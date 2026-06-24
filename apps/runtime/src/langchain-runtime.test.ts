import assert from 'node:assert/strict';
import {
  langChainStreamToTextResponse,
  textFromLangChainContent,
  toLangChainMessages,
} from './langchain-runtime';

const messages = toLangChainMessages([
  { role: 'system', content: '系统提示词' },
  { role: 'user', content: '你好' },
  { role: 'assistant', content: '你好，有什么可以帮你？' },
]);

assert.deepEqual(messages, [
  { role: 'system', content: '系统提示词' },
  { role: 'user', content: '你好' },
  { role: 'assistant', content: '你好，有什么可以帮你？' },
]);

assert.equal(textFromLangChainContent('直接文本'), '直接文本');
assert.equal(
  textFromLangChainContent([
    { type: 'text', text: '第一段' },
    { type: 'reasoning', reasoning: '内部推理不应透出' },
    { type: 'text', text: '第二段' },
  ]),
  '第一段第二段',
);
assert.equal(textFromLangChainContent([{ type: 'image_url', image_url: 'x' }]), '');

let finishedText = '';
let finishedUsage: { promptTokens: number; completionTokens: number; totalTokens: number } | null =
  null;

async function* chunks() {
  yield { content: '你' };
  yield { content: [{ type: 'text', text: '好' }] };
  yield {
    content: '！',
    usage_metadata: { input_tokens: 2, output_tokens: 3, total_tokens: 5 },
  };
}

const response = langChainStreamToTextResponse(chunks(), {
  headers: { 'x-message-id': 'assistant-message-id' },
  onFinish: async ({ text, usage }) => {
    finishedText = text;
    finishedUsage = usage;
  },
});

assert.equal(response.headers.get('x-message-id'), 'assistant-message-id');
assert.equal(response.headers.get('content-type'), 'text/plain; charset=utf-8');
assert.equal(await response.text(), '你好！');
assert.equal(finishedText, '你好！');
assert.deepEqual(finishedUsage, {
  promptTokens: 2,
  completionTokens: 3,
  totalTokens: 5,
});
