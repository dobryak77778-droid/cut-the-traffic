import type {
  DirectionId,
  LevelConfig,
  LevelLayout,
  LevelObjective,
  LightGroupDef,
  PressureConfig,
  VehicleSpec,
  VehicleType,
} from '../../types';

/** Shared intersection geometry for the MVP level set. */
export const LAYOUT: LevelLayout = {
  width: 540,
  height: 960,
  roadWidth: 168,
  laneOffset: 42,
  centerX: 270,
  centerY: 430,
};

/**
 * Reusable light-group presets. Levels compose their controls from these,
 * so adding a new control scheme is pure data.
 */
export const GROUPS: Record<string, LightGroupDef> = {
  ew: { id: 'ew', label: 'E–W', short: '↔', directions: ['E', 'W'], slot: 'bl' },
  ns: { id: 'ns', label: 'N–S', short: '↕', directions: ['N', 'S'], slot: 'br' },
  e: { id: 'e', label: 'East', short: '→', directions: ['E'], slot: 'bl' },
  w: { id: 'w', label: 'West', short: '←', directions: ['W'], slot: 'br' },
  n: { id: 'n', label: 'North', short: '↑', directions: ['N'], slot: 'tl' },
  s: { id: 's', label: 'South', short: '↓', directions: ['S'], slot: 'tr' },
};

/** Re-seat a group preset on a different button slot for a specific level. */
export function atSlot(group: LightGroupDef, slot: LightGroupDef['slot']): LightGroupDef {
  return { ...group, slot };
}

export interface SpawnItem {
  type: VehicleType;
  dir: DirectionId;
  /** Seconds since the previous vehicle; first vehicle uses `start`. */
  gap?: number;
}

/**
 * Build an explicit spawn schedule from a compact list.
 * The resulting `at` values are plain data – gameplay never re-derives them.
 */
export function schedule(start: number, defaultGap: number, items: SpawnItem[]): VehicleSpec[] {
  let t = start;
  return items.map((item, i) => {
    if (i > 0) t += item.gap ?? defaultGap;
    return { type: item.type, dir: item.dir, at: Math.round(t * 1000) / 1000 };
  });
}

export function makeLevel(
  id: number,
  name: string,
  hint: string,
  groups: LightGroupDef[],
  spawn: VehicleSpec[],
  opts: {
    speedMul?: number;
    parTime: number;
    initialGreen?: string[];
    /**
     * Objective without `totalVehicles` – it is always derived from the spawn
     * list. Defaults to CLEAR_TRAFFIC.
     */
    objective?: DistributiveOmit<LevelObjective, 'totalVehicles'>;
    /** Enables the Traffic Pressure meter (with optional tuning overrides). */
    pressure?: Partial<PressureConfig>;
  },
): LevelConfig {
  const objective = {
    ...(opts.objective ?? { type: 'CLEAR_TRAFFIC' }),
    totalVehicles: spawn.length,
  } as LevelObjective;
  return {
    id,
    name,
    hint,
    layout: LAYOUT,
    groups,
    spawn,
    speedMul: opts.speedMul ?? 1,
    parTime: opts.parTime,
    objective,
    initialGreen: opts.initialGreen,
    pressure: opts.pressure,
  };
}

type DistributiveOmit<T, K extends keyof T> = T extends unknown ? Omit<T, K> : never;
