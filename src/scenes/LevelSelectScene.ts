import Phaser from 'phaser';
import { DESIGN_HEIGHT, DESIGN_WIDTH } from '../config/game';
import { LEVELS } from '../data/levels';
import { getAnalytics } from '../services/analytics';
import { audio } from '../services/audio';
import { getSave } from '../services/save';
import { FONT, PALETTE, makeTextButton } from '../ui/widgets';

/** Level grid: unlocked / locked / completed + best times. */
export default class LevelSelectScene extends Phaser.Scene {
  constructor() {
    super('LevelSelect');
  }

  create(): void {
    const W = DESIGN_WIDTH;
    const H = DESIGN_HEIGHT;
    const save = getSave();

    this.cameras.main.setBackgroundColor('#141a23');

    // Header.
    const back = makeTextButton(this, {
      width: 92,
      height: 44,
      label: '‹ BACK',
      fontSize: 17,
      color: PALETTE.panelLight,
      radius: 12,
      onClick: () => {
        audio.play('button');
        this.scene.start('Menu');
      },
    });
    back.root.setPosition(64, 54);

    this.add
      .text(W / 2, 54, 'LEVELS', {
        fontFamily: FONT,
        fontSize: '26px',
        fontStyle: '700',
        color: '#f2f4f7',
        letterSpacing: 4,
      })
      .setOrigin(0.5);

    const completedCount = LEVELS.filter((l) => save.isCompleted(l.id)).length;
    this.add
      .text(W / 2, 92, `${completedCount} / ${LEVELS.length} cleared`, {
        fontFamily: FONT,
        fontSize: '14px',
        color: '#93a1b3',
      })
      .setOrigin(0.5);

    // Grid.
    const cardW = 226;
    const cardH = 116;
    const gapX = 16;
    const gapY = 18;
    const startX = (W - cardW * 2 - gapX) / 2 + cardW / 2;
    const startY = 140 + cardH / 2;

    LEVELS.forEach((level, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = startX + col * (cardW + gapX);
      const y = startY + row * (cardH + gapY);

      const unlocked = save.isUnlocked(level.id);
      const done = save.isCompleted(level.id);
      const best = save.bestTime(level.id);

      const g = this.add.graphics();
      g.fillStyle(0x000000, 0.28);
      g.fillRoundedRect(-cardW / 2, -cardH / 2 + 5, cardW, cardH, 16);
      g.fillStyle(unlocked ? PALETTE.card : 0x1a2029, 1);
      g.fillRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 16);
      g.lineStyle(2, done ? 0x2fbf71 : unlocked ? 0x3c4a5c : 0x252c36, 1);
      g.strokeRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 16);

      const num = this.add
        .text(-cardW / 2 + 18, -cardH / 2 + 14, String(level.id).padStart(2, '0'), {
          fontFamily: FONT,
          fontSize: '30px',
          fontStyle: '800',
          color: unlocked ? '#f2c14e' : '#4a5563',
        })
        .setOrigin(0, 0);

      const name = this.add
        .text(-cardW / 2 + 18, -cardH / 2 + 54, level.name, {
          fontFamily: FONT,
          fontSize: '17px',
          fontStyle: '600',
          color: unlocked ? '#e8edf4' : '#5d6a7c',
        })
        .setOrigin(0, 0);

      const sub = this.add
        .text(
          -cardW / 2 + 18,
          -cardH / 2 + 80,
          done && best !== undefined
            ? `BEST ${best.toFixed(1)}s`
            : unlocked
              ? `${level.spawn.length} VEHICLES`
              : 'LOCKED',
          {
            fontFamily: FONT,
            fontSize: '13px',
            color: done ? '#6fdca4' : unlocked ? '#93a1b3' : '#4a5563',
          },
        )
        .setOrigin(0, 0);

      if (unlocked) {
        if (done) {
          // check badge
          const badge = this.add.graphics();
          badge.fillStyle(PALETTE.green, 1);
          badge.fillCircle(cardW / 2 - 30, -18, 17);
          const check = this.add.graphics();
          check.lineStyle(4, 0xffffff, 1);
          check.lineBetween(cardW / 2 - 38, -18, cardW / 2 - 32, -11);
          check.lineBetween(cardW / 2 - 32, -11, cardW / 2 - 21, -26);
          this.add.container(x, y, [g, num, name, sub, badge, check]);
        } else {
          this.add.container(x, y, [g, num, name, sub]);
        }
        const hit = this.add
          .rectangle(x, y, cardW, cardH, 0x000000, 0)
          .setInteractive(
            new Phaser.Geom.Rectangle(0, 0, cardW, cardH),
            Phaser.Geom.Rectangle.Contains,
          );
        hit.on('pointerover', () => g.setAlpha(0.85));
        hit.on('pointerout', () => g.setAlpha(1));
        hit.on('pointerdown', () => {
          audio.play('button');
          this.cameras.main.fadeOut(140, 10, 13, 18);
          this.time.delayedCall(150, () =>
            this.scene.start('Game', { levelId: level.id }),
          );
        });
      } else {
        // padlock glyph
        const lock = this.add.graphics();
        lock.lineStyle(3, 0x55616f, 1);
        lock.strokeCircle(cardW / 2 - 30, -22, 8);
        lock.beginPath();
        lock.arc(cardW / 2 - 30, -22, 8, Math.PI, 0, false);
        lock.strokePath();
        lock.fillStyle(0x55616f, 1);
        lock.fillRoundedRect(cardW / 2 - 41, -22, 22, 18, 4);
        this.add.container(x, y, [g, num, name, sub, lock]);
      }
    });

    getAnalytics().track('level_select_opened');
    this.cameras.main.fadeIn(150, 10, 13, 18);
  }
}
