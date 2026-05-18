/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { nanoid } from 'nanoid';
import { GameState, Player, PlayerColor } from '../types/game';
import { LudoEngine } from './engine';
import { persistRoom, deleteRoomRow } from './persistence';

const COLORS: PlayerColor[] = ['RED', 'GREEN', 'YELLOW', 'BLUE'];

export class RoomManager {
  private static rooms = new Map<string, GameState>();
  // Last mutation time per room — drives idle GC.
  private static activity = new Map<string, number>();

  private static touch(roomId: string) {
    this.activity.set(roomId, Date.now());
  }

  /** Restore in-progress games loaded from the DB on boot. */
  static hydrate(states: GameState[]) {
    for (const s of states) {
      this.rooms.set(s.roomId, s);
      this.touch(s.roomId);
    }
    if (states.length) console.log(`[rooms] rehydrated ${states.length} room(s) from DB`);
  }

  static createRoom(hostName: string, hostId: string): GameState {
    // Collision-safe code (P1 hardens the alphabet; this avoids overwrites now).
    let code = nanoid(6).toUpperCase();
    while (this.rooms.has(code)) code = nanoid(6).toUpperCase();

    const host: Player = {
      id: hostId,
      name: hostName,
      color: COLORS[0],
      isReady: false,
      tokens: [],
    };

    const state = LudoEngine.createInitialState(code, [host]);
    this.rooms.set(code, state);
    this.touch(code);
    persistRoom(state);
    return state;
  }

  static leaveRoom(userId: string) {
    const room = this.getRoomByPlayer(userId);
    if (room) {
      room.players = room.players.filter(p => p.id !== userId);
      if (room.players.length === 0) {
        this.deleteRoom(room.roomId);
      } else {
        this.touch(room.roomId);
        persistRoom(room);
      }
    }
  }

  static joinRoom(code: string, playerName: string, userId: string): GameState | null {
    const state = this.rooms.get(code);
    if (!state) return null;

    // Already in the room (rejoining)
    const existingPlayer = state.players.find(p => p.id === userId);
    if (existingPlayer) return state;

    if (state.players.length >= 4) return null;
    if (state.status !== 'WAITING') return null;

    const taken = state.players.map(p => p.color);
    const color = COLORS.find(c => !taken.includes(c)) ?? COLORS[state.players.length];
    state.players.push({ id: userId, name: playerName, color, isReady: false, tokens: [] });
    this.touch(code);
    persistRoom(state);
    return state;
  }

  static getRoom(code: string): GameState | null {
    return this.rooms.get(code) || null;
  }

  static updateRoom(code: string, newState: GameState) {
    this.rooms.set(code, newState);
    this.touch(code);
    persistRoom(newState);
  }

  static deleteRoom(roomId: string) {
    this.rooms.delete(roomId);
    this.activity.delete(roomId);
    void deleteRoomRow(roomId);
  }

  static getRoomByPlayer(playerId: string): GameState | null {
    for (const state of this.rooms.values()) {
      if (state.players.find(p => p.id === playerId)) {
        return state;
      }
    }
    return null;
  }

  static getAll(): GameState[] {
    return [...this.rooms.values()];
  }

  static lastActivity(roomId: string): number {
    return this.activity.get(roomId) ?? 0;
  }
}
