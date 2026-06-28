# Reward Companion System 规格

更新时间：2026-06-25  
线上预览：https://reward-companion-system.vercel.app  
子项目路径：`reward-companion-system/`

## 0. Reward Engine 架构冻结

本节为当前 Reward Engine 的冻结设计规范。后续开发不得再重构奖励系统的核心结构，只能在本分层下补全内容、优化表现或扩展具体奖励形态。

### 0.1 五层结构

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

### 0.2 唯一职责

- `StudyProgress Layer` 只负责学习进度事实：连续天数、最近打卡日期、今日完成状态。
- `Reward Engine Core` 是唯一奖励决策中心，只能由这里判断是否解锁 Day1 / Day7 / Day14 / Day30 / Day50 / Day100。
- `Reward Scene Layer` 只负责展示全屏奖励，不直接写业务判断。
- `Feedback Layer` 只负责展示轻反馈，不抢占全屏奖励。
- `UI State Machine Layer` 只负责当前奖励内部交互状态，不重新计算奖励规则。

### 0.3 禁止事项

后续开发不允许：

- UI 自己计算奖励节点
- 视频控制业务状态
- Day 组件独立实现 reward 判断逻辑
- `RewardScene` 直接写 streak / reward line 业务判断
- 多套 state system 并存
- fallback UI 另起一套状态机

### 0.4 唯一规则

```text
Reward Engine Core 是唯一决策中心
UI 只负责展示 state
Video 只负责表现，不参与逻辑
```

视频可以通过 `onEnded` / `onError` 发出事件，但不能直接决定领取、收藏、关闭、奖励解锁或最终卡面结果。

### 0.5 允许扩展范围

可以继续做：

- Day14 / Day30 / Day50 / Day100 内容补全
- 收藏柜 `Collected Cards UI`
- `HomeDashboard` 体验优化
- 轻反馈动画优化

以上扩展必须遵守本节冻结分层结构。

## 1. 定位

奖励系统不是弹窗，不是普通「恭喜完成」提示，而是学习完成后的情绪回应。

连续学习里程碑进入全屏紫色演唱会应援舞台；答题全对、错题解决等单点高光使用轻反馈，不打断学习流程。

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

### 5.2 breakthrough_feedback：错题解决奖励

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
→ 可选择「重新抽一次」回到 pool
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
