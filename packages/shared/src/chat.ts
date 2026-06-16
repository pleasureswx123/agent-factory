// Web <-> Runtime 的聊天协议类型与解析工具
import { z } from 'zod';

/** POST /chat：在某个会话中发消息（runtime 负责消息落库） */
export const chatRequestSchema = z.object({
  conversationId: z.string().uuid(),
  text: z.string().min(1),
  artifactIds: z.array(z.string().uuid()).default([]),
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
  modelProfileId: z.string().uuid(),
  input: z.string().min(1),
});
export type TestRunRequest = z.infer<typeof testRunSchema>;

/** Factory 输出的候选 Agent 建议（模型按约定输出 JSON 代码块） */
export type AgentSuggestion = {
  name: string;
  description: string;
  reason: string;
  systemPrompt?: string;
};

const suggestionBlockRe = /```agent-suggestions\s*([\s\S]*?)```/g;

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
              systemPrompt: typeof item.systemPrompt === 'string' ? item.systemPrompt : undefined,
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
