/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect } from 'react';
import { useGameStore } from './store/useGameStore';
import { useSettingsStore } from './store/useSettingsStore';
import { Lobby } from './components/UI/Lobby';
import { WaitingRoom } from './components/UI/WaitingRoom';
import { GameView } from './components/UI/GameView';
import { ConnectionOverlay } from './components/UI/ConnectionOverlay';

export default function App() {
  const { gameState, me } = useGameStore();
  const { theme } = useSettingsStore();

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return (
    <>
      {!gameState || !me ? (
        <Lobby />
      ) : gameState.status === 'WAITING' ? (
        <WaitingRoom />
      ) : (
        <GameView />
      )}
      <ConnectionOverlay />
    </>
  );
}
