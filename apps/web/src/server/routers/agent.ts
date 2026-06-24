import {
  agentDnas,
  agents,
  artifacts,
  conversations,
  type Db,
  promptVersions,
  resources,
  secrets,
} from '@agent-os/db';
import {
  createAgentModelProviderSchema,
  createAgentSchema,
  DEFAULT_USER_ID,
  type DnaConfigInput,
  deleteAgentModelProviderSchema,
  updateAgentBasicSchema,
  updateAgentDnaSchema,
  updateAgentModelProviderSchema,
} from '@agent-os/shared';
import { encryptSecret, secretHint } from '@agent-os/shared/crypto';
import { TRPCError } from '@trpc/server';
import { and, desc, eq, inArray, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { publicProcedure, router } from '../trpc';

/** 新建 prompt 版本（agent 内自增） */
async function nextPromptVersion(db: Db, agentId: string, content: string, note?: string) {
  const [latest] = await db
    .select({ version: promptVersions.version })
    .from(promptVersions)
    .where(eq(promptVersions.agentId, agentId))
    .orderBy(desc(promptVersions.version))
    .limit(1);
  const [created] = await db
    .insert(promptVersions)
    .values({
      agentId,
      version: (latest?.version ?? 0) + 1,
      content,
      changeNote: note,
      authorId: DEFAULT_USER_ID,
    })
    .returning();
  if (!created)
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: '创建 Prompt 版本失败' });
  return created;
}

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

async function currentAgentDnaForEdit(db: Db, agentId: string) {
  const [agent] = await db
    .select()
    .from(agents)
    .where(and(eq(agents.id, agentId), isNull(agents.deletedAt)))
    .limit(1);
  if (!agent) throw new TRPCError({ code: 'NOT_FOUND', message: 'Agent 不存在' });
  if (!agent.currentDnaId) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Agent 配置缺失' });

  const [currentDna] = await db
    .select()
    .from(agentDnas)
    .where(eq(agentDnas.id, agent.currentDnaId))
    .limit(1);
  if (!currentDna) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Agent 配置缺失' });

  const [prompt] = await db
    .select()
    .from(promptVersions)
    .where(eq(promptVersions.id, currentDna.promptVersionId))
    .limit(1);

  return {
    agent,
    currentDna,
    dnaInput: {
      prompt: prompt?.content ?? '',
      modelProfileId: currentDna.modelProfileId,
      modelProfileIds: currentDna.modelProfileIds,
      rules: currentDna.rules,
      guidelines: currentDna.guidelines,
      testCases: currentDna.testCases,
      evaluationCriteria: currentDna.evaluationCriteria,
      skills: currentDna.skills,
      tools: currentDna.tools,
      skillIds: currentDna.skillIds,
      toolIds: currentDna.toolIds,
      knowledgeBaseIds: currentDna.knowledgeBaseIds,
      reasoningMode: currentDna.reasoningMode,
      memoryPolicy: currentDna.memoryPolicy,
    } satisfies DnaConfigInput,
  };
}

/** 新建 DNA 版本并设为 Agent 当前配置 */
async function createDnaVersion(
  db: Db,
  agentId: string,
  promptVersionId: string,
  dna: DnaConfigInput,
) {
  const [latest] = await db
    .select({ version: agentDnas.version })
    .from(agentDnas)
    .where(eq(agentDnas.agentId, agentId))
    .orderBy(desc(agentDnas.version))
    .limit(1);
  const [created] = await db
    .insert(agentDnas)
    .values({
      agentId,
      version: (latest?.version ?? 0) + 1,
      promptVersionId,
      modelProfileId: dna.modelProfileId ?? null,
      modelProfileIds: dna.modelProfileIds,
      rules: dna.rules,
      guidelines: dna.guidelines,
      testCases: dna.testCases,
      evaluationCriteria: dna.evaluationCriteria,
      skills: dna.skills,
      tools: dna.tools,
      skillIds: dna.skillIds,
      toolIds: dna.toolIds,
      knowledgeBaseIds: dna.knowledgeBaseIds,
      reasoningMode: dna.reasoningMode,
      memoryPolicy: dna.memoryPolicy,
      status: 'published',
    })
    .returning();
  if (!created) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: '创建 DNA 失败' });
  await db
    .update(agents)
    .set({ currentDnaId: created.id, updatedAt: new Date() })
    .where(eq(agents.id, agentId));
  return created;
}

export const agentRouter = router({
  list: publicProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select()
      .from(agents)
      .where(isNull(agents.deletedAt))
      .orderBy(desc(agents.updatedAt));
  }),

  get: publicProcedure
    .input(z.object({ agentId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [agent] = await ctx.db
        .select()
        .from(agents)
        .where(and(eq(agents.id, input.agentId), isNull(agents.deletedAt)))
        .limit(1);
      if (!agent) throw new TRPCError({ code: 'NOT_FOUND', message: 'Agent 不存在' });

      let dna = null;
      let prompt = null;
      if (agent.currentDnaId) {
        [dna] = await ctx.db
          .select()
          .from(agentDnas)
          .where(eq(agentDnas.id, agent.currentDnaId))
          .limit(1);
        if (dna) {
          [prompt] = await ctx.db
            .select()
            .from(promptVersions)
            .where(eq(promptVersions.id, dna.promptVersionId))
            .limit(1);
        }
      }

      const refIds = [
        ...(dna?.modelProfileId ? [dna.modelProfileId] : []),
        ...(dna?.modelProfileIds ?? []),
        ...(dna?.knowledgeBaseIds ?? []),
      ];
      const refs = refIds.length
        ? await ctx.db.select().from(resources).where(inArray(resources.id, refIds))
        : [];

      return { agent, dna: dna ?? null, prompt: prompt ?? null, boundResources: refs };
    }),

  create: publicProcedure.input(createAgentSchema).mutation(async ({ ctx, input }) => {
    const [agent] = await ctx.db
      .insert(agents)
      .values({
        ownerId: DEFAULT_USER_ID,
        name: input.name,
        description: input.description,
        status: input.status,
      })
      .returning();
    if (!agent) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: '创建 Agent 失败' });
    const pv = await nextPromptVersion(ctx.db, agent.id, input.dna.prompt, '初始版本');
    await createDnaVersion(ctx.db, agent.id, pv.id, input.dna);
    return agent;
  }),

  updateBasic: publicProcedure.input(updateAgentBasicSchema).mutation(async ({ ctx, input }) => {
    const [updated] = await ctx.db
      .update(agents)
      .set({
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(agents.id, input.agentId), isNull(agents.deletedAt)))
      .returning();
    if (!updated) throw new TRPCError({ code: 'NOT_FOUND', message: 'Agent 不存在' });
    return updated;
  }),

  /** 保存配置：prompt 有变化则生成新 Prompt 版本，并生成新 DNA 版本 */
  updateDna: publicProcedure.input(updateAgentDnaSchema).mutation(async ({ ctx, input }) => {
    const [agent] = await ctx.db
      .select()
      .from(agents)
      .where(and(eq(agents.id, input.agentId), isNull(agents.deletedAt)))
      .limit(1);
    if (!agent) throw new TRPCError({ code: 'NOT_FOUND', message: 'Agent 不存在' });

    let promptVersionId: string | null = null;
    if (agent.currentDnaId) {
      const [currentDna] = await ctx.db
        .select()
        .from(agentDnas)
        .where(eq(agentDnas.id, agent.currentDnaId))
        .limit(1);
      if (currentDna) {
        const [currentPrompt] = await ctx.db
          .select()
          .from(promptVersions)
          .where(eq(promptVersions.id, currentDna.promptVersionId))
          .limit(1);
        if (currentPrompt && currentPrompt.content === input.dna.prompt) {
          promptVersionId = currentPrompt.id;
        }
      }
    }
    if (!promptVersionId) {
      const pv = await nextPromptVersion(ctx.db, input.agentId, input.dna.prompt, input.changeNote);
      promptVersionId = pv.id;
    }
    return createDnaVersion(ctx.db, input.agentId, promptVersionId, input.dna);
  }),

  /** 软删除 Agent；删除会话上下文，但保留已沉淀素材资产并断开来源关系 */
  delete: publicProcedure
    .input(z.object({ agentId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(agents)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(eq(agents.id, input.agentId));
      await ctx.db
        .update(artifacts)
        .set({
          agentId: null,
          conversationId: null,
          messageId: null,
          sourceAgentDeleted: true,
        })
        .where(eq(artifacts.agentId, input.agentId));
      await ctx.db.delete(conversations).where(eq(conversations.agentId, input.agentId));
      return { ok: true };
    }),

  promptHistory: publicProcedure
    .input(z.object({ agentId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select()
        .from(promptVersions)
        .where(eq(promptVersions.agentId, input.agentId))
        .orderBy(desc(promptVersions.version));
    }),

  /** 将历史 Prompt 版本恢复为当前版本（生成新版本 + 新 DNA） */
  restorePromptVersion: publicProcedure
    .input(z.object({ agentId: z.string().uuid(), promptVersionId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [target] = await ctx.db
        .select()
        .from(promptVersions)
        .where(eq(promptVersions.id, input.promptVersionId))
        .limit(1);
      if (!target || target.agentId !== input.agentId) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Prompt 版本不存在' });
      }
      const [agent] = await ctx.db
        .select()
        .from(agents)
        .where(eq(agents.id, input.agentId))
        .limit(1);
      if (!agent?.currentDnaId)
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Agent 配置缺失' });
      const [currentDna] = await ctx.db
        .select()
        .from(agentDnas)
        .where(eq(agentDnas.id, agent.currentDnaId))
        .limit(1);
      if (!currentDna) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Agent 配置缺失' });

      const pv = await nextPromptVersion(
        ctx.db,
        input.agentId,
        target.content,
        `恢复自 v${target.version}`,
      );
      return createDnaVersion(ctx.db, input.agentId, pv.id, {
        prompt: target.content,
        modelProfileId: currentDna.modelProfileId,
        modelProfileIds: currentDna.modelProfileIds,
        rules: currentDna.rules,
        guidelines: currentDna.guidelines,
        testCases: currentDna.testCases,
        evaluationCriteria: currentDna.evaluationCriteria,
        skills: currentDna.skills,
        tools: currentDna.tools,
        skillIds: currentDna.skillIds,
        toolIds: currentDna.toolIds,
        knowledgeBaseIds: currentDna.knowledgeBaseIds,
        reasoningMode: currentDna.reasoningMode,
        memoryPolicy: currentDna.memoryPolicy,
      });
    }),

  createModelProvider: publicProcedure
    .input(createAgentModelProviderSchema)
    .mutation(async ({ ctx, input }) => {
      const { currentDna, dnaInput } = await currentAgentDnaForEdit(ctx.db, input.agentId);
      let secretId: string | null = null;
      if (input.secretValue) {
        const secret = await createSecretRecord(ctx.db, input.name, input.secretValue);
        secretId = secret.id;
      }
      const [created] = await ctx.db
        .insert(resources)
        .values({
          ownerId: DEFAULT_USER_ID,
          type: 'provider',
          name: input.name,
          status: 'active',
          config: {
            agentId: input.agentId,
            baseUrl: input.baseUrl,
            modelId: input.modelId,
            modality: input.modality,
          },
          secretId,
        })
        .returning();
      if (!created)
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: '创建模型 Provider 失败' });

      const modelProfileIds = Array.from(new Set([...dnaInput.modelProfileIds, created.id]));
      await createDnaVersion(ctx.db, input.agentId, currentDna.promptVersionId, {
        ...dnaInput,
        modelProfileId: dnaInput.modelProfileId ?? created.id,
        modelProfileIds,
      });
      return created;
    }),

  updateModelProvider: publicProcedure
    .input(updateAgentModelProviderSchema)
    .mutation(async ({ ctx, input }) => {
      const { currentDna, dnaInput } = await currentAgentDnaForEdit(ctx.db, input.agentId);
      const [provider] = await ctx.db
        .select()
        .from(resources)
        .where(eq(resources.id, input.resourceId))
        .limit(1);
      if (provider?.type !== 'provider') {
        throw new TRPCError({ code: 'NOT_FOUND', message: '模型 Provider 不存在' });
      }
      if (
        provider.id !== dnaInput.modelProfileId &&
        !dnaInput.modelProfileIds.includes(provider.id)
      ) {
        throw new TRPCError({ code: 'PRECONDITION_FAILED', message: '该模型不属于当前 Agent' });
      }

      const config = {
        ...(provider.config as Record<string, unknown>),
        agentId: input.agentId,
        baseUrl: input.baseUrl,
        modelId: input.modelId,
        modality: input.modality,
      };
      let resourceId = provider.id;
      let updated = provider;

      if ((provider.config as { agentId?: string }).agentId === input.agentId) {
        const patch: Record<string, unknown> = {
          name: input.name,
          config,
          updatedAt: new Date(),
        };
        if (input.secretValue) {
          const secret = await createSecretRecord(ctx.db, input.name, input.secretValue);
          patch.secretId = secret.id;
        }
        const [updatedProvider] = await ctx.db
          .update(resources)
          .set(patch)
          .where(eq(resources.id, provider.id))
          .returning();
        if (!updatedProvider) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: '更新模型 Provider 失败' });
        }
        updated = updatedProvider;
      } else {
        let secretId = provider.secretId;
        if (input.secretValue) {
          const secret = await createSecretRecord(ctx.db, input.name, input.secretValue);
          secretId = secret.id;
        }
        const [createdProvider] = await ctx.db
          .insert(resources)
          .values({
            ownerId: DEFAULT_USER_ID,
            type: 'provider',
            name: input.name,
            status: 'active',
            config,
            secretId,
          })
          .returning();
        if (!createdProvider) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: '创建模型 Provider 失败' });
        }
        updated = createdProvider;
        resourceId = createdProvider.id;

        const replacedModelIds = dnaInput.modelProfileIds.map((id) =>
          id === provider.id ? resourceId : id,
        );
        await createDnaVersion(ctx.db, input.agentId, currentDna.promptVersionId, {
          ...dnaInput,
          modelProfileId:
            dnaInput.modelProfileId === provider.id ? resourceId : dnaInput.modelProfileId,
          modelProfileIds: Array.from(new Set(replacedModelIds)),
        });
      }

      return updated;
    }),

  deleteModelProvider: publicProcedure
    .input(deleteAgentModelProviderSchema)
    .mutation(async ({ ctx, input }) => {
      const { currentDna, dnaInput } = await currentAgentDnaForEdit(ctx.db, input.agentId);
      const [provider] = await ctx.db
        .select()
        .from(resources)
        .where(eq(resources.id, input.resourceId))
        .limit(1);
      if (provider?.type !== 'provider') {
        throw new TRPCError({ code: 'NOT_FOUND', message: '模型 Provider 不存在' });
      }
      if (
        provider.id !== dnaInput.modelProfileId &&
        !dnaInput.modelProfileIds.includes(provider.id)
      ) {
        throw new TRPCError({ code: 'PRECONDITION_FAILED', message: '该模型不属于当前 Agent' });
      }

      const modelProfileIds = dnaInput.modelProfileIds.filter((id) => id !== input.resourceId);
      await createDnaVersion(ctx.db, input.agentId, currentDna.promptVersionId, {
        ...dnaInput,
        modelProfileId:
          dnaInput.modelProfileId === input.resourceId
            ? (modelProfileIds[0] ?? null)
            : dnaInput.modelProfileId,
        modelProfileIds,
      });

      if ((provider.config as { agentId?: string }).agentId === input.agentId) {
        await ctx.db.delete(resources).where(eq(resources.id, input.resourceId));
      }
      return { ok: true };
    }),
});
