import { useMemo, useState } from "react";
import { RewardScene } from "../components/RewardScene";
import type { RewardDay } from "../config/rewardConfig";
import {
  collectReward,
  getCollectedRewards,
  getNextRewardDay,
  resetCollectedCards,
  resetCollectedRewards,
} from "../rewards/rewardStorage";

function toRewardDay(day: number): RewardDay {
  return day as RewardDay;
}

export function StudyCompleteDemo() {
  const [streakDays, setStreakDays] = useState(1);
  const [activeRewardDay, setActiveRewardDay] = useState<RewardDay | null>(null);
  const [status, setStatus] = useState("还没有完成今天学习");
  const [collectedVersion, setCollectedVersion] = useState(0);

  const collectedRewards = useMemo(() => getCollectedRewards(), [collectedVersion]);

  function handleCompleteStudy() {
    const nextRewardDay = getNextRewardDay(streakDays);

    if (nextRewardDay === null) {
      setStatus("今天的学习已完成");
      return;
    }

    setActiveRewardDay(toRewardDay(nextRewardDay));
    setStatus(`解锁 Day${nextRewardDay} 奖励`);
  }

  function handleCollectReward() {
    if (activeRewardDay === null) {
      return;
    }

    collectReward(activeRewardDay);
    setCollectedVersion((current) => current + 1);
    setStatus("奖励已收下");
  }

  function handleCloseReward() {
    setActiveRewardDay(null);
  }

  function handleReset() {
    resetCollectedRewards();
    resetCollectedCards();
    setCollectedVersion((current) => current + 1);
    setActiveRewardDay(null);
    setStatus("领取记录已重置");
  }

  return (
    <main className="study-demo">
      <section className="study-demo-panel">
        <span className="study-demo-eyebrow">开发预览</span>
        <h1>学习完成奖励触发</h1>
        <p>用这里模拟主站完成学习后的奖励判断。生产环境不会显示这个测试入口。</p>
        <p>把连续学习天数改成 14 / 30 / 50 / 100，可以分别模拟对应节点。</p>

        <label className="study-demo-field">
          <span>当前连续学习天数</span>
          <input
            min="1"
            type="number"
            value={streakDays}
            onChange={(event) => setStreakDays(Math.max(1, Number(event.target.value) || 1))}
          />
        </label>

        <div className="study-demo-actions">
          <button type="button" onClick={handleCompleteStudy}>
            完成今天学习
          </button>
          <button type="button" className="study-demo-secondary" onClick={handleReset}>
            重置领取记录
          </button>
        </div>

        <div className="study-demo-status">
          <strong>{status}</strong>
          <span>已领取：{collectedRewards.length > 0 ? collectedRewards.join("、") : "暂无"}</span>
        </div>
      </section>

      {activeRewardDay !== null && (
        <RewardScene
          rewardDay={activeRewardDay}
          onCollect={handleCollectReward}
          onClose={handleCloseReward}
        />
      )}
    </main>
  );
}
