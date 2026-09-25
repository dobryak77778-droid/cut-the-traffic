import type { LevelConfig } from '../../types';
import { GROUPS, atSlot, makeLevel, schedule } from './common';

/**
 * Level 8 – Split control: the east and west approaches become independently
 * controlled groups (three buttons total). You can hold one horizontal
 * direction while the other waits – but every tap costs attention.
 */
export const level08: LevelConfig = makeLevel(
  8,
  'Split Control',
  'EAST ≠ WEST',
  [GROUPS.e, GROUPS.w, atSlot(GROUPS.ns, 'tr')],
  schedule(1.3, 1.7, [
    { type: 'car', dir: 'E' },
    { type: 'car', dir: 'W' },
    { type: 'car', dir: 'N' },
    { type: 'van', dir: 'S' },
    { type: 'car', dir: 'E' },
    { type: 'car', dir: 'W' },
    { type: 'van', dir: 'N' },
    { type: 'car', dir: 'S' },
    { type: 'car', dir: 'E', gap: 1.1 },
    { type: 'car', dir: 'W', gap: 1.2 },
    { type: 'van', dir: 'N' },
    { type: 'car', dir: 'S' },
    { type: 'car', dir: 'E' },
    { type: 'car', dir: 'W' },
  ]),
  { parTime: 31, initialGreen: ['e', 'w'] },
);
