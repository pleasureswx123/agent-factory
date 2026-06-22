'use client';

// Agent Factory：左侧需求澄清对话，右侧四步创建流程
// 1 需求澄清 -> 2 选择候选 Agent -> 3 配置 DNA -> 4 测试并创建
import {
  type AgentSuggestion,
  parseAgentSuggestions,
  recommendAgentResourceIds,
  stripSuggestionBlocks,
} from '@agent-os/shared';
import { Bot, ChevronLeft, Play, Plus, Send, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { type PointerEvent as ReactPointerEvent, useRef, useState } from 'react';
import { Badge, Button, Field, Input, Select, Textarea } from '@/components/ui';
import { DEFAULT_FACTORY_PANEL_WIDTH, useWorkbenchStore } from '@/lib/store';
import { trpc } from '@/lib/trpc';
import {
  cn,
  consumeTextStream,
  providerOptionLabel,
  RUNTIME_URL,
  readRuntimeError,
} from '@/lib/utils';

type ChatMsg = { role: 'user' | 'assistant'; content: string };
type PublishEvaluation = {
  status: 'publishable' | 'needs_changes' | 'blocked';
  summary: string;
  reasons?: string[];
  suggestions?: string[];
};

type DnaDraft = {
  name: string;
  description: string;
  rules: string[];
  guidelines: string[];
  prompt: string;
  testCases: { name: string; input: string; expected: string }[];
  evaluationCriteria: string[];
  modelProfileId: string | null;
  skillIds: string[];
  toolIds: string[];
  knowledgeBaseIds: string[];
};

const EMPTY_DRAFT: DnaDraft = {
  name: '',
  description: '',
  rules: [],
  guidelines: [],
  prompt: '',
  testCases: [],
  evaluationCriteria: [],
  modelProfileId: null,
  skillIds: [],
  toolIds: [],
  knowledgeBaseIds: [],
};

const STEPS = ['需求澄清', '选择候选', '配置 DNA', '测试发布'] as const;
const MIN_FACTORY_PANEL_WIDTH = 360;
const MAX_FACTORY_PANEL_WIDTH = 720;

function clampFactoryPanelWidth(width: number) {
  const viewportMax =
    typeof window === 'undefined'
      ? MAX_FACTORY_PANEL_WIDTH
      : Math.max(
          MIN_FACTORY_PANEL_WIDTH,
          Math.min(MAX_FACTORY_PANEL_WIDTH, window.innerWidth - 560),
        );
  return Math.min(Math.max(width, MIN_FACTORY_PANEL_WIDTH), viewportMax);
}

export default function FactoryPage() {
  const router = useRouter();
  const { factoryPanelWidth, setCurrentAgent, setFactoryPanelWidth } = useWorkbenchStore();
  const utils = trpc.useUtils();

  const { data: resourceList = [] } = trpc.resource.list.useQuery({});
  const providers = resourceList.filter((r) => r.type === 'provider');
  const skills = resourceList.filter((r) => r.type === 'skill');
  const tools = resourceList.filter((r) => r.type === 'tool');
  const kbs = resourceList.filter((r) => r.type === 'knowledge_base');

  const createAgent = trpc.agent.create.useMutation();

  // ---- 左侧需求对话 ----
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // 从全部助手回复中收集候选建议（后出现的优先展示在前）
  const suggestions: AgentSuggestion[] = msgs
    .filter((m) => m.role === 'assistant')
    .flatMap((m) => parseAgentSuggestions(m.content))
    .reverse();

  // ---- 右侧四步流程 ----
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<DnaDraft>(EMPTY_DRAFT);
  const [testInput, setTestInput] = useState('');
  const [testOutput, setTestOutput] = useState<string | null>(null);
  const [evaluation, setEvaluation] = useState<PublishEvaluation | null>(null);
  const [testRunning, setTestRunning] = useState(false);
  const composerExpanded = input.includes('\n');
  const resizeStartRef = useRef<{ pointerX: number; width: number } | null>(null);
  const panelWidth = clampFactoryPanelWidth(factoryPanelWidth || DEFAULT_FACTORY_PANEL_WIDTH);

  function handleResizePointerDown(event: ReactPointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    resizeStartRef.current = { pointerX: event.clientX, width: panelWidth };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    function handlePointerMove(moveEvent: PointerEvent) {
      const start = resizeStartRef.current;
      if (!start) return;
      setFactoryPanelWidth(
        clampFactoryPanelWidth(start.width + start.pointerX - moveEvent.clientX),
      );
    }

    function handlePointerUp() {
      resizeStartRef.current = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('pointermove', handlePointerMove);
    }

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp, { once: true });
  }

  async function sendFactoryChat() {
    const text = input.trim();
    if (!text || streaming !== null) return;
    setError(null);
    const next: ChatMsg[] = [...msgs, { role: 'user', content: text }];
    setMsgs(next);
    setInput('');
    setStreaming('');
    try {
      const res = await fetch(`${RUNTIME_URL}/factory/chat`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ messages: next }),
      });
      if (!res.ok) {
        setError(await readRuntimeError(res));
        return;
      }
      const full = await consumeTextStream(res, (t) => {
        setStreaming(stripSuggestionBlocks(t));
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      });
      setMsgs((prev) => [...prev, { role: 'assistant', content: full }]);
      if (parseAgentSuggestions(full).length > 0 && step === 0) setStep(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : '请求失败，请检查 Runtime 服务');
    } finally {
      setStreaming(null);
    }
  }

  function pickSuggestion(s: AgentSuggestion) {
    const recommended = recommendAgentResourceIds(
      `${s.name}\n${s.description}\n${s.reason}\n${s.systemPrompt ?? ''}`,
      resourceList,
    );
    setDraft({
      ...EMPTY_DRAFT,
      name: s.name,
      description: s.description,
      rules: s.rules ?? [],
      guidelines: s.guidelines ?? [],
      prompt: s.systemPrompt ?? '',
      testCases: s.testCases ?? [],
      evaluationCriteria: s.evaluationCriteria ?? [],
      modelProfileId: providers[0]?.id ?? null,
      skillIds: recommended.skillIds,
      toolIds: recommended.toolIds,
      knowledgeBaseIds: recommended.knowledgeBaseIds,
    });
    setTestInput(s.testCases?.[0]?.input ?? '');
    setStep(2);
  }

  async function runTest() {
    if (!draft.prompt.trim() || !testInput.trim() || testRunning) return;
    setError(null);
    setTestRunning(true);
    setTestOutput('');
    setEvaluation(null);
    try {
      const res = await fetch(`${RUNTIME_URL}/test-run`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          systemPrompt: draft.prompt,
          rules: draft.rules,
          guidelines: draft.guidelines,
          modelProfileId: draft.modelProfileId,
          input: testInput,
        }),
      });
      if (!res.ok) {
        setError(await readRuntimeError(res));
        setTestOutput(null);
        return;
      }
      const output = await consumeTextStream(res, setTestOutput);
      const evalRes = await fetch(`${RUNTIME_URL}/test-evaluate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          agentName: draft.name,
          description: draft.description,
          rules: draft.rules,
          guidelines: draft.guidelines,
          systemPrompt: draft.prompt,
          evaluationCriteria: draft.evaluationCriteria,
          input: testInput,
          output,
        }),
      });
      if (evalRes.ok) {
        setEvaluation((await evalRes.json()) as PublishEvaluation);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '试跑失败');
      setTestOutput(null);
    } finally {
      setTestRunning(false);
    }
  }

  async function handleCreate() {
    if (!draft.name.trim() || !draft.prompt.trim()) return;
    if (!testOutput || !evaluation) {
      setError('请先完成试跑并获得发布判断后再创建 Agent');
      return;
    }
    if (evaluation.status === 'blocked') {
      setError('当前发布判断为暂不建议发布，请调整后重新试跑');
      return;
    }
    setError(null);
    const agent = await createAgent.mutateAsync({
      name: draft.name.trim(),
      description: draft.description.trim() || undefined,
      status: 'published',
      dna: {
        prompt: draft.prompt,
        rules: draft.rules,
        guidelines: draft.guidelines,
        modelProfileId: draft.modelProfileId,
        testCases: draft.testCases,
        evaluationCriteria: draft.evaluationCriteria,
        skillIds: draft.skillIds,
        toolIds: draft.toolIds,
        knowledgeBaseIds: draft.knowledgeBaseIds,
        memoryPolicy: { shortTerm: { type: 'window', maxMessages: 20 } },
      },
    });
    await utils.agent.list.invalidate();
    setCurrentAgent(agent.id);
    router.push('/');
  }

  function toggleId(key: 'skillIds' | 'toolIds' | 'knowledgeBaseIds', id: string) {
    setDraft((d) => ({
      ...d,
      [key]: d[key].includes(id) ? d[key].filter((v) => v !== id) : [...d[key], id],
    }));
  }

  function updateDraftTestCase(
    index: number,
    patch: Partial<{ name: string; input: string; expected: string }>,
  ) {
    setDraft((d) => ({
      ...d,
      testCases: d.testCases.map((testCase, i) =>
        i === index ? { ...testCase, ...patch } : testCase,
      ),
    }));
  }

  function removeDraftTestCase(index: number) {
    setDraft((d) => ({
      ...d,
      testCases: d.testCases.filter((_, i) => i !== index),
    }));
  }

  return (
    <div className="flex h-full bg-neutral-50">
      {/* 左侧：需求澄清对话 */}
      <div className="flex min-w-0 flex-1 flex-col bg-white">
        <header className="flex items-center gap-2 border-b border-neutral-200 bg-white px-6 py-3">
          <Sparkles size={18} className="text-neutral-500" />
          <h1 className="text-sm font-semibold">Agent Factory</h1>
          <span className="text-xs text-neutral-400">用自然语言描述需求，推导要创建的 Agent</span>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="mx-auto max-w-2xl space-y-4">
            {msgs.length === 0 && streaming === null && (
              <div className="mt-16 text-center text-sm text-neutral-400">
                例如：「我要做短视频脚本生产，需要分析对标脚本并产出新脚本」
              </div>
            )}
            {msgs.map((m, i) => (
              <div
                // biome-ignore lint/suspicious/noArrayIndexKey: 无状态对话，索引即顺序
                key={i}
                className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}
              >
                <div
                  className={cn(
                    'max-w-[85%] whitespace-pre-wrap break-words rounded-lg px-4 py-2.5 text-sm',
                    m.role === 'user'
                      ? 'bg-neutral-900 text-white'
                      : 'border border-neutral-200 bg-white',
                  )}
                >
                  {m.role === 'assistant' ? stripSuggestionBlocks(m.content) : m.content}
                </div>
              </div>
            ))}
            {streaming !== null && (
              <div className="flex justify-start">
                <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-lg border border-neutral-200 bg-white px-4 py-2.5 text-sm">
                  {streaming || <span className="animate-pulse text-neutral-400">思考中…</span>}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </div>

        {error && (
          <div className="mx-6 mb-2 rounded-md bg-red-50 px-3 py-2 text-xs text-red-600">
            {error}
          </div>
        )}

        <div className="bg-white px-6 pb-4 pt-2">
          <div className="mx-auto max-w-2xl">
            <div
              className={cn(
                'grid grid-cols-[auto_minmax(0,1fr)_auto] items-end gap-2 rounded-[28px] border border-neutral-200 bg-white shadow-sm transition-[padding,box-shadow,border-color] duration-200 focus-within:border-neutral-300 focus-within:shadow-md',
                composerExpanded ? 'grid-rows-[auto_auto] px-5 py-3' : 'grid-rows-[auto] px-3 py-2',
              )}
            >
              <button
                type="button"
                className={cn(
                  'flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-neutral-700 hover:bg-neutral-100 hover:text-neutral-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-neutral-400',
                  composerExpanded ? 'col-start-1 row-start-2' : 'col-start-1 row-start-1',
                )}
                title="补充需求上下文"
              >
                <Plus size={22} strokeWidth={1.8} />
              </button>
              <Textarea
                rows={1}
                value={input}
                placeholder="描述你的业务需求"
                className={cn(
                  'resize-none overflow-y-hidden border-0 bg-transparent px-0 text-base shadow-none focus:border-transparent focus:outline-none',
                  composerExpanded
                    ? 'col-span-3 col-start-1 row-start-1 min-h-16 py-0'
                    : 'col-start-2 row-start-1 min-h-10 py-2.5',
                )}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (
                    e.key === 'Enter' &&
                    !e.shiftKey &&
                    !e.ctrlKey &&
                    !e.metaKey &&
                    !e.nativeEvent.isComposing
                  ) {
                    e.preventDefault();
                    sendFactoryChat();
                  }
                }}
              />
              <button
                type="button"
                className={cn(
                  'flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-white transition-colors hover:bg-neutral-700 disabled:cursor-not-allowed disabled:bg-neutral-200 disabled:text-neutral-400',
                  composerExpanded ? 'col-start-3 row-start-2' : 'col-start-3 row-start-1',
                )}
                disabled={streaming !== null || !input.trim()}
                onClick={sendFactoryChat}
                title="发送"
                aria-label="发送"
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 右侧：四步创建流程 */}
      <div
        className="relative flex shrink-0 flex-col border-l border-neutral-200 bg-neutral-50"
        style={{ width: panelWidth }}
      >
        <button
          type="button"
          aria-label="调整 Factory 右侧流程栏宽度"
          title="拖拽调整右侧流程栏宽度"
          onPointerDown={handleResizePointerDown}
          className="group absolute left-0 top-0 z-20 h-full w-2 -translate-x-1 cursor-col-resize touch-none"
        >
          <span className="block h-full w-px bg-transparent transition-colors group-hover:bg-neutral-300 group-active:bg-neutral-400" />
        </button>
        <div className="flex items-center gap-1 border-b border-neutral-200 px-4 py-3">
          {STEPS.map((label, i) => (
            <div key={label} className="flex items-center gap-1">
              {i > 0 && <div className="h-px w-4 bg-neutral-200" />}
              <span
                className={cn(
                  'flex items-center gap-1 rounded-full px-2.5 py-1 text-xs',
                  i === step
                    ? 'bg-neutral-900 font-medium text-white'
                    : i < step
                      ? 'bg-neutral-100 text-neutral-600'
                      : 'text-neutral-400',
                )}
              >
                {i + 1}. {label}
              </span>
            </div>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {/* Step 0：等待需求澄清 */}
          {step === 0 && (
            <div className="mt-12 text-center text-sm text-neutral-400">
              <Bot size={36} strokeWidth={1.5} className="mx-auto mb-3" />
              <p>在左侧对话中澄清需求后，</p>
              <p>候选 Agent 会出现在这里。</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => {
                  setDraft({ ...EMPTY_DRAFT, modelProfileId: providers[0]?.id ?? null });
                  setStep(2);
                }}
              >
                跳过，手动创建
              </Button>
            </div>
          )}

          {/* Step 1：候选 Agent 列表 */}
          {step === 1 && (
            <div className="space-y-3">
              {suggestions.length === 0 && (
                <p className="text-sm text-neutral-400">暂无候选，请继续在左侧补充需求。</p>
              )}
              {suggestions.map((s, i) => (
                <div
                  // biome-ignore lint/suspicious/noArrayIndexKey: 建议列表无稳定 id
                  key={`${s.name}-${i}`}
                  className="rounded-lg border border-neutral-200 p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold">{s.name}</span>
                    <Button size="sm" onClick={() => pickSuggestion(s)}>
                      选择
                    </Button>
                  </div>
                  <p className="mt-1 text-xs text-neutral-500">{s.description}</p>
                  {s.reason && <p className="mt-1 text-xs text-neutral-400">理由：{s.reason}</p>}
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setDraft({ ...EMPTY_DRAFT, modelProfileId: providers[0]?.id ?? null });
                  setStep(2);
                }}
              >
                手动创建
              </Button>
            </div>
          )}

          {/* Step 2：配置 DNA */}
          {step === 2 && (
            <div>
              <Field label="Agent 名称">
                <Input
                  value={draft.name}
                  onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                />
              </Field>
              <Field label="职责描述">
                <Input
                  value={draft.description}
                  onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                />
              </Field>
              <Field label="系统提示词（Prompt）">
                <Textarea
                  rows={8}
                  value={draft.prompt}
                  onChange={(e) => setDraft((d) => ({ ...d, prompt: e.target.value }))}
                />
              </Field>
              <Field label="Rules（每行一条）">
                <Textarea
                  rows={4}
                  value={draft.rules.join('\n')}
                  placeholder="例如：只输出结构化分析，不改写原文。"
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      rules: e.target.value
                        .split('\n')
                        .map((v) => v.trim())
                        .filter(Boolean),
                    }))
                  }
                />
              </Field>
              <Field label="Guidelines（每行一条）">
                <Textarea
                  rows={4}
                  value={draft.guidelines.join('\n')}
                  placeholder="例如：始终使用简体中文。"
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      guidelines: e.target.value
                        .split('\n')
                        .map((v) => v.trim())
                        .filter(Boolean),
                    }))
                  }
                />
              </Field>
              <Field label="测试样例">
                <div className="space-y-3">
                  {draft.testCases.map((testCase, index) => (
                    <div
                      // biome-ignore lint/suspicious/noArrayIndexKey: 测试样例为本地草稿，可按顺序编辑
                      key={index}
                      className="space-y-2 rounded-md border border-neutral-200 p-3"
                    >
                      <div className="flex items-center gap-2">
                        <Input
                          value={testCase.name}
                          placeholder="样例名称"
                          onChange={(e) => updateDraftTestCase(index, { name: e.target.value })}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => removeDraftTestCase(index)}
                        >
                          删除
                        </Button>
                      </div>
                      <Textarea
                        rows={3}
                        value={testCase.input}
                        placeholder="输入：用户会真实提交的内容"
                        onChange={(e) => updateDraftTestCase(index, { input: e.target.value })}
                      />
                      <Textarea
                        rows={3}
                        value={testCase.expected}
                        placeholder="期望：可验证的输出结果"
                        onChange={(e) => updateDraftTestCase(index, { expected: e.target.value })}
                      />
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      setDraft((d) => ({
                        ...d,
                        testCases: [
                          ...d.testCases,
                          { name: '手动测试样例', input: '', expected: '' },
                        ],
                      }))
                    }
                  >
                    新增测试样例
                  </Button>
                </div>
              </Field>
              <Field label="发布判断标准（每行一条）">
                <Textarea
                  rows={4}
                  value={draft.evaluationCriteria.join('\n')}
                  placeholder="例如：输出结构稳定；不虚构事实；能处理缺失信息。"
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      evaluationCriteria: e.target.value
                        .split('\n')
                        .map((v) => v.trim())
                        .filter(Boolean),
                    }))
                  }
                />
              </Field>
              <Field label="模型 Provider">
                <Select
                  value={draft.modelProfileId ?? ''}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, modelProfileId: e.target.value || null }))
                  }
                >
                  <option value="">（未绑定，使用默认）</option>
                  {providers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {providerOptionLabel(p)}
                    </option>
                  ))}
                </Select>
                {providers.length === 0 && (
                  <p className="mt-1 text-xs text-amber-600">
                    暂无 Provider，请先到「资源与凭证」添加模型配置
                  </p>
                )}
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
                    {list.length === 0 && <span className="text-xs text-neutral-400">暂无</span>}
                    {list.map((r) => (
                      <button key={r.id} type="button" onClick={() => toggleId(key, r.id)}>
                        <Badge tone={draft[key].includes(r.id) ? 'blue' : 'neutral'}>
                          {r.name}
                        </Badge>
                      </button>
                    ))}
                  </div>
                </Field>
              ))}
              <div className="mt-2 flex justify-between">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setStep(suggestions.length ? 1 : 0)}
                >
                  <ChevronLeft size={14} /> 上一步
                </Button>
                <Button
                  size="sm"
                  disabled={!draft.name.trim() || !draft.prompt.trim()}
                  onClick={() => setStep(3)}
                >
                  下一步
                </Button>
              </div>
            </div>
          )}

          {/* Step 3：测试并创建 */}
          {step === 3 && (
            <div>
              <div className="mb-3 rounded-md bg-neutral-50 p-3 text-xs text-neutral-500">
                <div className="font-medium text-neutral-700">{draft.name}</div>
                <div className="mt-0.5">{draft.description || '（无描述）'}</div>
                {draft.evaluationCriteria.length > 0 && (
                  <ul className="mt-2 list-inside list-disc space-y-0.5">
                    {draft.evaluationCriteria.map((criterion) => (
                      <li key={criterion}>{criterion}</li>
                    ))}
                  </ul>
                )}
              </div>
              <Field label="测试输入（试跑不落库）">
                <Textarea
                  rows={3}
                  value={testInput}
                  onChange={(e) => setTestInput(e.target.value)}
                  placeholder="输入一段测试内容，验证 Prompt 效果"
                />
              </Field>
              <Button
                variant="outline"
                size="sm"
                disabled={testRunning || !testInput.trim() || !draft.prompt.trim()}
                onClick={runTest}
              >
                <Play size={13} /> 试跑
              </Button>
              {!draft.modelProfileId && (
                <p className="mt-1 text-xs text-neutral-400">
                  未绑定模型 Provider 时将使用资源中心的默认模型。
                </p>
              )}
              {testOutput !== null && (
                <pre className="mt-3 max-h-60 overflow-auto whitespace-pre-wrap rounded-md bg-neutral-50 p-3 text-xs">
                  {testOutput || '生成中…'}
                </pre>
              )}
              {evaluation && (
                <div
                  className={cn(
                    'mt-3 rounded-md border p-3 text-xs',
                    evaluation.status === 'publishable'
                      ? 'border-green-200 bg-green-50 text-green-700'
                      : evaluation.status === 'blocked'
                        ? 'border-red-200 bg-red-50 text-red-700'
                        : 'border-amber-200 bg-amber-50 text-amber-700',
                  )}
                >
                  <div className="font-medium">
                    {evaluation.status === 'publishable'
                      ? '可以发布'
                      : evaluation.status === 'blocked'
                        ? '暂不建议发布'
                        : '建议调整后发布'}
                  </div>
                  <p className="mt-1">{evaluation.summary}</p>
                  {(evaluation.reasons?.length ?? 0) > 0 && (
                    <ul className="mt-2 list-inside list-disc space-y-0.5">
                      {evaluation.reasons?.map((reason) => (
                        <li key={reason}>{reason}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
              <div className="mt-4 flex justify-between">
                <Button variant="outline" size="sm" onClick={() => setStep(2)}>
                  <ChevronLeft size={14} /> 上一步
                </Button>
                <Button
                  size="sm"
                  disabled={
                    createAgent.isPending ||
                    !testOutput ||
                    !evaluation ||
                    evaluation.status === 'blocked'
                  }
                  onClick={handleCreate}
                >
                  {createAgent.isPending ? '发布中…' : '发布 Agent'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
