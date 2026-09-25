import Phaser from 'phaser';
import type { LightGroupDef, LightState } from '../types';
import { FONT, PALETTE } from './widgets';

const R = 46; // visual radius → 92px touch target

export type LightButtonState = 'red' | 'green' | 'pending';

/**
 * Large round traffic-light control. Reads as an actual signal head:
 * red/green lamp, blinking amber while a switch is clearing, press feedback.
 * The whole circle (plus margin) is the hit area – no precise tapping needed.
 */
export class LightButton {
  readonly root: Phaser.GameObjects.Container;
  private readonly lampGfx: Phaser.GameObjects.Graphics;
  private readonly label: Phaser.GameObjects.Text;
  private readonly ring: Phaser.GameObjects.Graphics;
  private state: LightButtonState = 'red';
  private pulse = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    readonly group: LightGroupDef,
    x: number,
    y: number,
    private readonly onTap: () => void,
  ) {
    this.root = scene.add.container(x, y);

    // Outer hit area (generous, ~116px). Lives inside the container so it
    // follows the button; rect is in top-left space of the hit object.
    const hitSize = (R + 12) * 2;
    const hit = scene.add
      .rectangle(0, 0, hitSize, hitSize, 0x000000, 0)
      .setInteractive(
        new Phaser.Geom.Rectangle(0, 0, hitSize, hitSize),
        Phaser.Geom.Rectangle.Contains,
      );

    const body = scene.add.graphics();
    body.fillStyle(0x000000, 0.3);
    body.fillCircle(0, 5, R);
    body.fillStyle(PALETTE.panel, 1);
    body.fillCircle(0, 0, R);
    body.lineStyle(4, 0xffffff, 0.14);
    body.strokeCircle(0, 0, R);

    this.lampGfx = scene.add.graphics();
    this.ring = scene.add.graphics();
    this.label = scene.add
      .text(0, 1, group.short, {
        fontFamily: FONT,
        fontSize: '30px',
        fontStyle: '700',
        color: '#ffffff',
        stroke: '#10151c',
        strokeThickness: 3,
      })
      .setOrigin(0.5);

    const caption = scene.add
      .text(0, R + 14, group.label, {
        fontFamily: FONT,
        fontSize: '13px',
        fontStyle: '600',
        color: '#dfe6ef',
        stroke: '#10151c',
        strokeThickness: 3,
      })
      .setOrigin(0.5, 0);

    this.root.add([hit, body, this.ring, this.lampGfx, this.label, caption]);

    hit.on('pointerdown', () => {
      this.root.setScale(0.93);
    });
    const release = (over: boolean) => {
      this.root.setScale(1);
      if (over) this.onTap();
    };
    hit.on('pointerup', () => release(true));
    hit.on('pointerout', () => release(false));

    this.apply('red');
  }

  private apply(state: LightButtonState): void {
    this.state = state;
    const g = this.lampGfx;
    g.clear();
    if (state === 'green') {
      g.fillStyle(PALETTE.green, 1);
      g.fillCircle(0, 0, R - 12);
      g.fillStyle(0xffffff, 0.22);
      g.fillCircle(-8, -10, 12);
    } else if (state === 'red') {
      g.fillStyle(PALETTE.red, 1);
      g.fillCircle(0, 0, R - 12);
      g.fillStyle(0xffffff, 0.2);
      g.fillCircle(-8, -10, 12);
    } else {
      g.fillStyle(PALETTE.amber, 0.85);
      g.fillCircle(0, 0, R - 16);
      g.fillStyle(0xffffff, 0.18);
      g.fillCircle(-8, -10, 10);
    }
  }

  setState(state: LightButtonState): void {
    if (state !== this.state) this.apply(state);
  }

  /** Called every frame for the pending-blink pulse. */
  update(dtMs: number): void {
    if (this.state === 'pending') {
      this.pulse = (this.pulse + dtMs / 240) % 1;
      const a = 0.35 + 0.55 * Math.abs(Math.sin(this.pulse * Math.PI));
      this.ring.clear();
      this.ring.lineStyle(5, PALETTE.amber, a);
      this.ring.strokeCircle(0, 0, R + 5);
    } else if (this.state === 'green') {
      this.pulse = (this.pulse + dtMs / 900) % 1;
      const a = 0.25 + 0.25 * Math.abs(Math.sin(this.pulse * Math.PI));
      this.ring.clear();
      this.ring.lineStyle(4, 0x7dffbe, a);
      this.ring.strokeCircle(0, 0, R + 5);
    } else {
      if (this.ring) this.ring.clear();
    }
  }

  destroy(): void {
    this.root.destroy();
  }
}
