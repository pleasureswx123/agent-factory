// 提供 data/uploads/ 下的本地文件（仅限单层文件名，防目录穿越）
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';

const UPLOAD_DIR = path.join(process.cwd(), 'data', 'uploads');

const MIME_BY_EXT: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.mp4': 'video/mp4',
  '.pdf': 'application/pdf',
};

export async function GET(_req: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const safeName = path.basename(name);
  try {
    const data = await readFile(path.join(UPLOAD_DIR, safeName));
    const ext = path.extname(safeName).toLowerCase();
    return new NextResponse(new Uint8Array(data), {
      headers: {
        'content-type': MIME_BY_EXT[ext] ?? 'application/octet-stream',
        'cache-control': 'public, max-age=31536000, immutable',
      },
    });
  } catch {
    return NextResponse.json({ error: '文件不存在' }, { status: 404 });
  }
}
