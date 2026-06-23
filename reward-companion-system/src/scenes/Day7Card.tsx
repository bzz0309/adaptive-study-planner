import type { RewardConfigItem } from "../config/rewardConfig";
import { PlaceholderReward } from "./PlaceholderReward";

type Day7CardProps = {
  reward: RewardConfigItem;
};

export function Day7Card({ reward }: Day7CardProps) {
  return <PlaceholderReward reward={reward} />;
}
