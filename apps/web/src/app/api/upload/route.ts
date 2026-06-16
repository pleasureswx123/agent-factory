// 本地文件上传：保存到 data/uploads/，并登记为素材（artifact）
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { artifacts, getDb } from '@agent-os/db';
import { DEFAULT_USER_ID } from '@agent-os/shared';
import { NextResponse } from 'next/server';

const UPLOAD_DIR = path.join(process.cwd(), 'data', 'uploads');

/** 由 MIME 推断素材类型 */
function detectType(mime: string): 'image' | 'audio' | 'video' | 'json' | 'text' | 'file' {
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime.startsWith('video/')) return 'video';
  if (mime === 'application/json') return 'json';
  if (mime.startsWith('text/')) return 'text';
  return 'file';
}

export async function POST(req: Request) {
  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: '缺少文件' }, { status: 400 });
  }
  const agentId = (form.get('agentId') as string | null) || null;
  const conversationId = (form.get('conversationId') as string | null) || null;

  const mime = file.type || 'application/octet-stream';
  const type = detectType(mime);
  const buffer = Buffer.from(await file.arrayBuffer());

  // 文本/JSON 直接入库 content；其余落盘并存 fileUrl
  let content: string | null = null;
  let fileUrl: string | null = null;
  if (type === 'text' || type === 'json') {
    content = buffer.toString('utf-8');
  } else {
    await mkdir(UPLOAD_DIR, { recursive: true });
    const safeName = `${randomUUID()}-${file.name.replace(/[^\w.\-\u4e00-\u9fa5]/g, '_')}`;
    await writeFile(path.join(UPLOAD_DIR, safeName), buffer);
    fileUrl = `/api/files/${safeName}`;
  }

  const db = getDb();
  const [created] = await db
    .insert(artifacts)
    .values({
      ownerId: DEFAULT_USER_ID,
      agentId,
      conversationId,
      name: file.name,
      type,
      content,
      fileUrl,
      mimeType: mime,
      sizeBytes: buffer.length,
    })
    .returning();

  if (!created) {
    return NextResponse.json({ error: '保存素材失败' }, { status: 500 });
  }
  return NextResponse.json(created);
}
