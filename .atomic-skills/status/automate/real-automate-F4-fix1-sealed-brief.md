# Phase writer brief — real-automate F4

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
- **phaseId:** F4
- **initiativePath:** /home/henry/atomic-skills/.worktrees/real-automate/.atomic-skills/projects/atomic-skills/real-automate/phases/f4-review-e-o-flow-no-audit.md (read-only)
- **worktreePath (cwd):** /home/henry/atomic-skills/.worktrees/real-automate-F4-fix1-writer
- **writerBranch:** impl/real-automate-F4-fix1-writer
- **baseRef:** ff4764ce5c199243adf563edb7d016c9a61761b6
- **decisionLogPath:** /home/henry/atomic-skills/.worktrees/real-automate/.atomic-skills/projects/atomic-skills/real-automate/decisions/F4.jsonl (informational — host owns append; do not write)

### Tasks (1)

#### T-002 — Audit lê o grafo
- status: active
- paths: ["src/phase-delivery-audit-gate.js","tests/phase-delivery-audit-gate.test.js","skills/core/audit-delivery.md","src/automate-orchestrator-gates.js","tests/automate-orchestrator-gates.test.js","scripts/assert-automate-gate.js","tests/assert-automate-gate.test.js"]
- scopeBoundary: ["Do not treat the final page as this audit gate.","Do not skip reading flow/flow.json at ratifiedGraphSha.","Do not implement F5 page, button, PR, or archive.","Do not reopen the F3 writer/merge marco."]
- acceptance: ["it - audit-delivery refuses a divergent ratifiedGraphSha.","it - a flow.json fixture with one xor and a report missing that line fails.","it - where businessIntent disagrees with the graph, the graph wins.","it - deliveryAuditAllowsClose / canRunPhaseDone / assert-automate-gate --gate phase-done load flow/flow.json at ratifiedGraphSha; an honest CLOSED stamp without graph input fails under automate."]
- verifier: {"kind":"shell","command":"node --test tests/phase-delivery-audit-gate.test.js","expectExitCode":0}
- weight: 1

## F4-fix1 defect (this spawn)

Independent evaluation at HEAD `17af7584` (report `.atomic-skills/reviews/eval-real-automate-F4.md`) verdict **fail**, 1 major:

`deliveryAuditAllowsClose` (`src/phase-delivery-audit-gate.js` ~661-686) runs `deliveryAuditGraphCoverage` only when the caller already passed `flowDoc`, `flowPath`, or `ratifiedGraphSha` (`hasGraphInput`). `canRunPhaseDone` (`src/automate-orchestrator-gates.js` ~482-486) and `assert-automate-gate` (`scripts/assert-automate-gate.js` ~1096-1111) pass the stamp/gate only. An honest CLOSED stamp without those graph fields still allows close.

F4 BI: the gate that closes the phase reads `flow/flow.json` at `ratifiedGraphSha`. Helper `deliveryAuditGraphCoverage` exists; fixture tests pass when graph is injected. Production close path does not load the cited graph.

### Required behavior
1. TDD: add a failing test that `deliveryAuditAllowsClose` under `planExecutionMode: 'automate'` with an honest CLOSED stamp **and no** `flowDoc`/`flowPath`/`ratifiedGraphSha` does **not** allow close when graph coverage is missing. Watch it fail. Then implement.
2. Production close (`deliveryAuditAllowsClose` / `canRunPhaseDone` / `assert-automate-gate --gate phase-done`) must read `flow/flow.json` at `ratifiedGraphSha` (use `flowPathsForPlan` when a plan path/cwd is available; inject `exists`/`readFile`). Missing cited path fails closed (L-F2-1). Size-cap the report parser (L-F2-2); do not grow a CommonMark parser.
3. Keep existing T-002 tests green: divergent sha refused; xor without a report line fails; graph wins vs BI.
4. Keep-green: `node --test tests/phase-review-gate.test.js`, `tests/automate-product-fence.test.js`, `tests/automate-run-writer.test.js`, `tests/automate-host-pen.test.js`.
5. Do not implement F5. Do not swap the program to `automate-phase-run.js`. Do not reopen F3 writer/merge.

### Lessons
- L-F2-1: if a stamp cites a path, missing file/dir/empty/path-escape are issues.
- L-F2-2: size-cap the detector.

## Claim report (required output)

Write the claim report JSON to: `.atomic-skills/status/automate/real-automate-F4-fix1-claims.json`
Do **not** overwrite `.atomic-skills/status/automate/real-automate-claims.json` (F4 T-001/T-003 claims).

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
2. Write claim report to `.atomic-skills/status/automate/real-automate-F4-fix1-claims.json`.
3. Final message: summary of files changed, commit SHAs, claim report path, any blockers.
4. Do not mark tasks done in YAML. Do not call done/phase-done.

---
sealed-brief: true
host-chat-history: excluded
