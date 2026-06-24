# 给 Claude Code 的阶段推进指令

用途：将 `AI-Director-Agent-Final-PRD.md` 和 `AI-Director-Agent-Final-Technical-Architecture.md` 作为全新项目开发输入时，按阶段喂给 Claude Code 使用。

使用原则：

1. 每次只喂一个阶段的指令。
2. 不要让 Claude Code 一次性实现 P0、P1、P2。
3. 每个阶段先验收，再进入下一阶段。
4. 除非明确要求，不要让 Claude Code 主动扩展后续功能。
5. 始终要求保持已完成链路稳定。

## 0. 立项启动指令

当你准备让 Claude Code 基于两份最终文档创建全新项目时，使用：

```text
请基于以下两个文档，从零创建一个全新项目：

- AI-Director-Agent-Final-PRD.md
- AI-Director-Agent-Final-Technical-Architecture.md

严格按这两个文档实现 Phase 1 / P0 MVP。不要主动实现 P1、P2 或后续阶段能力，除非文档明确要求为 P0 预留接口。

要求：

1. 使用技术方案中固定的默认技术栈：
   - React / Vite / TypeScript
   - Python FastAPI
   - Python LangGraph
   - Celery + Redis
   - PostgreSQL
   - SQLAlchemy 2.x + Alembic
   - MinIO / S3-compatible storage
   - REST + SSE
   - Docker Compose

2. 不要自行切换到：
   - Next.js 全栈
   - Node 后端
   - BullMQ
   - AgentScope
   - AutoGen
   - CrewAI
   - Dify
   - Langflow
   - Flowise
   - 纯自研 runtime

3. P0 必须跑通以下闭环：
   - 创建 VideoProject
   - 使用默认 AI Director Agent
   - 生成 Director Production Bible
   - 生成 Director Segments
   - 生成 Visual Decision / Audio Pack / Continuity Pack
   - 通过 mock provider 生成图片或视频资产
   - 保存 Reference Asset 和 asset_version
   - 写入 approval_events
   - 通过 SSE / Job API 查看任务进度
   - 生成基础 manifest.json

4. 必须提供 mock provider 和 seed data，保证没有真实模型 API Key 时也能跑通 P0 smoke test。

5. 最终输出：
   - 项目结构
   - 已实现的 P0 能力
   - 未完成的 P0 缺口
   - 启动方式
   - 测试方式
   - P0 smoke test 结果
```

## 1. P0 已实现后的验收与补齐指令

当 Claude Code 已经完成 Phase 1 / P0 MVP 基础实现后，使用：

```text
当前项目已完成 Phase 1 / P0 MVP 的基础实现。请先不要继续扩展 P1/P2 功能。

你的任务是基于这两个文档做一次完整验收与补齐：

- AI-Director-Agent-Final-PRD.md
- AI-Director-Agent-Final-Technical-Architecture.md

要求：

1. 对照 `AI-Director-Agent-Final-PRD.md` 的 P0 / Phase 1 要求逐项检查。
2. 对照 `AI-Director-Agent-Final-Technical-Architecture.md` 的技术验收清单逐项检查。
3. 找出当前实现中缺失、不一致、不可运行、不可验证的部分。
4. 优先修复 P0 闭环问题，不要新增 P1/P2 能力。
5. 确保以下链路可跑通：
   - 创建 VideoProject
   - 使用默认 AI Director Agent
   - 生成 Director Production Bible
   - 生成 Director Segments
   - 生成 Visual Decision / Audio Pack / Continuity Pack
   - 通过 mock provider 生成图片或视频资产
   - 保存 Reference Asset 和 asset_version
   - 写入 approval_events
   - 通过 SSE / Job API 查看任务进度
   - 生成基础 manifest.json

6. 跑通并修复测试：
   - docker compose up --build
   - alembic upgrade head
   - pytest
   - 前端 test / build
   - P0 end-to-end smoke test

最终输出：

- P0 验收结果清单
- 已修复的问题
- 仍未完成但属于 P0 的缺口
- 明确不要实现的 P1/P2 功能列表
```

简短版：

```text
当前已完成 Phase 1 / P0 MVP 基础实现。请不要扩展新功能，先按 PRD 和技术方案做 P0 验收、补齐和修复。目标是让 P0 端到端链路稳定跑通，并输出验收清单。
```

## 2. P0 验收完成后进入 P1 规划

当 P0 已经完成并验收通过后，不要直接让 Claude Code 开始写 P1，先让它做 P1 计划：

```text
当前项目已经完成 Phase 1 / P0 MVP，并已按 PRD 和技术方案完成 P0 验收与补齐。

现在进入 P1 阶段。请先不要直接大规模实现功能，先基于以下两个文档制定 P1 实施计划：

- AI-Director-Agent-Final-PRD.md
- AI-Director-Agent-Final-Technical-Architecture.md

你的任务：

1. 复查 P1 范围，区分哪些是必须优先做、哪些可以继续后置。
2. 输出 P1 功能拆解清单。
3. 给出推荐开发顺序。
4. 标注每个 P1 功能影响到的：
   - 数据模型
   - API
   - Runtime / Worker
   - 前端页面
   - 测试验收
5. 不要修改 P0 已稳定链路，除非是为了兼容 P1 必须做的小改动。
6. 不要实现 P2 能力。
7. 最后给出第一批最值得实现的 P1 任务，并说明原因。

重点优先考虑：

- Director Board Library 完整化
- 角色卡、场景卡、风格卡结构化编辑
- 图生视频 / 首尾帧 / 多图参考路由
- 资产血缘和复用次数增强
- Segment 级质检和重试
- 临时 TTS / 音效提示词 / 音乐提示词
- Performance Card / Continuity Sheet / Relationship Arc / Negative Style Rules
- Embedding / Rerank 资产检索
- Visual / Voice Consistency 检测
- Cost / Budget Controller
- Agent Factory 创建 AI Director Agent 的完整流程

最终输出：

- P1 实施计划
- P1 第一批任务清单
- 不进入本轮的 P1 项
- 明确不做的 P2 项
```

## 3. 开始实现 P1 第一批任务

当 Claude Code 已经输出 P1 计划，并且你确认了第一批任务后，使用：

```text
按你刚才输出的 P1 实施计划，开始实现第一批 P1 任务。

要求：

1. 只实现第一批任务，不要扩展到其它 P1 或 P2。
2. 保持 P0 端到端链路稳定。
3. 每完成一个任务都补齐测试和验收。
4. 最终输出：
   - 实现内容
   - 修改文件
   - 测试结果
   - P0 是否仍然通过
   - 剩余 P1 待办
```

## 4. P1 第一批完成后的复盘与第二批计划

当 P1 第一批任务已经实现并验收通过后，使用：

```text
P1 第一批任务已经实现并验收通过。

现在请做一次 P1 阶段复盘，并准备 P1 第二批任务。

任务要求：

1. 对照 PRD 和技术方案，列出：
   - 已完成的 P1 能力
   - 未完成的 P1 能力
   - 被证明需要调整的设计
   - 对 P0 链路造成影响的地方

2. 检查 P0 端到端链路是否仍然通过：
   - 创建 VideoProject
   - 默认 AI Director Agent
   - Director Production Bible
   - Director Segments
   - Visual Decision / Audio Pack / Continuity Pack
   - mock provider 生成资产
   - Reference Asset / asset_version
   - approval_events
   - SSE / Job API
   - manifest.json

3. 基于当前完成情况，推荐 P1 第二批任务。
   优先选择能增强产品核心壁垒的任务：
   - 资产复用能力
   - Segment 级质检和重试
   - Director Board Library
   - 图生视频 / 首尾帧 / 多图参考路由
   - 声音一致性
   - Visual / Voice Consistency 检测
   - Agent Factory 完整创建流程

4. 不要实现 P2。
5. 不要重构已经稳定的 P0/P1 第一批链路，除非有明确缺陷。

最终输出：

- P1 第一批复盘
- P0 回归验收结果
- P1 剩余清单
- P1 第二批推荐任务
- 每个推荐任务的影响范围和验收标准
```

## 5. 开始实现 P1 第二批任务

当 P1 第二批计划确认后，使用：

```text
按刚才确认的 P1 第二批任务开始实现。

要求：

1. 只实现 P1 第二批任务。
2. 保持 P0 和 P1 第一批能力稳定。
3. 每个任务必须补齐数据模型、API、Runtime/Worker、前端展示和测试。
4. 不要做 P2。
5. 最终输出：
   - 实现内容
   - 修改文件
   - 测试结果
   - P0 回归是否通过
   - P1 第一批回归是否通过
   - P1 第二批验收结果
   - 剩余 P1 待办
```

如果 P1 还有后续批次，继续使用：

```text
上一批 P1 已完成并验收通过。请先复盘，再推荐下一批 P1 任务；确认后再实现。不要进入 P2，除非我明确说开始 P2。
```

## 6. P1 全部完成后进入 P2 规划

当 P1 全部完成并验收通过后，使用：

```text
P1 能力已经全部完成，并已通过 P0 + P1 回归验收。

现在进入 P2 阶段。请先不要直接实现，先基于 PRD 和技术方案制定 P2 实施计划。

要求：

1. 对照文档列出所有 P2 能力。
2. 判断哪些 P2 能力最值得优先做，哪些可以继续后置。
3. 给出 P2 推荐开发顺序。
4. 标注每项 P2 涉及的：
   - 数据模型
   - API
   - Runtime / Worker
   - 前端页面
   - 测试验收
5. 明确哪些 P2 功能可能会破坏或重构 P0/P1 已稳定链路。
6. 不要直接实现。
7. 最终输出：
   - P2 实施计划
   - P2 第一批任务清单
   - 风险点
   - 需要我确认的产品取舍
```

## 7. 开始实现 P2 第一批任务

当 P2 第一批任务确认后，使用：

```text
按刚才确认的 P2 第一批任务开始实现。

要求：

1. 只实现 P2 第一批任务。
2. 保持 P0 / P1 端到端链路稳定。
3. 每个任务必须补齐数据模型、API、Runtime/Worker、前端展示和测试。
4. 如果需要重构 P0/P1 结构，先说明原因和影响范围，不要直接大改。
5. 最终输出：
   - 实现内容
   - 修改文件
   - 测试结果
   - P0 回归是否通过
   - P1 回归是否通过
   - P2 第一批验收结果
   - 剩余 P2 待办
```

如果 P2 还有后续批次，继续使用：

```text
上一批 P2 已完成并验收通过。请先复盘，再推荐下一批 P2 任务；确认后再实现。保持 P0/P1 链路稳定。
```

## 8. P0 / P1 / P2 全部完成后的产品化验收

当 P0、P1、P2 都完成后，进入上线前检查：

```text
P0、P1、P2 已全部完成并通过回归验收。

现在进入产品化验收和内测准备阶段。

请基于 PRD、技术方案和当前实现做一次完整上线前检查：

1. 产品闭环是否完整。
2. UI/UX 是否符合文档要求。
3. 核心链路是否稳定。
4. 数据模型和 API 是否清晰。
5. 异步任务、SSE、Celery、MinIO、PostgreSQL 是否可靠。
6. mock provider 和真实 provider 切换是否清楚。
7. 错误处理、空状态、加载状态、失败重试是否完整。
8. 安全审核、权限、密钥管理是否达标。
9. 导出 manifest 和资产包是否可被外部工具理解。
10. 测试覆盖是否足够。

最终输出：

- 上线前验收报告
- 必须修复的问题
- 建议修复的问题
- 可以后置的问题
- 内测使用说明
```

## 9. 优先级说明

如果 Claude Code 对 P0 / P1 / P2 含义不清，使用：

```text
P0、P1、P2 是需求优先级，不是阶段编号。

P0：第一版 MVP 必须做。没有它，产品闭环不成立。
P1：MVP 后第一轮增强。重要，但不阻塞第一版跑通。
P2：中长期能力。先不做，避免第一版范围失控。

当前阶段只实现我明确指定的优先级范围，不要主动实现更高阶能力。
```

