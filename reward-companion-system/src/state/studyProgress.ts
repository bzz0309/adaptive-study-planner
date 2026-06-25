const STREAK_DAYS_KEY = "purple-cheer-streak-days";
const LAST_CHECKIN_DATE_KEY = "purple-cheer-last-checkin-date";

export type StreakUpdateResult = {
  streakDays: number;
  didIncrement: boolean;
  alreadyCheckedIn: boolean;
  checkinDate: string;
};

function canUseLocalStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function getTodayKey() {
  const date = new Date();
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeStreakDays(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.trunc(value));
}

function writeStreakDays(streakDays: number) {
  if (!canUseLocalStorage()) {
    return;
  }

  window.localStorage.setItem(STREAK_DAYS_KEY, String(normalizeStreakDays(streakDays)));
}

export function getStreakDays(): number {
  if (!canUseLocalStorage()) {
    return 0;
  }

  const rawValue = window.localStorage.getItem(STREAK_DAYS_KEY);

  if (!rawValue) {
    return 0;
  }

  const parsedValue = Number(rawValue);

  if (!Number.isFinite(parsedValue)) {
    window.localStorage.removeItem(STREAK_DAYS_KEY);
    return 0;
  }

  return normalizeStreakDays(parsedValue);
}

export function isTodayCheckedIn(): boolean {
  if (!canUseLocalStorage()) {
    return false;
  }

  return window.localStorage.getItem(LAST_CHECKIN_DATE_KEY) === getTodayKey();
}

export function incrementStreakIfNeeded(): StreakUpdateResult {
  const checkinDate = getTodayKey();
  const currentStreakDays = getStreakDays();

  if (!canUseLocalStorage()) {
    return {
      streakDays: currentStreakDays,
      didIncrement: false,
      alreadyCheckedIn: false,
      checkinDate,
    };
  }

  if (isTodayCheckedIn()) {
    return {
      streakDays: currentStreakDays,
      didIncrement: false,
      alreadyCheckedIn: true,
      checkinDate,
    };
  }

  const nextStreakDays = currentStreakDays + 1;
  writeStreakDays(nextStreakDays);
  window.localStorage.setItem(LAST_CHECKIN_DATE_KEY, checkinDate);

  return {
    streakDays: nextStreakDays,
    didIncrement: true,
    alreadyCheckedIn: false,
    checkinDate,
  };
}

export function setStreakDaysForDevelopment(streakDays: number): number {
  const normalizedStreakDays = normalizeStreakDays(streakDays);
  writeStreakDays(normalizedStreakDays);

  if (canUseLocalStorage()) {
    window.localStorage.removeItem(LAST_CHECKIN_DATE_KEY);
  }

  return normalizedStreakDays;
}

export function resetStudyProgress(): void {
  if (!canUseLocalStorage()) {
    return;
  }

  window.localStorage.removeItem(STREAK_DAYS_KEY);
  window.localStorage.removeItem(LAST_CHECKIN_DATE_KEY);
}

export { LAST_CHECKIN_DATE_KEY, STREAK_DAYS_KEY };
