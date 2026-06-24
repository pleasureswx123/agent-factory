import { type AgentCapabilityBinding, artifacts, type Db } from '@agent-os/db';
import { inArray } from 'drizzle-orm';
import type { AgentTool } from './agent-runner';

type AgentToolContext = {
  db: Db;
  artifactIds: string[];
};

function stringArg(args: Record<string, unknown>, key: string) {
  const value = args[key];
  return typeof value === 'string' ? value.trim() : '';
}

function numberArg(args: Record<string, unknown>, key: string) {
  const value = args[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

async function readArtifactTool(ctx: AgentToolContext, args: Record<string, unknown>) {
  const explicitId = stringArg(args, 'artifactId');
  const ids = explicitId ? [explicitId] : ctx.artifactIds;
  if (ids.length === 0) return '当前消息没有引用素材。';

  const rows = await ctx.db.select().from(artifacts).where(inArray(artifacts.id, ids));
  if (rows.length === 0) return '没有找到可读取的素材。';

  return rows
    .map((artifact) =>
      [
        `素材 ID: ${artifact.id}`,
        `名称: ${artifact.name}`,
        `类型: ${artifact.type}`,
        artifact.content ? `内容:\n${artifact.content}` : '',
        !artifact.content && artifact.fileUrl ? `文件地址: ${artifact.fileUrl}` : '',
      ]
        .filter(Boolean)
        .join('\n'),
    )
    .join('\n\n---\n\n');
}

async function summarizeTextTool(args: Record<string, unknown>) {
  const text = stringArg(args, 'text');
  const maxLength = Math.min(2000, Math.max(120, numberArg(args, 'maxLength') ?? 600));
  if (!text) return '未提供需要总结的文本。';
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}\n\n[已截断：原文 ${text.length} 字符，保留前 ${maxLength} 字符]`;
}

export function loadAgentTools(
  bindings: AgentCapabilityBinding[],
  ctx: AgentToolContext,
): AgentTool[] {
  const enabledIds = new Set(
    bindings.filter((binding) => binding.enabled !== false).map((binding) => binding.id),
  );
  const tools: AgentTool[] = [];

  if (enabledIds.has('read_artifact')) {
    tools.push({
      id: 'read_artifact',
      name: '读取素材',
      description:
        '读取当前消息引用的素材，或按 artifactId 读取指定素材。参数：artifactId 可选字符串。',
      execute: (args) => readArtifactTool(ctx, args),
    });
  }

  if (enabledIds.has('summarize_text')) {
    tools.push({
      id: 'summarize_text',
      name: '总结文本',
      description: '把较长文本压缩到指定长度。参数：text 必填字符串，maxLength 可选数字。',
      execute: summarizeTextTool,
    });
  }

  return tools;
}
