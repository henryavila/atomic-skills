---
schemaVersion: "0.1"
slug: automate-writer-runtime
title: Automate writer runtime (1 + A + B)
version: "1.0"
status: archived
started: 2026-07-29T15:42:49.201Z
lastUpdated: 2026-07-29T17:04:08.270Z
branch: plan/automate-writer-runtime
currentPhase: null
parallelismAllowed: false
principles:
  - id: P1
    title: Host-thin close path
    body: Under automate, product source reaches the plan branch only via writer
      branch merge; host never closes tasks on its own product commits.
  - id: P2
    title: Runner is the writer channel
    body: Work-order, lease, sealed brief, claim validate are owned by a package
      CLI; skill prose points at that CLI, not a second invented protocol.
  - id: P3
    title: Soft recipe, hard fence
    body: Spawn remains host-invoked; refuse of illegal done is machine-checked.
  - id: P4
    title: No Layer 4 in this plan
    body: No daemon spawn adapter; no multi-host supervisor.
  - id: P5
    title: Compose, do not fork
    body: Extend lease, claim-report, assert-automate-gate, maestro cursor; no
      parallel gate system.
  - id: P6
    title: No second top-level skill
    body: Extend implement + shared assets only.
glossary:
  - term: sealed brief
    definition: Self-contained phase-writer prompt written by the runner (work-order
      + code-only fence); no host chat history.
  - term: plan-tree product fence
    definition: Assert/done gate that rejects product path changes on plan branch
      not explained by claim SHAs.
  - term: host-local runner
    definition: Per-host CLI (Layer 3) for prepare/validate of one phase writer cycle.
  - term: product path
    definition: Path classified as product/source for fence purposes (not
      `.atomic-skills/` durable state).
phases:
  - id: F0
    slug: automate-writer-runtime-f0-skill-recipe-and-honesty-1
    title: Skill recipe and honesty (#1)
    goal: Make Grok (and portable) phase-writer spawn instructions explicit;
      document guarantee limits honestly.
    dependsOn: []
    subPhaseCount: 2
    exitGate:
      summary: 1 criterion to meet
      criteria:
        - id: G-F0-1
          description: Skill and docs name the Grok portable writer spawn path and honesty
            limits.
          status: met
          verifier:
            kind: shell
            command: node -e "const fs=require('fs'); const
              p=['skills/core/implement.md','skills/shared/implement-automate-maestro.md','docs/kb/automate-orchestrator-realism.md'];
              for (const f of p){ if(!fs.existsSync(f)) process.exit(1);}
              console.log('ok')"
            expectExitCode: 0
          metAt: 2026-07-29T16:26:58.973Z
          evidence:
            verifierKind: shell
            verifiedAt: 2026-07-29T16:26:58.973Z
            passed: true
            exitCode: 0
            verifiedCommit: 06d0918db4c118155e3a2fe7c7e49a69d35f9ac7
    status: done
    businessIntent:
      value: Operators running implement under automate get an explicit Grok/portable
        phase-writer spawn recipe and honest docs so the host does not treat
        explore-only or single-threaded coding as permission to edit product
        source.
      workflow: Edit implement.md, implement-automate-maestro.md,
        implement-phase-writer.md, implement-antipatterns.md, and
        automate-orchestrator-realism.md; verify with shell greps for
        general-purpose spawn and Layer 3 honesty.
      rules: No runner CLI or fence code in F0. No Layer 4 claims. Keep tool-name
        abstraction and ide conditionals. Do not enable concurrent phase
        writers.
      outOfScope: Layer 3 automate-phase-run CLI, product-source fence helpers, Mode 2
        Codex lane, Layer 4 daemon.
      doneWhen: Grok/portable phase-writer spawn recipe is greppable and
        realism/antipatterns state that prose alone does not force spawn while
        runner+fence are the hard close path.
    summary: Receita de spawn Grok/portátil e honestidade Layer 3 (sem runtime ainda).
  - id: F1
    slug: automate-writer-runtime-f1-layer-3-host-local-runner-a
    title: Layer 3 host-local runner (A)
    goal: Package CLI prepares one phase writer cycle and validates claims without
      hosting a daemon.
    dependsOn:
      - F0
    subPhaseCount: 3
    exitGate:
      summary: 1 criterion to meet
      criteria:
        - id: G-F1-1
          description: Runner prepare validate covered by unit tests and skill wiring.
          status: met
          verifier:
            kind: shell
            command: node --test tests/automate-work-order.test.js
              tests/automate-sealed-brief.test.js
              tests/automate-phase-run.test.js
            expectExitCode: 0
          metAt: 2026-07-29T16:26:58.973Z
          evidence:
            verifierKind: shell
            verifiedAt: 2026-07-29T16:26:58.973Z
            passed: true
            exitCode: 0
            verifiedCommit: 06d0918db4c118155e3a2fe7c7e49a69d35f9ac7
    status: done
    summary: CLI host-local prepare/validate + builders de work-order e brief selado.
    businessIntent:
      value: Operators get a host-local CLI that prepares work-order, lease, sealed
        brief and validates claim reports so pure-maestro does not invent the
        writer channel ad hoc.
      workflow: Implement pure builders + scripts/automate-phase-run.js
        prepare/validate with unit tests; wire Step C skill prose to the runner;
        update realism Layer 3.
      rules: No spawn from Node. No done/phase-done from runner. Sibling worktree
        never nested under plan worktree. Never commit lease secrets. Compose
        writer-lease and claim-report.
      outOfScope: Product-source fence (F2). Layer 4 daemon. Concurrent phase writers.
        Mode 2 Codex.
      doneWhen: node --test for work-order, sealed-brief, phase-run pass and maestro
        asset greps automate-phase-run.
  - id: F2
    slug: automate-writer-runtime-f2-plan-tree-product-source-fence-b
    title: Plan-tree product-source fence (B)
    goal: Under durable automate, block orchestrator done when plan-branch product
      paths changed outside claim-backed SHAs.
    dependsOn:
      - F1
    subPhaseCount: 3
    exitGate:
      summary: 1 criterion to meet
      criteria:
        - id: G-F2-1
          description: Fence unit tests and assert done integration pass.
          status: met
          verifier:
            kind: shell
            command: node --test tests/automate-product-fence.test.js
              tests/assert-automate-gate.test.js
            expectExitCode: 0
          metAt: 2026-07-29T16:26:58.973Z
          evidence:
            verifierKind: shell
            verifiedAt: 2026-07-29T16:26:58.973Z
            passed: true
            exitCode: 0
            verifiedCommit: 06d0918db4c118155e3a2fe7c7e49a69d35f9ac7
    status: done
    summary: Cerca de product-source no plan tree no assert done sob automate.
    businessIntent:
      value: Under durable automate, orchestrator done fails closed when plan-branch
        product paths changed outside claim-backed coverage.
      workflow: Implement pure fence predicate, wire into canDoneFromAutomateClaims
        and assert-automate-gate --gate done, document Step E and antipatterns.
      rules: Pure predicate injects path lists (no git inside pure module). No chat
        waiver. Preserve lastAssert. State paths under .atomic-skills do not
        trip fence.
      outOfScope: Layer 4. Claim lease-secret signing. Changing phase-done
        evaluationGate beyond done path.
      doneWhen: Fence unit tests and assert done integration tests pass; maestro
        mentions fence.
  - id: F3
    slug: automate-writer-runtime-f3-integration-surface-and-dogfood-chec
    title: Integration surface and dogfood checklist
    goal: Full suite green; install path; operator dogfood checklist for 1+A+B
      without claiming Layer 4.
    dependsOn:
      - F2
    subPhaseCount: 2
    exitGate:
      summary: 1 criterion to meet
      criteria:
        - id: G-F3-1
          description: Full npm test green and dogfood checklist published.
          status: met
          verifier:
            kind: shell
            command: npm test && test -f docs/kb/automate-writer-runtime-dogfood.md
            expectExitCode: 0
          metAt: 2026-07-29T16:26:58.973Z
          evidence:
            verifierKind: shell
            verifiedAt: 2026-07-29T16:26:58.973Z
            passed: true
            exitCode: 0
            verifiedCommit: 06d0918db4c118155e3a2fe7c7e49a69d35f9ac7
    status: done
    summary: Suite verde, superfície de pacote e checklist de dogfood 1+A+B.
    businessIntent:
      value: Full suite stays green and operators have a dogfood checklist for
        prepare→spawn→validate→merge→assert done without claiming Layer 4.
      workflow: Run full npm test, fix regressions, write dogfood checklist + memory
        reference, link from realism.
      rules: Do not bump major version. Do not claim dogfood already passed. Do not
        document Layer 4 as done.
      outOfScope: New features beyond 1+A+B. Installer rewrite.
      doneWhen: npm test exits 0 and docs/kb/automate-writer-runtime-dogfood.md exists.
references: []
---

# Automate writer runtime (1 + A + B)

## 1. Context

Close the gap where `implement --mode=automate` documents pure-maestro but the host codes product source itself. Ship skill spawn recipe (#1), Layer 3 host-local runner (A), and plan-tree product-source fence (B).

## 2. Inviolable principles

- **P1 Host-thin close path** — Under automate, product source reaches the plan branch only via writer branch merge; host never closes tasks on its own product commits.
- **P2 Runner is the writer channel** — Work-order, lease, sealed brief, claim validate are owned by a package CLI; skill prose points at that CLI, not a second invented protocol.
- **P3 Soft recipe, hard fence** — Spawn remains host-invoked; refuse of illegal done is machine-checked.
- **P4 No Layer 4 in this plan** — No daemon spawn adapter; no multi-host supervisor.
- **P5 Compose, do not fork** — Extend lease, claim-report, assert-automate-gate, maestro cursor; no parallel gate system.
- **P6 No second top-level skill** — Extend implement + shared assets only.

## 3. Phase tree

_(Canonical list in frontmatter `phases:`. aiDeck renders the tree visually when running.)_


## Reviews

- internal: 2026-07-29T15:45:00Z | mode=internal | plan creation self-pass after SPEC lint + critic Approved design | major+ = 0
- ground-truth: complete-empty-repo | mode=ground-truth | fp=e37e0500b5a0 | at=2026-07-29T15:50:00Z | A=0 B=0


## Ground-truth review

Status: complete-empty-repo

Scanned: repo product modules for automate (assert-automate-gate, writer-lease, claim-report, maestro-cursor, implement assets). This plan introduces new modules not yet present.

### A — Plan phantoms (plan says, code missing)

- none at bootstrap — planned outputs (scripts/automate-phase-run.js, src/automate-product-fence.js, etc.) are future deliverables of F1–F2 tasks, not pre-existing claims of current code. verified_by: phases F1–F2 task outputs.

### B — Silent code (code present, plan silent)

- none — existing automate helpers are explicitly composed (design Decision 4 / P5); plan does not claim a second gate system. verified_by: design.md Decision 4; docs/kb/automate-orchestrator-realism.md Layers 1–2.5.

Counts: A=0 phantoms actionable at bootstrap; B=0 silent systems.

## Self-review against code-quality gates

- **G1 read-before-claim**: design cites realism.md and implement Grok block; no false claim that Layer 4 exists.
- **G2 soft-language**: decisions use fail-closed language; guarantee limits explicit.
- **G6 reference-or-strike**: fence algorithm and cursor ownership sections added from critic nits.
- **G10 gate-must-be-able-to-fail**: exit gates use shell commands that fail if files/tests missing.

## Finalize / archive

- **PR:** https://github.com/henryavila/atomic-skills/pull/39 (`plan/automate-writer-runtime` → `develop`)
- **Published:** 2026-07-29T17:04:08.270Z
- **Review:** local review-code (3 criticals fixed); Codex external deferred after tree mutation
- **Archived:** operator request after finalize (2026-07-29T17:04:08.270Z)
- **Caveats:** product fence path-set only (not process identity); run assert `--base-ref` in plan worktree
