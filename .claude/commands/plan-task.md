---
description: Plan the next (or given) backlog task before coding
argument-hint: [task id, optional]
---
1. Read CLAUDE.md, docs/06-backlog.md, and the docs the task touches (feature list, architecture, field map).
2. Select task `$ARGUMENTS` or the first unchecked task.
3. Output a short plan: files to create/change, tests to write first, acceptance criteria restated, risks vs the Hard rules in CLAUDE.md.
4. If the task would violate a Hard rule or needs a new permission/dependency, stop and ask. Otherwise wait for "go".
