# Decision package — phase F3

**Log path:** `.atomic-skills/projects/atomic-skills/real-automate/decisions/F3.jsonl`

**Entries:** 4

| # | category | decision | why | impact | evidencePath |
|---|----------|----------|-----|--------|--------------|
| 1 | routing | Apply L-F2-1 and L-F2-2 at F3 start | Operator token Apply as duas. Cited lock/worktree paths fail closed. Do not inflate automate-run.js. | F3 writer brief includes fail-closed lock and size-cap. | .atomic-skills/projects/atomic-skills/real-automate/lessons/real-automate-f2-prototipo.md |
| 2 | review-disposition | STOP F3 phase-done: operator declined AskUserQuestion twice on blocker/critical residual | Local residual: 1 blocker (leftover writer branch) + 4 critical (pen.lock not exclusive, lease residue, empty host argv, spawn error unhandled). Codex: 1 blocker (empty argv) + 3 critical. Decline is not accept. Free-text recovery forbidden. | phase-done blocked. nextAction: re-open AskUserQuestion fix vs stop. evaluationGate passed; lessonsState none; reviewGate not stamped passed. | .atomic-skills/reviews/2026-10-02-real-automate-F3-residual-local.md |
| 3 | review-disposition | fix — dispatch F3 correction writer for residual blocker/critical | Operator: Despacha o writer de correção da F3. Local B1 leftover branch; C1 non-exclusive pen.lock; C2 lease residue; C3 empty argv; C4 spawn error; M1 empty writerWorktree. | redispatch F→C with operatorOverride; sibling impl/real-automate-F3-fix1 | .atomic-skills/reviews/2026-10-02-real-automate-F3-residual-local.md |
| 4 | review-disposition | accept F3-fix1 residual: local F-001 git-before-lease blocker, F-002 EPERM-as-dead, Codex majors (worktree race, phaseId traversal, branch -D on failure, coordinator vs child pid) | Operator token: Accept residual — phase-done neste recorte. F3 is one writer on this machine (P9). Concurrent two-session and cross-uid EPERM are F4. Fake-host 22/22 is the milestone. | reviewGate mode=both with fix1 local+codex receipts; remaining HIGH/blocker accepted for this slice. | .atomic-skills/reviews/2026-10-02-real-automate-F3-fix1-local.md |
