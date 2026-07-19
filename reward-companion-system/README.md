# 学习陪伴奖励系统

紫色应援演唱会风格的成长奖励系统。完成学习后进入 `RewardScene`，由统一配置驱动不同奖励场景。

## 结构

```txt
RewardScene
├── Day1Scene
├── Day7Card
├── Day14Player
├── Day30Ticket
├── Day50CheerFlag
├── Day100Poster
├── Day365Ocean
```

当前已完整实现并冻结 `Day1Scene`，`Day7Card` 已实现抽卡、正反面查看与收藏五状态流程；Day14 及之后节点仍为 placeholder。

## 运行

```bash
npm install
npm run dev
```
