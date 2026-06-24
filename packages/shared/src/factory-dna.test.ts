import assert from 'node:assert/strict';
import {
  DEFAULT_FACTORY_DNA,
  FACTORY_DNA,
  factoryDnaConfigSchema,
  renderFactoryDnaPrompt,
} from './factory-dna';

assert.equal(FACTORY_DNA.identity, 'Agent Factory');
assert.ok(FACTORY_DNA.rules.some((rule) => rule.includes('不生成空占位配置')));
assert.ok(FACTORY_DNA.skills.includes('需求澄清'));
assert.ok(FACTORY_DNA.permissions.some((permission) => permission.includes('用户确认')));

const parsed = factoryDnaConfigSchema.parse({
  name: '自定义 Factory',
  icon: 'sparkles',
  description: '负责创建 Agent',
  prompt: '你是一个可微调的 Factory Agent。',
});

assert.deepEqual(parsed.rules, []);
assert.deepEqual(parsed.guidelines, []);
assert.deepEqual(parsed.skills, []);
assert.deepEqual(parsed.tools, []);
assert.equal(parsed.reasoningMode.maxIterations, 3);
assert.equal(parsed.memoryPolicy.shortTerm, undefined);

const rendered = renderFactoryDnaPrompt({
  ...DEFAULT_FACTORY_DNA,
  name: '自定义 Factory',
  prompt: '你是一个可微调的 Factory Agent。',
  rules: ['必须给出测试样例'],
  guidelines: ['优先使用简体中文'],
  skills: [
    {
      id: 'agent_design',
      name: 'Agent 角色设计',
      description: '设计 Agent 的身份、职责和边界',
      source: 'factory-default',
      enabled: true,
    },
  ],
  tools: [
    {
      id: 'factory_test_run',
      name: 'Runtime 试跑',
      description: '调用 Runtime 对草稿 Agent 做试跑',
      source: 'factory-default',
      enabled: true,
    },
  ],
});

assert.match(rendered, /自定义 Factory/);
assert.match(rendered, /必须给出测试样例/);
assert.match(rendered, /Agent 角色设计/);
assert.match(rendered, /factory_test_run/);
