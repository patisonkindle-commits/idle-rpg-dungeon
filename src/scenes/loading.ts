import Phaser from 'phaser';

export class LoadingScene extends Phaser.Scene {
    constructor() {
        super({ key: 'LoadingScene' });
    }

    preload() {
        // No external assets needed — everything is procedural
        const loadingText = this.add.text(400, 480, 'Loading...', {
            fontSize: '24px',
            color: '#ffffff'
        }).setOrigin(0.5);
    }

    create() {
        this.scene.start('GameState');
    }
}
