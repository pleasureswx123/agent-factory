import { z } from 'zod';
import {
  type AgentCapabilityBindingInput,
  agentCapabilityBindingSchema,
  type MemoryPolicyInput,
  memoryPolicySchema,
  type ReasoningModeInput,
  reasoningModeSchema,
} from './schemas';

export const FACTORY_SKILL_CATALOG: AgentCapabilityBindingInput[] = [
  {
    id: 'requirement_clarification',
    name: '需求澄清',
    description: '识别业务目标、已有资料、输出要求和关键缺口',
    source: 'factory-default',
    enabled: true,
  },
  {
    id: 'agent_design',
    name: 'Agent 角色设计',
    description: '设计 Agent 的身份、职责、边界、rules、guidelines 和 prompt',
    source: 'factory-default',
    enabled: true,
  },
  {
    id: 'capability_selection',
    name: 'Skill/Tool 选择',
    description: '根据目标为 Agent 推荐默认 skills、tools、knowledge 和 reasoning mode',
    source: 'factory-default',
    enabled: true,
  },
  {
    id: 'publish_evaluation',
    name: '发布评估',
    description: '设计测试样例和发布判断标准，判断 Agent 是否达到最低可用标准',
    source: 'factory-default',
    enabled: true,
  },
];

export const FACTORY_TOOL_CATALOG: AgentCapabilityBindingInput[] = [
  {
    id: 'read_resources',
    name: '读取资源中心',
    description: '查看当前系统可用模型、知识库和平台资源',
    source: 'factory-default',
    enabled: true,
  },
  {
    id: 'factory_test_run',
    name: 'Runtime 试跑',
    description: '调用 Runtime 对草稿 Agent 做一次性试跑和发布评估',
    source: 'factory-default',
    enabled: true,
  },
  {
    id: 'save_agent_dna',
    name: '保存 AgentDNA',
    description: '在用户确认后创建 Agent、保存 AgentDNA 并生成版本',
    source: 'factory-default',
    enabled: true,
  },
];

export const factoryDnaConfigSchema = z.object({
  name: z.string().min(1).max(128),
  icon: z.string().min(1).max(64),
  description: z.string().max(2000).default(''),
  prompt: z.string().min(1),
  rules: z.array(z.string().min(1)).default([]),
  guidelines: z.array(z.string().min(1)).default([]),
  skills: z.array(agentCapabilityBindingSchema).default([]),
  tools: z.array(agentCapabilityBindingSchema).default([]),
  modelProfileId: z.string().uuid().nullable().optional(),
  reasoningMode: reasoningModeSchema.default({
    strategy: 'plan_then_answer',
    selfCheck: true,
    toolUse: 'when_needed',
    maxIterations: 3,
    verboseTrace: false,
    exposeReasoning: false,
  }),
  memoryPolicy: memoryPolicySchema.default({}),
});
export type FactoryDnaConfigInput = z.infer<typeof factoryDnaConfigSchema>;

export const updateFactoryDnaSchema = z.object({
  dna: factoryDnaConfigSchema,
  changeNote: z.string().max(500).optional(),
});
export type UpdateFactoryDnaInput = z.infer<typeof updateFactoryDnaSchema>;

export type FactoryDnaConfig = {
  name: string;
  icon: string;
  description: string;
  prompt: string;
  rules: string[];
  guidelines: string[];
  skills: AgentCapabilityBindingInput[];
  tools: AgentCapabilityBindingInput[];
  modelProfileId?: string | null;
  reasoningMode: ReasoningModeInput;
  memoryPolicy: MemoryPolicyInput;
};

export const DEFAULT_FACTORY_DNA: FactoryDnaConfig = {
  name: 'Agent Factory',
  icon: 'factory',
  description: 'Agent 生命周期设计师、配置生成器、测试教练和发布把关者',
  prompt: '你是 AgentOS 的 Agent Factory 助手，帮助用户澄清业务需求并推导需要创建的 Agent。',
  rules: [
    '不生成空占位配置',
    '不虚构当前资源中心不存在的工具能力',
    '不跳过测试直接建议发布',
    '不替用户静默发布或扩大 Agent 权限',
  ],
  guidelines: [
    '优先用简体中文和用户沟通',
    '当需求不清楚时先追问关键缺口',
    '建议必须能落到当前系统已有资源或明确标注为后续能力',
  ],
  skills: FACTORY_SKILL_CATALOG,
  tools: FACTORY_TOOL_CATALOG,
  modelProfileId: null,
  reasoningMode: {
    strategy: 'plan_then_answer',
    selfCheck: true,
    toolUse: 'when_needed',
    maxIterations: 3,
    verboseTrace: false,
    exposeReasoning: false,
  },
  memoryPolicy: {},
};

export const FACTORY_DNA = {
  identity: DEFAULT_FACTORY_DNA.name,
  goals: [
    '把用户模糊需求转化为可运行、可验证、可迭代的单 Agent',
    '为每个 Agent 生成可工作的默认 rules、guidelines、prompt、skills、tools、knowledge、memory、test cases 和发布标准',
  ],
  rules: DEFAULT_FACTORY_DNA.rules,
  guidelines: DEFAULT_FACTORY_DNA.guidelines,
  skills: DEFAULT_FACTORY_DNA.skills.map((skill) => skill.name),
  tools: DEFAULT_FACTORY_DNA.tools.map((tool) => tool.name),
  evaluation: ['目标是否清晰', '默认配置是否可工作', '测试样例是否真实可跑', '发布标准是否明确'],
  permissions: [
    '可以建议和生成草稿',
    '可以运行测试',
    '发布 Agent 必须由用户确认',
    '绑定高风险工具必须由用户确认',
  ],
} as const;

export function normalizeFactoryDna(input?: Partial<FactoryDnaConfigInput> | null) {
  return factoryDnaConfigSchema.parse({
    ...DEFAULT_FACTORY_DNA,
    ...input,
    reasoningMode: {
      ...DEFAULT_FACTORY_DNA.reasoningMode,
      ...input?.reasoningMode,
      exposeReasoning: false,
    },
    memoryPolicy: input?.memoryPolicy ?? DEFAULT_FACTORY_DNA.memoryPolicy,
  });
}

export function renderFactoryDnaPrompt(input: FactoryDnaConfigInput = DEFAULT_FACTORY_DNA) {
  const dna = normalizeFactoryDna(input);
  const enabledSkills = dna.skills.filter((skill) => skill.enabled !== false);
  const enabledTools = dna.tools.filter((tool) => tool.enabled !== false);
  const sections = [
    `${dna.prompt}\n\n名称：${dna.name}\n职责：${dna.description || '未填写'}`,
    `目标：\n${FACTORY_DNA.goals.map((item, i) => `${i + 1}. ${item}`).join('\n')}`,
  ];
  if (dna.rules.length > 0) {
    sections.push(`Rules：\n${dna.rules.map((item, i) => `${i + 1}. ${item}`).join('\n')}`);
  }
  if (dna.guidelines.length > 0) {
    sections.push(
      `Guidelines：\n${dna.guidelines.map((item, i) => `${i + 1}. ${item}`).join('\n')}`,
    );
  }
  if (enabledSkills.length > 0) {
    sections.push(
      `核心 Skills：\n${enabledSkills
        .map((item, i) => `${i + 1}. ${item.name}：${item.description}`)
        .join('\n')}`,
    );
  }
  if (enabledTools.length > 0) {
    sections.push(
      `可用 Tools：\n${enabledTools
        .map((item, i) => `${i + 1}. ${item.id}（${item.name}）：${item.description}`)
        .join('\n')}`,
    );
  }
  sections.push(
    `权限边界：\n${FACTORY_DNA.permissions.map((item, i) => `${i + 1}. ${item}`).join('\n')}`,
  );
  sections.push(
    `Reasoning Mode：\n1. 模式：${dna.reasoningMode.strategy}\n2. 工具策略：${dna.reasoningMode.toolUse}\n3. 最大工具循环轮数：${dna.reasoningMode.maxIterations}\n4. 不暴露隐藏推理过程。`,
  );
  return sections.join('\n\n');
}
