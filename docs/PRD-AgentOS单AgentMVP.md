# AgentOS 单 Agent MVP 产品需求文档

版本：v0.1  
日期：2026-06-12  
状态：产品定义稿  

## 1. 产品定位

AgentOS 是一个面向 Agent 创建、配置、测试、复用的通用智能体平台。当前 MVP 不做业务线、多 Agent 协同、Workflow 编排和复杂运行中心，先聚焦“单 Agent 能稳定创建、配置、对话测试、产出素材、复用素材”的完整闭环。

本阶段的核心目标不是做一个普通聊天工具，而是做一个可持续调试和沉淀 Agent 能力的平台底座。用户创建出来的每一个 Agent，都应该在与该 Agent 的独立对话中不断输入、输出、评估和调整，直到该 Agent 能稳定产出用户满意的结果；满意输出可以沉淀为可复用素材，满意配置可以继续沉淀为 Agent 的可复用能力。

## 2. MVP 范围

### 2.1 本阶段包含

1. Agent Factory 通过对话澄清需求、推导候选 Agent 列表，并创建单 Agent。
2. 我的 Agents 列表与当前 Agent 选择。
3. 我的 Agents 增加、删除与基础管理。
4. 单 Agent 对话工作台。
4. 当前 Agent 会话列表。
5. 单 Agent 反复对话调试，并将满意输出保存为素材资产。
6. 可折叠素材资产库。
7. Agent 配置详情。
8. 资源与凭证中心。

### 2.2 本阶段不包含

1. 业务线 / Workspace 层级。
2. 多 Agent 协同。
3. 综合 Agent / Workflow 编排。
4. 阶段 Stage 概念。
5. 独立运行中心 / Run Monitor 页面。
6. Prompt 多版本横向对比页面。
7. 多租户、团队权限、计费结算等后台管理能力。

### 2.3 MVP 成功标准

1. 用户能创建一个单 Agent。
2. 用户能配置该 Agent 的 Prompt、模型、工具、知识库、记忆等能力。
3. 用户能用该 Agent 发起新会话并反复测试。
4. Agent 输出可以沉淀为素材资产。
5. 用户能在对话中引用已有素材继续生成。
6. 平台资源如模型 Provider、API Key、Skills、Tools、知识库可以集中管理，Agent 只选择和引用。

## 3. 用户与使用场景

### 3.1 目标用户

当前阶段主要面向需要反复调试 Agent 效果的创建者，包括：

1. 产品负责人。
2. 提示词工程师。
3. 内容生产流程设计者。
4. 需要把固定任务封装成 Agent 的业务人员。

### 3.2 核心使用场景

用户希望创建一个“脚本分析 Agent”。该 Agent 可以读取用户输入或引用素材，输出结构化分析结果，例如人物、冲突、场景、风险点、可复用素材字段。

如果用户还不清楚自己需要哪些 Agent，可以先与 Agent Factory 对话，描述自己的业务需求。Agent Factory 通过多轮对话理解用户要完成的任务，推理出可能需要的 Agent 列表，并给出建议，例如“脚本分析 Agent、素材生成 Agent、质检 Agent”。用户确认后，再逐个创建这些 Agent。

如果用户已经清楚自己需要哪些 Agent，也可以跳过需求澄清，直接在 Agent Factory 中创建指定 Agent。

用户会经历以下过程：

1. 在 Agent Factory 中通过对话澄清业务需求，或直接输入已明确的 Agent 创建需求。
2. Agent Factory 给出建议 Agent 列表，用户确认要创建的 Agent。
3. 配置 Agent 的职责、Prompt、模型、工具和知识库。
4. 在单 Agent 对话工作台中与该 Agent 反复对话，测试输入与输出。
5. 对不满意的结果继续调整 Prompt、模型或资源绑定。
6. 将满意输出保存为素材资产。
7. 在后续对话中通过 `@素材` 引用已有素材继续生成。

## 4. 信息架构

当前 MVP 的导航结构如下：

```text
AgentOS
├── 新建会话
├── Agent Factory
├── 我的 Agents
│   ├── 初始为空
│   └── 随用户创建 Agent 动态增加
├── 当前 Agent 会话
│   ├── 测试模型输出
│   ├── 调整系统提示词
│   ├── 引用素材继续生成
│   ├── 保存满意素材
│   └── 脚本分析对比样例
└── 资源与凭证入口
```

主页面包括：

1. 单 Agent 对话工作台。
2. Agent Factory 创建单 Agent。
3. Agent 配置详情。
4. 资源与凭证中心。
5. 素材资产库面板。

## 5. 核心概念

### 5.1 Agent

Agent 是平台中的核心执行单元。一个 Agent 负责一个明确任务，例如脚本分析、提示词优化、素材生成或质检。

用户第一次进入系统时，`我的 Agents` 列表默认为空。随着用户通过 Agent Factory 创建 Agent，Agent 会动态出现在 `我的 Agents` 列表中。用户可以按需新增、删除和管理 Agent。

Agent 应至少包含：

1. 名称。
2. 职责描述。
3. 系统提示词。
4. 模型配置。
5. 工具绑定。
6. 知识库绑定。
7. 记忆策略。
8. 会话列表。
9. 产出素材列表。

Agent 管理能力至少包括：

1. 新增 Agent。
2. 删除 Agent。
3. 修改 Agent 名称与职责。
4. 进入 Agent 配置详情。
5. 查看该 Agent 的会话与素材资产。

### 5.2 AgentDNA

AgentDNA 是 Agent 的配置快照，用于描述一个 Agent 当前如何工作。

AgentDNA 包含：

1. Agent 基础信息。
2. System Prompt。
3. Model Profile。
4. Skills / Tools 绑定。
5. 知识库绑定。
6. Memory 策略。
7. 发布状态。

MVP 阶段可以先把 AgentDNA 理解为“当前 Agent 配置详情”，后续再演进为可版本化配置快照。

### 5.3 Conversation

Conversation 是某个 Agent 下的一次对话。每个 Agent 拥有自己的会话列表。

顶部 `新建会话` 的含义是：为当前选中的 Agent 创建一条新的空白会话，并进入单 Agent 对话工作台。

每个 Agent 行右侧只保留设置齿轮，不再常驻“新建对话”图标，避免和顶部 `新建会话` 形成重复入口。

### 5.4 Artifact / 素材资产

素材资产是 Agent 输出中可被复用、预览、引用和管理的内容。素材不是普通附件，而是 AgentOS 的核心产物。

素材可以来自：

1. 用户上传。
2. 用户从 Agent 对话输出中手动保存的某段内容。
3. Agent 测试或生成过程中的结构化结果。

MVP 阶段 Agent 输出不会自动进入素材资产库。只有用户明确点击“保存为素材”后，该输出才成为素材资产。

素材可以被用于：

1. 在对话框中通过 `@素材` 引用。
2. 作为下一轮生成的输入。
3. 在素材资产库中预览和管理。
4. 作为后续 Agent 能力调试的样例。

### 5.5 Resource / Credential

资源与凭证是平台级基础资源，不属于某个单独 Agent，但可以被 Agent 选择和引用。

包括：

1. 模型 Provider。
2. API Key。
3. Skills。
4. Tools。
5. 知识库 KB。

Agent 配置详情中不直接维护所有底层资源，而是引用资源与凭证中心中已配置好的资源。

## 6. 页面需求

### 6.1 单 Agent 对话工作台

原型参考：

1. `schematic/素材资产库处于折叠状态时的页面.png`
2. `schematic/展开并且处于列表状态时的页面.png`
3. `schematic/展开并且处于缩略图状态时的页面.png`

#### 页面目标

提供当前 Agent 的主要使用界面。用户在这里选择 Agent、切换会话、输入消息、引用素材、查看输出，并通过右侧素材资产库复用产物。

#### 布局

页面采用三部分结构：

1. 左侧合并侧栏。
2. 中间对话区域。
3. 右侧可折叠素材资产库。

#### 左侧侧栏

左侧包含：

1. `AgentOS` 品牌。
2. `新建会话` 按钮。
3. `Agent Factory` 导航。
4. `我的 Agents` 区域。
5. Agent 子列表。
6. 当前 Agent 会话列表。
7. 资源与凭证入口。

Agent 子列表要求：

1. 使用轻量列表样式。
2. 不使用左侧彩色 border。
3. 每个 Agent 行右侧只保留设置齿轮。
4. 点击 Agent 名称切换当前 Agent。
5. 点击齿轮进入 Agent 配置详情。
6. 初始状态为空；当用户创建 Agent 后，列表按创建时间或最近使用时间动态增加。
7. 用户可以在 Agent 管理入口中删除不需要的 Agent。删除前需要二次确认，并提示该 Agent 下的会话和素材处理规则。

`新建会话` 按钮行为：

1. 为当前选中的 Agent 创建新会话。
2. 创建后进入空白对话状态。
3. 新会话出现在当前 Agent 会话列表顶部。

#### 中间对话区域

中间对话区域包含：

1. 当前 Agent 名称，例如 `脚本分析 Agent`。
2. 用户消息卡片。
3. Agent 回复卡片。
4. 素材引用条。
5. 底部输入框。
6. 上传附件入口。
7. 发送按钮。

不再显示顶部状态标签 `单 Agent 测试中`。

#### 右侧素材资产库

素材资产库有三种状态：

1. 折叠状态。
2. 展开且处于列表状态。
3. 展开且处于缩略图状态。

折叠状态：

1. 只显示右侧竖向按钮 `素材资产库`。
2. 中间对话区域占满右侧可用空间。

展开状态：

1. 右侧出现素材资产库面板。
2. 顶部显示 `素材资产库` 标题。
3. 提供 `列表 / 缩略图` 切换。
4. 提供 Agent tabs，tab 不是固定枚举，而是与 `我的 Agents` 列表一一对应。
5. 用户每创建一个 Agent，素材资产库顶部就增加一个对应 Agent tab。
6. 默认选中当前正在对话的 Agent tab。
7. 每个 Agent tab 下展示该 Agent 所有会话产出的素材资产。
8. 如果该 Agent 有多个 conversationId，且每个 conversationId 下都有素材资产，则该 Agent tab 下需要聚合显示这些素材，并保留会话来源信息。

列表视图：

1. 只显示素材列表。
2. 不同时显示缩略图。
3. 每个素材展示名称、类型、状态和操作入口。
4. 每个素材需要展示来源会话，至少能识别 `conversationId` 或会话标题。

缩略图视图：

1. 只显示素材缩略图网格。
2. 不同时显示列表。
3. 每个素材展示预览图和名称。
4. 每个缩略图卡片需要保留素材类型和来源会话信息。

### 6.2 Agent Factory 创建单 Agent

原型参考：

`schematic/AgentFactory创建单agent页面.png`

#### 页面目标

帮助用户创建一个新的单 Agent。第一阶段只创建单 Agent，不创建业务线或多 Agent Workflow。

Agent Factory 不是单纯表单页，而是一个可以通过对话帮助用户澄清需求、推导 Agent 列表、再逐个创建 Agent 的创建助手。用户可以先与 Agent Factory 聊业务需求，由 Agent Factory 分析“完成该业务可能需要哪些 Agent”；也可以在已明确需求时直接创建指定 Agent。

#### 页面结构

页面包括：

1. 左侧 AgentOS 侧栏。
2. 页面标题 `Agent Factory 创建单 Agent`。
3. Agent Factory 需求对话区。
4. 候选 Agent 建议列表。
5. 四步流程卡片。
6. AgentDNA 配置表单。
7. 实时测试区。

#### 需求对话区

需求对话区用于承接用户的业务描述。

用户可以输入：

1. 想完成的业务目标。
2. 当前已有资料或素材。
3. 期望输出结果。
4. 已经明确想创建的 Agent。

Agent Factory 需要输出：

1. 对业务需求的理解摘要。
2. 建议创建的 Agent 列表。
3. 每个建议 Agent 的职责说明。
4. 用户下一步可以直接创建的 Agent。

#### 候选 Agent 建议列表

当 Agent Factory 推理出候选 Agent 后，需要以列表形式展示。

每个候选 Agent 至少包含：

1. Agent 名称。
2. Agent 职责。
3. 建议原因。
4. `创建此 Agent` 操作。

用户可以：

1. 接受建议并创建 Agent。
2. 修改 Agent 名称和职责后创建。
3. 删除不需要的候选 Agent。
4. 如果已经清楚要创建什么 Agent，可以跳过建议列表，直接进入 AgentDNA 配置。

#### 四步流程

1. 基础信息：名称、头像、职责。
2. Prompt 与模型：System Prompt、modelId。
3. 工具与知识库：Skills、Tools、KB。
4. 测试并发布：保存为我的 Agent。

#### AgentDNA 配置

需要配置：

1. 名称。
2. 职责。
3. 系统提示词。
4. 模型。
5. 工具。
6. 知识库。

#### 实时测试区

包括：

1. 输入样例。
2. 输出评分。
3. 发布策略。
4. 保存草稿。
5. 运行测试。

### 6.3 Agent 配置详情

原型参考：

`schematic/agent配置页面.png`

#### 页面目标

集中管理某个 Agent 的所有可调参数，避免配置散落在对话工作台中。

#### 页面结构

页面包括：

1. 左侧 AgentOS 侧栏。
2. 标题 `Agent 配置详情`。
3. 副标题 `一个 Agent 的全部可调参数集中在这里，避免配置散落。`
4. 顶部配置 tabs。
5. 当前 tab 的配置编辑区。
6. 当前绑定摘要。

#### 配置 tabs

包括：

1. 基础。
2. Prompt。
3. 模型。
4. 工具。
5. 知识库。
6. 记忆。
7. 发布。

默认展示 Prompt tab。

#### Prompt tab

展示：

1. `System Prompt v12`。
2. 系统提示词正文。
3. 当前 Agent 职责说明。
4. 输出要求。
5. Prompt 版本历史入口。

示例文案：

```text
你是一个脚本分析 Agent。你的职责是读取用户输入或引用素材，输出结构化分析结果。

输出必须包含：人物、冲突、场景、风险点、可复用素材字段。
```

Prompt 版本历史要求：

1. 每次保存 Prompt 修改时生成一个新版本。
2. 版本记录至少包含版本号、保存时间、修改人和 Prompt 正文。
3. 用户可以查看历史版本内容。
4. 用户可以将某个历史版本恢复为当前版本。

#### 当前绑定

展示当前 Agent 引用的资源：

1. `Model: doubao-seed-2-0-pro`
2. `BaseURL: provider profile`
3. `Skills: 文件解析、总结`
4. `Tools: none`
5. `KB: 剧作知识库`
6. `Memory: 当前 Agent 私有`

### 6.4 资源与凭证中心

原型参考：

`schematic/资源与凭证设置页面.png`

#### 页面目标

集中管理平台资源。Agent 配置只选择和引用这些资源，不直接保存底层密钥或工具实现。

#### 页面入口

左侧侧栏底部增加一个资源与凭证设置按钮。按钮可以使用齿轮图标或资源图标，并在进入页面时显示选中状态。

#### 页面结构

页面包括：

1. 标题 `资源与凭证中心`。
2. 副标题说明资源中心定位。
3. 四个资源卡片。
4. 资源清单。
5. 新增资源按钮。

#### 资源卡片

1. 模型 Provider：OpenAI 兼容与自定义 BaseURL。
2. API Key：密钥独立管理，不写入 Agent。
3. Skills / Tools：全局能力池，Agent 选择绑定。
4. 知识库 KB：上传、索引、权限控制。

#### 资源清单

默认展示 Provider 列表。

需要支持筛选：

1. Provider。
2. API Key。
3. Skills。
4. Tools。
5. 知识库。

示例资源：

1. `doubao provider`
2. `openai compatible`
3. `local model gateway`

## 7. 关键交互规则

### 7.1 新建会话

顶部 `新建会话` 是当前 Agent 的会话创建入口。

规则：

1. 如果已选中 Agent，则为该 Agent 创建新会话。
2. 如果未选中 Agent，则默认选中最近使用的 Agent。
3. 创建后进入空白对话状态。
4. 新会话显示在当前 Agent 会话列表顶部。

### 7.2 切换 Agent

点击左侧 Agent 名称时：

1. 当前 Agent 切换为被点击 Agent。
2. 中间对话区展示该 Agent 最近一次会话。
3. 当前 Agent 会话列表切换为该 Agent 的会话。
4. 素材资产库切换为该 Agent 的产出素材。

### 7.2.1 管理 Agent

用户可以管理 `我的 Agents` 列表。

规则：

1. 用户第一次进入系统时，Agent 列表为空。
2. 用户通过 Agent Factory 创建 Agent 后，新 Agent 出现在 `我的 Agents` 列表中。
3. 用户可以删除 Agent。删除时必须二次确认。
4. 删除 Agent 前需要提示该 Agent 下已有会话与素材资产的处理方式。
5. MVP 默认删除 Agent 时不物理删除素材资产，而是将相关素材标记为“来源 Agent 已删除”，避免误删有价值产物。

### 7.3 进入 Agent 配置

点击 Agent 行右侧齿轮时：

1. 进入 `Agent 配置详情` 页面。
2. 默认打开该 Agent 的 Prompt tab。
3. 页面右侧显示该 Agent 当前绑定资源。

### 7.4 素材引用

在对话输入框中：

1. 用户可以通过 `@` 触发素材选择。
2. 选中素材后，素材以预览附件形式出现在输入框或消息区。
3. 发送消息时，素材作为当前消息上下文传入 Agent。

### 7.5 素材资产库展开与折叠

1. 点击竖向 `素材资产库` 按钮展开面板。
2. 再次点击或点击收起按钮折叠面板。
3. 折叠时，对话区占满剩余空间。
4. 展开时，对话区宽度缩小，右侧显示素材面板。

### 7.6 列表 / 缩略图切换

1. 选择 `列表` 时，只显示列表。
2. 选择 `缩略图` 时，只显示缩略图网格。
3. 两种视图不同时显示。
4. 当前视图状态可以按用户偏好记忆。

### 7.7 Agent Factory 对话式创建

Agent Factory 支持两种创建路径。

路径一：需求不清楚。

1. 用户与 Agent Factory 对话，描述业务目标。
2. Agent Factory 追问必要信息。
3. Agent Factory 汇总需求理解。
4. Agent Factory 推导建议 Agent 列表。
5. 用户从建议列表中选择要创建的 Agent。
6. 进入该 Agent 的 AgentDNA 配置与测试流程。

路径二：需求已明确。

1. 用户直接输入要创建的 Agent 名称和职责。
2. Agent Factory 跳过需求推导，直接进入 AgentDNA 配置。
3. 用户完成配置、测试并保存到 `我的 Agents`。

## 8. 数据对象

### 8.1 Agent

字段建议：

| 字段 | 说明 |
| --- | --- |
| id | Agent 唯一标识 |
| name | Agent 名称 |
| description | 职责描述 |
| status | 草稿 / 已发布 |
| currentAgentDNAId | 当前配置版本 |
| createdAt | 创建时间 |
| updatedAt | 更新时间 |
| deletedAt | 删除时间；为空表示未删除 |

### 8.2 AgentDNA

字段建议：

| 字段 | 说明 |
| --- | --- |
| id | AgentDNA 唯一标识 |
| agentId | 所属 Agent |
| prompt | 系统提示词 |
| modelProfileId | 模型配置引用 |
| skillIds | Skills 引用 |
| toolIds | Tools 引用 |
| knowledgeBaseIds | 知识库引用 |
| memoryPolicy | 记忆策略 |
| version | 版本号 |
| status | 草稿 / 已发布 |

### 8.3 Conversation

字段建议：

| 字段 | 说明 |
| --- | --- |
| id | 会话唯一标识 |
| agentId | 所属 Agent |
| title | 会话标题 |
| createdAt | 创建时间 |
| updatedAt | 更新时间 |

### 8.4 Message

字段建议：

| 字段 | 说明 |
| --- | --- |
| id | 消息唯一标识 |
| conversationId | 所属会话 |
| role | user / assistant / system |
| content | 消息正文 |
| artifactRefs | 引用素材 |
| createdAt | 创建时间 |

### 8.5 Artifact

字段建议：

| 字段 | 说明 |
| --- | --- |
| id | 素材唯一标识 |
| agentId | 产出 Agent |
| conversationId | 来源会话 |
| messageId | 来源消息 |
| name | 素材名称 |
| type | 文本 / JSON / 图片 / 音频 / 视频 / 报告 |
| status | 已保存 |
| content | 文本或结构化内容 |
| fileUrl | 文件地址 |
| thumbnailUrl | 缩略图地址 |
| sourceAgentDeleted | 来源 Agent 是否已删除 |
| createdAt | 创建时间 |

### 8.6 Resource

字段建议：

| 字段 | 说明 |
| --- | --- |
| id | 资源唯一标识 |
| type | provider / api_key / skill / tool / knowledge_base |
| name | 资源名称 |
| status | 可用 / 禁用 / 配置中 |
| config | 非敏感配置 |
| secretRef | 密钥引用 |
| createdAt | 创建时间 |
| updatedAt | 更新时间 |

## 9. 权限与安全要求

MVP 阶段至少需要满足：

1. API Key 不在 Agent 配置详情中明文展示。
2. Agent 只引用 API Key Profile 或 Provider Profile。
3. 素材引用需要校验素材是否属于当前用户可访问范围。
4. 删除 Agent 前需要确认。
5. 删除资源前需要检查是否被 Agent 引用。

## 10. 非功能需求

### 10.1 易用性

1. 单 Agent 工作台首屏应清楚展示当前 Agent、当前会话和可用素材入口。
2. 常用操作不能隐藏太深：新建会话、切换 Agent、进入配置、引用素材应在一到两步内完成。
3. 设置类操作从工作台中剥离，集中到 Agent 配置详情和资源与凭证中心。

### 10.2 可扩展性

虽然 MVP 不做多 Agent，但架构上应保留扩展可能：

1. Agent 与 Conversation 一对多。
2. Agent 与 Artifact 一对多。
3. AgentDNA 与资源通过引用关系绑定。
4. Artifact 保留来源字段，便于未来做血缘追踪。

### 10.3 可维护性

1. 平台资源集中管理，避免配置散落。
2. Prompt、模型、工具、知识库、记忆策略都应有清晰边界。
3. UI 页面职责清晰：工作台用于使用，配置详情用于调参，资源中心用于底座管理。

## 11. 原型与素材说明

当前仓库中的视觉稿位于 `schematic` 目录：

| 文件 | 对应页面 |
| --- | --- |
| `素材资产库处于折叠状态时的页面.png` | 单 Agent 对话工作台 - 素材库折叠 |
| `展开并且处于列表状态时的页面.png` | 单 Agent 对话工作台 - 素材库列表 |
| `展开并且处于缩略图状态时的页面.png` | 单 Agent 对话工作台 - 素材库缩略图 |
| `agent配置页面.png` | Agent 配置详情 |
| `AgentFactory创建单agent页面.png` | Agent Factory 创建单 Agent |
| `资源与凭证设置页面.png` | 资源与凭证中心 |

## 12. 已确认产品决策

以下决策来自当前评审意见，作为 MVP 阶段的默认产品规则：

1. Agent 输出不默认保存为素材，需要用户手动保存。
2. MVP 不区分“素材冻结”和“普通保存”，不引入素材冻结概念。
3. Prompt 在 MVP 阶段需要完整版本历史。
4. 资源与凭证中心 MVP 不需要支持测试连接。
5. 知识库上传、索引、检索不作为 MVP 第一批能力。
6. 当前原型图暂时继续以本地图片为主，不要求同步回 Figma。
