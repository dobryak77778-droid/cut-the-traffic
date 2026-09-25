import Phaser from 'phaser';
import type { LevelLayout } from '../types';

/**
 * Procedural "low-poly inspired" city block painted into a single texture.
 * Clean roads, sidewalks, markings, crosswalks, stylized buildings & trees.
 * Deterministic – no random props, so every level looks identical.
 */

const C = {
  grass: 0x79b757,
  grassPatch: 0x71ae50,
  grassDot: 0x6aa94b,
  sidewalk: 0xccd1d8,
  sidewalkEdge: 0xb4bac3,
  asphalt: 0x3d424a,
  asphaltSoft: 0x434952,
  white: 0xf3f4f6,
  buildingA: 0xdadee5,
  buildingARoof: 0xb6bec9,
  buildingB: 0xc9cfd8,
  buildingBRoof: 0xaeb6c1,
  buildingC: 0xd8cfbf,
  buildingCRoof: 0xbcb2a0,
  window: 0x8fa4bb,
  windowDark: 0x7388a0,
  trunk: 0x6e5236,
  treeDark: 0x3f8f4a,
  treeMid: 0x51a558,
  treeLight: 0x64b96a,
  path: 0xbdb7ac,
  bench: 0x8a6a48,
  shadow: 0x000000,
};

function shade(color: number, f: number): number {
  const r = Math.min(255, Math.round(((color >> 16) & 0xff) * f));
  const g = Math.min(255, Math.round(((color >> 8) & 0xff) * f));
  const b = Math.min(255, Math.round((color & 0xff) * f));
  return (r << 16) | (g << 8) | b;
}

function building(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  body: number,
  roof: number,
): void {
  // ground shadow
  g.fillStyle(C.shadow, 0.16);
  g.fillRoundedRect(x + 6, y + 8, w, h, 8);
  // body
  g.fillStyle(body, 1);
  g.fillRoundedRect(x, y, w, h, 8);
  // roof cap
  g.fillStyle(roof, 1);
  g.fillRoundedRect(x + 4, y + 4, w - 8, Math.min(18, h * 0.22), 5);
  // window grid
  const cols = Math.max(2, Math.floor((w - 16) / 22));
  const rows = Math.max(2, Math.floor((h - 34) / 26));
  const startX = x + 12;
  const startY = y + Math.min(30, h * 0.3);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const wx = startX + c * ((w - 24) / cols);
      const wy = startY + r * 26;
      if (wy > y + h - 14) break;
      const lit = (r * 7 + c * 3 + Math.floor(x)) % 5 === 0;
      g.fillStyle(lit ? C.window : C.windowDark, lit ? 0.95 : 0.65);
      g.fillRoundedRect(wx, wy, 12, 14, 2);
    }
  }
}

function tree(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number): void {
  g.fillStyle(C.shadow, 0.14);
  g.fillEllipse(x + r * 0.35, y + r * 0.5, r * 2, r * 1.2);
  g.fillStyle(C.trunk, 1);
  g.fillRect(x - 3, y, 6, r * 0.7);
  g.fillStyle(C.treeDark, 1);
  g.fillCircle(x, y - r * 0.15, r);
  g.fillStyle(C.treeMid, 1);
  g.fillCircle(x - r * 0.22, y - r * 0.35, r * 0.72);
  g.fillStyle(C.treeLight, 1);
  g.fillCircle(x - r * 0.3, y - r * 0.5, r * 0.42);
}

function park(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number): void {
  // paved path
  g.fillStyle(C.path, 1);
  g.fillRoundedRect(x + 8, y + h * 0.45, w - 16, 16, 8);
  g.fillStyle(C.path, 1);
  g.fillRoundedRect(x + w * 0.45, y + 8, 14, h - 16, 7);
  // trees
  const pts: [number, number][] = [
    [x + 26, y + 26],
    [x + w - 30, y + 30],
    [x + 30, y + h - 34],
    [x + w - 34, y + h - 30],
    [x + w * 0.5, y + 22],
  ];
  for (const [tx, ty] of pts) tree(g, tx, ty, 15 + ((tx + ty) % 5));
  // bench
  g.fillStyle(C.bench, 1);
  g.fillRoundedRect(x + w * 0.2, y + h * 0.45 - 14, 26, 8, 3);
}

function zebra(
  g: Phaser.GameObjects.Graphics,
  dir: 'E' | 'W' | 'N' | 'S',
  layout: LevelLayout,
): void {
  const { centerX: cx, centerY: cy, roadWidth: rw } = layout;
  const half = rw / 2;
  const barLen = 24; // along travel direction
  const barW = 8; // across travel
  const gap = 6;
  const count = 6;
  const laneHalf = half - 6; // stripes only over the approach half-road
  g.fillStyle(C.white, 0.9);
  for (let i = 0; i < count; i++) {
    const off = 6 + i * (barW + gap);
    switch (dir) {
      case 'E': {
        // Eastbound approach = south half of the horizontal road.
        const x = cx - half - off - barLen;
        g.fillRect(x, cy + 4, barLen, laneHalf);
        break;
      }
      case 'W': {
        const x = cx + half + off;
        g.fillRect(x, cy - 4 - laneHalf, barLen, laneHalf);
        break;
      }
      case 'S': {
        // Southbound approach = west half of the vertical road.
        const y = cy - half - off - barLen;
        g.fillRect(cx - 4 - laneHalf, y, laneHalf, barLen);
        break;
      }
      case 'N': {
        const y = cy + half + off;
        g.fillRect(cx + 4, y, laneHalf, barLen);
        break;
      }
    }
  }
}

function stopLine(
  g: Phaser.GameObjects.Graphics,
  dir: 'E' | 'W' | 'N' | 'S',
  layout: LevelLayout,
): void {
  const { centerX: cx, centerY: cy, roadWidth: rw } = layout;
  const half = rw / 2;
  const t = 6;
  g.fillStyle(C.white, 0.95);
  switch (dir) {
    case 'E':
      g.fillRect(cx - half - t, cy + 3, t, half - 3);
      break;
    case 'W':
      g.fillRect(cx + half, cy - half + 3, t, half - 3);
      break;
    case 'S':
      g.fillRect(cx - half + 3, cy - half - t, half - 3, t);
      break;
    case 'N':
      g.fillRect(cx + 3, cy + half, half - 3, t);
      break;
  }
}

export function paintWorld(g: Phaser.GameObjects.Graphics, layout: LevelLayout): void {
  const { width: W, height: H, roadWidth: rw, centerX: cx, centerY: cy } = layout;
  const half = rw / 2;
  const walk = 16;

  // Grass base + subtle patches.
  g.fillStyle(C.grass, 1);
  g.fillRect(0, 0, W, H);
  g.fillStyle(C.grassPatch, 1);
  g.fillEllipse(W * 0.2, H * 0.82, 260, 160);
  g.fillEllipse(W * 0.85, H * 0.2, 220, 140);
  g.fillStyle(C.grassDot, 1);
  for (const [dx, dy] of [
    [40, 120],
    [500, 880],
    [70, 700],
    [470, 250],
    [120, 930],
    [430, 60],
    [30, 420],
    [510, 560],
  ] as [number, number][]) {
    g.fillCircle(dx, dy, 5);
    g.fillCircle(dx + 14, dy + 9, 3);
  }

  // Sidewalks (road + margin).
  g.fillStyle(C.sidewalk, 1);
  g.fillRect(0, cy - half - walk, W, rw + walk * 2);
  g.fillRect(cx - half - walk, 0, rw + walk * 2, H);
  g.fillStyle(C.sidewalkEdge, 1);
  g.fillRect(0, cy - half - walk, W, 3);
  g.fillRect(0, cy + half + walk - 3, W, 3);
  g.fillRect(cx - half - walk, 0, 3, H);
  g.fillRect(cx + half + walk - 3, 0, 3, H);

  // Asphalt.
  g.fillStyle(C.asphalt, 1);
  g.fillRect(0, cy - half, W, rw);
  g.fillRect(cx - half, 0, rw, H);
  g.fillStyle(C.asphaltSoft, 1);
  g.fillRect(0, cy - half, W, 4);
  g.fillRect(0, cy + half - 4, W, 4);
  g.fillRect(cx - half, 0, 4, H);
  g.fillRect(cx + half - 4, 0, 4, H);

  // Centre lines (dashed, broken through the junction).
  g.fillStyle(C.white, 0.9);
  const dash = 20;
  const space = 16;
  const gapBox = half + 8;
  for (let x = 6; x < W; x += dash + space) {
    if (x > cx - gapBox && x < cx + gapBox) continue;
    g.fillRect(x, cy - 2, dash, 4);
  }
  for (let y = 6; y < H; y += dash + space) {
    if (y > cy - gapBox && y < cy + gapBox) continue;
    g.fillRect(cx - 2, y, 4, dash);
  }

  // Edge lines, stopping before each crosswalk.
  const zebraDepth = 6 + 6 * 14 + 4; // matches zebra() spacing
  g.fillStyle(C.white, 0.65);
  g.fillRect(0, cy - half + 3, cx - half - zebraDepth, 3);
  g.fillRect(cx + half + zebraDepth, cy - half + 3, W - (cx + half + zebraDepth), 3);
  g.fillRect(0, cy + half - 6, cx - half - zebraDepth, 3);
  g.fillRect(cx + half + zebraDepth, cy + half - 6, W - (cx + half + zebraDepth), 3);
  g.fillRect(cx - half + 3, 0, 3, cy - half - zebraDepth);
  g.fillRect(cx + half - 6, 0, 3, cy - half - zebraDepth);
  g.fillRect(cx - half + 3, cy + half + zebraDepth, 3, H - (cy + half + zebraDepth));
  g.fillRect(cx + half - 6, cy + half + zebraDepth, 3, H - (cy + half + zebraDepth));

  // Crosswalks + stop lines.
  zebra(g, 'E', layout);
  zebra(g, 'W', layout);
  zebra(g, 'S', layout);
  zebra(g, 'N', layout);
  stopLine(g, 'E', layout);
  stopLine(g, 'W', layout);
  stopLine(g, 'S', layout);
  stopLine(g, 'N', layout);

  // --- City blocks ---------------------------------------------------------
  const topH = cy - half - walk;
  const botY = cy + half + walk;
  const leftW = cx - half - walk;
  const rightX = cx + half + walk;

  // North-west: office block + trees.
  building(g, 16, 20, 120, Math.max(90, topH * 0.42), C.buildingA, C.buildingARoof);
  building(g, 16, topH * 0.46 + 24, 74, Math.max(60, topH * 0.3), C.buildingB, C.buildingBRoof);
  tree(g, 118, topH * 0.62, 17);
  tree(g, 146, topH * 0.8, 14);

  // North-east: park + low block.
  park(g, rightX + 8, 12, Math.max(120, W - rightX - 18), Math.max(110, topH * 0.42));
  building(g, rightX + 14, topH * 0.5 + 16, Math.max(110, W - rightX - 30), Math.max(70, topH * 0.34), C.buildingC, C.buildingCRoof);

  // South-west: park.
  park(g, 14, botY + 14, Math.max(120, leftW - 24), Math.max(140, H - botY - 40));
  tree(g, leftW - 26, botY + 34, 15);

  // South-east: apartments.
  building(g, rightX + 14, botY + 18, Math.max(120, W - rightX - 32), 150, C.buildingA, C.buildingARoof);
  building(g, rightX + 14, botY + 190, Math.max(90, (W - rightX) * 0.55), Math.max(80, H - botY - 220), C.buildingB, C.buildingBRoof);
  tree(g, rightX + 40, botY + 176, 14);
  tree(g, 96, H - 60, 16);
}
