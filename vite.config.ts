import { defineConfig } from 'vite';

export default defineConfig({
    base: '/idle-rpg-dungeon/',
    build: {
        chunkSizeWarningLimit: 1600
    }
});
