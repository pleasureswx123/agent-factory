import { ChatOpenAI } from '@langchain/openai';
import type { ModelProfile } from './provider';

export type RuntimeChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export type RuntimeToolCall = {
  id: string;
  name: string;
  args: Record<string, unknown>;
};

export type RuntimeToolMessage = {
  role: 'tool';
  content: string;
  toolCallId: string;
  toolName: string;
};

export type RuntimeAssistantToolCallMessage = {
  role: 'assistant';
  content: string;
  toolCalls: RuntimeToolCall[];
};

export type RuntimeAgentMessage =
  | RuntimeChatMessage
  | RuntimeAssistantToolCallMessage
  | RuntimeToolMessage;

type LangChainContentBlock = {
  type?: string;
  text?: string;
};

export type LangChainChunk = {
  content?: unknown;
  usage_metadata?: {
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
  };
};

export type RuntimeTokenUsage = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
};

export function buildLangChainChatModel(profile: ModelProfile): ChatOpenAI {
  return new ChatOpenAI({
    model: profile.modelId,
    apiKey: profile.apiKey,
    streamUsage: false,
    configuration: {
      baseURL: profile.baseUrl,
    },
  });
}

export function toLangChainMessages(messages: RuntimeChatMessage[]) {
  return messages.map((message) => ({ role: message.role, content: message.content }));
}

export function textFromLangChainContent(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .map((block: LangChainContentBlock) =>
      block && block.type === 'text' && typeof block.text === 'string' ? block.text : '',
    )
    .join('');
}

function usageFromChunk(chunk: LangChainChunk): RuntimeTokenUsage | null {
  const usage = chunk.usage_metadata;
  if (!usage) return null;
  return {
    promptTokens: usage.input_tokens ?? 0,
    completionTokens: usage.output_tokens ?? 0,
    totalTokens: usage.total_tokens ?? 0,
  };
}

export function langChainStreamToTextResponse(
  chunks: AsyncIterable<LangChainChunk>,
  opts: {
    headers?: Record<string, string>;
    onFinish?: (result: { text: string; usage: RuntimeTokenUsage | null }) => Promise<void>;
  } = {},
): Response {
  const encoder = new TextEncoder();
  let fullText = '';
  let latestUsage: RuntimeTokenUsage | null = null;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of chunks) {
          const text = textFromLangChainContent(chunk.content);
          const usage = usageFromChunk(chunk);
          if (usage) latestUsage = usage;
          if (!text) continue;
          fullText += text;
          controller.enqueue(encoder.encode(text));
        }
        await opts.onFinish?.({ text: fullText, usage: latestUsage });
        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });

  return new Response(stream, {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      ...opts.headers,
    },
  });
}

export async function invokeLangChainText(
  profile: ModelProfile,
  messages: RuntimeChatMessage[],
): Promise<{ text: string; usage: RuntimeTokenUsage | null }> {
  return invokeLangChainModelText(buildLangChainChatModel(profile), messages);
}

export async function invokeLangChainModelText(
  model: ChatOpenAI,
  messages: RuntimeChatMessage[],
): Promise<{ text: string; usage: RuntimeTokenUsage | null }> {
  const response = await model.invoke(toLangChainMessages(messages));
  const usage = response.usage_metadata
    ? {
        promptTokens: response.usage_metadata.input_tokens ?? 0,
        completionTokens: response.usage_metadata.output_tokens ?? 0,
        totalTokens: response.usage_metadata.total_tokens ?? 0,
      }
    : null;
  return { text: textFromLangChainContent(response.content), usage };
}

export async function streamLangChainText(profile: ModelProfile, messages: RuntimeChatMessage[]) {
  return streamLangChainModelText(buildLangChainChatModel(profile), messages);
}

export async function streamLangChainModelText(model: ChatOpenAI, messages: RuntimeChatMessage[]) {
  return model.stream(toLangChainMessages(messages));
}
