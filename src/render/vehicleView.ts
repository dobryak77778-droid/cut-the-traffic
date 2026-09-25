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
  if (type === 'ambulance') return 'tex-ambulance-0';
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
  /** Ambulance-only: flashing light bar + soft glow. */
  private beacon: Phaser.GameObjects.Image | null = null;
  private glow: Phaser.GameObjects.Image | null = null;
  private beaconClock = 0;

  constructor(scene: Phaser.Scene, ev: SimVehicle, layout: LevelLayout) {
    this.root = scene.add.container(0, 0).setDepth(5);
    this.shadow = scene.add.image(4, 6, 'shadow').setAlpha(0.28);
    this.inner = scene.add.container(0, 0);
    this.sprite = scene.add.image(0, 0, textureFor(ev.type, ev.id));

    const spec = ev.spec;
    this.shadow.setDisplaySize(spec.length + 12, spec.width * 1.4);

    this.inner.add(this.sprite);
    if (ev.type === 'ambulance') {
      // Soft alternating glow under the vehicle + the two-lamp bar on the roof.
      this.glow = scene.add.image(0, 0, 'shadow').setTint(0xff4d4d).setAlpha(0.22);
      this.glow.setDisplaySize(spec.length + 40, spec.width * 2.6);
      this.beacon = scene.add.image(spec.length / 2 - 24.5, 0, 'amb-light-a').setOrigin(0.5);
      this.inner.addAt(this.glow, 0);
      this.inner.add(this.beacon);
    }
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

    if (this.beacon && this.glow && !this.crashed) {
      // ~3.3 Hz alternation – readable, not strobing.
      this.beaconClock += dt;
      const phaseA = Math.floor(this.beaconClock * 6.6) % 2 === 0;
      this.beacon.setTexture(phaseA ? 'amb-light-a' : 'amb-light-b');
      this.glow.setTint(phaseA ? 0xff4d4d : 0x4aa8ff);
      this.glow.setAlpha(0.16 + 0.08 * Math.abs(Math.sin(this.beaconClock * Math.PI * 6.6)));
    }
  }

  markCrashed(): void {
    if (this.crashed) return;
    this.crashed = true;
    this.sprite.setTint(0xfff0c0);
    this.glow?.setAlpha(0);
    this.beacon?.setTexture('amb-light-a');
  }

  destroy(): void {
    this.root.destroy();
  }
}
