import { GameState, Player, PlayerColor, Profile } from './game';

export interface ServerToClientEvents {
  'room:update':      (state: GameState | null) => void;
  'room:joined':      (data: { player: Player; roomState: GameState }) => void;
  'room:error':       (error: string) => void;
  'profile:state':    (profile: Profile) => void;
  'game:dice-rolled': (value: number) => void;
  'game:token-moved': (data: { tokenId: string; from: number; to: number }) => void;
  'game:capture':     (data: { capturedTokenId: string }) => void;
}

export interface ClientToServerEvents {
  'room:create':     (data: { name: string; userId: string; players?: number; vsCpu?: boolean }) => void;
  'room:join':       (data: { code: string; name: string; userId: string }) => void;
  'room:auth':       (data: { userId: string }) => void;
  'profile:update':  (data: { name: string; avatar: string }) => void;
  'room:leave':      () => void;
  'room:ready':      () => void;
  'room:pick-color': (data: { color: PlayerColor }) => void;
  'room:add-bot':    (data: { count: number }) => void;
  'game:roll-dice':  () => void;
  'game:move-token': (data: { tokenId: string }) => void;
  'game:send-chat':  (data: { text: string }) => void;
  'game:send-emoji': (data: { emoji: string }) => void;
  'game:restart':    () => void;
  /** @deprecated use room:add-bot */
  'room:fill-bots':  () => void;
}
