'use client';

// Agent 配置详情页：基础信息 / Prompt 版本 / 模型与绑定 / 记忆策略 / 发布与删除
import type { MemoryPolicy } from '@agent-os/db';
import {
  AGENT_SKILL_CATALOG,
  AGENT_STATUS_LABELS,
  AGENT_TOOL_CATALOG,
  type AgentCapabilityBindingInput,
  MODEL_MODALITY_LABELS,
  type ModelModality,
  type ReasoningModeInput,
} from '@agent-os/shared';
import { Bot, Pencil, Plus, Trash2 } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Badge, Button, Dialog, Field, Input, Select, Tabs, Textarea } from '@/components/ui';
import { useWorkbenchStore } from '@/lib/store';
import { trpc } from '@/lib/trpc';
import { formatTime, providerOptionLabel, RUNTIME_URL, readRuntimeError } from '@/lib/utils';

type EvolveSuggestion = {
  summary: string;
  promptSuggestions?: string[];
  ruleSuggestions?: string[];
  testCaseSuggestions?: { name: string; input: string; expected: string }[];
  riskNotes?: string[];
};

type DnaState = {
  rules: string[];
  guidelines: string[];
  prompt: string;
  testCases: { name: string; input: string; expected: string }[];
  evaluationCriteria: string[];
  modelProfileId: string | null;
  modelProfileIds: string[];
  skills: AgentCapabilityBindingInput[];
  tools: AgentCapabilityBindingInput[];
  skillIds: string[];
  toolIds: string[];
  knowledgeBaseIds: string[];
  reasoningMode: ReasoningModeInput;
  memoryPolicy: MemoryPolicy;
};

const TABS = [
  { key: 'basic', label: '基础信息' },
  { key: 'prompt', label: 'Prompt 版本' },
  { key: 'binding', label: '模型与绑定' },
  { key: 'memory', label: '记忆策略' },
  { key: 'publish', label: '发布与删除' },
];

const MODEL_MODALITIES: ModelModality[] = ['text', 'image', 'video'];
const DEFAULT_REASONING_MODE: ReasoningModeInput = {
  strategy: 'direct',
  selfCheck: false,
  toolUse: 'when_needed',
  maxIterations: 3,
  verboseTrace: false,
  exposeReasoning: false,
};

function normalizeReasoningMode(mode?: Partial<ReasoningModeInput> | null): ReasoningModeInput {
  return {
    ...DEFAULT_REASONING_MODE,
    ...mode,
    maxIterations: Math.min(10, Math.max(1, Number(mode?.maxIterations) || 3)),
    verboseTrace: mode?.verboseTrace ?? false,
    exposeReasoning: false,
  };
}

export default function AgentConfigPage() {
  const params = useParams<{ id: string }>();
  const agentId = params.id;
  const router = useRouter();
  const { setCurrentAgent, setCurrentConversation } = useWorkbenchStore();
  const utils = trpc.useUtils();

  const { data, isLoading } = trpc.agent.get.useQuery({ agentId }, { enabled: !!agentId });
  const { data: history = [] } = trpc.agent.promptHistory.useQuery(
    { agentId },
    { enabled: !!agentId },
  );
  const { data: resourceList = [] } = trpc.resource.list.useQuery({});

  const [tab, setTab] = useState('basic');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [dna, setDna] = useState<DnaState | null>(null);
  const [changeNote, setChangeNote] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [evolveSuggestion, setEvolveSuggestion] = useState<EvolveSuggestion | null>(null);
  const [evolveLoading, setEvolveLoading] = useState(false);
  const [evolveError, setEvolveError] = useState<string | null>(null);
  const [modelDialogOpen, setModelDialogOpen] = useState(false);
  const [editingModelId, setEditingModelId] = useState<string | null>(null);
  const [modelName, setModelName] = useState('');
  const [modelBaseUrl, setModelBaseUrl] = useState('');
  const [modelId, setModelId] = useState('');
  const [modelModality, setModelModality] = useState<ModelModality>('text');
  const [modelSecret, setModelSecret] = useState('');
  const [modelError, setModelError] = useState<string | null>(null);

  // 数据到达后初始化本地编辑态（仅一次）
  useEffect(() => {
    if (!data || dna) return;
    setName(data.agent.name);
    setDescription(data.agent.description ?? '');
    setDna({
      prompt: data.prompt?.content ?? '',
      rules: data.dna?.rules ?? [],
      guidelines: data.dna?.guidelines ?? [],
      testCases: data.dna?.testCases ?? [],
      evaluationCriteria: data.dna?.evaluationCriteria ?? [],
      modelProfileId: data.dna?.modelProfileId ?? null,
      modelProfileIds: Array.from(
        new Set([
          ...(data.dna?.modelProfileId ? [data.dna.modelProfileId] : []),
          ...(data.dna?.modelProfileIds ?? []),
        ]),
      ),
      skills: data.dna?.skills ?? [],
      tools: data.dna?.tools ?? [],
      skillIds: data.dna?.skillIds ?? [],
      toolIds: data.dna?.toolIds ?? [],
      knowledgeBaseIds: data.dna?.knowledgeBaseIds ?? [],
      reasoningMode: normalizeReasoningMode(data.dna?.reasoningMode),
      memoryPolicy: data.dna?.memoryPolicy ?? {},
    });
  }, [data, dna]);

  const invalidate = async () => {
    await utils.agent.get.invalidate({ agentId });
    await utils.agent.promptHistory.invalidate({ agentId });
    await utils.agent.list.invalidate();
  };

  const updateBasic = trpc.agent.updateBasic.useMutation({
    onSuccess: async () => {
      await invalidate();
      setNotice('基础信息已保存');
    },
  });
  const updateDna = trpc.agent.updateDna.useMutation({
    onSuccess: async () => {
      await invalidate();
      setChangeNote('');
      setNotice('配置已保存（生成新 DNA 版本）');
    },
  });
  const restoreVersion = trpc.agent.restorePromptVersion.useMutation({
    onSuccess: async (_created, vars) => {
      await invalidate();
      const target = history.find((h) => h.id === vars.promptVersionId);
      if (target) setDna((d) => (d ? { ...d, prompt: target.content } : d));
      setNotice('已恢复历史版本');
    },
  });
  const deleteAgent = trpc.agent.delete.useMutation({
    onSuccess: async () => {
      await utils.agent.list.invalidate();
      await utils.artifact.list.invalidate();
      setCurrentAgent(null);
      setCurrentConversation(null);
      router.push('/');
    },
  });
  const createModelProvider = trpc.agent.createModelProvider.useMutation({
    onSuccess: async (provider) => {
      await utils.resource.list.invalidate();
      await invalidate();
      setDna((d) =>
        d
          ? {
              ...d,
              modelProfileId: d.modelProfileId ?? provider.id,
              modelProfileIds: Array.from(new Set([...d.modelProfileIds, provider.id])),
            }
          : d,
      );
      setModelDialogOpen(false);
      setModelSecret('');
      setNotice('模型 Provider 已添加到当前 Agent');
    },
    onError: (e) => setModelError(e.message),
  });
  const updateModelProvider = trpc.agent.updateModelProvider.useMutation({
    onSuccess: async (provider, variables) => {
      await utils.resource.list.invalidate();
      await invalidate();
      setDna((d) =>
        d
          ? {
              ...d,
              modelProfileId:
                d.modelProfileId === variables.resourceId ? provider.id : d.modelProfileId,
              modelProfileIds: Array.from(
                new Set(
                  d.modelProfileIds.map((id) => (id === variables.resourceId ? provider.id : id)),
                ),
              ),
            }
          : d,
      );
      setModelDialogOpen(false);
      setEditingModelId(null);
      setModelSecret('');
      setNotice('模型 Provider 已更新');
    },
    onError: (e) => setModelError(e.message),
  });
  const deleteModelProvider = trpc.agent.deleteModelProvider.useMutation({
    onSuccess: async (_result, variables) => {
      await utils.resource.list.invalidate();
      await invalidate();
      setDna((d) => {
        if (!d) return d;
        const modelProfileIds = d.modelProfileIds.filter((id) => id !== variables.resourceId);
        return {
          ...d,
          modelProfileId:
            d.modelProfileId === variables.resourceId
              ? (modelProfileIds[0] ?? null)
              : d.modelProfileId,
          modelProfileIds,
        };
      });
      setNotice('模型 Provider 已从当前 Agent 移除');
    },
    onError: (e) => setNotice(e.message),
  });

  function saveDna(note?: string) {
    if (!dna?.prompt.trim()) return;
    setNotice(null);
    updateDna.mutate({
      agentId,
      dna: {
        ...dna,
        modelProfileIds: Array.from(
          new Set([...(dna.modelProfileId ? [dna.modelProfileId] : []), ...dna.modelProfileIds]),
        ),
      },
      changeNote: note,
    });
  }

  async function generateEvolveSuggestion() {
    const ok = window.confirm(
      '生成改进建议会把该 Agent 的当前配置、最近会话和素材摘要发送给 Factory 默认模型进行分析。是否继续？',
    );
    if (!ok) return;
    setEvolveLoading(true);
    setEvolveError(null);
    setEvolveSuggestion(null);
    try {
      const res = await fetch(`${RUNTIME_URL}/factory/evolve`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ agentId }),
      });
      if (!res.ok) {
        setEvolveError(await readRuntimeError(res));
        return;
      }
      setEvolveSuggestion((await res.json()) as EvolveSuggestion);
    } catch (err) {
      setEvolveError(err instanceof Error ? err.message : '生成改进建议失败');
    } finally {
      setEvolveLoading(false);
    }
  }

  if (isLoading || !data || !dna) {
    return <div className="p-8 text-sm text-neutral-400">加载中…</div>;
  }

  const providers = resourceList.filter((r) => r.type === 'provider');
  const agentProviders = providers.filter(
    (p) =>
      (p.config as { agentId?: string }).agentId === agentId || dna.modelProfileIds.includes(p.id),
  );
  const kbs = resourceList.filter((r) => r.type === 'knowledge_base');
  const selectedProvider = agentProviders.find((p) => p.id === dna.modelProfileId) ?? null;
  const configuredProviders = agentProviders.filter((p) => dna.modelProfileIds.includes(p.id));
  const selectedProviderConfig = (selectedProvider?.config ?? {}) as {
    baseUrl?: string;
    modelId?: string;
    modality?: string;
    apiKeyResourceId?: string;
  };
  const selectedProviderModality = selectedProviderConfig.modality ?? 'text';

  function toggleId(key: 'skillIds' | 'toolIds' | 'knowledgeBaseIds', id: string) {
    setDna((d) =>
      d
        ? {
            ...d,
            [key]: d[key].includes(id) ? d[key].filter((v) => v !== id) : [...d[key], id],
          }
        : d,
    );
  }

  function toggleCapability(key: 'skills' | 'tools', capability: AgentCapabilityBindingInput) {
    setDna((d) => {
      if (!d) return d;
      const exists = d[key].some((item) => item.id === capability.id);
      return {
        ...d,
        [key]: exists
          ? d[key].filter((item) => item.id !== capability.id)
          : [
              ...d[key],
              {
                ...capability,
                source: 'manual',
                enabled: true,
                reason: '用户在当前 Agent 设置中手动添加',
              },
            ],
      };
    });
  }

  function setPrimaryModelProvider(id: string | null) {
    setDna((d) =>
      d
        ? {
            ...d,
            modelProfileId: id,
            modelProfileIds: id
              ? Array.from(new Set([id, ...d.modelProfileIds]))
              : d.modelProfileIds,
          }
        : d,
    );
  }

  function toggleModelProvider(id: string) {
    setDna((d) => {
      if (!d) return d;
      const exists = d.modelProfileIds.includes(id);
      const modelProfileIds = exists
        ? d.modelProfileIds.filter((modelId) => modelId !== id)
        : [...d.modelProfileIds, id];
      const modelProfileId =
        exists && d.modelProfileId === id ? (modelProfileIds[0] ?? null) : (d.modelProfileId ?? id);
      return { ...d, modelProfileId, modelProfileIds };
    });
  }

  function resetModelForm() {
    setEditingModelId(null);
    setModelName('');
    setModelBaseUrl('');
    setModelId('');
    setModelModality('text');
    setModelSecret('');
    setModelError(null);
  }

  function openCreateModelDialog() {
    resetModelForm();
    setModelDialogOpen(true);
  }

  function openEditModelDialog(provider: (typeof providers)[number]) {
    const config = provider.config as {
      baseUrl?: string;
      modelId?: string;
      modality?: ModelModality;
    };
    setEditingModelId(provider.id);
    setModelName(provider.name);
    setModelBaseUrl(config.baseUrl ?? '');
    setModelId(config.modelId ?? '');
    setModelModality(config.modality ?? 'text');
    setModelSecret('');
    setModelError(null);
    setModelDialogOpen(true);
  }

  function saveModelProvider() {
    if (!modelName.trim() || !modelBaseUrl.trim() || !modelId.trim()) {
      setModelError('请填写 Provider 名称、BaseURL 和模型 ID');
      return;
    }
    setModelError(null);
    const payload = {
      agentId,
      name: modelName.trim(),
      baseUrl: modelBaseUrl.trim(),
      modelId: modelId.trim(),
      modality: modelModality,
      secretValue: modelSecret.trim() || undefined,
    };
    if (editingModelId) {
      updateModelProvider.mutate({ ...payload, resourceId: editingModelId });
      return;
    }
    createModelProvider.mutate(payload);
  }

  function updateDnaTestCase(
    index: number,
    patch: Partial<{ name: string; input: string; expected: string }>,
  ) {
    setDna((d) =>
      d
        ? {
            ...d,
            testCases: d.testCases.map((testCase, i) =>
              i === index ? { ...testCase, ...patch } : testCase,
            ),
          }
        : d,
    );
  }

  function removeDnaTestCase(index: number) {
    setDna((d) =>
      d
        ? {
            ...d,
            testCases: d.testCases.filter((_, i) => i !== index),
          }
        : d,
    );
  }

  const shortTerm = dna.memoryPolicy.shortTerm;
  const longTerm = dna.memoryPolicy.longTerm;

  return (
    <div className="flex h-full flex-col bg-white">
      <header className="flex items-center gap-2 border-b border-neutral-200 bg-white px-6 py-3">
        <Bot size={18} className="text-neutral-500" />
        <h1 className="text-sm font-semibold">{data.agent.name}</h1>
        <Badge tone={data.agent.status === 'published' ? 'green' : 'neutral'}>
          {AGENT_STATUS_LABELS[data.agent.status] ?? data.agent.status}
        </Badge>
        <span className="text-xs text-neutral-400">
          DNA v{data.dna?.version ?? '-'} · Prompt v{data.prompt?.version ?? '-'}
        </span>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        <div className="mx-auto w-full max-w-2xl">
          <Tabs tabs={TABS} value={tab} onChange={setTab} />

          {notice && (
            <div className="mt-3 rounded-md bg-green-50 px-3 py-2 text-xs text-green-700">
              {notice}
            </div>
          )}

          <div className="mt-4">
            {tab === 'basic' && (
              <div>
                <Field label="Agent 名称">
                  <Input value={name} onChange={(e) => setName(e.target.value)} />
                </Field>
                <Field label="职责描述">
                  <Textarea
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </Field>
                <div className="mb-4 rounded-md border border-neutral-200 bg-neutral-50 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-xs font-medium text-neutral-500">当前模型设置</div>
                      <div className="mt-1 text-sm font-medium text-neutral-900">
                        {selectedProvider
                          ? providerOptionLabel(selectedProvider)
                          : '未绑定模型 Provider'}
                      </div>
                      <div className="mt-1 text-xs text-neutral-500">
                        {selectedProvider
                          ? '该 Agent 会优先使用这里绑定的自定义 Provider。'
                          : '未绑定时将回退到资源中心的 Factory 默认文本模型。'}
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setTab('binding')}
                    >
                      模型与绑定
                    </Button>
                  </div>
                </div>
                <Button
                  size="sm"
                  disabled={updateBasic.isPending || !name.trim()}
                  onClick={() => {
                    setNotice(null);
                    updateBasic.mutate({ agentId, name: name.trim(), description });
                  }}
                >
                  保存基础信息
                </Button>
              </div>
            )}

            {tab === 'prompt' && (
              <div>
                <Field label="Rules（每行一条）">
                  <Textarea
                    rows={4}
                    value={dna.rules.join('\n')}
                    onChange={(e) =>
                      setDna({
                        ...dna,
                        rules: e.target.value
                          .split('\n')
                          .map((v) => v.trim())
                          .filter(Boolean),
                      })
                    }
                  />
                </Field>
                <Field label="Guidelines（每行一条）">
                  <Textarea
                    rows={4}
                    value={dna.guidelines.join('\n')}
                    onChange={(e) =>
                      setDna({
                        ...dna,
                        guidelines: e.target.value
                          .split('\n')
                          .map((v) => v.trim())
                          .filter(Boolean),
                      })
                    }
                  />
                </Field>
                <Field label="测试样例">
                  <div className="space-y-3">
                    {dna.testCases.map((testCase, index) => (
                      <div
                        // biome-ignore lint/suspicious/noArrayIndexKey: 测试样例为本地配置草稿，可按顺序编辑
                        key={index}
                        className="space-y-2 rounded-md border border-neutral-200 p-3"
                      >
                        <div className="flex items-center gap-2">
                          <Input
                            value={testCase.name}
                            placeholder="样例名称"
                            onChange={(e) => updateDnaTestCase(index, { name: e.target.value })}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => removeDnaTestCase(index)}
                          >
                            删除
                          </Button>
                        </div>
                        <Textarea
                          rows={3}
                          value={testCase.input}
                          placeholder="输入：用户会真实提交的内容"
                          onChange={(e) => updateDnaTestCase(index, { input: e.target.value })}
                        />
                        <Textarea
                          rows={3}
                          value={testCase.expected}
                          placeholder="期望：可验证的输出结果"
                          onChange={(e) => updateDnaTestCase(index, { expected: e.target.value })}
                        />
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        setDna({
                          ...dna,
                          testCases: [
                            ...dna.testCases,
                            { name: '手动测试样例', input: '', expected: '' },
                          ],
                        })
                      }
                    >
                      新增测试样例
                    </Button>
                  </div>
                </Field>
                <Field label="发布判断标准（每行一条）">
                  <Textarea
                    rows={4}
                    value={dna.evaluationCriteria.join('\n')}
                    onChange={(e) =>
                      setDna({
                        ...dna,
                        evaluationCriteria: e.target.value
                          .split('\n')
                          .map((v) => v.trim())
                          .filter(Boolean),
                      })
                    }
                  />
                </Field>
                <Field label="系统提示词（保存后生成新版本）">
                  <Textarea
                    rows={12}
                    value={dna.prompt}
                    onChange={(e) => setDna({ ...dna, prompt: e.target.value })}
                  />
                </Field>
                <Field label="版本说明（可选）">
                  <Input
                    value={changeNote}
                    placeholder="例如：强化输出格式约束"
                    onChange={(e) => setChangeNote(e.target.value)}
                  />
                </Field>
                <Button
                  size="sm"
                  disabled={updateDna.isPending || !dna.prompt.trim()}
                  onClick={() => saveDna(changeNote.trim() || undefined)}
                >
                  保存 Prompt
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="ml-2"
                  disabled={evolveLoading}
                  onClick={generateEvolveSuggestion}
                >
                  {evolveLoading ? '分析中…' : '生成改进建议'}
                </Button>

                {evolveError && (
                  <div className="mt-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-600">
                    {evolveError}
                  </div>
                )}
                {evolveSuggestion && (
                  <div className="mt-3 rounded-md border border-neutral-200 bg-neutral-50 p-3 text-xs">
                    <div className="font-medium text-neutral-700">{evolveSuggestion.summary}</div>
                    {[
                      ['Prompt 建议', evolveSuggestion.promptSuggestions],
                      ['Rules 建议', evolveSuggestion.ruleSuggestions],
                      ['风险提示', evolveSuggestion.riskNotes],
                    ].map(([label, values]) =>
                      Array.isArray(values) && values.length > 0 ? (
                        <div key={label as string} className="mt-2">
                          <div className="font-medium text-neutral-600">{label as string}</div>
                          <ul className="mt-1 list-inside list-disc space-y-0.5 text-neutral-500">
                            {values.map((value) => (
                              <li key={value}>{value}</li>
                            ))}
                          </ul>
                        </div>
                      ) : null,
                    )}
                    {(evolveSuggestion.testCaseSuggestions?.length ?? 0) > 0 && (
                      <div className="mt-2">
                        <div className="font-medium text-neutral-600">测试样例建议</div>
                        <ul className="mt-1 list-inside list-disc space-y-0.5 text-neutral-500">
                          {evolveSuggestion.testCaseSuggestions?.map((testCase) => (
                            <li key={testCase.name}>
                              {testCase.name}：{testCase.input}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                <h3 className="mt-6 mb-2 text-sm font-semibold">版本历史</h3>
                <ul className="space-y-2">
                  {history.map((h) => (
                    <li key={h.id} className="rounded-md border border-neutral-200 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-sm">
                          <Badge tone={h.id === data.prompt?.id ? 'green' : 'neutral'}>
                            v{h.version}
                          </Badge>
                          <span className="text-xs text-neutral-400">
                            {formatTime(h.createdAt)}
                          </span>
                          {h.changeNote && (
                            <span className="text-xs text-neutral-500">{h.changeNote}</span>
                          )}
                        </div>
                        {h.id !== data.prompt?.id && (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={restoreVersion.isPending}
                            onClick={() =>
                              restoreVersion.mutate({ agentId, promptVersionId: h.id })
                            }
                          >
                            恢复此版本
                          </Button>
                        )}
                      </div>
                      <pre className="mt-2 max-h-28 overflow-auto whitespace-pre-wrap rounded bg-neutral-50 p-2 text-xs text-neutral-500">
                        {h.content}
                      </pre>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {tab === 'binding' && (
              <div>
                <div className="mb-4 rounded-md border border-neutral-200 bg-neutral-50 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium text-neutral-900">
                        当前 Agent 的模型 Provider
                      </div>
                      <p className="mt-1 text-xs leading-5 text-neutral-500">
                        这里维护的模型只服务于当前
                        Agent。会话输入框只能在下方可用模型中切换；新增、修改或移除会生成新的 DNA
                        版本。
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={openCreateModelDialog}
                    >
                      <Plus size={13} />
                      新增模型
                    </Button>
                  </div>
                </div>
                <Field label="默认模型 Provider">
                  <Select
                    value={dna.modelProfileId ?? ''}
                    onChange={(e) => setPrimaryModelProvider(e.target.value || null)}
                  >
                    <option value="">（未绑定）</option>
                    {agentProviders.map((p) => (
                      <option key={p.id} value={p.id}>
                        {providerOptionLabel(p)}
                      </option>
                    ))}
                  </Select>
                </Field>
                {agentProviders.length === 0 && (
                  <div className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                    当前 Agent 暂无模型 Provider。点击「新增模型」添加 BaseURL、模型 ID、能力和 API
                    Key。
                  </div>
                )}
                <Field label="当前 Agent 可用模型列表">
                  <div className="space-y-2">
                    {agentProviders.map((p) => {
                      const config = p.config as {
                        agentId?: string;
                        baseUrl?: string;
                        modelId?: string;
                        modality?: string;
                      };
                      const enabled = dna.modelProfileIds.includes(p.id);
                      const isAgentOwned = config.agentId === agentId;
                      return (
                        <div
                          key={p.id}
                          className="rounded-md border border-neutral-200 bg-white p-3 text-xs"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <button
                              type="button"
                              className="min-w-0 text-left"
                              onClick={() => toggleModelProvider(p.id)}
                            >
                              <div className="flex flex-wrap items-center gap-1.5">
                                <Badge tone={enabled ? 'blue' : 'neutral'}>
                                  {enabled ? '会话可用' : '未启用'}
                                </Badge>
                                {p.id === dna.modelProfileId && <Badge tone="green">默认</Badge>}
                                {!isAgentOwned && <Badge tone="amber">已接管时复制</Badge>}
                              </div>
                              <div className="mt-2 truncate text-sm font-medium text-neutral-900">
                                {providerOptionLabel(p)}
                              </div>
                              <div className="mt-1 truncate text-neutral-500">
                                {config.baseUrl ?? '-'}
                              </div>
                            </button>
                            <div className="flex shrink-0 gap-1">
                              {enabled && p.id !== dna.modelProfileId && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setPrimaryModelProvider(p.id)}
                                >
                                  设默认
                                </Button>
                              )}
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => openEditModelDialog(p)}
                              >
                                <Pencil size={12} />
                                修改
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                disabled={deleteModelProvider.isPending}
                                onClick={() => {
                                  if (window.confirm(`从当前 Agent 移除模型「${p.name}」？`)) {
                                    deleteModelProvider.mutate({ agentId, resourceId: p.id });
                                  }
                                }}
                              >
                                <Trash2 size={12} />
                                移除
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Field>
                {selectedProvider && (
                  <div className="mb-4 grid gap-2 rounded-md border border-neutral-200 p-3 text-xs md:grid-cols-2">
                    <div>
                      <div className="text-neutral-400">供应商</div>
                      <div className="mt-0.5 font-medium text-neutral-700">
                        {selectedProvider.name}
                      </div>
                    </div>
                    <div>
                      <div className="text-neutral-400">模型 ID</div>
                      <div className="mt-0.5 font-medium text-neutral-700">
                        {selectedProviderConfig.modelId ?? '-'}
                      </div>
                    </div>
                    <div>
                      <div className="text-neutral-400">模型能力</div>
                      <div className="mt-0.5 font-medium text-neutral-700">
                        {MODEL_MODALITY_LABELS[selectedProviderModality] ??
                          selectedProviderModality}
                      </div>
                    </div>
                    <div>
                      <div className="text-neutral-400">BaseURL</div>
                      <div className="mt-0.5 truncate font-medium text-neutral-700">
                        {selectedProviderConfig.baseUrl ?? '-'}
                      </div>
                    </div>
                  </div>
                )}
                {configuredProviders.length > 0 && (
                  <div className="mb-4 rounded-md border border-neutral-200 p-3 text-xs">
                    <div className="mb-2 font-medium text-neutral-700">会话可切换模型</div>
                    <div className="flex flex-wrap gap-1.5">
                      {configuredProviders.map((p) => (
                        <Badge key={p.id} tone={p.id === dna.modelProfileId ? 'green' : 'neutral'}>
                          {providerOptionLabel(p)}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                {(
                  [
                    ['skills', 'Skills', AGENT_SKILL_CATALOG],
                    ['tools', 'Tools', AGENT_TOOL_CATALOG],
                  ] as const
                ).map(([key, label, list]) => (
                  <Field key={key} label={label}>
                    <div className="flex flex-wrap gap-1.5">
                      {list.map((capability) => {
                        const active = dna[key].some((item) => item.id === capability.id);
                        return (
                          <button
                            key={capability.id}
                            type="button"
                            onClick={() => toggleCapability(key, capability)}
                          >
                            <Badge tone={active ? 'blue' : 'neutral'}>{capability.name}</Badge>
                          </button>
                        );
                      })}
                    </div>
                    <p className="mt-1 text-xs text-neutral-400">
                      这些能力属于当前 Agent 的 DNA，不来自资源与凭证。
                    </p>
                  </Field>
                ))}
                {([['knowledgeBaseIds', '知识库', kbs]] as const).map(([key, label, list]) => (
                  <Field key={key} label={label}>
                    <div className="flex flex-wrap gap-1.5">
                      {list.length === 0 && (
                        <span className="text-xs text-neutral-400">暂无可绑定资源</span>
                      )}
                      {list.map((r) => (
                        <button key={r.id} type="button" onClick={() => toggleId(key, r.id)}>
                          <Badge tone={dna[key].includes(r.id) ? 'blue' : 'neutral'}>
                            {r.name}
                          </Badge>
                        </button>
                      ))}
                    </div>
                  </Field>
                ))}
                <Button
                  size="sm"
                  disabled={updateDna.isPending}
                  onClick={() => saveDna('更新模型与绑定')}
                >
                  保存绑定配置
                </Button>
              </div>
            )}

            {tab === 'memory' && (
              <div>
                <Field label="思考模式">
                  <Select
                    value={dna.reasoningMode.strategy}
                    onChange={(e) =>
                      setDna({
                        ...dna,
                        reasoningMode: {
                          ...dna.reasoningMode,
                          strategy: e.target.value as ReasoningModeInput['strategy'],
                        },
                      })
                    }
                  >
                    <option value="direct">直接回答</option>
                    <option value="clarify_first">澄清优先</option>
                    <option value="plan_then_answer">先规划再回答</option>
                    <option value="tool_first">工具优先</option>
                    <option value="react">ReAct 多步执行</option>
                  </Select>
                </Field>
                <Field label="工具使用策略">
                  <Select
                    value={dna.reasoningMode.toolUse}
                    onChange={(e) =>
                      setDna({
                        ...dna,
                        reasoningMode: {
                          ...dna.reasoningMode,
                          toolUse: e.target.value as ReasoningModeInput['toolUse'],
                        },
                      })
                    }
                  >
                    <option value="none">不使用工具</option>
                    <option value="when_needed">按需使用工具</option>
                    <option value="required">优先使用工具</option>
                  </Select>
                </Field>
                <Field label="最大工具循环轮数">
                  <Input
                    type="number"
                    min={1}
                    max={10}
                    value={dna.reasoningMode.maxIterations}
                    onChange={(e) =>
                      setDna({
                        ...dna,
                        reasoningMode: {
                          ...dna.reasoningMode,
                          maxIterations: Math.min(10, Math.max(1, Number(e.target.value) || 3)),
                        },
                      })
                    }
                  />
                </Field>
                <Field label="自检">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={dna.reasoningMode.selfCheck}
                      onChange={(e) =>
                        setDna({
                          ...dna,
                          reasoningMode: {
                            ...dna.reasoningMode,
                            selfCheck: e.target.checked,
                            exposeReasoning: false,
                          },
                        })
                      }
                    />
                    最终回答前检查 Rules、输出格式和用户目标
                  </label>
                </Field>
                <Field label="Verbose Trace">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={dna.reasoningMode.verboseTrace}
                      onChange={(e) =>
                        setDna({
                          ...dna,
                          reasoningMode: {
                            ...dna.reasoningMode,
                            verboseTrace: e.target.checked,
                          },
                        })
                      }
                    />
                    记录工具循环调试轨迹（仅落库，不展示给用户）
                  </label>
                </Field>
                <Field label="短期记忆：上下文窗口（最近 N 条消息）">
                  <Input
                    type="number"
                    min={1}
                    max={200}
                    value={shortTerm?.type === 'window' ? shortTerm.maxMessages : 20}
                    onChange={(e) =>
                      setDna({
                        ...dna,
                        memoryPolicy: {
                          ...dna.memoryPolicy,
                          shortTerm: {
                            type: 'window',
                            maxMessages: Math.max(1, Number(e.target.value) || 20),
                          },
                        },
                      })
                    }
                  />
                </Field>
                <Field label="长期记忆">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={longTerm?.enabled ?? false}
                      onChange={(e) =>
                        setDna({
                          ...dna,
                          memoryPolicy: {
                            ...dna.memoryPolicy,
                            longTerm: {
                              enabled: e.target.checked,
                              scope: longTerm?.scope ?? 'agent',
                            },
                          },
                        })
                      }
                    />
                    启用长期记忆（MVP 占位，运行时暂未消费）
                  </label>
                </Field>
                <Button
                  size="sm"
                  disabled={updateDna.isPending}
                  onClick={() => saveDna('更新记忆策略')}
                >
                  保存记忆策略
                </Button>
              </div>
            )}

            {tab === 'publish' && (
              <div>
                <Field label="发布状态">
                  <Select
                    value={data.agent.status}
                    onChange={(e) => {
                      setNotice(null);
                      updateBasic.mutate({
                        agentId,
                        status: e.target.value as 'draft' | 'published' | 'archived',
                      });
                    }}
                  >
                    {Object.entries(AGENT_STATUS_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </Select>
                </Field>

                <div className="mt-6 rounded-md border border-red-200 p-4">
                  <h3 className="text-sm font-semibold text-red-600">危险操作</h3>
                  <p className="mt-1 text-xs text-neutral-500">
                    删除为软删除：相关会话会删除，已保存素材会保留并标记来源 Agent 已删除。
                  </p>
                  <Button
                    variant="danger"
                    size="sm"
                    className="mt-3"
                    disabled={deleteAgent.isPending}
                    onClick={() => {
                      if (window.confirm(`确定删除 Agent「${data.agent.name}」？`)) {
                        deleteAgent.mutate({ agentId });
                      }
                    }}
                  >
                    删除 Agent
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      <Dialog
        open={modelDialogOpen}
        onClose={() => {
          if (!createModelProvider.isPending && !updateModelProvider.isPending) {
            setModelDialogOpen(false);
          }
        }}
        title={editingModelId ? '修改模型 Provider' : '新增模型 Provider'}
      >
        <Field label="Provider 名称">
          <Input
            value={modelName}
            placeholder="例如：出图-火山引擎"
            onChange={(e) => setModelName(e.target.value)}
          />
        </Field>
        <Field label="BaseURL">
          <Input
            value={modelBaseUrl}
            placeholder="https://ark.cn-beijing.volces.com/api/v3"
            onChange={(e) => setModelBaseUrl(e.target.value)}
          />
        </Field>
        <Field label="模型 ID">
          <Input
            value={modelId}
            placeholder="doubao-seedream-5-0-260128"
            onChange={(e) => setModelId(e.target.value)}
          />
        </Field>
        <Field label="模型能力">
          <Select
            value={modelModality}
            onChange={(e) => setModelModality(e.target.value as ModelModality)}
          >
            {MODEL_MODALITIES.map((modality) => (
              <option key={modality} value={modality}>
                {MODEL_MODALITY_LABELS[modality]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={editingModelId ? 'API Key（可选，填写则更换）' : 'API Key（加密存储）'}>
          <Input
            type="password"
            value={modelSecret}
            placeholder="sk-..."
            onChange={(e) => setModelSecret(e.target.value)}
          />
        </Field>
        {modelError && (
          <div className="mb-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-600">
            {modelError}
          </div>
        )}
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={createModelProvider.isPending || updateModelProvider.isPending}
            onClick={() => setModelDialogOpen(false)}
          >
            取消
          </Button>
          <Button
            type="button"
            disabled={
              createModelProvider.isPending ||
              updateModelProvider.isPending ||
              !modelName.trim() ||
              !modelBaseUrl.trim() ||
              !modelId.trim()
            }
            onClick={saveModelProvider}
          >
            {editingModelId
              ? updateModelProvider.isPending
                ? '保存中…'
                : '保存'
              : createModelProvider.isPending
                ? '创建中…'
                : '创建并绑定'}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
