import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Send, MessageSquare, Settings, Volume2, VolumeX,
  Music, X, Share2, Activity, Moon, Sun, Crown, Swords,
  ChevronRight, Zap,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { LudoBoard } from '../Board/LudoBoard';
import { useGameStore } from '../../store/useGameStore';
import { useSocket } from '../../hooks/useSocket';
import { useSounds } from '../../hooks/useSounds';
import { useSettingsStore } from '../../store/useSettingsStore';
import { Dice } from './Dice';
import { LudoEngine } from '../../lib/engine';
import { Player } from '../../types/game';

// ─── Helpers ────────────────────────────────────────────────────────────────

const PLAYER_COLORS: Record<string, string> = {
  RED: '#fa5252', GREEN: '#40c057', YELLOW: '#fcc419', BLUE: '#339af0',
};

const PLAYER_BG: Record<string, string> = {
  RED:    'linear-gradient(135deg,#ff8787,#fa5252)',
  GREEN:  'linear-gradient(135deg,#69db7c,#40c057)',
  YELLOW: 'linear-gradient(135deg,#ffd43b,#fcc419)',
  BLUE:   'linear-gradient(135deg,#74c0fc,#339af0)',
};

const PLAYER_GLOW: Record<string, string> = {
  RED:    '0 0 20px rgba(250,82,82,0.5)',
  GREEN:  '0 0 20px rgba(64,192,87,0.5)',
  YELLOW: '0 0 20px rgba(252,196,25,0.5)',
  BLUE:   '0 0 20px rgba(51,154,240,0.5)',
};

const EMOJIS = ['🔥', '😂', '👑', '💀', '🤯', '😭', '⚡', '🎉'];

// ─── PlayerCard ──────────────────────────────────────────────────────────────

interface PlayerCardProps {
  player: Player;
  isActive: boolean;
  isMe: boolean;
  compact?: boolean;
}

const PlayerCard: React.FC<PlayerCardProps> = ({ player, isActive, isMe, compact }) => {
  const finished = player.tokens.filter(t => t.isFinished).length;
  const inPlay   = player.tokens.filter(t => !t.isFinished && t.position >= 0).length;
  const color    = PLAYER_COLORS[player.color] || '#6366f1';
  const bg       = PLAYER_BG[player.color] || 'linear-gradient(135deg,#6366f1,#4f46e5)';
  const glow     = PLAYER_GLOW[player.color] || '';

  return (
    <motion.div
      animate={isActive ? { boxShadow: [glow, '0 0 0px transparent', glow] } : { boxShadow: 'none' }}
      transition={{ repeat: Infinity, duration: 2.4 }}
      className={`
        relative rounded-2xl border transition-all duration-300 overflow-hidden
        ${isActive
          ? 'border-white/20 bg-white/10 backdrop-blur-md'
          : 'border-white/5 bg-white/5 backdrop-blur-sm opacity-60'}
        ${compact ? 'p-2' : 'p-3'}
      `}
    >
      {/* Active pulse bar */}
      {isActive && (
        <motion.div
          layoutId="active-bar"
          className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl"
          style={{ background: bg }}
          animate={{ opacity: [0.7, 1, 0.7] }}
          transition={{ repeat: Infinity, duration: 1.8 }}
        />
      )}

      <div className={`flex items-center gap-2 ${compact ? '' : 'mb-2'}`}>
        {/* Avatar */}
        <div
          className="rounded-xl flex items-center justify-center text-white font-black shadow-lg shrink-0"
          style={{
            background: bg,
            width: compact ? 30 : 38,
            height: compact ? 30 : 38,
            fontSize: compact ? 13 : 15,
            boxShadow: isActive ? glow : 'none',
          }}
        >
          {player.name[0].toUpperCase()}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <p className={`font-black text-white truncate ${compact ? 'text-[10px]' : 'text-xs'}`}>
              {player.name}
            </p>
            {isMe && (
              <span className="shrink-0 text-[8px] font-black text-indigo-300 bg-indigo-500/20 px-1 rounded">
                YOU
              </span>
            )}
          </div>
          {!compact && (
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[10px] text-slate-400">
                {finished}/4 home
              </span>
              {inPlay > 0 && (
                <span className="text-[10px] text-slate-500">· {inPlay} moving</span>
              )}
            </div>
          )}
        </div>

        {isActive && (
          <motion.div
            animate={{ rotate: [0, 10, -10, 0] }}
            transition={{ repeat: Infinity, duration: 0.8 }}
          >
            <Zap size={compact ? 12 : 14} style={{ color }} />
          </motion.div>
        )}
      </div>

      {/* Progress bar */}
      {!compact && (
        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ background: bg }}
            initial={{ width: 0 }}
            animate={{ width: `${(finished / 4) * 100}%` }}
            transition={{ type: 'spring', stiffness: 100 }}
          />
        </div>
      )}

      {/* Token pips */}
      {!compact && (
        <div className="flex gap-1 mt-2">
          {player.tokens.map(t => (
            <div
              key={t.id}
              className="w-3 h-3 rounded-full border border-white/20"
              style={{
                background: t.isFinished ? bg : t.position >= 0 ? color : 'transparent',
                opacity: t.isFinished ? 1 : t.position >= 0 ? 0.8 : 0.25,
              }}
            />
          ))}
        </div>
      )}
    </motion.div>
  );
};

// ─── GameView ─────────────────────────────────────────────────────────────────

export const GameView: React.FC = () => {
  const { gameState, me: myInitial } = useGameStore();
  const { rollDice, moveToken, sendChat, sendEmoji, leaveRoom, restartGame } = useSocket();
  const { playSound, stopSound } = useSounds();
  const {
    masterVolume, isMuted, sfxEnabled, musicEnabled, theme,
    setMasterVolume, toggleMute, toggleSFX, toggleMusic, toggleTheme,
  } = useSettingsStore();

  const [isRollingLocal, setIsRollingLocal] = useState(false);
  const [lastDiceValue, setLastDiceValue] = useState<number | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [chatText, setChatText] = useState('');
  const [showCopySuccess, setShowCopySuccess] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'log'>('chat');
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [gameState?.messages]);

  useEffect(() => {
    if (gameState?.diceValue != null) {
      setLastDiceValue(gameState.diceValue);
      if (gameState.diceValue === 6) playSound('SIX');
    }
  }, [gameState?.diceValue]);

  useEffect(() => {
    if (gameState?.winner) {
      playSound('WIN');
      confetti({ particleCount: 180, spread: 80, origin: { y: 0.55 },
        colors: ['#fa5252','#40c057','#fcc419','#339af0','#a855f7'] });
    }
  }, [gameState?.winner]);

  if (!gameState || !myInitial) return null;

  const me = gameState.players.find(p => p.id === myInitial.id) || myInitial;
  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  const isMyTurn = currentPlayer.id === me.id;

  const canMoveToken = (tokenId: string) => {
    if (!isMyTurn || gameState.diceValue == null) return false;
    const token = currentPlayer.tokens.find(t => t.id === tokenId);
    if (!token) return false;
    return LudoEngine.canMove(token, gameState.diceValue!, me.color);
  };

  // Auto-move when only one valid token
  useEffect(() => {
    if (!isRollingLocal && isMyTurn && gameState.diceValue != null && !gameState.winner) {
      const moves = LudoEngine.getPossibleMoves(currentPlayer.tokens, gameState.diceValue);
      if (moves.length === 1) {
        const t = setTimeout(() => handleTokenMove(moves[0].id), 650);
        return () => clearTimeout(t);
      }
    }
  }, [isRollingLocal, gameState.diceValue, isMyTurn, gameState.winner]);

  const handleRoll = () => {
    if (!isMyTurn || gameState.diceValue != null) return;
    setIsRollingLocal(true);
    playSound('ROLL_SHAKE');
    rollDice();
    setTimeout(() => playSound('ROLL_TUMBLE'), 200);
    setTimeout(() => {
      setIsRollingLocal(false);
      stopSound('ROLL_TUMBLE');
      playSound('ROLL_LAND');
    }, 1400);
  };

  const handleTokenMove = (tokenId: string) => {
    if (isMyTurn && gameState.diceValue != null) {
      playSound('MOVE');
      moveToken(tokenId);
    }
  };

  const handleEmoji = (emoji: string) => {
    playSound('EMOJI');
    sendEmoji(emoji);
  };

  const handleSendChat = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (chatText.trim()) { sendChat(chatText); setChatText(''); }
  };

  const copyInvite = () => {
    navigator.clipboard.writeText(window.location.href);
    setShowCopySuccess(true);
    setTimeout(() => setShowCopySuccess(false), 2000);
  };

  const currentColor = PLAYER_COLORS[currentPlayer.color] || '#6366f1';
  const currentBg    = PLAYER_BG[currentPlayer.color] || '';

  // ──────────────────────────────────────────────────────────────────
  return (
    <div className="game-root">

      {/* ── HEADER ─────────────────────────────────────────────────── */}
      <header className="game-header">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <span className="text-2xl">🎲</span>
          <span className="text-sm font-black text-white tracking-widest uppercase hidden sm:block">
            Ludo Elite
          </span>
        </div>

        {/* Turn banner — centre, impossible to miss */}
        <AnimatePresence mode="wait">
          {gameState.winner ? (
            <motion.div
              key="winner"
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-yellow-400/20 border border-yellow-400/40"
            >
              <Crown size={16} className="text-yellow-400" />
              <span className="text-sm font-black text-yellow-300 tracking-wide">
                {gameState.winner} wins!
              </span>
            </motion.div>
          ) : (
            <motion.div
              key={currentPlayer.id}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="flex items-center gap-2 px-4 py-2 rounded-full border"
              style={{
                background: `${currentColor}18`,
                borderColor: `${currentColor}40`,
              }}
            >
              <motion.div
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ background: currentBg }}
                animate={{ scale: [1, 1.3, 1] }}
                transition={{ repeat: Infinity, duration: 1.2 }}
              />
              <span className="text-sm font-black text-white tracking-wide">
                {isMyTurn ? "✨ Your turn!" : `${currentPlayer.name}'s turn`}
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Settings */}
        <button
          onClick={() => setIsSettingsOpen(true)}
          className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 flex items-center justify-center text-slate-300 hover:text-white transition-all active:scale-90"
        >
          <Settings size={17} />
        </button>
      </header>

      {/* ── MAIN CONTENT ───────────────────────────────────────────── */}
      <div className="game-main">

        {/* LEFT / TOP — Player cards */}
        <aside className="game-players">
          <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2 px-1 hidden md:block">
            Players
          </p>

          {/* Desktop: vertical list */}
          <div className="hidden md:flex flex-col gap-2">
            {gameState.players.map((p, i) => (
              <PlayerCard
                key={p.id}
                player={p}
                isActive={i === gameState.currentPlayerIndex}
                isMe={p.id === me.id}
              />
            ))}
          </div>

          {/* Mobile: 2×2 compact grid */}
          <div className="grid grid-cols-2 gap-1.5 md:hidden">
            {gameState.players.map((p, i) => (
              <PlayerCard
                key={p.id}
                player={p}
                isActive={i === gameState.currentPlayerIndex}
                isMe={p.id === me.id}
                compact
              />
            ))}
          </div>
        </aside>

        {/* CENTRE — Board */}
        <main className="game-board-area">
          <AnimatePresence>
            {gameState.winner && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/60 backdrop-blur-md rounded-3xl gap-5"
              >
                <div className="text-6xl animate-bounce">🏆</div>
                <h2 className="text-3xl font-black text-white tracking-tight text-center">
                  {gameState.winner}<br/>
                  <span className="text-yellow-400">Wins!</span>
                </h2>
                <div className="flex gap-3">
                  <button
                    onClick={restartGame}
                    className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-full text-sm tracking-wide transition-all active:scale-95 shadow-lg shadow-indigo-500/30"
                  >
                    Play Again
                  </button>
                  <button
                    onClick={leaveRoom}
                    className="px-6 py-2.5 bg-white/10 hover:bg-white/20 text-white font-black rounded-full text-sm tracking-wide transition-all active:scale-95 border border-white/20"
                  >
                    Leave
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <LudoBoard
            players={gameState.players}
            onTokenClick={handleTokenMove}
            canMoveToken={canMoveToken}
            messages={gameState.messages}
            diceValue={gameState.diceValue}
          />
        </main>

        {/* RIGHT / BOTTOM — Controls */}
        <aside className="game-controls">

          {/* 3D Dice */}
          <div className="flex flex-col items-center gap-1">
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1 hidden md:block">
              Dice
            </p>
            <Dice
              value={gameState.diceValue !== null ? gameState.diceValue : lastDiceValue}
              isRolling={isRollingLocal}
              disabled={!isMyTurn || gameState.diceValue !== null}
              onClick={handleRoll}
            />
          </div>

          {/* Divider */}
          <div className="hidden md:block h-px bg-white/10 my-1" />

          {/* Emoji reactions */}
          <div>
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2 hidden md:block">
              React
            </p>
            <div className="grid grid-cols-4 gap-1.5">
              {EMOJIS.map(e => (
                <motion.button
                  key={e}
                  whileTap={{ scale: 0.8 }}
                  whileHover={{ scale: 1.15 }}
                  onClick={() => handleEmoji(e)}
                  className="aspect-square rounded-xl bg-white/8 hover:bg-white/15 border border-white/8 flex items-center justify-center text-lg transition-colors"
                >
                  {e}
                </motion.button>
              ))}
            </div>
          </div>

          {/* Divider */}
          <div className="hidden md:block h-px bg-white/10 my-1" />

          {/* Chat toggle */}
          <button
            onClick={() => setIsChatOpen(true)}
            className="flex items-center justify-between w-full px-3 py-2.5 rounded-xl bg-white/8 hover:bg-white/15 border border-white/8 transition-all group"
          >
            <div className="flex items-center gap-2">
              <MessageSquare size={15} className="text-slate-400 group-hover:text-white transition-colors" />
              <span className="text-xs font-bold text-slate-400 group-hover:text-white transition-colors">Chat</span>
            </div>
            <ChevronRight size={14} className="text-slate-600 group-hover:text-slate-300 transition-colors" />
          </button>
        </aside>
      </div>

      {/* ── SETTINGS MODAL ──────────────────────────────────────────── */}
      <AnimatePresence>
        {isSettingsOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSettingsOpen(false)}
              className="absolute inset-0 bg-black/70 backdrop-blur-md"
            />
            <motion.div
              initial={{ scale: 0.88, opacity: 0, y: 24 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.88, opacity: 0, y: 24 }}
              className="relative w-full max-w-sm bg-slate-900 border border-white/10 p-6 rounded-3xl shadow-2xl"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-black text-white uppercase tracking-widest">Settings</h2>
                <button
                  onClick={() => setIsSettingsOpen(false)}
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-400 hover:text-white transition-all"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-4">
                {/* Actions */}
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={leaveRoom}
                    className="flex flex-col items-center gap-2 py-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-all active:scale-95"
                  >
                    <X size={18} />
                    <span className="text-[10px] font-black uppercase tracking-wide">Quit</span>
                  </button>
                  <button
                    onClick={copyInvite}
                    className="relative flex flex-col items-center gap-2 py-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 transition-all active:scale-95"
                  >
                    {showCopySuccess && (
                      <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="absolute -top-10 left-1/2 -translate-x-1/2 bg-emerald-500 text-white text-[10px] font-bold px-3 py-1 rounded-full whitespace-nowrap"
                      >
                        Copied!
                      </motion.div>
                    )}
                    <Share2 size={18} />
                    <span className="text-[10px] font-black uppercase tracking-wide">Invite</span>
                  </button>
                </div>

                {/* Theme */}
                <button
                  onClick={toggleTheme}
                  className="flex items-center justify-between w-full p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all"
                >
                  <div className="flex items-center gap-3">
                    {theme === 'dark'
                      ? <Moon size={16} className="text-indigo-400" />
                      : <Sun size={16} className="text-amber-400" />
                    }
                    <span className="text-sm font-bold text-white">Dark Mode</span>
                  </div>
                  <div className={`w-10 h-5 rounded-full relative transition-colors ${theme === 'dark' ? 'bg-indigo-500' : 'bg-slate-600'}`}>
                    <motion.div
                      animate={{ x: theme === 'dark' ? 22 : 2 }}
                      className="absolute top-1 w-3 h-3 bg-white rounded-full"
                    />
                  </div>
                </button>

                {/* Volume */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-indigo-500/20 rounded-xl">
                        {isMuted ? <VolumeX size={16} className="text-indigo-400" /> : <Volume2 size={16} className="text-indigo-400" />}
                      </div>
                      <span className="text-sm font-bold text-white">Master Volume</span>
                    </div>
                    <button
                      onClick={toggleMute}
                      className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${isMuted ? 'bg-red-500/20 text-red-400' : 'bg-white/10 text-slate-400'}`}
                    >
                      {isMuted ? 'Muted' : 'Live'}
                    </button>
                  </div>
                  <input
                    type="range" min="0" max="1" step="0.01"
                    value={masterVolume}
                    onChange={e => setMasterVolume(parseFloat(e.target.value))}
                    className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                  />
                </div>

                {/* SFX / Music toggles */}
                <div className="flex gap-3">
                  {[
                    { label: 'SFX', on: sfxEnabled, toggle: toggleSFX },
                    { label: 'Music', on: musicEnabled, toggle: toggleMusic, Icon: Music },
                  ].map(({ label, on, toggle }) => (
                    <button
                      key={label}
                      onClick={toggle}
                      className={`flex-1 py-3 rounded-2xl border text-sm font-black tracking-wide transition-all ${on ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300' : 'bg-white/5 border-white/10 text-slate-500'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <p className="mt-6 pt-4 border-t border-white/10 text-center text-[10px] text-slate-600 font-bold uppercase tracking-widest">
                Ludo Elite v2.0
              </p>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── CHAT DRAWER ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {isChatOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsChatOpen(false)}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100]"
            />
            <motion.div
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="fixed right-0 top-0 bottom-0 w-full sm:w-[360px] bg-slate-950 border-l border-white/10 z-[101] flex flex-col"
            >
              {/* Drawer header */}
              <div className="flex items-center justify-between p-4 border-b border-white/10">
                <div className="flex bg-white/8 p-1 rounded-full gap-0.5">
                  {(['chat','log'] as const).map(tab => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-black uppercase tracking-wide transition-all ${
                        activeTab === tab
                          ? 'bg-white/15 text-white'
                          : 'text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      {tab === 'chat' ? <MessageSquare size={11} /> : <Activity size={11} />}
                      {tab}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setIsChatOpen(false)}
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-400 hover:text-white transition-all"
                >
                  <X size={15} />
                </button>
              </div>

              {/* Messages / Log */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 scroll-smooth scrollbar-hide">
                {activeTab === 'chat' ? (
                  <>
                    {gameState.messages.map(msg => (
                      <div key={msg.id} className={`flex flex-col ${msg.senderId === me.id ? 'items-end' : 'items-start'}`}>
                        <span className="text-[10px] text-slate-500 font-bold mb-1">{msg.senderName}</span>
                        <div className={`px-3 py-2 rounded-2xl max-w-[80%] text-sm font-medium ${
                          msg.senderId === me.id
                            ? 'bg-indigo-600 text-white rounded-tr-sm'
                            : 'bg-white/10 text-slate-200 rounded-tl-sm'
                        } ${msg.emoji ? '!bg-transparent text-3xl p-0' : ''}`}>
                          {msg.emoji || msg.text}
                        </div>
                      </div>
                    ))}
                    <div ref={chatEndRef} />
                  </>
                ) : (
                  <>
                    {gameState.moveHistory?.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-slate-600">
                        <Swords size={36} className="mb-3 opacity-50" />
                        <p className="text-xs font-black uppercase tracking-widest">No moves yet</p>
                      </div>
                    ) : (
                      [...(gameState.moveHistory || [])].reverse().map((move, i) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/8"
                        >
                          <div
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ background: PLAYER_COLORS[move.color] || '#6366f1' }}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-slate-200 truncate">
                              {move.player} → {move.to === 57 ? 'FINISH 🏁' : `cell ${move.to}`}
                            </p>
                            <p className="text-[10px] text-slate-500">
                              {move.captured ? '💥 Captured!' : `Rolled ${move.roll}`}
                            </p>
                          </div>
                        </motion.div>
                      ))
                    )}
                  </>
                )}
              </div>

              {/* Quick emojis + input */}
              {activeTab === 'chat' && (
                <div className="p-4 border-t border-white/10 space-y-3">
                  <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
                    {EMOJIS.map(e => (
                      <motion.button
                        key={e}
                        whileTap={{ scale: 0.8 }}
                        onClick={() => handleEmoji(e)}
                        className="w-10 h-10 shrink-0 flex items-center justify-center bg-white/8 hover:bg-white/15 rounded-xl text-lg transition-colors"
                      >
                        {e}
                      </motion.button>
                    ))}
                  </div>
                  <form onSubmit={handleSendChat} className="flex gap-2">
                    <input
                      type="text"
                      value={chatText}
                      onChange={e => setChatText(e.target.value)}
                      placeholder="Say something..."
                      className="flex-1 bg-white/8 border border-white/10 rounded-2xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/50"
                    />
                    <button
                      type="submit"
                      className="w-11 h-11 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl flex items-center justify-center transition-colors active:scale-90 shadow-lg"
                    >
                      <Send size={16} />
                    </button>
                  </form>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};
