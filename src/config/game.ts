/**
 * Central gameplay tuning. Everything designers tweak often lives here.
 */

export const DESIGN_WIDTH = 540;
export const DESIGN_HEIGHT = 960;

export const VEHICLE = {
  car: {
    length: 46,
    width: 25,
    maxSpeed: 165,
    accel: 150,
    brake: 300,
    gap: 10,
  },
  van: {
    length: 58,
    width: 27,
    maxSpeed: 145,
    accel: 115,
    brake: 250,
    gap: 11,
  },
  truck: {
    length: 88,
    width: 30,
    maxSpeed: 118,
    accel: 70,
    brake: 195,
    gap: 13,
  },
} as const;

export const SIM = {
  /** Extra bumper gap kept when following another vehicle. */
  followMargin: 8,
  /** Forgiveness (px) before two boxes count as overlapping. */
  collisionShrink: 4,
  /** Seconds a vehicle must be stopped before it counts for "perfect flow" analysis. */
  perfectStopTolerance: 0.4,
  /** Snapshot cadence for the rewarded-ad continue. */
  snapshotInterval: 0.2,
  snapshotHistory: 20,
  /** Rewarded continue rewinds this many seconds, then freezes the world briefly. */
  rewindSeconds: 2.0,
  continueFreezeSeconds: 1.1,
  /** Max seconds a spawn may be deferred when the lane is blocked. */
  spawnMaxDefer: 2.0,
} as const;

/** Camera / cinematic tuning for the crash moment. */
export const CRASH = {
  slowmoScale: 0.28,
  slowmoDurationMs: 650,
  zoom: 1.22,
  shakeIntensity: 0.012,
  shakeDurationMs: 450,
  panelDelayMs: 620,
} as const;
