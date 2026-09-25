import type { LevelConfig } from '../../types';
import { GROUPS, makeLevel, schedule } from './common';

/**
 * Level 10 – Rush hour: every approach is its own group (four buttons) and the
 * streets are full. Combines split control, trucks, queues and short windows.
 */
export const level10: LevelConfig = makeLevel(
  10,
  'Rush Hour',
  'EVERY ROAD FOR ITSELF',
  [GROUPS.e, GROUPS.w, GROUPS.n, GROUPS.s],
  schedule(1.2, 1.4, [
    { type: 'car', dir: 'E' },
    { type: 'truck', dir: 'W' },
    { type: 'car', dir: 'N' },
    { type: 'van', dir: 'S' },
    { type: 'car', dir: 'E' },
    { type: 'car', dir: 'W' },
    { type: 'truck', dir: 'N' },
    { type: 'car', dir: 'S' },
    { type: 'van', dir: 'E' },
    { type: 'car', dir: 'N' },
    { type: 'truck', dir: 'S', gap: 1.8 },
    { type: 'car', dir: 'W' },
    { type: 'car', dir: 'E', gap: 1.1 },
    { type: 'van', dir: 'N' },
    { type: 'car', dir: 'S' },
    { type: 'truck', dir: 'W', gap: 1.8 },
  ]),
  { speedMul: 1.1, parTime: 38, initialGreen: ['e', 'w'] },
);
