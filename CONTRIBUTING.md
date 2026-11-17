# Contributing

Thanks for helping. This project is small and deliberately conservative; please read the hard rules first.

## Hard rules (a PR that breaks one will not be merged)
1. **Never submit.** No clicking `btnSubmit` or `btnReset`, no `form.submit()`, no submit postbacks.
2. **No captcha/OTP bypass, polling/auto-booking at slot opening, or multi-session racing.**
3. **Zero network calls.** No analytics, remote config, accounts or payments.
4. **Profile data stays local.** Never log personal data or file bytes (console, errors, tests, fixtures).
5. **Minimum permissions.** A new permission needs an ADR in `docs/adr/` (template: `0000-template.md`).
6. **No guessed field facts.** Selectors and options must be backed by the fixture (`tests/fixtures/`) or a recorded
   live capture in `docs/04-field-map.md`.
7. **Never commit real personal data.** `tests/fixtures/admission.html` is sanitized; keep it that way.

The full list with context is in [CLAUDE.md](CLAUDE.md).

## Workflow
1. Pick or open an issue; discuss larger changes first. The task queue is [docs/06-backlog.md](docs/06-backlog.md).
2. Branch from `main`, one change per PR.
3. Write the failing test first, then the minimum code.
4. Run `npm run verify` (typecheck, lint, tests, build) and `npm run test:e2e`; both must pass.
5. Update docs (field map, backlog, ADRs) when behavior changes.
6. Commit with [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `test:`, `docs:`, `chore:`).

## Code style
TypeScript strict, no `any`, no `eval`, no inline scripts (MV3 CSP). Small pure modules in `src/core/` with unit tests;
keep `src/content/` thin. Typed messages live in `src/shared/messages.ts`. Prefer explicit, user-readable errors.
Justify any new dependency in the PR (this project bundles its font and assets rather than loading them remotely).

## Development
```bash
npm ci
npm run dev        # watch build; load dist/ unpacked in chrome://extensions
npm run verify
```
