import type { LevelConfig } from '../../types';
import { GROUPS, makeLevel, schedule } from './common';

/**
 * Level 7 – Mixed speeds: fast cars catch slow trucks and stack up behind
 * them. Timing a green for the truck also releases the cars queued on it.
 */
export const level07: LevelConfig = makeLevel(
  7,
  'Mixed Speeds',
  'CARS CATCH TRUCKS',
  [GROUPS.ew, GROUPS.ns],
  schedule(1.3, 1.4, [
    { type: 'truck', dir: 'E' },
    { type: 'car', dir: 'E', gap: 1.5 },
    { type: 'car', dir: 'N', gap: 1.2 },
    { type: 'van', dir: 'N', gap: 1.4 },
    { type: 'car', dir: 'W', gap: 1.3 },
    { type: 'truck', dir: 'W', gap: 1.5 },
    { type: 'van', dir: 'S', gap: 1.3 },
    { type: 'car', dir: 'S', gap: 1.2 },
    { type: 'car', dir: 'E', gap: 1.4 },
    { type: 'truck', dir: 'N', gap: 1.6 },
    { type: 'car', dir: 'W', gap: 1.3 },
    { type: 'van', dir: 'S', gap: 1.4 },
  ]),
  { speedMul: 1.05, parTime: 30 },
);
