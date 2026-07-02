import { cheerBoxDays, getCheerBoxNodes, getCurrentCheerBoxDay, rewardConfig, type CheerBoxNode, type RewardDay } from "../config/rewardConfig";

type GrowthPhase = {
  className: string;
  days: RewardDay[];
  kicker: string;
  title: string;
};

type MyCheerBoxProps = {
  onContinue: () => void;
  streakDays: number;
};

const growthPhases: GrowthPhase[] = [
  {
    className: "is-build",
    days: [1, 7, 14],
    kicker: "阶段一",
    title: "建立节奏",
  },
  {
    className: "is-maintain",
    days: [30, 50, 100],
    kicker: "阶段二",
    title: "维持节奏",
  },
];

function normalizeStreakDays(streakDays: number) {
  if (!Number.isFinite(streakDays)) {
    return 0;
  }

  return Math.max(0, Math.trunc(streakDays));
}

function getNodesForPhase(days: RewardDay[], nodes: CheerBoxNode[]) {
  return nodes.filter((node) => days.includes(node.day));
}

export function MyCheerBox({ onContinue, streakDays }: MyCheerBoxProps) {
  const normalizedStreakDays = normalizeStreakDays(streakDays);
  const currentDay = getCurrentCheerBoxDay(normalizedStreakDays);
  const cheerBoxNodes = getCheerBoxNodes(normalizedStreakDays);
  const currentReward = rewardConfig[currentDay];

  return (
    <main className="cheer-box-page">
      <section className="cheer-box-shell" aria-label="My Cheer Box">
        <header className="cheer-box-hero">
          <span className="cheer-box-eyebrow">Growth Timeline</span>
          <div>
            <h1>My Cheer Box</h1>
            <p>连续学习第 {normalizedStreakDays} 天</p>
          </div>
          <strong>{currentReward.growth.meaning}</strong>
        </header>

        <section className="cheer-rhythm-layout" aria-label="双节奏成长结构">
          {growthPhases.map((phase) => (
            <section className={`cheer-rhythm-phase ${phase.className}`} key={phase.title}>
              <div className="cheer-phase-heading">
                <span>{phase.kicker}</span>
                <h2>{phase.title}</h2>
              </div>

              <div className="cheer-phase-path">
                {getNodesForPhase(phase.days, cheerBoxNodes).map((node) => {
                  const reward = rewardConfig[node.day];

                  return (
                    <article className={`cheer-growth-node is-${node.status} tone-${reward.growth.cheerBoxTone}`} key={node.day}>
                      <span className="cheer-node-day">{reward.growth.cheerBoxLabel}</span>
                      <div>
                        <h3>{reward.growth.cheerBoxLine}</h3>
                        <p>{reward.growth.stageName}</p>
                        <small>{reward.growth.cheerBoxDetail}</small>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </section>

        <section className="cheer-timeline" aria-label="Day1 到 Day100 辅助时间轴">
          {cheerBoxDays.map((day) => {
            const status = cheerBoxNodes.find((node) => node.day === day)?.status ?? "locked";

            return (
              <div className={`cheer-timeline-step is-${status}`} key={day}>
                <span />
                <strong>Day{day}</strong>
              </div>
            );
          })}
        </section>

        <footer className="cheer-box-cta">
          <div>
            <strong>你的节奏正在被记录</strong>
            <p>继续把今天这一小段走完。</p>
          </div>
          <button type="button" onClick={onContinue}>
            继续学习
          </button>
        </footer>
      </section>
    </main>
  );
}
