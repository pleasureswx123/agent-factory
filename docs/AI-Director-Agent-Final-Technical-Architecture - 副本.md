# AI Director Agent Studio 最终版技术方案

日期：2026-06-23  
版本：v1.0 开发基准版  
用途：全新项目研发启动、架构实现、模块拆解、技术验收  
对应产品文档：`docs/AI-Director-Agent-Final-PRD.md`

## 0. 开发执行说明

本文件可作为 Claude Code 或其他开发 Agent 的技术实现输入。执行时遵循：

1. 默认按 Phase 1：Director MVP 开发，不主动扩展到 Phase 2+。
2. 先实现领域模型和 API，再实现 Runtime，再实现 Studio UI。
3. 按第 3.5 节固定默认技术栈实现；除非产品负责人明确批准，不要自行切换到 Node 全栈、AgentScope、CrewAI、AutoGen、Dify、Langflow 或纯自研 runtime。
4. Model Gateway、Tool Runtime、Asset Service 必须有清晰接口，避免业务代码直接调用具体模型供应商 API。
5. 视频生成必须异步执行，不能用同步 HTTP 请求长时间阻塞。
6. 所有生成结果必须保存为 Reference Asset，并记录来源血缘。
7. 不在 MVP 中实现复杂多 Agent、完整剪辑 timeline、MCP 市场、导演风格市场。
8. 每个开发阶段必须对照第 15 章技术验收检查。

## 1. 技术目标

本方案面向全新项目立项，采用明确默认技术栈的开发基准设计。技术目标是设计一个面向 AI 视频生产的 AgentOS 应用，使其支持：

1. Agent Factory 创建和调优 AI Director / Video Production Agent。
2. AgentDNA / FactoryDNA / DirectorDNA 版本化。
3. per-Agent 模型列表和按模态分流。
4. Reference Asset Library 管理全能参考素材。
5. VideoProject 管理视频生产上下文。
6. AI Director 输出导演判断、导演手记、导演板选择和 Director Segment。
7. 文本、图片、视频、多模态模型协同。
8. Tool calling loop 执行读取素材、生成图片、生成视频、保存资产、质检等动作。
9. 生成过程、工具调用、资产血缘和质检结果可观察。

## 2. 需求语义边界

本技术方案面向一个全新项目。项目目标是构建 AI Director Agent Studio，而不是普通聊天机器人、普通文生视频工具或通用 Agent demo。

### 2.1 必须保留的领域语义

无论采用什么技术栈，系统必须保留以下领域概念：

1. Agent Factory
   - 用于创建、配置和进化 AI Director / Video Production Agent。
   - 它是 Meta-Agent，不是普通表单向导。

2. AgentDNA / DirectorDNA / FactoryDNA
   - AgentDNA 描述 Agent 的身份、职责、规则、模型、工具、记忆、评估。
   - DirectorDNA 描述导演风格、导演原则、视觉语言、生成策略和质检标准。
   - FactoryDNA 描述 Agent Factory 自身如何澄清需求、推荐能力、测试发布。

3. VideoProject
   - 视频生产的项目容器，承载文本、参考素材、导演判断、段落、生成结果和质检记录。

4. Reference Asset Library
   - 管理角色卡、场景卡、美术设定卡、风格卡、首尾帧、导演手记、导演板、视频片段等资产。

5. Director Segment
   - 将视频生产拆成可控但不过度束缚 AI 的生成段落。MVP 可默认 15 秒，但时长应由模型能力、剧情节奏和生成模式动态决定。

6. Tool Calling Loop
   - Agent 不能只在 prompt 里“假装会用工具”，必须能真实调用工具并把结果回写上下文。

7. 多模态模型路由
   - 文本分析、图片生成、视频生成、多模态理解、质检评估应可使用不同模型。

8. Trace / Activity
   - 用户能看到“分析故事、选择导演板、读取素材、生成视频、质检结果”等可审计过程。

### 2.2 技术栈边界

本开发基准版已经固定默认技术栈，便于 Claude Code 或其他开发 Agent 直接落地。以下内容可以保持接口可替换，但第一版开发不要自行更换实现：

1. 前端默认 React / TypeScript / Vite。
2. 后端默认 Python / FastAPI。
3. Agent Runtime 默认 Python LangGraph。
4. Worker 默认 Python + Celery + Redis。
5. 数据库默认 PostgreSQL。
6. ORM 默认 SQLAlchemy 2.x + Alembic。
7. 对象存储默认 S3-compatible，本地开发用 MinIO。
8. 前后端 API 默认 REST + SSE，不使用 GraphQL/tRPC。
9. 模型供应商通过自研 Model Gateway 适配，不在业务代码中直接调用。
10. MCP、可视化 workflow、完整多 Agent 编排后置。

可替换的是接口边界，不是第一版实现路线。开发 Agent 应按默认栈实现，避免技术选型漂移。

## 3. 技术选型原则与候选框架

本方案不假设团队已经确定 AgentScope、LangGraph、CrewAI、AutoGen、Dify、Langflow、OpenAI Agents SDK 等框架。它们都是 Agent 相关技术，但解决的问题不同，不能因为“都和 Agent 有关”就直接堆在一起。

更合理的做法是先确定系统分层，再决定每一层是否采用成熟框架。

### 3.1 选型原则

技术选型应服务以下目标：

1. 支持长流程、可恢复的视频生产任务。
2. 支持 Agent 状态、工具调用、人工确认、失败重试和 trace。
3. 支持多模态模型和多 provider 路由。
4. 支持素材资产、项目上下文、段落状态和生成任务的持久化。
5. 支持未来从单 AI Director Agent 演进到多专业 Agent。
6. 不把系统绑定到单一模型厂商或单一视频生成接口。
7. 不为了框架概念牺牲产品的导演判断、资产复用和工作台体验。

### 3.2 市场上常见的 Agent 产品技术分层

参考 ChatGPT、Codex、AI IDE、Dify、Langflow、Flowise、AutoGen Studio 等产品形态，较成熟的 Agent 产品通常不是一个框架包打天下，而是分成以下层：

```text
Studio / Product UI
  对话、项目、资产、工作流、设置、监控、人工确认

Application Domain Layer
  项目、Agent 配置、工具绑定、资产、记忆、评估、权限

Agent Runtime
  prompt 编译、模型调用、tool loop、状态机、handoff、trace

Workflow / Graph Runtime
  长任务、步骤编排、checkpoint、resume、人工审批、异步任务

Model Gateway
  多模型 provider、模型路由、模型能力描述、成本/限流

Tool / MCP Runtime
  内置工具、HTTP 工具、MCP 工具、权限、sandbox、审计

Storage & Infra
  DB、对象存储、向量库、队列、任务调度、日志、权限、密钥
```

对应到本产品：

```text
Studio UI
  AI Director 工作台、项目页、右侧资产栏、段落页、导演板库

Domain Layer
  VideoProject、DirectorDNA、DirectorBoard、Segment、Asset、Evaluation

Agent Runtime
  AI Director 判断、工具调用、Director prompt 编译、trace

Workflow Runtime
  Director Segment 生成、视频任务轮询、质检、人审和重试

Model Gateway
  文本模型、图片模型、视频模型、多模态模型、评估模型

Tool Runtime
  读写资产、生成 Asset Card、生成图片、生成视频、轮询任务、质检、MCP 扩展
```

这个分层比“选某一个 Agent 框架”更重要。

### 3.3 候选框架分析

结论先行：

```text
MVP 默认采用 Python LangGraph。
MVP 不采用 AgentScope、Langflow、AutoGen、CrewAI、Dify、Flowise 作为主架构。
这些框架只作为后续参考，不进入第一版依赖。
```

#### LangGraph

适合场景：

1. 视频生产的长流程编排。
2. Director Segment 生成、提交任务、轮询、质检、人工确认。
3. 需要 checkpoint、interrupt、resume、trace 的流程。
4. 后续多 Agent 和状态图编排。

建议：

> LangGraph 是本产品 MVP 默认 Agent Runtime。AI Director 的生产过程天然是 state graph：分析、规划、生成、轮询、质检、人工确认、重试。

#### LangChain / LangChain.js

适合场景：

1. 封装不同模型供应商的调用。
2. 组织 prompt、messages、tools、structured output。
3. 快速接入 OpenAI-compatible chat model 和 tool calling。
4. 在轻量 MVP 中作为模型调用工具库。

建议：

> LangChain 更适合作为模型调用和工具封装库，不应被当成完整产品架构。LangGraph 可以理解为更适合有状态流程和 Agent 编排的运行时；本产品如果要处理 Director Segment、视频任务轮询、人工确认和质检重试，LangGraph 的价值高于单独使用 LangChain。

#### AgentScope

适合场景：

1. 需要更完整的 Agent 服务化能力。
2. 需要事件系统、权限系统、workspace / sandbox、多会话能力。
3. 后续要把工具执行和 Agent 运行做成更生产化的服务。

建议：

> AgentScope 值得作为生产级 Agent 服务底座参考，尤其是事件、权限、workspace/sandbox、多会话和工具执行安全。但需要评估生态、语言栈和团队熟悉度。

MVP 判断：

```text
不采用 AgentScope 作为第一版主架构。
原因：当前重点是垂直 AI 视频生产工作台，不是先建设通用 AgentOS 服务底座。
后续如果要强化 workspace、sandbox、权限、session 和工具执行安全，再评估 AgentScope。
```

#### OpenAI Agents SDK

适合场景：

1. 需要清晰的 agents / tools / guardrails / handoffs / tracing 抽象。
2. 需要快速构建工具调用、handoff、trace 的 agent 原型。
3. 与 OpenAI 生态深度结合。

建议：

> OpenAI Agents SDK 的 agents / tools / guardrails / handoffs / tracing 抽象很清晰，适合快速原型和设计参考。但本产品需要多模型、多视频供应商，不应绑定单一模型厂商。

#### CrewAI

适合场景：

1. 后续把复杂环节升级为 Story Analysis Agent、Character Bible Agent、Video QA Agent。
2. 强调 role / goal / task / crew / flow。

建议：

> CrewAI 对未来“专业子 Agent 团队”有参考价值，但 MVP 不建议先 Crew 化。第一阶段应先做一个强 AI Director Agent + workflow steps。

#### AutoGen / Microsoft Agent Framework

适合场景：

1. 多 Agent 对话、handoff、human-in-the-loop。
2. 团队式 Agent 协作。

建议：

> 作为未来多 Agent 协作参考，不建议第一阶段作为核心复杂度来源。

MVP 判断：

```text
不采用 AutoGen 作为第一版主架构。
原因：AutoGen 更适合多 Agent 对话和团队式协作；当前阶段应避免过早多 Agent 化。
第一版重点是一个强 AI Director Agent + workflow steps + assets + tools。
```

#### Dify / Langflow / Flowise

适合场景：

1. 可视化 workflow。
2. Prompt IDE、模型管理、RAG、LLMOps。
3. 工作流发布为 API 或工具。

建议：

> 作为产品形态和可视化编排参考，但本产品第一阶段不应被“通用工作流画布”带偏；应先做好 AI Director 工作台和视频生产资产。

MVP 判断：

```text
不采用 Langflow / Dify / Flowise 作为第一版底座。
原因：它们更偏通用 workflow / prompt flow / 低代码编排。
本产品需要强领域对象：VideoProject、Director Segment、Reference Asset、Production Bible、Audio Pack、Continuity Pack。
过早采用通用工作流画布，会削弱导演工作台和资产系统的产品主线。
```

### 3.4 固定技术路线

采用“领域模型自有 + Python LangGraph Runtime + 自研 Model Gateway + 异步 Worker”的路线：

```text
产品领域层
  VideoProject / DirectorDNA / DirectorBoard / Segment / Asset / Evaluation

Agent Runtime 层
  Python LangGraph

Model Gateway 层
  自研 provider adapter，OpenAI-compatible adapter 起步，扩展火山 / 通义 / 智谱 / 图片模型 / 视频模型 / TTS 模型

Tool Runtime 层
  builtin tools / HTTP tools / MCP tools / workflow tools

Storage 层
  PostgreSQL / MinIO-S3 / Redis / job_events trace store
```

第一阶段执行原则：

1. 产品领域模型必须自有，不被任何框架的数据结构绑死。
2. Runtime 固定使用 Python LangGraph。
3. 不建议 MVP 同时引入太多 Agent 框架，避免概念堆叠。
4. OpenAI Agents SDK 可作为抽象参考，但不作为实现依赖。
5. CrewAI / AutoGen 适合后续多专业 Agent 阶段，不作为第一阶段主架构。
6. Dify / Langflow / Flowise 适合作为产品形态和 workflow 可视化参考，不建议直接作为核心底座。

### 3.5 固定默认技术栈

为了直接交给 Claude Code 或其他开发 Agent 实现，本方案固定以下默认技术栈。开发时不要再做框架选型，不要自行切换到其他路线。

#### 3.5.1 默认技术栈

```text
Frontend:
  React 18 + TypeScript + Vite
  TanStack Query
  Zustand
  Tailwind CSS
  shadcn/ui 或等价 headless component

Backend API:
  Python 3.11+
  FastAPI
  Pydantic v2
  SQLAlchemy 2.x
  Alembic

Agent Runtime:
  Python
  LangGraph
  LangChain 仅作为模型调用和 tool 封装辅助库

Worker / Queue:
  Redis
  Celery
  独立 worker 进程

Storage:
  PostgreSQL
  S3-compatible Object Storage
  本地和生产默认均可使用 MinIO

Realtime / Activity:
  Server-Sent Events
  不默认使用 WebSocket
  job_events / run_steps 持久化

Model Gateway:
  自研 provider adapter
  OpenAI-compatible adapter 起步
  图片 / 视频 / TTS / 多模态供应商通过 adapter 扩展
  必须提供 mock provider，保证无真实 API Key 时也能跑通 P0 端到端流程

Auth:
  MVP 可先使用本地用户 / 简化 session
  保留后续接入 OAuth / SSO 的边界

Package / Dev:
  Python 使用 uv 或 poetry 二选一，默认 uv
  Frontend 使用 pnpm
  Docker / Docker Compose 管理全套本地开发环境
```

#### 3.5.2 固定默认栈的理由

1. 产品需要清晰的 Studio UI，React / TypeScript 生态成熟。
2. 本项目更需要工作台应用而非 SSR 内容站，Vite + React 足够直接。
3. AI Director 的生产流程天然适合 LangGraph / state graph。
3. 模型和视频供应商不应绑定单一厂商，因此 Model Gateway 必须自研。
4. 视频生成是异步长任务，必须有 Queue / Worker。
5. 资产复用是核心能力，必须有 Object Storage。
6. Python 更适合 AI Runtime、文件解析、视频/音频处理、多模态评估和后续算法扩展。
7. Celery 更成熟、更大众，适合图片、视频、TTS、质检、导出等长耗时任务；后续如需要复杂 durable workflow，可再评估 Temporal。

#### 3.5.3 非默认技术路线

以下只作为技术负责人后续评估参考，不作为本开发基准版的执行路线：

1. Node.js / BullMQ 全栈
   - 仅当团队强 TypeScript 后端经验时考虑。

2. AgentScope
   - 适合后续建设更完整 AgentOS 底座，不作为 MVP 默认 runtime。

3. Temporal
   - 适合复杂跨天工作流、强恢复和 Saga，不作为 MVP 第一默认队列。

4. Next.js 全栈
   - 适合 BFF 或营销站，不作为 AI Runtime 和 Worker 主体。

5. Dify / Langflow / Flowise
   - 仅作为产品形态参考，不作为本产品核心底座。

#### 3.5.4 Mock Provider 与种子数据

为了让 Claude Code 在没有真实模型 API Key 的情况下也能完成可验证开发，MVP 必须提供 mock provider 和 seed data。

要求：

1. `mock_text_provider`
   - 返回固定但结构合理的导演判断、ProductionBible、Segment、AudioPack、ContinuityPack。

2. `mock_image_provider`
   - 生成占位图片文件或从本地 fixture 复制图片，并保存为 ReferenceAsset。

3. `mock_video_provider`
   - 生成占位视频文件或从本地 fixture 复制短视频，并通过 Celery job 模拟 queued / running / polling / succeeded 状态。

4. `mock_tts_provider`
   - P0 可只返回字幕、对白和声音说明；如生成临时音频，可使用本地 fixture。

5. `mock_evaluation_provider`
   - 返回固定结构的 Director Evaluation，包括 pass / needs_changes / blocked。

6. Seed Data
   - 默认用户。
   - 默认 AI Director Agent。
   - 默认 DirectorDNA。
   - 默认 Director Boards。
   - 默认 Model Provider / Model Profiles。
   - 示例 VideoProject。

验收要求：

```bash
docker compose up --build
docker compose exec api alembic upgrade head
docker compose exec api python -m scripts.seed
docker compose exec api pytest
```

以上命令必须在没有真实模型 Key 的情况下跑通 P0 smoke test。真实 provider adapter 可以随后替换 mock provider，但不得影响领域模型和 API 结构。

### 3.6 本产品推荐

综合本产品特点，执行路线固定为：

```text
Phase 1:
  领域模型自有
  Python FastAPI
  Python LangGraph
  Python Celery Worker
  自研 Model Gateway
  PostgreSQL + Redis + MinIO / S3
  内置工具优先，MCP 后置

Phase 2:
  引入更完整 Trace / Run Store
  加强权限和 sandbox
  增加 MCP 工具接入
  评估 AgentScope 的事件、session、workspace 能力

Phase 3:
  多专业子 Agent
  Handoff / supervisor
  可视化 workflow
```

最重要的判断：

> 不要把技术方案押注在某一个 Agent 框架上。核心资产是 VideoProject、DirectorDNA、DirectorBoard、Segment、Reference Asset、Evaluation 这些领域模型，以及 AI Director 的运行链路。框架只是 runtime 实现选择。

## 4. 总体架构

```text
Frontend Studio
├── Agent Factory
├── AI Director Workspace
├── VideoProject Workspace
├── Reference Asset Library
├── Director Board Library
├── Agent / Director Settings
└── Run / Evaluation Monitor

Application API
├── Agent Management
├── Factory Management
├── VideoProject Management
├── DirectorDNA Management
├── Director Board Management
├── Segment Management
├── Asset Management
├── Evaluation Management
└── Resource / Model Management

Agent Runtime
├── Model Gateway Client
├── Agent Runner
├── Tool Calling Loop
├── Model Router
├── Media Generation Router
├── Tool Executor
├── Asset Context Builder
├── Trace Recorder
└── Evaluation Runner

Storage
├── Relational DB
├── Object Storage / Uploads
├── Secret Store
├── Future Vector Store
└── Future Queue / Durable Run Store
```

MVP 边界：

1. P0 必须内置默认 AI Director Agent、默认 DirectorDNA、默认 Director Boards 和默认模型配置，使用户不经过完整 Agent Factory 也能创建 VideoProject 并跑通生成闭环。
2. Agent Factory 在 P0 中可以先实现为“默认 Agent 设置页 + DNA 查看/微调入口 + 创建项目入口”。
3. Agent Factory 的完整对话式澄清、自动创建 Agent、测试发布、版本进化流程放入 P1。
4. 这样可以避免第一阶段把主要工程量消耗在通用 Agent 创建平台上，而忽略 AI Director 工作台、资产复用、Segment 生成和质检闭环。

## 5. 核心运行链路

### 5.1 创建 AI Director Agent

```text
用户输入目标
-> Factory Chat 澄清需求
-> Factory 生成 AI Director / Video Agent 建议
-> 推荐 DirectorDNA、Director Boards、skills、tools、models
-> 试跑测试
-> 评估是否可创建
-> 创建 Agent + PromptVersion + AgentDNA
```

### 5.2 创建 VideoProject

```text
用户创建项目
-> 输入 source text / 上传素材
-> 绑定 AI Director Agent
-> 初始化 projectBrief
-> AI Director 生成 directorNotes
-> 生成角色卡 / 场景卡 / 风格卡
-> 生成 Director Segments
```

### 5.3 生成单个 Director Segment

```text
加载 VideoProject
-> 加载 DirectorDNA / AgentDNA
-> 加载 Segment
-> 加载引用素材
-> AI Director 判断 Control Level
-> AI Director 生成 Director Visual Decision
-> 选择生成方式
-> 准备 prompt pack
-> 调用图片 / 视频工具
-> 保存生成结果为资产
-> 生成 Director Evaluation
-> 更新 Segment 状态
```

### 5.4 Tool loop

```text
system prompt = AgentDNA + DirectorDNA + Director Notes + Segment Context
user input = 用户指令 + @素材 + 当前 VideoProject 状态
model output = assistant 或 tool_calls
runtime 执行 tool
tool result 回写 messages
模型继续判断
最终输出导演判断 / 生成结果 / 质检结论
```

## 6. 数据模型设计

### 6.0 数据库访问层约定

本项目固定使用 SQLAlchemy 2.x ORM + Alembic + PostgreSQL。Claude Code 实现时不要切换到 Prisma、Drizzle、Django ORM、Tortoise ORM，也不要在业务代码中大量手写裸 SQL。

职责边界：

1. SQLAlchemy ORM
   - 定义数据库持久化模型。
   - 管理表关系、外键、索引、事务和查询。
   - 覆盖 VideoProject、AgentDNA、DirectorDNA、DirectorSegment、ReferenceAsset、GenerationJob、JobEvent、DirectorEvaluation 等核心表。

2. Alembic
   - 管理数据库 schema migration。
   - 所有表结构变更必须通过 Alembic migration。
   - 不允许只改 ORM model 而不生成 migration。

3. Pydantic v2
   - 定义 API 入参、出参、领域 DTO、工具输入输出 schema。
   - 不作为 ORM，不直接承担数据库关系映射。

4. Repository / Service 边界
   - API route 不直接堆复杂 SQLAlchemy 查询。
   - 复杂读写通过 repository 或 service 层封装。
   - Agent Runtime 和 Worker 通过 service/repository 访问数据库，不直接依赖 FastAPI request session。

5. Session 管理
   - FastAPI 请求使用 dependency 注入数据库 session。
   - Celery worker 中必须独立创建和关闭 session。
   - 每个 job handler 应明确事务边界，失败时 rollback。

6. JSON 字段
   - DirectorDNA、ProductionBible、AudioPack、ContinuityPack、PromptPack、Evaluation result 等可先用 PostgreSQL JSONB。
   - 高频查询字段后续再拆成独立列或索引。

7. 迁移和初始化
   - Docker 启动后通过 `alembic upgrade head` 初始化数据库。
   - 测试环境使用独立 test database。

### 6.1 核心基础表

新项目建议具备以下基础表或等价存储对象：

1. `agents`
2. `prompt_versions`
3. `agent_dnas`
4. `factory_dnas`
5. `conversations`
6. `messages`
7. `artifacts`
8. `resources`
9. `secrets`
10. `agent_memory`
11. `audit_logs`

### 6.2 新增表：video_projects

```text
video_projects
├── id
├── owner_id
├── agent_id
├── title
├── brief
├── source_text
├── target_type
├── target_duration
├── aspect_ratio
├── platform
├── status
├── current_director_dna_id
├── production_bible jsonb
├── created_at
├── updated_at
├── deleted_at
```

说明：

1. `agent_id` 绑定主 Video Production Agent / AI Director Agent。
2. `current_director_dna_id` 指向当前导演配置版本。
3. `source_text` 可保存短文本，长文本也可转为 artifact。

### 6.3 新增表：director_dnas

```text
director_dnas
├── id
├── project_id
├── agent_id
├── version
├── name
├── style
├── principles jsonb
├── visual_language jsonb
├── generation_policy jsonb
├── evaluation_policy jsonb
├── status
├── change_note
├── created_at
```

说明：

1. DirectorDNA 可以项目级，也可以 Agent 默认级。
2. MVP 先项目级，后续可沉淀为可复用导演风格。

### 6.4 新增表：director_boards

```text
director_boards
├── id
├── owner_id
├── name
├── category
├── description
├── applicable_scenes jsonb
├── principles jsonb
├── prompt_template
├── evaluation_criteria jsonb
├── source
├── version
├── status
├── created_at
├── updated_at
```

说明：

1. `source` 可为 builtin、factory-default、manual。
2. 导演板应版本化，避免覆盖式修改。

### 6.5 新增表：project_director_boards

```text
project_director_boards
├── project_id
├── director_board_id
├── enabled
├── reason
├── created_at
```

说明：表示某个项目启用了哪些导演板。

### 6.6 新增表：director_notes

```text
director_notes
├── id
├── project_id
├── segment_id nullable
├── agent_id
├── content
├── reasoning_summary
├── source_message_id
├── created_at
├── updated_at
```

说明：

1. 项目级导演手记和段落级导演手记使用同一张表。
2. `reasoning_summary` 存可展示的导演理由，不存隐藏推理链。

### 6.7 新增表：director_segments

```text
director_segments
├── id
├── project_id
├── order_index
├── title
├── duration_seconds
├── plot_purpose
├── emotion_curve jsonb
├── character_relation_change
├── audience_focus
├── visual_decision jsonb
├── audio_pack jsonb
├── continuity_pack jsonb
├── production_constraints jsonb
├── control_level
├── generation_mode
├── prompt_pack jsonb
├── status
├── evaluation_status
├── created_at
├── updated_at
```

`control_level`：

```text
loose | guided | strict | locked
```

`generation_mode`：

```text
text_to_video
image_to_video
first_last_frame
character_reference
scene_reference
style_reference
multi_image_reference
mixed_reference
```

### 6.8 新增表：segment_assets

```text
segment_assets
├── segment_id
├── artifact_id
├── role
├── created_at
```

`role` 示例：

```text
source_text
character_reference
scene_reference
style_reference
first_frame
last_frame
storyboard_draft
generated_video
evaluation_record
```

### 6.9 资产版本、血缘和用法

Reference Asset 必须支持版本、血缘和使用记录，否则无法保证“某个 Segment 使用了哪个版本的角色卡 / 场景卡 / Voice Card / 首帧”。

#### artifacts

```text
artifacts
├── id
├── project_id nullable
├── owner_id
├── current_version_id nullable
├── asset_type
├── asset_subtype
├── title
├── status
├── source
├── metadata jsonb
├── created_at
├── updated_at
├── deleted_at nullable
```

#### asset_versions

```text
asset_versions
├── id
├── artifact_id
├── version
├── file_url nullable
├── preview_url nullable
├── content_text nullable
├── structured_spec jsonb
├── prompt_snapshot jsonb
├── model_profile_id nullable
├── generation_job_id nullable
├── approval_status
├── created_by
├── created_at
```

`approval_status`：

```text
draft | suggested | approved | rejected | regenerating | locked
```

#### asset_lineage

```text
asset_lineage
├── id
├── source_artifact_id
├── source_version_id nullable
├── target_artifact_id
├── target_version_id nullable
├── relation_type
├── metadata jsonb
├── created_at
```

`relation_type` 示例：

```text
derived_from
generated_from
used_as_reference
regenerated_from
evaluated_by
exported_as
```

#### asset_usages

```text
asset_usages
├── id
├── artifact_id
├── asset_version_id
├── project_id
├── segment_id nullable
├── usage_role
├── used_by_job_id nullable
├── created_at
```

`usage_role` 示例：

```text
character_reference
scene_reference
voice_reference
performance_reference
first_frame
last_frame
style_reference
generated_output
evaluation_input
export_item
```

规则：

1. Segment 绑定资产时必须绑定到 `asset_version_id`，不能只绑定 artifact。
2. 新生成或重生成资产必须创建新版本，不覆盖旧版本。
3. 已被 Segment 使用的 approved / locked 版本不能被静默修改。
4. 删除资产默认软删除，保留 lineage 和 usages。

### 6.10 审批状态机

关键资产需要审批状态，避免错误角色卡、Voice Card、美术设定扩散到所有 Segment。

```text
approval_items
├── id
├── project_id
├── target_type
├── target_id
├── target_version_id nullable
├── status
├── reason nullable
├── requested_by
├── approved_by nullable
├── approved_at nullable
├── rejected_by nullable
├── rejected_at nullable
├── locked_by nullable
├── locked_at nullable
├── created_at
├── updated_at
```

```text
approval_events
├── id
├── approval_item_id
├── from_status nullable
├── to_status
├── actor_id
├── reason nullable
├── created_at
```

`target_type` 示例：

```text
production_bible
character_card
scene_card
voice_card
sound_design_card
performance_card
director_segment_plan
first_frame
generated_video
```

### 6.11 模型 Provider 与 Profile

模型配置必须是可管理对象，不能写死在环境变量里。

```text
model_providers
├── id
├── name
├── provider_type
├── base_url
├── auth_type
├── secret_ref
├── status
├── created_at
├── updated_at
```

```text
model_profiles
├── id
├── provider_id
├── display_name
├── model_id
├── modality
├── capabilities jsonb
├── cost_policy jsonb
├── rate_limit_policy jsonb
├── default_parameters jsonb
├── status
├── created_at
├── updated_at
```

```text
agent_model_bindings
├── agent_id
├── model_profile_id
├── role
├── enabled
├── created_at
```

```text
project_model_defaults
├── project_id
├── role
├── model_profile_id
├── created_at
├── updated_at
```

`role` 示例：

```text
text_reasoning
vision_understanding
image_generation
video_generation
tts
audio_understanding
evaluation
safety
embedding
rerank
```

### 6.12 导出任务与 Manifest

本产品不做最终剪辑合成，但必须能导出外部剪辑软件可继续使用的资产包。

MVP 边界：

1. P0 只要求生成基础 `manifest.json` 和最小资产目录结构。
2. P0 的 manifest 必须记录项目、Segment、资产版本、提示词、声音包、质检结果和血缘关系。
3. P0 不要求完成剪映、Premiere、达芬奇、CapCut 的完整兼容性验证。
4. 批量资产包导出、声音制作包导出、EDL/XML/JSON 项目描述导出属于 Phase 5。

```text
export_jobs
├── id
├── project_id
├── status
├── export_type
├── manifest_artifact_id nullable
├── output_url nullable
├── created_by
├── created_at
├── finished_at nullable
```

导出目录结构建议：

```text
export/
├── manifest.json
├── project.json
├── production_bible.json
├── segments/
│   ├── segment-001.json
│   └── segment-001.mp4
├── assets/
│   ├── characters/
│   ├── scenes/
│   ├── art_direction/
│   ├── voice_cards/
│   ├── sound_design/
│   └── prompts/
├── audio/
│   ├── dialogue.csv
│   ├── subtitles.srt
│   └── temp_voice/
├── evaluations/
└── lineage.json
```

`manifest.json` 必须记录：

```text
projectId
exportedAt
segments
artifacts
assetVersions
lineage
modelProfiles
promptSnapshots
evaluationResults
```

### 6.13 扩展 artifacts

建议增加或通过 metadata 承载：

```text
asset_subtype
project_id
segment_id
lineage
reference_tags
reuse_count
```

MVP 可先放在 `metadata`，稳定后再迁移为列。

`asset_subtype` 示例：

```text
character_card
npc_card
scene_card
art_direction_card
style_card
color_lighting_card
costume_card
prop_card
scene_detail_card
atmosphere_card
worldbuilding_card
symbol_pattern_card
architecture_style_card
vehicle_card
mechanical_card
vfx_concept_card
shot_reference_board
first_frame_card
last_frame_card
director_note
director_board
prompt_pack
generated_image
generated_video
voice_card
sound_design_card
music_mood_card
ambient_sound_card
dialogue_script
subtitle_file
temp_voice_audio
sound_effect_prompt
music_prompt
performance_card
emotion_map
continuity_sheet
time_space_context
relationship_arc
negative_style_rules
model_capability_profile
failure_memory
production_bible
genre_contract
audience_target
motif_system
frame_safety
subtitle_style
dialogue_executability
motion_plausibility
approval_gate
evaluation_rubric
evaluation_record
```

Asset Card metadata 建议：

```json
{
  "assetSubtype": "character_card",
  "priority": "P0",
  "sourceTextRefs": ["chapter-1"],
  "projectId": "uuid",
  "segmentIds": ["uuid"],
  "structuredSpec": {
    "name": "角色名 / 场景名 / 设定名",
    "description": "结构化设定摘要",
    "visualKeywords": ["关键词"],
    "colorPalette": ["#000000"],
    "lighting": "灯光设定",
    "style": "美术风格",
    "relationships": []
  },
  "generationMode": "text_to_image",
  "referenceAssetIds": [],
  "prompt": "用于图片模型生成的提示词",
  "imageModelProfileId": "uuid",
  "reuseCount": 0,
  "status": "confirmed"
}
```

说明：

1. 不同卡类型可以有不同 `structuredSpec` 字段。
2. MVP 可先统一存在 metadata，后续稳定后拆成更细的表。
3. Asset Card 的图像文件仍作为 artifact 文件存储，结构化设定作为 metadata 存储。

### 6.14 Director Visual Decision 结构

Director Visual Decision 是 Director Segment 的视觉判断结构，不等同于固定分镜，也不是用户必填项。它由 AI Director 根据剧情、情绪、角色、场景、美术设定和 Control Level 自动生成。

建议结构：

```json
{
  "shotSizeTendency": "景别倾向，例如从中景进入近景",
  "cameraMovementTendency": "镜头 / 运镜倾向，例如缓慢推近、固定镜头、跟拍",
  "compositionTendency": "构图倾向，例如前景遮挡、留白、对称、失衡",
  "lightingTendency": "光影倾向，例如低照度侧光、逆光、暖光",
  "colorTendency": "色彩倾向，例如冷灰偏蓝、低饱和、暖色回忆感",
  "rhythmTendency": "节奏倾向，例如克制、紧张、快速、缓慢",
  "controlLevel": "loose | guided | strict | locked",
  "directorReason": "这些视觉判断服务什么情绪和叙事目的"
}
```

规则：

1. 每个 Director Segment 必须有 `visual_decision`。
2. `visual_decision` 是倾向和导演理由，不是固定镜头清单。
3. 如果 `controlLevel=loose`，只给视觉方向，保留视频模型发挥空间。
4. 如果 `controlLevel=strict/locked`，可进一步生成首帧、尾帧、关键画面或分镜草稿。

### 6.15 Segment Audio Pack 结构

Segment Audio Pack 是 Director Segment 的声音与对白结构化数据。它不是最终混音工程，而是保证对白、字幕、角色声音、环境声和音乐情绪在多个 Segment 中保持一致的生产依据。

建议结构：

```json
{
  "dialogueLines": [
    {
      "speakerCharacterId": "uuid",
      "voiceCardAssetId": "uuid",
      "text": "台词文本",
      "emotion": "压抑 / 爆发 / 试探 / 冷静",
      "delivery": "语速、停顿、重音、气口说明",
      "subtitleText": "字幕文本",
      "syncHint": "与画面动作或情绪点的同步说明"
    }
  ],
  "narration": {
    "text": "旁白或内心独白",
    "voiceCardAssetId": "uuid",
    "delivery": "旁白语气"
  },
  "ambientSound": "环境声说明",
  "soundEffects": ["关键音效"],
  "musicMood": "音乐情绪、节奏和进入退出方式",
  "soundDesignCardAssetId": "uuid",
  "continuityRefs": {
    "previousSegmentAudioState": "上一段声音结束状态",
    "nextSegmentAudioIntent": "下一段声音进入意图"
  },
  "exportAssets": ["dialogue_script", "subtitle_file", "temp_voice_audio"]
}
```

Voice Card metadata 建议：

```json
{
  "assetSubtype": "voice_card",
  "characterId": "uuid",
  "voiceIdentity": {
    "ageImpression": "青年 / 中年 / 老年",
    "timbre": "清冷 / 沙哑 / 温和 / 厚重",
    "pitchRange": "偏低 / 中等 / 偏高",
    "speakingSpeed": "慢 / 中 / 快",
    "accent": "普通话 / 方言 / 轻微口音",
    "emotionalRange": ["克制", "爆发", "疲惫"],
    "catchphrases": [],
    "doNotChange": ["不要突然改变音色", "不要改变口音"]
  },
  "tts": {
    "provider": "optional",
    "voiceId": "optional",
    "referenceAudioAssetIds": []
  }
}
```

规则：

1. 主要角色必须有 Voice Card。
2. 同一角色跨 Segment 默认复用同一 Voice Card。
3. 每个 Director Segment 必须有 `audio_pack`，即使该段没有对白，也要说明环境声、音乐情绪或静默理由。
4. P0 只要求生成结构化声音设计、对白和字幕；最终配音、音乐、混音不在系统内完成。
5. P1 可生成临时 TTS、音效提示词和音乐提示词。

### 6.16 Director Continuity Pack 结构

Director Continuity Pack 用于保证多个 Director Segment 在叙事、情绪、表演、时空、风格和技术可执行性上连续。它不等同于分镜，也不是让用户填写复杂影视表单，而是 AI Director 在每个 Segment 上必须输出的结构化导演判断。

建议结构：

```json
{
  "narrativeFunction": "铺垫 / 转折 / 冲突升级 / 信息揭示 / 情绪释放 / 悬念保留",
  "emotionState": {
    "entry": "进入本段时的情绪状态",
    "peak": "本段情绪峰值",
    "exit": "离开本段时的情绪状态"
  },
  "performanceDirection": {
    "characterId": "uuid",
    "performanceCardAssetId": "uuid",
    "facialExpression": "表情方向",
    "eyeDirection": "眼神方向",
    "bodyLanguage": "身体状态和动作习惯",
    "deliveryRhythm": "说话节奏和停顿"
  },
  "blockingDecision": {
    "spatialRelation": "人物与人物、人物与空间的关系",
    "movement": "靠近、后退、停住、遮挡等调度",
    "powerRelation": "谁占据主动、谁被压制"
  },
  "timeSpaceContext": {
    "time": "时间",
    "location": "地点",
    "weather": "天气或环境状态",
    "relationToPrevious": "与上一段关系",
    "relationToNext": "与下一段关系"
  },
  "relationshipArc": "角色关系在本段中的变化",
  "visualMotivation": "为什么这样拍，以及视觉选择服务什么情绪和叙事目的",
  "audienceFocus": "观众此刻最应该看见、听见、理解什么",
  "negativeStyleRules": ["不要变成广告片质感", "不要过度动漫化"],
  "modelCapabilityNotes": {
    "risk": ["复杂多人互动可能不稳定"],
    "strategy": ["降低动作复杂度", "使用首尾帧约束"]
  },
  "continuityChecklist": {
    "costume": "服装状态",
    "props": "关键道具状态",
    "makeupOrInjury": "妆造 / 伤口状态",
    "lighting": "光线连续性",
    "sound": "声音连续性",
    "actionCarryOver": "上一段动作如何接续"
  },
  "failureMemoryRefs": ["uuid"]
}
```

Performance Card metadata 建议：

```json
{
  "assetSubtype": "performance_card",
  "characterId": "uuid",
  "actingProfile": {
    "defaultExpression": "默认表情气质",
    "eyeBehavior": "眼神习惯",
    "posture": "站姿 / 坐姿 / 行走方式",
    "gestureHabits": ["习惯性动作"],
    "emotionalExpression": {
      "suppressed": "压抑时如何演",
      "angry": "愤怒时如何演",
      "sad": "悲伤时如何演"
    },
    "doNotChange": ["不要突然变成夸张短剧表演"]
  }
}
```

规则：

1. 每个 Director Segment 必须有 `continuity_pack`。
2. P0 至少包含 narrativeFunction、emotionState、audienceFocus、continuityChecklist。
3. 主要角色必须有基础 Performance Card。
4. 生成失败必须记录 failureReason，并可进入 Failure Memory。
5. P1 增强 blockingDecision、relationshipArc、negativeStyleRules、modelCapabilityNotes。

### 6.17 Director Production Bible 结构

Director Production Bible 是 VideoProject 的项目级导演生产圣经。它决定整个项目像什么类型、给谁看、信息如何释放、关键意象如何复用、画面和字幕如何安全呈现、哪些生成风险需要规避、哪些环节需要人工确认。

建议结构：

```json
{
  "genreContract": {
    "genre": "短剧 / 漫剧 / 微电影 / 悬疑 / 爱情 / 古风 / 科幻",
    "audienceExpectation": "观众对该类型的默认期待",
    "pacingRules": "节奏规则",
    "performanceStyle": "表演强度",
    "visualRules": "视觉规则",
    "audioRules": "声音规则",
    "doNotBreak": ["不要破坏的类型规则"]
  },
  "audienceTarget": {
    "targetPlatform": "抖音 / 小红书 / B站 / YouTube / 私域",
    "targetViewer": "目标观众",
    "attentionSpan": "注意力长度",
    "emotionalHook": "情绪钩子",
    "acceptableComplexity": "观众可接受的信息复杂度",
    "viewingContext": "观看场景"
  },
  "informationDensity": {
    "mustShow": ["必须展示的信息"],
    "canImply": ["可以暗示的信息"],
    "shouldHide": ["暂时隐藏的信息"],
    "revealTiming": "揭示节奏",
    "overloadRisk": "信息过载风险"
  },
  "motifSystem": {
    "visualMotifs": ["视觉意象"],
    "soundMotifs": ["声音意象"],
    "propMotifs": ["道具意象"],
    "emotionalMeaning": "意象的情绪意义",
    "reuseRules": "复用规则"
  },
  "frameSafety": {
    "aspectRatio": "9:16 / 16:9 / 1:1",
    "safeArea": "安全边距",
    "subtitleArea": "字幕区域",
    "subjectPlacement": "主体位置",
    "cropRisk": "裁切风险"
  },
  "subtitleStyle": {
    "fontStyle": "字体气质",
    "position": "字幕位置",
    "rhythm": "出现节奏",
    "maxCharsPerLine": 16,
    "avoidCovering": ["不要遮挡人物脸部", "不要遮挡关键道具"]
  },
  "dialogueExecutability": {
    "lipSyncRisk": "口型风险",
    "dialogueLengthRule": "单句长度规则",
    "faceVisibilityStrategy": "正脸 / 侧脸 / 背影 / 反应镜头策略",
    "subtitleFallback": "字幕或旁白替代策略"
  },
  "motionPlausibility": {
    "actionComplexityRules": "动作复杂度规则",
    "bodyRisk": "身体动作风险",
    "handRisk": "手部风险",
    "objectInteractionRisk": "物体交互风险",
    "simplifyStrategy": "简化策略"
  },
  "approvalGates": [
    "approveArtDirection",
    "approveMainCharacters",
    "approveVoiceCards",
    "approveSegments",
    "approveFirstFrame",
    "approveGeneratedVideo"
  ],
  "evaluationRubric": {
    "storyClarity": "故事清晰度",
    "emotionContinuity": "情绪连续性",
    "characterConsistency": "角色一致性",
    "performanceConsistency": "表演一致性",
    "visualConsistency": "视觉一致性",
    "audioConsistency": "声音一致性",
    "motionPlausibility": "动作可信度",
    "genreFit": "类型匹配",
    "modelExecutionQuality": "模型执行质量"
  }
}
```

Segment `production_constraints` 建议：

```json
{
  "genreRulesApplied": ["本段应用的类型片规则"],
  "audienceFocusApplied": "本段服务的观众注意力策略",
  "informationDensity": "本段展示 / 暗示 / 隐藏的信息",
  "motifUsage": ["本段使用的关键意象"],
  "frameSafetyNotes": "画面安全区和裁切风险",
  "subtitleNotes": "字幕呈现规则",
  "dialogueExecutability": "口型风险与替代表现方式",
  "motionPlausibility": "动作可信度和简化策略",
  "approvalRequired": false
}
```

规则：

1. 每个 VideoProject 必须有 `production_bible`。
2. P0 至少包含 genreContract、audienceTarget、informationDensity、frameSafety、dialogueExecutability、evaluationRubric。
3. 每个 Director Segment 应从 `production_bible` 派生 `production_constraints`。
4. P1 增强 motifSystem、subtitleStyle、motionPlausibility、approvalGates。

### 6.18 新增表：director_evaluations

```text
director_evaluations
├── id
├── project_id
├── segment_id nullable
├── artifact_id nullable
├── agent_id
├── input_snapshot jsonb
├── result jsonb
├── verdict
├── suggestions jsonb
├── created_at
```

`verdict`：

```text
pass | needs_changes | blocked
```

## 7. AgentDNA、DirectorDNA 与 Prompt 编译

### 7.1 分层原则

Prompt 编译不意味着产品概念混为一谈。系统应保留结构化配置，再在 runtime 编译为模型可理解的 messages。

输入层：

```text
AgentDNA
DirectorDNA
Director Notes
Director Boards
VideoProject Context
Segment Context
Director Production Bible
Reference Assets
Voice Cards
Sound Design Cards
Performance Cards
Continuity Sheets
Tool Bindings
```

编译层：

```text
system message
user message
tool message
assistant message
```

### 7.2 System Prompt 结构

建议最终 system prompt：

```text
Identity:
你是当前 VideoProject 的 AI Director Agent...

Mission:
理解故事、判断情绪、组织参考素材、选择视听表达方式...

Director Principles:
1. 情绪优先
2. 镜头服务叙事
3. 不机械套用模板
4. 必要时才建议分镜
5. 保留 AI 视频模型创造空间

DirectorDNA:
...

Available Director Boards:
...

Project Context:
...

Current Segment:
...

Director Visual Decision:
...

Segment Audio Pack:
...

Director Continuity Pack:
...

Production Constraints:
...

Available Reference Assets:
...

Available Tools:
...

Output Contract:
先输出导演判断，再输出下一步动作和可保存资产。
```

### 7.3 输出结构建议

AI Director 默认输出应包含结构化块：

```json
{
  "directorJudgment": "这段戏的核心是...",
  "directorReason": "我建议这样拍，因为...",
  "directorVisualDecision": {
    "shotSizeTendency": "从中景逐渐进入近景",
    "cameraMovementTendency": "缓慢推近，避免频繁切换",
    "compositionTendency": "前景遮挡制造隔阂",
    "lightingTendency": "低照度侧光",
    "colorTendency": "冷灰偏蓝",
    "rhythmTendency": "克制、缓慢",
    "controlLevel": "guided",
    "directorReason": "这段核心是压迫感和情绪逼近"
  },
  "segmentAudioPack": {
    "dialogueLines": [
      {
        "speakerCharacterId": "uuid",
        "voiceCardAssetId": "uuid",
        "text": "台词文本",
        "emotion": "压抑",
        "delivery": "慢速，句尾停顿",
        "subtitleText": "字幕文本"
      }
    ],
    "ambientSound": "环境声方向",
    "musicMood": "音乐情绪",
    "soundDesignCardAssetId": "uuid",
    "continuityRefs": {}
  },
  "directorContinuityPack": {
    "narrativeFunction": "冲突升级",
    "emotionState": {
      "entry": "压抑",
      "peak": "爆发边缘",
      "exit": "悬而未决"
    },
    "audienceFocus": "观众应注意角色眼神和手中道具",
    "continuityChecklist": {
      "props": "道具仍在女主右手",
      "sound": "上一段雨声延续"
    }
  },
  "productionConstraints": {
    "genreRulesApplied": ["悬疑短片：信息延迟揭示"],
    "informationDensity": "本段只暗示冲突原因，不解释全部背景",
    "dialogueExecutability": "避免正脸长对白，使用侧脸和字幕承接",
    "motionPlausibility": "动作保持简单，避免复杂手部交互",
    "approvalRequired": false
  },
  "controlLevel": "guided",
  "recommendedBoards": ["二人对话戏导演板"],
  "referenceNeeds": ["女主角色卡", "女主 Voice Card", "女主 Performance Card", "室内夜景场景卡"],
  "nextActions": ["generate_character_card", "plan_segment"],
  "saveAs": ["director_note"]
}
```

UI 可用该结构渲染为卡片，并允许一键保存为资产。

## 8. Runtime 设计

### 8.1 Runtime 固定实现路线

Runtime 固定使用 Python LangGraph。AI Director 的生产流程按 state graph 组织，核心节点如下：

```text
load_project_context
load_production_bible
load_segment_context
compose_director_prompt
model_decision
execute_tools
enqueue_generation_job
wait_or_poll_job_result
save_assets
evaluate_result
persist_trace
```

实现要求：

1. LangGraph 负责 Agent 状态图、节点边界、checkpoint 和 interrupt/resume。
2. Celery Worker 负责耗时任务：图片、视频、TTS、质检、导出。
3. LangGraph 不直接长时间阻塞等待视频模型；它应提交 job，并通过 job 状态恢复后续节点。
4. 所有节点输入输出必须是结构化 schema，不允许只传大段字符串。
5. 每个节点必须写入 run_steps / job_events，供 UI Activity 展示。

### 8.2 Runtime 分支

Runtime 应按任务类型分支：

1. Director Chat
   - 输出导演判断、导演手记、Director Visual Decision、Segment Audio Pack、Director Continuity Pack、段落计划。

2. Asset Generation
   - 生成角色卡、NPC 卡、场景卡、美术设定卡、风格卡、道具卡、Voice Card、Sound Design Card、Performance Card、首尾帧参考卡等 Asset Card。

3. Video Generation
   - 文生视频、图生视频、首尾帧、多参考图。

4. Audio Planning
   - 生成对白、字幕、旁白、声音设计、临时 TTS、音效提示词和音乐提示词。

5. Continuity Planning
   - 生成叙事功能、情绪曲线、表演方向、场面调度、时空关系、风格禁区和连续性检查。

6. Production Bible Planning
   - 生成类型片规则、观众对象、信息密度、关键意象、画面安全区、字幕风格、对白可执行性、动作可信度和质检标准。

7. Evaluation
   - 对生成结果进行导演质检。

8. Project Evolution
   - 根据用户反馈、失败案例、已保存资产优化 DirectorDNA / AgentDNA。

## 9. Tool 设计

### 9.1 MVP 工具

建议第一阶段工具：

```text
read_asset
save_asset
list_project_assets
create_director_note
create_character_card
create_scene_card
create_style_card
create_asset_card
create_voice_card
create_sound_design_card
create_performance_card
create_continuity_pack
create_production_bible
derive_production_constraints
update_failure_memory
evaluate_continuity
evaluate_with_director_rubric
generate_card_image
generate_dialogue_script
generate_subtitles
generate_temp_voice
generate_sound_prompt
plan_segments
generate_image
generate_video
poll_video_task
evaluate_segment
```

Asset Card 相关工具应支持：

```text
create_asset_card
  从文本和导演判断中创建美术总设定卡、角色卡、场景卡、色彩光影卡、道具卡、Voice Card、Sound Design Card 等结构化资产，并标记 P0/P1/P2 优先级。

generate_card_image
  根据 Asset Card 的结构化设定调用图片模型生成卡图。

regenerate_card_image
  基于已有卡图或用户反馈重新生成。

create_voice_card
  为主要角色生成声音身份、音色、语速、口音、情绪范围、TTS voiceId 或参考音频绑定。

create_sound_design_card
  生成项目级声音设计规则，包括环境声、音乐情绪、音效密度、沉默使用方式和声音质感。

generate_dialogue_script
  为 Segment 生成对白、旁白、字幕和说话角色引用。

generate_temp_voice
  可选调用 TTS 生成临时配音参考，结果保存为 Reference Asset，不作为最终混音。

create_performance_card
  为主要角色生成表演设定，包括表情、眼神、动作习惯、姿态、情绪表达方式。

create_continuity_pack
  为 Segment 生成叙事功能、情绪状态、场面调度、时空关系、观众注意力和连续性检查。

create_production_bible
  为 VideoProject 生成类型片规则、观众对象、信息密度、关键意象、画面安全区、字幕风格、对白可执行性、动作可信度、人工确认点和质检标准。

derive_production_constraints
  从项目级 Production Bible 派生 Segment 级生成约束，例如口型风险、动作风险、字幕区域和信息密度。

evaluate_continuity
  检查角色、表演、场景、声音、道具、时间、风格是否跨 Segment 连续。

evaluate_with_director_rubric
  按 Production Bible 的 evaluationRubric 对 Segment 或资产进行导演维度质检。

update_failure_memory
  记录失败原因，例如角色变脸、表演不对、声音不一致、动作接不上、风格跑偏。
```

图片生成模式应支持：

```text
text_to_image
image_to_image
multi_reference_image
text_image_to_image
```

### 9.2 工具输入输出

工具必须有明确 schema，不能只靠 prompt 描述。

示例：

```json
{
  "name": "generate_video",
  "input": {
    "projectId": "uuid",
    "segmentId": "uuid",
    "mode": "image_to_video",
    "prompt": "string",
    "referenceAssetIds": ["uuid"],
    "modelProfileId": "uuid"
  },
  "output": {
    "artifactId": "uuid",
    "status": "saved",
    "fileUrl": "string"
  }
}
```

### 9.3 Tool 权限

1. Agent 只能调用 AgentDNA / Project 绑定的工具。
2. 生成视频等高成本工具需要明确状态和可取消机制。
3. 删除、覆盖、发布类动作需要确认。
4. 外部 MCP 工具后续引入 permission policy。

## 10. 模型能力与执行能力策略

### 10.1 模型能力层

系统不能只接入文本、图片和视频生成模型。为了让 AI Director 真正完成“理解、检索、生成、质检、一致性检测、安全审核、成本控制”的闭环，需要把模型能力分层设计。

P0 必须具备或预留：

1. Text Reasoning Model
   - 故事分析、导演判断、分段、Director Production Bible、Director Continuity Pack、提示词生成、基础质检。

2. Multimodal Understanding Model
   - 理解图片资产、角色卡、场景卡、生成结果截图；用于基础视觉质检。

3. Image Generation / Edit Model
   - 角色卡、场景卡、美术设定卡、首帧/尾帧、多参考图、图生图。

4. Video Generation Model
   - Director Segment 视频生成。

5. Audio / TTS Model
   - Voice Card、临时配音、旁白、声音参考。P0 可先预留接口，P1 接入实际生成。

6. Video QA / Multimodal Evaluation Model
   - 生成视频后的角色、场景、情绪、动作、画面安全区和类型匹配质检。

7. Prompt Compiler / Prompt Optimizer Model
   - 把导演判断转换为不同模型可执行的 prompt：图片 prompt、视频 prompt、TTS prompt、质检 rubric。

8. Safety / Moderation Model
   - 输入文本、提示词、生成图片、生成视频、生成音频和导出前审核。

P1 建议增强：

1. Embedding Model
   - 用于在项目资产库中检索角色卡、场景卡、风格卡、Voice Card、失败案例、导演板。

2. Rerank Model
   - 对检索出的资产、导演板、失败案例进行重排，选择当前 Segment 最相关的引用。

3. OCR / Document Parsing Model
   - 支持 PDF、扫描件、截图、图片文字、剧本文档输入。

4. Visual Consistency Model
   - 检测角色脸、服装、场景、美术风格、光影色彩是否一致。

5. Voice Consistency Model
   - 检测同一角色音色、语速、口音、情绪表达是否符合 Voice Card。

6. Music / SFX Generation Model
   - 生成音乐、环境声、音效参考，或生成可交给外部工具的音频提示词。

P2 可扩展：

1. Voice Clone Model
   - 在用户拥有授权音频时生成一致角色声音。

2. Face / Character Identity Model
   - 更强的人脸、角色身份一致性检测。

3. Advanced Video Understanding Model
   - 分析动作连续性、镜头运动、口型同步、复杂多人互动。

### 10.2 工程执行层

模型能力必须配套工程执行能力，否则系统会停留在“会分析但跑不起来”的状态。

P0 必须实现：

1. Model Gateway
   - 统一封装文本、图片、视频、多模态、TTS、评估、安全审核模型。
   - 业务代码不能直接调用具体模型供应商 API。

2. Prompt Compiler
   - 将 DirectorDNA、Production Bible、Continuity Pack、Audio Pack、Reference Assets 编译成不同模型的可执行 prompt。
   - 不同模型需要不同 prompt 模板和参数。

3. Model Router
   - 根据任务类型、模态、成本、速度、质量、失败重试策略选择模型。

4. Async Job Queue
   - 图片、视频、TTS、质检等任务必须支持提交、轮询、取消、超时、失败重试。

5. Asset Versioning
   - 角色卡、场景卡、Voice Card、Production Bible、Director Segment、生成结果都必须有版本。
   - Segment 必须记录使用了哪个资产版本。

6. Approval State Machine
   - 关键资产需要状态：draft、suggested、approved、rejected、regenerating、locked。
   - 未确认的核心资产不应大规模扩散生成。

7. Trace / Event Log
   - 记录模型调用、工具调用、任务状态、失败原因、重试、保存资产、质检结果。

8. Export Manifest
   - 导出资产包时必须生成 JSON manifest，记录资产、版本、来源、Segment 引用、提示词、质检结果。

P1 建议增强：

1. Asset Lineage Graph
   - 记录资产从哪里来、被哪些 Segment 使用、由哪些模型生成、经历过哪些版本。

2. Cost / Budget Controller
   - 记录 token、图片、视频、TTS、质检任务成本；支持预算上限和高成本确认。

3. Search Index
   - 用 embedding / metadata / tags 建立项目资产检索索引。

4. Retry / Fallback Strategy
   - 生成失败时可自动降级模型、切换生成方式、降低动作复杂度或改用首尾帧策略。

5. Safety Audit Log
   - 记录安全审核输入、结论、阻断原因和人工处理结果。

### 10.3 Async Job Queue 管理方案

图片、视频、TTS、视频质检、资产导出都不应在 HTTP 请求中同步完成。系统必须把长任务交给异步队列和 Worker，并通过任务状态、事件日志和资产血缘把结果写回项目。

#### 10.3.1 队列类型

建议按任务类型拆队列，避免视频长任务阻塞轻量任务：

```text
queue:analysis
  故事分析、Production Bible、Segment Plan、Continuity Pack

queue:image
  角色卡、场景卡、美术卡、首帧/尾帧、图生图、多参考图

queue:video
  文生视频、图生视频、首尾帧视频、多参考视频

queue:audio
  TTS、临时配音、声音参考、音效/音乐提示词

queue:evaluation
  图片质检、视频质检、声音一致性质检、导演质检

queue:export
  资产包、字幕、对白、manifest、质检报告导出

queue:safety
  输入、提示词、生成结果、导出前安全审核
```

#### 10.3.2 任务状态机

所有异步任务必须有统一状态：

```text
queued
running
waiting_provider
polling
requires_approval
succeeded
failed
cancelled
timeout
retrying
```

说明：

1. `queued`：任务已入队。
2. `running`：Worker 正在执行本地逻辑。
3. `waiting_provider`：已提交外部模型供应商任务。
4. `polling`：正在轮询外部任务结果。
5. `requires_approval`：需要用户确认后继续。
6. `retrying`：失败后准备按策略重试。

#### 10.3.3 建议数据结构

```text
generation_jobs
├── id
├── project_id
├── segment_id nullable
├── asset_id nullable
├── job_type
├── queue_name
├── status
├── provider
├── model_profile_id
├── provider_task_id nullable
├── input_snapshot jsonb
├── output_snapshot jsonb
├── error_code nullable
├── error_message nullable
├── retry_count
├── max_retries
├── idempotency_key
├── cost_snapshot jsonb
├── created_by
├── created_at
├── started_at nullable
├── finished_at nullable
├── cancelled_at nullable
```

```text
job_events
├── id
├── job_id
├── event_type
├── message
├── payload jsonb
├── created_at
```

`job_events` 用于 UI Activity / Trace 展示，不展示隐藏推理，只展示可审计动作。

#### 10.3.4 前端如何感知生成结果

图片、视频、TTS、质检等任务都必须采用“立即返回 jobId + SSE 推送进度 + 状态 API 兜底查询”的模式，不能让前端等待长 HTTP 请求。

标准链路：

```text
1. 前端点击生成图片 / 视频 / 音频
2. API 创建 generation_job
3. API 立即返回 jobId
4. Celery worker 执行任务
5. worker 更新 generation_jobs.status
6. worker 写入 job_events
7. API 通过 SSE 推送 job.updated / activity.progress
8. 任务成功后保存 artifact
9. SSE 推送 asset.saved
10. 前端刷新 Asset Panel / Segment Detail / ChatArea
```

必须提供的 API：

```text
POST /api/generation-jobs
  创建异步生成任务，立即返回 jobId。

GET /api/generation-jobs/{jobId}
  查询任务当前状态，用于页面刷新、SSE 断线后的兜底查询。

POST /api/generation-jobs/{jobId}/cancel
  取消任务。

POST /api/generation-jobs/{jobId}/retry
  基于原 input_snapshot 重试任务。

GET /api/events?projectId=...
  SSE 订阅项目事件，包括 job.updated、activity.progress、asset.saved。
```

SSE 事件示例：

```json
{
  "event": "job.updated",
  "data": {
    "jobId": "uuid",
    "projectId": "uuid",
    "segmentId": "uuid",
    "jobType": "generate_video",
    "status": "polling",
    "progress": 45,
    "message": "正在轮询视频生成结果"
  }
}
```

成功事件示例：

```json
{
  "event": "asset.saved",
  "data": {
    "jobId": "uuid",
    "artifactId": "uuid",
    "assetSubtype": "generated_video",
    "url": "signed-url-or-api-url"
  }
}
```

前端展示要求：

1. ChatArea
   - 创建任务后显示“正在生成...”的任务卡。
   - 收到 `job.updated` 更新状态和进度。
   - 收到 `asset.saved` 后替换为生成结果卡片。

2. Right Panel / Director Monitor
   - 展示项目内所有 active jobs。
   - 支持查看失败原因、取消、重试。

3. Asset Library
   - 收到 `asset.saved` 后自动刷新资产列表。

4. Segment Detail
   - Segment 绑定的生成任务成功后，更新 segment status 和 artifact 引用。

兜底策略：

1. SSE 断开后前端自动重连。
2. 重连后使用 `lastEventId` 或 `updatedAt` 拉取遗漏事件。
3. 页面刷新时调用 `GET /api/generation-jobs/{jobId}` 恢复任务状态。
4. 如果 SSE 不可用，前端可以临时轮询 job status，但默认仍以 SSE 为主。

#### 10.3.5 幂等与重试

必须支持：

1. `idempotency_key`
   - 防止用户重复点击或 Worker 重启导致重复扣费生成。

2. `provider_task_id`
   - 外部视频模型通常是提交任务后返回 taskId，后续轮询。

3. 重试策略
   - 网络错误：可自动重试。
   - 供应商限流：延迟重试。
   - 内容安全失败：不自动重试，进入 blocked。
   - 生成质量失败：可根据 Evaluation 建议生成新任务。

4. 取消策略
   - 本地 queued/running 可取消。
   - 已提交供应商任务时，如果供应商支持取消则调用取消；不支持则标记本地 cancelled，并忽略回调结果。

5. 超时策略
   - 每种任务有独立 timeout。
   - 视频任务 timeout 应明显长于图片和文本任务。

#### 10.3.6 Worker 分工

```text
analysis-worker
  文本分析、导演判断、规划、prompt 编译

image-worker
  图片生成、图片编辑、卡图生成、缩略图

video-worker
  视频提交、轮询、下载、保存、失败重试

audio-worker
  TTS、临时配音、声音参考

evaluation-worker
  多模态质检、视频 QA、声音一致性、导演 rubric

export-worker
  资产包、manifest、字幕、对白、质检报告
```

MVP 可以物理上只有一个 worker 进程，但代码层面必须按 job type 分 handler。

#### 10.3.7 队列技术选型

本开发基准版固定使用：

```text
Redis + Celery
```

理由：

1. Celery 成熟度高、资料多、团队更容易维护。
2. Redis 生态成熟，便于本地 Docker Compose 和生产部署。
3. 图片、视频、TTS、评估、导出等长耗时任务都能通过 Celery task 承接。
4. 支持任务路由、重试、超时、任务状态、定时清理和多 worker 扩展。
5. Dramatiq / RQ / BullMQ / Temporal 不作为 MVP 默认实现。

后续备注：

1. Temporal
   - 适合复杂长流程、跨天恢复、强 Saga 和大量人工确认，但不进入第一版默认实现。

2. LangGraph checkpoint + Queue
   - LangGraph 负责 Agent 状态图和 checkpoint。
   - Queue 负责耗时任务执行和供应商轮询。
   - 两者不冲突：LangGraph 不应替代所有后台任务系统。

#### 10.3.8 Python 还是 Node.js

固定结论：

```text
前端：React / TypeScript / Vite。
API 层：Python FastAPI。
AI Runtime：Python + LangGraph。
Worker：Python + Celery + Redis。
```

原因：

1. Python 更适合 AI Runtime
   - LangGraph / LangChain Python 生态更完整。
   - 多模态处理、视频/音频处理、CV、embedding、文件解析、评估工具更丰富。

2. Node.js 更适合前端和轻量 BFF
   - React / Vite / TypeScript UI 开发效率高。
   - 但本开发基准版不采用 Node 后端和 BullMQ。

3. 本产品更像 AI 生产管线，不只是聊天应用
   - 涉及图片、视频、音频、文件解析、异步 worker、评估和资产处理。
   - Python 作为 runtime/worker 主语言更稳。

默认技术组合：

```text
Studio UI: React / TypeScript / Vite
API Service: FastAPI / Python
Agent Runtime: Python + LangGraph
Worker: Python + Celery + Redis
Database: PostgreSQL
Object Storage: S3-compatible / MinIO
Trace Store: PostgreSQL 起步，后续可拆
```

关键原则：本开发基准版按 Python FastAPI + LangGraph + Celery 执行，不要让 UI、API、Agent Runtime、Worker 混成一个进程；任务队列和任务状态必须是一等对象。

### 10.4 Docker 与本地开发环境

本项目默认使用 Docker / Docker Compose 管理本地开发环境。Claude Code 初始化项目时必须生成 Docker 相关文件，不允许只提供裸机启动说明。

#### 10.4.1 Compose 服务

`docker-compose.yml` 至少包含：

```text
studio
  React / Vite 前端开发服务

api
  FastAPI HTTP API + SSE

runtime
  LangGraph runtime 服务

worker
  Celery worker

postgres
  PostgreSQL 数据库

redis
  Celery broker / result backend / cache

minio
  S3-compatible object storage

minio-init
  初始化 bucket、policy、开发访问配置
```

MVP 可将 `api` 和 `runtime` 合并为一个 Python 服务，但目录和模块边界仍必须分开；`worker` 必须独立进程。

#### 10.4.2 必需 Docker 文件

新项目必须包含：

```text
Dockerfile.api
Dockerfile.worker
Dockerfile.studio
docker-compose.yml
.env.example
.dockerignore
```

如采用单个 Python 镜像，也可以使用：

```text
services/api/Dockerfile
services/worker/Dockerfile
apps/studio/Dockerfile
```

#### 10.4.3 环境变量

`.env.example` 至少包含：

```text
DATABASE_URL=postgresql+psycopg://agentos:agentos@postgres:5432/agentos
REDIS_URL=redis://redis:6379/0
S3_ENDPOINT=http://minio:9000
S3_ACCESS_KEY=agentos
S3_SECRET_KEY=agentos-secret
S3_BUCKET=agentos-assets
MODEL_GATEWAY_DEFAULT_PROVIDER=openai_compatible
OPENAI_COMPATIBLE_BASE_URL=
OPENAI_COMPATIBLE_API_KEY=
OPENAI_COMPATIBLE_TEXT_MODEL=
OPENAI_COMPATIBLE_VISION_MODEL=
VIDEO_PROVIDER=
VIDEO_PROVIDER_API_KEY=
TTS_PROVIDER=
TTS_PROVIDER_API_KEY=
APP_ENV=development
```

真实密钥不得写入仓库。

#### 10.4.4 默认启动命令

README 必须提供以下命令：

```bash
docker compose up --build
```

以及常用开发命令：

```bash
docker compose logs -f api
docker compose logs -f worker
docker compose exec api alembic upgrade head
docker compose exec api pytest
docker compose exec studio pnpm test
```

#### 10.4.5 数据卷与持久化

Compose 必须定义：

```text
postgres_data
redis_data
minio_data
```

本地生成文件不直接散落到项目根目录；所有资产通过 MinIO / S3 接口保存。

#### 10.4.6 MinIO 生产部署

生产环境可以继续使用 MinIO，不要求必须购买云厂商对象存储。MinIO 是 S3-compatible object storage，适合作为本项目的资产存储后端。

生产使用 MinIO 时必须满足：

1. 独立持久化磁盘
   - 不要把 MinIO 数据放在容器临时层。
   - 必须挂载独立 volume 或服务器数据盘。

2. 定期备份
   - 至少备份 MinIO bucket 和 PostgreSQL。
   - 资产文件和数据库 metadata 必须同时备份，否则血缘会断。

3. 访问控制
   - 不要使用开发环境默认账号密码。
   - 使用强密码和最小权限 access key。
   - bucket 默认私有，通过后端签名 URL 访问。

4. HTTPS / 反向代理
   - 生产环境必须通过 HTTPS 暴露 API 和资产访问。
   - MinIO Console 不应直接暴露到公网，除非加访问控制。

5. 容量和清理策略
   - 图片、视频、临时音频会快速增长。
   - 需要记录资产引用、临时文件、失败生成结果，并提供清理策略。

6. 可迁移性
   - 应通过 S3 adapter 访问 MinIO。
   - 未来如果迁移到阿里云 OSS、腾讯 COS、AWS S3，不应影响业务代码。

部署建议：

```text
MVP / 小团队生产：
  单机 Docker Compose + MinIO volume + 定期备份

中期生产：
  独立 MinIO 服务 + 独立数据盘 + 备份任务 + HTTPS

更高可用：
  MinIO 分布式部署或迁移到云厂商对象存储
```

#### 10.4.7 健康检查

至少提供：

```text
GET /healthz
GET /readyz
```

`/readyz` 需要检查 PostgreSQL、Redis、MinIO 是否可用。

### 10.5 per-Agent / per-Project 模型列表

推荐设计：

1. Resource Center 管理全局 provider 和 credentials。
2. AgentDNA 保存当前 Agent 可用模型列表。
3. 会话中只能切换当前 Agent 配置模型。
4. VideoProject 可在 Agent 模型列表基础上指定项目默认模型。

### 10.6 生成方式路由

根据 `generation_mode` 选择模型和 API：

```text
text_to_video -> video model
image_to_video -> video model + image reference
first_last_frame -> video model + first/last frame
multi_image_reference -> video model + multiple references
character_reference -> video model + character card/images
style_reference -> video/image model + style assets
dialogue_generation -> text model + Voice Card
temp_voice -> TTS model + Voice Card
sound_prompt -> text model + Sound Design Card
asset_search -> embedding model + rerank model
visual_consistency_check -> multimodal / visual consistency model
voice_consistency_check -> audio understanding / voice consistency model
video_quality_check -> video QA / multimodal evaluation model
prompt_compile -> prompt compiler model
safety_check -> safety / moderation model
```

## 11. 前端架构

### 11.0 实时输出与打字机效果

Agent 对话必须支持流式输出和打字机效果。默认实现使用 Server-Sent Events，而不是 WebSocket。

选择 SSE 的原因：

1. Agent 回复、Activity、任务进度大多数是服务端到客户端的单向推送。
2. SSE 实现简单，天然适合 HTTP、反向代理、鉴权和断线重连。
3. 打字机效果只需要服务端逐步推送 token / delta / activity event，前端按事件追加渲染。
4. WebSocket 更适合强双向实时协作、多人在线编辑、低延迟控制通道；MVP 不需要默认引入。

WebSocket 后置条件：

1. 多人同时编辑同一个 VideoProject。
2. 实时画布协作或拖拽同步。
3. 用户和 Agent 之间存在高频双向控制通道。
4. 浏览器需要主动推送连续控制事件给后端。

没有这些需求时，不引入 WebSocket。

默认事件类型：

```text
message.delta       文本增量，用于打字机效果
message.completed   单条回复完成
activity.started    工具/任务开始
activity.progress   工具/任务进度
activity.completed  工具/任务完成
job.updated         异步任务状态变化
asset.saved         资产保存完成
error               错误事件
```

前端实现要求：

1. ChatArea 使用 SSE 连接接收增量。
2. 同一条 assistant message 按 `messageId` 聚合 delta。
3. 断线后可根据 conversationId / lastEventId 恢复。
4. Activity 面板从 `job_events` / `run_steps` 读取可审计过程。
5. 不展示隐藏推理链，只展示可审计动作、工具摘要、任务状态和导演理由。

### 11.1 页面结构

新增页面建议：

```text
/projects
/projects/[id]
/projects/[id]/segments/[segmentId]
/director-boards
/director-boards/[id]
/assets
/agents/[id]
/factory
/factory/settings
```

### 11.2 主要组件

```text
ProjectSidebar
DirectorWorkspace
DirectorChatArea
DirectorActivityPanel
SegmentList
SegmentDetail
ReferenceAssetPanel
DirectorBoardPicker
ControlLevelBadge
GenerationModeSelector
ModelProfileSwitcher
DirectorEvaluationPanel
```

### 11.3 三栏布局

推荐三栏工作台：

```text
左侧：项目 / Agent / 段落 / 资产 / 导演板导航
中间：AI Director 工作流
右侧：导演监控 / 参考资产 / 生成任务 / 质检
```

### 11.4 状态管理

继续使用本地持久化 UI 状态：

```text
currentProjectId
currentAgentId
currentSegmentId
sidebarCollapsed
rightPanelOpen
rightPanelWidth
assetView
segmentView
```

## 12. API 设计

### 12.1 Application API

必须提供以下业务 API 模块：

```text
Project API
  projects CRUD
  production_bible get/update/generate

Director Board API
  director_boards CRUD
  project director board bindings

Director Segment API
  segments CRUD
  plan_segments
  update visual/audio/continuity/production constraints

Director Evaluation API
  create evaluation
  list segment evaluations
  approve / reject evaluation suggestion

Asset API
  artifacts CRUD
  asset_versions CRUD
  asset_usages list
  asset_lineage graph
  upload / preview / signed URL

Approval API
  approval_items list
  approve
  reject
  lock
  request_regeneration

Job API
  create generation job
  get job status
  cancel job
  retry job
  list project jobs

Export API
  create export job
  get export status
  download manifest / asset package

Model Provider API
  model_providers CRUD
  model_profiles CRUD
  agent_model_bindings
  project_model_defaults

Safety API
  check input
  check prompt
  check generated asset
  list safety audit logs
```

同时需要基础 API 模块：

```text
Agent API
Factory API
Conversation API
User / Session API
```

### 12.2 Runtime HTTP Routes

新增或扩展：

```text
POST /director/chat
POST /director/plan-segments
POST /director/generate-asset
POST /director/generate-segment
POST /director/evaluate
POST /director/evolve
```

如果采用单一 chat endpoint，也必须通过 project / segment / task type 明确分流；为了边界清晰，更建议新增 director routes。

## 13. Trace 与 Observability

### 13.1 可展示过程

UI 展示：

```text
分析故事
判断情绪
选择导演板
查找参考素材
生成角色卡
生成视频片段
保存资产
质检镜头
```

### 13.2 不展示隐藏推理

不展示模型内部思维链，只展示：

1. 可审计动作。
2. 工具调用摘要。
3. 输入输出摘要。
4. 导演理由。
5. 错误和建议。

### 13.3 Trace 数据

MVP 可继续存入 messages.toolCalls / artifact metadata。

后续建议新增：

```text
agent_runs
run_steps
tool_calls
model_calls
```

## 14. 安全与权限

1. Secret 继续使用 secrets 表加密保存。
2. AgentDNA 不保存明文密钥。
3. Agent 只能调用绑定工具和模型。
4. 高成本生成任务需要明确确认和状态展示。
5. 删除项目不物理删除资产，只断开项目关系或标记归档。
6. 外部 MCP / HTTP tool 需要权限等级和审计。
7. 用户上传文件需要类型和大小限制。

## 15. 分阶段实施计划

### 15.0 可执行技术验收清单

Claude Code 实现本项目时，每个阶段必须提供可运行的验证命令和测试结果。不能只完成页面或接口文件，而不证明数据、任务、资产和实时事件可以闭环。

基础命令：

```bash
docker compose up --build
docker compose exec api alembic upgrade head
docker compose exec api pytest
docker compose exec studio pnpm test
docker compose exec studio pnpm build
```

后端测试必须覆盖：

1. SQLAlchemy model、Pydantic schema、Alembic migration 三者字段一致。
2. VideoProject CRUD、ProductionBible 生成和更新。
3. DirectorSegment CRUD、plan_segments、visualDecision / audioPack / continuityPack 更新。
4. ReferenceAsset 创建、上传、预览、签名 URL、版本创建、软删除。
5. asset_versions、asset_lineage、asset_usages 的写入和查询。
6. approval_items 和 approval_events 的 approve / reject / lock / request_regeneration 状态流转。
7. model_providers、model_profiles、agent_model_bindings、project_model_defaults 的配置读取。
8. generation_jobs 和 job_events 的 queued / running / succeeded / failed / retrying / cancelled 状态流转。
9. Celery worker 能执行 image / video / audio / evaluation / export 至少一种 mock job。
10. MinIO 能上传文件、读取文件、生成 signed URL。
11. Export job 能生成 manifest.json 和基础资产目录结构。
12. Safety / Moderation API 能记录输入审核、prompt 审核、生成资产审核日志。

Runtime 测试必须覆盖：

1. AI Director Runtime 能完成一次 tool loop：模型决策 -> tool call -> tool result -> 最终输出。
2. Prompt Compiler 能分别生成 text、image、video、tts、evaluation、safety prompt。
3. Model Router 能按 task_type、modality、project default、agent binding 选择模型。
4. Async Job Queue 对耗时生成任务立即返回 jobId，不阻塞 HTTP 请求。
5. provider polling、timeout、retry、cancel、idempotency key 能工作。
6. 失败任务能写入 failure_reason，并可被 Director Evaluation 或失败记忆引用。

前端测试必须覆盖：

1. Studio 可以创建 VideoProject 并进入三栏工作台。
2. ChatArea 能显示打字机效果和 Activity / Trace。
3. SSE 能接收 `message.delta`、`job.updated`、`activity.progress`、`asset.saved`。
4. SSE 断线后能自动重连；刷新页面后可通过 Job API 恢复任务状态。
5. Reference Asset Panel 能展示资产、版本、审批状态、来源血缘和被哪些 Segment 使用。
6. Segment Detail 能展示 visualDecision、audioPack、continuityPack、productionConstraints。
7. Model Switcher 只显示当前 Agent / Project 可用模型。
8. Export 页面能展示 manifest、资产包状态和下载入口。

端到端验收必须覆盖：

1. 输入一段小说或短文。
2. 生成 Director Production Bible。
3. 生成至少 3 个 Director Segment。
4. 每个 Segment 生成 visualDecision、audioPack、continuityPack、productionConstraints。
5. 生成至少两类 Asset Card，例如角色卡和场景卡。
6. 生成或 mock 生成至少一个 Segment 视频。
7. 保存生成结果为 ReferenceAsset，并创建 asset_version。
8. 用户确认一个关键资产，系统写入 approval_events。
9. 同一角色卡被两个 Segment 引用，asset_usages 可查询。
10. 导出资产包，manifest 中包含项目、Segment、资产版本、提示词、声音包、质检结果和血缘。

### Phase 1：Director MVP

目标：跑通从文本到导演判断、段落计划、生成资产的闭环。

实施项：

1. 新增 VideoProject 表和基础 router。
2. 扩展 Artifact metadata 支持 asset_subtype、projectId、segmentId。
3. 新增 DirectorDNA 配置结构。
4. 新增 Director Notes。
5. 新增 Director Segments。
6. 新增项目工作台页面。
7. 新增 Director Chat runtime。
8. 新增 Segment Audio Pack、基础 Voice Card、Sound Design Card 和字幕文本。
9. 新增 Director Continuity Pack、基础 Performance Card、基础连续性检查。
10. 新增 Director Production Bible 基础版。
11. 新增 Model Gateway、Prompt Compiler、Model Router、Async Job Queue。
12. 新增 Asset Versioning、Approval State、Trace/Event Log、Export Manifest。
13. 新增基础工具：read_asset、save_asset、plan_segments、generate_image、generate_video、generate_dialogue_script、generate_subtitles、create_continuity_pack、create_production_bible、derive_production_constraints、evaluate_segment。
14. 接入基础 Director Evaluation 和 Safety / Moderation。

验收：

1. 输入文本后能生成导演判断。
2. 能生成至少 3 个 Director Segment，并为每段给出建议时长。
3. 每段有 visualDecision、audioPack、continuityPack、controlLevel 和 generationMode。
4. 项目有 productionBible，每段有 productionConstraints。
5. 能引用素材生成图片或视频。
6. 生成结果、声音设定、表演设定、对白和字幕能保存为资产。
7. 生成任务可异步执行、可查看状态、可失败重试。
8. 关键资产有版本和审批状态。

技术验收：

1. 所有 P0 领域对象有数据库 schema、API schema 和基础 CRUD。
2. AI Director Runtime 能完成一次完整 tool loop。
3. 视频生成任务使用异步 job 执行，不阻塞主请求。
4. 生成过程有可展示 Activity / Trace。
5. Reference Asset 有来源血缘：project、segment、message、generation task。
6. Model Gateway 至少接入一个文本模型、一个图片模型、一个视频模型。
7. Prompt Compiler 能分别生成文本、图片、视频、TTS、评估、安全审核所需 prompt。
8. Async Job Queue 能提交、轮询、失败重试图片/视频/评估任务。
9. 每个 Director Segment 必须生成 Director Visual Decision，但具体强弱控制由 controlLevel 决定。
10. 每个 Director Segment 必须生成 Segment Audio Pack；主要角色必须有可复用 Voice Card。
11. 每个 Director Segment 必须生成 Director Continuity Pack；主要角色必须有基础 Performance Card。
12. 每个 VideoProject 必须生成 Director Production Bible；每个 Segment 必须派生 productionConstraints。
13. 关键 API 有基础测试或集成验证。
14. 所有 P0 表必须有 SQLAlchemy model、Pydantic schema 和 Alembic migration。

### Phase 2：资产与一致性

目标：让参考资产真正复用。

实施项：

1. 角色卡、场景卡、风格卡结构化。
2. Reference Asset Library 强化。
3. 资产血缘和引用次数。
4. 段落与资产绑定。
5. 角色一致性、风格一致性和声音一致性质检。
6. 表演一致性、时空连续性、道具连续性和风格禁区检查。
7. 关键意象系统、字幕风格、动作可信度、人工确认点。
8. 临时 TTS、音效提示词、音乐提示词。
9. Embedding / Rerank 资产检索。
10. Visual / Voice Consistency 检测。
11. Cost / Budget Controller。

### Phase 3：导演板与进化

目标：沉淀导演方法。

实施项：

1. Director Board Library。
2. 内置导演板。
3. 自定义导演板。
4. 从成功案例生成导演板建议。
5. 从失败案例生成反例。
6. DirectorDNA evolve。

### Phase 4：专业子 Agent

目标：把高价值环节 Agent 化。

候选：

1. Story Analysis Agent。
2. Character Bible Agent。
3. Visual Style Agent。
4. Storyboard Draft Agent。
5. Video QA Agent。

### Phase 5：资产包导出与外部剪辑协作

目标：不内置剪辑合成能力，而是提供专业剪辑软件可继续使用的资产包。

实施项：

1. Segment 视频批量导出。
2. Reference Asset 批量导出。
3. 导演手记、Director Visual Decision、Segment Audio Pack、提示词包导出。
4. 资产目录结构和 metadata manifest。
5. 对白、字幕、Voice Card、Sound Design Card、临时音频、音效/音乐提示词导出。
6. 可选 EDL/XML/JSON 项目描述导出。
7. 外部剪辑软件兼容性验证。

## 16. 关键技术决策

1. 保留 AgentOS 领域语义，但本开发基准版固定使用 React / TypeScript / Vite + Python FastAPI + LangGraph + Celery + PostgreSQL + Redis + MinIO。
2. AgentDNA / FactoryDNA 继续作为核心配置快照概念。
3. 新增 DirectorDNA，但不替代 AgentDNA；DirectorDNA 是视频导演领域的专用扩展。
4. VideoProject 是视频生产的一等对象。
5. Reference Asset 是资产中心，不只是附件。
6. Runtime 固定使用 Python LangGraph；LangChain 仅作为模型调用和 tool 封装辅助库。AgentScope、OpenAI Agents SDK、CrewAI、AutoGen 仅作为后续参考，不进入 MVP 默认实现。
7. 多 Agent 放到后续阶段，MVP 先做一个强 AI Director Agent + skills/tools/workflow steps。
8. 分镜不是默认最高层对象，Director Segment 和 Director Notes 更重要。
9. 右侧面板是导演资产和生产监控，不是普通文件栏。
10. 所有生成结果都要可追溯、可保存、可复用。
11. 不内置最终剪辑合成能力；系统产出 Reference Asset、Director Segment 视频和外部剪辑软件友好的资产包。
12. 不内置最终混音能力；系统产出 Voice Card、Sound Design Card、Segment Audio Pack、对白、字幕和临时声音参考。
13. Director Production Bible 是项目级约束，Director Segment 的具体生成必须从它派生 productionConstraints，避免类型、观众、信息密度、口型、动作和质检标准失控。
14. 模型能力不只包括生成模型，还必须包括理解、检索、重排、质检、一致性检测、安全审核和成本路由。
15. 工程执行层必须包含 Prompt Compiler、Async Job Queue、Asset Versioning、Approval State Machine、Trace/Event Log 和 Export Manifest。

## 17. 新项目实施建议

如果重新创建一个项目，建议从第一天就按领域边界拆分，而不是先做一个聊天页面再不断补功能。

### 17.1 推荐模块边界

```text
studio-ui
  AI Director 工作台、项目页、资产栏、导演板库、设置页

api-service
  用户、项目、Agent 配置、资产、导演板、段落、评估的业务 API

agent-runtime
  Director prompt 编译、模型调用、tool loop、state graph、trace

model-gateway
  文本、图片、视频、多模态、TTS、Embedding、Rerank、评估、安全审核模型的 provider adapter

prompt-compiler
  Director prompt、图片 prompt、视频 prompt、TTS prompt、质检 rubric、安全审核请求的编译

tool-runtime
  内置工具、HTTP 工具、未来 MCP 工具、权限和审计

asset-service
  文件上传、对象存储、缩略图、素材血缘、复用关系、版本管理

job-worker
  视频任务提交、轮询、重试、超时、异步生成、质检任务

approval-service
  关键资产审批状态、锁定、重新生成、人工确认点

export-service
  资产包导出、JSON manifest、字幕/对白/提示词/质检报告导出

safety-service
  输入、提示词、生成结果和导出前安全审核

storage
  PostgreSQL、Object Storage、Queue、Trace Store、Secret Store
```

### 17.2 固定初始目录结构

新项目按以下目录初始化：

```text
apps/
  studio/

services/
  api/
  runtime/
  worker/

libs/
  domain/
  model_gateway/
  prompt_compiler/
  tool_runtime/
  queue_runtime/
  asset_core/
  approval_core/
  export_core/
  safety_core/
  prompts/
  shared_types/

infra/
  docker-compose.yml
  Dockerfile.api
  Dockerfile.worker
  Dockerfile.studio
  .env.example
  .dockerignore
  migrations/

storage/
  local/
```

说明：

1. `apps/studio`：React / TypeScript / Vite 前端。
2. `services/api`：FastAPI HTTP API、SSE、认证、业务路由。
3. `services/runtime`：LangGraph runtime、Agent turn、tool loop、prompt 编译入口。
4. `services/worker`：Celery worker、队列任务 handler、供应商轮询。
5. `libs/domain`：Pydantic / SQLAlchemy 领域模型和枚举。
6. `libs/model_gateway`：模型 provider adapter。
7. `libs/tool_runtime`：工具 schema、权限、执行器。
8. `libs/asset_core`：资产保存、版本、血缘、manifest。
9. `libs/approval_core`：审批状态机。
10. `libs/safety_core`：安全审核。
11. `infra/docker-compose.yml`：本地开发默认启动入口。
12. `infra/.env.example`：环境变量模板，不能包含真实密钥。

关键不是目录名字，而是避免把 UI、领域模型、模型调用、工具执行、视频任务全部揉进一个服务。Docker 是默认开发入口，不能只提供裸机启动方式。

### 17.3 MVP 开发顺序

推荐顺序：

1. 先定义领域模型：VideoProject、DirectorDNA、DirectorBoard、Segment、Asset、Evaluation、AudioPack、ContinuityPack、ProductionBible。
2. 再定义 Model Gateway：统一文本、图片、视频、多模态、TTS、评估、安全审核模型调用接口。
3. 再定义 Prompt Compiler：把导演结构化判断编译为不同模型可执行 prompt。
4. 再定义 Tool Runtime：read_asset、save_asset、generate_image、generate_video、evaluate_segment、evaluate_continuity。
5. 再定义 Agent Runtime：AI Director tool loop、state graph、trace。
6. 再做 Asset Versioning、Approval State、Async Job Queue 和 Export Manifest。
7. 再做 Studio UI：三栏工作台、底部输入、右侧资产栏。
8. 最后增强检索、重排、成本控制和安全审核。

不要先做：

1. 完整多 Agent 协作。
2. 复杂可视化 workflow 画布。
3. 专业剪辑 timeline 和最终合成能力。
4. 大而全 MCP 市场。
5. 大量导演模板和风格市场。

### 17.4 首轮开发任务切片

给开发 Agent 的首轮任务建议：

```text
Task 1: 初始化项目结构
  - studio-ui
  - api-service
  - agent-runtime
  - worker
  - shared domain/types
  - Dockerfile.api / Dockerfile.worker / Dockerfile.studio
  - docker-compose.yml
  - .env.example

Task 2: 实现领域模型
  - VideoProject
  - DirectorDNA
  - DirectorBoard
  - DirectorSegment
  - SegmentAudioPack
  - DirectorContinuityPack
  - DirectorProductionBible
  - VoiceCard
  - SoundDesignCard
  - PerformanceCard
  - ReferenceAsset
  - DirectorEvaluation
  - GenerationJob
  - JobEvent

Task 3: 实现基础 API
  - Project API
  - Asset API
  - Segment API
  - Director Board API
  - Evaluation API
  - Job API
  - Approval API
  - Export API
  - Model Provider API
  - Safety API

Task 4: 实现 Model Gateway
  - 文本模型接口
  - 图片模型接口
  - 视频模型接口
  - TTS / 声音模型接口预留
  - 多模态评估接口
  - Safety / Moderation 接口
  - provider 配置与密钥引用

Task 5: 实现 Prompt Compiler / Model Router
  - compile_text_prompt
  - compile_image_prompt
  - compile_video_prompt
  - compile_tts_prompt
  - compile_evaluation_rubric
  - route_model_by_task

Task 6: 实现 Tool Runtime
  - read_asset
  - save_asset
  - plan_segments
  - create_voice_card
  - create_sound_design_card
  - create_performance_card
  - create_continuity_pack
  - create_production_bible
  - derive_production_constraints
  - generate_dialogue_script
  - generate_subtitles
  - generate_image
  - generate_video
  - evaluate_continuity
  - evaluate_with_director_rubric
  - update_failure_memory
  - evaluate_segment

Task 7: 实现执行基础设施
  - Async Job Queue
  - generation_jobs / job_events
  - job state machine
  - worker handlers by job type
  - provider task polling
  - retry / timeout / cancel
  - idempotency key
  - Asset Versioning
  - Approval State Machine
  - Trace/Event Log
  - Export Manifest
  - Safety Audit Log

Task 8: 实现 AI Director Runtime
  - prompt 编译
  - tool loop
  - activity trace
  - director judgment 输出结构

Task 9: 实现 Studio UI
  - 三栏布局
  - VideoProject 工作台
  - AI Director 对话区
  - 右侧 Reference Asset / Director Monitor
  - Director Segment 列表

Task 10: 打通 P0 端到端流程
  - 输入文本
  - 生成导演判断
  - 生成 segments
  - 生成 visual decision
  - 生成 audio pack / voice card / subtitles
  - 生成 continuity pack / performance card
  - 生成 production bible / production constraints
  - 调用生成工具
  - 保存资产
  - 记录版本/审批/trace
  - 生成 export manifest
  - 输出质检

Task 11: 补齐自动化验收
  - pytest 后端单元测试
  - FastAPI integration tests
  - Alembic migration test
  - Celery worker mock job test
  - MinIO object storage test
  - SSE reconnect test
  - 前端组件测试
  - 前端 build test
  - P0 end-to-end smoke test
```

## 18. PRD 到技术方案覆盖矩阵

技术方案必须覆盖产品需求文档中的 P0 要求。Claude Code 实现时应按下表逐项对照，不允许只实现聊天壳或单模型生成页。

```text
PRD 要求                                      技术方案落点
VideoProject                                  video_projects / Project API / Project Workspace
AI Director Agent                             AgentDNA / DirectorDNA / LangGraph Runtime / Tool Loop
DirectorDNA                                   director_dnas / Prompt Compiler / Director Runtime
Director Production Bible                     director_production_bible structure / Project API
Director Board                                director_boards / project_director_boards / Board API
Director Notes                                director_notes / create_director_note tool
Director Segment                              director_segments / Segment API / Segment Detail UI
Director Visual Decision                      visualDecision json / Prompt Compiler / Segment Detail UI
Segment Audio Pack                            audioPack json / VoiceCard / SoundDesignCard / Audio tools
Director Continuity Pack                      continuityPack json / continuity evaluation tools
Reference Asset Library                       artifacts / asset_versions / asset_usages / Asset Panel
Asset Card 生成                               generate_image tools / Asset Versioning / Approval State
资产复用                                      segment_assets / asset_usages / asset_lineage
关键资产审批                                  approval_items / approval_events / Approval API
模型配置                                      model_providers / model_profiles / Model Router
图片生成                                      image queue / image provider adapter / generate_image tool
视频生成                                      video queue / video provider adapter / generate_video tool
语音与字幕                                    TTS adapter / VoiceCard / subtitles / SegmentAudioPack
异步耗时任务                                  Celery / Redis / generation_jobs / job_events
实时进度                                      SSE / Job API fallback / Activity Trace
安全审核                                      Safety API / safety audit logs / moderation adapters
质检评估                                      director_evaluations / evaluation queue / evaluation tools
导出资产包                                    export_jobs / manifest.json / MinIO package output
不做最终剪辑合成                              Export package only / no timeline compositor in MVP
三栏工作台                                    React Studio / ProjectSidebar / DirectorWorkspace / AssetPanel
Docker 开发环境                               Docker Compose / PostgreSQL / Redis / MinIO / API / Worker / Studio
```

如果 PRD 后续新增要求，必须同步补充：

1. 领域对象。
2. 数据模型。
3. API。
4. Runtime 或 Worker 执行链路。
5. 前端展示位置。
6. 自动化验收。

## 19. 风险与应对

### 风险 1：过早多 Agent 化

应对：MVP 只做一个强 AI Director Agent，复杂环节先以 skill/tool/workflow step 表达。

### 风险 2：过度分镜限制 AI

应对：优先 Director Notes、Control Level、Segment；分镜草稿只作为必要时辅助。

### 风险 3：变成普通文生视频壳

应对：强制引入 VideoProject、Reference Asset、Director Evaluation 和资产复用。

### 风险 4：右侧资产失控

应对：资产类型、来源血缘、项目/段落绑定必须从第一阶段设计。

### 风险 5：工具调用不可控

应对：AgentDNA 工具绑定、maxIterations、verboseTrace、权限策略和高成本确认。

## 20. 最终架构判断

本项目应该从“Agent 创建平台”演进为：

```text
AgentOS 底座
  -> Agent Factory Meta-Agent
  -> AI Director Agent
  -> VideoProject
  -> Reference Asset Library
  -> Director Runtime
  -> Generation Tools
  -> Director Evaluation
```

第一阶段不追求复杂多 Agent，不追求完整剪辑软件，而是把“AI 导演判断 + 参考素材 + Director Segment + 生成工具 + 资产沉淀”跑通。

这条路径在本开发基准版中固定使用 React / TypeScript / Vite、Python FastAPI、Python LangGraph、Celery、PostgreSQL、Redis 和 MinIO。后续即使替换具体框架，也必须围绕这些核心领域对象和运行链路设计。
