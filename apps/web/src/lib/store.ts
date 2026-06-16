'use client';

// 全局 UI 状态：当前 Agent / 会话选择 + 素材库面板偏好（持久化到 localStorage）
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type WorkbenchState = {
  currentAgentId: string | null;
  currentConversationId: string | null;
  /** 素材资产库：折叠 / 展开 */
  artifactPanelOpen: boolean;
  /** 素材资产库视图：列表 / 缩略图 */
  artifactView: 'list' | 'grid';
  setCurrentAgent: (agentId: string | null) => void;
  setCurrentConversation: (conversationId: string | null) => void;
  toggleArtifactPanel: () => void;
  setArtifactView: (view: 'list' | 'grid') => void;
};

export const useWorkbenchStore = create<WorkbenchState>()(
  persist(
    (set) => ({
      currentAgentId: null,
      currentConversationId: null,
      artifactPanelOpen: false,
      artifactView: 'list',
      setCurrentAgent: (agentId) => set({ currentAgentId: agentId, currentConversationId: null }),
      setCurrentConversation: (conversationId) => set({ currentConversationId: conversationId }),
      toggleArtifactPanel: () => set((s) => ({ artifactPanelOpen: !s.artifactPanelOpen })),
      setArtifactView: (view) => set({ artifactView: view }),
    }),
    { name: 'agent-os-workbench' },
  ),
);
