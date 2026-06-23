type BrowserAudioContext = typeof AudioContext;

type RewardAudioState = {
  context: AudioContext;
  master: GainNode;
  ambientNodes: OscillatorNode[];
};

function getAudioContextConstructor(): BrowserAudioContext | null {
  if (typeof window === "undefined") {
    return null;
  }

  return window.AudioContext ?? null;
}

function rampGain(gain: AudioParam, value: number, context: AudioContext, duration = 0.32) {
  gain.cancelScheduledValues(context.currentTime);
  gain.setTargetAtTime(value, context.currentTime, duration);
}

export function createRewardAudioController() {
  let state: RewardAudioState | null = null;

  async function ensureState() {
    if (state) {
      return state;
    }

    const AudioContextConstructor = getAudioContextConstructor();

    if (!AudioContextConstructor) {
      return null;
    }

    const context = new AudioContextConstructor();
    const master = context.createGain();
    const filter = context.createBiquadFilter();
    const ambientGain = context.createGain();
    const ambientNodes: OscillatorNode[] = [];

    master.gain.value = 0;
    filter.type = "lowpass";
    filter.frequency.value = 1280;
    ambientGain.gain.value = 0.18;

    filter.connect(ambientGain);
    ambientGain.connect(master);
    master.connect(context.destination);

    [
      { frequency: 196, type: "sine" as OscillatorType },
      { frequency: 293.66, type: "triangle" as OscillatorType },
      { frequency: 392, type: "sine" as OscillatorType },
    ].forEach((tone, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();

      oscillator.type = tone.type;
      oscillator.frequency.value = tone.frequency;
      gain.gain.value = index === 1 ? 0.08 : 0.06;

      oscillator.connect(gain);
      gain.connect(filter);
      oscillator.start();
      ambientNodes.push(oscillator);
    });

    state = { context, master, ambientNodes };
    return state;
  }

  async function start() {
    const nextState = await ensureState();

    if (!nextState) {
      return false;
    }

    if (nextState.context.state === "suspended") {
      await nextState.context.resume();
    }

    rampGain(nextState.master.gain, 0.08, nextState.context, 0.42);
    return true;
  }

  function playCollect() {
    if (!state) {
      return;
    }

    const { context, master } = state;
    const now = context.currentTime;
    const notes = [523.25, 659.25, 783.99];

    notes.forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();

      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(frequency, now + index * 0.07);
      gain.gain.setValueAtTime(0, now + index * 0.07);
      gain.gain.linearRampToValueAtTime(0.16, now + index * 0.07 + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.001, now + index * 0.07 + 0.45);

      oscillator.connect(gain);
      gain.connect(master);
      oscillator.start(now + index * 0.07);
      oscillator.stop(now + index * 0.07 + 0.5);
    });
  }

  function stop() {
    if (!state) {
      return;
    }

    rampGain(state.master.gain, 0, state.context, 0.18);
  }

  function destroy() {
    if (!state) {
      return;
    }

    stop();
    window.setTimeout(() => {
      state?.ambientNodes.forEach((node) => {
        try {
          node.stop();
        } catch {
          // Audio nodes may already be stopped by the browser.
        }
      });
      state?.context.close();
      state = null;
    }, 260);
  }

  return { destroy, playCollect, start, stop };
}
