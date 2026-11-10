---
description: Review the current diff with the reviewer agent, then fix findings
---
Delegate to the `reviewer` subagent on the current diff. Fix every must-fix finding, re-run `/verify`, tick the task in docs/06-backlog.md,
update docs (field map, architecture, feature list) if behavior changed, then propose a Conventional Commit message.
