# PRD — IISM Form Filler

**Problem**: Filling the IISM admission form is slow and error-prone (postback reloads wipe files, 500 KB limits, exact option labels). The convenient tool is paywalled (₹299) and requires Google sign-in.
**Goal**: A free, local, auditable extension that fills the form correctly in one click and leaves submission to the human.
**Users**: The owner, plus family/friends applying (multi-profile).
**Non-goals**: Winning seat races, bypassing verification, distribution at scale, monetization. See feature list section X.

**Success metrics**
- Fills ≥ 95% of mapped fields correctly on a real form with one click; < 10 s excluding reload waits.
- All five required uploads attached on first run.
- 0 network requests, 0 submits (enforced by e2e tests).
- Recovers from a form markup change within one task (update field map + fixture).

**Risks**: form IDs unverified (T-001) · site changes without notice · site may reject programmatic file input (fallback: instruct manual pick) ·
ToS ambiguity (we fill only; user submits) · Chrome MV3 service-worker eviction mid-run (state in `storage.session`).

**Milestones**: M1 = Phase 0–2 (profile+docs UI) · M2 = Phase 3 (engine, e2e green) · M3 = Phase 4 (real-site smoke, P1 features).
