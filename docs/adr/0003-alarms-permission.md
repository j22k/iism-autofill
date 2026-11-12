# ADR-0003: `alarms` permission for the fill-run watchdog
Date: 2026-11-12 · Status: accepted

## Context
T-032's watchdog (docs/03-architecture.md: "if no `READY` in 60s → FAILED") was first implemented with a
plain `setTimeout`/`clearTimeout` inside the service worker. Code review caught that this does not survive
MV3 service-worker eviction: Chrome idles out an inactive service worker in well under 60 seconds, which
destroys any in-memory timer. If the worker is evicted while a run is waiting on a postback's `READY`, the
timer meant to fail the run after 60s simply no longer exists, and `chrome.storage.session` is left holding
a run stuck at `phase: 'running'` forever with no recourse.

`chrome.alarms` is the MV3-recommended mechanism for exactly this: alarms are scheduled by the browser, not
the worker, and firing one wakes/restarts the service worker to deliver it to a freshly-registered
`chrome.alarms.onAlarm` listener. `handleWatchdogFired` already re-derives everything it needs from
`chrome.storage.session` rather than from in-memory state, so it is naturally eviction-safe once the alarm
itself is.

## Decision
Add `alarms` to `manifest.json`'s `permissions`. The real `ServiceWorkerDeps.armWatchdog`/`disarmWatchdog`
(src/background/service-worker.ts) are backed by `chrome.alarms.create`/`chrome.alarms.clear`, keyed by a
per-tab alarm name; a single top-level `chrome.alarms.onAlarm.addListener` (registered unconditionally at
module load, the same pattern already used for `chrome.runtime.onMessage`) forwards a fired alarm into
`orchestrator.handleWatchdogFired(tabId)`. Unit tests inject a `setTimeout`-backed fake through the same
deps seam — they don't need real alarms to verify the state machine's timing logic.

`tests/unit/manifest.test.ts` is updated to allow `alarms` alongside the existing `storage`/`sidePanel`/
`scripting`.

## Consequences
- Matches Hard Rule 5 (minimum permissions, with an ADR on file for anything new) — `alarms` carries no
  network or host access of its own, so Hard Rule 3 (zero network calls beyond the admission domain) is
  unaffected.
- Chrome clamps a packed extension's alarm delay to a minimum of roughly 30 seconds; the watchdog's 60s
  window is comfortably above that floor.
- If a future task needs a scheduled/recurring capability unrelated to this watchdog, it should still get
  its own ADR entry rather than silently riding on this one's permission grant.
