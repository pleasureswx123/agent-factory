type ResourceCandidate = {
  id: string;
  type: 'skill' | 'tool' | 'knowledge_base' | string;
  name: string;
  config?: Record<string, unknown>;
};

type RecommendedResourceIds = {
  skillIds: string[];
  toolIds: string[];
  knowledgeBaseIds: string[];
};

function textOf(resource: ResourceCandidate) {
  const description =
    typeof resource.config?.description === 'string' ? resource.config.description : '';
  const key = typeof resource.config?.key === 'string' ? resource.config.key : '';
  return `${resource.name} ${key} ${description}`.toLowerCase();
}

function isExecutableResource(resource: ResourceCandidate) {
  if (resource.config?.placeholder === true || resource.config?.executable === false) return false;
  return !/占位|暂不执行|不可用/.test(textOf(resource));
}

function scoreResource(agentText: string, resource: ResourceCandidate) {
  const haystack = `${agentText} ${textOf(resource)}`.toLowerCase();
  let score = 0;
  if (/文件|上传|附件|素材|解析|读取/.test(haystack))
    score += textOf(resource).includes('file') ? 2 : 0;
  if (/总结|摘要|归纳|分析|拆解/.test(haystack))
    score += /总结|summarize/.test(textOf(resource)) ? 2 : 0;
  if (/网络|检索|搜索|最新|竞品|资料/.test(haystack))
    score += /检索|search/.test(textOf(resource)) ? 2 : 0;
  return score;
}

export function recommendAgentResourceIds(
  agentText: string,
  resources: readonly ResourceCandidate[],
): RecommendedResourceIds {
  const byScore = resources
    .filter(isExecutableResource)
    .map((resource) => ({ resource, score: scoreResource(agentText, resource) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  return {
    skillIds: byScore
      .filter((item) => item.resource.type === 'skill')
      .map((item) => item.resource.id),
    toolIds: byScore
      .filter((item) => item.resource.type === 'tool')
      .map((item) => item.resource.id),
    knowledgeBaseIds: byScore
      .filter((item) => item.resource.type === 'knowledge_base')
      .map((item) => item.resource.id),
  };
}
