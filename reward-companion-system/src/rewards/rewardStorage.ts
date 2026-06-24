const COLLECTED_REWARDS_KEY = "purple-cheer-collected-rewards";
const COLLECTED_CARDS_KEY = "purple-cheer-collected-cards";
const CURRENT_REWARD_DAYS = [1, 7, 14, 30, 50, 100] as const;

export type CollectedCard = {
  cardId: string;
  collectedAt: string;
  unlockedDay: number;
};

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

function normalizeCollectedCards(value: unknown): CollectedCard[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is CollectedCard => {
      if (!item || typeof item !== "object") {
        return false;
      }

      const card = item as Partial<CollectedCard>;
      return typeof card.cardId === "string" && typeof card.collectedAt === "string" && typeof card.unlockedDay === "number";
    })
    .filter((card, index, cards) => cards.findIndex((item) => item.cardId === card.cardId) === index);
}

function writeCollectedCards(cards: CollectedCard[]) {
  if (!canUseLocalStorage()) {
    return;
  }

  window.localStorage.setItem(COLLECTED_CARDS_KEY, JSON.stringify(normalizeCollectedCards(cards)));
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

export function getCollectedCards(): CollectedCard[] {
  if (!canUseLocalStorage()) {
    return [];
  }

  try {
    const rawValue = window.localStorage.getItem(COLLECTED_CARDS_KEY);

    if (!rawValue) {
      return [];
    }

    return normalizeCollectedCards(JSON.parse(rawValue));
  } catch {
    window.localStorage.removeItem(COLLECTED_CARDS_KEY);
    return [];
  }
}

export function isCardCollected(cardId: string): boolean {
  return getCollectedCards().some((card) => card.cardId === cardId);
}

export function collectCard(cardId: string, unlockedDay: number): void {
  const cards = getCollectedCards();

  if (cards.some((card) => card.cardId === cardId)) {
    return;
  }

  writeCollectedCards([
    ...cards,
    {
      cardId,
      collectedAt: new Date().toISOString(),
      unlockedDay,
    },
  ]);
}

export function resetCollectedCards(): void {
  if (!canUseLocalStorage()) {
    return;
  }

  window.localStorage.removeItem(COLLECTED_CARDS_KEY);
}

export function getNextRewardDay(streakDays: number): number | null {
  if (!Number.isFinite(streakDays)) {
    return null;
  }

  const normalizedStreakDays = Math.trunc(streakDays);

  for (const rewardDay of CURRENT_REWARD_DAYS) {
    if (normalizedStreakDays >= rewardDay && !isRewardCollected(rewardDay)) {
      return rewardDay;
    }
  }

  return null;
}

export { COLLECTED_CARDS_KEY, COLLECTED_REWARDS_KEY };
