import assert from 'node:assert/strict';
import { evaluateTestRunSchema, evolveAgentSchema, parseAgentSuggestions } from './chat';
import { dnaConfigSchema } from './schemas';

const parsed = dnaConfigSchema.parse({
  prompt: '你是一个脚本分析 Agent。',
});

assert.deepEqual(parsed.rules, []);
assert.deepEqual(parsed.guidelines, []);
assert.deepEqual(parsed.testCases, []);
assert.deepEqual(parsed.evaluationCriteria, []);

const configured = dnaConfigSchema.parse({
  prompt: '你是一个脚本分析 Agent。',
  rules: ['只输出结构化分析，不改写原文。'],
  guidelines: ['始终使用简体中文。'],
  testCases: [{ name: '基础脚本分析', input: '开头三秒提出冲突...', expected: '结构化拆解' }],
  evaluationCriteria: ['完成结构化拆解'],
});

assert.deepEqual(configured.rules, ['只输出结构化分析，不改写原文。']);
assert.deepEqual(configured.guidelines, ['始终使用简体中文。']);
assert.equal(configured.testCases[0]?.name, '基础脚本分析');
assert.deepEqual(configured.evaluationCriteria, ['完成结构化拆解']);

const suggestions = parseAgentSuggestions(`
\`\`\`agent-suggestions
[
  {
    "name": "脚本分析 Agent",
    "description": "读取脚本输出结构化分析",
    "reason": "用户需要分析脚本",
    "testCases": [
      {"name": "基础脚本分析", "input": "开头三秒提出冲突...", "expected": "输出结构化拆解"}
    ],
    "evaluationCriteria": ["完成结构化拆解", "不改写原文"]
  }
]
\`\`\`
`);

assert.equal(suggestions[0]?.testCases?.[0]?.name, '基础脚本分析');
assert.equal(suggestions[0]?.testCases?.[0]?.input, '开头三秒提出冲突...');
assert.deepEqual(suggestions[0]?.evaluationCriteria, ['完成结构化拆解', '不改写原文']);

const evaluationRequest = evaluateTestRunSchema.parse({
  agentName: '脚本分析 Agent',
  description: '读取脚本输出结构化分析',
  rules: ['不改写原文'],
  guidelines: ['使用简体中文'],
  systemPrompt: '你是一个脚本分析 Agent。',
  evaluationCriteria: ['完成结构化拆解'],
  input: '开头三秒提出冲突...',
  output: '结构化拆解结果...',
});

assert.equal(evaluationRequest.evaluationCriteria[0], '完成结构化拆解');

const evolveRequest = evolveAgentSchema.parse({
  agentId: '11111111-1111-1111-1111-111111111111',
});

assert.equal(evolveRequest.agentId, '11111111-1111-1111-1111-111111111111');
