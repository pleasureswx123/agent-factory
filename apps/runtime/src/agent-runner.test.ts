import assert from 'node:assert/strict';
import {
  agentTurnToTextResponse,
  buildAgentPrompt,
  runAgentTurn,
  runToolLoop,
} from './agent-runner';
import type { ModelProfile } from './provider';

const prompt = buildAgentPrompt({
  systemPrompt: '你是小说分析助手。',
  history: [
    { role: 'user', content: '上一轮用户输入' },
    { role: 'assistant', content: '上一轮助手回复' },
  ],
  input: '分析这一段',
});

assert.deepEqual(prompt, [
  { role: 'system', content: '你是小说分析助手。' },
  { role: 'user', content: '上一轮用户输入' },
  { role: 'assistant', content: '上一轮助手回复' },
  { role: 'user', content: '分析这一段' },
]);

const profile: ModelProfile = {
  id: 'provider-id',
  name: '测试模型',
  baseUrl: 'https://example.com/v1',
  modelId: 'test-model',
  apiKey: 'sk-test',
  modality: 'text',
};

let receivedProfile: ModelProfile | null = null;
let receivedMessages: unknown = null;

async function* fakeStream() {
  yield { content: '直观' };
  yield { content: '一点' };
}

const turn = await runAgentTurn({
  modelProfile: profile,
  systemPrompt: '系统提示',
  history: [],
  input: '用户输入',
  streamModel: async (modelProfile, messages) => {
    receivedProfile = modelProfile;
    receivedMessages = messages;
    return fakeStream();
  },
});

assert.equal(receivedProfile, profile);
assert.deepEqual(receivedMessages, [
  { role: 'system', content: '系统提示' },
  { role: 'user', content: '用户输入' },
]);

let saved = '';
const response = agentTurnToTextResponse(turn, {
  headers: { 'x-message-id': 'assistant-id' },
  onFinish: async ({ text }) => {
    saved = text;
  },
});

assert.equal(response.headers.get('x-message-id'), 'assistant-id');
assert.equal(await response.text(), '直观一点');
assert.equal(saved, '直观一点');

const loopMessages: unknown[] = [];
const loop = await runToolLoop({
  messages: [{ role: 'user', content: '读素材后回答' }],
  tools: [
    {
      id: 'read_artifact',
      name: '读取素材',
      description: '读取素材',
      execute: async ({ artifactId }) => `素材内容:${artifactId}`,
    },
  ],
  maxIterations: 3,
  verboseTrace: true,
  invokeModel: async (messages) => {
    loopMessages.push(messages);
    return loopMessages.length === 1
      ? {
          content: '',
          toolCalls: [
            {
              id: 'call-1',
              name: 'read_artifact',
              args: { artifactId: 'artifact-1' },
            },
          ],
        }
      : { content: '最终回答' };
  },
});

assert.equal(loop.text, '最终回答');
assert.equal(loop.trace.length, 3);
assert.deepEqual(loopMessages, [
  [{ role: 'user', content: '读素材后回答' }],
  [
    { role: 'user', content: '读素材后回答' },
    {
      role: 'assistant',
      content: '',
      toolCalls: [{ id: 'call-1', name: 'read_artifact', args: { artifactId: 'artifact-1' } }],
    },
    {
      role: 'tool',
      content: '素材内容:artifact-1',
      toolCallId: 'call-1',
      toolName: 'read_artifact',
    },
  ],
]);

await assert.rejects(
  () =>
    runToolLoop({
      messages: [{ role: 'user', content: '一直调工具' }],
      tools: [
        {
          id: 'read_artifact',
          name: '读取素材',
          description: '读取素材',
          execute: async () => '结果',
        },
      ],
      maxIterations: 1,
      verboseTrace: false,
      invokeModel: async () => ({
        content: '',
        toolCalls: [{ id: 'call-loop', name: 'read_artifact', args: { artifactId: 'a' } }],
      }),
    }),
  /工具调用超过最大轮数/,
);
