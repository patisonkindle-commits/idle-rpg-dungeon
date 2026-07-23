import Phaser from 'phaser';

export class LoadingScene extends Phaser.Scene {
    constructor() {
        super({ key: 'LoadingScene' });
    }

    preload() {
        this.load.image('bg', 'assets/bg.png');
        this.load.image('hero', 'assets/hero.png');
        this.load.image('enemy', 'assets/enemy.png');
    }

    create() {
        this.scene.start('GameState');
    }
}
