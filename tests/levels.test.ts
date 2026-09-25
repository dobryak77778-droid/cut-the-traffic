import { describe, expect, it } from 'vitest';
import { LEVELS, getLevel, nextLevelId } from '../src/data/levels';
import type { DirectionId } from '../src/types';

const ALL_DIRS: DirectionId[] = ['E', 'W', 'N', 'S'];

describe('level data', () => {
  it('exposes exactly 10 levels with unique sequential ids', () => {
    expect(LEVELS.length).toBe(10);
    expect(LEVELS.map((l) => l.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it('getLevel resolves every level and throws on unknown ids', () => {
    for (const l of LEVELS) expect(getLevel(l.id)).toBe(l);
    expect(() => getLevel(99)).toThrow();
  });

  it('nextLevelId walks the chain and ends at null', () => {
    expect(nextLevelId(1)).toBe(2);
    expect(nextLevelId(9)).toBe(10);
    expect(nextLevelId(10)).toBeNull();
    expect(nextLevelId(42)).toBeNull();
  });

  it('every level has a valid spawn schedule', () => {
    for (const level of LEVELS) {
      expect(level.spawn.length).toBeGreaterThan(0);
      expect(level.spawn.length).toBe(level.objective.totalVehicles);
      let last = -1;
      for (const s of level.spawn) {
        expect(s.at).toBeGreaterThan(0);
        expect(s.at).toBeGreaterThanOrEqual(last); // sorted, non-decreasing
        last = s.at;
        expect(['car', 'van', 'truck']).toContain(s.type);
        expect(ALL_DIRS).toContain(s.dir);
      }
    }
  });

  it('every spawn direction is covered by a controllable light group', () => {
    for (const level of LEVELS) {
      const covered = new Set(level.groups.flatMap((g) => g.directions));
      for (const s of level.spawn) expect(covered.has(s.dir)).toBe(true);
    }
  });

  it('group slots are unique per level and groups have unique ids', () => {
    for (const level of LEVELS) {
      const slots = new Set(level.groups.map((g) => g.slot));
      const ids = new Set(level.groups.map((g) => g.id));
      expect(slots.size).toBe(level.groups.length);
      expect(ids.size).toBe(level.groups.length);
      expect(level.groups.length).toBeGreaterThanOrEqual(2);
      expect(level.groups.length).toBeLessThanOrEqual(4);
    }
  });

  it('initialGreen references existing groups', () => {
    for (const level of LEVELS) {
      if (!level.initialGreen) continue;
      const ids = level.groups.map((g) => g.id);
      for (const g of level.initialGreen) expect(ids).toContain(g);
    }
  });

  it('difficulty progression grows traffic and adds mechanics', () => {
    const counts = LEVELS.map((l) => l.spawn.length);
    expect(counts[0]).toBeLessThanOrEqual(6); // level 1 stays gentle
    expect(counts[9]).toBeGreaterThan(counts[0]);
    // vans arrive by level 4, trucks by level 5
    const typesUpTo = (n: number) =>
      new Set(LEVELS.slice(0, n).flatMap((l) => l.spawn.map((s) => s.type)));
    expect(typesUpTo(3).has('van')).toBe(false);
    expect(typesUpTo(4).has('van')).toBe(true);
    expect(typesUpTo(4).has('truck')).toBe(false);
    expect(typesUpTo(5).has('truck')).toBe(true);
    // control groups split on later levels
    expect(LEVELS[7].groups.length).toBeGreaterThanOrEqual(3);
    expect(LEVELS[9].groups.length).toBe(4);
  });

  it('every level defines par time, hint and layout', () => {
    for (const level of LEVELS) {
      expect(level.parTime).toBeGreaterThanOrEqual(15);
      expect(level.parTime).toBeLessThanOrEqual(45);
      expect(level.hint.length).toBeGreaterThan(0);
      expect(level.layout.roadWidth).toBeGreaterThan(0);
      expect(level.speedMul).toBeGreaterThan(0);
    }
  });
});
