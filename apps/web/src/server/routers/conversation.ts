import { conversations, messages } from '@agent-os/db';
import {
  createConversationSchema,
  DEFAULT_USER_ID,
  renameConversationSchema,
} from '@agent-os/shared';
import { TRPCError } from '@trpc/server';
import { asc, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { publicProcedure, router } from '../trpc';

export const conversationRouter = router({
  list: publicProcedure
    .input(z.object({ agentId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select()
        .from(conversations)
        .where(eq(conversations.agentId, input.agentId))
        .orderBy(desc(conversations.updatedAt));
    }),

  create: publicProcedure.input(createConversationSchema).mutation(async ({ ctx, input }) => {
    const [created] = await ctx.db
      .insert(conversations)
      .values({
        agentId: input.agentId,
        ownerId: DEFAULT_USER_ID,
        title: input.title ?? null,
      })
      .returning();
    if (!created) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: '创建会话失败' });
    return created;
  }),

  rename: publicProcedure.input(renameConversationSchema).mutation(async ({ ctx, input }) => {
    const [updated] = await ctx.db
      .update(conversations)
      .set({ title: input.title, updatedAt: new Date() })
      .where(eq(conversations.id, input.conversationId))
      .returning();
    if (!updated) throw new TRPCError({ code: 'NOT_FOUND', message: '会话不存在' });
    return updated;
  }),

  delete: publicProcedure
    .input(z.object({ conversationId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.delete(conversations).where(eq(conversations.id, input.conversationId));
      return { ok: true };
    }),

  messages: publicProcedure
    .input(z.object({ conversationId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select()
        .from(messages)
        .where(eq(messages.conversationId, input.conversationId))
        .orderBy(asc(messages.createdAt));
    }),
});
