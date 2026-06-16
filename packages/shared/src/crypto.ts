// 仅服务端使用：AES-256-GCM envelope encryption
// 主密钥存 ~/.agent-os/master.key（首次使用自动生成），DEK 逐密钥随机。
// 注意：不要在客户端组件中导入本模块（依赖 node:crypto / node:fs）。

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

export type EncryptedSecret = {
  ciphertext: string;
  iv: string;
  authTag: string;
  encryptedDek: string;
};

function masterKeyPath(): string {
  return process.env.AGENT_OS_MASTER_KEY_FILE ?? join(homedir(), '.agent-os', 'master.key');
}

let cachedMasterKey: Buffer | null = null;

/** 读取主密钥；不存在则生成 32 字节随机密钥并落盘 */
export function getMasterKey(): Buffer {
  if (cachedMasterKey) return cachedMasterKey;
  const path = masterKeyPath();
  if (existsSync(path)) {
    cachedMasterKey = Buffer.from(readFileSync(path, 'utf8').trim(), 'hex');
  } else {
    const key = randomBytes(32);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, key.toString('hex'), { mode: 0o600 });
    cachedMasterKey = key;
  }
  if (cachedMasterKey.length !== 32) {
    throw new Error('master key 必须是 32 字节 hex');
  }
  return cachedMasterKey;
}

function aesEncrypt(key: Buffer, plaintext: Buffer): { iv: Buffer; ct: Buffer; tag: Buffer } {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return { iv, ct, tag: cipher.getAuthTag() };
}

function aesDecrypt(key: Buffer, iv: Buffer, ct: Buffer, tag: Buffer): Buffer {
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]);
}

/** 加密明文密钥：随机 DEK 加密数据，主密钥加密 DEK */
export function encryptSecret(plaintext: string): EncryptedSecret {
  const dek = randomBytes(32);
  const data = aesEncrypt(dek, Buffer.from(plaintext, 'utf8'));
  const wrapped = aesEncrypt(getMasterKey(), dek);
  return {
    ciphertext: data.ct.toString('base64'),
    iv: data.iv.toString('base64'),
    authTag: data.tag.toString('base64'),
    // iv.ct.tag 三段 base64 拼接
    encryptedDek: `${wrapped.iv.toString('base64')}.${wrapped.ct.toString('base64')}.${wrapped.tag.toString('base64')}`,
  };
}

/** 解密 secrets 表中的一条记录 */
export function decryptSecret(record: EncryptedSecret): string {
  const [wIv, wCt, wTag] = record.encryptedDek.split('.');
  if (!wIv || !wCt || !wTag) throw new Error('encryptedDek 格式不正确');
  const dek = aesDecrypt(
    getMasterKey(),
    Buffer.from(wIv, 'base64'),
    Buffer.from(wCt, 'base64'),
    Buffer.from(wTag, 'base64'),
  );
  return aesDecrypt(
    dek,
    Buffer.from(record.iv, 'base64'),
    Buffer.from(record.ciphertext, 'base64'),
    Buffer.from(record.authTag, 'base64'),
  ).toString('utf8');
}

/** 生成 UI 展示用 hint，例如 sk-****1234 */
export function secretHint(plaintext: string): string {
  if (plaintext.length <= 8) return '****';
  return `${plaintext.slice(0, 3)}****${plaintext.slice(-4)}`;
}
