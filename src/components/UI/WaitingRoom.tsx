/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion } from 'motion/react';
import { Users, CheckCircle2, Circle, Copy, Play, Link as LinkIcon } from 'lucide-react';
import { useGameStore } from '../../store/useGameStore';
import { useSocket } from '../../hooks/useSocket';

export const WaitingRoom: React.FC = () => {
  const { gameState, me: myInitialState } = useGameStore();
  const { setReady, fillBots } = useSocket();

  if (!gameState || !myInitialState) return null;

  // Derive "me" from gameState to stay in sync with server-side updates
  const me = gameState.players.find(p => p.id === myInitialState.id) || myInitialState;
  const isHost = gameState.players[0]?.id === me.id;

  const copyCode = () => {
    navigator.clipboard.writeText(gameState.roomId);
  };

  const copyLink = () => {
    const link = `${window.location.origin}?room=${gameState.roomId}`;
    navigator.clipboard.writeText(link);
    // You could add a toast here, but for now we'll rely on the visual feedback
  };

  const colors = {
    RED: 'bg-red-500',
    GREEN: 'bg-green-500',
    YELLOW: 'bg-yellow-400',
    BLUE: 'bg-blue-500',
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4 transition-colors duration-500">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden border border-slate-100 dark:border-slate-800"
      >
        <div className="p-10">
          <div className="flex flex-col md:flex-row justify-between items-start gap-6 mb-8">
            <div>
              <h2 className="text-3xl font-bold text-slate-800 dark:text-white">Game Lobby</h2>
              <p className="text-slate-500 dark:text-slate-400 mt-1">Waiting for players to get ready...</p>
            </div>
            
            <div className="flex flex-col gap-2 w-full md:w-auto">
              <div 
                onClick={copyCode}
                className="bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/30 p-3 rounded-xl cursor-pointer hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-colors flex items-center justify-between gap-4 group"
              >
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase font-bold text-indigo-400 tracking-wider">Room Code</span>
                  <span className="text-xl font-mono font-bold text-indigo-600 dark:text-indigo-400 uppercase">{gameState.roomId}</span>
                </div>
                <Copy size={18} className="text-indigo-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-300" />
              </div>

              <button 
                onClick={copyLink}
                className="flex items-center justify-center gap-2 py-2 px-4 bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              >
                <LinkIcon size={16} />
                Copy Invite Link
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
            {Array.from({ length: 4 }).map((_, i) => {
              const player = gameState.players[i];
              return (
                <div 
                  key={i}
                  className={`p-6 rounded-2xl border-2 transition-all duration-300 ${
                    player 
                      ? 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 shadow-sm' 
                      : 'bg-slate-50 dark:bg-slate-900 border-dashed border-slate-200 dark:border-slate-700 opacity-60'
                  }`}
                >
                  {player ? (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-xl ${colors[player.color]} shadow-lg flex items-center justify-center text-white font-bold`}>
                          {player.name[0].toUpperCase()}
                        </div>
                        <div>
                          <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                            {player.name}
                            {player.isAI && <span className="text-[10px] bg-indigo-100 dark:bg-indigo-950/40 text-indigo-500 dark:text-indigo-400 px-1.5 py-0.5 rounded uppercase font-bold tracking-tighter flex items-center gap-1">Bot 🤖</span>}
                            {player.id === me.id && <span className="text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded uppercase font-bold tracking-tighter">You</span>}
                          </div>
                          <div className="text-xs text-slate-400 dark:text-slate-500 uppercase font-bold tracking-widest">{player.color}</div>
                        </div>
                      </div>
                      {player.isReady ? (
                        <CheckCircle2 className="text-green-500" size={24} />
                      ) : (
                        <Circle className="text-slate-200 dark:text-slate-700" size={24} />
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-4 text-slate-300 dark:text-slate-600">
                      <div className="w-12 h-12 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700" />
                      <span className="font-medium">Waiting for player...</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex flex-col items-center gap-4">
            <button
              onClick={setReady}
              className={`w-full max-w-xs py-5 rounded-2xl font-bold text-lg shadow-xl transition-all active:scale-95 flex items-center justify-center gap-3 ${
                me.isReady 
                  ? 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 shadow-slate-100 dark:shadow-none' 
                  : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-100 dark:shadow-none'
              }`}
            >
              {me.isReady ? 'Im Ready!' : 'Ready to Start'}
              {me.isReady && <CheckCircle2 size={24} />}
            </button>

            {isHost && gameState.players.length < 4 && (
              <button 
                onClick={fillBots}
                className="text-xs font-bold text-indigo-500 dark:text-indigo-400 hover:underline flex items-center gap-1.5"
              >
                <Users size={14} />
                Fill with Bots
              </button>
            )}
            
            <p className="text-xs text-slate-400 font-medium">
              Need 2+ players. All must be ready to start.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
