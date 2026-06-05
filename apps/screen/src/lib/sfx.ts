/**
 * Tiny game-show sound effects, synthesized with the Web Audio API — no audio
 * files to host/load. Browsers require a user gesture before audio can play, so
 * the context is resumed on the first pointer interaction (the host's clicks).
 */
let ctx: AudioContext | null = null;

function ac(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

/** Play one enveloped oscillator note. */
function note(freq: number, start: number, dur: number, type: OscillatorType = 'sine', gain = 0.2): void {
  const c = ac();
  if (!c) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.value = freq;
  o.connect(g);
  g.connect(c.destination);
  const t0 = c.currentTime + start;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.start(t0);
  o.stop(t0 + dur + 0.03);
}

export const sfx = {
  whoosh() { note(330, 0, 0.12, 'triangle', 0.14); note(495, 0.06, 0.13, 'triangle', 0.1); },
  lock() { note(170, 0, 0.1, 'square', 0.16); },
  reveal() { [523, 659, 784].forEach((f, i) => note(f, i * 0.07, 0.18, 'sine', 0.15)); },
  ding() { note(880, 0, 0.18, 'sine', 0.18); note(1320, 0.05, 0.16, 'sine', 0.1); },
  eliminate() { note(300, 0, 0.18, 'sawtooth', 0.15); note(200, 0.13, 0.24, 'sawtooth', 0.15); },
  win() {
    [523, 659, 784, 1047].forEach((f, i) => note(f, i * 0.12, 0.45, 'triangle', 0.2));
    note(1047, 0.62, 0.8, 'sine', 0.14);
  },
};

/** Resume the audio context on the first user gesture (autoplay policy). */
export function initSfxGesture(): void {
  if (typeof window === 'undefined') return;
  const resume = () => { ac(); window.removeEventListener('pointerdown', resume); };
  window.addEventListener('pointerdown', resume, { once: true });
}
