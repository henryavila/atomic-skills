# audit-delivery — real-automate F3
**verdict:** CLOSED
**HEAD:** c3fa0dcd5c0c2961b46f84842267de43c6abccc1
**mode:** audit light, axes product+residual
**intent-source:** `.atomic-skills/projects/atomic-skills/real-automate/phases/f3-um-writer-merge-e-para.md` businessIntent
**evaluatedAt:** 2026-10-02T16:12:00Z

## Intent Package
Spine:
- D1: After the six gates, `scripts/automate-run.js` creates a writer worktree (not `automate-phase-run.js`).
- D2: Writes `pen.lock` with owner, pid, writerWorktree; deletes on exit including failure; dead pid does not block; empty/missing cited path fail-closed (L-F2-1).
- D3: Spawns injectable host CLI in that worktree; chat session is not the writer.
- D4: Merges onto the plan branch and stops; no phase-done; no second phase materialized.
- P1: Fake-host integration test exits 0 and the writer file is on the plan branch.

Acceptance / doneWhen: `node --test tests/automate-run-writer.test.js` exit 0; writer blob on plan branch; F4 not materialized.

Vocabulary: none (additive).

Surfaces (3): `scripts/automate-run.js`, `tests/automate-run-writer.test.js`, `.atomic-skills/status/automate/pen.lock`.

Non-goals: F4 claim/fence/review loop; F5 page; real host prompt protocol.

## Matrix
| ID | Status | Evidence |
|----|--------|----------|
| D1 | RESOLVED | `runWriterSession` `scripts/automate-run.js` worktree add `-B`; grep `automate-phase-run` absent in that file; eval independentConfirmations |
| D2 | RESOLVED | exclusive `wx` writePenLock; owner-only unlink; coordinator pid; empty writerWorktree throws; dead pid stale-dead-pid; tests B1/C1/M1 22/22 |
| D3 | RESOLVED | `startHost` + `AUTOMATE_HOST_ARGS`; fake CLI writes `writer-output.txt` in worktree; C3/C4 tests |
| D4 | RESOLVED | stderr `merged; stopping`; exit 0 once; no `phase-done`/`materialize` in source; F4 remains `.source.json` |
| P1 | RESOLVED | `node --test tests/automate-run-writer.test.js` 22 pass / 0 fail at HEAD `c3fa0dcd`; `git show HEAD:writer-output.txt` in fixture = `from-writer` |

## Residual hunt
OLD: `writer spawn is not in this build` / `process.exit(2)` after gates; `git worktree add -b` leftover branch; overwrite pen.lock.
- exit 2 path replaced by `runWriterSession` (D1–D4).
- leftover branch: second run test (B1).
- overwrite lock: `wx` + owner unlink (C1).
Zero CRITICAL in the post-fix evaluation.

Open HIGH accepted by operator (one-writer F3 slice):
- git worktree add/remove before exclusive lease (local F-001 / Codex-1)
- `isPidAlive` treats EPERM as dead (F-002)
- unvalidated phaseId in worktree path (Codex-2)
- `git branch -D` after merge failure (Codex-3)
- lock pid is coordinator; surviving child after coordinator death (Codex-4)

## Accept Records
| Finding | Risk | Mitigation | Operator | At | Expires |
|---------|------|------------|----------|-----|---------|
| F-001 git-before-lease | Concurrent loser can `-B`/`-D` another writer tree | F3 is one writer on this machine (P9). LEASE_EXISTS after lock reclaim. F4 if multi-session. | operator | 2026-10-02T16:10:00Z | — |
| F-002 EPERM=dead | Cross-uid live pid lock stolen | Same-uid coordinator; F3 not multi-user CI steal | operator | 2026-10-02T16:10:00Z | — |
| Codex-2 phaseId path | `--phase '../x'` rmSync outside parent | Tests inject safe phase ids; validate in F4 | operator | 2026-10-02T16:10:00Z | — |
| Codex-3 branch -D on failure | Failed merge loses writer ref | Milestone is successful fake-host merge; retry from HEAD | operator | 2026-10-02T16:10:00Z | — |
| Codex-4 coordinator pid | Child lives after coordinator death, pen gone | Fake host exits before merge; real host argv is F4 | operator | 2026-10-02T16:10:00Z | — |

## findings
Zero CRITICAL. HIGH items have Accept Records. Product Dn/Pn RESOLVED.

## Verdict CLOSED
Load-bearing D1–D4 and P1 RESOLVED. Residual valid (not excluded). Accept Records cover remaining HIGH. Green suite 22/22 is evidence for rows, not a substitute.
