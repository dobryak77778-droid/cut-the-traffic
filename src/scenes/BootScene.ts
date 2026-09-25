import Phaser from 'phaser';
import { LAYOUT } from '../data/levels/common';
import { paintWorld } from '../render/worldArt';
import {
  buildAmbulanceLightTextures,
  buildShadowTexture,
  buildSparkTexture,
  buildStarburstTexture,
  buildVehicleTextures,
} from '../render/vehicleArt';
import { audio } from '../services/audio';
import { syncAudioSettings } from '../services/audioConfig';

/** Generates all procedural textures, then moves to the menu. */
export default class BootScene extends Phaser.Scene {
  private startedMenu = false;

  constructor() {
    super('Boot');
  }

  preload(): void {
    // Nothing to load – every asset is generated at runtime.
  }

  create(): void {
    // World background (all MVP levels share one layout).
    const world = this.add.graphics();
    paintWorld(world, LAYOUT);
    world.generateTexture('world', LAYOUT.width, LAYOUT.height);
    world.destroy();

    buildVehicleTextures(this);
    buildAmbulanceLightTextures(this);
    buildShadowTexture(this);
    buildSparkTexture(this);
    buildStarburstTexture(this);

    syncAudioSettings();
    this.input.once('pointerdown', () => {
      audio.unlock();
      syncAudioSettings(); // music may be waiting for a gesture
    });

    // Wait for the bundled web font so the first text we draw isn't a
    // fallback face (bounded to 900ms so loading never feels stuck).
    const startMenu = () => {
      if (this.scene.isActive() && !this.startedMenu) {
        this.startedMenu = true;
        this.scene.start('Menu');
      }
    };
    if (typeof document !== 'undefined' && document.fonts?.ready) {
      void document.fonts.ready.then(startMenu);
      this.time.delayedCall(900, startMenu);
    } else {
      startMenu();
    }
  }
}
