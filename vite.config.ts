import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  base: process.env.GITHUB_PAGES === 'true' ? '/tirechaos/' : '/',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
  },
  build: {
    target: 'es2020',
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('@babylonjs/')) {
            return 'vendor-babylon';
          }
          if (id.includes('cannon-es')) {
            return 'vendor-cannon';
          }
          if (id.includes('node_modules')) {
            return 'vendor';
          }
          return 'game';
        },
      },
    },
  },
});
