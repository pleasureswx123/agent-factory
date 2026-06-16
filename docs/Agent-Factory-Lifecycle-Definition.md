# Agent Factory 生命周期定义

## 1. 定义

Agent Factory 是一个面向单 Agent 的生命周期工厂。

它的目标不是只生成一份 Agent 配置，而是帮助用户把模糊需求转化为可运行、可测试、可发布、可观察、可迭代的 Agent。

一句话定义：

> Agent Factory 是把用户意图转化为可验证 Agent 的生产系统。

在 MVP 阶段，Agent Factory 只服务单 Agent，不创建多 Agent workflow，不做业务线编排，不引入复杂状态机。

## 2. 为什么不是普通创建器

普通创建器只解决“如何创建一个 Agent”。

生命周期工厂要解决的是：

1. 这个 Agent 要解决什么问题。
2. 它需要哪些 rules、prompt、model、skills、tools、knowledge 和 memory。
3. 它如何被测试，什么结果算可发布。
4. 它发布后如何在真实会话中使用。
5. 它的表现如何被观察和沉淀。
6. 它如何通过版本迭代持续变好。

因此，Agent Factory 的核心对象不是表单，而是 Agent 的生命周期。

## 3. 生命周期阶段

### 3.1 Define：定义

Define 阶段负责把用户的自然语言需求变成 Agent 目标说明。

最少需要明确：

1. Agent 名称。
2. Agent 职责。
3. 目标用户或使用场景。
4. 输入类型。
5. 期望输出。
6. 成功标准。
7. 明确不做的事情。

MVP 中，Define 阶段主要由 Agent Factory 对话区完成。

### 3.2 Compose：组装

Compose 阶段负责把目标说明转化为 AgentDNA。

AgentDNA 至少包括：

1. system prompt。
2. model profile 引用。
3. skill 引用。
4. tool 引用。
5. knowledge base 引用。
6. memory policy。

AgentDNA 只引用资源中心中的资源，不直接保存密钥或底层实现细节。

### 3.3 Test：测试

Test 阶段负责验证 Agent 是否能完成定义阶段承诺的任务。

MVP 中，测试至少包括：

1. 用户输入一条样例。
2. Runtime 使用当前草稿配置试跑。
3. 返回可检查的输出。
4. 用户决定是否继续调整或发布。

测试结果暂不要求自动评分，但界面和数据结构应保留后续加入 test cases、评价和回归测试的空间。

### 3.4 Publish：发布

Publish 阶段负责把通过测试的配置保存为“我的 Agent”。

发布后需要形成：

1. agent 记录。
2. prompt version 记录。
3. agent dna 记录。
4. 当前 dna 指针。

发布不是终点，而是 Agent 进入真实使用阶段的起点。

### 3.5 Use：使用

Use 阶段发生在单 Agent 工作台。

用户围绕已发布 Agent 创建会话、发送消息、引用素材、查看输出，并按需把有价值的输出保存为素材。

MVP 中，Agent 输出不自动进入素材资产库，只有用户明确保存后才成为 artifact。

### 3.6 Observe：观察

Observe 阶段负责收集 Agent 在真实使用中的表现。

MVP 可以先不做完整观测面板，但架构上应把以下信号视为后续可沉淀对象：

1. 会话消息。
2. 用户保存的素材。
3. 用户反复修改的 prompt。
4. 工具调用失败。
5. 用户手动恢复的 prompt 版本。

Observe 的目的不是监控炫技，而是为 Evolve 阶段提供事实依据。

### 3.7 Evolve：进化

Evolve 阶段负责把真实使用反馈沉淀为 Agent 改进。

可沉淀对象包括：

1. 新 prompt version。
2. 新 AgentDNA version。
3. 新测试样例。
4. 新 rules 或 guidelines。
5. skill/tool 绑定调整。
6. memory policy 调整。

MVP 中，进化以人工编辑和版本历史为主；后续可以加入自动建议，但不应让系统无审查地自我改写核心规则。

## 4. MVP 边界

MVP 应该完成：

1. Define：对话式澄清需求，生成候选 Agent。
2. Compose：编辑 AgentDNA。
3. Test：用草稿配置实时试跑。
4. Publish：保存为我的 Agent。
5. Use：在工作台中使用 Agent。
6. Evolve 基础：Prompt 版本历史和 AgentDNA 版本。

MVP 不做：

1. 多 Agent workflow。
2. 业务线编排。
3. 自动调度任务。
4. 自动发布到外部渠道。
5. 完整评测系统。
6. Agent 无人工确认的自我改写。

## 5. 产品原则

1. 少做功能，但底座不能临时。
2. Agent 配置必须版本化。
3. Agent 只引用资源中心资源，不持有密钥。
4. 创建、配置、使用、资源管理要分工清晰。
5. 测试和发布必须分离。
6. 观察和进化先留结构，再逐步产品化。
7. 用户始终保留最终判断和发布权。

## 6. 与当前 PRD 的关系

当前 PRD 中的“Agent Factory 创建单 Agent”可以视为生命周期工厂的 MVP 入口。

现有四步流程可以映射为：

1. 基础信息 -> Define。
2. Prompt 与模型 -> Compose。
3. 工具与知识库 -> Compose。
4. 测试并发布 -> Test + Publish。

后续不需要推翻当前 PRD，而是把页面目标从“创建单 Agent”升级为“完成单 Agent 的定义、组装、测试和发布闭环”。

## 7. 后续演进方向

第一阶段：单 Agent 创建闭环。

重点是让用户能从需求对话进入 AgentDNA 配置，并完成测试与发布。

第二阶段：单 Agent 迭代闭环。

重点是把真实使用中的会话、素材、prompt 修改和版本恢复转化为可复用的改进依据。

第三阶段：多 Agent workflow。

只有当单 Agent 的生命周期闭环稳定后，才引入多个 Agent 的编排、调度、任务状态、失败重试和人工审批节点。

## 8. 成功标准

Agent Factory 的第一阶段成功，不以创建了多少配置项为标准，而以用户是否能完成以下闭环为标准：

1. 用自然语言描述一个真实任务。
2. 得到一个合理的 Agent 定义。
3. 配置模型、prompt、skills、tools、memory。
4. 用样例验证输出。
5. 发布为可使用 Agent。
6. 在工作台中真实使用。
7. 后续能通过版本历史继续改进。
