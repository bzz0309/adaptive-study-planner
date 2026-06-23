import type { RewardConfigItem } from "../config/rewardConfig";
import { PlaceholderReward } from "./PlaceholderReward";

type Day365OceanProps = {
  reward: RewardConfigItem;
};

export function Day365Ocean({ reward }: Day365OceanProps) {
  return <PlaceholderReward reward={reward} />;
}
