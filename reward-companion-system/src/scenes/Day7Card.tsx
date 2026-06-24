import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import hiddenPool1 from "../assets/reward/day7/pool/hidden-1.webp";
import hiddenPool2 from "../assets/reward/day7/pool/hidden-2.webp";
import hiddenPool3 from "../assets/reward/day7/pool/hidden-3.webp";
import hiddenPool4 from "../assets/reward/day7/pool/hidden-4.webp";
import hiddenPool5 from "../assets/reward/day7/pool/hidden-5.webp";
import hiddenPool6 from "../assets/reward/day7/pool/hidden-6.webp";
import hiddenPool7 from "../assets/reward/day7/pool/hidden-7.webp";
import type { RewardConfigItem } from "../config/rewardConfig";
import { day7FirstCard } from "../rewards/rewardCards";
import { collectCard, collectReward } from "../rewards/rewardStorage";

type Day7CardProps = {
  reward: RewardConfigItem;
  onCollect?: () => void;
  onClose?: () => void;
  onComplete?: () => void;
};

type Day7Phase = "ready" | "drawing" | "revealed" | "collecting" | "ended";
type CardSide = "front" | "back";

const poolCards = [
  { className: "card-0", image: hiddenPool1 },
  { className: "card-1", image: hiddenPool2 },
  { className: "card-2", image: hiddenPool3 },
  { className: "card-3", image: hiddenPool4 },
  { className: "card-4", image: hiddenPool5 },
  { className: "card-5", image: hiddenPool6 },
  { className: "card-6", image: hiddenPool7 },
];

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

    setPhase("drawing");
    setSide("front");

    const revealTimer = window.setTimeout(
      () => {
        setPhase("revealed");
        setSide("front");
      },
      reduceMotion ? 120 : 940,
    );
    timersRef.current.push(revealTimer);
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
      reduceMotion ? 420 : 980,
    );
    timersRef.current.push(collectTimer);
  }

  function handleReplay() {
    didCollectRef.current = false;
    setPhase("ready");
    setSide("front");
  }

  function handleClose() {
    onClose?.();
    onComplete?.();
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
          {phase === "ended" ? (
            <motion.div
              className="day7-collected-state"
              key="day7-collected"
              initial={{ opacity: 0, y: reduceMotion ? 0 : 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              transition={{ duration: reduceMotion ? 0.12 : 0.44, ease: [0.22, 1, 0.36, 1] }}
            >
              <span>{day7FirstCard.rarity}</span>
              <p>{day7FirstCard.collectMessage}</p>
            </motion.div>
          ) : phase === "ready" || phase === "drawing" ? (
            <motion.div
              className={`day7-pack ${phase === "drawing" ? "is-drawing" : ""}`}
              key="day7-pack"
              initial={{ opacity: 0, y: 34, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -18, scale: 0.96 }}
              transition={{ duration: reduceMotion ? 0.12 : 0.56, ease: [0.22, 1, 0.36, 1] }}
            >
              {poolCards.map((card, index) => (
                <div
                  className={`day7-pack-card ${card.className}`}
                  aria-hidden="true"
                  key={card.className}
                >
                  <img src={card.image} alt="" />
                  {index === 3 && (
                    <>
                      <span>{day7FirstCard.rarity}</span>
                      <strong>?</strong>
                    </>
                  )}
                </div>
              ))}
              {phase === "drawing" && (
                <motion.div
                  className="day7-drawn-card"
                  aria-hidden="true"
                  initial={{ opacity: 0, y: 12, scale: 0.92, rotate: 0, rotateY: 0 }}
                  animate={{
                    opacity: 1,
                    y: reduceMotion ? 0 : -76,
                    scale: reduceMotion ? 1 : 1.16,
                    rotate: 0,
                    rotateY: reduceMotion ? 0 : 180,
                  }}
                  transition={{ duration: reduceMotion ? 0.12 : 0.82, ease: [0.16, 1, 0.3, 1] }}
                >
                  <img src={day7FirstCard.frontImage} alt="" />
                </motion.div>
              )}
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
                x: phase === "collecting" ? (reduceMotion ? 0 : 88) : 0,
                y: phase === "collecting" ? (reduceMotion ? 0 : 118) : 0,
                scale: phase === "collecting" ? 0.42 : 1,
                rotate: phase === "collecting" ? 8 : 0,
                rotateY: 0,
              }}
              transition={{ duration: reduceMotion ? 0.12 : 0.78, ease: [0.16, 1, 0.3, 1] }}
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
        ) : phase === "drawing" ? (
          <div className="day7-drawing-label">正在抽取</div>
        ) : phase === "ended" ? (
          <div className="day7-end-actions">
            <button type="button" onClick={handleReplay}>
              重新抽
            </button>
            <button type="button" className="day7-secondary" onClick={handleClose}>
              关闭
            </button>
          </div>
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
                收下
              </button>
            </div>
          </>
        )}
      </motion.div>
    </section>
  );
}
