import type { AgentCapabilityBindingInput } from './schemas';

export const AGENT_SKILL_CATALOG: AgentCapabilityBindingInput[] = [
  {
    id: 'content_analysis',
    name: '内容结构化分析',
    description: '拆解文本、脚本或素材中的主题、结构、冲突、亮点和风险',
    source: 'factory-default',
    enabled: true,
  },
  {
    id: 'novel_video_adaptation',
    name: '小说短视频适配',
    description: '把小说片段转化为适合短视频制作的镜头、钩子、爽点和素材建议',
    source: 'factory-default',
    enabled: true,
  },
  {
    id: 'generation_planning',
    name: '生成任务规划',
    description: '把用户目标拆成可执行的生成步骤，并明确输出结构与验收标准',
    source: 'factory-default',
    enabled: true,
  },
];

export const AGENT_TOOL_CATALOG: AgentCapabilityBindingInput[] = [
  {
    id: 'read_artifact',
    name: '读取素材',
    description: '读取用户上传、会话引用或素材库中的文本/文件内容',
    source: 'factory-default',
    enabled: true,
  },
  {
    id: 'summarize_text',
    name: '总结文本',
    description: '把长文本压缩成结构化摘要、要点和风险提示',
    source: 'factory-default',
    enabled: true,
  },
  {
    id: 'web_search',
    name: '网络检索',
    description: '根据查询词检索外部资料并返回摘要线索',
    source: 'factory-default',
    enabled: true,
  },
];

function scoreCapability(agentText: string, capability: AgentCapabilityBindingInput) {
  const haystack = `${agentText} ${capability.name} ${capability.description}`.toLowerCase();
  let score = 0;
  if (/小说|网文|短视频|视频|镜头|爽点|改编/.test(haystack)) {
    if (/小说|短视频|镜头|爽点|素材/.test(`${capability.name} ${capability.description}`))
      score += 3;
  }
  if (/分析|拆解|结构|脚本|内容/.test(haystack)) {
    if (/分析|拆解|结构|总结/.test(`${capability.name} ${capability.description}`)) score += 2;
  }
  if (/文件|上传|素材|附件|读取/.test(haystack)) {
    if (/读取|素材|文件/.test(`${capability.name} ${capability.description}`)) score += 2;
  }
  if (/网络|检索|搜索|最新|竞品|资料/.test(haystack)) {
    if (/网络|检索|搜索|资料/.test(`${capability.name} ${capability.description}`)) score += 2;
  }
  return score;
}

function recommendFromCatalog(
  agentText: string,
  catalog: readonly AgentCapabilityBindingInput[],
  fallbackCount: number,
) {
  const scored = catalog
    .map((capability) => ({ capability, score: scoreCapability(agentText, capability) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((item) => ({
      ...item.capability,
      source: 'factory-default' as const,
      enabled: true,
      reason: `根据 Agent 需求自动推荐：${item.capability.description}`,
    }));

  return scored.length > 0
    ? scored
    : catalog.slice(0, fallbackCount).map((capability) => ({
        ...capability,
        source: 'factory-default' as const,
        enabled: true,
        reason: `作为通用默认能力启用：${capability.description}`,
      }));
}

export function recommendAgentCapabilities(agentText: string) {
  return {
    skills: recommendFromCatalog(agentText, AGENT_SKILL_CATALOG, 1),
    tools: recommendFromCatalog(agentText, AGENT_TOOL_CATALOG, 1),
  };
}
