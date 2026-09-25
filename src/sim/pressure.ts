import type { DirectionId, PressureConfig } from '../types';
import { PRESSURE, WAITING_SPEED } from '../config/game';
import type { SimVehicle } from './vehicle';

/** Resolve a level's partial pressure config against the global defaults. */
export function resolvePressureConfig(partial?: Partial<PressureConfig>): PressureConfig {
  return { ...PRESSURE, ...(partial ?? {}) };
}

/** True when the vehicle is (essentially) stopped before its stop line. */
export function isWaiting(v: SimVehicle): boolean {
  return v.v < WAITING_SPEED && v.s <= v.stopS + 2;
}

/** Number of waiting vehicles per direction. Directions with none are omitted. */
export function queueLengths(vehicles: SimVehicle[]): Partial<Record<DirectionId, number>> {
  const out: Partial<Record<DirectionId, number>> = {};
  for (const v of vehicles) {
    if (!isWaiting(v)) continue;
    out[v.dir] = (out[v.dir] ?? 0) + 1;
  }
  return out;
}

export interface PressureStepInput {
  dt: number;
  vehicles: SimVehicle[];
  /** Vehicles that exited the screen during this step. */
  clearedThisStep: number;
}

/**
 * Traffic Pressure meter (0..1). Pure and deterministic – no Phaser.
 *
 *  - grows while vehicles wait beyond `graceSeconds`
 *  - grows faster when a single lane's queue exceeds `queueThreshold`
 *  - recovers while nothing waits beyond the grace, plus a relief per exit
 *  - `failed` flips once the value reaches `failAt`
 */
export class PressureSystem {
  readonly config: PressureConfig;
  value = 0;
  /** Highest value reached this attempt (analytics). */
  peak = 0;
  /** Growth (positive) or recovery (negative) rate from the last step. */
  lastRate = 0;

  constructor(config?: Partial<PressureConfig>) {
    this.config = resolvePressureConfig(config);
  }

  get enabled(): boolean {
    return this.config.enabled;
  }

  get failed(): boolean {
    return this.enabled && this.value >= this.config.failAt - 1e-9;
  }

  reset(): void {
    this.value = 0;
    this.peak = 0;
    this.lastRate = 0;
  }

  /** Force a value (tests / rewind restore). */
  set(value: number): void {
    this.value = clamp01(value);
    this.peak = Math.max(this.peak, this.value);
  }

  step(input: PressureStepInput): number {
    if (!this.enabled) return this.value;
    const c = this.config;
    const queues = queueLengths(input.vehicles);

    let growth = 0;
    for (const v of input.vehicles) {
      if (!isWaiting(v)) continue;
      if (v.waitTime <= c.graceSeconds) continue;
      const q = queues[v.dir] ?? 1;
      const boost = 1 + c.queueBoost * Math.max(0, q - c.queueThreshold);
      growth += c.waitRate * boost;
    }

    let rate: number;
    if (growth > 0) {
      rate = growth;
    } else {
      rate = -c.recoverRate;
    }
    let next = this.value + rate * input.dt;
    if (input.clearedThisStep > 0) next -= c.clearRelief * input.clearedThisStep;

    this.value = clamp01(next);
    this.peak = Math.max(this.peak, this.value);
    this.lastRate = rate;
    return this.value;
  }
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
