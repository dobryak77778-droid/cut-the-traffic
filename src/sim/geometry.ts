import type { DirectionId, LevelLayout, VehicleType } from '../types';
import { VEHICLE } from '../config/game';

/** Distance from the screen edge to the spawn centre point (px). */
export const SPAWN_MARGIN = 96;
/** Distance past the far edge at which a vehicle is considered gone. */
export const EXIT_MARGIN = 70;
/** Gap kept between a stopped bumper and the stop line. */
export const STOP_GAP = 7;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type Axis = 'h' | 'v';

export function axisOf(dir: DirectionId): Axis {
  return dir === 'E' || dir === 'W' ? 'h' : 'v';
}

export function isHorizontal(dir: DirectionId): boolean {
  return axisOf(dir) === 'h';
}

export function dirVector(dir: DirectionId): { x: number; y: number } {
  switch (dir) {
    case 'E':
      return { x: 1, y: 0 };
    case 'W':
      return { x: -1, y: 0 };
    case 'S':
      return { x: 0, y: 1 };
    case 'N':
      return { x: 0, y: -1 };
  }
}

/**
 * Right-hand traffic lanes:
 *  - E travels on the lower half (y > centerY)
 *  - W travels on the upper half
 *  - S travels on the left half  (x < centerX)
 *  - N travels on the right half
 */
export function laneCoord(dir: DirectionId, layout: LevelLayout): number {
  const { laneOffset: off, centerX: cx, centerY: cy } = layout;
  switch (dir) {
    case 'E':
      return cy + off;
    case 'W':
      return cy - off;
    case 'S':
      return cx - off;
    case 'N':
      return cx + off;
  }
}

/** World coordinate of the spawn centre point along the travel axis. */
export function spawnOrigin(dir: DirectionId, layout: LevelLayout): number {
  switch (dir) {
    case 'E':
      return -SPAWN_MARGIN;
    case 'W':
      return layout.width + SPAWN_MARGIN;
    case 'S':
      return -SPAWN_MARGIN;
    case 'N':
      return layout.height + SPAWN_MARGIN;
  }
}

/** Centre coordinate for a given travelled distance s. */
export function coordAt(dir: DirectionId, layout: LevelLayout, s: number): number {
  const origin = spawnOrigin(dir, layout);
  switch (dir) {
    case 'E':
      return origin + s;
    case 'W':
      return origin - s;
    case 'S':
      return origin + s;
    case 'N':
      return origin - s;
  }
}

/** World position of a vehicle centre. */
export function positionOf(
  dir: DirectionId,
  layout: LevelLayout,
  s: number,
): { x: number; y: number } {
  const lane = laneCoord(dir, layout);
  const c = coordAt(dir, layout, s);
  return isHorizontal(dir) ? { x: c, y: lane } : { x: lane, y: c };
}

/**
 * Travelled distance at which a vehicle's front bumper rests behind the stop
 * line. Always positive for sane layouts.
 */
export function stopLineS(dir: DirectionId, layout: LevelLayout, type: VehicleType): number {
  const len = VEHICLE[type].length;
  const halfRoad = layout.roadWidth / 2;
  let stopCentre: number;
  switch (dir) {
    case 'E':
      stopCentre = layout.centerX - halfRoad - STOP_GAP - len / 2;
      return stopCentre - spawnOrigin(dir, layout);
    case 'W':
      stopCentre = layout.centerX + halfRoad + STOP_GAP + len / 2;
      return spawnOrigin(dir, layout) - stopCentre;
    case 'S':
      stopCentre = layout.centerY - halfRoad - STOP_GAP - len / 2;
      return stopCentre - spawnOrigin(dir, layout);
    case 'N':
      stopCentre = layout.centerY + halfRoad + STOP_GAP + len / 2;
      return spawnOrigin(dir, layout) - stopCentre;
  }
}

/** Travelled distance at which the vehicle is fully off the far edge. */
export function exitS(dir: DirectionId, layout: LevelLayout, type: VehicleType): number {
  const len = VEHICLE[type].length;
  switch (dir) {
    case 'E':
      return layout.width + EXIT_MARGIN + len / 2 - spawnOrigin(dir, layout);
    case 'W':
      return spawnOrigin(dir, layout) - (0 - EXIT_MARGIN - len / 2);
    case 'S':
      return layout.height + EXIT_MARGIN + len / 2 - spawnOrigin(dir, layout);
    case 'N':
      return spawnOrigin(dir, layout) - (0 - EXIT_MARGIN - len / 2);
  }
}

export function rectOf(
  dir: DirectionId,
  layout: LevelLayout,
  s: number,
  type: VehicleType,
): Rect {
  const pos = positionOf(dir, layout, s);
  const spec = VEHICLE[type];
  return isHorizontal(dir)
    ? { x: pos.x - spec.length / 2, y: pos.y - spec.width / 2, w: spec.length, h: spec.width }
    : { x: pos.x - spec.width / 2, y: pos.y - spec.length / 2, w: spec.width, h: spec.length };
}

export function rectsOverlap(a: Rect, b: Rect, shrink = 0): boolean {
  const h = shrink / 2;
  return (
    a.x + h < b.x + b.w - h &&
    a.x + a.w - h > b.x + h &&
    a.y + h < b.y + b.h - h &&
    a.y + a.h - h > b.y + h
  );
}
