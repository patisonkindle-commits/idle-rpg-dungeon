import Phaser from 'phaser';
import { LoadingScene } from './scenes/loading';
import { GameState } from './scenes/game-state';

const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    width: 800,
    height: 1000,
    parent: 'app',
    backgroundColor: '#0d0d1a',
    scene: [LoadingScene, GameState]
};

const game = new Phaser.Game(config);
