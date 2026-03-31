import Phaser from 'phaser';
import RAPIER from '@dimforge/rapier2d-compat';
import { GameScene } from './scenes/GameScene';
import { MenuScene } from './scenes/MenuScene';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from './config';

await RAPIER.init();

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: CANVAS_WIDTH,
  height: CANVAS_HEIGHT,
  backgroundColor: '#020210',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.NO_CENTER,
  },
  scene: [MenuScene, GameScene],
};

new Phaser.Game(config);
