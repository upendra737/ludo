import React, { useEffect, useLayoutEffect, useRef, useState, useCallback } from 'react';

/**
 * Production 3D dice.
 *
 * Hard rules that make it bulletproof:
 *  1. NO Framer Motion anywhere in the 3D transform chain. Framer manages
 *     `transform` through its own pipeline and silently drops the inherited
 *     `transform-style: preserve-3d` context — that is what was flattening the
 *     cube into a single dot / empty box. Every node here is a plain <div>
 *     with explicit preserve-3d.
 *  2. The cube transform is owned 100% imperatively (refs + rAF). React never
 *     writes `transform`, so a parent re-render can never reset or fight it.
 *  3. Landing is fully deterministic: the cube is rotated to the EXACT face
 *     for `value` before the settle transition starts, so the visible face is
 *     mathematically guaranteed to equal `value` — the label reads the same
 *     `value`, so a face/label mismatch is impossible by construction.
 *  4. Completion fires via transitionend AND a setTimeout fallback (guarded by
 *     a ref). transitionend can be silently skipped by the browser when a
 *     transition is interrupted; the fallback guarantees onSettled always runs.
 */

interface Props {
  value: number | null;
  rolling: boolean;
  onClick: () => void;
  disabled: boolean;
  onSettled: (value: number) => void;
  size?: number;
}

const DOT: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [[28, 28], [72, 72]],
  3: [[28, 28], [50, 50], [72, 72]],
  4: [[28, 28], [72, 28], [28, 72], [72, 72]],
  5: [[28, 28], [72, 28], [50, 50], [28, 72], [72, 72]],
  6: [[28, 22], [72, 22], [28, 50], [72, 50], [28, 78], [72, 78]],
};

// Cube rotation that brings each face value flush to the viewer
const FACE_ROT: Record<number, { x: number; y: number }> = {
  1: { x:   0, y:   0 },
  6: { x:   0, y: 180 },
  3: { x:   0, y: -90 },
  4: { x:   0, y:  90 },
  2: { x:  90, y:   0 },
  5: { x: -90, y:   0 },
};

const REST_X = -26;   // resting tilt — shows top + front + right => reads as a solid cube
const REST_Y =  34;
const REST_Z =  -5;

const MIN_TUMBLE_MS      = 200;  // floor so a fast server reply still gets a real tumble
const SETTLE_DURATION_MS = 240;  // springy landing  (total roll ≈ 440ms, within 400–500ms)
const FALLBACK_PAD_MS    = 140;  // transitionend safety-net buffer

export const Dice: React.FC<Props> = ({
  value, rolling, onClick, disabled, onSettled, size = 112,
}) => {
  const half = Math.round(size / 2);

  // Face placement on the cube — translateZ pushes each face out by half the edge
  const faceTransform: Record<number, string> = {
    1: `rotateY(0deg)    translateZ(${half}px)`,
    6: `rotateY(180deg)  translateZ(${half}px)`,
    3: `rotateY(90deg)   translateZ(${half}px)`,
    4: `rotateY(-90deg)  translateZ(${half}px)`,
    2: `rotateX(-90deg)  translateZ(${half}px)`,
    5: `rotateX(90deg)   translateZ(${half}px)`,
  };

  const cubeRef = useRef<HTMLDivElement>(null);

  // Accumulated rotation — persists across rolls so the cube spins on from where it rests
  const accX = useRef(REST_X);
  const accY = useRef(REST_Y);
  const accZ = useRef(REST_Z);

  // Tumble velocities (deg/sec) for a fluid, physical spin
  const velX = useRef(0);
  const velY = useRef(0);
  const velZ = useRef(0);

  const rafRef       = useRef<number | null>(null);
  const lastTsRef    = useRef(0);
  const startRef     = useRef(0);
  const settledRef   = useRef(false);
  const fallbackRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [glow, setGlow] = useState(false);

  const writeTransform = (x: number, y: number, z: number, transition: string) => {
    const el = cubeRef.current;
    if (!el) return;
    el.style.transition = transition;
    el.style.transform  = `translateZ(0) rotateX(${x}deg) rotateY(${y}deg) rotateZ(${z}deg)`;
  };

  // Imperative initial pose (React never owns `transform`)
  useLayoutEffect(() => {
    writeTransform(accX.current, accY.current, accZ.current, 'none');
  }, []);

  const stopRaf = () => {
    if (rafRef.current !== null) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
  };
  const clearFallback = () => {
    if (fallbackRef.current !== null) { clearTimeout(fallbackRef.current); fallbackRef.current = null; }
  };

  const finishSettle = useCallback((val: number) => {
    if (settledRef.current) return;
    settledRef.current = true;
    clearFallback();
    setGlow(val === 6);
    onSettled(val);
  }, [onSettled]);

  const settle = useCallback((val: number) => {
    stopRaf();

    const target = FACE_ROT[val];

    // Forward-only delta so the cube always rotates onward into the target face,
    // then lands EXACTLY on it (+2 full spins for drama). Visible face === val.
    const curX = ((accX.current % 360) + 360) % 360;
    const curY = ((accY.current % 360) + 360) % 360;
    const tgtX = ((target.x   % 360) + 360) % 360;
    const tgtY = ((target.y   % 360) + 360) % 360;
    const fwdX = ((tgtX - curX) + 360) % 360;
    const fwdY = ((tgtY - curY) + 360) % 360;

    accX.current = accX.current + fwdX + 720;
    accY.current = accY.current + fwdY + 720;
    accZ.current = 0;

    // Force a style flush so the browser registers the transition start reliably
    writeTransform(accX.current, accY.current, 0, 'none');
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    cubeRef.current?.offsetHeight;
    writeTransform(
      accX.current, accY.current, 0,
      `transform ${SETTLE_DURATION_MS}ms cubic-bezier(0.18, 1.25, 0.36, 1)`,
    );

    const el = cubeRef.current;
    const onEnd = (e: TransitionEvent) => {
      if (e.propertyName !== 'transform') return;
      el?.removeEventListener('transitionend', onEnd);
      finishSettle(val);
    };
    el?.addEventListener('transitionend', onEnd);

    // Safety net — transitionend can be silently dropped if interrupted
    clearFallback();
    fallbackRef.current = setTimeout(() => {
      el?.removeEventListener('transitionend', onEnd);
      finishSettle(val);
    }, SETTLE_DURATION_MS + FALLBACK_PAD_MS);
  }, [finishSettle]);

  // ── Tumble: velocity-integrated rAF for a smooth, genuine physical spin ──
  useEffect(() => {
    if (!rolling) return;

    settledRef.current = false;
    setGlow(false);
    startRef.current = performance.now();
    lastTsRef.current = startRef.current;

    // Strong multi-axis angular velocity, biased so it tumbles forward
    const rnd = (a: number, b: number) => a + Math.random() * (b - a);
    velX.current = rnd(620, 1020) * (Math.random() < 0.5 ? 1 : 0.6);
    velY.current = rnd(680, 1120);
    velZ.current = rnd(140, 300) * (Math.random() < 0.5 ? 1 : -1);

    const frame = (ts: number) => {
      const dt = Math.min(0.05, (ts - lastTsRef.current) / 1000);
      lastTsRef.current = ts;

      accX.current += velX.current * dt;
      accY.current += velY.current * dt;
      accZ.current += velZ.current * dt;

      writeTransform(accX.current, accY.current, accZ.current, 'none');
      rafRef.current = requestAnimationFrame(frame);
    };
    rafRef.current = requestAnimationFrame(frame);

    return stopRaf;
  }, [rolling]);

  // ── Settle once the true value is known (respecting the tumble floor) ──
  useEffect(() => {
    if (!rolling || value === null) return;

    const elapsed   = performance.now() - startRef.current;
    const remaining = MIN_TUMBLE_MS - elapsed;

    if (remaining <= 0) { settle(value); return; }
    const t = setTimeout(() => settle(value), remaining);
    return () => clearTimeout(t);
  }, [rolling, value, settle]);

  // Re-arm for the next roll cycle
  useEffect(() => {
    if (!rolling && value === null) settledRef.current = false;
  }, [rolling, value]);

  useEffect(() => () => { stopRaf(); clearFallback(); }, []);

  const interactive = !disabled && !rolling;
  const radius = Math.round(size * 0.17);

  return (
    <div
      className="flex flex-col items-center gap-3"
      style={{ position: 'relative', zIndex: 50, isolation: 'isolate' }}
    >
      {/* press/hover scale lives OUTSIDE the perspective context */}
      <div
        className={`dice-press${interactive ? ' di' : ''}`}
        onClick={interactive ? onClick : undefined}
        style={{ cursor: interactive ? 'pointer' : 'not-allowed' }}
      >
        {/* ground shadow */}
        <div style={{
          position: 'absolute', bottom: -10, left: '14%', width: '72%', height: 14,
          background: 'rgba(0,0,0,0.45)', borderRadius: '50%',
          filter: 'blur(7px)', transform: 'scaleY(0.45)', pointerEvents: 'none',
        }} />

        {/* six glow */}
        <div style={{
          position: 'absolute', inset: -size * 0.3,
          borderRadius: '50%', pointerEvents: 'none', zIndex: -1,
          background: 'radial-gradient(circle, rgba(251,191,36,0.7) 0%, transparent 66%)',
          filter: 'blur(18px)',
          opacity: glow ? 1 : 0,
          transform: glow ? 'scale(1)' : 'scale(0.5)',
          transition: 'opacity .35s ease, transform .35s ease',
        }} />

        {/* idle pulse ring */}
        {interactive && value === null && (
          <div className="dice-pulse" style={{
            position: 'absolute', inset: -5,
            border: '2px solid rgba(99,102,241,0.45)',
            borderRadius: radius + 4, pointerEvents: 'none',
          }} />
        )}

        {/* PERSPECTIVE STAGE — plain div, dramatic depth */}
        <div style={{
          width: size, height: size,
          perspective: `${Math.round(size * 2.7)}px`,
          perspectiveOrigin: '50% 45%',
          WebkitPerspective: `${Math.round(size * 2.7)}px`,
        }}>
          {/* CUBE — preserve-3d, transform owned imperatively */}
          <div
            ref={cubeRef}
            style={{
              position: 'relative',
              width: '100%', height: '100%',
              transformStyle: 'preserve-3d',
              WebkitTransformStyle: 'preserve-3d',
              filter: disabled ? 'grayscale(0.45) opacity(0.4)' : 'none',
            }}
          >
            {([1, 2, 3, 4, 5, 6] as const).map(fv => {
              const isSix = fv === 6;
              return (
                <div key={fv} style={{
                  position: 'absolute', inset: 0,
                  transform: faceTransform[fv],
                  transformStyle: 'preserve-3d',
                  WebkitTransformStyle: 'preserve-3d',
                  backfaceVisibility: 'hidden',
                  WebkitBackfaceVisibility: 'hidden',
                  borderRadius: radius,
                  background: isSix
                    ? 'linear-gradient(135deg,#fffdf2 0%,#fef3c7 55%,#fde68a 100%)'
                    : 'linear-gradient(135deg,#ffffff 0%,#eef4fb 55%,#dfe9f5 100%)',
                  border: isSix
                    ? '1.5px solid rgba(217,119,6,0.40)'
                    : '1.5px solid rgba(170,196,224,0.95)',
                  boxShadow: isSix
                    ? 'inset 3px 4px 10px rgba(255,255,255,0.95), inset -4px -5px 12px rgba(161,79,0,0.16)'
                    : 'inset 3px 4px 10px rgba(255,255,255,0.98), inset -4px -5px 12px rgba(15,40,75,0.14)',
                }}>
                  <svg viewBox="0 0 100 100" width="100%" height="100%" style={{ padding: '14%' }}>
                    {DOT[fv].map(([cx, cy], i) => (
                      <circle key={i} cx={cx} cy={cy} r="10.5"
                        fill={isSix ? '#92400e' : '#1e293b'} />
                    ))}
                  </svg>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Label — plain DOM, never part of the 3D chain */}
      <div style={{ minHeight: 20, display: 'flex', alignItems: 'center' }}>
        {interactive && value === null && (
          <span className="text-[10px] font-black text-indigo-400 tracking-widest uppercase bg-indigo-950/40 border border-indigo-500/20 px-2.5 py-0.5 rounded-full">
            Tap to Roll
          </span>
        )}
        {rolling && (
          <span className="dice-blink text-[10px] font-black text-slate-500 tracking-widest uppercase">
            Rolling…
          </span>
        )}
        {!rolling && value !== null && (
          <span className={`text-xs font-black tracking-wide ${value === 6 ? 'text-yellow-400' : 'text-slate-300'}`}>
            {value === 6 ? '🎉 SIX!' : `Rolled ${value}`}
          </span>
        )}
      </div>
    </div>
  );
};
