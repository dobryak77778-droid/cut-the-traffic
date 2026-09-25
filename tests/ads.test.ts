import { describe, expect, it } from 'vitest';
import { MONETIZATION } from '../src/config/monetization';
import {
  AdService,
  InterstitialScheduler,
  MockAdProvider,
} from '../src/services/ads';
import { SaveService } from '../src/services/save';

function setup(now = () => 1_000_000) {
  const save = new SaveService(null);
  const scheduler = new InterstitialScheduler(save, now);
  const provider = new MockAdProvider(save);
  const ads = new AdService(provider, scheduler);
  return { save, scheduler, provider, ads };
}

describe('interstitial scheduling policy', () => {
  it('never fires on the first completions (warm-up + every-N)', () => {
    const { save, scheduler } = setup();
    save.noteLevelCompletedForAds();
    expect(scheduler.isEligible()).toBe(false);
    save.noteLevelCompletedForAds();
    expect(scheduler.isEligible()).toBe(false);
  });

  it(`becomes eligible every ${MONETIZATION.interstitialEveryNLevels} completions`, () => {
    const { save, scheduler } = setup();
    for (let i = 0; i < MONETIZATION.interstitialEveryNLevels; i++) {
      save.noteLevelCompletedForAds();
    }
    expect(scheduler.isEligible()).toBe(true);
    save.noteInterstitialShown();
    expect(scheduler.isEligible()).toBe(false); // counter reset
    for (let i = 0; i < MONETIZATION.interstitialEveryNLevels; i++) {
      save.noteLevelCompletedForAds();
    }
    expect(scheduler.isEligible()).toBe(false); // min interval not elapsed
  });

  it('respects the minimum interval once enough time passes', () => {
    let clock = 10_000_000;
    const { save, scheduler } = setup(() => clock);
    for (let i = 0; i < MONETIZATION.interstitialEveryNLevels; i++) {
      save.noteLevelCompletedForAds();
    }
    expect(scheduler.isEligible()).toBe(true);
    save.noteInterstitialShown(clock);
    for (let i = 0; i < MONETIZATION.interstitialEveryNLevels; i++) {
      save.noteLevelCompletedForAds();
    }
    expect(scheduler.isEligible()).toBe(false);
    clock += MONETIZATION.minIntervalMs + 1;
    expect(scheduler.isEligible()).toBe(true);
  });

  it('Remove Ads entitlement disables interstitials entirely', () => {
    const { save, scheduler, ads } = setup();
    save.setRemoveAds(true);
    for (let i = 0; i < 10; i++) save.noteLevelCompletedForAds();
    expect(scheduler.isEligible()).toBe(false);
    expect(ads.isInterstitialAvailable()).toBe(false);
  });
});

describe('mock AdService', () => {
  it('is rewarded-available by default (voluntary mechanic)', async () => {
    const { ads } = setup();
    expect(ads.isRewardedAdAvailable()).toBe(true);
    const res = await ads.showRewardedAd();
    expect(res.rewarded).toBe(true);
  });

  it('never shows an interstitial unless the dev setting is on', async () => {
    const { ads, save } = setup();
    for (let i = 0; i < 10; i++) save.noteLevelCompletedForAds();
    expect(ads.scheduler.isEligible()).toBe(true);
    const result = await ads.showInterstitialIfEligible();
    expect(result.shown).toBe(false);
    expect(result.reason).toBe('skipped');
  });

  it('shows the mock interstitial only when dev-enabled with a presenter', async () => {
    const { ads, save } = setup();
    save.setSetting('mockAds', true);
    let presented = 0;
    ads.setPresenter({
      presentInterstitial: async () => {
        presented += 1;
      },
      presentRewarded: async () => true,
    });
    for (let i = 0; i < 10; i++) save.noteLevelCompletedForAds();
    const result = await ads.showInterstitialIfEligible();
    expect(result.shown).toBe(true);
    expect(presented).toBe(1);
    // cadence resets after a shown interstitial
    expect(save.snapshot.ads.levelsCompletedSinceInterstitial).toBe(0);
    expect(save.snapshot.ads.lastInterstitialAt).toBeGreaterThan(0);
  });

  it('does not fire when policy says no', async () => {
    const { ads, save } = setup();
    save.setSetting('mockAds', true);
    ads.setPresenter({
      presentInterstitial: async () => {
        throw new Error('should not be presented');
      },
      presentRewarded: async () => true,
    });
    save.noteLevelCompletedForAds();
    const result = await ads.showInterstitialIfEligible();
    expect(result.shown).toBe(false);
    expect(result.reason).toBe('not-eligible');
  });

  it('rewarded ad can be declined by the viewer', async () => {
    const { ads } = setup();
    ads.setPresenter({
      presentInterstitial: async () => {},
      presentRewarded: async () => false,
    });
    const res = await ads.showRewardedAd();
    expect(res.rewarded).toBe(false);
  });
});
