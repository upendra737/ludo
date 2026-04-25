/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Send, Smile, MessageSquare, ChevronRight, ChevronLeft, Settings, Volume2, VolumeX, Music, X, Share2, Activity, Moon, Sun } from 'lucide-react';
import confetti from 'canvas-confetti';
import { LudoBoard } from '../Board/LudoBoard';
import { useGameStore } from '../../store/useGameStore';
import { useSocket } from '../../hooks/useSocket';
import { useSounds } from '../../hooks/useSounds';
import { useSettingsStore } from '../../store/useSettingsStore';
import { Dice } from './Dice';
import { LudoEngine } from '../../lib/engine';

export const GameView: React.FC = () => {
  const { gameState, me: myInitialState } = useGameStore();
  const { rollDice, moveToken, sendChat, sendEmoji, leaveRoom, restartGame } = useSocket();
  const { playSound, stopSound } = useSounds();
  const [activeTab, setActiveTab] = useState<'chat' | 'history'>('chat');

  const [showCopySuccess, setShowCopySuccess] = useState(false);
  const copyInviteLink = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    setShowCopySuccess(true);
    setTimeout(() => setShowCopySuccess(false), 2000);
  };
  const { 
    masterVolume, 
    isMuted, 
    sfxEnabled, 
    musicEnabled, 
    theme,
    setMasterVolume, 
    toggleMute, 
    toggleSFX, 
    toggleMusic,
    toggleTheme
  } = useSettingsStore();

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };
  
  const [isRollingLocal, setIsRollingLocal] = React.useState(false);
  const [lastDiceValue, setLastDiceValue] = React.useState<number | null>(null);
  const [isChatOpen, setIsChatOpen] = React.useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);
  const [chatText, setChatText] = React.useState('');
  const chatEndRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (gameState?.diceValue !== null) {
      setLastDiceValue(gameState!.diceValue);
      if (gameState!.diceValue === 6) {
        playSound('SIX');
      }
    }
  }, [gameState?.diceValue]);

  React.useEffect(() => {
    if (gameState?.winner) {
      playSound('WIN');
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#ff6b6b', '#51cf66', '#ffd93d', '#4dabf7']
      });
    }
  }, [gameState?.winner]);

  React.useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [gameState?.messages]);

  if (!gameState || !myInitialState) return null;

  // Derive active "me" state from gameState
  const me = gameState.players.find(p => p.id === myInitialState.id) || myInitialState;

  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  const isMyTurn = currentPlayer.id === me.id;

  React.useEffect(() => {
    if (isMyTurn && !gameState.winner) {
      if (navigator.vibrate) {
        navigator.vibrate([100, 50, 100]); // Vibrating pattern for your turn
      }
    }
  }, [isMyTurn]);

  const canMoveToken = (tokenId: string) => {
    if (!isMyTurn || gameState.diceValue === null) return false;
    const token = currentPlayer.tokens.find(t => t.id === tokenId);
    if (!token) return false;
    return LudoEngine.canMove(token, gameState.diceValue, me.color);
  };

  React.useEffect(() => {
    if (!isRollingLocal && isMyTurn && gameState.diceValue !== null && !gameState.winner) {
      const possibleMoves = LudoEngine.getPossibleMoves(currentPlayer.tokens, gameState.diceValue);
      if (possibleMoves.length === 1) {
        // Auto move the only valid token after a short suspenseful delay
        const timer = setTimeout(() => {
          handleTokenMove(possibleMoves[0].id);
        }, 600);
        return () => clearTimeout(timer);
      }
    }
  }, [isRollingLocal, gameState.diceValue, isMyTurn, gameState.winner]);

  const getPlayerColor = (color: string) => {
    switch (color) {
      case 'RED': return '#ef4444';
      case 'GREEN': return '#22c55e';
      case 'YELLOW': return '#eab308';
      case 'BLUE': return '#3b82f6';
      default: return '#ccc';
    }
  };

  const handleRoll = async () => {
    if (isMyTurn && gameState.diceValue === null) {
      setIsRollingLocal(true);
      playSound('ROLL_SHAKE');
      
      // Request roll from server
      rollDice();
      
      // Delay for animation sync
      setTimeout(() => {
        playSound('ROLL_TUMBLE');
      }, 200);

      setTimeout(() => {
        setIsRollingLocal(false);
        stopSound('ROLL_TUMBLE');
        playSound('ROLL_LAND');
      }, 1400); // Sync with Dice.tsx duration
    }
  };

  const handleTokenMove = (tokenId: string) => {
    if (isMyTurn && gameState.diceValue !== null) {
      playSound('MOVE');
      moveToken(tokenId);
    }
  };

  const handleSendChat = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (chatText.trim()) {
      sendChat(chatText);
      setChatText('');
    }
  };

  const emojis = ['👍', '🔥', '🤣', '😭', '🤯', '😡', 'GG'];

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900 flex flex-col items-center justify-center p-2 md:p-6 overflow-hidden relative transition-colors duration-500">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(99,102,241,0.1),transparent)] pointer-events-none" />
      
      {/* Top Bar - Players & Settings */}
      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="w-full max-w-4xl px-4 py-3 flex items-center justify-between gap-4 relative z-20"
      >
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar flex-1">
          {gameState.players.map((p, idx) => (
            <motion.div 
              key={p.id} 
              variants={itemVariants}
              animate={idx === gameState.currentPlayerIndex ? {
                boxShadow: [
                  "0 0 0 0px rgba(99, 102, 241, 0)",
                  "0 0 0 10px rgba(99, 102, 241, 0.1)",
                  "0 0 0 0px rgba(99, 102, 241, 0)"
                ]
              } : {}}
              transition={{ repeat: Infinity, duration: 2 }}
              className={`min-w-[120px] p-3 rounded-2xl flex flex-col items-center gap-2 border-2 transition-all relative ${
                idx === gameState.currentPlayerIndex 
                  ? 'border-indigo-500 bg-white dark:bg-slate-800 shadow-2xl ring-2 ring-indigo-500/10 -translate-y-2' 
                  : 'border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-800/40 opacity-70'
              }`}
            >
              <div className="relative">
                <div className="w-10 h-10 rounded-full shadow-lg flex items-center justify-center text-white text-xs font-black border-2 border-white overflow-hidden" 
                     style={{ 
                       background: p.color === 'RED' ? 'var(--color-red-start)' : p.color === 'GREEN' ? 'var(--color-green-start)' : p.color === 'YELLOW' ? 'var(--color-yellow-start)' : 'var(--color-blue-start)'
                     }}>
                  {p.name[0].toUpperCase()}
                </div>
                {idx === gameState.currentPlayerIndex && (
                  <motion.div 
                    layoutId="turn-indicator"
                    className="absolute -top-1 -right-1 w-4 h-4 bg-indigo-500 border-2 border-white rounded-full"
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ repeat: Infinity, duration: 1 }}
                  />
                )}
              </div>
              
              <div className="text-[10px] font-black text-slate-800 dark:text-slate-200 tracking-wider truncate max-w-full uppercase">{p.name}</div>
              
              {/* Highlight bar for current turn */}
              {idx === gameState.currentPlayerIndex && (
                <motion.div 
                  layoutId="active-bar"
                  className="absolute -bottom-1 left-0 right-0 h-1 rounded-full"
                  style={{ 
                    background: p.color === 'RED' ? '#ef4444' : p.color === 'GREEN' ? '#22c55e' : p.color === 'YELLOW' ? '#eab308' : '#3b82f6'
                  }}
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                />
              )}

              <AnimatePresence>
                {gameState.messages.find(m => m.senderId === p.id && Date.now() - m.timestamp < 3000) && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0 }}
                    className="absolute -bottom-10 left-1/2 -translate-x-1/2 glass px-3 py-1.5 rounded-xl shadow-2xl text-[10px] font-bold z-30 flex items-center gap-1 min-w-max"
                  >
                    {gameState.messages.find(m => m.senderId === p.id && Date.now() - m.timestamp < 3000)?.emoji ? 
                      <span className="text-xl">{gameState.messages.find(m => m.senderId === p.id && Date.now() - m.timestamp < 3000)?.emoji}</span> :
                      <span className="text-slate-800">{gameState.messages.find(m => m.senderId === p.id && Date.now() - m.timestamp < 3000)?.text.substring(0, 20)}</span>
                    }
                    <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-white border-t border-l border-white/20 rotate-45" />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>

        <button 
          onClick={() => setIsSettingsOpen(true)}
          className="w-12 h-12 rounded-2xl bg-white/80 dark:bg-slate-800/80 backdrop-blur-md border border-white dark:border-slate-700 shadow-lg flex items-center justify-center text-slate-600 dark:text-slate-300 hover:text-indigo-600 transition-all active:scale-95"
        >
          <Settings size={24} />
        </button>
      </motion.div>

      {/* Title / Winner */}
      <div className="text-center my-4 h-12 flex flex-col items-center justify-center relative z-20">
        <AnimatePresence mode="wait">
          {gameState.winner ? (
            <motion.div 
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="flex flex-col items-center gap-4"
            >
              <h1 className="text-4xl font-black text-indigo-600 uppercase tracking-tighter drop-shadow-xl">
                {gameState.winner} Wins! 👑
              </h1>
              <div className="flex gap-3 mt-4">
                <button 
                  onClick={restartGame}
                  className="px-6 py-2 bg-indigo-600 text-white rounded-full font-black text-xs uppercase tracking-widest hover:bg-indigo-700 shadow-lg active:scale-95 flex items-center gap-2"
                >
                  <Smile size={16} />
                  New Game
                </button>
                <button 
                  onClick={leaveRoom}
                  className="px-6 py-2 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 rounded-full font-black text-xs uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-700 shadow-md active:scale-95"
                >
                  Exit Room
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.p 
              key={currentPlayer.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className={`text-[10px] font-black uppercase tracking-widest px-4 py-1 rounded-full bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700 transition-colors ${isMyTurn ? 'text-indigo-600 border-indigo-200 dark:border-indigo-900/50' : 'text-slate-400 dark:text-slate-500'}`}
            >
              {isMyTurn ? "It's your turn!" : `${currentPlayer.name}'s turn`}
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      {/* Main Board Container */}
      <div className="relative z-10 w-full flex flex-col items-center gap-6 max-w-2xl">
        <LudoBoard 
          players={gameState.players} 
          onTokenClick={handleTokenMove}
          canMoveToken={canMoveToken}
          messages={gameState.messages}
          diceValue={gameState.diceValue}
        />

        {/* Dice & Controls Row */}
        <motion.div 
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="flex items-center gap-8 bg-white/50 dark:bg-slate-800/50 backdrop-blur-md p-4 rounded-[2rem] border border-white dark:border-slate-700 shadow-sm w-full max-w-md justify-between"
        >
          {/* Emojis Selector (Simple) */}
          <div className="flex flex-col gap-2">
            <p className="text-[8px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest pl-1">Chat</p>
            <div className="flex items-center gap-1">
              <button 
                onClick={() => setIsChatOpen(!isChatOpen)}
                className="w-10 h-10 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-sm active:scale-95"
              >
                <MessageSquare size={18} />
              </button>
            </div>
          </div>

          {/* Quick Chat Input Integrated */}
          <div className="flex-1 max-w-sm hidden sm:block">
            <form onSubmit={handleSendChat} className="relative group">
              <input 
                type="text" 
                value={chatText}
                onChange={(e) => setChatText(e.target.value)}
                placeholder="Type a message..."
                className="w-full bg-slate-100 dark:bg-slate-900/50 rounded-full py-2 px-10 text-xs font-medium border border-transparent focus:border-indigo-500/50 focus:bg-white dark:focus:bg-slate-900 transition-all outline-none"
              />
              <MessageSquare size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <button 
                type="submit"
                className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 bg-indigo-600 text-white rounded-full flex items-center justify-center scale-0 group-focus-within:scale-100 transition-transform hover:bg-indigo-700"
              >
                <Send size={12} />
              </button>
            </form>
          </div>

          {/* Centered Dice */}
          <div className="flex flex-col items-center gap-2">
            <Dice 
              value={gameState.diceValue !== null ? gameState.diceValue : lastDiceValue} 
              isRolling={isRollingLocal} 
              disabled={!isMyTurn || gameState.diceValue !== null}
              onClick={handleRoll}
            />
          </div>

          {/* Quick Emojis */}
          <div className="flex flex-col gap-2 items-end">
            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest pr-1">Express</p>
            <div className="flex items-center gap-1">
              {['😂', '🔥', '👑'].map(e => (
                <button 
                  key={e}
                  onClick={() => sendEmoji(e)}
                  className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-sm hover:scale-110 transition-all shadow-sm active:scale-90"
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Modals & Overlays */}
      <AnimatePresence>
        {isSettingsOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSettingsOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-sm glass dark:bg-slate-800 dark:border-slate-700 p-6 rounded-[2.5rem] shadow-2xl"
            >
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-widest">Settings</h2>
                <button 
                  onClick={() => setIsSettingsOpen(false)}
                  className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors dark:text-slate-400"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-6">
                {/* Actions Section */}
                <div className="grid grid-cols-2 gap-3 mb-6">
                  <button 
                    onClick={leaveRoom}
                    className="flex flex-col items-center justify-center gap-2 p-4 rounded-[1.5rem] bg-red-50 dark:bg-red-950/20 border-2 border-red-100 dark:border-red-900/30 text-red-600 hover:bg-red-100 transition-all active:scale-95"
                  >
                    <X size={20} />
                    <span className="text-[10px] font-black uppercase tracking-widest">Quit Game</span>
                  </button>
                  <button 
                    onClick={copyInviteLink}
                    className="flex flex-col items-center justify-center gap-2 p-4 rounded-[1.5rem] bg-emerald-50 dark:bg-emerald-950/20 border-2 border-emerald-100 dark:border-emerald-900/30 text-emerald-600 hover:bg-emerald-100 transition-all active:scale-95 relative"
                  >
                    {showCopySuccess && (
                      <motion.div 
                        initial={{ opacity: 0, y: -10 }} 
                        animate={{ opacity: 1, y: 0 }} 
                        className="absolute -top-12 left-1/2 -translate-x-1/2 bg-emerald-600 text-white text-[10px] font-bold px-3 py-1 rounded-full shadow-lg whitespace-nowrap"
                      >
                        Copied!
                      </motion.div>
                    )}
                    <Share2 size={20} />
                    <span className="text-[10px] font-black uppercase tracking-widest">Invite</span>
                  </button>
                </div>

                {/* Dark Mode Toggle */}
                <button 
                  onClick={toggleTheme}
                  className={`flex items-center justify-between w-full p-4 rounded-2xl border-2 transition-all ${theme === 'dark' ? 'bg-indigo-950/20 border-indigo-900/30' : 'bg-slate-50 border-slate-100'}`}
                >
                  <div className="flex items-center gap-3">
                    {theme === 'dark' ? <Moon size={18} className="text-indigo-400" /> : <Sun size={18} className="text-amber-500" />}
                    <span className={`font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>Dark mode</span>
                  </div>
                  <div className={`w-10 h-5 rounded-full relative transition-colors ${theme === 'dark' ? 'bg-indigo-500' : 'bg-slate-300'}`}>
                    <motion.div 
                      animate={{ x: theme === 'dark' ? 20 : 2 }}
                      className="absolute top-1 w-3 h-3 bg-white rounded-full"
                    />
                  </div>
                </button>

                {/* Volume Section */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl text-indigo-600 dark:text-indigo-400">
                        {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
                      </div>
                      <span className="font-bold text-slate-700 dark:text-slate-300">Master Volume</span>
                    </div>
                    <button 
                      onClick={toggleMute}
                      className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tight ${isMuted ? 'bg-red-100 dark:bg-red-900/30 text-red-600' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'}`}
                    >
                      {isMuted ? 'Muted' : 'Unmute'}
                    </button>
                  </div>
                  <input 
                    type="range" 
                    min="0" 
                    max="1" 
                    step="0.01" 
                    value={masterVolume}
                    onChange={(e) => setMasterVolume(parseFloat(e.target.value))}
                    className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                  />
                </div>

                {/* Toggles */}
                <div className="flex flex-col gap-3">
                  <button 
                    onClick={toggleSFX}
                    className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${sfxEnabled ? 'bg-indigo-50 border-indigo-100' : 'bg-slate-50 border-slate-100'}`}
                  >
                    <span className={`font-bold ${sfxEnabled ? 'text-indigo-900' : 'text-slate-400'}`}>Sound Effects</span>
                    <div className={`w-10 h-5 rounded-full relative transition-colors ${sfxEnabled ? 'bg-indigo-500' : 'bg-slate-300'}`}>
                      <motion.div 
                        animate={{ x: sfxEnabled ? 20 : 2 }}
                        className="absolute top-1 w-3 h-3 bg-white rounded-full"
                      />
                    </div>
                  </button>

                  <button 
                    onClick={toggleMusic}
                    className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${musicEnabled ? 'bg-indigo-50 border-indigo-100' : 'bg-slate-50 border-slate-100'}`}
                  >
                    <div className="flex items-center gap-3">
                      <Music size={18} className={musicEnabled ? 'text-indigo-600' : 'text-slate-400'} />
                      <span className={`font-bold ${musicEnabled ? 'text-indigo-900' : 'text-slate-400'}`}>Background Music</span>
                    </div>
                    <div className={`w-10 h-5 rounded-full relative transition-colors ${musicEnabled ? 'bg-indigo-500' : 'bg-slate-300'}`}>
                      <motion.div 
                        animate={{ x: musicEnabled ? 20 : 2 }}
                        className="absolute top-1 w-3 h-3 bg-white rounded-full"
                      />
                    </div>
                  </button>
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-slate-200/50 dark:border-slate-700/50 text-center">
                <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest">Ludo Elite v2.0</p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Chat Drawer Overlay */}
      <AnimatePresence>
        {isChatOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsChatOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm z-[100]"
            />
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              className="fixed right-0 top-0 bottom-0 w-full sm:w-[380px] bg-white dark:bg-slate-900 shadow-2xl z-[101] flex flex-col"
            >
              <div className="p-6 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-full">
                  <button 
                    onClick={() => setActiveTab('chat')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-black transition-all ${activeTab === 'chat' ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-500'}`}
                  >
                    <MessageSquare size={14} />
                    CHAT
                  </button>
                  <button 
                    onClick={() => setActiveTab('history')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-black transition-all ${activeTab === 'history' ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-500'}`}
                  >
                    <Activity size={14} />
                    LOG
                  </button>
                </div>
                <button onClick={() => setIsChatOpen(false)} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                  <X size={20} className="text-slate-400" />
                </button>
              </div>
              
              <div className="flex-1 overflow-hidden p-6">
                {activeTab === 'chat' ? (
                  <div className="h-full flex flex-col gap-3 overflow-y-auto pr-2 scroll-smooth">
                    {gameState.messages?.map((msg) => (
                      <div key={msg.id} className={`flex flex-col ${msg.senderId === me.id ? 'items-end' : 'items-start'}`}>
                        <div className="text-[10px] text-slate-400 font-bold mb-0.5">{msg.senderName}</div>
                        <div className={`px-3 py-2 rounded-2xl max-w-[80%] text-sm ${
                          msg.senderId === me.id 
                            ? 'bg-indigo-600 text-white rounded-tr-none' 
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-tl-none'
                        } ${msg.emoji ? 'text-3xl bg-transparent p-0' : ''}`}>
                          {msg.emoji || msg.text}
                        </div>
                      </div>
                    ))}
                    <div ref={chatEndRef} />
                  </div>
                ) : (
                  <div className="h-full flex flex-col gap-3 overflow-y-auto scrollbar-hide">
                    {gameState.moveHistory?.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-600 grayscale opacity-50">
                        <Activity size={40} className="mb-4" />
                        <p className="text-xs font-black uppercase tracking-widest">No moves yet</p>
                      </div>
                    ) : (
                      [...(gameState.moveHistory || [])].reverse().map((move, i) => (
                        <motion.div 
                          key={i}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm flex items-center gap-3"
                        >
                          <div className={`w-2 h-2 rounded-full ${
                            move.color === 'RED' ? 'bg-red-500' :
                            move.color === 'GREEN' ? 'bg-green-500' :
                            move.color === 'YELLOW' ? 'bg-yellow-500' : 'bg-blue-500'
                          }`} />
                          <div className="flex-1">
                            <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                              {move.player} moved to {move.to === 57 ? 'FINISH' : `cell ${move.to}`}
                            </p>
                            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                              {move.captured ? '💥 Captured a token!' : `Rolled a ${move.roll}`}
                            </p>
                          </div>
                        </motion.div>
                      ))
                    )}
                  </div>
                )}
              </div>

              {activeTab === 'chat' && (
                <div className="p-6 border-t border-slate-100 dark:border-slate-800 gap-3 flex flex-col bg-white dark:bg-slate-900">
                  <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-2">
                    {emojis.map(e => (
                      <button 
                        key={e} 
                        onClick={() => e === 'GG' ? sendChat("Good game!") : sendEmoji(e)}
                        className="w-10 h-10 flex items-center justify-center bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl text-lg transition-colors shrink-0"
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                  <form onSubmit={handleSendChat} className="flex gap-2">
                    <input 
                      type="text" 
                      value={chatText}
                      onChange={(e) => setChatText(e.target.value)}
                      placeholder="Say something..."
                      className="flex-1 bg-slate-50 dark:bg-slate-800 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 border border-slate-100 dark:border-slate-700 text-slate-900 dark:text-white"
                    />
                    <button type="submit" className="w-12 h-12 bg-indigo-600 text-white rounded-2xl flex items-center justify-center hover:bg-indigo-700 transition-colors shadow-lg active:scale-90">
                      <Send size={18} />
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
