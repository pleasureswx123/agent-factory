// Agent Factory：需求澄清对话（无状态） + 实时测试试跑（不落库）
import type { Db } from '@agent-os/db';
import {
  agentDnas,
  agents,
  artifacts,
  conversations,
  messages,
  promptVersions,
} from '@agent-os/db';
import {
  evaluateTestRunSchema,
  evolveAgentSchema,
  factoryChatSchema,
  renderFactoryDnaPrompt,
  testRunSchema,
} from '@agent-os/shared';
import { generateText, type ModelMessage, streamText } from 'ai';
import { desc, eq, inArray } from 'drizzle-orm';
import type { Context } from 'hono';
import { z } from 'zod';
import { resolveDefaultModel, resolveModel } from '../provider';

const FACTORY_SYSTEM_PROMPT = `${renderFactoryDnaPrompt()}

工作方式：
1. 如果用户需求不清楚，先追问必要信息（业务目标、已有资料、期望输出），一次最多问 2-3 个问题。
2. 当信息足够时，先用一段话总结你对需求的理解，再给出建议创建的 Agent 列表。
3. 每个建议 Agent 必须职责单一、可独立测试。
4. 如果用户已明确说出要创建的 Agent，直接将其整理进建议列表，不要反复追问。
5. 每个建议 Agent 都要给出可工作的默认 rules、guidelines、systemPrompt、testCases 和 evaluationCriteria，不要留空占位。

输出建议列表时，必须在回复末尾附加一个 JSON 代码块，语言标记固定为 agent-suggestions，格式如下：

\`\`\`agent-suggestions
[{"name":"脚本分析 Agent","description":"读取脚本输出结构化分析","reason":"用户需要对脚本做结构化拆解","rules":["只输出结构化分析，不直接改写原文"],"guidelines":["始终使用简体中文"],"systemPrompt":"你是一个脚本分析 Agent...","testCases":[{"name":"基础脚本分析","input":"这里放一段用户可能输入的脚本","expected":"输出结构化脚本拆解"}],"evaluationCriteria":["完成结构化拆解","不改写原文","指出关键风险或缺失信息"]}]
\`\`\`

systemPrompt 字段请给出可直接使用的完整系统提示词草稿。testCases 至少给 1 条真实可跑样例。evaluationCriteria 至少给 3 条发布判断标准。除该 JSON 块外，正文用简体中文自然表述。`;

function buildSystemPrompt(systemPrompt: string, rules: string[], guidelines: string[]): string {
  const sections = [systemPrompt.trim()];
  if (rules.length > 0) {
    sections.push(`Rules:\n${rules.map((rule, i) => `${i + 1}. ${rule}`).join('\n')}`);
  }
  if (guidelines.length > 0) {
    sections.push(
      `Guidelines:\n${guidelines.map((guideline, i) => `${i + 1}. ${guideline}`).join('\n')}`,
    );
  }
  return sections.join('\n\n');
}

const publishEvaluationResponseSchema = z.object({
  status: z.enum(['publishable', 'needs_changes', 'blocked']),
  summary: z.string(),
  reasons: z.array(z.string()).default([]),
  suggestions: z.array(z.string()).default([]),
});

const evolveSuggestionResponseSchema = z.object({
  summary: z.string(),
  promptSuggestions: z.array(z.string()).default([]),
  ruleSuggestions: z.array(z.string()).default([]),
  testCaseSuggestions: z
    .array(z.object({ name: z.string(), input: z.string(), expected: z.string() }))
    .default([]),
  riskNotes: z.array(z.string()).default([]),
});

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
  const { systemPrompt, rules, guidelines, modelProfileId, input } = parsed.data;

  let model: Awaited<ReturnType<typeof resolveModel>>;
  try {
    model = await resolveModel(db, modelProfileId);
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : '模型解析失败' }, 400);
  }

  const result = streamText({
    model,
    messages: [
      { role: 'system', content: buildSystemPrompt(systemPrompt, rules, guidelines) },
      { role: 'user', content: input },
    ],
  });
  return result.toTextStreamResponse();
}

export async function handleTestEvaluate(c: Context, db: Db) {
  const parsed = evaluateTestRunSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: '请求参数不合法' }, 400);

  let model: Awaited<ReturnType<typeof resolveDefaultModel>>;
  try {
    model = await resolveDefaultModel(db);
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : '模型解析失败' }, 400);
  }

  const result = await generateText({
    model,
    messages: [
      {
        role: 'system',
        content:
          '你是 Agent Factory 的发布评估员。根据 Agent 定义、规则、测试输入和输出，判断这个 Agent 是否可发布。只输出 JSON：{"status":"publishable|needs_changes|blocked","summary":"一句话结论","reasons":["原因"],"suggestions":["改进建议"]}。',
      },
      {
        role: 'user',
        content: JSON.stringify(parsed.data, null, 2),
      },
    ],
  });

  try {
    const parsedResult = publishEvaluationResponseSchema.safeParse(JSON.parse(result.text));
    if (parsedResult.success) return c.json(parsedResult.data);
    return c.json({
      status: 'needs_changes',
      summary: '发布评估格式不完整，需要人工复核。',
      reasons: ['模型返回的评估 JSON 缺少必要字段或字段类型不正确'],
      suggestions: ['请调整 Agent 配置后重新试跑，或根据原始输出手动判断'],
    });
  } catch {
    return c.json({
      status: 'needs_changes',
      summary: result.text.slice(0, 300),
      reasons: ['评估结果不是合法 JSON'],
      suggestions: ['请根据评估文本手动调整 Agent 配置后重新试跑'],
    });
  }
}

export async function handleFactoryEvolve(c: Context, db: Db) {
  const parsed = evolveAgentSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: '请求参数不合法' }, 400);

  const [agent] = await db.select().from(agents).where(eq(agents.id, parsed.data.agentId)).limit(1);
  if (!agent?.currentDnaId || agent.deletedAt) {
    return c.json({ error: 'Agent 不存在或配置缺失' }, 404);
  }
  const [dna] = await db
    .select()
    .from(agentDnas)
    .where(eq(agentDnas.id, agent.currentDnaId))
    .limit(1);
  if (!dna) return c.json({ error: 'Agent DNA 不存在' }, 404);
  const [prompt] = await db
    .select()
    .from(promptVersions)
    .where(eq(promptVersions.id, dna.promptVersionId))
    .limit(1);

  const convs = await db
    .select()
    .from(conversations)
    .where(eq(conversations.agentId, agent.id))
    .orderBy(desc(conversations.updatedAt))
    .limit(5);
  const convIds = convs.map((conv) => conv.id);
  const recentMessages = convIds.length
    ? await db
        .select()
        .from(messages)
        .where(inArray(messages.conversationId, convIds))
        .orderBy(desc(messages.createdAt))
        .limit(20)
    : [];
  const recentArtifacts = await db
    .select()
    .from(artifacts)
    .where(eq(artifacts.agentId, agent.id))
    .orderBy(desc(artifacts.createdAt))
    .limit(10);

  let model: Awaited<ReturnType<typeof resolveDefaultModel>>;
  try {
    model = await resolveDefaultModel(db);
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : '模型解析失败' }, 400);
  }

  const result = await generateText({
    model,
    messages: [
      {
        role: 'system',
        content:
          '你是 Agent Factory 的进化建议员。根据 Agent 当前 DNA、最近会话和素材信号，输出 JSON：{"summary":"一句话观察","promptSuggestions":["建议"],"ruleSuggestions":["建议"],"testCaseSuggestions":[{"name":"名称","input":"输入","expected":"期望"}],"riskNotes":["风险"]}。只输出 JSON。',
      },
      {
        role: 'user',
        content: JSON.stringify(
          {
            agent: { name: agent.name, description: agent.description },
            dna: {
              rules: dna.rules,
              guidelines: dna.guidelines,
              prompt: prompt?.content,
              testCases: dna.testCases,
              evaluationCriteria: dna.evaluationCriteria,
            },
            recentMessages: recentMessages.map((m) => ({ role: m.role, content: m.content })),
            recentArtifacts: recentArtifacts.map((a) => ({
              name: a.name,
              type: a.type,
              content: a.content?.slice(0, 1000),
            })),
          },
          null,
          2,
        ),
      },
    ],
  });

  try {
    const parsedResult = evolveSuggestionResponseSchema.safeParse(JSON.parse(result.text));
    if (parsedResult.success) return c.json(parsedResult.data);
    return c.json({
      summary: '进化建议格式不完整，需要人工复核。',
      promptSuggestions: [],
      ruleSuggestions: [],
      testCaseSuggestions: [],
      riskNotes: ['模型返回的进化建议 JSON 缺少必要字段或字段类型不正确'],
    });
  } catch {
    return c.json({
      summary: result.text.slice(0, 300),
      promptSuggestions: [],
      ruleSuggestions: [],
      testCaseSuggestions: [],
      riskNotes: ['进化建议不是合法 JSON，请手动参考 summary'],
    });
  }
}
