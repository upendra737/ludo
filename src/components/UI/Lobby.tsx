/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Play, Users, Link as LinkIcon, AlertCircle } from 'lucide-react';
import { useSocket } from '../../hooks/useSocket';
import { useGameStore } from '../../store/useGameStore';

export const Lobby: React.FC = () => {
  const [name, setName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [view, setView] = useState<'INITIAL' | 'CREATE' | 'JOIN'>('INITIAL');
  
  const { createRoom, joinRoom } = useSocket();
  const { error } = useGameStore();

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('room');
    if (code) {
      setRoomCode(code.toUpperCase());
      setView('JOIN');
    }
  }, []);

  const handleCreate = () => {
    if (name.trim()) {
      createRoom(name);
    }
  };

  const handleJoin = () => {
    if (name.trim() && roomCode.trim()) {
      joinRoom(roomCode, name);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4 transition-colors duration-500">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-[2.5rem] shadow-2xl overflow-hidden border border-white/20 dark:border-slate-800"
      >
        <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 p-10 text-white text-center">
          <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-6 backdrop-blur-md border border-white/30">
            <Play size={32} className="fill-white translate-x-0.5" />
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight mb-2">Global Ludo</h1>
          <p className="text-indigo-100/90 font-medium tracking-wide text-sm uppercase">Multiplayer Strategy Game</p>
        </div>

        <div className="p-10">
          <AnimatePresence mode="wait">
            {view === 'INITIAL' && (
              <motion.div
                key="initial"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-4"
              >
                <button
                  onClick={() => setView('CREATE')}
                  className="w-full py-4 bg-indigo-600 text-white rounded-xl font-semibold flex items-center justify-center gap-3 hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-100 dark:shadow-none"
                >
                  <Play size={20} fill="currentColor" />
                  Create Private Room
                </button>
                <button
                  onClick={() => setView('JOIN')}
                  className="w-full py-4 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-2 border-slate-100 dark:border-slate-700 rounded-xl font-semibold flex items-center justify-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                >
                  <Users size={20} />
                  Join with Code
                </button>
              </motion.div>
            )}

            {(view === 'CREATE' || view === 'JOIN') && (
              <motion.div
                key="form"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div>
                  <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider">Your Name</label>
                  <input
                    autoFocus
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter your name..."
                    className="w-full p-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-xl focus:border-indigo-500 focus:outline-none transition-colors text-lg dark:text-white"
                  />
                </div>

                {view === 'JOIN' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                  >
                    <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider">Room Code</label>
                    <input
                      type="text"
                      value={roomCode}
                      onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                      placeholder="e.g. AB12CD"
                      className="w-full p-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-xl focus:border-indigo-500 focus:outline-none transition-colors text-lg font-mono tracking-widest uppercase dark:text-white"
                    />
                  </motion.div>
                )}

                {error && (
                  <div className="flex items-center gap-2 text-red-500 text-sm bg-red-50 dark:bg-red-950/20 p-3 rounded-lg border border-red-100 dark:border-red-900/30">
                    <AlertCircle size={16} />
                    {error}
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={() => setView('INITIAL')}
                    className="flex-1 py-4 text-slate-500 dark:text-slate-400 font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-colors"
                  >
                    Back
                  </button>
                  <button
                    onClick={view === 'CREATE' ? handleCreate : handleJoin}
                    disabled={!name || (view === 'JOIN' && !roomCode)}
                    className="flex-[2] py-4 bg-indigo-600 text-white rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-100 dark:shadow-none"
                  >
                    {view === 'CREATE' ? 'Start Lobby' : 'Join Game'}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
};
