// POST /chat：会话内对话（用户消息 + 助手回复均落库，流式返回纯文本）
import { randomUUID } from 'node:crypto';
import {
  agentDnas,
  agents,
  artifacts,
  conversations,
  type Db,
  type MemoryPolicy,
  type MessageContent,
  messages,
  promptVersions,
  type ReasoningMode,
} from '@agent-os/db';
import { chatRequestSchema } from '@agent-os/shared';
import { and, asc, eq, gt, inArray } from 'drizzle-orm';
import type { Context } from 'hono';
import { agentTurnToTextResponse, runAgentTurn } from '../agent-runner';
import { loadAgentTools } from '../agent-tools';
import type { RuntimeChatMessage } from '../langchain-runtime';
import { generateImage, generateVideo, saveGeneratedFile } from '../media';
import { resolveProviderProfile } from '../provider';

function partsToText(content: MessageContent): string {
  return content
    .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
    .map((p) => p.text)
    .join('\n');
}

function composeReasoningMode(mode: ReasoningMode): string {
  const strategyText: Record<ReasoningMode['strategy'], string> = {
    direct: '直接回答简单问题，不额外展开规划。',
    clarify_first: '需求不清楚时先提出必要澄清问题，再执行任务。',
    plan_then_answer: '复杂任务先内部规划步骤，再给出最终答案。',
    tool_first: '需要事实、素材或外部信息时，优先判断是否应使用工具。',
    react: '按“判断下一步-执行动作-观察结果-继续”的方式组织多步任务。',
  };
  const toolUseText: Record<ReasoningMode['toolUse'], string> = {
    none: '不要调用工具，只基于已提供上下文回答。',
    when_needed: '仅在任务需要时使用可用工具。',
    required: '回答前必须优先使用合适工具获取上下文或证据。',
  };
  const lines = [
    strategyText[mode.strategy],
    toolUseText[mode.toolUse],
    `工具循环最多 ${mode.maxIterations ?? 3} 轮，超过后停止并返回错误。`,
    mode.selfCheck ? '最终回答前检查是否满足 Rules、输出格式和用户目标。' : '',
    '不要暴露隐藏推理过程，只输出用户需要看到的结论、步骤或必要依据。',
  ].filter(Boolean);
  return `Reasoning Mode:\n${lines.map((line, i) => `${i + 1}. ${line}`).join('\n')}`;
}

function buildSystemPrompt(
  prompt: string,
  rules: string[],
  guidelines: string[],
  reasoningMode: ReasoningMode,
  skills: { name: string; description: string; enabled: boolean }[],
  tools: { id: string; name: string; description: string; enabled: boolean }[],
): string {
  const sections = [prompt.trim()];
  if (rules.length > 0) {
    sections.push(`Rules:\n${rules.map((rule, i) => `${i + 1}. ${rule}`).join('\n')}`);
  }
  if (guidelines.length > 0) {
    sections.push(
      `Guidelines:\n${guidelines.map((guideline, i) => `${i + 1}. ${guideline}`).join('\n')}`,
    );
  }
  const enabledSkills = skills.filter((skill) => skill.enabled !== false);
  if (enabledSkills.length > 0) {
    sections.push(
      `Skills:\n${enabledSkills
        .map((skill, i) => `${i + 1}. ${skill.name}：${skill.description}`)
        .join('\n')}`,
    );
  }
  const enabledTools = tools.filter((tool) => tool.enabled !== false);
  if (enabledTools.length > 0) {
    sections.push(
      `Available Tools:\n${enabledTools
        .map((tool, i) => `${i + 1}. ${tool.id}（${tool.name}）：${tool.description}`)
        .join('\n')}`,
    );
  }
  sections.push(composeReasoningMode(reasoningMode));
  return sections.join('\n\n');
}

function buildChatHistory(
  history: { role: string; content: MessageContent }[],
): RuntimeChatMessage[] {
  return history.flatMap((m) => {
    if (m.role !== 'user' && m.role !== 'assistant') return [];
    const text = partsToText(m.content);
    return text ? [{ role: m.role, content: text }] : [];
  });
}

async function artifactContext(db: Db, ids: string[]): Promise<string> {
  if (ids.length === 0) return '';
  const rows = await db.select().from(artifacts).where(inArray(artifacts.id, ids));
  const blocks = rows.map(
    (a) =>
      `【引用素材：${a.name}（类型：${a.type}）】\n${a.content ?? a.fileUrl ?? '(无文本内容)'}`,
  );
  return blocks.length > 0 ? `\n\n用户引用了以下素材作为上下文：\n${blocks.join('\n\n')}` : '';
}

export async function handleChat(c: Context, db: Db) {
  const parsed = chatRequestSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: '请求参数不合法' }, 400);
  const {
    conversationId,
    text,
    artifactIds,
    modelProfileId: requestedModelProfileId,
    clientRequestId,
    replaceMessageId,
  } = parsed.data;

  const [conversation] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .limit(1);
  if (!conversation) return c.json({ error: '会话不存在' }, 404);

  const [agent] = await db
    .select()
    .from(agents)
    .where(eq(agents.id, conversation.agentId))
    .limit(1);
  if (!agent || agent.deletedAt) return c.json({ error: 'Agent 不存在或已删除' }, 404);
  if (!agent.currentDnaId) return c.json({ error: '该 Agent 尚未完成配置（缺少 DNA）' }, 400);

  const [dna] = await db
    .select()
    .from(agentDnas)
    .where(eq(agentDnas.id, agent.currentDnaId))
    .limit(1);
  if (!dna) return c.json({ error: 'Agent 配置缺失' }, 400);
  const configuredModelIds = Array.from(
    new Set([...(dna.modelProfileId ? [dna.modelProfileId] : []), ...(dna.modelProfileIds ?? [])]),
  );
  const activeModelProfileId = requestedModelProfileId ?? dna.modelProfileId;

  if (!activeModelProfileId) {
    return c.json({ error: '该 Agent 未绑定模型 Provider，请到配置详情的「模型」tab 设置' }, 400);
  }
  if (!configuredModelIds.includes(activeModelProfileId)) {
    return c.json({ error: '所选模型不在当前 Agent 的模型列表中，请到配置详情调整' }, 400);
  }

  const [promptVersion] = await db
    .select()
    .from(promptVersions)
    .where(eq(promptVersions.id, dna.promptVersionId))
    .limit(1);
  const systemPrompt = buildSystemPrompt(
    promptVersion?.content ?? '你是一个乐于助人的 AI 助手。',
    dna.rules ?? [],
    dna.guidelines ?? [],
    dna.reasoningMode,
    dna.skills ?? [],
    dna.tools ?? [],
  );

  let profile: Awaited<ReturnType<typeof resolveProviderProfile>>;
  try {
    profile = await resolveProviderProfile(db, activeModelProfileId);
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : '模型解析失败' }, 400);
  }

  const refContext = await artifactContext(db, artifactIds);

  // 落库：用户消息。编辑重发时复用原消息 id，并清掉该轮之后的旧回复/后续消息。
  const userMessageId = replaceMessageId ?? clientRequestId ?? randomUUID();
  const userContent: MessageContent = [
    { type: 'text', text },
    ...artifactIds.map((id) => ({ type: 'artifact-ref' as const, artifactId: id })),
  ];

  if (replaceMessageId) {
    const replacedAt = new Date();
    const [targetMessage] = await db
      .select()
      .from(messages)
      .where(and(eq(messages.id, replaceMessageId), eq(messages.conversationId, conversationId)))
      .limit(1);
    if (targetMessage?.role !== 'user') {
      return c.json({ error: '只能编辑当前会话中的用户消息' }, 400);
    }

    const staleMessages = await db
      .select({ id: messages.id })
      .from(messages)
      .where(
        and(
          eq(messages.conversationId, conversationId),
          gt(messages.createdAt, targetMessage.createdAt),
        ),
      );
    const staleIds = staleMessages.map((m) => m.id);
    if (staleIds.length > 0) {
      await db
        .update(artifacts)
        .set({ conversationId: null, messageId: null })
        .where(inArray(artifacts.messageId, staleIds));
      await db.delete(messages).where(inArray(messages.id, staleIds));
    }

    await db
      .update(messages)
      .set({ content: userContent, artifactRefs: artifactIds, createdAt: replacedAt })
      .where(eq(messages.id, replaceMessageId));
  } else {
    const [insertedUserMessage] = await db
      .insert(messages)
      .values({
        id: userMessageId,
        conversationId,
        role: 'user',
        content: userContent,
        artifactRefs: artifactIds,
      })
      .onConflictDoNothing()
      .returning({ id: messages.id });
    if (!insertedUserMessage) {
      return c.text('', 200, { 'x-duplicate-request': '1' });
    }
  }

  // 会话标题：首条消息自动命名 + 更新时间
  await db
    .update(conversations)
    .set({
      updatedAt: new Date(),
      ...(conversation.title ? {} : { title: text.slice(0, 30) }),
    })
    .where(eq(conversations.id, conversationId));

  const assistantMessageId = randomUUID();

  // 图像/视频模态：同步生成 → 回传素材 → 落库带 artifact-ref 的助手消息
  if (profile.modality === 'image' || profile.modality === 'video') {
    const prompt = text + refContext;
    try {
      const file =
        profile.modality === 'image'
          ? await generateImage(profile, prompt)
          : await generateVideo(profile, prompt);
      const saved = await saveGeneratedFile(file, {
        name: `${agent.name}-${profile.modality === 'image' ? '图片' : '视频'}-${Date.now()}`,
        agentId: conversation.agentId,
        conversationId,
        content: text,
      });
      const note =
        profile.modality === 'image'
          ? '已生成图片，已自动保存为素材。'
          : '已生成视频，已自动保存为素材。';
      await db.insert(messages).values({
        id: assistantMessageId,
        conversationId,
        role: 'assistant',
        content: [
          { type: 'text', text: note },
          { type: 'artifact-ref', artifactId: saved.id },
        ],
        artifactRefs: [saved.id],
      });
      await db
        .update(artifacts)
        .set({ messageId: assistantMessageId })
        .where(eq(artifacts.id, saved.id));
      return c.text(note, 200, { 'x-message-id': assistantMessageId });
    } catch (err) {
      return c.json(
        {
          error:
            err instanceof Error
              ? err.message
              : `${profile.modality === 'image' ? '图像' : '视频'}生成失败`,
        },
        502,
      );
    }
  }

  // 文本模态：历史消息（短期记忆：窗口截断）+ 流式对话
  const memory = (dna.memoryPolicy ?? {}) as MemoryPolicy;
  const windowSize = memory.shortTerm?.type === 'window' ? memory.shortTerm.maxMessages : 30;
  const history = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(asc(messages.createdAt));
  const windowed = history.filter((m) => m.id !== userMessageId).slice(-windowSize);

  const executableTools =
    dna.reasoningMode.toolUse === 'none'
      ? []
      : loadAgentTools(dna.tools ?? [], { db, artifactIds });
  if (dna.reasoningMode.toolUse === 'required' && executableTools.length === 0) {
    return c.json({ error: '当前 Agent 没有可执行工具，请先在「模型与绑定」中启用工具' }, 400);
  }

  const turn = await runAgentTurn({
    modelProfile: profile,
    systemPrompt,
    history: buildChatHistory(windowed),
    input: text + refContext,
    tools: executableTools,
    maxIterations: dna.reasoningMode.maxIterations ?? 3,
    verboseTrace: dna.reasoningMode.verboseTrace ?? false,
  });

  return agentTurnToTextResponse(turn, {
    headers: { 'x-message-id': assistantMessageId },
    onFinish: async ({ text: fullText, usage }) => {
      await db.insert(messages).values({
        id: assistantMessageId,
        conversationId,
        role: 'assistant',
        content: [{ type: 'text', text: fullText }],
        tokenUsage: {
          promptTokens: usage?.promptTokens ?? 0,
          completionTokens: usage?.completionTokens ?? 0,
          totalTokens: usage?.totalTokens ?? 0,
        },
        toolCalls: turn.trace && turn.trace.length > 0 ? turn.trace : undefined,
      });
    },
  });
}
