import type {
  DirectionId,
  FailReason,
  GamePhase,
  LevelConfig,
  LevelObjective,
  LightGroupDef,
  VehicleSpec,
  VehicleSnapshot,
  VehicleType,
  WorldSnapshot,
} from '../types';
import { SIM, VEHICLE } from '../config/game';
import { TrafficLightController } from './trafficLights';
import { isHorizontal, exitS, stopLineS, positionOf } from './geometry';
import { createVehicle, stepVehicle, type SimVehicle } from './vehicle';
import { findCollisionPair } from './collision';
import { PressureSystem, queueLengths } from './pressure';

/** Fixed physics timestep (seconds). */
const FIXED_DT = 1 / 60;

export interface CrashEvent {
  a: SimVehicle;
  b: SimVehicle;
  /** World-space impact point. */
  x: number;
  y: number;
}

/** Live state of the EMERGENCY objective (also exposed for HUD/analytics). */
export interface EmergencyState {
  /** Whether the ambulance has spawned yet. */
  active: boolean;
  /** Sim time the ambulance entered the world. */
  spawnedAt: number;
  /** Seconds allowed from spawn until the ambulance clears the junction. */
  timeLimit: number;
  /** Seconds left (clamped at 0). Equals timeLimit until the ambulance spawns. */
  remaining: number;
  /** Ambulance has fully cleared the intersection box. */
  crossed: boolean;
  /** Sim time when it crossed (for analytics). */
  crossedAt: number | null;
  /** Vehicle id of the tracked ambulance, once spawned. */
  vehicleId: number | null;
}

/**
 * Pure traffic simulation. No Phaser, no DOM – unit tested in Node and driven
 * by GameScene with fixed-clamped deltas.
 */
export class TrafficSim {
  phase: GamePhase = 'running';
  time = 0;
  /** Keeps the on-screen clock monotonic after a rewarded rewind. */
  private timeOffset = 0;
  vehicles: SimVehicle[] = [];
  lights: TrafficLightController;
  spawnedCount = 0;
  crash: CrashEvent | null = null;
  freezeTimer = 0;
  /** Longest any single vehicle has been stopped (perfect-flow metric). */
  maxStopTime = 0;
  clearedCount = 0;
  /** Why the level ended when phase is 'crash' or 'failed'. */
  failReason: FailReason | null = null;
  /** Traffic Pressure meter (disabled unless the level opts in). */
  pressure: PressureSystem;
  /** Longest queue seen this attempt (analytics / QUEUE_LIMIT HUD). */
  maxQueueSeen = 0;
  /** EMERGENCY objective tracking (null on other objectives). */
  emergency: EmergencyState | null = null;

  private nextId = 1;
  private snapshots: WorldSnapshot[] = [];
  private snapshotAcc = 0;
  private acc = 0;
  /** Spawn entries sorted by time – data may be authored in any order. */
  private spawnQueue: VehicleSpec[];

  constructor(readonly level: LevelConfig) {
    this.spawnQueue = [...level.spawn].sort((a, b) => a.at - b.at);
    this.lights = new TrafficLightController(
      level.groups,
      this.allDirections(),
      level.initialGreen,
    );
    this.pressure = new PressureSystem(level.pressure);
    this.reset();
  }

  get objective(): LevelObjective {
    return this.level.objective;
  }

  /** Seconds left for a SURVIVE objective (0 for other objectives). */
  get surviveRemaining(): number {
    const obj = this.level.objective;
    if (obj.type !== 'SURVIVE') return 0;
    return Math.max(0, obj.seconds - this.time);
  }

  /** Waiting vehicles per direction (only directions with a queue). */
  queueLengths(): Partial<Record<DirectionId, number>> {
    return queueLengths(this.vehicles);
  }

  /** Longest current queue over all lanes. */
  get longestQueue(): number {
    let m = 0;
    for (const n of Object.values(this.queueLengths())) m = Math.max(m, n ?? 0);
    return m;
  }

  /** The tracked ambulance, if it is currently in the world. */
  get ambulance(): SimVehicle | null {
    const id = this.emergency?.vehicleId;
    if (id == null) return null;
    return this.vehicles.find((v) => v.id === id) ?? null;
  }

  private allDirections(): DirectionId[] {
    const set = new Set(this.level.groups.flatMap((g) => g.directions));
    for (const v of this.level.spawn) set.add(v.dir);
    return Array.from(set);
  }

  get displayTime(): number {
    return this.time + this.timeOffset;
  }

  get remaining(): number {
    return this.vehicles.length + (this.level.spawn.length - this.spawnedCount);
  }

  /** Whether rewind history exists for a rewarded continue. */
  get hasHistory(): boolean {
    return this.snapshots.length > 0;
  }

  reset(): void {
    this.phase = 'running';
    this.time = 0;
    this.timeOffset = 0;
    this.vehicles = [];
    this.spawnedCount = 0;
    this.crash = null;
    this.freezeTimer = 0;
    this.maxStopTime = 0;
    this.clearedCount = 0;
    this.failReason = null;
    this.maxQueueSeen = 0;
    this.pressure.reset();
    this.emergency = this.initEmergency();
    this.nextId = 1;
    this.snapshots = [];
    this.snapshotAcc = 0;
    this.acc = 0;
    this.lights = new TrafficLightController(
      this.level.groups,
      this.allDirections(),
      this.level.initialGreen,
      0,
    );
    this.lights.setTime(0);
    this.lights.update();
  }

  private initEmergency(): EmergencyState | null {
    const obj = this.level.objective;
    if (obj.type !== 'EMERGENCY') return null;
    return {
      active: false,
      spawnedAt: 0,
      timeLimit: obj.timeLimit,
      remaining: obj.timeLimit,
      crossed: false,
      crossedAt: null,
      vehicleId: null,
    };
  }

  /** Tap a light group. Returns true when the controller state moved. */
  toggleGroup(group: LightGroupDef): boolean {
    if (this.phase !== 'running') return false;
    const clearance = this.computeClearance(group);
    return this.lights.toggle(group, clearance);
  }

  /**
   * All-red clearance interval: how long cross traffic must stay red so that
   * vehicles which cannot stop before the line can still clear the box safely.
   */
  private computeClearance(group: LightGroupDef): number {
    let worst = 0;
    for (const v of this.vehicles) {
      const conflicting = group.directions.some((g) => isHorizontal(g) !== isHorizontal(v.dir));
      if (!conflicting) continue;
      const d = v.stopS - v.s;
      const stoppingDistance = (v.v * v.v) / (2 * Math.max(1, v.spec.brake));
      const committed = d < 0 || (v.v > 2 && stoppingDistance > d + 1);
      if (!committed) continue;
      const sClear = v.stopS + this.level.layout.roadWidth + v.spec.length + 14;
      const distance = Math.max(0, sClear - v.s);
      const speed = Math.max(v.v, 35);
      worst = Math.max(worst, distance / speed);
    }
    return worst;
  }

  // --- spawning ------------------------------------------------------------
  private laneVehicles(dir: string): SimVehicle[] {
    return this.vehicles.filter((v) => v.dir === dir).sort((a, b) => a.s - b.s);
  }

  private trySpawn(): void {
    const queue = this.spawnQueue;
    while (this.spawnedCount < queue.length && queue[this.spawnedCount].at <= this.time) {
      const spec = queue[this.spawnedCount];
      const lane = this.laneVehicles(spec.dir);
      const closest = lane[0]; // smallest s = nearest the spawn point
      if (closest) {
        const leaderRear = closest.s - closest.spec.length / 2;
        const selfHalf = VEHICLE[spec.type].length / 2;
        if (leaderRear < selfHalf + 8) break; // lane blocked – defer spawn
      }
      const ev = createVehicle(
        this.nextId++,
        spec.type,
        spec.dir,
        this.time,
        stopLineS(spec.dir, this.level.layout, spec.type),
        exitS(spec.dir, this.level.layout, spec.type),
      );
      this.vehicles.push(ev);
      this.spawnedCount += 1;
      if (spec.type === 'ambulance' && this.emergency && !this.emergency.active) {
        this.emergency.active = true;
        this.emergency.spawnedAt = this.time;
        this.emergency.vehicleId = ev.id;
      }
    }
  }

  // --- main step -----------------------------------------------------------
  /**
   * Fixed-timestep update: real elapsed time is consumed in stable 1/60s
   * substeps so the simulation clock stays wall-accurate on slow frames
   * (throttled tabs, low-end phones) instead of running in slow motion.
   */
  update(rawDt: number): void {
    if (this.phase !== 'running') return;
    if (this.freezeTimer > 0) {
      this.freezeTimer = Math.max(0, this.freezeTimer - rawDt);
      return;
    }
    this.acc += Math.min(rawDt, 0.25);
    let steps = 0;
    while (this.acc >= FIXED_DT && steps < 12 && this.phase === 'running') {
      this.step(FIXED_DT);
      this.acc -= FIXED_DT;
      steps += 1;
    }
    if (steps >= 12) this.acc = 0; // dropped frames beyond the budget
  }

  private step(dt: number): void {
    {
      this.time += dt;
      this.lights.setTime(this.time);
      this.lights.update();

      this.trySpawn();

    // Per-lane car following, front vehicle first.
    const dirs = new Set(this.vehicles.map((v) => v.dir));
    for (const dir of dirs) {
      const lane = this.vehicles.filter((v) => v.dir === dir).sort((a, b) => b.s - a.s);
      let leader: SimVehicle | null = null;
      for (const v of lane) {
        let gap: number | null = null;
        if (leader) {
          gap = leader.s - leader.spec.length / 2 - (v.s + v.spec.length / 2);
        }
        stepVehicle(v, {
          dt,
          speedMul: this.level.speedMul,
          leaderGap: gap,
          lightGreen: this.lights.isGreen(v.dir),
        });
        leader = v;
        if (v.stopTime > this.maxStopTime) this.maxStopTime = v.stopTime;
      }
    }

    // Exits.
    let clearedThisStep = 0;
    if (this.vehicles.length > 0) {
      const survived = this.vehicles.filter((v) => {
        if (v.s >= v.exitS) {
          this.clearedCount += 1;
          clearedThisStep += 1;
          this.maxStopTime = Math.max(this.maxStopTime, v.stopTime);
          return false;
        }
        return true;
      });
      this.vehicles = survived;
    }

    // Traffic pressure + queue bookkeeping.
    this.pressure.step({ dt, vehicles: this.vehicles, clearedThisStep });
    const longest = this.longestQueue;
    if (longest > this.maxQueueSeen) this.maxQueueSeen = longest;
    this.updateEmergency();

    // Collisions.
    const pair = findCollisionPair(this.vehicles, this.level.layout);
    if (pair) {
      const [a, b] = pair;
      a.crashed = true;
      b.crashed = true;
      const pa = positionOf(a.dir, this.level.layout, a.s);
      const pb = positionOf(b.dir, this.level.layout, b.s);
      this.crash = { a, b, x: (pa.x + pb.x) / 2, y: (pa.y + pb.y) / 2 };
      // Arcade kick: lock the wrecked pair and recoil them slightly so the
      // slow-motion beat reads as an impact, not as vehicles driving on.
      a.v = 0;
      b.v = 0;
      a.s = Math.max(0, a.s - 9);
      b.s = Math.max(0, b.s - 9);
      this.phase = 'crash';
      this.failReason = 'crash';
      // Snapshot history is intentionally kept: the rewarded "continue" rewinds it.
      return;
    }

    // Objective rules (fail first, then win).
    const fail = this.evaluateFailure();
    if (fail) {
      this.failReason = fail;
      this.phase = 'failed';
      return;
    }
    if (this.evaluateWin()) {
      this.phase = 'complete';
      return;
    }

    // History for rewarded continue.
    this.snapshotAcc += dt;
    if (this.snapshotAcc >= SIM.snapshotInterval) {
      this.snapshotAcc = 0;
      this.snapshots.push(this.captureSnapshot());
      if (this.snapshots.length > SIM.snapshotHistory) this.snapshots.shift();
    }
    }
  }

  // --- objectives ----------------------------------------------------------
  private updateEmergency(): void {
    const em = this.emergency;
    if (!em || !em.active) return;
    if (!em.crossed) {
      em.remaining = Math.max(0, em.timeLimit - (this.time - em.spawnedAt));
      const amb = this.ambulance;
      if (amb) {
        // "Through" = rear bumper past the far side of the junction box.
        const clearS = amb.stopS + this.level.layout.roadWidth + amb.spec.length + 8;
        if (amb.s >= clearS) {
          em.crossed = true;
          em.crossedAt = this.time;
        }
      } else if (this.vehicles.every((v) => v.id !== em.vehicleId)) {
        // Exited the screen without passing the check (should not happen, but
        // never let a cleared ambulance count as a failure).
        em.crossed = true;
        em.crossedAt = this.time;
      }
    }
  }

  private get allTrafficCleared(): boolean {
    return this.spawnedCount >= this.level.spawn.length && this.vehicles.length === 0;
  }

  private evaluateFailure(): FailReason | null {
    const obj = this.level.objective;
    // Gridlock applies to every level that enables pressure.
    if (this.pressure.failed) return 'gridlock';
    switch (obj.type) {
      case 'PRESSURE_LIMIT':
        if (this.pressure.enabled && this.pressure.value >= obj.maxPressure - 1e-9) {
          return 'gridlock';
        }
        return null;
      case 'QUEUE_LIMIT':
        return this.longestQueue > obj.maxQueue ? 'queue_limit' : null;
      case 'EMERGENCY': {
        const em = this.emergency;
        if (em && em.active && !em.crossed && em.remaining <= 0) return 'emergency_timeout';
        return null;
      }
      default:
        return null;
    }
  }

  private evaluateWin(): boolean {
    const obj = this.level.objective;
    switch (obj.type) {
      case 'SURVIVE':
        return this.time >= obj.seconds || this.allTrafficCleared;
      case 'EMERGENCY':
        return this.allTrafficCleared && (this.emergency?.crossed ?? true);
      case 'CLEAR_TRAFFIC':
      case 'PRESSURE_LIMIT':
      case 'QUEUE_LIMIT':
      default:
        return this.allTrafficCleared;
    }
  }

  // --- debug / test hooks --------------------------------------------------
  /** Remove every vehicle (test tooling only). */
  debugClear(): void {
    this.vehicles = [];
  }

  /**
   * Place a vehicle at an exact travelled distance with an exact speed.
   * Test tooling only – never called by gameplay.
   */
  debugPlace(type: VehicleType, dir: DirectionId, s: number, v: number): SimVehicle {
    const ev = createVehicle(
      this.nextId++,
      type,
      dir,
      this.time,
      stopLineS(dir, this.level.layout, type),
      exitS(dir, this.level.layout, type),
    );
    ev.s = s;
    ev.v = v;
    this.vehicles.push(ev);
    return ev;
  }

  // --- snapshots -----------------------------------------------------------
  /**
   * Crash cinematic step: everything eases to a stop (heavy braking) while the
   * wrecked pair stays put. Driven by GameScene with a slowed delta.
   */
  stepCinematic(dt: number): void {
    const clamped = Math.min(dt, 1 / 30);
    for (const v of this.vehicles) {
      if (v.crashed) continue;
      v.v = Math.max(0, v.v - v.spec.brake * 1.4 * clamped);
      v.s += v.v * clamped;
    }
  }

  private captureSnapshot(): WorldSnapshot {
    return {
      t: this.time,
      vehicles: this.vehicles.map((v) => ({
        id: v.id,
        type: v.type,
        dir: v.dir,
        s: v.s,
        v: v.v,
      })),
      lights: this.lights.serialize(),
      spawnedCount: this.spawnedCount,
      pressure: this.pressure.value,
    };
  }

  /**
   * Rewarded-ad continue: rewind to shortly before the crash, freeze the world
   * for a beat so the player can re-orient, then resume. Returns false when no
   * usable history exists (caller may fall back to a plain restart).
   */
  restoreForContinue(): boolean {
    const targetT = this.time - SIM.rewindSeconds;
    let snap: WorldSnapshot | null = null;
    for (const s of this.snapshots) {
      if (s.t <= targetT) snap = s; // keep the latest one that is old enough
    }
    if (!snap && this.snapshots.length > 0) snap = this.snapshots[0];
    if (!snap) return false;

    this.phase = 'running';
    this.crash = null;
    this.failReason = null;
    this.timeOffset += Math.max(0, this.time - snap.t);
    this.time = snap.t;
    this.vehicles = snap.vehicles.map((vs) => {
      const ev = createVehicle(
        vs.id,
        vs.type,
        vs.dir,
        this.time - 1,
        stopLineS(vs.dir, this.level.layout, vs.type),
        exitS(vs.dir, this.level.layout, vs.type),
      );
      ev.s = vs.s;
      ev.v = vs.v;
      return ev;
    });
    this.spawnedCount = snap.spawnedCount;
    this.lights.restore(snap.lights);
    // Rewind pressure too, with a little extra relief so the continue is a
    // genuine second chance rather than an immediate re-fail.
    this.pressure.set(Math.max(0, (snap.pressure ?? 0) - 0.15));
    if (this.emergency) {
      const em = this.emergency;
      const stillHere = this.vehicles.some((v) => v.id === em.vehicleId);
      if (em.active && !em.crossed && !stillHere && em.spawnedAt > this.time) {
        // Ambulance had not spawned yet at the snapshot: re-arm the objective.
        em.active = false;
        em.vehicleId = null;
        em.remaining = em.timeLimit;
      }
    }
    this.snapshots = this.snapshots.filter((s) => s.t <= snap.t);
    this.snapshotAcc = 0;
    this.freezeTimer = SIM.continueFreezeSeconds;
    this.nextId = Math.max(this.nextId, ...this.vehicles.map((v) => v.id + 1), 1);
    return true;
  }

  /** Debug/test helper: world state as a plain object. */
  debugState() {
    return {
      phase: this.phase,
      failReason: this.failReason,
      objective: this.level.objective.type,
      pressure: Math.round(this.pressure.value * 100) / 100,
      queues: this.queueLengths(),
      emergency: this.emergency
        ? {
            active: this.emergency.active,
            crossed: this.emergency.crossed,
            remaining: Math.round(this.emergency.remaining * 10) / 10,
          }
        : null,
      time: this.displayTime,
      spawnedCount: this.spawnedCount,
      total: this.level.spawn.length,
      cleared: this.clearedCount,
      lights: this.lights.serialize(),
      pendingGroup: this.lights.pendingGroupId,
      vehicles: this.vehicles.map((v) => ({
        id: v.id,
        type: v.type,
        dir: v.dir,
        s: Math.round(v.s),
        v: Math.round(v.v),
        /** Distance of the front bumper to the stop line (negative = past). */
        d: Math.round(v.stopS - v.s),
        pos: positionOf(v.dir, this.level.layout, v.s),
      })),
    };
  }
}

export type { SimVehicle, VehicleSnapshot };
