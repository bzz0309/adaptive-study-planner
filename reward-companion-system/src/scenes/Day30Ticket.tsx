import type { RewardConfigItem } from "../config/rewardConfig";
import { PlaceholderReward } from "./PlaceholderReward";

type Day30TicketProps = {
  reward: RewardConfigItem;
};

export function Day30Ticket({ reward }: Day30TicketProps) {
  return <PlaceholderReward reward={reward} />;
}
