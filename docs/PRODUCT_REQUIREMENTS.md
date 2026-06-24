# 产品文档索引

更新时间：2026-06-25  
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
- 主站如何触发奖励系统
- 当前主站旧奖励原型边界

## 3. 奖励系统规格

阅读：[REWARD_SYSTEM_SPEC.md](./REWARD_SYSTEM_SPEC.md)

负责内容：

- RewardScene 架构
- 视频情绪层 + React 交互层
- 连续打卡奖励 `streak_reward`
- Day1 / Day7 / Day14 / Day30 / Day50 / Day100
- Day365 远期规划
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
