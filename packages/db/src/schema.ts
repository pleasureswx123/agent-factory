// AgentOS MVP - Drizzle schema 草稿 v0.1
// 对齐 docs/PRD-AgentOS单AgentMVP.md 第 8 节字段。
// prompt_versions 从 AgentDNA 拆出，便于 Prompt 独立版本化。
// 循环外键通过 references(() => ...) 的回调形式做前向引用。

import { sql } from 'drizzle-orm';
import {
  type AnyPgColumn,
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

// ===== Enums =====

export const agentStatusEnum = pgEnum('agent_status', ['draft', 'published', 'archived']);
export const dnaStatusEnum = pgEnum('dna_status', ['draft', 'published']);
export const messageRoleEnum = pgEnum('message_role', ['user', 'assistant', 'system', 'tool']);
export const artifactTypeEnum = pgEnum('artifact_type', [
  'text',
  'json',
  'image',
  'audio',
  'video',
  'report',
  'file',
]);
export const artifactStatusEnum = pgEnum('artifact_status', ['saved', 'archived']);
export const resourceTypeEnum = pgEnum('resource_type', [
  'provider',
  'api_key',
  'skill',
  'tool',
  'knowledge_base',
]);
export const resourceStatusEnum = pgEnum('resource_status', ['active', 'disabled', 'configuring']);
export const memoryScopeEnum = pgEnum('memory_scope', ['agent', 'conversation']);

// ===== Type helpers (JSON 字段强类型) =====

export type MemoryPolicy = {
  shortTerm?: { type: 'window'; maxMessages: number } | { type: 'summary'; maxTokens: number };
  longTerm?: { enabled: boolean; scope: 'agent' | 'conversation' };
};

export type AgentRule = string;
export type AgentGuideline = string;
export type AgentTestCase = {
  name: string;
  input: string;
  expected: string;
};

export type MessagePart =
  | { type: 'text'; text: string }
  | { type: 'tool-call'; toolCallId: string; toolName: string; args: unknown }
  | { type: 'tool-result'; toolCallId: string; result: unknown }
  | { type: 'artifact-ref'; artifactId: string };

export type MessageContent = MessagePart[];

export type TokenUsage = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
};

// ===== Users（为多租户预留；MVP 单用户也走这张表）=====

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: varchar('email', { length: 256 }).notNull(),
    name: varchar('name', { length: 128 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    emailUq: uniqueIndex('users_email_uq').on(t.email),
  }),
);

// ===== Agents =====

export const agents = pgTable(
  'agents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id),
    name: varchar('name', { length: 128 }).notNull(),
    description: text('description'),
    avatarUrl: text('avatar_url'),
    status: agentStatusEnum('status').notNull().default('draft'),
    currentDnaId: uuid('current_dna_id').references((): AnyPgColumn => agentDnas.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => ({
    ownerIdx: index('agents_owner_idx').on(t.ownerId),
    ownerNameIdx: index('agents_owner_name_idx').on(t.ownerId, t.name),
  }),
);

// ===== Prompt Versions（从 AgentDNA 拆出）=====

export const promptVersions = pgTable(
  'prompt_versions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    agentId: uuid('agent_id')
      .notNull()
      .references(() => agents.id, { onDelete: 'cascade' }),
    version: integer('version').notNull(), // 每个 agent 内部从 1 自增
    content: text('content').notNull(),
    changeNote: text('change_note'),
    authorId: uuid('author_id').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    agentVerUq: uniqueIndex('prompt_versions_agent_version_uq').on(t.agentId, t.version),
  }),
);

// ===== AgentDNA（Agent 配置快照，引用 prompt_version + 资源）=====

export const agentDnas = pgTable(
  'agent_dnas',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    agentId: uuid('agent_id')
      .notNull()
      .references(() => agents.id, { onDelete: 'cascade' }),
    version: integer('version').notNull(),
    promptVersionId: uuid('prompt_version_id')
      .notNull()
      .references(() => promptVersions.id, { onDelete: 'restrict' }),
    modelProfileId: uuid('model_profile_id').references((): AnyPgColumn => resources.id, {
      onDelete: 'set null',
    }),
    rules: jsonb('rules').$type<AgentRule[]>().notNull().default(sql`'[]'::jsonb`),
    guidelines: jsonb('guidelines').$type<AgentGuideline[]>().notNull().default(sql`'[]'::jsonb`),
    testCases: jsonb('test_cases').$type<AgentTestCase[]>().notNull().default(sql`'[]'::jsonb`),
    evaluationCriteria: jsonb('evaluation_criteria')
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    skillIds: jsonb('skill_ids').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    toolIds: jsonb('tool_ids').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    knowledgeBaseIds: jsonb('knowledge_base_ids')
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    memoryPolicy: jsonb('memory_policy').$type<MemoryPolicy>().notNull().default(sql`'{}'::jsonb`),
    status: dnaStatusEnum('status').notNull().default('draft'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    agentVerUq: uniqueIndex('agent_dnas_agent_version_uq').on(t.agentId, t.version),
  }),
);

// ===== Conversations =====

export const conversations = pgTable(
  'conversations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    agentId: uuid('agent_id')
      .notNull()
      .references(() => agents.id, { onDelete: 'cascade' }),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id),
    title: varchar('title', { length: 256 }),
    pinned: boolean('pinned').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    agentUpdatedIdx: index('conversations_agent_updated_idx').on(t.agentId, t.updatedAt),
  }),
);

// ===== Messages =====

export const messages = pgTable(
  'messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    role: messageRoleEnum('role').notNull(),
    content: jsonb('content').$type<MessageContent>().notNull(),
    artifactRefs: jsonb('artifact_refs').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    toolCalls: jsonb('tool_calls'),
    tokenUsage: jsonb('token_usage').$type<TokenUsage>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    convCreatedIdx: index('messages_conversation_created_idx').on(t.conversationId, t.createdAt),
  }),
);

// ===== Artifacts =====

export const artifacts = pgTable(
  'artifacts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id),
    agentId: uuid('agent_id').references(() => agents.id, { onDelete: 'set null' }),
    conversationId: uuid('conversation_id').references(() => conversations.id, {
      onDelete: 'set null',
    }),
    messageId: uuid('message_id').references(() => messages.id, { onDelete: 'set null' }),
    name: varchar('name', { length: 256 }).notNull(),
    type: artifactTypeEnum('type').notNull(),
    status: artifactStatusEnum('status').notNull().default('saved'),
    content: text('content'),
    fileUrl: text('file_url'),
    thumbnailUrl: text('thumbnail_url'),
    mimeType: varchar('mime_type', { length: 128 }),
    sizeBytes: integer('size_bytes'),
    sourceAgentDeleted: boolean('source_agent_deleted').notNull().default(false),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    ownerCreatedIdx: index('artifacts_owner_created_idx').on(t.ownerId, t.createdAt),
    agentCreatedIdx: index('artifacts_agent_created_idx').on(t.agentId, t.createdAt),
  }),
);

// ===== Secrets（envelope encryption，与 resources 解耦）=====

export const secrets = pgTable('secrets', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerId: uuid('owner_id')
    .notNull()
    .references(() => users.id),
  alias: varchar('alias', { length: 128 }).notNull(),
  ciphertext: text('ciphertext').notNull(),
  iv: text('iv').notNull(),
  authTag: text('auth_tag').notNull(),
  encryptedDek: text('encrypted_dek').notNull(),
  kmsKeyId: varchar('kms_key_id', { length: 256 }),
  hint: varchar('hint', { length: 64 }), // UI 上只显示 "sk-****1234"
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  rotatedAt: timestamp('rotated_at', { withTimezone: true }),
});

// ===== Resources（Provider / API Key / Skill / Tool / KB 统一抽象）=====

export const resources = pgTable(
  'resources',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id),
    type: resourceTypeEnum('type').notNull(),
    name: varchar('name', { length: 128 }).notNull(),
    status: resourceStatusEnum('status').notNull().default('configuring'),
    config: jsonb('config').$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    secretId: uuid('secret_id').references(() => secrets.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    ownerTypeIdx: index('resources_owner_type_idx').on(t.ownerId, t.type),
  }),
);

// ===== Agent Memory（长期记忆 KV）=====

export const agentMemory = pgTable(
  'agent_memory',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    agentId: uuid('agent_id')
      .notNull()
      .references(() => agents.id, { onDelete: 'cascade' }),
    conversationId: uuid('conversation_id').references(() => conversations.id, {
      onDelete: 'cascade',
    }),
    scope: memoryScopeEnum('scope').notNull(),
    key: varchar('key', { length: 256 }).notNull(),
    value: jsonb('value').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    agentScopeKeyUq: uniqueIndex('agent_memory_agent_scope_key_uq').on(t.agentId, t.scope, t.key),
  }),
);

// ===== Audit Logs =====

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id),
    action: varchar('action', { length: 64 }).notNull(), // e.g. 'agent.delete'
    entityType: varchar('entity_type', { length: 64 }).notNull(),
    entityId: uuid('entity_id').notNull(),
    payload: jsonb('payload'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    entityCreatedIdx: index('audit_logs_entity_created_idx').on(
      t.entityType,
      t.entityId,
      t.createdAt,
    ),
  }),
);

// ===== Inferred types =====

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Agent = typeof agents.$inferSelect;
export type NewAgent = typeof agents.$inferInsert;
export type AgentDna = typeof agentDnas.$inferSelect;
export type NewAgentDna = typeof agentDnas.$inferInsert;
export type PromptVersion = typeof promptVersions.$inferSelect;
export type NewPromptVersion = typeof promptVersions.$inferInsert;
export type Conversation = typeof conversations.$inferSelect;
export type NewConversation = typeof conversations.$inferInsert;
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
export type Artifact = typeof artifacts.$inferSelect;
export type NewArtifact = typeof artifacts.$inferInsert;
export type Resource = typeof resources.$inferSelect;
export type NewResource = typeof resources.$inferInsert;
export type Secret = typeof secrets.$inferSelect;
export type NewSecret = typeof secrets.$inferInsert;
