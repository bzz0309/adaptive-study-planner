import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import type { RewardConfigItem } from "../config/rewardConfig";
import { day7FirstCard } from "../rewards/rewardCards";
import { collectCard, collectReward } from "../rewards/rewardStorage";

type Day7CardProps = {
  reward: RewardConfigItem;
  onCollect?: () => void;
  onClose?: () => void;
  onComplete?: () => void;
};

type Day7Phase = "ready" | "revealed" | "collecting" | "ended";
type CardSide = "front" | "back";

export function Day7Card({ onCollect, onClose, onComplete }: Day7CardProps) {
  const reduceMotion = useReducedMotion();
  const [phase, setPhase] = useState<Day7Phase>("ready");
  const [side, setSide] = useState<CardSide>("front");
  const didCollectRef = useRef(false);
  const timersRef = useRef<number[]>([]);
  const hasExternalExit = Boolean(onClose || onComplete);

  useEffect(() => {
    return () => {
      didCollectRef.current = false;
      timersRef.current.forEach((timer) => window.clearTimeout(timer));
      timersRef.current = [];
    };
  }, []);

  function handleDraw() {
    if (phase !== "ready") {
      return;
    }

    setPhase("revealed");
    setSide("back");

    const flipTimer = window.setTimeout(
      () => {
        setSide("front");
      },
      reduceMotion ? 80 : 680,
    );
    timersRef.current.push(flipTimer);
  }

  function handleFlip() {
    if (phase !== "revealed") {
      return;
    }

    setSide((current) => (current === "front" ? "back" : "front"));
  }

  function handleCollect() {
    if (didCollectRef.current || phase !== "revealed") {
      return;
    }

    didCollectRef.current = true;
    collectReward(day7FirstCard.unlockedDay);
    collectCard(day7FirstCard.id, day7FirstCard.unlockedDay);
    setPhase("collecting");
    onCollect?.();

    const collectTimer = window.setTimeout(
      () => {
        if (hasExternalExit) {
          onClose?.();
          onComplete?.();
          return;
        }

        setPhase("ended");
      },
      reduceMotion ? 520 : 1550,
    );
    timersRef.current.push(collectTimer);
  }

  function handleReplay() {
    didCollectRef.current = false;
    setPhase("ready");
    setSide("front");
  }

  if (phase === "ended") {
    return (
      <motion.div
        className="day7-end-state"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: reduceMotion ? 0.12 : 0.36 }}
      >
        <motion.div
          className="day7-end-card"
          initial={{ opacity: 0, y: reduceMotion ? 0 : 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduceMotion ? 0.12 : 0.42, ease: [0.22, 1, 0.36, 1] }}
        >
          <span>{day7FirstCard.rarity}</span>
          <h1>已放进收藏柜</h1>
          <p>{day7FirstCard.collectMessage}</p>
          <button type="button" onClick={handleReplay}>
            重新预览
          </button>
        </motion.div>
      </motion.div>
    );
  }

  return (
    <section className={`day7-scene is-${phase}`} aria-label={day7FirstCard.title}>
      <div className="day7-bg" aria-hidden="true">
        <span className="day7-bg-line line-one" />
        <span className="day7-bg-line line-two" />
        <span className="day7-bg-star star-one" />
        <span className="day7-bg-star star-two" />
      </div>

      <motion.header
        className="day7-copy"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduceMotion ? 0.12 : 0.54, ease: [0.22, 1, 0.36, 1] }}
      >
        <span>DAY 7</span>
        <h1>抽取本周应援卡</h1>
        <p>第七天，抽一张属于这一周的卡</p>
      </motion.header>

      <div className="day7-stage">
        <AnimatePresence mode="wait">
          {phase === "ready" ? (
            <motion.div
              className="day7-pack"
              key="day7-pack"
              initial={{ opacity: 0, y: 34, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -18, scale: 0.96 }}
              transition={{ duration: reduceMotion ? 0.12 : 0.56, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="day7-pack-card card-a" aria-hidden="true" />
              <div className="day7-pack-card card-b" aria-hidden="true" />
              <div className="day7-pack-card card-c">
                <span>{day7FirstCard.rarity}</span>
                <strong>?</strong>
              </div>
            </motion.div>
          ) : (
            <motion.button
              className={`day7-card-shell ${side === "back" ? "is-back" : ""}`}
              key="day7-card"
              type="button"
              onClick={handleFlip}
              disabled={phase === "collecting"}
              initial={{ opacity: 0, y: 48, scale: 0.88, rotateY: reduceMotion ? 0 : 180 }}
              animate={{
                opacity: phase === "collecting" ? 0 : 1,
                y: phase === "collecting" ? -42 : 0,
                scale: phase === "collecting" ? 0.68 : 1,
                rotateY: 0,
              }}
              transition={{ duration: reduceMotion ? 0.12 : 0.76, ease: [0.16, 1, 0.3, 1] }}
              aria-label={side === "front" ? "查看卡片背面" : "查看卡片正面"}
            >
              <span className="day7-card-glow" aria-hidden="true" />
              <span className="day7-card-inner">
                <span className="day7-card-face day7-card-front">
                  <img src={day7FirstCard.frontImage} alt={`${day7FirstCard.rarity} ${day7FirstCard.title} NO. ${day7FirstCard.cardNo}`} />
                </span>
                <span className="day7-card-face day7-card-back">
                  <img
                    src={day7FirstCard.backImage}
                    alt={`${day7FirstCard.backLyricKo} ${day7FirstCard.backLyricEn} ${day7FirstCard.backLyricZh}`}
                  />
                </span>
              </span>
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      <motion.div
        className="day7-action-panel"
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: reduceMotion ? 0 : 0.2, duration: reduceMotion ? 0.12 : 0.46 }}
      >
        {phase === "ready" ? (
          <button type="button" onClick={handleDraw}>
            抽一张
          </button>
        ) : (
          <>
            <div className="day7-card-meta">
              <span>{day7FirstCard.rarity}</span>
              <strong>{day7FirstCard.title}</strong>
              <small>NO. {day7FirstCard.cardNo}</small>
            </div>
            <div className="day7-card-actions">
              <button type="button" className="day7-secondary" onClick={handleFlip} disabled={phase === "collecting"}>
                {side === "front" ? "查看背面" : "查看正面"}
              </button>
              <button type="button" onClick={handleCollect} disabled={phase === "collecting"}>
                放进收藏柜
              </button>
            </div>
          </>
        )}
      </motion.div>

      <AnimatePresence>
        {phase === "collecting" && (
          <motion.div
            className="day7-collect-message"
            initial={{ opacity: 0, y: 18, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: reduceMotion ? 0.12 : 0.38, ease: [0.22, 1, 0.36, 1] }}
          >
            {day7FirstCard.collectMessage}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
