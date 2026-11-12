# ADR-0002: Manifest permissions — storage, sidePanel, scripting; one host permission
Date: 2026-11-10 · Status: accepted

## Context
CLAUDE.md Hard Rule 5 requires an ADR for any permission the extension requests, and Hard Rule 3 caps
`host_permissions` to the admission domain with zero other network access. `docs/03-architecture.md`
already named the permission set; this ADR is the record required before it lands in `manifest.json`
(it landed in T-002's scaffold; this ADR formalizes it, per the backlog's own ordering of T-002 before
T-003).

## Decision
`manifest.json` requests exactly:
- `permissions`: `storage` (profile text in `chrome.storage.local`, run state in `chrome.storage.session`),
  `sidePanel` (the main UI surface — autofill/reset/report), `scripting` (service worker needs to
  message/inject logic into the content script context across postback reloads). T-032 later added
  `alarms` for the fill-run watchdog, recorded in `docs/adr/0003-alarms-permission.md` per this ADR's own
  "update in the same change" rule — the set below is the original T-002/T-003 baseline, not the current one.
- `host_permissions`: `["https://admission.iismgulmarg.in/*"]` — the one site this extension acts on. No
  other host, no `<all_urls>`.
- No `externally_connectable`, no `activeTab` (not needed — the content script is statically declared for
  the one domain instead of requested per-click), no `tabs`, no `identity`, no `background` network-related
  permissions (`webRequest`, etc.).

`tests/unit/manifest.test.ts` pins this exact set as a regression test: it fails if `permissions` gains
anything outside `{storage, sidePanel, scripting}`, if `host_permissions` changes from the single admission
URL, or if `externally_connectable` is ever added — forcing a conscious update to this ADR before any of
that can ship.

## Consequences
- Matches Hard Rule 3 (zero network calls beyond the one domain the extension exists to fill) and Hard
  Rule 5 (minimum permissions, ADR on file).
- If a future task needs a new permission (e.g., `downloads` for exporting a profile, per T-042), that
  task must update this ADR and the regression test in the same change — not add it silently.
