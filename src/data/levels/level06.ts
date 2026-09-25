import type { LevelConfig } from '../../types';
import { GROUPS, makeLevel, schedule } from './common';

/**
 * Level 6 – Close quarters: bursts of vehicles in the same lane force real
 * queuing. Gameplay V2: SURVIVE – traffic keeps arriving for the whole
 * objective window; the player wins by keeping pressure off the ceiling for
 * 35 seconds rather than by emptying the screen.
 */
export const level06: LevelConfig = makeLevel(
  6,
  'Close Quarters',
  'KEEP IT MOVING',
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
    // Second wave is denser and keeps the junction busy until the timer ends.
    { type: 'car', dir: 'W', gap: 1.1 },
    { type: 'car', dir: 'S', gap: 0.8 },
    { type: 'van', dir: 'N', gap: 0.9 },
    { type: 'car', dir: 'E', gap: 0.8 },
    { type: 'car', dir: 'W', gap: 0.7 },
    { type: 'car', dir: 'S', gap: 1.0 },
    { type: 'car', dir: 'N', gap: 0.8 },
    { type: 'van', dir: 'E', gap: 0.9 },
    { type: 'car', dir: 'W', gap: 0.8 },
    { type: 'car', dir: 'S', gap: 0.9 },
    { type: 'car', dir: 'E', gap: 0.8 },
    { type: 'car', dir: 'N', gap: 0.9 },
    { type: 'car', dir: 'W', gap: 0.8 },
    { type: 'car', dir: 'S', gap: 0.9 },
    { type: 'car', dir: 'E', gap: 0.8 },
    { type: 'car', dir: 'N', gap: 1.0 },
  ]),
  {
    parTime: 35,
    objective: { type: 'SURVIVE', seconds: 35 },
    pressure: { enabled: true },
  },
);
