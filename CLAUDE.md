# CLAUDE.md — IISM Form Filler (personal Chrome extension)

## What this is
A free, personal-use Manifest V3 Chrome extension that autofills the IISM Gulmarg online admission form
(`https://admission.iismgulmarg.in/`) from a profile stored locally in the browser. It replaces the paid
"IISM Autofill" extension. **It never submits the form.** The human reviews and clicks submit.

Read first: `docs/01-feature-list.md` (what), `docs/03-architecture.md` (how), `docs/04-field-map.md` (form facts),
`docs/06-backlog.md` (ordered tasks). Research background: `docs/00-research.md`.

## Hard rules (never violate)
1. **Never click `btnSubmit`, never call `form.submit()`, never `__doPostBack` for submit.** Fill only.
2. **No captcha/OTP bypass, no polling/auto-booking at slot opening time, no multi-session racing.** Out of scope on purpose (fairness + ToS risk).
3. **Zero network calls.** No analytics, no remote config, no accounts, no payments. `manifest.json` must have no `host_permissions` beyond the admission domain and no `externally_connectable`.
4. **Profile data stays local** (`chrome.storage.local` for text, IndexedDB for files). Never log PII or file bytes (console, errors, tests, fixtures).
5. **Minimum permissions**: `storage`, `sidePanel`, `activeTab`/`scripting` only if needed. Any new permission needs an ADR in `docs/adr/`.
6. Field IDs in `docs/04-field-map.md` were verified against a real saved form on 2026-11-10 (fixture in `tests/fixtures/`). Level/Schedule options still need a live capture (T-001b). Never hardcode a guess without a fixture test.
7. Never click `btnReset` either (it posts back). Never commit real personal data; `tests/fixtures/admission.html` is sanitized — keep it that way.

## Stack
TypeScript (strict), Vite + `@crxjs/vite-plugin` (or plain Vite multi-entry), Vitest + jsdom (unit), Playwright (e2e against a local fixture
page that mimics the ASP.NET WebForms postback behavior), ESLint + Prettier. No UI framework unless an ADR says so (vanilla TS + small web components).

## Commands (create these in package.json; keep names stable)
- `npm run dev` — Vite dev build, load `dist/` unpacked
- `npm run build` — production build to `dist/`
- `npm run typecheck` · `npm run lint` · `npm test` · `npm run test:e2e`
- `npm run verify` — typecheck + lint + test + build (must pass before any task is "done")

## Domain gotchas (ASP.NET WebForms)
- `ddlCourse`, `ddlCourseLevel`, `ddlScheduleCourse`, `ddlState`, `txtDateOfBirth` trigger a **full page reload (postback)**.
  The content script is destroyed and re-injected. Fill state must live in the service worker / storage, not page memory.
- Order: course → (level, schedule, state) → text fields/dropdowns/declaration → DOB (last reload) → files last.
- Text, dropdowns, checkbox survive reloads; **file inputs do not**. Upload files only after the last reload.
- Wait for reload completion (poll `document.readyState` + value stability) — never fixed `sleep`.
- Setting `.value` is not enough: dispatch `input` and `change` events; for postback fields use the page's own onchange.
- Uploads: JPG/JPEG/PNG/GIF (docs may also be PDF; photo/signature/guardian-signature not — see docs/04-field-map.md's verified details), ≤ 500 KB each (page JS only blocks >1 MB; stay at 500 KB), non-empty. Compress/validate in the extension before attach (DataTransfer API).
- Site has intentionally misspelled IDs (`Eduation`, `Phototo`, `Appicant`); match exactly.
- DOB format `dd/MM/yyyy`. Changing `ddlScheduleCourse` clears DOB.

## Workflow (AI-SDLC) — follow in order
1. Pick the next unchecked task in `docs/06-backlog.md`. Do one task per branch/commit.
2. `/plan-task` → short plan referencing acceptance criteria. Confirm if it touches a Hard rule.
3. Write the failing test first (`/tdd`). Then implement the minimum.
4. `/verify` (runs `npm run verify`). Fix until green. Show output; don't claim success without it.
5. `/review` (uses `.claude/agents/reviewer.md`), fix findings, tick the backlog box, update docs if behavior changed.
6. Commit with Conventional Commits (`feat:`, `fix:`, `test:`, `docs:`, `chore:`).

## Code style
- Small pure modules in `src/core/` (mapping, validation, date format, image checks) — fully unit tested; DOM code in `src/content/` stays thin.
- Typed message contracts between side panel ↔ service worker ↔ content script in `src/shared/messages.ts`.
- Prefer explicit errors with a user-readable message surfaced in the side panel report ("filled 21/24, 3 skipped: …").
- No `any`, no `eval`, no inline scripts (MV3 CSP). No dependencies without justification in the PR/commit message.

## Definition of Done
Acceptance criteria met · tests added · `npm run verify` green · no new permissions without ADR · docs/field-map updated · no PII in repo.
