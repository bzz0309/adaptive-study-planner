import { useMemo, useRef, useState } from "react";
import { LightFeedbackQueue, type QueuedLightFeedback } from "./LightFeedback";
import { RewardScene } from "./RewardScene";
import type { RewardDay } from "../config/rewardConfig";
import {
  collectReward,
  getCollectedRewards,
  getNextRewardDay,
  resetCollectedCards,
  resetCollectedRewards,
} from "../rewards/rewardStorage";
import {
  getStreakDays,
  incrementStreakIfNeeded,
  isTodayCheckedIn,
  resetStudyProgress,
  setStreakDaysForDevelopment,
} from "../state/studyProgress";

function toRewardDay(day: number): RewardDay {
  return day as RewardDay;
}

export function HomeDashboard() {
  const [streakDays, setStreakDays] = useState(() => getStreakDays());
  const [checkedInToday, setCheckedInToday] = useState(() => isTodayCheckedIn());
  const [activeRewardDay, setActiveRewardDay] = useState<RewardDay | null>(null);
  const [feedbackItems, setFeedbackItems] = useState<QueuedLightFeedback[]>([]);
  const [status, setStatus] = useState("完成今天学习后，会生成明日重点。");
  const [version, setVersion] = useState(0);
  const didCollectActiveRewardRef = useRef(false);

  const collectedRewards = useMemo(() => getCollectedRewards(), [version]);

  function enqueueHighlightFeedback() {
    setFeedbackItems((current) => [
      ...current,
      {
        queueId: `highlight-${Date.now()}-${current.length}`,
        feedbackId: "highlight_all_correct",
      },
    ]);
  }

  function dismissFeedback(queueId: string) {
    setFeedbackItems((current) => current.filter((item) => item.queueId !== queueId));
  }

  function openRewardScene(rewardDay: RewardDay) {
    didCollectActiveRewardRef.current = false;
    setActiveRewardDay(rewardDay);
  }

  function completeTodayStudy() {
    const result = incrementStreakIfNeeded();
    setStreakDays(result.streakDays);
    setCheckedInToday(result.alreadyCheckedIn || result.didIncrement);

    if (result.alreadyCheckedIn) {
      setStatus("今天已经完成过了，连续天数不会重复增加。");
      return;
    }

    const nextRewardDay = getNextRewardDay(result.streakDays);

    if (nextRewardDay !== null) {
      setStatus(`连续学习第 ${result.streakDays} 天，解锁 Day${nextRewardDay} 应援奖励。`);
      openRewardScene(toRewardDay(nextRewardDay));
      return;
    }

    setStatus("今天的学习已完成，明日重点已准备生成。");
    enqueueHighlightFeedback();
  }

  function handleCollectReward() {
    if (activeRewardDay === null || didCollectActiveRewardRef.current) {
      return;
    }

    didCollectActiveRewardRef.current = true;
    collectReward(activeRewardDay);
    setVersion((current) => current + 1);
    setStatus(`Day${activeRewardDay} 奖励已收下。`);
  }

  function handleCloseReward() {
    setActiveRewardDay(null);
    didCollectActiveRewardRef.current = false;
  }

  function resetAllProgress() {
    resetStudyProgress();
    resetCollectedRewards();
    resetCollectedCards();
    setStreakDays(0);
    setCheckedInToday(false);
    setActiveRewardDay(null);
    setFeedbackItems([]);
    setVersion((current) => current + 1);
    setStatus("本地学习进度和奖励领取记录已重置。");
  }

  function simulateStreakDays(nextStreakDays: number) {
    const normalizedStreakDays = setStreakDaysForDevelopment(nextStreakDays);
    setStreakDays(normalizedStreakDays);
    setCheckedInToday(isTodayCheckedIn());
    setStatus(`已准备到连续学习第 ${normalizedStreakDays} 天。点击完成今天学习可验证下一个奖励节点。`);
  }

  return (
    <main className="home-dashboard">
      <section className="home-shell" aria-label="学习陪伴首页">
        <header className="home-hero">
          <span className="home-eyebrow">Purple Cheer Companion</span>
          <div>
            <p className="home-streak-label">当前连续学习天数</p>
            <h1>连续学习第 {streakDays} 天</h1>
          </div>
          <p>{checkedInToday ? "今天已经留下记录了。" : "完成今天学习后，会为你判断是否点亮新的应援奖励。"}</p>
        </header>

        <section className="home-grid">
          <article className="home-panel home-task-card">
            <span>今日学习任务</span>
            <h2>完成一组练习 / 复习错题 / 查看明日重点</h2>
            <p>先把今天这一小段走完，系统会根据结果更新连续天数和奖励状态。</p>
            <button type="button" onClick={completeTodayStudy}>
              完成今天学习
            </button>
          </article>

          <article className="home-panel">
            <span>明日重点</span>
            <p>明日重点将在你完成今天学习后生成。</p>
          </article>

          <article className="home-panel cheer-cabinet-card">
            <span>收藏入口</span>
            <h2>我的应援柜</h2>
            <p>之后会在这里整理已收下的小卡、票根、海报和应援记录。</p>
            <button type="button" aria-label="打开我的应援柜">
              我的应援柜
            </button>
          </article>
        </section>

        <section className="home-status" aria-live="polite">
          <strong>{status}</strong>
          <span>已领取奖励：{collectedRewards.length > 0 ? collectedRewards.join("、") : "暂无"}</span>
        </section>

        {import.meta.env.DEV ? (
          <section className="home-dev-tools" aria-label="开发调试">
            <span>开发调试</span>
            <div>
              {[1, 7, 14, 30, 50, 100].map((day) => (
                <button type="button" key={day} onClick={() => simulateStreakDays(day - 1)}>
                  准备 Day{day}
                </button>
              ))}
              <button type="button" onClick={resetAllProgress}>
                重置进度与奖励
              </button>
            </div>
          </section>
        ) : null}
      </section>

      <LightFeedbackQueue items={feedbackItems} onDismiss={dismissFeedback} />

      {activeRewardDay !== null ? (
        <RewardScene
          rewardDay={activeRewardDay}
          onCollect={handleCollectReward}
          onClose={handleCloseReward}
          onComplete={handleCloseReward}
        />
      ) : null}
    </main>
  );
}
