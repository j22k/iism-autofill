# IISM Form Filler

A free, open-source Chrome extension (Manifest V3) that autofills the
[IISM Gulmarg](https://admission.iismgulmarg.in/) online admission form from a profile you keep **locally in your
browser**. It fills the form; **you review it and press Submit yourself.**

> Unofficial. Not affiliated with, endorsed by, or connected to IISM. Use it only for your own or a consenting
> applicant's application. You are responsible for what you submit.

## Features
- Profile editor with validation (date picker, phone/pincode/e-mail checks, the site's length limits) and dropdown
  pickers for course, level, batch, state, qualification and diet.
- Document manager for the uploads (type and size checks, thumbnails, automatic shrinking of oversized photos to
  500 KB, applicant signature reused for the guardian slot).
- Side panel: page detection, pre-flight checklist, **Preview (dry run)**, **Autofill**, **Reset** (reloads the tab),
  a per-field fill report, a warning if the site's form has changed, and red outlines on required fields still empty.
- Handles the site's ASP.NET postbacks (Course, Level, Batch, State and date of birth reload the page) with a
  resumable run, so a reload never loses progress. Files are attached last because they do not survive a reload.
- Export / import of the text profile as JSON.

## Hard guarantees
- **Never submits.** No code clicks Submit or Reset, calls `form.submit()`, or triggers a submit postback. An
  end-to-end test fails if a submit request is ever sent.
- **No captcha/OTP bypass, no polling or auto-booking, no multi-session racing.** Out of scope on purpose.
- **Zero network calls.** No analytics, accounts, remote config or payments. The only host permission is the
  admission site, and the font is bundled.
- **Your data stays local** (`chrome.storage.local` and IndexedDB). See [PRIVACY.md](PRIVACY.md).

## Install (unpacked)
Requires Node 22+.

```bash
npm ci
npm run build
```

Then open `chrome://extensions`, enable **Developer mode**, choose **Load unpacked** and select the `dist/` folder.
After a rebuild, press the reload icon on the extension's card. More in [docs/RELEASE.md](docs/RELEASE.md).

## Use
1. Open the extension's **Options** page, fill the profile and add your documents, then **Save profile**.
2. Open the admission form and the extension's side panel.
3. **Preview** shows what will be written; **Autofill** fills it.
4. Read the report, fix anything flagged, complete any mobile verification or captcha yourself, and submit manually.

## Develop
| Command | What it does |
| --- | --- |
| `npm run dev` | Watch build into `dist/` |
| `npm run build` | Production build |
| `npm run typecheck`, `npm run lint`, `npm test` | Checks and unit tests (Vitest + jsdom) |
| `npm run test:e2e` | Playwright: loads `dist/` and fills the local fixture (set `CHROMIUM_PATH` if Playwright's expected browser is not installed) |
| `npm run verify` | typecheck + lint + test + build (must pass before any change is done) |
| `npm run package` | Zip `dist/` |

Layout: pure logic in `src/core/`, thin DOM code in `src/content/`, the service worker in `src/background/`, UI in
`src/sidepanel/` and `src/options/`, typed messages in `src/shared/messages.ts`. Design docs live in [docs/](docs/)
(`00-research` to `06-backlog`, ADRs in `docs/adr/`). Rules for contributors and AI assistants: [CLAUDE.md](CLAUDE.md).

## Status
Unit and end-to-end tests pass against a sanitized fixture of the form. A manual smoke test on the live site
(`docs/05-test-plan.md`, task T-040) is still the final check. Open items (multiple profiles with per-profile
documents) are in [docs/06-backlog.md](docs/06-backlog.md).

## Contributing, security, license
[CONTRIBUTING.md](CONTRIBUTING.md) · [SECURITY.md](SECURITY.md) · [PRIVACY.md](PRIVACY.md) · [MIT License](LICENSE)
