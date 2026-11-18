# Brainstorm hardening — process package for DESIGN front-half

Endurece o `atomic-skills:brainstorm` e a fidelidade de `project new plan`: entrevista, research repo, debate always, lints/receipts, **BI draft-and-ratify**, **router fino + stage-N.md**, **creation-gates.stage monotônico**. Fonte: `projects/atomic-skills/brainstorm-hardening/design.md`.

## Principles

- **P1 Process over soft prose** — gate sem script/exit code não é gate.
- **P2 One canonical design surface** — interview content lives in `design.md`; templates are lazy assets only.
- **P3 Debate is actor, never judge** — critic + user decide; anti-theater requires dissent or rejected alternatives.
- **P4 Exempt lanes stay exempt** — ad-hoc / single-task / `adopt` skip DESIGN (R-ORCH-03); enforcers must not false-positive them.
- **P5 No Stage 8 rewrite** — plan review remains `review-plan`; this plan only hardens DESIGN.
- **P6 Fidelity via stage files + exit codes** — less hot-path text, more assert scripts; more skill prose increases ignore rate.

## Glossary

| Term | Definition |
|------|------------|
| multi-phase DESIGN | Full brainstorm path used by `project new plan` (not ad-hoc / adopt) |
| design-gates receipt | JSON under `.atomic-skills/status/design-gates/<projectId>-<slug>.json` |
| research-digest | `projects/<id>/<slug>/research-digest.md` with enough non-placeholder bullets and at least one repo path |
| anti-theater | Contrarian + dissent or rejected alternatives when two or more approaches |
| draft-and-ratify | Agent drafts businessIntent spine; user approves or edits via AskUserQuestion |
| creation stage | Monotonic `stage` field on creation-gates JSON; advanced only by assert-creation-stage |
| stage file | `skills/shared/project-assets/new-plan/stage-N.md` loaded only for the current stage |

## F0 — Skill rewrite, BI contract, lazy assets

Goal: Multi-phase brainstorm always runs interview then repo research digest then debate --gate then user ratify then write then critic; kill skip ladder; thin brainstorm body plus brainstorm-assets; create-plan Stage 2 matches; businessIntent is draft-and-ratify not blank prompt.

### T-001 — Author brainstorm-assets lazy pack

- Files: skills/shared/brainstorm-assets/interview.md, skills/shared/brainstorm-assets/research.md, skills/shared/brainstorm-assets/process-receipt.md
- scopeBoundary: do not rewrite skills/core/brainstorm.md process body in this task; do not touch review-plan or debate gate-mode beyond cross-links
- acceptance: interview.md has HALT questions and bans bare ok/yes without spine; research.md names research-digest.md and weak-digest bars; process-receipt.md names interviewAccepted and design-gates path
- verifier: kind shell command: "test -f skills/shared/brainstorm-assets/interview.md && test -f skills/shared/brainstorm-assets/research.md && test -f skills/shared/brainstorm-assets/process-receipt.md && rg -q 'proof-of-work|Interview|entrevista' skills/shared/brainstorm-assets/interview.md && rg -q 'research-digest' skills/shared/brainstorm-assets/research.md && rg -q 'interviewAccepted' skills/shared/brainstorm-assets/process-receipt.md"

### T-002 — Rewrite brainstorm.md process (always interview + research + debate)

- Files: skills/core/brainstorm.md, docs/skills/brainstorm.md
- scopeBoundary: do not implement find-missing-design-process.js or assert-creation-stage.js here; do not change Stage 8 review-plan; do not force debate on adopt or ad-hoc
- acceptance: B0 Interview HARD before research/debate; B0b research-digest required; B1 always debate --gate; skip-ladder phrases gone; red-flags cover skip-interview and empty digest; docs/skills/brainstorm.md summarizes new flow; body stays thin and points at brainstorm-assets
- verifier: kind shell command: "rg -q 'Interview|entrevista|B0' skills/core/brainstorm.md && rg -q 'debate --gate|debate.*--gate' skills/core/brainstorm.md && ! rg -q 'Run a panel ONLY when' skills/core/brainstorm.md && rg -q 'research-digest|B0b' skills/core/brainstorm.md && rg -q 'brainstorm-assets' skills/core/brainstorm.md && rg -q 'Interview|debate|lint-design' docs/skills/brainstorm.md"

### T-003 — Stage 2 brainstorm contract + businessIntent draft-and-ratify

- Files: skills/shared/project-assets/project-create-plan.md, tests/project.test.js
- scopeBoundary: do not split create-plan into stage-N files in this task (F2 T-009); do not implement assert-creation-stage.js here
- acceptance: Stage 2 describes interview plus research plus always debate --gate and no old ladder phrase; Stage 6 businessIntent is draft-and-ratify (agent drafts spine, user ratifies via AskUserQuestion); phrase must not pre-fill or user-written blank spine for BI is removed; tests assert brainstorm wiring and draft-and-ratify or businessIntent draft language
- verifier: kind shell command: "! rg -q 'only when ≥2 viable approaches AND' skills/shared/project-assets/project-create-plan.md && ! rg -q 'must not pre-fill the five fields' skills/shared/project-assets/project-create-plan.md && rg -q 'draft-and-ratify|drafts the|Drafted|businessIntent' skills/shared/project-assets/project-create-plan.md && rg -q 'debate --gate|Interview|interview' skills/shared/project-assets/project-create-plan.md && node --test tests/project.test.js"

```yaml
exit_gate:
  criteria:
    - id: G-F0-1
      description: brainstorm.md has no skip-ladder; interview research debate always; brainstorm-assets exist
      status: pending
      verifier:
        kind: shell
        command: "! rg -q 'Run a panel ONLY when|skip the panel|skip straight to B2|skip straight to B3' skills/core/brainstorm.md && rg -q 'debate --gate' skills/core/brainstorm.md && rg -q 'Interview|entrevista' skills/core/brainstorm.md && rg -q 'research-digest|B0b' skills/core/brainstorm.md && test -d skills/shared/brainstorm-assets && test -f skills/shared/brainstorm-assets/interview.md"
    - id: G-F0-2
      description: create-plan Stage 2 always-debate; BI draft-and-ratify; project tests green
      status: pending
      verifier:
        kind: shell
        command: "! rg -q 'only when ≥2 viable approaches AND|must not pre-fill the five fields' skills/shared/project-assets/project-create-plan.md && rg -q 'debate --gate|Interview|interview' skills/shared/project-assets/project-create-plan.md && rg -q 'draft-and-ratify|Drafted|drafts the' skills/shared/project-assets/project-create-plan.md && node --test tests/project.test.js"
```

## F1 — Expand lint-design and skill docs contract

Goal: lint-design always requires Context, Non-goals, and Interview sections with real content; tests lock the contract.

### T-004 — Expand lint-design REQUIRED sections

- Files: scripts/lint-design.js, tests/lint-design.test.js
- scopeBoundary: do not add design-gates or creation-stage logic here; do not change lint-source.js SPEC gate
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

## F2 — Receipts, stage assert, create-plan split, Stage 4 wire

Goal: design-gates + find-missing/weak-design + assert-creation-stage monotonic; split create-plan into thin router plus new-plan/stage-N.md; HARD-BLOCK Stage 4 and brainstorm B5; exempt adopt ad-hoc single-task.

### T-006 — design-gates and creation-gates helpers

- Files: scripts/design-gates.js, scripts/creation-gates.js, skills/shared/brainstorm-assets/process-receipt.md, tests/design-gates.test.js, tests/creation-gates.test.js
- scopeBoundary: do not change find-weak-business-intent rules; do not write plan.md product state beyond helpers under status/
- acceptance: design-gates create/update/read with schemaVersion 0.1 fields interviewAccepted debateGate researchDigest criticVerdict userApproved status; creation-gates supports monotonic stage field and ordered stages list; unit tests cover happy path missing fields and illegal stage skip
- verifier: kind shell command: "node --test tests/design-gates.test.js tests/creation-gates.test.js"

### T-007 — Detectors find-missing-design-process find-weak-design assert-creation-stage

- Files: scripts/find-missing-design-process.js, scripts/find-weak-design.js, scripts/assert-creation-stage.js, tests/find-missing-design-process.test.js, tests/find-weak-design.test.js, tests/assert-creation-stage.test.js
- scopeBoundary: do not false-fail adopt/ad-hoc paths; CLI takes explicit plan design or creation-gate path
- acceptance: find-missing exits 1 when design process receipt missing or not ready; find-weak fails soft-language non-goals echo short interview weak digest; assert-creation-stage exits 1 on skip or declare ready early; negative tests for exempt lanes; all three test files green
- verifier: kind shell command: "node --test tests/find-missing-design-process.test.js tests/find-weak-design.test.js tests/assert-creation-stage.test.js"

### T-008 — Wire Stage 4 and brainstorm B5 to detectors

- Files: skills/shared/project-assets/project-create-plan.md, skills/core/brainstorm.md, tests/project.test.js
- scopeBoundary: do not change Stage 8 receipt scripts; stage-N split may still be incomplete until T-009 but detector names must appear in the create-plan surface the router keeps
- acceptance: Stage 4 runs lint-design then find-missing-design-process then find-weak-design before decompose; brainstorm B5 refuses handoff unless design-gates ready; HARD-BLOCK language present; tests assert script names
- verifier: kind shell command: "rg -q 'find-missing-design-process' skills/shared/project-assets/project-create-plan.md && rg -q 'find-weak-design' skills/shared/project-assets/project-create-plan.md && rg -q 'HARD-BLOCK|find-missing-design-process' skills/shared/project-assets/project-create-plan.md && rg -q 'design-gates|find-missing-design-process' skills/core/brainstorm.md && node --test tests/project.test.js"

### T-009 — Split create-plan into thin router plus stage-N.md and assert stage advance

- Files: skills/shared/project-assets/project-create-plan.md, skills/shared/project-assets/new-plan/stage-1.md, skills/shared/project-assets/new-plan/stage-2.md, skills/shared/project-assets/new-plan/stage-3.md, skills/shared/project-assets/new-plan/stage-4.md, skills/shared/project-assets/new-plan/stage-5.md, skills/shared/project-assets/new-plan/stage-6.md, skills/shared/project-assets/new-plan/stage-7.md, skills/shared/project-assets/new-plan/stage-8.md, skills/shared/project-assets/new-plan/stage-9.md, tests/project.test.js, tests/assert-creation-stage.test.js
- scopeBoundary: do not rewrite Stage 8 review-plan skill body; keep adopt path either as stage file or thin pointer without expanding adopt into novel behavior; do not add walls of Red Flags
- acceptance: project-create-plan.md is a thin router that tells agent to read only new-plan/stage-N.md for current creation stage; each stage-1 through stage-9 file exists with a Contract section; stage-6 states BI draft-and-ratify; router or stage-6/9 invokes assert-creation-stage; create-plan file line count is materially smaller than pre-split monólito or router explicitly defers body to stage files; tests pin router loads stage path and assert-creation-stage name
- verifier: kind shell command: "test -f skills/shared/project-assets/new-plan/stage-1.md && test -f skills/shared/project-assets/new-plan/stage-6.md && test -f skills/shared/project-assets/new-plan/stage-9.md && rg -q 'stage-6|new-plan/stage' skills/shared/project-assets/project-create-plan.md && rg -q 'draft-and-ratify|Drafted|drafts the' skills/shared/project-assets/new-plan/stage-6.md && rg -q 'assert-creation-stage' skills/shared/project-assets/project-create-plan.md skills/shared/project-assets/new-plan/stage-6.md skills/shared/project-assets/new-plan/stage-9.md && node --test tests/project.test.js tests/assert-creation-stage.test.js"

```yaml
exit_gate:
  criteria:
    - id: G-F2-1
      description: design-gates creation-gates detector and assert-creation-stage unit tests pass
      status: pending
      verifier:
        kind: shell
        command: "node --test tests/design-gates.test.js tests/creation-gates.test.js tests/find-missing-design-process.test.js tests/find-weak-design.test.js tests/assert-creation-stage.test.js"
    - id: G-F2-2
      description: Stage 4 and brainstorm HARD-BLOCK detectors; stage router and stage-6 exist
      status: pending
      verifier:
        kind: shell
        command: "rg -q 'find-missing-design-process' skills/shared/project-assets/project-create-plan.md && rg -q 'find-weak-design' skills/shared/project-assets/project-create-plan.md && test -f skills/shared/project-assets/new-plan/stage-6.md && rg -q 'assert-creation-stage' skills/shared/project-assets/project-create-plan.md skills/shared/project-assets/new-plan/stage-6.md && node --test tests/design-gates.test.js tests/find-missing-design-process.test.js tests/find-weak-design.test.js tests/assert-creation-stage.test.js"
    - id: G-F2-3
      description: detectors do not false-positive adopt/ad-hoc/single-task exempt lanes
      status: pending
      verifier:
        kind: shell
        command: "rg -q 'adopt|ad-hoc|adhoc|single-task|R-ORCH-03|exempt' tests/find-missing-design-process.test.js && node --test tests/find-missing-design-process.test.js"
```

## F3 — Dogfood, pressure tests, announce

Goal: Pressure-test skip escapes and more-text-worse; dogfood checklist includes stage router and draft-and-ratify; onboarding Stage 2 text updated.

### T-010 — Pressure-test red-flags for skip paths and fidelity escapes

- Files: projects/atomic-skills/brainstorm-hardening/pressure-tests.md
- scopeBoundary: do not re-run full Inc3 suite; additive scenarios only for this plan
- acceptance: documents at least 5 scenarios including skip interview under time pressure, skip debate because obvious, empty research digest theater, skip creation stage without assert, more text in monólito increases ignore; each maps to a Red-Flag or detector or assert-creation-stage fail
- verifier: kind shell command: "test -f projects/atomic-skills/brainstorm-hardening/pressure-tests.md && rg -q 'skip interview|skip debate|empty digest|assert-creation-stage|monolito|ignore' projects/atomic-skills/brainstorm-hardening/pressure-tests.md"

### T-011 — Dogfood checklist and onboarding note

- Files: docs/design/project-onboarding/html-design-brief.md, projects/atomic-skills/brainstorm-hardening/dogfood-checklist.md
- scopeBoundary: do not rewrite entire onboarding HTML; only new plan / brainstorm stage description; no Stage 8 behavior changes
- acceptance: dogfood-checklist lists interview research-digest debate critic lint design-gates assert-creation-stage stage-N router draft-and-ratify Stage 4; onboarding brief mentions interview always debate and thin stage process
- verifier: kind shell command: "test -f projects/atomic-skills/brainstorm-hardening/dogfood-checklist.md && rg -q 'assert-creation-stage|draft-and-ratify|stage-' projects/atomic-skills/brainstorm-hardening/dogfood-checklist.md && rg -q 'entrevista|debate|Interview|always|estágio|stage' docs/design/project-onboarding/html-design-brief.md"

```yaml
exit_gate:
  criteria:
    - id: G-F3-1
      description: pressure-tests and dogfood checklist exist and reference new gates including assert-creation-stage
      status: pending
      verifier:
        kind: shell
        command: "test -f projects/atomic-skills/brainstorm-hardening/dogfood-checklist.md && test -f projects/atomic-skills/brainstorm-hardening/pressure-tests.md && rg -q 'find-missing-design-process|design-gates|assert-creation-stage|Interview|debate' projects/atomic-skills/brainstorm-hardening/dogfood-checklist.md && rg -q 'skip interview|skip debate|assert-creation-stage|digest' projects/atomic-skills/brainstorm-hardening/pressure-tests.md"
```
