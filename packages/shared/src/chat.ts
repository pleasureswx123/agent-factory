// Web <-> Runtime 的聊天协议类型与解析工具
import { z } from 'zod';

/** POST /chat：在某个会话中发消息（runtime 负责消息落库） */
export const chatRequestSchema = z.object({
  conversationId: z.string().uuid(),
  text: z.string().min(1),
  artifactIds: z.array(z.string().uuid()).default([]),
  clientRequestId: z.string().uuid().optional(),
  replaceMessageId: z.string().uuid().optional(),
});
export type ChatRequest = z.infer<typeof chatRequestSchema>;

/** POST /factory/chat：Agent Factory 需求澄清对话（无状态，不落库） */
export const factoryChatSchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(['user', 'assistant']),
      content: z.string(),
    }),
  ),
});
export type FactoryChatRequest = z.infer<typeof factoryChatSchema>;

/** POST /test-run：Agent Factory 实时测试区一次性试跑（不落库） */
export const testRunSchema = z.object({
  systemPrompt: z.string().min(1),
  rules: z.array(z.string().min(1)).default([]),
  guidelines: z.array(z.string().min(1)).default([]),
  modelProfileId: z.string().uuid().nullable().optional(),
  input: z.string().min(1),
});
export type TestRunRequest = z.infer<typeof testRunSchema>;

/** POST /test-evaluate：Factory 对一次试跑结果给出发布判断 */
export const evaluateTestRunSchema = z.object({
  agentName: z.string().min(1),
  description: z.string().default(''),
  rules: z.array(z.string().min(1)).default([]),
  guidelines: z.array(z.string().min(1)).default([]),
  systemPrompt: z.string().min(1),
  evaluationCriteria: z.array(z.string().min(1)).default([]),
  input: z.string().min(1),
  output: z.string().min(1),
});
export type EvaluateTestRunRequest = z.infer<typeof evaluateTestRunSchema>;

/** POST /factory/evolve：根据真实使用信号生成 Agent 改进建议 */
export const evolveAgentSchema = z.object({
  agentId: z.string().uuid(),
});
export type EvolveAgentRequest = z.infer<typeof evolveAgentSchema>;

/** Factory 输出的候选 Agent 建议（模型按约定输出 JSON 代码块） */
export type AgentSuggestion = {
  name: string;
  description: string;
  reason: string;
  rules?: string[];
  guidelines?: string[];
  systemPrompt?: string;
  testCases?: { name: string; input: string; expected: string }[];
  evaluationCriteria?: string[];
};

const suggestionBlockRe = /```agent-suggestions\s*([\s\S]*?)```/g;
type AgentSuggestionTestCase = { name: string; input: string; expected: string };

function isAgentSuggestionTestCase(value: unknown): value is AgentSuggestionTestCase {
  return (
    !!value &&
    typeof value === 'object' &&
    typeof (value as { name?: unknown }).name === 'string' &&
    typeof (value as { input?: unknown }).input === 'string' &&
    typeof (value as { expected?: unknown }).expected === 'string'
  );
}

/** 从 Factory 助手回复中提取 ```agent-suggestions``` JSON 块 */
export function parseAgentSuggestions(text: string): AgentSuggestion[] {
  const out: AgentSuggestion[] = [];
  for (const match of text.matchAll(suggestionBlockRe)) {
    try {
      const parsed = JSON.parse(match[1] ?? '');
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (item && typeof item.name === 'string') {
            out.push({
              name: item.name,
              description: typeof item.description === 'string' ? item.description : '',
              reason: typeof item.reason === 'string' ? item.reason : '',
              rules: Array.isArray(item.rules)
                ? item.rules.filter((v: unknown): v is string => typeof v === 'string')
                : undefined,
              guidelines: Array.isArray(item.guidelines)
                ? item.guidelines.filter((v: unknown): v is string => typeof v === 'string')
                : undefined,
              systemPrompt: typeof item.systemPrompt === 'string' ? item.systemPrompt : undefined,
              testCases: Array.isArray(item.testCases)
                ? item.testCases
                    .filter(isAgentSuggestionTestCase)
                    .map((v: AgentSuggestionTestCase) => ({
                      name: v.name,
                      input: v.input,
                      expected: v.expected,
                    }))
                : undefined,
              evaluationCriteria: Array.isArray(item.evaluationCriteria)
                ? item.evaluationCriteria.filter((v: unknown): v is string => typeof v === 'string')
                : undefined,
            });
          }
        }
      }
    } catch {
      // 忽略无法解析的块
    }
  }
  return out;
}

/** 渲染时去掉建议 JSON 块，避免原始 JSON 直接展示给用户 */
export function stripSuggestionBlocks(text: string): string {
  return text.replace(suggestionBlockRe, '').trim();
}
