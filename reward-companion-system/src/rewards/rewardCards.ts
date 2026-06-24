import timelapseTimelessBack from "../assets/reward/day7/timelapse-timeless-back.jpg";
import timelapseTimelessFront from "../assets/reward/day7/timelapse-timeless-front.jpg";

export type RewardCard = {
  id: string;
  unlockedDay: number;
  firstDrop: boolean;
  rarity: "N" | "R" | "SR" | "SSR";
  title: string;
  cardNo: string;
  frontImage: string;
  backImage: string;
  backLyricKo: string;
  backLyricEn: string;
  backLyricZh: string;
  collectMessage: string;
};

export const day7FirstCard: RewardCard = {
  id: "day7_timelapse_timeless",
  unlockedDay: 7,
  firstDrop: true,
  rarity: "SSR",
  title: "Time Lapse, Timeless",
  cardNo: "19890309",
  frontImage: timelapseTimelessFront,
  backImage: timelapseTimelessBack,
  backLyricKo: "변하지 않아",
  backLyricEn: "Last forever",
  backLyricZh: "永不改变，直到永远",
  collectMessage: "有些努力，会留在时间里发光。",
};

export const rewardCards = [day7FirstCard];
