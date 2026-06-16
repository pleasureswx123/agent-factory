import { MODEL_MODALITY_LABELS } from '@agent-os/shared';
import { type ClassValue, clsx } from 'clsx';

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

/** Provider 下拉项显示文案：名称 · 模型 ID（非文本模态附加能力标识），便于同名 Provider 区分 */
export function providerOptionLabel(p: { name: string; config: unknown }): string {
  const cfg = (p.config ?? {}) as { modelId?: string; modality?: string };
  let label = p.name;
  if (cfg.modelId) label += ` · ${cfg.modelId}`;
  const modality = cfg.modality ?? 'text';
  if (modality !== 'text') label += `（${MODEL_MODALITY_LABELS[modality] ?? modality}）`;
  return label;
}

export function formatTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const RUNTIME_URL = process.env.NEXT_PUBLIC_RUNTIME_URL ?? 'http://127.0.0.1:4001';

/** 读取 runtime 的流式纯文本响应，逐块回调 */
export async function consumeTextStream(
  res: Response,
  onChunk: (fullText: string) => void,
): Promise<string> {
  if (!res.body) return '';
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let full = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    full += decoder.decode(value, { stream: true });
    onChunk(full);
  }
  full += decoder.decode();
  onChunk(full);
  return full;
}

/** 非 2xx 时尝试解析 runtime 返回的 { error } */
export async function readRuntimeError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { error?: string };
    return data.error ?? `请求失败（${res.status}）`;
  } catch {
    return `请求失败（${res.status}）`;
  }
}
