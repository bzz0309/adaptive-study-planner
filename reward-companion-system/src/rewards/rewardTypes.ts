export type RewardLineType = "streak_reward" | "highlight_feedback" | "breakthrough_feedback";

export type StreakRewardDay = 1 | 7 | 14 | 30 | 50 | 100;
export type FutureStreakRewardDay = 365;

export const CURRENT_STREAK_REWARD_DAYS = [1, 7, 14, 30, 50, 100] as const satisfies readonly StreakRewardDay[];
export const FUTURE_STREAK_REWARD_DAYS = [365] as const satisfies readonly FutureStreakRewardDay[];

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
