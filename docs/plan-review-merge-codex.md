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

### Argument contract (non-interactive)

Antes do Step 0 mode picker, ambos os skills DEVEM parsear `{{ARG_VAR}}` e
honrar flags explícitas. O picker (`{{ASK_USER_QUESTION_TOOL}}`) só é
invocado quando NENHUMA flag explícita resolve o modo. Isso preserva uso
em scripts, hooks, e loops de status que rodavam os skills pre-merge.

Contrato (vale pra `review-plan` e `review-code`):

| Flag | Efeito | Compatibilidade |
|---|---|---|
| `--mode=local` | Skip mode picker; força local self-loop. | Novo (v3.0.0). |
| `--mode=codex` | Skip mode picker; força codex envelope. | Novo. |
| `--mode=both` | Skip mode picker; força local→codex. | Novo. |
| `--mode=internal` | Alias pra `--mode=local`. | Compat com flag de `review-plan` v2.x. |
| `--no-cross-ref` (review-plan apenas) | Skip cross-ref picker; força internal-only. Vale só quando `mode ∈ {local, both}`. | Compat com `review-plan` v2.x. |
| `--cross-ref=<path>` (review-plan apenas) | Skip cross-ref picker; usa o artifact informado. | Compat com `review-plan` v2.x. |
| (nenhuma flag) | Roda Step 0 picker(s). | Default. |

Modo invocado sem TTY (e.g. via hook ou `parallel-dispatch`) com nenhuma
flag explícita: skill aborta com mensagem orientando o caller a passar
`--mode=...`. NÃO invoca `{{ASK_USER_QUESTION_TOOL}}` em background.

Fase 2 (review-plan body) e Fase 4 (review-code body) DEVEM incluir
sub-task explícito implementando esse parser e os early-exits antes do
Step 0a.

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

### 1.2 — Cross-ref picker (vale em TODOS os modos)

Cross-reference artifact selection (PRD, spec, decision record etc.) é
ortogonal ao mode picker. Em todos os modos — `local`, `codex`, `both` —
roda a detecção existente de artifacts + `{{ASK_USER_QUESTION_TOOL}}`
("internal-only" ou "cross-ref + path(s)") do atual `review-plan.md:Step 0`.

- `mode == local`: artifacts selecionados entram no checklist do self-loop.
- `mode == codex`: artifacts selecionados são anexados ao Pass 1 briefing
  como **source facts neutros** (sob heading `## External artifacts`), com
  o mesmo anti-framing das constraints externas. NÃO inclui findings do
  local nem narrative — só o conteúdo do artifact + path. Sealed envelope
  preservado.
- `mode == both`: artifacts entram nas duas fases (checklist local +
  briefing codex). O briefing codex usa a versão CLEANED dos artifacts se
  o local tiver corrigido qualquer um deles inline.

Skip explícito: `--no-cross-ref` ou ausência total de artifacts detectáveis
mantém o behavior pre-merge (review puramente sobre o plan).

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

**Fonte canônica do sub-flow codex:** o body NÃO pode duplicar a lógica
do envelope two-pass via copy-paste do `review-plan-with-codex.md`. Em vez
disso, deve **referenciar/incluir** os assets canônicos em
`skills/shared/codex-bridge-assets/` (pre-flight, briefing templates,
invocation canonical, validation checklist, output templates, review file
template, index row template). Mecânica:

- Cada etapa do sub-flow codex no body cita o asset relevante por path
  (e.g. "Pre-flight: aplicar `skills/shared/codex-bridge-assets/preflight-checks.txt`").
- Sub-task obrigatório antes do delete da Fase 5: rodar `diff` entre o
  fluxo embutido no body novo e os assets em `skills/shared/codex-bridge-assets/`.
  Qualquer divergência semântica é resolvida em favor dos assets (single
  source of truth). Divergências reais documentadas inline no body com
  comentário explícito do motivo.
- Validação cross-cutting: nenhum bloco do sub-flow codex no body novo
  contradiz os assets compartilhados. Critério de done auditável via
  checklist na Fase 10 (manual diff + `grep -c "codex-bridge-assets"` em
  ambos os bodies retorna ≥ 1).

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

### 3.1 — Argument & diff capture contract (review-code)

Antes do mode picker, e antes de qualquer prompt, o skill DEVE:

1. **Parsear `{{ARG_VAR}}`** seguindo o mesmo Argument Contract da seção
   `Argument contract (non-interactive)` (suportar `--mode=local|codex|both`,
   `--allow-dirty`, abort-without-TTY).
2. **Validar a ref/range** com a lógica range-aware existente em
   `review-code` v2.x (commit hash, branch, `A..B`, `A...B`).
3. **Materializar o diff UMA vez** via `git diff <resolved-ref> --` e
   armazenar o output em uma variável de sessão (`CAPTURED_DIFF`). Ambas
   as fases (local e codex) consomem `CAPTURED_DIFF`, NUNCA re-executam
   `git diff` — garante que vêem exatamente o mesmo material.
4. **Dirty-tree policy** (vale em todos os modos):
   - Tree limpo: prossegue normalmente.
   - Tree sujo + `--allow-dirty`: warning + inclui working-tree changes no
     `CAPTURED_DIFF`.
   - Tree sujo sem `--allow-dirty`: aborta com mensagem (mesma do pre-flight
     de codex-bridge-assets — bug #8404 hallucinations).
5. **Mode picker (Step 0)** roda DEPOIS dos passos 1–4 acima, garantindo
   que abortos por ref inválida ou tree sujo não dependem de TTY.

---

## Fase 4 — Reescrever `skills/en/core/review-code.md` body

Mesmo padrão do Fase 2 mas pra código. Estima ~400 linhas combinadas
(menos que review-plan porque review-code não tem cross-ref complexity).

Sub-tasks explícitos (além do merge de bodies):

- Implementar Argument & diff capture contract (Fase 3.1) no topo do body.
- Garantir que tanto a fase `local` (checklist) quanto a fase `codex`
  (Pass 1 + Pass 2 briefings) recebem `CAPTURED_DIFF` como input, não a
  ref em si.
- Validar com smoke test: rodar `mode=both` num PR pequeno e confirmar
  que o diff revisado é byte-identical entre as duas fases (`md5` no
  output de `git diff` materializado em ambas).

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

- [ ] Nenhuma referência **funcional** (catalog entry, anchor de seção, link executável, fixture de teste, related: array, comando renderizado) aos nomes `review-plan-with-codex` ou `review-code-with-codex` sobrou em `skills/`, `meta/`, `src/`, `tests/`, `README.md`, `CHANGELOG.md`. **Exceção permitida:** os nomes podem aparecer em prosa de migração dentro de `README.md` (nota v3.0.0) e `CHANGELOG.md` (entry 3.0.0 — bullets de "Removed" + linhas de "Migration"). (`README.pt-BR.md` fora de escopo per [[decisao-skills-en-only]].)
  - Verificação operacional: `rg "review-(plan|code)-with-codex" skills/ meta/ src/ tests/` retorna 0 matches; em `README.md` e `CHANGELOG.md`, os matches restantes devem estar contidos em blocos de migração rotulados explicitamente.
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
