import type { LevelConfig } from '../../types';
import { level01 } from './level01';
import { level02 } from './level02';
import { level03 } from './level03';
import { level04 } from './level04';
import { level05 } from './level05';
import { level06 } from './level06';
import { level07 } from './level07';
import { level08 } from './level08';
import { level09 } from './level09';
import { level10 } from './level10';

/**
 * Level registry. Adding a level:
 *  1. create src/data/levels/levelNN.ts exporting a LevelConfig
 *  2. import and append it here
 * Nothing else changes – the sim, UI and progression read from this list.
 */
export const LEVELS: LevelConfig[] = [
  level01,
  level02,
  level03,
  level04,
  level05,
  level06,
  level07,
  level08,
  level09,
  level10,
];

export function getLevel(id: number): LevelConfig {
  const level = LEVELS.find((l) => l.id === id);
  if (!level) throw new Error(`Unknown level: ${id}`);
  return level;
}

export function nextLevelId(id: number): number | null {
  const idx = LEVELS.findIndex((l) => l.id === id);
  if (idx < 0 || idx + 1 >= LEVELS.length) return null;
  return LEVELS[idx + 1].id;
}
