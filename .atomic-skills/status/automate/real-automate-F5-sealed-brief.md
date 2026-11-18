# Phase writer brief — real-automate F5

You are a **code-only phase writer** implementing plan tasks in an isolated sibling worktree.
This sealed brief is self-contained. **No host chat history is included or authorized.**

## Code-only fence (HARD)

You are a **code-only phase writer**. You MAY:
- Orient on the phase work-order (task ids, paths, scopeBoundary, acceptance, verifier).
- Edit product/source paths inside each task's admitted targets (respect scopeBoundary exclusions).
- Run pre-close self-check verifiers for confidence.
- Create **implementation** microcommits with explicit paths only (`rtk git add <paths>` — never `git add .` / `-A`).
- Return a structured **claim report** for every task you attempted.

You **MUST NOT**:
- Invoke `done`, `phase-done`, finalize, archive, or any project-skill state transition.
- Mutate durable `.atomic-skills/` project state (plan.md, phase initiatives, rollups, lessons, review receipts, handoff).
- Mark tasks `status: done` in initiative YAML (orchestrator closes).
- Self-certify: a claim is confidence, not closure.
- Nest a phase worktree under the plan worktree.
- Depend on host chat history (this sealed brief is the full packet).

Never claim Layer 4 shipped. Never commit writer-lease secrets.

## Phase work-order

- **planSlug:** real-automate
- **phaseId:** F5
- **initiativePath:** /home/henry/atomic-skills/.worktrees/real-automate/.atomic-skills/projects/atomic-skills/real-automate/phases/f5-pagina-final.md (read-only)
- **worktreePath (cwd):** /home/henry/atomic-skills/.worktrees/real-automate-F5-writer
- **writerBranch:** impl/real-automate-F5-writer
- **baseRef:** 7d79ea82ad9233a6055eee53fb4d8cb6b91c931d
- **decisionLogPath:** /home/henry/atomic-skills/.worktrees/real-automate/.atomic-skills/projects/atomic-skills/real-automate/decisions/F5.jsonl (informational — host owns append; do not write)

### Tasks (3)

#### T-001 — Frases
- status: pending
- paths: ["src/decision-log.js","tests/decision-log.test.js","tests/final-page-reader.test.js"]
- scopeBoundary: ["Do not treat chat ok as presented evidence.","Do not merge the PR.","Do not archive in this phase's PR command."]
- acceptance: ["it - each JSONL decision carries said and saw.","it - an entry missing said or saw does not count as presented.","it - the page reader test covers those cases."]
- verifier: {"kind":"shell","command":"node --test tests/final-page-reader.test.js","expectExitCode":0}
- weight: 1

#### T-002 — Servidor
- status: pending
- paths: ["scripts/serve-flow.js","scripts/lib/serve-flow.js","src/plan-end-review.js","scripts/assert-automate-gate.js","tests/final-page-http.test.js"]
- scopeBoundary: ["Do not serve the final page as file://.","Do not let a session-written userValidatedAt pass finalize.","Do not stop serving flow.html preview from serve-flow.js."]
- acceptance: ["it - the final view does not open as file://.","it - the button stays off while any phase deliveryAuditGate is not passed.","it - serve-flow.js still serves the flow.html preview.","it - the button is the only writer of userValidatedAt.","it - a session-written timestamp fails userValidationOk and assert-automate-gate --gate finalize."]
- verifier: {"kind":"shell","command":"node --test tests/final-page-http.test.js","expectExitCode":0}
- weight: 1

#### T-003 — Paradas
- status: pending
- paths: ["scripts/automate-run.js","tests/automate-run-stops.test.js"]
- scopeBoundary: ["Do not reinstall a stop per phase after resume.","Do not merge the PR.","Do not archive in the PR command."]
- acceptance: ["it - travei, não avanço, and mudança grande open the same origin.","it - confirmation is recorded in the log.","it - the program resumes without reinstalling a stop per phase."]
- verifier: {"kind":"shell","command":"node --test tests/automate-run-stops.test.js","expectExitCode":0}
- weight: 1

## Lessons (apply)
- L-F4-1: if a gate cites `flow/flow.json` at `ratifiedGraphSha`, the production close path loads that file. Missing/empty/path-escape fail closed. Opt-in skip is a silent pass.
- L-F4-2: when a shared gate starts fail-closing, the same writer fence includes related allow-fixtures.
- L-F2-1: cited path missing/empty/escape is an issue.
- L-F2-2: size-cap detectors; do not inflate a parser.

Program of this plan: `scripts/automate-run.js` (not `automate-phase-run.js`).
TDD: failing test first per task. Keep-green: `node --test tests/phase-review-gate.test.js`, `tests/phase-delivery-audit-gate.test.js`, `tests/automate-run-writer.test.js`.

## Claim report (required output)

Write the claim report JSON to: `.atomic-skills/status/automate/real-automate-F5-claims.json`
Do **not** overwrite `real-automate-claims.json`. Three open tasks: exclusive `commitShas[]` per task (do not share one SHA; do not share base/head endpoints).

Envelope shape:
```json
{
  "planSlug": "<planSlug>",
  "phaseId": "<phaseId>",
  "worktreePath": "<cwd>",
  "writerBranch": "<branch>",
  "finishedAt": "<ISO>",
  "tasks": [
    {
      "taskId": "T-00N",
      "status": "claimed-pass|claimed-fail|blocked|skipped",
      "commitShas": ["..."],
      "base": null,
      "head": null,
      "paths": ["..."],
      "verifierCommand": "...",
      "exitCode": 0,
      "transcript": "..."
    }
  ]
}
```

Rules:
- Array key is **`tasks`** (canonical; `claims` is a tolerated alias only).
- Open claims need commit identity: non-empty `commitShas[]` **or** `base`+`head`.
- Open claims need `paths[]` ≥1 non-empty path, `verifierCommand`, `exitCode`, `transcript`.
- `claimed-pass` requires `exitCode === 0`.
- Multi-task exclusivity: do not share bare SHAs across open claims without exclusive `base`+`head` per task.
- Prefer exclusive `base`+`head` per task when multi-task commits share SHAs.
- Do not invent pass for missing work-order tasks.

## Exit

1. All listed verifiers green for claimed-pass tasks (self-check).
2. Write claim report to `.atomic-skills/status/automate/real-automate-F5-claims.json`.
3. Final message: summary of files changed, commit SHAs, claim report path, any blockers.
4. Do not mark tasks done in YAML. Do not call done/phase-done.

---
sealed-brief: true
host-chat-history: excluded
