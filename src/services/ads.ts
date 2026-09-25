import { MONETIZATION, interstitialsAllowed } from '../config/monetization';
import { getAnalytics } from './analytics';
import type { SaveService } from './save';

/**
 * Advertising abstraction.
 *
 * Gameplay only ever talks to `AdService`. The mock provider is the MVP default
 * and NEVER interrupts play unless a developer explicitly enables mock ads in
 * settings. A future AdMob provider implements the same interface, so no
 * gameplay code has to change.
 */

export interface AdResult {
  shown: boolean;
  /** Why nothing was shown (skipped / disabled / not ready). */
  reason?: 'disabled' | 'not-eligible' | 'skipped';
}

export interface RewardedResult {
  rewarded: boolean;
}

/** Optional UI bridge: lets the mock provider draw a fake ad overlay. */
export interface AdPresenter {
  /** Resolves when the fake interstitial has been dismissed. */
  presentInterstitial(durationMs: number): Promise<void>;
  /** Resolves with true if the viewer "watched" the fake rewarded ad. */
  presentRewarded(durationMs: number): Promise<boolean>;
}

export interface AdProvider {
  isInterstitialAvailable(): boolean;
  showInterstitial(): Promise<AdResult>;
  isRewardedAdAvailable(): boolean;
  showRewardedAd(): Promise<RewardedResult>;
}

/**
 * Decides whether an interstitial may be shown at a natural transition point.
 * All frequency policy lives here – never in scenes.
 */
export class InterstitialScheduler {
  constructor(
    private readonly save: SaveService,
    private readonly now: () => number = () => Date.now(),
  ) {}

  /**
   * Does policy allow an interstitial right now? (pure check, no side effects).
   * Callers must invoke `save.noteLevelCompletedForAds()` for the current
   * completion BEFORE this check so the counter includes it.
   */
  isEligible(): boolean {
    const ads = this.save.snapshot.ads;
    if (!interstitialsAllowed(ads)) return false;
    // Never on the very first completion of a session (warm-up).
    if (ads.sessionCompletions < MONETIZATION.warmupCompletionsBeforeFirst) return false;
    if (ads.levelsCompletedSinceInterstitial < MONETIZATION.interstitialEveryNLevels) return false;
    if (ads.lastInterstitialAt > 0 && this.now() - ads.lastInterstitialAt < MONETIZATION.minIntervalMs) {
      return false;
    }
    return true;
  }

  /** Eligibility + analytics. Called at natural transitions only. */
  checkAndAnnounce(): boolean {
    const eligible = this.isEligible();
    if (eligible) {
      getAnalytics().track('interstitial_eligible', {
        completedSinceLast: this.save.snapshot.ads.levelsCompletedSinceInterstitial,
      });
    }
    return eligible;
  }

  markShown(): void {
    const completedSince = this.save.snapshot.ads.levelsCompletedSinceInterstitial;
    this.save.noteInterstitialShown(this.now());
    getAnalytics().track('interstitial_shown', { completedSince });
  }
}

/** Dev/mock provider – safe by default. */
export class MockAdProvider implements AdProvider {
  private presenter: AdPresenter | null = null;

  constructor(private readonly save: SaveService) {}

  setPresenter(presenter: AdPresenter | null): void {
    this.presenter = presenter;
  }

  private get mockEnabled(): boolean {
    return this.save.snapshot.settings.mockAds;
  }

  isInterstitialAvailable(): boolean {
    return interstitialsAllowed(this.save.snapshot.ads);
  }

  async showInterstitial(): Promise<AdResult> {
    if (!this.isInterstitialAvailable()) return { shown: false, reason: 'disabled' };
    if (!this.mockEnabled || !this.presenter) {
      // Developer setting off → resolve instantly, never interrupt gameplay.
      return { shown: false, reason: 'skipped' };
    }
    await this.presenter.presentInterstitial(MONETIZATION.mockInterstitialDurationMs);
    return { shown: true };
  }

  isRewardedAdAvailable(): boolean {
    return MONETIZATION.rewardedAlwaysAvailableInMock;
  }

  async showRewardedAd(): Promise<RewardedResult> {
    if (!this.isRewardedAdAvailable()) return { rewarded: false };
    if (!this.presenter) {
      // Headless/tests: simulate a successful watch after a short delay.
      await new Promise((r) => setTimeout(r, 50));
      return { rewarded: true };
    }
    const watched = await this.presenter.presentRewarded(MONETIZATION.mockRewardedDurationMs);
    return { rewarded: watched };
  }
}

/**
 * Placeholder for the future AdMob provider.
 * Keep this file free of SDK imports – integration happens in a separate module
 * (see README "AdService" section) which registers itself via setAdProvider().
 */
export class AdmobPlaceholderProvider implements AdProvider {
  isInterstitialAvailable(): boolean {
    return false;
  }
  showInterstitial(): Promise<AdResult> {
    return Promise.resolve({ shown: false, reason: 'disabled' });
  }
  isRewardedAdAvailable(): boolean {
    return false;
  }
  showRewardedAd(): Promise<RewardedResult> {
    return Promise.resolve({ rewarded: false });
  }
}

let service: AdService | null = null;

/** Facade the game uses. */
export class AdService {
  constructor(
    private provider: AdProvider,
    readonly scheduler: InterstitialScheduler,
  ) {}

  setProvider(provider: AdProvider): void {
    this.provider = provider;
  }

  /** Wire a UI bridge into the mock provider (no-op for other providers). */
  setPresenter(presenter: AdPresenter | null): void {
    if (this.provider instanceof MockAdProvider) this.provider.setPresenter(presenter);
  }

  isInterstitialAvailable(): boolean {
    return this.provider.isInterstitialAvailable();
  }

  showInterstitial(): Promise<AdResult> {
    return this.provider.showInterstitial();
  }

  isRewardedAdAvailable(): boolean {
    return this.provider.isRewardedAdAvailable();
  }

  showRewardedAd(): Promise<RewardedResult> {
    return this.provider.showRewardedAd();
  }

  /**
   * Called after a level is completed (natural transition, never mid-gameplay).
   * Shows an interstitial when policy allows; always resolves with the result.
   */
  async showInterstitialIfEligible(): Promise<AdResult> {
    if (!this.scheduler.checkAndAnnounce()) {
      return { shown: false, reason: 'not-eligible' };
    }
    const result = await this.provider.showInterstitial();
    if (result.shown) this.scheduler.markShown();
    // When the mock is skipped (dev setting off) the cadence counter is left
    // untouched so enabling mock ads later doesn't trigger a burst.
    return result;
  }
}

export function getAdService(save: SaveService): AdService {
  if (!service) {
    const mock = new MockAdProvider(save);
    service = new AdService(mock, new InterstitialScheduler(save));
  }
  return service;
}

export function setAdService(next: AdService): void {
  service = next;
}
