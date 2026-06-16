import { type Db, getDb } from '@agent-os/db';
import { initTRPC } from '@trpc/server';
import superjson from 'superjson';

export type TrpcContext = {
  db: Db;
};

export function createContext(): TrpcContext {
  return { db: getDb() };
}

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;
