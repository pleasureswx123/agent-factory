'use client';

import {
  Bot,
  Factory,
  MessageSquare,
  Plus,
  Settings,
  SlidersHorizontal,
  Trash2,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useWorkbenchStore } from '@/lib/store';
import { trpc } from '@/lib/trpc';
import { cn } from '@/lib/utils';

export function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const { currentAgentId, currentConversationId, setCurrentAgent, setCurrentConversation } =
    useWorkbenchStore();

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
    <aside className="flex h-full w-60 shrink-0 flex-col border-r border-neutral-200 bg-white">
      <Link href="/" className="flex h-12 items-center px-3">
        <img
          src="/brand/company-logo.svg"
          alt="AgentOS"
          className="h-9 w-full object-contain object-left"
        />
      </Link>

      <div className="px-3">
        <button
          type="button"
          onClick={handleNewConversation}
          disabled={createConversation.isPending}
          className="flex w-full items-center gap-2 rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50"
        >
          <Plus size={16} /> 新建会话
        </button>
      </div>

      <nav className="mt-3 px-3">
        <Link
          href="/factory"
          className={cn(
            'flex items-center gap-2 rounded-md px-3 py-2 text-sm',
            pathname === '/factory'
              ? 'bg-neutral-100 font-medium'
              : 'text-neutral-600 hover:bg-neutral-50',
          )}
        >
          <Factory size={16} /> Agent Factory
        </Link>
      </nav>

      <div className="mt-4 flex-1 overflow-y-auto px-3">
        <div className="px-3 text-xs font-medium text-neutral-400">我的 Agents</div>
        <ul className="mt-1 space-y-0.5">
          {agents.length === 0 && (
            <li className="px-3 py-2 text-xs text-neutral-400">暂无 Agent，去 Factory 创建</li>
          )}
          {agents.map((agent) => (
            <li key={agent.id} className="group flex items-center">
              <button
                type="button"
                onClick={() => selectAgent(agent.id)}
                className={cn(
                  'flex min-w-0 flex-1 items-center gap-2 rounded-md px-3 py-2 text-left text-sm',
                  agent.id === currentAgentId && pathname === '/'
                    ? 'bg-neutral-100 font-medium'
                    : 'text-neutral-600 hover:bg-neutral-50',
                )}
              >
                <Bot size={15} className="shrink-0" />
                <span className="truncate">{agent.name}</span>
              </button>
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
                onClick={() => {
                  if (window.confirm(`确定删除 Agent「${agent.name}」？`)) {
                    deleteAgent.mutate({ agentId: agent.id });
                  }
                }}
                className="ml-1 rounded p-1.5 text-neutral-400 opacity-0 transition-opacity hover:bg-red-50 hover:text-red-600 disabled:opacity-50 group-hover:opacity-100"
              >
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>

        {currentAgentId && (
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
                  <li
                    key={conv.id}
                    className={cn(
                      'group flex items-center rounded-md',
                      selected ? 'bg-neutral-100 font-medium' : 'hover:bg-neutral-50',
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setCurrentConversation(conv.id);
                        router.push('/');
                      }}
                      className={cn(
                        'flex min-w-0 flex-1 items-center gap-2 px-3 py-1.5 text-left text-sm',
                        selected ? 'text-neutral-900' : 'text-neutral-500',
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
                      onClick={() => deleteConversation.mutate({ conversationId: conv.id })}
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

      <div className="border-t border-neutral-200 p-3">
        <Link
          href="/resources"
          className={cn(
            'flex items-center gap-2 rounded-md px-3 py-2 text-sm',
            pathname === '/resources'
              ? 'bg-neutral-100 font-medium'
              : 'text-neutral-600 hover:bg-neutral-50',
          )}
        >
          <SlidersHorizontal size={16} /> 资源与凭证
        </Link>
      </div>
    </aside>
  );
}
