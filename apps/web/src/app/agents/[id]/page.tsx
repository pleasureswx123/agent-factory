'use client';

// Agent 配置详情页：基础信息 / Prompt 版本 / 模型与绑定 / 记忆策略 / 发布与删除
import type { MemoryPolicy } from '@agent-os/db';
import { AGENT_STATUS_LABELS } from '@agent-os/shared';
import { Bot } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Badge, Button, Field, Input, Tabs, Textarea } from '@/components/ui';
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
  skillIds: string[];
  toolIds: string[];
  knowledgeBaseIds: string[];
  memoryPolicy: MemoryPolicy;
};

const TABS = [
  { key: 'basic', label: '基础信息' },
  { key: 'prompt', label: 'Prompt 版本' },
  { key: 'binding', label: '模型与绑定' },
  { key: 'memory', label: '记忆策略' },
  { key: 'publish', label: '发布与删除' },
];

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
      skillIds: data.dna?.skillIds ?? [],
      toolIds: data.dna?.toolIds ?? [],
      knowledgeBaseIds: data.dna?.knowledgeBaseIds ?? [],
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

  function saveDna(note?: string) {
    if (!dna?.prompt.trim()) return;
    setNotice(null);
    updateDna.mutate({ agentId, dna, changeNote: note });
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
  const skills = resourceList.filter((r) => r.type === 'skill');
  const tools = resourceList.filter((r) => r.type === 'tool');
  const kbs = resourceList.filter((r) => r.type === 'knowledge_base');

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
    <div className="flex h-full flex-col">
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

      <div className="px-6 pt-3">
        <Tabs tabs={TABS} value={tab} onChange={setTab} />
      </div>

      {notice && (
        <div className="mx-6 mt-3 rounded-md bg-green-50 px-3 py-2 text-xs text-green-700">
          {notice}
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-6 py-4">
        <div className="max-w-2xl">
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
                        <span className="text-xs text-neutral-400">{formatTime(h.createdAt)}</span>
                        {h.changeNote && (
                          <span className="text-xs text-neutral-500">{h.changeNote}</span>
                        )}
                      </div>
                      {h.id !== data.prompt?.id && (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={restoreVersion.isPending}
                          onClick={() => restoreVersion.mutate({ agentId, promptVersionId: h.id })}
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
              <Field label="模型 Provider">
                <select
                  className="h-9 w-full rounded-md border border-neutral-300 bg-white px-2 text-sm"
                  value={dna.modelProfileId ?? ''}
                  onChange={(e) => setDna({ ...dna, modelProfileId: e.target.value || null })}
                >
                  <option value="">（未绑定，使用默认）</option>
                  {providers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {providerOptionLabel(p)}
                    </option>
                  ))}
                </select>
              </Field>
              {(
                [
                  ['skillIds', 'Skills', skills],
                  ['toolIds', 'Tools', tools],
                  ['knowledgeBaseIds', '知识库', kbs],
                ] as const
              ).map(([key, label, list]) => (
                <Field key={key} label={label}>
                  <div className="flex flex-wrap gap-1.5">
                    {list.length === 0 && (
                      <span className="text-xs text-neutral-400">暂无可绑定资源</span>
                    )}
                    {list.map((r) => (
                      <button key={r.id} type="button" onClick={() => toggleId(key, r.id)}>
                        <Badge tone={dna[key].includes(r.id) ? 'blue' : 'neutral'}>{r.name}</Badge>
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
                <select
                  className="h-9 w-full rounded-md border border-neutral-300 bg-white px-2 text-sm"
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
                </select>
              </Field>

              <div className="mt-6 rounded-md border border-red-200 p-4">
                <h3 className="text-sm font-semibold text-red-600">危险操作</h3>
                <p className="mt-1 text-xs text-neutral-500">
                  删除为软删除：对应会话、消息与产出素材会一并删除。
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
  );
}
