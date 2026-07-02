import { useRef, useState } from "react";
import { LightFeedbackQueue, type QueuedLightFeedback } from "./LightFeedback";
import { MyCheerBox } from "./MyCheerBox";
import { RewardScene } from "./RewardScene";
import type { RewardDay } from "../config/rewardConfig";
import {
  collectReward,
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
  const [showCheerBox, setShowCheerBox] = useState(false);
  const [status, setStatus] = useState("选择今天的任务，完成后记录学习行为。");
  const didCollectActiveRewardRef = useRef(false);

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
      setStatus(`连续学习第 ${result.streakDays} 天，学习反馈已准备好。`);
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
    setStatus(`Day${activeRewardDay} 学习反馈已收下。`);
  }

  function handleCloseReward() {
    setActiveRewardDay(null);
    didCollectActiveRewardRef.current = false;
  }

  function handleCompleteReward() {
    const completedRewardDay = activeRewardDay;

    setActiveRewardDay(null);
    didCollectActiveRewardRef.current = false;

    if (completedRewardDay === 7) {
      setShowCheerBox(true);
    }
  }

  function resetAllProgress() {
    resetStudyProgress();
    resetCollectedRewards();
    resetCollectedCards();
    setStreakDays(0);
    setCheckedInToday(false);
    setActiveRewardDay(null);
    setFeedbackItems([]);
    setStatus("本地学习进度和反馈记录已重置。");
  }

  function simulateStreakDays(nextStreakDays: number) {
    const normalizedStreakDays = setStreakDaysForDevelopment(nextStreakDays);
    setStreakDays(normalizedStreakDays);
    setCheckedInToday(isTodayCheckedIn());
    setStatus(`已准备到连续学习第 ${normalizedStreakDays} 天。点击完成今天学习可验证下一个反馈节点。`);
  }

  if (showCheerBox) {
    return <MyCheerBox streakDays={streakDays} onContinue={() => setShowCheerBox(false)} />;
  }

  return (
    <main className="home-dashboard">
      <section className="home-shell" aria-label="学习陪伴首页">
        <header className="home-hero">
          <span className="home-eyebrow">Study Planner</span>
          <div>
            <p className="home-streak-label">今日学习闭环</p>
            <h1>计划、执行、完成</h1>
          </div>
          <p>{checkedInToday ? `今天已完成学习，连续学习第 ${streakDays} 天。` : `当前连续学习第 ${streakDays} 天，完成今天任务后会继续记录。`}</p>
        </header>

        <section className="home-grid">
          <article className="home-panel home-task-card">
            <span>学习任务流</span>
            <h2>开始 → 完成 → 记录</h2>
            <p>{status}</p>
            <button type="button" onClick={completeTodayStudy}>
              完成今天学习
            </button>
          </article>

          <article className="home-panel">
            <span>今日状态</span>
            <h2>{checkedInToday ? "今天已完成" : "等待完成记录"}</h2>
            <p>Reward Engine 只在学习完成后提供情绪反馈；成长回顾会在关键节点后出现。</p>
          </article>
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
          onComplete={handleCompleteReward}
        />
      ) : null}
    </main>
  );
}
