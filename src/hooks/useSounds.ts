/**
 * Web Audio API sound engine — no CDN dependencies.
 *
 * Autoplay unlock strategy (same approach as Howler.js / Tone.js):
 *  1. Register a one-time click/touchstart listener at module load time.
 *     The first user gesture (lobby button, room join, etc.) creates the
 *     AudioContext inside a real gesture handler → browser starts it in
 *     "running" state immediately.
 *  2. All sounds schedule at currentTime + LEAD (150 ms) so even if resume()
 *     is still resolving on a slow device, audio fires after context wakes.
 *  3. Never bail on "suspended" — call resume() and let LEAD absorb the lag.
 */
import { useCallback, useRef } from 'react';
import { useSettingsStore } from '../store/useSettingsStore';

export type SoundType =
  | 'ROLL_SHAKE'
  | 'ROLL_TUMBLE'
  | 'ROLL_LAND'
  | 'MOVE'
  | 'CAPTURE'
  | 'WIN'
  | 'SIX'
  | 'TURN'
  | 'FINISH'
  | 'EMOJI_LAUGH'
  | 'EMOJI_CRY'
  | 'EMOJI_TEASE'
  | 'EMOJI_ANGRY';

const LEAD = 0.15; // seconds — absorbs resume() latency on slow devices

// ─── AudioContext singleton ───────────────────────────────────────────────────
let ctx: AudioContext | null = null;

const getCtx = (): AudioContext | null => {
  try {
    if (!ctx || ctx.state === 'closed') {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    return ctx;
  } catch {
    return null;
  }
};

// ── One-time unlock on first user gesture (module-level, runs on import) ─────
// This fires before the game starts, so by the time the dice is clicked the
// context is already in "running" state.
const _unlock = () => {
  getCtx();
  // Play a 1-sample silent buffer — the universally accepted browser unlock
  if (ctx && ctx.state === 'running') {
    try {
      const buf = ctx.createBuffer(1, 1, ctx.sampleRate);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      src.start(0);
    } catch {}
  }
};

if (typeof window !== 'undefined') {
  window.addEventListener('click',      _unlock, { once: true, passive: true });
  window.addEventListener('touchstart', _unlock, { once: true, passive: true });
  window.addEventListener('keydown',    _unlock, { once: true, passive: true });
}

// ─── Synthesis helpers ────────────────────────────────────────────────────────

const noiseCache = new Map<number, AudioBuffer>();
const noise = (c: AudioContext): AudioBufferSourceNode => {
  let buf = noiseCache.get(c.sampleRate);
  if (!buf) {
    buf = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    noiseCache.set(c.sampleRate, buf);
  }
  const src = c.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  return src;
};

const osc = (c: AudioContext, type: OscillatorType, freq: number) => {
  const o = c.createOscillator();
  o.type = type;
  o.frequency.value = freq;
  return o;
};

const gain = (c: AudioContext, vol: number) => {
  const g = c.createGain();
  g.gain.value = vol;
  return g;
};

// ─── Sound recipes ────────────────────────────────────────────────────────────

const woodKnock = (c: AudioContext, vol: number, pitch = 1.0) => {
  const t = c.currentTime + LEAD;

  const n = noise(c);
  const filt = c.createBiquadFilter();
  filt.type = 'bandpass';
  filt.frequency.value = 1800 * pitch;
  filt.Q.value = 3;
  const ng = gain(c, vol * 0.6);
  ng.gain.setValueAtTime(vol * 0.6, t);
  ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
  n.connect(filt); filt.connect(ng); ng.connect(c.destination);
  n.start(t); n.stop(t + 0.07);

  const body = osc(c, 'triangle', 140 * pitch);
  const bg = gain(c, vol * 0.5);
  bg.gain.setValueAtTime(vol * 0.5, t);
  bg.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
  body.frequency.exponentialRampToValueAtTime(60 * pitch, t + 0.18);
  body.connect(bg); bg.connect(c.destination);
  body.start(t); body.stop(t + 0.20);
};

const diceRattle = (c: AudioContext, vol: number) => {
  const t = c.currentTime + LEAD;
  for (let i = 0; i < 4; i++) {
    const d = i * 0.07;
    const n2 = noise(c);
    const f2 = c.createBiquadFilter();
    f2.type = 'bandpass';
    f2.frequency.value = 1200 + Math.random() * 600;
    f2.Q.value = 4;
    const g2 = gain(c, 0);
    g2.gain.setValueAtTime(vol * 0.45, t + d);
    g2.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.055);
    n2.connect(f2); f2.connect(g2); g2.connect(c.destination);
    n2.start(t + d); n2.stop(t + d + 0.07);
  }
};

const captureSound = (c: AudioContext, vol: number) => {
  const t = c.currentTime + LEAD;

  const n3 = noise(c);
  const f3 = c.createBiquadFilter();
  f3.type = 'highpass';
  f3.frequency.value = 900;
  const g3 = gain(c, vol * 0.8);
  g3.gain.setValueAtTime(vol * 0.8, t);
  g3.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
  n3.connect(f3); f3.connect(g3); g3.connect(c.destination);
  n3.start(t); n3.stop(t + 0.14);

  const b = osc(c, 'sine', 100);
  const bg = gain(c, vol * 0.7);
  bg.gain.setValueAtTime(vol * 0.7, t);
  bg.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
  b.frequency.exponentialRampToValueAtTime(40, t + 0.25);
  b.connect(bg); bg.connect(c.destination);
  b.start(t); b.stop(t + 0.27);

  // High-velocity slide "zip" — the captured piece flung back to its nest
  const zt = t + 0.05;
  const z = osc(c, 'sawtooth', 1500);
  z.frequency.exponentialRampToValueAtTime(170, zt + 0.20);
  const zf = c.createBiquadFilter();
  zf.type = 'bandpass';
  zf.frequency.value = 900;
  zf.Q.value = 1.4;
  const zg = gain(c, 0);
  zg.gain.setValueAtTime(0, zt);
  zg.gain.linearRampToValueAtTime(vol * 0.32, zt + 0.02);
  zg.gain.exponentialRampToValueAtTime(0.0001, zt + 0.22);
  z.connect(zf); zf.connect(zg); zg.connect(c.destination);
  z.start(zt); z.stop(zt + 0.24);
};

const winSound = (c: AudioContext, vol: number) => {
  const t = c.currentTime + LEAD;
  [261.6, 329.6, 392, 523].forEach((freq, i) => {
    const o2 = osc(c, 'sine', freq);
    const g4 = gain(c, 0);
    g4.gain.setValueAtTime(0, t + i * 0.12);
    g4.gain.linearRampToValueAtTime(vol * 0.4, t + i * 0.12 + 0.02);
    g4.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.12 + 0.35);
    o2.connect(g4); g4.connect(c.destination);
    o2.start(t + i * 0.12); o2.stop(t + i * 0.12 + 0.4);
  });
};

const sixSound = (c: AudioContext, vol: number) => {
  const t = c.currentTime + LEAD;
  [660, 880, 1100].forEach((freq, i) => {
    const o3 = osc(c, 'sine', freq);
    const g5 = gain(c, 0);
    g5.gain.setValueAtTime(0, t + i * 0.08);
    g5.gain.linearRampToValueAtTime(vol * 0.35, t + i * 0.08 + 0.015);
    g5.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.08 + 0.22);
    o3.connect(g5); g5.connect(c.destination);
    o3.start(t + i * 0.08); o3.stop(t + i * 0.08 + 0.25);
  });
};

const laughSound = (c: AudioContext, vol: number) => {
  const t = c.currentTime + LEAD;
  [400, 550, 700].forEach((f, i) => {
    const o4 = osc(c, 'sine', f);
    o4.frequency.linearRampToValueAtTime(f * 1.4, t + i * 0.1 + 0.09);
    const g6 = gain(c, 0);
    g6.gain.setValueAtTime(0, t + i * 0.1);
    g6.gain.linearRampToValueAtTime(vol * 0.3, t + i * 0.1 + 0.01);
    g6.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.1 + 0.10);
    o4.connect(g6); g6.connect(c.destination);
    o4.start(t + i * 0.1); o4.stop(t + i * 0.1 + 0.12);
  });
};

const crySound = (c: AudioContext, vol: number) => {
  const t = c.currentTime + LEAD;

  const o5 = osc(c, 'sine', 500);
  o5.frequency.linearRampToValueAtTime(220, t + 0.4);
  const g7 = gain(c, vol * 0.35);
  g7.gain.setValueAtTime(vol * 0.35, t);
  g7.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
  o5.connect(g7); g7.connect(c.destination);
  o5.start(t); o5.stop(t + 0.48);

  const o6 = osc(c, 'sine', 440);
  o6.frequency.linearRampToValueAtTime(180, t + 0.3);
  const g8 = gain(c, 0);
  g8.gain.setValueAtTime(0, t + 0.12);
  g8.gain.linearRampToValueAtTime(vol * 0.2, t + 0.14);
  g8.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);
  o6.connect(g8); g8.connect(c.destination);
  o6.start(t + 0.12); o6.stop(t + 0.45);
};

const teaseSound = (c: AudioContext, vol: number) => {
  const t = c.currentTime + LEAD;
  const o7 = osc(c, 'sine', 300);
  o7.frequency.exponentialRampToValueAtTime(700, t + 0.12);
  o7.frequency.exponentialRampToValueAtTime(400, t + 0.22);
  const g9 = gain(c, vol * 0.3);
  g9.gain.setValueAtTime(vol * 0.3, t);
  g9.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
  o7.connect(g9); g9.connect(c.destination);
  o7.start(t); o7.stop(t + 0.3);
};

const angrySound = (c: AudioContext, vol: number) => {
  const t = c.currentTime + LEAD;

  const saw = osc(c, 'sawtooth', 80);
  const filt = c.createBiquadFilter();
  filt.type = 'lowpass';
  filt.frequency.value = 400;
  const g10 = gain(c, vol * 0.4);
  g10.gain.setValueAtTime(vol * 0.4, t);
  g10.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
  saw.connect(filt); filt.connect(g10); g10.connect(c.destination);
  saw.start(t); saw.stop(t + 0.32);

  const nc = noise(c);
  const gn = gain(c, vol * 0.5);
  gn.gain.setValueAtTime(vol * 0.5, t);
  gn.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
  nc.connect(gn); gn.connect(c.destination);
  nc.start(t); nc.stop(t + 0.05);
};

// ─── Dispatch ─────────────────────────────────────────────────────────────────
const SYNTHS: Record<SoundType, (c: AudioContext, vol: number) => void> = {
  ROLL_SHAKE:  (c, v) => diceRattle(c, v),
  ROLL_TUMBLE: (c, v) => diceRattle(c, v * 0.5),
  ROLL_LAND:   (c, v) => woodKnock(c, v, 1.3),
  MOVE:        (c, v) => woodKnock(c, v * 0.7, 1.0),
  CAPTURE:     (c, v) => captureSound(c, v),
  WIN:         (c, v) => winSound(c, v),
  SIX:         (c, v) => sixSound(c, v),
  TURN:        (c, v) => sixSound(c, v * 0.5),
  FINISH:      (c, v) => winSound(c, v * 1.2),
  EMOJI_LAUGH: (c, v) => laughSound(c, v),
  EMOJI_CRY:   (c, v) => crySound(c, v),
  EMOJI_TEASE: (c, v) => teaseSound(c, v),
  EMOJI_ANGRY: (c, v) => angrySound(c, v),
};

// ─── Hook ─────────────────────────────────────────────────────────────────────
export const useSounds = () => {
  const { masterVolume, isMuted, sfxEnabled } = useSettingsStore();
  const lastPlayRef = useRef<Record<string, number>>({});

  const playSound = useCallback(
    (type: SoundType, throttleMs = 0) => {
      if (!sfxEnabled || isMuted || masterVolume <= 0) return;
      if (throttleMs > 0) {
        const last = lastPlayRef.current[type] ?? 0;
        if (Date.now() - last < throttleMs) return;
        lastPlayRef.current[type] = Date.now();
      }
      const c = getCtx();
      if (!c) return;
      // Do NOT bail on suspended — LEAD absorbs the resume() latency
      try {
        SYNTHS[type](c, masterVolume);
      } catch {
        // swallow synthesis errors silently
      }
    },
    [sfxEnabled, isMuted, masterVolume]
  );

  return { playSound, stopSound: (_: SoundType) => {} };
};
