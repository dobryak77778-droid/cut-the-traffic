import { describe, expect, it } from 'vitest';
import { SaveService, defaultSave } from '../src/services/save';

/** In-memory Storage shim so tests exercise the real persistence path. */
interface MemStorage {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  readonly _map: Map<string, string>;
}

function memoryStorage(): MemStorage {
  const map = new Map<string, string>();
  return {
    _map: map,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
  };
}

describe('progression & local save', () => {
  it('starts at level 1 with everything locked beyond it', () => {
    const save = new SaveService(null);
    expect(save.unlockedLevel).toBe(1);
    expect(save.isUnlocked(1)).toBe(true);
    expect(save.isUnlocked(2)).toBe(false);
    expect(save.isCompleted(1)).toBe(false);
    expect(save.bestTime(1)).toBeUndefined();
  });

  it('completing level N unlocks N+1', () => {
    const save = new SaveService(null);
    const unlocked = save.completeLevel(1, 18.4);
    expect(unlocked).toBe(true);
    expect(save.isUnlocked(2)).toBe(true);
    expect(save.isUnlocked(3)).toBe(false);
    save.completeLevel(2, 21.0);
    expect(save.isUnlocked(3)).toBe(true);
    expect(save.isCompleted(1)).toBe(true);
    expect(save.bestTime(1)).toBeCloseTo(18.4);
  });

  it('keeps the best time, not the latest', () => {
    const save = new SaveService(null);
    save.completeLevel(1, 25);
    save.completeLevel(1, 19);
    save.completeLevel(1, 23);
    expect(save.bestTime(1)).toBeCloseTo(19);
  });

  it('progress survives a reload (same storage, new instance)', () => {
    const storage = memoryStorage();
    const a = new SaveService(storage);
    a.completeLevel(1, 17.2);
    a.completeLevel(2, 20.1);
    a.setSetting('sound', false);

    const b = new SaveService(storage); // "reload"
    expect(b.unlockedLevel).toBe(3);
    expect(b.isCompleted(2)).toBe(true);
    expect(b.bestTime(1)).toBeCloseTo(17.2);
    expect(b.snapshot.settings.sound).toBe(false);
  });

  it('survives corrupted save data', () => {
    const storage = memoryStorage();
    storage.setItem('ctt.save.v1', '{not json');
    const save = new SaveService(storage);
    expect(save.unlockedLevel).toBe(1);
  });

  it('counts attempts per level', () => {
    const save = new SaveService(null);
    expect(save.registerAttempt(1)).toBe(1);
    expect(save.registerAttempt(1)).toBe(2);
    expect(save.registerAttempt(2)).toBe(1);
  });

  it('resetProgress clears unlocks but keeps settings', () => {
    const save = new SaveService(null);
    save.completeLevel(1, 15);
    save.setSetting('music', true);
    save.resetProgress();
    expect(save.unlockedLevel).toBe(1);
    expect(save.isCompleted(1)).toBe(false);
    expect(save.snapshot.settings.music).toBe(true);
  });

  it('default save is well-formed', () => {
    const d = defaultSave();
    expect(d.version).toBe(1);
    expect(d.settings.sound).toBe(true);
    expect(d.ads.removeAds).toBe(false);
  });
});
