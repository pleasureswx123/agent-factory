'use client';

import {
  type AgentCapabilityBindingInput,
  FACTORY_SKILL_CATALOG,
  FACTORY_TOOL_CATALOG,
  type FactoryDnaConfigInput,
  type ReasoningModeInput,
} from '@agent-os/shared';
import { Bot, Factory, Sparkles, WandSparkles } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Badge, Button, Field, Input, Select, Textarea } from '@/components/ui';
import { trpc } from '@/lib/trpc';
import { providerOptionLabel } from '@/lib/utils';

const ICONS = [
  { value: 'factory', label: 'Factory', Icon: Factory },
  { value: 'sparkles', label: 'Sparkles', Icon: Sparkles },
  { value: 'bot', label: 'Bot', Icon: Bot },
  { value: 'wand', label: 'Wand', Icon: WandSparkles },
] as const;

const DEFAULT_REASONING_MODE: ReasoningModeInput = {
  strategy: 'plan_then_answer',
  selfCheck: true,
  toolUse: 'when_needed',
  maxIterations: 3,
  verboseTrace: false,
  exposeReasoning: false,
};

function normalizeDraft(dna: FactoryDnaConfigInput): FactoryDnaConfigInput {
  return {
    ...dna,
    reasoningMode: {
      ...DEFAULT_REASONING_MODE,
      ...dna.reasoningMode,
      exposeReasoning: false,
    },
    memoryPolicy: dna.memoryPolicy ?? {},
  };
}

function toggleCapability(
  list: AgentCapabilityBindingInput[],
  capability: AgentCapabilityBindingInput,
) {
  const exists = list.some((item) => item.id === capability.id);
  return exists
    ? list.filter((item) => item.id !== capability.id)
    : [
        ...list,
        {
          ...capability,
          source: 'manual' as const,
          enabled: true,
          reason: '用户在 FactoryDNA 设置中手动添加',
        },
      ];
}

export default function FactorySettingsPage() {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.factory.getDna.useQuery();
  const { data: history = [] } = trpc.factory.history.useQuery();
  const { data: resourceList = [] } = trpc.resource.list.useQuery({});
  const providers = resourceList.filter((resource) => resource.type === 'provider');
  const [draft, setDraft] = useState<FactoryDnaConfigInput | null>(null);
  const [changeNote, setChangeNote] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  const updateDna = trpc.factory.updateDna.useMutation({
    onSuccess: async () => {
      await utils.factory.getDna.invalidate();
      await utils.factory.history.invalidate();
      setChangeNote('');
      setNotice('FactoryDNA 已保存为新版本');
    },
  });

  useEffect(() => {
    if (!data || draft) return;
    setDraft(normalizeDraft(data.dna));
  }, [data, draft]);

  if (isLoading || !data || !draft) {
    return <div className="p-8 text-sm text-neutral-400">加载中...</div>;
  }

  const ActiveIcon = ICONS.find((item) => item.value === draft.icon)?.Icon ?? Factory;
  const shortTerm = draft.memoryPolicy.shortTerm;

  return (
    <div className="flex h-full flex-col bg-white">
      <header className="flex items-center gap-2 border-b border-neutral-200 bg-white px-6 py-3">
        <ActiveIcon size={18} className="text-neutral-500" />
        <h1 className="text-sm font-semibold">FactoryDNA 设置</h1>
        <Badge tone="blue">Meta-Agent</Badge>
        <span className="text-xs text-neutral-400">v{data.version || 'default'}</span>
        <Link href="/factory" className="ml-auto text-xs text-neutral-500 hover:text-neutral-900">
          返回 Factory
        </Link>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_320px]">
        <div className="overflow-y-auto px-6 py-4">
          <div className="mx-auto w-full max-w-3xl">
            {notice && (
              <div className="mb-3 rounded-md bg-green-50 px-3 py-2 text-xs text-green-700">
                {notice}
              </div>
            )}

            <div className="mb-4 rounded-md border border-neutral-200 bg-neutral-50 p-3">
              <div className="text-sm font-medium text-neutral-900">Agent Factory 自身 DNA</div>
              <p className="mt-1 text-xs leading-5 text-neutral-500">
                这里配置的是创建其他 Agent 的 Meta-Agent。保存后，Factory 对话、候选 Agent
                生成和发布评估会使用新的 FactoryDNA。
              </p>
            </div>

            <Field label="名称">
              <Input
                value={draft.name}
                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
              />
            </Field>

            <Field label="Icon">
              <div className="flex flex-wrap gap-2">
                {ICONS.map(({ value, label, Icon }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setDraft({ ...draft, icon: value })}
                    className={`flex h-9 items-center gap-2 rounded-md border px-3 text-sm ${
                      draft.icon === value
                        ? 'border-neutral-900 bg-neutral-900 text-white'
                        : 'border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50'
                    }`}
                  >
                    <Icon size={15} />
                    {label}
                  </button>
                ))}
              </div>
            </Field>

            <Field label="职责描述">
              <Textarea
                rows={3}
                value={draft.description}
                onChange={(event) => setDraft({ ...draft, description: event.target.value })}
              />
            </Field>

            <Field label="系统提示词">
              <Textarea
                rows={8}
                value={draft.prompt}
                onChange={(event) => setDraft({ ...draft, prompt: event.target.value })}
              />
            </Field>

            <Field label="Rules（每行一条）">
              <Textarea
                rows={4}
                value={draft.rules.join('\n')}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    rules: event.target.value
                      .split('\n')
                      .map((item) => item.trim())
                      .filter(Boolean),
                  })
                }
              />
            </Field>

            <Field label="Guidelines（每行一条）">
              <Textarea
                rows={4}
                value={draft.guidelines.join('\n')}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    guidelines: event.target.value
                      .split('\n')
                      .map((item) => item.trim())
                      .filter(Boolean),
                  })
                }
              />
            </Field>

            <Field label="默认模型 Provider">
              <Select
                value={draft.modelProfileId ?? ''}
                onChange={(event) =>
                  setDraft({ ...draft, modelProfileId: event.target.value || null })
                }
              >
                <option value="">使用资源中心 Factory 默认文本模型</option>
                {providers.map((provider) => (
                  <option key={provider.id} value={provider.id}>
                    {providerOptionLabel(provider)}
                  </option>
                ))}
              </Select>
            </Field>

            {(
              [
                ['skills', 'Factory Skills', FACTORY_SKILL_CATALOG],
                ['tools', 'Factory Tools', FACTORY_TOOL_CATALOG],
              ] as const
            ).map(([key, label, catalog]) => (
              <Field key={key} label={label}>
                <div className="flex flex-wrap gap-1.5">
                  {catalog.map((capability) => {
                    const active = draft[key].some((item) => item.id === capability.id);
                    return (
                      <button
                        key={capability.id}
                        type="button"
                        onClick={() =>
                          setDraft({
                            ...draft,
                            [key]: toggleCapability(draft[key], capability),
                          })
                        }
                      >
                        <Badge tone={active ? 'blue' : 'neutral'}>{capability.name}</Badge>
                      </button>
                    );
                  })}
                </div>
              </Field>
            ))}

            <div className="grid gap-3 md:grid-cols-2">
              <Field label="思考模式">
                <Select
                  value={draft.reasoningMode.strategy}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      reasoningMode: {
                        ...draft.reasoningMode,
                        strategy: event.target.value as ReasoningModeInput['strategy'],
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
                  value={draft.reasoningMode.toolUse}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      reasoningMode: {
                        ...draft.reasoningMode,
                        toolUse: event.target.value as ReasoningModeInput['toolUse'],
                      },
                    })
                  }
                >
                  <option value="none">不使用工具</option>
                  <option value="when_needed">按需使用工具</option>
                  <option value="required">优先使用工具</option>
                </Select>
              </Field>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <Field label="最大工具循环轮数">
                <Input
                  type="number"
                  min={1}
                  max={10}
                  value={draft.reasoningMode.maxIterations}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      reasoningMode: {
                        ...draft.reasoningMode,
                        maxIterations: Math.min(10, Math.max(1, Number(event.target.value) || 3)),
                      },
                    })
                  }
                />
              </Field>
              <Field label="短期记忆窗口">
                <Input
                  type="number"
                  min={1}
                  max={200}
                  value={shortTerm?.type === 'window' ? shortTerm.maxMessages : 20}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      memoryPolicy: {
                        ...draft.memoryPolicy,
                        shortTerm: {
                          type: 'window',
                          maxMessages: Math.max(1, Number(event.target.value) || 20),
                        },
                      },
                    })
                  }
                />
              </Field>
            </div>

            <Field label="Verbose Trace">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={draft.reasoningMode.verboseTrace}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      reasoningMode: {
                        ...draft.reasoningMode,
                        verboseTrace: event.target.checked,
                        exposeReasoning: false,
                      },
                    })
                  }
                />
                记录 Factory 执行调试轨迹
              </label>
            </Field>

            <Field label="变更说明">
              <Input
                value={changeNote}
                placeholder="例如：强化默认 Agent 设计规则"
                onChange={(event) => setChangeNote(event.target.value)}
              />
            </Field>

            <Button
              size="sm"
              disabled={updateDna.isPending || !draft.name.trim() || !draft.prompt.trim()}
              onClick={() => {
                setNotice(null);
                updateDna.mutate({ dna: draft, changeNote: changeNote.trim() || undefined });
              }}
            >
              {updateDna.isPending ? '保存中...' : '保存 FactoryDNA'}
            </Button>
          </div>
        </div>

        <aside className="overflow-y-auto border-l border-neutral-200 bg-neutral-50 p-4">
          <div className="text-sm font-semibold text-neutral-900">版本历史</div>
          <div className="mt-3 space-y-2">
            {history.length === 0 && (
              <div className="rounded-md border border-dashed border-neutral-200 p-3 text-xs text-neutral-400">
                当前使用内置默认 FactoryDNA，保存后会生成 v1。
              </div>
            )}
            {history.map((item) => (
              <button
                key={item.id}
                type="button"
                className="w-full rounded-md border border-neutral-200 bg-white p-3 text-left text-xs hover:bg-neutral-50"
                onClick={() => {
                  setDraft(normalizeDraft(item.dna));
                  setNotice(`已载入 v${item.version}，保存后会生成新版本`);
                }}
              >
                <div className="font-medium text-neutral-900">FactoryDNA v{item.version}</div>
                <div className="mt-1 line-clamp-2 text-neutral-500">
                  {item.changeNote || item.dna.description || '无变更说明'}
                </div>
              </button>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
