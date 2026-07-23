declare module 'dungeon-generator' {
    export default class Dungeon {
        constructor(config: any);
        generate(): void;
        size: number[];
        walls: any;
        start_pos: number[];
        children: any[];
    }
}
