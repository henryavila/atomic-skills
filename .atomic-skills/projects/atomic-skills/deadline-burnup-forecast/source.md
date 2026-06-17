# Deadline Burn-up Forecast (Earned Value / SPI)

Burn-up ponderado por complexidade contra um deadline por-plano: mostra se um plano está acima/abaixo do ritmo esperado para a data-alvo, em vez de uma data fixa de conclusão. Implementa a fonte de fluxo (evento done emitido na transição), o peso por task, a série earned-vs-planned e o render no aiDeck. Fonte-de-verdade: design.md deste plano.

## Principles

### P1 Sinal antes de cálculo
Primeiro tornar o fluxo observável (a transição done emite evento verificável); o forecast é consequência. O RED da feature é "a transição done emite um evento?" — hoje não emite.

### P2 Capturar imutável agora, tratar depois
Eventos e actuals são gravados crus no instante em que acontecem; regressão/calibração é fase posterior. Nenhuma fonte derivada lossy substitui o log de eventos.

### P3 Forward-only, sem histórico cosmético
Enforcement de closedAt vale só para frente; legado fica closedAt:null. Proibido inventar closedAt retroativo em lote — colapsa a curva num degrau falso.

### P4 Uma fonte, não duas
O evento de conclusão é efeito colateral atômico do próprio comando done/phase-done/reconcile, não um arquivo paralelo mantido à mão que diverge do tracker.

## F0 — Fonte de fluxo: evento done emitido na transição

Goal: criar o log append-only de conclusões (completions.jsonl) e fazer os passos done/phase-done/reconcile emitirem um evento imutável por conclusão, com schema validado. Este é o RED da feature (sem isso não há curva earned).

### T-001 — Helper append-completion + log JSONL
Cria o helper que faz append de uma linha JSON por conclusão em `.atomic-skills/analytics/completions.jsonl` (cria `analytics/` se ausente). Campos: ts, event, projectId, planSlug, phaseId, taskId, weight. Append-only.
Files: scripts/append-completion.js, tests/append-completion.test.js
scopeBoundary: só escreve em .atomic-skills/analytics/; nunca muta state .md; não computa série nem agrega.
acceptance: appendCompletion anexa exatamente uma linha JSON válida; analytics/ é criado idempotentemente; chamadas repetidas nunca reescrevem nem reordenam linhas já gravadas.
verifier: kind shell — node --test tests/append-completion.test.js

### T-002 — Schema do evento de conclusão + validação
Define o schema da linha do completions.jsonl e liga sua validação ao pipeline determinístico, sem quebrar o validate-state existente (que só varre .md).
Files: meta/schemas/completion-event.schema.json, scripts/validate-aideck-state.js, tests/completion-event-schema.test.js
scopeBoundary: additionalProperties:false no schema; campos exatamente os de T-001; não altera as regras cross-field do validate-state.js (GATE-R2 intacto).
acceptance: uma linha bem-formada valida; linha com campo extra ou sem ts/weight é rejeitada; o validador roda sobre o jsonl sem afetar a varredura .md do validate-state.
verifier: kind shell — node --test tests/completion-event-schema.test.js

### T-003 — Emitir o evento nas transições done/phase-done/reconcile
Liga o append-completion aos três pontos de mutação que já carimbam conclusão na skill (done, phase-done bulk-close, reconcile), no mesmo instante da transição.
Files: skills/shared/project-assets/project-transitions.md
scopeBoundary: edição de instrução de skill (prosa executada pelo modelo); não cria novo comando; um append por task fechada (phase-done em lote = N appends), nunca um <now> compartilhado.
acceptance: project-transitions.md instrui append-completion no passo done; instrui um append por task no phase-done bulk-close; instrui append no reconcile.
verifier: kind shell — grep -c "append-completion" skills/shared/project-assets/project-transitions.md | grep -qE "^[3-9]|[0-9]{2,}"

```yaml
exit_gate:
  - id: G-1
    description: o completions.jsonl recebe um evento imutável por conclusão, validado por schema, emitido pelas três transições.
    status: pending
    verifier:
      kind: shell
      command: node --test tests/append-completion.test.js && node --test tests/completion-event-schema.test.js
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
Adiciona closedAt e lastUpdated à projeção de task emitida (hoje emit-consumer-state.js:255-267 carrega só id/title/summary/status/blocked/blockedBy), para a curva earned ler o instante de conclusão.
Files: scripts/emit-consumer-state.js, tests/emit-consumer-state.test.js
scopeBoundary: só adiciona campos à projeção de task; não altera outras projeções; closedAt ausente vira null (legado honesto), nunca inventado.
acceptance: a projeção de task inclui closedAt e lastUpdated; task sem closedAt na fonte emite closedAt:null.
verifier: kind shell — node --test tests/emit-consumer-state.test.js

### T-003 — Admitir closedAt na projeção do schema emitido + rebuild do bundle
Permite closedAt na projeção de task do aideck-state.schema.json (additionalProperties:false) e regenera o bundle assets/aideck-consumer/schema.json para o schema-drift.test.js passar.
Files: meta/schemas/aideck-state.schema.json, assets/aideck-consumer/schema.json
scopeBoundary: mudança additiva no $defs da projeção de task; não toca regras cross-field; bundle regenerado pelo gerador, não editado à mão.
acceptance: aideck-state.schema.json admite closedAt na task emitida; bundle regenerado e schema-drift.test.js passa.
verifier: kind shell — node --test tests/schema-drift.test.js

```yaml
exit_gate:
  - id: G-1
    description: closedAt é auditável (soft) e emitido na projeção; nenhum closedAt retroativo é inventado.
    status: pending
    verifier:
      kind: shell
      command: node --test tests/find-unclosed-done.test.js && node --test tests/emit-consumer-state.test.js
```

## F2 — Peso por task: proxy estrutural + rollups

Goal: introduzir tasks[].weight (number, opcional, default=1) derivado por proxy estrutural no decompose, com rollups weightDone/weightTotal espelhando tasksDone/tasksTotal.

### T-001 — Campo weight no schema da task + rebuild do bundle
Adiciona weight (number, minimum 0, opcional) ao $defs.task de initiative.schema.json e regenera o bundle.
Files: meta/schemas/initiative.schema.json, assets/aideck-consumer/schema.json
scopeBoundary: campo opcional, fora de required (backward-compat 0.1); não toca GATE-R2; bundle regenerado pelo gerador.
acceptance: task com weight numérico valida; task sem weight continua válida; schema-drift.test.js passa após o rebuild.
verifier: kind shell — node --test tests/schema-drift.test.js

### T-002 — Rollups weightDone/weightTotal
Estende compute-rollups.js para precomputar weightTotal (soma de weight, default 1 por task sem weight) e weightDone (soma das done) por initiative, e emiti-los.
Files: scripts/compute-rollups.js, scripts/emit-consumer-state.js, tests/compute-rollups.test.js
scopeBoundary: espelha o padrão tasksDone/tasksTotal; idempotente; task sem weight conta como 1 (degrada para count-burnup).
acceptance: weightTotal soma todos os weights (1 quando ausente); weightDone soma os das done; rerun de compute-rollups é idempotente (sem diff na segunda passada).
verifier: kind shell — node --test tests/compute-rollups.test.js

### T-003 — Auditor de tasks sem weight (backfill replicável)
Cria find-unweighted-tasks.js espelhando find-missing-task-summaries.js (zero-token, exit não-zero) e referencia-o no passo de anotação do decompose (Stage 6 de project-create-plan.md) como ponto de atribuição.
Files: scripts/find-unweighted-tasks.js, tests/find-unweighted-tasks.test.js, skills/shared/project-assets/project-create-plan.md
scopeBoundary: read-only; não atribui weight sozinho (o texto/proxy é autorado na skill); não toca src/decompose.js (congelado, R-ORCH-10).
acceptance: lista tasks sem weight e sai não-zero quando há ao menos uma; project-create-plan.md Stage 6 referencia o auditor como ponto de atribuição do weight.
verifier: kind shell — node --test tests/find-unweighted-tasks.test.js

```yaml
exit_gate:
  - id: G-1
    description: weight existe no schema, é somado em rollups weightDone/weightTotal, e tem auditor de backfill.
    status: pending
    verifier:
      kind: shell
      command: node --test tests/schema-drift.test.js && node --test tests/compute-rollups.test.js
```

## F3 — Série earned-vs-planned + deadline + wiring de recompute

Goal: adicionar plan.deadline, computar a série burn-up (earned acumulado vs linha planejada linear) e o SPI no emit, e ligar o recompute ao refresh-state (fechando o gap em que ele só chama emitFocus).

### T-001 — Campo deadline no plano + rebuild do bundle
Adiciona deadline (isoTimestamp, opcional) ao plan.schema.json e regenera o bundle.
Files: meta/schemas/plan.schema.json, assets/aideck-consumer/schema.json
scopeBoundary: campo opcional; plan.schema.json é .strict(), edição explícita; bundle regenerado pelo gerador.
acceptance: plano com deadline ISO valida; plano sem deadline continua válido; schema-drift.test.js passa.
verifier: kind shell — node --test tests/schema-drift.test.js

### T-002 — buildSeries: burnup.json + spi.json
Adiciona buildSeries() ao emit-consumer-state.js que lê completions.jsonl, bucketiza earned-weight por dia, computa a linha planejada (weightTotal no started → 0 no deadline) e o SPI, emitindo burnup.json e spi.json como bare-arrays; adiciona $defs.burnup e $defs.spi ao aideck-state.schema.json e regenera o bundle.
Files: scripts/emit-consumer-state.js, meta/schemas/aideck-state.schema.json, assets/aideck-consumer/schema.json, tests/emit-series.test.js
scopeBoundary: toda agregação é pré-computada (aiDeck não agrega); saída são bare-arrays; sem deadline emite earned sem linha planejada.
acceptance: burnup.json traz earned acumulado e a linha planejada por bucket; spi.json traz o SPI corrente; cada record emitido tem $def correspondente (validate-aideck-state verde).
verifier: kind shell — node --test tests/emit-series.test.js && node --test tests/schema-drift.test.js

### T-003 — Ligar emit ao refresh-state sem regredir emitFocus
Faz refresh-state.js disparar o emit da série (hoje importa só emitFocus), mantendo o digest emitFocus existente intacto.
Files: scripts/refresh-state.js, tests/refresh-state.test.js
scopeBoundary: additivo: adiciona o passo de emit; não remove nem altera o path emitFocus; idempotente, fail-open.
acceptance: refresh-state regenera burnup.json/spi.json além de focus.json; o digest focus.json continua sendo emitido (sem regressão).
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

Goal: gravar os actuals crus por conclusão (calibração: só geração, tratamento depois) e promover closedAt de soft para hard no GATE-R2 quando a lacuna de instrumentação chegar perto de zero.

### T-001 — Actuals de fase no evento phase-done
Grava no evento de phase-done os stats do diff started→HEAD (arquivos, LOC, commits) como actuals crus, sem tratá-los.
Files: scripts/append-completion.js, skills/shared/project-assets/project-transitions.md, tests/append-completion-actuals.test.js
scopeBoundary: só captura/anexa actuals crus; nenhuma regressão/calibração; campos actuals opcionais no schema do evento (não quebram F0).
acceptance: o evento phase-done inclui filesChanged/locAdded/locRemoved/commits do range; ausência de git/diff degrada para actuals omitidos, sem erro.
verifier: kind shell — node --test tests/append-completion-actuals.test.js

### T-002 — Actuals de task via dispatch-log quando presente
Quando há dispatch-log.json para a task (lane codex), grava attempts/duração/escalations como actuals no evento de task-done.
Files: scripts/append-completion.js, tests/append-completion-dispatchlog.test.js
scopeBoundary: só lê dispatch-log existente; ausência não é erro (Mode-1 serial fica sem esses actuals); não cria dispatch-log nem instrumenta commits.
acceptance: com dispatch-log presente, o evento task-done inclui attempts/duração/escalations; sem dispatch-log, o evento é emitido sem esses campos.
verifier: kind shell — node --test tests/append-completion-dispatchlog.test.js

### T-003 — Promover closedAt para hard-gate no GATE-R2
Quando o auditor (F1 T-001) reporta lacuna ~0, adiciona ao checkMetInvariant (validate-state.js:364-399) a exigência de closedAt para toda task done cuja transição é posterior ao corte; legado grandfathered.
Files: scripts/validate-state.js, tests/validate-state.test.js
scopeBoundary: forward-only: legado sem closedAt não é rejeitado; não altera a regra de evidence.passed existente do GATE-R2.
acceptance: task done nova sem closedAt é rejeitada pelo validate-state; task done legada (pré-corte) sem closedAt continua válida.
verifier: kind shell — node --test tests/validate-state.test.js

```yaml
exit_gate:
  - id: G-1
    description: actuals crus são gravados por conclusão e closedAt é hard-gated forward-only sem rejeitar legado.
    status: pending
    verifier:
      kind: shell
      command: node --test tests/append-completion-actuals.test.js && node --test tests/validate-state.test.js
```

## F5 — Render no aiDeck (depende do redesign do dashboard)

Goal: registrar os dataSources burnup/spi no manifest e uma página com line-chart (2 séries) + stat SPI, usando só widgets publicados. DEPENDÊNCIA EXTERNA: bloqueada até o redesign do dashboard (plano fix-aideck-dashboard, F2) aterrissar — o forecast só renderiza sobre o dashboard refeito; por isso é a última fase. As fases F0–F4 (instrumentação de tracking) são independentes e implementáveis já.

### T-001 — dataSources + página burn-up no manifest
Adiciona dataSources burnup e spi e uma página "Ritmo" com line-chart (planejada vs earned) + stat SPI ao manifest do consumer refeito, validando contra widgets reais.
Files: assets/aideck-consumer/manifest.yaml, tests/aideck-consumer-manifest.test.js
scopeBoundary: usa só widgets publicados (line-chart, stat); não introduz widget inexistente; não altera as páginas/dataSources existentes além do necessário ao burn-up; não inicia antes do redesign do dashboard (fix-aideck-dashboard) estar estável.
acceptance: manifest registra dataSources burnup e spi e a página com line-chart + stat; todo widget usado na página existe no registry publicado do aiDeck.
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
