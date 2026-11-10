# Research: "IISM Autofill" and alternatives

_Date: 2026-11-09. Sources: Chrome Web Store listing, vendor site/privacy policy, two GitHub projects, IISM instructions page._

## 1. The paid extension (IISM Autofill, v1.0.0, 315 KiB)
Store: https://chromewebstore.google.com/detail/iism-autofill/hjjnmhfhfmknpogkfkmjhdmlikgkhmkd
Vendor site: https://iism-autofill.vercel.app/ · Contact: iismautofill@gmail.com · Unaffiliated with IISM.
Stats at time of check: updated 2026-10-23, 77 users, 1 rating (5.0), no review text.

**Features**
- Profile (course, personal, address, education, medical) saved locally via options/side panel; autosave.
- Document store (photo, signature, DOB proof, domicile proof, education proof, ski certificate, parent signature) in browser DB.
- One-click autofill from side panel: text fields first, then waits for page reload, then uploads files.
- Dropdowns matched to exact form option text (course, state, blood group); DOB converted to site format.
- One-click Reset. Profile-strength meter (paid). Never submits.
- Field mappings updated remotely (no reinstall on form change).

**Pricing**: Free = name, email, mobile, DOB, DOB proof, reset. Full Access = ₹299 one-time (all fields, 7 uploads, meter, future updates). Google sign-in + Razorpay. Refund policy on site is an unfilled placeholder (`[REFUND_POLICY]`).

**Drawbacks / risks observed**
| # | Issue | Our fix |
|---|---|---|
| 1 | Paywall for ~90% of function, ₹299, refund policy undefined | Free, local, open |
| 2 | Requires Google sign-in; vendor receives email/name/photo, error reports to a EU provider | No accounts, zero network |
| 3 | Remote-updated field mappings = remote-code-adjacent trust, can break/change silently | Mappings in repo, versioned, tested, user-editable JSON override |
| 4 | Single-developer, brand new (1 rating) — bus factor, store takedown risk | You own the source |
| 5 | Listing doesn't disclose permissions | Documented minimal manifest |
| 6 | Single profile only (apparent) | Multiple profiles (family/friends) |
| 7 | No visible validation of 500 KB/format limits before upload | Pre-flight image validation + auto-compress |
| 8 | No fill report / per-field status visible | Fill report with skipped/failed fields |
| 9 | No import/export/backup (privacy policy: no sync, data lost if profile cleared) | JSON export/import (files as base64 zip) |
| 10 | Postback wipes uploaded files — easy to get wrong | Explicit state machine, uploads last |

## 2. Reddit / community
Searches for Reddit threads on this extension and on IISM Gulmarg autofill returned **nothing relevant** (extension ~1 month old). Don't invent
community claims. Action: after you use it, record your own issues in `docs/06-backlog.md`. A YouTube demo ("How to use IISM autofill") exists.
Analogous complaints in generic autofill-extension threads (not IISM-specific): React/ASP controls ignoring `.value`, fields not firing change events, page reload
wiping state, extensions breaking after site markup changes, paywalls/subscription creep.

## 3. Open-source alternatives (both are submit-bots; we deliberately differ)
- `imsoumya18/iism-registration` (Selenium/Python): fills + submits, `--watch` reload ~1 s until course appears, `--at` waits for booking time. Source of the field IDs and postback order.
- `Kargnin/iism-gulmarg-admission-bot` (Python stdlib, HTTP only): direct requests, dry-run, 500 KB image rules, phone normalization (10 digits, strip +91/91/0), guardian signature fallback, one-course-per-year warning.
**We take their knowledge, not their behavior** — no auto-submit, no polling-for-seats (see CLAUDE.md Hard rules).

## 4. Form facts (from instructions page + bots)
JPEG/JPG/PNG only, ≤ 500 KB. Required uploads: photo, signature, DOB certificate, education certificate (+ guardian signature enforced by client validation).
Mobile verified once; payment link emailed after eligible submission; one course per person per year; fees non-refundable; medical certificate + indemnity at reporting.
Site returned HTTP 403 to automated fetch → field IDs unverified; verify in a real browser (backlog T-001).

## 5. Verdict
Yes, build your own. Scope is small (one site, one form), the hard part is postback/reload sequencing and file-input handling, both well understood.
Estimated: MVP in 1–2 days with Claude Code.
