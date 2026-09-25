import type { LevelConfig } from '../../types';
import { GROUPS, makeLevel, schedule } from './common';

/**
 * Level 9 – Heavy traffic with trucks and short safe windows. Long vehicles
 * dominate the box; the clearance interval works against quick switching.
 */
export const level09: LevelConfig = makeLevel(
  9,
  'Short Windows',
  'TRUCKS FILL THE GAP',
  [GROUPS.ew, GROUPS.ns],
  schedule(1.2, 1.35, [
    { type: 'car', dir: 'E' },
    { type: 'car', dir: 'N' },
    { type: 'truck', dir: 'W' },
    { type: 'car', dir: 'S' },
    { type: 'van', dir: 'E' },
    { type: 'car', dir: 'N' },
    { type: 'truck', dir: 'S' },
    { type: 'car', dir: 'W' },
    { type: 'van', dir: 'N' },
    { type: 'car', dir: 'E' },
    { type: 'truck', dir: 'E', gap: 1.7 },
    { type: 'car', dir: 'S' },
    { type: 'van', dir: 'W' },
    { type: 'car', dir: 'N' },
  ]),
  { speedMul: 1.05, parTime: 34 },
);
