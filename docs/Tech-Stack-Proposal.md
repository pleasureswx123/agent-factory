# AgentOS MVP 技术栈方案

版本：v0.2
日期：2026-06-12
状态：决策已确认
配套文档：`docs/PRD-AgentOS单AgentMVP.md`

## 0. 已确认形态

本 MVP 锁定为：

1. **单用户本地工具**：默认绑定 `127.0.0.1`，无多租户、无团队权限、无 SaaS 形态。
2. **部署地域：仅国内**：模型 Provider、对象存储、依赖镜像均按国内可访问选型。
3. **Agent Runtime：TypeScript**：基于 Vercel AI SDK，与前端同语言。
4. **MCP**：仅在 Tool 抽象层留扩展接口，MVP 不接入 MCP client。
5. **UI 还原度**：参考 `schematic/` 原型图布局与信息架构，不做 1:1 像素还原；视觉细节以 shadcn/ui 默认风格为基线。

## 1. 目标与原则

在 PRD 约束下（单 Agent / 调试 + 沉淀 / 资源中心化 / 国内可用），选一套足够轻、又能直通生产的技术栈。

优先级：**落地速度 > 架构纯净度**，但不为速度牺牲扩展性（PRD 已为多 Agent / Workflow 留扩展点）。

## 2. 整体架构

```text
┌──────────────────────────────────────────────────────────────┐
│                       Web (Next.js)                          │
│   - Agent 工作台 / Factory / 配置 / 资源中心 / 素材库         │
│   - SSE/Streaming UI (Vercel AI SDK UI)                      │
└──────────────┬───────────────────────────────┬───────────────┘
               │ tRPC / Server Actions         │ /api/chat (SSE)
               ▼                               ▼
┌──────────────────────────┐   ┌──────────────────────────────┐
│   App API (Next.js RSC)  │   │   Agent Runtime (Node 服务)   │
│   - CRUD: Agent/DNA/...  │   │   - Vercel AI SDK + Tools     │
│   - Prompt 版本管理       │   │   - Tool 执行 / Memory        │
│   - 鉴权 / 资源选择       │   │   - 流式输出 / Artifact 落库   │
└──────────┬───────────────┘   └──────────┬───────────────────┘
           │                              │
           ▼                              ▼
     ┌──────────────────────────────────────────┐
     │  Postgres (主存) + Redis (缓存/队列/流)    │
     │  + S3 兼容对象存储 (素材)                  │
     └──────────────────────────────────────────┘
```

两个进程：Web/App 一个 Next.js 进程，Agent Runtime 一个独立 Node 进程。MVP 阶段可放在同一台机器、同一个 monorepo，但**不要写在同一个进程里**——Agent 跑长任务会拖死 Web。

## 3. 前端

| 层 | 选型 | 理由 |
| --- | --- | --- |
| 框架 | Next.js 15 (App Router) + React 19 | SSR + 流式 + RSC，对 AI 聊天天然友好 |
| 语言 | TypeScript 5.x (strict) | 与后端共享类型 |
| 样式 | Tailwind CSS v4 + shadcn/ui | 与原型图风格匹配，组件可控、可改 |
| 客户端状态 | Zustand | 比 Redux 轻，比 Context 可控 |
| 服务端状态 | TanStack Query | 缓存 / 失效 / 乐观更新 |
| 表单 | react-hook-form + zod | AgentDNA / 资源配置表单复杂，zod 同时给后端用 |
| 聊天 UI | Vercel AI SDK（`ai` + `@ai-sdk/react`） | `useChat` 解决流式、工具调用、消息状态 |
| Prompt 编辑器 | CodeMirror 6 | 版本 diff、变量高亮 |
| 拖拽 / @引用 | @dnd-kit + 自研 mention 插件 | `@素材` 走 mention，artifact 可拖入对话 |
| 图标 | lucide-react | shadcn 默认 |
| 端到端类型 | tRPC v11 | 不写 OpenAPI，前后端共享 zod schema |

## 4. 后端 / API 层

核心决策：MVP **不引入独立后端语言**，App API 全部走 Next.js Route Handlers + tRPC，单 monorepo 部署。

| 层 | 选型 | 理由 |
| --- | --- | --- |
| 框架 | Next.js Route Handlers + tRPC v11 | 与前端同仓库、同类型、同进程 |
| 校验 | zod（与前端共用 schema） | 单一事实源 |
| 鉴权 | MVP 默认无登录，绑定 `127.0.0.1`；可选 Basic Auth 中间件做最小保护 | 单用户本地工具不需要完整 NextAuth |
| 文件上传 | 走本地 Route Handler 接收 → 落本地磁盘 / OSS | 单机场景不需要预签名 URL |
| 密钥加密 | AES-256-GCM + 本地主密钥（首次运行生成，存 `~/.agent-os/master.key`） | 国内单机部署，KMS 可后期接入 |
| 后台任务 | BullMQ on Redis | 素材后处理、长任务异步化 |
| 日志 | pino + pino-pretty（dev） | 轻量、结构化 |
| LLM 可观测 | Langfuse（self-host，国内可部署） | trace / cost / prompt 评估 |

## 5. Agent Runtime

核心决策：用 **TypeScript + Vercel AI SDK** 作为 MVP runtime，**不直接上 LangGraph**。

理由：
1. 单 Agent，不需要图状编排。
2. 国内常用 Provider（doubao / 通义 / DeepSeek / OpenAI 兼容网关）`@ai-sdk/openai-compatible` 直接支持。
3. Tool calling、streaming、structured output 一套搞定。
4. 与前端 `useChat` 完美对接。

| 层 | 选型 | 备注 |
| --- | --- | --- |
| Runtime 进程 | Node 22 + Hono 独立服务（端口 `:4001`） | 与 Next.js 解耦；将来可换 Python |
| Agent 核心 | Vercel AI SDK v5（`ai`、`@ai-sdk/openai`、`@ai-sdk/openai-compatible`） | 多 Provider、流式、tool calling |
| Provider 适配 | OpenAI-compatible 一把梭：doubao（火山方舟）/ 通义（DashScope）/ DeepSeek / 本地网关 | 一套代码跑全部国内主流 Provider |
| Tool 注册 | 内置 Skills（文件解析 / 总结 / 网络检索）；Tool 抽象层留 MCP 接口（MVP 不接入） | MVP 内置 3-5 个 Skill 即可 |
| Memory | 短期：会话级窗口截断；长期：手动写入 `agent_memory` 表 | 对应 PRD 的"记忆策略" |
| Artifact 产出 | Agent 输出**不自动入库**（PRD 决策），仅在用户点"保存为素材"时落库 | 由前端调 App API |

预留：未来要做多 Agent / Workflow 时，再把 Runtime 换/包成 Mastra 或 LangGraph.js，对外接口（`POST /chat` SSE）保持不变。

## 6. 数据库与存储

| 组件 | 选型 | 用途 |
| --- | --- | --- |
| 主库 | PostgreSQL 16 | 所有结构化数据；MVP 单库够用 |
| ORM | Drizzle ORM | TS-first，迁移可读，比 Prisma 轻 |
| 迁移 | drizzle-kit | |
| 向量 | pgvector 扩展（先装不用） | 为知识库预留，MVP 不启用 |
| 缓存 / 队列 / Pub-Sub | Redis 7 | BullMQ、SSE fan-out、会话热缓存 |
| 对象存储 | 单机默认本地磁盘 `./data/artifacts`；可选切换阿里云 OSS / 腾讯云 COS | 单用户本地工具无需 S3 |
| 搜索（可选） | 先不上；够用就 Postgres 全文检索 | |

Schema 映射 PRD 第 8 节（直接可建表）：

```text
agents, agent_dnas, conversations, messages,
artifacts, resources, secrets,
prompt_versions      ← 拆出来，专门承载 Prompt 历史
agent_memory         ← 长期记忆
audit_logs           ← 资源 / Agent 变更审计
```

建议把 `prompt_versions` 从 `AgentDNA` 里拆出来，避免每改一次 Prompt 就生成整份 DNA 快照。

## 7. 本地开发与部署

| 阶段 | 方案 |
| --- | --- |
| 本地 dev | `docker compose up postgres redis langfuse`；`pnpm dev` 同时拉 Next.js + Runtime |
| npm 镜像 | npmmirror（`.npmrc` 配 registry） |
| 包管理 | pnpm + Turborepo（monorepo） |
| 仓库结构 | `apps/web`（Next.js）+ `apps/runtime`（Node）+ `packages/db`（Drizzle schema）+ `packages/shared`（zod / types） |
| Lint / Format | Biome（一个工具替代 eslint + prettier） |
| 测试 | Vitest（单元）+ Playwright（关键 E2E：创建 Agent / 发消息 / 保存素材） |
| CI | GitHub Actions：lint + test + build + drizzle migrate dry-run |
| 分发 | 用户本机：`docker compose up` 一键起；可选打包 Electron 壳 | |
| 镜像 | 多阶段 Dockerfile，`node:22-slim`（国内可拉 docker.m.daocloud.io 镜像） |

## 8. PRD 能力对照

| PRD 要求 | 技术落点 |
| --- | --- |
| 流式对话 | `useChat` + AI SDK SSE |
| `@素材` 引用 | CodeMirror mention 插件 + `artifactRefs` 数组进 `messages` 表 |
| 素材手动保存 | 前端按钮 → App API → `artifacts` 表 + 本地磁盘 / OSS |
| Prompt 完整版本史 | `prompt_versions` 表 + CodeMirror diff |
| 资源中心 + 仅引用 | `resources` + `secrets` 分离；`agent_dnas` 只存 ID |
| API Key 不明文 | AES-256-GCM + 本地主密钥；UI 只显 `sk-****1234` |
| 知识库不进 MVP | 表结构预留 `knowledge_base_id`，UI tab 留"敬请期待" |
| 折叠 / 列表 / 缩略图 | Zustand persist 用户偏好 |
| 删除 Agent 软删 | `agents.deleted_at` 标记 Agent；删除会话上下文；已保存素材保留，`artifacts.agent_id` / `conversation_id` / `message_id` 置空并标记 `sourceAgentDeleted` |
| 删除会话 | 删除 conversation / message；已保存素材保留，`artifacts.conversation_id` / `message_id` 置空 |
| 删除素材 | 仅从素材资产库移除，`artifacts.agent_id` 置空；不删除历史会话消息和消息中的生成结果 |

## 9. 已确认决策

| # | 决策 | 结论 | 影响 |
| --- | --- | --- | --- |
| 1 | 部署地域 | **仅国内** | Provider / OSS / 镜像源全部按国内可用选 |
| 2 | 多租户 | **单用户本地工具** | 不上 NextAuth、不做 RLS；`users` 表保留供后期扩展 |
| 3 | Agent Runtime 语言 | **TypeScript** | 与前端同语言，统一 Vercel AI SDK |
| 4 | MCP | **MVP 不接入** | Tool 抽象层留扩展接口，后续无破坏性扩展 |
| 5 | UI 还原度 | **参考原型，不 1:1** | 走 shadcn/ui 默认风格，节省 UI 工时 |

## 10. 版本说明

| 版本 | 日期 | 变更 |
| --- | --- | --- |
| v0.1 | 2026-06-12 | 初版草案 |
| v0.2 | 2026-06-12 | 锁定 5 项决策；按"单用户本地 + 国内"重写鉴权 / 密钥 / 存储 / 部署 |
