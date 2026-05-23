---
name: project-roadmap-2026-05-22
description: Três planos sequenciais escritos em 2026-05-22 — consolidation, depois merge-codex, depois catalog-v0.2. Ordem obrigatória.
metadata:
  type: project
---

Três planos no `docs/` aguardando execução, em **ordem obrigatória**:

1. **`docs/plan-review-skills-consolidation.md`** — primeiro
   - Merge `review-plan-internal` + `review-plan-vs-artifacts` → `review-plan` (com AskUserQuestion cross-ref)
   - Cria `review-code` (Gap 1 da auditoria)
   - Adiciona G1+G2+G6 gates em `review-plan-with-codex`
   - Corrige `git rev-parse --verify` range bug em `review-code-with-codex.md:25`
   - Adiciona template var `ASK_USER_QUESTION_TOOL` em `src/render.js` (Fase 0)
   - Atualiza refs a nomes antigos em outros skill bodies (Fase 3.5)
   - Bump `package.json` 1.8.1 → **2.0.0** (breaking renames)
   - Cria `CHANGELOG.md` (primeiro do projeto, formato Keep a Changelog)
   - **11 fases (0, 1, 2, 3, 3.5, 4-9), ~3h30min**
   - Já passou por 2 reviews (internal + codex). Codex foi REJECT no Pass 2 com 1B/2C/2M; todos os 5 findings fixed in-plan.

2. **`docs/plan-review-merge-codex.md`** (a escrever) — segundo
   - Merge `review-plan` + `review-plan-with-codex` → 1 skill `review-plan` com Step 0 mode picker (both/local/codex)
   - Merge `review-code` + `review-code-with-codex` → 1 skill `review-code` idem
   - Net: 4 → 2 skills de review no total
   - Ordem dentro do "both" mode: **local → codex** (validado por evidência empírica desta sessão + memória 2026-05-21 + custo + anti-anchoring)
   - Sealed envelope preservation: codex briefing roda no plan CLEANED (pós-fixes locais), sem ver findings do local
   - Bump major: 2.0.0 → **3.0.0** (mais 2 breaking removes)

3. **`docs/plan-skills-catalog-v0.2.md`** — terceiro
   - Schema v0.2 em `meta/catalog.yaml` (renomeado de `skills.yaml` no rename-to-catalog initiative): 7 campos novos (one_liner, emoji, version_added, subcommands, args, output_artifacts, dependencies)
   - Validator cross-checks (skill body ↔ catalog entry)
   - Gerador de README.md + `src/dashboard/data/skills.generated.ts`
   - Pre-commit hook + CI workflow
   - 6 fases (A-F), ~5-6h sequencial
   - Já passou por review interno (3 iterações, 13 findings corrigidos)
   - **Trabalha sobre o catálogo final pós-merge (2 review skills, não 4)** — economiza retrabalho

**Why ordem fixa:**
- merge-codex roda DEPOIS de consolidation pra simplificar — consolidation já vai estar com renames feitos + Phase 0 (ASK_USER_QUESTION_TOOL) feito, que merge-codex reusa.
- v0.2 roda POR ÚLTIMO pra escrever metadata sobre 2 skills finais (não 4 intermediárias).

**Releases (decidido user 2026-05-22):**
- v2.0.0: após consolidation (breaking: 2 renames + 1 rename adapt)
- v3.0.0: após merge-codex (breaking: 2 removes)
- v3.x ou v3.1.0: após catalog v0.2 (additive, minor bump)

**Why a evidência empírica do merge-codex existe:**
2026-05-21 (`feedback-framing-llm-judge.md:42-48`): codex catchou 4 majors que self-review missed.
2026-05-22 (esta sessão): review-plan-internal catchou 9 issues no consolidation plan, depois review-plan-with-codex catchou 5 NOVOS issues — zero overlap. Catches disjuntos. Validates "always both em projetos grandes".

**How to apply:**

- Ao abrir nova sessão, ler MEMORY.md → ver esse pointer → confirmar com user qual plano está em execução antes de qualquer code edit.
- Se o user pedir "execute o plano de skills", confirmar QUAL — a ordem importa.
- Skills EN-only desde 2026-05-22 (ver [[decisao-skills-en-only]]); todos os 3 planos respeitam.
- Consolidation: decisões já validadas (merge plan, naming, Gap 1 criar, Gap 2 G-gates, Gap 3 manter codex separado por enquanto, hard break + CHANGELOG, 5 codex fixes aplicados). Não re-discutir.
- Merge-codex: decisão de mergir + ordem local→codex VALIDADAS (não re-discutir). Detalhes do AskUserQuestion mode picker vão pro spec.
- Catalog v0.2: schema v0.2 fields decididos. Cross-check + geradores decididos. Não re-discutir.

Relacionado: [[decisao-skills-en-only]], [[feedback-framing-llm-judge]] (evidência da memória sobre cross-model review).
