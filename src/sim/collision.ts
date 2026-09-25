import type { LevelLayout } from '../types';
import { SIM } from '../config/game';
import { axisOf, rectsOverlap, rectOf } from './geometry';
import type { SimVehicle } from './vehicle';

/**
 * Cheap collision detection.
 *
 * All travel is axis-aligned, so only horizontal-vs-vertical pairs can ever
 * overlap (same-lane rear-ends are prevented by car-following). With a handful
 * of vehicles per level this is a trivial O(n²/4) check.
 */
export function findCollisionPair(
  vehicles: SimVehicle[],
  layout: LevelLayout,
): [SimVehicle, SimVehicle] | null {
  const horiz: SimVehicle[] = [];
  const vert: SimVehicle[] = [];
  for (const v of vehicles) {
    (axisOf(v.dir) === 'h' ? horiz : vert).push(v);
  }
  if (horiz.length === 0 || vert.length === 0) return null;

  // Broad phase: a crash can only happen while both vehicles are near the
  // intersection box (each rect must reach it along its travel axis).
  const half = layout.roadWidth / 2;
  const cx = layout.centerX;
  const cy = layout.centerY;
  const hReach: { v: SimVehicle; x0: number; x1: number }[] = [];
  for (const v of horiz) {
    const r = rectOf(v.dir, layout, v.s, v.type);
    const x0 = r.x;
    const x1 = r.x + r.w;
    if (x1 >= cx - half && x0 <= cx + half) hReach.push({ v, x0, x1 });
  }
  if (hReach.length === 0) return null;

  for (const v of vert) {
    const r = rectOf(v.dir, layout, v.s, v.type);
    const y0 = r.y;
    const y1 = r.y + r.h;
    if (y1 < cy - half || y0 > cy + half) continue;
    for (const h of hReach) {
      const hr = rectOf(h.v.dir, layout, h.v.s, h.v.type);
      if (rectsOverlap(hr, r, SIM.collisionShrink)) return [h.v, v];
    }
  }
  return null;
}
