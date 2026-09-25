import { describe, expect, it } from 'vitest';
import { TrafficSim } from '../src/sim/trafficSim';
import { getLevel } from '../src/data/levels';
import type { LevelConfig, LightGroupDef } from '../src/types';
import { stopLineS, positionOf, exitS } from '../src/sim/geometry';
import { VEHICLE } from '../src/config/game';

/** Run the sim headlessly for `seconds` at 60 fps. */
function run(sim: TrafficSim, seconds: number, onStep?: (t: number) => void): void {
  const steps = Math.round(seconds * 60);
  for (let i = 0; i < steps; i++) {
    sim.update(1 / 60);
    onStep?.(i / 60);
    if (sim.phase !== 'running') break;
  }
}

function singleDirLevel(dir: 'E' | 'N', initialGreen: string[], groups?: LightGroupDef[]): LevelConfig {
  const base = getLevel(1);
  return {
    ...base,
    id: 901,
    groups: groups ?? [base.groups[0], base.groups[1]],
    initialGreen,
    spawn: [
      { type: 'car', dir, at: 0.5 },
      { type: 'car', dir, at: 2.2 },
    ],
    objective: { type: 'clear-all', totalVehicles: 2 },
  };
}

describe('vehicle physics', () => {
  it('stops before the stop line on red', () => {
    const level = singleDirLevel('E', ['ns']); // E starts red
    const sim = new TrafficSim(level);
    run(sim, 8);

    expect(sim.vehicles.length).toBeGreaterThanOrEqual(1);
    const v = sim.vehicles[0];
    expect(v.v).toBeLessThan(3);
    expect(v.s).toBeLessThanOrEqual(v.stopS);
    // Front bumper sits near the line, not miles away or through it.
    expect(v.stopS - v.s).toBeLessThan(20);
    const pos = positionOf(v.dir, level.layout, v.s);
    expect(pos.x).toBeLessThan(level.layout.centerX - level.layout.roadWidth / 2);
  });

  it('queues behind a leading vehicle with a safe gap', () => {
    const level = singleDirLevel('E', ['ns']); // both stay red → they queue
    const sim = new TrafficSim(level);
    run(sim, 10);
    expect(sim.vehicles.length).toBe(2);
    const [a, b] = [...sim.vehicles].sort((x, y) => x.s - y.s); // b ahead
    const gap = b.s - b.spec.length / 2 - (a.s + a.spec.length / 2);
    expect(gap).toBeGreaterThanOrEqual(0);
    expect(a.v).toBeLessThan(3);
    expect(b.v).toBeLessThan(3);
  });

  it('accelerates on green, clears the junction and exits the screen', () => {
    const level = singleDirLevel('E', ['ew']); // E starts green
    const sim = new TrafficSim(level);
    let maxSpeed = 0;
    run(sim, 14, () => {
      for (const v of sim.vehicles) maxSpeed = Math.max(maxSpeed, v.v);
    });
    expect(maxSpeed).toBeGreaterThan(80); // actually reached speed
    expect(sim.clearedCount).toBe(2);
    expect(sim.phase).toBe('complete');
  });

  it('does not spawn a vehicle on top of one already in the lane', () => {
    const base = getLevel(1);
    const level: LevelConfig = {
      ...base,
      id: 902,
      initialGreen: ['ns'], // red for E → lane fills up
      spawn: [
        { type: 'car', dir: 'E', at: 0.5 },
        { type: 'car', dir: 'E', at: 0.55 },
        { type: 'car', dir: 'E', at: 0.6 },
      ],
      objective: { type: 'clear-all', totalVehicles: 3 },
    };
    const sim = new TrafficSim(level);
    run(sim, 6);
    // All three spawn eventually (deferred), never overlapping.
    expect(sim.spawnedCount).toBe(3);
    expect(sim.vehicles.length).toBe(3);
    const sorted = [...sim.vehicles].sort((x, y) => x.s - y.s);
    for (let i = 1; i < sorted.length; i++) {
      const lead = sorted[i];
      const follow = sorted[i - 1];
      const gap = lead.s - lead.spec.length / 2 - (follow.s + follow.spec.length / 2);
      expect(gap).toBeGreaterThanOrEqual(-1);
    }
  });

  it('truck is slower and longer than a car', () => {
    expect(VEHICLE.truck.length).toBeGreaterThan(VEHICLE.car.length);
    expect(VEHICLE.truck.maxSpeed).toBeLessThan(VEHICLE.car.maxSpeed);
    expect(VEHICLE.truck.accel).toBeLessThan(VEHICLE.car.accel);
    expect(exitS('E', getLevel(1).layout, 'truck')).toBeGreaterThan(
      exitS('E', getLevel(1).layout, 'car'),
    );
    // Both types rest with their FRONT bumper at the same stop line, so the
    // truck's centre sits further back – it needs more road to clear the box.
    const layout = getLevel(1).layout;
    const carFront = stopLineS('E', layout, 'car') + VEHICLE.car.length / 2;
    const truckFront = stopLineS('E', layout, 'truck') + VEHICLE.truck.length / 2;
    expect(truckFront).toBeCloseTo(carFront, 5);
    expect(stopLineS('E', layout, 'truck')).toBeLessThan(stopLineS('E', layout, 'car'));
  });
});

describe('collision + win condition', () => {
  it('detects a cross collision and switches to the crash phase', () => {
    const base = getLevel(1);
    const level: LevelConfig = {
      ...base,
      id: 903,
      // Both axes spawn frequently; we force both green via the debug setter.
      spawn: [
        { type: 'car', dir: 'E', at: 1.75 },
        { type: 'car', dir: 'N', at: 0.6 },
      ],
      objective: { type: 'clear-all', totalVehicles: 2 },
    };
    const sim = new TrafficSim(level);
    // Ignore clearance rules – simulate a dangerous double-green.
    run(sim, 1.4);
    sim.lights.setGroupState(base.groups[0], 'green');
    sim.lights.setGroupState(base.groups[1], 'green');
    run(sim, 8);
    expect(sim.phase).toBe('crash');
    expect(sim.crash).not.toBeNull();
    expect(sim.crash!.a.crashed).toBe(true);
    expect(sim.crash!.b.crashed).toBe(true);
    expect(sim.hasHistory).toBe(true);
  });

  it('does not crash when lights are switched normally (clearance interval)', () => {
    const base = getLevel(1);
    const level: LevelConfig = {
      ...base,
      id: 904,
      spawn: [
        { type: 'car', dir: 'N', at: 0.6 },
        { type: 'car', dir: 'E', at: 3.0 },
      ],
      initialGreen: ['ns'],
      objective: { type: 'clear-all', totalVehicles: 2 },
    };
    const sim = new TrafficSim(level);
    // Player asks for EW green while the north car is mid-approach, then
    // switches back once the east car has cleared.
    let askedEw = false;
    let askedNs = false;
    run(sim, 14, (t) => {
      if (!askedEw && t > 1.2) {
        sim.toggleGroup(base.groups[0]); // ew
        askedEw = true;
      }
      if (askedEw && !askedNs && t > 6.0) {
        sim.toggleGroup(base.groups[1]); // ns
        askedNs = true;
      }
    });
    expect(askedEw).toBe(true);
    expect(askedNs).toBe(true);
    expect(sim.phase).toBe('complete');
    expect(sim.clearedCount).toBe(2);
  });

  it('completes a full stock level when one axis stays green', () => {
    const level: LevelConfig = { ...getLevel(3), id: 905 };
    const sim = new TrafficSim(level);
    run(sim, 60);
    // Not a crash; the sim eventually finishes or keeps running with no crash.
    expect(sim.phase).not.toBe('crash');
  });
});
