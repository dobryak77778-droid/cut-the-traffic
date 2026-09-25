/**
 * Analytics abstraction. MVP ships a console implementation; a real SDK can be
 * dropped in later by implementing AnalyticsService and registering it.
 */

export type AnalyticsEvent =
  | 'game_started'
  | 'level_started'
  | 'level_completed'
  | 'level_failed'
  | 'level_restarted'
  | 'perfect_flow'
  | 'rewarded_offer_shown'
  | 'rewarded_offer_accepted'
  | 'rewarded_completed'
  | 'interstitial_eligible'
  | 'interstitial_shown'
  | 'level_select_opened'
  | 'settings_opened'
  // Gameplay V2
  | 'pressure_high'
  | 'pressure_peak'
  | 'gridlock_failure'
  | 'queue_limit_failure'
  | 'ambulance_spawned'
  | 'ambulance_success'
  | 'ambulance_failure'
  | 'objective_completed'
  | 'objective_failed';

export type AnalyticsPayload = Record<string, string | number | boolean | undefined>;

export interface AnalyticsService {
  track(event: AnalyticsEvent, payload?: AnalyticsPayload): void;
}

export class ConsoleAnalytics implements AnalyticsService {
  constructor(private readonly enabled: boolean = true) {}

  track(event: AnalyticsEvent, payload: AnalyticsPayload = {}): void {
    if (!this.enabled) return;
    // eslint-disable-next-line no-console
    console.info(`[analytics] ${event}`, payload);
  }
}

export class NullAnalytics implements AnalyticsService {
  track(): void {
    /* no-op */
  }
}

let instance: AnalyticsService = new ConsoleAnalytics(import.meta.env?.DEV !== false);

export function getAnalytics(): AnalyticsService {
  return instance;
}

export function setAnalytics(service: AnalyticsService): void {
  instance = service;
}
