# Phase writer brief — audit-delivery-hardening F4

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
- **phaseId:** F4
- **initiativePath:** /Volumes/External/code/atomic-skills/.atomic-skills/projects/atomic-skills/audit-delivery-hardening/phases/audit-delivery-hardening-f4-p2-advanced-dogfood.md (read-only)
- **worktreePath (cwd):** /Volumes/External/code/audit-delivery-hardening-F4-writer
- **writerBranch:** impl/audit-delivery-hardening-F4-writer
- **baseRef:** 940069192829d6e516176cb17384c457313adb96
- **decisionLogPath:** /Volumes/External/code/atomic-skills/.atomic-skills/projects/atomic-skills/audit-delivery-hardening/decisions/F4.jsonl (informational — host owns append; do not write)

### Tasks (6)

#### T-022 — Prosecution axis NO-only
- status: pending
- paths: ["skills/shared/audit-delivery-assets/checklists/prosecution.md"]
- scopeBoundary: []
- acceptance: ["Optional prosecution axis cannot emit RESOLVED; auto-recommend on empty first merge for large rewrites."]
- verifier: {"kind":"shell","command":"rg -n 'prosecution|NO-only|disprove' skills/core/audit-delivery.md skills/shared/audit-delivery-assets/","expectExitCode":0}

#### T-023 — Fresh critic merge full depth
- status: pending
- paths: ["skills/shared/audit-delivery-assets/critic-merge.md"]
- scopeBoundary: ["Light depth may keep parent merge."]
- acceptance: ["Full depth documents gap list then product downgrade-only then fresh critic preferred."]
- verifier: {"kind":"shell","command":"rg -n 'critic|fresh|Gap List|downgrade' skills/core/audit-delivery.md skills/shared/audit-delivery-assets/","expectExitCode":0}

#### T-024 — Dual reaudit ledger + residual-blind
- status: pending
- paths: ["skills/shared/audit-delivery-assets/reaudit-entry.md"]
- scopeBoundary: []
- acceptance: ["Per-finding retest plus residual-blind without claimed-fix narratives; plateau on open C+H."]
- verifier: {"kind":"shell","command":"rg -n 'residual-blind|ledger|claimed fix' skills/shared/audit-delivery-assets/reaudit-entry.md skills/core/audit-delivery.md","expectExitCode":0}

#### T-025 — Fix composition recipe
- status: pending
- paths: ["skills/shared/audit-delivery-assets/fix-composition-recipe.md"]
- scopeBoundary: ["Do not re-implement parallel-dispatch."]
- acceptance: ["fix-composition-recipe.md partitions findings then fix then re-run audit-delivery."]
- verifier: {"kind":"shell","command":"test -f skills/shared/audit-delivery-assets/fix-composition-recipe.md && rg -n 'parallel-dispatch|re-run|plateau' skills/shared/audit-delivery-assets/fix-composition-recipe.md","expectExitCode":0}

#### T-026 — Optional cross-model residual critic flag
- status: pending
- paths: ["skills/core/audit-delivery.md","meta/catalog.yaml"]
- scopeBoundary: ["Do not seal intent out of Spec Package."]
- acceptance: ["--cross=off|residual|critic|reaudit default off; external brief Spec/ledger only."]
- verifier: {"kind":"shell","command":"rg -n 'cross=|cross-model|Spec Package' skills/core/audit-delivery.md meta/catalog.yaml","expectExitCode":0}

#### T-027 — businessIntent import + dogfood checklist
- status: pending
- paths: ["skills/shared/audit-delivery-assets/intent-package.md",".atomic-skills/projects/atomic-skills/audit-delivery-hardening/dogfood-checklist.md"]
- scopeBoundary: []
- acceptance: ["BI import drafts package from value/workflow/rules/outOfScope/doneWhen.","Dogfood checklist encodes four SM failure modes AND implement hard-gate (deliveryAuditGate never skip)."]
- verifier: {"kind":"shell","command":"rg -n 'businessIntent|doneWhen|outOfScope' skills/shared/audit-delivery-assets/intent-package.md && test -f .atomic-skills/projects/atomic-skills/audit-delivery-hardening/dogfood-checklist.md && rg -q 'deliveryAuditGate|never skip|hard-gate' .atomic-skills/projects/atomic-skills/audit-delivery-hardening/dogfood-checklist.md","expectExitCode":0}

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
