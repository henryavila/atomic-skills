---
schemaVersion: "0.1"
slug: skills-restructuring-f4-feature-project-review
title: "Feature: project review"
goal: dar ao project um subcomando de auditoria de plano/iniciativa
  materializados, compondo linters, verify, review-plan e review-code.
status: done
branch: null
started: 2026-06-15T13:37:12.477Z
lastUpdated: 2026-06-16T20:51:13.900Z
nextAction: null
parentPlan: skills-restructuring
phaseId: F4
tasksDone: 3
tasksTotal: 3
gatesMet: 1
gatesTotal: 1
weightDone: 3
weightTotal: 3
exitGates:
  - id: F4-G1
    description: O subcomando existe e a suite de validação passa.
    status: met
    verifier:
      kind: shell
      command: test -f skills/shared/project-assets/project-review.md && grep -q
        'project review' skills/core/project.md && grep -qiE
        'review-plan|review-code|verify'
        skills/shared/project-assets/project-review.md && npm run
        validate-skills
      expectExitCode: 0
    metAt: 2026-06-16T20:51:13.900Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-16T20:08:50.818Z
      passed: true
      exitCode: 0
      outputSummary: "Compound gate exit 0: project-review.md exists, project.md cites
        'project review', project-review.md cites
        review-plan/review-code/verify, and npm run validate-skills → 'All 15
        skills valid'."
    verifierLabel: "shell: test -f skills/shared/project-assets/project-review.md && g…"
    evidenceSummary: passed · 2026-06-16
stack:
  - id: 1
    title: "Feature: project review"
    type: task
    openedAt: 2026-06-15T13:37:12.477Z
tasks:
  - id: T4.1
    title: review-plan resolve slug e active-plan
    status: done
    closedAt: 2026-06-16T19:56:38.254Z
    lastUpdated: 2026-06-16T19:56:38.254Z
    summary: review-plan resolve slug e plano ativo
    description: "Estender o parser de review-plan para resolver um slug ou o plano
      ativo quando o primeiro token não é arquivo legível, reusando a detecção
      do project. Arquivos: skills/core/review-plan.md"
    scopeBoundary:
      - não tocar os HARD-GATEs nem o sub-flow codex; só o contrato de argumento.
    acceptance:
      - o corpo descreve resolução por slug e fallback para active-plan.
    verifier:
      kind: shell
      command: grep -qiE 'slug|active.plan' skills/core/review-plan.md
      expectExitCode: 0
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-16T19:56:38.254Z
      passed: true
      exitCode: 0
      outputSummary: grep -qiE 'slug|active.plan' skills/core/review-plan.md matched
        (quiet, no stdout); exit 0 == expectExitCode 0. Added '### Target
        resolution' subsection to the Argument contract (slug + active-plan
        ladder).
    outputs:
      - kind: file
        path: skills/core/review-plan.md
  - id: T4.2
    title: review-plan auto cross-ref por provenance
    status: done
    closedAt: 2026-06-16T19:58:21.372Z
    lastUpdated: 2026-06-16T19:58:21.372Z
    summary: review-plan auto cross-ref via references/supersedes
    description: "Pré-popular os artefatos de cross-ref a partir de references e
      supersedes do frontmatter do plano, antes do scan de prosa; manter a flag
      manual como override. Arquivos: skills/core/review-plan.md"
    scopeBoundary:
      - não remover o scan de prosa nem a flag manual de cross-ref.
    acceptance:
      - o corpo descreve auto-resolução de cross-ref via references/supersedes.
    verifier:
      kind: shell
      command: grep -qE 'references|supersedes' skills/core/review-plan.md
      expectExitCode: 0
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-16T19:58:21.372Z
      passed: true
      exitCode: 0
      outputSummary: grep -qE 'references|supersedes' skills/core/review-plan.md
        matched at L134/L138; exit 0 == expectExitCode 0. Step 0b step 1 now
        seeds detected_artifacts from frontmatter references[]/supersedes before
        the prose scan (step 2 still scans + appends; --cross-ref flags still
        override).
    outputs:
      - kind: file
        path: skills/core/review-plan.md
  - id: T4.3
    title: Subcomando project review (detail lazy)
    status: done
    closedAt: 2026-06-16T20:00:51.377Z
    lastUpdated: 2026-06-16T20:00:51.377Z
    summary: Subcomando project review compõe linters + verify + reviews
    description: "Criar o subcomando project review que resolve o alvo, roda os
      linters determinísticos mais verify, chama review-plan e opcionalmente
      review-code; adicionar à grammar e ao dispatch table do router. Arquivos:
      skills/core/project.md, skills/shared/project-assets/project-review.md"
    scopeBoundary:
      - não duplicar a lógica de review-plan; o subcomando compõe, não
        reimplementa.
    acceptance:
      - o detail file project-review.md existe
      - a grammar do router cita project review
      - o dispatch table aponta para o detail.
    verifier:
      kind: shell
      command: test -f skills/shared/project-assets/project-review.md && grep -q
        'project review' skills/core/project.md
      expectExitCode: 0
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-16T20:00:51.377Z
      passed: true
      exitCode: 0
      outputSummary: "test -f project-review.md && grep -q 'project review' project.md
        → exit 0. Created project-review.md (composition detail: target
        resolution + linters + verify + review-plan [+ review-code], delegates
        never reimplements); added grammar line + dispatch row to project.md.
        F4-G1 compound verifier (incl. validate-skills, 15 skills valid) also
        exit 0."
    outputs:
      - kind: file
        path: skills/core/project.md
      - kind: file
        path: skills/shared/project-assets/project-review.md
parked: []
emerged: []
summary: Subcomando project review que audita plano/iniciativa materializados.
planTitle: Reestruturação das skills atomic-skills
---


# Narrative / notes

Initiative for phase **F4 — Feature: project review**.

## Decisions

- **Routing → Mode 1 (recorded, not silent).** Codex lane is ON
  (`.atomic-skills/status/routing.json`: `mode2Enabled: true`,
  `codexLane.enabled: true`, `requireDeterministicVerifier: true`). All three
  tasks were nonetheless implemented in **Mode 1 (single-threaded, self)**: the
  acceptance is a prose-quality judgment ("o corpo descreve…" / "compõe, não
  reimplementa") while the verifiers are keyword-presence greps — the grep is a
  presence-floor, not a quality-gate, so the spec does not carry prose-coherence
  across a foreign handoff (F1 not-fully-spec-ready). T4.3 also needs the
  `review-plan` structure in-context to compose without duplicating it.
- **T4.1** — added `### Target resolution` to `review-plan.md`'s Argument
  contract: a 4-rung ladder (readable file → slug → active plan → abort),
  reusing the router's `## Initial detection`; did NOT touch the HARD-GATEs or
  the codex sub-flow (scopeBoundary held).
- **T4.2** — `review-plan.md` Step 0b step 1 now auto-seeds `detected_artifacts`
  from frontmatter `references[]`/`supersedes` BEFORE the prose scan; prose scan
  (step 2) still runs + appends; `--cross-ref`/`--no-cross-ref` still override
  (scopeBoundary held).
- **T4.3** — created `project-review.md` as a **composition** detail (target
  resolution + deterministic linters + `verify` + `review-plan` [+ `review-code`
  under `--with-code`]); it delegates to existing machinery and never
  re-implements `review-plan`'s checklist (scopeBoundary held). Wired router
  grammar line + dispatch row in `project.md`.

## Self-review against code-quality gates (implement)

- **G1 read-before-claim**: applied — each closed task links the source change +
  the verifier run that closed it (T4.1 → review-plan.md `### Target resolution`,
  grep exit 0; T4.2 → Step 0b L134/L138, grep exit 0; T4.3 → project-review.md +
  router edits, `test -f && grep -q` exit 0 and F4-G1 compound exit 0).
- **G2 soft-language**: applied — every closure is `passed: true` GATE-R2
  evidence (`exitCode: 0`), not "should/looks done"; handoff narrative scanned
  for the ban list.
- **G6 reference-or-strike**: applied — handoff literals are verbatim
  paths/commands/exit codes (`npm run validate-skills` → "All 15 skills valid";
  `npm run validate-state` → "All 53 file(s) valid").

## Session handoff

- **Narrative:** Phase **F4 (Feature: project review)** implementation is
  COMPLETE — all 3 tasks (`T4.1`, `T4.2`, `T4.3`) closed through verified PASS,
  `tasksDone: 3/3`, `validate-state` green on all 53 files. The phase exit gate
  **F4-G1 is still `status: pending`** (gates are met only at `phase-done`); its
  verifier was dry-run and passed (compound exit 0). Nothing committed yet —
  `phase-done` is the commit point and is user-opt-in.
- **Decision log:** see `## Decisions` above — Mode-1 routing (recorded, not
  silent, despite Codex lane on); the three scopeBoundaries held; `review` is a
  composition that delegates to `verify`/`review-plan`/`review-code`, never
  re-implements them.
- **Single nextAction:** Run `atomic-skills:project phase-done` for F4 — it runs
  the F4-G1 exit-gate verifier (`test -f skills/shared/project-assets/project-review.md && grep -q 'project review' skills/core/project.md && grep -qiE 'review-plan|review-code|verify' skills/shared/project-assets/project-review.md && npm run validate-skills`, already dry-run exit 0), runs the mandatory `review-code` phase-diff gate, distills lessons, records `reviewGate`, and advances `currentPhase` F4→F5.
- **Verbatim state:**
  - `node scripts/refresh-state.js` → `rollups 1 changed, focus 0 changed, digest → skills-restructuring · F4`
  - `npm run validate-state .atomic-skills/` → `✓ All 53 file(s) valid, 13 plan(s) cross-validated, 1 routing config(s) valid (schemaVersion 0.1/0.2)`
  - F4-G1 compound verifier → `F4-G1 COMPOUND EXIT:0` (incl. `npm run validate-skills` → `✓ All 15 skills valid`)
  - New file: `skills/shared/project-assets/project-review.md`
  - Edited: `skills/core/review-plan.md` (`### Target resolution`; Step 0b step 1 provenance seed), `skills/core/project.md` (grammar line + dispatch row)
- **Uncommitted changes:** (`git status --porcelain` at snapshot)
  ```
   M .atomic-skills/focus.json
   M .atomic-skills/projects/atomic-skills/skills-restructuring/phases/f4-feature-project-review.md
   M skills/core/project.md
   M skills/core/review-plan.md
  ?? skills/shared/project-assets/project-review.md
  ```

## Self-review against code-quality gates (phase-done)

- **G1 read-before-claim**: 3 tasks closed, each linked to source in its `outputs[]`
  + the verifier run that closed it; the 3 review fixes each read the cited
  `file:line` before editing.
- **G2 soft-language**: scanned `nextAction` (now `null`) + task/criterion
  descriptions for the ban list; 0 violations.
- **G6 reference-or-strike**: 1 exit criterion (F4-G1) `met` with `evidence`
  populated (`passed: true`, `exitCode: 0`); 0 deferred.
- **Codex review**: ran `atomic-skills:review-code --mode=local` on
  `d5f8575..9406177` at reviewed HEAD = `ecaae5b`, verdict `needs_changes→all
  fixed` (1 major + 2 minor, all fixed in-phase), file
  `.atomic-skills/reviews/2026-06-16-2016-skills-restructuring-f4.md`. The codex
  `review-due` offer was not taken: `last-review.json` `lastReviewedCommit` is on
  a different branch (`impl/design-brief-source-of-truth`), not meaningful for
  this phase's diff.
- **Review gate (G2)**: recorded on the phase descriptor as `reviewGate: { status:
  passed, at: ecaae5b4abf87aa615c0d23418825cf7fbc9167a, mode: local, reviewFile:
  .atomic-skills/reviews/2026-06-16-2016-skills-restructuring-f4.md }`.
- **Lessons (G1)**: distilled 1 reusable lesson (L-001) into
  `lessons/skills-restructuring-f4-feature-project-review.md`, ratified by the
  user — the composition-skill non-interactive-guard lesson from the major
  finding.

## Links

_(plan doc, external refs)_
