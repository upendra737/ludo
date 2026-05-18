import React, { useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface Props {
  value: number | null;
  rolling: boolean;
  onClick: () => void;
  disabled: boolean;
  onSettled: (value: number) => void;
  size?: number;
}

const DOT_LAYOUTS: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [[28, 28], [72, 72]],
  3: [[28, 28], [50, 50], [72, 72]],
  4: [[28, 28], [72, 28], [28, 72], [72, 72]],
  5: [[28, 28], [72, 28], [50, 50], [28, 72], [72, 72]],
  6: [[28, 22], [72, 22], [28, 50], [72, 50], [28, 78], [72, 78]],
};

const VALUE_TO_ROT: Record<number, { x: number; y: number }> = {
  1: { x: 0,   y: 0   },
  6: { x: 0,   y: 180 },
  3: { x: 0,   y: -90 },
  4: { x: 0,   y: 90  },
  2: { x: 90,  y: 0   },
  5: { x: -90, y: 0   },
};

// Total roll experience strictly capped: MIN_TUMBLE_MS + SETTLE_DURATION_MS = 440ms
const MIN_TUMBLE_MS      = 200;
const SETTLE_DURATION_MS = 240;

export const Dice: React.FC<Props> = ({
  value, rolling, onClick, disabled, onSettled, size = 108,
}) => {
  const half = Math.floor(size / 2);

  const faceTx: Record<number, string> = {
    1: `rotateY(0deg)   translateZ(${half}px)`,
    6: `rotateY(180deg) translateZ(${half}px)`,
    3: `rotateY(90deg)  translateZ(${half}px)`,
    4: `rotateY(-90deg) translateZ(${half}px)`,
    2: `rotateX(-90deg) translateZ(${half}px)`,
    5: `rotateX(90deg)  translateZ(${half}px)`,
  };

  const cubeRef      = useRef<HTMLDivElement>(null);
  const accX         = useRef(-20);
  const accY         = useRef(25);
  const accZ         = useRef(8);
  const rafRef       = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const settledRef   = useRef(false);
  const [showGlow, setShowGlow] = React.useState(false);

  const applyTransform = (x: number, y: number, z: number, transition: string) => {
    if (!cubeRef.current) return;
    cubeRef.current.style.transition = transition;
    cubeRef.current.style.transform  =
      `rotateX(${x}deg) rotateY(${y}deg) rotateZ(${z}deg)`;
  };

  const settle = useCallback((val: number) => {
    if (settledRef.current) return;
    settledRef.current = true;

    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    const target = VALUE_TO_ROT[val];
    const curX = ((accX.current % 360) + 360) % 360;
    const curY = ((accY.current % 360) + 360) % 360;
    const tgtX = ((target.x % 360) + 360) % 360;
    const tgtY = ((target.y % 360) + 360) % 360;
    const fwdX = ((tgtX - curX) + 360) % 360;
    const fwdY = ((tgtY - curY) + 360) % 360;
    const newX = accX.current + fwdX + 720;
    const newY = accY.current + fwdY + 720;

    accX.current = newX;
    accY.current = newY;
    accZ.current = 0;

    applyTransform(newX, newY, 0,
      `transform ${SETTLE_DURATION_MS}ms cubic-bezier(0.25,1.4,0.4,1)`);

    const cube = cubeRef.current;
    if (!cube) {
      setShowGlow(val === 6);
      onSettled(val);
      return;
    }

    const onEnd = (e: TransitionEvent) => {
      if (e.propertyName !== 'transform') return;
      cube.removeEventListener('transitionend', onEnd);
      setShowGlow(val === 6);
      onSettled(val);
    };
    cube.addEventListener('transitionend', onEnd);
  }, [onSettled]);

  // RAF tumble — runs while rolling=true
  useEffect(() => {
    if (!rolling) return;

    settledRef.current = false;
    startTimeRef.current = performance.now();
    setShowGlow(false);

    const tumble = () => {
      // ~45° max per frame at 60fps ≈ same average velocity as 170° per 60ms interval
      accX.current += (Math.random() - 0.38) * 45;
      accY.current += (Math.random() - 0.38) * 45;
      accZ.current += (Math.random() - 0.5)  * 10;
      applyTransform(accX.current, accY.current, accZ.current, 'none');
      rafRef.current = requestAnimationFrame(tumble);
    };
    rafRef.current = requestAnimationFrame(tumble);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [rolling]);

  // Settle once value arrives — waits for MIN_TUMBLE if server responds too fast
  useEffect(() => {
    if (!rolling || value === null) return;

    const elapsed   = performance.now() - startTimeRef.current;
    const remaining = MIN_TUMBLE_MS - elapsed;

    if (remaining <= 0) {
      settle(value);
    } else {
      const t = setTimeout(() => settle(value), remaining);
      return () => clearTimeout(t);
    }
  }, [rolling, value, settle]);

  // Reset settled guard when a new roll cycle begins
  useEffect(() => {
    if (!rolling && value === null) settledRef.current = false;
  }, [rolling, value]);

  return (
    <div
      className="flex flex-col items-center gap-3"
      style={{ position: 'relative', zIndex: 50, isolation: 'isolate' }}
    >
      {/*
        Perspective wrapper — fixed 700px keeps the cube near-orthographic so it
        never inverts, flattens, or vanishes at extreme tumble angles. Centered
        origin = symmetric, stable rotation. Padding + overflow:visible give the
        swept cube corners room so no ancestor clip ever crops it.
      */}
      <div style={{
        perspective: '700px',
        perspectiveOrigin: '50% 50%',
        padding: Math.round(size * 0.14),
        overflow: 'visible',
      }}>
        <motion.div
          style={{
            position: 'relative',
            width: size,
            height: size,
            transformStyle: 'preserve-3d',
            willChange: 'transform',
          }}
          whileHover={!disabled && !rolling ? { scale: 1.07 } : {}}
          whileTap={!disabled && !rolling ? { scale: 0.90 } : {}}
          onClick={!disabled && !rolling ? onClick : undefined}
          className={!disabled && !rolling ? 'cursor-pointer select-none' : 'cursor-not-allowed select-none'}
        >
          {/* Ground shadow */}
          <div className="absolute pointer-events-none" style={{
            bottom: -12, left: '12%', width: '76%', height: 14,
            background: 'rgba(0,0,0,0.50)',
            borderRadius: '50%', filter: 'blur(7px)', transform: 'scaleY(0.45)',
          }} />

          {/* Golden glow for six */}
          <AnimatePresence>
            {showGlow && (
              <motion.div key="glow"
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1.7 }}
                exit={{ opacity: 0, scale: 0.5 }}
                className="absolute inset-0 pointer-events-none"
                style={{
                  borderRadius: '50%',
                  background: 'radial-gradient(circle, rgba(251,191,36,0.7) 0%, transparent 68%)',
                  filter: 'blur(16px)', zIndex: -1,
                }}
              />
            )}
          </AnimatePresence>

          {/* 3D cube */}
          <div
            ref={cubeRef}
            style={{
              width: '100%', height: '100%',
              transformStyle: 'preserve-3d',
              transform: `rotateX(${accX.current}deg) rotateY(${accY.current}deg) rotateZ(${accZ.current}deg)`,
              filter: disabled ? 'grayscale(0.5) opacity(0.35)' : 'none',
            }}
          >
            {([1, 2, 3, 4, 5, 6] as const).map(faceVal => {
              const dots  = DOT_LAYOUTS[faceVal] || [];
              const isSix = faceVal === 6;
              return (
                <div key={faceVal} style={{
                  position: 'absolute', inset: 0,
                  transform: faceTx[faceVal],
                  backfaceVisibility: 'hidden',
                  WebkitBackfaceVisibility: 'hidden',
                  borderRadius: Math.round(size * 0.16) + 'px',
                  background: isSix
                    ? 'linear-gradient(145deg, #fffef0 0%, #fef9d7 40%, #fef3c7 100%)'
                    : 'linear-gradient(145deg, #ffffff 0%, #f3f7fb 60%, #e8f0f8 100%)',
                  border: isSix
                    ? '1.5px solid rgba(217,119,6,0.38)'
                    : '1.5px solid rgba(182,204,228,0.92)',
                  boxShadow: isSix
                    ? 'inset 2px 3px 8px rgba(255,255,255,0.92), inset -2px -3px 9px rgba(161,79,0,0.14)'
                    : 'inset 2px 3px 8px rgba(255,255,255,0.97), inset -2px -3px 9px rgba(0,0,0,0.10)',
                }}>
                  <svg viewBox="0 0 100 100" width="100%" height="100%" style={{ padding: '13%' }}>
                    {dots.map(([cx, cy], i) => (
                      <circle key={i} cx={cx} cy={cy} r="10"
                        fill={isSix ? '#92400e' : '#1e293b'} />
                    ))}
                  </svg>
                </div>
              );
            })}
          </div>

          {/* Pulse ring — awaiting roll */}
          {!disabled && !value && !rolling && (
            <motion.div className="absolute border-2 border-indigo-500/40 pointer-events-none"
              style={{ inset: -4, borderRadius: Math.round(size * 0.2) + 'px' }}
              animate={{ scale: [1, 1.12, 1], opacity: [0.7, 0.1, 0.7] }}
              transition={{ repeat: Infinity, duration: 2.2 }}
            />
          )}
        </motion.div>
      </div>

      {/* Label */}
      <AnimatePresence mode="wait">
        {!disabled && !value && !rolling && (
          <motion.span key="hint"
            initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
            className="text-[10px] font-black text-indigo-400 tracking-widest uppercase bg-indigo-950/40 border border-indigo-500/20 px-2.5 py-0.5 rounded-full"
          >
            Tap to Roll
          </motion.span>
        )}
        {rolling && (
          <motion.span key="rolling"
            animate={{ opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 0.55 }}
            className="text-[10px] font-black text-slate-500 tracking-widest uppercase"
          >
            Rolling…
          </motion.span>
        )}
        {!rolling && value !== null && (
          <motion.span key={`v${value}`}
            initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
            className={`text-xs font-black tracking-wide ${value === 6 ? 'text-yellow-400' : 'text-slate-300'}`}
          >
            {value === 6 ? '🎉 SIX!' : `Rolled ${value}`}
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
};
