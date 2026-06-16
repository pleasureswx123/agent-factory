import { artifacts, conversations } from '@agent-os/db';
import { createArtifactSchema, DEFAULT_USER_ID } from '@agent-os/shared';
import { TRPCError } from '@trpc/server';
import { desc, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { publicProcedure, router } from '../trpc';

export const artifactRouter = router({
  /** 按 Agent 查素材；附带来源会话标题 */
  list: publicProcedure
    .input(z.object({ agentId: z.string().uuid().optional() }))
    .query(async ({ ctx, input }) => {
      const rows = input.agentId
        ? await ctx.db
            .select()
            .from(artifacts)
            .where(eq(artifacts.agentId, input.agentId))
            .orderBy(desc(artifacts.createdAt))
        : await ctx.db.select().from(artifacts).orderBy(desc(artifacts.createdAt));

      const convIds = [
        ...new Set(rows.map((r) => r.conversationId).filter((v): v is string => !!v)),
      ];
      const convs = convIds.length
        ? await ctx.db
            .select({ id: conversations.id, title: conversations.title })
            .from(conversations)
            .where(inArray(conversations.id, convIds))
        : [];
      const titleMap = new Map(convs.map((c) => [c.id, c.title]));
      return rows.map((r) => ({
        ...r,
        conversationTitle: r.conversationId ? (titleMap.get(r.conversationId) ?? null) : null,
      }));
    }),

  get: publicProcedure
    .input(z.object({ artifactId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [row] = await ctx.db
        .select()
        .from(artifacts)
        .where(eq(artifacts.id, input.artifactId))
        .limit(1);
      if (!row) throw new TRPCError({ code: 'NOT_FOUND', message: '素材不存在' });
      return row;
    }),

  create: publicProcedure.input(createArtifactSchema).mutation(async ({ ctx, input }) => {
    const [created] = await ctx.db
      .insert(artifacts)
      .values({
        ownerId: DEFAULT_USER_ID,
        agentId: input.agentId ?? null,
        conversationId: input.conversationId ?? null,
        messageId: input.messageId ?? null,
        name: input.name,
        type: input.type,
        content: input.content,
        fileUrl: input.fileUrl,
        thumbnailUrl: input.thumbnailUrl,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
      })
      .returning();
    if (!created) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: '保存素材失败' });
    return created;
  }),

  rename: publicProcedure
    .input(z.object({ artifactId: z.string().uuid(), name: z.string().min(1).max(256) }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(artifacts)
        .set({ name: input.name })
        .where(eq(artifacts.id, input.artifactId))
        .returning();
      if (!updated) throw new TRPCError({ code: 'NOT_FOUND', message: '素材不存在' });
      return updated;
    }),

  delete: publicProcedure
    .input(z.object({ artifactId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.delete(artifacts).where(eq(artifacts.id, input.artifactId));
      return { ok: true };
    }),
});
