# ADR-0001: Build tooling — Vite for pages, esbuild for background/content
Date: 2026-11-10 · Status: accepted

## Context
CLAUDE.md allows either `@crxjs/vite-plugin` or plain Vite multi-entry. The extension has four kinds of
build output with different constraints:
- `sidepanel/index.html`, `options/index.html` — ordinary pages, loaded via `<script type="module">`, fine
  with Vite's default ES module output and code-splitting.
- `background/service-worker.ts` — MV3 service worker, declared `"type": "module"` in `manifest.json`, so
  ESM output is fine, but it's a single logical entry.
- `content/index.ts` — MV3 content script, loaded as a classic (non-module) script. It must be a single
  self-contained file; it cannot `import` a shared chunk at runtime.

Rollup (Vite's bundler) refuses IIFE/UMD output when there are multiple entry points, because that format
can't express code-splitting. Background and content together, in one Rollup pass, would force choosing one
format for both — but background needs ESM-compatible semantics and content needs a non-module IIFE. Adding
`@crxjs/vite-plugin` would resolve this transparently, at the cost of an extra dependency whose MV3 behavior
is partly implicit/magic — not a good trade for a small personal project where predictability matters more
than saving a few lines of config.

## Decision
Use plain Vite (`vite.config.ts`, `root: 'src'`) for the two HTML pages only. Build
`background/service-worker.ts` and `content/index.ts` separately with the `esbuild` CLI (already a
transitive dependency of Vite, added here as an explicit devDependency since it's invoked directly):
- background → `--bundle --format=esm --outfile=dist/background/service-worker.js`
- content → `--bundle --format=iife --outfile=dist/content/index.js`

`manifest.json` and `icons/` are copied into `dist/` via `vite-plugin-static-copy`. `npm run build` chains
`vite build && esbuild ... && esbuild ...`. `npm run dev` (`scripts/dev.mjs`) runs the Vite watch build and
both esbuild watch contexts together, after a one-time clean of `dist/` — `emptyOutDir` is left on for the
one-shot `build` (safe, since it finishes before the esbuild commands run) but turned off for the `dev`
watcher, because in watch mode Vite re-empties the whole `dist/` on every rebuild and would otherwise race
with and delete the esbuild watchers' output.

## Consequences
- No dependency on `@crxjs/vite-plugin`; one more devDependency (`esbuild`) that was already present
  transitively, now explicit and version-pinned.
- Background and content have no access to Vite's HMR or asset pipeline (fine — they're thin, DOM-facing
  code per `docs/03-architecture.md`; all real logic lives in `src/core/`, built and unit-tested separately
  without any bundler).
- If background/content ever need to share a non-trivial module, it has to be duplicated into both esbuild
  entry points, or split into a shared file each imports (esbuild will bundle it into each output
  independently — no cross-entry chunk, by design, since content can't load one at runtime).
