---
date: 2026-05-22T15:46:08-03:00
topic: plan-review-merge-codex
artifact: docs/plan-review-merge-codex.md
skill: review-plan-with-codex
reviewer: gpt-5-codex
codex_version: codex-cli 0.130.0
final_verdict: needs_changes
counts_final: {blocker: 0, critical: 1, major: 4, minor: 0, nit: 0}
counts_blind: {blocker: 0, critical: 2, major: 3, minor: 0, nit: 0}
framing_delta: {dropped: 1, maintained: 4, emerged: 1}
schema_version: "1.0"
---

# Cross-Model Review — plan-review-merge-codex

## Pass 1 (blind)

---
verdict: needs_changes
counts: {blocker: 0, critical: 2, major: 3, minor: 0, nit: 0}
reviewer: gpt-5-codex
pass: blind
schema_version: "1.0"
---

## Summary
The plan removes two invocable skills but does not specify a complete migration of call sites, tests, scripted review flows, or mode flags. Several completion criteria are internally impossible or under-specified, so an implementation can pass the written phases while leaving broken commands and stale references behind.

The largest risks are dependency breakage from deleted skill names, loss of non-interactive review execution, and a codex plan-review path that cannot perform the cross-reference behavior still advertised by the merged skill.

## Findings

### F-001 [critical] dependency breaks — docs/plan-review-merge-codex.md:75-84

**Evidence:**
```md
| 1 | Design do Step 0 mode picker (review-plan) | (design only) | 15 min |
| 2 | Reescrever `skills/en/core/review-plan.md` body — combina ambos os modos | edit body | 60 min |
| 3 | Design do Step 0 mode picker (review-code) | (design only) | 10 min |
| 4 | Reescrever `skills/en/core/review-code.md` body — combina ambos os modos | edit body | 45 min |
| 5 | Delete `skills/en/core/review-plan-with-codex.md` + `review-code-with-codex.md` | rm | 1 min |
| 6 | Atualizar `meta/skills.yaml` (remove 2 entries `-with-codex`) | edit | 10 min |
| 7 | Atualizar README.md (tabela + seções) | edit | 25 min |
| 8 | Atualizar HelpView.tsx (remove 2 entries do const) | edit | 15 min |
| 9 | Bump version 2.0.0 → **3.0.0** + atualiza CHANGELOG | edits | 10 min |
| 10 | Validação: `npm test`, `npm run validate-skills`, `npm run build:dashboard`, manual HelpView | scripts | 15 min |
```

**Claim:** The phase list deletes the `-with-codex` skill files but has no repository-wide migration task for functional references in other skill bodies, source files, or tests.

**Impact:** Existing invocations of deleted commands can remain in automation and test fixtures, so installed workflows can call non-existent skills and `npm test` can fail after the files are removed.

**Recommendation:** Add a mandatory migration phase before validation: run `rg "review-plan-with-codex|review-code-with-codex" skills/ meta/ src/ tests/ README.md CHANGELOG.md`, replace every functional call site with the merged command and selected mode, and update tests that assert the old skill files render.

**Confidence:** high

---

### F-002 [major] contradiction — docs/plan-review-merge-codex.md:413-418

**Evidence:**
```md
- **Removed `review-plan-with-codex`** — merged into `review-plan` (existing).
  The codex cross-model envelope is now opt-in via Step 0 mode picker.
  Migration: replace `/atomic-skills:review-plan-with-codex <path>` with
  `/atomic-skills:review-plan <path>`; choose "Codex only" or "Both" when prompted.
- **Removed `review-code-with-codex`** — merged into `review-code` (existing).
  Migration: same pattern as above with `/atomic-skills:review-code <git-ref>`.
```

**Claim:** The plan requires adding old skill names to `CHANGELOG.md` while the Definition of Done later requires zero references to those names in `CHANGELOG.md`.

**Impact:** The implementation cannot satisfy both the release notes requirement and the cross-cutting zero-reference gate; validation becomes subjective or forces removal of the documented migration path.

**Recommendation:** Change the zero-reference rule to allow old names only in migration narrative sections of `README.md` and `CHANGELOG.md`, while forbidding live commands, catalog entries, anchors, tests, and executable references.

**Confidence:** high

---

### F-003 [critical] dependency breaks — docs/plan-review-merge-codex.md:55-58

**Evidence:**
```md
Final: 2 skills de review. Cada uma com 3 modos:
- `both` (default, local→codex)
- `local only`
- `codex only`
```

**Claim:** The new mode model omits the existing non-interactive `review-plan` modes such as internal/cross-ref execution, and the plan does not define compatibility or migration for callers that pass mode flags.

**Impact:** Automated workflows that run review skills in loops can start prompting the user or reject their existing flags, which breaks non-interactive plan generation/status flows even if the new picker works manually.

**Recommendation:** Define argument parsing before the picker: preserve `--mode=internal` as `local`, preserve or map cross-reference flags, add `--mode=local|codex|both`, and update all internal callers to use the supported non-interactive flag.

**Confidence:** high

---

### F-004 [major] coverage gap — docs/plan-review-merge-codex.md:118-126

**Evidence:**
```md
### 1.2 — Cross-ref picker (only on local OR both — codex doesn't use it)

If `mode` ∈ {`local`, `both`}: run the existing artifact detection +
AskUserQuestion from current `review-plan.md:Step 0` (cross-ref or
internal-only).

If `mode == codex`: skip — codex envelope reviews the plan against the
external constraints baked into the briefing template; no cross-ref
mechanism needed.
```

**Claim:** `codex only` mode drops cross-reference artifact selection even though the merged `review-plan` is still described as supporting optional cross-reference review.

**Impact:** A user choosing codex-only review of a plan against a PRD/spec cannot provide those artifacts to the codex briefing, so requirement gaps against external artifacts are invisible to the cross-model reviewer.

**Recommendation:** Run artifact detection for all `review-plan` modes, including `codex`, and include selected artifacts in the codex briefing as neutral source facts while still excluding local findings and prior-review narrative.

**Confidence:** high

---

### F-005 [major] ambiguity — docs/plan-review-merge-codex.md:277-285

**Evidence:**
```md
Pre-flight (git ref validation, dirty tree check) runs AFTER mode picker,
since it applies to all modes.

---

## Fase 4 — Reescrever `skills/en/core/review-code.md` body

Mesmo padrão do Fase 2 mas pra código. Estima ~400 linhas combinadas
(menos que review-plan porque review-code não tem cross-ref complexity).
```

**Claim:** The `review-code` merge is under-specified because it does not define how git ref parsing, diff materialization, local review input, codex briefing input, and dirty-tree policy behave per mode.

**Impact:** Two implementations can produce materially different reviewed diffs, especially for branch names versus ranges or dirty worktrees, causing local and codex phases to review different code or fail after the mode prompt.

**Recommendation:** Add an explicit `review-code` flow matching the plan-level detail: parse `{{ARG_VAR}}`, validate ref/range, materialize the exact diff once, define dirty-tree handling, and state that local and codex phases both review that same captured diff.

**Confidence:** medium

## Questions (non-findings)

- docs/plan-review-merge-codex.md:340 — Should `network_required: true` remain global for a skill whose `local only` mode does not require network?

## Out of scope

- Internal codex envelope flow changes.
- Changes to `src/render.js`, `scripts/validate-skills.js`, `src/install.js`, or `src/detect.js`.
- `README.pt-BR.md`.
- Deprecated aliases for removed skill names.
## Pass 2 (informed)

---
verdict: needs_changes
counts: {blocker: 0, critical: 1, major: 4, minor: 0, nit: 0}
reviewer: gpt-5-codex
pass: informed
schema_version: "1.0"
---

## Summary
The plan still has implementation-breaking gaps after applying the external constraints. It contradicts itself on whether removed skill names may remain in `CHANGELOG.md`, under-specifies non-interactive argument handling despite repository conventions requiring `{{ARG_VAR}}`, and removes cross-reference selection from codex-only review even though the merged skill continues to advertise that capability.

The new constraints also expose a concrete dependency problem: the plan says the codex two-pass flow is defined in shared bridge assets, but the merge tasks only copy from the old skill bodies and never integrate those shared assets, so the merged skills can silently drift from the canonical envelope flow.

## Findings

### F-001 [major] contradiction — docs/plan-review-merge-codex.md:413

**Evidence:**
```md
- **Removed `review-plan-with-codex`** — merged into `review-plan` (existing).
  The codex cross-model envelope is now opt-in via Step 0 mode picker.
  Migration: replace `/atomic-skills:review-plan-with-codex <path>` with
  `/atomic-skills:review-plan <path>`; choose "Codex only" or "Both" when prompted.
- **Removed `review-code-with-codex`** — merged into `review-code` (existing).
  Migration: same pattern as above with `/atomic-skills:review-code <git-ref>`.
```

**Claim:** The plan requires adding removed skill names to `CHANGELOG.md` while the Definition of Done requires zero references to those names in `CHANGELOG.md`.

**Impact:** The implementation cannot satisfy both the migration documentation requirement and the zero-reference gate; either release notes lose the migration path or the final checklist fails.

**Recommendation:** Change the zero-reference rule to allow removed names only in migration documentation in `README.md` and `CHANGELOG.md`, while forbidding live catalog entries, executable references, tests, anchors, and skill-body references.

**Confidence:** high

---

### F-002 [critical] dependency breaks — docs/plan-review-merge-codex.md:55

**Evidence:**
```md
Final: 2 skills de review. Cada uma com 3 modos:
- `both` (default, local→codex)
- `local only`
- `codex only`
```

**Claim:** The new mode model omits existing non-interactive argument behavior and does not define how `{{ARG_VAR}}` flags map to the picker modes.

**Impact:** Automated or scripted uses of `review-plan` and `review-code` can start blocking on `{{ASK_USER_QUESTION_TOOL}}` prompts or reject existing flags, breaking non-interactive review flows even though the merged skills render successfully.

**Recommendation:** Add an argument contract before the picker: parse `{{ARG_VAR}}`, support non-interactive `--mode=local|codex|both`, preserve or map existing internal/cross-ref flags, and only call `{{ASK_USER_QUESTION_TOOL}}` when no explicit mode is provided.

**Confidence:** high

---

### F-003 [major] coverage gap — docs/plan-review-merge-codex.md:118

**Evidence:**
```md
### 1.2 — Cross-ref picker (only on local OR both — codex doesn't use it)

If `mode` ∈ {`local`, `both`}: run the existing artifact detection +
AskUserQuestion from current `review-plan.md:Step 0` (cross-ref or
internal-only).

If `mode == codex`: skip — codex envelope reviews the plan against the
external constraints baked into the briefing template; no cross-ref
mechanism needed.
```

**Claim:** `codex only` mode drops cross-reference artifact selection even though the merged `review-plan` is still documented as supporting optional cross-reference review.

**Impact:** A codex-only review of a plan against a PRD, spec, or decision record cannot include that artifact, so the cross-model reviewer misses requirement gaps that local mode would inspect.

**Recommendation:** Run artifact detection for all `review-plan` modes and include selected artifacts in the codex briefing as neutral source material, while still excluding local findings and prior-review narrative.

**Confidence:** high

---

### F-004 [major] ambiguity — docs/plan-review-merge-codex.md:277

**Evidence:**
```md
Pre-flight (git ref validation, dirty tree check) runs AFTER mode picker,
since it applies to all modes.

---

## Fase 4 — Reescrever `skills/en/core/review-code.md` body

Mesmo padrão do Fase 2 mas pra código. Estima ~400 linhas combinadas
(menos que review-plan porque review-code não tem cross-ref complexity).
```

**Claim:** The `review-code` merge does not define how git ref parsing, diff capture, dirty-tree policy, local input, and codex briefing input behave per mode.

**Impact:** Different implementations can review different diffs in local and codex phases, especially for ref ranges or dirty worktrees, causing inconsistent findings or late failures after the user has already selected a mode.

**Recommendation:** Add an explicit `review-code` flow: parse `{{ARG_VAR}}`, validate the ref or range, materialize one exact diff before either phase, define dirty-tree handling, and require both local and codex phases to review that same captured diff.

**Confidence:** medium

---

### F-005 [major] dependency breaks — docs/plan-review-merge-codex.md:197

**Evidence:**
```md
Body novo merges:
- Atual `review-plan.md` (Step 0 cross-ref, self-loop checklist, G1+G2+G6)
- Atual `review-plan-with-codex.md` (12-step codex envelope flow,
  G1+G2+G6 codex audit lens, sealed envelope, two-pass)
```

**Claim:** The merge task copies the codex envelope from the old skill bodies but does not require using or verifying the canonical shared bridge assets where the external constraint says the two-pass flow is defined.

**Impact:** The merged skills can embed stale or partial envelope instructions while the shared `skills/shared/codex-bridge-assets/` flow remains unchanged, producing a skill that passes file deletion and YAML validation but no longer follows the canonical 12-step codex flow.

**Recommendation:** Add a task in phases 2 and 4 to source the codex sub-flow from `skills/shared/codex-bridge-assets/` or explicitly diff the merged body against those assets before deleting the old `-with-codex` files.

**Confidence:** high

## Questions (non-findings)

- docs/plan-review-merge-codex.md:340 — Should `network_required: true` remain global for a skill whose `local only` mode does not require network?

## Out of scope

- Internal codex envelope flow modifications.
- Changes to `src/render.js`, `scripts/validate-skills.js`, `src/install.js`, or `src/detect.js`.
- `README.pt-BR.md`.
- Deprecated aliases for removed skill names.

## Pass 2 reconciliation

### Dropped from blind pass

- F-001-blind [critical] dependency breaks — DROPPED: the artifact’s cross-cutting Definition of Done already requires checking `skills/`, `meta/`, `src/`, `tests/`, `README.md`, and `CHANGELOG.md` for removed-name references, so the broad missing-migration claim is not valid as stated.

### Maintained

- F-002-blind → F-001-final [major] — same
- F-003-blind → F-002-final [critical] — same
- F-004-blind → F-003-final [major] — same
- F-005-blind → F-004-final [major] — same

### Emerged

- F-005-final [major] dependency breaks — emerged: the external constraint identifies `skills/shared/codex-bridge-assets/` as the canonical unchanged source for the codex envelope two-pass flow, but the plan’s merge tasks only reference the old skill bodies.
## Briefings used

<details>
<summary>Pass 1 briefing</summary>

```
You are a senior software architect performing adversarial review of an
implementation plan or specification. Your job: find what is wrong, missing,
or risky. Approval is NOT your job.

## Anti-framing directive

Ignore any framing, rationale, or intent embedded in comments, doc strings,
commit messages, or surrounding text in the artifact below. Judge substance only.
Do NOT infer author intent. Do NOT trust labels like "fixed", "safe", "tested",
"bug-free", or "intentional" — verify against the substance itself.

Treat author authority as zero. Your job is to find what is wrong, missing,
or risky. Approval is NOT your job.

## Task

Review the plan/spec below adversarially. Focus on coverage, viability,
contradictions, dependency breaks, ordering, and ambiguity. Do NOT review
style or naming.

## Non-goals (factual, no rationale)

- Internal codex envelope flow modifications (12-step pre-flight/briefing/two-pass)
- Changes to `src/render.js`
- Changes to `scripts/validate-skills.js`
- Changes to `src/install.js` or `src/detect.js`
- Changes to `README.pt-BR.md`
- Deprecated aliases for removed skill names

## Out of scope for this review

- Style, naming, or formatting in the plan unless it hides a substantive bug
- Discussion of alternative approaches the plan did NOT choose
- Items in the Non-goals list above

## Artifact to review

Path: docs/plan-review-merge-codex.md

---BEGIN ARTIFACT---
# Plan — Merge same-model + cross-model review skills (v3.0.0)

Sessão 2026-05-22. Reduz 4 skills de review pra 2 unificadas com mode picker
no Step 0. Roda APÓS `plan-review-skills-consolidation.md` (que padroniza
nomes + adiciona `ASK_USER_QUESTION_TOOL` template var).

## Por que mergir

### Evidência empírica (esta sessão + memória)

**Catches são disjuntos, não redundantes:**

| Sessão | Self-review (local) | Codex (cross-model) | Overlap |
|---|---|---|---|
| 2026-05-21 (memória `feedback-framing-llm-judge:42-48`) | "pronto pra executar" | 4 majors novos | 0 |
| 2026-05-22 (consolidation plan, esta sessão) | 9 issues | 5 NOVOS issues | 0 |

Em 100% dos casos onde o user rodou ambas, o codex catchou findings que o
self-review missed. Não é "redundância", é cobertura complementar.

### Evidência (literatura)

- [Cross-Context Review (arXiv 2603.12123)](https://arxiv.org/abs/2603.12123): same-session self-review F1 = 24.6%; cross-context F1 = 28.6%. **Mesmo o cross-context melhor sozinho deixa ~71% dos erros não-detectados** — os dois métodos juntos cobrem distintos.
- [Self-Preference Bias (arXiv 2410.21819)](https://arxiv.org/abs/2410.21819): LLMs preferem textos com baixa perplexidade (familiares). Self-review tem ponto cego estrutural — daí o valor do cross-family.
- [Refute-or-Promote (arXiv 2604.19049)](https://arxiv.org/html/2604.19049v1): valida stage-gated multi-agent review com Cross-Model Critic. Pipeline pattern.
- [Two-stage workflow (arXiv 2601.09905)](https://arxiv.org/pdf/2601.09905): secondary LLM critic re-revisa com rationale do primário.
- [Framing poison (arXiv 2603.18740)](https://arxiv.org/abs/2603.18740): -93pp detection rate quando briefing carrega intent. Reforça necessidade de sealed envelope para o codex.

### UX

O user disse: "em projetos maiores, eu vou sempre querer as 2 revisões".
Forçar 2 commands manuais é fricção. Merge com Step 0 default "both"
formaliza o workflow real. Para projetos pequenos, o picker permite "local
only".

## Ordem dentro de "both" mode: local → codex

Três argumentos convergentes (não-deduzidos — verificados):

1. **Custo**: local é grátis (tokens da sessão já corrente); codex é API paga (~$1-2/review). Filtrar obviedades grátis primeiro é eficiente.
2. **Anti-anchoring**: se codex primeiro, o local lê findings do codex e ancora (Claude trusta GPT — self-preference bias na direção oposta). Local primeiro deixa o codex receber plan fresco e produzir output independente.
3. **Sealed envelope**: o briefing do codex deve estar limpo de framing. Rodar local primeiro garante que o codex recebe SÓ o plano (cleaned) + constraints externas — NÃO as findings do local. Sealing preservada.

Validado empiricamente nesta sessão: consolidation plan rodou local→codex, codex catchou findings disjuntos.

## Net effect na catalog

| Antes (4 skills) | Depois (2 skills) |
|---|---|
| review-plan (same-model) | **review-plan** (com Step 0 mode picker) |
| review-plan-with-codex | (merged into review-plan) |
| review-code (same-model) | **review-code** (com Step 0 mode picker) |
| review-code-with-codex | (merged into review-code) |

Final: 2 skills de review. Cada uma com 3 modos:
- `both` (default, local→codex)
- `local only`
- `codex only`

## Pré-requisitos (já completos quando este plan executar)

Vindo do `plan-review-skills-consolidation.md`:
- ✅ `review-plan` existe com Step 0 cross-ref AskUserQuestion
- ✅ `review-code` existe com validação git ref range-aware
- ✅ `review-plan-with-codex` existe com G1+G2+G6 gates
- ✅ `review-code-with-codex` existe (sem mudança)
- ✅ `src/render.js` define `{{ASK_USER_QUESTION_TOOL}}` template var
- ✅ `CHANGELOG.md` existe (versão 2.0.0 documentada)
- ✅ `package.json:version == "2.0.0"`

## Fases (ordem obrigatória)

| # | Fase | Arquivos | Tempo |
|---|---|---|---|
| 1 | Design do Step 0 mode picker (review-plan) | (design only) | 15 min |
| 2 | Reescrever `skills/en/core/review-plan.md` body — combina ambos os modos | edit body | 60 min |
| 3 | Design do Step 0 mode picker (review-code) | (design only) | 10 min |
| 4 | Reescrever `skills/en/core/review-code.md` body — combina ambos os modos | edit body | 45 min |
| 5 | Delete `skills/en/core/review-plan-with-codex.md` + `review-code-with-codex.md` | rm | 1 min |
| 6 | Atualizar `meta/skills.yaml` (remove 2 entries `-with-codex`) | edit | 10 min |
| 7 | Atualizar README.md (tabela + seções) | edit | 25 min |
| 8 | Atualizar HelpView.tsx (remove 2 entries do const) | edit | 15 min |
| 9 | Bump version 2.0.0 → **3.0.0** + atualiza CHANGELOG | edits | 10 min |
| 10 | Validação: `npm test`, `npm run validate-skills`, `npm run build:dashboard`, manual HelpView | scripts | 15 min |

**Total: ~3h30min** sequencial.

---

## Fase 1 — Design Step 0 mode picker para `review-plan`

### 1.1 — Mode picker (sempre primeiro)

```markdown
## Step 0a — Pick review mode

Use {{ASK_USER_QUESTION_TOOL}}:

**Question:** "How should this plan be reviewed?"

**Options:**
- **Both (local then codex)** — Recommended for plans entering significant
  execution. Self-loop adversarial review runs first (catches contradictions,
  broken deps, ordering). Plan is fixed inline. Then codex cross-model
  review runs on the CLEANED plan with sealed envelope (catches what
  self-review missed due to self-preference bias). ~$1-2 codex cost.
- **Local only** — Self-loop adversarial review. Cheap, fast, catches
  obvious issues. Use for small plans or when codex is unavailable.
- **Codex only** — Skip local, go straight to cross-model envelope. Use
  when you already had another agent self-review the plan and want a
  fresh independent read.

Default: Both. The user explicitly opts down for cost-sensitive cases.
```

Set `mode` ∈ {`both`, `local`, `codex`} based on answer.

### 1.2 — Cross-ref picker (only on local OR both — codex doesn't use it)

If `mode` ∈ {`local`, `both`}: run the existing artifact detection +
AskUserQuestion from current `review-plan.md:Step 0` (cross-ref or
internal-only).

If `mode == codex`: skip — codex envelope reviews the plan against the
external constraints baked into the briefing template; no cross-ref
mechanism needed.

### 1.3 — Flow per mode

```
mode == 'local':
  Step 0a (mode) → 'local'
  Step 0b (cross-ref) → internal | cross-ref + artifacts
  Run self-loop checklist
  Apply fixes inline
  Output: standard analysis summary
  END (no codex)

mode == 'codex':
  Step 0a (mode) → 'codex'
  (skip Step 0b — codex envelope doesn't use cross-ref)
  Pre-flight checks (codex installed, working tree clean unless --allow-dirty)
  Build Pass 1 briefing from ORIGINAL plan + external constraints
  Codex Pass 1 (blind)
  Validate Pass 1
  Build Pass 2 briefing (informed)
  Codex Pass 2
  Validate Pass 2
  Persist to .atomic-skills/reviews/
  Triage codex findings; apply fixes
  END

mode == 'both':
  Step 0a (mode) → 'both'
  Step 0b (cross-ref) → internal | cross-ref + artifacts
  [LOCAL PHASE]
  Run self-loop checklist
  Apply fixes inline
  Track: track set of fix descriptions (for the audit trail, NOT for the codex briefing)
  [CODEX PHASE]
  Pre-flight checks
  Build Pass 1 briefing from CLEANED plan (post-local-fixes) + external constraints
    IMPORTANT: do NOT include local findings, fix descriptions, or any framing
    about what was already reviewed. Codex sees only the plan + facts.
  Codex Pass 1 (blind)
  Validate Pass 1
  Build Pass 2 (informed)
  Codex Pass 2
  Validate Pass 2
  Persist to .atomic-skills/reviews/ (includes both local fix log AND codex findings)
  Triage codex findings; apply fixes
  END
```

### 1.4 — Sealed envelope contract (critical)

**Hard rule:** quando `mode == both`, o briefing do codex Pass 1 NÃO pode
mencionar:
- Findings do local
- Descrições de fixes aplicados
- Iteration count do self-loop
- Que houve um self-review prévio

O codex deve ver o plan CLEANED como se fosse a primeira revisão. Toda
narrativa de "Claude já revisou isso, encontrou X, corrigiu Y" é FRAMING
TÓXICO ([arXiv 2603.18740](https://arxiv.org/abs/2603.18740): -93pp
detection rate).

Validation: o body do skill DEVE incluir uma instrução explícita:
> "When building the Pass 1 briefing for codex, do NOT include local
> review findings, fix descriptions, or any narrative implying a prior
> review took place. The codex receives the cleaned plan + external
> constraints ONLY."

---

## Fase 2 — Reescrever `skills/en/core/review-plan.md` body

### 2.1 — Estrutura combinada

Body novo merges:
- Atual `review-plan.md` (Step 0 cross-ref, self-loop checklist, G1+G2+G6)
- Atual `review-plan-with-codex.md` (12-step codex envelope flow,
  G1+G2+G6 codex audit lens, sealed envelope, two-pass)

Plus Step 0a mode picker (Fase 1.1) controlling which sections run.

### 2.2 — Tamanho esperado

Atual `review-plan.md` (após consolidation): ~250 linhas
Atual `review-plan-with-codex.md`: ~145 linhas
Combined: ~400-500 linhas após dedupe (Iron Law, mindset, severity scale
podem ser unificados; só os flows diferem).

### 2.3 — Iron Law unificado

```markdown
## Iron Law

NO APPROVAL WITHOUT EVIDENCE.
- Local mode: every checklist item marked "ok" must cite plan line numbers.
- Cross-ref mode: items cite line numbers from BOTH plan AND artifact.
- Codex mode: every codex finding must have `file:line` + 4 fields
  (Claim, Impact, Recommendation, Confidence).

NO INTENT IN THE BRIEFING (codex sub-flow).
When building codex briefings: only externally verifiable facts. No
intent narrative, no memory, no authorship, no local-review findings.
```

### 2.4 — Closing format unificado

Output adapta ao mode:

```markdown
### Analysis Summary

**Mode:** local | codex | both
**Cross-ref:** internal | <artifacts list> (local/both only)
**Iterations (local):** [N] (local/both only)
**Codex iterations:** 2 (codex/both only)
**Counts (local):** ... (local/both only)
**Counts (codex final):** ... (codex/both only)
**Framing Δ (codex):** ... (codex/both only)

| # | Finding | Severity | Mode | Action |
|---|---|---|---|---|
| 1 | ... | critical | local | applied |
| 2 | ... | major | codex | applied |

**Reviews saved at:** .atomic-skills/reviews/<file>.md (codex/both modes)
**Final status:** Plan approved / with caveats / Escalated
```

---

## Fase 3 — Design Step 0 mode picker para `review-code`

Mesmo shape do Fase 1.1 mas pra código. Sem cross-ref question (decidido
em consolidation — código É o artefato).

```markdown
## Step 0 — Pick review mode

Use {{ASK_USER_QUESTION_TOOL}}:

**Question:** "How should this code change be reviewed?"

**Options:**
- **Both (local then codex)** — Recommended for significant changes
  (auth, payments, data integrity). Self-loop catches obvious bugs.
  Then codex catches what self missed.
- **Local only** — Cheap, fast. Use for routine PRs or pre-commit checks.
- **Codex only** — Skip local. Use when another agent self-reviewed.
```

Pre-flight (git ref validation, dirty tree check) runs AFTER mode picker,
since it applies to all modes.

---

## Fase 4 — Reescrever `skills/en/core/review-code.md` body

Mesmo padrão do Fase 2 mas pra código. Estima ~400 linhas combinadas
(menos que review-plan porque review-code não tem cross-ref complexity).

---

## Fase 5 — Delete old skill body files

```bash
rm skills/en/core/review-plan-with-codex.md
rm skills/en/core/review-code-with-codex.md
```

---

## Fase 6 — Atualizar `meta/skills.yaml`

### 6.1 — Remover 2 entries

- DELETE `core.review-plan-with-codex` (entry inteira)
- DELETE `core.review-code-with-codex` (entry inteira)

### 6.2 — Atualizar entries restantes que referenciam os deletados

Pré-condição: post-consolidation o yaml já tem refs corretas. Pós-merge,
precisamos limpar `related:` que apontavam pra `-with-codex`:

- `review-plan.related`: hoje `[review-plan-with-codex, review-code]`
  (vindo do consolidation) → trocar pra `[review-code]`.
- `review-code.related`: hoje `[review-code-with-codex, review-plan, fix, hunt]`
  → trocar pra `[review-plan, fix, hunt]`.
- `fix.related`: hoje `[hunt, review-code, review-code-with-codex]`
  → trocar pra `[hunt, review-code]`.
- `hunt.related`: hoje `[fix, review-code, review-code-with-codex]`
  → trocar pra `[fix, review-code]`.

### 6.3 — Atualizar `description` e `purpose` de `review-plan` e `review-code`

As entries existentes descrevem APENAS o modo same-model. Pós-merge,
descrições refletem ambos os modos. Exemplo `review-plan`:

```yaml
review-plan:
  description: 'Adversarial review of an implementation plan. Step 0 picks mode: local self-loop, codex cross-model envelope, or both (local first → codex on cleaned plan). Optional cross-reference against external artifacts.'
  purpose: >
    Adversarial review with mode picker: local (cheap, fast), codex
    (cross-model via OpenAI Codex CLI, ~$1-2), or both (default — local
    first, codex second on cleaned plan with sealed envelope).
  when_to_use:
    - 'You finished a plan and want a structural review'
    - 'Significant plan about to enter execution (both mode recommended)'
    - 'Cross-model bug hunt (codex or both)'
  when_not_to_use:
    - 'Plan is brainstorming, not structured yet'
    - 'Trivial plan (skip review entirely)'
```

Similar pra `review-code`. Mantém `requires_args: true`, `mutates_repo: true`,
`network_required: true` (codex mode requer network).

### 6.4 — Cross-validação

`npm run validate-skills` deve passar com:
- 11 entries total (era 13 post-consolidation; -2 do merge)
- Nenhum `related:` aponta pra `review-plan-with-codex` ou `review-code-with-codex`

---

## Fase 7 — Atualizar `README.md`

### 7.1 — Tabela "Overview"

Remover 2 linhas de `-with-codex`. Atualizar one-liner de `review-plan` e
`review-code` pra mencionar os 3 modos.

### 7.2 — Seções detalhadas

- DELETE `### atomic-skills:review-plan-with-codex` section
- DELETE `### atomic-skills:review-code-with-codex` section
- UPDATE `### atomic-skills:review-plan` — mencionar os 3 modos, dar exemplos por mode
- UPDATE `### atomic-skills:review-code` — idem

### 7.3 — Note sobre breaking change

```markdown
> **Note (v3.0.0):** `review-plan-with-codex` and `review-code-with-codex`
> were merged into their same-model counterparts. The codex envelope flow
> is now opt-in via Step 0 mode picker ("both", "local", or "codex").
> See [CHANGELOG.md](CHANGELOG.md) for migration.
```

---

## Fase 8 — Atualizar `HelpView.tsx`

### 8.1 — Remover entries

- DELETE `id: 'review-plan-with-codex'` entry
- DELETE `id: 'review-code-with-codex'` entry

### 8.2 — Atualizar entries restantes

`review-plan.summary` e `review-code.summary` mencionam os 3 modos.

### 8.3 — `related:` cleanup

Grep `review-plan-with-codex|review-code-with-codex` em HelpView.tsx e
remover de qualquer `related` array.

---

## Fase 9 — Bump version 2.0.0 → 3.0.0 + CHANGELOG

### 9.1 — `package.json` + `package-lock.json`

```diff
# package.json
- "version": "2.0.0",
+ "version": "3.0.0",
```

Depois rodar `npm install --package-lock-only` pra regenerar `package-lock.json`.

### 9.2 — CHANGELOG entry novo

```markdown
## [3.0.0] — <date>

### Breaking changes

- **Removed `review-plan-with-codex`** — merged into `review-plan` (existing).
  The codex cross-model envelope is now opt-in via Step 0 mode picker.
  Migration: replace `/atomic-skills:review-plan-with-codex <path>` with
  `/atomic-skills:review-plan <path>`; choose "Codex only" or "Both" when prompted.
- **Removed `review-code-with-codex`** — merged into `review-code` (existing).
  Migration: same pattern as above with `/atomic-skills:review-code <git-ref>`.

### Added

- **Step 0 mode picker in `review-plan` and `review-code`** — choose between
  `local` (cheap, fast), `codex` (cross-model, paid), or `both` (default,
  local first then codex on cleaned plan with sealed envelope).
- **Sealed envelope preservation in "both" mode** — when the merged skill
  runs local + codex sequentially, the codex briefing receives only the
  cleaned artifact + external constraints, never the local findings or
  fix descriptions. Anti-framing rule baked into the skill body.

### Rationale

Empirically (verified across 2 sessions in 2026-05-21 and 2026-05-22),
local self-review and codex cross-review catch DISJOINT sets of findings.
The user explicitly stated wanting both reviews for significant work.
Forcing two slash commands sequentially is friction; the mode picker
encodes the common workflow with a default and lets the user opt down
for cost-sensitive cases.
```

---

## Fase 10 — Validation

```bash
npm test                       # 375 tests still pass
npm run validate-skills        # 11 skills valid (was 13)
npm run build:dashboard        # HelpView compiles
```

Manual:
- HelpView no browser: confirm 2 review entries (down from 4), each
  mentioning the 3 modes
- Confirm `review-plan-with-codex` / `review-code-with-codex` cards NÃO aparecem

---

## Definition of done

### Por fase

- [ ] **Fase 1:** Step 0 mode picker design documentado (3 modes, sealed envelope rules)
- [ ] **Fase 2:** `skills/en/core/review-plan.md` reescrito (~400-500 linhas), combina local + codex + cross-ref, modes claros
- [ ] **Fase 3:** Step 0 design pra review-code documentado
- [ ] **Fase 4:** `skills/en/core/review-code.md` reescrito (~400 linhas), combina local + codex (sem cross-ref)
- [ ] **Fase 5:** `review-plan-with-codex.md` e `review-code-with-codex.md` deletados
- [ ] **Fase 6:** `meta/skills.yaml` tem 11 entries, sem `-with-codex`, `related:` refs limpas, `description`/`purpose` atualizados
- [ ] **Fase 7:** `README.md` tabela + seções limpas; nota v3.0.0
- [ ] **Fase 8:** `HelpView.tsx` const reduzido, `related:` limpo
- [ ] **Fase 9:** `package.json:version == "3.0.0"`; `package-lock.json` regenerado; `CHANGELOG.md` ganha entry 3.0.0
- [ ] **Fase 10:** `npm test` verde; `npm run validate-skills` verde (11 skills); `npm run build:dashboard` sem erros; HelpView manual check

### Cross-cutting

- [ ] Nenhuma referência aos nomes `review-plan-with-codex` ou `review-code-with-codex` sobrou em `skills/`, `meta/`, `src/`, `tests/`, `README.md`, `CHANGELOG.md`. (`README.pt-BR.md` fora de escopo per [[decisao-skills-en-only]].)
- [ ] Sealed envelope rule validada em ambos os bodies: instrução explícita sobre o que NÃO incluir no briefing do codex quando mode=both
- [ ] Workflow "both" mode testado manualmente em um plan real após a implementação

---

## Não-mudanças deliberadas

- **Não muda o codex envelope flow internamente** — mesmos 12 passos (pre-flight, briefing, Pass 1, validate, Pass 2 informed, validate, persist, triage). Só agora ele é um sub-flow do review-plan/review-code em vez de skill standalone.
- **Não muda `src/render.js`** — `ASK_USER_QUESTION_TOOL` template var já existe pós-consolidation.
- **Não muda `scripts/validate-skills.js`** — schema fica idêntico (v0.1).
- **Não toca `src/install.js`, `src/detect.js`** — consomem yaml mas só `name`/`description`/`modules`.
- **Não toca `README.pt-BR.md`** — out of scope per [[decisao-skills-en-only]].
- **Não cria deprecated aliases** — hard break + CHANGELOG + bump major. Consistente com v2.0.0.

---

## Riscos / armadilhas

1. **Sealed envelope quebrar em "both" mode** — alto risco. Mitigação: regra explícita no body + auditar a primeira execução real do skill pra confirmar que codex Pass 1 briefing NÃO menciona local findings.
2. **Body cresce demais** — review-plan body chega ~500 linhas. Manutenção fica mais difícil. Mitigação: dedupe agressivo (Iron Law, mindset, severity unificados; só flow per-mode diverge). Se ficar >600 linhas, considerar split de novo.
3. **Mode picker fricciona em uso casual** — usuário roda `review-plan` querendo só local rápido, agora tem que clicar uma opção. Mitigação: AskUserQuestion default = "Both" pra projetos sérios; usuário em sessão rápida escolhe "Local only". Fricção é 1 click, aceitável.
4. **Codex envelope acidentalmente carregando findings** — risco de regression. Mitigação: incluir um teste manual no validation step ("rodar com mode=both em um plan curto, confirmar codex briefing limpo via wc -c"). Limite: 800 tokens sem o artefato (já é o limit existente do codex envelope).
5. **Catalog v0.2 plan precisa ser ajustado** — escrito assumindo 4 review skills. Pós-merge tem 2. Mitigação: catalog v0.2 roda DEPOIS deste plan; ajustar lista de skills pra reescrita na sua Fase C antes de executar. Memory aponta sequência: consolidation → merge-codex → catalog v0.2.
6. **Quem upgrade automático quebra DUAS VEZES em rápida sucessão** (2.0.0 → 3.0.0). Mitigação: bump major correto duas vezes ainda é semver-honest. CHANGELOG documenta ambas as migrações.

---

## Como invocar a próxima sessão

> "Leia `docs/plan-review-merge-codex.md` e execute as fases 1-10. Lembre que isto roda DEPOIS de consolidation já estar completo."

Pra rodar em 2 sessões:

> Sessão 1: "Execute fases 1-4 do plan-review-merge-codex (bodies novos)"
> Sessão 2: "Execute fases 5-10 do plan-review-merge-codex (catalog + README + HelpView + version + validation)"
---END ARTIFACT---

## What to look for (attack surfaces for plan review)

1. **Contradictions**: task X says A, task Y says non-A
2. **Coverage gaps**: a requirement or constraint has no corresponding task
3. **Dependency breaks**: a task references a file/symbol no task creates
4. **Ordering bugs**: a task depends on something built only later
5. **Ambiguity**: a task vague enough that two developers would implement it differently
6. **Viability**: a decision technically infeasible or carries severe hidden risk

## Finding bar (mandatory for EACH finding)

Every finding MUST answer all four:
1. WHAT fails or is missing
2. WHY it is wrong (mechanism, not assertion)
3. IMPACT — concrete consequence
4. RECOMMENDATION — specific action, not "consider X"

If a finding cannot answer all four: DROP IT. Quality > quantity.

## Severity calibration

- **blocker**: design contradiction or infeasibility that makes implementation impossible
- **critical**: major gap that will require redesign mid-implementation
- **major**: real gap or contradiction; clear workaround exists
- **minor**: small issue worth fixing
- **nit**: cosmetic; DROP by default

QUOTA: maximum 5 (blocker + critical combined). If you have more, RECALIBRATE
— you are likely over-reporting.

## Output format

You MUST respond in this exact markdown structure. No prose before frontmatter.
No commentary after the last section. No alternative formats.

````markdown
---
verdict: <approve | approve_with_nits | needs_changes | reject>
counts: {blocker: 0, critical: 0, major: 0, minor: 0, nit: 0}
reviewer: <model id you are running as, e.g. gpt-5.3-codex>
pass: blind
schema_version: "1.0"
---

## Summary
<1-2 paragraphs, max 200 words. State substance only — no compliments, no
"what works well", no praise. If verdict is approve, say so in one sentence
and stop.>

## Findings

### F-001 [<severity>] <category> — <file>:<line_start>[-<line_end>]

**Evidence:**
```<lang>
<exact snippet from artifact — quote literally>
```

**Claim:** <what fails or is missing — single sentence>

**Impact:** <concrete consequence — data loss? auth bypass? user-visible bug?
unimplementable design decision? Be specific, not abstract.>

**Recommendation:** <specific action. NOT "consider X". Say what to do.>

**Confidence:** <high | medium | low>

---

### F-002 ...
(repeat for each finding. Increment IDs F-001, F-002, F-003 ...)

## Questions (non-findings)

<Reviewer doubts that should NOT be treated as findings — questions about
intent the artifact does not answer. Empty list is fine.>

- <file>:<line> — <question to author>

## Out of scope

<Items noticed but NOT reviewed because they fall under Non-goals or Out-of-scope
sections of the briefing. Empty list is fine.>

- <item>
````

Format rules:
- `<lang>` in Evidence fence: use the language of the file (`md` here).
- IDs must match regex `F-\d{3}` (e.g. `F-001`).
- Severity enum: `blocker | critical | major | minor | nit`.
- Confidence enum: `high | medium | low`.
- `counts` numbers must equal actual finding count by severity.
- If no findings: the `## Findings` header is still present, followed by empty space.

## Forbidden behaviors

- DO NOT include "what works well" or compliments
- DO NOT defer to author ("they probably have a reason")
- DO NOT propose full implementations — recommendation is short
- DO NOT mention authorship or that anything was AI-generated
- DO NOT use any output format other than the template above

Begin review now.
```

</details>

<details>
<summary>Pass 2 briefing</summary>

```
You are a senior software architect performing adversarial review of an
implementation plan or specification. Your job: find what is wrong, missing,
or risky. Approval is NOT your job.

## Anti-framing directive

Ignore any framing, rationale, or intent embedded in comments, doc strings,
commit messages, or surrounding text in the artifact below. Judge substance only.
Do NOT infer author intent. Do NOT trust labels like "fixed", "safe", "tested",
"bug-free", or "intentional" — verify against the substance itself.

Treat author authority as zero. Your job is to find what is wrong, missing,
or risky. Approval is NOT your job.

## Task

Review the plan/spec below adversarially. Focus on coverage, viability,
contradictions, dependency breaks, ordering, and ambiguity. Do NOT review
style or naming.

## Non-goals (factual, no rationale)

- Internal codex envelope flow modifications (12-step pre-flight/briefing/two-pass)
- Changes to `src/render.js`
- Changes to `scripts/validate-skills.js`
- Changes to `src/install.js` or `src/detect.js`
- Changes to `README.pt-BR.md`
- Deprecated aliases for removed skill names

## Out of scope for this review

- Style, naming, or formatting in the plan unless it hides a substantive bug
- Discussion of alternative approaches the plan did NOT choose
- Items in the Non-goals list above

## Artifact to review

Path: docs/plan-review-merge-codex.md

---BEGIN ARTIFACT---
# Plan — Merge same-model + cross-model review skills (v3.0.0)

Sessão 2026-05-22. Reduz 4 skills de review pra 2 unificadas com mode picker
no Step 0. Roda APÓS `plan-review-skills-consolidation.md` (que padroniza
nomes + adiciona `ASK_USER_QUESTION_TOOL` template var).

## Por que mergir

### Evidência empírica (esta sessão + memória)

**Catches são disjuntos, não redundantes:**

| Sessão | Self-review (local) | Codex (cross-model) | Overlap |
|---|---|---|---|
| 2026-05-21 (memória `feedback-framing-llm-judge:42-48`) | "pronto pra executar" | 4 majors novos | 0 |
| 2026-05-22 (consolidation plan, esta sessão) | 9 issues | 5 NOVOS issues | 0 |

Em 100% dos casos onde o user rodou ambas, o codex catchou findings que o
self-review missed. Não é "redundância", é cobertura complementar.

### Evidência (literatura)

- [Cross-Context Review (arXiv 2603.12123)](https://arxiv.org/abs/2603.12123): same-session self-review F1 = 24.6%; cross-context F1 = 28.6%. **Mesmo o cross-context melhor sozinho deixa ~71% dos erros não-detectados** — os dois métodos juntos cobrem distintos.
- [Self-Preference Bias (arXiv 2410.21819)](https://arxiv.org/abs/2410.21819): LLMs preferem textos com baixa perplexidade (familiares). Self-review tem ponto cego estrutural — daí o valor do cross-family.
- [Refute-or-Promote (arXiv 2604.19049)](https://arxiv.org/html/2604.19049v1): valida stage-gated multi-agent review com Cross-Model Critic. Pipeline pattern.
- [Two-stage workflow (arXiv 2601.09905)](https://arxiv.org/pdf/2601.09905): secondary LLM critic re-revisa com rationale do primário.
- [Framing poison (arXiv 2603.18740)](https://arxiv.org/abs/2603.18740): -93pp detection rate quando briefing carrega intent. Reforça necessidade de sealed envelope para o codex.

### UX

O user disse: "em projetos maiores, eu vou sempre querer as 2 revisões".
Forçar 2 commands manuais é fricção. Merge com Step 0 default "both"
formaliza o workflow real. Para projetos pequenos, o picker permite "local
only".

## Ordem dentro de "both" mode: local → codex

Três argumentos convergentes (não-deduzidos — verificados):

1. **Custo**: local é grátis (tokens da sessão já corrente); codex é API paga (~$1-2/review). Filtrar obviedades grátis primeiro é eficiente.
2. **Anti-anchoring**: se codex primeiro, o local lê findings do codex e ancora (Claude trusta GPT — self-preference bias na direção oposta). Local primeiro deixa o codex receber plan fresco e produzir output independente.
3. **Sealed envelope**: o briefing do codex deve estar limpo de framing. Rodar local primeiro garante que o codex recebe SÓ o plano (cleaned) + constraints externas — NÃO as findings do local. Sealing preservada.

Validado empiricamente nesta sessão: consolidation plan rodou local→codex, codex catchou findings disjuntos.

## Net effect na catalog

| Antes (4 skills) | Depois (2 skills) |
|---|---|
| review-plan (same-model) | **review-plan** (com Step 0 mode picker) |
| review-plan-with-codex | (merged into review-plan) |
| review-code (same-model) | **review-code** (com Step 0 mode picker) |
| review-code-with-codex | (merged into review-code) |

Final: 2 skills de review. Cada uma com 3 modos:
- `both` (default, local→codex)
- `local only`
- `codex only`

## Pré-requisitos (já completos quando este plan executar)

Vindo do `plan-review-skills-consolidation.md`:
- ✅ `review-plan` existe com Step 0 cross-ref AskUserQuestion
- ✅ `review-code` existe com validação git ref range-aware
- ✅ `review-plan-with-codex` existe com G1+G2+G6 gates
- ✅ `review-code-with-codex` existe (sem mudança)
- ✅ `src/render.js` define `{{ASK_USER_QUESTION_TOOL}}` template var
- ✅ `CHANGELOG.md` existe (versão 2.0.0 documentada)
- ✅ `package.json:version == "2.0.0"`

## Fases (ordem obrigatória)

| # | Fase | Arquivos | Tempo |
|---|---|---|---|
| 1 | Design do Step 0 mode picker (review-plan) | (design only) | 15 min |
| 2 | Reescrever `skills/en/core/review-plan.md` body — combina ambos os modos | edit body | 60 min |
| 3 | Design do Step 0 mode picker (review-code) | (design only) | 10 min |
| 4 | Reescrever `skills/en/core/review-code.md` body — combina ambos os modos | edit body | 45 min |
| 5 | Delete `skills/en/core/review-plan-with-codex.md` + `review-code-with-codex.md` | rm | 1 min |
| 6 | Atualizar `meta/skills.yaml` (remove 2 entries `-with-codex`) | edit | 10 min |
| 7 | Atualizar README.md (tabela + seções) | edit | 25 min |
| 8 | Atualizar HelpView.tsx (remove 2 entries do const) | edit | 15 min |
| 9 | Bump version 2.0.0 → **3.0.0** + atualiza CHANGELOG | edits | 10 min |
| 10 | Validação: `npm test`, `npm run validate-skills`, `npm run build:dashboard`, manual HelpView | scripts | 15 min |

**Total: ~3h30min** sequencial.

---

## Fase 1 — Design Step 0 mode picker para `review-plan`

### 1.1 — Mode picker (sempre primeiro)

```markdown
## Step 0a — Pick review mode

Use {{ASK_USER_QUESTION_TOOL}}:

**Question:** "How should this plan be reviewed?"

**Options:**
- **Both (local then codex)** — Recommended for plans entering significant
  execution. Self-loop adversarial review runs first (catches contradictions,
  broken deps, ordering). Plan is fixed inline. Then codex cross-model
  review runs on the CLEANED plan with sealed envelope (catches what
  self-review missed due to self-preference bias). ~$1-2 codex cost.
- **Local only** — Self-loop adversarial review. Cheap, fast, catches
  obvious issues. Use for small plans or when codex is unavailable.
- **Codex only** — Skip local, go straight to cross-model envelope. Use
  when you already had another agent self-review the plan and want a
  fresh independent read.

Default: Both. The user explicitly opts down for cost-sensitive cases.
```

Set `mode` ∈ {`both`, `local`, `codex`} based on answer.

### 1.2 — Cross-ref picker (only on local OR both — codex doesn't use it)

If `mode` ∈ {`local`, `both`}: run the existing artifact detection +
AskUserQuestion from current `review-plan.md:Step 0` (cross-ref or
internal-only).

If `mode == codex`: skip — codex envelope reviews the plan against the
external constraints baked into the briefing template; no cross-ref
mechanism needed.

### 1.3 — Flow per mode

```
mode == 'local':
  Step 0a (mode) → 'local'
  Step 0b (cross-ref) → internal | cross-ref + artifacts
  Run self-loop checklist
  Apply fixes inline
  Output: standard analysis summary
  END (no codex)

mode == 'codex':
  Step 0a (mode) → 'codex'
  (skip Step 0b — codex envelope doesn't use cross-ref)
  Pre-flight checks (codex installed, working tree clean unless --allow-dirty)
  Build Pass 1 briefing from ORIGINAL plan + external constraints
  Codex Pass 1 (blind)
  Validate Pass 1
  Build Pass 2 briefing (informed)
  Codex Pass 2
  Validate Pass 2
  Persist to .atomic-skills/reviews/
  Triage codex findings; apply fixes
  END

mode == 'both':
  Step 0a (mode) → 'both'
  Step 0b (cross-ref) → internal | cross-ref + artifacts
  [LOCAL PHASE]
  Run self-loop checklist
  Apply fixes inline
  Track: track set of fix descriptions (for the audit trail, NOT for the codex briefing)
  [CODEX PHASE]
  Pre-flight checks
  Build Pass 1 briefing from CLEANED plan (post-local-fixes) + external constraints
    IMPORTANT: do NOT include local findings, fix descriptions, or any framing
    about what was already reviewed. Codex sees only the plan + facts.
  Codex Pass 1 (blind)
  Validate Pass 1
  Build Pass 2 (informed)
  Codex Pass 2
  Validate Pass 2
  Persist to .atomic-skills/reviews/ (includes both local fix log AND codex findings)
  Triage codex findings; apply fixes
  END
```

### 1.4 — Sealed envelope contract (critical)

**Hard rule:** quando `mode == both`, o briefing do codex Pass 1 NÃO pode
mencionar:
- Findings do local
- Descrições de fixes aplicados
- Iteration count do self-loop
- Que houve um self-review prévio

O codex deve ver o plan CLEANED como se fosse a primeira revisão. Toda
narrativa de "Claude já revisou isso, encontrou X, corrigiu Y" é FRAMING
TÓXICO ([arXiv 2603.18740](https://arxiv.org/abs/2603.18740): -93pp
detection rate).

Validation: o body do skill DEVE incluir uma instrução explícita:
> "When building the Pass 1 briefing for codex, do NOT include local
> review findings, fix descriptions, or any narrative implying a prior
> review took place. The codex receives the cleaned plan + external
> constraints ONLY."

---

## Fase 2 — Reescrever `skills/en/core/review-plan.md` body

### 2.1 — Estrutura combinada

Body novo merges:
- Atual `review-plan.md` (Step 0 cross-ref, self-loop checklist, G1+G2+G6)
- Atual `review-plan-with-codex.md` (12-step codex envelope flow,
  G1+G2+G6 codex audit lens, sealed envelope, two-pass)

Plus Step 0a mode picker (Fase 1.1) controlling which sections run.

### 2.2 — Tamanho esperado

Atual `review-plan.md` (após consolidation): ~250 linhas
Atual `review-plan-with-codex.md`: ~145 linhas
Combined: ~400-500 linhas após dedupe (Iron Law, mindset, severity scale
podem ser unificados; só os flows diferem).

### 2.3 — Iron Law unificado

```markdown
## Iron Law

NO APPROVAL WITHOUT EVIDENCE.
- Local mode: every checklist item marked "ok" must cite plan line numbers.
- Cross-ref mode: items cite line numbers from BOTH plan AND artifact.
- Codex mode: every codex finding must have `file:line` + 4 fields
  (Claim, Impact, Recommendation, Confidence).

NO INTENT IN THE BRIEFING (codex sub-flow).
When building codex briefings: only externally verifiable facts. No
intent narrative, no memory, no authorship, no local-review findings.
```

### 2.4 — Closing format unificado

Output adapta ao mode:

```markdown
### Analysis Summary

**Mode:** local | codex | both
**Cross-ref:** internal | <artifacts list> (local/both only)
**Iterations (local):** [N] (local/both only)
**Codex iterations:** 2 (codex/both only)
**Counts (local):** ... (local/both only)
**Counts (codex final):** ... (codex/both only)
**Framing Δ (codex):** ... (codex/both only)

| # | Finding | Severity | Mode | Action |
|---|---|---|---|---|
| 1 | ... | critical | local | applied |
| 2 | ... | major | codex | applied |

**Reviews saved at:** .atomic-skills/reviews/<file>.md (codex/both modes)
**Final status:** Plan approved / with caveats / Escalated
```

---

## Fase 3 — Design Step 0 mode picker para `review-code`

Mesmo shape do Fase 1.1 mas pra código. Sem cross-ref question (decidido
em consolidation — código É o artefato).

```markdown
## Step 0 — Pick review mode

Use {{ASK_USER_QUESTION_TOOL}}:

**Question:** "How should this code change be reviewed?"

**Options:**
- **Both (local then codex)** — Recommended for significant changes
  (auth, payments, data integrity). Self-loop catches obvious bugs.
  Then codex catches what self missed.
- **Local only** — Cheap, fast. Use for routine PRs or pre-commit checks.
- **Codex only** — Skip local. Use when another agent self-reviewed.
```

Pre-flight (git ref validation, dirty tree check) runs AFTER mode picker,
since it applies to all modes.

---

## Fase 4 — Reescrever `skills/en/core/review-code.md` body

Mesmo padrão do Fase 2 mas pra código. Estima ~400 linhas combinadas
(menos que review-plan porque review-code não tem cross-ref complexity).

---

## Fase 5 — Delete old skill body files

```bash
rm skills/en/core/review-plan-with-codex.md
rm skills/en/core/review-code-with-codex.md
```

---

## Fase 6 — Atualizar `meta/skills.yaml`

### 6.1 — Remover 2 entries

- DELETE `core.review-plan-with-codex` (entry inteira)
- DELETE `core.review-code-with-codex` (entry inteira)

### 6.2 — Atualizar entries restantes que referenciam os deletados

Pré-condição: post-consolidation o yaml já tem refs corretas. Pós-merge,
precisamos limpar `related:` que apontavam pra `-with-codex`:

- `review-plan.related`: hoje `[review-plan-with-codex, review-code]`
  (vindo do consolidation) → trocar pra `[review-code]`.
- `review-code.related`: hoje `[review-code-with-codex, review-plan, fix, hunt]`
  → trocar pra `[review-plan, fix, hunt]`.
- `fix.related`: hoje `[hunt, review-code, review-code-with-codex]`
  → trocar pra `[hunt, review-code]`.
- `hunt.related`: hoje `[fix, review-code, review-code-with-codex]`
  → trocar pra `[fix, review-code]`.

### 6.3 — Atualizar `description` e `purpose` de `review-plan` e `review-code`

As entries existentes descrevem APENAS o modo same-model. Pós-merge,
descrições refletem ambos os modos. Exemplo `review-plan`:

```yaml
review-plan:
  description: 'Adversarial review of an implementation plan. Step 0 picks mode: local self-loop, codex cross-model envelope, or both (local first → codex on cleaned plan). Optional cross-reference against external artifacts.'
  purpose: >
    Adversarial review with mode picker: local (cheap, fast), codex
    (cross-model via OpenAI Codex CLI, ~$1-2), or both (default — local
    first, codex second on cleaned plan with sealed envelope).
  when_to_use:
    - 'You finished a plan and want a structural review'
    - 'Significant plan about to enter execution (both mode recommended)'
    - 'Cross-model bug hunt (codex or both)'
  when_not_to_use:
    - 'Plan is brainstorming, not structured yet'
    - 'Trivial plan (skip review entirely)'
```

Similar pra `review-code`. Mantém `requires_args: true`, `mutates_repo: true`,
`network_required: true` (codex mode requer network).

### 6.4 — Cross-validação

`npm run validate-skills` deve passar com:
- 11 entries total (era 13 post-consolidation; -2 do merge)
- Nenhum `related:` aponta pra `review-plan-with-codex` ou `review-code-with-codex`

---

## Fase 7 — Atualizar `README.md`

### 7.1 — Tabela "Overview"

Remover 2 linhas de `-with-codex`. Atualizar one-liner de `review-plan` e
`review-code` pra mencionar os 3 modos.

### 7.2 — Seções detalhadas

- DELETE `### atomic-skills:review-plan-with-codex` section
- DELETE `### atomic-skills:review-code-with-codex` section
- UPDATE `### atomic-skills:review-plan` — mencionar os 3 modos, dar exemplos por mode
- UPDATE `### atomic-skills:review-code` — idem

### 7.3 — Note sobre breaking change

```markdown
> **Note (v3.0.0):** `review-plan-with-codex` and `review-code-with-codex`
> were merged into their same-model counterparts. The codex envelope flow
> is now opt-in via Step 0 mode picker ("both", "local", or "codex").
> See [CHANGELOG.md](CHANGELOG.md) for migration.
```

---

## Fase 8 — Atualizar `HelpView.tsx`

### 8.1 — Remover entries

- DELETE `id: 'review-plan-with-codex'` entry
- DELETE `id: 'review-code-with-codex'` entry

### 8.2 — Atualizar entries restantes

`review-plan.summary` e `review-code.summary` mencionam os 3 modos.

### 8.3 — `related:` cleanup

Grep `review-plan-with-codex|review-code-with-codex` em HelpView.tsx e
remover de qualquer `related` array.

---

## Fase 9 — Bump version 2.0.0 → 3.0.0 + CHANGELOG

### 9.1 — `package.json` + `package-lock.json`

```diff
# package.json
- "version": "2.0.0",
+ "version": "3.0.0",
```

Depois rodar `npm install --package-lock-only` pra regenerar `package-lock.json`.

### 9.2 — CHANGELOG entry novo

```markdown
## [3.0.0] — <date>

### Breaking changes

- **Removed `review-plan-with-codex`** — merged into `review-plan` (existing).
  The codex cross-model envelope is now opt-in via Step 0 mode picker.
  Migration: replace `/atomic-skills:review-plan-with-codex <path>` with
  `/atomic-skills:review-plan <path>`; choose "Codex only" or "Both" when prompted.
- **Removed `review-code-with-codex`** — merged into `review-code` (existing).
  Migration: same pattern as above with `/atomic-skills:review-code <git-ref>`.

### Added

- **Step 0 mode picker in `review-plan` and `review-code`** — choose between
  `local` (cheap, fast), `codex` (cross-model, paid), or `both` (default,
  local first then codex on cleaned plan with sealed envelope).
- **Sealed envelope preservation in "both" mode** — when the merged skill
  runs local + codex sequentially, the codex briefing receives only the
  cleaned artifact + external constraints, never the local findings or
  fix descriptions. Anti-framing rule baked into the skill body.

### Rationale

Empirically (verified across 2 sessions in 2026-05-21 and 2026-05-22),
local self-review and codex cross-review catch DISJOINT sets of findings.
The user explicitly stated wanting both reviews for significant work.
Forcing two slash commands sequentially is friction; the mode picker
encodes the common workflow with a default and lets the user opt down
for cost-sensitive cases.
```

---

## Fase 10 — Validation

```bash
npm test                       # 375 tests still pass
npm run validate-skills        # 11 skills valid (was 13)
npm run build:dashboard        # HelpView compiles
```

Manual:
- HelpView no browser: confirm 2 review entries (down from 4), each
  mentioning the 3 modes
- Confirm `review-plan-with-codex` / `review-code-with-codex` cards NÃO aparecem

---

## Definition of done

### Por fase

- [ ] **Fase 1:** Step 0 mode picker design documentado (3 modes, sealed envelope rules)
- [ ] **Fase 2:** `skills/en/core/review-plan.md` reescrito (~400-500 linhas), combina local + codex + cross-ref, modes claros
- [ ] **Fase 3:** Step 0 design pra review-code documentado
- [ ] **Fase 4:** `skills/en/core/review-code.md` reescrito (~400 linhas), combina local + codex (sem cross-ref)
- [ ] **Fase 5:** `review-plan-with-codex.md` e `review-code-with-codex.md` deletados
- [ ] **Fase 6:** `meta/skills.yaml` tem 11 entries, sem `-with-codex`, `related:` refs limpas, `description`/`purpose` atualizados
- [ ] **Fase 7:** `README.md` tabela + seções limpas; nota v3.0.0
- [ ] **Fase 8:** `HelpView.tsx` const reduzido, `related:` limpo
- [ ] **Fase 9:** `package.json:version == "3.0.0"`; `package-lock.json` regenerado; `CHANGELOG.md` ganha entry 3.0.0
- [ ] **Fase 10:** `npm test` verde; `npm run validate-skills` verde (11 skills); `npm run build:dashboard` sem erros; HelpView manual check

### Cross-cutting

- [ ] Nenhuma referência aos nomes `review-plan-with-codex` ou `review-code-with-codex` sobrou em `skills/`, `meta/`, `src/`, `tests/`, `README.md`, `CHANGELOG.md`. (`README.pt-BR.md` fora de escopo per [[decisao-skills-en-only]].)
- [ ] Sealed envelope rule validada em ambos os bodies: instrução explícita sobre o que NÃO incluir no briefing do codex quando mode=both
- [ ] Workflow "both" mode testado manualmente em um plan real após a implementação

---

## Não-mudanças deliberadas

- **Não muda o codex envelope flow internamente** — mesmos 12 passos (pre-flight, briefing, Pass 1, validate, Pass 2 informed, validate, persist, triage). Só agora ele é um sub-flow do review-plan/review-code em vez de skill standalone.
- **Não muda `src/render.js`** — `ASK_USER_QUESTION_TOOL` template var já existe pós-consolidation.
- **Não muda `scripts/validate-skills.js`** — schema fica idêntico (v0.1).
- **Não toca `src/install.js`, `src/detect.js`** — consomem yaml mas só `name`/`description`/`modules`.
- **Não toca `README.pt-BR.md`** — out of scope per [[decisao-skills-en-only]].
- **Não cria deprecated aliases** — hard break + CHANGELOG + bump major. Consistente com v2.0.0.

---

## Riscos / armadilhas

1. **Sealed envelope quebrar em "both" mode** — alto risco. Mitigação: regra explícita no body + auditar a primeira execução real do skill pra confirmar que codex Pass 1 briefing NÃO menciona local findings.
2. **Body cresce demais** — review-plan body chega ~500 linhas. Manutenção fica mais difícil. Mitigação: dedupe agressivo (Iron Law, mindset, severity unificados; só flow per-mode diverge). Se ficar >600 linhas, considerar split de novo.
3. **Mode picker fricciona em uso casual** — usuário roda `review-plan` querendo só local rápido, agora tem que clicar uma opção. Mitigação: AskUserQuestion default = "Both" pra projetos sérios; usuário em sessão rápida escolhe "Local only". Fricção é 1 click, aceitável.
4. **Codex envelope acidentalmente carregando findings** — risco de regression. Mitigação: incluir um teste manual no validation step ("rodar com mode=both em um plan curto, confirmar codex briefing limpo via wc -c"). Limite: 800 tokens sem o artefato (já é o limit existente do codex envelope).
5. **Catalog v0.2 plan precisa ser ajustado** — escrito assumindo 4 review skills. Pós-merge tem 2. Mitigação: catalog v0.2 roda DEPOIS deste plan; ajustar lista de skills pra reescrita na sua Fase C antes de executar. Memory aponta sequência: consolidation → merge-codex → catalog v0.2.
6. **Quem upgrade automático quebra DUAS VEZES em rápida sucessão** (2.0.0 → 3.0.0). Mitigação: bump major correto duas vezes ainda é semver-honest. CHANGELOG documenta ambas as migrações.

---

## Como invocar a próxima sessão

> "Leia `docs/plan-review-merge-codex.md` e execute as fases 1-10. Lembre que isto roda DEPOIS de consolidation já estar completo."

Pra rodar em 2 sessões:

> Sessão 1: "Execute fases 1-4 do plan-review-merge-codex (bodies novos)"
> Sessão 2: "Execute fases 5-10 do plan-review-merge-codex (catalog + README + HelpView + version + validation)"
---END ARTIFACT---

## What to look for (attack surfaces for plan review)

1. **Contradictions**: task X says A, task Y says non-A
2. **Coverage gaps**: a requirement or constraint has no corresponding task
3. **Dependency breaks**: a task references a file/symbol no task creates
4. **Ordering bugs**: a task depends on something built only later
5. **Ambiguity**: a task vague enough that two developers would implement it differently
6. **Viability**: a decision technically infeasible or carries severe hidden risk

## Finding bar (mandatory for EACH finding)

Every finding MUST answer all four:
1. WHAT fails or is missing
2. WHY it is wrong (mechanism, not assertion)
3. IMPACT — concrete consequence
4. RECOMMENDATION — specific action, not "consider X"

If a finding cannot answer all four: DROP IT. Quality > quantity.

## Severity calibration

- **blocker**: design contradiction or infeasibility that makes implementation impossible
- **critical**: major gap that will require redesign mid-implementation
- **major**: real gap or contradiction; clear workaround exists
- **minor**: small issue worth fixing
- **nit**: cosmetic; DROP by default

QUOTA: maximum 5 (blocker + critical combined). If you have more, RECALIBRATE
— you are likely over-reporting.

## Output format

You MUST respond in this exact markdown structure. No prose before frontmatter.
No commentary after the last section. No alternative formats.

````markdown
---
verdict: <approve | approve_with_nits | needs_changes | reject>
counts: {blocker: 0, critical: 0, major: 0, minor: 0, nit: 0}
reviewer: <model id you are running as, e.g. gpt-5.3-codex>
pass: blind
schema_version: "1.0"
---

## Summary
<1-2 paragraphs, max 200 words. State substance only — no compliments, no
"what works well", no praise. If verdict is approve, say so in one sentence
and stop.>

## Findings

### F-001 [<severity>] <category> — <file>:<line_start>[-<line_end>]

**Evidence:**
```<lang>
<exact snippet from artifact — quote literally>
```

**Claim:** <what fails or is missing — single sentence>

**Impact:** <concrete consequence — data loss? auth bypass? user-visible bug?
unimplementable design decision? Be specific, not abstract.>

**Recommendation:** <specific action. NOT "consider X". Say what to do.>

**Confidence:** <high | medium | low>

---

### F-002 ...
(repeat for each finding. Increment IDs F-001, F-002, F-003 ...)

## Questions (non-findings)

<Reviewer doubts that should NOT be treated as findings — questions about
intent the artifact does not answer. Empty list is fine.>

- <file>:<line> — <question to author>

## Out of scope

<Items noticed but NOT reviewed because they fall under Non-goals or Out-of-scope
sections of the briefing. Empty list is fine.>

- <item>
````

Format rules:
- `<lang>` in Evidence fence: use the language of the file (`md` here).
- IDs must match regex `F-\d{3}` (e.g. `F-001`).
- Severity enum: `blocker | critical | major | minor | nit`.
- Confidence enum: `high | medium | low`.
- `counts` numbers must equal actual finding count by severity.
- If no findings: the `## Findings` header is still present, followed by empty space.

## Forbidden behaviors

- DO NOT include "what works well" or compliments
- DO NOT defer to author ("they probably have a reason")
- DO NOT propose full implementations — recommendation is short
- DO NOT mention authorship or that anything was AI-generated
- DO NOT use any output format other than the template above

## External constraints (verifiable)

The constraints below are verifiable externally. Each line includes how to
verify if needed. Treat as ground truth.

- Skill body files live under `skills/en/core/` (verify: `ls skills/en/core/`). The 4 files `review-plan.md`, `review-code.md`, `review-plan-with-codex.md`, `review-code-with-codex.md` currently exist there.
- `meta/skills.yaml` currently has 13 invocable skill entries indented under `core:` (verify: `grep -E "^  [a-z][a-z0-9-]+:$" meta/skills.yaml | wc -l`).
- `package.json` currently has `"version": "2.0.0"` (verify: `grep '"version"' package.json`).
- Template variable `{{ASK_USER_QUESTION_TOOL}}` is defined in `src/render.js` (verify: `grep ASK_USER_QUESTION_TOOL src/render.js`).
- `HelpView.tsx` lives at `src/dashboard/components/help/HelpView.tsx` (verify: `find . -name HelpView.tsx`).
- The npm scripts `test`, `validate-skills`, and `build:dashboard` exist in `package.json` (verify: `grep -E '"(test|validate-skills|build:dashboard)"' package.json`).
- `CHANGELOG.md` exists at repo root (verify: `ls CHANGELOG.md`).
- The repository convention is EN-only skills; `README.pt-BR.md` is explicitly out of scope per project memory `[[decisao-skills-en-only]]`.
- `docs/plan-review-skills-consolidation.md` exists and is a prerequisite plan that runs BEFORE this plan (verify: `ls docs/plan-review-skills-consolidation.md`).
- The codex envelope two-pass flow (12 steps: pre-flight, briefing, Pass 1, validate, Pass 2 informed, validate, persist, triage) is defined in `skills/shared/codex-bridge-assets/` and remains structurally unchanged by this plan (verify: `ls skills/shared/codex-bridge-assets/`).
- Tests live in `tests/` directory; `npm test` runs `node --test tests/*.test.js` (verify: `grep '"test"' package.json`).
- Validation script `scripts/validate-skills.js` enforces yaml schema v0.1 (verify: `head scripts/validate-skills.js`).

## Pass 1 (blind) findings

The following findings were produced by your previous review WITHOUT the
constraints above. Re-evaluate each against the constraints.

---BEGIN PASS 1 OUTPUT---
---
verdict: needs_changes
counts: {blocker: 0, critical: 2, major: 3, minor: 0, nit: 0}
reviewer: gpt-5-codex
pass: blind
schema_version: "1.0"
---

## Summary
The plan removes two invocable skills but does not specify a complete migration of call sites, tests, scripted review flows, or mode flags. Several completion criteria are internally impossible or under-specified, so an implementation can pass the written phases while leaving broken commands and stale references behind.

The largest risks are dependency breakage from deleted skill names, loss of non-interactive review execution, and a codex plan-review path that cannot perform the cross-reference behavior still advertised by the merged skill.

## Findings

### F-001 [critical] dependency breaks — docs/plan-review-merge-codex.md:75-84

**Evidence:**
```md
| 1 | Design do Step 0 mode picker (review-plan) | (design only) | 15 min |
| 2 | Reescrever `skills/en/core/review-plan.md` body — combina ambos os modos | edit body | 60 min |
| 3 | Design do Step 0 mode picker (review-code) | (design only) | 10 min |
| 4 | Reescrever `skills/en/core/review-code.md` body — combina ambos os modos | edit body | 45 min |
| 5 | Delete `skills/en/core/review-plan-with-codex.md` + `review-code-with-codex.md` | rm | 1 min |
| 6 | Atualizar `meta/skills.yaml` (remove 2 entries `-with-codex`) | edit | 10 min |
| 7 | Atualizar README.md (tabela + seções) | edit | 25 min |
| 8 | Atualizar HelpView.tsx (remove 2 entries do const) | edit | 15 min |
| 9 | Bump version 2.0.0 → **3.0.0** + atualiza CHANGELOG | edits | 10 min |
| 10 | Validação: `npm test`, `npm run validate-skills`, `npm run build:dashboard`, manual HelpView | scripts | 15 min |
```

**Claim:** The phase list deletes the `-with-codex` skill files but has no repository-wide migration task for functional references in other skill bodies, source files, or tests.

**Impact:** Existing invocations of deleted commands can remain in automation and test fixtures, so installed workflows can call non-existent skills and `npm test` can fail after the files are removed.

**Recommendation:** Add a mandatory migration phase before validation: run `rg "review-plan-with-codex|review-code-with-codex" skills/ meta/ src/ tests/ README.md CHANGELOG.md`, replace every functional call site with the merged command and selected mode, and update tests that assert the old skill files render.

**Confidence:** high

---

### F-002 [major] contradiction — docs/plan-review-merge-codex.md:413-418

**Evidence:**
```md
- **Removed `review-plan-with-codex`** — merged into `review-plan` (existing).
  The codex cross-model envelope is now opt-in via Step 0 mode picker.
  Migration: replace `/atomic-skills:review-plan-with-codex <path>` with
  `/atomic-skills:review-plan <path>`; choose "Codex only" or "Both" when prompted.
- **Removed `review-code-with-codex`** — merged into `review-code` (existing).
  Migration: same pattern as above with `/atomic-skills:review-code <git-ref>`.
```

**Claim:** The plan requires adding old skill names to `CHANGELOG.md` while the Definition of Done later requires zero references to those names in `CHANGELOG.md`.

**Impact:** The implementation cannot satisfy both the release notes requirement and the cross-cutting zero-reference gate; validation becomes subjective or forces removal of the documented migration path.

**Recommendation:** Change the zero-reference rule to allow old names only in migration narrative sections of `README.md` and `CHANGELOG.md`, while forbidding live commands, catalog entries, anchors, tests, and executable references.

**Confidence:** high

---

### F-003 [critical] dependency breaks — docs/plan-review-merge-codex.md:55-58

**Evidence:**
```md
Final: 2 skills de review. Cada uma com 3 modos:
- `both` (default, local→codex)
- `local only`
- `codex only`
```

**Claim:** The new mode model omits the existing non-interactive `review-plan` modes such as internal/cross-ref execution, and the plan does not define compatibility or migration for callers that pass mode flags.

**Impact:** Automated workflows that run review skills in loops can start prompting the user or reject their existing flags, which breaks non-interactive plan generation/status flows even if the new picker works manually.

**Recommendation:** Define argument parsing before the picker: preserve `--mode=internal` as `local`, preserve or map cross-reference flags, add `--mode=local|codex|both`, and update all internal callers to use the supported non-interactive flag.

**Confidence:** high

---

### F-004 [major] coverage gap — docs/plan-review-merge-codex.md:118-126

**Evidence:**
```md
### 1.2 — Cross-ref picker (only on local OR both — codex doesn't use it)

If `mode` ∈ {`local`, `both`}: run the existing artifact detection +
AskUserQuestion from current `review-plan.md:Step 0` (cross-ref or
internal-only).

If `mode == codex`: skip — codex envelope reviews the plan against the
external constraints baked into the briefing template; no cross-ref
mechanism needed.
```

**Claim:** `codex only` mode drops cross-reference artifact selection even though the merged `review-plan` is still described as supporting optional cross-reference review.

**Impact:** A user choosing codex-only review of a plan against a PRD/spec cannot provide those artifacts to the codex briefing, so requirement gaps against external artifacts are invisible to the cross-model reviewer.

**Recommendation:** Run artifact detection for all `review-plan` modes, including `codex`, and include selected artifacts in the codex briefing as neutral source facts while still excluding local findings and prior-review narrative.

**Confidence:** high

---

### F-005 [major] ambiguity — docs/plan-review-merge-codex.md:277-285

**Evidence:**
```md
Pre-flight (git ref validation, dirty tree check) runs AFTER mode picker,
since it applies to all modes.

---

## Fase 4 — Reescrever `skills/en/core/review-code.md` body

Mesmo padrão do Fase 2 mas pra código. Estima ~400 linhas combinadas
(menos que review-plan porque review-code não tem cross-ref complexity).
```

**Claim:** The `review-code` merge is under-specified because it does not define how git ref parsing, diff materialization, local review input, codex briefing input, and dirty-tree policy behave per mode.

**Impact:** Two implementations can produce materially different reviewed diffs, especially for branch names versus ranges or dirty worktrees, causing local and codex phases to review different code or fail after the mode prompt.

**Recommendation:** Add an explicit `review-code` flow matching the plan-level detail: parse `{{ARG_VAR}}`, validate ref/range, materialize the exact diff once, define dirty-tree handling, and state that local and codex phases both review that same captured diff.

**Confidence:** medium

## Questions (non-findings)

- docs/plan-review-merge-codex.md:340 — Should `network_required: true` remain global for a skill whose `local only` mode does not require network?

## Out of scope

- Internal codex envelope flow changes.
- Changes to `src/render.js`, `scripts/validate-skills.js`, `src/install.js`, or `src/detect.js`.
- `README.pt-BR.md`.
- Deprecated aliases for removed skill names.---END PASS 1 OUTPUT---

## Your task in this pass

1. Re-evaluate ALL findings from Pass 1 against the External Constraints.
   For EACH Pass 1 finding, decide one of:
   - **DROP** — finding is invalid given a constraint or non-goal
   - **MAINTAIN** — finding stands, severity unchanged
   - **REFINE** — finding stands but severity changes

2. Identify NEW findings that emerge ONLY because of these constraints
   (e.g. the artifact violates a constraint you couldn't see in Pass 1).

3. Output the FULL final findings list (use new sequential IDs starting at
   F-001) plus a complete `## Pass 2 reconciliation` block.

## Output format

You MUST respond in this exact markdown structure.

````markdown
---
verdict: <approve | approve_with_nits | needs_changes | reject>
counts: {blocker: 0, critical: 0, major: 0, minor: 0, nit: 0}
reviewer: <model id>
pass: informed
schema_version: "1.0"
---

## Summary
<1-2 paragraphs, max 200 words>

## Findings

### F-001 [<severity>] <category> — <file>:<line>

**Evidence:** <...>
**Claim:** <...>
**Impact:** <...>
**Recommendation:** <...>
**Confidence:** <...>

---

### F-002 ... (final IDs — these are the post-constraints findings)

## Questions (non-findings)

- <file>:<line> — <question>

## Out of scope

- <item>

## Pass 2 reconciliation

### Dropped from blind pass

- F-001-blind [<severity>] <category> — DROPPED: <one-sentence reason citing
  which constraint or non-goal makes it invalid>

<If no drops: write `- _(none)_`>

### Maintained

- F-002-blind → F-001-final [<severity>] — <same | severity changed: was X, now Y>

<If no maintained: write `- _(none)_`>

### Emerged

- F-XXX-final [<severity>] <category> — emerged: <one-sentence reason citing
  the constraint that triggered the finding>

<If no emerged: write `- _(none)_`>
````

Rules specific to Pass 2:
- Final findings use sequential IDs `F-001, F-002, ...` (no `-final` suffix in `## Findings` — only in reconciliation references).
- In reconciliation, refer to blind findings with `-blind` suffix and maintained mappings with `→ F-XXX-final`.
- `counts` is the COUNT OF FINAL findings (post-reconciliation), not blind.
- `pass: informed` (literal).

Begin reconciliation now.
```

</details>

## Fixes applied in this session

<!-- Append-only. Triagem step adds lines here as user approves/skips. -->

- 2026-05-22 — F-002 [critical] APPLIED: inserted `### Argument contract (non-interactive)` section after the modes list (around line 59). Defines parsing of `{{ARG_VAR}}` for `--mode=local|codex|both`, `--mode=internal` aliasing to local, `--no-cross-ref` and `--cross-ref=<path>` compat for review-plan, abort-without-TTY policy, and requires Fase 2 & Fase 4 to include the parser sub-task. Suppresses Step 0 picker when an explicit mode flag is provided. Original line cited in finding: docs/plan-review-merge-codex.md:55.
- 2026-05-22 — F-001 [major] APPLIED: tightened cross-cutting zero-reference rule. Functional references (catalog entries, anchors, executable commands, test fixtures, `related:` arrays, rendered commands) must be 0; old skill names are explicitly allowed in migration prose inside README.md (v3.0.0 note) and CHANGELOG.md (3.0.0 entry). Added operational verification via `rg`. Original line cited in finding: docs/plan-review-merge-codex.md:413.
- 2026-05-22 — F-003 [major] APPLIED: cross-ref picker now runs in ALL modes (local, codex, both). Codex-only mode attaches selected artifacts under `## External artifacts` heading in the Pass 1 briefing as neutral source facts (sealed-envelope-compliant). Added per-mode behavior, `--no-cross-ref` skip. Original line cited in finding: docs/plan-review-merge-codex.md:118.
- 2026-05-22 — F-004 [major] APPLIED: inserted Fase 3.1 "Argument & diff capture contract (review-code)" with 5-step contract — arg parse, ref/range validation, single `git diff` materialization into `CAPTURED_DIFF` (both phases consume it), dirty-tree policy with `--allow-dirty`, mode picker AFTER capture. Added Fase 4 sub-tasks: implement contract, ensure both phases receive `CAPTURED_DIFF`, byte-identical smoke test. Original line cited in finding: docs/plan-review-merge-codex.md:277.
- 2026-05-22 — F-005 [major] APPLIED: added section in Fase 2.1 mandating that codex sub-flow in the merged body REFERENCES `skills/shared/codex-bridge-assets/` (single source of truth) rather than copy-pasting from old `-with-codex` bodies. Required pre-delete diff between embedded flow and canonical assets in Fase 5; documented divergence policy; auditable via Fase 10 grep check. Original line cited in finding: docs/plan-review-merge-codex.md:197.
