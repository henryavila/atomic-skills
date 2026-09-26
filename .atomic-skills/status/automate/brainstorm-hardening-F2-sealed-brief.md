# Phase writer brief — brainstorm-hardening F2

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
- **phaseId:** F2
- **initiativePath:** /Volumes/External/code/atomic-skills/.worktrees/brainstorm-hardening/.atomic-skills/projects/atomic-skills/brainstorm-hardening/phases/f2-receipts-stage-assert-create-plan-split.md (read-only)
- **worktreePath (cwd):** /Volumes/External/code/atomic-skills/.worktrees/brainstorm-hardening-F2-writer
- **writerBranch:** impl/brainstorm-hardening-F2-writer
- **baseRef:** 7111c157294ed1191f1000f3b486b6a5ee3e3b08
- **decisionLogPath:** /Volumes/External/code/atomic-skills/.worktrees/brainstorm-hardening/.atomic-skills/projects/atomic-skills/brainstorm-hardening/decisions/F2.jsonl (informational — host owns append; do not write)

### Tasks (4)

#### T-006 — — design-gates and creation-gates helpers
- status: pending
- paths: ["scripts/design-gates.js","scripts/creation-gates.js","skills/shared/brainstorm-assets/process-receipt.md","tests/design-gates.test.js","tests/creation-gates.test.js"]
- scopeBoundary: ["do not change find-weak-business-intent rules; do not write plan.md product state beyond helpers under status/"]
- acceptance: ["design-gates create/update/read with schemaVersion 0.1 fields interviewAccepted debateGate researchDigest criticVerdict userApproved status; creation-gates supports monotonic stage field and ordered stages list; unit tests cover happy path missing fields and illegal stage skip"]
- verifier: {"kind":"shell","command":"node --test tests/design-gates.test.js tests/creation-gates.test.js"}

#### T-007 — — Detectors find-missing-design-process find-weak-design assert-creation-stage
- status: pending
- paths: ["scripts/find-missing-design-process.js","scripts/find-weak-design.js","scripts/assert-creation-stage.js","tests/find-missing-design-process.test.js","tests/find-weak-design.test.js","tests/assert-creation-stage.test.js"]
- scopeBoundary: ["do not false-fail adopt/ad-hoc paths; CLI takes explicit plan design or creation-gate path"]
- acceptance: ["find-missing exits 1 when design process receipt missing or not ready; find-weak fails soft-language non-goals echo short interview weak digest; assert-creation-stage exits 1 on skip or declare ready early; negative tests for exempt lanes; all three test files green"]
- verifier: {"kind":"shell","command":"node --test tests/find-missing-design-process.test.js tests/find-weak-design.test.js tests/assert-creation-stage.test.js"}

#### T-008 — — Wire Stage 4 and brainstorm B5 to detectors
- status: pending
- paths: ["skills/shared/project-assets/project-create-plan.md","skills/core/brainstorm.md","tests/project.test.js"]
- scopeBoundary: ["do not change Stage 8 receipt scripts; stage-N split may still be incomplete until T-009 but detector names must appear in the create-plan surface the router keeps"]
- acceptance: ["Stage 4 runs lint-design then find-missing-design-process then find-weak-design before decompose; brainstorm B5 refuses handoff unless design-gates ready; HARD-BLOCK language present; tests assert script names"]
- verifier: {"kind":"shell","command":"rg -q 'find-missing-design-process' skills/shared/project-assets/project-create-plan.md && rg -q 'find-weak-design' skills/shared/project-assets/project-create-plan.md && rg -q 'HARD-BLOCK|find-missing-design-process' skills/shared/project-assets/project-create-plan.md && rg -q 'design-gates|find-missing-design-process' skills/core/brainstorm.md && node --test tests/project.test.js"}

#### T-009 — — Split create-plan into thin router plus stage-N.md and assert stage advance
- status: pending
- paths: ["skills/shared/project-assets/project-create-plan.md","skills/shared/project-assets/new-plan/stage-1.md","skills/shared/project-assets/new-plan/stage-2.md","skills/shared/project-assets/new-plan/stage-3.md","skills/shared/project-assets/new-plan/stage-4.md","skills/shared/project-assets/new-plan/stage-5.md","skills/shared/project-assets/new-plan/stage-6.md","skills/shared/project-assets/new-plan/stage-7.md","skills/shared/project-assets/new-plan/stage-8.md","skills/shared/project-assets/new-plan/stage-9.md","tests/project.test.js","tests/assert-creation-stage.test.js"]
- scopeBoundary: ["do not rewrite Stage 8 review-plan skill body; keep adopt path either as stage file or thin pointer without expanding adopt into novel behavior; do not add walls of Red Flags"]
- acceptance: ["project-create-plan.md is a thin router that tells agent to read only new-plan/stage-N.md for current creation stage; each stage-1 through stage-9 file exists with a Contract section; stage-6 states BI draft-and-ratify; router or stage-6/9 invokes assert-creation-stage; create-plan file line count is materially smaller than pre-split monólito or router explicitly defers body to stage files; tests pin router loads stage path and assert-creation-stage name"]
- verifier: {"kind":"shell","command":"test -f skills/shared/project-assets/new-plan/stage-1.md && test -f skills/shared/project-assets/new-plan/stage-6.md && test -f skills/shared/project-assets/new-plan/stage-9.md && rg -q 'stage-6|new-plan/stage' skills/shared/project-assets/project-create-plan.md && rg -q 'draft-and-ratify|Drafted|drafts the' skills/shared/project-assets/new-plan/stage-6.md && rg -q 'assert-creation-stage' skills/shared/project-assets/project-create-plan.md skills/shared/project-assets/new-plan/stage-6.md skills/shared/project-assets/new-plan/stage-9.md && node --test tests/project.test.js tests/assert-creation-stage.test.js"}

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
