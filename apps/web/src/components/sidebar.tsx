'use client';

import {
  Bot,
  ChevronsLeft,
  ChevronsRight,
  Factory,
  MessageSquare,
  Plus,
  Settings,
  SlidersHorizontal,
  Trash2,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button, Dialog } from '@/components/ui';
import { useWorkbenchStore } from '@/lib/store';
import { trpc } from '@/lib/trpc';
import { cn } from '@/lib/utils';

export function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const {
    currentAgentId,
    currentConversationId,
    sidebarCollapsed,
    setCurrentAgent,
    setCurrentConversation,
    toggleSidebar,
  } = useWorkbenchStore();
  const [deleteAgentTarget, setDeleteAgentTarget] = useState<{ id: string; name: string } | null>(
    null,
  );
  const [deleteConversationTarget, setDeleteConversationTarget] = useState<{
    id: string;
    title: string;
  } | null>(null);

  const utils = trpc.useUtils();
  const { data: agents = [] } = trpc.agent.list.useQuery();
  const { data: conversations = [], isSuccess: conversationsLoaded } =
    trpc.conversation.list.useQuery(
      { agentId: currentAgentId ?? '' },
      { enabled: !!currentAgentId },
    );
  const createConversation = trpc.conversation.create.useMutation({
    onSuccess: (conv) => {
      utils.conversation.list.invalidate({ agentId: conv.agentId });
      setCurrentConversation(conv.id);
      router.push('/');
    },
  });
  const deleteConversation = trpc.conversation.delete.useMutation({
    onSuccess: (_result, variables) => {
      setDeleteConversationTarget(null);
      if (variables.conversationId === currentConversationId) {
        const nextConversationId = conversations.find(
          (conv) => conv.id !== variables.conversationId,
        )?.id;
        setCurrentConversation(nextConversationId ?? null);
      }
      if (currentAgentId) utils.conversation.list.invalidate({ agentId: currentAgentId });
    },
  });
  const deleteAgent = trpc.agent.delete.useMutation({
    onSuccess: (_result, variables) => {
      setDeleteAgentTarget(null);
      utils.agent.list.invalidate();
      utils.artifact.list.invalidate();
      utils.conversation.list.invalidate({ agentId: variables.agentId });
      if (variables.agentId === currentAgentId) {
        const nextAgentId = agents.find((agent) => agent.id !== variables.agentId)?.id ?? null;
        setCurrentAgent(nextAgentId);
        setCurrentConversation(null);
        router.push(nextAgentId ? '/' : '/factory');
        return;
      }
      if (pathname === `/agents/${variables.agentId}`) router.push('/');
    },
  });

  useEffect(() => {
    if (!currentAgentId || currentConversationId || !conversationsLoaded) return;
    const latestConversationId = conversations[0]?.id;
    if (latestConversationId) setCurrentConversation(latestConversationId);
  }, [
    currentAgentId,
    currentConversationId,
    conversations,
    conversationsLoaded,
    setCurrentConversation,
  ]);

  // 新建会话：未选中 Agent 时默认用最近使用的 Agent；没有 Agent 则引导去 Factory
  const handleNewConversation = () => {
    const agentId = currentAgentId ?? agents[0]?.id;
    if (!agentId) {
      router.push('/factory');
      return;
    }
    if (agentId !== currentAgentId) setCurrentAgent(agentId);
    createConversation.mutate({ agentId });
  };

  const selectAgent = (agentId: string) => {
    if (agentId !== currentAgentId) {
      setCurrentAgent(agentId);
    } else {
      setCurrentConversation(conversations[0]?.id ?? null);
    }
    router.push('/');
  };

  return (
    <aside
      className={cn(
        'flex h-full shrink-0 flex-col border-r border-neutral-200 bg-neutral-50 transition-[width]',
        sidebarCollapsed ? 'w-14' : 'w-60',
      )}
    >
      <div
        className={cn(
          'flex h-12 items-center gap-2 px-3',
          sidebarCollapsed && 'justify-center px-2',
        )}
      >
        <button
          type="button"
          onClick={toggleSidebar}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
          title={sidebarCollapsed ? '展开侧栏' : '折叠侧栏'}
          aria-label={sidebarCollapsed ? '展开侧栏' : '折叠侧栏'}
        >
          {sidebarCollapsed ? <ChevronsRight size={17} /> : <ChevronsLeft size={17} />}
        </button>
        {!sidebarCollapsed && (
          <Link href="/" className="flex min-w-0 flex-1 items-center">
            {/* biome-ignore lint/performance/noImgElement: static SVG logo does not need Next image optimization. */}
            <img
              src="/brand/company-logo.svg"
              alt="AgentOS"
              className="h-9 w-full object-contain object-left"
            />
          </Link>
        )}
      </div>

      <div className={cn('px-3', sidebarCollapsed && 'px-2')}>
        <button
          type="button"
          onClick={handleNewConversation}
          disabled={createConversation.isPending}
          className={cn(
            'flex w-full items-center rounded-md bg-neutral-900 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50',
            sidebarCollapsed ? 'h-9 justify-center px-0' : 'gap-2 px-3 py-2',
          )}
          title="新建会话"
        >
          <Plus size={16} /> {!sidebarCollapsed && '新建会话'}
        </button>
      </div>

      <nav className={cn('mt-3 px-3', sidebarCollapsed && 'px-2')}>
        <Link
          href="/factory"
          className={cn(
            'flex items-center rounded-md text-sm',
            sidebarCollapsed ? 'h-9 justify-center px-0' : 'gap-2 px-3 py-2',
            pathname === '/factory'
              ? 'bg-neutral-100 font-medium'
              : 'text-neutral-600 hover:bg-neutral-50',
          )}
          title="Agent Factory"
        >
          <Factory size={16} /> {!sidebarCollapsed && 'Agent Factory'}
        </Link>
      </nav>

      <div className={cn('mt-4 flex-1 overflow-y-auto px-3', sidebarCollapsed && 'px-2')}>
        {!sidebarCollapsed && (
          <div className="px-3 text-xs font-medium text-neutral-400">我的 Agents</div>
        )}
        <ul className="mt-1 space-y-0.5">
          {agents.length === 0 && !sidebarCollapsed && (
            <li className="px-3 py-2 text-xs text-neutral-400">暂无 Agent，去 Factory 创建</li>
          )}
          {agents.map((agent) => (
            <li key={agent.id} className="group flex items-center">
              <button
                type="button"
                onClick={() => selectAgent(agent.id)}
                title={agent.name}
                className={cn(
                  'flex min-w-0 flex-1 items-center rounded-md text-left text-sm',
                  sidebarCollapsed ? 'h-9 justify-center px-0' : 'gap-2 px-3 py-2',
                  agent.id === currentAgentId && pathname === '/'
                    ? 'bg-neutral-100 font-medium'
                    : 'text-neutral-600 hover:bg-neutral-50',
                )}
              >
                <Bot size={15} className="shrink-0" />
                {!sidebarCollapsed && <span className="truncate">{agent.name}</span>}
              </button>
              {!sidebarCollapsed && (
                <>
                  <Link
                    href={`/agents/${agent.id}`}
                    className="ml-1 rounded p-1.5 text-neutral-400 opacity-0 transition-opacity hover:bg-neutral-100 hover:text-neutral-600 group-hover:opacity-100"
                    title="Agent 配置详情"
                  >
                    <Settings size={14} />
                  </Link>
                  <button
                    type="button"
                    aria-label={`删除 Agent：${agent.name}`}
                    title="删除 Agent"
                    disabled={deleteAgent.isPending}
                    onClick={() => setDeleteAgentTarget({ id: agent.id, name: agent.name })}
                    className="ml-1 rounded p-1.5 text-neutral-400 opacity-0 transition-opacity hover:bg-red-50 hover:text-red-600 disabled:opacity-50 group-hover:opacity-100"
                  >
                    <Trash2 size={14} />
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>

        {currentAgentId && !sidebarCollapsed && (
          <>
            <div className="mt-4 px-3 text-xs font-medium text-neutral-400">当前 Agent 会话</div>
            <ul className="mt-1 space-y-0.5">
              {conversations.length === 0 && (
                <li className="px-3 py-2 text-xs text-neutral-400">暂无会话</li>
              )}
              {conversations.map((conv) => {
                const selected = conv.id === currentConversationId;
                const title = conv.title ?? '新会话';
                return (
                  <li key={conv.id} className="group flex items-center">
                    <button
                      type="button"
                      onClick={() => {
                        setCurrentConversation(conv.id);
                        router.push('/');
                      }}
                      className={cn(
                        'flex min-w-0 flex-1 items-center gap-2 rounded-md px-3 py-1.5 text-left text-sm',
                        selected
                          ? 'bg-neutral-100 font-medium text-neutral-900'
                          : 'text-neutral-500 hover:bg-neutral-50',
                      )}
                    >
                      <MessageSquare size={13} className="shrink-0" />
                      <span className="truncate">{title}</span>
                    </button>
                    <button
                      type="button"
                      aria-label={`删除会话：${title}`}
                      title="删除会话"
                      disabled={deleteConversation.isPending}
                      onClick={() => setDeleteConversationTarget({ id: conv.id, title })}
                      className="ml-1 rounded p-1.5 text-neutral-400 opacity-0 transition-opacity hover:bg-red-50 hover:text-red-600 disabled:opacity-50 group-hover:opacity-100"
                    >
                      <Trash2 size={13} />
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>

      <div className={cn('border-t border-neutral-200 p-3', sidebarCollapsed && 'p-2')}>
        <Link
          href="/resources"
          className={cn(
            'flex items-center rounded-md text-sm',
            sidebarCollapsed ? 'h-9 justify-center px-0' : 'gap-2 px-3 py-2',
            pathname === '/resources'
              ? 'bg-neutral-100 font-medium'
              : 'text-neutral-600 hover:bg-neutral-50',
          )}
          title="资源与凭证"
        >
          <SlidersHorizontal size={16} /> {!sidebarCollapsed && '资源与凭证'}
        </Link>
      </div>

      <Dialog
        open={!!deleteAgentTarget}
        onClose={() => {
          if (!deleteAgent.isPending) setDeleteAgentTarget(null);
        }}
        title="删除 Agent"
      >
        <div className="space-y-3">
          <p className="text-sm text-neutral-700">
            确定删除这个 Agent 吗？相关会话会被删除；已保存的素材资产会保留，并标记为来源 Agent
            已删除。
          </p>
          <div className="rounded-md bg-neutral-50 px-3 py-2 text-sm text-neutral-900">
            {deleteAgentTarget?.name}
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              disabled={deleteAgent.isPending}
              onClick={() => setDeleteAgentTarget(null)}
            >
              取消
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700"
              disabled={deleteAgent.isPending || !deleteAgentTarget}
              onClick={() => {
                if (deleteAgentTarget) deleteAgent.mutate({ agentId: deleteAgentTarget.id });
              }}
            >
              删除
            </Button>
          </div>
        </div>
      </Dialog>

      <Dialog
        open={!!deleteConversationTarget}
        onClose={() => {
          if (!deleteConversation.isPending) setDeleteConversationTarget(null);
        }}
        title="删除会话"
      >
        <div className="space-y-3">
          <p className="text-sm text-neutral-700">
            确定删除这个会话吗？此操作不可撤销，但已保存的素材资产会继续保留。
          </p>
          <div className="rounded-md bg-neutral-50 px-3 py-2 text-sm text-neutral-900">
            {deleteConversationTarget?.title}
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              disabled={deleteConversation.isPending}
              onClick={() => setDeleteConversationTarget(null)}
            >
              取消
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700"
              disabled={deleteConversation.isPending || !deleteConversationTarget}
              onClick={() => {
                if (deleteConversationTarget) {
                  deleteConversation.mutate({ conversationId: deleteConversationTarget.id });
                }
              }}
            >
              删除
            </Button>
          </div>
        </div>
      </Dialog>
    </aside>
  );
}
