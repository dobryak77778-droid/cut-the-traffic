import Phaser from 'phaser';
import type { VehicleType } from '../types';

/**
 * Procedural vehicle textures (facing east / +x). One texture per colour
 * variant – no tinting artefacts on windows and lights.
 * No external assets: everything is drawn with Phaser Graphics.
 */

function shade(color: number, f: number): number {
  const r = Math.min(255, Math.round(((color >> 16) & 0xff) * f));
  const g = Math.min(255, Math.round(((color >> 8) & 0xff) * f));
  const b = Math.min(255, Math.round((color & 0xff) * f));
  return (r << 16) | (g << 8) | b;
}

const GLASS = 0xc7d8e8;
const GLASS_DARK = 0x9fb6cc;
const TYRE = 0x21262d;
const DARK = 0x2b313a;

export const CAR_COLORS = [0xe0574a, 0x4a7fd4, 0xedc13f, 0xf1f3f5, 0x5c6672, 0x46a96b];
export const VAN_COLORS = [0xf1f3f5, 0x4a7fd4, 0xe8853a, 0x3fa9a0];
export const TRUCK_CAB_COLORS = [0x4a7fd4, 0xe0574a, 0x3f8f6b, 0x5c6672];
export const TRUCK_BOX_COLORS = [0xe8e2d4, 0xd7dce3, 0xdcc9a8, 0xd5e0e8];

function wheels(g: Phaser.GameObjects.Graphics, L: number, W: number, xs: number[]): void {
  g.fillStyle(TYRE, 1);
  for (const x of xs) {
    g.fillRoundedRect(x, -W / 2 - 1.5, 9, 4.5, 2);
    g.fillRoundedRect(x, W / 2 - 3, 9, 4.5, 2);
  }
}

function lights(g: Phaser.GameObjects.Graphics, L: number, W: number): void {
  g.fillStyle(0xfff2c2, 1);
  g.fillRect(L / 2 - 3, -W / 2 + 3.5, 2.5, 5);
  g.fillRect(L / 2 - 3, W / 2 - 8.5, 2.5, 5);
  g.fillStyle(0xff6b5e, 1);
  g.fillRect(-L / 2 + 0.5, -W / 2 + 3.5, 2.5, 5);
  g.fillRect(-L / 2 + 0.5, W / 2 - 8.5, 2.5, 5);
}

function paintCar(g: Phaser.GameObjects.Graphics, body: number): void {
  const L = 46;
  const W = 25;
  const dark = shade(body, 0.82);
  const light = shade(body, 1.12);

  wheels(g, L, W, [-17, 8]);
  // body
  g.fillStyle(body, 1);
  g.fillRoundedRect(-L / 2, -W / 2, L, W, 7);
  // cabin
  g.fillStyle(dark, 1);
  g.fillRoundedRect(-11, -W / 2 + 2.5, 22, W - 5, 5);
  // glass
  g.fillStyle(GLASS, 1);
  g.fillRoundedRect(2, -W / 2 + 4, 8, W - 8, 2);
  g.fillStyle(GLASS_DARK, 1);
  g.fillRoundedRect(-9.5, -W / 2 + 4, 7, W - 8, 2);
  // roof sheen
  g.fillStyle(light, 0.35);
  g.fillRoundedRect(-7, -W / 2 + 3, 15, 4, 2);
  // bumpers
  g.fillStyle(dark, 1);
  g.fillRect(L / 2 - 4, -W / 2 + 1.5, 4, W - 3);
  g.fillRect(-L / 2, -W / 2 + 1.5, 3, W - 3);
  lights(g, L, W);
}

function paintVan(g: Phaser.GameObjects.Graphics, body: number): void {
  const L = 58;
  const W = 27;
  const dark = shade(body, 0.8);
  wheels(g, L, W, [-20, 12]);
  // main box
  g.fillStyle(body, 1);
  g.fillRoundedRect(-L / 2, -W / 2, L, W, 5);
  // cab area slightly lower nose
  g.fillStyle(dark, 1);
  g.fillRoundedRect(L / 2 - 16, -W / 2 + 1, 16, W - 2, 4);
  // windshield
  g.fillStyle(GLASS, 1);
  g.fillRoundedRect(L / 2 - 13, -W / 2 + 4, 9, W - 8, 2);
  // side window
  g.fillStyle(GLASS_DARK, 1);
  g.fillRoundedRect(L / 2 - 22, -W / 2 + 4.5, 5.5, W - 9, 2);
  // cargo panel line
  g.lineStyle(1.6, dark, 0.9);
  g.lineBetween(-L / 2 + 14, -W / 2 + 3, -L / 2 + 14, W / 2 - 3);
  g.lineBetween(-L / 2 + 26, -W / 2 + 3, -L / 2 + 26, W / 2 - 3);
  // skirt
  g.fillStyle(dark, 1);
  g.fillRect(-L / 2, W / 2 - 4, L, 3);
  lights(g, L, W);
}

function paintTruck(g: Phaser.GameObjects.Graphics, cabColor: number, boxColor: number): void {
  const L = 88;
  const W = 30;
  const cabDark = shade(cabColor, 0.82);
  const boxDark = shade(boxColor, 0.85);

  wheels(g, L, W, [-32, -18, 30]);
  // cargo box
  g.fillStyle(boxColor, 1);
  g.fillRoundedRect(-L / 2, -W / 2, 60, W, 3);
  // panel lines + stripe
  g.lineStyle(1.6, boxDark, 1);
  for (const x of [-L / 2 + 14, -L / 2 + 28, -L / 2 + 42]) {
    g.lineBetween(x, -W / 2 + 3, x, W / 2 - 3);
  }
  g.fillStyle(shade(boxColor, 0.72), 1);
  g.fillRect(-L / 2, W / 2 - 5, 60, 3.5);
  // chassis gap
  g.fillStyle(DARK, 1);
  g.fillRect(-L / 2 + 60, -W / 2 + 6, 5, W - 12);
  // cab
  g.fillStyle(cabColor, 1);
  g.fillRoundedRect(-L / 2 + 64, -W / 2, L - 64 - 1, W, 5);
  g.fillStyle(cabDark, 1);
  g.fillRoundedRect(-L / 2 + 64, W / 2 - 5, L - 65, 4, 2);
  // windshield + side glass
  g.fillStyle(GLASS, 1);
  g.fillRoundedRect(L / 2 - 12, -W / 2 + 4, 8, W - 8, 2);
  g.fillStyle(GLASS_DARK, 1);
  g.fillRoundedRect(-L / 2 + 66, -W / 2 + 4.5, 6, W - 9, 2);
  lights(g, L, W);
}

/**
 * Ambulance: white box body, red belt stripe, red cross on the roof and a
 * roof light bar. The flashing lights themselves are a separate overlay
 * texture (`amb-light`) toggled by VehicleView so the body stays static.
 */
function paintAmbulance(g: Phaser.GameObjects.Graphics): void {
  const L = 56;
  const W = 27;
  const body = 0xf7f9fb;
  const red = 0xd8342b;
  const dark = shade(body, 0.78);
  wheels(g, L, W, [-19, 11]);
  // main box
  g.fillStyle(body, 1);
  g.fillRoundedRect(-L / 2, -W / 2, L, W, 5);
  // cab nose
  g.fillStyle(dark, 1);
  g.fillRoundedRect(L / 2 - 15, -W / 2 + 1, 15, W - 2, 4);
  // windshield + side window
  g.fillStyle(GLASS, 1);
  g.fillRoundedRect(L / 2 - 12, -W / 2 + 4, 8, W - 8, 2);
  g.fillStyle(GLASS_DARK, 1);
  g.fillRoundedRect(L / 2 - 21, -W / 2 + 4.5, 5, W - 9, 2);
  // red belt stripe along both sides
  g.fillStyle(red, 1);
  g.fillRect(-L / 2 + 2, -W / 2 + 2, L - 18, 3);
  g.fillRect(-L / 2 + 2, W / 2 - 5, L - 18, 3);
  // roof cross
  g.fillStyle(red, 1);
  g.fillRect(-14, -1.75, 12, 3.5);
  g.fillRect(-9.75, -6, 3.5, 12);
  // light bar base (lights are drawn by the overlay)
  g.fillStyle(0x2b313a, 1);
  g.fillRoundedRect(L / 2 - 27, -W / 2 + 6, 5, W - 12, 1.5);
  // skirt
  g.fillStyle(dark, 1);
  g.fillRect(-L / 2, W / 2 - 3, L, 2);
  lights(g, L, W);
}

/** Two-lamp light bar overlay for the ambulance (red half / blue half). */
export function buildAmbulanceLightTextures(scene: Phaser.Scene): void {
  const make = (key: string, left: number, right: number) => {
    const g = scene.add.graphics();
    g.fillStyle(left, 1);
    g.fillRoundedRect(0, 0, 5, 7, 1.5);
    g.fillStyle(right, 1);
    g.fillRoundedRect(0, 8, 5, 7, 1.5);
    g.generateTexture(key, 5, 15);
    g.destroy();
  };
  make('amb-light-a', 0xff5a4d, 0x2a4b6e);
  make('amb-light-b', 0x7a2a25, 0x4aa8ff);
}

export interface TextureSpec {
  key: string;
  type: VehicleType;
  length: number;
  width: number;
}

export function buildVehicleTextures(scene: Phaser.Scene): TextureSpec[] {
  const out: TextureSpec[] = [];

  CAR_COLORS.forEach((color, i) => {
    const key = `tex-car-${i}`;
    const g = scene.add.graphics();
    paintCar(g, color);
    g.generateTexture(key, 46 + 4, 25 + 4);
    g.destroy();
    out.push({ key, type: 'car', length: 46, width: 25 });
  });

  VAN_COLORS.forEach((color, i) => {
    const key = `tex-van-${i}`;
    const g = scene.add.graphics();
    paintVan(g, color);
    g.generateTexture(key, 58 + 4, 27 + 4);
    g.destroy();
    out.push({ key, type: 'van', length: 58, width: 27 });
  });

  {
    const key = 'tex-ambulance-0';
    const g = scene.add.graphics();
    paintAmbulance(g);
    g.generateTexture(key, 56 + 4, 27 + 4);
    g.destroy();
    out.push({ key, type: 'ambulance', length: 56, width: 27 });
  }

  TRUCK_CAB_COLORS.forEach((cab, i) => {
    const key = `tex-truck-${i}`;
    const g = scene.add.graphics();
    paintTruck(g, cab, TRUCK_BOX_COLORS[i]);
    g.generateTexture(key, 88 + 4, 30 + 4);
    g.destroy();
    out.push({ key, type: 'truck', length: 88, width: 30 });
  });

  return out;
}

/** Soft ellipse shadow texture; scaled per vehicle at runtime. */
export function buildShadowTexture(scene: Phaser.Scene): void {
  const g = scene.add.graphics();
  const steps = 7;
  for (let i = steps; i >= 1; i--) {
    const t = i / steps;
    g.fillStyle(0x000000, 0.055);
    g.fillEllipse(60, 30, 112 * t, 44 * t);
  }
  g.generateTexture('shadow', 120, 60);
  g.destroy();
}

/** Small round spark used by the crash burst. */
export function buildSparkTexture(scene: Phaser.Scene): void {
  const g = scene.add.graphics();
  g.fillStyle(0xffffff, 1);
  g.fillCircle(8, 8, 7);
  g.generateTexture('spark', 16, 16);
  g.destroy();
}

/** Cartoon impact starburst. */
export function buildStarburstTexture(scene: Phaser.Scene): void {
  const g = scene.add.graphics();
  const spikes = 11;
  const outer = 54;
  const inner = 24;
  const points: Phaser.Math.Vector2[] = [];
  for (let i = 0; i < spikes * 2; i++) {
    const ang = (Math.PI * i) / spikes - Math.PI / 2;
    const r = i % 2 === 0 ? outer : inner;
    points.push(new Phaser.Math.Vector2(80 + Math.cos(ang) * r, 80 + Math.sin(ang) * r));
  }
  g.fillStyle(0xffffff, 1);
  g.fillPoints(points, true);
  g.generateTexture('starburst', 160, 160);
  g.destroy();
}
