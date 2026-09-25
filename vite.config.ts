import { defineConfig } from 'vite';

// Relative base so the site works at any GitHub Pages path (hash routing).
export default defineConfig({
  base: './',
  build: { outDir: 'dist', sourcemap: false },
  test: { include: ['tests/**/*.test.ts'], environment: 'node' },
} as never);
