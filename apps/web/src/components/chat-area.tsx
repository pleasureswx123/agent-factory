'use client';

// 中间对话区：流式对话、@素材引用、保存为素材、上传附件
import type { MessageContent } from '@agent-os/db';
import { AtSign, Paperclip, Save, Send } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Badge, Button, Dialog, Field, Input, Textarea } from '@/components/ui';
import { useWorkbenchStore } from '@/lib/store';
import { trpc } from '@/lib/trpc';
import { cn, consumeTextStream, RUNTIME_URL, readRuntimeError } from '@/lib/utils';

type PendingRef = { id: string; name: string };

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

/** 按绑定模型的模态显示等待提示（图像/视频生成耗时远长于文本流式） */
const PENDING_HINTS: Record<string, string> = {
  text: '思考中…',
  image: '图片生成中，通常需要十几秒…',
  video: '视频生成中，通常需要 1～5 分钟，请耐心等待…',
};

export function ChatArea({ agentId, agentName }: { agentId: string; agentName: string }) {
  const { currentConversationId, setCurrentConversation } = useWorkbenchStore();
  const utils = trpc.useUtils();

  const { data: messages = [] } = trpc.conversation.messages.useQuery(
    { conversationId: currentConversationId ?? '' },
    { enabled: !!currentConversationId },
  );
  const { data: artifacts = [] } = trpc.artifact.list.useQuery({ agentId });
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
  const [localUserText, setLocalUserText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saveTarget, setSaveTarget] = useState<{ messageId: string | null; text: string } | null>(
    null,
  );
  const [saveName, setSaveName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const artifactById = new Map(artifacts.map((a) => [a.id, a]));

  // 当前绑定模型的模态：用于发送后的等待提示
  const boundProvider = agentData?.boundResources.find(
    (r) => r.id === agentData.dna?.modelProfileId,
  );
  const modality = (boundProvider?.config as { modality?: string } | undefined)?.modality ?? 'text';
  const pendingHint = PENDING_HINTS[modality] ?? PENDING_HINTS.text;

  // biome-ignore lint/correctness/useExhaustiveDependencies: 消息变化时滚动到底部
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, streamText]);

  async function handleSend() {
    const text = input.trim();
    if (!text || sending) return;
    setError(null);
    setSending(true);
    setLocalUserText(text);
    const refs = pendingRefs.map((r) => r.id);
    setInput('');
    setPendingRefs([]);
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
        body: JSON.stringify({ conversationId: convId, text, artifactIds: refs }),
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
    } catch (err) {
      setError(err instanceof Error ? err.message : '发送失败，请检查 Runtime 服务是否启动');
      setStreamText(null);
    } finally {
      setLocalUserText(null);
      setSending(false);
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

  function openSaveDialog(messageId: string | null, text: string) {
    setSaveTarget({ messageId, text });
    setSaveName(`${agentName} 输出 ${new Date().toLocaleString('zh-CN')}`);
  }

  async function handleSaveArtifact() {
    if (!saveTarget || !saveName.trim()) return;
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

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col">
      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {messages.length === 0 && !localUserText && (
          <div className="mt-16 text-center text-sm text-neutral-400">
            与「{agentName}」开始对话。输入 @ 可引用素材，回复可「保存为素材」。
          </div>
        )}
        <div className="mx-auto max-w-3xl space-y-4">
          {messages.map((msg) => {
            const text = contentToText(msg.content);
            const refs = refIdsOf(msg.content);
            const isUser = msg.role === 'user';
            return (
              <div key={msg.id} className={cn('flex', isUser ? 'justify-end' : 'justify-start')}>
                <div
                  className={cn(
                    'group max-w-[80%] rounded-lg px-4 py-2.5 text-sm',
                    isUser ? 'bg-neutral-900 text-white' : 'border border-neutral-200 bg-white',
                  )}
                >
                  {refs.length > 0 && (
                    <div className="mb-1.5 flex flex-wrap gap-1">
                      {refs.map((id) => (
                        <Badge key={id} tone="blue">
                          <AtSign size={10} className="mr-0.5" />
                          {artifactById.get(id)?.name ?? '已删除素材'}
                        </Badge>
                      ))}
                    </div>
                  )}
                  <div className="whitespace-pre-wrap break-words">{text}</div>
                  {/* 助手消息中的图像/视频素材：内联渲染 */}
                  {!isUser &&
                    refs.map((id) => {
                      const a = artifactById.get(id);
                      if (!a?.fileUrl) return null;
                      if (a.type === 'image') {
                        // biome-ignore lint/performance/noImgElement: 本地文件直链，无需 next/image 优化
                        return (
                          <img
                            key={id}
                            src={a.fileUrl}
                            alt={a.name}
                            className="mt-2 max-h-80 max-w-full rounded-md border border-neutral-100"
                          />
                        );
                      }
                      if (a.type === 'video') {
                        return (
                          // biome-ignore lint/a11y/useMediaCaption: 模型生成视频无字幕
                          <video
                            key={id}
                            src={a.fileUrl}
                            controls
                            className="mt-2 max-h-80 w-full rounded-md border border-neutral-100"
                          />
                        );
                      }
                      return null;
                    })}
                  {!isUser && (
                    <div className="mt-1.5 flex justify-end opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        type="button"
                        onClick={() => openSaveDialog(msg.id, text)}
                        className="flex items-center gap-1 text-xs text-neutral-400 hover:text-neutral-700"
                      >
                        <Save size={12} /> 保存为素材
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
              <div className="max-w-[80%] rounded-lg bg-neutral-900 px-4 py-2.5 text-sm text-white opacity-80">
                <div className="whitespace-pre-wrap break-words">{localUserText}</div>
              </div>
            </div>
          )}

          {/* 流式生成中的回复 */}
          {streamText !== null && (
            <div className="flex justify-start">
              <div className="max-w-[80%] rounded-lg border border-neutral-200 bg-white px-4 py-2.5 text-sm">
                <div className="whitespace-pre-wrap break-words">
                  {streamText || (
                    <span className="animate-pulse text-neutral-400">{pendingHint}</span>
                  )}
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="mx-6 mb-2 rounded-md bg-red-50 px-3 py-2 text-xs text-red-600">{error}</div>
      )}

      {/* 输入区 */}
      <div className="border-t border-neutral-200 bg-white px-6 py-3">
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

            <div className="flex items-end gap-2">
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
              <Button
                variant="outline"
                size="icon"
                className="shrink-0"
                title="上传文件为素材并引用"
                onClick={() => fileInputRef.current?.click()}
              >
                <Paperclip size={16} />
              </Button>
              <Textarea
                rows={1}
                value={input}
                placeholder="输入消息，@ 引用素材，Enter 发送 / Shift+Enter 换行"
                className="max-h-32 min-h-9 resize-none"
                onChange={(e) => handleInputChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
              />
              <Button
                className="h-9 shrink-0"
                disabled={sending || !input.trim()}
                onClick={handleSend}
              >
                <Send size={15} /> 发送
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* 保存为素材对话框 */}
      <Dialog open={!!saveTarget} onClose={() => setSaveTarget(null)} title="保存为素材">
        <Field label="素材名称">
          <Input value={saveName} onChange={(e) => setSaveName(e.target.value)} />
        </Field>
        <div className="mb-3 max-h-40 overflow-y-auto rounded bg-neutral-50 p-2 text-xs text-neutral-500">
          {saveTarget?.text}
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
