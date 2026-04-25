/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useSettingsStore } from '../../store/useSettingsStore';

interface Props {
  value: number | null;
  onClick: () => void;
  disabled: boolean;
  isRolling: boolean;
}

export const Dice: React.FC<Props> = ({ value, onClick, disabled, isRolling }) => {
  const { theme } = useSettingsStore();
  const dots = {
    1: [[50, 50]],
    2: [[25, 25], [75, 75]],
    3: [[25, 25], [50, 50], [75, 75]],
    4: [[25, 25], [75, 25], [25, 75], [75, 75]],
    5: [[25, 25], [75, 25], [50, 50], [25, 75], [75, 75]],
    6: [[25, 25], [75, 25], [25, 50], [75, 50], [25, 75], [75, 75]]
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <motion.div
        style={{ perspective: 1000 }}
        whileHover={!disabled && !isRolling ? { scale: 1.05 } : {}}
        whileTap={!disabled && !isRolling ? { scale: 0.95 } : {}}
        onClick={!disabled && !isRolling ? onClick : undefined}
        className="relative"
      >
        {/* Glow effect for Six */}
        <AnimatePresence>
          {!isRolling && value === 6 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1.2 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-yellow-400/30 blur-2xl rounded-full"
            />
          )}
        </AnimatePresence>

        {/* The Dice Container */}
        <motion.div
          animate={isRolling ? {
            rotateX: [0, 720, 1440],
            rotateY: [0, 360, 1080],
            rotateZ: [0, 180, 720],
            y: [0, -40, -20, 0],
            scale: [1, 1.2, 0.9, 1.1, 1],
            filter: ['blur(0px)', 'blur(4px)', 'blur(0px)'],
          } : { 
            rotateX: 0, 
            rotateY: 0, 
            rotateZ: 0,
            y: 0,
            scale: 1,
            filter: 'blur(0px)'
          }}
          transition={isRolling ? { 
            duration: 1.4, 
            ease: "easeInOut",
          } : { type: "spring", stiffness: 300, damping: 20 }}
          className={`relative w-24 h-24 rounded-[1.75rem] shadow-2xl flex items-center justify-center cursor-pointer transform-gpu transition-colors duration-500 ${
            disabled && !isRolling
              ? 'bg-slate-100 dark:bg-slate-800 opacity-50 cursor-not-allowed' 
              : 'bg-white dark:bg-slate-700 border-t-2 border-white dark:border-slate-600'
          } ${!isRolling && value === 6 ? 'ring-4 ring-yellow-400 ring-offset-4 ring-offset-slate-100 dark:ring-offset-slate-900' : ''}`}
          style={{ transformStyle: 'preserve-3d' }}
        >
          {/* Dice Content */}
          <motion.div
            className="w-16 h-16 flex items-center justify-center"
            animate={!isRolling && value === 6 ? { scale: [1, 1.1, 1] } : {}}
            transition={{ repeat: Infinity, duration: 1.5 }}
          >
            <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-md">
              {!isRolling && value && dots[value as keyof typeof dots].map(([x, y], i) => (
                <circle key={i} cx={x} cy={y} r="12" fill="url(#dot-grad)" />
              ))}
              {isRolling && (
                <g opacity="0.3">
                   <circle cx="50" cy="50" r="12" fill="url(#dot-grad)" />
                   <circle cx="25" cy="25" r="10" fill="url(#dot-grad)" />
                   <circle cx="75" cy="75" r="10" fill="url(#dot-grad)" />
                </g>
              )}
              {!value && !isRolling && (
                <text x="50" y="65" textAnchor="middle" fontSize="40" fill="#e2e8f0" className="dark:fill-slate-600" fontWeight="900">?</text>
              )}
              <defs>
                <radialGradient id="dot-grad" cx="30%" cy="30%" r="70%">
                  <stop offset="0%" stopColor={theme === 'dark' ? '#cbd5e1' : '#475569'} />
                  <stop offset="100%" stopColor={theme === 'dark' ? '#f8fafc' : '#1e293b'} />
                </radialGradient>
              </defs>
            </svg>
          </motion.div>

          {/* Golden Burst Particles (Simplified SVG) */}
          {!isRolling && value === 6 && (
            <motion.div 
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: [1, 1.5], opacity: [0, 1, 0] }}
              className="absolute inset-0 pointer-events-none"
            >
              <div className="absolute inset-0 bg-yellow-400/20 rounded-full animate-ping" />
            </motion.div>
          )}
        </motion.div>

        {/* Shake indicator */}
        {!disabled && !value && !isRolling && (
          <div className="absolute -inset-1 border-2 border-indigo-500/20 rounded-[2rem] animate-pulse pointer-events-none" />
        )}
      </motion.div>
      
      {!disabled && !value && !isRolling && (
        <motion.span 
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-[10px] font-black text-indigo-500 dark:text-indigo-400 tracking-widest uppercase bg-indigo-50 dark:bg-indigo-950/20 px-3 py-1 rounded-full shadow-sm"
        >
          Your Turn • Roll
        </motion.span>
      )}
    </div>
  );
};
