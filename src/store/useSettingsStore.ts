import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SettingsState {
  masterVolume: number;
  isMuted: boolean;
  sfxEnabled: boolean;
  musicEnabled: boolean;
  setMasterVolume: (volume: number) => void;
  toggleMute: () => void;
  toggleSFX: () => void;
  toggleMusic: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      masterVolume: 0.5,
      isMuted: false,
      sfxEnabled: true,
      musicEnabled: true,
      setMasterVolume: (volume) => set({ masterVolume: volume }),
      toggleMute: () => set((state) => ({ isMuted: !state.isMuted })),
      toggleSFX: () => set((state) => ({ sfxEnabled: !state.sfxEnabled })),
      toggleMusic: () => set((state) => ({ musicEnabled: !state.musicEnabled })),
    }),
    {
      name: 'ludo-settings',
    }
  )
);
