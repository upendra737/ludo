import { Howl, Howler } from 'howler';
import { useCallback, useRef, useEffect } from 'react';
import { useSettingsStore } from '../store/useSettingsStore';

export type SoundType =
  | 'ROLL_SHAKE'
  | 'ROLL_TUMBLE'
  | 'ROLL_LAND'
  | 'MOVE'
  | 'CAPTURE'
  | 'WIN'
  | 'SIX'
  | 'TURN'
  | 'FINISH'
  | 'EMOJI';

const SOUNDS: Record<SoundType, string> = {
  ROLL_SHAKE:  'https://cdn.pixabay.com/audio/2022/03/15/audio_7315dc82a9.mp3',
  ROLL_TUMBLE: 'https://assets.mixkit.co/sfx/preview/mixkit-game-dice-roll-952.mp3',
  ROLL_LAND:   'https://cdn.pixabay.com/audio/2022/03/10/audio_510a726338.mp3',
  MOVE:        'https://cdn.pixabay.com/audio/2021/08/04/audio_06256f112e.mp3',
  CAPTURE:     'https://cdn.pixabay.com/audio/2021/08/04/audio_bb6076a06e.mp3',
  WIN:         'https://cdn.pixabay.com/audio/2021/08/04/audio_32cd49463a.mp3',
  SIX:         'https://assets.mixkit.co/sfx/preview/mixkit-winning-chimes-2015.mp3',
  TURN:        'https://assets.mixkit.co/sfx/preview/mixkit-electronic-chime-2000.mp3',
  FINISH:      'https://assets.mixkit.co/sfx/preview/mixkit-fantasy-game-success-notification-270.mp3',
  EMOJI:       'https://assets.mixkit.co/sfx/preview/mixkit-positive-notification-951.mp3',
};

// Synthesised fallback tones — guaranteed to work without CDN
const FALLBACK_TONES: Partial<Record<SoundType, { freq: number; freq2?: number; dur: number; type: OscillatorType }>> = {
  ROLL_LAND:   { freq: 260, freq2: 200, dur: 0.18, type: 'triangle' },
  MOVE:        { freq: 500, freq2: 620, dur: 0.10, type: 'sine' },
  CAPTURE:     { freq: 180, freq2: 120, dur: 0.28, type: 'sawtooth' },
  WIN:         { freq: 660, freq2: 880, dur: 0.60, type: 'sine' },
  SIX:         { freq: 550, freq2: 740, dur: 0.30, type: 'sine' },
  EMOJI:       { freq: 520, freq2: 660, dur: 0.12, type: 'sine' },
  TURN:        { freq: 380, freq2: 480, dur: 0.18, type: 'sine' },
  FINISH:      { freq: 800, freq2: 1000, dur: 0.50, type: 'sine' },
};

export const useSounds = () => {
  const { masterVolume, isMuted, sfxEnabled } = useSettingsStore();
  const soundsRef = useRef<Record<string, Howl>>({});
  const webAudioCtxRef = useRef<AudioContext | null>(null);
  const failedRef = useRef<Set<SoundType>>(new Set());

  const getAudioCtx = (): AudioContext | null => {
    try {
      if (!webAudioCtxRef.current || webAudioCtxRef.current.state === 'closed') {
        const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        webAudioCtxRef.current = new Ctx();
      }
      if (webAudioCtxRef.current.state === 'suspended') {
        webAudioCtxRef.current.resume();
      }
      return webAudioCtxRef.current;
    } catch {
      return null;
    }
  };

  const playFallbackTone = useCallback((type: SoundType) => {
    const config = FALLBACK_TONES[type];
    if (!config) return;
    const ctx = getAudioCtx();
    if (!ctx) return;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = config.type;
      osc.frequency.setValueAtTime(config.freq, ctx.currentTime);
      if (config.freq2) {
        osc.frequency.exponentialRampToValueAtTime(config.freq2, ctx.currentTime + config.dur * 0.6);
      }
      const vol = (isMuted ? 0 : masterVolume) * 0.22;
      gain.gain.setValueAtTime(vol, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + config.dur);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + config.dur);
    } catch { /* silent */ }
  }, [masterVolume, isMuted]);

  useEffect(() => {
    Howler.autoUnlock = true;

    Object.entries(SOUNDS).forEach(([key, src]) => {
      if (!soundsRef.current[key]) {
        soundsRef.current[key] = new Howl({
          src: [src],
          volume: masterVolume,
          preload: true,
          html5: false,
          onloaderror: () => {
            failedRef.current.add(key as SoundType);
          },
          onplayerror: () => {
            Howler.ctx?.resume();
            failedRef.current.add(key as SoundType);
          },
        });
      }
    });

    return () => {
      Object.values(soundsRef.current).forEach((s) => (s as Howl).unload());
      soundsRef.current = {};
    };
  }, []);

  useEffect(() => {
    Object.values(soundsRef.current).forEach((s) => {
      (s as Howl).volume(isMuted ? 0 : masterVolume);
    });
  }, [masterVolume, isMuted]);

  const playSound = useCallback((type: SoundType) => {
    if (!sfxEnabled || isMuted) return;

    if (Howler.ctx && Howler.ctx.state === 'suspended') {
      Howler.ctx.resume();
    }

    const sound = soundsRef.current[type];
    const hasFailed = failedRef.current.has(type);

    if (sound && !hasFailed) {
      if (type === 'ROLL_TUMBLE') {
        if (!sound.playing()) sound.loop(true).play();
      } else {
        sound.play();
      }
    } else {
      // Fallback: synthesise the tone via Web Audio API
      playFallbackTone(type);
    }
  }, [sfxEnabled, isMuted, playFallbackTone]);

  const stopSound = useCallback((type: SoundType) => {
    soundsRef.current[type]?.stop();
  }, []);

  return { playSound, stopSound };
};
