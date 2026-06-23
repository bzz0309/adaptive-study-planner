import { motion } from "framer-motion";
import type { RewardConfigItem } from "../config/rewardConfig";

type PlaceholderRewardProps = {
  reward: RewardConfigItem;
};

export function PlaceholderReward({ reward }: PlaceholderRewardProps) {
  return (
    <div className="placeholder-scene">
      <motion.div
        className="placeholder-card"
        initial={{ opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      >
        <span>{reward.copy.badge}</span>
        <h1>{reward.copy.placeholderTitle}</h1>
        <p>{reward.copy.placeholderBody}</p>
      </motion.div>
    </div>
  );
}
