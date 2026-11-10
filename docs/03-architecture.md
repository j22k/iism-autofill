# Architecture

## Components (MV3)
```
manifest.json
src/
  background/service-worker.ts   # orchestrates fill run; persists run state across page reloads
  content/index.ts               # injected on admission.iismgulmarg.in; executes single steps, reports back
  content/dom.ts                 # setValue, selectOption, attachFile, waitForReload helpers
  sidepanel/                     # UI: profile select, Autofill, Reset, report
  options/                       # full profile + document manager, import/export
  core/                          # PURE logic (unit-tested)
    fieldMap.ts                  # id -> {section, type, source, fallbacks}
    profile.ts                   # types + validation + defaults
    dateFormat.ts  phone.ts  match.ts (dropdown matching)  image.ts (type/size/compress)
    planner.ts                   # profile + page state -> ordered steps
  shared/messages.ts storage.ts db.ts
tests/unit  tests/e2e  tests/fixtures/admission.html (+ tiny server emulating postbacks)
```

## Fill run state machine
States: `IDLE → PREFLIGHT → COURSE → SCHEDULE_STATE → FIELDS → DOB → FILES → DONE | FAILED`.
- Service worker owns the run (`chrome.storage.session` stores `{runId, state, report}`).
- Each step is sent to the content script; steps that cause a postback end with the content script being torn down.
  On re-injection the content script announces `READY`, SW sees pending run and sends the next step.
- Watchdog: if no `READY` in 60 s → FAILED with message. No infinite loops; max one retry per step.
- Idempotent steps: skip a field whose current value already equals target.

## Key technical decisions
- **Events**: set value via native setter then dispatch `input` + `change` (+`blur`); postback fields: dispatch `change` to trigger page's `setTimeout(__doPostBack…)`.
- **Files**: build `File` from IndexedDB Blob, `new DataTransfer()`, assign `input.files`, dispatch `change`.
- **Image compression**: canvas re-encode JPEG, binary-search quality, then downscale until ≤ 500 KB.
- **Storage**: text profile in `chrome.storage.local`; Blobs in IndexedDB (`idb`-style tiny wrapper, no dependency).
- **Permissions**: `storage`, `sidePanel`, `scripting`, host `https://admission.iismgulmarg.in/*` only. Content script declared statically.
- **Security**: strict CSP, no remote scripts, no `eval`; PII never logged.
- **Selectors**: primary = `#id`; fallback = `[name$=suffix]` (WebForms may prefix `ctl00$…`), then label text. Verify prefixing in T-001.

## Testing strategy
- Unit: core modules (target ≥ 90% coverage on `src/core`).
- Integration: jsdom for dom.ts helpers.
- E2E: Playwright loads unpacked extension, opens local fixture served at a fake origin via route interception for `admission.iismgulmarg.in`, asserts final DOM, that `btnSubmit` was never clicked, and that no network requests left localhost.
- Manual: real-form smoke test using the checklist in `docs/05-test-plan.md` (never submit).

## ADRs
`docs/adr/0001-*.md` etc. One per significant decision (permissions, UI framework, storage).
