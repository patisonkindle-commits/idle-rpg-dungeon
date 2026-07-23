import Phaser from 'phaser';
import Dungeon from 'dungeon-generator';

interface Hero {
    x: number;
    y: number;
    hp: number;
    maxHp: number;
    attack: number;
    defense: number;
    level: number;
    exp: number;
    expToNext: number;
    gold: number;
    classLabel: string;
}

interface Enemy {
    hp: number;
    maxHp: number;
    attack: number;
    defense: number;
    type: string;
}

export class GameState extends Phaser.Scene {
    private heroes: Hero[] = [];
    private enemies: Enemy[] = [];
    private dungeon: any = null;
    private currentRoom: any = null;
    private roomTag: string = 'start';
    private level: number = 1;
    private gold: number = 0;
    private killed: number = 0;
    private timer: Phaser.Time.TimerEvent | null = null;
    private hudTexts: Phaser.GameObjects.Text[] = [];
    private heroSprites: Phaser.GameObjects.Text[] = [];
    private logText!: Phaser.GameObjects.Text;
    private minimapGraphics!: Phaser.GameObjects.Graphics;
    private isInCombat: boolean = false;
    private totalTicks: number = 0;

    constructor() {
        super({ key: 'GameState' });
    }

    create() {
        this.totalTicks = 0;
        this.isInCombat = false;

        // Initialize heroes
        this.heroes = [
            { x: 400, y: 300, hp: 100, maxHp: 100, attack: 15, defense: 5, level: 1, exp: 0, expToNext: 50, gold: 0, classLabel: '⚔️' },
            { x: 440, y: 300, hp: 80, maxHp: 80, attack: 12, defense: 3, level: 1, exp: 0, expToNext: 50, gold: 0, classLabel: '🔮' },
            { x: 480, y: 300, hp: 70, maxHp: 70, attack: 18, defense: 2, level: 1, exp: 0, expToNext: 50, gold: 0, classLabel: '🗡️' }
        ];

        // Background
        this.cameras.main.setBackgroundColor('#0d0d1a');

        // Generate dungeon
        this.generateDungeon();

        // Setup hero sprites
        this.heroSprites = [];
        for (let i = 0; i < this.heroes.length; i++) {
            const t = this.add.text(this.heroes[i].x, this.heroes[i].y, this.heroes[i].classLabel, { fontSize: '28px' });
            t.setOrigin(0.5);
            t.setDepth(10);
            this.heroSprites.push(t);
        }

        // Log area
        this.logText = this.add.text(10, 940, '', {
            fontSize: '12px',
            color: '#aaaaaa'
        }).setDepth(100);

        // Minimap
        this.minimapGraphics = this.add.graphics();
        this.minimapGraphics.setPosition(600, 40);
        this.minimapGraphics.setDepth(5);

        // Setup idle tick
        this.timer = this.time.addEvent({
            delay: 1500,
            callback: () => this.idleTick(),
            loop: true
        });
    }

    private log(msg: string) {
        this.logText.setText(msg);
    }

    private generateDungeon() {
        const seed = `level${this.level}_${Date.now()}`;
        this.dungeon = new Dungeon({
            size: [60, 60],
            seed: seed,
            rooms: {
                initial: {
                    min_size: [5, 5],
                    max_size: [7, 7],
                    max_exits: 3,
                    position: [30, 30]
                },
                any: {
                    min_size: [4, 4],
                    max_size: [8, 8],
                    max_exits: 4
                }
            },
            max_corridor_length: 6,
            min_corridor_length: 2,
            corridor_density: 0.35,
            symmetric_rooms: false,
            interconnects: 1,
            max_interconnect_length: 8,
            room_count: Math.min(8 + Math.floor(this.level * 0.5), 18)
        });
        this.dungeon.generate();

        // Tag rooms
        for (const piece of this.dungeon.children) {
            if (piece.tag === 'initial') {
                piece.tag = 'start';
            } else {
                const rng = Math.random();
                if (rng < 0.08) piece.tag = 'treasure';
                else if (rng < 0.13) piece.tag = 'shop';
                else if (rng < 0.17) piece.tag = 'rest';
                else if (rng < 0.05 && this.level % 5 === 0) piece.tag = 'boss';
                else piece.tag = 'normal';
            }
        }

        this.currentRoom = this.dungeon.children[0];
        this.roomTag = 'start';
    }

    private idleTick() {
        this.totalTicks++;

        // Check if all heroes are dead
        if (this.heroes.every(h => h.hp <= 0)) {
            this.log('💀 All heroes dead! Restarting...');
            this.scene.restart();
            return;
        }

        this.isInCombat = true;

        // Resolve room event
        if (this.roomTag === 'treasure') {
            const amt = 50 + Math.floor(Math.random() * 50);
            this.gainGold(amt);
            this.log(`💰 Treasure room! Gained ${amt} gold`);
        } else if (this.roomTag === 'rest') {
            this.healParty();
            this.log('🛌 Resting... HP recovered!');
        } else if (this.roomTag === 'shop') {
            this.gainGold(20);
            this.healParty();
            this.log('🏪 Shop! Bought potions, +20 HP all, +20 gold');
        } else if (this.roomTag === 'boss') {
            this.resolveBossCombat();
            return; // combat might continue
        } else {
            // normal room
            this.resolveNormalCombat();
        }

        // Advance to next room
        this.advanceRoom();
        this.renderMinimap();
        this.renderHUD();
        this.isInCombat = false;
    }

    private resolveNormalCombat() {
        const count = 1 + Math.floor(Math.random() * 2);
        this.enemies = [];
        for (let i = 0; i < count; i++) {
            this.enemies.push({
                hp: 30 + this.level * 8,
                maxHp: 30 + this.level * 8,
                attack: 8 + this.level * 2,
                defense: 2 + this.level,
                type: '👾'
            });
        }

        // Auto-resolve combat
        let rounds = 0;
        while (this.enemies.some(e => e.hp > 0) && this.heroes.some(h => h.hp > 0) && rounds < 20) {
            rounds++;
            // Heroes attack
            for (const hero of this.heroes) {
                if (hero.hp <= 0) continue;
                const target = this.enemies.find(e => e.hp > 0);
                if (!target) break;
                const dmg = Math.max(1, hero.attack + Math.floor(Math.random() * 7) - 3 - target.defense);
                target.hp -= dmg;
            }
            // Enemies attack
            for (const enemy of this.enemies) {
                if (enemy.hp <= 0) continue;
                const alive = this.heroes.filter(h => h.hp > 0);
                if (alive.length === 0) break;
                const target = alive[Math.floor(Math.random() * alive.length)];
                const dmg = Math.max(1, enemy.attack - target.defense + Math.floor(Math.random() * 4));
                target.hp -= dmg;
            }
        }

        const expGained = 15 + this.level * 5;
        this.gainExp(expGained);
        const goldGained = 20 + this.level * 8;
        this.gainGold(goldGained);
        this.killed += this.enemies.length;

        this.log(`⚔️ Win! +${expGained} exp, +${goldGained} gold (${this.enemies.length} enemies)`);
    }

    private resolveBossCombat() {
        const boss: Enemy = {
            hp: 120 + this.level * 25,
            maxHp: 120 + this.level * 25,
            attack: 20 + this.level * 4,
            defense: 8 + this.level * 2,
            type: '🐉'
        };

        let rounds = 0;
        while (boss.hp > 0 && this.heroes.some(h => h.hp > 0) && rounds < 50) {
            rounds++;
            for (const hero of this.heroes) {
                if (hero.hp <= 0) continue;
                const dmg = Math.max(1, hero.attack + Math.floor(Math.random() * 7) - 3 - boss.defense);
                boss.hp -= dmg;
            }
            if (boss.hp <= 0) break;
            const alive = this.heroes.filter(h => h.hp > 0);
            const target = alive[Math.floor(Math.random() * alive.length)];
            const dmg = Math.max(1, boss.attack - target.defense + Math.floor(Math.random() * 4));
            target.hp -= dmg;
        }

        if (boss.hp <= 0) {
            const expGained = 80 + this.level * 15;
            this.gainExp(expGained);
            const goldGained = 100 + this.level * 20;
            this.gainGold(goldGained);
            this.killed++;
            this.log(`🐉 Boss defeated! +${expGained} exp, +${goldGained} gold`);
            this.advanceRoom();
        } else {
            this.log('💀 Lost to boss!');
        }

        this.renderMinimap();
        this.renderHUD();
    }

    private advanceRoom() {
        if (!this.dungeon || !this.currentRoom) {
            this.level++;
            this.generateDungeon();
            this.currentRoom = this.dungeon.children[0];
            this.roomTag = 'start';
            this.renderMinimap();
            this.renderHUD();
            return;
        }

        const idx = this.dungeon.children.indexOf(this.currentRoom);
        const nextIdx = idx + 1;

        if (nextIdx >= this.dungeon.children.length) {
            // All rooms cleared
            this.level++;
            this.log(`🎉 All rooms cleared! Entering level ${this.level}`);
            this.generateDungeon();
            this.currentRoom = this.dungeon.children[0];
            this.roomTag = 'start';
        } else {
            this.currentRoom = this.dungeon.children[nextIdx];
            this.roomTag = (this.currentRoom as any).tag || 'normal';
        }

        this.renderMinimap();
        this.renderHUD();
    }

    private gainExp(amount: number) {
        const perHero = Math.floor(amount / this.heroes.length);
        for (const hero of this.heroes) {
            hero.exp += perHero;
            while (hero.exp >= hero.expToNext) {
                hero.exp -= hero.expToNext;
                hero.level++;
                hero.maxHp += 20;
                hero.hp = hero.maxHp;
                hero.attack += 3;
                hero.defense += 2;
                hero.expToNext = Math.floor(hero.expToNext * 1.5);
            }
        }
    }

    private gainGold(amount: number) {
        this.gold += amount;
    }

    private healParty() {
        for (const hero of this.heroes) {
            hero.hp = Math.min(hero.maxHp, hero.hp + 30);
        }
    }

    private renderMinimap() {
        this.minimapGraphics.clear();

        if (!this.dungeon) return;

        const scale = 0.4;
        const offX = 10;
        const offY = 10;

        for (const piece of this.dungeon.children) {
            const tag = piece.tag || 'normal';
            const color = tag === 'start' ? 0x4488ff :
                         tag === 'treasure' ? 0xffdd44 :
                         tag === 'boss' ? 0xff4444 :
                         tag === 'shop' ? 0x44ff88 :
                         tag === 'rest' ? 0x8844ff : 0x555555;

            const [gx, gy] = piece.position;
            const [w, h] = piece.size;

            this.minimapGraphics.fillStyle(color, 0.7);
            this.minimapGraphics.fillRect(
                gx * scale + offX,
                gy * scale + offY,
                w * scale,
                h * scale
            );
        }

        // Current room highlight
        if (this.currentRoom) {
            const [gx, gy] = this.currentRoom.position;
            const [w, h] = this.currentRoom.size;
            this.minimapGraphics.lineStyle(2, 0xffffff, 1);
            this.minimapGraphics.strokeRect(
                gx * scale + offX,
                gy * scale + offY,
                w * scale,
                h * scale
            );
        }

        // Draw room count
        const roomCount = this.dungeon.children.length;
        this.minimapGraphics.fillStyle(0xffffff, 0.8);
    }

    private renderHUD() {
        // Clear old HUD texts
        this.hudTexts.forEach(t => t.destroy());
        this.hudTexts = [];

        // Party info - top bar
        const barBg = this.add.graphics().setDepth(100);
        barBg.fillStyle(0x1a1a2e, 0.9);
        barBg.fillRect(0, 0, 800, 55);

        this.hudTexts.push(barBg as any);

        let x = 10;
        const classIcons = ['⚔️', '🔮', '🗡️'];
        const classNames = ['Warrior', 'Mage', 'Rogue'];

        for (let i = 0; i < this.heroes.length; i++) {
            const hero = this.heroes[i];
            const hpPct = hero.hp / hero.maxHp;
            const hpColor = hpPct > 0.5 ? '#44ff44' : hpPct > 0.25 ? '#ffaa00' : '#ff4444';

            const t = this.add.text(x, 5, `${classIcons[i]} Lv${hero.level} ${classNames[i]}`, {
                fontSize: '12px',
                color: '#ffffff'
            }).setDepth(100);
            this.hudTexts.push(t);

            const hpText = this.add.text(x, 22, `HP: ${hero.hp}/${hero.maxHp}`, {
                fontSize: '11px',
                color: hpColor
            }).setDepth(100);
            this.hudTexts.push(hpText);

            const expText = this.add.text(x, 36, `Exp: ${hero.exp}/${hero.expToNext}`, {
                fontSize: '10px',
                color: '#aaaacc'
            }).setDepth(100);
            this.hudTexts.push(expText);

            x += 150;
        }

        // Level/Gold/Killed info
        const infoText = this.add.text(500, 8, `Lv.${this.level} 💰${this.gold} 💀${this.killed}`, {
            fontSize: '14px',
            color: '#ffdd44'
        }).setDepth(100);
        this.hudTexts.push(infoText);

        // World map label
        const mapLabel = this.add.text(610, 5, 'Map', {
            fontSize: '10px',
            color: '#888888'
        }).setDepth(100);
        this.hudTexts.push(mapLabel);
    }

    update() {
        // Update hero positions with lerp
        for (let i = 0; i < this.heroSprites.length; i++) {
            const sprite = this.heroSprites[i];
            const hero = this.heroes[i];
            if (sprite && hero) {
                sprite.x += (hero.x - sprite.x) * 0.1;
                sprite.y += (hero.y - sprite.y) * 0.1;
            }
        }

        // Draw a simple dungeon room layout on screen
        if (this.currentRoom && this.currentRoom.position) {
            const [rx, ry] = this.currentRoom.position;
            const [rw, rh] = this.currentRoom.size;
            // Room background
            // We draw it less frequently to avoid garbage
        }
    }
}
