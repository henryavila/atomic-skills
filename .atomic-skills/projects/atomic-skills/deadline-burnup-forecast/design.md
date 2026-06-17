# Design — deadline-burnup-forecast

Previsão de ritmo por **burn-up ponderado contra um deadline** (Earned Value / SPI):
mostrar se um projeto grande está **acima ou abaixo** do ritmo esperado para uma data-alvo
definida pelo usuário — não uma data fixa de conclusão. Progresso medido por **peso de
complexidade por task**, não contagem.

## Context

O usuário quer, para um projeto grande (ex. `/home/henry/arch`), saber se está no ritmo de
um deadline — sabendo que o ritmo diário não é fixo (tem dias/semanas zeradas). A pergunta
real é diagnóstica ("estou adiantado/atrasado agora?"), não preditiva ("que dia exato termino?").

Realidade verificada do tracker hoje:
- `closedAt` (timestamp de conclusão de task) é documentado só em prosa e **nunca é
  machine-checked**. `verified_by: grep -n "closedAt" scripts/validate-state.js → 0 hits`.
- O único gate de `done` é o GATE-R2 (`checkMetInvariant`), que exige `evidence.passed===true`
  apenas para task `done` que **carrega verifier determinístico** — nunca `closedAt`.
  `verified_by: scripts/validate-state.js:364-399`.
- A projeção de task emitida ao dashboard carrega `id/title/summary/status/blocked/blockedBy`
  — **sem nenhum timestamp e sem peso**. `verified_by: scripts/emit-consumer-state.js:255-267`.
- Consequência viva: o projeto `/home/henry/arch` tem **0 tasks `done` e 0 `closedAt`** no
  estado vivo; 80 done estão num `_archive-legacy`. O git, em contraste, tem 60–190
  commits/semana. `verified_by: find/grep em /home/henry/arch/.atomic-skills/projects (0 hits de "status: done"/"closedAt") + git log --since=2026-05-01 (W18–W24: 136/79/191/127/79/152/61)`.
- O tracker registra **backlog, não fluxo** — ninguém dirige a transição `done` enquanto o
  trabalho acontece. Esta é a causa-raiz que o design endereça antes de qualquer cálculo.
- aiDeck v0.1 **não tem engine de agregação** — toda série/contagem/ratio precisa ser
  pré-computada em JSON bare-array. Os widgets `line-chart`, `stat`, `gauge` existem no runtime
  publicado. `verified_by: node_modules/@henryavila/aideck/dist/client/assets/index-*.js (registry contém line-chart, stat, gauge)`.

## Decisions

- **D1 — Sinal antes de cálculo (causa-raiz).** A feature primeiro torna o **fluxo**
  observável; o forecast é consequência. O primeiro RED da feature é "a transição `done`
  emite um evento de conclusão verificável?" — hoje a resposta é não. Fazer isso passar é o
  pré-requisito de tudo. *(Síntese do painel; o reframe do contrarian sobre a causa-raiz venceu.)*

- **D2 — Fonte da série = evento `done` emitido NA transição (Q2).** A série
  earned-weight-over-time vem de um log **append-only** escrito como **efeito colateral atômico**
  do próprio comando `done`/`phase-done`/`reconcile`, em `.atomic-skills/analytics/completions.jsonl`
  (1 linha imutável por conclusão). Não é um arquivo paralelo mantido à mão; é o tracker
  gravando seu próprio evento quando o estado muda. Uma fonte, não duas.

- **D3 — `closedAt` forward-only, sem backfill cosmético (Q1).** Enforcement vale **só para
  frente**. Legado fica `closedAt: null` (desconhecido honesto), grandfathered — **proibido**
  inventar `closedAt` retroativo em lote (colapsa a curva num degrau vertical falso). O
  enforcement **começa soft** (auditor que mede a lacuna de instrumentação) e **endurece para
  hard** quando a lacuna chega perto de zero — gatear sinal vivo, não campo morto.

- **D4 — Peso por task = proxy estrutural automático (Q3).** `tasks[].weight` (number,
  opcional, default=1) anotado no **passo de anotação do decompose (Stage 6** de
  `project-create-plan.md`), derivado de sinais já presentes na fonte (nº de `acceptance`,
  arquivos em `Files:`, `scopeBoundary`, tipo de `verifier`, tamanho). `src/decompose.js`
  permanece congelado (R-ORCH-10) — a anotação é no corpo da skill, não no engine.
  `verified_by: relatório do agente de pesquisa decompose (project-create-plan.md Stage 6; src/decompose.js:773)`.
  Sem peso ⇒ degrada para burn-up por contagem (weight=1).

- **D5 — Deadline por-plano, linha planejada linear (Q4).** `plan.deadline` (isoTimestamp,
  opcional). Linha planejada = `weightTotal` no `plan.started` → 0 no `plan.deadline`. Escopo
  do "termino" = **plano**; rollup de portfolio fica para depois.

- **D6 — Calibração: gerar dados no v1, tratar depois (Q5).** Cada evento de conclusão grava
  os **actuals crus** junto do peso estimado (phase-done: stats do diff `phase.started→HEAD`
  — arquivos/LOC/commits; task-done: campos do `dispatch-log.json` quando existirem —
  attempts/duração/escalations). O **tratamento** (regressão actual×peso, ajuste de
  coeficientes, re-weighting) é fase posterior. Captura imutável agora, processamento depois.

## Chosen approach

**Mecanismo (Earned Value / SPI, diagnóstico).** `emit-consumer-state.js` ganha um
`buildSeries()` que lê `completions.jsonl` e emite bare-arrays pré-computados
(`burnup.json`, `spi.json`), porque o aiDeck não agrega:
- **Linha planejada:** de `weightTotal` em `plan.started` a 0 em `plan.deadline` (D5).
- **Linha real (earned):** soma acumulada de `weight` concluído por dia/semana (de D2).
- **SPI** = `earned_real / earned_esperado_hoje` (>1 adiantado, <1 atrasado); + "X% do peso
  feito vs Y% do tempo decorrido".
- **Render:** `line-chart` 2 séries (planejada vs real) + `stat`/`gauge` SPI (widgets reais).

**Ciclo de vida do sinal — cada ponto cavalga um evento que já dispara** (achados dos agentes
de pesquisa; `verified_by`: relatórios de pesquisa project-transitions.md / refresh-state.js):
1. **decompose Stage 6** → *set* `weight` (D4).
2. **done / verify-on-done** (cada task) → *append* do evento {ts, weight, actuals} (D2/D6).
3. **reconciliation gate (>24h)** → já itera tasks abertas; refresh barato do peso restante.
4. **phase-done review gate** → já computa o diff `started→HEAD`; grava os actuals da fase (D6).
5. **refresh-state.js** (hooks SessionStart/Stop) → recomputa série + SPI automático *(gap a
   fechar: hoje não chama o emit)*.
6. **project-view step 0** → série fresca ao abrir o dashboard.

**Abordagens pesadas e o que ganhou (Q2):** três fontes foram pesadas para a série —
(a) log append-only, (b) derivar de `closedAt` no emit, (c) derivar do git. Venceu **(a) na
forma "evento emitido na transição"**: (b) é lossy por construção (reopen limpa, phase-done
em lote colapsa a timeline) e produziria um SPI que mente; (c) exige link task→commit
inexistente hoje (commit ≠ task; cadência de commit mede esforço, não entrega ponderada).

**Rollout (ordem, menor-alavanca-primeiro):**
1. Evento `done` emitido na transição + `completions.jsonl` (D1/D2) — o RED.
2. `closedAt` soft-auditor forward-only + emiti-lo na projeção (D3).
3. `weight` no decompose Stage 6 + rollups `weightDone/weightTotal` (D4).
4. `plan.deadline` + `buildSeries()` (burnup/spi) + wiring no refresh-state (D5).
5. Dashboard: line-chart 2 séries + stat SPI.
6. Captura de actuals nos eventos (D6). Endurecer `closedAt` para hard quando a lacuna ~0 (D3).

## Blast radius

Dois itens são portas de mão única (one-way doors):

- **D3 — contrato de validação (`closedAt`).** Endurecer o GATE-R2 muda o contrato de
  validação de **todo repo consumidor** da skill project. Um hard-gate cego rejeitaria ~100%
  das tasks `done` legadas (que nunca tiveram `closedAt`), incluindo as 80 em `_archive-legacy`
  — estado **válido** sob o contrato 0.1. **Contenção:** forward-only + legado `closedAt: null`
  grandfathered + fase soft-auditor antes do hard; o hard só morde tasks cuja transição ocorre
  após o corte. Reversão: remover a asserção do validador (a fase soft é não-destrutiva).

- **D2 — formato persistido git-tracked (`completions.jsonl`).** Um log que acumula histórico
  é caro de reverter depois que repos juntam dados. **Contenção:** JSONL append-only (merge-
  friendly, sem conflito linha-a-linha), schema versionável (`completion-event.schema.json`),
  e o emit trata o log como fonte e os JSON emitidos como cache derivado descartável. Reversão
  antes de acúmulo é barata; depois, o log vira artefato histórico mantido.

**Mudanças de schema (todas `additionalProperties:false` → exigem edição explícita + rebuild
do bundle):** `initiative.schema.json` (`weight`, `closedAt` na projeção), `plan.schema.json`
(`deadline`), `aideck-state.schema.json` (`$defs.burnup`/`spi`), novo
`completion-event.schema.json`, e **rebuild** de `assets/aideck-consumer/schema.json` (senão
`schema-drift.test.js` falha). `verified_by: relatórios dos agentes de pesquisa (decompose §4, project §4)`.

## Non-goals

- **Não** prever uma data fixa de conclusão (Monte Carlo preditivo fica fora; o usuário pediu
  diagnóstico contra deadline, não data exata).
- **Não** tratar/calibrar os dados de actuals no v1 (só capturar — D6).
- **Não** migrar/backfillar histórico legado para preencher a curva (D3).
- **Não** usar git como fonte de earned-value (rejeitado — ver Rejected alternatives).
- **Não** tocar `src/decompose.js` (congelado, R-ORCH-10).
- **Não** depender de widgets aiDeck inexistentes; só `line-chart`/`stat`/`gauge` (reais).

## Rejected alternatives

- **Q1(a) hard-gate imediato p/ toda task done.** Rejeitado: rejeita estado válido 0.1 em
  todos os repos consumidores num one-way-door. *(Aria, Tariq, Flynn.)*
- **Q1(c) migrate-then-gate com backfill em lote.** Rejeitado **após** o round 2: fabricaria
  `closedAt` retroativos colapsados num degrau vertical falso — SPI cosmético. *(Aria retirou a
  própria posição; Dr. Ravi expôs.)* **Dissent preservado:** Flynn/Ravi querem ficar **mais
  tempo no soft** (auditor que mede a lacuna) e só endurecer quando done↔trabalho convergir —
  D3 acomoda começando soft.
- **Q2(b) derivar a série de `closedAt` no emit.** Rejeitado: lossy por 3 mecanismos
  independentes (reopen limpa; phase-done bulk-close colapsa; archive move) → SPI que mente.
  **Dissent preservado:** Flynn defende isso como v1 enxuto ("um SPI aproximado que plota hoje
  bate um SPI perfeito em discussão") — endereçado pelo rollout faseado (spike primeiro).
- **Q2(c) snapshots periódicos.** Rejeitado: resolução amostral arbitrária, perde completions
  entre amostras.
- **Q2 reframe — git como fonte de earned-value (Dr. Ravi).** Rejeitado pelo fato que o
  contrarian não tinha: **não existe link task→commit** (commits sem id de task; só range por
  fase; dispatch-log só na sublane codex). Seria construir uma fonte inexistente (trailers/
  convenção de branch) e ainda assim com `commit ≠ task` e "esforço ≠ entrega". **Dissent
  preservado e absorvido:** o root-cause de Ravi (tracker não é alimentado) virou D1; git fica
  como reconciliação/auditoria **futura** SE/QUANDO houver linkage — nunca fonte primária v1.
- **Q2 — `completions.jsonl` mantido à mão (paralelo ao tracker).** Rejeitado: nasceria vazio
  e divergiria do tracker (mesma causa-raiz). Reframed para "append atômico DA transição `done`"
  (D2) — não é um segundo arquivo à mão.

## Open questions

- **Hard vs soft-até-fechar:** o ponto exato em que a "lacuna de instrumentação" justifica
  promover `closedAt` de soft-auditor para hard-gate. Evidência que resolve: a métrica do
  auditor (tasks com atividade recente mas ainda abertas no tracker) chegando perto de zero
  por N semanas. *(Decisão default: começa soft — D3.)*
- **Correlação done↔commit como follow-up de calibração** (não pré-requisito): só computável
  após existir linkage task→commit; fica para a fase de tratamento (D6).
- **Fórmula exata do `weight`:** quais coeficientes por proxy e normalização — a ser fixada na
  decomposição do plano (a decisão D4 trava a *abordagem*, não os números).

## Self-review against code-quality gates

- **G1 read-before-claim:** applied — claims sobre código existente carregam linhas/comandos
  verificados por mim (`scripts/validate-state.js:364-399` lido; `grep closedAt` = 0 hits
  executado; `scripts/emit-consumer-state.js:255-267` lido; greps no `/home/henry/arch` e
  `git log` executados; registry do client do aiDeck inspecionado). Claims oriundos dos agentes
  de pesquisa (decompose Stage 6, refresh-state hooks, schemas additionalProperties) estão
  marcados `verified_by: relatório de pesquisa` — a verificar na decomposição antes de implementar.
- **G2 soft-language:** applied — varrido contra a ban list (should/probably/may/typically/
  usually/I think/it seems/in theory/tends to); 0 ocorrências no corpo. Afirmações de incerteza
  estão marcadas explicitamente em Open questions, não diluídas em hedge.
- **G6 reference-or-strike:** applied — cada afirmação sobre o estado atual carrega
  `verified_by: <file:line | comando>`; afirmações não verificadas pessoalmente carregam a
  proveniência (relatório de pesquisa) e estão listadas para verificação na decomposição.
