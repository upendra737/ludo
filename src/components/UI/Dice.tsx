import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface Props {
  value: number | null;
  onClick: () => void;
  disabled: boolean;
  isRolling: boolean;
  size?: number; // cube edge length in px, default 108
}

const DOT_LAYOUTS: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [[28, 28], [72, 72]],
  3: [[28, 28], [50, 50], [72, 72]],
  4: [[28, 28], [72, 28], [28, 72], [72, 72]],
  5: [[28, 28], [72, 28], [50, 50], [28, 72], [72, 72]],
  6: [[28, 22], [72, 22], [28, 50], [72, 50], [28, 78], [72, 78]],
};

// Cube rotation that brings each face value to face the viewer
const VALUE_TO_ROT: Record<number, { x: number; y: number }> = {
  1: { x: 0,   y: 0   },  // front
  6: { x: 0,   y: 180 },  // back
  3: { x: 0,   y: -90 },  // right face rotated left
  4: { x: 0,   y: 90  },  // left face rotated right
  2: { x: 90,  y: 0   },  // top face rotated down
  5: { x: -90, y: 0   },  // bottom face rotated up
};

export const Dice: React.FC<Props> = ({
  value, onClick, disabled, isRolling, size = 108,
}) => {
  const half = Math.floor(size / 2);

  // Each face's CSS 3D position — translateZ = half the cube edge length
  const faceTx: Record<number, string> = {
    1: `rotateY(0deg)   translateZ(${half}px)`,
    6: `rotateY(180deg) translateZ(${half}px)`,
    3: `rotateY(90deg)  translateZ(${half}px)`,
    4: `rotateY(-90deg) translateZ(${half}px)`,
    2: `rotateX(-90deg) translateZ(${half}px)`,
    5: `rotateX(90deg)  translateZ(${half}px)`,
  };

  const cubeRef  = useRef<HTMLDivElement>(null);
  const accX     = useRef(-20);
  const accY     = useRef(25);
  const accZ     = useRef(8);   // small constant Z tilt makes resting die look natural
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [showGlow, setShowGlow] = React.useState(false);

  const applyTransform = (x: number, y: number, z: number, transition: string) => {
    if (!cubeRef.current) return;
    cubeRef.current.style.transition = transition;
    cubeRef.current.style.transform  =
      `rotateX(${x}deg) rotateY(${y}deg) rotateZ(${z}deg)`;
  };

  useEffect(() => {
    if (isRolling) {
      setShowGlow(false);

      timerRef.current = setInterval(() => {
        // Bias slightly positive so the cube tumbles forward on average
        accX.current += (Math.random() - 0.38) * 170;
        accY.current += (Math.random() - 0.38) * 170;
        // Z oscillates slowly — keeps cube from ever going perfectly edge-on
        accZ.current += (Math.random() - 0.5) * 35;
        applyTransform(accX.current, accY.current, accZ.current, 'transform 0.06s linear');
      }, 60);

    } else {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }

      if (value !== null) {
        const target = VALUE_TO_ROT[value];

        // ── Forward-only settlement ────────────────────────────────────────
        // Normalise current rotation to [0, 360) so delta is unambiguous
        const curX = ((accX.current % 360) + 360) % 360;
        const curY = ((accY.current % 360) + 360) % 360;

        // How many degrees FORWARD to reach target (always 0–359)
        const tgtX = ((target.x % 360) + 360) % 360;
        const tgtY = ((target.y % 360) + 360) % 360;
        const fwdX = ((tgtX - curX) + 360) % 360;
        const fwdY = ((tgtY - curY) + 360) % 360;

        // Land on target + 2 full extra spins for drama
        const newX = accX.current + fwdX + 720;
        const newY = accY.current + fwdY + 720;
        const newZ = 0; // snap Z back to upright at rest

        accX.current = newX;
        accY.current = newY;
        accZ.current = newZ;

        applyTransform(newX, newY, newZ, 'transform 0.95s cubic-bezier(0.22,1.2,0.36,1)');
        setTimeout(() => setShowGlow(value === 6), 750);
      }
    }

    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isRolling, value]);

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Perspective wrapper — tighter perspective = more dramatic 3D */}
      <div style={{ perspective: `${size * 4.5}px`, perspectiveOrigin: '50% 35%' }}>
        <motion.div
          style={{ position: 'relative', width: size, height: size }}
          whileHover={!disabled && !isRolling ? { scale: 1.07 } : {}}
          whileTap={!disabled && !isRolling ? { scale: 0.90 } : {}}
          onClick={!disabled && !isRolling ? onClick : undefined}
          className={!disabled && !isRolling ? 'cursor-pointer select-none' : 'cursor-not-allowed select-none'}
        >
          {/* Drop-shadow beneath cube for grounding */}
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
                  // Inset highlight top-left, shadow bottom-right → bevel feel
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

          {/* Pulse ring while awaiting roll */}
          {!disabled && !value && !isRolling && (
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
        {!disabled && !value && !isRolling && (
          <motion.span key="hint"
            initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
            className="text-[10px] font-black text-indigo-400 tracking-widest uppercase bg-indigo-950/40 border border-indigo-500/20 px-2.5 py-0.5 rounded-full"
          >
            Tap to Roll
          </motion.span>
        )}
        {isRolling && (
          <motion.span key="rolling"
            animate={{ opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 0.55 }}
            className="text-[10px] font-black text-slate-500 tracking-widest uppercase"
          >
            Rolling…
          </motion.span>
        )}
        {!isRolling && value !== null && (
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
