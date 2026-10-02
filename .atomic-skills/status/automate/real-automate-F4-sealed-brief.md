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
- **worktreePath (cwd):** /home/henry/atomic-skills/.worktrees/real-automate-F4-writer
- **writerBranch:** impl/real-automate-F4-writer
- **baseRef:** 89206f5b4946b644cc597662b09e1b83b3952c79
- **decisionLogPath:** /home/henry/atomic-skills/.worktrees/real-automate/.atomic-skills/projects/atomic-skills/real-automate/decisions/F4.jsonl (informational — host owns append; do not write)

### Tasks (3)

#### T-001 — Both com falha real
- status: pending
- paths: ["scripts/automate-run.js","src/phase-review-gate.js","tests/phase-review-gate.test.js","meta/schemas/plan.schema.json"]
- scopeBoundary: ["Do not ask for the external CLI again mid-run.","Do not accept a session-written `- internal:` line as the external receipt.","Do not implement F5 page, button, PR, or archive."]
- acceptance: ["it - reviewExternalCli is stored on the plan before the first phase and is not asked again.","it - overrideReason without stderr of that external CLI process fails.","it - a receipt written by the session fails.","it - receipt records command, exit, stderr, and verdict."]
- verifier: {"kind":"shell","command":"node --test tests/phase-review-gate.test.js","expectExitCode":0}
- weight: 1

#### T-002 — Audit lê o grafo
- status: pending
- paths: ["src/phase-delivery-audit-gate.js","tests/phase-delivery-audit-gate.test.js","skills/core/audit-delivery.md"]
- scopeBoundary: ["Do not treat the final page as this audit gate.","Do not skip reading flow/flow.json at ratifiedGraphSha.","Do not implement F5 page, button, PR, or archive."]
- acceptance: ["it - audit-delivery refuses a divergent ratifiedGraphSha.","it - a flow.json fixture with one xor and a report missing that line fails.","it - where businessIntent disagrees with the graph, the graph wins."]
- verifier: {"kind":"shell","command":"node --test tests/phase-delivery-audit-gate.test.js","expectExitCode":0}
- weight: 1

#### T-003 — Loop com teto
- status: pending
- paths: ["scripts/automate-run.js","src/automate-product-fence.js","tests/automate-product-fence.test.js","tests/phase-review-gate.test.js"]
- scopeBoundary: ["Do not advance after a third review that still has critical or major.","Do not put a mix finding of the stamped block into the review loop.","Do not implement F5 page, button, PR, or archive."]
- acceptance: ["it - critical or major dispatches an isolated fix agent and review returns, cap 3.","it - without critical or major, remaining findings go to status/automate/<slug>.json, the phase closes, and the next opens.","it - on the third review, critical or major stops.","it - a mix finding of the stamped block stops immediately and does not enter the loop.","it - phase close validates the claim and passes src/automate-product-fence.js."]
- verifier: {"kind":"shell","command":"node --test tests/phase-review-gate.test.js","expectExitCode":0}
- weight: 1

## Claim report (required output)

Write the claim report JSON to: `.atomic-skills/status/automate/real-automate-claims.json`

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
2. Write claim report to `.atomic-skills/status/automate/real-automate-claims.json`.
3. Final message: summary of files changed, commit SHAs, claim report path, any blockers.
4. Do not mark tasks done in YAML. Do not call done/phase-done.

---
sealed-brief: true
host-chat-history: excluded
