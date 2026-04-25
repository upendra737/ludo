/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { nanoid } from 'nanoid';
import { GameState, Player, PlayerColor } from '../types/game';
import { LudoEngine } from './engine';

const COLORS: PlayerColor[] = ['RED', 'GREEN', 'YELLOW', 'BLUE'];

export class RoomManager {
  private static rooms = new Map<string, GameState>();

  static createRoom(hostName: string, hostId: string): GameState {
    const code = nanoid(6).toUpperCase();
    const host: Player = {
      id: hostId,
      name: hostName,
      color: COLORS[0],
      isReady: false,
      tokens: [],
    };
    
    const state = LudoEngine.createInitialState(code, [host]);
    this.rooms.set(code, state);
    return state;
  }

  static leaveRoom(userId: string) {
    const room = this.getRoomByPlayer(userId);
    if (room) {
      room.players = room.players.filter(p => p.id !== userId);
      if (room.players.length === 0) {
        this.rooms.delete(room.roomId);
      }
    }
  }

  static joinRoom(code: string, playerName: string, userId: string): GameState | null {
    const state = this.rooms.get(code);
    if (!state) return null;

    // Check if player is already in the room (rejoining)
    const existingPlayer = state.players.find(p => p.id === userId);
    if (existingPlayer) return state;

    if (state.players.length >= 4) return null;
    if (state.status !== 'WAITING') return null;

    const newPlayer: Player = {
      id: userId,
      name: playerName,
      color: COLORS[state.players.length],
      isReady: false,
      tokens: [],
    };

    state.players.push(newPlayer);
    return state;
  }

  static getRoom(code: string): GameState | null {
    return this.rooms.get(code) || null;
  }

  static updateRoom(code: string, newState: GameState) {
    this.rooms.set(code, newState);
  }

  static getRoomByPlayer(playerId: string): GameState | null {
    for (const state of this.rooms.values()) {
      if (state.players.find(p => p.id === playerId)) {
        return state;
      }
    }
    return null;
  }
}
