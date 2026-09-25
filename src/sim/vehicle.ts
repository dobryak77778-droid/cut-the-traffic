import type { DirectionId, VehicleType, WorldSnapshot } from '../types';
import { SIM, VEHICLE } from '../config/game';

export interface VehicleSpecStatic {
  length: number;
  width: number;
  maxSpeed: number;
  accel: number;
  brake: number;
  gap: number;
}

export interface SimVehicle {
  id: number;
  type: VehicleType;
  dir: DirectionId;
  /** Distance travelled along the lane (centre of the vehicle, px). */
  s: number;
  /** Current speed, px/s. */
  v: number;
  /** Stop-line distance for this lane/vehicle (constant). */
  stopS: number;
  /** Exit distance for this lane/vehicle (constant). */
  exitS: number;
  spec: VehicleSpecStatic;
  /** Sim time when the vehicle entered the world. */
  spawnTime: number;
  /** Cumulative seconds spent essentially stopped (for perfect-flow). */
  stopTime: number;
  /** Seconds of the *current* stop (resets when the vehicle moves again). */
  waitTime: number;
  /** Set on the frame a crash involves this vehicle. */
  crashed: boolean;
}

export function createVehicle(
  id: number,
  type: VehicleType,
  dir: DirectionId,
  spawnTime: number,
  stopS: number,
  exitS: number,
): SimVehicle {
  const spec = VEHICLE[type];
  return {
    id,
    type,
    dir,
    s: 0,
    v: 0,
    stopS,
    exitS,
    spec,
    spawnTime,
    stopTime: 0,
    waitTime: 0,
    crashed: false,
  };
}

export interface StepContext {
  dt: number;
  speedMul: number;
  /** Bumper-to-bumper gap to the vehicle ahead, or null when leader is far. */
  leaderGap: number | null;
  /** Whether the vehicle may pass its stop line right now. */
  lightGreen: boolean;
}

/**
 * Advance one vehicle by dt seconds.
 *
 * Speed target = min(desired speed, follow cap, stop-line cap) with smooth
 * acceleration and bounded braking. sqrt(2·b·d) gives a natural ease-out as a
 * vehicle approaches a stop point.
 */
export function stepVehicle(ev: SimVehicle, ctx: StepContext): void {
  const { dt, speedMul } = ctx;
  const desired = ev.spec.maxSpeed * speedMul;
  let cap = desired;

  // Car following.
  if (ctx.leaderGap !== null) {
    const safe = ev.spec.gap + SIM.followMargin;
    const gap = ctx.leaderGap;
    const followCap = gap <= safe ? 0 : Math.sqrt(2 * ev.spec.brake * (gap - safe));
    cap = Math.min(cap, followCap);
  }

  // Stop line (only while still approaching it – past it, clear the box).
  // A small hard-stop band (`d <= HARD`) prevents the classic discrete-integration
  // overshoot where a car creeps 2px past the line and then accelerates through
  // a red. Vehicles genuinely deep past the line keep going to clear the box.
  const HARD = 1.5;
  if (!ctx.lightGreen) {
    const d = ev.stopS - ev.s;
    if (d > -2) {
      const lightCap = d <= HARD ? 0 : Math.sqrt(2 * ev.spec.brake * Math.max(0, d - HARD));
      cap = Math.min(cap, lightCap);
    }
  }

  let next: number;
  if (ev.v < cap) {
    next = Math.min(cap, ev.v + ev.spec.accel * dt);
  } else {
    next = Math.max(cap, ev.v - ev.spec.brake * dt);
  }
  ev.v = Math.max(0, next);
  ev.s += ev.v * dt;

  if (ev.v < 5) {
    ev.stopTime += dt;
    ev.waitTime += dt;
  } else {
    ev.waitTime = 0;
  }
}

export interface CollisionInfo {
  a: SimVehicle;
  b: SimVehicle;
}

export type { WorldSnapshot };
