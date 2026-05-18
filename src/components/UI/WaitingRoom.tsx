import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, Circle, Copy, Link as LinkIcon, Bot, Check, Shield } from 'lucide-react';
import { useGameStore } from '../../store/useGameStore';
import { useSocket } from '../../hooks/useSocket';
import { PlayerColor } from '../../types/game';

const COLOR_STYLES: Record<PlayerColor, { bg: string; glow: string; label: string; hex: string }> = {
  RED:    { bg: 'linear-gradient(135deg,#ff8787,#fa5252)', glow: 'rgba(250,82,82,0.45)',  label: 'Red',    hex: '#fa5252' },
  GREEN:  { bg: 'linear-gradient(135deg,#69db7c,#40c057)', glow: 'rgba(64,192,87,0.45)',  label: 'Green',  hex: '#40c057' },
  YELLOW: { bg: 'linear-gradient(135deg,#ffd43b,#fcc419)', glow: 'rgba(252,196,25,0.45)', label: 'Yellow', hex: '#fcc419' },
  BLUE:   { bg: 'linear-gradient(135deg,#74c0fc,#339af0)', glow: 'rgba(51,154,240,0.45)', label: 'Blue',   hex: '#339af0' },
};

const ALL_COLORS: PlayerColor[] = ['RED', 'GREEN', 'YELLOW', 'BLUE'];

export const WaitingRoom: React.FC = () => {
  const { gameState, me: myInitial } = useGameStore();
  const { setReady, pickColor, addBot } = useSocket();
  const [copied, setCopied] = useState<'code' | 'link' | null>(null);

  if (!gameState || !myInitial) return null;

  const me     = gameState.players.find(p => p.id === myInitial.id) || myInitial;
  const isHost = gameState.players[0]?.id === me.id;
  const target = gameState.targetPlayers || 4;
  const slots  = Math.max(0, target - gameState.players.length);

  const copy = (type: 'code' | 'link') => {
    const text = type === 'code'
      ? gameState.roomId
      : `${window.location.origin}?room=${gameState.roomId}`;
    navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  // Colour availability for picker
  const takenByHumans = gameState.players.filter(p => !p.isAI).map(p => p.color);

  return (
    <div className="min-h-screen flex items-center justify-center p-4"
         style={{ background: 'linear-gradient(160deg,#080b14 0%,#0d1629 60%,#080b14 100%)' }}>

      {/* Background orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/3 w-80 h-80 rounded-full opacity-15"
             style={{ background: 'radial-gradient(circle,#6366f1,transparent)', filter: 'blur(70px)' }} />
        <div className="absolute bottom-1/3 right-1/4 w-64 h-64 rounded-full opacity-12"
             style={{ background: 'radial-gradient(circle,#a855f7,transparent)', filter: 'blur(70px)' }} />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 22 }}
        className="relative w-full max-w-lg rounded-3xl overflow-hidden border border-white/10"
        style={{ background: 'rgba(15,23,42,0.90)', backdropFilter: 'blur(24px)' }}
      >
        {/* Header */}
        <div className="px-6 pt-7 pb-5 flex items-start justify-between"
             style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div>
            <h2 className="text-xl font-black text-white tracking-tight">Game Lobby</h2>
            <p className="text-slate-500 text-xs font-medium mt-0.5">
              {gameState.players.length}/{target} players · Waiting to start…
            </p>
          </div>

          {/* Room code + invite */}
          <div className="flex flex-col gap-2 text-right">
            <button
              onClick={() => copy('code')}
              className="flex items-center gap-2 px-3 py-2 rounded-xl transition-all hover:bg-white/10 active:scale-95 group"
              style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)' }}
            >
              <div className="text-left">
                <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">Code</p>
                <p className="text-base font-black text-indigo-300 font-mono tracking-widest">{gameState.roomId}</p>
              </div>
              {copied === 'code' ? <Check size={14} className="text-green-400" /> : <Copy size={14} className="text-indigo-400" />}
            </button>
            <button
              onClick={() => copy('link')}
              className="flex items-center justify-end gap-1.5 text-[11px] font-bold text-slate-500 hover:text-slate-300 transition-colors"
            >
              {copied === 'link' ? <Check size={12} className="text-green-400" /> : <LinkIcon size={12} />}
              {copied === 'link' ? 'Copied!' : 'Copy invite link'}
            </button>
          </div>
        </div>

        <div className="px-6 py-5 space-y-5">

          {/* ── Player Slots ────────────────────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {Array.from({ length: target }).map((_, i) => {
              const player = gameState.players[i];
              const cs     = player ? COLOR_STYLES[player.color] : null;
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06 }}
                  className="relative rounded-2xl overflow-hidden"
                  style={{
                    background: player ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.02)',
                    border: player
                      ? `1px solid ${cs!.hex}33`
                      : '1px dashed rgba(255,255,255,0.10)',
                    boxShadow: player && player.isReady ? `0 0 16px ${cs!.glow}` : 'none',
                  }}
                >
                  {/* Colour accent strip */}
                  {player && (
                    <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl"
                         style={{ background: cs!.bg }} />
                  )}

                  <div className="pl-4 pr-4 py-4 flex items-center gap-3">
                    {player ? (
                      <>
                        {/* Avatar */}
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-sm shrink-0"
                             style={{ background: cs!.bg, boxShadow: `0 4px 12px ${cs!.glow}` }}>
                          {player.name[0].toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-sm font-black text-white truncate">{player.name}</span>
                            {player.isAI && (
                              <span className="text-[9px] font-black bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded uppercase tracking-wide flex items-center gap-0.5">
                                <Bot size={8} /> Bot
                              </span>
                            )}
                            {player.id === me.id && (
                              <span className="text-[9px] font-black bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded uppercase tracking-wide flex items-center gap-0.5">
                                <Shield size={8} /> You
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">
                            {cs!.label}
                          </p>
                        </div>
                        {player.isReady
                          ? <CheckCircle2 size={20} className="text-green-400 shrink-0" />
                          : <Circle size={20} className="text-slate-700 shrink-0" />
                        }
                      </>
                    ) : (
                      <div className="flex items-center gap-3 opacity-40">
                        <div className="w-10 h-10 rounded-xl border-2 border-dashed border-white/20" />
                        <span className="text-sm font-medium text-slate-400">Waiting…</span>
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* ── Colour picker (only for self) ───────────────────────── */}
          <div>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
              Pick your colour
            </p>
            <div className="flex gap-2">
              {ALL_COLORS.map(c => {
                const cs    = COLOR_STYLES[c];
                const mine  = me.color === c;
                const taken = takenByHumans.includes(c) && !mine;
                return (
                  <motion.button
                    key={c}
                    whileTap={!taken ? { scale: 0.88 } : {}}
                    whileHover={!taken ? { scale: 1.08 } : {}}
                    onClick={() => !taken && pickColor(c)}
                    title={taken ? `Taken` : cs.label}
                    className="relative flex-1 h-10 rounded-xl transition-all"
                    style={{
                      background: cs.bg,
                      opacity: taken ? 0.3 : 1,
                      cursor: taken ? 'not-allowed' : 'pointer',
                      boxShadow: mine ? `0 0 0 3px white, 0 0 0 5px ${cs.hex}` : 'none',
                    }}
                  >
                    {mine && (
                      <Check size={16} className="absolute inset-0 m-auto text-white drop-shadow" />
                    )}
                  </motion.button>
                );
              })}
            </div>
          </div>

          {/* ── Add Bots (host only) ─────────────────────────────────── */}
          {isHost && slots > 0 && (
            <div>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
                Fill empty slots with bots
              </p>
              <div className="flex gap-2">
                {Array.from({ length: slots }, (_, i) => i + 1).map(n => (
                  <motion.button
                    key={n}
                    whileTap={{ scale: 0.92 }}
                    onClick={() => addBot(n)}
                    className="flex-1 py-2.5 rounded-xl text-xs font-black text-purple-200 uppercase tracking-wide transition-all hover:brightness-110 active:scale-95 flex items-center justify-center gap-1.5"
                    style={{
                      background: 'rgba(168,85,247,0.15)',
                      border: '1px solid rgba(168,85,247,0.30)',
                    }}
                  >
                    <Bot size={13} />
                    +{n} Bot{n > 1 ? 's' : ''}
                  </motion.button>
                ))}
              </div>
            </div>
          )}

          {/* ── Ready button ─────────────────────────────────────────── */}
          <div className="flex flex-col items-center gap-3 pt-1">
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={setReady}
              className="w-full py-4 rounded-2xl font-black text-sm uppercase tracking-wider text-white transition-all active:scale-95 flex items-center justify-center gap-2.5"
              style={me.isReady ? {
                background: 'rgba(74,222,128,0.15)',
                border: '1.5px solid rgba(74,222,128,0.35)',
                color: '#4ade80',
              } : {
                background: 'linear-gradient(135deg,#6366f1,#7c3aed)',
                boxShadow: '0 8px 24px rgba(99,102,241,0.35)',
              }}
            >
              {me.isReady ? (
                <><CheckCircle2 size={18} />  Ready! (click to unready)</>
              ) : (
                <>Ready to Start</>
              )}
            </motion.button>
            <p className="text-[11px] text-slate-600 font-medium text-center">
              Need 2+ players · Everyone must be ready
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
