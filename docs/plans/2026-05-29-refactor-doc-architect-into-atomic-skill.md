# Refactor doc-architect into an atomic-skill

Outcome of `atomic-skills:debate` (2026-05-29): adopt BMAD's `doc-architect` into atomic-skills
**via refactor**, not via port and not via rebuild-from-scratch. The decision reverses the prior
"NOT for porting" conclusion recorded in memory `bmad-doc-architect-concepts`, whose premise was
factually wrong. The artifact is a prompt/workflow skill of ~35 markdown files / ~4,346 lines with
zero PHP — the same genre as atomic-skills — already structured along clean extractor / contract /
renderer seams. `verified_by: find <source> -name '*.md' | wc -l → 35; wc -l total → 4346; grep PHP → 0`.
Source: `/Volumes/External/code/bmad-dev-productivity/bmad-doc-architect/workflows/bmad-doc-architect/`.
The proven value is the multi-step methodology: in a real Laravel app (`../arch`) the pipeline-generated
module doc beat an ad-hoc agent-generated doc. `unverified: the comparison rubric (criteria-based vs
holistic) is not yet confirmed — resolved by decision D4 in F0`.

## Principles

- **P1 Adopt, do not rebuild** — the artifact is markdown, the same genre as atomic-skills, so a refactor is a transform rather than a re-derivation; rebuilding fresh re-invents ~4,346 lines of proven pipeline at regression risk. `verified_by: source tree is .md only — find <source> -name '*.php' → 0 results`.
- **P2 Preserve the proven IP** — keep the `steps/` pipeline and the 5-dimension review (07a-e) prose intact; that rigor is why the pipeline doc beat ad-hoc generation. Touch prompt prose minimally.
- **P3 Laravel stays first-class** — ship exactly one Laravel/Nova extraction adapter; name the seam so a second stack is an additive file, but do not build a second adapter speculatively (premature generalization). The user's real fleet is Laravel/Nova. `verified_by: ../arch is a Laravel/Nova app — app/, routes/, nova/, database/migrations present`.
- **P4 Trust through provenance** — every load-bearing claim in a generated doc carries a `file:line` citation, verified in a pass separate from generation. This is the one guardrail the source pipeline lacks; the findings schema carries `source:{file,line}` but generated doc claims do not. `verified_by: references/findings-schema.md has source.file/source.line; step extraction files emit prose without per-claim citation`.
- **P5 House standard wins on shape** — reconcile doc-architect's `documentation-standard-template.md` into the target repo's own documentation standard; map fields and flag gaps rather than replacing wholesale, so extraction depth is preserved.

## Glossary

| Term | Definition |
|------|------------|
| **doc-architect** | The BMAD source skill being refactored: discovery → deep-read → extract dimensions → 5-D review → report, emitting 6 Diataxis-typed files per module. |
| **adapter seam** | The boundary isolating stack-specific extraction (`references/extraction-*` → `references/adapters/laravel.md`) from the framework-agnostic pipeline. |
| **5-D review** | The five independent review steps 07a-e: accuracy, permissions, type-purity, completeness, quality. |
| **Diataxis** | Documentation taxonomy (Tutorial / How-to / Reference / Explanation) the pipeline enforces and reviews for type purity. |
| **bake-off** | The head-to-head where the pipeline doc beat an ad-hoc agent doc on a real `../arch` module; reused as the F5 regression gate. |

## F0 — Confirm conventions and decisions

**Goal:** Lock the target skill layout against an existing atomic-skill and resolve the four open decisions before any file is moved.

### Sub-fases (menu)

- **T-001 — Read an existing atomic-skill end to end.** Inspect a skill under `skills/` to lock the exact layout: SKILL.md frontmatter shape, where step/reference files live, and the `skills/shared/<name>-assets/` convention.
- **T-002 — Resolve decisions D1-D4 with the user.** D1 standard tie-break (house standard wins on structure, template wins on extraction depth). D2 stack scope (Laravel + Nova only for v1; Filament is reference pattern, not drop-in). D3 type-purity rubric source (target repo's convention, not Laravel's). D4 the `../arch` comparison rubric (adopt as acceptance gate if criteria-based).
- **T-003 — Confirm target location and slug.** Propose `skills/modules/architect-doc/` plus `skills/shared/architect-doc-assets/`; confirm naming against the registry style.

**Exit gate da fase:** an existing skill's layout is documented as the template to follow, and D1-D4 each have a recorded answer.

## F1 — Mechanical move and tool abstraction

**Goal:** Copy the proven pipeline into the new skill location and convert it to atomic-skills conventions, changing structure and tool references only — not prompt substance.

### Sub-fases (menu)

- **T-001 — Copy the pipeline assets.** Bring `steps/` (step-01 through step-07f), `references/findings-schema.md`, `references/verification-checklist.md`, `references/documentation-standard-template.md`, and the `adapter-*.md` files into the new skill. The 5-D review (07a-e) is copied intact. `verified_by: source steps/ contains step-01-discovery..step-07f-report; references/ contains findings-schema.md, verification-checklist.md`.
- **T-002 — Run the tool-literal abstraction sweep.** Replace every `Bash`/`Read`/`Grep`/`Glob` literal with `{{BASH_TOOL}}`, `{{READ_TOOL}}`, `{{GREP_TOOL}}`, `{{GLOB_TOOL}}` across the moved files, per the project CLAUDE.md tool-abstraction rule.
- **T-003 — Rewrite SKILL.md frontmatter.** Convert to atomic-skills namespace and registry-style name/description; remove the BMAD `--headless` autonomous-mode block (or re-express it via atomic conventions if the user wants headless). `verified_by: source SKILL.md frontmatter is name+description only and body has an "Activation Mode Detection" --headless block`.
- **T-004 — Relocate output adapters.** Move `adapter-gh-issues`, `adapter-html-report`, `adapter-findings-report` into `references/adapters/` as pluggable output targets and variable-swap them.

**Exit gate da fase:** the skill loads under atomic-skills conventions with zero remaining hardcoded tool literals and no dangling BMAD frontmatter.

## F2 — Drop and replace BMAD coupling

**Goal:** Remove BMAD-specific scaffolding and re-point config, memory, and output paths to atomic-skills / target-repo conventions.

### Sub-fases (menu)

- **T-001 — Delete BMAD scaffolding.** Remove `_memory-template/`, `module.yaml`, `bmad-manifest.json`, `bmad-skill-manifest.yaml`. `verified_by: source tree lists _memory-template/, module.yaml, workflows/.../bmad-manifest.json, bmad-skill-manifest.yaml`.
- **T-002 — Replace language-config indirection.** The `{communication_language}` / `{generated_docs_language}` variables and the `_bmad/...config.yaml` loads resolve to the atomic-skills language convention; use `{{#if ...}}` conditionals where IDE-specific. `verified_by: source SKILL.md loads _bmad/bmad-doc-architect/config.yaml and _bmad/bmm/config.yaml and references {communication_language}/{generated_docs_language}`.
- **T-003 — Re-point memory and output paths.** Memory `_bmad/_memory/doc-architect-sidecar/` maps to `.ai/memory/`; output `_bmad-output/doc-architect/<module>/` maps to a target-repo-relative docs path aligned with the 6-files-per-module output. `verified_by: source step-01 frontmatter appArchitecture points at _bmad/_memory/doc-architect-sidecar/; findings-schema snapshot path is _bmad-output/doc-architect/<module-slug>/`.

**Exit gate da fase:** no path or variable in the skill references `_bmad`, `_bmad-output`, or a BMAD manifest.

## F3 — Carve Laravel into a first-class adapter

**Goal:** Isolate the stack-specific extraction knowledge behind one Laravel adapter while keeping its depth intact. This is the genuine engineering of the refactor, because coupling is both delegated and inlined.

### Sub-fases (menu)

- **T-001 — Consolidate extraction guides into the adapter.** Move `references/extraction-{flows,permissions,validations,user-guide}.md` (and business-rules extraction) into `references/adapters/laravel.md` (or a `laravel/` dir). `verified_by: source step-05-flows frontmatter delegates via extractionGuide: references/extraction-flows.md`.
- **T-002 — De-inline framework assumptions from steps.** Replace inlined Laravel/Eloquent specifics in the steps with generic prompts that delegate to the adapter — for example step-05 hardcodes `State`/`Transition` classes and `$name/$label/$color`. Audit every Laravel mention across `steps/01,02,04,05,06a`, `steps/07b,07d`, `discover-architecture.md`, `init.md`, `module-status.md`, `references/memory-system.md`, `references/verification-checklist.md`. `verified_by: grep -il laravel|filament|spatie|eloquent|nova across source → 18 files including those steps`.
- **T-003 — Document the adapter seam.** State explicitly that `references/adapters/laravel.md` is the one shipped adapter and how a second stack would plug in, so the seam is visible without building adapter #2.

**Exit gate da fase:** the framework-agnostic `steps/` carry no inlined Laravel symbols, and all stack specifics live in `references/adapters/laravel.md` with its depth preserved.

## F4 — Add claim-level citations

**Goal:** Close the one trust guardrail the source pipeline lacks — per-claim provenance captured at generation and confirmed at review.

### Sub-fases (menu)

- **T-001 — Add citation discipline to extraction steps.** Each architecture/flow assertion the pipeline emits carries a `file:line` (or symbol) reference; an uncited claim is marked as a confidence flag rather than asserted as fact.
- **T-002 — Extend the verification pass to check provenance and diagram edges.** The existing verification step re-reads cited sources to confirm each claim, and treats every Mermaid diagram edge as a verifiable claim that must trace to real code. `verified_by: source has references/verification-checklist.md and step-05/step-06b emit Mermaid stateDiagram-v2/flowchart/sequence with a "diagrams must match code exactly" rule`.

**Exit gate da fase:** a generated module doc carries a `file:line` citation on every load-bearing claim, and the verification pass fails when a citation does not resolve.

## F5 — Regression gate and acceptance

**Goal:** Prove the refactored skill still beats ad-hoc generation and emits a conformant, verifiable doc set.

### Sub-fases (menu)

- **T-001 — Re-run the refactored skill on the original module.** Run it on the same `../arch` module used in the original bake-off and compare against that result.
- **T-002 — Verify acceptance criteria.** Refactored pipeline beats ad-hoc on the D4 rubric; every cross-step reference resolves (markdown has no compiler, so a broken "as found in step 03" reference fails silently — gate via the ported `verification-checklist.md`); 6 Diataxis-typed files emitted; every load-bearing claim carries a citation.

**Exit gate da fase:** the regression run passes the D4 rubric and the verification checklist reports zero unresolved cross-step references or uncited claims.

## Self-review against code-quality gates

- **G1 read-before-claim**: every claim about the source artifact carries a `verified_by:` derived from direct inspection of the source tree during the debate (file tree, `wc -l`, grep counts, frontmatter reads). No claim is inferred from a file name alone.
- **G2 soft-language**: scanned the body for the ban list (`should`, `probably`, `may`, `typically`, `usually`, `I think`, `it seems`, `in theory`, `tends to`); 0 occurrences — assertions are committed statements or carry `unverified:`.
- **G6 reference-or-strike**: each load-bearing assertion carries `verified_by:` or `unverified:`. One `unverified:` remains — the `../arch` comparison rubric — explicitly deferred to decision D4 in F0.
