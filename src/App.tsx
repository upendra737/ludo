/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useGameStore } from './store/useGameStore';
import { Lobby } from './components/UI/Lobby';
import { WaitingRoom } from './components/UI/WaitingRoom';
import { GameView } from './components/UI/GameView';

export default function App() {
  const { gameState, me } = useGameStore();

  return (
    <>
      {!gameState || !me ? (
        <Lobby />
      ) : gameState.status === 'WAITING' ? (
        <WaitingRoom />
      ) : (
        <GameView />
      )}
    </>
  );
}
