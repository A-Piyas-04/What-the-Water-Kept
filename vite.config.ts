import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  base: './',
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    target: 'es2020',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 2048,
    rollupOptions: {
      output: { manualChunks: { pixi: ['pixi.js'] } },
    },
  },
  server: { host: true, port: 5173 },
});
