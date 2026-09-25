/**
 * Single source of truth for monetization behaviour.
 * Nothing in gameplay may hardcode ad frequency – it all reads from here.
 */
export interface MonetizationConfig {
  /** Show a mock/real interstitial after every N *completed* levels. */
  interstitialEveryNLevels: number;
  /** Hard floor between two interstitials, milliseconds. */
  minIntervalMs: number;
  /** Never show on the very first completion of a session. */
  warmupCompletionsBeforeFirst: number;
  /** Mock provider: show a fake ad UI at all (dev-only convenience). */
  mockAdsEnabledByDefault: boolean;
  /** Rewarded continue availability. */
  rewardedAlwaysAvailableInMock: boolean;
  /** Mock interstitial / rewarded duration in ms (mock provider only). */
  mockInterstitialDurationMs: number;
  mockRewardedDurationMs: number;
}

export const MONETIZATION: MonetizationConfig = {
  interstitialEveryNLevels: 3,
  minIntervalMs: 60_000,
  warmupCompletionsBeforeFirst: 1,
  mockAdsEnabledByDefault: false,
  rewardedAlwaysAvailableInMock: true,
  mockInterstitialDurationMs: 2500,
  mockRewardedDurationMs: 2200,
};

/**
 * Future "Remove Ads" entitlement. When the real IAP lands this flag is set by
 * the store integration; interstitials stop, rewarded ads stay available.
 */
export interface AdsEntitlements {
  removeAds: boolean;
}

export function interstitialsAllowed(entitlements: AdsEntitlements): boolean {
  return !entitlements.removeAds;
}
