import type { RewardConfigItem } from "../config/rewardConfig";
import { PlaceholderReward } from "./PlaceholderReward";

type Day14PlayerProps = {
  reward: RewardConfigItem;
};

export function Day14Player({ reward }: Day14PlayerProps) {
  return <PlaceholderReward reward={reward} />;
}
