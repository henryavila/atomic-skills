---
schemaVersion: "0.1"
slug: brainstorm-hardening
title: Brainstorm hardening — process package for DESIGN front-half
version: "1.0"
status: active
started: 2026-07-30T13:42:45.458Z
lastUpdated: 2026-07-30T13:42:45.458Z
branch: plan/brainstorm-hardening
currentPhase: F0
parallelismAllowed: false
principles:
  - id: P1
    title: Process over soft prose
    body: gate sem script/exit code não é gate.
  - id: P2
    title: One canonical design surface
    body: interview content lives in `design.md`; templates are lazy assets only.
  - id: P3
    title: Debate is actor, never judge
    body: critic + user decide; anti-theater requires dissent or rejected
      alternatives.
  - id: P4
    title: Exempt lanes stay exempt
    body: ad-hoc / single-task / `adopt` skip DESIGN (R-ORCH-03); enforcers must not
      false-positive them.
  - id: P5
    title: No Stage 8 rewrite
    body: plan review remains `review-plan`; this plan only hardens DESIGN.
glossary:
  - term: multi-phase DESIGN
    definition: Full brainstorm path used by `project new plan` (not ad-hoc / adopt)
  - term: design-gates receipt
    definition: JSON under
      `.atomic-skills/status/design-gates/<projectId>-<slug>.json` proving
      interview+research+debate+critic+user
  - term: research-digest
    definition: "`projects/<id>/<slug>/research-digest.md` with ≥3 non-placeholder
      bullets and ≥1 repo path"
  - term: anti-theater
    definition: "Gate rule: contrarian + dissent/rejected-alternatives when ≥2 approaches"
phases:
  - id: F0
    slug: brainstorm-hardening-f0-skill-rewrite-and-lazy-assets
    title: Skill rewrite and lazy assets
    summary: Reescreve brainstorm com entrevista, research e debate always + assets lazy
    goal: Multi-phase brainstorm always runs interview then repo research digest
      then debate --gate then user ratify then write then critic; kill skip
      ladder; thin skill body plus brainstorm-assets.
    dependsOn: []
    subPhaseCount: 3
    exitGate:
      summary: 2 criteria to meet
      criteria:
        - id: G-F0-1
          description: brainstorm.md has no skip-ladder phrase and always-debate plus
            interview plus research steps are present; brainstorm-assets dir
            exists
          status: pending
          verifier:
            kind: shell
            command: "! rg -q 'Run a panel ONLY when|skip the panel|skip straight to B2|skip straight to B3' skills/core/brainstorm.md && rg -q 'debate --gate' skills/core/brainstorm.md && rg -q 'Interview|entrevista' skills/core/brainstorm.md && rg -q 'research-digest|B0b' skills/core/brainstorm.md && test -d skills/shared/brainstorm-assets && test -f skills/shared/brainstorm-assets/interview.md"
        - id: G-F0-2
          description: project-create-plan Stage 2 text matches always-debate contract and project tests assert it
          status: pending
          verifier:
            kind: shell
            command: "! rg -q 'only when ≥2 viable approaches AND|Run a panel ONLY when' skills/shared/project-assets/project-create-plan.md && rg -q 'debate --gate|Interview|interview' skills/shared/project-assets/project-create-plan.md && rg -q 'always|Interview|debate --gate|find-missing-design-process|brainstorm' tests/project.test.js && node --test tests/project.test.js"

    status: active
    businessIntent:
      value: "Operador e agente não pulam entrevista/debate: multi-phase brainstorm
        deixa de convergir cedo e materializa design com escopo ratificado"
      workflow: T-001 templates lazy; T-002 brainstorm.md always
        interview+research+debate; T-003 project-create-plan Stage 2 + tests
      rules: Sem always-debate no adopt/ad-hoc; skill thin + assets; não implementar
        detectors F2 nesta fase
      outOfScope: "Fora: expandir lint-design REQUIRED, design-gates JSON,
        find-missing/weak, Stage 8 review-plan, research web, technique BMAD"
      doneWhen: brainstorm sem skip-ladder + debate --gate + brainstorm-assets existe;
        project.test.js e Stage 2 text verdes
  - id: F1
    slug: brainstorm-hardening-f1-expand-lint-design-and-skill-docs-contr
    title: Expand lint-design and skill docs contract
    summary: Expande lint-design para exigir Interview, Context e Non-goals
    goal: lint-design always requires Context, Non-goals, and Interview sections
      with real content; tests lock the contract.
    dependsOn:
      - F0
    subPhaseCount: 0
    exitGate:
      summary: 1 criterion to meet
      criteria:
        - id: G-F1-1
          description: lint-design rejects a design missing Interview or Non-goals or
            Context
          status: pending
          verifier:
            kind: test
            runner: node
            pattern: tests/lint-design.test.js
    status: pending
  - id: F2
    slug: brainstorm-hardening-f2-process-receipt-enforcers-and-stage-4-w
    title: Process receipt enforcers and Stage 4 wire
    summary: Receipt design-gates + detectors find-missing/weak e wire no Stage 4
    goal: design-gates receipt plus find-missing-design-process plus
      find-weak-design; HARD-BLOCK on create-plan Stage 4 and brainstorm B5
      handoff; exempt adopt ad-hoc single-task.
    dependsOn:
      - F1
    subPhaseCount: 0
    exitGate:
      summary: 3 criteria to meet
      criteria:
        - id: G-F2-1
          description: design-gates and detector unit tests pass
          status: pending
          verifier:
            kind: shell
            command: node --test tests/design-gates.test.js tests/find-missing-design-process.test.js tests/find-weak-design.test.js
        - id: G-F2-2
          description: Stage 4 and brainstorm B5 HARD-BLOCK on detectors (names + HARD language + detector tests)
          status: pending
          verifier:
            kind: shell
            command: "rg -q 'find-missing-design-process' skills/shared/project-assets/project-create-plan.md && rg -q 'find-weak-design' skills/shared/project-assets/project-create-plan.md && rg -q 'HARD-BLOCK|HARD_BLOCK|find-missing-design-process' skills/shared/project-assets/project-create-plan.md && rg -q 'design-gates|find-missing-design-process' skills/core/brainstorm.md && node --test tests/design-gates.test.js tests/find-missing-design-process.test.js tests/find-weak-design.test.js"
        - id: G-F2-3
          description: detectors do not false-positive adopt/ad-hoc/single-task exempt lanes (negative tests)
          status: pending
          verifier:
            kind: shell
            command: "rg -q 'adopt|ad-hoc|adhoc|single-task|R-ORCH-03|exempt' tests/find-missing-design-process.test.js && node --test tests/find-missing-design-process.test.js"
    status: pending
  - id: F3
    slug: brainstorm-hardening-f3-dogfood-pressure-tests-announce
    title: Dogfood, pressure tests, announce
    summary: Pressure-tests, dogfood checklist e nota de onboarding
    goal: Prove the hardened path on a dry-run checklist; pressure-test skip
      escapes; update onboarding brief Stage 2 text.
    dependsOn:
      - F2
    subPhaseCount: 0
    exitGate:
      summary: 1 criterion to meet
      criteria:
        - id: G-F3-1
          description: pressure-tests and dogfood checklist exist and reference the new
            gates
          status: pending
          verifier:
            kind: shell
            command: "test -f projects/atomic-skills/brainstorm-hardening/dogfood-checklist.md && test -f projects/atomic-skills/brainstorm-hardening/pressure-tests.md && rg -q 'find-missing-design-process|design-gates|Interview|debate' projects/atomic-skills/brainstorm-hardening/dogfood-checklist.md && rg -q 'skip interview|skip debate|empty digest|digest' projects/atomic-skills/brainstorm-hardening/pressure-tests.md"
    status: pending
references: []
---

# Brainstorm hardening — process package for DESIGN front-half

## 1. Context

Enduresce o `atomic-skills:brainstorm` (Stage 2 de `project new plan`): entrevista obrigatória, research repo com digests, `debate --gate` sempre no multi-phase, lints + receipts zero-token, lazy `brainstorm-assets/`. Fonte de verdade: `projects/atomic-skills/brainstorm-hardening/design.md` (critic Approved, user-ratified).

## 2. Inviolable principles

- **P1 Process over soft prose** — gate sem script/exit code não é gate.
- **P2 One canonical design surface** — interview content lives in `design.md`; templates are lazy assets only.
- **P3 Debate is actor, never judge** — critic + user decide; anti-theater requires dissent or rejected alternatives.
- **P4 Exempt lanes stay exempt** — ad-hoc / single-task / `adopt` skip DESIGN (R-ORCH-03); enforcers must not false-positive them.
- **P5 No Stage 8 rewrite** — plan review remains `review-plan`; this plan only hardens DESIGN.

## 3. Phase tree

_(Canonical list in frontmatter `phases:`. aiDeck renders the tree visually when running.)_

## Self-review against code-quality gates

- **G1 read-before-claim**: N/A for claims about code-to-write — plan describes process changes not yet implemented; design.md cites existing brainstorm skip ladder and lint-design REQUIRED.
- **G2 soft-language**: scanned plan narrative/principles; 0 ban-list hedges in task titles/goals.
- **G6 reference-or-strike**: process claims point at design.md and named scripts to be created; unverified runtime behavior deferred to implementation verifiers.
- **G10 gate-must-be-able-to-fail**: exit gates use shell/test verifiers (rg absence, test files, path existence) — each has a concrete FAIL mode.

## Reviews
- cross-model (codex): needs_changes→applied | provider=codex | provider_version=codex-cli-0.146.0 | major=4 minor=1 | file=.atomic-skills/reviews/2026-07-30-codex-brainstorm-hardening.md @ uncommitted (2026-07-30T13:54:39Z)
- ground-truth: complete | mode=ground-truth | fp=148164380611 | premises=5 | impacts=3 @ uncommitted (2026-07-30T13:54:40Z)
- internal: clean | mode=local | major=0 @ uncommitted (2026-07-30T13:44:22Z)


## Ground-truth review

**Status:** complete
**Scanned:** skills/core/brainstorm.md, skills/shared/project-assets/project-create-plan.md, scripts/lint-design.js, tests/lint-design.test.js, tests/project.test.js, docs/skills/brainstorm.md, docs/design/project-onboarding/html-design-brief.md; plan creates scripts/design-gates.js, find-missing-design-process.js, find-weak-design.js (not existence premises)

### A — Plan premises vs code
| Premise | Result | Evidence |
|---------|--------|----------|
| brainstorm.md exists as DESIGN skill | ok | skills/core/brainstorm.md present |
| lint-design.js REQUIRED is extendable | ok | scripts/lint-design.js + tests/lint-design.test.js present |
| project-create-plan Stage 2 owns DESIGN invoke | ok | skills/shared/project-assets/project-create-plan.md present |
| brainstorm-assets/ does not exist yet | ok | directory absent (to be created in T-001) |
| New detector scripts do not exist yet | ok | not premises — plan outputs |

### B — Code present, plan silent
| Area | Disposition |
|------|-------------|
| Stage 8 review-plan / find-unreviewed-plans | oos — explicit Non-goal |
| find-weak-business-intent pattern | accepted — mirrored by F2 detectors, not rewritten |
| debate gate-mode asset | oos — reused as-is; no contract change in this plan |

**Counts:** premises=5 ok; impacts disposed=3 (oos/accepted)
