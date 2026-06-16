// Agent Factory：需求澄清对话（无状态） + 实时测试试跑（不落库）
import type { Db } from '@agent-os/db';
import { factoryChatSchema, testRunSchema } from '@agent-os/shared';
import { type ModelMessage, streamText } from 'ai';
import type { Context } from 'hono';
import { resolveDefaultModel, resolveModel } from '../provider';

const FACTORY_SYSTEM_PROMPT = `你是 AgentOS 的 Agent Factory 助手，帮助用户澄清业务需求并推导需要创建的 Agent。

工作方式：
1. 如果用户需求不清楚，先追问必要信息（业务目标、已有资料、期望输出），一次最多问 2-3 个问题。
2. 当信息足够时，先用一段话总结你对需求的理解，再给出建议创建的 Agent 列表。
3. 每个建议 Agent 必须职责单一、可独立测试。
4. 如果用户已明确说出要创建的 Agent，直接将其整理进建议列表，不要反复追问。

输出建议列表时，必须在回复末尾附加一个 JSON 代码块，语言标记固定为 agent-suggestions，格式如下：

\`\`\`agent-suggestions
[{"name":"脚本分析 Agent","description":"读取脚本输出结构化分析","reason":"用户需要对脚本做结构化拆解","systemPrompt":"你是一个脚本分析 Agent..."}]
\`\`\`

systemPrompt 字段请给出可直接使用的完整系统提示词草稿。除该 JSON 块外，正文用简体中文自然表述。`;

export async function handleFactoryChat(c: Context, db: Db) {
  const parsed = factoryChatSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: '请求参数不合法' }, 400);

  let model: Awaited<ReturnType<typeof resolveDefaultModel>>;
  try {
    model = await resolveDefaultModel(db);
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : '模型解析失败' }, 400);
  }

  const modelMessages: ModelMessage[] = [
    { role: 'system', content: FACTORY_SYSTEM_PROMPT },
    ...parsed.data.messages.map((m) => ({ role: m.role, content: m.content })),
  ];

  const result = streamText({ model, messages: modelMessages });
  return result.toTextStreamResponse();
}

export async function handleTestRun(c: Context, db: Db) {
  const parsed = testRunSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: '请求参数不合法' }, 400);
  const { systemPrompt, modelProfileId, input } = parsed.data;

  let model: Awaited<ReturnType<typeof resolveModel>>;
  try {
    model = await resolveModel(db, modelProfileId);
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : '模型解析失败' }, 400);
  }

  const result = streamText({
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: input },
    ],
  });
  return result.toTextStreamResponse();
}
