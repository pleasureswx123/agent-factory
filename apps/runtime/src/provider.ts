// 模型 Provider 解析：resources(provider) + secrets → 模型档案 / AI SDK LanguageModel
import { type Db, resources, secrets } from '@agent-os/db';
import { MODEL_MODALITY_LABELS, type ModelModality } from '@agent-os/shared';
import { decryptSecret } from '@agent-os/shared/crypto';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { LanguageModel } from 'ai';
import { eq } from 'drizzle-orm';

type ProviderConfig = {
  baseUrl?: string;
  modelId?: string;
  modality?: ModelModality;
  apiKeyResourceId?: string;
};

/** 解析后的模型档案：原始连接信息 + 模态，供按模态分流到不同 API */
export type ModelProfile = {
  id: string;
  name: string;
  baseUrl: string;
  modelId: string;
  apiKey: string;
  modality: ModelModality;
};

export async function resolveProviderProfile(
  db: Db,
  modelProfileId: string,
): Promise<ModelProfile> {
  const [provider] = await db
    .select()
    .from(resources)
    .where(eq(resources.id, modelProfileId))
    .limit(1);

  if (provider?.type !== 'provider') {
    throw new Error('模型 Provider 不存在，请检查 Agent 的模型配置');
  }
  if (provider.status === 'disabled') {
    throw new Error(`模型 Provider「${provider.name}」已禁用`);
  }

  const cfg = provider.config as ProviderConfig;
  if (!cfg.baseUrl || !cfg.modelId) {
    throw new Error(`模型 Provider「${provider.name}」缺少 baseUrl 或 modelId 配置`);
  }

  // 密钥：优先 provider 自身绑定，其次引用的 API Key 资源
  let secretId = provider.secretId;
  if (!secretId && cfg.apiKeyResourceId) {
    const [apiKeyResource] = await db
      .select()
      .from(resources)
      .where(eq(resources.id, cfg.apiKeyResourceId))
      .limit(1);
    secretId = apiKeyResource?.secretId ?? null;
  }

  let apiKey = 'sk-no-key';
  if (secretId) {
    const [secret] = await db.select().from(secrets).where(eq(secrets.id, secretId)).limit(1);
    if (secret) apiKey = decryptSecret(secret);
  }

  return {
    id: provider.id,
    name: provider.name,
    baseUrl: cfg.baseUrl,
    modelId: cfg.modelId,
    apiKey,
    modality: cfg.modality ?? 'text',
  };
}

/** 文本模态档案 → AI SDK LanguageModel（OpenAI 兼容 chat 接口） */
export function buildLanguageModel(profile: ModelProfile): LanguageModel {
  const openaiCompatible = createOpenAICompatible({
    name: profile.name,
    baseURL: profile.baseUrl,
    apiKey: profile.apiKey,
  });
  return openaiCompatible(profile.modelId);
}

/** 仅文本对话场景（Factory 澄清 / 试跑）使用：非 text 模态给出明确报错 */
export async function resolveModel(db: Db, modelProfileId: string): Promise<LanguageModel> {
  const profile = await resolveProviderProfile(db, modelProfileId);
  if (profile.modality !== 'text') {
    throw new Error(
      `模型 Provider「${profile.name}」是${MODEL_MODALITY_LABELS[profile.modality]}模型，此场景仅支持文本对话模型`,
    );
  }
  return buildLanguageModel(profile);
}

/** Factory 对话使用：优先取标记为 Factory 默认的 provider，否则回退到第一个可用的文本模型 */
export async function resolveDefaultModel(db: Db): Promise<LanguageModel> {
  const rows = await db
    .select({ id: resources.id, status: resources.status, config: resources.config })
    .from(resources)
    .where(eq(resources.type, 'provider'));
  // Factory 是文本对话场景，只考虑 text 模态的 provider
  const textRows = rows.filter((r) => ((r.config as ProviderConfig).modality ?? 'text') === 'text');
  const isFactoryDefault = (r: (typeof rows)[number]) =>
    (r.config as { factoryDefault?: boolean }).factoryDefault === true;
  const active =
    textRows.find((r) => r.status === 'active' && isFactoryDefault(r)) ??
    textRows.find((r) => r.status === 'active') ??
    textRows[0];
  if (!active) {
    throw new Error('尚未配置文本对话模型 Provider，请先到「资源与凭证中心」添加');
  }
  return resolveModel(db, active.id);
}
