---
description: Run the full verification gate and report honestly
---
Run `npm run verify` (typecheck, lint, unit tests, build). If e2e exists for the task, also `npm run test:e2e`.
Also check: `git diff` adds no new manifest permissions without an ADR; grep src for `fetch(`, `XMLHttpRequest`, `sendBeacon`, `btnSubmit.click`, `.submit(`, `console.log` of profile data.
Report actual output. If anything fails, fix and rerun; do not claim done until green.
