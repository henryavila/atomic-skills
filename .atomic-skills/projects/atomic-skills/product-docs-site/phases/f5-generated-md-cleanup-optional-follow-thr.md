---
schemaVersion: "0.1"
slug: product-docs-site-f5-generated-md-cleanup-optional-follow-thr
title: Generated MD cleanup (optional follow-through)
goal: Decide and execute the fate of generated docs/skills/*.md now that the
  site is the human reference.
status: done
branch: plan/product-docs-site
started: 2026-07-17T16:23:40.000Z
lastUpdated: 2026-07-17T16:27:23.205Z
nextAction: null
parentPlan: product-docs-site
phaseId: F5
businessIntent:
  value: Keep a deliberate dual-view — site as canonical human product surface,
    generated docs/skills/*.md as secondary offline/agent/GitHub MD refs.
  workflow: Document dual-view in README (or docs note); keep generate-skill-docs
    in the default check-docs pipeline; do not delete skill bodies or
    engineering archive MD.
  rules: Do not delete docs/kb, docs/design, or skills/ bodies. Site remains
    product SSOT for humans; MD refs must stay drift-checked via check-docs.
  outOfScope: Removing generate-skill-docs; rewriting docs/kb or design archives;
    package version bump.
  doneWhen: dual-view reason is documented; generate-skill-docs still in
    check-docs; npm run check-docs exits 0.
tasksDone: 1
tasksTotal: 1
gatesMet: 1
gatesTotal: 1
exitGates:
  - id: F5-G1
    description: check-docs reflects the post-site decision on docs/skills generation.
    verifier:
      kind: shell
      command: npm run check-docs
      expectExitCode: 0
    status: met
    metAt: 2026-07-17T16:27:23.205Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-17T16:27:23.205Z
      verifiedCommit: b6f901a9cc90d364439e4562df80e97167a69823
      passed: true
      exitCode: 0
      outputSummary: F5-G1
stack:
  - id: 1
    title: Generated MD cleanup (optional follow-through)
    type: task
    openedAt: 2026-07-17T16:23:40.000Z
tasks:
  - id: T-014
    title: Retire or keep docs/skills with explicit decision
    scopeBoundary:
      - Do not delete docs/kb or docs/design. Do not delete skill bodies under
        skills/.
    acceptance:
      - it - Either generate-skill-docs remains in check-docs with a documented
        dual-view reason, or it is removed from the default docs pipeline and
        README no longer links to docs/skills for product reference.; it npm run
        check-docs exits 0 after the decision is implemented.
    verifier:
      kind: shell
      command: npm run check-docs
      expectExitCode: 0
    outputs:
      - kind: file
        path: docs/skills/
      - kind: file
        path: scripts/generate-skill-docs.js
      - kind: file
        path: package.json
      - kind: file
        path: README.md
    summary: Manter ou remover generate-skill-docs do pipeline padrão.
    weight: 2
    status: done
    lastUpdated: 2026-07-17T16:27:23.205Z
    closedAt: 2026-07-17T16:27:23.205Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-17T16:27:23.205Z
      verifiedCommit: b6f901a9cc90d364439e4562df80e97167a69823
      passed: true
      exitCode: 0
      outputSummary: T-014
parked: []
emerged: []
summary: Dual-view decision for generated docs/skills after product site cutover.
closedAt: 2026-07-17T16:27:23.205Z
reviewGate:
  at: b6f901a9cc90d364439e4562df80e97167a69823
  mode: codex
  provider: gpt-5.5
  verdict: covered_in_f4_f5_review
  counts:
    blocker: 0
    critical: 0
    major: 0
    minor: 0
    nit: 0
  reviewFile: .atomic-skills/reviews/product-docs-site-f4-f5-codex-pass1.md
---

# F5 generated MD cleanup
