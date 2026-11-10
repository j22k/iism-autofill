# Feature List (P0 = MVP, P1 = next, P2 = later, X = explicitly excluded)

Parity column = what the paid extension does today.

## A. Profile
| ID | Feature | Pri | Parity |
|---|---|---|---|
| A1 | Profile editor: course prefs, personal, address, education, medical/ID, emergency contact | P0 | yes |
| A2 | Autosave on change to `chrome.storage.local` | P0 | yes |
| A3 | Validation: 10-digit phone (strip +91/91/0), email, pincode 6-digit, DOB real date, required fields | P0 | no |
| A4 | Multiple profiles (switch/duplicate/delete) | P1 | no |
| A5 | JSON export/import (files embedded base64) for backup | P1 | no |
| A6 | Profile completeness meter | P1 | paid |
| A7 | Clear all data button | P0 | partial |

## B. Documents
| ID | Feature | Pri | Parity |
|---|---|---|---|
| B1 | Store: photo, applicant signature, DOB proof, education proof, guardian signature in IndexedDB | P0 | yes |
| B2 | Optional: domicile proof, ski/adventure certificate, employment proof | P0 | yes |
| B3 | Validate type (jpg/jpeg/png) and size ≤ 500 KB with clear error | P0 | no |
| B4 | Auto-compress/resize oversized images to ≤ 500 KB (canvas), preview thumbnails | P1 | no |
| B5 | PDF/HEIC → image first-page conversion | P2 | no |
| B6 | "Reuse applicant signature as guardian signature" toggle | P1 | no |

## C. Autofill engine
| ID | Feature | Pri | Parity |
|---|---|---|---|
| C1 | Detect admission form page; side panel shows ready/not-ready | P0 | yes |
| C2 | Ordered fill state machine surviving postbacks: course → level/schedule/state → text/dropdowns/declaration → DOB → files | P0 | yes |
| C3 | Fire proper `input`/`change` events; wait for reload via readiness + stability, no fixed sleeps, timeout with error | P0 | yes |
| C4 | Dropdown matching by exact → case-insensitive → regex/fuzzy; if ambiguous, leave for human and report | P0 | yes |
| C5 | DOB → `dd/MM/yyyy` | P0 | yes |
| C6 | File attach via `DataTransfer` to file inputs, after last reload | P0 | yes |
| C7 | Fill report (per-field ok/skipped/failed) in side panel | P0 | no |
| C8 | Reset/clear filled form (reload page + clear) | P0 | yes |
| C9 | Dry-run mode: highlight what would be filled, no changes | P1 | no |
| C10 | Re-fill only failed fields | P1 | no |
| C11 | Pre-flight checklist before fill (missing required docs/fields) | P0 | no |
| C12 | Warn: one-course-per-year, level prerequisites (Intermediate/Advanced need certificate) | P1 | no |
| C13 | Highlight unfilled required fields on page | P1 | no |

## D. Maintainability
| ID | Feature | Pri | Parity |
|---|---|---|---|
| D1 | Field map in versioned JSON (`src/core/fieldMap.ts`), selector fallbacks (id → name → label text) | P0 | remote |
| D2 | Local fixture form replicating postback behavior for e2e tests | P0 | no |
| D3 | User-editable mapping override in options (no remote fetch) | P2 | no |
| D4 | Form-drift detector: report which mapped IDs are missing on page | P1 | no |

## E. UX
| ID | Feature | Pri |
|---|---|---|
| E1 | Side panel UI: profile select, Autofill, Reset, report | P0 |
| E2 | Options page for full profile + docs | P0 |
| E3 | Dark mode, keyboard accessible, English | P1 |
| E4 | Hindi labels | P2 |

## X. Excluded by design
Auto-submit · seat/slot polling or timed booking · captcha/OTP bypass · payment · accounts/sign-in · telemetry · remote code/config · cloud sync · Firefox port (revisit later).
