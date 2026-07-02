export type RewardLineType = "streak_reward" | "highlight_feedback" | "breakthrough_feedback";

export type StreakRewardDay = 1 | 7 | 14 | 30 | 50 | 100;
export type FutureStreakRewardDay = 365;
export type StreakLevel = "start" | "stable" | "rhythm" | "identity_forming" | "memory_anchor";
export type RewardEmotion = "calm" | "excitement" | "stability" | "pride" | "memory";

export const CURRENT_STREAK_REWARD_DAYS = [1, 7, 14, 30, 50, 100] as const satisfies readonly StreakRewardDay[];
export const FUTURE_STREAK_REWARD_DAYS = [365] as const satisfies readonly FutureStreakRewardDay[];
export const STREAK_LEVEL_DAYS = {
  start: 1,
  stable: 7,
  rhythm: 14,
  identity_forming: 30,
  memory_anchor: 100,
} as const satisfies Record<StreakLevel, StreakRewardDay>;

export const streakLevelEmotionMap = {
  start: "calm",
  stable: "excitement",
  rhythm: "stability",
  identity_forming: "pride",
  memory_anchor: "memory",
} as const satisfies Record<StreakLevel, RewardEmotion>;

export const DAILY_FEEDBACKS_KEY = "purple-cheer-daily-feedbacks";

export const rewardPriority: Record<RewardLineType, number> = {
  streak_reward: 1,
  breakthrough_feedback: 2,
  highlight_feedback: 3,
};

export function compareRewardLinePriority(first: RewardLineType, second: RewardLineType) {
  return rewardPriority[first] - rewardPriority[second];
}

export function sortRewardLinesByPriority(lines: RewardLineType[]) {
  return [...lines].sort(compareRewardLinePriority);
}

export function getStreakLevel(streakDays: number): StreakLevel {
  if (!Number.isFinite(streakDays)) {
    return "start";
  }

  const normalizedStreakDays = Math.max(0, Math.trunc(streakDays));

  if (normalizedStreakDays >= STREAK_LEVEL_DAYS.memory_anchor) {
    return "memory_anchor";
  }

  if (normalizedStreakDays >= STREAK_LEVEL_DAYS.identity_forming) {
    return "identity_forming";
  }

  if (normalizedStreakDays >= STREAK_LEVEL_DAYS.rhythm) {
    return "rhythm";
  }

  if (normalizedStreakDays >= STREAK_LEVEL_DAYS.stable) {
    return "stable";
  }

  return "start";
}

export function getRewardEmotion(streakLevel: StreakLevel): RewardEmotion {
  return streakLevelEmotionMap[streakLevel];
}
