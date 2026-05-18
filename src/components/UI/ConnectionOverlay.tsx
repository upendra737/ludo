import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useGameStore } from '../../store/useGameStore';

/**
 * Full-screen "Reconnecting…" shield shown only when we're mid-game/room and
 * the socket has dropped. The server keeps the seat for 30s (AFK→bot grace)
 * and rehydrates from the DB across redeploys, so the game is genuinely safe.
 */
export const ConnectionOverlay: React.FC = () => {
  const { isConnected, gameState } = useGameStore();
  const show = !!gameState && !isConnected;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="reconnect"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex flex-col items-center justify-center gap-4 px-6 text-center"
          style={{ background: 'rgba(8,11,20,0.82)', backdropFilter: 'blur(8px)' }}
        >
          <div className="w-12 h-12 rounded-full border-2 border-white/15 border-t-indigo-400 animate-spin" />
          <p className="text-sm font-black text-white uppercase tracking-widest">Reconnecting…</p>
          <p className="text-xs text-slate-400 font-medium max-w-xs">
            Hang tight — your game is saved and your seat is held.
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
