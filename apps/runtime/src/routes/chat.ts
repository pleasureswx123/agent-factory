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
} from '@agent-os/db';
import { chatRequestSchema } from '@agent-os/shared';
import { type ModelMessage, streamText } from 'ai';
import { asc, eq, inArray } from 'drizzle-orm';
import type { Context } from 'hono';
import { generateImage, generateVideo, saveGeneratedFile } from '../media';
import { buildLanguageModel, resolveProviderProfile } from '../provider';

function partsToText(content: MessageContent): string {
  return content
    .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
    .map((p) => p.text)
    .join('\n');
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
  const { conversationId, text, artifactIds } = parsed.data;

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
  if (!dna.modelProfileId) {
    return c.json({ error: '该 Agent 未绑定模型 Provider，请到配置详情的「模型」tab 设置' }, 400);
  }

  const [promptVersion] = await db
    .select()
    .from(promptVersions)
    .where(eq(promptVersions.id, dna.promptVersionId))
    .limit(1);
  const systemPrompt = promptVersion?.content ?? '你是一个乐于助人的 AI 助手。';

  let profile: Awaited<ReturnType<typeof resolveProviderProfile>>;
  try {
    profile = await resolveProviderProfile(db, dna.modelProfileId);
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : '模型解析失败' }, 400);
  }

  const refContext = await artifactContext(db, artifactIds);

  // 落库：用户消息（显式 id，便于文本分支查历史时排除当前消息）
  const userMessageId = randomUUID();
  const userContent: MessageContent = [
    { type: 'text', text },
    ...artifactIds.map((id) => ({ type: 'artifact-ref' as const, artifactId: id })),
  ];
  await db.insert(messages).values({
    id: userMessageId,
    conversationId,
    role: 'user',
    content: userContent,
    artifactRefs: artifactIds,
  });

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

  const modelMessages: ModelMessage[] = [{ role: 'system', content: systemPrompt }];
  for (const m of windowed) {
    if (m.role !== 'user' && m.role !== 'assistant') continue;
    const t = partsToText(m.content);
    if (t) modelMessages.push({ role: m.role, content: t });
  }
  modelMessages.push({ role: 'user', content: text + refContext });

  const result = streamText({
    model: buildLanguageModel(profile),
    messages: modelMessages,
    onFinish: async ({ text: fullText, usage }) => {
      await db.insert(messages).values({
        id: assistantMessageId,
        conversationId,
        role: 'assistant',
        content: [{ type: 'text', text: fullText }],
        tokenUsage: {
          promptTokens: usage.inputTokens ?? 0,
          completionTokens: usage.outputTokens ?? 0,
          totalTokens: usage.totalTokens ?? 0,
        },
      });
    },
  });

  return result.toTextStreamResponse({
    headers: { 'x-message-id': assistantMessageId },
  });
}
