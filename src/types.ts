/**
 * Shared domain types for Cut the Traffic.
 * Keep this file free of Phaser imports so simulation + data stay testable in Node.
 */

export type DirectionId = 'E' | 'W' | 'N' | 'S';

export type VehicleType = 'car' | 'van' | 'truck' | 'ambulance';

/** Objective kinds supported by the data-driven level system (Gameplay V2). */
export type ObjectiveType =
  | 'CLEAR_TRAFFIC'
  | 'SURVIVE'
  | 'PRESSURE_LIMIT'
  | 'EMERGENCY'
  | 'QUEUE_LIMIT';

/**
 * Level objective descriptor. `totalVehicles` is always present so HUD,
 * level cards and validation tests can treat every level the same way.
 */
export type LevelObjective =
  | { type: 'CLEAR_TRAFFIC'; totalVehicles: number }
  | { type: 'SURVIVE'; totalVehicles: number; seconds: number }
  | { type: 'PRESSURE_LIMIT'; totalVehicles: number; maxPressure: number }
  | { type: 'EMERGENCY'; totalVehicles: number; timeLimit: number }
  | { type: 'QUEUE_LIMIT'; totalVehicles: number; maxQueue: number };

/** Why a level ended without a win. */
export type FailReason = 'crash' | 'gridlock' | 'queue_limit' | 'emergency_timeout';

/** Tuning for the Traffic Pressure meter. See src/config/game.ts for defaults. */
export interface PressureConfig {
  /** Whether pressure is tracked (and shown) at all on this level. */
  enabled: boolean;
  /** Seconds a vehicle may sit at a red before it starts adding pressure. */
  graceSeconds: number;
  /** Pressure (0..1) added per second per vehicle waiting beyond the grace. */
  waitRate: number;
  /** Queue length (waiting vehicles in one lane) above which growth accelerates. */
  queueThreshold: number;
  /** Extra growth multiplier per waiting vehicle above `queueThreshold`. */
  queueBoost: number;
  /** Pressure recovered per second while no vehicle waits beyond the grace. */
  recoverRate: number;
  /** Instant relief per vehicle that exits the screen. */
  clearRelief: number;
  /** Pressure level that fails the level with a gridlock (1 = 100%). */
  failAt: number;
}

export type LightState = 'red' | 'green';

/** A traffic-light group: one tap target controlling one or more directions. */
export interface LightGroupDef {
  id: string;
  label: string;
  /** Short label shown on the round control button. */
  short: string;
  directions: DirectionId[];
  /** Corner slot for the touch button: bottom-left / bottom-right / top-left / top-right. */
  slot: 'bl' | 'br' | 'tl' | 'tr';
}

export interface VehicleSpec {
  type: VehicleType;
  dir: DirectionId;
  /** Seconds after level start. */
  at: number;
}

export interface LevelLayout {
  /** World units (px) for the design resolution. */
  width: number;
  height: number;
  /** Road cross width (two lanes). */
  roadWidth: number;
  /** Perpendicular distance of a lane centre from the road centre. */
  laneOffset: number;
  /** Intersection centre. */
  centerX: number;
  centerY: number;
}

export interface LevelConfig {
  id: number;
  name: string;
  /** Free-form hint shown briefly on the level card / HUD (1-2 short words). */
  hint: string;
  layout: LevelLayout;
  /** Traffic-light groups the player can tap. */
  groups: LightGroupDef[];
  /** Explicit spawn schedule sorted by time. */
  spawn: VehicleSpec[];
  /** Global speed multiplier for this level. */
  speedMul: number;
  /** Par time (seconds) used for the performance grade. */
  parTime: number;
  /** Objective descriptor – data-driven so future goals can be added. */
  objective: LevelObjective;
  /** Optional Traffic Pressure overrides; omitted = pressure disabled. */
  pressure?: Partial<PressureConfig>;
  /** Group ids that start green (defaults to the first group). */
  initialGreen?: string[];
}

export interface VehicleSnapshot {
  id: number;
  type: VehicleType;
  dir: DirectionId;
  /** Distance travelled along the lane (centre of vehicle). */
  s: number;
  v: number;
}

export interface WorldSnapshot {
  /** Sim time in seconds when the snapshot was taken. */
  t: number;
  vehicles: VehicleSnapshot[];
  /** direction -> light state */
  lights: Record<DirectionId, LightState>;
  /** How many spawn entries were consumed. */
  spawnedCount: number;
  /** Traffic pressure (0..1) at snapshot time. */
  pressure?: number;
}

export type GamePhase = 'running' | 'crash' | 'complete' | 'failed';
