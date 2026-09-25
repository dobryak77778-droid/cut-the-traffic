import type { LevelConfig } from '../../types';
import { GROUPS, makeLevel, schedule } from './common';

/**
 * Level 1 – First Crossing
 * Two crossing directions, very low traffic. The player only needs to tap the
 * red ↔ control once to let the first northbound car through. Nothing is fast.
 */
export const level01: LevelConfig = makeLevel(
  1,
  'First Crossing',
  'TAP THE LIGHTS',
  [GROUPS.ew, GROUPS.ns],
  schedule(1.6, 2.7, [
    { type: 'car', dir: 'E' },
    { type: 'car', dir: 'W' },
    { type: 'car', dir: 'N' },
    { type: 'car', dir: 'E' },
    { type: 'car', dir: 'S' },
    { type: 'car', dir: 'W' },
  ]),
  { parTime: 20 },
);
