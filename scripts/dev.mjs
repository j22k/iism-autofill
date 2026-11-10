// Runs all three build watchers together: Vite (sidepanel/options HTML pages)
// plus esbuild contexts for the background service worker and content script,
// which Vite can't bundle (see the comment in vite.config.ts for why).
import { rmSync } from 'node:fs';
import { build as viteBuild } from 'vite';
import * as esbuild from 'esbuild';

// Clean once up front, then disable Vite's own emptyOutDir for the watch session:
// in watch mode it re-empties dist/ on every rebuild, which would wipe out whatever
// the esbuild watchers below already wrote there.
rmSync('dist', { recursive: true, force: true });

await viteBuild({ build: { watch: {}, emptyOutDir: false } });

const backgroundCtx = await esbuild.context({
  entryPoints: ['src/background/service-worker.ts'],
  bundle: true,
  format: 'esm',
  target: 'es2022',
  outfile: 'dist/background/service-worker.js',
});
await backgroundCtx.watch();

const contentCtx = await esbuild.context({
  entryPoints: ['src/content/index.ts'],
  bundle: true,
  format: 'iife',
  target: 'es2022',
  outfile: 'dist/content/index.js',
});
await contentCtx.watch();

console.log('Watching sidepanel/options (Vite) + background/content (esbuild). Ctrl+C to stop.');
