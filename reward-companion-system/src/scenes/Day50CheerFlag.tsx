import type { RewardConfigItem } from "../config/rewardConfig";
import { PlaceholderReward } from "./PlaceholderReward";

type Day50CheerFlagProps = {
  reward: RewardConfigItem;
};

export function Day50CheerFlag({ reward }: Day50CheerFlagProps) {
  return <PlaceholderReward reward={reward} />;
}
