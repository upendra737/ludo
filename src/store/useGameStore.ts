/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { create } from 'zustand';
import { GameState, Player } from '../types/game';

interface GameStore {
  gameState: GameState | null;
  me: Player | null;
  isConnected: boolean;
  error: string | null;
  
  setGameState: (state: GameState) => void;
  setMe: (player: Player) => void;
  setConnected: (connected: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

export const useGameStore = create<GameStore>((set) => ({
  gameState: null,
  me: null,
  isConnected: false,
  error: null,

  setGameState: (state) => set({ gameState: state }),
  setMe: (player) => set({ me: player }),
  setConnected: (connected) => set({ isConnected: connected }),
  setError: (error) => set({ error }),
  reset: () => set({ gameState: null, me: null, error: null }),
}));
