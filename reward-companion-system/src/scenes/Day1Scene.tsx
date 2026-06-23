import { motion, useReducedMotion } from "framer-motion";
import type { CSSProperties } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createRewardAudioController } from "../audio/rewardAudio";
import day1Desktop from "../assets/reward/day1/day1-desktop.webp";
import day1Mobile from "../assets/reward/day1/day1-mobile.webp";
import type { RewardConfigItem } from "../config/rewardConfig";

type Day1SceneProps = {
  reward: RewardConfigItem;
  onCollect?: () => void;
  onClose?: () => void;
  onComplete?: () => void;
};

export function Day1Scene({ reward, onCollect, onClose, onComplete }: Day1SceneProps) {
  const reduceMotion = useReducedMotion();
  const [collected, setCollected] = useState(false);
  const [closing, setClosing] = useState(false);
  const [previewEnded, setPreviewEnded] = useState(false);
  const [replayKey, setReplayKey] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const didCollectRef = useRef(false);
  const audioRef = useRef<ReturnType<typeof createRewardAudioController> | null>(null);
  const particles = useMemo(() => Array.from({ length: reduceMotion ? 8 : 22 }, (_, index) => index), [reduceMotion]);
  const hasExternalExit = Boolean(onClose || onComplete);

  useEffect(() => {
    audioRef.current = createRewardAudioController();

    return () => {
      audioRef.current?.destroy();
      audioRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (closing) {
      audioRef.current?.stop();
    }
  }, [closing]);

  useEffect(() => {
    if (!collected) {
      return undefined;
    }

    const closeDelay = reduceMotion ? 320 : 1000;
    const doneDelay = reduceMotion ? 520 : 1400;
    const closeTimer = window.setTimeout(() => setClosing(true), closeDelay);
    const doneTimer = window.setTimeout(() => {
      if (hasExternalExit) {
        onClose?.();
        onComplete?.();
        return;
      }

      setPreviewEnded(true);
    }, doneDelay);

    return () => {
      window.clearTimeout(closeTimer);
      window.clearTimeout(doneTimer);
    };
  }, [collected, hasExternalExit, onClose, onComplete, reduceMotion]);

  function handleCollect() {
    if (didCollectRef.current) {
      return;
    }

    didCollectRef.current = true;
    setCollected(true);
    audioRef.current?.playCollect();
    onCollect?.();
  }

  function handleReplay() {
    didCollectRef.current = false;
    setCollected(false);
    setClosing(false);
    setPreviewEnded(false);
    setReplayKey((current) => current + 1);
  }

  async function handleEnableSound() {
    const didStart = await audioRef.current?.start();

    if (didStart) {
      setSoundEnabled(true);
    }
  }

  const timing = {
    blackout: reduceMotion ? 0.1 : 0.5,
    light: reduceMotion ? 0.05 : 0.7,
    sweep: reduceMotion ? 0.1 : 1.2,
    art: reduceMotion ? 0.1 : 0.5,
    heading: reduceMotion ? 0.12 : 1.5,
    card: reduceMotion ? 0.14 : 2.3,
    button: reduceMotion ? 0.16 : 2.7,
  };

  if (previewEnded) {
    return (
      <motion.div
        className="preview-end-state"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: reduceMotion ? 0.12 : 0.36, ease: "easeOut" }}
      >
        <motion.div
          className="preview-end-card"
          initial={{ opacity: 0, y: reduceMotion ? 0 : 18, scale: reduceMotion ? 1 : 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: reduceMotion ? 0 : 0.08, duration: reduceMotion ? 0.12 : 0.46, ease: [0.22, 1, 0.36, 1] }}
        >
          <span aria-hidden="true">+1</span>
          <h1>已收下</h1>
          <p>今天也继续发光吧</p>
          <button type="button" onClick={handleReplay}>
            重新预览
          </button>
        </motion.div>
      </motion.div>
    );
  }

  return (
    <motion.div
      key={replayKey}
      className={`day1-scene${collected ? " is-collected" : ""}${closing ? " is-closing" : ""}`}
      style={
        {
          "--reward-glow": reward.visual.glow,
          "--reward-accent": reward.visual.accent,
          "--reward-card": reward.visual.card,
        } as CSSProperties
      }
      animate={{ opacity: closing ? 0 : 1 }}
      transition={{ duration: reduceMotion ? 0.12 : 0.4, ease: "easeOut" }}
    >
      <button
        type="button"
        className={`reward-sound-toggle${soundEnabled ? " is-on" : ""}`}
        onClick={handleEnableSound}
        disabled={soundEnabled}
        aria-label={soundEnabled ? "声音已开启" : "开启奖励场景声音"}
      >
        {soundEnabled ? "声音已开" : "点一下开声音"}
      </button>

      <motion.picture
        className="day1-art-layer"
        initial={{ opacity: 0, scale: reduceMotion ? 1 : 1.035, filter: "brightness(.28) saturate(.85)" }}
        animate={{ opacity: 1, scale: reduceMotion ? 1 : [1.035, 1.012, 1.018], filter: "brightness(1) saturate(1.08)" }}
        transition={{ delay: timing.art, duration: reduceMotion ? 0.12 : 0.8, ease: [0.22, 1, 0.36, 1] }}
      >
        <source srcSet={day1Mobile} media="(orientation: portrait), (max-aspect-ratio: 4/5)" />
        <img src={day1Desktop} alt="" aria-hidden="true" />
      </motion.picture>

      <div className="day1-bg-shade" aria-hidden="true" />
      <motion.div
        className="day1-blackout"
        initial={{ opacity: 1 }}
        animate={{ opacity: 0 }}
        transition={{ delay: reduceMotion ? 0.05 : 0.5, duration: reduceMotion ? 0.08 : 0.52, ease: "easeOut" }}
      />

      <motion.div
        className="day1-first-light"
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: [0, 1, 0.84], scale: [0.5, 1.18, 1] }}
        transition={{ delay: timing.light, duration: reduceMotion ? 0.12 : 0.7, ease: [0.22, 1, 0.36, 1] }}
        aria-hidden="true"
      />

      <motion.div
        className="day1-light-ocean"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: reduceMotion ? 0.08 : 1.2, duration: reduceMotion ? 0.12 : 0.8, ease: "easeOut" }}
        aria-hidden="true"
      />

      <motion.div
        className="day1-spotlight"
        initial={{ opacity: 0, x: "-68vw", rotate: -22, scaleX: 0.72 }}
        animate={
          reduceMotion
            ? { opacity: 0 }
            : { opacity: [0, 0.8, 0.52, 0], x: ["-68vw", "-18vw", "17vw", "54vw"], rotate: [-22, -7, 9, 18], scaleX: [0.72, 1.12, 0.94, 0.74] }
        }
        transition={{ delay: timing.sweep, duration: 0.9, ease: "easeInOut" }}
        aria-hidden="true"
      />

      <motion.div
        className="day1-taegg-focus"
        initial={{ opacity: 0, scale: 0.84 }}
        animate={{ opacity: [0, 0.86, 0.54], scale: [0.84, 1.08, 1] }}
        transition={{ delay: timing.art + 0.2, duration: reduceMotion ? 0.12 : 0.8, ease: [0.22, 1, 0.36, 1] }}
        aria-hidden="true"
      />

      <section className="reward-ui">
        <motion.header
          className="reward-copy"
          initial={{ opacity: 0, y: 18, filter: "blur(14px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ delay: timing.heading, duration: reduceMotion ? 0.12 : 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          <motion.span
            className="reward-eyebrow"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: timing.heading, duration: reduceMotion ? 0.1 : 0.32 }}
          >
            {reward.copy.eyebrow}
          </motion.span>
          <motion.h1
            className="reward-title"
            initial={{ opacity: 0, y: 12, filter: "blur(10px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ delay: timing.heading + (reduceMotion ? 0 : 0.22), duration: reduceMotion ? 0.1 : 0.42 }}
          >
            {reward.copy.title}
          </motion.h1>
          <motion.p
            className="reward-subtitle"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: timing.heading + (reduceMotion ? 0 : 0.46), duration: reduceMotion ? 0.1 : 0.36 }}
          >
            {reward.copy.subtitle}
          </motion.p>
        </motion.header>

        <motion.section
          className="reward-card"
          initial={{ opacity: 0, y: 34, scale: 0.96, filter: "blur(14px)" }}
          animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
          transition={{ delay: timing.card, duration: reduceMotion ? 0.12 : 0.72, ease: [0.22, 1, 0.36, 1] }}
        >
          <span className="card-star one" aria-hidden="true" />
          <span className="card-star two" aria-hidden="true" />
          <div className="reward-pill">{reward.copy.badge}</div>
          <div className="reward-card-copy">
            <h2>{reward.copy.cardTitle}</h2>
            <p>{reward.copy.cardBody}</p>
          </div>
          <motion.button
            type="button"
            onClick={handleCollect}
            disabled={collected}
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: collected ? [1, 0.92, 1.04, 1] : 1 }}
            whileTap={{ scale: collected ? 1 : 0.94 }}
            transition={{ delay: collected ? 0 : timing.button, duration: collected ? 0.34 : reduceMotion ? 0.12 : 0.46, ease: [0.22, 1, 0.36, 1] }}
          >
            {reward.copy.cta}
          </motion.button>
        </motion.section>
      </section>

      {collected && (
        <motion.div
          className="taegg-collect-wave"
          initial={{ opacity: 0.82, scale: 0.7 }}
          animate={{ opacity: 0, scale: reduceMotion ? 1.1 : 2.2 }}
          transition={{ duration: reduceMotion ? 0.25 : 0.9, ease: "easeOut" }}
          aria-hidden="true"
        />
      )}

      {collected && (
        <motion.div
          className="reward-gain"
          initial={{ opacity: 0, y: 14, scale: 0.88 }}
          animate={{ opacity: [0, 1, 1, 0], y: reduceMotion ? [0, 0, 0, 0] : [14, 0, -12, -26], scale: [0.88, 1, 1, 0.96] }}
          transition={{ duration: reduceMotion ? 0.6 : 1.05, ease: "easeOut" }}
        >
          {reward.copy.gain}
        </motion.div>
      )}

      {collected && (
        <div className="collected-particles" aria-hidden="true">
          {particles.map((particle) => (
            <motion.span
              key={particle}
              style={{ "--particle-x": `${(particle % 7) * 36 - 108}px` } as CSSProperties}
              initial={{ opacity: 0, y: 0, scale: 0.72 }}
              animate={{ opacity: [0, 1, 0], y: reduceMotion ? -24 : -168 - particle * 4, scale: [0.72, 1.08, 0.42] }}
              transition={{ delay: reduceMotion ? 0 : particle * 0.018, duration: reduceMotion ? 0.4 : 0.96, ease: "easeOut" }}
            />
          ))}
        </div>
      )}
    </motion.div>
  );
}
