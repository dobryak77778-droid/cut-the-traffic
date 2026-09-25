/**
 * Shared domain types for Cut the Traffic.
 * Keep this file free of Phaser imports so simulation + data stay testable in Node.
 */

export type DirectionId = 'E' | 'W' | 'N' | 'S';

export type VehicleType = 'car' | 'van' | 'truck';

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
  objective: { type: 'clear-all'; totalVehicles: number };
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
}

export type GamePhase = 'running' | 'crash' | 'complete';
