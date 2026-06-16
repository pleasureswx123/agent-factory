import { agentDnas, agents, type Db, resources, secrets } from '@agent-os/db';
import { createResourceSchema, DEFAULT_USER_ID, updateResourceSchema } from '@agent-os/shared';
import { encryptSecret, secretHint } from '@agent-os/shared/crypto';
import { TRPCError } from '@trpc/server';
import { desc, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { publicProcedure, router } from '../trpc';

async function createSecretRecord(db: Db, alias: string, value: string) {
  const enc = encryptSecret(value);
  const [created] = await db
    .insert(secrets)
    .values({
      ownerId: DEFAULT_USER_ID,
      alias,
      ciphertext: enc.ciphertext,
      iv: enc.iv,
      authTag: enc.authTag,
      encryptedDek: enc.encryptedDek,
      hint: secretHint(value),
    })
    .returning();
  if (!created) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: '保存密钥失败' });
  return created;
}

export const resourceRouter = router({
  /** 资源清单；密钥只回传 hint */
  list: publicProcedure
    .input(
      z.object({
        type: z.enum(['provider', 'api_key', 'skill', 'tool', 'knowledge_base']).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const rows = input.type
        ? await ctx.db
            .select()
            .from(resources)
            .where(eq(resources.type, input.type))
            .orderBy(desc(resources.createdAt))
        : await ctx.db.select().from(resources).orderBy(desc(resources.createdAt));

      const out = [];
      for (const r of rows) {
        let hint: string | null = null;
        if (r.secretId) {
          const [s] = await ctx.db
            .select({ hint: secrets.hint })
            .from(secrets)
            .where(eq(secrets.id, r.secretId))
            .limit(1);
          hint = s?.hint ?? null;
        }
        out.push({ ...r, secretHint: hint });
      }
      return out;
    }),

  create: publicProcedure.input(createResourceSchema).mutation(async ({ ctx, input }) => {
    let secretId: string | null = null;
    if (input.secretValue) {
      const secret = await createSecretRecord(ctx.db, input.name, input.secretValue);
      secretId = secret.id;
    }
    const [created] = await ctx.db
      .insert(resources)
      .values({
        ownerId: DEFAULT_USER_ID,
        type: input.type,
        name: input.name,
        status: 'active',
        config: input.config as Record<string, unknown>,
        secretId,
      })
      .returning();
    if (!created) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: '创建资源失败' });
    return created;
  }),

  update: publicProcedure.input(updateResourceSchema).mutation(async ({ ctx, input }) => {
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (input.name !== undefined) patch.name = input.name;
    if (input.status !== undefined) patch.status = input.status;
    if (input.config !== undefined) patch.config = input.config;
    if (input.secretValue) {
      const secret = await createSecretRecord(ctx.db, input.name ?? 'secret', input.secretValue);
      patch.secretId = secret.id;
    }
    const [updated] = await ctx.db
      .update(resources)
      .set(patch)
      .where(eq(resources.id, input.resourceId))
      .returning();
    if (!updated) throw new TRPCError({ code: 'NOT_FOUND', message: '资源不存在' });
    return updated;
  }),

  /** 设为 Factory 默认模型：标记目标 provider 的 config.factoryDefault，并清除其他 provider 的标记 */
  setFactoryDefault: publicProcedure
    .input(z.object({ resourceId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const providers = await ctx.db.select().from(resources).where(eq(resources.type, 'provider'));
      const target = providers.find((p) => p.id === input.resourceId);
      if (!target) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '模型 Provider 不存在' });
      }
      if (target.status === 'disabled') {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: '该 Provider 已停用，无法设为默认',
        });
      }
      if (((target.config as { modality?: string }).modality ?? 'text') !== 'text') {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'Factory 对话仅支持文本对话模型，图像/视频模型无法设为默认',
        });
      }
      for (const p of providers) {
        const cfg = { ...(p.config as Record<string, unknown>) };
        const shouldBeDefault = p.id === input.resourceId;
        if ((cfg.factoryDefault === true) === shouldBeDefault) continue;
        if (shouldBeDefault) {
          cfg.factoryDefault = true;
        } else {
          delete cfg.factoryDefault;
        }
        await ctx.db
          .update(resources)
          .set({ config: cfg, updatedAt: new Date() })
          .where(eq(resources.id, p.id));
      }
      return { ok: true };
    }),

  /** 删除前检查是否被未删除 Agent 的当前 DNA 引用 */
  delete: publicProcedure
    .input(z.object({ resourceId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const activeAgents = await ctx.db
        .select({ id: agents.id, name: agents.name, currentDnaId: agents.currentDnaId })
        .from(agents)
        .where(isNull(agents.deletedAt));
      const dnaIds = activeAgents.map((a) => a.currentDnaId).filter((v): v is string => !!v);
      if (dnaIds.length) {
        const dnas = await ctx.db.select().from(agentDnas);
        const current = dnas.filter((d) => dnaIds.includes(d.id));
        const used = current.some(
          (d) =>
            d.modelProfileId === input.resourceId ||
            d.skillIds.includes(input.resourceId) ||
            d.toolIds.includes(input.resourceId) ||
            d.knowledgeBaseIds.includes(input.resourceId),
        );
        if (used) {
          throw new TRPCError({
            code: 'PRECONDITION_FAILED',
            message: '该资源正在被 Agent 引用，请先在 Agent 配置中解除绑定',
          });
        }
      }
      await ctx.db.delete(resources).where(eq(resources.id, input.resourceId));
      return { ok: true };
    }),
});
