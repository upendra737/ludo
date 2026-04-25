/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GameState, Player, PlayerColor } from './game';

export interface ServerToClientEvents {
  'room:update': (state: GameState) => void;
  'room:joined': (data: { player: Player; roomState: GameState }) => void;
  'room:error': (error: string) => void;
  'game:dice-rolled': (value: number) => void;
  'game:token-moved': (data: { tokenId: string; from: number; to: number }) => void;
  'game:capture': (data: { capturedTokenId: string }) => void;
}

export interface ClientToServerEvents {
  'room:create': (data: { name: string; userId: string }) => void;
  'room:join': (data: { code: string; name: string; userId: string }) => void;
  'room:auth': (data: { userId: string }) => void;
  'room:leave': () => void;
  'room:ready': () => void;
  'game:roll-dice': () => void;
  'game:move-token': (data: { tokenId: string }) => void;
  'game:send-chat': (data: { text: string }) => void;
  'game:send-emoji': (data: { emoji: string }) => void;
  'game:restart': () => void;
  'room:fill-bots': () => void;
}
