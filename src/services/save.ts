import type { DirectionId, LevelConfig, VehicleSnapshot, WorldSnapshot } from '../types';

export type { DirectionId, LevelConfig, VehicleSnapshot, WorldSnapshot };

/** localStorage-backed progress + settings. Pure TS so it is unit-testable. */
export interface SaveData {
  version: number;
  /** Highest unlocked level id (1-based). */
  unlockedLevel: number;
  /** level id -> true once completed. */
  completed: Record<string, boolean>;
  /** level id -> best completion time in seconds. */
  bestTimes: Record<string, number>;
  attempts: Record<string, number>;
  settings: {
    sound: boolean;
    music: boolean;
    vibration: boolean;
    /** Dev switch: allow the mock interstitial UI to appear. */
    mockAds: boolean;
  };
  ads: {
    /** Future IAP flag – persisted now, wired to a store later. */
    removeAds: boolean;
    levelsCompletedSinceInterstitial: number;
    lastInterstitialAt: number;
    sessionCompletions: number;
  };
}

const SAVE_KEY = 'ctt.save.v1';
const SAVE_VERSION = 1;

export function defaultSave(): SaveData {
  return {
    version: SAVE_VERSION,
    unlockedLevel: 1,
    completed: {},
    bestTimes: {},
    attempts: {},
    settings: {
      sound: true,
      music: false,
      vibration: true,
      mockAds: false,
    },
    ads: {
      removeAds: false,
      levelsCompletedSinceInterstitial: 0,
      lastInterstitialAt: 0,
      sessionCompletions: 0,
    },
  };
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

/** Wraps a storage backend (localStorage in the browser, memory in tests). */
export class SaveService {
  private data: SaveData;
  private storage: StorageLike | null;

  constructor(storage: StorageLike | null = null) {
    this.storage = storage;
    this.data = this.load();
  }

  private load(): SaveData {
    if (!this.storage) return defaultSave();
    try {
      const raw = this.storage.getItem(SAVE_KEY);
      if (!raw) return defaultSave();
      const parsed = JSON.parse(raw) as Partial<SaveData>;
      if (!parsed || parsed.version !== SAVE_VERSION) return defaultSave();
      const base = defaultSave();
      return {
        ...base,
        ...parsed,
        settings: { ...base.settings, ...parsed.settings },
        ads: { ...base.ads, ...parsed.ads },
        completed: { ...parsed.completed },
        bestTimes: { ...parsed.bestTimes },
        attempts: { ...parsed.attempts },
      };
    } catch {
      return defaultSave();
    }
  }

  private persist(): void {
    if (!this.storage) return;
    try {
      this.storage.setItem(SAVE_KEY, JSON.stringify(this.data));
    } catch {
      /* storage full / unavailable – play on without persistence */
    }
  }

  get snapshot(): SaveData {
    return this.data;
  }

  get unlockedLevel(): number {
    return this.data.unlockedLevel;
  }

  isUnlocked(levelId: number): boolean {
    return levelId <= this.data.unlockedLevel;
  }

  isCompleted(levelId: number): boolean {
    return !!this.data.completed[String(levelId)];
  }

  bestTime(levelId: number): number | undefined {
    return this.data.bestTimes[String(levelId)];
  }

  /** Returns true when this completion unlocked a brand new level. */
  completeLevel(levelId: number, timeSeconds: number): boolean {
    const key = String(levelId);
    const firstTime = !this.data.completed[key];
    this.data.completed[key] = true;
    const prev = this.data.bestTimes[key];
    if (prev === undefined || timeSeconds < prev) {
      this.data.bestTimes[key] = timeSeconds;
    }
    this.data.attempts[key] = (this.data.attempts[key] ?? 0) + 1;
    const before = this.data.unlockedLevel;
    this.data.unlockedLevel = Math.max(this.data.unlockedLevel, levelId + 1);
    this.persist();
    return this.data.unlockedLevel > before && firstTime;
  }

  registerAttempt(levelId: number): number {
    const key = String(levelId);
    this.data.attempts[key] = (this.data.attempts[key] ?? 0) + 1;
    this.persist();
    return this.data.attempts[key];
  }

  setSetting<K extends keyof SaveData['settings']>(key: K, value: SaveData['settings'][K]): void {
    this.data.settings[key] = value;
    this.persist();
  }

  /** Future Remove Ads entitlement (no real payment flow in MVP). */
  setRemoveAds(value: boolean): void {
    this.data.ads.removeAds = value;
    this.persist();
  }

  // --- interstitial bookkeeping -------------------------------------------
  noteInterstitialShown(at: number = Date.now()): void {
    this.data.ads.levelsCompletedSinceInterstitial = 0;
    this.data.ads.lastInterstitialAt = at;
    this.persist();
  }

  noteLevelCompletedForAds(): void {
    this.data.ads.levelsCompletedSinceInterstitial += 1;
    this.data.ads.sessionCompletions += 1;
    this.persist();
  }

  /** Clears level progress but keeps settings (used by Settings → reset). */
  resetProgress(): void {
    this.data.unlockedLevel = 1;
    this.data.completed = {};
    this.data.bestTimes = {};
    this.data.attempts = {};
    this.data.ads.levelsCompletedSinceInterstitial = 0;
    this.data.ads.sessionCompletions = 0;
    this.persist();
  }

  resetForDev(): void {
    this.data = defaultSave();
    this.persist();
  }
}

/** Singleton used by the game; tests construct their own instances. */
let browserSave: SaveService | null = null;

export function getSave(): SaveService {
  if (!browserSave) {
    const storage =
      typeof localStorage !== 'undefined'
        ? localStorage
        : null;
    browserSave = new SaveService(storage);
  }
  return browserSave;
}
