import type { LevelConfig } from '../../types';
import { GROUPS, makeLevel, schedule } from './common';

/** Level 4 – Vans: slower to accelerate, a bit longer, need earlier greens. */
export const level04: LevelConfig = makeLevel(
  4,
  'Deliveries',
  'VANS ARE SLOW',
  [GROUPS.ew, GROUPS.ns],
  schedule(1.3, 2.0, [
    { type: 'car', dir: 'E' },
    { type: 'van', dir: 'N' },
    { type: 'car', dir: 'W' },
    { type: 'van', dir: 'S' },
    { type: 'van', dir: 'E' },
    { type: 'car', dir: 'N' },
    { type: 'car', dir: 'W' },
    { type: 'van', dir: 'S' },
    { type: 'car', dir: 'E' },
    { type: 'van', dir: 'N' },
  ]),
  { parTime: 26 },
);
