# AI Director Agent Studio 最终版产品需求文档

日期：2026-06-23  
版本：v1.0 开发基准版  
用途：全新项目研发启动、需求拆解、产品验收、迭代规划

## 0. 开发执行说明

本文件可作为 Claude Code 或其他开发 Agent 的产品需求输入。执行时遵循：

1. 以 P0 需求为第一阶段开发范围，不主动实现 P1/P2。
2. 如发现需求冲突，以“AI Director 工作台 + VideoProject + Reference Asset + Director Segment + 生成工具 + 质检闭环”为最高优先级。
3. 不把产品做成普通聊天机器人、普通文生视频页面、通用 Agent 平台或剪辑软件。
4. 所有新增功能必须能落到明确领域对象：VideoProject、DirectorDNA、DirectorBoard、DirectorSegment、ReferenceAsset、DirectorEvaluation。
5. 每个阶段完成后必须对照第 11 章验收标准检查。
6. 未明确要求时，不实现复杂多 Agent、完整 timeline、MCP 市场、导演风格市场。

## 1. 产品一句话

AI Director Agent Studio 是一个面向内容创作者的 AI 视频生产工作台，由具备导演思维的 AI Agent 主导视频创作流程。它让 AI 不只是根据 prompt 生成画面，而是像导演一样理解故事、判断情绪、组织参考素材、选择视听表达方式，并通过可复用的视频生产资产持续迭代，最终产出视频。

这里的“导演思维”指系统内部 AI Agent 的能力，不表示产品只面向专业导演。

核心表达：

> 让 AI 像导演一样思考，而不是像工具一样填空。

## 2. 背景与问题

当前视频大模型已经具备文生视频、图生视频、首尾帧、多图参考、角色参考等能力，但单纯接入模型并不能解决真实视频生产问题。

用户真实痛点包括：

1. 只有一段小说、文章或短句，不知道如何转成有情绪、有镜头、有节奏的视频。
2. 不懂导演、分镜、景别、构图、运镜、光影等影视知识。
3. 直接文生视频随机性强，难以复用角色、场景、风格和参考素材。
4. 如果人为制定太多固定规则，又会限制 AI 大模型的创造力。
5. 角色卡、场景卡、风格图、首尾帧、视频片段、导演手记等资产缺少统一管理。
6. 生成结果无法解释“为什么这样拍”，也很难知道哪里不好、如何修改。
7. 多 Agent、工具、模型、素材、记忆、评估如果边界不清，系统会变成复杂但不可控的堆叠。

因此，本产品不是要做一个普通“文本到视频”按钮，而是要做一个“AI 导演生产工作台”。

## 3. 产品定位

### 3.1 不是什么

本产品不是：

1. 普通文生视频工具。
2. 单纯视频模型调用壳。
3. 传统剪辑软件替代品。
4. 一开始就复杂多 Agent 团队编排平台。
5. 让用户填写大量影视规则表单的后台系统。
6. 机械分镜生成器。
7. 最终剪辑合成工具。

### 3.2 是什么

本产品是：

1. 以 AI Director Agent 为核心的视频生产工作台。
2. 以 VideoProject 为容器的创作系统。
3. 以 Reference Asset Library 为基础的全能参考素材管理系统。
4. 以 DirectorDNA、导演板、导演手记、Director Segment 为核心的导演判断系统。
5. 以 Agent Factory 创建和调优 AI Director / Video Production Agent 的 AgentOS 应用。
6. 以工具调用和生成模型为执行层的视频生产系统。

## 4. 目标用户

第一阶段目标用户：

1. 短剧、漫剧、剧情短视频、微电影创作者。
2. 希望把小说、文章、故事片段改成视频的内容创作者。
3. 不擅长影视导演和分镜，但希望 AI 能辅助完成视频表达的人。
4. 没有专业角色图、场景图、风格参考，也希望系统能从文本中逐步生成这些项目资产的人。
5. 希望通过 AI 建立可持续视频生产流程的个人或小团队。

## 5. 核心产品思想

### 5.1 AI 不应被死规则限制

产品不应把 AI 限制成执行固定规则的工具，例如：

```text
两人对话必须正反打
强势方必须低机位
每个段落必须拆固定数量镜头
每个段落必须远景、中景、特写
```

正确方向是：

```text
给 AI 足够好的导演知识、素材上下文、目标、边界和评估机制，
让 AI 自己判断如何拍、要不要分镜、要不要强控制、要不要自由发挥。
```

### 5.2 最高层控制对象不是分镜，而是导演意图

分镜是工具，不是最高层控制对象。产品应该优先表达：

1. 情绪目标。
2. 戏剧关系。
3. 观众注意力。
4. 视觉动机。
5. 导演理由。
6. 控制强度。
7. 参考素材策略。

### 5.3 资产是产品壁垒

系统的长期价值来自资产沉淀：

1. 角色卡。
2. 场景卡。
3. 风格卡。
4. 导演手记。
5. 导演板。
6. 首帧 / 尾帧。
7. 生成视频片段。
8. 质检记录。
9. 成功案例和失败反例。

这些资产让视频生产可复用、可迭代、可评估，而不是每次重新写 prompt。

## 6. 核心用户旅程

```text
1. 用户创建 VideoProject
2. 输入小说 / 文章 / 短句；如果用户已有素材，也可以上传作为参考
3. Agent Factory 创建或选择合适的 AI Director / Video Production Agent
4. AI Director 读取项目上下文，以及项目中已生成或已上传的参考资产
5. AI Director 输出导演判断和导演手记
6. 系统从文本中生成角色卡、场景卡、风格卡、导演板；后续 Segment 可反复引用这些资产
7. AI Director 拆分 Director Segments
8. 每段判断 Control Level 和生成方式
9. 调用图片 / 视频 / 多模态工具生成资产
10. 生成结果保存到 Reference Asset Library
11. AI Director 质检结果并给出修改建议
12. 用户反馈，系统迭代项目资产和视频片段
13. 导出资产包和 Segment 视频，交给剪映、Premiere、达芬奇、CapCut 等专业剪辑软件完成最终合成
```

## 7. 核心领域对象

### 7.1 VideoProject

VideoProject 是视频生产的项目容器。

```text
VideoProject
├── 项目名称
├── 原始文本 / 素材
├── 目标视频类型
├── 平台 / 画幅 / 时长
├── Director Production Bible
├── DirectorDNA
├── 导演手记
├── 角色卡
├── 场景卡
├── 风格卡
├── 导演板
├── Director Segments
├── 参考资产
├── 生成资产
├── 质检记录
└── 项目状态
```

### 7.2 AI Director Agent

AI Director Agent 是导演判断的主导者。

职责：

1. 理解故事和情绪。
2. 判断人物关系和戏剧冲突。
3. 决定是否需要分镜草稿。
4. 选择导演板和视听表达方式。
5. 判断每段控制强度。
6. 组织参考素材。
7. 生成镜头意图和提示词。
8. 调用生成工具。
9. 输出导演理由。
10. 质检 Segment 视频效果和资产可用性。

### 7.3 DirectorDNA

DirectorDNA 是 AI Director 的导演配置。

```text
DirectorDNA
├── 导演类型
├── 风格倾向
├── 情绪表达偏好
├── 镜头语言偏好
├── 控制强度策略
├── 参考素材使用策略
├── 导演知识库引用
├── 判断协议
├── 生成模型偏好
└── 质检标准
```

### 7.4 Director Board

导演板是可复用导演知识模块，不是固定分镜。

示例：

1. 二人对话戏导演板。
2. 跑步追逐戏导演板。
3. 角色初登场导演板。
4. 情绪崩溃导演板。
5. 暧昧拉扯导演板。
6. 空景转场导演板。

### 7.5 Director Notes

导演手记记录当前 VideoProject 或段落的导演判断。

它回答：

1. 这段戏为什么这样拍？
2. 观众应该感受到什么？
3. 哪个角色是注意力中心？
4. 哪里需要强控制？
5. 哪里应让 AI 自由发挥？

### 7.6 Director Production Bible

Director Production Bible 是整个 VideoProject 的导演生产圣经，用于约束全片的类型、观众、信息、意象、格式、字幕、动作可信度、生成可执行性和质检标准。它不是给用户填写的复杂表单，而是 AI Director 在项目启动阶段自动生成，并允许用户确认和微调。

它包含：

```text
DirectorProductionBible
├── genreContract          类型片规则：短剧 / 漫剧 / 微电影 / 悬疑 / 爱情 / 古风 / 科幻等
├── audienceTarget         观众对象：平台、观看场景、注意力长度、复杂度接受度
├── informationDensity     信息密度：必须展示、可以暗示、暂时隐藏、何时揭示
├── motifSystem            关键意象：视觉意象、声音意象、道具意象及复用规则
├── frameSafety            画面安全区：画幅、安全边距、字幕区、主体位置、裁切风险
├── subtitleStyle          字幕风格：字体气质、位置、字数、节奏、遮挡规则
├── dialogueExecutability  对白可执行性：口型风险、对白长度、替代表现方式
├── motionPlausibility     动作可信度：身体、手部、物体交互、复杂动作风险
├── approvalGates          人工确认点：美术、角色、声音、段落、首帧、成片
└── evaluationRubric       导演质检标准
```

关键说明：

1. Genre Contract / 类型片规则
   - 不同类型的视频导演逻辑完全不同。
   - 短剧、漫剧、微电影、悬疑、爱情、古风、科幻、恐怖、广告片的节奏、表演强度、镜头距离、音乐使用和转场方式不同。
   - AI Director 必须先判断“这个作品应该像什么类型”，并明确不要破坏哪些类型规则。

2. Audience Target / 观众对象
   - 同一个故事给抖音、小红书、B站、影视感短片、漫剧用户，拍法不同。
   - 应明确目标平台、观看场景、注意力长度、情绪钩子和复杂度接受度。

3. Information Density / 信息密度
   - 视频不是把小说信息全部塞进去。
   - AI Director 要决定哪些必须展示、哪些只暗示、哪些暂时隐藏、何时揭示。
   - 这是避免画面变成“解释型旁白”的关键。

4. Motif System / 关键意象系统
   - 反复出现的雨声、红伞、旧照片、钟声、背影、颜色、动作，可以让视频有作品感。
   - 每个意象需要说明情绪意义、出现时机和复用规则。

5. Frame Safety / 画面安全区
   - 竖屏、横屏、字幕区、人物不要被裁掉、重要信息不要贴边。
   - 短视频尤其必须考虑安全区和裁切风险。

6. Subtitle Style / 字幕风格
   - 字幕会直接影响质感。
   - 字体气质、位置、每行字数、出现节奏、是否遮挡主体都需要约束。

7. Dialogue Executability / 对白可执行性
   - 当前视频模型未必能稳定完成长对白和精准口型。
   - AI Director 需要判断是否使用正脸对白，或改用侧脸、背影、反应镜头、旁白、字幕承接。

8. Motion Plausibility / 动作可信度
   - 手部、复杂打斗、多人物交互、物体传递等是 AI 视频常见失败点。
   - AI Director 必须识别动作风险，并给出简化策略或参考素材需求。

9. Human Approval Gates / 人工确认点
   - 美术总设定、主角角色卡、Voice Card、关键场景卡、段落计划、首帧/尾帧、生成视频应支持确认。
   - 关键资产未经确认不应批量扩散生成。

10. Director Evaluation Rubric / 导演质检标准
   - 不只判断“好不好看”，而要按故事清晰度、情绪连续性、角色一致性、表演一致性、视觉一致性、声音一致性、动作可信度、类型匹配、模型执行质量质检。

P0 必须支持基础版：

1. genreContract。
2. audienceTarget。
3. informationDensity。
4. evaluationRubric。
5. frameSafety。
6. dialogueExecutability 基础风险判断。

P1 增强：

1. motifSystem。
2. subtitleStyle。
3. motionPlausibility。
4. approvalGates。
5. 更完整的类型片规则库。

### 7.7 Director Segment

Director Segment 是视频生成的基本生产单元，通常对应一次视频模型生成任务。MVP 可以默认按 15 秒拆分，因为当前主流视频模型更适合短段生成；但 Segment 时长不能写死，应根据所选视频模型能力、剧情节奏、生成模式和用户目标动态决定。未来模型支持 30 秒、60 秒或更长时，Segment 可自动调整。

```text
DirectorSegment
├── 剧情目的
├── 情绪曲线
├── 人物关系变化
├── 观众注意力中心
├── 类型片规则引用
├── 信息密度
├── 转场逻辑
├── 对白可执行性
├── 动作可信度
├── 导演手记
├── 导演视觉判断
├── 声音 / 对白设计
├── 绑定导演板
├── Control Level
├── 生成方式
├── 参考素材
├── 提示词包
├── 生成结果
└── 质检结果
```

### 7.8 Director Visual Decision

Director Visual Decision 是每个 Director Segment 必须具备的导演视觉判断。它不是用户必填表单，也不是固定分镜表，而是 AI Director 自动生成的视觉表达判断。

它回答：

```text
这一段应该用什么景别距离？
镜头应该静止、推近、跟拍，还是保持克制？
构图如何表达人物关系和空间压力？
光影如何服务情绪？
色彩和质感如何与整部戏统一？
节奏应该快还是慢？
哪些要明确控制，哪些交给视频模型发挥？
```

建议字段：

```text
DirectorVisualDecision
├── shotSizeTendency        景别倾向
├── cameraMovementTendency  镜头 / 运镜倾向
├── compositionTendency     构图倾向
├── lightingTendency        光影倾向
├── colorTendency           色彩倾向
├── rhythmTendency          节奏倾向
├── controlLevel            控制强度
└── directorReason          导演理由
```

原则：

1. AI Director 必须判断景别、镜头、构图、光影、色彩和节奏。
2. 这些判断不等于全部硬控，具体控制强度由 Control Level 决定。
3. 不要求用户填写这些字段，用户只需要接受、修改或重新生成。
4. Director Visual Decision 应服务情绪、叙事和连续性，而不是堆砌导演术语。

### 7.9 Segment Audio Pack

Segment Audio Pack 是每个 Director Segment 的声音与对白设计包。它不等于最终混音，也不要求本产品完成专业配音、音乐和音效合成；它负责把后续声音制作所需的信息结构化沉淀出来。

它回答：

```text
这一段是否有对白？
谁说话，说什么？
台词语气、停顿、情绪是什么？
是否需要旁白或内心独白？
环境声是什么？
关键音效是什么？
音乐情绪和节奏是什么？
字幕文本是什么？
声音如何和画面进入 / 离开状态衔接？
```

建议字段：

```text
SegmentAudioPack
├── dialogueLines        对白行
├── speakerRefs          说话角色与 Voice Card 引用
├── voiceDirection       语气 / 情绪 / 停顿 / 语速
├── narration            旁白 / 内心独白
├── ambientSound         环境声
├── soundEffects         关键音效
├── musicMood            音乐情绪与节奏
├── subtitleText         字幕文本
├── continuityRefs       与前后 Segment 的声音连续性引用
├── syncNotes            与画面动作或情绪点的同步说明
└── exportAssets         可导出的音频制作说明或临时音频
```

MVP 边界：

1. P0 必须生成对白文本、旁白文本、声音设计说明、字幕文本和基础 Voice Card。
2. P0 不要求生成最终配音、最终音乐和最终混音。
3. P1 可支持临时 TTS 配音、音效提示词、音乐提示词。
4. P2 可导出给剪辑软件或配音工具使用的声音制作包。

### 7.10 Sound Consistency

声音一致性和角色、场景、美术一致性同等重要。产品不应只生成一段段孤立的视频，而要让同一角色在不同 Director Segment 中保持相同的声音身份、说话习惯、语速、情绪范围和对白风格。

核心机制：

1. Voice Card
   - 每个主要角色都应生成声音设定卡。
   - 包含角色声音年龄感、音色、语速、语气、口头禅、情绪表达范围、方言/口音、禁用规则、可选 TTS voiceId、参考音频。
   - 同一角色在所有 Segment 中默认复用同一张 Voice Card。

2. Sound Design Card
   - 项目级声音设计卡，约束整部作品的声音气质。
   - 包含环境声风格、音乐情绪、沉默使用方式、音效密度、时代质感、紧张/舒缓段落的声音规则。

3. Segment Audio Pack
   - 段落级声音包，引用 Voice Card 和 Sound Design Card。
   - 描述当前段落谁说话、如何说、环境如何响、音乐如何进入和退出、字幕如何呈现。

4. Audio Continuity
   - 每个 Segment 需要知道前一段声音结束状态和下一段声音进入状态。
   - 例如上一段雨声是否延续、背景音乐是否淡出、角色情绪是否从压抑转为爆发。

产品边界：

1. 本产品负责生成和管理声音设定、对白、字幕、声音提示词、临时音频参考和导出包。
2. 本产品不做最终专业混音、母带、复杂音轨编辑和长片合成。
3. 最终配音、音乐、音效和混音可交给剪映、Premiere、达芬奇、CapCut、专业 TTS 或 DAW 工具完成。

### 7.11 Director Continuity Pack

Director Continuity Pack 是防止视频“每段都好看但连起来不成立”的导演连续性包。它不要求用户懂影视专业术语，而是由 AI Director 在分析原文、资产、前后 Segment 和模型能力后自动生成。

它覆盖：

```text
DirectorContinuityPack
├── narrativeFunction      这一段的叙事功能：铺垫 / 转折 / 冲突 / 揭示 / 释放 / 悬念
├── emotionState           情绪进入、峰值、退出状态
├── causalChain            因果链：上一段导致什么，本段发生什么，下一段承接什么
├── transitionLogic        转场逻辑：视觉、声音、动作、情绪如何衔接
├── performanceDirection   表演方向：表情、眼神、动作、身体状态、说话节奏
├── blockingDecision       场面调度：人物站位、距离、移动、遮挡、权力关系
├── timeSpaceContext       时空关系：时间、地点、天气、和前后段关系
├── relationshipArc        角色关系变化：信任、怀疑、压制、反抗、亲密、疏离
├── visualMotivation       视觉动机：为什么这样拍，而不是只列镜头术语
├── audienceFocus          观众注意力：这一段最应该看见什么、听见什么、理解什么
├── informationDensity     信息密度：本段展示 / 暗示 / 隐藏的信息
├── dialogueExecutability  对白可执行性：口型风险和替代表现方式
├── motionPlausibility     动作可信度：动作复杂度、手部风险、物体交互风险
├── negativeStyleRules     风格禁区：不要变成什么
├── modelCapabilityNotes   模型能力提醒：当前模型擅长 / 不擅长什么
└── continuityChecklist    连续性检查：服装、道具、伤口、天气、光线、声音、动作接续
```

关键说明：

1. Performance Card / 表演设定卡
   - 不是角色外貌卡，而是角色怎么演。
   - 包含表情、眼神、姿态、动作习惯、说话节奏、情绪爆发方式。
   - 用于避免同一个角色跨 Segment 表演气质突变。

2. Emotion Map / 情绪曲线
   - 项目级记录整部作品的情绪起伏。
   - Segment 级记录情绪进入、情绪峰值、情绪退出。
   - 用于避免每段都“用力过猛”或没有节奏。

3. Narrative Function / 叙事功能
   - 每个 Segment 必须说明它在整部视频里的作用。
   - 例如交代信息、制造悬念、升级冲突、释放情绪、承接转场。

4. Blocking / Staging Decision / 场面调度判断
   - 描述人物和物在空间里的关系，不等同于分镜。
   - 包括谁靠近谁、谁占据中心、谁被遮挡、谁退后、谁获得权力感。

5. Continuity Sheet / 连续性记录
   - 记录服装、道具、动作、天气、时间、场景状态、声音状态和人物伤痕等。
   - 用于保证前后 Segment 不互相打架。

6. Time-Space Context / 时空关系
   - 说明当前段落发生在何时何地，与上一段和下一段是什么关系。
   - 包括同一时刻、几小时后、回忆、梦境、平行叙事、地点切换。

7. Negative Style Rules / 风格禁区
   - 不只定义“要什么风格”，还要定义“不要变成什么”。
   - 例如不要土味短剧、不要广告片质感、不要过度动漫化、不要恐怖片光影。

8. Model Capability Profile / 模型能力档案
   - AI Director 必须知道当前视频模型适合什么、不适合什么。
   - 例如复杂多人互动、稳定文字、快速动作、长镜头、强角色一致性是否可靠。

9. Failure Memory / 失败案例记忆
   - 每次生成失败都要归因：角色变脸、表演不对、动作断裂、声音不一致、场景跳变、风格跑偏。
   - 后续生成时应自动避开同类失败。

P0 必须支持基础版：

1. 每个 Segment 有 narrativeFunction、emotionState、audienceFocus。
2. 每个 Segment 有基础 continuityChecklist。
3. 主要角色有基础 Performance Card。
4. 每次生成失败可记录 failureReason。

P1 增强：

1. 完整 Continuity Sheet。
2. Relationship Arc。
3. Blocking Decision。
4. Negative Style Rules。
5. Model Capability Profile。

### 7.12 Reference Asset

参考资产类型：

1. 原文素材。
2. 角色卡。
3. 角色三视图。
4. NPC 卡。
5. 场景卡。
6. 色彩卡。
7. 风格参考。
8. 首帧 / 尾帧。
9. 分镜草稿。
10. 导演手记。
11. 导演板。
12. 镜头提示词。
13. 对白 / 字幕文本。
14. 声音设计说明。
15. Voice Card / 角色声音设定卡。
16. Sound Design Card / 项目声音设计卡。
17. Music Mood Card / 音乐情绪卡。
18. Ambient Sound Card / 环境声卡。
19. 临时配音 / 音效 / 音乐参考。
20. Performance Card / 表演设定卡。
21. Emotion Map / 情绪曲线。
22. Continuity Sheet / 连续性记录。
23. Time-Space Context / 时空关系记录。
24. Failure Memory / 失败案例记录。
25. Director Production Bible。
26. Genre Contract / 类型片规则。
27. Audience Target / 观众对象。
28. Motif System / 关键意象系统。
29. Subtitle Style / 字幕风格。
30. Evaluation Rubric / 质检标准。
31. 生成视频片段。
32. 质检记录。

### 7.13 Asset Card 生成逻辑

Asset Card 是项目生产过程中沉淀的可复用视觉资产，包括角色卡、NPC 卡、场景卡、美术设定卡、风格卡、道具卡、首帧/尾帧参考卡等。它们不是普通文本卡片，也不是用户必须提前提供的素材，而是由系统根据原文、导演判断、生成策略和图片模型逐步生成。

生成逻辑：

```text
原文小说 / 文章 / 短句
-> 文本模型提取设定信息
-> AI Director 补全导演判断和视觉方向
-> 图片模型生成卡图
-> 保存为 Reference Asset
-> 后续 Director Segment 复用
```

不同 Asset Card 的信息结构不同，但都应包含“结构化设定 + 视觉生成结果 + 可复用提示词 + 来源血缘”。以角色卡为例，应至少包含：

1. 角色名称。
2. 角色身份和时代背景。
3. 外貌特征。
4. 年龄、性别、气质。
5. 性格特征。
6. 心理活动和情绪基调。
7. 人物关系。
8. 服装、妆造、道具。
9. 多角度参考图或三视图。
10. 适用于后续生成的提示词描述。

所有 Asset Card 的卡图都可由以下图片生成方式产生：

1. 文生图：从角色设定直接生成。
2. 图生图：基于已有角色图或草图优化。
3. 多参考图生图：结合多个角色、服装、风格或场景参考。
4. 文与图生图：结合文本设定和参考图片生成。

其他 Asset Card 遵循同样逻辑：

1. 场景卡：从原文提取时代、地点、空间、氛围、色彩、光影、环境元素，生成可复用场景参考。
2. 美术设定卡：从整部戏或某一段落的时代背景、颜色体系、环境氛围、灯光方向、质感、服化道、美术风格中生成统一视觉设定。
3. 风格卡：从目标视频类型、导演判断、镜头语言和参考方向中提取整体风格，生成风格参考。
4. NPC 卡：从剧情关系和人物功能中提取配角设定，生成配角视觉参考。
5. 道具卡：从剧情关键物、时代背景和人物关系中提取道具设定，生成道具参考。
6. 首帧/尾帧参考卡：根据 Segment 的开始/结束状态生成，用于图生视频或首尾帧视频生成。
7. 所有 Asset Card 都应在多个 Director Segment 中复用，保持角色、场景、美术、颜色、灯光、风格、声音和关键元素的一致性。

### 7.14 Asset Card 类型体系

影视和动画前期设定可以非常复杂，但产品不应一开始把所有专业分类都暴露给小白用户。建议采用三层体系：

```text
基础卡：MVP 必须支持，用户最容易理解。
扩展卡：第一轮增强，用于提升一致性和生产质量。
高级卡：专业项目或后续版本支持，默认不强制用户填写。
```

#### 基础卡 P0

1. 美术总设定卡
   - 统领整部戏的色调、光影、质感、年代、整体氛围。
   - 用于保证所有 Segment 的视觉统一。

2. 角色设定卡
   - 提取人物身份、外貌、年龄、性格、背景、人物关系、心理活动。
   - 由图片模型生成角色卡图，可包含正面、侧面、背面或多姿态参考。

3. 场景设定卡
   - 提取地点、时代、空间结构、环境氛围、光影、色调、主要陈设。
   - 由图片模型生成场景参考图。

4. 风格 / 色彩光影卡
   - 约束整部戏或段落的色彩体系、冷暖关系、光源方向、影调和质感。

5. Voice Card / 角色声音设定卡
   - 约束角色在全片中的声音身份、说话方式、情绪表达、口音、语速和对白习惯。

6. Sound Design Card / 项目声音设计卡
   - 约束整部戏的环境声、音乐情绪、音效密度、沉默使用方式和声音质感。

7. Director Segment 首帧 / 尾帧参考卡
   - 为单个 Segment 的图生视频或首尾帧视频生成服务。

#### 扩展卡 P1

1. 服饰设定卡
   - 角色服装、配饰、鞋帽、武器、妆造。

2. 道具设定卡
   - 随身道具、场景道具、功能道具，如武器、法器、机械、交通工具。

3. NPC / 配角设定卡
   - 配角、群像、群众角色、怪物、异兽、机甲、妖兽等。

4. 场景细化卡
   - 场景气氛图、平面布局、建筑单体、材质、室内陈设、自然环境。

5. 气氛图
   - 用于表达某段剧情、某个空间或某种情绪的大氛围。

#### 高级卡 P2

1. 世界观概念设定卡
   - 时代、文明、地理、规则、种族体系。

2. 符号纹样设定卡
   - 图腾、徽章、旗帜、文字、纹饰、logo。

3. 建筑风格规范卡
   - 建筑制式、雕刻、装饰语言、空间规则。

4. 载具 / 机械 / 机甲设定卡
   - 车辆、飞船、船只、坐骑、机器人、机关装置。

5. 特效概念设定卡
   - 法术光效、爆炸、粒子、能量、烟雾、幻境。

6. 镜头视觉参考板
   - 构图参考、镜头气氛、关键视觉参考，不等同于强制分镜。

产品默认只引导用户创建基础卡。扩展卡和高级卡应由 AI Director 根据项目复杂度自动建议生成，避免让用户一开始面对专业设定表。

## 8. 功能需求

### 8.1 Agent Factory

Agent Factory 是创建 AI Director / Video Production Agent 的入口。

MVP 边界：

1. P0 可以先内置一个默认 AI Director Agent，并允许用户基于默认配置创建 VideoProject。
2. P0 需要保留 AgentDNA / DirectorDNA / FactoryDNA 的数据结构和设置入口，但不要求完成复杂的 Agent Factory 自动创建闭环。
3. Agent Factory 的完整对话式创建、测试、发布和进化流程放入 P1。
4. 这样可以先验证“AI Director + VideoProject + Reference Asset + Director Segment + 生成工具 + 质检”的核心闭环，避免第一阶段被通用 Agent 创建平台带偏。

功能：

1. 对话式澄清用户目标。
2. 分析输入素材和期望视频类型。
3. 推荐 AI Director / Video Production Agent。
4. 生成 DirectorDNA / AgentDNA 草稿。
5. 推荐导演板、skills、tools、模型列表。
6. 生成 VideoProject 初始结构。
7. 进行测试和发布判断。
8. 保存为可运行 Agent。

### 8.2 AI Director 工作区

功能：

1. 用户可与 AI Director 对话。
2. 支持 `@素材` 引用。
3. AI Director 先输出导演判断，再输出执行建议。
4. 输出内容可保存为导演手记、角色卡、场景卡、导演板、段落方案、提示词包。
5. 支持用户确认、修改、重试。

### 8.3 VideoProject 工作台

功能：

1. 创建和管理项目。
2. 维护项目 Brief。
3. 管理源文本和参考素材。
4. 查看导演手记。
5. 查看角色卡、场景卡、风格卡。
6. 查看 Director Segment。
7. 查看生成结果和质检结果。
8. 支持继续迭代。

### 8.4 Director Board Library

功能：

1. 内置基础导演板。
2. 支持用户自定义导演板。
3. 支持 AI Director 推荐导演板。
4. 支持导演板版本化。
5. 支持按场景类型筛选。
6. 支持项目引用。

MVP 内置导演板：

1. 二人对话戏导演板。
2. 角色初登场导演板。
3. 情绪崩溃导演板。
4. 跑步追逐戏导演板。
5. 空景转场导演板。

### 8.5 Reference Asset Library

功能：

1. 上传图片、视频、文本、文件。
2. 保存 AI 生成结果为资产。
3. 资产分类管理。
4. 支持项目、Agent、段落维度筛选。
5. 支持 `@素材` 引用。
6. 记录来源血缘。
7. 删除项目或 Agent 不物理删除已保存资产。
8. 支持资产卡生成状态：待生成、生成中、已生成、需重试、已确认。
9. 支持同一角色 / 场景 / 风格资产在多个 Director Segment 中复用。

### 8.6 Segment Planner

功能：

1. 根据故事、目标时长和所选视频模型能力拆分 Director Segment。
2. 每段生成剧情目的、情绪曲线、人物关系变化。
3. 每段选择 Control Level。
4. 每段选择生成方式。
5. 每段绑定参考素材。
6. 每段生成提示词包。
7. 每段进入生成和质检。

### 8.7 Generation Tools

生成工具能力：

1. 文生视频。
2. 图生视频。
3. 首尾帧视频生成。
4. 多图参考视频生成。
5. 文生图。
6. 图生图。
7. 多参考图生图。
8. 文与图生图。
9. 角色卡图生成。
10. 场景卡图生成。
11. 风格卡图生成。
12. 视频任务轮询。
13. 生成结果自动保存为资产。

### 8.8 Director Evaluation

质检维度：

1. 情绪是否成立。
2. 镜头是否服务叙事。
3. 角色是否一致。
4. 参考素材是否正确使用。
5. 是否过度模板化。
6. 是否过度控制，限制 AI 创造力。
7. 是否适合继续生成下一段。

## 9. 界面与交互形态

### 9.1 界面原则

产品界面应是：

```text
专业、克制、清晰、资产密集、流程可见、对话驱动、右侧资产常驻。
```

不应是：

1. 营销型首页。
2. 普通聊天机器人。
3. 纯表单后台。
4. 重型剪辑软件。
5. 单模型生成页面。

### 9.2 推荐界面骨架

```text
Top Bar：当前 VideoProject / 搜索 / 设置 / 模型状态

左侧：项目、Agent、Segments、Assets、Boards、Settings

中间：AI Director 工作流
  - 对话
  - 导演判断
  - 导演手记
  - Director Segment 卡
  - 生成结果
  - 底部任务输入框

右侧：导演监控
  - 当前段落进度
  - 待确认事项
  - 生成任务
  - 最新资产
  - 绑定导演板
  - 质检风险
```

### 9.3 参考截图的取舍

从参考截图中应保留：

1. 三栏任务工作台。
2. 底部输入常驻。
3. Activity / Steps 折叠展示。
4. 右侧任务监控和产物面板。
5. 模型选择器。
6. 轻量、克制、低装饰的界面。

但要避免：

1. 通用 AI 助手空首页。
2. 普通文件列表式右侧栏。
3. 过度技术化的日志。
4. 过度留白。
5. 过早进入复杂 timeline 剪辑器。

## 10. MVP 范围

### 10.0 需求优先级

为便于直接进入研发拆解，需求按以下优先级执行：

```text
P0：MVP 必须实现，否则产品闭环不成立。
P1：MVP 后第一轮增强，影响产品可用性和复用能力。
P2：中长期能力，不阻塞第一版上线。
```

P0 范围：

1. VideoProject 创建和项目工作台。
2. AI Director Agent 对话区。
3. Director Notes 生成和保存。
4. Reference Asset Library 基础能力。
5. Director Segment 生成。
6. Control Level 判断。
7. 生成方式建议。
8. 至少一种图片生成工具和一种视频生成工具。
9. Segment Audio Pack、基础 Voice Card 和字幕文本。
10. Director Continuity Pack 基础版：叙事功能、情绪状态、观众注意力、连续性检查。
11. Director Production Bible 基础版：类型片规则、观众对象、信息密度、画面安全区、质检标准。
12. 生成任务异步状态：提交、排队中、进行中、等待供应商、轮询中、成功、失败、取消、超时、重试。
13. 关键资产版本和审批状态。
14. 生成过程 Trace / Activity。
15. 生成结果保存为资产。
16. 基础 Director Evaluation。
17. 基础安全审核和导出 manifest。
18. 内置默认 AI Director Agent，可支持创建项目和执行 P0 流程。

P1 范围：

1. Director Board Library。
2. 角色卡、场景卡、风格卡结构化编辑。
3. 多生成方式路由：图生视频、首尾帧、多图参考。
4. 资产血缘和复用次数。
5. Segment 级质检和重试。
6. 临时 TTS 配音、音效提示词、音乐提示词。
7. Performance Card、Continuity Sheet、Relationship Arc、Negative Style Rules。
8. Motif System、Subtitle Style、Motion Plausibility、Approval Gates。
9. Embedding / Rerank 资产检索。
10. Visual / Voice Consistency 检测。
11. 成本预算和模型路由策略。
12. Agent Factory 创建 AI Director Agent 的完整流程。

P2 范围：

1. 专业子 Agent。
2. 面向外部剪辑软件的资产包导出。
3. 可视化 workflow。
4. MCP 工具生态。
5. 声音制作包导出。
6. 导演风格市场。

### 10.1 必做

1. VideoProject 基础模型。
2. Reference Asset 类型扩展。
3. AI Director Agent 基础 DNA。
4. Director Notes 生成。
5. Director Segment 生成。
6. Control Level 判断。
7. 基础 Director Board Library。
8. 角色卡、场景卡、风格卡生成。
9. 至少接入一种图片生成和一种视频生成方式。
10. Segment Audio Pack、基础 Voice Card 和字幕文本生成。
11. Director Continuity Pack 基础版生成。
12. Director Production Bible 基础版生成。
13. 异步生成任务状态展示。
14. 关键资产版本与审批状态。
15. 生成过程 Trace / Activity。
16. 生成结果保存为资产。
17. 基础 Director Evaluation。
18. 基础安全审核和导出 manifest。
19. 三栏工作台界面。
20. 默认 AI Director Agent 初始化配置。

### 10.1.1 导出能力边界

P0 的导出能力只要求生成基础 `manifest.json`，并能记录项目、Segment、资产版本、提示词、声音包、质检结果和血缘关系。P0 不要求完成面向剪映、Premiere、达芬奇、CapCut 的完整资产包整理、批量导出和外部软件兼容性验证。

完整资产包导出、声音制作包导出、EDL/XML/JSON 项目描述导出属于 Phase 4 / P2 能力。

### 10.2 暂缓

1. 完整多 Agent 协作。
2. 复杂 timeline 剪辑。
3. 自动合成长视频。
4. 最终配音、音乐、混音和复杂音轨编辑。
5. 完整 MCP 生态。
6. 多人协作。
7. 导演风格市场。

## 11. 验收标准

### 11.1 产品验收

1. 用户输入一段小说或文章后，系统能生成导演判断。
2. 系统能说明为什么这样拍，而不是只给 prompt。
3. 系统能生成角色卡、场景卡或风格卡中的至少两类资产。
4. 系统能把内容拆成 Director Segment，并为每段给出建议时长。
5. 每个段落有 Control Level 和生成方式建议。
6. 每个段落有 Segment Audio Pack，包含对白、字幕和声音设计。
7. 主要角色有可复用 Voice Card，跨段落保持声音设定一致。
8. 每个段落有 Director Continuity Pack，包含叙事功能、情绪状态、观众注意力和基础连续性检查。
9. 主要角色有基础 Performance Card，跨段落保持表演气质一致。
10. 项目有 Director Production Bible，包含类型片规则、观众对象、信息密度和质检标准。
11. 每个 Segment 能说明对白可执行性、动作风险和基础转场逻辑。
12. 用户可以看到生成任务队列状态、失败原因、取消/重试结果和任务历史。
13. 关键资产有版本和审批状态，用户能确认或重新生成。
14. 用户可以引用参考素材参与生成。
15. 生成结果能保存为资产并在后续引用。
16. 导出资产包包含 manifest，记录资产、版本、Segment 引用和提示词。
17. 系统能给出导演维度质检意见。

### 11.2 体验验收

1. 用户不需要懂分镜，也能得到可理解的导演方案。
2. 用户可以看到 AI Director 的判断理由。
3. 用户可以选择接受、修改或重新生成导演判断。
4. 用户不会被迫填写复杂影视表单。
5. 用户能清楚知道当前 VideoProject 有哪些资产、哪些段落、哪些生成结果。

## 12. 阶段路线

### Phase 1：AI Director MVP

目标：跑通导演判断到生成片段的闭环。

范围：

1. VideoProject。
2. Director Notes。
3. Director Board。
4. Reference Asset。
5. Director Segment。
6. 基础生成工具。
7. Segment Audio Pack、基础 Voice Card 和字幕文本。
8. Director Continuity Pack 基础版。
9. Director Production Bible 基础版。

### Phase 2：资产复用与质检增强

目标：让项目资产真正可复用。

范围：

1. 角色一致性。
2. 场景一致性。
3. 风格一致性。
4. 声音一致性。
5. 表演一致性。
6. 连续性管理。
7. 类型片规则增强。
8. 关键意象系统。
9. 字幕风格、动作可信度和人工确认点。
10. Director Evaluation。
11. 失败案例反哺。

### Phase 3：专业子 Agent

目标：把复杂环节升级为独立 Agent。

可能子 Agent：

1. Story Analysis Agent。
2. Character Bible Agent。
3. Visual Style Agent。
4. Storyboard Draft Agent。
5. Video QA Agent。

### Phase 4：资产包导出与外部剪辑协作

目标：不内置剪辑合成能力，而是把资产和 Segment 视频整理成可被外部专业剪辑软件继续使用的项目资产包。

范围：

1. Segment 视频批量导出。
2. 角色卡、场景卡、美术设定卡、Voice Card、Sound Design Card、导演手记、提示词包导出。
3. 素材命名、目录结构、元数据清单。
4. 剪映、Premiere、达芬奇、CapCut 等外部软件友好的资产组织。
5. 对白、字幕、声音设计说明、临时音频和音效/音乐提示词导出。
6. 可选导出 EDL/XML/JSON 项目描述，但不在本产品中做最终剪辑合成。

## 13. 最终产品判断

最重要的取舍是：

```text
不要做一个泛泛的 Agent 平台。
不要做一个普通视频生成按钮。
不要做一个机械分镜工具。
不要做剪辑合成软件。
```

应该做：

```text
以 AI Director Agent 为主导，
以 VideoProject 为容器，
以 Reference Asset 为长期资产，
以导演判断和 Director Segment 为生产流程，
以 Voice Card、Sound Design Card 和 Segment Audio Pack 保持声音一致性，
以生成模型和工具调用为执行能力，
最终形成一个可复用、可迭代、可质检的视频资产与 Segment 视频生产工作台。
```

最终成片合成应交给市面上成熟剪辑软件完成。本产品负责把美术设定、声音设定、视觉资产、导演判断、Segment 视频和导出资产包做好。
