# Approved-plan orchestrator tick

One home for the cut from interactive `project` into automatic implementation.
The host session is the orchestrator. Each wakeup runs **one tick** and exits.
Workers implement and review. The board on disk is the memory across wakeups,
including a 5h window and a 7d window.

This file is the procedure. `skills/core/implement.md` and `skills/core/project.md`
point here. They do not restate the tick.

## Approval

`planApprovedAt` on plan frontmatter is the user's acceptance of the plan:
ratified `businessIntent`, validated flow, ground-truth receipt, and admitted
tasks (path, `scopeBoundary`, acceptance, verifier).

After the user accepts, and only then, write it with
`scripts/stamp-plan-approval.js --plan <plan.md>`. A generic "ok" is not
acceptance. That write does not set `userValidatedAt`. Clearing it is
`clearPlanApproval`.

`planApprovedAt` is not `userValidatedAt`. Delivery acceptance stays at plan
end, and only the user writes it.

Without a valid ISO `planApprovedAt`, the tick refuses (`plan-not-approved`).
Send the user back to `project`. Do not implement.

## Board

Path: `.atomic-skills/status/automate/<slug>.board.json`

`catalogFromTasks` builds parts from tasks the plan already has. The tick
does not invent parts. A task without paths, verifier, acceptance, and
`scopeBoundary` is not admitted.

Parts: `queued | dispatched | claimed | merged | review | done | blocked-human`.
Agents: `implement | review | fix`, each with lease, alive, claim, and review
result. One writer per worktree. Merge back to the plan branch is serial.

## One tick

Do not hand-build the snapshot. The command reads the plan, the phase files
beside it, the board, and the writer lease:

```bash
node "$(cat "$HOME/.atomic-skills/package-root" 2>/dev/null || echo .)/scripts/orchestrator-tick.js" \
  --from-plan <plan.md> \
  --status-root .atomic-skills/status
```

It writes the board and prints the actions. A task `status: done` is a
finished part. A task `status: blocked` is `blocked-human`. An active writer
lease marks that plan's in-flight implement and fix agents alive. Do not pass
chat memory as state.

Before the tick, record on the board any agent that returned since the last
wakeup: `claim`, `alive`, `review`, and `finding`. Then run the command again.
The disk board is what the command reads.

Then do only the printed actions:

| Action | Orchestrator does |
|---|---|
| `dispatch` `implement` or `fix` | One code-only writer, sibling worktree, sealed instruction from the action. Not on a path another in-flight part already holds. |
| `dispatch` `review` | A different agent from the one that wrote the part. Review does not edit product source. |
| `merge` | Serial merge of that one part onto the plan branch. The tick emits at most one merge. |
| `reverify` | Run that part's verifier on the merged tree. Record `verifierPassed` on the board. A claim is not a pass. |
| `close` | `assert-automate-gate --gate done` exited 0, then `done` for that part. The tick already required a clean review and `verifierPassed`. |
| `blocked-human` | Stop that reason. Do not stamp the gate. The next wakeup must see the same block and add no new work. |

## How to perform one action

The `/loop` session performs every action the tick printed, then exits.
One tick may print several dispatches. It does not re-enter
`skills/core/implement.md` as a script. It does not start a Node daemon
that spawns agents. If a writer lease for this plan is already active, do
not spawn another writer; record that agent on the board and let the next
wakeup read it.

- `dispatch` `implement` or `fix`: `assert-automate-gate --gate spawn` must exit 0. One sibling worktree. One writer. Sealed instruction from the action. Do not code in the orchestrator session. Record the agent on the board (lease, alive) before the next wakeup.
- `dispatch` `review`: a different agent. No product edits.
- `merge`: at most the one part the tick named. `git merge` onto the plan branch. The next wakeup sees status `merged`.
- `reverify`: run the verifier command the action printed, on the merged tree. Set `verifierPassed` on the board only from that exit code. A claim is not a pass.
- `close`: `assert-automate-gate --gate done` exit 0, then `done`. Session handoff is inside that done checkpoint. Do not create a second close commit. Do not write `userValidatedAt`.
- `blocked-human`: write nothing that stamps the gate. Exit the tick.

Gate prose for phase-done, `evaluationGate`, `deliveryAuditGate`, and plan-end
`external-both` lives in `skills/shared/implement-automate-maestro.md` and
`skills/shared/implement-harness-reference.md`. Read it only when the printed
action needs it.

Before `dispatch`, `assert-automate-gate --gate spawn` must exit 0. Before
`close`, `--gate done` must exit 0. Phase close still requires evaluation,
lessons (`recorded` + path, or explicit `none`), review, and
`deliveryAuditGate` with a real report. Those gates are not waived. Gate
detail is `skills/shared/implement-automate-maestro.md` and
`skills/shared/implement-harness-reference.md`. Do not re-enter
`skills/core/implement.md` to code.

`blocked-human` reasons that stay human:

- `decision-review` — the log has a `tradeoff` or `scope-exit` and no human PASS
- `review-disposition` — a major is open and has no Accept, Defer, or Fix
- `review-finding` or `agent-dead` — two redispatches already used (`MAX_REDISPATCH`)
- `part-not-admitted` — the task is outside the catalog contract
- `await-user-validation` — every part is `done`. Do not write `userValidatedAt`. Do not finalize.

The tick never emits `operatorOverride`, `decision-review-pass`, or a delivery stamp.

Disjoint parts with done dependencies dispatch in the same tick. Overlapping
paths stay queued. The next wakeup is the continue. Do not ask the operator
to continue between parts of an approved plan.

## Card

The command is the single `/loop` line from `--card --plan-file <plan.md>`. It exits 1 with `blocked: plan-not-approved` when `planApprovedAt` is missing. `implement` prints that line only after the stamp. This file does not. There is no other start path.

The loop session runs one tick and must not print another `/loop`. Read the board, run `scripts/orchestrator-tick.js` once, dispatch only the printed actions, and exit. The next fire of that same `/loop` is the next wakeup. The board is the memory. The skill does not schedule the loop.

## What the tick does not do

No daemon, no workqueue, no self-armed scheduler. No product edits by the
orchestrator. No second writer on the same worktree. No silent Mode 1 when an
agent dies. No new task without `project` ratify — scope changes return as
`blocked-human`.
