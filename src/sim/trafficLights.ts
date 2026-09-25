import type { DirectionId, LightGroupDef, LightState } from '../types';
import { isHorizontal } from './geometry';

/** Minimum all-red beat so a switch always reads visually (seconds). */
export const MIN_CLEARANCE = 0.08;
/** Safety cap on clearance waits (seconds). */
export const MAX_CLEARANCE = 2.8;

/**
 * Traffic-light controller with a real-world "all-red clearance" interval.
 *
 * Tapping a group:
 *  - red  → the group is scheduled to turn green; every conflicting
 *           (perpendicular) direction turns red immediately, and the green is
 *           applied once `clearance` seconds have passed. The sim computes
 *           clearance from vehicles that cannot stop before the line, so a
 *           committed car always finishes crossing before cross traffic moves.
 *  - green → the group turns red immediately.
 *  - pending → tapping again cancels the request.
 *
 * Parallel, non-conflicting directions are untouched, which lets later levels
 * run per-approach groups.
 */
export class TrafficLightController {
  private states = new Map<DirectionId, LightState>();
  private pendingGroup: LightGroupDef | null = null;
  private pendingAt = 0;
  /** Set for one frame when a pending green is applied (audio/feedback hook). */
  justApplied = false;

  constructor(
    readonly groups: LightGroupDef[],
    private readonly directions: DirectionId[],
    initialGreen?: string | string[],
    private now: number = 0,
  ) {
    for (const d of directions) this.states.set(d, 'red');
    const ids = Array.isArray(initialGreen)
      ? initialGreen
      : initialGreen
        ? [initialGreen]
        : [this.groups[0]?.id ?? ''];
    for (const gid of ids) {
      const g = this.groups.find((x) => x.id === gid);
      if (g) for (const d of g.directions) this.states.set(d, 'green');
    }
  }

  setTime(t: number): void {
    this.now = t;
  }

  stateOf(dir: DirectionId): LightState {
    return this.states.get(dir) ?? 'red';
  }

  isGreen(dir: DirectionId): boolean {
    return this.stateOf(dir) === 'green';
  }

  get pendingGroupId(): string | null {
    return this.pendingGroup?.id ?? null;
  }

  isPending(group: LightGroupDef): boolean {
    return this.pendingGroup?.id === group.id;
  }

  groupState(group: LightGroupDef): LightState {
    const anyGreen = group.directions.some((d) => this.isGreen(d));
    return anyGreen ? 'green' : 'red';
  }

  /** Apply a pending green when its clearance time is up. Call once per frame. */
  update(): boolean {
    this.justApplied = false;
    if (this.pendingGroup && this.now >= this.pendingAt) {
      for (const d of this.pendingGroup.directions) this.states.set(d, 'green');
      this.pendingGroup = null;
      this.justApplied = true;
      return true;
    }
    return false;
  }

  /**
   * Toggle a group. `clearance` is the all-red delay the simulation computed.
   * Returns true when the controller state moved (for sfx/feedback).
   */
  toggle(group: LightGroupDef, clearance: number = MIN_CLEARANCE): boolean {
    if (this.pendingGroup?.id === group.id) {
      this.pendingGroup = null; // cancel a request in flight
      return true;
    }
    if (this.groupState(group) === 'green') {
      for (const d of group.directions) this.states.set(d, 'red');
      return true;
    }
    // Request green: perpendicular traffic drops to red right away…
    for (const d of this.directions) {
      if (group.directions.includes(d)) continue;
      const conflicts = group.directions.some((g) => isHorizontal(g) !== isHorizontal(d));
      if (conflicts) this.states.set(d, 'red');
    }
    // …and the new green is scheduled after the clearance interval.
    this.pendingGroup = group;
    if (clearance <= MIN_CLEARANCE) {
      // Fast path: apply immediately on this frame.
      this.pendingAt = this.now;
      return this.update();
    }
    this.pendingAt = this.now + Math.min(MAX_CLEARANCE, Math.max(MIN_CLEARANCE, clearance));
    return true;
  }

  /** Force a group's directions to a state (level init / tests / debug). */
  setGroupState(group: LightGroupDef, state: LightState): void {
    for (const d of group.directions) this.states.set(d, state);
    if (state === 'green' && this.pendingGroup?.id === group.id) this.pendingGroup = null;
  }

  serialize(): Record<DirectionId, LightState> {
    const out = {} as Record<DirectionId, LightState>;
    for (const d of this.directions) out[d] = this.stateOf(d);
    return out;
  }

  restore(data: Record<DirectionId, LightState>): void {
    this.pendingGroup = null;
    for (const d of this.directions) {
      if (data[d]) this.states.set(d, data[d]);
    }
  }
}
