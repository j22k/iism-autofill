# Test Plan

## Automated
| Level | Tool | Scope |
|---|---|---|
| Unit | Vitest | `src/core/*` ≥ 90% coverage: phone, date, match, image rules, planner, validators |
| DOM | Vitest+jsdom | setValue fires input/change; selectOption; attachFile assigns files |
| E2E | Playwright + unpacked extension | Fixture form with simulated postbacks: full fill, resume after reload, watchdog timeout, reset |

Must-have assertions in E2E: (1) every mapped field has expected value; (2) file inputs populated only after final reload;
(3) `btnSubmit` click count = 0, form never submitted; (4) zero requests to hosts other than the fixture origin.

## Edge cases
Ambiguous course label · seats = 0 · image 501 KB · PNG with alpha · empty file · phone with +91 · DOB 29 Feb · slow reload (>5 s) ·
reload never arrives · user navigates away mid-run · second tab running · stale storage schema (migration) · missing optional docs.

## Manual smoke (real site, NEVER submit)
1. Complete mobile verification yourself. 2. Run Autofill with a test profile. 3. Compare every field to profile.
4. Confirm uploads show filenames. 5. Press Reset. 6. Record discrepancies in `docs/06-backlog.md`.
Use dummy data where possible; don't create real applications for testing.

## Security/privacy checks (each release)
Manifest permission diff · grep for `fetch(`/`XMLHttpRequest`/`sendBeacon` = none · no PII in console · no remote scripts · `npm audit`.
