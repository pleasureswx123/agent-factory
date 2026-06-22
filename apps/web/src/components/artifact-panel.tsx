'use client';

// 右侧可折叠素材资产库：折叠 / 列表 / 缩略图三态，Agent tabs 与「我的 Agents」一一对应
import type { inferRouterOutputs } from '@trpc/server';
import { Download, FileBox, LayoutGrid, List, PanelRightClose, Play, Trash2 } from 'lucide-react';
import { type PointerEvent as ReactPointerEvent, useRef, useState } from 'react';
import { Badge, Button, Dialog } from '@/components/ui';
import { DEFAULT_ARTIFACT_PANEL_WIDTH, useWorkbenchStore } from '@/lib/store';
import { trpc } from '@/lib/trpc';
import { cn, formatTime } from '@/lib/utils';
import type { AppRouter } from '@/server/routers/_app';

type ArtifactRow = inferRouterOutputs<AppRouter>['artifact']['list'][number];
type ArtifactTab = 'all' | string;
const MIN_ARTIFACT_PANEL_WIDTH = 280;
const MAX_ARTIFACT_PANEL_WIDTH = 640;

const TYPE_LABELS: Record<string, string> = {
  text: '文本',
  json: 'JSON',
  image: '图片',
  audio: '音频',
  video: '视频',
  report: '报告',
  file: '文件',
};

function conversationSourceLabel(artifact: ArtifactRow) {
  if (artifact.conversationTitle) return artifact.conversationTitle;
  return artifact.conversationId ? '已删除会话' : '无来源会话';
}

function formatAgentTabName(name: string) {
  const chars = Array.from(name);
  return chars.length > 5 ? `${chars.slice(0, 5).join('')}...` : name;
}

function safeFileName(name: string) {
  const reserved = new Set(['<', '>', ':', '"', '/', '\\', '|', '?', '*']);
  const cleaned = Array.from(name, (char) =>
    reserved.has(char) || char.charCodeAt(0) < 32 ? '_' : char,
  )
    .join('')
    .trim();
  return cleaned || 'artifact';
}

function contentFileName(artifact: ArtifactRow) {
  const name = safeFileName(artifact.name);
  if (/\.[a-z0-9]+$/i.test(name)) return name;
  return `${name}.${artifact.type === 'json' ? 'json' : 'txt'}`;
}

function clampArtifactPanelWidth(width: number) {
  const viewportMax =
    typeof window === 'undefined'
      ? MAX_ARTIFACT_PANEL_WIDTH
      : Math.max(
          MIN_ARTIFACT_PANEL_WIDTH,
          Math.min(MAX_ARTIFACT_PANEL_WIDTH, window.innerWidth - 520),
        );
  return Math.min(Math.max(width, MIN_ARTIFACT_PANEL_WIDTH), viewportMax);
}

export function ArtifactPanel() {
  const {
    artifactPanelOpen,
    toggleArtifactPanel,
    artifactPanelWidth,
    setArtifactPanelWidth,
    artifactView,
    setArtifactView,
    currentAgentId,
  } = useWorkbenchStore();
  const [activeTab, setActiveTab] = useState<ArtifactTab | null>(null);
  const [preview, setPreview] = useState<ArtifactRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ArtifactRow | null>(null);
  const resizeStartRef = useRef<{ pointerX: number; width: number } | null>(null);
  const panelWidth = clampArtifactPanelWidth(artifactPanelWidth || DEFAULT_ARTIFACT_PANEL_WIDTH);

  const utils = trpc.useUtils();
  const { data: agents = [] } = trpc.agent.list.useQuery();
  const tabAgentId =
    activeTab === 'all' ? null : (activeTab ?? currentAgentId ?? agents[0]?.id ?? null);
  const { data: artifacts = [] } = trpc.artifact.list.useQuery(
    { agentId: tabAgentId ?? undefined },
    { enabled: activeTab === 'all' || !!tabAgentId },
  );
  const deleteArtifact = trpc.artifact.delete.useMutation({
    onSuccess: () => {
      setDeleteTarget(null);
      utils.artifact.list.invalidate();
    },
  });

  async function downloadArtifact(artifact: ArtifactRow) {
    const filename = safeFileName(artifact.name);
    const link = document.createElement('a');
    link.style.display = 'none';
    link.download = filename;

    let objectUrl: string | null = null;
    try {
      if (artifact.fileUrl) {
        const response = await fetch(artifact.fileUrl);
        if (!response.ok) throw new Error('download fetch failed');
        const blob = await response.blob();
        objectUrl = URL.createObjectURL(blob);
        link.href = objectUrl;
      } else {
        const content =
          typeof artifact.content === 'string'
            ? artifact.content
            : JSON.stringify(artifact.content ?? '', null, 2);
        const blob = new Blob([content], {
          type:
            artifact.type === 'json'
              ? 'application/json;charset=utf-8'
              : 'text/plain;charset=utf-8',
        });
        objectUrl = URL.createObjectURL(blob);
        link.href = objectUrl;
        link.download = contentFileName(artifact);
      }

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch {
      if (artifact.fileUrl) {
        window.open(artifact.fileUrl, '_blank', 'noopener,noreferrer');
      }
    } finally {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    }
  }

  function handleResizePointerDown(event: ReactPointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    resizeStartRef.current = { pointerX: event.clientX, width: panelWidth };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    function handlePointerMove(moveEvent: PointerEvent) {
      const start = resizeStartRef.current;
      if (!start) return;
      setArtifactPanelWidth(
        clampArtifactPanelWidth(start.width + start.pointerX - moveEvent.clientX),
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

  if (!artifactPanelOpen) {
    return (
      <button
        type="button"
        onClick={toggleArtifactPanel}
        className="flex h-full w-9 shrink-0 items-center justify-center border-l border-neutral-200 bg-neutral-50 text-xs text-neutral-500 hover:bg-neutral-100"
        title="展开素材资产库"
      >
        <span style={{ writingMode: 'vertical-rl' }} className="tracking-widest">
          素材资产库
        </span>
      </button>
    );
  }

  return (
    <div
      className="relative flex h-full min-h-0 shrink-0 flex-col border-l border-neutral-200 bg-neutral-50"
      style={{ width: panelWidth }}
    >
      <button
        type="button"
        aria-label="调整素材库宽度"
        title="拖拽调整素材库宽度"
        onPointerDown={handleResizePointerDown}
        className="group absolute left-0 top-0 z-20 h-full w-2 -translate-x-1 cursor-col-resize touch-none"
      >
        <span className="block h-full w-px bg-transparent transition-colors group-hover:bg-neutral-300 group-active:bg-neutral-400" />
      </button>
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
        <button
          type="button"
          onClick={() => setActiveTab('all')}
          className={cn(
            'shrink-0 rounded-full px-3 py-1 text-xs',
            activeTab === 'all'
              ? 'bg-neutral-900 text-white'
              : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200',
          )}
          title="查看全部素材"
        >
          全部
        </button>
        {agents.map((agent) => (
          <button
            key={agent.id}
            type="button"
            onClick={() => setActiveTab(agent.id)}
            className={cn(
              'max-w-[6.5rem] shrink-0 truncate rounded-full px-3 py-1 text-xs',
              agent.id === tabAgentId
                ? 'bg-neutral-900 text-white'
                : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200',
            )}
            title={agent.name}
          >
            {formatAgentTabName(agent.name)}
          </button>
        ))}
        {agents.length === 0 && <span className="text-xs text-neutral-400">暂无 Agent</span>}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
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
                      来源会话：{conversationSourceLabel(a)} · {formatTime(a.createdAt)}
                    </div>
                  </button>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => downloadArtifact(a)}
                      className="rounded p-1 text-neutral-300 hover:bg-neutral-100 hover:text-neutral-700"
                      title="下载素材"
                      aria-label={`下载素材：${a.name}`}
                    >
                      <Download size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(a)}
                      className="rounded p-1 text-neutral-300 hover:bg-red-50 hover:text-red-500"
                      title="删除素材"
                      aria-label={`删除素材：${a.name}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        {/* 缩略图视图：只显示网格 */}
        {artifactView === 'grid' && artifacts.length > 0 && (
          <div className="grid grid-cols-2 gap-2">
            {artifacts.map((a) => (
              <div
                key={a.id}
                className="group relative rounded-md border border-neutral-200 p-2 hover:border-neutral-400"
              >
                <button type="button" onClick={() => setPreview(a)} className="w-full text-left">
                  <div className="relative flex h-20 items-center justify-center overflow-hidden rounded bg-neutral-50">
                    {a.type === 'image' && (a.thumbnailUrl ?? a.fileUrl) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={a.thumbnailUrl ?? a.fileUrl ?? ''}
                        alt={a.name}
                        className="h-full w-full object-cover"
                      />
                    ) : a.type === 'video' && a.fileUrl ? (
                      <>
                        <video
                          src={a.fileUrl}
                          muted
                          playsInline
                          preload="metadata"
                          className="h-full w-full bg-neutral-900 object-cover"
                        />
                        <span className="absolute inset-0 flex items-center justify-center bg-black/20 text-white">
                          <Play size={18} fill="currentColor" />
                        </span>
                      </>
                    ) : (
                      <span className="text-xs text-neutral-400">
                        {TYPE_LABELS[a.type] ?? a.type}
                      </span>
                    )}
                  </div>
                  <div className="mt-1.5 truncate text-xs font-medium">{a.name}</div>
                  <div className="truncate text-[10px] text-neutral-400">
                    {TYPE_LABELS[a.type] ?? a.type} · {conversationSourceLabel(a)}
                  </div>
                  {a.sourceAgentDeleted && (
                    <div className="mt-0.5">
                      <Badge tone="amber">来源 Agent 已删除</Badge>
                    </div>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => downloadArtifact(a)}
                  className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-neutral-500 opacity-0 shadow-sm transition-opacity hover:bg-white hover:text-neutral-900 group-hover:opacity-100"
                  title="下载素材"
                  aria-label={`下载素材：${a.name}`}
                >
                  <Download size={14} />
                </button>
              </div>
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
        ) : preview?.type === 'video' && preview.fileUrl ? (
          // biome-ignore lint/a11y/useMediaCaption: 模型生成视频无字幕
          <video src={preview.fileUrl} controls className="max-h-[60vh] w-full rounded bg-black" />
        ) : (
          <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap rounded bg-neutral-50 p-3 text-xs">
            {preview?.content ?? '(无文本内容)'}
          </pre>
        )}
      </Dialog>

      <Dialog
        open={!!deleteTarget}
        onClose={() => {
          if (!deleteArtifact.isPending) setDeleteTarget(null);
        }}
        title="删除素材"
      >
        <div className="space-y-3">
          <p className="text-sm text-neutral-700">
            确定从素材资产库移除这个素材吗？历史会话中的生成结果会继续保留，可从会话消息中再次保存。
          </p>
          <div className="rounded-md bg-neutral-50 px-3 py-2 text-sm text-neutral-900">
            {deleteTarget?.name}
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              disabled={deleteArtifact.isPending}
              onClick={() => setDeleteTarget(null)}
            >
              取消
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700"
              disabled={deleteArtifact.isPending || !deleteTarget}
              onClick={() => {
                if (deleteTarget) deleteArtifact.mutate({ artifactId: deleteTarget.id });
              }}
            >
              删除
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
