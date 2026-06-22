'use client';

// 全局 UI 状态：当前 Agent / 会话选择 + 素材库面板偏好（持久化到 localStorage）
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const DEFAULT_ARTIFACT_PANEL_WIDTH = 384;
export const DEFAULT_FACTORY_PANEL_WIDTH = 440;

type WorkbenchState = {
  currentAgentId: string | null;
  currentConversationId: string | null;
  /** 左侧导航栏：折叠 / 展开 */
  sidebarCollapsed: boolean;
  /** 素材资产库：折叠 / 展开 */
  artifactPanelOpen: boolean;
  /** 素材资产库宽度，单位 px */
  artifactPanelWidth: number;
  /** Agent Factory 右侧流程列宽度，单位 px */
  factoryPanelWidth: number;
  /** 素材资产库视图：列表 / 缩略图 */
  artifactView: 'list' | 'grid';
  setCurrentAgent: (agentId: string | null) => void;
  setCurrentConversation: (conversationId: string | null) => void;
  toggleSidebar: () => void;
  toggleArtifactPanel: () => void;
  setArtifactPanelWidth: (width: number) => void;
  setFactoryPanelWidth: (width: number) => void;
  setArtifactView: (view: 'list' | 'grid') => void;
};

export const useWorkbenchStore = create<WorkbenchState>()(
  persist(
    (set) => ({
      currentAgentId: null,
      currentConversationId: null,
      sidebarCollapsed: false,
      artifactPanelOpen: true,
      artifactPanelWidth: DEFAULT_ARTIFACT_PANEL_WIDTH,
      factoryPanelWidth: DEFAULT_FACTORY_PANEL_WIDTH,
      artifactView: 'list',
      setCurrentAgent: (agentId) => set({ currentAgentId: agentId, currentConversationId: null }),
      setCurrentConversation: (conversationId) => set({ currentConversationId: conversationId }),
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      toggleArtifactPanel: () => set((s) => ({ artifactPanelOpen: !s.artifactPanelOpen })),
      setArtifactPanelWidth: (width) => set({ artifactPanelWidth: width }),
      setFactoryPanelWidth: (width) => set({ factoryPanelWidth: width }),
      setArtifactView: (view) => set({ artifactView: view }),
    }),
    {
      name: 'agent-os-workbench',
      version: 4,
      migrate: (persisted) => {
        const state = (persisted ?? {}) as Partial<WorkbenchState>;
        return {
          ...state,
          artifactPanelOpen: true,
          artifactPanelWidth:
            typeof state.artifactPanelWidth === 'number'
              ? state.artifactPanelWidth
              : DEFAULT_ARTIFACT_PANEL_WIDTH,
          factoryPanelWidth:
            typeof state.factoryPanelWidth === 'number'
              ? state.factoryPanelWidth
              : DEFAULT_FACTORY_PANEL_WIDTH,
        };
      },
    },
  ),
);
