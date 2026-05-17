import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Play, Users, AlertCircle, Dice6 } from 'lucide-react';
import { useSocket } from '../../hooks/useSocket';
import { useGameStore } from '../../store/useGameStore';

export const Lobby: React.FC = () => {
  const [name, setName]         = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [view, setView]         = useState<'INITIAL' | 'CREATE' | 'JOIN'>('INITIAL');
  const { createRoom, joinRoom } = useSocket();
  const { error }                = useGameStore();

  React.useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('room');
    if (code) { setRoomCode(code.toUpperCase()); setView('JOIN'); }
  }, []);

  const handleCreate = () => { if (name.trim()) createRoom(name.trim()); };
  const handleJoin   = () => { if (name.trim() && roomCode.trim()) joinRoom(roomCode.trim(), name.trim()); };

  return (
    <div className="min-h-screen flex items-center justify-center p-4"
         style={{ background: 'linear-gradient(160deg,#080b14 0%,#0d1629 60%,#080b14 100%)' }}>

      {/* Background orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-72 h-72 rounded-full opacity-20"
             style={{ background: 'radial-gradient(circle,#6366f1,transparent)', filter: 'blur(60px)' }} />
        <div className="absolute bottom-1/4 right-1/4 w-72 h-72 rounded-full opacity-15"
             style={{ background: 'radial-gradient(circle,#a855f7,transparent)', filter: 'blur(60px)' }} />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 22 }}
        className="relative w-full max-w-sm"
      >
        {/* Card */}
        <div className="rounded-3xl overflow-hidden border border-white/10"
             style={{ background: 'rgba(15,23,42,0.85)', backdropFilter: 'blur(24px)' }}>

          {/* Header */}
          <div className="px-8 pt-10 pb-8 text-center"
               style={{ background: 'linear-gradient(135deg,rgba(99,102,241,0.3),rgba(168,85,247,0.2))' }}>
            <motion.div
              animate={{ rotate: [0, 15, -10, 0] }}
              transition={{ repeat: Infinity, duration: 4, repeatDelay: 2 }}
              className="w-16 h-16 mx-auto mb-5 rounded-2xl flex items-center justify-center"
              style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)' }}
            >
              <Dice6 size={34} className="text-white" />
            </motion.div>
            <h1 className="text-3xl font-black text-white tracking-tight">Ludo Elite</h1>
            <p className="text-indigo-300/80 text-sm font-medium mt-1 tracking-wide uppercase">
              Multiplayer · Up to 4 Players
            </p>
          </div>

          {/* Form area */}
          <div className="px-8 py-8">
            <AnimatePresence mode="wait">
              {view === 'INITIAL' && (
                <motion.div key="initial"
                  initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 16 }}
                  className="space-y-3"
                >
                  <button
                    onClick={() => setView('CREATE')}
                    className="w-full py-4 rounded-2xl font-black text-sm uppercase tracking-wider text-white flex items-center justify-center gap-3 transition-all active:scale-95 hover:brightness-110"
                    style={{ background: 'linear-gradient(135deg,#6366f1,#7c3aed)', boxShadow: '0 8px 24px rgba(99,102,241,0.35)' }}
                  >
                    <Play size={18} fill="currentColor" />
                    Create Room
                  </button>
                  <button
                    onClick={() => setView('JOIN')}
                    className="w-full py-4 rounded-2xl font-black text-sm uppercase tracking-wider text-white flex items-center justify-center gap-3 transition-all active:scale-95 hover:bg-white/15"
                    style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}
                  >
                    <Users size={18} />
                    Join with Code
                  </button>
                </motion.div>
              )}

              {(view === 'CREATE' || view === 'JOIN') && (
                <motion.div key="form"
                  initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}
                  className="space-y-5"
                >
                  {/* Name field */}
                  <div>
                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">
                      Your Name
                    </label>
                    <input
                      autoFocus
                      type="text"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') view === 'CREATE' ? handleCreate() : handleJoin(); }}
                      placeholder="Enter your name…"
                      maxLength={20}
                      className="w-full px-4 py-3.5 rounded-2xl text-sm font-bold text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                      style={{ background: 'rgba(255,255,255,0.07)', border: '1.5px solid rgba(255,255,255,0.12)' }}
                    />
                  </div>

                  {/* Room code field */}
                  {view === 'JOIN' && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                      <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">
                        Room Code
                      </label>
                      <input
                        type="text"
                        value={roomCode}
                        onChange={e => setRoomCode(e.target.value.toUpperCase())}
                        onKeyDown={e => { if (e.key === 'Enter') handleJoin(); }}
                        placeholder="e.g. AB12CD"
                        maxLength={8}
                        className="w-full px-4 py-3.5 rounded-2xl text-sm font-black text-white placeholder-slate-500 font-mono tracking-widest uppercase focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                        style={{ background: 'rgba(255,255,255,0.07)', border: '1.5px solid rgba(255,255,255,0.12)' }}
                      />
                    </motion.div>
                  )}

                  {error && (
                    <div className="flex items-center gap-2 text-red-400 text-xs font-bold p-3 rounded-xl"
                         style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)' }}>
                      <AlertCircle size={14} className="shrink-0" />
                      {error}
                    </div>
                  )}

                  <div className="flex gap-3 pt-1">
                    <button
                      onClick={() => setView('INITIAL')}
                      className="flex-1 py-3.5 rounded-2xl text-sm font-bold text-slate-400 hover:text-white transition-all hover:bg-white/8"
                    >
                      Back
                    </button>
                    <button
                      onClick={view === 'CREATE' ? handleCreate : handleJoin}
                      disabled={!name.trim() || (view === 'JOIN' && !roomCode.trim())}
                      className="flex-[2] py-3.5 rounded-2xl text-sm font-black text-white uppercase tracking-wider disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95 hover:brightness-110"
                      style={{ background: 'linear-gradient(135deg,#6366f1,#7c3aed)', boxShadow: '0 8px 24px rgba(99,102,241,0.3)' }}
                    >
                      {view === 'CREATE' ? 'Create Room' : 'Join Game'}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <p className="text-center text-xs text-slate-600 font-bold uppercase tracking-widest mt-4">
          Ludo Elite v2.0 · Play with friends
        </p>
      </motion.div>
    </div>
  );
};
