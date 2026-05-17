import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useSettingsStore } from '../../store/useSettingsStore';

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

// Each face's CSS 3D position in the cube (100×100px cube, faces translateZ 50px)
const FACE_CUBE_TRANSFORMS: Record<number, string> = {
  1: 'rotateY(0deg) translateZ(50px)',
  6: 'rotateY(180deg) translateZ(50px)',
  3: 'rotateY(90deg) translateZ(50px)',
  4: 'rotateY(-90deg) translateZ(50px)',
  2: 'rotateX(-90deg) translateZ(50px)',
  5: 'rotateX(90deg) translateZ(50px)',
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
  const { theme } = useSettingsStore();
  const isDark = theme === 'dark';
  const cubeRef = useRef<HTMLDivElement>(null);
  const accRotRef = useRef({ x: -20, y: 25 }); // slight tilt at rest looks natural
  const rollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [showGlow, setShowGlow] = React.useState(false);

  useEffect(() => {
    if (isRolling) {
      setShowGlow(false);
      rollTimerRef.current = setInterval(() => {
        accRotRef.current.x += (Math.random() - 0.4) * 150;
        accRotRef.current.y += (Math.random() - 0.4) * 150;
        if (cubeRef.current) {
          cubeRef.current.style.transition = 'transform 0.07s linear';
          cubeRef.current.style.transform =
            `rotateX(${accRotRef.current.x}deg) rotateY(${accRotRef.current.y}deg)`;
        }
      }, 70);
    } else {
      if (rollTimerRef.current) clearInterval(rollTimerRef.current);
      if (value !== null) {
        const target = VALUE_TO_ROT[value];
        const newX = Math.round(accRotRef.current.x / 360) * 360 + target.x + 720;
        const newY = Math.round(accRotRef.current.y / 360) * 360 + target.y + 720;
        accRotRef.current = { x: newX, y: newY };
        if (cubeRef.current) {
          cubeRef.current.style.transition = 'transform 0.85s cubic-bezier(0.34,1.56,0.64,1)';
          cubeRef.current.style.transform = `rotateX(${newX}deg) rotateY(${newY}deg)`;
        }
        setTimeout(() => setShowGlow(value === 6), 600);
      }
    }
    return () => { if (rollTimerRef.current) clearInterval(rollTimerRef.current); };
  }, [isRolling, value]);

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Perspective wrapper */}
      <div style={{ perspective: '700px', perspectiveOrigin: '50% 40%' }}>
        <motion.div
          style={{ position: 'relative', width: 110, height: 110 }}
          whileHover={!disabled && !isRolling ? { scale: 1.07 } : {}}
          whileTap={!disabled && !isRolling ? { scale: 0.92 } : {}}
          onClick={!disabled && !isRolling ? onClick : undefined}
          className={`${!disabled && !isRolling ? 'cursor-pointer' : 'cursor-not-allowed'} select-none`}
        >
          {/* Gold glow for 6 */}
          <AnimatePresence>
            {showGlow && (
              <motion.div
                key="glow"
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1.5 }}
                exit={{ opacity: 0, scale: 0.6 }}
                className="absolute inset-0 pointer-events-none"
                style={{
                  borderRadius: '22px',
                  background: 'radial-gradient(circle, rgba(251,191,36,0.55) 0%, transparent 70%)',
                  filter: 'blur(12px)',
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
              filter: disabled ? 'grayscale(0.7) opacity(0.45)' : 'none',
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
                    borderRadius: '20px',
                    background: isDark
                      ? isSix
                        ? 'linear-gradient(145deg, #2d2061 0%, #1a1440 100%)'
                        : 'linear-gradient(145deg, #1e2940 0%, #0f1623 100%)'
                      : isSix
                        ? 'linear-gradient(145deg, #fffbeb 0%, #fef3c7 100%)'
                        : 'linear-gradient(145deg, #ffffff 0%, #f1f5f9 100%)',
                    border: isDark
                      ? isSix
                        ? '1.5px solid rgba(251,191,36,0.45)'
                        : '1.5px solid rgba(255,255,255,0.07)'
                      : isSix
                        ? '1.5px solid rgba(217,119,6,0.45)'
                        : '1.5px solid rgba(200,214,229,0.9)',
                    boxShadow: isDark
                      ? 'inset 0 1px 0 rgba(255,255,255,0.07), inset 0 -3px 10px rgba(0,0,0,0.55)'
                      : 'inset 0 2px 6px rgba(255,255,255,0.95), inset 0 -2px 5px rgba(0,0,0,0.07)',
                  }}
                >
                  <svg viewBox="0 0 100 100" width="100%" height="100%" style={{ padding: '11%' }}>
                    {dots.map(([cx, cy], i) => (
                      <circle
                        key={i}
                        cx={cx}
                        cy={cy}
                        r="10.5"
                        fill={
                          isSix
                            ? isDark ? '#fbbf24' : '#92400e'
                            : isDark ? '#94a3b8' : '#1e293b'
                        }
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
