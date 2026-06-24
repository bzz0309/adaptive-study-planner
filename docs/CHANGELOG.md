# 变更记录

## 2026-06-25

### 轻反馈组件版本

- 新增 `LightFeedback`
- 新增 `HighlightFeedback`
- 新增 `BreakthroughFeedback`
- 新增 `LightFeedbackQueue`
- 默认 2.6 秒自动消失
- 支持手动关闭
- 支持轻反馈队列：`breakthrough_feedback` 优先于 `highlight_feedback`
- 不修改 Day1 / Day7 / RewardVideoLayer / PWA

### 三条奖励线版本

- 奖励系统拆成三条奖励线：
  - `streak_reward`
  - `breakthrough_feedback`
  - `highlight_feedback`
- 连续打卡奖励继续使用全屏 RewardScene
- 答题全对和错题解决第一期只使用轻反馈
- 新增 `rewardTypes.ts`
- 新增 `feedbackConfig.ts`
- 文档明确同一天多奖励按优先级排队展示

### streakDays 奖励规则版本

- 奖励解锁语义从学习天数统一为连续学习天数 `streakDays`
- 当前一期节点：
  - Day1
  - Day7
  - Day14
  - Day30
  - Day50
  - Day100
- Day365 保留为远期规划，不进入当前一期自动解锁
- localStorage key 保持不变

## 2026-06-24

### Day7 视频层架构版本

- Reward 系统升级为「视频情绪层 + React 交互层」
- Day7 预留 AI 视频素材路径：
  - `src/assets/reward/day7/day7-draw-desktop.mp4`
  - `src/assets/reward/day7/day7-draw-mobile.mp4`
- 无视频素材时自动回退到 CSS / 静态卡池 fallback
- React state machine 继续作为唯一业务状态源
- 视频不控制领取、不控制收藏、不控制关闭

### Day7 歌词卡版本

- Day7 实现紫色应援歌词卡
- 首次触发固定抽出 SSR 卡：
  - `Time Lapse, Timeless`
  - `NO. 19890309`
- 实现 7 张隐藏属性缩略图扇形卡池
- 抽卡前卡池加暗色遮罩和模糊，避免提前剧透
- 支持正反面翻卡
- 背面歌词：

```text
변하지 않아
Last forever
永不改变，直到永远
```

- 点击「收下」后记录：
  - `purple-cheer-collected-rewards`
  - `purple-cheer-collected-cards`
- 完成文案：

```text
有些努力，会留在时间里发光。
```

### PWA 版本

- 增加 `manifest.json`
- 增加 iPhone 添加到主屏幕支持
- 增加基础图标：
  - 192x192
  - 512x512
  - apple-touch-icon 180x180
- 当前阶段不做复杂 service worker 离线缓存

## 2026-06-23

### Day1 冻结版

- Day1 RewardScene 完整实现并冻结
- 使用横竖两张无主文案底图：
  - `day1-desktop.webp`
  - `day1-mobile.webp`
- React / HTML 负责标题、副标题、奖励卡片和按钮
- 支持暗场、底图渐亮、标题出现、卡片浮入、按钮呼吸
- 点击「收下」后：
  - 按钮禁用
  - `+1 紫色应援灯`
  - 粒子 / 光波反馈
  - RewardScene 淡出
  - `onCollect` 只触发一次
- 独立预览模式增加兜底结束态：

```text
已收下
今天也继续发光吧
重新预览
```
