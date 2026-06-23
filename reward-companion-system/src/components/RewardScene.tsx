import { AnimatePresence, motion } from "framer-motion";
import type { ReactElement } from "react";
import { getRewardByDay, type RewardConfigItem, type RewardDay, type RewardSceneType } from "../config/rewardConfig";
import { Day100Poster } from "../scenes/Day100Poster";
import { Day14Player } from "../scenes/Day14Player";
import { Day1Scene } from "../scenes/Day1Scene";
import { Day30Ticket } from "../scenes/Day30Ticket";
import { Day365Ocean } from "../scenes/Day365Ocean";
import { Day50CheerFlag } from "../scenes/Day50CheerFlag";
import { Day7Card } from "../scenes/Day7Card";

type RewardSceneProps = {
  day?: RewardDay;
  rewardDay?: RewardDay;
  onCollect?: (reward: RewardConfigItem) => void;
  onClose?: (reward: RewardConfigItem) => void;
  onComplete?: (reward: RewardConfigItem) => void;
};

type SceneComponent = (props: {
  reward: RewardConfigItem;
  onCollect?: () => void;
  onClose?: () => void;
  onComplete?: () => void;
}) => ReactElement;

const sceneRegistry: Record<RewardSceneType, SceneComponent> = {
  Day1Scene,
  Day7Card,
  Day14Player,
  Day30Ticket,
  Day50CheerFlag,
  Day100Poster,
  Day365Ocean,
};

export function RewardScene({ day, rewardDay, onCollect, onClose, onComplete }: RewardSceneProps) {
  const reward = getRewardByDay(rewardDay ?? day ?? 1);
  const ActiveScene = sceneRegistry[reward.sceneType];

  return (
    <main className="reward-shell">
      <AnimatePresence mode="wait">
        <motion.section
          key={reward.day}
          className="reward-stage"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        >
          <ActiveScene
            reward={reward}
            onCollect={onCollect ? () => onCollect(reward) : undefined}
            onClose={onClose ? () => onClose(reward) : undefined}
            onComplete={onComplete ? () => onComplete(reward) : undefined}
          />
        </motion.section>
      </AnimatePresence>
    </main>
  );
}
