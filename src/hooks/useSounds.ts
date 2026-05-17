/**
 * Pure Web Audio API sound engine — no CDN dependencies.
 * Every sound is synthesised in real time, so it always works.
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

// ─── Audio context singleton ──────────────────────────────────────────────────
let sharedCtx: AudioContext | null = null;
const getCtx = (): AudioContext | null => {
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!sharedCtx || sharedCtx.state === 'closed') sharedCtx = new AC();
    if (sharedCtx.state === 'suspended') sharedCtx.resume();
    return sharedCtx;
  } catch { return null; }
};

// ─── Synthesis helpers ────────────────────────────────────────────────────────

/** White-noise buffer (cached per sample-rate) */
const noiseCache = new Map<number, AudioBuffer>();
const noise = (ctx: AudioContext): AudioBufferSourceNode => {
  let buf = noiseCache.get(ctx.sampleRate);
  if (!buf) {
    buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    noiseCache.set(ctx.sampleRate, buf);
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  return src;
};

const osc = (ctx: AudioContext, type: OscillatorType, freq: number): OscillatorNode => {
  const o = ctx.createOscillator();
  o.type  = type;
  o.frequency.value = freq;
  return o;
};

const gain = (ctx: AudioContext, vol: number): GainNode => {
  const g = ctx.createGain();
  g.gain.value = vol;
  return g;
};

// ─── Individual sound recipes ────────────────────────────────────────────────

/** Wooden knock — token placed on board */
const woodKnock = (ctx: AudioContext, vol: number, pitch = 1.0) => {
  const t = ctx.currentTime;

  // Transient crack (filtered noise)
  const n = noise(ctx);
  const filt = ctx.createBiquadFilter();
  filt.type = 'bandpass';
  filt.frequency.value = 1800 * pitch;
  filt.Q.value = 3;
  const ng = gain(ctx, vol * 0.6);
  ng.gain.setValueAtTime(vol * 0.6, t);
  ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
  n.connect(filt); filt.connect(ng); ng.connect(ctx.destination);
  n.start(t); n.stop(t + 0.07);

  // Body resonance (wood thud)
  const body = osc(ctx, 'triangle', 140 * pitch);
  const bg = gain(ctx, vol * 0.5);
  bg.gain.setValueAtTime(vol * 0.5, t);
  bg.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
  body.frequency.exponentialRampToValueAtTime(60 * pitch, t + 0.18);
  body.connect(bg); bg.connect(ctx.destination);
  body.start(t); body.stop(t + 0.20);
};

/** Dice rattle (short burst) */
const diceRattle = (ctx: AudioContext, vol: number) => {
  const t = ctx.currentTime;
  // Multiple quick knocks
  for (let i = 0; i < 4; i++) {
    const delay = i * 0.07;
    const n2 = noise(ctx);
    const f2 = ctx.createBiquadFilter();
    f2.type = 'bandpass';
    f2.frequency.value = 1200 + Math.random() * 600;
    f2.Q.value = 4;
    const g2 = gain(ctx, 0);
    g2.gain.setValueAtTime(vol * 0.4, t + delay);
    g2.gain.exponentialRampToValueAtTime(0.0001, t + delay + 0.05);
    n2.connect(f2); f2.connect(g2); g2.connect(ctx.destination);
    n2.start(t + delay); n2.stop(t + delay + 0.06);
  }
};

/** Capture impact (harder knock + crack) */
const captureSound = (ctx: AudioContext, vol: number) => {
  const t = ctx.currentTime;
  // Hard crack
  const n3 = noise(ctx);
  const f3 = ctx.createBiquadFilter();
  f3.type = 'highpass';
  f3.frequency.value = 900;
  const g3 = gain(ctx, vol * 0.8);
  g3.gain.setValueAtTime(vol * 0.8, t);
  g3.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
  n3.connect(f3); f3.connect(g3); g3.connect(ctx.destination);
  n3.start(t); n3.stop(t + 0.14);

  // Deep thud
  const b = osc(ctx, 'sine', 100);
  const bg = gain(ctx, vol * 0.7);
  bg.gain.setValueAtTime(vol * 0.7, t);
  bg.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
  b.frequency.exponentialRampToValueAtTime(40, t + 0.25);
  b.connect(bg); bg.connect(ctx.destination);
  b.start(t); b.stop(t + 0.27);
};

/** Win fanfare — C-E-G ascending */
const winSound = (ctx: AudioContext, vol: number) => {
  const t = ctx.currentTime;
  [261.6, 329.6, 392, 523].forEach((freq, i) => {
    const o2 = osc(ctx, 'sine', freq);
    const g4 = gain(ctx, 0);
    g4.gain.setValueAtTime(0, t + i * 0.12);
    g4.gain.linearRampToValueAtTime(vol * 0.4, t + i * 0.12 + 0.02);
    g4.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.12 + 0.35);
    o2.connect(g4); g4.connect(ctx.destination);
    o2.start(t + i * 0.12); o2.stop(t + i * 0.12 + 0.4);
  });
};

/** Six chime — bright upward sweep */
const sixSound = (ctx: AudioContext, vol: number) => {
  const t = ctx.currentTime;
  [660, 880, 1100].forEach((freq, i) => {
    const o3 = osc(ctx, 'sine', freq);
    const g5 = gain(ctx, 0);
    g5.gain.setValueAtTime(0, t + i * 0.08);
    g5.gain.linearRampToValueAtTime(vol * 0.35, t + i * 0.08 + 0.015);
    g5.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.08 + 0.22);
    o3.connect(g5); g5.connect(ctx.destination);
    o3.start(t + i * 0.08); o3.stop(t + i * 0.08 + 0.25);
  });
};

// ─── Emoji sounds ─────────────────────────────────────────────────────────────

/** 😂 Laugh — rising happy sweep */
const laughSound = (ctx: AudioContext, vol: number) => {
  const t = ctx.currentTime;
  // Three quick rising squeaks
  [400, 550, 700].forEach((f, i) => {
    const o4 = osc(ctx, 'sine', f);
    o4.frequency.linearRampToValueAtTime(f * 1.4, t + i * 0.1 + 0.09);
    const g6 = gain(ctx, 0);
    g6.gain.setValueAtTime(0, t + i * 0.1);
    g6.gain.linearRampToValueAtTime(vol * 0.3, t + i * 0.1 + 0.01);
    g6.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.1 + 0.10);
    o4.connect(g6); g6.connect(ctx.destination);
    o4.start(t + i * 0.1); o4.stop(t + i * 0.1 + 0.12);
  });
};

/** 😢 Cry — descending sad tones */
const crySound = (ctx: AudioContext, vol: number) => {
  const t = ctx.currentTime;
  const o5 = osc(ctx, 'sine', 500);
  o5.frequency.linearRampToValueAtTime(220, t + 0.4);
  const g7 = gain(ctx, vol * 0.35);
  g7.gain.setValueAtTime(vol * 0.35, t);
  g7.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
  o5.connect(g7); g7.connect(ctx.destination);
  o5.start(t); o5.stop(t + 0.48);
  // Second descending tone
  const o6 = osc(ctx, 'sine', 440);
  o6.frequency.linearRampToValueAtTime(180, t + 0.3);
  const g8 = gain(ctx, 0);
  g8.gain.setValueAtTime(0, t + 0.12);
  g8.gain.linearRampToValueAtTime(vol * 0.2, t + 0.14);
  g8.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);
  o6.connect(g8); g8.connect(ctx.destination);
  o6.start(t + 0.12); o6.stop(t + 0.45);
};

/** 😏 Tease — playful bouncy boing */
const teaseSound = (ctx: AudioContext, vol: number) => {
  const t = ctx.currentTime;
  const o7 = osc(ctx, 'sine', 300);
  o7.frequency.exponentialRampToValueAtTime(700, t + 0.12);
  o7.frequency.exponentialRampToValueAtTime(400, t + 0.22);
  const g9 = gain(ctx, vol * 0.3);
  g9.gain.setValueAtTime(vol * 0.3, t);
  g9.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
  o7.connect(g9); g9.connect(ctx.destination);
  o7.start(t); o7.stop(t + 0.3);
};

/** 😡 Angry — harsh low buzz burst */
const angrySound = (ctx: AudioContext, vol: number) => {
  const t = ctx.currentTime;
  const saw = osc(ctx, 'sawtooth', 80);
  const filt = ctx.createBiquadFilter();
  filt.type = 'lowpass';
  filt.frequency.value = 400;
  const g10 = gain(ctx, vol * 0.4);
  g10.gain.setValueAtTime(vol * 0.4, t);
  g10.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
  saw.connect(filt); filt.connect(g10); g10.connect(ctx.destination);
  saw.start(t); saw.stop(t + 0.32);
  // Sharp noise crack at start
  const nc = noise(ctx);
  const gn = gain(ctx, vol * 0.5);
  gn.gain.setValueAtTime(vol * 0.5, t);
  gn.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
  nc.connect(gn); gn.connect(ctx.destination);
  nc.start(t); nc.stop(t + 0.05);
};

// ─── Sound dispatch ───────────────────────────────────────────────────────────

const SYNTHS: Record<SoundType, (ctx: AudioContext, vol: number) => void> = {
  ROLL_SHAKE:  (ctx, v) => diceRattle(ctx, v),
  ROLL_TUMBLE: (ctx, v) => diceRattle(ctx, v * 0.5),
  ROLL_LAND:   (ctx, v) => woodKnock(ctx, v, 1.3),
  MOVE:        (ctx, v) => woodKnock(ctx, v * 0.7, 1.0),
  CAPTURE:     (ctx, v) => captureSound(ctx, v),
  WIN:         (ctx, v) => winSound(ctx, v),
  SIX:         (ctx, v) => sixSound(ctx, v),
  TURN:        (ctx, v) => sixSound(ctx, v * 0.5),
  FINISH:      (ctx, v) => winSound(ctx, v * 1.2),
  EMOJI_LAUGH: (ctx, v) => laughSound(ctx, v),
  EMOJI_CRY:   (ctx, v) => crySound(ctx, v),
  EMOJI_TEASE: (ctx, v) => teaseSound(ctx, v),
  EMOJI_ANGRY: (ctx, v) => angrySound(ctx, v),
};

// ─── Hook ────────────────────────────────────────────────────────────────────

export const useSounds = () => {
  const { masterVolume, isMuted, sfxEnabled } = useSettingsStore();
  const lastPlayRef = useRef<Record<string, number>>({});

  const playSound = useCallback((type: SoundType, throttleMs = 0) => {
    if (!sfxEnabled || isMuted || masterVolume <= 0) return;
    if (throttleMs > 0) {
      const last = lastPlayRef.current[type] ?? 0;
      if (Date.now() - last < throttleMs) return;
      lastPlayRef.current[type] = Date.now();
    }
    const ctx = getCtx();
    if (!ctx) return;
    try { SYNTHS[type]?.(ctx, masterVolume); } catch { /* silent */ }
  }, [sfxEnabled, isMuted, masterVolume]);

  // No-op stopSound kept for API compatibility
  const stopSound = useCallback((_type: SoundType) => {}, []);

  return { playSound, stopSound };
};
