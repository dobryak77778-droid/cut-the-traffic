import type { LevelConfig } from '../../types';
import { GROUPS, makeLevel, schedule } from './common';

/** Level 2 – More cars, tighter rhythm, still only two controls. */
export const level02: LevelConfig = makeLevel(
  2,
  'Picking Up',
  'WATCH BOTH WAYS',
  [GROUPS.ew, GROUPS.ns],
  schedule(1.4, 2.1, [
    { type: 'car', dir: 'E' },
    { type: 'car', dir: 'W' },
    { type: 'car', dir: 'N' },
    { type: 'car', dir: 'S' },
    { type: 'car', dir: 'E' },
    { type: 'car', dir: 'W' },
    { type: 'car', dir: 'N' },
    { type: 'car', dir: 'S' },
    { type: 'car', dir: 'E' },
  ]),
  { parTime: 23 },
);
