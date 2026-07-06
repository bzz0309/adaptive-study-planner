# 变更记录

## 2026-07-06

### Real Material Question Bank v1

- 将 TOPIK 练习题源策略收敛为“真实资料题库为主，AI 辅助讲解和补充”
- 新增真实资料题库设计规范，明确真题 / 教材 / 用户资料的题目结构、图片规则、答案解析和导入流程
- 新增真实资料题库样例数据，保留原图、原选项、标准答案、中文释义和中文解析
- 新增资料题库校验脚本，检查题目字段、选项数量、答案范围、图片路径和禁止答前展示中文解析图
- 后端资料题样例统一使用答题前图片，避免把中文翻译和解释提前展示给用户
- 保持现有学习流程、Reward Engine、Day7 state machine 和部署结构不变

## 2026-07-02

### Learning Behavior Record

- 将任务弹窗从“手动保存打卡”改为“系统自动学习记录”
- 移除用户手填完成状态、正确题数和总题数
- 练习完成后由系统自动统计正确题数、总题数、正确率、错题解释，并写入任务记录
- 用户只在完成学习答题后保留可选反思输入，不触发完成或 Reward 反馈
- 将练习结果文案从“写入打卡”调整为“系统自动记录”
- 将开始学习后的出题入口改为考试配置驱动：优先按考试类型、等级、目标等级和当前任务请求在线出题，本地题库只作为兜底
- 新增 `/api/study-assistant` 的 `practice` action，支持按 TOPIK I / TOPIK II / IELTS / 自定义学习目标返回结构化练习题
- `practice` 后端有 OpenAI key 时尝试在线生成同型题，无 key 或失败时返回可用兜底题
- `practice` 后端支持 `OPENAI_BASE_URL`，可接入 OpenAI-compatible 转发服务并通过 `/chat/completions` 生成题
- 为 `practice` 出题增加质量审查层：不合格题会被过滤，数量不足时由兜底题补齐
- 任务开始前可选择本组题数：5 / 10 / 15 / 20，系统按选择数量生成、判题和记录
- 明确当前出题机制：AI 生成计划，在线同型练习优先，本地题库兜底，练习结果由系统判题

## 2026-07-01

### Product Architecture Freeze

- 将最终产品定位冻结为 Learning Behavior Driven Study System（学习行为驱动系统）
- 固定唯一主路径：`HomeDashboard → 学习执行 → 错题系统（可选强化） → Reward Engine（反馈） → My Cheer Box（回顾）`
- 固定系统分层：
  - 学习行为：主系统
  - 错题强化：学习能力增强
  - Reward 反馈：情绪反馈层
  - Cheer Box：成长回顾层
- 冻结模块职责：
  - `HomeDashboard` 只负责学习任务展示与开始学习
  - 错题系统只负责错题记录、复习和掌握状态
  - Reward Engine 只负责学习完成后的情绪反馈
  - My Cheer Box 只负责成长时间轴展示
- 明确禁止 Reward Engine 扩展为主系统、Cheer Box 升级为交互核心、新增 state machine、新增 reward flow、video 控制系统逻辑、UI 自行计算 reward
- 本次仅更新架构规范和文档边界，不新增功能

### System Re-balance

- 将系统重心收口为 `Study Planner → Reward Engine feedback → My Cheer Box review`
- 明确 Study Planner 是主产品，负责学习计划、任务执行、完成记录、错题复习和明日重点
- 明确 Reward Engine 降级为学习完成后的情绪反馈层，不再承担主产品入口
- 明确 My Cheer Box 降级为成长回顾查看页，不作为主导航入口，不参与 reward logic
- HomeDashboard 第一屏从奖励入口收口为学习任务流入口，并移除 My Cheer Box 主入口卡片
- 未修改 Day1 / Day7 / video system / state machine / Reward Engine Core

## 2026-06-30

### Day50 / Day100 Endgame UX

- 在不修改 Reward Engine Core、state machine、video system、reward logic 的前提下扩展 Day50 / Day100 终局体验
- Day50 固定为长期留存的稳定确认点：
  - 主文案：你一直在持续
  - 视觉 tone：low saturation glow / soft presence / minimal breath
- Day100 固定为长期沉淀和生活融合节点：
  - 主文案：它已经成为你的日常
  - 视觉 tone：memory tone / steady glow / near-static state
- My Cheer Box v2 继续作为唯一展示位置，Day50 / Day100 不进入抽卡、reveal、新视频或新状态
- 完整视觉强度曲线固定为：`Day7 > Day14 > Day30 > Day50 > Day100`

## 2026-06-29

### Day14 / Day30 成长内容扩展

- 在不修改 Reward Engine Core、Day7 state machine、video flow 的前提下扩展 Day14 / Day30 成长内容
- Day14 固定为稳定反馈节点：
  - 主文案：学习进入稳定阶段
  - 副文案：节奏正在持续
  - 视觉 tone：stable purple / slow breath / soft reward
- Day30 固定为习惯确认节点：
  - 主文案：你已经形成习惯
  - 副文案：节奏开始稳定存在
  - 视觉 tone：lower saturation purple / stable halo / identity confirmation
- My Cheer Box v2 复用 `rewardConfig.growth` 展示 Day14 / Day30 文案和视觉 tone
- 保持 `Day7 > Day14 > Day30` 强度递减曲线，Day14 / Day30 不引入抽卡、reveal、新页面或新状态

### Reward Engine v1 polish

- 在不修改 Reward Engine Core、Day7 state machine、video flow 的前提下做产品级体验优化
- Day7 drawing 阶段按钮统一为禁用态「抽一张」，不可 hover、不可点击
- Day7 drawing → front 增加约 260ms 过渡，避免视频结束瞬间跳变
- Day7 完成态文案统一为「查看成长回顾」
- Day7 idle video 使用 metadata preload，保持进入 pool 后自动播放
- HomeDashboard 收敛为一个学习入口、一句状态和「继续学习」主按钮
- My Cheer Box v2 current 节点增加轻微呼吸，unlocked / locked 视觉层级更克制

### Reward Engine UX Freeze

- 将 Reward Engine v1 + v2 体验收口为单一主线：
  - `HomeDashboard`
  - `Day7 Reward Scene`
  - `My Cheer Box v2`
- 固定系统角色：
  - `HomeDashboard`：唯一学习入口
  - `Day7 Reward Scene`：唯一情绪奖励节点
  - `My Cheer Box v2`：成长回顾工具
- Day7 完成态从重复抽取收口为「查看成长回顾」
- 生产环境不再暴露 Day7 重复抽取路径，开发环境保留「重新预览」
- 明确 UX Freeze 期间不新增 reward 类型、不新增 state machine、不修改 Reward Engine Core、不让 video 控制 state
- 明确 video 仅作为 `idle / draw / front` 情绪表达层

## 2026-06-28

### Reward Engine v2.1 成长模型定义层

- 新增 v2.1 设计规范层，不替代 v1 runtime，不做代码重构
- 统一 Day1 ~ Day100 成长曲线：
  - Day1：启动 / 被记录
  - Day7：觉醒 / 第一次仪式
  - Day14：稳定 / 节奏形成
  - Day30：身份 / 学习者
  - Day50：强化 / 留存锚点
  - Day100：长期记忆 / 人格固化
- 统一 emotion mapping：
  - Day1：`calm`
  - Day7：`excitement`
  - Day14：`stability`
  - Day30：`pride`
  - Day50：`reinforcement`
  - Day100：`memory_identity`
- 统一 visual intensity：
  - Day1：minimal glow
  - Day7：cinematic reward
  - Day14：soft reward
  - Day30：identity glow
  - Day50：pulse reinforcement
  - Day100：cinematic memory scene
- 明确 My Cheer Box v2 是成长时间轴系统，不是普通卡片集合
- 保持 Day7 五状态不变：`pool / drawing / front / back / collected`
- 明确 v2.1 不允许 UI 自行计算 reward、不允许 video 控制 state、不允许 reward 逻辑散落在组件中

### Day1 / Day7 产品文档统一

- 统一 Day1 / Day7 在产品文档中的成长语义：
  - Day1：`start / calm / 被看见`
  - Day7：`stable / excitement / 被记录`
- 明确 Day1 是首日关系建立和第一条学习记录被看见
- 明确 Day7 是一周连续学习被记录，并进入可收藏小卡
- 在 `PRODUCT_OVERVIEW.md`、`PRODUCT_REQUIREMENTS.md`、`MAIN_APP_REQUIREMENTS.md`、`REWARD_SYSTEM_SPEC.md` 中同步 Day1 / Day7 当前产品基线

### Reward Engine v2 设计层

- 新增 Growth System 设计层
- 新增 `streakLevel`
- 新增 `rewardEmotion`
- 新增 `getStreakLevel(streakDays)`
- 新增 `getRewardEmotion(streakLevel)`
- 新增 `getRewardScene(streakLevel)`
- `getNextRewardDay(streakDays)` 保持 v1 兼容
- v2 当前只作为扩展层存在，不重写 Day7、不替换 RewardScene

### Day7 idle / drawing 视频接入

- 更新 Day7 pool 阶段视频：
  - `src/assets/reward/day7/day7-idle-mobile.mp4`
- 新增 Day7 drawing 阶段视频：
  - `src/assets/reward/day7/day7-draw-mobile.mp4`
- `pool` 继续只负责卡池待机视频
- `drawing` 继续只负责抽卡 / 揭晓正面视频
- draw 视频 `onEnded` 后由状态机进入 `front`
- 保持 Day7 五状态不变：`pool / drawing / front / back / collected`
- 视频失败时继续使用 CSS fallback，不白屏，不卡死

### Reward Engine 架构冻结

- 将 Reward Engine 架构冻结为五层结构：
  - `StudyProgress Layer`
  - `Reward Engine Core`
  - `Reward Scene Layer`
  - `Feedback Layer`
  - `UI State Machine Layer`
- 明确 `Reward Engine Core` 是唯一奖励决策中心
- 明确 UI 只负责展示 state，不自行计算 reward
- 明确视频只负责表现，只能通过事件通知状态机
- 明确 Day7 只允许 `pool / drawing / front / back / collected` 五个状态
- 禁止 Day 组件独立实现 reward logic、禁止多套 state system 并存

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
