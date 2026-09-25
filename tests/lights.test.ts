import { describe, expect, it } from 'vitest';
import { TrafficLightController, MIN_CLEARANCE } from '../src/sim/trafficLights';
import type { LightGroupDef } from '../src/types';

const ew: LightGroupDef = { id: 'ew', label: 'E–W', short: '↔', directions: ['E', 'W'], slot: 'bl' };
const ns: LightGroupDef = { id: 'ns', label: 'N–S', short: '↕', directions: ['N', 'S'], slot: 'br' };
const e: LightGroupDef = { id: 'e', label: 'East', short: '→', directions: ['E'], slot: 'bl' };
const w: LightGroupDef = { id: 'w', label: 'West', short: '←', directions: ['W'], slot: 'br' };

function make(groups: LightGroupDef[], initial?: string[]) {
  const dirs = groups.flatMap((g) => g.directions);
  return new TrafficLightController(groups, dirs, initial ?? [groups[0].id], 0);
}

describe('TrafficLightController', () => {
  it('starts with the initial group green and the rest red', () => {
    const c = make([ew, ns], ['ew']);
    expect(c.isGreen('E')).toBe(true);
    expect(c.isGreen('W')).toBe(true);
    expect(c.isGreen('N')).toBe(false);
    expect(c.isGreen('S')).toBe(false);
  });

  it('toggling a red group applies green after the clearance interval', () => {
    const c = make([ew, ns], ['ew']);
    c.setTime(1);
    c.toggle(ns, 0.5);
    // Perpendicular traffic drops to red immediately…
    expect(c.isGreen('E')).toBe(false);
    expect(c.isGreen('W')).toBe(false);
    // …but the requested green waits for clearance.
    expect(c.isGreen('N')).toBe(false);
    expect(c.isPending(ns)).toBe(true);
    c.setTime(1.4);
    c.update();
    expect(c.isGreen('N')).toBe(false); // not yet
    c.setTime(1.6);
    c.update();
    expect(c.isGreen('N')).toBe(true);
    expect(c.isGreen('S')).toBe(true);
    expect(c.justApplied).toBe(true);
  });

  it('zero clearance applies immediately (fast-path)', () => {
    const c = make([ew, ns], ['ew']);
    c.setTime(0);
    c.toggle(ns, MIN_CLEARANCE);
    expect(c.isGreen('N')).toBe(true);
    expect(c.isGreen('E')).toBe(false);
  });

  it('toggling a green group turns it red', () => {
    const c = make([ew, ns], ['ew']);
    c.setTime(0);
    c.toggle(ew, MIN_CLEARANCE);
    expect(c.isGreen('E')).toBe(false);
    expect(c.isGreen('W')).toBe(false);
    expect(c.isPending(ew)).toBe(false);
  });

  it('tapping a pending group cancels the request', () => {
    const c = make([ew, ns], ['ew']);
    c.setTime(0);
    c.toggle(ns, 2);
    expect(c.isPending(ns)).toBe(true);
    c.toggle(ns);
    expect(c.isPending(ns)).toBe(false);
    c.setTime(10);
    c.update();
    expect(c.isGreen('N')).toBe(false);
  });

  it('parallel groups do not disturb each other (split control)', () => {
    const c = make([e, w, ns], ['e', 'w']);
    expect(c.isGreen('E')).toBe(true);
    expect(c.isGreen('W')).toBe(true);
    c.setTime(0);
    c.toggle(ns, 0.1);
    c.setTime(1);
    c.update();
    expect(c.isGreen('N')).toBe(true);
    // Requesting E green while NS is green forces NS red, W untouched-but-red.
    c.toggle(e, 0.1);
    c.setTime(2);
    c.update();
    expect(c.isGreen('E')).toBe(true);
    expect(c.isGreen('N')).toBe(false);
    expect(c.isGreen('S')).toBe(false);
  });

  it('serialize/restore round-trips light state', () => {
    const c = make([ew, ns], ['ns']);
    const data = c.serialize();
    expect(data.E).toBe('red');
    expect(data.N).toBe('green');
    const c2 = make([ew, ns], ['ew']);
    c2.restore(data);
    expect(c2.isGreen('N')).toBe(true);
    expect(c2.isGreen('E')).toBe(false);
  });
});
