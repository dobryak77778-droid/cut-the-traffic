import type { LevelConfig } from '../../types';
import { GROUPS, makeLevel, schedule } from './common';

/**
 * Level 6 – Close quarters: bursts of vehicles in the same lane force real
 * queuing. A tight group arrives together and leaves together.
 */
export const level06: LevelConfig = makeLevel(
  6,
  'Close Quarters',
  'QUEUES FORM',
  [GROUPS.ew, GROUPS.ns],
  schedule(1.3, 2.6, [
    { type: 'car', dir: 'E' },
    { type: 'car', dir: 'E', gap: 0.9 },
    { type: 'car', dir: 'N', gap: 1.5 },
    { type: 'car', dir: 'W', gap: 1.1 },
    { type: 'car', dir: 'W', gap: 0.9 },
    { type: 'car', dir: 'S', gap: 1.6 },
    { type: 'van', dir: 'E', gap: 1.2 },
    { type: 'car', dir: 'E', gap: 0.85 },
    { type: 'car', dir: 'N', gap: 1.4 },
    { type: 'van', dir: 'W', gap: 1.2 },
    { type: 'car', dir: 'S', gap: 1.3 },
    { type: 'car', dir: 'E', gap: 0.9 },
    { type: 'car', dir: 'N', gap: 1.4 },
  ]),
  { parTime: 30 },
);
