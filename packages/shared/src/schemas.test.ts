import assert from 'node:assert/strict';
import {
  chatRequestSchema,
  evaluateTestRunSchema,
  evolveAgentSchema,
  parseAgentSuggestions,
  testRunSchema,
} from './chat';
import {
  createAgentModelProviderSchema,
  dnaConfigSchema,
  updateAgentModelProviderSchema,
} from './schemas';

const parsed = dnaConfigSchema.parse({
  prompt: '你是一个脚本分析 Agent。',
});

assert.deepEqual(parsed.rules, []);
assert.deepEqual(parsed.guidelines, []);
assert.deepEqual(parsed.testCases, []);
assert.deepEqual(parsed.evaluationCriteria, []);
assert.deepEqual(parsed.reasoningMode, {
  strategy: 'direct',
  selfCheck: false,
  toolUse: 'when_needed',
  maxIterations: 3,
  verboseTrace: false,
  exposeReasoning: false,
});

const configured = dnaConfigSchema.parse({
  prompt: '你是一个脚本分析 Agent。',
  rules: ['只输出结构化分析，不改写原文。'],
  guidelines: ['始终使用简体中文。'],
  modelProfileId: '11111111-1111-1111-1111-111111111111',
  modelProfileIds: ['11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222'],
  testCases: [{ name: '基础脚本分析', input: '开头三秒提出冲突...', expected: '结构化拆解' }],
  evaluationCriteria: ['完成结构化拆解'],
  skills: [
    {
      id: 'script_analysis',
      name: '脚本结构化分析',
      description: '拆解脚本的结构、冲突和表达重点',
      source: 'factory-default',
      enabled: true,
      reason: '该 Agent 需要分析脚本内容',
    },
  ],
  tools: [
    {
      id: 'read_artifact',
      name: '读取素材',
      description: '读取用户上传或当前会话保存的素材内容',
      source: 'factory-default',
      enabled: true,
      reason: '该 Agent 需要读取输入素材',
    },
  ],
  reasoningMode: {
    strategy: 'plan_then_answer',
    selfCheck: true,
    toolUse: 'when_needed',
    maxIterations: 5,
    verboseTrace: true,
    exposeReasoning: false,
  },
});

assert.deepEqual(configured.rules, ['只输出结构化分析，不改写原文。']);
assert.deepEqual(configured.guidelines, ['始终使用简体中文。']);
assert.equal(configured.testCases[0]?.name, '基础脚本分析');
assert.deepEqual(configured.evaluationCriteria, ['完成结构化拆解']);
assert.equal(configured.modelProfileId, '11111111-1111-1111-1111-111111111111');
assert.deepEqual(configured.modelProfileIds, [
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
]);
assert.equal(configured.skills[0]?.id, 'script_analysis');
assert.equal(configured.tools[0]?.id, 'read_artifact');
assert.equal(configured.reasoningMode.strategy, 'plan_then_answer');
assert.equal(configured.reasoningMode.selfCheck, true);
assert.equal(configured.reasoningMode.maxIterations, 5);
assert.equal(configured.reasoningMode.verboseTrace, true);

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

const defaultModelTestRun = evaluateTestRunSchema.parse({
  agentName: '默认模型 Agent',
  systemPrompt: '你是一个默认模型测试 Agent。',
  input: '测试输入',
  output: '测试输出',
});

assert.equal(defaultModelTestRun.description, '');

const testRunWithDefaultModel = testRunSchema.parse({
  systemPrompt: '你是一个默认模型测试 Agent。',
  input: '测试输入',
});

assert.equal(testRunWithDefaultModel.modelProfileId, undefined);

const chatWithModelOverride = chatRequestSchema.parse({
  conversationId: '33333333-3333-3333-3333-333333333333',
  text: '测试输入',
  modelProfileId: '22222222-2222-2222-2222-222222222222',
});

assert.equal(chatWithModelOverride.modelProfileId, '22222222-2222-2222-2222-222222222222');

const createAgentModelProvider = createAgentModelProviderSchema.parse({
  agentId: '33333333-3333-3333-3333-333333333333',
  name: '当前 Agent 文本模型',
  baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
  modelId: 'doubao-seed-2-0-pro-260215',
  modality: 'text',
  secretValue: 'sk-test',
});

assert.equal(createAgentModelProvider.agentId, '33333333-3333-3333-3333-333333333333');
assert.equal(createAgentModelProvider.modality, 'text');

const updateAgentModelProvider = updateAgentModelProviderSchema.parse({
  agentId: '33333333-3333-3333-3333-333333333333',
  resourceId: '44444444-4444-4444-4444-444444444444',
  name: '当前 Agent 图像模型',
  baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
  modelId: 'doubao-seedream-5-0-260128',
  modality: 'image',
});

assert.equal(updateAgentModelProvider.resourceId, '44444444-4444-4444-4444-444444444444');

const evolveRequest = evolveAgentSchema.parse({
  agentId: '11111111-1111-1111-1111-111111111111',
});

assert.equal(evolveRequest.agentId, '11111111-1111-1111-1111-111111111111');
