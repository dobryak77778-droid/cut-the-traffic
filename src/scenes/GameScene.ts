import Phaser from 'phaser';
import { CRASH, DESIGN_HEIGHT, DESIGN_WIDTH, SIM } from '../config/game';
import { getLevel, nextLevelId } from '../data/levels';
import type { LevelConfig, LightGroupDef } from '../types';
import { TrafficSim } from '../sim/trafficSim';
import { VehicleView } from '../render/vehicleView';
import { LightButton } from '../ui/LightButton';
import { FONT, PALETTE, makePanel, makeTextButton } from '../ui/widgets';
import { getSave, type SaveService } from '../services/save';
import { getAdService, type AdService } from '../services/ads';
import { getAnalytics } from '../services/analytics';
import { audio } from '../services/audio';
import { vibrate } from '../services/vibration';
import { createPhaserAdPresenter } from './AdOverlayScene';

export interface GameSceneData {
  levelId: number;
}

type SceneState = 'play' | 'cine' | 'celebrate' | 'panel' | 'transition';

const SLOT_POS: Record<'bl' | 'br' | 'tl' | 'tr', { x: number; y: number }> = {
  bl: { x: 74, y: DESIGN_HEIGHT - 92 },
  br: { x: DESIGN_WIDTH - 74, y: DESIGN_HEIGHT - 92 },
  tl: { x: 74, y: 158 },
  tr: { x: DESIGN_WIDTH - 74, y: 158 },
};

/**
 * The playable level scene: traffic sim + rendering + HUD + result panels.
 * Game logic lives in src/sim; this scene only drives it and presents state.
 */
export default class GameScene extends Phaser.Scene {
  private level!: LevelConfig;
  private sim!: TrafficSim;
  private save!: SaveService;
  private ads!: AdService;

  private state: SceneState = 'play';
  private views = new Map<number, VehicleView>();
  private buttons: LightButton[] = [];
  private panelRoot: Phaser.GameObjects.Container | null = null;

  private attempt = 1;
  private hadCollision = false;
  private continueUsed = false;
  private cineTime = 0;
  private cineReturnStarted = false;

  private timeText!: Phaser.GameObjects.Text;
  private leftText!: Phaser.GameObjects.Text;
  private hintText: Phaser.GameObjects.Text | null = null;
  private hintBg: Phaser.GameObjects.Graphics | null = null;

  constructor() {
    super('Game');
  }

  init(data: GameSceneData): void {
    this.level = getLevel(data.levelId ?? 1);
    this.state = 'play';
    this.views = new Map();
    this.buttons = [];
    this.panelRoot = null;
    this.hadCollision = false;
    this.continueUsed = false;
    this.cineTime = 0;
    this.cineReturnStarted = false;
    this.hintText = null;
    this.hintBg = null;
  }

  create(): void {
    this.save = getSave();
    this.ads = getAdService(this.save);
    this.ads.setPresenter(createPhaserAdPresenter(this));

    this.sim = new TrafficSim(this.level);
    this.attempt = this.save.registerAttempt(this.level.id);

    this.add.image(0, 0, 'world').setOrigin(0).setDepth(0);

    this.createLightButtons();
    this.createHud();
    this.showHint();

    audio.play('engine');
    getAnalytics().track('level_started', {
      level: this.level.id,
      attempt: this.attempt,
      vehicles: this.level.spawn.length,
    });

    this.cameras.main.fadeIn(160, 10, 13, 18);
    this.registerDebugApi();

    // Desktop convenience: R restarts (no equivalent needed on mobile).
    this.input.keyboard?.on('keydown-R', () => {
      if (this.state !== 'transition') this.restart();
    });
  }

  // ---------------------------------------------------------------- HUD ----
  private createHud(): void {
    const W = DESIGN_WIDTH;

    const menu = makeTextButton(this, {
      width: 88,
      height: 38,
      label: 'MENU',
      fontSize: 14,
      color: 0x2a3341,
      radius: 11,
      onClick: () => this.goToLevels(),
    });
    menu.root.setPosition(58, 40).setDepth(30);

    const retry = makeTextButton(this, {
      width: 88,
      height: 38,
      label: 'RETRY',
      fontSize: 14,
      color: 0x2a3341,
      radius: 11,
      onClick: () => this.restart(),
    });
    retry.root.setPosition(W - 58, 40).setDepth(30);

    this.add
      .text(W / 2, 22, `LEVEL ${this.level.id} · ${this.level.name.toUpperCase()}`, {
        fontFamily: FONT,
        fontSize: '12px',
        fontStyle: '600',
        color: '#93a1b3',
        letterSpacing: 1,
      })
      .setOrigin(0.5)
      .setDepth(30);

    this.timeText = this.add
      .text(W / 2, 46, '0.0s', {
        fontFamily: FONT,
        fontSize: '27px',
        fontStyle: '800',
        color: '#ffffff',
      })
      .setOrigin(0.5)
      .setDepth(30);

    this.leftText = this.add
      .text(W / 2, 74, `${this.level.spawn.length} CARS LEFT`, {
        fontFamily: FONT,
        fontSize: '12px',
        color: '#93a1b3',
        letterSpacing: 1,
      })
      .setOrigin(0.5)
      .setDepth(30);
  }

  private createLightButtons(): void {
    for (const group of this.level.groups) {
      const pos = SLOT_POS[group.slot];
      const btn = new LightButton(this, group, pos.x, pos.y, () => this.tapGroup(group));
      btn.root.setDepth(25);
      this.buttons.push(btn);
    }
  }

  private showHint(): void {
    const W = DESIGN_WIDTH;
    const y = DESIGN_HEIGHT - 210;
    this.hintBg = this.add.graphics().setDepth(26);
    this.hintBg.fillStyle(0x0f141b, 0.82);
    const label = this.level.hint;
    const w = Math.max(200, label.length * 12 + 56);
    this.hintBg.fillRoundedRect(W / 2 - w / 2, y - 20, w, 40, 20);

    this.hintText = this.add
      .text(W / 2, y, label, {
        fontFamily: FONT,
        fontSize: '16px',
        fontStyle: '700',
        color: '#f5a524',
        letterSpacing: 1,
      })
      .setOrigin(0.5)
      .setDepth(26);

    this.tweens.add({
      targets: [this.hintBg, this.hintText],
      alpha: 0,
      delay: 2400,
      duration: 500,
      onComplete: () => {
        this.hintBg?.destroy();
        this.hintText?.destroy();
        this.hintBg = null;
        this.hintText = null;
      },
    });
  }

  private updateHud(): void {
    this.timeText.setText(`${this.sim.displayTime.toFixed(1)}s`);
    this.leftText.setText(`${this.sim.remaining} CARS LEFT`);
  }

  private refreshButtons(): void {
    for (const btn of this.buttons) {
      const pending = this.sim.lights.isPending(btn.group);
      const green = this.sim.lights.groupState(btn.group) === 'green';
      btn.setState(pending ? 'pending' : green ? 'green' : 'red');
    }
  }

  private tapGroup(group: LightGroupDef): void {
    if (this.state !== 'play') return;
    const changed = this.sim.toggleGroup(group);
    if (changed) {
      audio.play('switchLight');
      vibrate(20);
      this.refreshButtons();
    }
  }

  // -------------------------------------------------------------- views ----
  private syncViews(dt: number): void {
    const active = new Set<number>();
    for (const ev of this.sim.vehicles) {
      active.add(ev.id);
      let view = this.views.get(ev.id);
      if (!view) {
        view = new VehicleView(this, ev, this.level.layout);
        this.views.set(ev.id, view);
      }
      if (ev.crashed) view.markCrashed();
      view.sync(ev, this.level.layout, dt);
    }
    for (const [id, view] of this.views) {
      if (!active.has(id)) {
        view.destroy();
        this.views.delete(id);
      }
    }
  }

  private clearViews(): void {
    for (const view of this.views.values()) view.destroy();
    this.views.clear();
  }

  // -------------------------------------------------------------- loop -----
  update(_time: number, delta: number): void {
    for (const btn of this.buttons) btn.update(delta);

    switch (this.state) {
      case 'play': {
        this.sim.update(delta / 1000);
        if (this.sim.lights.justApplied) audio.play('tap');
        this.syncViews(delta / 1000);
        this.refreshButtons();
        this.updateHud();
        if (this.sim.phase === 'crash') this.beginCrash();
        else if (this.sim.phase === 'complete') this.beginComplete();
        break;
      }
      case 'cine': {
        this.cineTime += delta;
        this.sim.stepCinematic((delta / 1000) * CRASH.slowmoScale);
        this.syncViews((delta / 1000) * CRASH.slowmoScale);
        if (!this.cineReturnStarted && this.cineTime >= 350) {
          this.cineReturnStarted = true;
          this.tweens.add({
            targets: this.cameras.main,
            zoom: 1,
            scrollX: 0,
            scrollY: 0,
            duration: 300,
            ease: 'Cubic.easeInOut',
          });
        }
        if (this.cineTime >= CRASH.slowmoDurationMs) this.showFailPanel();
        break;
      }
      case 'celebrate':
      case 'panel':
      case 'transition':
        break;
    }
  }

  // ------------------------------------------------------------- crash -----
  private beginCrash(): void {
    this.state = 'cine';
    this.hadCollision = true;
    this.cineTime = 0;
    this.cineReturnStarted = false;

    const crash = this.sim.crash!;
    audio.stopEngine();
    audio.play('crash');
    vibrate([90, 40, 90]);

    getAnalytics().track('level_failed', {
      level: this.level.id,
      attempt: this.attempt,
      failureTime: round1(this.sim.displayTime),
      vehicleTypeA: crash.a.type,
      vehicleTypeB: crash.b.type,
    });

    const cam = this.cameras.main;
    cam.shake(CRASH.shakeDurationMs, CRASH.shakeIntensity);
    const targetX = crash.x - DESIGN_WIDTH / 2 / CRASH.zoom;
    const targetY = crash.y - DESIGN_HEIGHT / 2 / CRASH.zoom;
    this.tweens.add({
      targets: cam,
      zoom: CRASH.zoom,
      scrollX: targetX,
      scrollY: targetY,
      duration: 340,
      ease: 'Cubic.easeOut',
    });

    // Impact burst.
    const burst = this.add
      .image(crash.x, crash.y, 'starburst')
      .setDepth(16)
      .setTint(0xffb347)
      .setScale(0.25)
      .setAlpha(0.95);
    this.tweens.add({
      targets: burst,
      scale: 1.25,
      alpha: 0,
      angle: 24,
      duration: 620,
      ease: 'Cubic.easeOut',
      onComplete: () => burst.destroy(),
    });

    this.add
      .particles(crash.x, crash.y, 'spark', {
        speed: { min: 70, max: 260 },
        lifespan: { min: 300, max: 620 },
        quantity: 16,
        scale: { start: 0.75, end: 0 },
        tint: [0xffd166, 0xffffff, 0xff8c42],
        emitting: false,
      })
      .setDepth(16)
      .explode();

    // Brief white flash.
    const flash = this.add
      .rectangle(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT, 0xffffff, 0.5)
      .setOrigin(0)
      .setDepth(40);
    this.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 340,
      onComplete: () => flash.destroy(),
    });
  }

  private showFailPanel(): void {
    this.state = 'panel';
    this.cameras.main.setScroll(0, 0);
    this.cameras.main.setZoom(1);

    const W = DESIGN_WIDTH;
    const panel = makePanel(this, 440, 392);
    panel.setPosition(W / 2, DESIGN_HEIGHT / 2 + 8).setDepth(50);

    const title = this.add
      .text(0, -152, 'CRASH!', {
        fontFamily: FONT,
        fontSize: '44px',
        fontStyle: '800',
        color: '#ff6b5e',
        stroke: '#4a1512',
        strokeThickness: 3,
      })
      .setOrigin(0.5);
    const sub = this.add
      .text(0, -108, 'Two cars collided in the junction', {
        fontFamily: FONT,
        fontSize: '16px',
        color: '#aeb8c6',
      })
      .setOrigin(0.5);
    const survived = this.add
      .text(0, -74, `SURVIVED ${this.sim.displayTime.toFixed(1)}s`, {
        fontFamily: FONT,
        fontSize: '14px',
        fontStyle: '600',
        color: '#93a1b3',
        letterSpacing: 1,
      })
      .setOrigin(0.5);

    const retry = makeTextButton(this, {
      width: 310,
      height: 66,
      label: 'RETRY',
      fontSize: 26,
      radius: 16,
      onClick: () => this.restart(),
    });
    retry.root.setPosition(0, -8);

    const children: Phaser.GameObjects.GameObject[] = [title, sub, survived, retry.root];

    // Rewarded-ad continue (optional, once per attempt, never forced).
    const canContinue = !this.continueUsed && this.ads.isRewardedAdAvailable() && this.sim.hasHistory;
    if (canContinue) {
      getAnalytics().track('rewarded_offer_shown', {
        level: this.level.id,
        attempt: this.attempt,
      });
      const rewarded = makeTextButton(this, {
        width: 310,
        height: 58,
        label: 'CONTINUE  ·  WATCH AD',
        fontSize: 18,
        color: 0x2f7d55,
        radius: 15,
        onClick: () => void this.onRewardedContinue(),
      });
      rewarded.root.setPosition(0, 72);
      children.push(rewarded.root);
    }

    const toLevels = makeTextButton(this, {
      width: 150,
      height: 44,
      label: 'LEVELS',
      fontSize: 15,
      color: PALETTE.panelLight,
      radius: 12,
      onClick: () => this.goToLevels(),
    });
    toLevels.root.setPosition(0, 146);
    children.push(toLevels.root);

    for (const c of children) panel.add(c);
    panel.setScale(0.92).setAlpha(0);
    this.tweens.add({
      targets: panel,
      scale: 1,
      alpha: 1,
      duration: 170,
      ease: 'Back.easeOut',
    });
    this.panelRoot = panel;
  }

  // ---------------------------------------------------------- rewarded -----
  private async onRewardedContinue(): Promise<void> {
    getAnalytics().track('rewarded_offer_accepted', {
      level: this.level.id,
      attempt: this.attempt,
    });
    const result = await this.ads.showRewardedAd();
    if (this.scene.isPaused()) this.scene.resume();
    if (!result.rewarded) return;

    getAnalytics().track('rewarded_completed', {
      level: this.level.id,
      attempt: this.attempt,
    });
    this.continueUsed = true;
    audio.play('rewarded');
    vibrate([40, 60, 40]);

    const restored = this.sim.restoreForContinue();
    if (!restored) {
      // Fallback (documented): plain restart – snapshots exist for any level
      // that ran longer than ~0.2s, so this is a safety net only.
      this.sim.reset();
      this.hadCollision = false;
    }

    this.panelRoot?.destroy();
    this.panelRoot = null;
    this.clearViews();
    this.state = 'play';
    audio.play('engine');
    this.refreshButtons();
    this.updateHud();

    const toast = this.add
      .text(DESIGN_WIDTH / 2, DESIGN_HEIGHT / 2 - 60, 'GO!', {
        fontFamily: FONT,
        fontSize: '54px',
        fontStyle: '800',
        color: '#6fdca4',
        stroke: '#0f2a1d',
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(60);
    toast.setScale(0.4);
    this.tweens.add({
      targets: toast,
      scale: 1.1,
      duration: 260,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.tweens.add({
          targets: toast,
          alpha: 0,
          delay: 500,
          duration: 300,
          onComplete: () => toast.destroy(),
        });
      },
    });
  }

  // ----------------------------------------------------------- complete ----
  private beginComplete(): void {
    this.state = 'celebrate';
    audio.stopEngine();

    const time = this.sim.displayTime;
    const perfect = !this.hadCollision && this.sim.maxStopTime <= SIM.perfectStopTolerance;
    const grade = gradeFor(time, this.level.parTime);

    const prevBest = this.save.bestTime(this.level.id);
    const unlockedNew = this.save.completeLevel(this.level.id, time);
    const newBest = prevBest === undefined ? false : time < prevBest;

    this.save.noteLevelCompletedForAds();

    getAnalytics().track('level_completed', {
      level: this.level.id,
      attempt: this.attempt,
      completionTime: round1(time),
      grade,
      perfect,
    });
    if (perfect) {
      getAnalytics().track('perfect_flow', {
        level: this.level.id,
        attempt: this.attempt,
        completionTime: round1(time),
      });
      audio.play('perfect');
    } else {
      audio.play('levelComplete');
    }
    vibrate([35, 55, 35]);

    // Celebration particles (restrained).
    this.add
      .particles(DESIGN_WIDTH / 2, -10, 'spark', {
        x: { min: -220, max: 220 },
        y: { min: 0, max: 120 },
        speed: { min: 40, max: 130 },
        lifespan: 1400,
        quantity: 1,
        frequency: 90,
        scale: { start: 0.5, end: 0 },
        tint: [0xf2c14e, 0xffffff, 0x6fdca4],
        rotate: { min: 0, max: 180 },
        emitting: false,
      })
      .setDepth(40)
      .explode(perfect ? 30 : 18);

    this.time.delayedCall(420, () => this.showWinPanel(perfect, grade, newBest, unlockedNew, time));
  }

  private showWinPanel(
    perfect: boolean,
    grade: string,
    newBest: boolean,
    unlockedNew: boolean,
    time: number,
  ): void {
    this.state = 'panel';
    const W = DESIGN_WIDTH;
    const panel = makePanel(this, 440, 430);
    panel.setPosition(W / 2, DESIGN_HEIGHT / 2).setDepth(50);

    const title = this.add
      .text(0, -170, perfect ? 'PERFECT FLOW' : 'LEVEL COMPLETE', {
        fontFamily: FONT,
        fontSize: perfect ? '36px' : '30px',
        fontStyle: '800',
        color: perfect ? '#f2c14e' : '#ffffff',
        letterSpacing: perfect ? 2 : 1,
      })
      .setOrigin(0.5);
    panel.add(title);

    if (perfect) {
      panel.add(
        this.add
          .text(0, -136, 'LEVEL COMPLETE', {
            fontFamily: FONT,
            fontSize: '15px',
            fontStyle: '600',
            color: '#93a1b3',
            letterSpacing: 3,
          })
          .setOrigin(0.5),
      );
    }

    const timeText = this.add
      .text(-16, -74, `${time.toFixed(1)}s`, {
        fontFamily: FONT,
        fontSize: '52px',
        fontStyle: '800',
        color: '#ffffff',
      })
      .setOrigin(0.5);
    panel.add(timeText);

    // Grade badge.
    const badgeColor =
      grade === 'S' ? 0xf2c14e : grade === 'A' ? 0x2fbf71 : grade === 'B' ? 0x4a9de0 : 0x77839a;
    const badge = this.add.graphics();
    badge.fillStyle(badgeColor, 1);
    badge.fillCircle(96, -74, 32);
    badge.lineStyle(3, 0xffffff, 0.5);
    badge.strokeCircle(96, -74, 32);
    panel.add(badge);
    panel.add(
      this.add
        .text(96, -74, grade, {
          fontFamily: FONT,
          fontSize: '34px',
          fontStyle: '800',
          color: '#1b212b',
        })
        .setOrigin(0.5),
    );

    const parText = this.add
      .text(0, -26, `PAR ${this.level.parTime.toFixed(0)}s`, {
        fontFamily: FONT,
        fontSize: '14px',
        color: '#93a1b3',
        letterSpacing: 1,
      })
      .setOrigin(0.5);
    panel.add(parText);

    const statusMsg = unlockedNew
      ? `LEVEL ${this.level.id + 1} UNLOCKED`
      : newBest
        ? 'NEW BEST TIME'
        : '';
    if (statusMsg) {
      panel.add(
        this.add
          .text(0, 4, statusMsg, {
            fontFamily: FONT,
            fontSize: '16px',
            fontStyle: '700',
            color: '#6fdca4',
          })
          .setOrigin(0.5),
      );
    }

    const cont = makeTextButton(this, {
      width: 310,
      height: 66,
      label: 'CONTINUE',
      fontSize: 25,
      radius: 16,
      onClick: () => void this.onContinue(),
    });
    cont.root.setPosition(0, 66);
    panel.add(cont.root);

    const replay = makeTextButton(this, {
      width: 146,
      height: 52,
      label: 'REPLAY',
      fontSize: 16,
      color: PALETTE.panelLight,
      radius: 13,
      onClick: () => this.restart(),
    });
    replay.root.setPosition(-82, 144);
    panel.add(replay.root);

    const toLevels = makeTextButton(this, {
      width: 146,
      height: 52,
      label: 'LEVELS',
      fontSize: 16,
      color: PALETTE.panelLight,
      radius: 13,
      onClick: () => this.goToLevels(),
    });
    toLevels.root.setPosition(82, 144);
    panel.add(toLevels.root);

    panel.setScale(0.92).setAlpha(0);
    this.tweens.add({
      targets: panel,
      scale: 1,
      alpha: 1,
      duration: 180,
      ease: 'Back.easeOut',
    });
    this.panelRoot = panel;
  }

  private async onContinue(): Promise<void> {
    if (this.state === 'transition') return;
    this.state = 'transition';
    audio.play('button');

    // Natural transition point – the central scheduler decides.
    await this.ads.showInterstitialIfEligible();
    if (this.scene.isPaused()) this.scene.resume();

    const next = nextLevelId(this.level.id);
    this.cameras.main.fadeOut(150, 10, 13, 18);
    this.time.delayedCall(165, () => {
      if (next) this.scene.start('Game', { levelId: next });
      else this.scene.start('LevelSelect');
    });
  }

  // ------------------------------------------------------------- restart ---
  private restart(): void {
    audio.play('button');
    this.attempt = this.save.registerAttempt(this.level.id);
    getAnalytics().track('level_restarted', {
      level: this.level.id,
      attempt: this.attempt,
      afterFailure: this.hadCollision,
    });
    this.resetWorld();
    this.cameras.main.flash(90, 235, 242, 250);
  }

  private resetWorld(): void {
    this.panelRoot?.destroy();
    this.panelRoot = null;
    this.clearViews();
    this.sim.reset();
    this.state = 'play';
    this.hadCollision = false;
    this.continueUsed = false;
    this.cineTime = 0;
    this.cineReturnStarted = false;
    this.cameras.main.setZoom(1);
    this.cameras.main.setScroll(0, 0);
    this.refreshButtons();
    this.updateHud();
    audio.play('engine');
  }

  private goToLevels(): void {
    if (this.state === 'transition') return;
    this.state = 'transition';
    audio.play('button');
    audio.stopEngine();
    this.cameras.main.fadeOut(140, 10, 13, 18);
    this.time.delayedCall(150, () => this.scene.start('LevelSelect'));
  }

  // --------------------------------------------------------------- debug ---
  private registerDebugApi(): void {
    const api = {
      levelId: this.level.id,
      debugState: () => this.sim.debugState(),
      uiState: () => ({
        state: this.state,
        attempt: this.attempt,
        hadCollision: this.hadCollision,
        continueUsed: this.continueUsed,
        hasPanel: this.panelRoot !== null,
        groups: this.level.groups.map((g) => ({
          id: g.id,
          slot: g.slot,
          directions: g.directions,
        })),
      }),
      tap: (id: string) => {
        const g = this.level.groups.find((x) => x.id === id);
        if (g) this.tapGroup(g);
        return this.sim.lights.serialize();
      },
      restart: () => this.restart(),
      /**
       * Deterministic collision for E2E: clear the junction and launch one
       * eastbound and one northbound car at the crossing point together.
       */
      forceCrash: () => {
        const L = this.level.layout;
        const origin = { E: -96, W: L.width + 96, S: -96, N: L.height + 96 };
        const sE = L.centerX + L.laneOffset - origin.E; // E through N's lane
        const sN = origin.N - (L.centerY + L.laneOffset); // N through E's lane
        this.sim.debugClear();
        this.sim.debugPlace('car', 'E', Math.max(0, sE - 55), 165);
        this.sim.debugPlace('truck', 'N', Math.max(0, sN - 55), 165);
        return this.sim.debugState();
      },
      setLight: (dir: 'E' | 'W' | 'N' | 'S', state: 'red' | 'green') => {
        const g = this.level.groups.find((x) => x.directions.includes(dir));
        if (g) {
          this.sim.lights.setGroupState(g, state);
          this.refreshButtons();
        }
      },
    };
    (globalThis as unknown as { __CTT__: unknown }).__CTT__ = api;
  }
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

function gradeFor(time: number, par: number): string {
  if (time <= par) return 'S';
  if (time <= par * 1.15) return 'A';
  if (time <= par * 1.4) return 'B';
  return 'C';
}
