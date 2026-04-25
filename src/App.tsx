/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useGameStore } from './store/useGameStore';
import { useSettingsStore } from './store/useSettingsStore';
import { Lobby } from './components/UI/Lobby';
import { WaitingRoom } from './components/UI/WaitingRoom';
import { GameView } from './components/UI/GameView';

export default function App() {
  const { gameState, me } = useGameStore();
  const { theme } = useSettingsStore();

  return (
    <div className={theme === 'dark' ? 'dark' : ''}>
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-500">
        {!gameState || !me ? (
          <Lobby />
        ) : gameState.status === 'WAITING' ? (
          <WaitingRoom />
        ) : (
          <GameView />
        )}
      </div>
    </div>
  );
}
