import Phaser from 'phaser';
import { DESIGN_HEIGHT, DESIGN_WIDTH } from '../config/game';
import { getAnalytics } from '../services/analytics';
import { audio } from '../services/audio';
import { syncAudioSettings } from '../services/audioConfig';
import { getSave } from '../services/save';
import { FONT, PALETTE, makePanel, makeTextButton, makeToggleRow } from '../ui/widgets';

/**
 * Settings MVP: sound / music / vibration / mock-ads (dev) + privacy
 * placeholder + progress reset. All values persist through SaveService.
 */
export default class SettingsScene extends Phaser.Scene {
  constructor() {
    super('Settings');
  }

  create(): void {
    const W = DESIGN_WIDTH;
    const H = DESIGN_HEIGHT;
    const save = getSave();
    getAnalytics().track('settings_opened');

    this.cameras.main.setBackgroundColor('#141a23');

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
      .text(W / 2, 54, 'SETTINGS', {
        fontFamily: FONT,
        fontSize: '26px',
        fontStyle: '700',
        color: '#f2f4f7',
        letterSpacing: 4,
      })
      .setOrigin(0.5);

    const rows: { root: Phaser.GameObjects.Container }[] = [];
    const addToggle = (y: number, label: string, key: 'sound' | 'music' | 'vibration' | 'mockAds') => {
      const row = makeToggleRow(this, y, label, save.snapshot.settings[key], (v) => {
        save.setSetting(key, v);
        syncAudioSettings();
        if (key !== 'mockAds') audio.play('tap');
      });
      this.add.existing(row.root);
      rows.push(row);
    };

    addToggle(200, 'Sound effects', 'sound');
    addToggle(272, 'Music', 'music');
    addToggle(344, 'Vibration', 'vibration');
    addToggle(416, 'Mock ads (dev)', 'mockAds');

    this.add
      .text(70, 462, 'Mock ads off = interstitials never interrupt play.', {
        fontFamily: FONT,
        fontSize: '13px',
        color: '#7d8b9e',
      })
      .setOrigin(0, 0);

    // Divider.
    const div = this.add.graphics();
    div.lineStyle(1, 0xffffff, 0.08);
    div.lineBetween(48, 510, W - 48, 510);

    const reset = makeTextButton(this, {
      width: 300,
      height: 56,
      label: 'RESET PROGRESS',
      fontSize: 18,
      color: 0x8a3f43,
      radius: 14,
      onClick: () => {
        audio.play('button');
        save.resetProgress();
        const toast = this.add
          .text(W / 2, 700, 'Progress reset', {
            fontFamily: FONT,
            fontSize: '16px',
            color: '#6fdca4',
          })
          .setOrigin(0.5);
        this.tweens.add({
          targets: toast,
          alpha: 0,
          delay: 900,
          duration: 400,
          onComplete: () => toast.destroy(),
        });
      },
    });
    reset.root.setPosition(W / 2, 566);

    const privacy = makeTextButton(this, {
      width: 300,
      height: 56,
      label: 'PRIVACY',
      fontSize: 18,
      color: PALETTE.panelLight,
      radius: 14,
      onClick: () => {
        audio.play('button');
        this.showPrivacy();
      },
    });
    privacy.root.setPosition(W / 2, 640);

    this.add
      .text(W / 2, H - 34, 'Remove Ads entitlement: not purchasable in MVP', {
        fontFamily: FONT,
        fontSize: '12px',
        color: '#5d6a7c',
      })
      .setOrigin(0.5);

    this.cameras.main.fadeIn(150, 10, 13, 18);
  }

  private showPrivacy(): void {
    const W = DESIGN_WIDTH;
    const dim = this.add
      .rectangle(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT, 0x000000, 0.6)
      .setOrigin(0)
      .setInteractive(
        new Phaser.Geom.Rectangle(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT),
        Phaser.Geom.Rectangle.Contains,
      );
    const panel = makePanel(this, 420, 300);
    panel.setPosition(W / 2, DESIGN_HEIGHT / 2);
    const title = this.add
      .text(0, -110, 'PRIVACY', {
        fontFamily: FONT,
        fontSize: '22px',
        fontStyle: '700',
        color: '#f2f4f7',
      })
      .setOrigin(0.5);
    const body = this.add
      .text(
        0,
        -10,
        'Placeholder.\n\nThis MVP stores progress only in your\nbrowser (localStorage). Analytics go to the\ndeveloper console. No data leaves the device.\n\nA real privacy policy lands before release.',
        {
          fontFamily: FONT,
          fontSize: '15px',
          color: '#aeb8c6',
          align: 'center',
          lineSpacing: 5,
        },
      )
      .setOrigin(0.5);
    const close = makeTextButton(this, {
      width: 200,
      height: 52,
      label: 'CLOSE',
      fontSize: 18,
      radius: 14,
      onClick: () => {
        audio.play('button');
        dim.destroy();
        panel.destroy(); // takes title, body and the close button with it
      },
    });
    close.root.setPosition(0, 110);
    panel.add([title, body, close.root]);
    dim.on('pointerup', () => {
      dim.destroy();
      panel.destroy();
    });
  }
}
