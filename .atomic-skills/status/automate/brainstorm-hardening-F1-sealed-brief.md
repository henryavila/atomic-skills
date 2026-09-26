# Phase writer brief — brainstorm-hardening F1

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

- **planSlug:** brainstorm-hardening
- **phaseId:** F1
- **initiativePath:** /Volumes/External/code/atomic-skills/.worktrees/brainstorm-hardening/.atomic-skills/projects/atomic-skills/brainstorm-hardening/phases/f1-expand-lint-design-and-skill-docs-contr.md (read-only)
- **worktreePath (cwd):** /Volumes/External/code/atomic-skills/.worktrees/brainstorm-hardening-F1-writer
- **writerBranch:** impl/brainstorm-hardening-F1-writer
- **baseRef:** 0de3f10bdbcb0dd958c51619e4a278ba9c2f5c23
- **decisionLogPath:** /Volumes/External/code/atomic-skills/.worktrees/brainstorm-hardening/.atomic-skills/projects/atomic-skills/brainstorm-hardening/decisions/F1.jsonl (informational — host owns append; do not write)

### Tasks (2)

#### T-004 — — Expand lint-design REQUIRED sections
- status: pending
- paths: ["scripts/lint-design.js","tests/lint-design.test.js"]
- scopeBoundary: ["do not add design-gates or creation-stage logic here; do not change lint-source.js SPEC gate"]
- acceptance: ["REQUIRED always includes Context Non-goals Interview; Decisions and Chosen approach remain; Blast radius stays migration-only; empty bodies fail; tests cover missing Interview Non-goals Context"]
- verifier: {"kind":"shell","command":"node --test tests/lint-design.test.js"}

#### T-005 — — Fixture coverage and docs for new lint sections
- status: pending
- paths: ["tests/lint-design.test.js","docs/skills/brainstorm.md"]
- scopeBoundary: ["do not mass-edit historical projects/*/design.md files"]
- acceptance: ["tests mention Interview Non-goals Context; docs/skills/brainstorm.md documents new lint-required sections"]
- verifier: {"kind":"shell","command":"rg -q 'Interview|Non-goals|Context' tests/lint-design.test.js && rg -q 'lint-design|Non-goals|Interview' docs/skills/brainstorm.md"}

## Claim report (required output)

Write the claim report JSON to: `.atomic-skills/status/automate/brainstorm-hardening-claims.json`

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
2. Write claim report to `.atomic-skills/status/automate/brainstorm-hardening-claims.json`.
3. Final message: summary of files changed, commit SHAs, claim report path, any blockers.
4. Do not mark tasks done in YAML. Do not call done/phase-done.

---
sealed-brief: true
host-chat-history: excluded
