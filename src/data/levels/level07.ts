import type { LevelConfig } from '../../types';
import { GROUPS, makeLevel, schedule } from './common';

/**
 * Level 7 – Mixed speeds: fast cars catch slow trucks and stack up behind
 * them. Gameplay V2: EMERGENCY – an ambulance arrives from the west mid-level
 * behind a truck and must clear the junction within 14 seconds of appearing.
 * It obeys every rule (red lights, queuing, collisions) – the player has to
 * make room for it.
 */
export const level07: LevelConfig = makeLevel(
  7,
  'Mixed Speeds',
  'MAKE WAY',
  [GROUPS.ew, GROUPS.ns],
  schedule(1.3, 1.4, [
    { type: 'truck', dir: 'E' },
    { type: 'car', dir: 'E', gap: 1.5 },
    { type: 'car', dir: 'N', gap: 1.2 },
    { type: 'van', dir: 'N', gap: 1.4 },
    { type: 'car', dir: 'W', gap: 1.3 },
    { type: 'truck', dir: 'W', gap: 1.5 },
    { type: 'van', dir: 'S', gap: 1.3 },
    { type: 'ambulance', dir: 'W', gap: 1.2 },
    { type: 'car', dir: 'S', gap: 1.2 },
    { type: 'car', dir: 'E', gap: 1.4 },
    { type: 'truck', dir: 'N', gap: 1.6 },
    { type: 'car', dir: 'W', gap: 1.3 },
    { type: 'van', dir: 'S', gap: 1.4 },
  ]),
  {
    speedMul: 1.05,
    parTime: 32,
    objective: { type: 'EMERGENCY', timeLimit: 14 },
    pressure: { enabled: true },
  },
);
