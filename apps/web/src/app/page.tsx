'use client';

// 单 Agent 对话工作台：左侧栏（layout）+ 中间聊天区 + 右侧素材资产库
import { Bot } from 'lucide-react';
import Link from 'next/link';
import { ArtifactPanel } from '@/components/artifact-panel';
import { ChatArea } from '@/components/chat-area';
import { useWorkbenchStore } from '@/lib/store';
import { trpc } from '@/lib/trpc';

export default function HomePage() {
  const { currentAgentId } = useWorkbenchStore();
  const { data: agents = [], isLoading } = trpc.agent.list.useQuery();
  const agent = agents.find((a) => a.id === currentAgentId) ?? agents[0];

  return (
    <div className="flex h-full min-h-0 bg-neutral-50">
      {!agent ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 bg-white text-neutral-400">
          <Bot size={40} strokeWidth={1.5} />
          {isLoading ? (
            <p className="text-sm">加载中…</p>
          ) : (
            <>
              <p className="text-sm">还没有 Agent</p>
              <Link
                href="/factory"
                className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700"
              >
                去 Agent Factory 创建
              </Link>
            </>
          )}
        </div>
      ) : (
        <>
          <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-white">
            <header className="flex items-center gap-2 border-b border-neutral-200 bg-white px-6 py-3">
              <Bot size={18} className="text-neutral-500" />
              <h1 className="text-sm font-semibold">{agent.name}</h1>
              <span className="truncate text-xs text-neutral-400">{agent.description}</span>
            </header>
            <ChatArea agentId={agent.id} agentName={agent.name} />
          </div>
          <ArtifactPanel />
        </>
      )}
    </div>
  );
}
