import type { LevelConfig } from '../../types';
import { GROUPS, makeLevel, schedule } from './common';

/**
 * Level 2 – More cars, tighter rhythm, still only two controls.
 * Gameplay V2: gently introduces the Traffic Pressure meter. Rates are softer
 * than the defaults so a beginner sees the meter move without being punished.
 */
export const level02: LevelConfig = makeLevel(
  2,
  'Picking Up',
  'WATCH THE PRESSURE',
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
  {
    parTime: 23,
    objective: { type: 'CLEAR_TRAFFIC' },
    pressure: {
      enabled: true,
      graceSeconds: 3,
      waitRate: 0.02,
      recoverRate: 0.08,
      clearRelief: 0.03,
    },
  },
);
