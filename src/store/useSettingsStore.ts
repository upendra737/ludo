import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SettingsState {
  masterVolume: number;
  isMuted: boolean;
  sfxEnabled: boolean;
  musicEnabled: boolean;
  theme: 'dark' | 'light';
  setMasterVolume: (volume: number) => void;
  toggleMute: () => void;
  toggleSFX: () => void;
  toggleMusic: () => void;
  toggleTheme: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      masterVolume: 0.5,
      isMuted: false,
      sfxEnabled: true,
      musicEnabled: false,
      theme: 'dark',
      setMasterVolume: (volume) => set({ masterVolume: volume }),
      toggleMute: () => set((state) => ({ isMuted: !state.isMuted })),
      toggleSFX: () => set((state) => ({ sfxEnabled: !state.sfxEnabled })),
      toggleMusic: () => set((state) => ({ musicEnabled: !state.musicEnabled })),
      toggleTheme: () => set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' })),
    }),
    { name: 'ludo-settings' }
  )
);
