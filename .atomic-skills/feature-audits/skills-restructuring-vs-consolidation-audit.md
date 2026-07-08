> Auditoria gerada 2026-06-22 contra develop @ 1c66d61. Baseline de intenção: [[skills-restructuring-intent.md]].

# Auditoria — A consolidação multi-plano regrediu a otimização de economia de tokens?

## 1. Veredito

**A otimização SOBREVIVEU à consolidação, com UMA regressão pontual — e essa regressão NÃO foi causada pela consolidação.** O grau é: **otimização intacta + 1 quebra-de-budget interna ao próprio plano otimizador**. O padrão central da otimização — single-source / lazy-asset, com os blocos pesados movidos para `skills/shared/**` e apenas ponteiros residentes nos skills core — está **byte-for-byte preservado em todos os 12 pares (skill → asset)** verificados (D5), em todos os 17 lazy assets e 19 ponteiros (snapshot determinístico), e os dois gates determinísticos estão **VERDES** (`validate-skills`: 15 skills válidas; `npm test`: 1312/1312). Nenhum plano consolidado re-inlinou conteúdo movido, derrubou ponteiro nem deixou asset órfão. O crescimento dos arquivos core (`review-code.md`, `implement.md`) e do lazy `project-transitions.md` é **conteúdo de feature legítimo de outros planos**, de-duplicado e abaixo do orçamento. A única regressão real e confirmada é `skills/core/review-plan.md`, **1230B acima do teto rígido de 24000B** — e a evidência prova que o culpado é a fase **F4 do próprio plano skills-restructuring** (commit `9406177`), ancestral da consolidação, e não nenhum dos 7 planos consolidados.

## 2. Regressões CONFIRMADAS

| Arquivo | O que regrediu | Causa (plano/commit) | Evidência | Tipo / Correção recomendada |
|---|---|---|---|---|
| `skills/core/review-plan.md` | 25230B — **1230B acima** do teto rígido de 24000B estabelecido e verificado por F3/T3.2 (pós-F3 era 22631B). O verificador registrado de T3.2 (`test $(wc -c < skills/core/review-plan.md) -lt 24000`) **FALHA** em develop. | **F4 do skills-restructuring**, commit `9406177` (T4.1 Target-resolution ladder + T4.2 provenance seed). `git diff 1c55a32 9406177 --stat` = +2599B. NÃO é regressão da consolidação: o range `9406177..1c66d61` que toca o arquivo é vazio; `9406177` é ancestral de `e177e8b^2`. | `wc -c` em develop (`1c66d61`) = 25230B; `git show 9406177:skills/core/review-plan.md \| wc -c` = 25230B (idêntico). Verificador T3.2 registrado em `.atomic-skills/projects/atomic-skills/skills-restructuring/phases/f3-economia-de-tokens-per-skill.md` L88-105/L242. | **quebra-de-budget** — Extrair o bloco F4 `### Target resolution` (L64-91, ~1755B) para o lazy asset existente `skills/shared/project-assets/plan-initiative-depth.md` (hoje 7168B) como nova seção `§ *Target resolution*`, deixando um ponteiro de uma linha (mesmo padrão já usado em L185/L272/L442). Resultado: ~23500B, de volta sob 24000B. |

> Nota de severidade: D2 classifica a quebra como **medium**. É a única descoberta com `isRegression=true` em todo o conjunto D1-D6. O achado-irmão D2-2 ("o teto de 24000B não tem teste que o imponha") é uma **lacuna de gate**, não uma segunda regressão de arquivo — ver Plano de correção, item 3.

## 3. Crescimento LEGÍTIMO (não-regressão — NÃO "consertar")

- **`skills/core/review-code.md` — 17778B (< 20000, +2981B).** Crescimento residente da feature **F7 do plano worktree-lifecycle-finalization (WLF)**: bloco `## Step 0.5 — Surface-review dedup` (commits `a751093` + `83d2ee1`). Prova de que é WLF e não skills-restructuring: `git merge-base --is-ancestor a751093 e177e8b^2` → NÃO; `… e177e8b^1` → SIM; `git diff e177e8b -- review-code.md` = vazio. O bloco delega a lógica de match ao módulo puro `scripts/review-ledger.js` (não re-implementa inline). Ponteiros F1 intactos: `diff-capture.md` (L40) e `envelope-orchestration.md` (L233) NÃO re-inlinados. (D3-1, D3-2)
- **`skills/core/implement.md` — 18393B (< 22000, +2286B).** Crescimento residente da feature **WLF F0/T-006**: bloco `### Step 0.5 — Resolve the plan-worktree (lazy)` (commit `4304a20`). O bloco é lazy-correto: referencia `skills/shared/worktree-isolation.md` em vez de inlinar a lógica de detecção. Ponteiros F1 intactos: `mode2-codex-lane.md` (L93, single source do contrato Mode-2) e `implement-antipatterns.md` (L130/L155, tabela Temptation→Reality NÃO inlinada). **Importante:** o merge `e177e8b` resolveu o conflito de `implement.md` **mantendo o corpo F1-lean (16107B)** e apenas sobrepondo o Step 0.5 — descartou corretamente o corpo pesado pré-F1 do WLF (29287B, que tinha zero ponteiros para `implement-antipatterns.md`). A otimização venceu o conflito. (D3-3, D3-4, D3-5)
- **`skills/shared/project-assets/project-transitions.md` — 42854B (lazy asset, +12791B vs `e177e8b^2` = 30063B).** Conteúdo de feature distinto de dois planos, sem duplicação: `uniq -d` em headings = vazio; linhas >60 chars repetidas = vazio. +5149B do **deadline-burnup-forecast** (`appendCompletion` em `238f677`, `computePhaseActuals` em `003b526` — call sites distintos task-done vs phase-done) e +7642B do **plan-fork** (`### fork-resume` + Fork-link resume HARD gate + worktree-teardown offer, merge `7ea09b5`). O ponteiro single-source `verifier-exec.md` (L177-179, "moved to verifier-exec.md" / "Do NOT inline the executor back") sobreviveu intacto; `grep -c verify_exit_gate` = 1 (só o ponteiro). (D1-1 a D1-4, D5-3, D5-12)
- **`skills/core/project.md` — 21486B (max 22000, +783B vs baseline 20703B).** Apenas **novas linhas de tabela de router** (verbo `consolidate` em `6086c64`; fork-plan em `587ac7a`/`7ea09b5`), não conteúdo re-inlinado. O router permaneceu fino; single-source preservado. (D4-8)
  > Observação operacional (não-regressão): o snapshot marca `project.md` como "OK-but-near-ceiling" (+1090 vs target 20396, restando ~514B até o teto rígido de 22000). Sob orçamento, mas é o arquivo com menor folga — qualquer nova linha de router futura deve vigiar isso.

## 4. Skills / assets novos de outros planos

| Asset/skill | Origem (plano) | Registro | Status órfão |
|---|---|---|---|
| `skills/shared/project-assets/project-consolidate.md` (8402B) | plano **consolidate** (`6086c64`, refinado `c8069ec`) | Registrado via router lazy em `project.md:51` (linha de tabela `consolidate`) | Não-órfão (1 ponteiro inbound). Não existia em `e177e8b^2`. (D4-3) |
| `skills/shared/project-assets/project-finalize.md` (19471B) | plano **worktree-lifecycle-finalization** (`d74a1f0` F3 → `00dd0cd` F8) | Registrado via router lazy em `project.md:50` (linha `finalize`); handoff em `project-transitions.md:232` | Não-órfão. Não existia em `e177e8b^2`. (D4-4) |

- **Nenhum novo skill core (`skills/core/*.md`) foi adicionado por nenhum plano.** `git ls-tree -r e177e8b^2 -- skills/core` vs develop = conjunto idêntico de 14 arquivos. `project-migrate.md`, `project-review.md` e `debate-assets/critic.md` **já existiam** no baseline (não são novos da consolidação). (D4-5)
- **`critic.md` byte-idêntico** ao baseline (6256B → 6256B), não tocado pelos 7 planos. (D4-6)
- **Zero assets órfãos** no total: todos os 40 shared assets + `modules/memory/_assets/connect.md` têm ≥1 ponteiro inbound real (não coincidência de prosa). (D4-2)
- Os dois grandes lazy files — `project-create-plan.md` (51284B) e `project-emergence.md` (31572B) — compartilham **zero headings** entre si (`comm -12` = vazio, sem duplicação cruzada) e são referenciados apenas como detalhe lazy do router. (D4-7)

## 5. Estado dos gates / testes (develop, tip `1c66d61`)

- **`npm run validate-skills`: VERDE** — exit 0, "✓ All 15 skills valid (schema_version 0.2)" (14 core + 1 module). (D6-2)
- **`npm test`: VERDE** — tests **1312 / pass 1312 / fail 0 / skipped 0 / todo 0**, 152 suites, exit 0 (após `npm install`). Reconfirmado 2x (determinístico). (D6-1)
- **`npm run check-docs`: VERDE** — README/skill-docs/catalog.json ainda derivados do single source, sem drift pela consolidação. (D6-4)
- **As 8 falhas de contagem pré-existentes** (`countSkills` x3, `installSkills` x5) estão **RESOLVIDAS**: fixtures atualizadas para 14 core e footprint de 68 arquivos pós-consolidação (commits `1f50722`, `6086c64`). `detect.test.js` 15/15, `install.test.js` 37/37. (D6-3)
- **RED inicial foi só de ambiente:** a dep declarada `@henryavila/minimalist-installer@^0.1.0` (`package.json:60`) estava ausente de `node_modules` antes do `npm install`, causando 12 arquivos da família install a falhar com um único `ERR_MODULE_NOT_FOUND`. Não é regressão de código — `npm install` resolve. (D6-5)
- **Nenhum teste relevante à otimização falha** após `npm install`. Crucialmente: **não existe teste que imponha o teto de 24000B de `review-plan.md`** — `grep` por '24000'/'byte budget'/'ceiling' em `tests/`/`skills/`/`docs/` não retorna código de enforcement; o teto vive apenas no doc do plano F3 e em `tasks.json`. Foi por isso que F4 re-quebrou o budget em silêncio. (D2-2)

## 6. Plano de correção priorizado (menor blast-radius primeiro)

**Regressão verdadeira de otimização a corrigir (1):**

1. **Extrair o bloco `### Target resolution` de `skills/core/review-plan.md` (L64-91, ~1755B) para o lazy asset.**
   - Em `skills/shared/project-assets/plan-initiative-depth.md` (hoje 7168B): anexar uma nova seção `§ *Target resolution*` com o conteúdo de L64-91.
   - Em `skills/core/review-plan.md`: substituir L64-91 por um ponteiro de uma linha — `{{READ_TOOL}} skills/shared/project-assets/plan-initiative-depth.md § *Target resolution* — resolve plan_path (file | slug | active plan) before Step 0b.`
   - Efeito: ~25230B → ~23500B, sob 24000B. **NÃO** extrair também a expansão provenance-seed do Step 0b (L132-142, ~958B): ela está entrelaçada com o scan de prosa do step-2 que aumenta, então é mais load-bearing in place — extrair só o bloco Target-resolution já basta.
   - Mesmo padrão lazy que o arquivo já usa (ponteiros para `plan-initiative-depth.md` em L185/L272/L442). Blast-radius mínimo: 2 arquivos, sem mudança de comportamento.

2. **Re-fechar o budget após o item 1.** Rodar o verificador registrado de T3.2: `test $(wc -c < skills/core/review-plan.md) -lt 24000`. Deve passar. Atualizar o resultado em `f3-economia-de-tokens-per-skill.md` se o estado do plano for mantido.

**Lacuna de gate a fechar (1 — previne reincidência, não é regressão de arquivo):**

3. **Tornar o teto de byte um invariante permanente, não um check one-shot.** Adicionar um teste standing (ex.: `tests/skill-byte-budget.test.js`) afirmando `wc -c skills/core/review-plan.md < 24000` (e, idealmente, os tetos dos demais core skills) para que qualquer re-inline futuro — de qualquer plano ou fase posterior — falhe no CI. Lição direta de D2-2: F4 quebrou o budget de F3 porque o teto vivia só no doc do plano, nunca em `tests/`.

**O que NÃO consertar (crescimento legítimo — deixar como está):**

- `review-code.md` (17778B), `implement.md` (18393B), `project.md` (21486B), `project-transitions.md` (42854B): todos sob orçamento e crescidos por conteúdo de feature legítimo de outros planos (seção 3). Refinamentos opcionais (ex.: mover o Step 0.5 de review-dedup, ~50 linhas, para um lazy asset já que delega a `review-ledger.js`) são melhorias, **não correções de regressão** — só fazer se houver folga e vontade, jamais como urgência.
- `project-consolidate.md`, `project-finalize.md`: assets novos, corretamente roteados, não-órfãos. Manter.

## 7. Resolução aplicada (2026-06-22)

Itens 1+2+3 do plano de correção, em fluxo TDD:

- **Guard standing** (`tests/skill-byte-budget.test.js`): impõe os tetos documentados de F1/F2/F3 para os 8 core skills (project, implement, review-code, review-plan, hunt, debate, parallel-dispatch, init-memory). Escrito primeiro → RED em `review-plan.md` (25230B ≥ 24000B).
- **Extração** do bloco `### Target resolution` para um **asset dedicado** `skills/shared/project-assets/review-plan-target-resolution.md` (não o `plan-initiative-depth.md` originalmente proposto — aquele asset é estritamente sobre *initiative-depth*; um arquivo próprio respeita a responsabilidade única e é mais fácil de achar), deixando um ponteiro de 4 linhas em `review-plan.md`. Cross-ref "immediately below" reescrito (o parágrafo *Non-interactive abort* permanece residente). Resultado: **`review-plan.md` 25230B → 23891B (< 24000)** → guard GREEN.
- **Contadores de footprint** em `tests/install.test.js` bumpados pelo asset novo (68→69, 69→70, 135→137, 49→50).
- Gates: `validate-skills` ✓, `check-docs` ✓, **`npm test` 1322/1322 ✓**, `install-uninstall-roundtrip` ✓ (asset instala/desinstala simétrico).
