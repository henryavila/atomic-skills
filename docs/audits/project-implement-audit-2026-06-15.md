# Auditoria — skills project + implement (2026-06-15)

> Pente-fino final das skills `atomic-skills:project` (router fino + assets lazy em
> `skills/shared/project-assets/`) e `atomic-skills:implement` (driver de execução
> single-threaded no fim do ciclo DESIGN→PLAN→DECOMPOSE+SPEC→IMPLEMENT→VERIFY).
> Achados já verificados adversarialmente (`isReal=true`) + benchmark contra
> pesquisa externa de boas práticas. Todas as localizações em `file:line`.

## Sumário executivo

- **Estado geral: sólido.** A arquitetura central está alinhada com as boas práticas de ponta — separação planner/executor com viés cross-model real (Opus planeja+revisa / Codex executa; o schema rejeita Opus como executor), "done" definido por verifier determinístico (GATE-R2 hard-fail sem `evidence.passed===true`), estado durável em disco (`.atomic-skills/`) com resume por artefato, merge-back serial com re-verify na árvore mesclada, reconciliação detect-report-reconcile idempotente e lazy-load de três níveis. Nenhuma destas invariantes load-bearing está quebrada.
- **Nenhum achado CRITICAL ou HIGH.** Todo o risco é de **manutenibilidade/precisão documental**: contagens e referências que ficaram defasadas após movimentações (flatten do diretório `en/`, renumeração de stages) e cheat-sheets de schema que omitem campos válidos.
- **Risco principal nº1 — drift de single-source-of-truth.** O contrato Mode-2 está reescrito por inteiro em 4 lugares (`implement.md` ×3 + `mode2-codex-lane.md`), e o drift já é visível (a cláusula "schema default stays false" existe em só uma das cópias). Cada cópia pode divergir independentemente — exatamente o anti-padrão que a própria `mode2-codex-lane.md` se declara fonte única para evitar.
- **Risco principal nº2 — cheat-sheets de schema subespecificados.** O quick-reference em `project.md` omite campos que **outras seções do mesmo arquivo** exigem (`Task.summary`/`Task.evidence`, `PhaseDescriptor.summary`/`provenance`/`context`, e os 5 campos 0.2 do verifier `manual`). Um leitor que tratar o cheat-sheet como autoritativo escreve estado incompleto.
- **Risco principal nº3 — referências mortas e registry de gates incompleto.** `skills/en/core/review-code.md` (drift.md:73) é um caminho morto pós-flatten; o gate-id `G9 mutation-kill` é citado na skill mas ausente do registry canônico (`code-quality-gates.md` para em G8).
- **Recomendação macro:** quick-wins documentais (corrigir contagem de stages, caminho morto, registrar G9, completar cheat-sheets) + uma consolidação estrutural do contrato Mode-2 para uma única fonte. Todas as forças listadas na seção de benchmark devem ser **preservadas** e protegidas contra regressão em futuras edições.

## Achados por severidade

> Achados sobrepostos entre dimensões foram fundidos numa única entrada citando todas as localizações.

### CRITICAL
_(nenhum)_

### HIGH
_(nenhum)_

### MEDIUM

#### M1 — Contrato Codex/Mode-2 reescrito por inteiro em 4 lugares; drift já presente
- **Dimensão:** duplicação / bloat
- **Localizações:** `skills/core/implement.md:77-83` (prosa completa), `skills/core/implement.md:122-130` (Red Flags), `skills/core/implement.md:146-148` (tabela Rationalization), `skills/shared/mode2-codex-lane.md:13-23`, `:27-52`, `:80-97`.
- **Evidência:** o contrato Mode-2 completo — "Codex é o DEFAULT quando a lane está ligada; Mode 1 é fallback; o operador opta OUT não IN; qualidade carregada por spec+verifier não pela identidade do executor; F1 spec-readiness + F2 verifier determinístico; state-tree fence (Codex nunca escreve `.atomic-skills/`)" — está autorado por extenso em `implement.md:77-83` **E de novo** por inteiro em `mode2-codex-lane.md`, que o próprio `implement.md:79` nomeia como fonte única ("The full lane mechanics … live in `skills/shared/mode2-codex-lane.md`"). **Drift já visível:** `implement.md:81` diz "absent file ⇒ Mode-1 defaults"; `mode2-codex-lane.md` acrescenta "the shipped schema default stays false" — a cláusula schema-default vive em só uma das duas cópias, então quem ler só `implement.md` perde a informação. O mesmo contrato aparece uma **terceira** vez em Red Flags (`:122-123`) e uma **quarta** na tabela Rationalization (`:146-147`).
- **Recomendação:** tornar `mode2-codex-lane.md` a fonte única (ela já se declara assim). Em `implement.md:77-83` manter só: (1) a frase de uma linha default/fallback, (2) a condição de enable em `routing.json`, (3) o one-liner do state-tree fence, (4) o ponteiro para `mode2-codex-lane.md`. Deletar a re-derivação de F1/F2, o "opts OUT not IN" e o racional SDD (pertencem à `mode2`). Nas Red Flags/Rationalization, colapsar as 4 linhas Codex em 2 que **citam** a regra em vez de re-explicá-la.

#### M2 — `project-create-plan.md` diz "7 stages" mas o fluxo roda Stage 1 a Stage 9
- **Dimensão:** contradição entre seções
- **Localizações:** `skills/shared/project-assets/project-create-plan.md:24` (heading), bodies `:28,:34,:42,:48,:76,:92,:141,:146,:171` (Stage 1–9).
- **Evidência:** o heading em `:24` lê `## Default flow — 7 stages` seguido de "Stages run in order.", mas o grep de `^### Stage [0-9]` retorna nove stages: Stage 1 (Validate slug, `:28`), 2 (DESIGN, `:34`), 3 (Plan input source, `:42`), 4 (Receive markdown plan, `:48`), 5 (Decompose, `:76`), 6 (Create Plan + Initiatives, `:92`), 7 (Activate first phase, `:141`), 8 (Adversarial review, `:146`), 9 (Announce, `:171`). A contagem está defasada em 2; as referências de cross-stage ("Stage 8a internal review", "Stage 6 writes") dependem desses números serem estáveis.
- **Recomendação:** atualizar o heading `:24` para `## Default flow — 9 stages`. Os bodies (Stage 1–9) são a fonte de verdade; a contagem no heading é o lado defasado.

#### M3 — Cheat-sheet de Task omite `summary` e `evidence` (campos que a própria skill exige)
- **Dimensão:** drift de schema
- **Localizações:** `skills/core/project.md:144` (lista de opcionais de Task), `initiative.schema.json:173` (`task.summary`), `initiative.schema.json:209-212` (`task.evidence`).
- **Evidência:** `project.md:144` lista os opcionais de Task como `description, closedAt, blockedBy[], outputs[], tags[], resourceCounts, scopeBoundary[], acceptance[] (max 5), verifier, provenance, context` — omite `summary` e `evidence`. Mas `initiative.schema.json:173` define `task.summary` ("shown on the dashboard Home (Agora task table)"), e a própria seção "Task summaries" (`project.md:158`) é inteira sobre escrever `tasks[].summary`. `initiative.schema.json:209` define `task.evidence` — o campo exato que GATE-R2 lê (`validate-state.js:314 checkClaim(\`task …\`, task.verifier, task.evidence)`) e que `implement.md:45` usa no `done`. O cheat-sheet contradiz duas outras seções do mesmo arquivo.
- **Recomendação:** adicionar `summary` e `evidence` à lista de opcionais em `project.md:144`: `Optional: summary, description, closedAt, blockedBy[], outputs[], tags[], resourceCounts, scopeBoundary[], acceptance[] (max 5), verifier, evidence (resultado por-task do verifier; GATE-R2), provenance, context.`

#### M4 — Cheat-sheet de PhaseDescriptor omite `summary`, `provenance` e `context`
- **Dimensão:** drift de schema
- **Localizações:** `skills/core/project.md:139` (opcionais de PhaseDescriptor), `plan.schema.json:128` (`summary`), `plan.schema.json:167-168` (`provenance`/`context`).
- **Evidência:** `project.md:139` lista opcionais como `parallelWith[], track, audience, externalImports[], exitGateType`. O `$defs/phaseDescriptor` declara ainda `summary` (`plan.schema.json:128`, "Shown on the dashboard Home timeline"), `provenance` (`:167`) e `context` (`:168`, com `allOf` em `:170-176` forçando `context` quando `provenance` está presente). A omissão de `summary` é auto-contradição: `project.md:156` ("Phase summaries") manda autorar `plan.phases[].summary` em toda phase. `provenance`/`context` são os campos da emergence-ladder (`project.md:104-119`).
- **Recomendação:** adicionar em `project.md:139`: `Optional: summary, parallelWith[], track, audience, externalImports[], exitGateType, provenance, context (provenance ⇒ context obrigatório).`

### LOW

#### L1 — `skills/en/core/review-code.md` é caminho morto pós-flatten do diretório `en/`
- **Dimensão:** resíduo + contradição (fundido)
- **Localizações:** `skills/shared/project-assets/project-drift.md:73`; convenção correta em `project-transitions.md:119,:121,:132` e em `drift.md:122,:132`.
- **Evidência:** `drift.md:73` cita o review-code por caminho concreto: "(see `skills/en/core/review-code.md` — the codex sub-flow inside `review-code`)". Não existe diretório `skills/en/` no repo (`find skills -type d -name en` → vazio); o arquivo real é `skills/core/review-code.md`. As únicas outras ocorrências de `skills/en/` estão num doc histórico de planejamento (`docs/plan-review-merge-codex.md`), confirmando que o layer de locale `en/` foi removido e as skills foram achatadas para `skills/core/`. Toda outra referência no cluster usa o slug namespaced: `transitions.md:119` "run `atomic-skills:review-code`", `:121`, `:132`, e a própria `drift.md` em outras linhas.
- **Recomendação:** trocar o caminho em `drift.md:73` pelo slug `atomic-skills:review-code` (convenção usada em todo o resto) ou pelo caminho concreto correto `skills/core/review-code.md`. Opcional: grep do repo por `skills/en/` para limpar qualquer outra ocorrência viva (não-histórica).

#### L2 — Gate `G9 mutation-kill` citado como gate-id mas ausente do registry canônico
- **Dimensão:** drift de schema / resíduo (fundido)
- **Localizações:** `skills/shared/project-assets/project-transitions.md:174` (comentário inline `# test only, OPTIONAL (G9 mutation-kill)`), `:235` (bloco de definição inline), `docs/kb/code-quality-gates.md` (registry para em `## G8 — React hook safety`, linha 224).
- **Evidência:** `project-transitions.md` cita `G9 mutation-kill` duas vezes, mas o registry canônico `docs/kb/code-quality-gates.md` só define G1–G8 (`grep -c '^## G9'` → 0; último heading `## G8` em `:224`). O próprio arquivo instrui "When you find a new failure mode … add G8 here, then propagate the reference" — i.e., novos gates devem ser registrados ali primeiro. G9 está auto-definido inline na skill e em design docs (`04-gate-system-spec.md`, `05-fork-resolutions.md`, `07-inc0-inc1-implementation-notes.md`), então não é estritamente dangling, mas o registry de gate-ids e a prosa da skill divergiram.
- **Recomendação:** adicionar `## G9 — Mutation-kill (behavioral-test gate)` em `docs/kb/code-quality-gates.md` espelhando a definição inline de `project-transitions.md:235`, depois fazer a skill referenciar G9 por id (como faz com G1/G2/G6). Restaura a invariante de fonte-única que o próprio doc declara.

#### L3 — `project-view.md` cita `AIDECK_STATE_DOMAIN`, ausente do bloco CONTRACT que ele aponta
- **Dimensão:** contradição entre seções
- **Localizações:** `skills/shared/project-assets/project-view.md:59` (prosa do step 1), `project-view.md:11-33` (bloco AIDECK CONTRACT).
- **Evidência:** `project-view.md:59` diz "The `AIDECK_STATE_DOMAIN` / `AIDECK_BIN` / `DASHBOARD_DIR` values come from the AIDECK CONTRACT block above". Mas o bloco CONTRACT (`:11-33`) declara só `AIDECK_BIN` (`:27`), `DASHBOARD_DIR` (`:28`) e dinamicamente `AIDECK_CONSUMER`/`AIDECK_URL` — **não há** `AIDECK_STATE_DOMAIN` em parte alguma do bloco ou do arquivo. O preâmbulo do bloco (`:9`) ainda afirma "Nothing else … hardcodes the domain string". `AIDECK_STATE_DOMAIN` é referência dangling (parâmetro de domain-string pré-rewrite removido do contrato mas ainda nomeado na prosa). O script ensure-aideck (`:61-130`) nunca usa `AIDECK_STATE_DOMAIN`.
- **Recomendação:** deletar `AIDECK_STATE_DOMAIN` da frase em `project-view.md:59` — o bloco CONTRACT (fonte única que a frase aponta) está correto; a prosa é stale. Os dois valores restantes (`AIDECK_BIN`, `DASHBOARD_DIR`) são reais.

#### L4 — Cheat-sheet de ExitCriterionVerifier mostra só o shape 0.1 do `manual`, omitindo os campos 0.2
- **Dimensão:** drift de schema
- **Localizações:** `skills/core/project.md:141` (oneOf de ExitCriterionVerifier), `common.schema.json:128-160` (branch `manual`).
- **Evidência:** `project.md:141` renderiza o branch manual como `{kind: manual, description}`. O schema (`common.schema.json:128-160`) exige só `kind`+`description` (logo o required do cheat-sheet está correto) mas adiciona 5 campos opcionais 0.2 ativamente definidos: `demoCommand` (`:138`), `fallbackKind` enum [ui|cli|library|api] (`:140-144`), `steps[]` (`:145-149`), `expected[]` (`:150-154`), `data` (`:155-158`). A superfície manual-gate 0.2 fica invisível. Os branches shell/query/test em `project.md:141` batem com o schema (`common.schema.json:96-127`) exatamente.
- **Recomendação:** anotar o branch manual com seus opcionais 0.2 — `{kind: manual, description, demoCommand?, fallbackKind?, steps[]?, expected[]?, data?}` — ou um parêntese "(manual carrega campos 0.2 de acceptance-script; ver `common.schema.json`)".

## Resíduo & referências quebradas

| Item | Localização | Estado | Ação |
|---|---|---|---|
| Caminho morto `skills/en/core/review-code.md` (flatten do layer `en/`) | `project-drift.md:73` | Caminho não existe; real é `skills/core/review-code.md` | Trocar pelo slug `atomic-skills:review-code` (L1) |
| Ref dangling `AIDECK_STATE_DOMAIN` (param pré-rewrite removido do contrato) | `project-view.md:59` | Não declarado em `:11-33` nem no script `:61-130` | Deletar da frase (L3) |
| Gate-id `G9 mutation-kill` citado sem entrada no registry | `project-transitions.md:174,:235` vs `code-quality-gates.md:224` (para em G8) | Auto-definido inline; registry incompleto | Registrar `## G9` no registry (L2) |
| Ocorrências `skills/en/` em doc histórico | `docs/plan-review-merge-codex.md` | Histórico (planejamento) — **não** é resíduo vivo | Deixar; confirma a origem do flatten |

## Inconsistências entre arquivos

| Inconsistência | Lado correto (SoT) | Lado defasado | Severidade |
|---|---|---|---|
| "7 stages" no heading vs 9 stages no corpo | bodies Stage 1–9 (`create-plan.md:28…:171`) | heading `create-plan.md:24` | MEDIUM (M2) |
| Cheat-sheet Task sem `summary`/`evidence` que outras seções exigem | seção "Task summaries" `project.md:158` + schema `initiative.schema.json:173,209` | lista `project.md:144` | MEDIUM (M3) |
| Cheat-sheet PhaseDescriptor sem `summary`/`provenance`/`context` | seção "Phase summaries" `project.md:156` + schema `plan.schema.json:128,167-168` | lista `project.md:139` | MEDIUM (M4) |
| `review-code` por caminho `skills/en/...` vs slug em todo o resto | slug `atomic-skills:review-code` (`transitions.md:119,121,132`) | caminho `drift.md:73` | LOW (L1) |
| `AIDECK_STATE_DOMAIN` na prosa vs ausente no contrato | bloco CONTRACT `project-view.md:11-33` | prosa `project-view.md:59` | LOW (L3) |
| Cláusula "schema default stays false" só em uma cópia do contrato Mode-2 | `mode2-codex-lane.md` | `implement.md:81` | MEDIUM (raiz: M1) |

## Drift de schema/script

| Campo/Gate | Definido em (schema/registry) | Citado/omitido em (skill) | Tipo de drift |
|---|---|---|---|
| `task.summary` | `initiative.schema.json:173` | omitido em `project.md:144` (mas exigido em `:158`) | omissão no cheat-sheet (M3) |
| `task.evidence` | `initiative.schema.json:209-212` | omitido em `project.md:144` (lido por GATE-R2 `validate-state.js:314`) | omissão no cheat-sheet (M3) |
| `phaseDescriptor.summary` | `plan.schema.json:128` | omitido em `project.md:139` (mas exigido em `:156`) | omissão no cheat-sheet (M4) |
| `phaseDescriptor.provenance`/`context` | `plan.schema.json:167-168` (+allOf `:170-176`) | omitido em `project.md:139` | omissão no cheat-sheet (M4) |
| `manual.{demoCommand,fallbackKind,steps,expected,data}` | `common.schema.json:138-158` | omitido no oneOf `project.md:141` | omissão no cheat-sheet (L4) |
| Gate `G9` | ausente em `code-quality-gates.md` (G1–G8) | citado em `project-transitions.md:174,235` | gate-id não registrado (L2) |

**Strength a registrar (sem ação):** todo script + flag que as skills invocam resolve para um script real com contrato CLI correspondente — `detect-completion.js --json` (`project.md:75` → `:439-495`), `compute-rollups.js` (`:154`), `find-missing-summaries.js`/`find-missing-task-summaries.js`/`find-signalless-tasks.js` (`:156,158,172`), `lint-source.js` (`levelConfusedTaskTitle:89`, `lintSpec:290`) + `lint-task-titles.js` (`:160`), `reconcile-focus.js` (`:162`), `validate-state.js` GATE-R2 (`:279-318`) + `routing.schema.json` (`implement.md:81`). **O único drift está nas asserções humanas de schema (M3/M4/L4), não em nenhum nome de script, flag ou contrato de saída.**

## Duplicação & bloat — propostas de consolidação

**Consolidar (M1) — contrato Mode-2 numa única fonte.**
- Fonte única: `skills/shared/mode2-codex-lane.md` (já se autodeclara assim em `:13-52,80-97`).
- Em `implement.md:77-83`, reduzir a 4 itens: (1) frase default/fallback de uma linha; (2) condição de enable `routing.json` (`mode2Enabled:true` + `codexLane.enabled:true`); (3) one-liner do state-tree fence; (4) ponteiro para `mode2-codex-lane.md`. **Remover** a re-derivação de F1/F2, o "opts OUT not IN" e o racional SDD.
- Red Flags (`implement.md:122-130`) + Rationalization (`:146-148`): colapsar as ~4 linhas Codex em 2 que **citam** a regra (por id F1/F2/R-XAGENT-03) em vez de re-explicá-la.

**Padrão a preservar (NÃO inlinar) — executor de verifier centralizado.**
- A lógica de execução por-kind (shell/test/query/manual, shape do bloco de evidência, met-invariant GATE-R2, regra `testsCollected>0`) está autorada **uma vez** em `project-transitions.md:159-243` e referenciada — não re-implementada — por `verify-claim.md:28` ("the one shared executor; do not re-implement or diverge from it"), `implement.md:44` e phase-done/archive. Este é o modelo que M1 deve seguir; uma futura consolidação NÃO deve acidentalmente inlinar esses patterns nos callers e desfazer o single-source.

## Benchmark vs. boas práticas (com fontes/URLs)

### Forças a preservar (alinhamento forte com o estado da arte)

1. **Planner/executor cross-provider com debias real** — Opus PLANEJA+REVISA só, o `tierMap` rejeita modelo Opus como executor (`mode2-codex-lane.md:104-105`); executor RECEBE intent, reviewer é intent-DENIED (a "critical inversion", `:131-136`). Casa com orchestrator-workers + evaluator-optimizer (https://www.anthropic.com/engineering/building-effective-agents) e a verifier-isolation (fresh, reasoning-blind, cross-family dilui blind spots correlacionados — https://claude.com/blog/building-multi-agent-systems-when-and-how-to-use-them). Codex-revisado-por-Opus é cross-model por natureza — benefício de qualidade, não só de custo. **Preservar a distinção executor-recebe-intent / reviewer-negado-intent.**
2. **"Done" definido por verifier, executor self-checks-but-never-self-certifies** — `verify-claim.md` deriva o veredito de uma run fresca (step 4), nunca do report do produtor; GATE-R2 (`validate-state.js`, `transitions.md:181`) HARD-FAIL qualquer met/done sem `evidence.passed===true`. É o padrão evaluator + deterministic-gate: "agents generate completion language regardless of the actual state of the codebase" (https://dev.to/moonrunnerkc/ai-coding-agents-lie-about-their-work-outcome-based-verification-catches-it-12b4). A regra `testsCollected>0` mata o false-green vazio. **Manter a aplicação de GATE-R2 determinística (não LLM-judged).** É a invariante de correção load-bearing de todo o sistema.
3. **Merge-back serial com re-verify na árvore MESCLADA** (`implement.md:83,126-128`, `worktree-isolation.md:47-57`) — "merge one worktree at a time … fixing conflicts before merging the next"; "overlapping file lists → sequential" (https://www.mindstudio.ai/blog/parallel-agentic-development-git-worktrees). O re-verify pós-merge pega o "in-worktree pass is necessary but not sufficient" que a maioria dos designs paralelos perde. **Preservar.**
4. **Estado durável em disco + handoff event-driven + resume por artefato** (`implement.md:21,29-31,54-67`) — push state para artefatos on-disk (progress log + status machine-readable + git history) e resume lendo-os primeiro (https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents); handoff explícito revisável > compaction automática (https://tessl.io/blog/amp-retires-compaction-for-a-cleaner-handoff-in-the-coding-agent-context-race/). A regra verbatim-literals preserva constraints load-bearing exatamente. **Preservar resume-por-artefato e verbatim-literals.**
5. **Reconciliação detect-report-reconcile idempotente** (`project.md:164-170`, `project-verify.md:78-82`) — `detect-completion.js` determinístico, read-only, zero-token, fail-open, re-runnable como no-op quando em sync; reconcile é a única via de mutação de completion e é GATE-R2-gated. Padrão GitOps desired-vs-actual com re-reconcile idempotente (https://anynines.com/blog/external-state-drift-kubernetes-controller-self-healing-design/). **Preservar a separação detecção (sinal) ↔ autoridade de close (GATE-R2).**
6. **Lazy-load de três níveis** (router fino + dispatch table + detalhe on-demand) (`project.md:1,31-49`, `skills/shared/project-assets/`) — progressive disclosure da Anthropic (~40% redução de tokens, +15-20% acurácia; refs um nível de profundidade router→leaf) (https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills, https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices). **Preservar a disciplina do router.**

### Gaps vs. boas práticas (acionáveis)

- **Single-source-of-truth violado pelo contrato Mode-2 (M1).** A Anthropic alerta explicitamente contra conteúdo duplicado porque cópias divergem em contradição (https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices). O drift já materializou (cláusula schema-default em só uma cópia). É o gap mais alavancável de manutenibilidade.
- **Acceptance criteria e critérios do verifier devem ser UM artefato, não duas cópias que derivam** (https://orq.ai/blog/why-do-multi-agent-llm-systems-fail). Os cheat-sheets incompletos (M3/M4/L4) criam exatamente o risco "leitor não sabe que o campo é válido" → estado escrito divergente do que o verifier/dashboard leem.

### Over-engineering
- **Nenhum identificado.** A complexidade de orquestração (worktrees, escalation cascade, gates) corresponde à fragilidade real da tarefa (planner forte + executor barato/foreign + gating determinístico), conforme "add complexity only when it demonstrably improves outcomes" (https://www.anthropic.com/engineering/building-effective-agents). O único excesso é **repetição documental** (M1), não excesso arquitetural.

## Integração `review-plan` ⇄ `project` (escopo adicional pedido)

> Auditoria focada da relação entre `atomic-skills:review-plan` e os planos/iniciativas
> materializados pela skill `project`. Verdito sobre a tese "`review-plan` só aceita um
> arquivo de plan": **correta no contrato de entrada, mas desatualizada na compreensão de
> estrutura** — o Step 0c já faz auto-descoberta layout-aware de iniciativas.

### Estado atual de `review-plan`
- **Contrato de argumento (tese "só um arquivo"): VERDADEIRA.** O parser (`review-plan.md:44-64`) só monta um `plan_path` de filesystem e aborta se vazio (`:60-64`). Sem resolução de slug, de `<project-id>/<plan-slug>`, ou de active-plan — capacidades que `implement.md:3` e `project.md:55-57` já têm.
- **Compreensão de estrutura `project`: já existe (tese desatualizada).** O Step 0c (`review-plan.md:145-204`) faz parse do frontmatter (`phases:`/`slug:`), resolve o diretório de fases layout-aware (nested `projects/<id>/<slug>/phases/` ou flat `initiatives/`), casa cada fase por `parentPlan`+`phaseId` (schema-driven, não slug-derivation), e monta `initiative_map`. Os checks 14-20 (`:271-305`) auditam gate↔task, deps cross-fase, `subPhaseCount`, isolamento de escopo. O Initiative HARD-GATE (`:193-204`) proíbe editar iniciativas — corrige só o plano.
- **Call-sites:** `review-plan` só é invocado na **criação** (`project-create-plan.md` Stage 8a/8b) e em `project-emergence.md:154`. **Nenhum** subcomando operacional (`verify`, `review-due`, drift) o aciona; não existe `project review`.

### Lacunas vs. os 5 sub-pedidos
| Sub-pedido | Status | Essência |
|---|---|---|
| **(a)** aceitar por slug / active-plan | **FALTA** | parser só abre path (`review-plan.md:60-64`) |
| **(b)** auditar contra contrato estrutural do `project` | **PARCIAL** | Step 0c existe, mas re-derivado em **prosa-LLM**; não chama os linters determinísticos (`lint-task-titles`, `find-signalless-tasks`, `validate-state`, `compute-rollups`, `find-missing-summaries`) |
| **(c)** auditar contra a spec originária via provenance | **FALTA (auto)** | cross-ref é scan de prosa + `--cross-ref=` manual; ignora `references[]`/`supersedes` do frontmatter (`plan.schema.json:98-112`) |
| **(d)** inconsistência intra-plano | **JÁ COBERTO** | self-loop checks 1-7 |
| **(e)** contrastar com o código (local+codex) | **FALTA em review-plan; existe alhures** | `review-plan` nunca lê a árvore; contraste-de-código é `detect-completion.js`/`project verify` (determinístico) + `review-code --mode=both` (adversarial, local+codex) |

### Achados de integração
- **RP1 (HIGH, integration-gap)** — `review-plan` não resolve plano por slug nem active-plan, divergindo da gramática de `implement`/`project`. Loc: `review-plan.md:44-64` vs `implement.md:3`, `project.md:55-57`. Fix: se o 1º token não resolve para arquivo legível, tratá-lo como slug e resolver via a detecção de `project.md:55-57`; vazio → active-plan. Reusar, não reimplementar.
- **RP2 (HIGH, best-practice-gap)** — auditoria estrutural re-deriva em prosa o que linters determinísticos já garantem (sem single-source-of-truth). Loc: `review-plan.md:271-305` vs `scripts/{lint-task-titles,find-signalless-tasks,validate-state,compute-rollups,find-missing-summaries}.js`. Fix: para plano `project` materializado, rodar a bateria determinística zero-token e ingerir exit-codes como findings `structural`; a prosa cobre só o que máquina não cobre (semântica gate↔task).
- **RP3 (MEDIUM, integration-gap)** — cross-ref da spec originária não usa a provenance estruturada do plano. Loc: `review-plan.md:99-116` vs `plan.schema.json:98-112`, `common.schema.json:83-95`. Fix: parse de `references[]`/`supersedes.path`, pré-popular `detected_artifacts` com `kind ∈ {file, repo-path}` antes do scan de prosa; `--cross-ref=` continua como override.
- **RP4 (MEDIUM, integration-gap)** — nenhum subcomando operacional do `project` aciona `review-plan` (auditoria só na criação). Loc: `project.md:11-29` (sem `review`), `project-verify.md:27-82` (verify não chama review-plan). Fix: adicionar `project review [<slug>]`.
- **RP5 (LOW, best-practice-gap)** — contraste plano-vs-código não pertence a `review-plan`; o pedido "local E codex" é semântica de `review-code`. Loc: `project-verify.md:78-82` (`detect-completion.js`), `review-code.md:178-241` (`--mode=both`). Fix: **não** embutir leitura de árvore em `review-plan` (quebraria sua mente adversarial sobre o documento); compor via orquestrador.

### Design recomendado (uma escolha): novo `project review [<slug>]` que COMPÕE
Subcomando fino (detail file lazy, padrão `project-verify.md`) — **não** inchar `review-plan`. Justificativa: `review-plan`, `verify` e `review-code` têm Iron Laws conflitantes (review-plan corrige o plano e nunca toca iniciativa/artefato; verify é read-only; review-code roda em contexto selado sobre diff) — fundir tudo quebraria HARD-GATEs (`review-plan.md:137-143,193-204`). O `project` já é dono da resolução de slug/active-plan + estrutura + drift, então é o lugar natural pra orquestrar (single-source preservado). Fluxo:
1. **Resolver alvo** (reuso `project.md:55-57`): arg=slug → `projects/<id>/<slug>/plan.md`; sem arg → active-plan.
2. **Conformância estrutural determinística (zero-token):** `validate-state`, `lint-task-titles`, `find-signalless-tasks`, `find-missing-summaries`/`find-missing-task-summaries`, `compute-rollups`/`reconcile-focus` → findings `structural` (fecha RP2). Reuso de `project verify` checks 1-7.
3. **Auditoria adversarial do documento:** chamar `review-plan <path-resolvido>` com cross-ref **auto-resolvido** do `references[]`/`supersedes` (fecha RP3). Step 0c já dá a profundidade de iniciativa.
4. **Contraste-de-código (opcional, intrusive-actions):** delegar a `review-code <branch|all> --mode=both` (atende "local E codex" no lugar correto) + cruzar com o drift de `detect-completion.js` do passo 2.

Mais **duas melhorias aditivas baratas** em `review-plan` (destravam (a)/(c) mesmo fora do orquestrador, sem tocar HARD-GATEs): resolução de slug/active-plan no parser (RP1); auto cross-ref por provenance no Step 0b (RP3).

## Economia de tokens (arquitetura)

> Pergunta: a skill gasta tokens demais sem necessidade pela arquitetura? **Diagnóstico:
> a arquitetura (lazy-load de 3 níveis) está correta — é a própria otimização. O problema
> é que a DISCIPLINA do "router fino" erodiu: conteúdo que só serve a subcomandos
> específicos voltou a viver na camada SEMPRE-RESIDENTE, e é pago em todo turno de todo
> caminho — inclusive os read-only mais frequentes.** Estimativas em ~4 chars/token.

### Onde os tokens vão (medido)
- **`project.md` = 26.723 c ≈ 6.680 tok, pago em TODA invocação de `project`.** O bloco "ALWAYS-RESIDENT INVARIANTS" (linha 79→fim) é **18.940 c ≈ 4.735 tok = 71% do router**. Destes, **13.786 c ≈ 3.450 tok (linhas 136-205) são MOVÍVEIS** — schema quick-reference, mecânica de rollups/summaries (5.931 c ≈ 1.480 tok sozinho), completion-drift, code-quality gates, Red Flags + Rationalization. São conteúdos só relevantes DENTRO de uma mutação — onde o detail file já está carregado.
- **Pior caso: o no-args `/project`** (comando mais barato e frequente) carrega os 6.680 tok inteiros, incluindo ~3.450 tok de cheat-sheets de schema e mecânica de rollup que ele nunca toca.
- **`implement.md` = 27.001 c ≈ 6.750 tok, pago em TODA invocação.** Red Flags + Rationalization (113-157) = **11.820 c ≈ 2.955 tok = 44% do arquivo** — as duas tabelas expressam as MESMAS ~17 regras duas vezes (trigger + Temptation→Reality). Mode-2 prosa (77-111) = 5.862 c ≈ 1.465 tok, **duplicada** de `mode2-codex-lane.md` (M1) — paga inclusive por quem roda Mode-1-only (lane off).
- **Hot path `done`** carrega router (6.680) + `project-transitions.md` (28.385 c ≈ 7.100 tok) ≈ **13.780 tok**, embora `transitions.md` empacote archive/reconcile/phase-reopen/migrate-adjacent que o `done` diário não usa.

### Propostas (mesmo comportamento — ou melhor — com menos tokens)

**P1 — Restaurar o router fino: mover os 3 blocos de referência para fora do resident (~3.450 → ~800 tok).** Schema quick-reference, mecânica de rollups/summaries e code-quality-gates NÃO são gatilho ambiente — só servem dentro de uma mutação, cujo detail file já é carregado. Mover para `project-transitions.md`/`project-create-plan.md` (que já disparam o recompute) e/ou um lazy `project-schema-ref.md`; o router fica com 1 linha de invariante + ponteiro por bloco. Custo de Read extra = zero (o detail já era lido); ganho = ~2.600 tok fora de TODO caminho não-relacionado. **Fica resident** o que é genuinamente ambiente: Iron Law, pre-mutation gates, gate-status invariant (causa nº1 de card quebrado), ratify gate, emergence ladder (dispara da conversa), `new` menu.

**P2 — Colapsar a duplicação Red Flags + Rationalization (implement: ~2.955 → ~600 tok; project: ~430 → ~200).** As duas tabelas dizem o mesmo ~17× duas vezes. O load-bearing é o **gatilho de reconhecimento** (a one-liner que faz o agente se pegar no ato); a refutação ("Reality") só é consultada QUANDO o gatilho dispara. Manter resident uma lista compacta de gatilhos; mover as refutações Temptation→Reality para um lazy `implement-antipatterns.md` lido só no reconhecimento. É o MESMO princípio lazy-load do resto da skill, aplicado à prosa anti-padrão — proteção idêntica, refutação chega exatamente quando precisa.

**P3 — Consolidar Mode-2 (= M1): ~1.465 tok fora de `implement.md` + Mode-1-only deixa de pagar contrato codex.** Reduzir `implement.md:77-111` a stub de 4 linhas + ponteiro; `mode2-codex-lane.md` (fonte única) só é lido quando a lane engata. Quem roda lane off para de carregar 1.465 tok de contrato que nunca usa.

**P4 — Partir o hot-path de `transitions.md`.** Carvar `done`/`push`/`pop` (loop diário) num `project-transitions-core.md` menor; deixar archive/phase-reopen/detect-scope/reconcile num `-rare.md`. A dispatch table já roteia por-comando. **Cuidado:** os patterns de execução de verifier são compartilhados (done+phase-done+reconcile) — vão para um `verifier-exec.md` referenciado por ambos, preservando o single-source que o benchmark elogiou (não inlinar). Hot path `done` cai de ~7.100 → ~3.000 tok no detail.

### O que NÃO fazer (falsa economia)
- **Não** recolapsar detail files no router — é o oposto do conserto; o lazy-load É a economia.
- **Não** remover do resident os pre-mutation gates / gate-status / ratify / emergence ladder — disparam de contexto ambiente; removê-los quebra comportamento (e gate-status previne a falha nº1 de card).
- **Não** mexer nos scripts determinísticos — são o melhor movimento de token do sistema (Bash zero-token que devolve sinal compacto em vez do LLM raciocinar sobre estado cru). P1 inclusive REFORÇA esse padrão (o script computa; a skill só chama).
- **Não** trocar GATE-R2 determinístico por LLM-judge — é ganho de correção E de token.

### Ganho estimado (comportamento preservado)
| Superfície | Antes | Depois | Δ |
|---|---|---|---|
| Router (todo `project`) | ~6.680 | ~3.300 | **−50%** |
| `implement` (toda chamada) | ~6.750 | ~2.900 | **−57%** (P2+P3) |
| Hot path `done` (router+transitions) | ~13.780 | ~6.300 | **−54%** |

Nota sobre o regime dinâmico: o lazy-load adiciona um round-trip de Read, mas carregar 3k tokens resident é pago em TODO turno da sessão multi-turn; o Read lazy é pago uma vez. Mover resident→lazy para o que não é necessário a cada turno é quase sempre ganho líquido. Enquadramento honesto: **não é arquitetura nova — é re-aplicar o lazy-load existente ao conteúdo que voltou a vazar para a camada resident.**

## Plano de remediação priorizado

**Quick-wins (documentais, baixo risco, minutos cada):**
- [ ] **M2** — `project-create-plan.md:24`: trocar `7 stages` → `9 stages`.
- [ ] **L1** — `project-drift.md:73`: trocar `skills/en/core/review-code.md` → slug `atomic-skills:review-code`. Grep opcional do repo por `skills/en/` para varrer ocorrências vivas.
- [ ] **L3** — `project-view.md:59`: deletar `AIDECK_STATE_DOMAIN` da frase (manter `AIDECK_BIN`/`DASHBOARD_DIR`).
- [ ] **M3** — `project.md:144`: adicionar `summary` e `evidence` aos opcionais de Task.
- [ ] **M4** — `project.md:139`: adicionar `summary`, `provenance`, `context` (provenance ⇒ context) aos opcionais de PhaseDescriptor.
- [ ] **L4** — `project.md:141`: anotar o branch `manual` com os opcionais 0.2 (`demoCommand?`, `fallbackKind?`, `steps[]?`, `expected[]?`, `data?`).
- [ ] **L2** — adicionar `## G9 — Mutation-kill (behavioral-test gate)` a `docs/kb/code-quality-gates.md` espelhando `project-transitions.md:235`; fazer a skill referenciar G9 por id.

**Estrutural (consolidação, exige revisão cuidadosa):**
- [ ] **M1** — consolidar o contrato Mode-2 em `mode2-codex-lane.md` como fonte única; reduzir `implement.md:77-83` a 4 itens (default/fallback + enable + fence + ponteiro); colapsar as linhas Codex de Red Flags/Rationalization para citações por-id. Seguir o padrão já aplicado ao executor de verifier (`project-transitions.md:159-243` ← `verify-claim.md:28`).

**Integração `review-plan` ⇄ `project` (feature work — escopo adicional):**
- [ ] **RP1** — no parser de `review-plan.md:44-64`, resolver slug/active-plan quando o 1º token não é arquivo legível (reuso `project.md:55-57`). Aditivo, não toca HARD-GATEs.
- [ ] **RP3** — no Step 0b de `review-plan.md:99-116`, auto cross-ref via `references[]`/`supersedes` do frontmatter antes do scan de prosa; `--cross-ref=` continua override.
- [ ] **RP2 + RP4 + RP5** — criar `project review [<slug>]` (detail file lazy padrão `project-verify.md`): resolve alvo → linters determinísticos + `verify` (estrutura/drift) → `review-plan <path>` (adversarial sobre o documento, cross-ref auto) → opcional `review-code --mode=both` (adversarial sobre o código, local+codex). Decisão: compor, **não** inchar `review-plan`.

**Economia de tokens (estrutural — alto retorno, mesmo comportamento):**
- [ ] **P1** — mover schema-ref + mecânica de rollups/summaries + code-quality-gates do bloco resident de `project.md` para os detail files que já os usam (+ ponteiro de 1 linha no router). Router resident ~−50%. Manter resident só os invariantes de gatilho ambiente.
- [ ] **P2** — colapsar Red Flags + Rationalization: gatilhos compactos resident, refutações Temptation→Reality para lazy `implement-antipatterns.md` lido só no reconhecimento. `implement.md` ~−2.300 tok.
- [ ] **P3** (= M1) — stub Mode-2 de 4 linhas em `implement.md`; contrato completo só em `mode2-codex-lane.md` (lido quando a lane engata). Mode-1-only para de pagar ~1.465 tok.
- [ ] **P4** — partir `project-transitions.md` em `-core` (done/push/pop) + `-rare` (archive/reconcile/...) + `verifier-exec.md` compartilhado (não inlinar). Hot path `done` ~−54%.

**Preservação (proteger contra regressão em futuras edições):**
- [ ] Não inlinar o executor de verifier centralizado nos callers (manteria DRY de `transitions.md:159-243`).
- [ ] Manter GATE-R2 determinístico (não LLM-judged); resume por artefato + verbatim-literals; merge-back serial com re-verify; detecção separada da autoridade de close.
