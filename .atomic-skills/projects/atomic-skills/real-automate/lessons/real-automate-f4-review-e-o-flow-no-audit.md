---
schemaVersion: "0.2"
slug: real-automate-f4-review-e-o-flow-no-audit
projectId: atomic-skills
parentPlan: real-automate
lessons:
  - id: L-F4-1
    statement: deliveryAuditAllowsClose ran graph coverage only when the caller already passed flowDoc, flowPath, or ratifiedGraphSha. Honest CLOSED without those fields still allowed phase-done.
    corrective: If the gate that closes the phase cites flow/flow.json at ratifiedGraphSha, the production close path loads that file. Missing cited path, empty doc, and path-escape fail closed. Opt-in hasGraphInput is a silent skip.
    scope: reusable
    appliesTo: []
    status: open
    confidence: 2
    evidence: .atomic-skills/reviews/eval-real-automate-F4.md
    createdAt: 2026-10-02T18:20:00.000Z
    validatedAt: 2026-10-02T18:20:00.000Z
  - id: L-F4-2
    statement: F4-fix1 made the close path fail-closed without graph. Nine tests in lifecycle-order-guard, decision-review-gate, and implement-phase-agents-contract still expected stamp-only allow and went red on the merged tree.
    corrective: When a shared gate starts fail-closing, the same writer fence includes the related allow-fixtures. Do not leave those suites for a second redispatch.
    scope: reusable
    appliesTo: []
    status: open
    confidence: 2
    evidence: .atomic-skills/reviews/eval-real-automate-F4.md
    createdAt: 2026-10-02T18:20:00.000Z
    validatedAt: 2026-10-02T18:20:00.000Z
---

# Lessons — F4 Review e o flow no audit

Operator-ratified 2026-10-02 (AskUserQuestion: Registrar L-F4-1 e L-F4-2).
