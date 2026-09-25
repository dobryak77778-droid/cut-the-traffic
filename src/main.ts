import Phaser from 'phaser';
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/700.css';
import '@fontsource/roboto/900.css';
import { DESIGN_HEIGHT, DESIGN_WIDTH } from './config/game';
import { LEVELS } from './data/levels';
import BootScene from './scenes/BootScene';
import GameScene from './scenes/GameScene';
import LevelSelectScene from './scenes/LevelSelectScene';
import MenuScene from './scenes/MenuScene';
import SettingsScene from './scenes/SettingsScene';
import AdOverlayScene from './scenes/AdOverlayScene';
import { syncAudioSettings } from './services/audioConfig';

/**
 * Cut the Traffic – entry point.
 * Portrait-first 9:16 design that scales to any viewport (FIT + centre).
 */
const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game-container',
  width: DESIGN_WIDTH,
  height: DESIGN_HEIGHT,
  backgroundColor: '#12161d',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  render: {
    antialias: true,
    powerPreference: 'high-performance',
  },
  fps: {
    target: 60,
    smoothStep: true,
  },
  scene: [
    BootScene,
    MenuScene,
    LevelSelectScene,
    SettingsScene,
    AdOverlayScene,
    GameScene,
  ],
});

syncAudioSettings();

// Exposed for E2E tooling and dev console inspection.
(globalThis as unknown as { __CTT_GAME__: unknown }).__CTT_GAME__ = game;

export default game;
