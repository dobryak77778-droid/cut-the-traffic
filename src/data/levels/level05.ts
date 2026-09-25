import type { LevelConfig } from '../../types';
import { GROUPS, makeLevel, schedule } from './common';

/**
 * Level 5 – Trucks enter the mix. A truck needs a long, clean window to clear
 * the box: start greens early or it will still be inside when you switch.
 */
export const level05: LevelConfig = makeLevel(
  5,
  'Heavy Haulers',
  'TRUCKS NEED TIME',
  [GROUPS.ew, GROUPS.ns],
  schedule(1.3, 2.1, [
    { type: 'car', dir: 'E' },
    { type: 'truck', dir: 'W' },
    { type: 'car', dir: 'N' },
    { type: 'truck', dir: 'S' },
    { type: 'van', dir: 'E' },
    { type: 'car', dir: 'W' },
    { type: 'truck', dir: 'N' },
    { type: 'car', dir: 'S' },
    { type: 'car', dir: 'E' },
    { type: 'van', dir: 'W' },
  ]),
  { parTime: 29 },
);
