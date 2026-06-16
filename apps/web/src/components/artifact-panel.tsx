'use client';

// 右侧可折叠素材资产库：折叠 / 列表 / 缩略图三态，Agent tabs 与「我的 Agents」一一对应
import type { inferRouterOutputs } from '@trpc/server';
import { FileBox, LayoutGrid, List, PanelRightClose, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Badge, Dialog } from '@/components/ui';
import { useWorkbenchStore } from '@/lib/store';
import { trpc } from '@/lib/trpc';
import { cn, formatTime } from '@/lib/utils';
import type { AppRouter } from '@/server/routers/_app';

type ArtifactRow = inferRouterOutputs<AppRouter>['artifact']['list'][number];

const TYPE_LABELS: Record<string, string> = {
  text: '文本',
  json: 'JSON',
  image: '图片',
  audio: '音频',
  video: '视频',
  report: '报告',
  file: '文件',
};

export function ArtifactPanel() {
  const { artifactPanelOpen, toggleArtifactPanel, artifactView, setArtifactView, currentAgentId } =
    useWorkbenchStore();
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [preview, setPreview] = useState<ArtifactRow | null>(null);

  const utils = trpc.useUtils();
  const { data: agents = [] } = trpc.agent.list.useQuery();
  const tabAgentId = activeTab ?? currentAgentId ?? agents[0]?.id ?? null;
  const { data: artifacts = [] } = trpc.artifact.list.useQuery(
    { agentId: tabAgentId ?? undefined },
    { enabled: !!tabAgentId },
  );
  const deleteArtifact = trpc.artifact.delete.useMutation({
    onSuccess: () => utils.artifact.list.invalidate(),
  });

  if (!artifactPanelOpen) {
    return (
      <button
        type="button"
        onClick={toggleArtifactPanel}
        className="flex h-full w-9 shrink-0 items-center justify-center border-l border-neutral-200 bg-white text-xs text-neutral-500 hover:bg-neutral-50"
        title="展开素材资产库"
      >
        <span style={{ writingMode: 'vertical-rl' }} className="tracking-widest">
          素材资产库
        </span>
      </button>
    );
  }

  return (
    <div className="flex h-full w-96 shrink-0 flex-col border-l border-neutral-200 bg-white">
      <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
        <h2 className="text-sm font-semibold">素材资产库</h2>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setArtifactView('list')}
            className={cn(
              'rounded p-1.5',
              artifactView === 'list'
                ? 'bg-neutral-100 text-neutral-900'
                : 'text-neutral-400 hover:text-neutral-600',
            )}
            title="列表视图"
          >
            <List size={15} />
          </button>
          <button
            type="button"
            onClick={() => setArtifactView('grid')}
            className={cn(
              'rounded p-1.5',
              artifactView === 'grid'
                ? 'bg-neutral-100 text-neutral-900'
                : 'text-neutral-400 hover:text-neutral-600',
            )}
            title="缩略图视图"
          >
            <LayoutGrid size={15} />
          </button>
          <button
            type="button"
            onClick={toggleArtifactPanel}
            className="ml-1 rounded p-1.5 text-neutral-400 hover:text-neutral-600"
            title="收起"
          >
            <PanelRightClose size={15} />
          </button>
        </div>
      </div>

      {/* Agent tabs：与我的 Agents 一一对应 */}
      <div className="flex gap-1 overflow-x-auto border-b border-neutral-200 px-3 py-2">
        {agents.map((agent) => (
          <button
            key={agent.id}
            type="button"
            onClick={() => setActiveTab(agent.id)}
            className={cn(
              'shrink-0 rounded-full px-3 py-1 text-xs',
              agent.id === tabAgentId
                ? 'bg-neutral-900 text-white'
                : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200',
            )}
          >
            {agent.name}
          </button>
        ))}
        {agents.length === 0 && <span className="text-xs text-neutral-400">暂无 Agent</span>}
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {artifacts.length === 0 && (
          <div className="mt-10 text-center text-xs text-neutral-400">
            暂无素材。对话中点击「保存为素材」即可沉淀产出。
          </div>
        )}

        {/* 列表视图：只显示列表 */}
        {artifactView === 'list' && artifacts.length > 0 && (
          <ul className="space-y-2">
            {artifacts.map((a) => (
              <li key={a.id} className="rounded-md border border-neutral-200 p-2.5">
                <div className="flex items-start justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setPreview(a)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <div className="flex items-center gap-1.5">
                      <FileBox size={14} className="shrink-0 text-neutral-400" />
                      <span className="truncate text-sm font-medium hover:underline">{a.name}</span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <Badge tone="blue">{TYPE_LABELS[a.type] ?? a.type}</Badge>
                      <Badge tone="green">已保存</Badge>
                      {a.sourceAgentDeleted && <Badge tone="amber">来源 Agent 已删除</Badge>}
                    </div>
                    <div className="mt-1 truncate text-xs text-neutral-400">
                      来源会话：{a.conversationTitle ?? a.conversationId ?? '（无）'} ·{' '}
                      {formatTime(a.createdAt)}
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(`确定删除素材「${a.name}」？`)) {
                        deleteArtifact.mutate({ artifactId: a.id });
                      }
                    }}
                    className="rounded p-1 text-neutral-300 hover:bg-red-50 hover:text-red-500"
                    title="删除素材"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {/* 缩略图视图：只显示网格 */}
        {artifactView === 'grid' && artifacts.length > 0 && (
          <div className="grid grid-cols-2 gap-2">
            {artifacts.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => setPreview(a)}
                className="rounded-md border border-neutral-200 p-2 text-left hover:border-neutral-400"
              >
                <div className="flex h-20 items-center justify-center overflow-hidden rounded bg-neutral-50">
                  {a.type === 'image' && (a.thumbnailUrl ?? a.fileUrl) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={a.thumbnailUrl ?? a.fileUrl ?? ''}
                      alt={a.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-xs text-neutral-400">
                      {TYPE_LABELS[a.type] ?? a.type}
                    </span>
                  )}
                </div>
                <div className="mt-1.5 truncate text-xs font-medium">{a.name}</div>
                <div className="truncate text-[10px] text-neutral-400">
                  {TYPE_LABELS[a.type] ?? a.type} · {a.conversationTitle ?? '（无会话）'}
                </div>
                {a.sourceAgentDeleted && (
                  <div className="mt-0.5">
                    <Badge tone="amber">来源 Agent 已删除</Badge>
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      <Dialog
        open={!!preview}
        onClose={() => setPreview(null)}
        title={preview?.name ?? '素材预览'}
        width="max-w-2xl"
      >
        {preview?.type === 'image' && preview.fileUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview.fileUrl}
            alt={preview.name}
            className="max-h-[60vh] w-full object-contain"
          />
        ) : (
          <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap rounded bg-neutral-50 p-3 text-xs">
            {preview?.content ?? '(无文本内容)'}
          </pre>
        )}
      </Dialog>
    </div>
  );
}
