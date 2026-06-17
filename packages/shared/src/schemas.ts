// 跨前后端共享的 zod schema（tRPC 输入校验 + 表单校验单一事实源）
import { z } from 'zod';

// ===== Agent =====

export const memoryPolicySchema = z.object({
  shortTerm: z
    .union([
      z.object({ type: z.literal('window'), maxMessages: z.number().int().min(1).max(200) }),
      z.object({ type: z.literal('summary'), maxTokens: z.number().int().min(100) }),
    ])
    .optional(),
  longTerm: z.object({ enabled: z.boolean(), scope: z.enum(['agent', 'conversation']) }).optional(),
});
export type MemoryPolicyInput = z.infer<typeof memoryPolicySchema>;

export const dnaConfigSchema = z.object({
  rules: z.array(z.string().min(1)).default([]),
  guidelines: z.array(z.string().min(1)).default([]),
  prompt: z.string().min(1, '系统提示词不能为空'),
  testCases: z
    .array(
      z.object({
        name: z.string().min(1),
        input: z.string().min(1),
        expected: z.string().min(1),
      }),
    )
    .default([]),
  evaluationCriteria: z.array(z.string().min(1)).default([]),
  modelProfileId: z.string().uuid().nullable().optional(),
  skillIds: z.array(z.string().uuid()).default([]),
  toolIds: z.array(z.string().uuid()).default([]),
  knowledgeBaseIds: z.array(z.string().uuid()).default([]),
  memoryPolicy: memoryPolicySchema.default({}),
});
export type DnaConfigInput = z.infer<typeof dnaConfigSchema>;

export const createAgentSchema = z.object({
  name: z.string().min(1, '名称不能为空').max(128),
  description: z.string().max(2000).optional(),
  status: z.enum(['draft', 'published']).default('draft'),
  dna: dnaConfigSchema,
});
export type CreateAgentInput = z.infer<typeof createAgentSchema>;

export const updateAgentBasicSchema = z.object({
  agentId: z.string().uuid(),
  name: z.string().min(1).max(128).optional(),
  description: z.string().max(2000).optional(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
});

export const updateAgentDnaSchema = z.object({
  agentId: z.string().uuid(),
  dna: dnaConfigSchema,
  changeNote: z.string().max(500).optional(),
});

// ===== Conversation / Message =====

export const createConversationSchema = z.object({
  agentId: z.string().uuid(),
  title: z.string().max(256).optional(),
});

export const renameConversationSchema = z.object({
  conversationId: z.string().uuid(),
  title: z.string().min(1).max(256),
});

// ===== Artifact =====

export const artifactTypeSchema = z.enum([
  'text',
  'json',
  'image',
  'audio',
  'video',
  'report',
  'file',
]);

export const createArtifactSchema = z.object({
  agentId: z.string().uuid().nullable().optional(),
  conversationId: z.string().uuid().nullable().optional(),
  messageId: z.string().uuid().nullable().optional(),
  name: z.string().min(1, '素材名称不能为空').max(256),
  type: artifactTypeSchema,
  content: z.string().optional(),
  fileUrl: z.string().optional(),
  thumbnailUrl: z.string().optional(),
  mimeType: z.string().max(128).optional(),
  sizeBytes: z.number().int().optional(),
});
export type CreateArtifactInput = z.infer<typeof createArtifactSchema>;

// ===== Resource =====

export const resourceTypeSchema = z.enum([
  'provider',
  'api_key',
  'skill',
  'tool',
  'knowledge_base',
]);

export const modelModalitySchema = z.enum(['text', 'image', 'video']);
export type ModelModality = z.infer<typeof modelModalitySchema>;

export const providerConfigSchema = z.object({
  baseUrl: z.string().url('BaseURL 格式不正确'),
  modelId: z.string().min(1, '模型 ID 不能为空'),
  /** 模型能力模态：文本对话 / 图像生成 / 视频生成；缺省按 text 处理 */
  modality: modelModalitySchema.optional(),
  /** 复用资源中心已有的 API Key 资源；与 apiKey 二选一 */
  apiKeyResourceId: z.string().uuid().optional(),
});
export type ProviderConfig = z.infer<typeof providerConfigSchema>;

export const createResourceSchema = z.object({
  type: resourceTypeSchema,
  name: z.string().min(1, '资源名称不能为空').max(128),
  config: z.record(z.unknown()).default({}),
  /** 明文密钥（api_key / provider 可选），服务端加密后只存密文 */
  secretValue: z.string().min(1).optional(),
});
export type CreateResourceInput = z.infer<typeof createResourceSchema>;

export const updateResourceSchema = z.object({
  resourceId: z.string().uuid(),
  name: z.string().min(1).max(128).optional(),
  status: z.enum(['active', 'disabled', 'configuring']).optional(),
  config: z.record(z.unknown()).optional(),
  secretValue: z.string().min(1).optional(),
});
