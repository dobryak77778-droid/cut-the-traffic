import Phaser from 'phaser';
import { DESIGN_HEIGHT, DESIGN_WIDTH } from '../config/game';
import type { AdPresenter } from '../services/ads';
import { audio } from '../services/audio';
import { FONT, PALETTE, makeTextButton } from '../ui/widgets';

export interface AdOverlayData {
  mode: 'interstitial' | 'rewarded';
  durationMs: number;
  resolve: (rewarded: boolean) => void;
}

/**
 * Mock ad overlay. Clearly labelled as a placeholder – it can never be
 * mistaken for a real ad, and it never appears unless the developer enabled
 * "Mock ads (dev)" (interstitial) or the player volunteered (rewarded).
 */
export default class AdOverlayScene extends Phaser.Scene {
  constructor() {
    super('AdOverlay');
  }

  create(data: AdOverlayData): void {
    const W = DESIGN_WIDTH;
    const H = DESIGN_HEIGHT;
    let settled = false;
    const settle = (rewarded: boolean) => {
      if (settled) return;
      settled = true;
      data.resolve(rewarded);
      this.scene.stop();
    };

    this.add.rectangle(0, 0, W, H, 0x05070a, 0.92).setOrigin(0);
    const card = this.add.graphics();
    card.fillStyle(PALETTE.panel, 1);
    card.fillRoundedRect(50, H / 2 - 190, W - 100, 380, 22);
    card.lineStyle(2, 0xffffff, 0.1);
    card.strokeRoundedRect(50, H / 2 - 190, W - 100, 380, 22);

    this.add
      .text(W / 2, H / 2 - 158, 'MOCK AD · DEV PLACEHOLDER', {
        fontFamily: FONT,
        fontSize: '13px',
        fontStyle: '700',
        color: '#f5a524',
        letterSpacing: 2,
      })
      .setOrigin(0.5);

    this.add
      .text(
        W / 2,
        H / 2 - 90,
        data.mode === 'rewarded' ? 'Rewarded video\nplaceholder' : 'Interstitial\nplaceholder',
        {
          fontFamily: FONT,
          fontSize: '30px',
          fontStyle: '700',
          color: '#f2f4f7',
          align: 'center',
          lineSpacing: 4,
        },
      )
      .setOrigin(0.5);

    this.add
      .text(
        W / 2,
        H / 2 + 58,
        data.mode === 'rewarded'
          ? 'A real build would play a 15–30s video here.\nReward is granted automatically.'
          : 'A real build would show an AdMob interstitial.\nThis dev mock never runs unless enabled.',
        {
          fontFamily: FONT,
          fontSize: '14px',
          color: '#93a1b3',
          align: 'center',
          lineSpacing: 4,
        },
      )
      .setOrigin(0.5);

    // Countdown + progress.
    const total = Math.max(1, data.durationMs / 1000);
    const countText = this.add
      .text(W / 2, H / 2 - 6, String(Math.ceil(total)), {
        fontFamily: FONT,
        fontSize: '46px',
        fontStyle: '800',
        color: '#ffffff',
      })
      .setOrigin(0.5);

    const barBg = this.add.graphics();
    barBg.fillStyle(0x0f141b, 1);
    barBg.fillRoundedRect(90, H / 2 + 108, W - 180, 14, 7);
    const barFill = this.add.graphics();

    const start = this.time.now;
    this.time.addEvent({
      delay: 40,
      loop: true,
      callback: () => {
        const elapsed = this.time.now - start;
        const p = Math.min(1, elapsed / data.durationMs);
        barFill.clear();
        barFill.fillStyle(PALETTE.accent, 1);
        barFill.fillRoundedRect(90, H / 2 + 108, Math.max(14, (W - 180) * p), 14, 7);
        countText.setText(String(Math.max(0, Math.ceil(total - elapsed / 1000))));
        if (p >= 1) settle(true);
      },
    });

    if (data.mode === 'interstitial') {
      const close = makeTextButton(this, {
        width: 220,
        height: 56,
        label: 'CLOSE (AFTER TIMER)',
        fontSize: 15,
        color: PALETTE.panelLight,
        radius: 14,
        onClick: () => settle(true),
      });
      close.root.setPosition(W / 2, H / 2 + 168);
      close.setEnabled(false);
      this.time.delayedCall(data.durationMs, () => close.setEnabled(true));
    } else {
      const cancel = makeTextButton(this, {
        width: 260,
        height: 52,
        label: 'CANCEL · NO REWARD',
        fontSize: 15,
        color: 0x8a3f43,
        radius: 14,
        onClick: () => settle(false),
      });
      cancel.root.setPosition(W / 2, H / 2 + 168);
      this.time.delayedCall(data.durationMs - 400, () => cancel.setEnabled(false));
      audio.play('tap');
    }
  }
}

/**
 * Bridges the mock AdService to the overlay scene. Fail-open: if the scene
 * cannot be launched the interstitial is skipped and the rewarded ad still
 * grants its reward (never block a player who opted in).
 */
export function createPhaserAdPresenter(scene: Phaser.Scene): AdPresenter {
  return {
    presentInterstitial(durationMs: number): Promise<void> {
      return new Promise((resolve) => {
        try {
          scene.scene.launch('AdOverlay', {
            mode: 'interstitial',
            durationMs,
            resolve: () => resolve(),
          });
          scene.scene.pause();
          const resume = () => {
            if (scene.scene.isPaused()) scene.scene.resume();
          };
          // Resume once the overlay stops.
          const check = setInterval(() => {
            if (!scene.scene.isActive('AdOverlay')) {
              clearInterval(check);
              resume();
            }
          }, 80);
        } catch {
          resolve();
        }
      });
    },
    presentRewarded(durationMs: number): Promise<boolean> {
      return new Promise((resolve) => {
        try {
          scene.scene.launch('AdOverlay', {
            mode: 'rewarded',
            durationMs,
            resolve: (rewarded: boolean) => resolve(rewarded),
          });
          scene.scene.pause();
          const check = setInterval(() => {
            if (!scene.scene.isActive('AdOverlay')) {
              clearInterval(check);
              if (scene.scene.isPaused()) scene.scene.resume();
            }
          }, 80);
        } catch {
          resolve(true);
        }
      });
    },
  };
}
