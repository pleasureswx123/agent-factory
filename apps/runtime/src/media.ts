// 图像/视频生成：按模型档案调用对应 API，生成文件回传 web /api/upload 登记为素材
import type { ModelProfile } from './provider';

const WEB_URL = process.env.WEB_URL ?? 'http://127.0.0.1:3000';

type GeneratedFile = { buffer: Uint8Array; mime: string; ext: string };

function joinUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/, '')}${path}`;
}

function authHeaders(profile: ModelProfile): Record<string, string> {
  return {
    'content-type': 'application/json',
    authorization: `Bearer ${profile.apiKey}`,
  };
}

async function readApiError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { error?: { message?: string }; message?: string };
    return data.error?.message ?? data.message ?? `HTTP ${res.status}`;
  } catch {
    return `HTTP ${res.status}`;
  }
}

/** 下载远程文件（生成接口返回 url 时），按 content-type 推断扩展名 */
async function downloadFile(
  url: string,
  fallback: { mime: string; ext: string },
): Promise<GeneratedFile> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`下载生成文件失败（HTTP ${res.status}）`);
  const mime = res.headers.get('content-type')?.split(';')[0] || fallback.mime;
  const extByMime: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/webp': 'webp',
    'video/mp4': 'mp4',
  };
  return {
    buffer: new Uint8Array(await res.arrayBuffer()),
    mime,
    ext: extByMime[mime] ?? fallback.ext,
  };
}

/** 图像生成：OpenAI 兼容 images/generations（gpt-image 系列返回 b64_json，方舟 seedream 系列默认返回 url） */
export async function generateImage(profile: ModelProfile, prompt: string): Promise<GeneratedFile> {
  const res = await fetch(joinUrl(profile.baseUrl, '/images/generations'), {
    method: 'POST',
    headers: authHeaders(profile),
    body: JSON.stringify({ model: profile.modelId, prompt }),
  });
  if (!res.ok) throw new Error(`图像生成失败：${await readApiError(res)}`);
  const data = (await res.json()) as { data?: { b64_json?: string; url?: string }[] };
  const item = data.data?.[0];
  if (item?.b64_json) {
    return {
      buffer: Uint8Array.from(Buffer.from(item.b64_json, 'base64')),
      mime: 'image/png',
      ext: 'png',
    };
  }
  if (item?.url) return downloadFile(item.url, { mime: 'image/png', ext: 'png' });
  throw new Error('图像生成接口未返回图片数据');
}

/** 视频生成：火山方舟 contents/generations/tasks 异步任务（创建 + 轮询，如 doubao-seedance 系列） */
export async function generateVideo(profile: ModelProfile, prompt: string): Promise<GeneratedFile> {
  const createRes = await fetch(joinUrl(profile.baseUrl, '/contents/generations/tasks'), {
    method: 'POST',
    headers: authHeaders(profile),
    body: JSON.stringify({
      model: profile.modelId,
      content: [{ type: 'text', text: prompt }],
    }),
  });
  if (!createRes.ok) throw new Error(`创建视频生成任务失败：${await readApiError(createRes)}`);
  const { id: taskId } = (await createRes.json()) as { id?: string };
  if (!taskId) throw new Error('视频生成任务创建后未返回任务 ID');

  // 轮询任务状态，最长等待 10 分钟
  const deadline = Date.now() + 10 * 60_000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 5000));
    const statusRes = await fetch(
      joinUrl(profile.baseUrl, `/contents/generations/tasks/${taskId}`),
      {
        headers: authHeaders(profile),
      },
    );
    if (!statusRes.ok) throw new Error(`查询视频生成任务失败：${await readApiError(statusRes)}`);
    const task = (await statusRes.json()) as {
      status?: string;
      content?: { video_url?: string };
      error?: { message?: string };
    };
    if (task.status === 'succeeded') {
      if (!task.content?.video_url) throw new Error('视频生成任务完成但未返回视频地址');
      return downloadFile(task.content.video_url, { mime: 'video/mp4', ext: 'mp4' });
    }
    if (task.status === 'failed' || task.status === 'cancelled') {
      throw new Error(
        `视频生成任务${task.status === 'failed' ? '失败' : '已取消'}：${task.error?.message ?? '未知原因'}`,
      );
    }
  }
  throw new Error('视频生成超时（10 分钟），请稍后在 Provider 控制台确认任务状态');
}

/** 将生成文件回传 web /api/upload：落盘 data/uploads 并登记为 artifact */
export async function saveGeneratedFile(
  file: GeneratedFile,
  opts: { name: string; agentId?: string | null; conversationId?: string | null },
): Promise<{ id: string; name: string; fileUrl: string | null }> {
  const fd = new FormData();
  fd.append(
    'file',
    new Blob([file.buffer.buffer as ArrayBuffer], { type: file.mime }),
    `${opts.name}.${file.ext}`,
  );
  if (opts.agentId) fd.append('agentId', opts.agentId);
  if (opts.conversationId) fd.append('conversationId', opts.conversationId);
  const res = await fetch(`${WEB_URL}/api/upload`, { method: 'POST', body: fd });
  if (!res.ok) throw new Error('生成文件保存为素材失败，请确认 web 服务已启动');
  return (await res.json()) as { id: string; name: string; fileUrl: string | null };
}
