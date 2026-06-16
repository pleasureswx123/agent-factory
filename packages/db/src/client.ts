// Drizzle + postgres-js 客户端（web / runtime 共用）
// 单例缓存，避免 Next.js dev 热重载时连接数膨胀。

import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

export type Db = PostgresJsDatabase<typeof schema>;

const globalForDb = globalThis as unknown as { __agentOsDb?: Db };

export function getDb(): Db {
  if (globalForDb.__agentOsDb) return globalForDb.__agentOsDb;
  const url = process.env.DATABASE_URL ?? 'postgres://postgres:postgres@127.0.0.1:5432/agentos';
  const client = postgres(url, { max: 10 });
  const db = drizzle(client, { schema });
  globalForDb.__agentOsDb = db;
  return db;
}
