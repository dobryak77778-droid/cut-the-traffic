import { describe, expect, it } from 'vitest';
import { TrafficSim } from '../src/sim/trafficSim';
import { PressureSystem, queueLengths, resolvePressureConfig } from '../src/sim/pressure';
import { createVehicle } from '../src/sim/vehicle';
import { getLevel } from '../src/data/levels';
import { exitS, stopLineS } from '../src/sim/geometry';
import { PRESSURE, VEHICLE } from '../src/config/game';
import type { LevelConfig, LevelObjective, PressureConfig, VehicleSpec } from '../src/types';
import {
  failTitle,
  objectiveCardLabel,
  objectiveSubtitle,
  objectiveTitle,
} from '../src/sim/objectives';

/** Run the sim headlessly for `seconds` at 60 fps. */
function run(sim: TrafficSim, seconds: number, onStep?: (t: number) => void): void {
  const steps = Math.round(seconds * 60);
  for (let i = 0; i < steps; i++) {
    sim.update(1 / 60);
    onStep?.(i / 60);
    if (sim.phase !== 'running') break;
  }
}

function makeLevel(
  spawn: VehicleSpec[],
  objective: LevelObjective,
  opts: { initialGreen?: string[]; pressure?: Partial<PressureConfig> } = {},
): LevelConfig {
  const base = getLevel(1);
  return {
    ...base,
    id: 950,
    groups: [base.groups[0], base.groups[1]],
    initialGreen: opts.initialGreen ?? ['ns'],
    spawn,
    objective,
    pressure: opts.pressure,
  };
}

/** A waiting car parked at its stop line (used to drive the pressure model). */
function parkedCar(id: number, dir: 'E' | 'W' | 'N' | 'S', waitTime: number) {
  const layout = getLevel(1).layout;
  const v = createVehicle(id, 'car', dir, 0, stopLineS(dir, layout, 'car'), exitS(dir, layout, 'car'));
  v.s = v.stopS;
  v.v = 0;
  v.waitTime = waitTime;
  v.stopTime = waitTime;
  return v;
}

// --------------------------------------------------------------------------
describe('PressureSystem (pure model)', () => {
  it('is disabled by default and never moves when disabled', () => {
    const p = new PressureSystem();
    expect(p.enabled).toBe(false);
    p.step({ dt: 5, vehicles: [parkedCar(1, 'E', 60)], clearedThisStep: 0 });
    expect(p.value).toBe(0);
    expect(p.failed).toBe(false);
  });

  it('merges level overrides with the global defaults', () => {
    const c = resolvePressureConfig({ enabled: true, waitRate: 0.5 });
    expect(c.enabled).toBe(true);
    expect(c.waitRate).toBe(0.5);
    expect(c.recoverRate).toBe(PRESSURE.recoverRate);
  });

  it('does not grow during the grace period', () => {
    const p = new PressureSystem({ enabled: true });
    const car = parkedCar(1, 'E', 0);
    for (let i = 0; i < 60; i++) {
      car.waitTime += 1 / 60; // 1 s total, well inside graceSeconds
      p.step({ dt: 1 / 60, vehicles: [car], clearedThisStep: 0 });
    }
    expect(p.value).toBe(0);
  });

  it('increases when a vehicle waits beyond the grace period', () => {
    const p = new PressureSystem({ enabled: true });
    p.step({ dt: 1, vehicles: [parkedCar(1, 'E', 10)], clearedThisStep: 0 });
    expect(p.value).toBeCloseTo(PRESSURE.waitRate, 6);
    expect(p.lastRate).toBeGreaterThan(0);
  });

  it('increases faster when a single lane queue exceeds the threshold', () => {
    const one = new PressureSystem({ enabled: true });
    one.step({ dt: 1, vehicles: [parkedCar(1, 'E', 10)], clearedThisStep: 0 });

    const spread = new PressureSystem({ enabled: true });
    spread.step({
      dt: 1,
      vehicles: [parkedCar(1, 'E', 10), parkedCar(2, 'N', 10)],
      clearedThisStep: 0,
    });
    // Two waiting cars in different lanes: exactly twice one car.
    expect(spread.value).toBeCloseTo(one.value * 2, 6);

    const queued = new PressureSystem({ enabled: true });
    queued.step({
      dt: 1,
      vehicles: [parkedCar(1, 'E', 10), parkedCar(2, 'E', 10), parkedCar(3, 'E', 10), parkedCar(4, 'E', 10)],
      clearedThisStep: 0,
    });
    // Four in one lane is more than four times one car (queue boost applies).
    expect(queued.value).toBeGreaterThan(one.value * 4);
  });

  it('decreases while traffic flows and on each cleared vehicle', () => {
    const p = new PressureSystem({ enabled: true });
    p.set(0.5);
    p.step({ dt: 1, vehicles: [], clearedThisStep: 0 });
    expect(p.value).toBeCloseTo(0.5 - PRESSURE.recoverRate, 6);
    expect(p.lastRate).toBeLessThan(0);
    const before = p.value;
    p.step({ dt: 0, vehicles: [], clearedThisStep: 2 });
    expect(p.value).toBeCloseTo(before - 2 * PRESSURE.clearRelief, 6);
  });

  it('clamps to [0,1], tracks the peak and fails at failAt', () => {
    const p = new PressureSystem({ enabled: true, failAt: 0.8 });
    p.step({ dt: 100, vehicles: [], clearedThisStep: 0 });
    expect(p.value).toBe(0);
    p.step({ dt: 1000, vehicles: [parkedCar(1, 'E', 10)], clearedThisStep: 0 });
    expect(p.value).toBe(1);
    expect(p.peak).toBe(1);
    expect(p.failed).toBe(true);
    p.reset();
    expect(p.value).toBe(0);
    expect(p.peak).toBe(0);
    expect(p.failed).toBe(false);
  });

  it('queueLengths counts only vehicles stopped before their stop line', () => {
    const moving = parkedCar(9, 'E', 0);
    moving.v = 100;
    const past = parkedCar(10, 'E', 0);
    past.s = past.stopS + 50;
    const q = queueLengths([parkedCar(1, 'E', 1), parkedCar(2, 'E', 1), parkedCar(3, 'N', 1), moving, past]);
    expect(q.E).toBe(2);
    expect(q.N).toBe(1);
    expect(q.W).toBeUndefined();
  });
});

// --------------------------------------------------------------------------
describe('TrafficSim – pressure integration', () => {
  it('stays at zero and never fails on levels without pressure', () => {
    const sim = new TrafficSim(getLevel(1));
    expect(sim.pressure.enabled).toBe(false);
    run(sim, 30);
    expect(sim.pressure.value).toBe(0);
    expect(sim.phase).not.toBe('failed');
  });

  it('builds pressure when a red light holds a queue and recovers once it flows', () => {
    const level = makeLevel(
      [
        { type: 'car', dir: 'E', at: 0.3 },
        { type: 'car', dir: 'E', at: 1.0 },
        { type: 'car', dir: 'E', at: 1.7 },
      ],
      { type: 'CLEAR_TRAFFIC', totalVehicles: 3 },
      { initialGreen: ['ns'], pressure: { enabled: true } },
    );
    const sim = new TrafficSim(level);
    run(sim, 14);
    expect(sim.phase).toBe('running');
    const built = sim.pressure.value;
    expect(built).toBeGreaterThan(0.05);
    expect(sim.pressure.peak).toBeGreaterThanOrEqual(built);

    sim.toggleGroup(level.groups[0]); // ew green
    run(sim, 4);
    expect(sim.pressure.value).toBeLessThan(built);
  });

  it('fails the level with a gridlock when pressure reaches the maximum', () => {
    const level = makeLevel(
      [
        { type: 'car', dir: 'E', at: 0.3 },
        { type: 'car', dir: 'E', at: 0.9 },
        { type: 'car', dir: 'E', at: 1.5 },
        { type: 'car', dir: 'W', at: 0.5 },
        { type: 'car', dir: 'W', at: 1.1 },
      ],
      { type: 'CLEAR_TRAFFIC', totalVehicles: 5 },
      { initialGreen: ['ns'], pressure: { enabled: true } },
    );
    const sim = new TrafficSim(level);
    run(sim, 90);
    expect(sim.phase).toBe('failed');
    expect(sim.failReason).toBe('gridlock');
    expect(sim.pressure.value).toBe(1);
    expect(sim.debugState().failReason).toBe('gridlock');
  });

  it('gives a fair amount of time before a gridlock (not a surprise fail)', () => {
    const level = makeLevel(
      [
        { type: 'car', dir: 'E', at: 0.3 },
        { type: 'car', dir: 'N', at: 0.3 },
      ],
      { type: 'CLEAR_TRAFFIC', totalVehicles: 2 },
      { initialGreen: [], pressure: { enabled: true } },
    );
    // Both lights red – one car waiting in each lane.
    const sim = new TrafficSim(level);
    sim.lights.setGroupState(level.groups[0], 'red');
    sim.lights.setGroupState(level.groups[1], 'red');
    run(sim, 15);
    expect(sim.phase).toBe('running');
    expect(sim.pressure.value).toBeLessThan(0.6);
  });

  it('rewinds pressure on a rewarded continue with extra relief', () => {
    const level = makeLevel(
      [
        { type: 'car', dir: 'E', at: 0.3 },
        { type: 'car', dir: 'E', at: 0.9 },
        { type: 'car', dir: 'E', at: 1.5 },
        { type: 'car', dir: 'W', at: 0.5 },
        { type: 'car', dir: 'W', at: 1.1 },
      ],
      { type: 'CLEAR_TRAFFIC', totalVehicles: 5 },
      { initialGreen: ['ns'], pressure: { enabled: true } },
    );
    const sim = new TrafficSim(level);
    run(sim, 90);
    expect(sim.phase).toBe('failed');
    expect(sim.restoreForContinue()).toBe(true);
    expect(sim.phase).toBe('running');
    expect(sim.failReason).toBeNull();
    expect(sim.pressure.value).toBeLessThan(0.9);
    expect(sim.pressure.value).toBeGreaterThan(0);
  });
});

// --------------------------------------------------------------------------
describe('QUEUE_LIMIT objective', () => {
  const spawn: VehicleSpec[] = [
    { type: 'car', dir: 'E', at: 0.3 },
    { type: 'car', dir: 'E', at: 0.8 },
    { type: 'car', dir: 'E', at: 1.3 },
    { type: 'car', dir: 'E', at: 1.8 },
  ];

  it('fails as soon as a lane holds more waiting vehicles than allowed', () => {
    const level = makeLevel(spawn, { type: 'QUEUE_LIMIT', totalVehicles: 4, maxQueue: 2 }, {
      initialGreen: ['ns'],
    });
    const sim = new TrafficSim(level);
    run(sim, 20);
    expect(sim.phase).toBe('failed');
    expect(sim.failReason).toBe('queue_limit');
    expect(sim.maxQueueSeen).toBe(3);
    expect(sim.queueLengths().E).toBe(3);
  });

  it('does not fail while the queue stays within the limit', () => {
    const level = makeLevel(spawn, { type: 'QUEUE_LIMIT', totalVehicles: 4, maxQueue: 4 }, {
      initialGreen: ['ns'],
    });
    const sim = new TrafficSim(level);
    run(sim, 20);
    expect(sim.phase).toBe('running');
    expect(sim.longestQueue).toBeLessThanOrEqual(4);
  });

  it('completes normally when the traffic is cleared', () => {
    const level = makeLevel(spawn, { type: 'QUEUE_LIMIT', totalVehicles: 4, maxQueue: 2 }, {
      initialGreen: ['ew'],
    });
    const sim = new TrafficSim(level);
    run(sim, 20);
    expect(sim.phase).toBe('complete');
    expect(sim.clearedCount).toBe(4);
  });
});

// --------------------------------------------------------------------------
describe('SURVIVE objective', () => {
  it('completes once the survive window has elapsed even with traffic on screen', () => {
    const level = makeLevel(
      [
        { type: 'car', dir: 'E', at: 0.5 },
        { type: 'car', dir: 'N', at: 1.0 },
        { type: 'car', dir: 'E', at: 6.0 },
        { type: 'car', dir: 'N', at: 7.0 },
      ],
      { type: 'SURVIVE', totalVehicles: 4, seconds: 8 },
      { initialGreen: ['ew'], pressure: { enabled: true } },
    );
    const sim = new TrafficSim(level);
    expect(sim.surviveRemaining).toBe(8);
    run(sim, 20);
    expect(sim.phase).toBe('complete');
    expect(sim.time).toBeGreaterThanOrEqual(8);
    expect(sim.time).toBeLessThan(8.1);
    expect(sim.surviveRemaining).toBe(0);
  });

  it('fails with a gridlock if pressure maxes out before the timer ends', () => {
    const level = makeLevel(
      [
        { type: 'car', dir: 'E', at: 0.3 },
        { type: 'car', dir: 'E', at: 0.9 },
        { type: 'car', dir: 'E', at: 1.5 },
        { type: 'car', dir: 'W', at: 0.5 },
        { type: 'car', dir: 'W', at: 1.1 },
      ],
      { type: 'SURVIVE', totalVehicles: 5, seconds: 120 },
      { initialGreen: ['ns'], pressure: { enabled: true } },
    );
    const sim = new TrafficSim(level);
    run(sim, 119);
    expect(sim.phase).toBe('failed');
    expect(sim.failReason).toBe('gridlock');
  });

  it('level 6 survives when the player alternates the lights sensibly', () => {
    const level = getLevel(6);
    const sim = new TrafficSim(level);
    let next = 4;
    run(sim, 60, (t) => {
      if (t >= next) {
        const ew = level.groups[0];
        const ns = level.groups[1];
        const ewGreen = sim.lights.groupState(ew) === 'green';
        sim.toggleGroup(ewGreen ? ns : ew);
        next = t + 4;
      }
    });
    expect(sim.phase).toBe('complete');
  });
});

// --------------------------------------------------------------------------
describe('PRESSURE_LIMIT objective', () => {
  it('fails once pressure reaches the configured threshold (below the global max)', () => {
    const level = makeLevel(
      [
        { type: 'car', dir: 'E', at: 0.3 },
        { type: 'car', dir: 'E', at: 0.9 },
        { type: 'car', dir: 'E', at: 1.5 },
      ],
      { type: 'PRESSURE_LIMIT', totalVehicles: 3, maxPressure: 0.3 },
      { initialGreen: ['ns'], pressure: { enabled: true } },
    );
    const sim = new TrafficSim(level);
    run(sim, 90);
    expect(sim.phase).toBe('failed');
    expect(sim.failReason).toBe('gridlock');
    expect(sim.pressure.value).toBeGreaterThanOrEqual(0.3 - 1e-6);
    expect(sim.pressure.value).toBeLessThan(0.35);
  });

  it('completes when traffic clears below the threshold', () => {
    const level = makeLevel(
      [{ type: 'car', dir: 'E', at: 0.3 }],
      { type: 'PRESSURE_LIMIT', totalVehicles: 1, maxPressure: 0.5 },
      { initialGreen: ['ew'], pressure: { enabled: true } },
    );
    const sim = new TrafficSim(level);
    run(sim, 12);
    expect(sim.phase).toBe('complete');
    expect(sim.pressure.peak).toBe(0);
  });
});

// --------------------------------------------------------------------------
describe('Ambulance behaviour', () => {
  it('has a vehicle spec and uses the same stop-line geometry as other vehicles', () => {
    expect(VEHICLE.ambulance.maxSpeed).toBeGreaterThan(VEHICLE.car.maxSpeed);
    const layout = getLevel(1).layout;
    const carFront = stopLineS('E', layout, 'car') + VEHICLE.car.length / 2;
    const ambFront = stopLineS('E', layout, 'ambulance') + VEHICLE.ambulance.length / 2;
    expect(ambFront).toBeCloseTo(carFront, 5);
  });

  it('stops at a red light like everyone else', () => {
    const level = makeLevel(
      [{ type: 'ambulance', dir: 'E', at: 0.3 }],
      { type: 'EMERGENCY', totalVehicles: 1, timeLimit: 60 },
      { initialGreen: ['ns'] },
    );
    const sim = new TrafficSim(level);
    run(sim, 8);
    const amb = sim.ambulance!;
    expect(amb).not.toBeNull();
    expect(amb.type).toBe('ambulance');
    expect(amb.v).toBeLessThan(3);
    expect(amb.s).toBeLessThanOrEqual(amb.stopS);
    expect(amb.stopS - amb.s).toBeLessThan(20);
    expect(sim.emergency?.crossed).toBe(false);
  });

  it('queues behind a slower vehicle with a safe gap and never overtakes', () => {
    const level = makeLevel(
      [
        { type: 'truck', dir: 'E', at: 0.3 },
        { type: 'ambulance', dir: 'E', at: 1.2 },
      ],
      { type: 'EMERGENCY', totalVehicles: 2, timeLimit: 60 },
      { initialGreen: ['ew'] },
    );
    const sim = new TrafficSim(level);
    let minGap = Infinity;
    run(sim, 12, () => {
      const truck = sim.vehicles.find((v) => v.type === 'truck');
      const amb = sim.vehicles.find((v) => v.type === 'ambulance');
      if (truck && amb) {
        const gap = truck.s - truck.spec.length / 2 - (amb.s + amb.spec.length / 2);
        minGap = Math.min(minGap, gap);
      }
    });
    expect(minGap).toBeGreaterThanOrEqual(0);
    expect(minGap).toBeLessThan(60); // it did actually catch up and follow
  });

  it('collides normally when crossing traffic is let through', () => {
    const level = makeLevel(
      [
        { type: 'ambulance', dir: 'E', at: 1.6 },
        { type: 'car', dir: 'N', at: 0.6 },
      ],
      { type: 'EMERGENCY', totalVehicles: 2, timeLimit: 60 },
      { initialGreen: ['ns'] },
    );
    const sim = new TrafficSim(level);
    run(sim, 1.4);
    sim.lights.setGroupState(level.groups[0], 'green');
    sim.lights.setGroupState(level.groups[1], 'green');
    run(sim, 8);
    expect(sim.phase).toBe('crash');
    expect(sim.failReason).toBe('crash');
    const types = [sim.crash!.a.type, sim.crash!.b.type];
    expect(types).toContain('ambulance');
  });

  it('never teleports: position advances continuously and speed stays bounded', () => {
    const level = makeLevel(
      [{ type: 'ambulance', dir: 'E', at: 0.3 }],
      { type: 'EMERGENCY', totalVehicles: 1, timeLimit: 60 },
      { initialGreen: ['ew'] },
    );
    const sim = new TrafficSim(level);
    let lastS = -1;
    let maxJump = 0;
    let maxV = 0;
    run(sim, 10, () => {
      const amb = sim.ambulance;
      if (!amb) return;
      if (lastS >= 0) maxJump = Math.max(maxJump, amb.s - lastS);
      lastS = amb.s;
      maxV = Math.max(maxV, amb.v);
    });
    expect(maxV).toBeLessThanOrEqual(VEHICLE.ambulance.maxSpeed * level.speedMul + 1e-6);
    expect(maxJump).toBeLessThanOrEqual((VEHICLE.ambulance.maxSpeed * level.speedMul) / 60 + 0.5);
  });
});

// --------------------------------------------------------------------------
describe('EMERGENCY objective', () => {
  it('tracks the countdown from the ambulance spawn, not from level start', () => {
    const level = makeLevel(
      [
        { type: 'car', dir: 'E', at: 0.3 },
        { type: 'ambulance', dir: 'E', at: 5 },
      ],
      { type: 'EMERGENCY', totalVehicles: 2, timeLimit: 10 },
      { initialGreen: ['ns'] },
    );
    const sim = new TrafficSim(level);
    run(sim, 4);
    expect(sim.emergency?.active).toBe(false);
    expect(sim.emergency?.remaining).toBe(10);
    run(sim, 3);
    expect(sim.emergency?.active).toBe(true);
    expect(sim.emergency?.remaining).toBeCloseTo(8, 0);
  });

  it('fails with emergency_timeout when the ambulance is held too long', () => {
    const level = makeLevel(
      [{ type: 'ambulance', dir: 'E', at: 0.3 }],
      { type: 'EMERGENCY', totalVehicles: 1, timeLimit: 6 },
      { initialGreen: ['ns'] },
    );
    const sim = new TrafficSim(level);
    run(sim, 20);
    expect(sim.phase).toBe('failed');
    expect(sim.failReason).toBe('emergency_timeout');
    expect(sim.time).toBeGreaterThanOrEqual(6.3);
    expect(sim.time).toBeLessThan(6.5);
    expect(sim.emergency?.crossed).toBe(false);
  });

  it('marks the ambulance as through once it clears the junction and then completes', () => {
    const level = makeLevel(
      [{ type: 'ambulance', dir: 'E', at: 0.3 }],
      { type: 'EMERGENCY', totalVehicles: 1, timeLimit: 10 },
      { initialGreen: ['ew'] },
    );
    const sim = new TrafficSim(level);
    let crossedAt: number | null = null;
    run(sim, 15, (t) => {
      if (crossedAt === null && sim.emergency?.crossed) crossedAt = t;
    });
    expect(sim.phase).toBe('complete');
    expect(sim.emergency?.crossed).toBe(true);
    expect(sim.emergency?.crossedAt).not.toBeNull();
    expect(crossedAt).not.toBeNull();
    expect(crossedAt!).toBeLessThan(10);
  });

  it('a late green still succeeds when the ambulance gets through in time', () => {
    const level = makeLevel(
      [{ type: 'ambulance', dir: 'E', at: 0.3 }],
      { type: 'EMERGENCY', totalVehicles: 1, timeLimit: 10 },
      { initialGreen: ['ns'] },
    );
    const sim = new TrafficSim(level);
    run(sim, 4);
    expect(sim.ambulance!.v).toBeLessThan(3); // waiting at the red
    sim.toggleGroup(level.groups[0]);
    run(sim, 12);
    expect(sim.phase).toBe('complete');
    expect(sim.emergency?.crossed).toBe(true);
  });

  it('level 7 is completable with a simple alternating policy that prioritises the ambulance', () => {
    const level = getLevel(7);
    const sim = new TrafficSim(level);
    const ew = level.groups[0];
    const ns = level.groups[1];
    let next = 4;
    run(sim, 90, (t) => {
      const em = sim.emergency!;
      const amb = sim.ambulance;
      if (em.active && !em.crossed && amb) {
        // Make way: request the ambulance's axis if it isn't green already.
        if (!sim.lights.isGreen(amb.dir) && !sim.lights.isPending(ew)) sim.toggleGroup(ew);
        next = t + 3;
        return;
      }
      if (t >= next) {
        sim.toggleGroup(sim.lights.groupState(ew) === 'green' ? ns : ew);
        next = t + 4;
      }
    });
    expect(sim.phase).toBe('complete');
    expect(sim.emergency?.crossed).toBe(true);
  });
});

// --------------------------------------------------------------------------
describe('objective UX strings', () => {
  it('produces the required headlines', () => {
    expect(objectiveTitle({ type: 'CLEAR_TRAFFIC', totalVehicles: 5 })).toBe('CLEAR ALL TRAFFIC');
    expect(objectiveTitle({ type: 'PRESSURE_LIMIT', totalVehicles: 5, maxPressure: 0.8 })).toBe(
      'KEEP PRESSURE BELOW 80%',
    );
    expect(objectiveTitle({ type: 'SURVIVE', totalVehicles: 5, seconds: 35 })).toBe(
      'SURVIVE 35 SECONDS',
    );
    expect(objectiveTitle({ type: 'EMERGENCY', totalVehicles: 5, timeLimit: 14 })).toBe(
      'GET THE AMBULANCE THROUGH',
    );
    expect(objectiveTitle({ type: 'QUEUE_LIMIT', totalVehicles: 5, maxQueue: 3 })).toContain('3');
  });

  it('has a subtitle, card label and fail title for every case', () => {
    const objs: LevelObjective[] = [
      { type: 'CLEAR_TRAFFIC', totalVehicles: 1 },
      { type: 'SURVIVE', totalVehicles: 1, seconds: 10 },
      { type: 'PRESSURE_LIMIT', totalVehicles: 1, maxPressure: 0.5 },
      { type: 'EMERGENCY', totalVehicles: 1, timeLimit: 10 },
      { type: 'QUEUE_LIMIT', totalVehicles: 1, maxQueue: 2 },
    ];
    for (const o of objs) {
      expect(objectiveSubtitle(o).length).toBeGreaterThan(0);
      expect(objectiveCardLabel(o).length).toBeGreaterThan(0);
    }
    for (const r of ['crash', 'gridlock', 'queue_limit', 'emergency_timeout'] as const) {
      expect(failTitle(r).length).toBeGreaterThan(0);
    }
  });
});
