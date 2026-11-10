# Backlog (AI-SDLC task queue — do top to bottom; one task per commit)

Format: `- [ ] T-ID title — acceptance criteria`. Tick when `npm run verify` is green and reviewed.

## Phase 0 — Foundations
- [x] T-001 Capture real form — DONE 2026-11-10: sanitized fixture at `tests/fixtures/admission.html`, field map verified. Follow-ups: T-001b capture the Level/Schedule options after a Course postback (needs live session; dropdowns are empty in the saved page); T-001c capture the mobile-verification page (`Enter 10 digit mobile no.`) markup to decide if we offer anything there (default: no, user does it).
- [x] T-002 Scaffold project — DONE 2026-11-10: Vite(+esbuild for background/content)+TS strict, manifest v3 (storage/sidePanel/scripting + single host_permission), ESLint/Prettier, Vitest, all CLAUDE.md script names wired, `npm run verify` green (5 tests incl. a manifest-permissions regression test). `dist/` layout confirmed to match manifest paths; actual "load unpacked in chrome://extensions" needs a manual check (no OS file-picker automation available here). Reviewed; two SHOULD-FIX applied (dev script wasn't watching background/content — fixed, plus a real emptyOutDir race that was silently dropping dist/background/service-worker.js in watch mode; Node types no longer leak into browser-context tsconfig). Remaining NITs carried forward: tests/e2e dir doesn't exist yet (T-031/T-035), sidePanel click behavior unwired (T-023/T-032), ADR-0001 (tooling: Vite+esbuild split, why) and ADR-0002 (permissions: storage/sidePanel/scripting + host_permissions) still owed in T-003.
- [x] T-003 `.gitignore`, git init, first commit; ADR-0001 (tooling), ADR-0002 (permissions). — DONE 2026-11-10.

## Phase 1 — Core logic (pure, TDD)
- [x] T-010 `profile.ts` types + validators (phone normalize, email, pincode, DOB) — table-driven tests incl. `+91 98765-43210 → 9876543210`. — DONE 2026-11-10: 42 tests. Reviewed; fixed a doc-vs-code mismatch (mobile/email now under `contact.*` matching the field map, not `address.*`), tightened `normalizePhone`/`isValidPincode` to reject results that don't look like real numbers (leading-zero mobile, leading-zero PIN), added DOB inclusive-boundary tests.
- [ ] T-011 `dateFormat.ts` ISO → `dd/MM/yyyy`, rejects impossible dates.
- [ ] T-012 `match.ts` dropdown matching exact → ci → fuzzy; returns `{status: matched|ambiguous|none}`.
- [ ] T-013 `image.ts` validate type/size; compress to ≤ 500 KB (canvas mocked in unit, real in e2e).
- [ ] T-014 `fieldMap.ts` from verified map + selector fallbacks (`#id`, `[name$=id]`, label).
- [ ] T-015 `planner.ts` ordered steps + preflight (missing required docs/fields, guardian signature rule).

## Phase 2 — Storage & UI
- [ ] T-020 storage + IndexedDB wrapper; blobs round-trip; clear-all.
- [ ] T-021 Options page: profile form with autosave + inline validation (A1–A3, A7).
- [ ] T-022 Document manager with thumbnails, validation errors (B1–B3).
- [ ] T-023 Side panel shell: page-detected status, profile dropdown, Autofill/Reset buttons (E1, C1).

## Phase 3 — Engine
- [ ] T-030 `content/dom.ts` setValue/selectOption/attachFile + `waitForReload` — jsdom tests; events fired.
- [ ] T-031 Fixture server emulating postbacks — start from `tests/fixtures/admission.html`; fake `__doPostBack` that re-renders dependent dropdowns, clears files, keeps text; `ddlCourseLevel` also posts back (reload clears files, DOB clears on schedule change).
- [ ] T-032 Service-worker run state machine with watchdog, resumes after reload (C2, C3).
- [ ] T-033 Fill report UI (C7) + failure messages.
- [ ] T-034 Reset (C8). Preflight UI (C11).
- [ ] T-035 E2E: full happy path on fixture; asserts `btnSubmit` never clicked and no external network.

## Phase 4 — Hardening & P1
- [ ] T-040 Real-form manual smoke test (docs/05-test-plan.md); record findings as new tasks here.
- [ ] T-041 Multiple profiles (A4) · T-042 Export/import (A5) · T-043 Completeness meter (A6).
- [ ] T-044 Dry-run (C9), re-fill failed (C10), required-field highlight (C13).
- [ ] T-045 Drift detector (D4); course warnings (C12); auto-compress UI (B4); guardian-sig reuse (B6).
- [ ] T-046 Packaging: zip `dist/`, `docs/RELEASE.md`; optional private/unlisted Web Store upload.

## Parking lot (P2)
PDF/HEIC conversion · mapping override · Hindi UI · Firefox port.
