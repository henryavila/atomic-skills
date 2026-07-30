# Brainstorm hardening — process package for DESIGN front-half

Enduresce o `atomic-skills:brainstorm` (Stage 2 de `project new plan`): entrevista obrigatória, research repo com digests, `debate --gate` sempre no multi-phase, lints + receipts zero-token, lazy `brainstorm-assets/`. Fonte de verdade: `projects/atomic-skills/brainstorm-hardening/design.md` (critic Approved, user-ratified).

## Principles

- **P1 Process over soft prose** — gate sem script/exit code não é gate.
- **P2 One canonical design surface** — interview content lives in `design.md`; templates are lazy assets only.
- **P3 Debate is actor, never judge** — critic + user decide; anti-theater requires dissent or rejected alternatives.
- **P4 Exempt lanes stay exempt** — ad-hoc / single-task / `adopt` skip DESIGN (R-ORCH-03); enforcers must not false-positive them.
- **P5 No Stage 8 rewrite** — plan review remains `review-plan`; this plan only hardens DESIGN.

## Glossary

| Term | Definition |
|------|------------|
| multi-phase DESIGN | Full brainstorm path used by `project new plan` (not ad-hoc / adopt) |
| design-gates receipt | JSON under `.atomic-skills/status/design-gates/<projectId>-<slug>.json` proving interview+research+debate+critic+user |
| research-digest | `projects/<id>/<slug>/research-digest.md` with ≥3 non-placeholder bullets and ≥1 repo path |
| anti-theater | Gate rule: contrarian + dissent/rejected-alternatives when ≥2 approaches |

## F0 — Skill rewrite and lazy assets

Goal: Multi-phase brainstorm always runs interview then repo research digest then debate --gate then user ratify then write then critic; kill skip ladder; thin skill body plus brainstorm-assets.

### T-001 — Author brainstorm-assets lazy pack

- Files: skills/shared/brainstorm-assets/interview.md, skills/shared/brainstorm-assets/research.md, skills/shared/brainstorm-assets/process-receipt.md
- scopeBoundary: do not rewrite skills/core/brainstorm.md process body in this task; do not touch review-plan or debate gate-mode beyond cross-links
- acceptance: interview.md has HALT questions and proof-of-work ban on bare ok/yes; research.md names research-digest.md path and weak-digest bars; process-receipt.md names interviewAccepted field
- verifier: kind shell command: "test -f skills/shared/brainstorm-assets/interview.md && test -f skills/shared/brainstorm-assets/research.md && test -f skills/shared/brainstorm-assets/process-receipt.md && rg -q 'proof-of-work|Interview|entrevista' skills/shared/brainstorm-assets/interview.md && rg -q 'research-digest' skills/shared/brainstorm-assets/research.md && rg -q 'interviewAccepted' skills/shared/brainstorm-assets/process-receipt.md"

### T-002 — Rewrite brainstorm.md process (always interview + research + debate)

- Files: skills/core/brainstorm.md, docs/skills/brainstorm.md
- scopeBoundary: do not implement find-missing-design-process.js here; do not change Stage 8 review-plan; do not force debate on adopt or ad-hoc
- acceptance: B0 Interview HARD before research/debate; B0b research-digest required; B1 always debate --gate; skip-ladder phrase Run a panel ONLY when is gone; red-flags cover skip-interview and empty digest; docs/skills/brainstorm.md summarizes new flow
- verifier: kind shell command: "rg -q 'Interview|entrevista|B0' skills/core/brainstorm.md && rg -q 'debate --gate|debate.*--gate' skills/core/brainstorm.md && ! rg -q 'Run a panel ONLY when' skills/core/brainstorm.md && rg -q 'research-digest|B0b' skills/core/brainstorm.md && rg -q 'brainstorm-assets' skills/core/brainstorm.md && rg -q 'Interview|debate|lint-design' docs/skills/brainstorm.md"

### T-003 — Point create-plan Stage 2 at new brainstorm contract

- Files: skills/shared/project-assets/project-create-plan.md, tests/project.test.js
- scopeBoundary: do not implement Stage 4 receipt scripts in this task (F2 owns that); only Stage 2 DESIGN wording and tests that pin the contract
- acceptance: Stage 2 no longer says debate only when two viable approaches AND expensive-to-reverse; describes interview plus research plus always debate --gate; tests/project.test.js still assert atomic-skills:brainstorm and lint-design.js and reject superpowers:brainstorm
- verifier: kind shell command: "! rg -q 'only when ≥2 viable approaches AND' skills/shared/project-assets/project-create-plan.md && rg -q 'debate --gate|Interview|interview' skills/shared/project-assets/project-create-plan.md && node --test tests/project.test.js"

```yaml
exit_gate:
  criteria:
    - id: G-F0-1
      description: brainstorm.md has no skip-ladder phrase and always-debate plus interview plus research steps are present; brainstorm-assets dir exists
      status: pending
      verifier:
        kind: shell
        command: "! rg -q 'Run a panel ONLY when' skills/core/brainstorm.md && rg -q 'debate --gate' skills/core/brainstorm.md && test -d skills/shared/brainstorm-assets"
    - id: G-F0-2
      description: project-create-plan Stage 2 text matches always-debate contract; project tests green
      status: pending
      verifier:
        kind: test
        runner: node
        pattern: tests/project.test.js
```

## F1 — Expand lint-design and skill docs contract

Goal: lint-design always requires Context, Non-goals, and Interview sections with real content; tests lock the contract.

### T-004 — Expand lint-design REQUIRED sections

- Files: scripts/lint-design.js, tests/lint-design.test.js
- scopeBoundary: do not add design-gates receipt logic here; do not change lint-source.js SPEC gate
- acceptance: REQUIRED always includes Context Non-goals Interview; Decisions and Chosen approach remain; Blast radius stays migration-only; empty bodies fail; tests cover missing Interview Non-goals Context
- verifier: kind shell command: "node --test tests/lint-design.test.js"

### T-005 — Fixture coverage and docs for new lint sections

- Files: tests/lint-design.test.js, docs/skills/brainstorm.md
- scopeBoundary: do not mass-edit historical projects/*/design.md files
- acceptance: tests mention Interview Non-goals Context; docs/skills/brainstorm.md documents new lint-required sections
- verifier: kind shell command: "rg -q 'Interview|Non-goals|Context' tests/lint-design.test.js && rg -q 'lint-design|Non-goals|Interview' docs/skills/brainstorm.md"

```yaml
exit_gate:
  criteria:
    - id: G-F1-1
      description: lint-design rejects a design missing Interview or Non-goals or Context
      status: pending
      verifier:
        kind: test
        runner: node
        pattern: tests/lint-design.test.js
```

## F2 — Process receipt enforcers and Stage 4 wire

Goal: design-gates receipt plus find-missing-design-process plus find-weak-design; HARD-BLOCK on create-plan Stage 4 and brainstorm B5 handoff; exempt adopt ad-hoc single-task.

### T-006 — design-gates receipt schema and write helpers

- Files: scripts/design-gates.js, skills/shared/brainstorm-assets/process-receipt.md, tests/design-gates.test.js
- scopeBoundary: do not change businessIntent find-weak scripts; do not write plan.md state
- acceptance: helpers create update read .atomic-skills/status/design-gates JSON; schemaVersion 0.1 requires interviewAccepted debateGate researchDigest criticVerdict userApproved status; unit tests cover happy path and missing fields
- verifier: kind shell command: "node --test tests/design-gates.test.js"

### T-007 — find-missing-design-process and find-weak-design detectors

- Files: scripts/find-missing-design-process.js, scripts/find-weak-design.js, tests/find-missing-design-process.test.js, tests/find-weak-design.test.js
- scopeBoundary: do not false-fail adopt/ad-hoc paths; default CLI takes an explicit plan or design path
- acceptance: find-missing exits 1 when receipt missing or status not ready; find-weak fails soft-language non-goals echo short interview and weak research-digest; tests green for both scripts
- verifier: kind shell command: "node --test tests/find-missing-design-process.test.js tests/find-weak-design.test.js"

### T-008 — Wire Stage 4 and brainstorm B5 to detectors

- Files: skills/shared/project-assets/project-create-plan.md, skills/core/brainstorm.md, tests/project.test.js
- scopeBoundary: do not change Stage 8 receipt scripts find-unreviewed-plans or ground-truth
- acceptance: Stage 4 runs lint-design then find-missing-design-process then find-weak-design before decompose; brainstorm B5 refuses handoff unless receipt ready; tests assert new script names in create-plan
- verifier: kind shell command: "rg -q 'find-missing-design-process' skills/shared/project-assets/project-create-plan.md && rg -q 'find-weak-design' skills/shared/project-assets/project-create-plan.md && rg -q 'design-gates|find-missing-design-process' skills/core/brainstorm.md && node --test tests/project.test.js"

```yaml
exit_gate:
  criteria:
    - id: G-F2-1
      description: design-gates and detector unit tests pass
      status: pending
      verifier:
        kind: shell
        command: "node --test tests/design-gates.test.js tests/find-missing-design-process.test.js tests/find-weak-design.test.js"
    - id: G-F2-2
      description: create-plan Stage 4 and brainstorm cite the new detectors
      status: pending
      verifier:
        kind: shell
        command: "rg -q 'find-missing-design-process' skills/shared/project-assets/project-create-plan.md && rg -q 'find-missing-design-process|design-gates' skills/core/brainstorm.md"
```

## F3 — Dogfood, pressure tests, announce

Goal: Prove the hardened path on a dry-run checklist; pressure-test skip escapes; update onboarding brief Stage 2 text.

### T-009 — Pressure-test red-flags for skip-interview and skip-debate

- Files: projects/atomic-skills/brainstorm-hardening/pressure-tests.md
- scopeBoundary: do not re-run full Inc3 suite; additive scenarios only for this plan
- acceptance: file documents at least 3 scenarios skip interview under time pressure skip debate because obvious empty research digest theater; each maps to a Red-Flag or detector fail
- verifier: kind shell command: "test -f projects/atomic-skills/brainstorm-hardening/pressure-tests.md && rg -q 'skip interview|skip debate|empty digest|digest' projects/atomic-skills/brainstorm-hardening/pressure-tests.md"

### T-010 — Dogfood checklist and onboarding note

- Files: docs/design/project-onboarding/html-design-brief.md, projects/atomic-skills/brainstorm-hardening/dogfood-checklist.md
- scopeBoundary: do not rewrite entire onboarding HTML; only the new plan / brainstorm stage description; no Stage 8 wording changes required
- acceptance: dogfood-checklist lists interview research-digest debate critic lint detectors Stage 4; onboarding brief Stage 2 mentions interview and always debate
- verifier: kind shell command: "test -f projects/atomic-skills/brainstorm-hardening/dogfood-checklist.md && rg -q 'entrevista|debate|Interview|always' docs/design/project-onboarding/html-design-brief.md"

```yaml
exit_gate:
  criteria:
    - id: G-F3-1
      description: pressure-tests and dogfood checklist exist and reference the new gates
      status: pending
      verifier:
        kind: shell
        command: "test -f projects/atomic-skills/brainstorm-hardening/dogfood-checklist.md && test -f projects/atomic-skills/brainstorm-hardening/pressure-tests.md"
```
