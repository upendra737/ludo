import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Play, Users, AlertCircle, Dice6, Pencil, Trophy, Bot, ArrowLeft, Zap, X } from 'lucide-react';
import { useSocket } from '../../hooks/useSocket';
import { useGameStore } from '../../store/useGameStore';
import { useProfileStore, AVATARS } from '../../store/useProfileStore';

export const Lobby: React.FC = () => {
  const { name, avatar, wins, games, hasIdentity, setIdentity } = useProfileStore();
  const { createRoom, joinRoom, updateProfile, quickPlay, cancelQuick } = useSocket();
  const { error, matchmaking } = useGameStore();

  const [editing,   setEditing]   = useState(!hasIdentity);
  const [draftName, setDraftName] = useState(name);
  const [draftAv,   setDraftAv]   = useState(avatar || AVATARS[0]);
  const [view,      setView]      = useState<'MENU' | 'COUNT' | 'JOIN'>('MENU');
  const [mode,      setMode]      = useState<'cpu' | 'private'>('private');
  const [roomCode,  setRoomCode]  = useState('');

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('room');
    if (code) { setRoomCode(code.toUpperCase()); setView('JOIN'); }
  }, []);

  const saveIdentity = () => {
    const n = draftName.trim();
    if (!n) return;
    setIdentity(n, draftAv);
    updateProfile(n.slice(0, 24), draftAv);
    setEditing(false);
  };

  const start      = (n: number) => { if (name.trim()) createRoom(name.trim(), n, mode === 'cpu'); };
  const handleJoin = () => { if (name.trim() && roomCode.trim()) joinRoom(roomCode.trim(), name.trim()); };
  const handleQuick = () => { if (name.trim()) quickPlay(name.trim()); };

  return (
    <div className="min-h-screen flex items-center justify-center p-4"
         style={{ background: 'linear-gradient(160deg,#080b14 0%,#0d1629 60%,#080b14 100%)' }}>

      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-72 h-72 rounded-full opacity-20"
             style={{ background: 'radial-gradient(circle,#6366f1,transparent)', filter: 'blur(60px)' }} />
        <div className="absolute bottom-1/4 right-1/4 w-72 h-72 rounded-full opacity-15"
             style={{ background: 'radial-gradient(circle,#a855f7,transparent)', filter: 'blur(60px)' }} />
      </div>

      {/* Quick Play searching overlay */}
      <AnimatePresence>
        {matchmaking.searching && (
          <motion.div key="mm"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex flex-col items-center justify-center gap-5 px-6 text-center"
            style={{ background: 'rgba(8,11,20,0.88)', backdropFilter: 'blur(10px)' }}
          >
            <div className="w-14 h-14 rounded-full border-2 border-white/15 border-t-amber-400 animate-spin" />
            <div>
              <p className="text-base font-black text-white uppercase tracking-widest">Finding players…</p>
              <p className="text-xs text-slate-400 font-medium mt-1">
                {matchmaking.queued} in queue · bots fill in if needed
              </p>
            </div>
            <button onClick={cancelQuick}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-black uppercase tracking-wide text-slate-300 transition-all active:scale-95"
              style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)' }}>
              <X size={14} /> Cancel
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 22 }}
        className="relative w-full max-w-sm"
      >
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

          <div className="px-8 py-8">
            <AnimatePresence mode="wait">

              {/* ── Identity setup / edit ───────────────────────────── */}
              {editing && (
                <motion.div key="id"
                  initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 16 }}
                  className="space-y-5"
                >
                  <div>
                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">
                      Your Name
                    </label>
                    <input
                      autoFocus type="text" value={draftName}
                      onChange={e => setDraftName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') saveIdentity(); }}
                      placeholder="Enter your name…" maxLength={24}
                      className="w-full px-4 py-3.5 rounded-2xl text-sm font-bold text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                      style={{ background: 'rgba(255,255,255,0.07)', border: '1.5px solid rgba(255,255,255,0.12)' }}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">
                      Pick an Avatar
                    </label>
                    <div className="grid grid-cols-6 gap-2">
                      {AVATARS.map(a => (
                        <button key={a} onClick={() => setDraftAv(a)}
                          className="aspect-square rounded-xl text-xl flex items-center justify-center transition-all active:scale-90"
                          style={{
                            background: draftAv === a ? 'rgba(99,102,241,0.35)' : 'rgba(255,255,255,0.06)',
                            border: draftAv === a ? '1.5px solid #818cf8' : '1.5px solid rgba(255,255,255,0.10)',
                          }}>
                          {a}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-3 pt-1">
                    {hasIdentity && (
                      <button onClick={() => setEditing(false)}
                        className="flex-1 py-3.5 rounded-2xl text-sm font-bold text-slate-400 hover:text-white transition-all hover:bg-white/8">
                        Back
                      </button>
                    )}
                    <button onClick={saveIdentity} disabled={!draftName.trim()}
                      className="flex-[2] py-3.5 rounded-2xl text-sm font-black text-white uppercase tracking-wider disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95 hover:brightness-110"
                      style={{ background: 'linear-gradient(135deg,#6366f1,#7c3aed)', boxShadow: '0 8px 24px rgba(99,102,241,0.3)' }}>
                      {hasIdentity ? 'Save' : 'Continue'}
                    </button>
                  </div>
                </motion.div>
              )}

              {/* ── Main menu ───────────────────────────────────────── */}
              {!editing && view === 'MENU' && (
                <motion.div key="menu"
                  initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}
                  className="space-y-3"
                >
                  {/* Profile chip */}
                  <button onClick={() => { setDraftName(name); setDraftAv(avatar); setEditing(true); }}
                    className="w-full flex items-center gap-3 p-3 rounded-2xl mb-2 transition-all hover:bg-white/8 group"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)' }}>
                    <span className="text-2xl">{avatar}</span>
                    <div className="flex-1 min-w-0 text-left">
                      <p className="text-sm font-black text-white truncate">{name}</p>
                      <p className="text-[11px] text-slate-400 font-bold flex items-center gap-1">
                        <Trophy size={11} className="text-yellow-400" />
                        {wins}W · {games} game{games === 1 ? '' : 's'}
                      </p>
                    </div>
                    <Pencil size={14} className="text-slate-500 group-hover:text-slate-300" />
                  </button>

                  <button onClick={handleQuick}
                    className="w-full py-4 rounded-2xl font-black text-sm uppercase tracking-wider text-white flex items-center justify-center gap-3 transition-all active:scale-95 hover:brightness-110"
                    style={{ background: 'linear-gradient(135deg,#f59e0b,#f97316)', boxShadow: '0 8px 24px rgba(245,158,11,0.35)' }}>
                    <Zap size={18} fill="currentColor" /> Quick Play
                  </button>
                  <button onClick={() => { setMode('cpu'); setView('COUNT'); }}
                    className="w-full py-4 rounded-2xl font-black text-sm uppercase tracking-wider text-white flex items-center justify-center gap-3 transition-all active:scale-95 hover:brightness-110"
                    style={{ background: 'linear-gradient(135deg,#6366f1,#7c3aed)', boxShadow: '0 8px 24px rgba(99,102,241,0.35)' }}>
                    <Bot size={18} /> Play vs Computer
                  </button>
                  <button onClick={() => { setMode('private'); setView('COUNT'); }}
                    className="w-full py-4 rounded-2xl font-black text-sm uppercase tracking-wider text-white flex items-center justify-center gap-3 transition-all active:scale-95 hover:bg-white/15"
                    style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}>
                    <Play size={18} fill="currentColor" /> Create Private Room
                  </button>
                  <button onClick={() => setView('JOIN')}
                    className="w-full py-4 rounded-2xl font-black text-sm uppercase tracking-wider text-white flex items-center justify-center gap-3 transition-all active:scale-95 hover:bg-white/15"
                    style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}>
                    <Users size={18} /> Join with Code
                  </button>
                </motion.div>
              )}

              {/* ── Player-count picker ─────────────────────────────── */}
              {!editing && view === 'COUNT' && (
                <motion.div key="count"
                  initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}
                  className="space-y-4"
                >
                  <div className="flex items-center gap-2 text-slate-300">
                    {mode === 'cpu' ? <Bot size={16} className="text-indigo-400" /> : <Play size={16} className="text-indigo-400" />}
                    <span className="text-sm font-black uppercase tracking-widest">
                      {mode === 'cpu' ? 'Solo vs Computer' : 'Private Room'}
                    </span>
                  </div>
                  <p className="text-xs font-black text-slate-500 uppercase tracking-widest">
                    How many players?
                  </p>
                  <div className="grid grid-cols-3 gap-3">
                    {[2, 3, 4].map(n => (
                      <button key={n} onClick={() => start(n)}
                        className="py-6 rounded-2xl font-black text-white transition-all active:scale-95 hover:brightness-110 flex flex-col items-center gap-1"
                        style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.30)' }}>
                        <span className="text-2xl">{n}</span>
                        <span className="text-[10px] text-slate-400 uppercase tracking-wide">
                          {mode === 'cpu' ? `you + ${n - 1} bot${n - 1 > 1 ? 's' : ''}` : 'players'}
                        </span>
                      </button>
                    ))}
                  </div>
                  <button onClick={() => setView('MENU')}
                    className="w-full py-3 rounded-2xl text-sm font-bold text-slate-400 hover:text-white transition-all hover:bg-white/8 flex items-center justify-center gap-2">
                    <ArrowLeft size={14} /> Back
                  </button>
                </motion.div>
              )}

              {/* ── Join with code ──────────────────────────────────── */}
              {!editing && view === 'JOIN' && (
                <motion.div key="join"
                  initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}
                  className="space-y-5"
                >
                  <div>
                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">
                      Room Code
                    </label>
                    <input
                      autoFocus type="text" value={roomCode}
                      onChange={e => setRoomCode(e.target.value.toUpperCase())}
                      onKeyDown={e => { if (e.key === 'Enter') handleJoin(); }}
                      placeholder="e.g. AB12CD" maxLength={8}
                      className="w-full px-4 py-3.5 rounded-2xl text-sm font-black text-white placeholder-slate-500 font-mono tracking-widest uppercase focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                      style={{ background: 'rgba(255,255,255,0.07)', border: '1.5px solid rgba(255,255,255,0.12)' }}
                    />
                  </div>
                  {error && (
                    <div className="flex items-center gap-2 text-red-400 text-xs font-bold p-3 rounded-xl"
                         style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)' }}>
                      <AlertCircle size={14} className="shrink-0" /> {error}
                    </div>
                  )}
                  <div className="flex gap-3 pt-1">
                    <button onClick={() => setView('MENU')}
                      className="flex-1 py-3.5 rounded-2xl text-sm font-bold text-slate-400 hover:text-white transition-all hover:bg-white/8">
                      Back
                    </button>
                    <button onClick={handleJoin} disabled={!roomCode.trim()}
                      className="flex-[2] py-3.5 rounded-2xl text-sm font-black text-white uppercase tracking-wider disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95 hover:brightness-110"
                      style={{ background: 'linear-gradient(135deg,#6366f1,#7c3aed)', boxShadow: '0 8px 24px rgba(99,102,241,0.3)' }}>
                      Join Game
                    </button>
                  </div>
                </motion.div>
              )}

            </AnimatePresence>

            {error && !editing && view === 'MENU' && (
              <div className="flex items-center gap-2 text-red-400 text-xs font-bold p-3 rounded-xl mt-4"
                   style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)' }}>
                <AlertCircle size={14} className="shrink-0" /> {error}
              </div>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-slate-600 font-bold uppercase tracking-widest mt-4">
          Ludo Elite v2.0 · Play with friends
        </p>
      </motion.div>
    </div>
  );
};
