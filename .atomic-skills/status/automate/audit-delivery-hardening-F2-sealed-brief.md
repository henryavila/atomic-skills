# Phase writer brief — audit-delivery-hardening F2

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
- **phaseId:** F2
- **initiativePath:** /Volumes/External/code/atomic-skills/.atomic-skills/projects/atomic-skills/audit-delivery-hardening/phases/audit-delivery-hardening-f2-p1-evidence-ecosystem.md (read-only)
- **worktreePath (cwd):** /Volumes/External/code/audit-delivery-hardening-F2-writer
- **writerBranch:** impl/audit-delivery-hardening-F2-writer
- **baseRef:** b83fefd28b2abf327a7626d7ee3e0062787522e3
- **decisionLogPath:** /Volumes/External/code/atomic-skills/.atomic-skills/projects/atomic-skills/audit-delivery-hardening/decisions/F2.jsonl (informational — host owns append; do not write)

### Tasks (7)

#### T-011 — Staged evidence columns S C U O T X
- status: pending
- paths: ["skills/shared/audit-delivery-assets/matrices.md"]
- scopeBoundary: ["Do not require all stages on cosmetic decisions."]
- acceptance: ["matrices.md documents stages; RESOLVED forbidden if required stage is ? or fail."]
- verifier: {"kind":"shell","command":"test -f skills/shared/audit-delivery-assets/matrices.md && rg -n 'S.*C.*U|required stage|RESOLVED' skills/shared/audit-delivery-assets/matrices.md","expectExitCode":0}

#### T-012 — Matrix C must-not negative space
- status: pending
- paths: ["skills/shared/audit-delivery-assets/matrices.md"]
- scopeBoundary: ["No full FMEA."]
- acceptance: ["Must-not rows; RESOLVED means searched-and-absent with evidence; seeded from non-goals."]
- verifier: {"kind":"shell","command":"rg -n 'must-not|Must NOT|Matrix C|mustNot' skills/shared/audit-delivery-assets/ skills/core/audit-delivery.md","expectExitCode":0}

#### T-013 — Spec Package strip anti-success-framing
- status: pending
- paths: ["skills/shared/audit-delivery-assets/spec-package.md"]
- scopeBoundary: ["Intent criteria stay; success narrative out."]
- acceptance: ["spec-package.md; axis brief uses Spec Package only."]
- verifier: {"kind":"shell","command":"test -f skills/shared/audit-delivery-assets/spec-package.md && rg -n 'Spec Package|success narrative|shipping narrative' skills/shared/audit-delivery-assets/ skills/core/audit-delivery.md","expectExitCode":0}

#### T-014 — Multi-hop evidence bar for RESOLVED
- status: pending
- paths: ["skills/shared/audit-delivery-assets/matrices.md"]
- scopeBoundary: []
- acceptance: ["Load-bearing RESOLVED requires >=2 chain hops or single-surface waiver."]
- verifier: {"kind":"shell","command":"rg -n 'multi-hop|chain|2 hops|≥2' skills/shared/audit-delivery-assets/ skills/core/audit-delivery.md","expectExitCode":0}

#### T-015 — Add --depth=light|full
- status: pending
- paths: ["skills/core/audit-delivery.md","meta/catalog.yaml"]
- scopeBoundary: []
- acceptance: ["full default; light still forbids CLOSED on CRITICAL / residual opt-out / load-bearing NO."]
- verifier: {"kind":"shell","command":"rg -n 'depth=light|depth=full|--depth' skills/core/audit-delivery.md meta/catalog.yaml","expectExitCode":0}

#### T-016 — Sibling catalog disambiguation (plan-end != delivery audit)
- status: pending
- paths: ["meta/catalog.yaml","docs/skills/audit-delivery.md"]
- scopeBoundary: ["Disambiguation copy only — hard phase-done gate is T-017.","Do not describe audit-delivery as optional/soft after phase close."]
- acceptance: ["when_not disambiguates plan-end intentVsDelivered and parallel-dispatch-audit.","Catalog/docs state phase close requires this skill (hard), not a soft tip."]
- verifier: {"kind":"shell","command":"rg -n 'audit-delivery' meta/catalog.yaml docs/skills/ && rg -n 'intentVsDelivered|plan-end|parallel-dispatch-audit|when_not|phase-done|hard' meta/catalog.yaml docs/skills/audit-delivery.md","expectExitCode":0}

#### T-017 — implement hard-gate deliveryAuditGate on every phase-done (NEVER skippable)
- status: pending
- paths: ["src/phase-delivery-audit-gate.js","skills/core/implement.md","skills/shared/implement-automate-maestro.md","skills/shared/implement-antipatterns.md","src/automate-orchestrator-gates.js"]
- scopeBoundary: ["Gate is on each phase-done, not only plan-end finalize.","Plan-end intentVsDelivered stays separate and is not a substitute.","No skip path: do not add operatorSkip / status skipped acceptance for this gate.","Mode-1 and pure-maestro both hard-require the gate."]
- acceptance: ["Phase close order runs audit-delivery then stamps phases[].deliveryAuditGate before phase-done.","Stamp shape: status passed + reportPath + verdict CLOSED|PARTIAL + verifiedAt; OPEN never stamps passed.","Skip is illegal: missing gate, skipped, operatorSkip, reason-only, empty reportPath all fail closed.","canRunPhaseDone and assert-automate-gate --gate phase-done require valid deliveryAuditGate.","implement red-flag/antipattern forbids soft-suggest, skip, forge, review-code/suite substitute.","Unit tests cover skip fail / missing fail / valid CLOSED pass."]
- verifier: {"kind":"shell","command":"test -f src/phase-delivery-audit-gate.js && rg -n 'deliveryAuditGate|deliveryAuditAllowsClose|audit-delivery' skills/core/implement.md skills/shared/implement-automate-maestro.md skills/shared/implement-antipatterns.md src/automate-orchestrator-gates.js && rg -n 'deliveryAudit' tests/","expectExitCode":0}

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
