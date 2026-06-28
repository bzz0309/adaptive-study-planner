import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import hiddenPool1 from "../assets/reward/day7/pool/hidden-1.webp";
import hiddenPool2 from "../assets/reward/day7/pool/hidden-2.webp";
import hiddenPool3 from "../assets/reward/day7/pool/hidden-3.webp";
import hiddenPool4 from "../assets/reward/day7/pool/hidden-4.webp";
import hiddenPool5 from "../assets/reward/day7/pool/hidden-5.webp";
import hiddenPool6 from "../assets/reward/day7/pool/hidden-6.webp";
import hiddenPool7 from "../assets/reward/day7/pool/hidden-7.webp";
import { HighlightFeedback } from "../components/LightFeedback";
import type { RewardVideoSources } from "../components/RewardVideoLayer";
import type { RewardConfigItem } from "../config/rewardConfig";
import { day7FirstCard } from "../rewards/rewardCards";
import { collectCard, collectReward } from "../rewards/rewardStorage";

type Day7CardProps = {
  reward: RewardConfigItem;
  onCollect?: () => void;
  onClose?: () => void;
  onComplete?: () => void;
};

type Day7Phase = "pool" | "drawing" | "front" | "back" | "collected";

const day7IdleVideoModules = import.meta.glob("../assets/reward/day7/day7-idle-*.mp4", {
  eager: true,
  import: "default",
  query: "?url",
}) as Record<string, string>;

const day7DrawVideoModules = import.meta.glob("../assets/reward/day7/day7-draw-*.mp4", {
  eager: true,
  import: "default",
  query: "?url",
}) as Record<string, string>;

const day7IdleVideoSources: RewardVideoSources = {
  desktop: day7IdleVideoModules["../assets/reward/day7/day7-idle-desktop.mp4"],
  mobile: day7IdleVideoModules["../assets/reward/day7/day7-idle-mobile.mp4"],
};

const day7DrawVideoSources: RewardVideoSources = {
  desktop: day7DrawVideoModules["../assets/reward/day7/day7-draw-desktop.mp4"],
  mobile: day7DrawVideoModules["../assets/reward/day7/day7-draw-mobile.mp4"],
};

const poolCards = [
  { className: "card-0", image: hiddenPool1 },
  { className: "card-1", image: hiddenPool2 },
  { className: "card-2", image: hiddenPool3 },
  { className: "card-3", image: hiddenPool4 },
  { className: "card-4", image: hiddenPool5 },
  { className: "card-5", image: hiddenPool6 },
  { className: "card-6", image: hiddenPool7 },
  { className: "card-7", image: hiddenPool1 },
  { className: "card-8", image: hiddenPool2 },
  { className: "card-9", image: hiddenPool3 },
  { className: "card-10", image: hiddenPool4 },
  { className: "card-11", image: hiddenPool5 },
  { className: "card-12", image: hiddenPool6 },
  { className: "card-13", image: hiddenPool7 },
  { className: "card-14", image: hiddenPool1 },
];

type Day7VideoLayerProps = {
  canUseDrawVideo: boolean;
  canUseIdleVideo: boolean;
  onDrawEnded: () => void;
  onDrawError: () => void;
  onIdleError: () => void;
  phase: Day7Phase;
};

function getMobileSourceMedia(sources: RewardVideoSources) {
  return sources.desktop ? "(max-width: 760px), (orientation: portrait)" : undefined;
}

function Day7VideoLayer({
  canUseDrawVideo,
  canUseIdleVideo,
  onDrawEnded,
  onDrawError,
  onIdleError,
  phase,
}: Day7VideoLayerProps) {
  const showIdleVideo = phase === "pool" && canUseIdleVideo;
  const showDrawVideo = phase === "drawing" && canUseDrawVideo;

  return (
    <div className="day7-media-layer" aria-label="Day7 抽卡视频氛围层" aria-hidden="true">
      {showIdleVideo ? (
        <video
          key="day7-idle-video"
          className="reward-video"
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          onError={onIdleError}
        >
          {day7IdleVideoSources.mobile ? (
            <source src={day7IdleVideoSources.mobile} media={getMobileSourceMedia(day7IdleVideoSources)} type="video/mp4" />
          ) : null}
          {day7IdleVideoSources.desktop ? <source src={day7IdleVideoSources.desktop} type="video/mp4" /> : null}
        </video>
      ) : null}

      {showDrawVideo ? (
        <video
          key="day7-draw-video"
          className="reward-video"
          autoPlay
          muted
          playsInline
          preload="auto"
          onEnded={onDrawEnded}
          onError={onDrawError}
        >
          {day7DrawVideoSources.mobile ? (
            <source src={day7DrawVideoSources.mobile} media={getMobileSourceMedia(day7DrawVideoSources)} type="video/mp4" />
          ) : null}
          {day7DrawVideoSources.desktop ? <source src={day7DrawVideoSources.desktop} type="video/mp4" /> : null}
        </video>
      ) : null}

      {!showIdleVideo && !showDrawVideo ? (
        <div className="day7-bg" aria-hidden="true">
          <span className="day7-bg-line line-one" />
          <span className="day7-bg-line line-two" />
          <span className="day7-bg-star star-one" />
          <span className="day7-bg-star star-two" />
        </div>
      ) : null}
    </div>
  );
}

export function Day7Card({ onCollect, onClose, onComplete }: Day7CardProps) {
  const reduceMotion = useReducedMotion();
  const shouldReduceMotion = Boolean(reduceMotion);
  const [phase, setPhase] = useState<Day7Phase>("pool");
  const [idleVideoFailed, setIdleVideoFailed] = useState(false);
  const [drawVideoFailed, setDrawVideoFailed] = useState(false);
  const timersRef = useRef<number[]>([]);
  const canUseIdleVideo = Boolean(
    (day7IdleVideoSources.desktop || day7IdleVideoSources.mobile) && !idleVideoFailed && !shouldReduceMotion,
  );
  const canUseDrawVideo = Boolean(
    (day7DrawVideoSources.desktop || day7DrawVideoSources.mobile) && !drawVideoFailed && !shouldReduceMotion,
  );

  useEffect(() => {
    return () => {
      timersRef.current.forEach((timer) => window.clearTimeout(timer));
      timersRef.current = [];
    };
  }, []);

  function clearTimers() {
    timersRef.current.forEach((timer) => window.clearTimeout(timer));
    timersRef.current = [];
  }

  function finishDrawing() {
    clearTimers();
    setPhase((currentPhase) => (currentPhase === "drawing" ? "front" : currentPhase));
  }

  function handleDraw() {
    if (phase !== "pool") {
      return;
    }

    clearTimers();
    setPhase("drawing");

    if (!canUseDrawVideo) {
      const revealTimer = window.setTimeout(finishDrawing, shouldReduceMotion ? 120 : 940);
      timersRef.current.push(revealTimer);
    }
  }

  function showBack() {
    if (phase === "front") {
      setPhase("back");
    }
  }

  function showFront() {
    if (phase === "back") {
      setPhase("front");
    }
  }

  function handleCollect() {
    if (phase !== "front") {
      return;
    }

    collectReward(day7FirstCard.unlockedDay);
    collectCard(day7FirstCard.id, day7FirstCard.unlockedDay);
    onCollect?.();
    setPhase("collected");
  }

  function handleReplay() {
    clearTimers();
    setPhase("pool");
  }

  function handleIdleVideoError() {
    setIdleVideoFailed(true);
  }

  function handleDrawVideoError() {
    setDrawVideoFailed(true);

    const fallbackTimer = window.setTimeout(finishDrawing, 420);
    timersRef.current.push(fallbackTimer);
  }

  const canUseActiveVideo = phase === "pool" ? canUseIdleVideo : canUseDrawVideo;

  return (
    <section className={`day7-scene is-${phase}`} aria-label={day7FirstCard.title}>
      <Day7VideoLayer
        canUseDrawVideo={canUseDrawVideo}
        canUseIdleVideo={canUseIdleVideo}
        onDrawEnded={finishDrawing}
        onDrawError={handleDrawVideoError}
        onIdleError={handleIdleVideoError}
        phase={phase}
      />

      <div className="day7-ui-layer">
        <motion.header
          className="day7-copy"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: shouldReduceMotion ? 0.12 : 0.54, ease: [0.22, 1, 0.36, 1] }}
        >
          <span>DAY 7</span>
          <h1>抽取本周应援卡</h1>
          <p>第七天，抽一张属于这一周的卡</p>
        </motion.header>

        <div className="day7-stage">
          <AnimatePresence mode="wait">
            {phase === "collected" ? (
              <motion.div
                className="day7-collected-state"
                key="day7-collected"
                initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 18 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 12 }}
                transition={{ duration: shouldReduceMotion ? 0.12 : 0.44, ease: [0.22, 1, 0.36, 1] }}
              >
                <span>{day7FirstCard.rarity}</span>
                <p>{day7FirstCard.collectMessage}</p>
              </motion.div>
            ) : phase === "pool" || phase === "drawing" ? (
              <motion.div
                className={`day7-pack ${phase === "drawing" ? "is-drawing" : ""} ${canUseActiveVideo ? "has-video-layer" : ""}`}
                key="day7-pack"
                initial={{ opacity: 0, y: 34, scale: 0.94 }}
                animate={{ opacity: canUseActiveVideo ? 0 : 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -18, scale: 0.96 }}
                transition={{ duration: shouldReduceMotion ? 0.12 : 0.56, ease: [0.22, 1, 0.36, 1] }}
              >
                {poolCards.map((card) => (
                  <div className={`day7-pack-card ${card.className}`} aria-hidden="true" key={card.className}>
                    <img src={card.image} alt="" />
                  </div>
                ))}
                {phase === "drawing" && !canUseDrawVideo && (
                  <motion.div
                    className="day7-drawn-card"
                    aria-hidden="true"
                    initial={{ opacity: 0, y: 12, scale: 0.92, rotate: 0, rotateY: 0 }}
                    animate={{
                      opacity: 1,
                      y: shouldReduceMotion ? 0 : -76,
                      scale: shouldReduceMotion ? 1 : 1.16,
                      rotate: 0,
                      rotateY: shouldReduceMotion ? 0 : 180,
                    }}
                    transition={{ duration: shouldReduceMotion ? 0.12 : 0.82, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <img src={day7FirstCard.frontImage} alt="" />
                  </motion.div>
                )}
              </motion.div>
            ) : (
              <motion.div
                className={`day7-card-shell ${phase === "back" ? "is-back" : ""}`}
                key="day7-card"
                initial={{ opacity: 0, y: 48, scale: 0.88, rotateY: shouldReduceMotion ? 0 : 180 }}
                animate={{
                  opacity: 1,
                  x: 0,
                  y: 0,
                  scale: 1,
                  rotate: 0,
                  rotateY: 0,
                }}
                transition={{ duration: shouldReduceMotion ? 0.12 : 0.78, ease: [0.16, 1, 0.3, 1] }}
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
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <motion.div
          className="day7-action-panel"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: shouldReduceMotion ? 0 : 0.2, duration: shouldReduceMotion ? 0.12 : 0.46 }}
        >
          {phase === "pool" ? (
            <button type="button" onClick={handleDraw}>
              抽一张
            </button>
          ) : phase === "drawing" ? (
            <div className="day7-drawing-label">正在抽取</div>
          ) : phase === "collected" ? (
            <div className="day7-end-actions">
              <HighlightFeedback autoDismissMs={3600000} onClose={() => undefined} />
              <button type="button" onClick={handleReplay}>
                重新抽一次
              </button>
            </div>
          ) : phase === "front" ? (
            <>
            <div className="day7-card-meta">
              <span>{day7FirstCard.rarity}</span>
              <strong>{day7FirstCard.title}</strong>
              <small>NO. {day7FirstCard.cardNo}</small>
            </div>
            <div className="day7-card-actions">
              <button type="button" className="day7-secondary" onClick={showBack}>
                查看背面
              </button>
              <button type="button" onClick={handleCollect}>
                收下
              </button>
            </div>
            </>
          ) : (
            <>
            <div className="day7-card-meta">
              <span>{day7FirstCard.rarity}</span>
              <strong>{day7FirstCard.title}</strong>
              <small>NO. {day7FirstCard.cardNo}</small>
            </div>
            <div className="day7-card-actions">
              <button type="button" className="day7-secondary" onClick={showFront}>
                查看正面
              </button>
            </div>
            </>
          )}
        </motion.div>
      </div>
    </section>
  );
}
