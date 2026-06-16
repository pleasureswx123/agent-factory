# Agent Factory / AgentOS Single Agent MVP

Agent Factory 是 AgentOS 的本地单用户 MVP。当前版本聚焦单 Agent 的完整闭环：通过 Agent Factory 创建 Agent，配置 AgentDNA，在单 Agent 工作台中对话测试，将满意输出保存为素材，并在后续对话中引用素材继续生成。

## 项目结构

```text
agent-factory/
├── apps/
│   ├── web/                 # Next.js Web 应用，包含工作台、Factory、配置页、资源中心
│   └── runtime/             # Hono Runtime 服务，负责模型调用、流式对话、图像/视频生成
├── packages/
│   ├── db/                  # Drizzle + PostgreSQL 数据模型、迁移、seed
│   └── shared/              # Web / Runtime 共用的 Zod schema、协议、常量、加密工具
├── docs/                    # 产品与技术文档
├── schematic/               # 页面原型参考图
├── scripts/                 # 项目脚本目录
├── docker-compose.yml       # 本地 PostgreSQL/pgvector 服务
├── package.json             # monorepo 根脚本
├── pnpm-workspace.yaml      # pnpm workspace 配置
├── turbo.json               # Turborepo 任务配置
├── biome.json               # Biome lint/format 配置
├── tsconfig.base.json       # TypeScript 基础配置
└── .env.example             # 本地环境变量示例
```

## 关键文件说明

### 根目录

- `package.json`：定义 `dev`、`build`、`typecheck`、`lint`、数据库迁移等根命令。
- `pnpm-workspace.yaml`：声明 `apps/*` 与 `packages/*` 为 workspace 包。
- `turbo.json`：定义 Turborepo 的 `dev`、`build`、`typecheck`、`test`、`lint` 任务。
- `docker-compose.yml`：启动本地 `pgvector/pgvector:pg16` PostgreSQL，默认数据库为 `agentos`。
- `.env.example`：本地开发环境变量模板。
- `biome.json`：Biome 代码检查和格式化配置。
- `tsconfig.base.json`：所有 TypeScript 包继承的基础配置。

### `apps/web`

- `apps/web/src/app/layout.tsx`：应用根布局，挂载左侧栏和全局 Providers。
- `apps/web/src/app/page.tsx`：单 Agent 对话工作台首页。
- `apps/web/src/app/factory/page.tsx`：Agent Factory 页面，支持需求澄清、候选 Agent、DNA 配置和试跑。
- `apps/web/src/app/agents/[id]/page.tsx`：Agent 配置详情页，管理基础信息、Prompt 版本、模型绑定、记忆策略和删除。
- `apps/web/src/app/resources/page.tsx`：资源与凭证中心，管理 Provider、API Key、Skill、Tool、知识库。
- `apps/web/src/app/api/trpc/[trpc]/route.ts`：tRPC HTTP 入口。
- `apps/web/src/app/api/upload/route.ts`：上传文件并登记为素材。
- `apps/web/src/app/api/files/[name]/route.ts`：读取本地上传文件。
- `apps/web/src/components/sidebar.tsx`：左侧导航、Agent 列表、会话列表。
- `apps/web/src/components/chat-area.tsx`：对话区、流式响应、素材引用、保存为素材、文件上传。
- `apps/web/src/components/artifact-panel.tsx`：右侧素材资产库，支持折叠、列表和缩略图视图。
- `apps/web/src/server/routers/`：tRPC 业务路由，包括 Agent、Conversation、Artifact、Resource。
- `apps/web/src/lib/store.ts`：Zustand 本地状态，保存当前 Agent、会话和素材面板偏好。
- `apps/web/src/lib/utils.ts`：前端通用工具、Runtime 地址、流式响应读取。

### `apps/runtime`

- `apps/runtime/src/index.ts`：Runtime 服务入口，注册 `/health`、`/chat`、`/factory/chat`、`/test-run`。
- `apps/runtime/src/routes/chat.ts`：单 Agent 会话对话入口，负责消息落库、上下文拼接、模型分流和流式返回。
- `apps/runtime/src/routes/factory.ts`：Agent Factory 需求澄清对话和 Agent 试跑。
- `apps/runtime/src/provider.ts`：解析模型 Provider、解密密钥、构造 OpenAI-compatible 模型客户端。
- `apps/runtime/src/media.ts`：图像/视频生成和生成文件保存。

### `packages/db`

- `packages/db/src/schema.ts`：核心数据模型，包括 User、Agent、PromptVersion、AgentDNA、Conversation、Message、Artifact、Secret、Resource、Memory、AuditLog。
- `packages/db/src/client.ts`：Drizzle + postgres-js 数据库客户端。
- `packages/db/src/seed.ts`：写入默认本地用户和内置 Skill 资源。
- `packages/db/drizzle/`：Drizzle 生成的 SQL 迁移与快照。
- `packages/db/drizzle.config.ts`：Drizzle Kit 配置。

### `packages/shared`

- `packages/shared/src/schemas.ts`：tRPC 表单和输入校验 schema。
- `packages/shared/src/chat.ts`：Web 与 Runtime 之间的聊天协议，以及 Factory 候选 Agent JSON 解析。
- `packages/shared/src/constants.ts`：资源类型、状态、模型模态、内置 Skill 等常量。
- `packages/shared/src/crypto.ts`：服务端密钥加密/解密工具。
- `packages/shared/src/index.ts`：共享模块导出入口。

### `docs` 与 `schematic`

- `docs/PRD-AgentOS单AgentMVP.md`：当前 MVP 产品需求文档。
- `docs/Tech-Stack-Proposal.md`：技术栈方案文档。
- `schematic/*.png`：工作台、Factory、配置页、资源中心等页面参考图。

## 本地开发环境

### 前置依赖

- Node.js `>= 22`
- pnpm `>= 10`
- Docker Desktop 或兼容的 Docker 环境

建议先复制环境变量文件：

```powershell
Copy-Item .env.example .env
```

默认配置如下：

```env
DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/agentos
NEXT_PUBLIC_RUNTIME_URL=http://127.0.0.1:4001
PORT=4001
```

## 启动完整服务

### 1. 安装依赖

```powershell
pnpm install
```

### 2. 启动 PostgreSQL

```powershell
docker compose up -d
```

确认数据库容器已启动：

```powershell
docker compose ps
```

### 3. 初始化数据库

首次启动或 schema 变更后执行：

```powershell
pnpm db:push
pnpm db:seed
```

如果需要生成迁移文件：

```powershell
pnpm db:generate
```

如果采用迁移方式更新数据库：

```powershell
pnpm db:migrate
```

### 4. 启动 Web 与 Runtime

推荐直接启动整个 monorepo：

```powershell
pnpm dev
```

默认服务地址：

- Web: `http://localhost:3000`
- Runtime health: `http://127.0.0.1:4001/health`

也可以分别启动：

```powershell
pnpm --filter @agent-os/web dev
pnpm --filter @agent-os/runtime dev
```

### 5. 配置模型 Provider

进入 Web 后打开 `资源与凭证` 页面，新增一个文本对话模型 Provider：

1. 选择或填写 Provider 名称。
2. 填写 OpenAI-compatible `BaseURL`。
3. 填写模型 ID。
4. 填写 API Key。
5. 如需用于 Agent Factory，点击 `设为 Factory 默认`。

没有文本模型 Provider 时，Factory 对话和 Agent 对话会返回模型配置错误。

## 常用开发命令

```powershell
# 类型检查
pnpm typecheck

# 代码检查
pnpm lint

# 构建
pnpm build

# 格式化
pnpm format

# 数据库 schema 推送
pnpm db:push

# 写入默认用户和内置 Skill
pnpm db:seed
```

## 基本验证流程

1. 打开 `http://localhost:3000`。
2. 进入 `资源与凭证`，添加文本模型 Provider。
3. 进入 `Agent Factory`，描述想创建的 Agent。
4. 选择候选 Agent，配置 Prompt 和模型 Provider。
5. 创建 Agent 后回到首页，发起对话。
6. 将满意回复保存为素材。
7. 在输入框输入 `@` 引用素材继续对话。
8. 展开右侧 `素材资产库`，检查列表/缩略图视图。

## 当前注意事项

- 项目当前是本地单用户 MVP，默认用户 ID 由 seed 写入。
- API Key 会加密存储，界面只展示 hint。
- Agent 删除是软删除，素材会保留并标记来源 Agent 已删除。
- 长期记忆、知识库索引、真实 Tool/Skill 执行仍属于后续扩展能力。
- 图像/视频生成依赖对应 Provider 的接口兼容性和模型能力配置。
