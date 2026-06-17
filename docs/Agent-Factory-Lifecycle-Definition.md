# Agent Factory 生命周期定义

## 1. 定义

Agent Factory 是一个面向单 Agent 的生命周期工厂。

“单 Agent”意味着每次 Factory 只生产、测试和发布一个 Agent，不在 MVP 阶段创建多 Agent workflow。

“生命周期工厂”意味着 Factory 不停留在一次性生成配置，而是作为一个系统，围绕一个 Agent 完成定义、组装、测试、发布、使用观察和持续迭代。

Agent Factory 本身也是一个 Agent。更准确地说，它是一个元 Agent：它不直接完成用户的业务任务，而是负责生产、测试和改进完成业务任务的 Agent。

一句话定义：

> Agent Factory 是把用户意图转化为可验证 Agent 的系统。

在 MVP 阶段，Agent Factory 只服务单 Agent，不创建多 Agent workflow，不做业务线编排，不引入复杂状态机。

## 2. 为什么不是普通创建器

普通创建器只解决“如何创建一个 Agent”。

生命周期工厂要解决的是：

1. 这个 Agent 要解决什么问题。
2. 它需要哪些 rules、guidelines、prompt、model、skills、tools、knowledge 和 memory。
3. 除 model 需要用户明确选择或确认外，其他配置是否有一套能正常工作的默认值。
4. 它如何被测试，什么结果算可发布。
5. 它发布后如何在真实会话中使用。
6. 它的表现如何被观察和沉淀。
7. 它如何通过版本迭代持续变好。

因此，Agent Factory 的核心对象不是表单，而是 Agent 的生命周期。

Factory 应该比大多数用户更懂“怎样的 Agent 可以发布”。用户负责表达目标和确认取舍，Factory 负责把目标翻译成专业配置、默认能力、测试建议和发布判断。

## 3. Factory Agent 自身能力

既然 Agent Factory 本身也是 Agent，它也需要一套自己的 FactoryDNA。

FactoryDNA 至少包括：

1. factory identity：Agent 生命周期设计师、配置生成器、测试教练、发布把关者。
2. factory goals：把用户模糊需求转化为可运行、可验证、可迭代的 Agent。
3. factory rules & guidelines：不生成空占位配置，不虚构不可用工具，不跳过测试，不替用户静默发布。
4. factory prompt：指导它如何澄清需求、生成 AgentDNA、推荐能力、设计测试和判断发布。
5. factory skills：需求澄清、任务拆解、Agent 角色设计、prompt 设计、skill/tool 选择、测试样例设计、发布评估、迭代建议。
6. factory tools：读取资源中心、查询可用 skills/tools/knowledge、调用 Runtime 试跑草稿 Agent、保存 Agent 和 AgentDNA。
7. factory knowledge：平台能力、资源市场、模型能力边界、工具限制、最佳实践、历史成功 Agent 模板。
8. factory memory：用户偏好、历史创建记录、常见 Agent 类型、测试反馈和迭代建议。
9. factory evaluation：检查它生成的 Agent 是否目标清晰、默认可用、测试可跑、发布标准明确。
10. factory permissions：可以建议、生成草稿、运行测试；发布 Agent、绑定高风险工具、修改核心 rules 必须由用户确认。

MVP 中，Factory Agent 可以先作为内置系统 Agent 存在，不必出现在“我的 Agents”列表中。用户看到的是 Agent Factory 页面，底层运行的是固定的 Factory Agent。后续再把 FactoryDNA 版本化、可观察和可迭代。

系统中至少存在两类 Agent：

1. Factory Agent：负责定义、组装、测试、发布和改进其他 Agent。
2. Business Agent：负责在工作台中完成用户的具体业务任务。

两者不能混淆。Factory Agent 的输出是 AgentDNA、测试建议、发布判断和迭代建议；Business Agent 的输出是用户业务结果、会话消息和素材。Factory Agent 可以使用平台资源来试跑草稿 Agent，但不能绕过用户确认直接发布或扩大 Business Agent 的权限。

## 4. 生命周期阶段

### 4.1 Define：定义

Define 阶段负责把用户的自然语言需求变成 Agent 目标说明。

最少需要明确：

1. Agent 名称。
2. Agent 职责。
3. 目标用户或使用场景。
4. 输入类型。
5. 期望输出。
6. 成功标准。
7. 明确不做的事情。

MVP 中，Define 阶段主要由 Factory Agent 驱动的 Agent Factory 对话区完成。

### 4.2 Compose：组装

Compose 阶段负责把目标说明转化为 AgentDNA。

AgentDNA 至少包括：

1. rules & guidelines。
2. system prompt。
3. model profile 引用。
4. skill 绑定。
5. tool 绑定。
6. knowledge base 绑定。
7. memory policy。

除 model profile 外，Factory 应该为每个 Agent 生成一套能正常工作的默认配置，而不是留空占位。默认配置包括：

1. 基础 rules：任务边界、输出风格、遇到不确定性时的处理方式。
2. 默认 prompt：可直接运行，能体现 Agent 职责和输出标准。
3. 默认 skills：根据 Agent 目标从能力池中自动推荐并绑定。
4. 默认 tools：根据 Agent 需要从工具市场或资源中心中自动推荐并绑定。
5. 默认 memory policy：决定是否记住会话摘要、用户偏好或任务样例。
6. 默认 knowledge 策略：没有知识库时不强行绑定；有合适知识源时推荐绑定。

这里的“绑定”或“引用”不是让用户手动翻资源列表。它的意思是：AgentDNA 保存资源 ID，底层密钥、工具实现和技能定义仍由资源中心或市场管理；Factory 负责根据当前 Agent 的目标自动推荐最合适的 skill/tool/knowledge，并让用户确认或替换。

### 4.3 Test：测试

Test 阶段负责验证 Agent 是否能完成定义阶段承诺的任务。

MVP 中，测试至少包括：

1. 用户输入一条样例。
2. Runtime 使用当前草稿配置试跑。
3. 返回可检查的输出。
4. Factory 对输出给出发布建议。
5. 用户决定是否继续调整或发布。

“可发布”不是指模型能返回一段文本，而是输出结果达到当前 Agent 任务的最低可用标准。Factory 应该主动判断：

1. 是否完成用户目标。
2. 是否遵守 rules & guidelines。
3. 输出结构是否稳定、可读、可复用。
4. 是否遗漏关键输入或关键约束。
5. 是否出现明显幻觉、越权承诺或无依据结论。
6. 对失败或不确定情况是否有可接受的处理方式。

在多数情况下，用户并不知道怎样的输出才算可以发布，所以 Factory 需要给出专业判断：可以发布、建议调整后发布、暂不建议发布，并说明原因。

测试结果暂不要求自动评分，但界面和数据结构应保留后续加入 test cases、评价和回归测试的空间。

### 4.4 Publish：发布

Publish 阶段负责把通过测试的配置保存为“我的 Agent”。

发布后需要形成：

1. agent 记录。
2. prompt version 记录。
3. agent dna 记录。
4. 当前 dna 指针。

发布不是终点，而是 Agent 进入真实使用阶段的起点。

### 4.5 Use：使用

Use 阶段发生在单 Agent 工作台。

用户围绕已发布 Agent 创建会话、发送消息、引用素材、查看输出，并按需把有价值的输出保存为素材。

MVP 中，Agent 输出不自动进入素材资产库，只有用户明确保存后才成为 artifact。

### 4.6 Observe：观察

Observe 阶段负责收集 Agent 在真实使用中的表现。

MVP 可以先不做完整观测面板，但架构上应把以下信号视为后续可沉淀对象：

1. 会话消息。
2. 用户保存的素材。
3. 用户反复修改的 prompt。
4. 工具调用失败。
5. 用户手动恢复的 prompt 版本。

Observe 的目的不是监控炫技，而是为 Evolve 阶段提供事实依据。

### 4.7 Evolve：进化

Evolve 阶段负责把真实使用反馈沉淀为 Agent 改进。

可沉淀对象包括：

1. 新 prompt version。
2. 新 AgentDNA version。
3. 新测试样例。
4. 新 rules 或 guidelines。
5. skill/tool 绑定调整。
6. memory policy 调整。

持续变好依赖一个闭环，而不是一次性优化：

1. 从真实会话中发现反复出现的问题、失败和高价值输出。
2. 把用户保存为素材、手动修改、恢复版本、删除候选能力等行为视为反馈信号。
3. 将反馈转化为候选改进：prompt 调整、rules 增补、skill/tool 绑定变化、memory 策略变化或新增测试样例。
4. 用已有测试样例和新样例回归验证改进后的 Agent。
5. 生成新的 AgentDNA version，而不是覆盖旧版本。
6. 由用户确认后发布新版本。

MVP 中，进化以人工编辑、版本历史和 Factory 建议为主；后续可以加入自动建议，但不应让系统无审查地自我改写核心 rules、guidelines 或工具权限。

## 5. MVP 边界

MVP 应该完成：

1. Define：对话式澄清需求，生成候选 Agent。
2. Compose：生成并编辑 AgentDNA，包括 rules & guidelines、prompt、skills、tools、knowledge、memory。
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

## 6. 产品原则

1. 少做功能，但底座不能临时。
2. Agent 配置必须版本化。
3. Factory Agent 是内置系统 Agent，不应混入用户创建的 Business Agent 列表。
4. Agent 只引用资源中心资源，不持有密钥。
5. Factory 应该提供可工作的默认 rules、prompt、skills、tools、knowledge 和 memory 策略。
6. Factory 应该主动推荐 skill/tool/knowledge 绑定，而不是把选择负担完全交给用户。
7. Factory 应该给出发布判断，不能只把测试结果丢给用户。
8. 创建、配置、使用、资源管理要分工清晰。
9. 测试和发布必须分离。
10. 观察和进化先留结构，再逐步产品化。
11. 用户始终保留最终判断和发布权。

## 7. 与当前 PRD 的关系

当前 PRD 中的“Agent Factory 创建单 Agent”可以视为生命周期工厂的 MVP 入口。

现有四步流程可以映射为：

1. 基础信息 -> Define。
2. Prompt 与模型 -> Compose。
3. 工具与知识库 -> Compose。
4. 测试并发布 -> Test + Publish。

为了避免心智困扰，页面文案应持续强调：MVP 的 Factory 一次只创建一个 Agent；它之所以叫生命周期工厂，是因为它围绕这个 Agent 提供从定义到持续迭代的系统能力，而不是因为一次会生成多个 Agent。

后续不需要推翻当前 PRD，而是把页面目标从“创建单 Agent”升级为“完成单 Agent 的定义、组装、测试和发布闭环”。

## 8. 后续演进方向

第一阶段：单 Agent 创建闭环。

重点是让用户能从需求对话进入 AgentDNA 配置，并完成测试与发布。

第二阶段：单 Agent 迭代闭环。

重点是把真实使用中的会话、素材、prompt 修改和版本恢复转化为可复用的改进依据。

第三阶段：多 Agent workflow。

只有当单 Agent 的生命周期闭环稳定后，才引入多个 Agent 的编排、调度、任务状态、失败重试和人工审批节点。

## 9. 成功标准

Agent Factory 的第一阶段成功，不以创建了多少配置项为标准，而以用户是否能完成以下闭环为标准：

1. 用自然语言描述一个真实任务。
2. 得到一个合理的 Agent 定义。
3. 得到一套可工作的默认 rules、prompt、skills、tools、knowledge、memory。
4. 用样例验证输出。
5. 看到 Factory 对输出是否可发布的判断。
6. 发布为可使用 Agent。
7. 在工作台中真实使用。
8. 后续能通过版本历史和改进建议继续变好。
