/// <reference types="node" />
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';

// Background/content scripts are bundled separately via esbuild (see "build" script in
// package.json) because MV3 content scripts must ship as a single, non-split file.
export default defineConfig({
  root: 'src',
  base: './',
  plugins: [
    viteStaticCopy({
      targets: [
        { src: '../manifest.json', dest: '.' },
        { src: '../icons', dest: '.' },
      ],
    }),
  ],
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        sidepanel: resolve(import.meta.dirname, 'src/sidepanel/index.html'),
        options: resolve(import.meta.dirname, 'src/options/index.html'),
      },
    },
  },
});
