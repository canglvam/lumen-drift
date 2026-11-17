// Synthesized sound effects on the Web Audio API: no audio files, no network. The context is
// created lazily on the first user gesture (browsers block audio before one) and every call is
// guarded, so a headless run or a muted tab never throws.
export function createAudio() {
  let context = null;
  let master = null;
  let muted = false;

  function ensure() {
    if (context !== null) {
      if (context.state === 'suspended') context.resume().catch(() => {});
      return context !== null;
    }
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return false;
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = 0.22;
      master.connect(context.destination);
      return true;
    } catch {
      context = null;
      return false;
    }
  }

  /** A short oscillator note: frequency slides from `from` to `to` over `seconds`. */
  function tone(from, to, seconds, type, volume, when = 0) {
    if (muted || !ensure()) return;
    try {
      const start = context.currentTime + when;
      const osc = context.createOscillator();
      const gain = context.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(from, start);
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), start + seconds);
      gain.gain.setValueAtTime(volume, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + seconds);
      osc.connect(gain);
      gain.connect(master);
      osc.start(start);
      osc.stop(start + seconds + 0.02);
    } catch {
      // Sound is garnish: never let it break the game.
    }
  }

  return {
    unlock() {
      ensure();
    },
    toggleMute() {
      muted = !muted;
      return muted;
    },
    isMuted() {
      return muted;
    },
    collect() {
      tone(660, 990, 0.09, 'sine', 0.5);
    },
    bank(combo) {
      const base = 523 * (1 + 0.06 * combo);
      tone(base, base, 0.1, 'triangle', 0.5);
      tone(base * 1.25, base * 1.25, 0.12, 'triangle', 0.45, 0.07);
      tone(base * 1.5, base * 1.5, 0.18, 'triangle', 0.4, 0.14);
    },
    hit() {
      tone(180, 55, 0.28, 'sawtooth', 0.6);
    },
    dash() {
      tone(300, 900, 0.14, 'sine', 0.35);
    },
    shatter() {
      tone(880, 220, 0.12, 'square', 0.25);
    },
    levelUp() {
      tone(440, 440, 0.09, 'triangle', 0.45);
      tone(554, 554, 0.09, 'triangle', 0.45, 0.08);
      tone(659, 659, 0.16, 'triangle', 0.45, 0.16);
    },
    win() {
      [523, 659, 784, 1047].forEach((freq, i) => tone(freq, freq, 0.22, 'triangle', 0.45, i * 0.12));
    },
    lose() {
      [392, 330, 262, 196].forEach((freq, i) => tone(freq, freq * 0.94, 0.22, 'sine', 0.4, i * 0.14));
    },
  };
}
