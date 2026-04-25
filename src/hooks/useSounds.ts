/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Howl, Howler } from 'howler';
import { useCallback, useRef, useEffect } from 'react';
import { useSettingsStore } from '../store/useSettingsStore';

type SoundType = 'ROLL_SHAKE' | 'ROLL_TUMBLE' | 'ROLL_LAND' | 'MOVE' | 'CAPTURE' | 'WIN' | 'SIX' | 'TURN' | 'FINISH';

const SOUNDS: Record<SoundType, string> = {
  ROLL_SHAKE: 'https://cdn.pixabay.com/audio/2022/03/15/audio_7315dc82a9.mp3', // Dice rattle
  ROLL_TUMBLE: 'https://assets.mixkit.co/sfx/preview/mixkit-game-dice-roll-952.mp3', // Tumbling
  ROLL_LAND: 'https://cdn.pixabay.com/audio/2022/03/10/audio_510a726338.mp3', // Hard clack
  MOVE: 'https://cdn.pixabay.com/audio/2021/08/04/audio_06256f112e.mp3',
  CAPTURE: 'https://cdn.pixabay.com/audio/2021/08/04/audio_bb6076a06e.mp3',
  WIN: 'https://cdn.pixabay.com/audio/2021/08/04/audio_32cd49463a.mp3',
  SIX: 'https://assets.mixkit.co/sfx/preview/mixkit-winning-chimes-2015.mp3',
  TURN: 'https://assets.mixkit.co/sfx/preview/mixkit-electronic-chime-2000.mp3',
  FINISH: 'https://assets.mixkit.co/sfx/preview/mixkit-fantasy-game-success-notification-270.mp3',
};

export const useSounds = () => {
  const { masterVolume, isMuted, sfxEnabled } = useSettingsStore();
  const soundsRef = useRef<Record<string, Howl>>({});

  useEffect(() => {
    // Enable auto-unlocking for mobile/desktop browsers
    Howler.autoUnlock = true;

    // Preload sounds
    Object.entries(SOUNDS).forEach(([key, src]) => {
      if (!soundsRef.current[key]) {
        soundsRef.current[key] = new Howl({
          src: [src],
          volume: masterVolume,
          preload: true,
          html5: false, // Use Web Audio API for better performance and sync
          onloaderror: (id, err) => console.warn(`Sound load error for ${key}:`, err),
          onplayerror: (id, err) => {
            console.warn(`Sound playback error for ${key}:`, err);
            // On play error, try to resume context
            Howler.ctx?.resume();
          }
        });
      }
    });

    return () => {
      // Cleanup
      Object.values(soundsRef.current).forEach((s: any) => s.unload());
      soundsRef.current = {};
    };
  }, []);

  // Update volumes when masterVolume changes
  useEffect(() => {
    Object.values(soundsRef.current).forEach((s: any) => {
      s.volume(isMuted ? 0 : masterVolume);
    });
  }, [masterVolume, isMuted]);

  const playSound = useCallback((type: SoundType) => {
    if (!sfxEnabled || isMuted) return;
    
    // Explicitly try to resume context on every play call to bypass autoplay blocks
    if (Howler.ctx && Howler.ctx.state === 'suspended') {
      Howler.ctx.resume();
    }

    const sound = soundsRef.current[type];
    if (sound) {
      // If it's a loop sound like tumbling, we handle it differently
      if (type === 'ROLL_TUMBLE') {
        if (!sound.playing()) {
          sound.loop(true).play();
        }
      } else {
        sound.play();
      }
    }
  }, [sfxEnabled, isMuted]);

  const stopSound = useCallback((type: SoundType) => {
    const sound = soundsRef.current[type];
    if (sound) {
      sound.stop();
    }
  }, []);

  return { playSound, stopSound };
};
