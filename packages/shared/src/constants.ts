// AgentOS 共享常量

/** MVP 单用户模式下的默认本地用户 id（seed 时写入） */
export const DEFAULT_USER_ID = '00000000-0000-0000-0000-000000000001';

/** 内置 Skills（seed 时作为 skill 资源写入资源中心） */
export const BUILTIN_SKILLS = [
  { key: 'file-parse', name: '文件解析', description: '解析用户上传的文本类文件内容' },
  { key: 'summarize', name: '总结', description: '对长文本进行结构化总结' },
  {
    key: 'web-search',
    name: '网络检索',
    description: '检索网络信息（占位，MVP 暂不执行真实检索）',
  },
] as const;

export const RESOURCE_TYPE_LABELS: Record<string, string> = {
  provider: '模型 Provider',
  api_key: 'API Key',
  skill: 'Skill',
  tool: 'Tool',
  knowledge_base: '知识库',
};

export const AGENT_STATUS_LABELS: Record<string, string> = {
  draft: '草稿',
  published: '已发布',
  archived: '已归档',
};

export const MODEL_MODALITY_LABELS: Record<string, string> = {
  text: '文本对话',
  image: '图像生成',
  video: '视频生成',
};

export const ARTIFACT_TYPE_LABELS: Record<string, string> = {
  text: '文本',
  json: 'JSON',
  image: '图片',
  audio: '音频',
  video: '视频',
  report: '报告',
  file: '文件',
};
