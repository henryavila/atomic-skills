# Phase writer brief — audit-delivery-hardening F3

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

- **planSlug:** audit-delivery-hardening
- **phaseId:** F3
- **initiativePath:** /Volumes/External/code/atomic-skills/.atomic-skills/projects/atomic-skills/audit-delivery-hardening/phases/audit-delivery-hardening-f3-p1-thin-body-guards.md (read-only)
- **worktreePath (cwd):** /Volumes/External/code/audit-delivery-hardening-F3-writer
- **writerBranch:** impl/audit-delivery-hardening-F3-writer
- **baseRef:** 2d5a3ce9a9f232e016ca419ad0947a7d1150394b
- **decisionLogPath:** /Volumes/External/code/atomic-skills/.atomic-skills/projects/atomic-skills/audit-delivery-hardening/decisions/F3.jsonl (informational — host owns append; do not write)

### Tasks (4)

#### T-018 — Thin body rewrite ~120-180 lines
- status: pending
- paths: ["skills/core/audit-delivery.md"]
- scopeBoundary: ["Keep Iron Law, mode dispatch, HARD-GATEs, red flags compressed, composition note."]
- acceptance: ["Body <= ~220 lines soft; Assets lazy index lists all assets."]
- verifier: {"kind":"shell","command":"wc -l skills/core/audit-delivery.md | awk '{exit !($1<=220)}' && rg -n 'Assets \\(lazy\\)|ASSETS_PATH' skills/core/audit-delivery.md","expectExitCode":0}

#### T-019 — Checklists + report + findings ledger assets
- status: pending
- paths: ["skills/shared/audit-delivery-assets/report-template.md","skills/shared/audit-delivery-assets/checklists/product.md","skills/shared/audit-delivery-assets/checklists/residual.md"]
- scopeBoundary: []
- acceptance: ["product and residual checklists; report-template SSOT including Accept Register."]
- verifier: {"kind":"shell","command":"test -f skills/shared/audit-delivery-assets/report-template.md && test -f skills/shared/audit-delivery-assets/checklists/product.md && test -f skills/shared/audit-delivery-assets/checklists/residual.md","expectExitCode":0}

#### T-020 — Static guard assets referenced
- status: pending
- paths: ["tests/audit-delivery-assets.test.js"]
- scopeBoundary: ["Static file graph only; no skill runtime executor."]
- acceptance: ["tests/audit-delivery-assets.test.js fails on orphan assets; node --test exits 0."]
- verifier: {"kind":"shell","command":"node --test tests/audit-delivery-assets.test.js","expectExitCode":0}

#### T-021 — INVESTIGATOR fallback
- status: pending
- paths: ["skills/core/audit-delivery.md"]
- scopeBoundary: []
- acceptance: ["If spawn unavailable, sequential inline axes with degradation warning."]
- verifier: {"kind":"shell","command":"rg -n 'INVESTIGATOR|unavailable|degraded|inline' skills/core/audit-delivery.md","expectExitCode":0}

## Claim report (required output)

Write the claim report JSON to: `.atomic-skills/status/automate/audit-delivery-hardening-claims.json`

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
2. Write claim report to `.atomic-skills/status/automate/audit-delivery-hardening-claims.json`.
3. Final message: summary of files changed, commit SHAs, claim report path, any blockers.
4. Do not mark tasks done in YAML. Do not call done/phase-done.

---
sealed-brief: true
host-chat-history: excluded
