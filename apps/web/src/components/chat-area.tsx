'use client';

// 中间对话区：流式对话、@素材引用、保存为素材、上传附件
import type { MessageContent } from '@agent-os/db';
import type { inferRouterOutputs } from '@trpc/server';
import {
  AtSign,
  Brain,
  Check,
  Copy,
  ImageIcon,
  Pencil,
  Plus,
  Save,
  Send,
  Video,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Badge, Button, Dialog, Field, Input, Textarea } from '@/components/ui';
import { useWorkbenchStore } from '@/lib/store';
import { trpc } from '@/lib/trpc';
import { cn, consumeTextStream, RUNTIME_URL, readRuntimeError } from '@/lib/utils';
import type { AppRouter } from '@/server/routers/_app';

type PendingRef = { id: string; name: string };
type ArtifactForMessage = inferRouterOutputs<AppRouter>['artifact']['list'][number];
type SaveTarget =
  | { kind: 'text'; messageId: string | null; text: string }
  | { kind: 'artifact'; messageId: string | null; artifact: ArtifactForMessage };
type OptimisticReplacement = { id: string; text: string; artifactIds: string[] };
type ImagePreview = { name: string; url: string };

function contentToText(content: MessageContent): string {
  return content
    .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
    .map((p) => p.text)
    .join('\n');
}

function refIdsOf(content: MessageContent): string[] {
  return content
    .filter((p): p is { type: 'artifact-ref'; artifactId: string } => p.type === 'artifact-ref')
    .map((p) => p.artifactId);
}

function MarkdownText({ text }: { text: string }) {
  return (
    <div className="markdown-body break-words text-[15px] leading-7">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="mb-3 mt-7 first:mt-0 text-xl font-semibold leading-8">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="mb-3 mt-7 first:mt-0 text-lg font-semibold leading-8">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="mb-2 mt-6 first:mt-0 text-base font-semibold leading-7">{children}</h3>
          ),
          h4: ({ children }) => (
            <h4 className="mb-2 mt-5 first:mt-0 text-sm font-semibold leading-7">{children}</h4>
          ),
          p: ({ children }) => <p className="my-2 leading-7">{children}</p>,
          ul: ({ children }) => <ul className="my-3 list-disc space-y-1.5 pl-5">{children}</ul>,
          ol: ({ children }) => <ol className="my-3 list-decimal space-y-1.5 pl-5">{children}</ol>,
          li: ({ children }) => <li className="pl-1 leading-7">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="my-4 border-l-2 border-neutral-300 pl-4 text-neutral-600">
              {children}
            </blockquote>
          ),
          hr: () => <hr className="my-6 border-neutral-200" />,
          code: ({ children, className }) => {
            const inline = !className;
            if (inline) {
              return (
                <code className="rounded bg-neutral-100 px-1 py-0.5 text-[0.92em] text-neutral-900">
                  {children}
                </code>
              );
            }
            return (
              <code className={cn('block overflow-x-auto whitespace-pre p-3 text-xs', className)}>
                {children}
              </code>
            );
          },
          pre: ({ children }) => (
            <pre className="my-4 overflow-x-auto rounded-lg bg-neutral-950 text-neutral-50">
              {children}
            </pre>
          ),
          table: ({ children }) => (
            <div className="my-4 overflow-x-auto">
              <table className="w-full border-collapse text-sm">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border border-neutral-200 bg-neutral-50 px-3 py-2 text-left font-semibold">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border border-neutral-200 px-3 py-2 align-top">{children}</td>
          ),
          a: ({ children, href }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-blue-600 hover:underline"
            >
              {children}
            </a>
          ),
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}

/** 可解释的生成过程，不展示模型内部原始推理链路。 */
type ResponseProcess = { title: string; summary: string; steps: string[]; icon: typeof Brain };

const TEXT_RESPONSE_PROCESS: ResponseProcess = {
  title: '文本回复处理中',
  summary: '正在整理上下文并生成回复',
  steps: ['理解用户输入', '整理会话上下文与引用素材', '生成可读回复'],
  icon: Brain,
};

const RESPONSE_PROCESS: Record<string, ResponseProcess> = {
  text: TEXT_RESPONSE_PROCESS,
  image: {
    title: '图片生成处理中',
    summary: '正在把文字需求转换为图像生成任务',
    steps: [
      '理解画面主体与风格',
      '整理提示词和引用素材',
      '调用图片模型生成',
      '保存结果到素材资产库',
    ],
    icon: ImageIcon,
  },
  video: {
    title: '视频生成处理中',
    summary: '正在把文字需求转换为短视频生成任务',
    steps: [
      '理解镜头主体与动作',
      '整理时长、风格和画面约束',
      '调用视频模型生成',
      '保存结果到素材资产库',
    ],
    icon: Video,
  },
};
const MAX_INPUT_ROWS = 10;

function responseProcessFor(modality: string) {
  return RESPONSE_PROCESS[modality] ?? TEXT_RESPONSE_PROCESS;
}

function processStepIntervalSeconds(modality: string) {
  if (modality === 'video') return 18;
  if (modality === 'image') return 4;
  return 1;
}

function formatElapsed(seconds: number) {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}m ${rest}s`;
}

function resizeTextareaToContent(el: HTMLTextAreaElement, maxRows = MAX_INPUT_ROWS) {
  const style = window.getComputedStyle(el);
  const lineHeight = Number.parseFloat(style.lineHeight) || 20;
  const paddingY =
    (Number.parseFloat(style.paddingTop) || 0) + (Number.parseFloat(style.paddingBottom) || 0);
  const maxHeight = lineHeight * maxRows + paddingY;

  el.style.height = 'auto';
  const nextHeight = Math.min(el.scrollHeight, maxHeight);
  el.style.height = `${nextHeight}px`;
  el.style.overflowY = el.scrollHeight > maxHeight ? 'auto' : 'hidden';
}

function mediaTypeLabel(type: string | undefined) {
  if (type === 'video') return '视频';
  if (type === 'audio') return '音频';
  if (type === 'file') return '文件';
  return '图片';
}

function generatedMediaStatusText(options: {
  originalText: string;
  refs: string[];
  refArtifacts: ArtifactForMessage[];
  isSaved: boolean;
}) {
  const { originalText, refs, refArtifacts, isSaved } = options;
  const mediaArtifact = refArtifacts.find((artifact) =>
    ['image', 'video', 'audio', 'file'].includes(artifact.type),
  );
  if (!mediaArtifact && refs.length === 0) return originalText;

  const looksLikeGeneratedMedia =
    originalText.includes('已生成图片') ||
    originalText.includes('已生成视频') ||
    originalText.includes('已自动保存为素材');
  if (!looksLikeGeneratedMedia) return originalText;

  const label = mediaTypeLabel(mediaArtifact?.type);
  if (isSaved) return `已生成${label}，已保存到素材资产库。`;
  if (mediaArtifact) {
    return `已生成${label}，当前未保存到素材资产库。可点击「保存为素材」重新保存。`;
  }
  return `已生成${label}，原素材已不可用。可点击「保存为素材」保存当前文字说明。`;
}

function ResponseProcessPanel({
  modality,
  elapsedSeconds,
}: {
  modality: string;
  elapsedSeconds: number;
}) {
  const process = responseProcessFor(modality);
  const Icon = process.icon;
  const activeIndex = Math.min(
    process.steps.length - 1,
    Math.floor(elapsedSeconds / processStepIntervalSeconds(modality)),
  );

  return (
    <div className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2.5">
      <div className="flex items-start gap-2">
        <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-neutral-500">
          <Icon size={14} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs font-medium text-neutral-700">{process.title}</div>
            <div className="shrink-0 text-[11px] text-neutral-400">
              已用时 {formatElapsed(elapsedSeconds)}
            </div>
          </div>
          <div className="mt-0.5 text-xs text-neutral-500">{process.summary}</div>
          <ol className="mt-2 space-y-1.5">
            {process.steps.map((step, index) => {
              const isDone = index < activeIndex;
              const isActive = index === activeIndex;
              return (
                <li key={step} className="flex items-center gap-2 text-xs text-neutral-500">
                  <span
                    className={cn(
                      'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[10px]',
                      isActive
                        ? 'animate-pulse border-neutral-400 bg-neutral-900 text-white'
                        : 'border-neutral-300 bg-white text-neutral-400',
                      isDone && 'border-green-500 bg-green-500 text-white',
                    )}
                  >
                    {isDone ? <Check size={10} /> : index + 1}
                  </span>
                  <span className={cn(isActive && 'font-medium text-neutral-700')}>{step}</span>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </div>
  );
}

export function ChatArea({ agentId, agentName }: { agentId: string; agentName: string }) {
  const { currentConversationId, setCurrentConversation } = useWorkbenchStore();
  const utils = trpc.useUtils();

  const { data: messages = [] } = trpc.conversation.messages.useQuery(
    { conversationId: currentConversationId ?? '' },
    { enabled: !!currentConversationId },
  );
  const { data: artifacts = [] } = trpc.artifact.list.useQuery({ agentId });
  const { data: messageArtifacts = [] } = trpc.artifact.list.useQuery({});
  const { data: agentData } = trpc.agent.get.useQuery({ agentId });
  const createConversation = trpc.conversation.create.useMutation();
  const createArtifact = trpc.artifact.create.useMutation({
    onSuccess: () => utils.artifact.list.invalidate(),
  });

  const [input, setInput] = useState('');
  const [pendingRefs, setPendingRefs] = useState<PendingRef[]>([]);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [streamText, setStreamText] = useState<string | null>(null);
  const [responseElapsedSeconds, setResponseElapsedSeconds] = useState(0);
  const [localUserText, setLocalUserText] = useState<string | null>(null);
  const [optimisticReplacement, setOptimisticReplacement] = useState<OptimisticReplacement | null>(
    null,
  );
  const [editingMessage, setEditingMessage] = useState<{
    id: string;
    text: string;
    artifactIds: string[];
  } | null>(null);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [manualCopyText, setManualCopyText] = useState<string | null>(null);
  const [saveTarget, setSaveTarget] = useState<SaveTarget | null>(null);
  const [imagePreview, setImagePreview] = useState<ImagePreview | null>(null);
  const [saveName, setSaveName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const editInputRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const sendingRef = useRef(false);

  const artifactById = new Map(messageArtifacts.map((a) => [a.id, a]));
  const currentArtifactIds = new Set(artifacts.map((a) => a.id));
  const savedMessageIds = new Set(
    artifacts.map((a) => a.messageId).filter((id): id is string => !!id),
  );

  // 当前绑定模型的模态：用于发送后的等待提示
  const boundProvider = agentData?.boundResources.find(
    (r) => r.id === agentData.dna?.modelProfileId,
  );
  const modality = (boundProvider?.config as { modality?: string } | undefined)?.modality ?? 'text';
  const isResponding = streamText !== null;

  // biome-ignore lint/correctness/useExhaustiveDependencies: 消息变化时滚动到底部
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, streamText]);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    resizeTextareaToContent(el);
  });

  useEffect(() => {
    const el = editInputRef.current;
    if (!el) return;
    resizeTextareaToContent(el);
  });

  useEffect(() => {
    if (!isResponding) return;
    setResponseElapsedSeconds(0);
    const timer = window.setInterval(() => {
      setResponseElapsedSeconds((seconds) => seconds + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isResponding]);

  async function submitMessage(
    text: string,
    artifactIds: string[],
    options?: { replaceMessageId?: string },
  ) {
    if (sendingRef.current) return;
    sendingRef.current = true;
    setError(null);
    setSending(true);
    if (options?.replaceMessageId) {
      setLocalUserText(null);
      setOptimisticReplacement({ id: options.replaceMessageId, text, artifactIds });
    } else {
      setLocalUserText(text);
      setOptimisticReplacement(null);
    }
    setEditingMessage(null);
    setMentionOpen(false);
    try {
      let convId = currentConversationId;
      if (!convId) {
        const conv = await createConversation.mutateAsync({ agentId });
        convId = conv.id;
        setCurrentConversation(conv.id);
      }
      setStreamText('');
      const res = await fetch(`${RUNTIME_URL}/chat`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          conversationId: convId,
          text,
          artifactIds,
          clientRequestId: crypto.randomUUID(),
          replaceMessageId: options?.replaceMessageId,
        }),
      });
      if (!res.ok) {
        setError(await readRuntimeError(res));
        setStreamText(null);
        return;
      }
      await consumeTextStream(res, setStreamText);
      await utils.conversation.messages.invalidate({ conversationId: convId });
      await utils.conversation.list.invalidate({ agentId });
      // 图像/视频模态会生成新素材，刷新素材列表以便消息内联渲染
      await utils.artifact.list.invalidate();
      setStreamText(null);
      setResponseElapsedSeconds(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : '发送失败，请检查 Runtime 服务是否启动');
      setStreamText(null);
      setResponseElapsedSeconds(0);
    } finally {
      setLocalUserText(null);
      setOptimisticReplacement(null);
      sendingRef.current = false;
      setSending(false);
    }
  }

  async function handleSend() {
    const text = input.trim();
    if (!text || sending || sendingRef.current) return;
    const refs = pendingRefs.map((r) => r.id);
    setInput('');
    setPendingRefs([]);
    await submitMessage(text, refs);
  }

  async function handleResendEditedMessage() {
    const text = editingMessage?.text.trim();
    if (!editingMessage || !text || sending || sendingRef.current) return;
    await submitMessage(text, editingMessage.artifactIds, { replaceMessageId: editingMessage.id });
  }

  function copyTextWithSelection(text: string) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.top = '0';
    textarea.style.left = '0';
    textarea.style.width = '1px';
    textarea.style.height = '1px';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);
    let copied = false;
    try {
      copied = document.execCommand('copy');
    } finally {
      document.body.removeChild(textarea);
    }
    if (!copied) throw new Error('复制失败');
  }

  async function copyMessageText(messageId: string, text: string) {
    setError(null);
    try {
      if (navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(text);
        } catch {
          copyTextWithSelection(text);
        }
      } else {
        copyTextWithSelection(text);
      }
      setCopiedMessageId(messageId);
      window.setTimeout(() => {
        setCopiedMessageId((current) => (current === messageId ? null : current));
      }, 1200);
    } catch {
      setManualCopyText(text);
    }
  }

  function handleInputChange(value: string) {
    setInput(value);
    setMentionOpen(/(^|\s)@$/.test(value));
  }

  function pickMention(id: string, name: string) {
    setPendingRefs((prev) => (prev.some((r) => r.id === id) ? prev : [...prev, { id, name }]));
    setInput((prev) => prev.replace(/@$/, ''));
    setMentionOpen(false);
  }

  async function handleUpload(file: File) {
    setError(null);
    const fd = new FormData();
    fd.append('file', file);
    fd.append('agentId', agentId);
    if (currentConversationId) fd.append('conversationId', currentConversationId);
    const res = await fetch('/api/upload', { method: 'POST', body: fd });
    if (!res.ok) {
      setError('上传失败');
      return;
    }
    const artifact = (await res.json()) as { id: string; name: string };
    utils.artifact.list.invalidate();
    setPendingRefs((prev) => [...prev, { id: artifact.id, name: artifact.name }]);
  }

  function openSaveDialog(messageId: string | null, text: string, refs: string[]) {
    const mediaArtifact = refs
      .map((id) => artifactById.get(id))
      .find((artifact) => artifact && ['image', 'video', 'audio', 'file'].includes(artifact.type));
    if (mediaArtifact) {
      setSaveTarget({ kind: 'artifact', messageId, artifact: mediaArtifact });
      setSaveName(mediaArtifact.name);
      return;
    }
    setSaveTarget({ kind: 'text', messageId, text });
    setSaveName(`${agentName} 输出 ${new Date().toLocaleString('zh-CN')}`);
  }

  async function handleSaveArtifact() {
    if (!saveTarget || !saveName.trim()) return;
    if (saveTarget.kind === 'artifact') {
      await createArtifact.mutateAsync({
        agentId,
        conversationId: currentConversationId,
        messageId: saveTarget.messageId,
        name: saveName.trim(),
        type: saveTarget.artifact.type,
        content: saveTarget.artifact.content ?? undefined,
        fileUrl: saveTarget.artifact.fileUrl ?? undefined,
        thumbnailUrl: saveTarget.artifact.thumbnailUrl ?? undefined,
        mimeType: saveTarget.artifact.mimeType ?? undefined,
        sizeBytes: saveTarget.artifact.sizeBytes ?? undefined,
      });
      setSaveTarget(null);
      return;
    }
    let type: 'text' | 'json' = 'text';
    try {
      JSON.parse(saveTarget.text);
      type = 'json';
    } catch {
      /* 非 JSON，按文本保存 */
    }
    await createArtifact.mutateAsync({
      agentId,
      conversationId: currentConversationId,
      messageId: saveTarget.messageId,
      name: saveName.trim(),
      type,
      content: saveTarget.text,
    });
    setSaveTarget(null);
  }

  const replacementIndex = optimisticReplacement
    ? messages.findIndex((msg) => msg.id === optimisticReplacement.id)
    : -1;
  const visibleMessages =
    replacementIndex >= 0 ? messages.slice(0, replacementIndex + 1) : messages;
  const composerExpanded = input.includes('\n');

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      {/* 消息列表 */}
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
        {messages.length === 0 && !localUserText && (
          <div className="mt-16 text-center text-sm text-neutral-400">
            与「{agentName}」开始对话。输入 @ 可引用素材，回复可「保存为素材」。
          </div>
        )}
        <div className="mx-auto max-w-3xl space-y-6">
          {visibleMessages.map((msg) => {
            const replacement = optimisticReplacement?.id === msg.id ? optimisticReplacement : null;
            const text = replacement?.text ?? contentToText(msg.content);
            const refs = replacement?.artifactIds ?? refIdsOf(msg.content);
            const isUser = msg.role === 'user';
            const refArtifacts = refs.flatMap((id) => {
              const artifact = artifactById.get(id);
              return artifact ? [artifact] : [];
            });
            const userPreviewArtifacts =
              isUser && editingMessage?.id !== msg.id
                ? refArtifacts.filter(
                    (artifact) => artifact.fileUrl && ['image', 'video'].includes(artifact.type),
                  )
                : [];
            const badgeRefs = refs.filter((id) => {
              const artifact = artifactById.get(id);
              return !(
                isUser &&
                editingMessage?.id !== msg.id &&
                artifact?.fileUrl &&
                ['image', 'video'].includes(artifact.type)
              );
            });
            const isSavedToLibrary =
              savedMessageIds.has(msg.id) || refs.some((id) => currentArtifactIds.has(id));
            const displayText =
              isUser || editingMessage?.id === msg.id
                ? text
                : generatedMediaStatusText({
                    originalText: text,
                    refs,
                    refArtifacts,
                    isSaved: isSavedToLibrary,
                  });
            return (
              <div key={msg.id} className={cn('flex', isUser ? 'justify-end' : 'justify-start')}>
                <div
                  className={cn(
                    'group flex flex-col',
                    isUser && editingMessage?.id === msg.id
                      ? 'w-[80%] max-w-[42rem]'
                      : isUser
                        ? 'max-w-[72%]'
                        : 'w-full max-w-full',
                    isUser ? 'items-end' : 'items-start',
                  )}
                >
                  {userPreviewArtifacts.length > 0 && (
                    <div className="mb-2 flex max-w-full flex-col items-end gap-2">
                      {userPreviewArtifacts.map((artifact) => {
                        const fileUrl = artifact.fileUrl;
                        if (!fileUrl) return null;
                        if (artifact.type === 'image') {
                          return (
                            <button
                              key={artifact.id}
                              type="button"
                              className="block max-w-full rounded-3xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-neutral-500"
                              onClick={() => setImagePreview({ name: artifact.name, url: fileUrl })}
                            >
                              {/* biome-ignore lint/performance/noImgElement: 本地文件直链，无需 next/image 优化 */}
                              <img
                                src={fileUrl}
                                alt={artifact.name}
                                className="max-h-72 max-w-sm rounded-3xl object-cover"
                              />
                            </button>
                          );
                        }
                        return (
                          // biome-ignore lint/a11y/useMediaCaption: 用户引用素材可能没有字幕
                          <video
                            key={artifact.id}
                            src={fileUrl}
                            controls
                            className="max-h-72 max-w-sm rounded-3xl bg-black"
                          />
                        );
                      })}
                    </div>
                  )}
                  <div
                    className={cn(
                      'text-sm leading-6',
                      isUser && editingMessage?.id === msg.id
                        ? 'w-full rounded-[28px] bg-neutral-100 px-5 py-4 text-neutral-950'
                        : isUser
                          ? 'rounded-[18px] bg-neutral-900 px-4 py-2.5 text-white'
                          : 'w-full py-1 text-neutral-950',
                    )}
                  >
                    {badgeRefs.length > 0 && !(isUser && editingMessage?.id === msg.id) && (
                      <div className="mb-1.5 flex flex-wrap gap-1">
                        {badgeRefs.map((id) => (
                          <Badge key={id} tone="blue">
                            <AtSign size={10} className="mr-0.5" />
                            {artifactById.get(id)?.name ?? '已删除素材'}
                          </Badge>
                        ))}
                      </div>
                    )}
                    {isUser && editingMessage?.id === msg.id ? (
                      <div className="space-y-3">
                        {refs.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {refs.map((id) => {
                              const artifact = artifactById.get(id);
                              if (!artifact) {
                                return (
                                  <Badge key={id} tone="blue">
                                    已删除素材
                                  </Badge>
                                );
                              }
                              const imageUrl = artifact.thumbnailUrl ?? artifact.fileUrl;
                              if (artifact.type === 'image' && imageUrl) {
                                return (
                                  // biome-ignore lint/performance/noImgElement: 本地文件直链，无需 next/image 优化
                                  <img
                                    key={id}
                                    src={imageUrl}
                                    alt={artifact.name}
                                    className="h-16 w-16 rounded-xl border border-white object-cover shadow-sm"
                                  />
                                );
                              }
                              return (
                                <Badge key={id} tone="blue">
                                  <AtSign size={10} className="mr-0.5" />
                                  {artifact.name}
                                </Badge>
                              );
                            })}
                          </div>
                        )}
                        <Textarea
                          ref={editInputRef}
                          rows={1}
                          value={editingMessage.text}
                          className="min-h-7 resize-none border-0 !bg-transparent p-0 text-base leading-relaxed text-neutral-950 shadow-none outline-none placeholder:text-neutral-500 focus-visible:outline-none"
                          onChange={(e) =>
                            setEditingMessage((current) =>
                              current ? { ...current, text: e.target.value } : current,
                            )
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                              e.preventDefault();
                              handleResendEditedMessage();
                            }
                          }}
                        />
                        <div className="flex justify-end gap-3">
                          <button
                            type="button"
                            className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm text-neutral-900 hover:bg-neutral-50"
                            onClick={() => setEditingMessage(null)}
                          >
                            取消
                          </button>
                          <button
                            type="button"
                            className="rounded-full bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50"
                            disabled={sending || !editingMessage.text.trim()}
                            onClick={handleResendEditedMessage}
                          >
                            发送
                          </button>
                        </div>
                      </div>
                    ) : isUser ? (
                      <div className="whitespace-pre-wrap break-words">{displayText}</div>
                    ) : (
                      <MarkdownText text={displayText} />
                    )}
                    {/* 助手消息中的图像/视频素材：内联渲染 */}
                    {!isUser &&
                      refs.map((id) => {
                        const a = artifactById.get(id);
                        if (!a?.fileUrl) return null;
                        const fileUrl = a.fileUrl;
                        if (a.type === 'image') {
                          return (
                            <button
                              key={id}
                              type="button"
                              className="mt-2 block max-w-full rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-neutral-500"
                              onClick={() => setImagePreview({ name: a.name, url: fileUrl })}
                            >
                              {/* biome-ignore lint/performance/noImgElement: 本地文件直链，无需 next/image 优化 */}
                              <img
                                src={fileUrl}
                                alt={a.name}
                                className="max-h-80 max-w-full rounded-xl border border-neutral-100"
                              />
                            </button>
                          );
                        }
                        if (a.type === 'video') {
                          return (
                            // biome-ignore lint/a11y/useMediaCaption: 模型生成视频无字幕
                            <video
                              key={id}
                              src={fileUrl}
                              controls
                              className="mt-2 max-h-80 w-full rounded-xl border border-neutral-100"
                            />
                          );
                        }
                        return null;
                      })}
                  </div>
                  {!isUser && (
                    <div className="mt-2 flex justify-start gap-1 text-neutral-500">
                      <button
                        type="button"
                        title={copiedMessageId === msg.id ? '已复制' : '复制'}
                        aria-label={copiedMessageId === msg.id ? '已复制' : '复制回复'}
                        onClick={() => copyMessageText(msg.id, displayText)}
                        className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-neutral-100 hover:text-neutral-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-neutral-400"
                      >
                        {copiedMessageId === msg.id ? <Check size={16} /> : <Copy size={16} />}
                      </button>
                      <button
                        type="button"
                        disabled={isSavedToLibrary}
                        onClick={() => openSaveDialog(msg.id, text, refs)}
                        className="flex h-7 items-center gap-1 rounded-md px-2 text-xs text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 disabled:cursor-default disabled:bg-transparent disabled:text-green-600"
                      >
                        <Save size={13} /> {isSavedToLibrary ? '已保存' : '保存为素材'}
                      </button>
                    </div>
                  )}
                  {isUser && editingMessage?.id !== msg.id && (
                    <div className="mt-1 flex justify-end gap-1 pr-1 text-neutral-500">
                      <button
                        type="button"
                        title={copiedMessageId === msg.id ? '已复制' : '复制'}
                        aria-label={copiedMessageId === msg.id ? '已复制' : '复制'}
                        onClick={() => copyMessageText(msg.id, text)}
                        className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-neutral-100 hover:text-neutral-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-neutral-400"
                      >
                        {copiedMessageId === msg.id ? <Check size={17} /> : <Copy size={17} />}
                      </button>
                      <button
                        type="button"
                        title="编辑"
                        aria-label="编辑"
                        onClick={() => setEditingMessage({ id: msg.id, text, artifactIds: refs })}
                        className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-neutral-100 hover:text-neutral-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-neutral-400"
                      >
                        <Pencil size={17} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* 发送中的本地用户消息（乐观展示） */}
          {localUserText && (
            <div className="flex justify-end">
              <div className="max-w-[72%] rounded-[18px] bg-neutral-900 px-4 py-2.5 text-sm leading-6 text-white opacity-80">
                <div className="whitespace-pre-wrap break-words">{localUserText}</div>
              </div>
            </div>
          )}

          {/* 流式生成中的回复 */}
          {streamText !== null && (
            <div className="flex justify-start">
              <div className="w-full max-w-full py-1 text-sm text-neutral-950">
                <ResponseProcessPanel modality={modality} elapsedSeconds={responseElapsedSeconds} />
                {streamText && (
                  <div className="mt-3">
                    <MarkdownText text={streamText} />
                  </div>
                )}
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="mx-6 mb-2 shrink-0 rounded-md bg-red-50 px-3 py-2 text-xs text-red-600">
          {error}
        </div>
      )}

      {/* 输入区 */}
      <div className="shrink-0 bg-white px-6 pb-4 pt-2">
        <div className="mx-auto max-w-3xl">
          {pendingRefs.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {pendingRefs.map((r) => (
                <Badge key={r.id} tone="blue">
                  <AtSign size={10} className="mr-0.5" />
                  {r.name}
                  <button
                    type="button"
                    onClick={() => setPendingRefs((prev) => prev.filter((p) => p.id !== r.id))}
                    className="ml-1 hover:text-red-500"
                  >
                    ×
                  </button>
                </Badge>
              ))}
            </div>
          )}

          <div className="relative">
            {/* @ 素材下拉 */}
            {mentionOpen && (
              <div className="absolute bottom-full left-0 z-10 mb-1 max-h-56 w-72 overflow-y-auto rounded-md border border-neutral-200 bg-white py-1 shadow-lg">
                {artifacts.length === 0 && (
                  <div className="px-3 py-2 text-xs text-neutral-400">该 Agent 暂无素材</div>
                )}
                {artifacts.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => pickMention(a.id, a.name)}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-neutral-50"
                  >
                    <AtSign size={13} className="shrink-0 text-neutral-400" />
                    <span className="truncate">{a.name}</span>
                  </button>
                ))}
              </div>
            )}

            <div
              className={cn(
                'grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-end gap-2 rounded-[28px] border border-neutral-200 bg-white shadow-sm transition-[padding,box-shadow,border-color] duration-200 focus-within:border-neutral-300 focus-within:shadow-md',
                composerExpanded ? 'grid-rows-[auto_auto] px-5 py-3' : 'grid-rows-[auto] px-3 py-2',
              )}
            >
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleUpload(file);
                  e.target.value = '';
                }}
              />
              <button
                type="button"
                className={cn(
                  'flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-neutral-700 hover:bg-neutral-100 hover:text-neutral-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-neutral-400',
                  composerExpanded ? 'col-start-1 row-start-2' : 'col-start-1 row-start-1',
                )}
                title="上传文件为素材并引用"
                onClick={() => fileInputRef.current?.click()}
              >
                <Plus size={22} strokeWidth={1.8} />
              </button>
              <Textarea
                ref={inputRef}
                rows={1}
                value={input}
                placeholder="有问题，尽管问"
                className={cn(
                  'resize-none overflow-y-hidden border-0 bg-transparent px-0 text-base shadow-none focus:border-transparent focus:outline-none',
                  composerExpanded
                    ? 'col-span-4 col-start-1 row-start-1 min-h-16 py-0'
                    : 'col-start-2 row-start-1 min-h-10 py-2.5',
                )}
                onChange={(e) => handleInputChange(e.target.value)}
                onKeyDown={(e) => {
                  if (
                    e.key === 'Enter' &&
                    !e.shiftKey &&
                    !e.ctrlKey &&
                    !e.metaKey &&
                    !e.nativeEvent.isComposing
                  ) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
              />
              <button
                type="button"
                className={cn(
                  'mb-0.5 hidden h-9 shrink-0 items-center gap-1 rounded-full px-3 text-sm text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 sm:flex',
                  composerExpanded ? 'col-start-3 row-start-2' : 'col-start-3 row-start-1',
                )}
                title="引用素材"
                onClick={() => setMentionOpen(true)}
              >
                @ 素材
              </button>
              <button
                type="button"
                className={cn(
                  'flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-white transition-colors hover:bg-neutral-700 disabled:cursor-not-allowed disabled:bg-neutral-200 disabled:text-neutral-400',
                  composerExpanded ? 'col-start-4 row-start-2' : 'col-start-4 row-start-1',
                )}
                disabled={sending || !input.trim()}
                onClick={handleSend}
                title="发送"
                aria-label="发送"
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 保存为素材对话框 */}
      <Dialog open={!!manualCopyText} onClose={() => setManualCopyText(null)} title="手动复制">
        <div className="mb-2 text-xs text-neutral-500">
          浏览器禁止自动写入剪贴板，请复制下方内容。
        </div>
        <Textarea
          autoFocus
          rows={8}
          value={manualCopyText ?? ''}
          readOnly
          className="max-h-80 resize-none"
          onFocus={(e) => e.currentTarget.select()}
        />
        <div className="mt-3 flex justify-end">
          <Button onClick={() => setManualCopyText(null)}>关闭</Button>
        </div>
      </Dialog>

      <Dialog
        open={!!imagePreview}
        onClose={() => setImagePreview(null)}
        title={imagePreview?.name ?? '预览图片'}
        width="max-w-5xl"
      >
        {imagePreview && (
          <div className="flex max-h-[75vh] items-center justify-center overflow-auto rounded-md bg-neutral-950 p-2">
            {/* biome-ignore lint/performance/noImgElement: 本地文件直链，无需 next/image 优化 */}
            <img
              src={imagePreview.url}
              alt={imagePreview.name}
              className="max-h-[72vh] max-w-full object-contain"
            />
          </div>
        )}
      </Dialog>

      {/* 保存为素材对话框 */}
      <Dialog open={!!saveTarget} onClose={() => setSaveTarget(null)} title="保存为素材">
        <Field label="素材名称">
          <Input value={saveName} onChange={(e) => setSaveName(e.target.value)} />
        </Field>
        <div className="mb-3 max-h-40 overflow-y-auto rounded bg-neutral-50 p-2 text-xs text-neutral-500">
          {saveTarget?.kind === 'artifact'
            ? `将重新保存素材：${saveTarget.artifact.name}`
            : saveTarget?.text}
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setSaveTarget(null)}>
            取消
          </Button>
          <Button
            disabled={createArtifact.isPending || !saveName.trim()}
            onClick={handleSaveArtifact}
          >
            保存
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
