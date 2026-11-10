---
description: Red-green-refactor for the current task
---
1. Write the failing test(s) from the task's acceptance criteria. Run them; show they fail for the right reason.
2. Implement the minimum to pass. Run again.
3. Refactor with tests green. Keep `src/core` pure; keep DOM code thin.
4. Never put real personal data in fixtures; use obviously fake values.
