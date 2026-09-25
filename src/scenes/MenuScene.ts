import Phaser from 'phaser';
import { DESIGN_HEIGHT, DESIGN_WIDTH } from '../config/game';
import { LEVELS } from '../data/levels';
import { getSave } from '../services/save';
import { getAnalytics } from '../services/analytics';
import { audio } from '../services/audio';
import { FONT, PALETTE, makeTextButton } from '../ui/widgets';

/** Minimal main menu: PLAY · LEVELS · SETTINGS. */
export default class MenuScene extends Phaser.Scene {
  constructor() {
    super('Menu');
  }

  create(): void {
    const W = DESIGN_WIDTH;
    const H = DESIGN_HEIGHT;
    const save = getSave();
    getAnalytics().track('game_started');

    this.cameras.main.setBackgroundColor('#141a23');

    // Decorative road strip with a looping car.
    const road = this.add.graphics();
    road.fillStyle(0x30363f, 1);
    road.fillRect(0, H - 190, W, 96);
    road.fillStyle(0xcfd4da, 0.7);
    for (let x = 8; x < W; x += 44) {
      road.fillRect(x, H - 144, 24, 5);
    }
    road.fillStyle(0xb9bfc7, 1);
    road.fillRect(0, H - 194, W, 5);
    road.fillRect(0, H - 99, W, 5);

    const loopCar = this.add.image(-80, H - 122, 'tex-car-1');
    this.tweens.add({
      targets: loopCar,
      x: W + 90,
      duration: 4200,
      repeat: -1,
      repeatDelay: 700,
      ease: 'Linear',
    });
    const loopTruck = this.add.image(W + 100, H - 168, 'tex-truck-0');
    loopTruck.setFlipX(true);
    this.tweens.add({
      targets: loopTruck,
      x: -110,
      duration: 6000,
      repeat: -1,
      repeatDelay: 1100,
      ease: 'Linear',
    });

    // Title block.
    const lightHead = this.add.graphics();
    lightHead.fillStyle(0x1b212b, 1);
    lightHead.fillRoundedRect(W / 2 - 22, 150, 44, 104, 12);
    lightHead.fillStyle(PALETTE.red, 1);
    lightHead.fillCircle(W / 2, 176, 13);
    lightHead.fillStyle(0x4b5563, 1);
    lightHead.fillCircle(W / 2, 202, 13);
    lightHead.fillStyle(0x4b5563, 1);
    lightHead.fillCircle(W / 2, 228, 13);
    // subtle blinking green
    const greenLamp = this.add.circle(W / 2, 228, 13, PALETTE.green).setAlpha(0);
    this.tweens.add({
      targets: greenLamp,
      alpha: { from: 0, to: 1 },
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    const redLamp = this.add.circle(W / 2, 176, 13, PALETTE.red);
    this.tweens.add({
      targets: redLamp,
      alpha: { from: 1, to: 0.35 },
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    this.add
      .text(W / 2, 310, 'CUT THE', {
        fontFamily: FONT,
        fontSize: '38px',
        fontStyle: '700',
        color: '#e8edf4',
        letterSpacing: 8,
      })
      .setOrigin(0.5);
    this.add
      .text(W / 2, 366, 'TRAFFIC', {
        fontFamily: FONT,
        fontSize: '58px',
        fontStyle: '800',
        color: '#ffffff',
        letterSpacing: 6,
      })
      .setOrigin(0.5);
    this.add
      .text(W / 2, 412, 'manage the flow  ·  nobody crashes', {
        fontFamily: FONT,
        fontSize: '15px',
        color: '#93a1b3',
      })
      .setOrigin(0.5);

    // Buttons.
    const latest = Math.min(save.unlockedLevel, LEVELS.length);
    const play = makeTextButton(this, {
      width: 300,
      height: 74,
      label: 'PLAY',
      fontSize: 30,
      radius: 20,
      onClick: () => {
        audio.play('button');
        this.cameras.main.fadeOut(140, 10, 13, 18);
        this.time.delayedCall(150, () => this.scene.start('Game', { levelId: latest }));
      },
    });
    play.root.setPosition(W / 2, 520);
    play.root.setAlpha(0);
    this.tweens.add({ targets: play.root, alpha: 1, y: 514, duration: 260, ease: 'Back.easeOut' });

    const levelsBtn = makeTextButton(this, {
      width: 300,
      height: 60,
      label: 'LEVELS',
      fontSize: 22,
      color: PALETTE.panelLight,
      radius: 16,
      onClick: () => {
        audio.play('button');
        this.scene.start('LevelSelect');
      },
    });
    levelsBtn.root.setPosition(W / 2, 612);

    const settingsBtn = makeTextButton(this, {
      width: 300,
      height: 60,
      label: 'SETTINGS',
      fontSize: 22,
      color: PALETTE.panelLight,
      radius: 16,
      onClick: () => {
        audio.play('button');
        this.scene.start('Settings');
      },
    });
    settingsBtn.root.setPosition(W / 2, 686);

    this.add
      .text(W / 2, H - 26, 'v0.1 MVP · no ads in dev unless enabled', {
        fontFamily: FONT,
        fontSize: '12px',
        color: '#5d6a7c',
      })
      .setOrigin(0.5);

    this.cameras.main.fadeIn(160, 10, 13, 18);
  }
}
