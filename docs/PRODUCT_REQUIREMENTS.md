# 产品文档索引

更新时间：2026-07-01
项目仓库：https://github.com/bzz0309/adaptive-study-planner  
线上奖励系统预览：https://reward-companion-system.vercel.app

此文件现在作为产品文档入口，不再承载所有细节。后续开发请优先按主题阅读下面的拆分文档。

## 1. 产品总览

阅读：[PRODUCT_OVERVIEW.md](./PRODUCT_OVERVIEW.md)

负责内容：

- 产品定位
- 目标用户
- 核心体验
- 主流程概览
- 产品语气与情绪目标

## 2. 主站功能需求

阅读：[MAIN_APP_REQUIREMENTS.md](./MAIN_APP_REQUIREMENTS.md)

负责内容：

- 多考试学习规划
- 学习信息填写
- 课程表生成
- 每日打卡
- 明日重点
- 资料上传与 AI 核验
- 账号与云同步
- 主站如何触发反馈层
- Product Architecture Freeze：Learning Behavior Driven Study System
- System Re-balance：Study Planner 为核心，Reward Engine 为反馈层，My Cheer Box 为回顾层
- 当前主站旧奖励原型边界

## 3. Reward 反馈层规格

阅读：[REWARD_SYSTEM_SPEC.md](./REWARD_SYSTEM_SPEC.md)

负责内容：

- RewardScene 架构
- 视频情绪层 + React 交互层
- 连续打卡奖励 `streak_reward`
- Day1 / Day7 / Day14 / Day30 / Day50 / Day100
- Reward Engine v2：Growth System 设计层
- Reward Engine v2.1：完整成长曲线 + 视觉映射设计层
- Product Architecture Freeze：`HomeDashboard → 学习执行 → 错题系统 → Reward Engine → My Cheer Box`
- System Re-balance：`Study Planner → Reward Engine feedback → My Cheer Box review`
- Day1：`start / calm / 被看见`
- Day7：`stable / excitement / 被记录`
- Day14：稳定反馈节点，仅在 My Cheer Box v2 展示
- Day30：习惯确认节点，仅在 My Cheer Box v2 展示
- Day50：稳定确认点，仅在 My Cheer Box v2 展示
- Day100：生活化沉淀节点，仅在 My Cheer Box v2 展示
- Day7 idle / drawing 视频阶段
- Day365 远期规划，不进入当前自动解锁
- 三条奖励线
- HighlightFeedback / BreakthroughFeedback 轻反馈
- localStorage keys
- PWA
- 主站接入方式

奖励系统内容以此文档为主。

## 4. 错题系统规格

阅读：[WRONG_QUESTION_SYSTEM.md](./WRONG_QUESTION_SYSTEM.md)

负责内容：

- 错题来源
- 历史错题导入
- 错题归因
- 复习队列
- 变式练习
- 掌握标准
- 明日重点联动
- 错题轻反馈 `BreakthroughFeedback`

错题系统内容以此文档为主。

## 5. 变更记录

阅读：[CHANGELOG.md](./CHANGELOG.md)

记录内容：

- Day1 冻结版
- Day7 歌词卡版本
- Day7 视频层架构版本
- Reward Engine v2 设计层
- Reward Engine v2.1 成长模型定义层
- Reward Engine UX Freeze
- Day1 / Day7 产品文档统一
- PWA 版本
- `streakDays` 奖励规则版本
- 三条奖励线版本
- 轻反馈组件版本

## 6. 文档维护规则

- 涉及主站学习流程，更新 `MAIN_APP_REQUIREMENTS.md`
- 涉及奖励表现、奖励规则、PWA、RewardScene，更新 `REWARD_SYSTEM_SPEC.md`
- 涉及错题闭环，更新 `WRONG_QUESTION_SYSTEM.md`
- 涉及已完成的重要版本，更新 `CHANGELOG.md`
- `PRODUCT_REQUIREMENTS.md` 只维护索引和阅读路径
