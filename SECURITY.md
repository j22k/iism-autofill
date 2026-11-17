# Security policy

## Reporting a vulnerability
Please report security issues privately using GitHub's "Report a vulnerability" (Security tab) on this repository
rather than a public issue. Include steps to reproduce and the affected version.

## Scope and design constraints
In scope: anything that could leak profile data or documents, send data off-device, widen the extension's
permissions, or cause the form to be submitted automatically. The hard rules are listed in [CLAUDE.md](CLAUDE.md);
changes touching them need a maintainer's sign-off, and new permissions need an ADR in `docs/adr/`.

Never include real personal data (names, IDs, photos, signatures) in an issue, a test or a fixture.
