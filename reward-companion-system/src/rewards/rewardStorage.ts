const COLLECTED_REWARDS_KEY = "purple-cheer-collected-rewards";
const REWARD_DAYS = [1, 7, 14, 30, 50, 100, 365] as const;

function canUseLocalStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function normalizeRewardDays(value: unknown): number[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .filter((day): day is number => typeof day === "number" && Number.isFinite(day))
        .map((day) => Math.trunc(day)),
    ),
  ).sort((a, b) => a - b);
}

function writeCollectedRewards(days: number[]) {
  if (!canUseLocalStorage()) {
    return;
  }

  window.localStorage.setItem(COLLECTED_REWARDS_KEY, JSON.stringify(normalizeRewardDays(days)));
}

export function getCollectedRewards(): number[] {
  if (!canUseLocalStorage()) {
    return [];
  }

  try {
    const rawValue = window.localStorage.getItem(COLLECTED_REWARDS_KEY);

    if (!rawValue) {
      return [];
    }

    return normalizeRewardDays(JSON.parse(rawValue));
  } catch {
    window.localStorage.removeItem(COLLECTED_REWARDS_KEY);
    return [];
  }
}

export function isRewardCollected(day: number): boolean {
  return getCollectedRewards().includes(day);
}

export function collectReward(day: number): void {
  writeCollectedRewards([...getCollectedRewards(), day]);
}

export function resetCollectedRewards(): void {
  if (!canUseLocalStorage()) {
    return;
  }

  window.localStorage.removeItem(COLLECTED_REWARDS_KEY);
}

export function getNextRewardDay(studyDays: number): number | null {
  if (!Number.isFinite(studyDays)) {
    return null;
  }

  const normalizedStudyDays = Math.trunc(studyDays);

  for (const rewardDay of REWARD_DAYS) {
    if (normalizedStudyDays >= rewardDay && !isRewardCollected(rewardDay)) {
      return rewardDay;
    }
  }

  return null;
}

export { COLLECTED_REWARDS_KEY };
