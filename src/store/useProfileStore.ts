import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Lightweight device-bound profile. Identity (name/avatar) is owned by the
 * client and persisted in localStorage so it's prefilled every visit; stats
 * (wins/games) are owned by the server and pushed via the `profile:state`
 * socket event. Keyed implicitly to the existing `ludo_user_id`.
 */
export const AVATARS = [
  '🦁', '🐯', '🐼', '🦊', '🐸', '🐵',
  '🐧', '🦄', '🐲', '👾', '🤖', '🎯',
];

interface ProfileState {
  name: string;
  avatar: string;
  wins: number;
  games: number;
  hasIdentity: boolean;
  setIdentity: (name: string, avatar: string) => void;
  setStats: (wins: number, games: number) => void;
}

export const useProfileStore = create<ProfileState>()(
  persist(
    (set) => ({
      name: '',
      avatar: AVATARS[0],
      wins: 0,
      games: 0,
      hasIdentity: false,
      setIdentity: (name, avatar) =>
        set({ name: name.trim().slice(0, 24), avatar, hasIdentity: !!name.trim() }),
      setStats: (wins, games) => set({ wins, games }),
    }),
    {
      name: 'ludo-profile',
      // only the identity is durable locally; stats come from the server
      partialize: (s) => ({ name: s.name, avatar: s.avatar, hasIdentity: s.hasIdentity }),
    },
  ),
);
