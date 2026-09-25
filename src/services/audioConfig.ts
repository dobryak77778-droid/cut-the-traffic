import { audio } from './audio';
import { configureVibration } from './vibration';
import { getSave } from './save';

/** Re-reads persisted settings and applies them to audio + haptics. */
export function syncAudioSettings(): void {
  const save = getSave();
  audio.configure({
    isSoundOn: () => save.snapshot.settings.sound,
    isMusicOn: () => save.snapshot.settings.music,
  });
  configureVibration(() => save.snapshot.settings.vibration);
}
