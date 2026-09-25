import Phaser from 'phaser';

/** Small UI toolkit shared by all menus and the HUD. */

/** Bundled web font (works on mobile wrappers and headless test browsers). */
export const FONT = 'Roboto, Segoe UI, Helvetica Neue, Arial, sans-serif';

export const PALETTE = {
  ink: 0x1b212b,
  panel: 0x1e2530,
  panelLight: 0x2a3341,
  card: 0x232b38,
  text: 0xf2f4f7,
  textDim: 0xaeb8c6,
  accent: 0x4a9de0,
  accentDark: 0x3b7fb8,
  gold: 0xf2c14e,
  green: 0x2fbf71,
  red: 0xe5484d,
  amber: 0xf5a524,
};

export function roundRect(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  color: number,
  alpha = 1,
): void {
  g.fillStyle(color, alpha);
  g.fillRoundedRect(x, y, w, h, r);
}

export interface TextButtonOptions {
  width: number;
  height: number;
  label: string;
  fontSize?: number;
  color?: number;
  textColor?: number;
  radius?: number;
  onClick?: () => void;
}

export interface TextButton {
  root: Phaser.GameObjects.Container;
  setEnabled(v: boolean): void;
  setLabel(text: string): void;
  destroy(): void;
}

export function makeTextButton(
  scene: Phaser.Scene,
  opts: TextButtonOptions,
): TextButton {
  const { width: w, height: h } = opts;
  const fontSize = opts.fontSize ?? 24;
  const color = opts.color ?? PALETTE.accent;
  const textColor = opts.textColor ?? 0xffffff;
  const radius = opts.radius ?? 14;

  const root = scene.add.container(0, 0);
  const bg = scene.add.graphics();
  const label = scene.add
    .text(0, 0, opts.label, {
      fontFamily: FONT,
      fontSize: `${fontSize}px`,
      fontStyle: '600',
      color: `#${textColor.toString(16).padStart(6, '0')}`,
      align: 'center',
    })
    .setOrigin(0.5);

  const draw = (pressed: boolean, c: number) => {
    bg.clear();
    // shadow
    bg.fillStyle(0x000000, 0.25);
    bg.fillRoundedRect(-w / 2, -h / 2 + 4, w, h, radius);
    bg.fillStyle(c, 1);
    bg.fillRoundedRect(-w / 2, -h / 2, w, h, radius);
    if (pressed) {
      bg.fillStyle(0xffffff, 0.12);
      bg.fillRoundedRect(-w / 2, -h / 2, w, h, radius);
    }
  };

  let enabled = true;
  draw(false, color);
  root.add([bg, label]);
  root.setSize(w, h);
  // NOTE: Phaser normalises hit tests by displayOrigin, so hit areas are
  // expressed in top-left space (0,0 = top-left of the object).
  root.setInteractive(new Phaser.Geom.Rectangle(0, 0, w, h), Phaser.Geom.Rectangle.Contains);

  root.on('pointerdown', () => {
    if (!enabled) return;
    draw(true, color);
    root.setScale(0.97);
  });
  const release = () => {
    draw(false, color);
    root.setScale(1);
  };
  root.on('pointerup', () => {
    if (!enabled) return;
    release();
    opts.onClick?.();
  });
  root.on('pointerout', release);

  return {
    root,
    setEnabled(v: boolean) {
      enabled = v;
      root.setAlpha(v ? 1 : 0.45);
    },
    setLabel(t: string) {
      label.setText(t);
    },
    destroy() {
      root.destroy();
    },
  };
}

/** Big rounded card used by result panels. */
export function makePanel(scene: Phaser.Scene, w: number, h: number): Phaser.GameObjects.Container {
  const root = scene.add.container(0, 0);
  const g = scene.add.graphics();
  g.fillStyle(0x000000, 0.35);
  g.fillRoundedRect(-w / 2 + 6, -h / 2 + 10, w, h, 22);
  g.fillStyle(PALETTE.panel, 1);
  g.fillRoundedRect(-w / 2, -h / 2, w, h, 22);
  g.lineStyle(2, 0xffffff, 0.08);
  g.strokeRoundedRect(-w / 2, -h / 2, w, h, 22);
  root.add(g);
  return root;
}

export interface ToggleRow {
  root: Phaser.GameObjects.Container;
  setValue(v: boolean): void;
}

export function makeToggleRow(
  scene: Phaser.Scene,
  y: number,
  label: string,
  value: boolean,
  onChange: (v: boolean) => void,
): ToggleRow {
  const root = scene.add.container(scene.scale.width / 2, y);
  const text = scene.add
    .text(-200, 0, label, {
      fontFamily: FONT,
      fontSize: '22px',
      color: `#${PALETTE.text.toString(16)}`,
    })
    .setOrigin(0, 0.5);

  const trackG = scene.add.graphics();
  const knob = scene.add.graphics();
  const W = 74;
  const H = 38;

  const draw = (v: boolean) => {
    trackG.clear();
    trackG.fillStyle(v ? PALETTE.green : 0x3a4453, 1);
    trackG.fillRoundedRect(150, -H / 2, W, H, H / 2);
    knob.clear();
    knob.fillStyle(0xffffff, 1);
    const kx = v ? 150 + W - H + 4 : 150 + 4;
    knob.fillCircle(kx + (H - 8) / 2, 0, (H - 8) / 2);
  };

  let current = value;
  draw(current);

  const hit = scene.add
    .rectangle(0, 0, 440, 64, 0x000000, 0)
    .setOrigin(0.5)
    .setInteractive(new Phaser.Geom.Rectangle(0, 0, 440, 64), Phaser.Geom.Rectangle.Contains);
  hit.on('pointerdown', () => {
    current = !current;
    draw(current);
    onChange(current);
  });

  root.add([text, trackG, knob, hit]);
  return {
    root,
    setValue(v: boolean) {
      current = v;
      draw(v);
    },
  };
}
