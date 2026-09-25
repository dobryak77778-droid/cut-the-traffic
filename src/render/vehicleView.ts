import Phaser from 'phaser';
import type { DirectionId, LevelLayout, VehicleType } from '../types';
import { positionOf } from '../sim/geometry';
import type { SimVehicle } from '../sim/vehicle';

const DIR_ANGLE: Record<DirectionId, number> = {
  E: 0,
  W: Math.PI,
  S: Math.PI / 2,
  N: -Math.PI / 2,
};

let textureSeq = 0;

export function textureFor(type: VehicleType, id: number): string {
  if (type === 'car') return `tex-car-${id % 6}`;
  if (type === 'van') return `tex-van-${id % 4}`;
  return `tex-truck-${id % 4}`;
}

/**
 * Visual wrapper for one simulated vehicle: soft shadow + body sprite with a
 * subtle suspension bob and braking lean. Positions come from the sim – the
 * view never owns gameplay state.
 */
export class VehicleView {
  private readonly root: Phaser.GameObjects.Container;
  private readonly inner: Phaser.GameObjects.Container;
  private readonly shadow: Phaser.GameObjects.Image;
  private readonly sprite: Phaser.GameObjects.Image;
  private bobPhase = (textureSeq++ % 100) * 0.37;
  private lastV = 0;
  private crashed = false;

  constructor(scene: Phaser.Scene, ev: SimVehicle, layout: LevelLayout) {
    this.root = scene.add.container(0, 0).setDepth(5);
    this.shadow = scene.add.image(4, 6, 'shadow').setAlpha(0.28);
    this.inner = scene.add.container(0, 0);
    this.sprite = scene.add.image(0, 0, textureFor(ev.type, ev.id));

    const spec = ev.spec;
    this.shadow.setDisplaySize(spec.length + 12, spec.width * 1.4);

    this.inner.add(this.sprite);
    this.root.add([this.shadow, this.inner]);
    this.sync(ev, layout, 0);
  }

  sync(ev: SimVehicle, layout: LevelLayout, dt: number): void {
    const pos = positionOf(ev.dir, layout, ev.s);
    this.root.setPosition(pos.x, pos.y);

    const angle = DIR_ANGLE[ev.dir];
    this.shadow.setRotation(angle);

    // Suspension: gentle lateral sway scaled by speed; settles when stopped.
    const speedRatio = Math.max(0, Math.min(1, ev.v / ev.spec.maxSpeed));
    this.bobPhase += dt * (5 + ev.v * 0.05);
    const amp = 0.35 + 1.15 * speedRatio;
    const bob = Math.sin(this.bobPhase) * amp;
    const accel = dt > 0 ? (ev.v - this.lastV) / dt : 0;
    const lean = Phaser.Math.Clamp(-accel * 0.004, -0.05, 0.05);
    this.inner.y = bob;
    this.inner.rotation = angle + Math.cos(this.bobPhase) * 0.016 * speedRatio + lean;
    this.lastV = ev.v;
  }

  markCrashed(): void {
    if (this.crashed) return;
    this.crashed = true;
    this.sprite.setTint(0xfff0c0);
  }

  destroy(): void {
    this.root.destroy();
  }
}
