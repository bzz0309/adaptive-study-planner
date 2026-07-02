import { getRewardEmotion, type RewardEmotion, type StreakLevel } from "../rewards/rewardTypes";

export type RewardDay = 1 | 7 | 14 | 30 | 50 | 100 | 365;

export type RewardSceneType =
  | "Day1Scene"
  | "Day7Card"
  | "Day14Player"
  | "Day30Ticket"
  | "Day50CheerFlag"
  | "Day100Poster"
  | "Day365Ocean";

export type RewardCopy = {
  eyebrow: string;
  title: string;
  subtitle: string;
  badge: string;
  cardTitle: string;
  cardBody: string;
  cta: string;
  gain: string;
  placeholderTitle: string;
  placeholderBody: string;
};

export type RewardVisual = {
  glow: string;
  accent: string;
  card: string;
};

export type GrowthStageSemantic = {
  streakLevel: StreakLevel;
  emotion: RewardEmotion;
  stageName: string;
  meaning: string;
  cheerBoxLabel: string;
  cheerBoxLine: string;
  cheerBoxDetail: string;
  cheerBoxTone: "start" | "climax" | "stable" | "identity" | "reinforcement" | "memory";
};

export type CheerBoxNodeStatus = "unlocked" | "current" | "locked";

export type CheerBoxNode = {
  day: RewardDay;
  status: CheerBoxNodeStatus;
};

export type RewardConfigItem = {
  day: RewardDay;
  sceneType: RewardSceneType;
  growth: GrowthStageSemantic;
  copy: RewardCopy;
  visual: RewardVisual;
};

export const streakLevelSceneMap = {
  start: "Day1Scene",
  stable: "Day7Card",
  rhythm: "Day14Player",
  identity_forming: "Day30Ticket",
  memory_anchor: "Day100Poster",
} as const satisfies Record<StreakLevel, RewardSceneType>;

export function getRewardScene(streakLevel: StreakLevel): RewardSceneType {
  return streakLevelSceneMap[streakLevel];
}

export const rewardConfig: Record<RewardDay, RewardConfigItem> = {
  1: {
    day: 1,
    sceneType: "Day1Scene",
    growth: {
      streakLevel: "start",
      emotion: getRewardEmotion("start"),
      stageName: "启动",
      meaning: "第一条学习记录被系统看见。",
      cheerBoxLabel: "Day1",
      cheerBoxLine: "一切从这里开始",
      cheerBoxDetail: "第一条记录被看见",
      cheerBoxTone: "start",
    },
    copy: {
      eyebrow: "FIRST CHEER LIGHT",
      title: "第一盏应援灯亮了",
      subtitle: "给今天也在坚持学习的你亮一下",
      badge: "DAY 1 · 首日点亮",
      cardTitle: "今天的灯亮起来了",
      cardBody: "第一条记录已经留下，先陪你开始。",
      cta: "收下",
      gain: "+1 紫色应援灯",
      placeholderTitle: "首日点亮",
      placeholderBody: "关系建立场景已完成。",
    },
    visual: {
      glow: "#d9c4ff",
      accent: "#f7d7ff",
      card: "rgba(121, 82, 176, 0.44)",
    },
  },
  7: {
    day: 7,
    sceneType: "Day7Card",
    growth: {
      streakLevel: "stable",
      emotion: getRewardEmotion("stable"),
      stageName: "觉醒",
      meaning: "连续七天开始形成可回看的成长记录。",
      cheerBoxLabel: "Day7",
      cheerBoxLine: "节奏开始形成",
      cheerBoxDetail: "第一次仪式",
      cheerBoxTone: "climax",
    },
    copy: {
      eyebrow: "ENCORE CARD",
      title: "一周安可",
      subtitle: "连续出现的七天，已经很值得被看见。",
      badge: "DAY 7 · 一周安可",
      cardTitle: "一周安可",
      cardBody: "连续出现的七天，已经很值得被看见。",
      cta: "预览",
      gain: "+1 安可小卡",
      placeholderTitle: "Day7Card 占位",
      placeholderBody: "这里之后会做成一张可收藏的小卡奖励。",
    },
    visual: { glow: "#cab7ff", accent: "#fff3b0", card: "rgba(103, 72, 166, 0.4)" },
  },
  14: {
    day: 14,
    sceneType: "Day14Player",
    growth: {
      streakLevel: "rhythm",
      emotion: getRewardEmotion("rhythm"),
      stageName: "稳定阶段",
      meaning: "学习进入稳定阶段，节奏正在持续。",
      cheerBoxLabel: "Day14",
      cheerBoxLine: "学习步入稳定",
      cheerBoxDetail: "节奏正在持续",
      cheerBoxTone: "stable",
    },
    copy: {
      eyebrow: "TWO WEEK PLAYER",
      title: "双周歌单",
      subtitle: "两周的记录慢慢有了自己的节奏。",
      badge: "DAY 14 · 双周歌单",
      cardTitle: "双周歌单",
      cardBody: "两周的记录慢慢有了自己的节奏。",
      cta: "预览",
      gain: "+1 双周播放器",
      placeholderTitle: "Day14Player 占位",
      placeholderBody: "这里之后会做成播放器式奖励。",
    },
    visual: { glow: "#b9a9ff", accent: "#f0d5ff", card: "rgba(99, 70, 155, 0.4)" },
  },
  30: {
    day: 30,
    sceneType: "Day30Ticket",
    growth: {
      streakLevel: "identity_forming",
      emotion: getRewardEmotion("identity_forming"),
      stageName: "习惯形成",
      meaning: "你已经形成习惯，节奏开始稳定存在。",
      cheerBoxLabel: "Day30",
      cheerBoxLine: "成为你的习惯",
      cheerBoxDetail: "节奏开始稳定存在",
      cheerBoxTone: "identity",
    },
    copy: {
      eyebrow: "TOUR TICKET",
      title: "一个月巡演站",
      subtitle: "这一路不是突然完成，是一天一天亮起来的。",
      badge: "DAY 30 · 一个月巡演站",
      cardTitle: "一个月巡演站",
      cardBody: "这一路不是突然完成，是一天一天亮起来的。",
      cta: "预览",
      gain: "+1 巡演票根",
      placeholderTitle: "Day30Ticket 占位",
      placeholderBody: "这里之后会做成纪念票根奖励。",
    },
    visual: { glow: "#d6c5ff", accent: "#ffe6a5", card: "rgba(120, 77, 162, 0.4)" },
  },
  50: {
    day: 50,
    sceneType: "Day50CheerFlag",
    growth: {
      streakLevel: "identity_forming",
      emotion: getRewardEmotion("identity_forming"),
      stageName: "稳定确认",
      meaning: "你一直在持续，节奏还在这里。",
      cheerBoxLabel: "Day50",
      cheerBoxLine: "你一直在持续",
      cheerBoxDetail: "稳定确认点",
      cheerBoxTone: "reinforcement",
    },
    copy: {
      eyebrow: "CHEER FLAG",
      title: "应援旗",
      subtitle: "坚持开始有了自己的形状。",
      badge: "DAY 50 · 应援旗",
      cardTitle: "应援旗",
      cardBody: "坚持开始有了自己的形状。",
      cta: "预览",
      gain: "+1 应援旗",
      placeholderTitle: "Day50CheerFlag 占位",
      placeholderBody: "这里之后会做成可展开的应援旗奖励。",
    },
    visual: { glow: "#ccb7ff", accent: "#f7c5ff", card: "rgba(97, 68, 152, 0.4)" },
  },
  100: {
    day: 100,
    sceneType: "Day100Poster",
    growth: {
      streakLevel: "memory_anchor",
      emotion: getRewardEmotion("memory_anchor"),
      stageName: "生活融合",
      meaning: "它已经成为你的日常，安静地留在生活里。",
      cheerBoxLabel: "Day100",
      cheerBoxLine: "它已经成为你的日常",
      cheerBoxDetail: "长期沉淀",
      cheerBoxTone: "memory",
    },
    copy: {
      eyebrow: "MEMORIAL POSTER",
      title: "纪念海报",
      subtitle: "一百天会变成一张很轻、但很有分量的证明。",
      badge: "DAY 100 · 纪念海报",
      cardTitle: "纪念海报",
      cardBody: "一百天会变成一张很轻、但很有分量的证明。",
      cta: "预览",
      gain: "+1 纪念海报",
      placeholderTitle: "Day100Poster 占位",
      placeholderBody: "这里之后会做成一张年度节点海报。",
    },
    visual: { glow: "#d7c9ff", accent: "#fff0c1", card: "rgba(111, 78, 170, 0.4)" },
  },
  365: {
    day: 365,
    sceneType: "Day365Ocean",
    growth: {
      streakLevel: "memory_anchor",
      emotion: getRewardEmotion("memory_anchor"),
      stageName: "年度记忆",
      meaning: "一整年的学习轨迹汇成长期记忆。",
      cheerBoxLabel: "Day365：年度灯海",
      cheerBoxLine: "走进一整年的灯海",
      cheerBoxDetail: "年度记忆",
      cheerBoxTone: "memory",
    },
    copy: {
      eyebrow: "PURPLE OCEAN",
      title: "紫色灯海",
      subtitle: "一年之后，灯海里有你自己留下的每一天。",
      badge: "DAY 365 · 紫色灯海",
      cardTitle: "紫色灯海",
      cardBody: "一年之后，灯海里有你自己留下的每一天。",
      cta: "预览",
      gain: "+1 紫色灯海",
      placeholderTitle: "Day365Ocean 占位",
      placeholderBody: "这里之后会做成年度灯海场景。",
    },
    visual: { glow: "#e0d0ff", accent: "#f6ddff", card: "rgba(91, 61, 145, 0.42)" },
  },
};

export const rewardDays = Object.keys(rewardConfig).map(Number) as RewardDay[];
export const cheerBoxDays = [1, 7, 14, 30, 50, 100] as const satisfies readonly RewardDay[];

export function getRewardByDay(day: RewardDay) {
  return rewardConfig[day];
}

function normalizeStreakDays(streakDays: number) {
  if (!Number.isFinite(streakDays)) {
    return 0;
  }

  return Math.max(0, Math.trunc(streakDays));
}

export function getCurrentCheerBoxDay(streakDays: number): RewardDay {
  const normalizedStreakDays = normalizeStreakDays(streakDays);
  const unlockedDays = cheerBoxDays.filter((day) => normalizedStreakDays >= day);

  if (unlockedDays.length > 0) {
    return unlockedDays[unlockedDays.length - 1];
  }

  return 1;
}

export function getCheerBoxNodeStatus(day: RewardDay, streakDays: number): CheerBoxNodeStatus {
  const normalizedStreakDays = normalizeStreakDays(streakDays);
  const currentDay = getCurrentCheerBoxDay(normalizedStreakDays);

  if (day === currentDay) {
    return "current";
  }

  if (normalizedStreakDays >= day) {
    return "unlocked";
  }

  return "locked";
}

export function getCheerBoxNodes(streakDays: number): CheerBoxNode[] {
  return cheerBoxDays.map((day) => ({
    day,
    status: getCheerBoxNodeStatus(day, streakDays),
  }));
}
