import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SettingsState {
  masterVolume: number;
  isMuted: boolean;
  sfxEnabled: boolean;
  musicEnabled: boolean;
  theme: 'light' | 'dark';
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
      musicEnabled: true,
      theme: 'light',
      setMasterVolume: (volume) => set({ masterVolume: volume }),
      toggleMute: () => set((state) => ({ isMuted: !state.isMuted })),
      toggleSFX: () => set((state) => ({ sfxEnabled: !state.sfxEnabled })),
      toggleMusic: () => set((state) => ({ musicEnabled: !state.musicEnabled })),
      toggleTheme: () => set((state) => ({ theme: state.theme === 'light' ? 'dark' : 'light' })),
    }),
    {
      name: 'ludo-settings',
    }
  )
);
