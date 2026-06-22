# Deadline Burn-up Forecast (Earned Value / SPI)

Burn-up ponderado por complexidade contra um deadline por-plano: mostra se um plano está acima/abaixo do ritmo esperado para a data-alvo, em vez de uma data fixa de conclusão. Implementa a fonte de fluxo (evento done emitido na transição), o peso por task, a série earned-vs-planned e o render no aiDeck. Fonte-de-verdade: design.md deste plano.

> **Notas de divergência do design (reviews cross-model 2026-06-17):** Este source.md é a especificação CORRIGIDA; o `design.md` (artefato-fonte) NÃO foi editado (HARD-GATE). Resolver no design quando ele for revisado:
> 1. `design.md:122` lista as mudanças de schema como "initiative.schema.json (weight, closedAt na projeção)". A projeção de `closedAt` vive em `aideck-state.schema.json`, e a lista omite `weightDone`/`weightTotal`/`lastUpdated`.
> 2. `design.md:75` (D5) define a linha planejada como "weightTotal em plan.started a 0 em plan.deadline" — isso é uma curva **burn-DOWN** (trabalho restante), mas a feature é um **burn-UP / earned-value** com SPI = earned/expected. A Planned Value correta é **0 no started → weightTotal no deadline** (CRESCENTE). O plano (F3/T-002) usa a direção corrigida.
> 3. O `weightBasis` ('count' antes de F2, 'proxy' depois) cria um log de basis misto; F3/T-002 emite **séries earned separadas** por basis e SPI por basis (o design não especificou a reconciliação).

## Principles

### P1 Sinal antes de cálculo
Primeiro tornar o fluxo observável (a transição done emite evento verificável); o forecast é consequência. O RED da feature é "a transição done emite um evento?" — hoje não emite. A prova do RED é comportamental (um teste que exercita a chamada de emissão), não um grep de prosa.

### P2 Capturar imutável agora, tratar depois
Eventos e actuals são gravados crus no instante em que acontecem; regressão/calibração é fase posterior. Nenhuma fonte derivada lossy substitui o log de eventos. O peso é congelado no evento no instante da conclusão (com o seu `weightBasis`), nunca re-derivado no render.

### P3 Forward-only, sem histórico cosmético
Enforcement de closedAt vale só para frente; legado fica closedAt:null. Proibido inventar closedAt retroativo em lote — colapsa a curva num degrau falso. O corte forward-only é um conjunto persistido de ids grandfathered, não uma comparação de timestamp mutável.

### P4 Uma fonte, não duas
O evento de conclusão é efeito colateral atômico do próprio comando done/phase-done/reconcile, não um arquivo paralelo mantido à mão que diverge do tracker.

## F0 — Fonte de fluxo: evento done emitido na transição

Goal: criar o log append-only de conclusões (completions.jsonl) e fazer os passos done/phase-done/reconcile emitirem um evento imutável por conclusão, com schema validado, e provar a emissão por teste comportamental. Este é o RED da feature (sem isso não há curva earned).

### T-001 — Helper append-completion + log JSONL
Cria o helper que faz append de uma linha JSON por conclusão em `.atomic-skills/analytics/completions.jsonl` (cria `analytics/` se ausente). Campos: ts, **event (enum: 'task-done' | 'phase-done' | 'reconcile')**, projectId, planSlug, phaseId, taskId, weight (default 1), weightBasis ('count'|'proxy'). Append-only. NOTA o log é GLOBAL (um só, compartilhado por todos os planos) — o filtro por projectId/planSlug é responsabilidade do consumidor (F3).
Files: scripts/append-completion.js, tests/append-completion.test.js
scopeBoundary: só escreve em .atomic-skills/analytics/; nunca muta state .md; não computa série nem agrega; weight ausente vira 1 com weightBasis 'count'; event sempre um dos três do enum.
acceptance: appendCompletion anexa exatamente uma linha JSON válida com event (do enum), weight e weightBasis; analytics/ é criado idempotentemente; chamadas repetidas nunca reescrevem nem reordenam linhas já gravadas.
verifier: kind shell — node --test tests/append-completion.test.js

### T-002 — Schema do evento de conclusão (+ event enum + weightBasis + actuals opcional) + validação
Define o schema da linha do completions.jsonl e liga sua validação ao pipeline determinístico, sem quebrar o validate-state existente (que só varre .md). `event` é um enum obrigatório ('task-done' | 'phase-done' | 'reconcile') — nome de evento desconhecido é rejeitado (senão F3/F4 teriam que inventar filtragem). `weightBasis` é enum obrigatório. Pré-declara um sub-objeto OPCIONAL `actuals` (additionalProperties:false interno) para os campos que F4 vai preencher — assim F4 nunca precisa destravar este schema depois.
Files: meta/schemas/completion-event.schema.json, scripts/validate-aideck-state.js, tests/completion-event-schema.test.js
scopeBoundary: additionalProperties:false no nível do evento; campos-base = os de T-001 (ts/event/projectId/planSlug/phaseId/taskId/weight/weightBasis) + `actuals` opcional (filesChanged/locAdded/locRemoved/commits/attempts/durationMs/escalations, todos opcionais, additionalProperties:false interno); event e weightBasis são enums fechados; não altera as regras cross-field do validate-state.js (GATE-R2 intacto).
acceptance: uma linha bem-formada valida; linha sem ts/event/weight/weightBasis ou com campo extra de topo é rejeitada; event fora do enum ('foo') é rejeitado; weightBasis fora do enum é rejeitado; uma linha com o sub-objeto actuals válido passa e com sub-chave desconhecida em actuals é rejeitada; o validador roda sobre o jsonl sem afetar a varredura .md do validate-state.
verifier: kind shell — node --test tests/completion-event-schema.test.js

### T-003 — Emitir o evento nas transições + detector estrutural (modelo de evento)
Liga o append-completion aos três pontos de mutação que já carimbam conclusão (done, phase-done bulk-close, reconcile), no mesmo instante da transição. **Modelo de evento por transição:** **done** → 1 evento {event:'task-done'}; **phase-done bulk-close** → N eventos {event:'task-done'} (um por task fechada, nunca um <now> compartilhado) MAIS 1 evento {event:'phase-done'} que carrega os actuals AGREGADOS da fase (F4/T-001) UMA vez — assim o diff da fase nunca é duplicado nas N linhas de task; **reconcile** → 1 evento {event:'task-done'} por task reconciliada. Como a transição é PROSA executada pelo modelo (não há função a chamar), o verifier é um detector ESTRUTURAL (scripts/lint-transition-emits.js, zero-token, exit não-zero) que inspeciona cada um dos 3 blocos — NÃO um grep de contagem (que não prova que o bloco certo tem a instrução certa).
Files: skills/shared/project-assets/project-transitions.md, scripts/lint-transition-emits.js, tests/transition-emits.test.js
scopeBoundary: edição de instrução de skill (prosa) + um detector read-only; não cria comando novo; o detector inspeciona os 3 blocos, não conta ocorrências.
acceptance: cada bloco done/phase-done/reconcile em project-transitions.md instrui o append com o event correto; phase-done instrui N task-done (um por task) + 1 phase-done; o detector lint-transition-emits sai não-zero se algum bloco não carrega a instrução de emit com os campos exigidos.
verifier: kind shell — node --test tests/transition-emits.test.js

### T-004 — Contrato da API de emissão (appendCompletion) — não a prova da prosa
Teste de CONTRATO da API appendCompletion no jeito que a transição a invoca: asserta o crescimento append-only e a CARDINALIDADE do modelo de evento (T-003). NÃO prova que a prosa de project-transitions.md está correta (isso é o detector estrutural de T-003) — prova que a API, chamada como documentado, grava exatamente o esperado. (Honesto sobre o limite: a prosa model-executed não é testável comportamentalmente; T-003 a cobre estruturalmente, T-004 cobre a API.)
Files: tests/emit-on-transition.test.js
scopeBoundary: escreve só num completions.jsonl de fixture/tmp; chama a API pública de appendCompletion (não reescreve a prosa da skill); é teste de contrato da API, não da prosa; sem rede nem modelo.
acceptance: uma chamada done grava 1 linha {event:'task-done'}; uma sequência phase-done de N tasks grava N {event:'task-done'} + 1 {event:'phase-done'}; reconcile grava 1 {event:'task-done'}; cada linha valida no completion-event.schema.
verifier: kind shell — node --test tests/emit-on-transition.test.js

```yaml
exit_gate:
  - id: G-1
    description: o completions.jsonl recebe um evento imutável por conclusão, validado por schema (event enum), emitido pelas três transições — wiring estrutural da prosa (T-003 lint-transition-emits) E contrato da API (T-004 emit-on-transition) ambos verificados no gate.
    status: pending
    verifier:
      kind: shell
      command: node --test tests/append-completion.test.js && node --test tests/completion-event-schema.test.js && node --test tests/emit-on-transition.test.js && node --test tests/transition-emits.test.js
```

## F1 — closedAt forward-only: auditor soft + emissão

Goal: tornar closedAt auditável (soft, mede a lacuna de instrumentação) e emiti-lo na projeção de task do dashboard, sem backfill cosmético e sem hard-gate ainda.

### T-001 — Auditor da lacuna de instrumentação
Detector zero-token que lista tasks status:done sem closedAt (a métrica que decide quando promover para hard depois), exit não-zero quando houver offenders.
Files: scripts/find-unclosed-done.js, tests/find-unclosed-done.test.js
scopeBoundary: read-only; nunca muta state nem inventa closedAt; ignora a árvore _archive-legacy (legado grandfathered).
acceptance: lista cada task done sem closedAt e sai não-zero quando há ao menos uma; sai zero quando todas as done vivas têm closedAt; ignora _archive-legacy.
verifier: kind shell — node --test tests/find-unclosed-done.test.js

### T-002 — Emitir closedAt e lastUpdated na projeção de task
Adiciona closedAt e lastUpdated à projeção de task emitida (hoje emit-consumer-state.js:253-268 carrega só id/title/summary/status/blocked/blockedBy), para a curva earned ler o instante de conclusão.
Files: scripts/emit-consumer-state.js, tests/emit-consumer-state.test.js
scopeBoundary: só adiciona campos à projeção de task; não altera outras projeções; closedAt ausente vira null (legado honesto), nunca inventado.
acceptance: a projeção de task inclui closedAt e lastUpdated; task sem closedAt na fonte emite closedAt:null; a projeção emitida com os dois campos passa validateAideckState (sem drift de campo contra o bundle) — exige T-003 já aplicado.
verifier: kind shell — node --test tests/emit-consumer-state.test.js

### T-003 — Admitir closedAt E lastUpdated na projeção do schema emitido + rebuild do bundle
Permite closedAt E lastUpdated na projeção de task ($defs.tasks) do aideck-state.schema.json (additionalProperties:false) e regenera o bundle assets/aideck-consumer/schema.json para o schema-drift.test.js passar. Ambos os campos porque T-002 emite os dois; admitir só closedAt deixaria lastUpdated como drift.
Files: meta/schemas/aideck-state.schema.json, assets/aideck-consumer/schema.json
scopeBoundary: mudança additiva no $defs.tasks da projeção (closedAt + lastUpdated); não toca regras cross-field; bundle regenerado pelo gerador (npm run build:aideck-schema), não editado à mão.
acceptance: aideck-state.schema.json admite closedAt E lastUpdated na task emitida; bundle regenerado e schema-drift.test.js passa.
verifier: kind shell — node --test tests/schema-drift.test.js

```yaml
exit_gate:
  - id: G-1
    description: closedAt é auditável (soft) e closedAt+lastUpdated são emitidos na projeção e admitidos no schema (sem drift, schema-drift no gate); nenhum closedAt retroativo é inventado.
    status: pending
    verifier:
      kind: shell
      command: node --test tests/find-unclosed-done.test.js && node --test tests/emit-consumer-state.test.js && node --test tests/schema-drift.test.js
```

## F2 — Peso por task: proxy estrutural + rollups

Goal: introduzir tasks[].weight (number, opcional, default=1) AUTORADO pelo modelo no passo de decomposição (Stage 6 de project-create-plan.md — prosa, como os task summaries; NUNCA por src/decompose.js, que é congelado/R-ORCH-10), derivado de sinais estruturais (nº de acceptance, Files, scopeBoundary, tipo de verifier), e auditor-enforced; com rollups weightDone/weightTotal espelhando tasksDone/tasksTotal — admitidos no schema source E na projeção emitida.

### T-001 — Campo weight (task) + rollups weightDone/weightTotal nos schemas + rebuild do bundle
Adiciona weight (number, minimum 0, opcional) ao $defs.task de initiative.schema.json E weightDone/weightTotal (number, opcionais) ao top-level da initiative (initiative.schema.json) E à projeção $defs.initiatives de aideck-state.schema.json; regenera o bundle. Sem os três, compute-rollups grava/emite campos que os schemas strict (additionalProperties:false) rejeitam.
Files: meta/schemas/initiative.schema.json, meta/schemas/aideck-state.schema.json, assets/aideck-consumer/schema.json
scopeBoundary: campos opcionais, fora de required (backward-compat 0.1); não toca GATE-R2; bundle regenerado pelo gerador.
acceptance: task com weight numérico valida; task sem weight continua válida; initiative com weightDone/weightTotal valida no schema source E na projeção emitida; schema-drift.test.js passa após o rebuild.
verifier: kind shell — node --test tests/schema-drift.test.js

### T-002 — Rollups weightDone/weightTotal
Estende compute-rollups.js para precomputar weightTotal (soma de weight, default 1 por task sem weight) e weightDone (soma das done) por initiative, e emiti-los na projeção.
Files: scripts/compute-rollups.js, scripts/emit-consumer-state.js, tests/compute-rollups.test.js, tests/emit-consumer-state.test.js
scopeBoundary: espelha o padrão tasksDone/tasksTotal; idempotente; task sem weight conta como 1 (degrada para count-burnup).
acceptance: weightTotal soma todos os weights (1 quando ausente); weightDone soma os das done; rerun de compute-rollups é idempotente (sem diff na segunda passada); a projeção emitida com weightDone/weightTotal passa validateAideckState (sem drift).
verifier: kind shell — node --test tests/compute-rollups.test.js && node --test tests/emit-consumer-state.test.js

### T-003 — Auditor de tasks sem weight (backfill replicável)
Cria find-unweighted-tasks.js espelhando find-missing-task-summaries.js (zero-token, exit não-zero) e referencia-o no passo de anotação do decompose (Stage 6 de project-create-plan.md) como ponto de atribuição.
Files: scripts/find-unweighted-tasks.js, tests/find-unweighted-tasks.test.js, skills/shared/project-assets/project-create-plan.md
scopeBoundary: read-only; não atribui weight sozinho (o texto/proxy é autorado na skill); não toca src/decompose.js (congelado, R-ORCH-10).
acceptance: lista tasks sem weight e sai não-zero quando há ao menos uma; project-create-plan.md Stage 6 referencia o auditor como ponto de atribuição do weight.
verifier: kind shell — node --test tests/find-unweighted-tasks.test.js

```yaml
exit_gate:
  - id: G-1
    description: weight existe no schema (task) e weightDone/weightTotal são admitidos (source + projeção), somados em rollups e emitidos sem drift, com auditor de backfill.
    status: pending
    verifier:
      kind: shell
      command: node --test tests/schema-drift.test.js && node --test tests/compute-rollups.test.js && node --test tests/emit-consumer-state.test.js
```

## F3 — Série earned-vs-planned + deadline + wiring de recompute

Goal: adicionar plan.deadline, computar a série burn-up (earned acumulado vs linha planejada linear CRESCENTE 0→weightTotal — earned-value, não burn-down) e o SPI por basis no emit, e ligar o recompute ao refresh-state (que hoje roda rollups+reconcile+emitFocus mas NÃO invoca emit-consumer-state).

### T-001 — Campo deadline no plano + rebuild do bundle
Adiciona deadline (isoTimestamp, opcional) ao plan.schema.json e regenera o bundle.
Files: meta/schemas/plan.schema.json, assets/aideck-consumer/schema.json
scopeBoundary: campo opcional; plan.schema.json é .strict(), edição explícita; bundle regenerado pelo gerador.
acceptance: plano com deadline ISO valida; plano sem deadline continua válido; schema-drift.test.js passa.
verifier: kind shell — node --test tests/schema-drift.test.js

### T-002 — buildSeries: burnup.json + spi.json (earned-value, duas séries por basis)
Adiciona buildSeries() ao emit-consumer-state.js que lê completions.jsonl, bucketiza earned-weight por dia e emite, como bare-arrays: (1) a **linha planejada (Planned Value)** = 0 no started → weightTotal no deadline (CRESCENTE — earned-value/burn-UP, NÃO weightTotal→0 que seria burn-down e inverteria o SPI); (2) **DUAS séries earned separadas por weightBasis** — earnedCount (eventos 'count', escala de contagem) e earnedProxy (eventos 'proxy', escala de peso) — porque o log append-only mistura os dois e somá-los confundiria escalas; (3) **SPI por basis**: spiProxy = earnedProxy / plannedValue(hoje) (comparável, mesma escala proxy do weightTotal) e spiCount (informativo, escala de contagem). Adiciona $defs.burnup e $defs.spi ao aideck-state.schema.json e regenera o bundle. Borda: planned-value zero, deadline ausente, ou data fora de [started, deadline] ⇒ SPI null (nunca divisão por zero nem extrapolação).
**Escopo (o log é global):** buildSeries FILTRA completions.jsonl por projectId E planSlug do plano corrente — sem o filtro a série misturaria eventos de outros planos. **weightTotal é PLAN-WIDE** (soma dos weights de todas as tasks de todas as initiatives do plano), não o rollup por-initiative de F2/T-002; o denominador do SPI é plan-wide. **"hoje"** (data corrente do SPI) = relógio de parede no instante do emit.
Files: scripts/emit-consumer-state.js, meta/schemas/aideck-state.schema.json, assets/aideck-consumer/schema.json, tests/emit-series.test.js
scopeBoundary: toda agregação é pré-computada (aiDeck não agrega); saída são bare-arrays; filtra por projectId+planSlug; weightTotal é plan-wide; a linha planejada é CRESCENTE (0→weightTotal); count e proxy são séries SEPARADAS, nunca somadas; sem deadline emite earned sem linha planejada e SPI null.
acceptance: burnup.json traz, por bucket, plannedValue (0→weightTotal plan-wide crescente), earnedCount e earnedProxy como séries distintas; spi.json traz spiProxy (earnedProxy/planned, null nas bordas: planned zero / sem deadline / fora do intervalo) e spiCount; com DOIS planos no mesmo completions.jsonl, a série de um plano exclui os eventos do outro (filtro projectId+planSlug provado por teste); cada record emitido tem $def correspondente (validate-aideck-state verde).
verifier: kind shell — node --test tests/emit-series.test.js && node --test tests/schema-drift.test.js

### T-003 — Ligar emit ao refresh-state sem regredir emitFocus
Faz refresh-state.js disparar o emit da série (hoje roda computeRollupsDir+reconcileDir+emitFocus, mas NÃO invoca emit-consumer-state), mantendo as três passadas existentes intactas.
Files: scripts/refresh-state.js, tests/refresh-state.test.js
scopeBoundary: additivo: adiciona o passo de emit da série; não remove nem altera os passos rollups/reconcile/emitFocus; idempotente, fail-open.
acceptance: refresh-state regenera burnup.json/spi.json além de focus.json; as três passadas existentes (rollups, reconcile, emitFocus/focus.json) continuam intactas (sem regressão).
verifier: kind shell — node --test tests/refresh-state.test.js

```yaml
exit_gate:
  - id: G-1
    description: a série earned-vs-planned + SPI é emitida e recomputada automaticamente pelo refresh-state, com deadline no schema.
    status: pending
    verifier:
      kind: shell
      command: node --test tests/emit-series.test.js && node --test tests/refresh-state.test.js
```

## F4 — Geração de dados de calibração + endurecer closedAt

Goal: gravar os actuals crus por conclusão (calibração: só geração, tratamento depois) no sub-objeto `actuals` já admitido pelo schema do evento (F0/T-002), e promover closedAt de soft para hard no GATE-R2 via um corte persistido (grandfatheredTaskIds), forward-only, quando a lacuna de instrumentação (F1/T-001) chegar perto de zero.

### T-001 — Actuals de fase no evento {event:'phase-done'} (uma vez, não por task)
Grava os actuals agregados da fase (diff started→HEAD: arquivos, LOC, commits) no sub-objeto actuals do ÚNICO evento {event:'phase-done'} emitido por phase-done (modelo de evento de F0/T-003) — NUNCA nas N linhas {event:'task-done'}, senão o diff da fase seria duplicado N vezes (overcount). `started` = phase.started (o timestamp da fase, não plan/branch). Sem tratá-los (P2).
Files: scripts/append-completion.js, skills/shared/project-assets/project-transitions.md, tests/append-completion-actuals.test.js
scopeBoundary: actuals de fase SÓ no evento phase-done (cardinalidade 1 por fase, nunca por task); nenhuma regressão/calibração; não destrava o completion-event.schema (já pré-declarado em F0); started=phase.started.
acceptance: o evento {event:'phase-done'} inclui actuals.filesChanged/locAdded/locRemoved/commits do range phase.started→HEAD; os N eventos {event:'task-done'} do mesmo phase-done NÃO carregam os actuals da fase (sem duplicação); ausência de git/diff degrada para actuals omitido, sem erro; a linha com actuals valida no completion-event.schema.
verifier: kind shell — node --test tests/append-completion-actuals.test.js

### T-002 — Actuals de task via dispatch-log quando presente
Quando há dispatch-log.json para a task (lane codex), grava attempts/durationMs/escalations no sub-objeto actuals do evento de task-done.
Files: scripts/append-completion.js, tests/append-completion-dispatchlog.test.js
scopeBoundary: só lê dispatch-log existente; ausência não é erro (Mode-1 serial fica sem esses actuals); não cria dispatch-log nem instrumenta commits; usa o sub-objeto actuals já admitido.
acceptance: com dispatch-log presente, o evento task-done inclui actuals.attempts/durationMs/escalations; sem dispatch-log, o evento é emitido sem esses campos.
verifier: kind shell — node --test tests/append-completion-dispatchlog.test.js

### T-003 — Promover closedAt a hard-gate forward-only com corte persistido (validator + script de flip)
Adiciona um campo persistido `closedAtHardening { enforcedFrom: isoTimestamp, grandfatheredTaskIds: [string] }` ao plan.schema.json (opcional). Quando um plano o declara, checkMetInvariant (validate-state.js:364-399) exige closedAt para toda task done cujo id NÃO esteja em grandfatheredTaskIds; as ids grandfathered e os planos sem closedAtHardening continuam válidos. O flip NÃO é hand-edit: é implementado pelo script `scripts/harden-closedat.js` (operação única, idempotente) que computa grandfatheredTaskIds = done vivas sem closedAt no instante do flip, grava enforcedFrom=now no plano, e NUNCA inventa closedAt (P3). Sem o script, não há jeito reproduzível de criar o corte (o validator sozinho deixaria o operador hand-editar e grandfatherar ids errados).
Files: scripts/validate-state.js, scripts/harden-closedat.js, meta/schemas/plan.schema.json, assets/aideck-consumer/schema.json, tests/validate-state.test.js, tests/harden-closedat.test.js
scopeBoundary: forward-only via grandfatheredTaskIds persistido; legado/grandfathered nunca rejeitado; o script nunca inventa closedAt; não altera a regra evidence.passed do GATE-R2; bundle regenerado pelo gerador.
acceptance: o script harden-closedat computa grandfatheredTaskIds (= done vivas sem closedAt) e grava enforcedFrom idempotentemente (rerun não muda o conjunto nem reescreve enforcedFrom já gravado); com closedAtHardening declarado, task done nova (id fora de grandfatheredTaskIds) sem closedAt é rejeitada pelo validate-state; task done grandfathered (id na lista) sem closedAt continua válida; plano sem closedAtHardening não muda de comportamento (soft); schema-drift.test.js passa após o rebuild.
verifier: kind shell — node --test tests/validate-state.test.js && node --test tests/harden-closedat.test.js && node --test tests/schema-drift.test.js

```yaml
exit_gate:
  - id: G-1
    description: actuals crus (fase E task/dispatch-log) são gravados por conclusão no sub-objeto admitido e closedAt é hard-gated forward-only via corte persistido (grandfatheredTaskIds) gravado pelo script de flip, sem rejeitar legado.
    status: pending
    verifier:
      kind: shell
      command: node --test tests/append-completion-actuals.test.js && node --test tests/append-completion-dispatchlog.test.js && node --test tests/validate-state.test.js && node --test tests/harden-closedat.test.js && node --test tests/schema-drift.test.js
```

## F5 — Render no aiDeck (depende do redesign do dashboard)

Goal: registrar os dataSources burnup/spi no manifest e uma página com line-chart (2 séries) + stat SPI, usando só widgets publicados. DEPENDÊNCIA EXTERNA BLOQUEANTE: esta fase está bloqueada até o redesign do dashboard (plano fix-aideck-dashboard, F2) aterrissar — o forecast só renderiza sobre o dashboard refeito; por isso é a última fase. A dependência é declarada em `externalImports` na fase materializada (não só em prosa), e o verifier checa a presença do manifest refeito antes de a página ser admitida. As fases F0–F4 (instrumentação de tracking) são independentes e implementáveis já.

### T-001 — dataSources + página burn-up no manifest
Adiciona dataSources burnup e spi e uma página "Ritmo" ao manifest do consumer refeito: um line-chart com TRÊS trilhas (planejada 0→weightTotal, earnedCount, earnedProxy — as duas séries earned separadas por basis de F3/T-002) + stat para spiProxy (e stat informativo spiCount), validando contra widgets reais.
Files: assets/aideck-consumer/manifest.yaml, tests/aideck-consumer-manifest.test.js
scopeBoundary: usa só widgets publicados (line-chart, stat); não introduz widget inexistente; não altera as páginas/dataSources existentes além do necessário ao burn-up; PRÉ-REQUISITO BLOQUEANTE: não inicia antes do redesign do dashboard (fix-aideck-dashboard, F2) estar estável e o manifest refeito presente.
acceptance: manifest registra dataSources burnup e spi e a página com line-chart (planejada + earnedCount + earnedProxy) + stat spiProxy; todo widget usado na página existe no registry publicado do aiDeck.
verifier: kind shell — node --test tests/aideck-consumer-manifest.test.js

```yaml
exit_gate:
  - id: G-1
    description: a página de ritmo renderiza com widgets reais ligados a burnup.json/spi.json, sobre o dashboard refeito.
    status: pending
    verifier:
      kind: shell
      command: node --test tests/aideck-consumer-manifest.test.js
```
