/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type PlayerColor = 'RED' | 'GREEN' | 'YELLOW' | 'BLUE';

export interface Token {
  id: string;
  color: PlayerColor;
  position: number; // -1 to -4 (home), 0 to 51 (main path), 52 to 57 (finish line)
  isFinished: boolean;
}

export interface Player {
  id: string;
  name: string;
  color: PlayerColor;
  isReady: boolean;
  tokens: Token[];
  isAI?: boolean;
}

export type GameStatus = 'WAITING' | 'PLAYING' | 'FINISHED';

export interface GameState {
  roomId: string;
  players: Player[];
  status: GameStatus;
  currentPlayerIndex: number;
  diceValue: number | null;
  logs: string[];
  winner: string | null; // Player name
  lastRollTimestamp: number | null;
  movesRemaining: number; // 1 unless they roll a 6 (handled by engine)
  messages: ChatMessage[];
  moveHistory: GameMove[];
}

export interface GameMove {
  player: string;
  from: number;
  to: number;
  roll: number;
  color: string;
  captured: boolean;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text?: string;
  emoji?: string;
  timestamp: number;
}

export interface RoomMetadata {
  code: string;
  hostId: string;
  createdAt: number;
}
