# Phase writer brief — brainstorm-hardening F0

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
- **phaseId:** F0
- **initiativePath:** /Volumes/External/code/atomic-skills/.worktrees/brainstorm-hardening/.atomic-skills/projects/atomic-skills/brainstorm-hardening/phases/f0-skill-rewrite-bi-contract-lazy-assets.md (read-only)
- **worktreePath (cwd):** /Volumes/External/code/atomic-skills/.worktrees/brainstorm-hardening-F0-writer
- **writerBranch:** impl/brainstorm-hardening-F0-writer
- **baseRef:** cc60fd46fb96c861d35c5ff9635ef304b3b43175
- **decisionLogPath:** /Volumes/External/code/atomic-skills/.worktrees/brainstorm-hardening/.atomic-skills/projects/atomic-skills/brainstorm-hardening/decisions/F0.jsonl (informational — host owns append; do not write)

### Tasks (3)

#### T-001 — — Author brainstorm-assets lazy pack
- status: pending
- paths: ["skills/shared/brainstorm-assets/interview.md","skills/shared/brainstorm-assets/research.md","skills/shared/brainstorm-assets/process-receipt.md"]
- scopeBoundary: ["do not rewrite skills/core/brainstorm.md process body in this task; do not touch review-plan or debate gate-mode beyond cross-links"]
- acceptance: ["interview.md has HALT questions and bans bare ok/yes without spine; research.md names research-digest.md and weak-digest bars; process-receipt.md names interviewAccepted and design-gates path"]
- verifier: {"kind":"shell","command":"test -f skills/shared/brainstorm-assets/interview.md && test -f skills/shared/brainstorm-assets/research.md && test -f skills/shared/brainstorm-assets/process-receipt.md && rg -q 'proof-of-work|Interview|entrevista' skills/shared/brainstorm-assets/interview.md && rg -q 'research-digest' skills/shared/brainstorm-assets/research.md && rg -q 'interviewAccepted' skills/shared/brainstorm-assets/process-receipt.md"}

#### T-002 — — Rewrite brainstorm.md process (always interview + research + debate)
- status: pending
- paths: ["skills/core/brainstorm.md","docs/skills/brainstorm.md"]
- scopeBoundary: ["do not implement find-missing-design-process.js or assert-creation-stage.js here; do not change Stage 8 review-plan; do not force debate on adopt or ad-hoc"]
- acceptance: ["B0 Interview HARD before research/debate; B0b research-digest required; B1 always debate --gate; skip-ladder phrases gone; red-flags cover skip-interview and empty digest; docs/skills/brainstorm.md summarizes new flow; body stays thin and points at brainstorm-assets"]
- verifier: {"kind":"shell","command":"rg -q 'Interview|entrevista|B0' skills/core/brainstorm.md && rg -q 'debate --gate|debate.*--gate' skills/core/brainstorm.md && ! rg -q 'Run a panel ONLY when' skills/core/brainstorm.md && rg -q 'research-digest|B0b' skills/core/brainstorm.md && rg -q 'brainstorm-assets' skills/core/brainstorm.md && rg -q 'Interview|debate|lint-design' docs/skills/brainstorm.md"}

#### T-003 — — Stage 2 brainstorm contract + businessIntent draft-and-ratify
- status: pending
- paths: ["skills/shared/project-assets/project-create-plan.md","tests/project.test.js"]
- scopeBoundary: ["do not split create-plan into stage-N files in this task (F2 T-009); do not implement assert-creation-stage.js here"]
- acceptance: ["Stage 2 describes interview plus research plus always debate --gate and no old ladder phrase; Stage 6 businessIntent is draft-and-ratify (agent drafts spine, user ratifies via AskUserQuestion); phrase must not pre-fill or user-written blank spine for BI is removed; tests assert brainstorm wiring and draft-and-ratify or businessIntent draft language"]
- verifier: {"kind":"shell","command":"! rg -q 'only when ≥2 viable approaches AND' skills/shared/project-assets/project-create-plan.md && ! rg -q 'must not pre-fill the five fields' skills/shared/project-assets/project-create-plan.md && rg -q 'draft-and-ratify|drafts the|Drafted|businessIntent' skills/shared/project-assets/project-create-plan.md && rg -q 'debate --gate|Interview|interview' skills/shared/project-assets/project-create-plan.md && node --test tests/project.test.js"}

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
