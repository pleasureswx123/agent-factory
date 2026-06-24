import { AIMessage, HumanMessage, SystemMessage, ToolMessage } from '@langchain/core/messages';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import {
  buildLangChainChatModel,
  type LangChainChunk,
  langChainStreamToTextResponse,
  type RuntimeAgentMessage,
  type RuntimeAssistantToolCallMessage,
  type RuntimeChatMessage,
  type RuntimeTokenUsage,
  type RuntimeToolCall,
  type RuntimeToolMessage,
  streamLangChainText,
  textFromLangChainContent,
} from './langchain-runtime';
import type { ModelProfile } from './provider';

type AgentPromptInput = {
  systemPrompt: string;
  history: RuntimeChatMessage[];
  input: string;
};

export type AgentTurn = {
  messages: RuntimeAgentMessage[];
  stream: AsyncIterable<LangChainChunk>;
  trace?: ToolLoopTraceEvent[];
};

export type AgentTool = {
  id: string;
  name: string;
  description: string;
  execute(args: Record<string, unknown>): Promise<string>;
};

export type ToolLoopModelResult = {
  content: string;
  toolCalls?: RuntimeToolCall[];
  usage?: RuntimeTokenUsage | null;
};

export type ToolLoopTraceEvent =
  | {
      type: 'model_tool_calls';
      iteration: number;
      toolCalls: RuntimeToolCall[];
    }
  | {
      type: 'tool_call';
      iteration: number;
      toolCallId: string;
      toolName: string;
      args: Record<string, unknown>;
    }
  | {
      type: 'tool_result';
      iteration: number;
      toolCallId: string;
      toolName: string;
      result: string;
    };

export type ToolLoopResult = {
  text: string;
  messages: RuntimeAgentMessage[];
  trace: ToolLoopTraceEvent[];
  usage: RuntimeTokenUsage | null;
};

export function buildAgentPrompt({ systemPrompt, history, input }: AgentPromptInput) {
  return [
    { role: 'system', content: systemPrompt },
    ...history,
    { role: 'user', content: input },
  ] satisfies RuntimeChatMessage[];
}

export async function runAgentTurn({
  modelProfile,
  systemPrompt,
  history,
  input,
  tools = [],
  maxIterations = 3,
  verboseTrace = false,
  streamModel = streamLangChainText,
  invokeModel,
}: {
  modelProfile: ModelProfile;
  systemPrompt: string;
  history: RuntimeChatMessage[];
  input: string;
  tools?: AgentTool[];
  maxIterations?: number;
  verboseTrace?: boolean;
  streamModel?: (
    modelProfile: ModelProfile,
    messages: RuntimeChatMessage[],
  ) => Promise<AsyncIterable<LangChainChunk>>;
  invokeModel?: (messages: RuntimeAgentMessage[]) => Promise<ToolLoopModelResult>;
}): Promise<AgentTurn> {
  const messages = buildAgentPrompt({ systemPrompt, history, input });
  if (tools.length > 0) {
    const loop = await runToolLoop({
      messages,
      tools,
      maxIterations,
      verboseTrace,
      invokeModel:
        invokeModel ??
        ((loopMessages) => invokeLangChainWithTools(modelProfile, loopMessages, tools)),
    });
    return {
      messages: loop.messages,
      stream: textToStream(loop.text),
      trace: loop.trace,
    };
  }
  return {
    messages,
    stream: await streamModel(modelProfile, messages),
  };
}

export async function runToolLoop({
  messages,
  tools,
  maxIterations,
  verboseTrace,
  invokeModel,
}: {
  messages: RuntimeAgentMessage[];
  tools: AgentTool[];
  maxIterations: number;
  verboseTrace: boolean;
  invokeModel: (messages: RuntimeAgentMessage[]) => Promise<ToolLoopModelResult>;
}): Promise<ToolLoopResult> {
  const workingMessages = [...messages];
  const trace: ToolLoopTraceEvent[] = [];
  let usage: RuntimeTokenUsage | null = null;

  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    const modelResult = await invokeModel([...workingMessages]);
    usage = modelResult.usage ?? usage;
    const toolCalls = modelResult.toolCalls ?? [];

    if (toolCalls.length === 0) {
      return {
        text: modelResult.content,
        messages: workingMessages,
        trace,
        usage,
      };
    }

    const assistantMessage: RuntimeAssistantToolCallMessage = {
      role: 'assistant',
      content: modelResult.content,
      toolCalls,
    };
    workingMessages.push(assistantMessage);
    if (verboseTrace) {
      trace.push({ type: 'model_tool_calls', iteration, toolCalls });
    }

    for (const call of toolCalls) {
      const tool = tools.find((candidate) => candidate.id === call.name);
      if (!tool) {
        throw new Error(`工具不存在或未启用：${call.name}`);
      }
      if (verboseTrace) {
        trace.push({
          type: 'tool_call',
          iteration,
          toolCallId: call.id,
          toolName: call.name,
          args: call.args,
        });
      }
      const result = await tool.execute(call.args);
      const toolMessage: RuntimeToolMessage = {
        role: 'tool',
        content: result,
        toolCallId: call.id,
        toolName: call.name,
      };
      workingMessages.push(toolMessage);
      if (verboseTrace) {
        trace.push({
          type: 'tool_result',
          iteration,
          toolCallId: call.id,
          toolName: call.name,
          result,
        });
      }
    }
  }

  throw new Error(`工具调用超过最大轮数（${maxIterations}）`);
}

async function invokeLangChainWithTools(
  modelProfile: ModelProfile,
  messages: RuntimeAgentMessage[],
  tools: AgentTool[],
): Promise<ToolLoopModelResult> {
  const model = buildLangChainChatModel(modelProfile).bindTools(
    tools.map(
      (tool) =>
        new DynamicStructuredTool({
          name: tool.id,
          description: tool.description,
          schema: z.record(z.unknown()),
          func: (args) => tool.execute(args),
        }),
    ),
  );
  const response = await model.invoke(toLangChainAgentMessages(messages));
  return {
    content: textFromLangChainContent(response.content),
    toolCalls: (response.tool_calls ?? []).map((call) => ({
      id: call.id ?? `${call.name}-${Date.now()}`,
      name: call.name,
      args: (call.args ?? {}) as Record<string, unknown>,
    })),
    usage: response.usage_metadata
      ? {
          promptTokens: response.usage_metadata.input_tokens ?? 0,
          completionTokens: response.usage_metadata.output_tokens ?? 0,
          totalTokens: response.usage_metadata.total_tokens ?? 0,
        }
      : null,
  };
}

function toLangChainAgentMessages(messages: RuntimeAgentMessage[]) {
  return messages.map((message) => {
    if (message.role === 'system') return new SystemMessage(message.content);
    if (message.role === 'user') return new HumanMessage(message.content);
    if (message.role === 'tool') {
      return new ToolMessage({
        content: message.content,
        tool_call_id: message.toolCallId,
        name: message.toolName,
      });
    }
    if ('toolCalls' in message) {
      return new AIMessage({
        content: message.content,
        tool_calls: message.toolCalls.map((call) => ({
          id: call.id,
          name: call.name,
          args: call.args,
        })),
      });
    }
    return new AIMessage(message.content);
  });
}

async function* textToStream(text: string): AsyncIterable<LangChainChunk> {
  yield { content: text };
}

export function agentTurnToTextResponse(
  turn: AgentTurn,
  opts: {
    headers?: Record<string, string>;
    onFinish?: (result: { text: string; usage: RuntimeTokenUsage | null }) => Promise<void>;
  } = {},
) {
  return langChainStreamToTextResponse(turn.stream, opts);
}
