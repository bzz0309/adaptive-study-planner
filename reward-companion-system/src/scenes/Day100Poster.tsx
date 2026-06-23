import type { RewardConfigItem } from "../config/rewardConfig";
import { PlaceholderReward } from "./PlaceholderReward";

type Day100PosterProps = {
  reward: RewardConfigItem;
};

export function Day100Poster({ reward }: Day100PosterProps) {
  return <PlaceholderReward reward={reward} />;
}
