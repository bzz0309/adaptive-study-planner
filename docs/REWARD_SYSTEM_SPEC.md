# Reward Companion System 规格

更新时间：2026-07-01
线上预览：https://reward-companion-system.vercel.app  
子项目路径：`reward-companion-system/`

## 0. Product Architecture Freeze

最终产品架构冻结为 Learning Behavior Driven Study System（学习行为驱动系统）。

唯一允许的系统主线：

```text
HomeDashboard
→ 学习执行
→ 错题系统（可选强化）
→ Reward Engine（反馈）
→ My Cheer Box（回顾）
```

模块职责冻结：

- `HomeDashboard` 是学习行为入口，只负责学习任务展示与开始学习，不承载 reward / growth / video 逻辑。
- 错题系统是学习能力增强层，只负责错题记录、归因、复习和掌握状态，不参与 reward logic。
- `Reward Engine` 是情绪反馈层，只负责学习完成后的 Day1 / Day7 / Day14-100 反馈，不作为核心产品。
- `My Cheer Box` 是成长回顾层，只展示成长时间轴，不参与 reward 计算，不作为主入口。

最终收敛目标：

```text
Home = 学习行为入口
错题 = 学习强化
Reward = 情绪反馈
Cheer Box = 成长回顾
```

强约束：

- 不允许 Reward Engine 扩展为主系统
- 不允许 Cheer Box 升级为交互核心
- 不允许新增 state machine
- 不允许新增 reward flow
- 不允许 video 控制系统逻辑
- 不允许 UI 自行计算 reward

## 0.1 Reward Engine 架构冻结

本节为当前 Reward Engine 的冻结设计规范。后续开发不得再重构奖励系统的核心结构，只能在本分层下补全内容、优化表现或扩展具体奖励形态。

### 0.1.1 五层结构

Reward Companion System 必须严格遵守以下五层结构：

```text
StudyProgress Layer
→ streakDays
→ lastCheckinDate
→ today status

Reward Engine Core
→ getNextRewardDay(streakDays)
→ rewardConfig (1 / 7 / 14 / 30 / 50 / 100)
→ reward line rules

Reward Scene Layer
→ RewardScene
→ RewardVideoLayer
→ Day1 / Day7 / Day14 / Day30 / Day50 / Day100

Feedback Layer
→ HighlightFeedback
→ BreakthroughFeedback
→ LightFeedbackQueue

UI State Machine Layer
→ pool
→ drawing
→ front
→ back
→ collected
```

### 0.1.2 唯一职责

- `StudyProgress Layer` 只负责学习进度事实：连续天数、最近打卡日期、今日完成状态。
- `Reward Engine Core` 是唯一奖励决策中心，只能由这里判断是否解锁 Day1 / Day7 / Day14 / Day30 / Day50 / Day100。
- `Reward Scene Layer` 只负责展示全屏奖励，不直接写业务判断。
- `Feedback Layer` 只负责展示轻反馈，不抢占全屏奖励。
- `UI State Machine Layer` 只负责当前奖励内部交互状态，不重新计算奖励规则。

### 0.1.3 禁止事项

后续开发不允许：

- UI 自己计算奖励节点
- 视频控制业务状态
- Day 组件独立实现 reward 判断逻辑
- `RewardScene` 直接写 streak / reward line 业务判断
- 多套 state system 并存
- fallback UI 另起一套状态机

### 0.1.4 唯一规则

```text
Reward Engine Core 是唯一决策中心
UI 只负责展示 state
Video 只负责表现，不参与逻辑
```

视频可以通过 `onEnded` / `onError` 发出事件，但不能直接决定领取、收藏、关闭、奖励解锁或最终卡面结果。

### 0.1.5 冻结后的允许范围

Product Architecture Freeze 后，只允许做：

- bug fix
- 文案一致性修正
- 视觉稳定性优化
- 无逻辑扩展的轻反馈动效优化
- 不改变主路径的体验收口

禁止继续新增 DayX 逻辑、reward 类型、video flow、state machine 或 Cheer Box 主入口。

## 1. 定位

奖励系统不是弹窗，不是普通「恭喜完成」提示，而是学习完成后的情绪回应。

连续学习里程碑进入全屏紫色演唱会应援舞台；答题全对、错题解决等单点高光使用轻反馈，不打断学习流程。

## 1.1 Reward Engine v2：Growth System 设计层

v2 将 Reward Engine 从“奖励系统”升级为“学习成长系统”。

v1 流程：

```text
学习 → 打卡 → 奖励 → 完成
```

v2 目标：

```text
学习 → 连续成长 → 情绪反馈 → 身份变化 → 长期沉淀
```

核心定义：

```text
Reward 不再只是奖励，而是成长标记。
```

本轮 v2 只作为扩展层存在，不替换 v1 的 `getNextRewardDay(streakDays)`，不重写 `RewardScene`，不修改 Day7 状态机，不强制替换视频系统。

### 1.2 streakLevel

`streakLevel` 是 `streakDays` 之上的成长分层。

| streakDays | streakLevel | 语义 |
|---|---|---|
| 1 day | `start` | 被看见 |
| 7 days | `stable` | 被记录 |
| 14 days | `rhythm` | 形成节奏 |
| 30 days | `identity_forming` | 成为习惯 |
| 100 days | `memory_anchor` | 进入长期记忆 |

新增核心函数：

```ts
getStreakLevel(streakDays)
```

### 1.3 rewardEmotion

`rewardEmotion` 是成长阶段对应的情绪表达层。

| streakLevel | rewardEmotion | 当前节点 |
|---|---|---|
| `start` | `calm` | Day1 |
| `stable` | `excitement` | Day7 |
| `rhythm` | `stability` | Day14 |
| `identity_forming` | `pride` | Day30 |
| `memory_anchor` | `memory` | Day100 |

新增核心函数：

```ts
getRewardEmotion(streakLevel)
getRewardScene(streakLevel)
```

### 1.4 成长阶段语义

Day 节点语义从“奖励”升级为“成长阶段”：

| Day | v2 语义 | My Cheer Box v2 语义 |
|---|---|---|
| Day1 | 被看见 | 第一条记录 |
| Day7 | 被记录 | 第一次被记录 |
| Day14 | 形成节奏 | 节奏形成 |
| Day30 | 成为习惯 | 习惯稳定 |
| Day100 | 进入长期记忆 | 长期沉淀 |

`rewardConfig` 可以携带 `growth` 字段，用于渐进式支持 My Cheer Box v2、成长轨迹、身份阶段文案和长期沉淀视图。

### 1.5 Emotion Layer 设计层

Video Layer 在 v2 中升级为 Emotion Layer 的设计概念：

```text
idle → calm
draw → excitement
reveal → pride
```

注意：本轮只定义设计语义，不强制实现新的 video 系统。视频仍然只能表现情绪，不参与业务逻辑，不控制 state。

### 1.6 v2 兼容原则

- v1 所有功能继续可用
- `getNextRewardDay(streakDays)` 保留兼容
- `RewardScene` 结构保留
- Day7 仍只允许 `pool / drawing / front / back / collected`
- Day7 不新增独立 reward logic
- 不修改 PWA、build、deploy 流程
- v2 概念只能作为扩展层渐进接入

## 1.7 Reward Engine v2.1：成长模型定义层

v2.1 不是功能实现，不替代 v1 runtime，也不要求重构代码。v2.1 是 Reward Engine 的成长模型定义层，用于统一指导 Day1 ~ Day100 的语义、情绪系统、视频系统和 UI 展示逻辑。

### 1.7.1 成长曲线

| Day | 成长阶段 | 语义 |
|---|---|---|
| Day1 | 启动 | 被记录 |
| Day7 | 觉醒 | 第一次仪式 |
| Day14 | 稳定 | 节奏形成 |
| Day30 | 身份 | 学习者 |
| Day50 | 强化 | 留存锚点 |
| Day100 | 长期记忆 | 人格固化 |

### 1.7.2 情绪系统

| Day | emotion |
|---|---|
| Day1 | `calm` |
| Day7 | `excitement` |
| Day14 | `stability` |
| Day30 | `pride` |
| Day50 | `reinforcement` |
| Day100 | `memory_identity` |

### 1.7.3 视觉强度

| Day | visual intensity |
|---|---|
| Day1 | minimal glow |
| Day7 | cinematic reward |
| Day14 | soft reward |
| Day30 | identity glow |
| Day50 | pulse reinforcement |
| Day100 | cinematic memory scene |

### 1.7.4 Reward 类型映射

| Day | Reward 类型 |
|---|---|
| Day1 | LightFeedback |
| Day7 | Full Reward Scene |
| Day14 | Soft Reward |
| Day30 | Identity Reward |
| Day50 | Reinforcement Reward |
| Day100 | Memory Reward |

说明：这里的 Reward 类型是产品语义层定义，不要求立即改变当前组件名称或 runtime 结构。

### 1.7.5 UI State Machine 约束

Day7 UI State Machine 继续保持：

```text
pool → drawing → front → back → collected
```

v2.1 不得新增 state，不得拆分 `drawing`，不得新增 `reveal` phase，不得影响现有 Day7 状态机。

### 1.7.6 Video Layer 规则

Video Layer 仅作为情绪表达层：

- Day1：system boot
- Day7：draw + reveal
- Day14+：soft emotional transitions

视频不得控制 state，不得决定奖励是否领取、是否收藏、是否关闭，也不得承载 Reward Engine Core 的业务判断。

### 1.7.7 My Cheer Box v2

My Cheer Box v2 定义为成长时间轴系统，而不是简单卡片集合。

Day 节点用于表达成长阶段，不作为普通 UI reward list。未来实现时应围绕成长轨迹、阶段沉淀和身份变化组织，而不是只按卡片列表陈列。

### 1.7.8 v2.1 强约束

不允许：

- 用 v2.1 替代 v1 runtime
- UI 自行计算 reward
- video 控制 state
- reward 逻辑散落在组件中

v2.1 只能作为统一规则标准和渐进实现依据。

## 1.8 UX Freeze：体验收口

当前 Reward Engine v1 + v2 进入 UX Freeze。冻结目标不是继续扩展奖励系统，而是统一用户心智路径。本节为 Reward 反馈层内部体验收口，最终产品主线以 `Product Architecture Freeze` 为准。

唯一主线：

```text
HomeDashboard
→ Day7 Reward Scene
→ My Cheer Box v2
```

系统角色固定：

- `HomeDashboard`：学习行为入口，不承载 reward / growth / video 逻辑
- `Day7 Reward Scene`：唯一情绪奖励节点
- `My Cheer Box v2`：成长回顾工具，不作为主入口

目标状态：

```text
一个学习入口（Home）
一个奖励节点（Day7）
一个成长回顾（My Cheer Box）
```

UX Freeze 强约束：

- 不再新增 reward 类型
- 不再新增 state machine
- 不修改 Reward Engine Core 结构
- 不让 video 控制业务逻辑
- 不让 Cheer Box 接 reward logic
- 不继续扩展 Day7 phase
- 不再引入新的 UI flow
- 不再拆分 reward 逻辑
- 不再扩展 DayX 结构

Video 系统冻结为情绪表达层：

- `idle`：氛围
- `draw`：行为
- `front`：展示

video 不参与任何 state 决策。

### 1.8.1 v1 polish 体验规则

v1 polish 只允许体验、交互细节和视觉稳定性优化，不允许修改 Reward Engine 架构。

- Day7 `drawing` 阶段按钮必须禁用，文案保持「抽一张」
- Day7 `drawing → front` 必须保留 200~400ms 平滑过渡
- Day7 完成态主动作统一为「查看成长回顾」
- Day7 idle video 只在 pool 中作为氛围播放，使用延迟加载策略
- My Cheer Box v2 current 节点可以轻微呼吸，但不得游戏化
- HomeDashboard 主按钮统一为「继续学习」
- HomeDashboard 只保留 `streakDays` 和一句当前状态文案

### 1.8.2 System Re-balance：系统重心收口

系统重心固定为：

```text
Study Planner（核心）
→ Reward Engine（反馈层）
→ My Cheer Box（回顾层）
```

执行原则：

- Study Planner 是主产品，负责计划生成、任务执行、完成记录、错题复习和明日重点
- Reward Engine 降级为学习完成后的情绪反馈层，只在关键节点提供 Day1 / Day7 / Day14-100 反馈
- My Cheer Box 降级为成长回顾查看页，不作为主导航入口，不参与 reward logic
- 不新增 reward 类型、video flow、state machine 或 Day7 phase
- Reward Engine Core 继续只负责奖励节点判断，不扩大为主产品逻辑

### 1.8.3 Day14 / Day30 成长内容扩展

Day14 / Day30 只允许作为 My Cheer Box v2 内的成长内容扩展，不新增 reward flow，不新增 state machine，不引入 drawing / reveal，也不改变 Reward Engine Core。

强度曲线固定为：

```text
Day7 > Day14 > Day30
```

节点定位：

| Day | 产品语义 | 主文案 | 副文案 | 表现方式 |
|---|---|---|---|---|
| Day14 | 学习进入稳定状态 | 学习进入稳定阶段 | 节奏正在持续 | stable purple / slow breath / soft reward |
| Day30 | 从学习行为进入习惯形成 | 你已经形成习惯 | 节奏开始稳定存在 | lower saturation purple / stable halo / identity confirmation |

执行规则：

- Day7 仍是唯一情绪高潮节点
- Day14 是稳定反馈节点，不是抽卡或强揭示奖励
- Day30 是习惯确认节点，不是抽卡或 reveal 奖励
- Day14 / Day30 只能复用 My Cheer Box v2 展示
- Day14 / Day30 不得创建新页面、新视频流或新状态
- `rewardConfig.growth` 可以承载对应展示文案和视觉 tone，但不得承载新的奖励判断逻辑

### 1.8.4 Day50 / Day100 Endgame UX

Day50 / Day100 是长期留存情绪锚点（Retention Anchor），不是奖励、功能节点或新流程。

完整强度递减曲线固定为：

```text
Day7 > Day14 > Day30 > Day50 > Day100
```

节点定位：

| Day | 产品语义 | 主文案 | 表现方式 |
|---|---|---|---|
| Day50 | 稳定确认点 | 你一直在持续 | low saturation glow / soft presence / minimal breath |
| Day100 | 长期沉淀 / 生活融合 | 它已经成为你的日常 | memory tone / steady glow / near-static state |

执行规则：

- Day50 只能表达“你还在持续”的稳定确认，不得做成奖励事件
- Day100 只能表达“生活化沉淀”，不得做成强仪式或强揭示
- Day50 / Day100 只能在 My Cheer Box v2 节点中展示
- Day50 / Day100 不得新增 video、state、reward type 或 RewardScene flow

## 2. 技术栈

- React
- TypeScript
- Vite
- Framer Motion
- CSS
- 无后端
- `rewardConfig` 驱动全屏奖励内容

## 3. RewardScene 统一入口

```text
RewardScene
├── Day1Scene
├── Day7Card
├── Day14Player
├── Day30Ticket
├── Day50CheerFlag
├── Day100Poster
└── Day365Ocean
```

规则：

- `RewardScene` 是全屏连续奖励的唯一入口
- 所有全屏奖励内容由 `rewardConfig.ts` 驱动
- 不允许每个 Day 组件自己写死业务判断
- 不允许多个 rewardConfig
- Day 组件只负责渲染对应奖励形态
- `RewardScene` 负责统一选择奖励场景

## 4. 视频情绪层 + React 交互层

奖励系统采用三层结构：

```text
Background / Video Layer
→ AI 视频、底图、氛围动画
→ 不包含按钮、主文案、真实交互
→ pointer-events: none

UI Layer
→ 标题、副标题、卡片、按钮、状态提示
→ 翻面按钮、收下按钮、完成态按钮
→ pointer-events: auto

State Logic Layer
→ rewardDay、phase 状态机
→ onCollect / onClose / onComplete
→ localStorage、卡片收藏
→ 不依赖视频决定业务状态
```

视频只负责情绪和动效，不负责业务逻辑。

React 状态机始终是唯一状态源。视频只能通过 `onLoadedData`、`onEnded`、`onError` 通知 UI 层，不直接决定是否领取、是否收藏、是否关闭场景。

## 5. 奖励线

### 5.1 streak_reward：连续打卡奖励

定位：长期坚持。

使用全屏 `RewardScene`。

当前一期自动解锁节点：

- `streakDays >= 1`：Day1
- `streakDays >= 7`：Day7
- `streakDays >= 14`：Day14
- `streakDays >= 30`：Day30
- `streakDays >= 50`：Day50
- `streakDays >= 100`：Day100

365 天奖励保留为远期规划，不进入当前一期自动解锁。

### 5.2 breakthrough_feedback：错题解决反馈

定位：突破卡点。

不使用全屏 RewardScene，第一期只做轻反馈 `BreakthroughFeedback`。

触发场景：

- 首次解决错题
- 连续解决 3 道错题
- 一个知识点从错题队列移出
- 延迟变式题连续两次正确

### 5.3 highlight_feedback：答题全对奖励

定位：单日高光。

不使用全屏 RewardScene，第一期只做轻反馈 `HighlightFeedback`。

触发场景：

- 当天一组练习题全部正确
- 一次小测全部正确
- 某组题连续全对

## 6. 奖励优先级

同一天触发多个奖励时，按以下顺序排队：

1. `streak_reward`
2. `breakthrough_feedback`
3. `highlight_feedback`

轻反馈可以延迟展示，不能覆盖或打断全屏 `RewardScene`。

示例：

- 用户今天连续第 7 天，并且答题全对：先展示 Day7 `RewardScene`，Day7 完成后再展示「今日高光」轻反馈。
- 用户今天解决错题，但没有达到连续奖励节点：只展示 `BreakthroughFeedback`。

## 7. 当前实现状态

| 奖励节点 | 组件 | 状态 |
|---|---|---|
| Day1 | Day1Scene | 已完整实现，冻结 |
| Day7 | Day7Card | 已实现紫色应援歌词卡 |
| Day14 | Day14Player | 占位 |
| Day30 | Day30Ticket | 占位 |
| Day50 | Day50CheerFlag | 占位 |
| Day100 | Day100Poster | 占位 |
| Day365 | Day365Ocean | 远期规划占位 |

### 7.1 Day1 / Day7 产品基线

Day1 和 Day7 是当前已经进入产品级基线的两个成长节点。

| 节点 | streakLevel | rewardEmotion | 成长语义 | 当前产品状态 |
|---|---|---|---|---|
| Day1 | `start` | `calm` | 被看见 | 已完整实现并冻结 |
| Day7 | `stable` | `excitement` | 被记录 | 已实现五状态抽卡流程和 idle / drawing 视频 |

统一原则：

- Day1 不再随意修改视觉、动画、底图和文案
- Day7 不新增状态，不拆分 `drawing`，不新增 `reveal` phase
- Day1 / Day7 都由 `RewardScene` 统一承载
- Day1 / Day7 都是成长标记，不是孤立弹窗奖励

## 8. Day1 奖励场景

Day1 是「关系建立场景」，表达第一条学习记录已经留下，第一盏应援灯为用户亮起。

当前文案：

```text
英文：FIRST CHEER LIGHT
主标题：第一盏应援灯亮了
副标题：给今天也在坚持学习的你亮一下
卡片标签：DAY 1 · 首日点亮
卡片标题：今天的灯亮起来了
卡片描述：第一条记录已经留下，先陪你开始。
按钮：收下
领取反馈：+1 紫色应援灯
```

视觉方向：

- 紫色应援演唱会
- 泰蛋灯亮起
- 应援棒 / 灯海
- 聚光灯
- 治愈、陪伴、K-pop 氛围

当前背景素材：

```text
src/assets/reward/day1/day1-desktop.webp
src/assets/reward/day1/day1-mobile.webp
```

Day1 已冻结。后续不应随意修改视觉、动画、底图和文案。

## 9. Day7 紫色应援歌词卡

Day7 是轻量抽卡奖励，定位为「第一次真正收藏」。

当前体验流程：

```text
进入 Day7
→ pool：看到 idle / 卡池待机视频或静态卡池
→ 点击「抽一张」
→ drawing：播放 draw / reveal 视频或 CSS fallback 抽卡动画
→ front：展示 SSR 正面卡 Time Lapse, Timeless
→ 点击「查看背面」
→ back：展示背面歌词
→ 点击「查看正面」可返回 front
→ 点击「收下」
→ 记录奖励节点和卡片收藏
→ collected：显示完成态和轻反馈
→ 查看成长回顾，进入 My Cheer Box v2
```

卡片信息：

```text
id: day7_timelapse_timeless
rarity: SSR
title: Time Lapse, Timeless
cardNo: 19890309
unlockedDay: 7
firstDrop: true
```

背面歌词：

```text
변하지 않아
Last forever
永不改变，直到永远
```

完成态文案：

```text
有些努力，会留在时间里发光。
```

Day7 状态流转：

```text
pool
→ drawing
→ front
↔ back
→ collected
```

Day7 只允许以上 5 个状态。不得新增 `collecting`、`revealing`、`videoEnded` 等临时业务状态。

## 10. Day7 视频层

Day7 视频层分为两个表现阶段，但状态仍由 React `phase` 状态机唯一控制。

素材路径：

```text
src/assets/reward/day7/day7-idle-desktop.mp4
src/assets/reward/day7/day7-idle-mobile.mp4
src/assets/reward/day7/day7-draw-desktop.mp4
src/assets/reward/day7/day7-draw-mobile.mp4
```

视频职责：

- `phase=pool`：播放 `day7-idle-*`，循环播放，只表现卡池待机
- `phase=drawing`：播放 `day7-draw-*`，只播放一次，只表现选中 / 抽出 / reveal
- `phase=front`：展示正式 SSR 正面卡图，最终结果不依赖视频画面
- `phase=back`：展示正式背面卡图
- `phase=collected`：展示完成态和轻反馈

如果 `day7-draw-*` 视频不存在或加载失败：

- 使用现有 CSS fallback 抽卡动画
- 不白屏
- 仍由 Day7 状态机进入 `front`

如果视频加载失败：

- 标记视频不可用
- 回退到静态卡池或 CSS 抽卡动画
- 不影响用户继续完成抽卡和领取

如果用户开启 `prefers-reduced-motion`：

- 不自动播放视频
- 使用静态 fallback
- 仍保留完整交互流程

视频只能通过 `onEnded` / `onError` 通知状态机事件。视频不得直接决定 `phase`、领取状态、收藏状态或奖励结果。

## 11. 轻反馈组件

轻反馈用于非全屏奖励。

当前组件：

```text
LightFeedback
HighlightFeedback
BreakthroughFeedback
LightFeedbackQueue
```

特性：

- 不全屏
- 不进入收藏柜
- 不弹大 modal
- 不打断学习流程
- 默认 2.6 秒后自动消失
- 支持手动关闭
- 多个轻反馈排队展示，不同时叠加
- 尊重 `prefers-reduced-motion`

### 11.1 HighlightFeedback

默认文案：

```text
标题：今日高光
正文：今天的题目，被你稳稳拿下了。
```

短版：

```text
标题：全对通过
正文：今天这一组，很稳。
```

### 11.2 BreakthroughFeedback

首次解决错题：

```text
标题：突破卡点
正文：这道错题不是被跳过了，是被你慢慢拿下了。
```

短版：

```text
标题：卡点通过
正文：这次，真的会了。
```

知识点掌握：

```text
标题：掌握确认
正文：这个知识点，已经从错题队列毕业了。
```

## 12. localStorage keys

连续奖励领取状态：

```text
purple-cheer-collected-rewards
```

卡片收藏状态：

```text
purple-cheer-collected-cards
```

轻反馈同日去重预留：

```text
purple-cheer-daily-feedbacks
```

建议格式：

```json
{
  "2026-06-24": ["highlight_all_correct", "breakthrough_wrong_question"]
}
```

## 13. PWA

当前 Reward Companion System 已支持 iPhone 添加到主屏幕的基础 PWA 配置。

范围：

- `manifest.json`
- `apple-touch-icon`
- `apple-mobile-web-app-capable`
- `apple-mobile-web-app-status-bar-style`
- `apple-mobile-web-app-title`
- 192x192 图标
- 512x512 图标
- 180x180 Apple 图标

当前阶段不做复杂 service worker 离线缓存，避免缓存旧版本导致更新困难。

## 14. 主站接入方式

主站在用户完成学习行为后，根据奖励规则决定是否打开 RewardScene，或把轻反馈加入后续队列。

连续奖励：

```ts
const rewardDay = getNextRewardDay(streakDays)

if (rewardDay !== null) {
  setActiveRewardDay(rewardDay)
}
```

全屏奖励接入：

```tsx
<RewardScene
  rewardDay={activeRewardDay}
  onCollect={() => {
    collectReward(activeRewardDay)
  }}
  onClose={() => {
    // 关闭奖励场景
  }}
  onComplete={() => {
    // 返回学习页或继续后续流程
  }}
/>
```

接入原则：

- 主站负责判断是否触发奖励
- `RewardScene` 只负责展示连续打卡里程碑奖励
- 答题全对和错题解决第一期只用轻反馈，不进入全屏 `RewardScene`
- `onCollect` 负责记录奖励已领取
- `onClose` / `onComplete` 负责关闭奖励场景或回到学习页
- 同一天多奖励按 `streak_reward`、`breakthrough_feedback`、`highlight_feedback` 的顺序排队

## 15. 预览方式

线上预览：

```text
https://reward-companion-system.vercel.app
```

Day7 预览：

```text
https://reward-companion-system.vercel.app/?rewardDay=7
```

本地启动：

```bash
cd reward-companion-system
npm install
npm run dev
```

开发环境中提供 `StudyCompleteDemo`，用于模拟：

- 连续学习天数
- Day1 / Day7 / Day14 / Day30 / Day50 / Day100 解锁
- HighlightFeedback
- BreakthroughFeedback
- 轻反馈排队展示
