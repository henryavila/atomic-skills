# Phase writer brief — audit-delivery-hardening F0

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
- **phaseId:** F0
- **initiativePath:** /Volumes/External/code/atomic-skills/.atomic-skills/projects/atomic-skills/audit-delivery-hardening/phases/audit-delivery-hardening-f0-p0-craft-foundation.md (read-only)
- **worktreePath (cwd):** /Volumes/External/code/audit-delivery-hardening-F0-writer
- **writerBranch:** impl/audit-delivery-hardening-F0-writer
- **baseRef:** 8a2b43f199023c5b3df58fe5c2ea55581a505612
- **decisionLogPath:** /Volumes/External/code/atomic-skills/.atomic-skills/projects/atomic-skills/audit-delivery-hardening/decisions/F0.jsonl (informational — host owns append; do not write)

### Tasks (5)

#### T-001 — EN-only enums + drop hard PT language
- status: pending
- paths: ["skills/core/audit-delivery.md","skills/shared/audit-delivery-assets/axis-brief-template.md","skills/shared/audit-delivery-assets/reaudit-brief-template.md","docs/skills/audit-delivery.md","meta/catalog.yaml"]
- scopeBoundary: ["Do not change product positioning vs review-code.","Do not invent PT skill forks.","Do not implement residual protocol (F1)."]
- acceptance: ["Skill body and assets use RESOLVED|PARTIAL|NO|N/A and CLOSED|PARTIAL|OPEN (and REGRESSION on reaudit).","No line hardcodes presenting output in Portuguese/Brazilian as skill rule.","Section headers in templates are English."]
- verifier: {"kind":"shell","command":"! rg -q 'Present in Portuguese|FECHADO|RESOLVIDO|Reauditoria|Resumo executivo' skills/core/audit-delivery.md skills/shared/audit-delivery-assets","expectExitCode":0}

#### T-002 — Parse-args-first HARD step
- status: pending
- paths: ["skills/core/audit-delivery.md"]
- scopeBoundary: ["Do not add a Node CLI unless needed later; prose parse is enough for v1."]
- acceptance: ["Step 0 parses ARG_VAR into mode/axes/out/depth/flags before any Intent Package file read or report write.","Documented accepted flags match catalog args."]
- verifier: {"kind":"shell","command":"rg -n 'Parse.*ARG_VAR|BEFORE any|parse.*before' skills/core/audit-delivery.md","expectExitCode":0}

#### T-003 — Wire existing assets + ASSETS index
- status: pending
- paths: ["skills/core/audit-delivery.md"]
- scopeBoundary: ["Do not invent full checklist tree yet (F3); must load the two existing templates at the correct phases."]
- acceptance: ["Body contains READ_TOOL or ASSETS_PATH references to both templates.","Phase 2 spawn and reaudit/re-run instruct filling those templates."]
- verifier: {"kind":"shell","command":"rg -n 'axis-brief-template|reaudit-brief-template|ASSETS_PATH' skills/core/audit-delivery.md","expectExitCode":0}

#### T-004 — Reaudit entry path
- status: pending
- paths: ["skills/shared/audit-delivery-assets/reaudit-entry.md","skills/core/audit-delivery.md"]
- scopeBoundary: ["Full dual residual-blind reaudit is F4; F0 only documents load-report recover package reaudit append."]
- acceptance: ["Mode table includes reaudit entry requiring --out or report path, read-only product tree, report append.","Asset reaudit-entry.md exists and is READ at reaudit entry."]
- verifier: {"kind":"shell","command":"test -f skills/shared/audit-delivery-assets/reaudit-entry.md && rg -n 'reaudit-entry|mode=reaudit|--out' skills/core/audit-delivery.md","expectExitCode":0}

#### T-005 — Catalog argument_hint + mode docs
- status: pending
- paths: ["meta/catalog.yaml","docs/skills/audit-delivery.md"]
- scopeBoundary: ["Do not change skill count schema; keep mutates_repo true but clarify RO default in description."]
- acceptance: ["argument_hint includes --out and mode flags within length budget.","Description/examples state default is read-only.","npm run validate-skills exits 0."]
- verifier: {"kind":"shell","command":"npm run validate-skills && rg -n 'argument_hint|read-only|audit-and-fix' meta/catalog.yaml","expectExitCode":0}

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
