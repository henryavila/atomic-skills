---
schemaVersion: "0.1"
slug: refactor-doc-architect
title: Refactor doc-architect into an atomic-skill
version: "1.0"
status: paused
started: 2026-05-31T20:37:21.595Z
lastUpdated: 2026-06-02T12:33:02Z
branch: main
currentPhase: F0
parallelismAllowed: false
principles:
  - id: P1
    title: Adopt, do not rebuild
    body: "the artifact is markdown, the same genre as atomic-skills, so a refactor
      is a transform rather than a re-derivation; rebuilding fresh re-invents
      ~4,346 lines of proven pipeline at regression risk. `verified_by: source
      tree is .md only — find <source> -name '.php' → 0 results`."
  - id: P2
    title: Preserve the proven IP
    body: keep the `steps/` pipeline and the 5-dimension review (07a-e) prose
      intact; that rigor is why the pipeline doc beat ad-hoc generation. Touch
      prompt prose minimally.
  - id: P3
    title: Laravel stays first-class
    body: "ship exactly one Laravel/Nova extraction adapter; name the seam so a
      second stack is an additive file, but do not build a second adapter
      speculatively (premature generalization). The user's real fleet is
      Laravel/Nova. `verified_by: ../arch is a Laravel/Nova app — app/, routes/,
      nova/, database/migrations present`."
  - id: P4
    title: Trust through provenance
    body: "every load-bearing claim in a generated doc carries a `file:line`
      citation, verified in a pass separate from generation. This is the one
      guardrail the source pipeline lacks; the findings schema carries
      `source:{file,line}` but generated doc claims do not. `verified_by:
      references/findings-schema.md has source.file/source.line; step extraction
      files emit prose without per-claim citation`."
  - id: P5
    title: House standard wins on shape
    body: reconcile doc-architect's `documentation-standard-template.md` into the
      target repo's own documentation standard; map fields and flag gaps rather
      than replacing wholesale, so extraction depth is preserved.
glossary:
  - term: doc-architect
    definition: "The BMAD source skill being refactored: discovery → deep-read →
      extract dimensions → 5-D review → report, emitting 6 Diataxis-typed files
      per module."
  - term: adapter seam
    definition: The boundary isolating stack-specific extraction
      (`references/extraction-` → `references/adapters/laravel.md`) from the
      framework-agnostic pipeline.
  - term: 5-D review
    definition: "The five independent review steps 07a-e: accuracy, permissions,
      type-purity, completeness, quality."
  - term: Diataxis
    definition: Documentation taxonomy (Tutorial / How-to / Reference / Explanation)
      the pipeline enforces and reviews for type purity.
  - term: bake-off
    definition: The head-to-head where the pipeline doc beat an ad-hoc agent doc on
      a real `../arch` module; reused as the F5 regression gate.
phases:
  - id: F0
    slug: refactor-doc-architect-f0-confirm-conventions-and-decisions
    title: Confirm conventions and decisions
    goal: Lock the target skill layout against an existing atomic-skill and resolve
      the four open decisions before any file is moved.
    dependsOn: []
    subPhaseCount: 3
    exitGate:
      summary: 1 criterion to meet
      criteria:
        - id: G-1
          description: an existing skill's layout is documented as the template to follow;
            D1-D3 each have a recorded answer; and D4 has produced a concrete
            criteria-based F5 acceptance rubric with an archived baseline
            (original ad-hoc doc + pipeline doc + module SHA) and explicit
            pass/fail thresholds.
          status: pending
          verifier:
            kind: manual
            description: Verify exit-gate prose with the user during phase-done.
    status: paused
    summary: Trava o layout-alvo da skill contra um atomic-skill existente e resolve
      as 4 decisões abertas antes de mover arquivos.
  - id: F1
    slug: refactor-doc-architect-f1-mechanical-move-and-tool-abstraction
    title: Mechanical move and tool abstraction
    goal: Copy the proven pipeline into the new skill location and convert it to
      atomic-skills conventions, changing structure and tool references only —
      not prompt substance.
    dependsOn:
      - F0
    subPhaseCount: 4
    exitGate:
      summary: 1 criterion to meet
      criteria:
        - id: G-1
          description: the skill loads under atomic-skills conventions with zero remaining
            hardcoded tool literals and no dangling BMAD frontmatter.
          status: pending
          verifier:
            kind: manual
            description: Verify exit-gate prose with the user during phase-done.
    status: pending
    summary: Move o pipeline provado pro novo local + converte às convenções
      atomic-skills (estrutura/ferramentas, não a lógica).
  - id: F2
    slug: refactor-doc-architect-f2-drop-and-replace-bmad-coupling
    title: Drop and replace BMAD coupling
    goal: Remove BMAD-specific scaffolding and re-point config, memory, and output
      paths to atomic-skills / target-repo conventions.
    dependsOn:
      - F1
    subPhaseCount: 4
    exitGate:
      summary: 1 criterion to meet
      criteria:
        - id: G-1
          description: no path or variable in the skill references `_bmad`,
            `_bmad-output`, or a BMAD manifest.
          status: pending
          verifier:
            kind: manual
            description: Verify exit-gate prose with the user during phase-done.
    status: pending
    summary: Remove o acoplamento BMAD e re-aponta config/memória/saída pras
      convenções atomic-skills / target-repo.
  - id: F3
    slug: refactor-doc-architect-f3-carve-laravel-into-a-first-class-adap
    title: Carve Laravel into a first-class adapter
    goal: Isolate the stack-specific extraction knowledge behind one Laravel adapter
      while keeping its depth intact. This is the genuine engineering of the
      refactor, because coupling is both delegated and inlined.
    dependsOn:
      - F2
    subPhaseCount: 3
    exitGate:
      summary: 1 criterion to meet
      criteria:
        - id: G-1
          description: the framework-agnostic `steps/` carry no inlined Laravel symbols,
            and all stack specifics live in `references/adapters/laravel.md`
            with its depth preserved.
          status: pending
          verifier:
            kind: manual
            description: Verify exit-gate prose with the user during phase-done.
    status: pending
    summary: Isola o conhecimento de extração Laravel atrás de um adapter de
      primeira classe, mantendo a profundidade.
  - id: F4
    slug: refactor-doc-architect-f4-add-claim-level-citations
    title: Add claim-level citations
    goal: Close the one trust guardrail the source pipeline lacks — per-claim
      provenance captured at generation and confirmed at review.
    dependsOn:
      - F3
    subPhaseCount: 2
    exitGate:
      summary: 1 criterion to meet
      criteria:
        - id: G-1
          description: a generated module doc carries a `file:line` citation on every
            load-bearing claim, and the verification pass fails when a citation
            does not resolve.
          status: pending
          verifier:
            kind: manual
            description: Verify exit-gate prose with the user during phase-done.
    status: pending
    summary: "Citações por claim: proveniência capturada na geração e confirmada no
      review — o guardrail de confiança que faltava."
  - id: F5
    slug: refactor-doc-architect-f5-regression-gate-and-acceptance
    title: Regression gate and acceptance
    goal: Prove the refactored skill still beats ad-hoc generation and emits a
      conformant, verifiable doc set.
    dependsOn:
      - F4
    subPhaseCount: 2
    exitGate:
      summary: 1 criterion to meet
      criteria:
        - id: G-1
          description: the regression run passes the concrete criteria-based rubric
            produced in F0/D4 (with its archived baseline), and the verification
            checklist reports zero unresolved cross-step references or uncited
            claims.
          status: pending
          verifier:
            kind: manual
            description: Verify exit-gate prose with the user during phase-done.
    status: pending
    summary: "Gate de regressão + aceitação: prova que a skill refatorada supera a
      geração ad-hoc e emite docs conformes/verificáveis."
references: []
planTitle: Refactor doc-architect into an atomic-skill
---

# Refactor doc-architect into an atomic-skill

## 1. Context

Outcome of `atomic-skills:debate` (2026-05-29): adopt BMAD's `doc-architect` into atomic-skills
**via refactor**, not via port and not via rebuild-from-scratch. The decision reverses the prior
"NOT for porting" conclusion recorded in memory `bmad-doc-architect-concepts`, whose premise was
factually wrong. The artifact is a prompt/workflow skill of ~35 markdown files / ~4,346 lines with
zero PHP — the same genre as atomic-skills — already structured along clean extractor / contract /
renderer seams. `verified_by: find <source> -name '*.md' | wc -l → 35; wc -l total → 4346; grep PHP → 0`.
Source: `/Volumes/External/code/bmad-dev-productivity/bmad-doc-architect/workflows/bmad-doc-architect/`.
The proven value is the multi-step methodology: in a real Laravel app (`../arch`) the pipeline-generated
module doc beat an ad-hoc agent-generated doc. `unverified: the original comparison rubric (criteria-based
vs holistic) is not confirmed`. Per codex F-003, F0/D4 does not merely *record* this — it must *produce* a
concrete criteria-based acceptance rubric (archived baseline + pass/fail thresholds) before F1 starts, since
F5 has no alternate gate.

## 2. Inviolable principles

- **P1 Adopt, do not rebuild** — the artifact is markdown, the same genre as atomic-skills, so a refactor is a transform rather than a re-derivation; rebuilding fresh re-invents ~4,346 lines of proven pipeline at regression risk. `verified_by: source tree is .md only — find <source> -name '.php' → 0 results`.
- **P2 Preserve the proven IP** — keep the `steps/` pipeline and the 5-dimension review (07a-e) prose intact; that rigor is why the pipeline doc beat ad-hoc generation. Touch prompt prose minimally.
- **P3 Laravel stays first-class** — ship exactly one Laravel/Nova extraction adapter; name the seam so a second stack is an additive file, but do not build a second adapter speculatively (premature generalization). The user's real fleet is Laravel/Nova. `verified_by: ../arch is a Laravel/Nova app — app/, routes/, nova/, database/migrations present`.
- **P4 Trust through provenance** — every load-bearing claim in a generated doc carries a `file:line` citation, verified in a pass separate from generation. This is the one guardrail the source pipeline lacks; the findings schema carries `source:{file,line}` but generated doc claims do not. `verified_by: references/findings-schema.md has source.file/source.line; step extraction files emit prose without per-claim citation`.
- **P5 House standard wins on shape** — reconcile doc-architect's `documentation-standard-template.md` into the target repo's own documentation standard; map fields and flag gaps rather than replacing wholesale, so extraction depth is preserved. Delivered by F2/T-004 (added per codex F-005); F5 gates generated docs on conformance to the reconciled standard.

## 3. Phase tree

_(Canonical list in frontmatter `phases:`. aiDeck renders the tree visually when running.)_

## Self-review against code-quality gates

- **G1 read-before-claim**: every claim about the source artifact carries a `verified_by:` derived from direct inspection of the source tree during the debate (file tree, `wc -l`, grep counts, frontmatter reads). No claim is inferred from a file name alone.
- **G2 soft-language**: scanned the body for the ban list (`should`, `probably`, `may`, `typically`, `usually`, `I think`, `it seems`, `in theory`, `tends to`); 0 occurrences — assertions are committed statements or carry `unverified:`.
- **G6 reference-or-strike**: each load-bearing assertion carries `verified_by:` or `unverified:`. One `unverified:` remains — the `../arch` comparison rubric — explicitly deferred to decision D4 in F0.

## Reviews

- 2026-05-31 — codex cross-model (gpt-5-codex, two-pass): **needs_changes** (1 critical, 4 major) → **all 5 applied**. See [`.atomic-skills/reviews/2026-05-31-2059-refactor-doc-architect.md`](../reviews/2026-05-31-2059-refactor-doc-architect.md). F-001 (F1/T-001 full copy manifest), F-002 (F1/T-002 all 8 tool vars), F-003 critical (F0/D4 must produce a concrete rubric; F5 references it unconditionally), F-004 (F4/T-001 single citation grammar), F-005 (new F2/T-004 standard reconciliation). All 7 state files re-validated against schema post-fix.

## Decompose warnings

- Skipped H2 section: "Self-review against code-quality gates" — re-appended above by the orchestrator after materialize (decompose has no heuristic for it; it is required content per the skill contract).
