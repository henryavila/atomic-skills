# Reconstrução de intenção — Plano "skills-restructuring" (Reestruturação das skills atomic-skills)

> Documento de **recuperação de intenção** (não auditoria de código). Fiel às fontes: master plan, design.md, fases f0–f6, registros de review e lessons. Onde a fonte é silenciosa, está marcado **"não declarado"**. Nomes de skill, caminhos e ids de gate preservados exatamente.

---

## 1. Objetivo geral

A reestruturação consolidou, num único plano multifásico, **quatro frentes** sobre as skills do repo `atomic-skills`: (1) um "pente fino" de consistência de baixo risco; (2) economia de tokens da arquitetura de skills (afinar o router `project` e o driver `implement`, fatorar o bloat transversal em uma receita por padrão, e empurrar blocos mode-gated/branch-only de cada skill grande para assets lazy); (3) a nova feature de subcomando `project review`; e (4) a nova skill `design-brief`. Os princípios condutores são **single-source-of-truth (P1)**, **lazy-load que não recolapsa (P2)**, **preservação de comportamento / mover-não-reescrever (P3)**, **um verifier determinístico por task (P4)** e **um design-brief não-contaminante (P5)**. A execução foi planejada via **codex (Mode 2) com review do Opus**, sequencialmente (`parallelismAllowed: false`). As fontes normativas são `docs/audits/project-implement-audit-2026-06-15.md` e `docs/audits/token-economy-all-skills-2026-06-15.md` (este último quantificou ~21,7k tokens recuperáveis sem mudança de comportamento).

---

## 2. Visão das fases (f0–f6)

| Fase | Objetivo numa linha | Status declarado |
|---|---|---|
| **F0** | Pente fino de consistência (resíduo/drift documental de baixo risco), sem mudar comportamento | done (reviewGate passed; **exit gate F0-G1 = pending**) |
| **F1** | Economia de tokens em `project` e `implement` — router fino + driver enxuto (<22000 bytes cada) | done (F1-G1 **met**; reviewGate passed) |
| **F2** | Economia de tokens transversal — uma receita por padrão repetido em N skills | done (F2-G1 **met**; reviewGate passed) |
| **F3** | Economia de tokens per-skill — mover blocos mode-gated/branch-only para assets lazy | done (F3-G1 **met**; reviewGate passed) |
| **F4** | Feature `project review` — subcomando de auditoria de plano/iniciativa | done (F4-G1 **met**; reviewGate passed) |
| **F5** | Nova skill `design-brief` — prompts DS-first + telas-consomem-DS, anti-contaminação 3 camadas | done (**F5-G1 = pending** no master, mas **met** no doc da fase — ver §6) |
| **F6** | `focus.json` não drifta silenciosamente — refresh-state na transição + install conecta hooks | done (F6-G1 **met**; reviewGate passed) |

> **Inconsistência de cabeçalho:** o master plan declara `currentPhase: F4` e `status: archived`, embora **todas as sete fases** estejam `done`. Ver §6.

---

## 3. Por fase (f0–f6)

### F0 — Pente fino de consistência
*(slug `skills-restructuring-f0-pente-fino-de-consistencia`, subPhaseCount 7, dependsOn: nenhuma)*

**Objetivo:** corrigir resíduo e drift documental de baixo risco nas skills, **sem mudar comportamento** — contagem errada de stages, caminhos mortos, cheat-sheets de schema incompletos no router, e um quality gate não registrado. Meta: a suite de validação continua passando após edições puramente documentais.

**Tasks (id · descrição · critério de aceitação):**

| id | descrição | critério de aceitação (verifier shell, exit 0) |
|---|---|---|
| **T0.1** | Corrigir contagem de stages no create-plan: heading "7 stages" → "9 stages" em `project-create-plan.md` (Stage 1–9). ScopeBoundary: só o heading, não o corpo. | `grep -q '9 stages' … && ! grep -q '7 stages' …` |
| **T0.2** | Completar cheat-sheet de Task com `summary` e `evidence` nos opcionais de Task no Schema quick-reference do router (`project.md`). | `grep -qE 'Task.*Optional:.*summary.*evidence' skills/core/project.md` |
| **T0.3** | Completar cheat-sheet de PhaseDescriptor: adicionar `summary`, `provenance`, `context` (`project.md`). | `grep -qE 'PhaseDescriptor.*Optional:.*summary.*provenance.*context' …` |
| **T0.4** | Anotar campos 0.2 do verifier manual (`demoCommand`, `fallbackKind`, `steps`, `expected`, `data`) no branch manual do `ExitCriterionVerifier` (`project.md`). | `grep -q 'demoCommand' … && grep -q 'fallbackKind' …` |
| **T0.5** | Corrigir caminho morto: `skills/en/core/review-code.md` → slug `atomic-skills:review-code` em `project-drift.md`. | `! grep -q 'skills/en/' … && grep -q 'atomic-skills:review-code' …` |
| **T0.6** | Registrar gate **G9 mutation-kill** em `docs/kb/code-quality-gates.md`, espelhando o shape `evidence.mutation` inline de `project-transitions.md`. ScopeBoundary: só a seção G9, não a matriz rule×skill. | `grep -qE '^##+ G9' docs/kb/code-quality-gates.md` |
| **T0.7** | Remover referência dangling `AIDECK_STATE_DOMAIN` da prosa de `project-view.md`, mantendo `AIDECK_BIN`/`DASHBOARD_DIR`. | `! grep -q 'AIDECK_STATE_DOMAIN' … && grep -q 'AIDECK_BIN' …` |

**Arquivos:** modificados `project-create-plan.md`, `skills/core/project.md`, `project-drift.md`, `docs/kb/code-quality-gates.md`, `project-view.md`; criado `lessons/skills-restructuring-f0-pente-fino-de-consistencia.md` (L-001).

**Exit gate:** **F0-G1** — "Suite de validação de skills passa após as correções de pente fino" · `npm run validate-skills`, exit 0. *Status no master plan:* **pending** (sem bloco de evidência). *No doc da fase:* met (2026-06-16), evidence "✓ All 15 skills valid (schema_version 0.2)". → ver §6.

**Decisões-chave:** routing optou **OUT** para Mode 1 (inline single-thread) — T0.2/T0.3/T0.4 tocam o mesmo `project.md` (não-paralelizável); overhead de worktree > trabalho. T0.6 espelhou só a seção G9 (sem coluna na matriz, consistente com tratamento de G8).

**Itens em aberto:** lição **L-001** destilada da finding de review (gap matrix-footnote do G9, corrigido no commit `8a35a17`); rodar `phase-done` para F0 era opt-in do usuário (posteriormente: reviewGate stamped passed, commit `8a35a17`).

---

### F1 — Economia de tokens: project e implement
*(slug `…-f1-economia-de-tokens-project-e-implement`, subPhaseCount 4 [nota: 5 tasks T1.1–T1.5], dependsOn F0)*

**Objetivo:** restaurar o **router fino** (`project`) e o **driver enxuto** (`implement`) movendo todo conteúdo não-ambiental (referências de schema, mecânica de rollups, code-quality-gates, tabelas de refutação anti-padrão, contrato Mode-2, padrões de verifier) do bloco resident para detail/asset lazy — `project.md` e `implement.md` cada um **<22000 bytes** — sem perder comportamento. Inclui correção de raiz no decompose H3-mode para materializar o interior SPEC das tasks.

**Tasks:**

| id | descrição | critério de aceitação |
|---|---|---|
| **T1.1** | Router fino: mover Schema quick-reference + rollups/summaries + code-quality-gates do resident de `project.md` para detail, deixando ponteiro de 1 linha. Split semântico: field-reference/summaries/level-hygiene → `project-create-plan.md`; rollups/focus markers → `project-transitions.md`; cq-gates → ponteiro. **ScopeBoundary:** NÃO mover Iron Law, pre-mutation gates, gate-status invariant, ratify gate, emergence ladder (ficam resident). | `! grep -q 'Schema quick-reference' project.md && wc -c < project.md < 22000 && npm run validate-skills` |
| **T1.2** | Colapsar Red Flags/Rationalization do `implement`: manter gatilhos one-liner resident, mover tabela Temptation→Reality para `skills/shared/implement-antipatterns.md`. **ScopeBoundary:** NÃO remover gatilhos; NÃO tocar Process/Iron Law. | `test -f implement-antipatterns.md && wc -c < implement.md < 22000 && grep -q 'implement-antipatterns' implement.md` |
| **T1.3** | Contrato Mode-2 em fonte única: reduzir em `implement.md` a stub de 4 itens + ponteiro; fonte única em `skills/shared/mode2-codex-lane.md`. **ScopeBoundary:** NÃO duplicar F1/F2/racional SDD. | `grep -q 'mode2-codex-lane' implement.md && grep -c 'spec-readiness' implement.md ≤ 1` |
| **T1.4** | Partir `project-transitions.md` (hot/cold path) e extrair padrões de verifier para `skills/shared/project-assets/verifier-exec.md` como **fonte única**. **ScopeBoundary:** NÃO inlinar o executor nos callers; preservar semântica GATE-R2. | `test -f verifier-exec.md && grep -q 'verifier-exec' project-transitions.md && npm run validate-skills` |
| **T1.5** | **(emergent, ratificada)** Corrigir `src/decompose.js` H3-mode: parsear os 4 campos SPEC + lead-description e mapeá-los ao schema (verifier via inline flow-map `{kind: …}`, mesma forma do exit_gate). **ScopeBoundary:** NÃO alterar grammar de fases nem exit_gate YAML; preservar R-ORCH-10. | `node --test tests/decompose.test.js` |

**Arquivos:** modificados `skills/core/project.md` (28696→20396B), `project-transitions.md` (32762→28692B), `project-create-plan.md`, `skills/core/implement.md` (27001→17931→16107B), `mode2-codex-lane.md`, `src/decompose.js`, `tests/decompose.test.js` (72/72), `tests/project.test.js` (fix-forward, 34/34); criados `implement-antipatterns.md`, `verifier-exec.md`, `lessons/…-f1….md` (L-F1-1), arquivo de review, hooks `.atomic-skills/status/hooks/`.

**Exit gate:** **F1-G1 (met, 2026-06-16T14:17:46Z)** — `project.md` <22000B && `implement.md` <22000B && grep `mode2-codex-lane` em implement.md && grep `verifier-exec` em project-transitions.md && validate-skills. Evidence: project.md=20396B, implement.md=16107B, "All 15 skills valid".

**Decisões-chave:** Executor **Mode 1** (opt-out do default Codex) — overlap de arquivos (T1.1↔T1.4, T1.2↔T1.3) + `parallelismAllowed:false` zeram ganho de worktree. `verifier-exec.md` como fonte única (callers resolvem via ponteiro). T1.5 ratificada por humano (surfaçada pelo review-plan da F0, que achou 31/31 tasks sem interior SPEC). **Ordem pós-F1 acordada:** F6 → F2 → F3 → F4 (F5 já done). Codex review **SKIPPED** no phase-done; review em `--mode=local` (override registrado).

**Itens em aberto:** **8 falhas pré-existentes** em `npm test` (3× countSkills espera '13 core' / catalog tem 14 após F5; 5× installSkills) — red desde F5, delegadas à **branch de finalização** (F1 introduziu 0 líquidas). Consolidação de 3 worktrees + merge delegados a branch dedicada; conflito conhecido: `plan/multiplan-focus` edita `implement.md` (reescrito na F1). Follow-ups deferidos: 1 major **FU-F1-1** + 1 minor a uma task de fix dedicada; 1 minor dispensado by-design.

---

### F2 — Economia de tokens: padrões transversais
*(slug `…-f2-economia-de-tokens-padroes-transversais`, subPhaseCount 7, dependsOn F1)*

**Objetivo:** aplicar **uma receita por padrão repetido** em N skills de uma vez. De-duplicar convenções (Red Flags/Rationalization), extrair sub-fluxos compartilhados (envelope codex, gates G1-G7, scaffolds emit-time, verifier-exec, debug-techniques) para assets lazy referenciados por caminho — encolhendo o corpo resident e preservando a lógica load-bearing. Depende de F1 (verifier-exec.md nasce em T1.4).

**Tasks:**

| id | descrição | critério de aceitação |
|---|---|---|
| **T2.1** | Convenção Red Flags/Rationalization em todas. **Disposition:** KEEP inline em `fix.md`+`hunt.md` (os 2 permitidos); DELETE em `brainstorm.md`+`debate.md` (pura reafirmação, P3); MOVE `parallel-dispatch.md`+`parallel-dispatch-audit.md` → `skills/shared/parallel-dispatch-assets/rationalization.md`. Ponteiro lazy NÃO pode usar header `## Rationalization`. | `grep -rl '## Rationalization' [6 skills] | wc -l ≤ 2` |
| **T2.2** | Extrair esqueleto do envelope codex (11-12 passos byte-idênticos) → `skills/shared/codex-bridge-assets/envelope-orchestration.md`, parametrizado por slots; review-code/review-plan referenciam. Slot «TRIAGE_NOTES» preserva Verdict-line/early-exit do review-plan (P3). | `test -f envelope-orchestration.md && grep -q 'envelope-orchestration' review-code.md && … review-plan.md` |
| **T2.3** | Gates G1-G7 por referência: substituir paráfrases inline pelo one-liner que `code-quality-gates.md` prescreve, em brainstorm/hunt/fix/review-code. | `grep -rl 'code-quality-gates.md' [4 skills] | wc -l == 4` |
| **T2.4** | Scaffolds emit-time → `skills/shared/parallel-dispatch-assets/templates.md`; spec canônica do report; `parallel-dispatch.md` <13000B. | `test -f templates.md && wc -c < parallel-dispatch.md < 13000` |
| **T2.5** | Colapsar re-derivação de verifier-exec no `verify-claim` (step 4 → verdict-shape + ponteiro p/ verifier-exec.md). | `grep -q 'verifier-exec' verify-claim.md && grep -c 'testsCollected' ≤ 2` |
| **T2.6** | Reduzir debug-techniques inline em `fix.md` a gatilho + ponteiro p/ `debug-techniques.md`. | `grep -q 'debug-techniques' fix.md` |
| **T2.7** | Adicionar 3ª opção de remédio (colisão de escopo) apontando `worktree-isolation.md` em `parallel-dispatch.md`. | `grep -q 'worktree-isolation' parallel-dispatch.md` |

**Arquivos:** modificados `brainstorm.md`, `fix.md`, `hunt.md`, `parallel-dispatch.md`, `parallel-dispatch-audit.md`, `debate.md`, `review-code.md`, `review-plan.md`, `verify-claim.md`; **criados** `envelope-orchestration.md`, `parallel-dispatch-assets/rationalization.md`, `parallel-dispatch-assets/templates.md`.

**Exit gate:** **F2-G1 (met, 2026-06-16T18:56:10Z)** — `test -f envelope-orchestration.md && npm run validate-skills`. Evidence: file exists + "All 15 skills valid".

**Decisões-chave:** Executor **Mode 1** (Opus serial, ratificado) — 7 tasks colidem nos mesmos arquivos + verifiers são grep-floors fracos (dedup editorial é juízo). Ponteiro lazy não pode usar header `## Rationalization` (senão o grep contaria). «TRIAGE_NOTES» preserva o Verdict-line do review-plan. Codex review NÃO rodado no phase-done (mode local; 2 findings — 1 major + 1 minor — corrigidos em `2e09b596`).

**Itens em aberto:** lição **L-001** (UNION de placeholders ao extrair esqueleto compartilhado) destilada e ratificada; disposta para F3 via `list-lessons.js --phase F3`.

---

### F3 — Economia de tokens: per-skill
*(slug `…-f3-economia-de-tokens-per-skill`, subPhaseCount 5, dependsOn F2)*

**Objetivo:** reduzir custo de token **por-skill** movendo blocos mode-gated e branch-only de cada skill grande (review-code, review-plan, hunt, debate, init-memory) para assets lazy, carregando só o branch que roda.

**Tasks:**

| id | descrição | critério de aceitação |
|---|---|---|
| **T3.1** | `review-code`: mover blocos mode-gated (local-review, codex-subflow) + diff-capture para `skills/shared/local-review-assets/diff-capture.md` (movido por `sed -n '38,197p'` p/ manter algoritmo intacto). Step 0 mode-picker fica resident. <20000B. **ScopeBoundary:** não tocar Step 0; preservar algoritmo diff-shape. | `test -f diff-capture.md && wc -c < review-code.md < 20000` (→14797B) |
| **T3.2** | `review-plan`: mover Step 0c initiative-discovery + checks 14-20 + closing template → `skills/shared/project-assets/plan-initiative-depth.md`; HARD-GATE de iniciativa fica resident. <24000B. | `test -f plan-initiative-depth.md && wc -c < review-plan.md < 24000` (→22631B) |
| **T3.3** | `hunt`: mover Phase 0 directory-triage + report consolidado → `skills/shared/hunt-assets/directory-triage.md`, ponteiro de 2 linhas; unificar convention-detection. <14000B. **ScopeBoundary:** preservar Iron Law + single-file scope. | `test -f directory-triage.md && wc -c < hunt.md < 14000` (→11476B) |
| **T3.4** | `debate`: mover gate-mode → `skills/shared/debate-assets/gate-mode.md`; deletar 'why this matters' + 'where this fits' redundantes. <15000B. **ScopeBoundary:** não tocar Iron Law spawn-don't-roleplay nem Synthesis Handoff. | `test -f gate-mode.md && wc -c < debate.md < 15000` (→12431B) |
| **T3.5** | `init-memory`: router de scaffold + mover Step 5 Connect + Critical Context → `skills/modules/memory/_assets/connect.md`. <7800B. **ScopeBoundary:** não tocar steps iniciais de memory-structure-creation. | `test -f connect.md && wc -c < init-memory.md < 7800` (→7108B) |

**Arquivos:** modificados `review-code.md`, `review-plan.md`, `hunt.md`, `debate.md`, `init-memory.md`; **criados** `local-review-assets/diff-capture.md`, `project-assets/plan-initiative-depth.md`, `hunt-assets/directory-triage.md`, `debate-assets/gate-mode.md`, `memory/_assets/connect.md`, review file, `lessons/…-f3….md` (L-001, L-002).

**Exit gate:** **F3-G1 (met, 2026-06-16T19:32:13Z)** — `npm run validate-skills`. Evidence: "All 15 skills valid".

**Decisões-chave:** Routing **Mode 1** (opt-out Codex) — verifiers são proxy fraco (asset-exists + byte-size), não capturam preservação semântica; review-code de fim-de-fase é o check semântico. T3.1: **mover verbatim**, não parafrasear (slice programático). Lesson de F2 aplicada. Review em `--mode=local` (sealed envelope) — sinal **DESTRUCTIVE=TRUE foi falso-positivo** (doc de tokens relocado), override → local confirmado pelo operador; 2 minor (refs dangling de move-verbatim) aplicados em `aa1c16c`.

**Itens em aberto:** lições **L-001/L-002** disponibilizadas a F4 via `list-lessons.js --phase F4`; mudanças não-commitadas no handoff; ruído benigno de tracking-hook (`focus.json`, `last-session.json`).

---

### F4 — Feature: project review
*(slug `…-f4-feature-project-review`, subPhaseCount 3, dependsOn F3)*

**Objetivo:** dar ao `atomic-skills:project` um subcomando de auditoria que revisa um plano/iniciativa **materializado** compondo linters determinísticos, `verify`, `review-plan` e (opcionalmente) `review-code` — sem reimplementar máquina de review (delega e compõe). Para habilitar, `review-plan` primeiro ganha resolução de alvo (slug ou plano ativo) + auto-seed de cross-ref da frontmatter `references`/`supersedes`.

**Tasks:**

| id | descrição | critério de aceitação |
|---|---|---|
| **T4.1** | Estender parser de `review-plan.md`: resolver slug OU plano ativo quando o 1º token não é arquivo legível, reusando `## Initial detection` do router — ladder de 4 degraus (readable file → slug → active plan → abort), num `### Target resolution`. **ScopeBoundary:** não tocar HARD-GATEs nem codex sub-flow. | `grep -qiE 'slug|active.plan' review-plan.md` |
| **T4.2** | Pré-popular cross-ref de `references`/`supersedes` (frontmatter, L134/L138) ANTES do prose scan, mantendo flag manual como override (Step 0b step 1). **ScopeBoundary:** não remover prose scan nem flag manual. | `grep -qE 'references|supersedes' review-plan.md` |
| **T4.3** | Criar subcomando `project review`: resolve alvo, roda linters + `verify`, chama `review-plan` (+ `review-code` sob `--with-code`); wire na grammar + dispatch do router. Arquivos: `project.md`, `skills/shared/project-assets/project-review.md`. **ScopeBoundary:** NÃO duplicar lógica de review-plan; compõe, não reimplementa. | `test -f project-review.md && grep -q 'project review' project.md` |

**Arquivos:** modificados `review-plan.md`, `skills/core/project.md`; **criado** `skills/shared/project-assets/project-review.md`; review file; `lessons/…-f4….md` (L-001).

**Exit gate:** **F4-G1 (met, 2026-06-16T20:08:50/20:51:13Z)** — `test -f project-review.md && grep -q 'project review' project.md && grep -qiE 'review-plan|review-code|verify' project-review.md && npm run validate-skills`. Evidence: exit 0, "All 15 skills valid".

**Decisões-chave:** Routing **Mode 1** (registrado, não silencioso) — aceitação é juízo de qualidade de prosa mas verifiers são greps de presença (presence-floor); T4.3 precisa da estrutura de review-plan in-context para compor sem duplicar. `project review` **delega** e nunca reimplementa o checklist de review-plan. T4.1 reusa `## Initial detection` para o ladder de 4 degraus. phase-done: review-code `--mode=local`, verdict needs_changes→tudo fixado (1 major + 2 minor); lesson **L-001** (composition-skill non-interactive-guard) ratificada.

**Itens em aberto:** nada commitado no snapshot de handoff (phase-done é o commit point, opt-in); oferta de codex `review-due` NÃO tomada (lastReviewedCommit em outra branch `impl/design-brief-source-of-truth`); `weightDone 0/3` (anomalia de peso).

---

### F5 — Nova skill: design-brief
*(slug `…-f5-nova-skill-design-brief`, subPhaseCount 5, dependsOn F4)*

**Objetivo:** criar a skill **lean** `design-brief` que, a partir de um app real (código + product intent), gera prompts **DS-first** (Design System) e prompts de telas que **consomem o DS herdado** — sem contaminar a decisão visual. Anti-contaminação ancorada no **modelo de 3 camadas + R1–R9** de `docs/design/design-brief-three-layer-briefing.md`: silêncio só na forma visual (camada 1); modelo de interação (camada 2) e filosofia/quem-decide (camada 3) são blocos **obrigatórios por tela** com valores concretos minerados do código. Skill nasce enxuta, agnóstica (Lekto/FSRS só como gold example), usa variáveis de tool-abstraction.

**Tasks:**

| id | descrição | critério de aceitação (resumo) |
|---|---|---|
| **T5.1** | Corpo lean de `skills/core/design-brief.md`: Iron Law anti-contaminação (3 camadas), fluxo DS-first, input contract (código + product intent §1 + project plan), inventário de telas + coverage ledger, mineração R2 (timers/counts/lengths/modality/triggers/what-stays-hidden), omission audit R3 com **stop/ask** ao operador, language fixa (pt-BR), variáveis de tool-abstraction, ponteiros para assets. **ScopeBoundary:** NÃO embutir skeletons/fixtures no corpo. | `test -f design-brief.md` + greps `anti-contamin\|DS-first\|inherit`, `omiss\|three-layer`, `modality\|trigger`, `pt-BR\|language`, `intent`, `inventory\|coverage` |
| **T5.2** | `skills/shared/design-brief-assets/ds-prompt.md`: token contract semântico, inventário de componentes c/ estados, **exatamente 1** base template, restrições WCAG 2.2. **ScopeBoundary:** 1 template (não um set); templates por role, sem hardcode de componentes. | `test -f ds-prompt.md` + grep `1 template\|um template` |
| **T5.3** | `skills/shared/design-brief-assets/screens-prompt.md`: preâmbulo R9, blocos obrigatórios por tela 'Modelo de interação' (R4) + 'Filosofia/guardrails' (R5/R6), omission audit R3, template das **8 seções do §4** + states checklist (empty/loading/error/offline/first-time/populated), mobile+desktop, light+dark, fork-from-base, regra **stop-and-signal** se a tela precisar de algo fora do DS. **ScopeBoundary:** não redeclara tokens (consome por nome); interação por behavior attribute, nunca widget (R4); substituir-nunca-deletar (R7). | `test -f screens-prompt.md` + greps `inherit\|consum\|states`, `interaction model`, `philosophy\|guardrail`, `flow`, `signal` |
| **T5.4** | (a) `fixtures-recipe.md` de DADOS REAIS do app (seeders/tests/production; cardinalidade/length/distribution/edge-rows que carregam a textura, R8; sintético só fallback explícito); (b) `anti-contamination.md` com 3 camadas, tabela DEFINE/DECIDE, substituir-nunca-deletar (R7), omission audit (R3), checklist de aceitação §6 por tela. **ScopeBoundary:** dados reais c/ PII anonimizada; checklist converte requisito visual em restrição, nunca solução; codificar 3 camadas + R1–R9 agnosticamente. | `test -f fixtures-recipe.md && test -f anti-contamination.md` + greps `cardinality\|edge`, `real\|seeder\|produ`, `three-layer\|3 layers\|substitut\|replace`, `accept\|checklist` |
| **T5.5** | Registrar `design-brief` em `meta/catalog.yaml`; validação passa. **ScopeBoundary:** só adicionar design-brief. | `grep -q 'design-brief' meta/catalog.yaml && npm run validate-skills` |

**Arquivos:** **criados** `skills/core/design-brief.md`, `ds-prompt.md`, `screens-prompt.md`, `fixtures-recipe.md`, `anti-contamination.md`; modificados `meta/catalog.yaml`, `docs/design/design-brief-three-layer-briefing.md` (vendored, commit `e6f0199`); review record cross-model.

**Exit gate:** **F5-G1** — todos os 5 arquivos presentes + grep `design-brief-assets` em design-brief.md + grep `interaction model|philosophy|guardrail` e `signal` em screens-prompt.md + `three-layer|…|substitut|replace` e `accept|checklist` em anti-contamination.md + `real|seeder|produ` em fixtures-recipe.md + **negative grep** contra nomes de tool hardcoded (`Bash tool|Read tool|Write tool|Grep tool|Glob tool|Edit tool`) + validate-skills. **Discrepância de status:** *no master plan* = **pending** (sem metAt, sem evidence block, diferente de F1–F4/F6); *no doc da fase* = **met** (evidence exit 0, 5 files present, verifiedAt 2026-06-15T16:29:10Z). → ver §6.

**Decisões-chave:** **D5 reformulada** (post-mortem Lekto, 2026-06-15): anti-contaminação deixa de ser só vocabulário-banido + silêncio e vira **3 camadas + R1–R9**. Silêncio só na camada 1 (forma visual). Decidido com operador (4 respostas): delivery = atualizar o plano e parar; parâmetros via auto-extração + audit interativo; skill agnóstica. **Review cross-model** (codex gpt-5-codex, mode=both): 5 majors absorvidos (inventário+ledger §7; fixtures reais R8; product intent input explícito §1; tool-abstraction obrigatória; gate reforçado). Limite reconhecido: greps são **necessary-not-sufficient** — fidelidade R1–R9/§4/§6 é selada pela review Opus no phase-done.

**Itens em aberto:** Codex review NÃO executado no phase-done (gate local-only por opção do operador, `36a6e16..HEAD`); 4 minor de self-review aplicados (#1 'reversibility' restaurado; #2 lista de widgets proibidos R4 restaurada; #3 `dependencies:[git]` não-usado removido; #4 output markdown explícito p/ justificar `mutates_repo:true`). **F5 é a única fase SEM lesson file** em `lessons/`.

---

### F6 — focus.json não drifta silenciosamente
*(slug `…-f6-focus-json-auto-refresh`, subPhaseCount 2, dependsOn: nenhuma — independente, emergent rung 6, ratificada por humano)*

**Objetivo:** fechar o gap em que o `focus.json` (digest plano consumido pela statusline claudebar) fica **stale** porque seu auto-refresh dependia do passo interativo opcional `project-setup §5` — i.e., `atomic-skills install` sozinho deixa o digest velho. Fix estrutural em 2 eixos: **portável** (o fluxo de transição regenera via `refresh-state`) e **instalável** (`install` conecta os hooks de project-status, com paridade uninstall).

**Tasks:**

| id | descrição | critério de aceitação |
|---|---|---|
| **T6.1** | (fix portável) Trocar o recompute step das transições done/reconcile/phase-done/switch de `node scripts/compute-rollups.js` para `node scripts/refresh-state.js` (rollups + reconcile-focus + emit-focus num passo), em `project-transitions.md`. **ScopeBoundary:** só a invocação do recompute; não alterar GATE-R2 nem os scripts (refresh-state.js já existe). | `grep -q 'refresh-state' project-transitions.md && npm run validate-skills` |
| **T6.2** | (fix instalável) `src/install.js` stage `.atomic-skills/status/hooks/{session-start,stop,pre-write}.sh` + `config.json` e registra SessionStart+Stop em `settings.local.json` (project-scope), com reversal em `src/uninstall.js` (HARD RULE de paridade) + cobertura no round-trip test. **ScopeBoundary:** não tocar o auto-update hook (version-check.sh); paridade byte-for-byte ou allowlist em CLAUDE.md; PreToolUse/pre-write staged mas NÃO registrado. | `node --test tests/install-uninstall-roundtrip.test.js` |

**Arquivos:** modificados `project-transitions.md`, `src/install.js` (`installProjectStatusHooks`, `settingsLocalCreated`), `src/uninstall.js` (`removeProjectStatusHooks`), `tests/install-uninstall-roundtrip.test.js`, `focus.json`, descritor da fase; criados `lessons/…-f6….md` (L-F6-1), review file.

**Exit gate:** **F6-G1 (met, 2026-06-16T16:29:42Z)** — `grep -q 'refresh-state' project-transitions.md && node --test tests/install-uninstall-roundtrip.test.js && npm run validate-skills`. Evidence: grep OK; round-trip 8/8 (após 3 fixes de review-gate); "All 15 skills valid".

**Decisões-chave:** **F6-G1 deliberadamente desacoplado de `npm test`** — o bloco ratificado usava `npm test`, mas as **8 falhas de contagem** (countSkills/installSkills) são delegadas à branch de finalização; usar `npm test` bloquearia o phase-done. `refresh-state.js` já agrega os 3 passos — T6.1 só re-aponta. Convenções T6.2: `settings.local.json` (não settings.json), project-scope, comando `"$CLAUDE_PROJECT_DIR/.atomic-skills/status/hooks/<script>.sh"`; pre-write staged mas não registrado (enforcement pertence ao project-setup). Paridade provada empiricamente (baseline via git stash = 0 líquido). Codex review **SKIPPED** (mode local; diff aditivo 247/27); **4 findings reais achados E corrigidos in-phase** (1 major ex-critical + 1 major + 2 minor) via TDD; o fix de sticky-flag também fechou o mesmo resíduo no auto-update hook precedente.

**Itens em aberto:** 8 falhas pré-existentes delegadas à finalização (0 líquido em T6.2); **FU-F1-1** pendente (fora do escopo de F6); range de review-code provável `d4414fc..HEAD` a verificar; pre-write hook intencionalmente não-registrado (enforcement = project-setup).

---

## 4. Skills geradas/alteradas — checklist mestre para auditoria

> Lista consolidada e deduplicada de cada skill/arquivo que o plano tocou. **Fase dona** = onde foi criado/originado; ações posteriores anotadas.

### Skills core / módulos (skills/)
| Arquivo | Fase dona | Ação | Propósito numa linha |
|---|---|---|---|
| `skills/core/project.md` | F1 | modificado (F0/T0.2-4, F1/T1.1, F4/T4.3) | Router fino <22000B; cheat-sheets; wire de `project review` + dispatch |
| `skills/core/implement.md` | F1 | modificado (T1.2, T1.3) | Driver enxuto <22000B; Red Flags só gatilhos; Mode-2 stub→`mode2-codex-lane` |
| `skills/core/review-code.md` | F2 | modificado (T2.2, T2.3, F3/T3.1) | Referencia envelope-orchestration + cq-gates; diff-capture → asset; <20000B |
| `skills/core/review-plan.md` | F2 | modificado (T2.2, F3/T3.2, F4/T4.1-2) | Referencia envelope; initiative-depth → asset; Target resolution + cross-ref seeding |
| `skills/core/hunt.md` | F2 | modificado (T2.1 KEEP, T2.3, F3/T3.3) | Mantém Rationalization; ref cq-gates; directory-triage → asset; <14000B |
| `skills/core/fix.md` | F2 | modificado (T2.1 KEEP, T2.3, T2.6) | Mantém Rationalization; ref cq-gates + debug-techniques |
| `skills/core/brainstorm.md` | F2 | modificado (T2.1 DELETE, T2.3) | Deleta Rationalization reafirmante; ref cq-gates |
| `skills/core/debate.md` | F2 | modificado (T2.1 DELETE, F3/T3.4) | Deleta Rationalization; gate-mode → asset; remove why/where; <15000B |
| `skills/core/parallel-dispatch.md` | F2 | modificado (T2.1 MOVE, T2.4, T2.7) | Rationalization+scaffolds → assets; ponteiro worktree-isolation; <13000B |
| `skills/core/parallel-dispatch-audit.md` | F2 | modificado (T2.1 MOVE, T2.4) | Rationalization+scaffolds → assets (spec canônica do report) |
| `skills/core/verify-claim.md` | F2 | modificado (T2.5) | Step 4 → verdict-shape + ponteiro verifier-exec; testsCollected ≤2 |
| `skills/core/design-brief.md` | F5 | **criado** | Corpo lean: anti-contaminação 3 camadas, DS-first, input contract, inventário+ledger, R2/R3 |
| `skills/modules/memory/init-memory.md` | F3 | modificado (T3.5) | Scaffold router; Step 5 + Critical Context → asset; <7800B |

### Assets compartilhados (skills/shared/, skills/modules/.../_assets/)
| Arquivo | Fase dona | Ação | Propósito |
|---|---|---|---|
| `skills/shared/implement-antipatterns.md` | F1 | **criado** | Tabela Temptation→Reality lazy (de implement) |
| `skills/shared/mode2-codex-lane.md` | F1 | modificado | Fonte única do contrato Mode-2 |
| `skills/shared/project-assets/verifier-exec.md` | F1 | **criado** | Fonte única dos padrões de execução de verifier |
| `skills/shared/project-assets/project-transitions.md` | F1 | modificado (T1.1, T1.4, F6/T6.1) | Recebe rollups/focus; hot/cold split; refresh-state como recompute aggregator |
| `skills/shared/project-assets/project-create-plan.md` | F0/F1 | modificado (T0.1, T1.1) | "9 stages"; recebe field-reference/summaries/level-hygiene/cq-gates |
| `skills/shared/project-assets/project-drift.md` | F0 | modificado (T0.5) | Caminho morto → slug `atomic-skills:review-code` |
| `skills/shared/project-assets/project-view.md` | F0 | modificado (T0.7) | Remove `AIDECK_STATE_DOMAIN` dangling |
| `skills/shared/codex-bridge-assets/envelope-orchestration.md` | F2 | **criado** | Esqueleto 12-step do envelope codex (slots) — satisfaz F2-G1 |
| `skills/shared/parallel-dispatch-assets/rationalization.md` | F2 | **criado** | Rationalization lazy (parallel-dispatch + audit) |
| `skills/shared/parallel-dispatch-assets/templates.md` | F2 | **criado** | Scaffolds emit-time + spec canônica do report |
| `skills/shared/local-review-assets/diff-capture.md` | F3 | **criado** | Diff-capture contract + destructive-diff signal lazy |
| `skills/shared/project-assets/plan-initiative-depth.md` | F3 | **criado** | Step 0c initiative-discovery + checks 14-20 + closing |
| `skills/shared/hunt-assets/directory-triage.md` | F3 | **criado** | Phase 0 directory-triage + report consolidado |
| `skills/shared/debate-assets/gate-mode.md` | F3 | **criado** | Bloco gate-mode lazy |
| `skills/modules/memory/_assets/connect.md` | F3 | **criado** | Step 5 Connect + Critical Context lazy |
| `skills/shared/project-assets/project-review.md` | F4 | **criado** | Subcomando `project review` (composição; delega) |
| `skills/shared/design-brief-assets/ds-prompt.md` | F5 | **criado** | DS prompt: tokens + componentes + 1 base template + WCAG 2.2 |
| `skills/shared/design-brief-assets/screens-prompt.md` | F5 | **criado** | Screens prompt: R9, Modelo de interação + Filosofia/guardrails, 8 seções §4 |
| `skills/shared/design-brief-assets/fixtures-recipe.md` | F5 | **criado** | Fixtures de dados reais (cardinalidade/edge-rows, textura R8) |
| `skills/shared/design-brief-assets/anti-contamination.md` | F5 | **criado** | 3 camadas, DEFINE/DECIDE, R7, R3, checklist §6 |

### Código / testes / config / docs
| Arquivo | Fase dona | Ação | Propósito |
|---|---|---|---|
| `src/decompose.js` | F1 | modificado (T1.5) | H3-mode parseia interior SPEC e mapeia ao schema |
| `tests/decompose.test.js` | F1 | modificado (T1.5) | 5 testes RED→GREEN de parsing H3 |
| `tests/project.test.js` | F1 | modificado (fix-forward) | 2 testes apontando aos novos locais |
| `src/install.js` | F6 | modificado (T6.2) | Stage hooks project-status + registra SessionStart/Stop |
| `src/uninstall.js` | F6 | modificado (T6.2) | Reversal (paridade HARD RULE) |
| `tests/install-uninstall-roundtrip.test.js` | F6 | modificado (T6.2) | Cobertura de paridade (re-install/scope/preservação) |
| `docs/kb/code-quality-gates.md` | F0 | modificado (T0.6) | Seção **G9 — Mutation-kill** |
| `meta/catalog.yaml` | F5 | modificado (T5.5) | Registra `design-brief` |
| `docs/design/design-brief-three-layer-briefing.md` | F5 | vendored/modificado | Spec canônica 3 camadas + R1–R9 (gold example Lekto) |
| `docs/audits/project-implement-audit-2026-06-15.md` | (fonte) | gerado | Fonte normativa F0 |
| `docs/audits/token-economy-all-skills-2026-06-15.md` | (fonte) | gerado | Fonte normativa F1/F2/F3 (~21,7k tokens) |
| `skills/shared/debug-techniques.md`, `…/worktree-isolation.md` | (referências F2) | referenciados (T2.6/T2.7) | Alvos de ponteiro — **se foram criados ou já existiam: não declarado** |

> **Nota de auditoria:** `subPhaseCount` no master diverge da contagem real de tasks em algumas fases (F1: subPhaseCount 4 vs 5 tasks T1.1–T1.5). A contagem autoritativa de tasks está nos docs de fase, não no master.

---

## 5. Decisões e restrições transversais

- **P1 — Single-source-of-truth:** um contrato vive em exatamente um arquivo; os demais apontam por ponteiro, nunca recopiam.
- **P2 — Lazy-load não recolapsa:** só gatilhos de ambiente (Iron Laws, gates, emergence ladder) ficam resident; o resto vai para detail/asset lazy. Guardrail explícito: lazy-load não pode recolapsar de volta para o corpo.
- **P3 — Preservar comportamento:** mover/relocar conteúdo, nunca reescrever semântica; **GATE-R2 determinístico permanece intacto** (sem troca por LLM-judge); ao tornar lazy, mover o algoritmo determinístico íntegro — nunca substituir por "o modelo decide".
- **P4 — Verifier determinístico por task:** toda task fecha só com evidência de um verifier shell/test/query. Sinal recorrente de aceitação: `npm run validate-skills` exit 0 em todas as fases.
- **P5 — design-brief não contamina:** silêncio só na camada 1 (forma visual = silêncio do designer); camadas 2 (modelo de interação) e 3 (filosofia/quem-decide) = produto, especificadas com valores concretos em blocos obrigatórios por tela.
- **Execução:** planejada via **codex (Mode 2) + review Opus**; na prática **todas** as fases rodaram em **Mode 1** (opt-out registrado, não silencioso) por overlap de arquivos, `parallelismAllowed:false`, ou verifiers serem grep-floors fracos.
- **Cadeia de dependência:** F0→F1→F2→F3→F4→F5 linear; **F6 independente** (dependsOn vazio, emergent, off-chain). Catch 2: F3 depende de F1/T1.4 (`verifier-exec.md` nasce lá).
- **HARD RULE install↔uninstall (F6):** toda mutação persistente do install.js tem reversal correspondente no uninstall.js ou allowlist deliberada em CLAUDE.md; round-trip retorna ao baseline byte-for-byte.
- **Lista canônica de fases** vive na frontmatter `phases:`; aiDeck renderiza a árvore (o corpo §3 é ponteiro, não duplicata).
- **Guardrails do design-brief:** nunca hardcodar nomes de componente de projeto (Lekto/FSRS só gold example); templates por role/archetype; abstrair o parâmetro load-bearing ("uma escala curta" em vez de "~3 níveis; ritmo de segundos; ~8s") é exatamente a falha que a skill existe para prevenir (R2); não regredir para under-specification; usar variáveis de tool-abstraction (sem nomes de tool hardcoded).
- **Não otimizar** `prompt` nem `save-and-push` (já enxutos; tocar piora).
- **Lessons:** todas com `scope: reusable, status: open, confidence: 2, schemaVersion 0.2`, surfaçadas a cada fase via `list-lessons.js --phase`.
- **Blast radius:** ALTO = F1 (corpos carregados a cada invocação); MÉDIO = F2/F3 (muitas skills, uma receita repetida — risco de aplicação inconsistente); BAIXO = F0 (doc), F4 (subcomando aditivo), F5 (skill nova).

---

## 6. Pontos de atenção para a auditoria

**Inconsistências de status declarado (ambiguidade documental):**
1. **Master plan `currentPhase: F4`** mas todas as 7 fases `done` e `status: archived` — o cabeçalho do master não acompanhou o avanço.
2. **F0-G1 = pending no master plan** (sem met/evidence) embora a fase esteja `done`; o **doc da fase F0** diz met (2026-06-16, evidence "All 15 skills valid"). A passagem do validate-skills é asserida mas, no master, não evidenciada.
3. **F5-G1 = pending no master plan** (sem `metAt`, sem evidence block, diferente de F1–F4/F6) embora a fase esteja `done`; o **doc da fase F5** diz met (verifiedAt 2026-06-15T16:29:10Z, exit 0, 5 files present). **Divergência master↔fase a reconciliar.**

**Verificabilidade necessária-não-suficiente (tema recorrente nas reviews):**
4. Gates passam por **existência de arquivo / keyword** sem provar o comportamento prometido. Findings de plano F-003/F-004/F-005 (codex) reforçaram gates de F1/F4/F5. **F5 explicitamente reconhece** que greps são necessary-not-sufficient — a fidelidade de R1–R9/§4/§6 é selada pela **review Opus no phase-done**, não pelo grep. Auditar: a codificação fiel realmente ocorreu, não só os markers grep.

**Deferrals e dívida fora-de-escopo:**
5. **FU-F1-1 (major, DEFERRED):** SPEC gate admite `verifier: kind shell` sem command; `parseTaskVerifier` (T1.5) materializa `{kind:shell}` schema-inválido que HARD-fail no validate-state. Mecanismo: `isDeterministicVerifier` decide só pelo token `kind` (lint-source.js:273-280); `lintSpec` só gate de existência (351-356); spread em decompose.js:877. Deferido a task `atomic-skills:fix` dedicada (toca lint-source.js, fora do diff F1) — **status de resolução: não declarado** (era aberto ao fim do plano). Minor associado (branch bare-verifier sem teste) bundled com o fix.
6. **8 falhas pré-existentes** (3× countSkills esperando '13 core' / catalog tem 14 após F5; 5× installSkills) **red desde F5** — nenhum gate roda `npm test`; **delegadas à branch de finalização**. F6-G1 foi deliberadamente desacoplado de `npm test` por causa delas. **Resolução: não declarada** (fora deste plano).
7. **Consolidação de 3 worktrees** (design-brief, fix-aideck, multiplan) + merge final delegados a branch de finalização conduzida por outro agente; conflito conhecido em `implement.md` (reescrito na F1 vs editado em `plan/multiplan-focus`).

**Reviews sem Pass-2 limpo registrado:**
8. **Plano (2026-06-15):** codex Pass 1 = needs_changes (0B/0C/5M); o doc diz CRITICAL + 5 majors aplicados mas **não registra verdict de Pass 2 codex limpo**.
9. **Codex review SKIPPED no phase-done de F1, F2, F3, F4, F5, F6** (todas rodaram `--mode=local`). Overrides registrados; em F3 e F5 o sinal **DESTRUCTIVE foi falso-positivo** (doc de tokens / vocabulário relocado verbatim). Auditar se a ausência de cross-model deixou algo passar.

**Artefatos de move-verbatim (risco de regressão silenciosa):**
10. F3 lições L-001 (refs relativas 'above'/'below'/'this skill' dangling após mover para asset standalone) e L-002 (DESTRUCTIVE falso-positivo por doc relocado). Auditar cada asset criado por grep `above|below|this skill|this section` resolvendo cada hit.
11. F2 L-001 (UNION de placeholders): `{{ARTIFACT_PATH}}` órfão no envelope — corrigido em `2e09b596`, mas auditar se **todos** os leaf-templates têm substituição.

**Anomalias menores:**
12. F4 `weightDone 0/3` (pesos zerados apesar de tasks done).
13. `subPhaseCount` no master diverge da contagem real de tasks (ex.: F1 subPhaseCount 4 vs 5 tasks).
14. `skills/shared/debug-techniques.md` e `skills/shared/worktree-isolation.md` são **alvos de ponteiro** em F2 (T2.6/T2.7) — se já existiam ou foram criados nesta restruturação: **não declarado**.