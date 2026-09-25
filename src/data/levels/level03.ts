import type { LevelConfig } from '../../types';
import { GROUPS, makeLevel, schedule } from './common';

/** Level 3 – All four approaches feed the junction. */
export const level03: LevelConfig = makeLevel(
  3,
  'Four Ways',
  'ALL FOUR ROADS',
  [GROUPS.ew, GROUPS.ns],
  schedule(1.3, 2.0, [
    { type: 'car', dir: 'E' },
    { type: 'car', dir: 'N' },
    { type: 'car', dir: 'W' },
    { type: 'car', dir: 'S' },
    { type: 'car', dir: 'E' },
    { type: 'car', dir: 'N' },
    { type: 'car', dir: 'W' },
    { type: 'car', dir: 'S' },
    { type: 'car', dir: 'E' },
    { type: 'car', dir: 'N' },
  ]),
  { parTime: 25 },
);
