import React, { useEffect, useLayoutEffect, useRef, useState, useCallback } from 'react';

/**
 * Production 3D dice — choreographed, never flattens, never vanishes, never desyncs.
 *
 * Three hard rules (each a bug that was actually shipped before):
 *
 *  1. NO flatten-triggers in the 3D chain. Per the CSS spec, `transform-style:
 *     preserve-3d` is forced to `flat` when the element has `filter`,
 *     `opacity<1`, `overflow≠visible`, `clip-path`, `mask`, or `isolation`.
 *     The cube and every node between the perspective element and the faces
 *     therefore carry NONE of those. The "disabled" dim is applied on
 *     `.dice-press`, which is ABOVE the perspective element, so it composites
 *     the finished 2D render without collapsing the cube's own 3D context.
 *
 *  2. NO backface culling. `backface-visibility:hidden` makes the browser drop
 *     faces mid-tumble, which is the intermittent "vanish". All six faces are
 *     fully opaque instead — the cube is a closed solid, depth-sorted, so the
 *     near faces always occlude the far ones and something is always drawn.
 *
 *  3. Choreographed rotation. A free random X/Y/Z tumble passes through
 *     edge-on orientations where a hollow plane-cube genuinely looks flat.
 *     Here `rotateY` spins; `rotateX`/`rotateZ` only wobble inside a bounded
 *     cone that never approaches 90°, so 2-3 solid faces are visible on every
 *     single frame. The landing pose is the value's face plus a constant 3/4
 *     tilt — deterministic, so the visible face always equals `value`.
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

// Cube rotation that brings each face flush to the camera (before the 3/4 tilt)
const FACE_ROT: Record<number, { x: number; y: number }> = {
  1: { x:   0, y:   0 },
  6: { x:   0, y: 180 },
  3: { x:   0, y: -90 },
  4: { x:   0, y:  90 },
  2: { x: -90, y:   0 },
  5: { x:  90, y:   0 },
};

// During the TUMBLE: a wide bounded-cone tilt so the spinning cube always
// shows 2-3 solid faces and never goes edge-on / flat.
const SPIN_X = -22;
const SPIN_Z =  -4;

// At REST / landing: a small tilt so the cube shows essentially ONE face (the
// rolled value) with just a gentle 3D hint — not the 3-face corner view.
const REST_X =  -9;
const REST_Y =  11;
const REST_Z =   0;

const resultPose = (v: number) => ({
  x: FACE_ROT[v].x + REST_X,
  y: FACE_ROT[v].y + REST_Y,
  z: REST_Z,
});
const IDLE = { x: REST_X, y: REST_Y, z: REST_Z }; // == resultPose(1)

const MIN_TUMBLE_MS      = 200;  // spin floor so a fast server reply still tumbles
const SETTLE_DURATION_MS = 240;  // spring landing  (total ≈ 440ms, within 400–500ms)
const FALLBACK_PAD_MS    = 150;  // transitionend safety-net buffer

export const Dice: React.FC<Props> = ({
  value, rolling, onClick, disabled, onSettled, size = 112,
}) => {
  const half  = Math.round(size / 2);
  const depth = `${Math.round(size * 2.7)}px`; // dramatic perspective

  // Static placement of each face on the (unrotated) cube
  const faceTransform: Record<number, string> = {
    1: `rotateY(0deg)   translateZ(${half}px)`,
    6: `rotateY(180deg) translateZ(${half}px)`,
    3: `rotateY(90deg)  translateZ(${half}px)`,
    4: `rotateY(-90deg) translateZ(${half}px)`,
    2: `rotateX(90deg)  translateZ(${half}px)`,
    5: `rotateX(-90deg) translateZ(${half}px)`,
  };

  const cubeRef = useRef<HTMLDivElement>(null);

  // Accumulated rotation (persists across rolls so the spin continues smoothly)
  const rx = useRef(IDLE.x);
  const ry = useRef(IDLE.y);
  const rz = useRef(IDLE.z);

  const velY        = useRef(0);   // continuous spin speed during a roll (deg/s)
  const rafRef      = useRef<number | null>(null);
  const startRef    = useRef(0);
  const lastTsRef   = useRef(0);
  const settledRef  = useRef(false);
  const fallbackRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [glow, setGlow] = useState(false);

  const write = (x: number, y: number, z: number, transition: string) => {
    const el = cubeRef.current;
    if (!el) return;
    el.style.transition = transition;
    el.style.transform  = `translateZ(0) rotateX(${x}deg) rotateY(${y}deg) rotateZ(${z}deg)`;
  };

  useLayoutEffect(() => { write(rx.current, ry.current, rz.current, 'none'); }, []);

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
    const pose = resultPose(val);

    // Current (pre-settle) pose from the last tumble frame
    const fromX = rx.current;
    const fromY = ry.current;
    const fromZ = rz.current;

    // Forward-only Y delta → the cube always rolls onward into the result and
    // lands EXACTLY on it (+2 spins for drama). X/Z ease from their wobble.
    const curYn = ((fromY % 360) + 360) % 360;
    const tgtYn = ((pose.y % 360) + 360) % 360;
    const fwdY  = ((tgtYn - curYn) + 360) % 360;

    const finalX = pose.x;
    const finalY = fromY + fwdY + 720;
    const finalZ = pose.z;

    rx.current = finalX;
    ry.current = finalY;
    rz.current = finalZ;

    // Assert the pre-settle pose, force a reflow, THEN apply the transition so
    // the browser reliably registers the start and fires transitionend.
    write(fromX, fromY, fromZ, 'none');
    if (cubeRef.current) void cubeRef.current.offsetHeight;
    write(finalX, finalY, finalZ,
      `transform ${SETTLE_DURATION_MS}ms cubic-bezier(0.18, 1.22, 0.34, 1)`);

    const el = cubeRef.current;
    const onEnd = (e: TransitionEvent) => {
      if (e.propertyName !== 'transform') return;
      el?.removeEventListener('transitionend', onEnd);
      finishSettle(val);
    };
    el?.addEventListener('transitionend', onEnd);

    clearFallback();
    fallbackRef.current = setTimeout(() => {
      el?.removeEventListener('transitionend', onEnd);
      finishSettle(val);
    }, SETTLE_DURATION_MS + FALLBACK_PAD_MS);
  }, [finishSettle]);

  // ── Choreographed tumble (bounded cone → never edge-on, never flat) ──
  useEffect(() => {
    if (!rolling) return;

    settledRef.current = false;
    setGlow(false);
    startRef.current  = performance.now();
    lastTsRef.current = startRef.current;
    velY.current      = 1100 + Math.random() * 500; // deg/s

    const frame = (ts: number) => {
      const t  = (ts - startRef.current) / 1000;          // seconds since roll
      const dt = Math.min(0.05, (ts - lastTsRef.current) / 1000);
      lastTsRef.current = ts;

      ry.current += velY.current * dt;                    // fast continuous spin
      rx.current  = SPIN_X + 14 * Math.sin(t * 6.0);      // bounded wobble  (-36…-8)
      rz.current  = SPIN_Z +  7 * Math.sin(t * 8.0);      // bounded wobble  (±~7)

      write(rx.current, ry.current, rz.current, 'none');
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

  // Idle / post-turn pose when not rolling. Uses the SAME forward-only delta as
  // settle and no-ops when already in place — so it never fights a just-landed
  // pose or interpolates a giant backward spin.
  useEffect(() => {
    if (rolling) return;
    if (value === null) settledRef.current = false;

    const p     = value === null ? IDLE : resultPose(value);
    const curYn = ((ry.current % 360) + 360) % 360;
    const tgtYn = ((p.y % 360) + 360) % 360;
    const fwdY  = ((tgtYn - curYn) + 360) % 360;

    if (fwdY === 0 && rx.current === p.x && rz.current === p.z) return; // already there

    rx.current = p.x;
    ry.current = ry.current + fwdY; // shortest forward path; keeps accumulator
    rz.current = p.z;
    write(rx.current, ry.current, rz.current, 'transform 320ms ease');
  }, [rolling, value]);

  useEffect(() => () => { stopRaf(); clearFallback(); }, []);

  const interactive = !disabled && !rolling;
  const radius = Math.round(size * 0.17);

  return (
    <div className="flex flex-col items-center gap-3" style={{ position: 'relative' }}>

      {/* Press/hover/dim wrapper — ABOVE the perspective element, so its
          opacity/filter composites the 2D result without flattening the cube */}
      <div
        className={`dice-press${interactive ? ' di' : ''}${disabled ? ' dice-dim' : ''}`}
        onClick={interactive ? onClick : undefined}
        style={{ cursor: interactive ? 'pointer' : 'not-allowed' }}
      >
        {/* ground shadow (sibling, painted first → under the cube) */}
        <div style={{
          position: 'absolute', bottom: -10, left: '15%', width: '70%', height: 13,
          background: 'rgba(0,0,0,0.42)', borderRadius: '50%',
          filter: 'blur(7px)', transform: 'scaleY(0.45)', pointerEvents: 'none',
        }} />

        {/* six glow (sibling, painted before the stage) */}
        <div style={{
          position: 'absolute', inset: -size * 0.32, borderRadius: '50%',
          pointerEvents: 'none',
          background: 'radial-gradient(circle, rgba(251,191,36,0.65) 0%, transparent 66%)',
          filter: 'blur(18px)',
          opacity: glow ? 1 : 0,
          transform: glow ? 'scale(1)' : 'scale(0.5)',
          transition: 'opacity .35s ease, transform .35s ease',
        }} />

        {interactive && value === null && (
          <div className="dice-pulse" style={{
            position: 'absolute', inset: -5,
            border: '2px solid rgba(99,102,241,0.45)',
            borderRadius: radius + 4, pointerEvents: 'none',
          }} />
        )}

        {/* PERSPECTIVE STAGE — establishes the 3D context, no flatten props */}
        <div style={{
          position: 'relative',
          width: size, height: size,
          perspective: depth,
          WebkitPerspective: depth,
          perspectiveOrigin: '50% 42%',
        }}>
          {/* CUBE — preserve-3d, transform owned imperatively, NO filter/opacity */}
          <div
            ref={cubeRef}
            style={{
              position: 'absolute', inset: 0,
              transformStyle: 'preserve-3d',
              WebkitTransformStyle: 'preserve-3d',
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
                  // fully OPAQUE — no backface-visibility, depth-sort occludes
                  borderRadius: radius,
                  background: isSix
                    ? 'linear-gradient(135deg,#fffdf2 0%,#fef3c7 55%,#fcd34d 100%)'
                    : 'linear-gradient(135deg,#ffffff 0%,#eef4fb 55%,#dbe6f4 100%)',
                  border: isSix
                    ? '1.5px solid rgba(202,138,4,0.55)'
                    : '1.5px solid rgba(148,178,212,1)',
                  boxShadow: isSix
                    ? 'inset 3px 4px 11px rgba(255,255,255,0.95), inset -5px -6px 13px rgba(146,64,14,0.20)'
                    : 'inset 3px 4px 11px rgba(255,255,255,0.98), inset -5px -6px 13px rgba(15,40,75,0.18)',
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
