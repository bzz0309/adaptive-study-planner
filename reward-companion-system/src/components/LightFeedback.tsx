import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect } from "react";
import { feedbackConfig, type FeedbackConfigItem, type FeedbackRewardId } from "../rewards/feedbackConfig";
import { rewardPriority } from "../rewards/rewardTypes";

const DEFAULT_AUTO_DISMISS_MS = 2600;

export type LightFeedbackVariant = "default" | "short";

export type QueuedLightFeedback = {
  queueId: string;
  feedbackId: FeedbackRewardId;
  variant?: LightFeedbackVariant;
};

type LightFeedbackProps = {
  feedback: FeedbackConfigItem;
  variant?: LightFeedbackVariant;
  autoDismissMs?: number;
  onClose: () => void;
};

type FeedbackWrapperProps = {
  feedbackId?: FeedbackRewardId;
  variant?: LightFeedbackVariant;
  autoDismissMs?: number;
  onClose: () => void;
};

type LightFeedbackQueueProps = {
  items: QueuedLightFeedback[];
  onDismiss: (queueId: string) => void;
};

function getFeedbackCopy(feedback: FeedbackConfigItem, variant: LightFeedbackVariant) {
  if (variant === "short" && feedback.shortTitle && feedback.shortBody) {
    return {
      title: feedback.shortTitle,
      body: feedback.shortBody,
    };
  }

  return {
    title: feedback.title,
    body: feedback.body,
  };
}

function getFeedbackTone(feedback: FeedbackConfigItem) {
  return feedback.lineType === "breakthrough_feedback" ? "breakthrough" : "highlight";
}

export function LightFeedback({
  feedback,
  variant = "default",
  autoDismissMs = DEFAULT_AUTO_DISMISS_MS,
  onClose,
}: LightFeedbackProps) {
  const shouldReduceMotion = useReducedMotion();
  const copy = getFeedbackCopy(feedback, variant);
  const tone = getFeedbackTone(feedback);

  useEffect(() => {
    const timer = window.setTimeout(onClose, autoDismissMs);
    return () => window.clearTimeout(timer);
  }, [autoDismissMs, onClose]);

  return (
    <motion.aside
      className={`light-feedback light-feedback--${tone}`}
      role="status"
      aria-live="polite"
      initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.98 }}
      animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
      exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.99 }}
      transition={{ duration: shouldReduceMotion ? 0.01 : 0.24, ease: "easeOut" }}
    >
      <span className="light-feedback-orb" aria-hidden="true">
        <span />
      </span>
      <span className="light-feedback-copy">
        <strong>{copy.title}</strong>
        <span>{copy.body}</span>
      </span>
      <button type="button" className="light-feedback-close" aria-label="关闭轻反馈" onClick={onClose}>
        ×
      </button>
    </motion.aside>
  );
}

export function HighlightFeedback({
  feedbackId = "highlight_all_correct",
  variant,
  autoDismissMs,
  onClose,
}: FeedbackWrapperProps) {
  return (
    <LightFeedback
      feedback={feedbackConfig[feedbackId]}
      variant={variant}
      autoDismissMs={autoDismissMs}
      onClose={onClose}
    />
  );
}

export function BreakthroughFeedback({
  feedbackId = "breakthrough_wrong_question",
  variant,
  autoDismissMs,
  onClose,
}: FeedbackWrapperProps) {
  return (
    <LightFeedback
      feedback={feedbackConfig[feedbackId]}
      variant={variant}
      autoDismissMs={autoDismissMs}
      onClose={onClose}
    />
  );
}

export function LightFeedbackQueue({ items, onDismiss }: LightFeedbackQueueProps) {
  const activeItem = [...items].sort((first, second) => {
    const firstFeedback = feedbackConfig[first.feedbackId];
    const secondFeedback = feedbackConfig[second.feedbackId];
    return rewardPriority[firstFeedback.lineType] - rewardPriority[secondFeedback.lineType];
  })[0];

  return (
    <div className="light-feedback-region" aria-live="polite" aria-relevant="additions removals">
      <AnimatePresence mode="wait">
        {activeItem ? (
          <LightFeedback
            key={activeItem.queueId}
            feedback={feedbackConfig[activeItem.feedbackId]}
            variant={activeItem.variant}
            onClose={() => onDismiss(activeItem.queueId)}
          />
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export { DEFAULT_AUTO_DISMISS_MS };
