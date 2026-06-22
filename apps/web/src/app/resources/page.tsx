'use client';

// 资源与凭证中心：类型统计卡片 + 清单筛选 + 新增资源（API Key 加密存储，仅显 hint）
import { MODEL_MODALITY_LABELS, type ModelModality, RESOURCE_TYPE_LABELS } from '@agent-os/shared';
import { ChevronDown, KeyRound, Pencil, Plus } from 'lucide-react';
import { useState } from 'react';
import { Badge, Button, Dialog, Field, Input, Select } from '@/components/ui';
import { trpc } from '@/lib/trpc';
import { cn, formatTime } from '@/lib/utils';

type ResourceType = 'provider' | 'api_key' | 'skill' | 'tool' | 'knowledge_base';

const TYPE_ORDER: ResourceType[] = ['provider', 'api_key', 'skill', 'tool', 'knowledge_base'];

const STATUS_LABELS: Record<string, string> = {
  active: '可用',
  disabled: '已停用',
  configuring: '配置中',
};

// 常用模型 Provider 预设：名称匹配时自动回填 BaseURL 与模态，模型 ID 仅作占位提示
const ARK_BASE_URL = 'https://ark.cn-beijing.volces.com/api/v3';
const PROVIDER_PRESETS: {
  name: string;
  baseUrl: string;
  modelHint: string;
  modality: ModelModality;
}[] = [
  {
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    modelHint: 'deepseek-chat',
    modality: 'text',
  },
  {
    name: '火山方舟（豆包）',
    baseUrl: ARK_BASE_URL,
    modelHint: 'doubao-seed-1-6-250615',
    modality: 'text',
  },
  {
    name: '火山方舟 Seedream（出图）',
    baseUrl: ARK_BASE_URL,
    modelHint: 'doubao-seedream-4-0-250828',
    modality: 'image',
  },
  {
    name: '火山方舟 Seedance（出视频）',
    baseUrl: ARK_BASE_URL,
    modelHint: 'doubao-seedance-2-0-260128',
    modality: 'video',
  },
  {
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    modelHint: 'gpt-4o-mini',
    modality: 'text',
  },
  {
    name: 'OpenAI 图像（gpt-image）',
    baseUrl: 'https://api.openai.com/v1',
    modelHint: 'gpt-image-2',
    modality: 'image',
  },
  {
    name: 'Moonshot Kimi',
    baseUrl: 'https://api.moonshot.cn/v1',
    modelHint: 'kimi-k2-0711-preview',
    modality: 'text',
  },
  {
    name: '通义千问',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    modelHint: 'qwen-plus',
    modality: 'text',
  },
  {
    name: '智谱 GLM',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    modelHint: 'glm-4-plus',
    modality: 'text',
  },
  {
    name: 'MiniMax',
    baseUrl: 'https://api.minimaxi.com/v1',
    modelHint: 'MiniMax-Text-01',
    modality: 'text',
  },
  {
    name: '硅基流动 SiliconFlow',
    baseUrl: 'https://api.siliconflow.cn/v1',
    modelHint: 'deepseek-ai/DeepSeek-V3',
    modality: 'text',
  },
  {
    name: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    modelHint: 'openai/gpt-4o-mini',
    modality: 'text',
  },
  {
    name: 'Ollama（本地）',
    baseUrl: 'http://127.0.0.1:11434/v1',
    modelHint: 'qwen2.5',
    modality: 'text',
  },
];

export default function ResourcesPage() {
  const utils = trpc.useUtils();
  const { data: resourceList = [] } = trpc.resource.list.useQuery({});
  const [filter, setFilter] = useState<ResourceType | 'all'>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingResourceId, setEditingResourceId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 新增表单状态
  const [formType, setFormType] = useState<ResourceType>('provider');
  const [formName, setFormName] = useState('');
  const [presetOpen, setPresetOpen] = useState(false);
  const [formBaseUrl, setFormBaseUrl] = useState('');
  const [formModelId, setFormModelId] = useState('');
  const [formModality, setFormModality] = useState<ModelModality>('text');
  const [formSecret, setFormSecret] = useState('');
  const [formDesc, setFormDesc] = useState('');

  // 修改表单状态
  const [editType, setEditType] = useState<ResourceType>('provider');
  const [editName, setEditName] = useState('');
  const [editBaseUrl, setEditBaseUrl] = useState('');
  const [editModelId, setEditModelId] = useState('');
  const [editModality, setEditModality] = useState<ModelModality>('text');
  const [editDesc, setEditDesc] = useState('');

  const createResource = trpc.resource.create.useMutation({
    onSuccess: () => {
      utils.resource.list.invalidate();
      setDialogOpen(false);
    },
    onError: (e) => setError(e.message),
  });
  const updateResource = trpc.resource.update.useMutation({
    onSuccess: () => {
      utils.resource.list.invalidate();
      setEditDialogOpen(false);
      setEditingResourceId(null);
    },
    onError: (e) => setError(e.message),
  });
  const deleteResource = trpc.resource.delete.useMutation({
    onSuccess: () => utils.resource.list.invalidate(),
    onError: (e) => setError(e.message),
  });
  const setFactoryDefault = trpc.resource.setFactoryDefault.useMutation({
    onSuccess: () => utils.resource.list.invalidate(),
    onError: (e) => setError(e.message),
  });

  const counts = Object.fromEntries(
    TYPE_ORDER.map((t) => [t, resourceList.filter((r) => r.type === t).length]),
  );
  const filtered = filter === 'all' ? resourceList : resourceList.filter((r) => r.type === filter);

  function openDialog() {
    setFormType('provider');
    setFormName('');
    setFormBaseUrl('');
    setFormModelId('');
    setFormModality('text');
    setFormSecret('');
    setFormDesc('');
    setPresetOpen(false);
    setError(null);
    setDialogOpen(true);
  }

  function openEditDialog(resource: (typeof resourceList)[number]) {
    const config = resource.config as Record<string, unknown>;
    setEditingResourceId(resource.id);
    setEditType(resource.type as ResourceType);
    setEditName(resource.name);
    setEditBaseUrl(typeof config.baseUrl === 'string' ? config.baseUrl : '');
    setEditModelId(typeof config.modelId === 'string' ? config.modelId : '');
    setEditModality(
      config.modality === 'image' || config.modality === 'video' ? config.modality : 'text',
    );
    setEditDesc(typeof config.description === 'string' ? config.description : '');
    setError(null);
    setEditDialogOpen(true);
  }

  function handleCreate() {
    if (!formName.trim()) return;
    setError(null);
    const config: Record<string, unknown> = {};
    if (formType === 'provider') {
      if (!formBaseUrl.trim() || !formModelId.trim()) {
        setError('Provider 需要填写 BaseURL 和模型 ID');
        return;
      }
      config.baseUrl = formBaseUrl.trim();
      config.modelId = formModelId.trim();
      config.modality = formModality;
    }
    if (formDesc.trim()) config.description = formDesc.trim();
    createResource.mutate({
      type: formType,
      name: formName.trim(),
      config,
      secretValue: formSecret.trim() || undefined,
    });
  }

  function handleUpdate() {
    if (!editingResourceId || !editName.trim()) return;
    setError(null);
    const current = resourceList.find((r) => r.id === editingResourceId);
    if (!current) return;
    const config = { ...(current.config as Record<string, unknown>) };
    if (editType === 'provider') {
      if (!editBaseUrl.trim() || !editModelId.trim()) {
        setError('Provider 需要填写 BaseURL 和模型 ID');
        return;
      }
      config.baseUrl = editBaseUrl.trim();
      config.modelId = editModelId.trim();
      config.modality = editModality;
    } else if (editDesc.trim()) {
      config.description = editDesc.trim();
    } else {
      delete config.description;
    }
    updateResource.mutate({
      resourceId: editingResourceId,
      name: editName.trim(),
      config,
    });
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-neutral-200 bg-white px-6 py-3">
        <div className="flex items-center gap-2">
          <KeyRound size={18} className="text-neutral-500" />
          <h1 className="text-sm font-semibold">资源与凭证中心</h1>
          <span className="text-xs text-neutral-400">密钥加密存储，界面仅展示 hint</span>
        </div>
        <Button size="sm" onClick={openDialog}>
          <Plus size={14} /> 新增资源
        </Button>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        {/* 类型统计卡片 */}
        <div className="grid grid-cols-5 gap-3">
          {TYPE_ORDER.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setFilter(filter === t ? 'all' : t)}
              className={cn(
                'rounded-lg border p-3 text-left transition-colors',
                filter === t
                  ? 'border-neutral-900 bg-neutral-50'
                  : 'border-neutral-200 hover:border-neutral-400',
              )}
            >
              <div className="text-xs text-neutral-500">{RESOURCE_TYPE_LABELS[t]}</div>
              <div className="mt-1 text-2xl font-semibold">{counts[t]}</div>
            </button>
          ))}
        </div>

        {error && (
          <div className="mt-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-600">{error}</div>
        )}

        {/* 资源清单 */}
        <div className="mt-4 overflow-hidden rounded-lg border border-neutral-200">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-left text-xs text-neutral-500">
              <tr>
                <th className="px-4 py-2 font-medium">名称</th>
                <th className="px-4 py-2 font-medium">类型</th>
                <th className="px-4 py-2 font-medium">状态</th>
                <th className="px-4 py-2 font-medium">密钥</th>
                <th className="px-4 py-2 font-medium">配置</th>
                <th className="px-4 py-2 font-medium">创建时间</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-xs text-neutral-400">
                    暂无资源，点击右上角「新增资源」添加
                  </td>
                </tr>
              )}
              {filtered.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-2.5 font-medium">
                    <span className="inline-flex items-center gap-1.5">
                      {r.name}
                      {r.type === 'provider' &&
                        ((r.config as { modality?: ModelModality }).modality ?? 'text') !==
                          'text' && (
                          <Badge tone="purple">
                            {
                              MODEL_MODALITY_LABELS[
                                (r.config as { modality?: string }).modality ?? 'text'
                              ]
                            }
                          </Badge>
                        )}
                      {r.type === 'provider' &&
                        (r.config as { factoryDefault?: boolean }).factoryDefault === true && (
                          <Badge tone="green">Factory 默认</Badge>
                        )}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge tone="blue">{RESOURCE_TYPE_LABELS[r.type] ?? r.type}</Badge>
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge tone={r.status === 'active' ? 'green' : 'amber'}>
                      {STATUS_LABELS[r.status] ?? r.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs text-neutral-500">
                    {r.secretHint ?? '—'}
                  </td>
                  <td className="max-w-48 truncate px-4 py-2.5 text-xs text-neutral-500">
                    {r.type === 'provider'
                      ? `${(r.config as { modelId?: string }).modelId ?? ''} @ ${(r.config as { baseUrl?: string }).baseUrl ?? ''}`
                      : ((r.config as { description?: string }).description ?? '—')}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-neutral-400">
                    {formatTime(r.createdAt)}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {r.type === 'provider' &&
                      r.status === 'active' &&
                      ((r.config as { modality?: string }).modality ?? 'text') === 'text' &&
                      (r.config as { factoryDefault?: boolean }).factoryDefault !== true && (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={setFactoryDefault.isPending}
                          onClick={() => setFactoryDefault.mutate({ resourceId: r.id })}
                        >
                          设为 Factory 默认
                        </Button>
                      )}
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={updateResource.isPending}
                      onClick={() => openEditDialog(r)}
                    >
                      <Pencil size={12} />
                      修改
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={deleteResource.isPending}
                      onClick={() => {
                        if (window.confirm(`确定删除资源「${r.name}」？`)) {
                          deleteResource.mutate({ resourceId: r.id });
                        }
                      }}
                    >
                      删除
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 新增资源对话框 */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title="新增资源">
        <Field label="资源类型">
          <Select value={formType} onChange={(e) => setFormType(e.target.value as ResourceType)}>
            {TYPE_ORDER.map((t) => (
              <option key={t} value={t}>
                {RESOURCE_TYPE_LABELS[t]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={formType === 'provider' ? '名称（可从预设选择或自行输入）' : '名称'}>
          {formType === 'provider' ? (
            <div className="relative">
              <Input
                value={formName}
                placeholder="例如：DeepSeek"
                className="pr-8"
                onChange={(e) => {
                  const v = e.target.value;
                  setFormName(v);
                  // 名称命中预设时自动回填 BaseURL 与模态（仍可手动修改）
                  const preset = PROVIDER_PRESETS.find((p) => p.name === v);
                  if (preset) {
                    setFormBaseUrl(preset.baseUrl);
                    setFormModality(preset.modality);
                  }
                }}
                onBlur={() => setPresetOpen(false)}
              />
              {/* 下拉按钮与选项均用 onMouseDown+preventDefault，避免触发 Input blur */}
              <button
                type="button"
                aria-label="展开预设列表"
                className="absolute inset-y-0 right-0 flex w-8 items-center justify-center text-neutral-400 hover:text-neutral-600"
                onMouseDown={(e) => {
                  e.preventDefault();
                  setPresetOpen((v) => !v);
                }}
              >
                <ChevronDown size={14} />
              </button>
              {presetOpen && (
                <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-neutral-200 bg-white py-1 shadow-lg">
                  {PROVIDER_PRESETS.map((p) => (
                    <li key={p.name}>
                      <button
                        type="button"
                        className="flex w-full flex-col px-3 py-1.5 text-left hover:bg-neutral-50"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setFormName(p.name);
                          setFormBaseUrl(p.baseUrl);
                          setFormModality(p.modality);
                          setPresetOpen(false);
                        }}
                      >
                        <span className="inline-flex items-center gap-1.5 text-sm">
                          {p.name}
                          {p.modality !== 'text' && (
                            <Badge tone="purple">{MODEL_MODALITY_LABELS[p.modality]}</Badge>
                          )}
                        </span>
                        <span className="text-xs text-neutral-400">{p.baseUrl}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <Input
              value={formName}
              placeholder="资源名称"
              onChange={(e) => setFormName(e.target.value)}
            />
          )}
        </Field>
        {formType === 'provider' && (
          <>
            <Field label="BaseURL（OpenAI 兼容接口）">
              <Input
                value={formBaseUrl}
                placeholder="https://api.deepseek.com/v1"
                onChange={(e) => setFormBaseUrl(e.target.value)}
              />
            </Field>
            <Field label="模型 ID">
              <Input
                value={formModelId}
                placeholder={
                  PROVIDER_PRESETS.find((p) => p.name === formName)?.modelHint ?? 'deepseek-chat'
                }
                onChange={(e) => setFormModelId(e.target.value)}
              />
            </Field>
            <Field label="模型能力">
              <Select
                value={formModality}
                onChange={(e) => setFormModality(e.target.value as ModelModality)}
              >
                {(['text', 'image', 'video'] as const).map((m) => (
                  <option key={m} value={m}>
                    {MODEL_MODALITY_LABELS[m]}
                  </option>
                ))}
              </Select>
            </Field>
          </>
        )}
        {(formType === 'provider' || formType === 'api_key') && (
          <Field label={formType === 'provider' ? 'API Key（加密存储）' : '密钥值（加密存储）'}>
            <Input
              type="password"
              value={formSecret}
              placeholder="sk-..."
              onChange={(e) => setFormSecret(e.target.value)}
            />
          </Field>
        )}
        {formType !== 'provider' && formType !== 'api_key' && (
          <Field label="描述（可选）">
            <Input value={formDesc} onChange={(e) => setFormDesc(e.target.value)} />
          </Field>
        )}
        {error && (
          <div className="mb-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-600">{error}</div>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setDialogOpen(false)}>
            取消
          </Button>
          <Button disabled={createResource.isPending || !formName.trim()} onClick={handleCreate}>
            创建
          </Button>
        </div>
      </Dialog>

      {/* 修改资源对话框 */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} title="修改资源">
        <Field label="名称">
          <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
        </Field>
        {editType === 'provider' && (
          <>
            <Field label="BaseURL（OpenAI 兼容接口）">
              <Input value={editBaseUrl} onChange={(e) => setEditBaseUrl(e.target.value)} />
            </Field>
            <Field label="模型 ID">
              <Input value={editModelId} onChange={(e) => setEditModelId(e.target.value)} />
            </Field>
            <Field label="模型能力">
              <Select
                value={editModality}
                onChange={(e) => setEditModality(e.target.value as ModelModality)}
              >
                {(['text', 'image', 'video'] as const).map((m) => (
                  <option key={m} value={m}>
                    {MODEL_MODALITY_LABELS[m]}
                  </option>
                ))}
              </Select>
            </Field>
          </>
        )}
        {editType !== 'provider' && editType !== 'api_key' && (
          <Field label="描述（可选）">
            <Input value={editDesc} onChange={(e) => setEditDesc(e.target.value)} />
          </Field>
        )}
        {editType === 'api_key' && (
          <p className="mb-3 text-xs text-neutral-400">
            密钥值不在此处展示；如需更换密钥，请新增资源。
          </p>
        )}
        {error && (
          <div className="mb-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-600">{error}</div>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
            取消
          </Button>
          <Button disabled={updateResource.isPending || !editName.trim()} onClick={handleUpdate}>
            保存
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
