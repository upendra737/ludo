import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface Props {
  value: number | null;
  onClick: () => void;
  disabled: boolean;
  isRolling: boolean;
}

const DOT_LAYOUTS: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [[28, 28], [72, 72]],
  3: [[28, 28], [50, 50], [72, 72]],
  4: [[28, 28], [72, 28], [28, 72], [72, 72]],
  5: [[28, 28], [72, 28], [50, 50], [28, 72], [72, 72]],
  6: [[28, 22], [72, 22], [28, 50], [72, 50], [28, 78], [72, 78]],
};

// Each face's CSS 3D position in the cube
const FACE_CUBE_TRANSFORMS: Record<number, string> = {
  1: 'rotateY(0deg)   translateZ(55px)',
  6: 'rotateY(180deg) translateZ(55px)',
  3: 'rotateY(90deg)  translateZ(55px)',
  4: 'rotateY(-90deg) translateZ(55px)',
  2: 'rotateX(-90deg) translateZ(55px)',
  5: 'rotateX(90deg)  translateZ(55px)',
};

// Cube rotation to bring each face value toward the viewer
const VALUE_TO_ROT: Record<number, { x: number; y: number }> = {
  1: { x: 0,   y: 0   },
  6: { x: 0,   y: 180 },
  3: { x: 0,   y: -90 },
  4: { x: 0,   y: 90  },
  2: { x: 90,  y: 0   },
  5: { x: -90, y: 0   },
};

export const Dice: React.FC<Props> = ({ value, onClick, disabled, isRolling }) => {
  const cubeRef = useRef<HTMLDivElement>(null);
  const accRotRef = useRef({ x: -20, y: 25 });
  const rollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [showGlow, setShowGlow] = React.useState(false);

  useEffect(() => {
    if (isRolling) {
      setShowGlow(false);
      rollTimerRef.current = setInterval(() => {
        accRotRef.current.x += (Math.random() - 0.4) * 160;
        accRotRef.current.y += (Math.random() - 0.4) * 160;
        if (cubeRef.current) {
          cubeRef.current.style.transition = 'transform 0.06s linear';
          cubeRef.current.style.transform =
            `rotateX(${accRotRef.current.x}deg) rotateY(${accRotRef.current.y}deg)`;
        }
      }, 65);
    } else {
      if (rollTimerRef.current) clearInterval(rollTimerRef.current);
      if (value !== null) {
        const target = VALUE_TO_ROT[value];
        const newX = Math.round(accRotRef.current.x / 360) * 360 + target.x + 720;
        const newY = Math.round(accRotRef.current.y / 360) * 360 + target.y + 720;
        accRotRef.current = { x: newX, y: newY };
        if (cubeRef.current) {
          cubeRef.current.style.transition = 'transform 0.9s cubic-bezier(0.34,1.56,0.64,1)';
          cubeRef.current.style.transform = `rotateX(${newX}deg) rotateY(${newY}deg)`;
        }
        setTimeout(() => setShowGlow(value === 6), 700);
      }
    }
    return () => { if (rollTimerRef.current) clearInterval(rollTimerRef.current); };
  }, [isRolling, value]);

  const SIZE = 110;

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Perspective wrapper */}
      <div style={{ perspective: '520px', perspectiveOrigin: '50% 38%' }}>
        <motion.div
          style={{ position: 'relative', width: SIZE, height: SIZE }}
          whileHover={!disabled && !isRolling ? { scale: 1.08 } : {}}
          whileTap={!disabled && !isRolling ? { scale: 0.91 } : {}}
          onClick={!disabled && !isRolling ? onClick : undefined}
          className={`${!disabled && !isRolling ? 'cursor-pointer' : 'cursor-not-allowed'} select-none`}
        >
          {/* Soft shadow beneath cube for depth */}
          <div
            className="absolute pointer-events-none"
            style={{
              bottom: -14,
              left: '10%',
              width: '80%',
              height: 20,
              background: 'rgba(0,0,0,0.45)',
              borderRadius: '50%',
              filter: 'blur(8px)',
              transform: 'scaleY(0.5)',
            }}
          />

          {/* Gold glow for 6 */}
          <AnimatePresence>
            {showGlow && (
              <motion.div
                key="glow"
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1.6 }}
                exit={{ opacity: 0, scale: 0.6 }}
                className="absolute inset-0 pointer-events-none"
                style={{
                  borderRadius: '22px',
                  background: 'radial-gradient(circle, rgba(251,191,36,0.65) 0%, transparent 70%)',
                  filter: 'blur(14px)',
                  zIndex: -1,
                }}
              />
            )}
          </AnimatePresence>

          {/* The 3D Cube */}
          <div
            ref={cubeRef}
            style={{
              width: '100%',
              height: '100%',
              transformStyle: 'preserve-3d',
              transform: `rotateX(${accRotRef.current.x}deg) rotateY(${accRotRef.current.y}deg)`,
              filter: disabled ? 'grayscale(0.5) opacity(0.4)' : 'none',
            }}
          >
            {Object.entries(FACE_CUBE_TRANSFORMS).map(([fv, faceTransform]) => {
              const faceVal = Number(fv);
              const dots = DOT_LAYOUTS[faceVal] || [];
              const isSix = faceVal === 6;

              return (
                <div
                  key={faceVal}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    transform: faceTransform,
                    backfaceVisibility: 'hidden',
                    WebkitBackfaceVisibility: 'hidden',
                    borderRadius: '18px',
                    // Dice faces are always white/ivory — like a real physical die
                    background: isSix
                      ? 'linear-gradient(145deg, #fffef0 0%, #fef9d7 40%, #fef3c7 100%)'
                      : 'linear-gradient(145deg, #ffffff 0%, #f4f7fb 60%, #edf2f7 100%)',
                    border: isSix
                      ? '1.5px solid rgba(217,119,6,0.40)'
                      : '1.5px solid rgba(186,206,230,0.95)',
                    // Inset lighting: bright top-left edge, dark bottom-right for depth
                    boxShadow: isSix
                      ? 'inset 0 2px 8px rgba(255,255,255,0.9), inset 0 -3px 10px rgba(161,79,0,0.12), 0 6px 24px rgba(0,0,0,0.5)'
                      : 'inset 0 2px 8px rgba(255,255,255,0.95), inset 0 -3px 10px rgba(0,0,0,0.10), 0 6px 24px rgba(0,0,0,0.5)',
                  }}
                >
                  <svg viewBox="0 0 100 100" width="100%" height="100%" style={{ padding: '12%' }}>
                    {dots.map(([cx, cy], i) => (
                      <circle
                        key={i}
                        cx={cx}
                        cy={cy}
                        r="10"
                        fill={isSix ? '#92400e' : '#1e293b'}
                      />
                    ))}
                  </svg>
                </div>
              );
            })}
          </div>

          {/* Pulse ring when awaiting roll */}
          {!disabled && !value && !isRolling && (
            <motion.div
              className="absolute rounded-3xl border-2 border-indigo-500/40 pointer-events-none"
              style={{ inset: '-5px' }}
              animate={{ scale: [1, 1.14, 1], opacity: [0.7, 0.1, 0.7] }}
              transition={{ repeat: Infinity, duration: 2.2 }}
            />
          )}
        </motion.div>
      </div>

      {/* Status label */}
      <AnimatePresence mode="wait">
        {!disabled && !value && !isRolling && (
          <motion.span
            key="hint"
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            className="text-[11px] font-black text-indigo-400 tracking-widest uppercase bg-indigo-950/40 border border-indigo-500/20 px-3 py-1 rounded-full"
          >
            Tap to Roll
          </motion.span>
        )}
        {isRolling && (
          <motion.span
            key="rolling"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ repeat: Infinity, duration: 0.55 }}
            className="text-[11px] font-black text-slate-500 tracking-widest uppercase"
          >
            Rolling…
          </motion.span>
        )}
        {!isRolling && value !== null && (
          <motion.span
            key={`v${value}`}
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className={`text-sm font-black tracking-wide ${
              value === 6 ? 'text-yellow-400' : 'text-slate-400'
            }`}
          >
            {value === 6 ? '🎉 SIX!' : `Rolled ${value}`}
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
};
