# Phase writer brief — brainstorm-hardening F3

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
- **phaseId:** F3
- **initiativePath:** /Volumes/External/code/atomic-skills/.worktrees/brainstorm-hardening/.atomic-skills/projects/atomic-skills/brainstorm-hardening/phases/f3-dogfood-pressure-tests-announce.md (read-only)
- **worktreePath (cwd):** /Volumes/External/code/atomic-skills/.worktrees/brainstorm-hardening-F3-writer
- **writerBranch:** impl/brainstorm-hardening-F3-writer
- **baseRef:** 3cf4fac3f8a58d473da3560ad597551789ed0f6d
- **decisionLogPath:** /Volumes/External/code/atomic-skills/.worktrees/brainstorm-hardening/.atomic-skills/projects/atomic-skills/brainstorm-hardening/decisions/F3.jsonl (informational — host owns append; do not write)

### Tasks (2)

#### T-010 — — Pressure-test red-flags for skip paths and fidelity escapes
- status: pending
- paths: ["projects/atomic-skills/brainstorm-hardening/pressure-tests.md"]
- scopeBoundary: ["do not re-run full Inc3 suite; additive scenarios only for this plan"]
- acceptance: ["documents at least 5 scenarios including skip interview under time pressure, skip debate because obvious, empty research digest theater, skip creation stage without assert, more text in monólito increases ignore; each maps to a Red-Flag or detector or assert-creation-stage fail"]
- verifier: {"kind":"shell","command":"test -f projects/atomic-skills/brainstorm-hardening/pressure-tests.md && rg -q 'skip interview|skip debate|empty digest|assert-creation-stage|monolito|ignore' projects/atomic-skills/brainstorm-hardening/pressure-tests.md"}

#### T-011 — — Dogfood checklist and onboarding note
- status: pending
- paths: ["docs/design/project-onboarding/html-design-brief.md","projects/atomic-skills/brainstorm-hardening/dogfood-checklist.md"]
- scopeBoundary: ["do not rewrite entire onboarding HTML; only new plan / brainstorm stage description; no Stage 8 behavior changes"]
- acceptance: ["dogfood-checklist lists interview research-digest debate critic lint design-gates assert-creation-stage stage-N router draft-and-ratify Stage 4; onboarding brief mentions interview always debate and thin stage process"]
- verifier: {"kind":"shell","command":"test -f projects/atomic-skills/brainstorm-hardening/dogfood-checklist.md && rg -q 'assert-creation-stage|draft-and-ratify|stage-' projects/atomic-skills/brainstorm-hardening/dogfood-checklist.md && rg -q 'entrevista|debate|Interview|always|estágio|stage' docs/design/project-onboarding/html-design-brief.md"}

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
