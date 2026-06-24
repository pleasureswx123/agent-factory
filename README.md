# Agent Factory / AgentOS Single Agent MVP

Agent Factory 是为了未来建设 **AI 视频生产工作台** 先做的一版初步设想和技术验证。它不是最终的视频生产平台本体，而是先验证“用 AI Agent 承接创作意图、沉淀可复用能力、管理模型与素材资产、形成可持续迭代的创作闭环”这件事是否可行。

当前版本可以理解为 AI Director / Video Production Agent 工作台的前置 MVP：先从单 Agent 生命周期切入，让用户能够创建 Agent、配置 AgentDNA、绑定模型 Provider、进行对话测试、保存输出素材，并在后续对话中引用素材继续生成。后续真正的 AI 视频生产工作台会在这个基础上继续扩展到项目、剧本、分镜、角色/场景参考、图像/视频生成、质检评估和生产资产管理等完整视频生产流程。

## 项目定位

这个项目当前承担三件事：

1. 验证 Agent Factory 是否能把用户的创作需求转成可运行、可测试、可迭代的 AI Agent。
2. 验证 AI Director Agent 的基础工作方式：理解需求、组织 Prompt / DNA / 工具 / 模型配置，并产出可复用内容。
3. 为未来 AI 视频生产工作台打底：先把 Agent、模型 Provider、素材资产、会话上下文和配置管理这些基础能力跑通，再逐步接入视频生产链路。

当前不把它定位为完整剪辑软件、完整文生视频平台或最终版多 Agent 视频工厂。它是面向未来 AI 视频生产工作台的一版基础原型和工程起点。

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

### 本地启动速查（推荐）

在 Windows PowerShell 中从仓库根目录执行：

```powershell
cd D:\work\laputta\agent-factory

# 1. 确保依赖已安装
pnpm install

# 2. 启动本地 PostgreSQL（只绑定 127.0.0.1:5432）
docker compose up -d

# 3. 同步数据库结构并写入默认用户/内置资源
pnpm db:push
pnpm db:seed

# 4. 启动 Web 与 Runtime
pnpm dev
```

启动成功后访问：

- Web 工作台：`http://127.0.0.1:3000`
- Runtime 健康检查：`http://127.0.0.1:4001/health`
- PostgreSQL：`127.0.0.1:5432`，数据库 `agentos`

如果希望像 Codex 当前会话这样后台启动，可使用：

```powershell
Start-Process -FilePath "powershell" -ArgumentList @(
  "-NoProfile",
  "-ExecutionPolicy",
  "Bypass",
  "-Command",
  "cd D:\work\laputta\agent-factory; pnpm dev *> .local-dev.out.log"
) -WindowStyle Hidden
```

后台启动后可用下面的命令确认状态：

```powershell
Get-NetTCPConnection -State Listen | Where-Object { $_.LocalPort -in 3000,4001,5432 }
Invoke-WebRequest http://127.0.0.1:3000/ -UseBasicParsing
Invoke-WebRequest http://127.0.0.1:4001/health -UseBasicParsing
Get-Content .local-dev.out.log -Tail 80
```

### 本地重启与端口占用处理

如果 `3000` 或 `4001` 已被旧的本项目进程占用，先只清理 `agent-factory` 相关 Node 进程：

```powershell
Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" |
  Where-Object { $_.CommandLine -like '*D:\work\laputta\agent-factory*' } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
```

然后重新执行：

```powershell
docker compose up -d
pnpm db:push
pnpm db:seed
pnpm dev
```

如果 Web 返回 `500 Internal Server Error`，优先检查数据库结构是否落后于代码：

```powershell
pnpm db:push
pnpm db:seed
```

再重新访问 `http://127.0.0.1:3000/`。常见症状是 PostgreSQL 日志中出现类似 `column "skills" does not exist` 或 `relation "factory_dnas" does not exist`，这通常表示本地数据库 schema 还没有同步。

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
- 删除语义按对象隔离：删除 Agent 会软删除 Agent 并删除其会话上下文，但已保存素材保留，并标记来源 Agent 已删除。
- 删除会话只删除该次对话上下文，已保存素材保留；素材来源会话会断开。
- 删除素材只表示从当前素材资产库移除，不删除历史会话消息；用户仍可从会话消息中再次保存为素材。
- 长期记忆、知识库索引、真实 Tool/Skill 执行仍属于后续扩展能力。
- 图像/视频生成依赖对应 Provider 的接口兼容性和模型能力配置。
