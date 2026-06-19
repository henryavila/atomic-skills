---
schemaVersion: "0.1"
slug: deadline-burnup-forecast
title: Deadline Burn-up Forecast (Earned Value / SPI)
version: "1.0"
status: active
started: 2026-06-17T12:06:57.781Z
lastUpdated: 2026-06-19T09:20:00Z
branch: plan/deadline-burnup-forecast
currentPhase: F2
parallelismAllowed: false
principles:
  - id: P1
    title: Sinal antes de cálculo
    body: Primeiro tornar o fluxo observável (a transição done emite evento
      verificável); o forecast é consequência. O RED da feature é "a transição
      done emite um evento?" — hoje não emite.
  - id: P2
    title: Capturar imutável agora, tratar depois
    body: Eventos e actuals são gravados crus no instante em que acontecem;
      regressão/calibração é fase posterior. Nenhuma fonte derivada lossy
      substitui o log de eventos.
  - id: P3
    title: Forward-only, sem histórico cosmético
    body: Enforcement de closedAt vale só para frente; legado fica closedAt:null.
      Proibido inventar closedAt retroativo em lote — colapsa a curva num degrau
      falso.
  - id: P4
    title: Uma fonte, não duas
    body: O evento de conclusão é efeito colateral atômico do próprio comando
      done/phase-done/reconcile, não um arquivo paralelo mantido à mão que
      diverge do tracker.
glossary: []
phases:
  - id: F0
    slug: deadline-burnup-forecast-f0-fonte-de-fluxo-evento-done-emitido
    title: "Fonte de fluxo: evento done emitido na transição"
    goal: criar o log append-only de conclusões (completions.jsonl) e fazer os
      passos done/phase-done/reconcile emitirem um evento imutável por
      conclusão, com schema validado. Este é o RED da feature (sem isso não há
      curva earned).
    dependsOn: []
    subPhaseCount: 4
    exitGate:
      summary: 1 criterion to meet
      criteria:
        - id: G-1
          description: o completions.jsonl recebe um evento imutável por conclusão,
            validado por schema (event enum), emitido pelas três transições —
            wiring estrutural (T-003 lint-transition-emits) E contrato da API
            (T-004 emit-on-transition) verificados no gate.
          status: met
          metAt: 2026-06-17T19:14:53Z
          verifier:
            kind: shell
            command: node --test tests/append-completion.test.js && node --test
              tests/completion-event-schema.test.js && node --test
              tests/emit-on-transition.test.js && node --test
              tests/transition-emits.test.js
          evidence:
            verifierKind: shell
            verifiedAt: 2026-06-17T19:14:53Z
            passed: true
            exitCode: 0
            outputSummary: "G-1 4-test chain on post-review tree 7c593f7 — 32 pass (14+10+3+5), 0 fail, exit 0"
    status: done
    reviewGate:
      status: passed
      at: 7c593f7
      mode: local
      reviewFile: .atomic-skills/reviews/2026-06-17-1938-code-deadline-burnup-forecast-f0.md
      verifiedAt: 2026-06-17T19:14:53Z
    summary: Cria o log append-only de conclusões e faz a transição done emitir o
      evento — o RED do forecast.
  - id: F1
    slug: deadline-burnup-forecast-f1-closedat-forward-only-auditor-soft
    title: "closedAt forward-only: auditor soft + emissão"
    goal: tornar closedAt auditável (soft, mede a lacuna de instrumentação) e
      emiti-lo na projeção de task do dashboard, sem backfill cosmético e sem
      hard-gate ainda.
    dependsOn:
      - F0
    subPhaseCount: 3
    exitGate:
      summary: 1 criterion to meet
      criteria:
        - id: G-1
          description: closedAt é auditável (soft) e closedAt+lastUpdated são emitidos na
            projeção e admitidos no schema (sem drift); nenhum closedAt
            retroativo é inventado.
          status: met
          metAt: 2026-06-19T09:15:51Z
          verifier:
            kind: shell
            command: node --test tests/find-unclosed-done.test.js && node --test
              tests/emit-consumer-state.test.js && node --test
              tests/schema-drift.test.js
          evidence:
            verifierKind: shell
            verifiedAt: 2026-06-19T09:15:51Z
            passed: true
            exitCode: 0
            outputSummary: "G-1 3-test chain on HEAD 5a735b9 — 19 pass (4+14+1), 0 fail, exit 0; auditor also green on live tree (every done task has closedAt)"
    status: done
    reviewGate:
      status: passed
      at: 5a735b9
      mode: local
      reviewFile: .atomic-skills/reviews/2026-06-19-0920-code-deadline-burnup-forecast-f1.md
      verifiedAt: 2026-06-19T09:20:00Z
    summary: Torna closedAt auditável (soft) e o emite na projeção, sem backfill
      cosmético.
  - id: F2
    slug: deadline-burnup-forecast-f2-peso-por-task-proxy-estrutural-roll
    title: "Peso por task: proxy estrutural + rollups"
    goal: introduzir tasks[].weight (number, opcional, default=1) AUTORADO pelo modelo
      no Stage 6 da decomposição (prosa, como os summaries; NUNCA por src/decompose.js
      congelado) de sinais estruturais e auditor-enforced, com rollups
      weightDone/weightTotal espelhando tasksDone/tasksTotal.
    dependsOn:
      - F1
    subPhaseCount: 3
    exitGate:
      summary: 1 criterion to meet
      criteria:
        - id: G-1
          description: weight existe no schema (task) e weightDone/weightTotal são
            admitidos (source + projeção), somados em rollups e emitidos sem
            drift, com auditor de backfill.
          status: met
          metAt: 2026-06-19T12:24:41Z
          verifier:
            kind: shell
            command: node --test tests/schema-drift.test.js && node --test
              tests/compute-rollups.test.js && node --test
              tests/emit-consumer-state.test.js
          evidence:
            verifierKind: shell
            verifiedAt: 2026-06-19T12:24:41Z
            passed: true
            exitCode: 0
            outputSummary: "G-1 3-test chain on reviewed+remediated HEAD ee960c9 — 20 pass (schema-drift 1 + compute-rollups 4 + emit-consumer-state 15), 0 fail, exit 0"
    status: pending
    reviewGate:
      status: passed
      at: ee960c9
      mode: local
      reviewFile: .atomic-skills/reviews/2026-06-19-1233-code-deadline-burnup-forecast-f2.md
      verifiedAt: 2026-06-19T12:33:22Z
    summary: Dá peso de complexidade a cada task (proxy automático) e soma em
      rollups weightDone/Total.
  - id: F3
    slug: deadline-burnup-forecast-f3-serie-earned-vs-planned-deadline-wi
    title: Série earned-vs-planned + deadline + wiring de recompute
    goal: adicionar plan.deadline, computar a série burn-up (earned acumulado vs
      linha planejada CRESCENTE 0→weightTotal — earned-value, não burn-down) e o
      SPI por basis no emit, e ligar o recompute ao refresh-state (que hoje roda
      rollups+reconcile+emitFocus mas NÃO invoca emit-consumer-state).
    dependsOn:
      - F2
    subPhaseCount: 3
    exitGate:
      summary: 1 criterion to meet
      criteria:
        - id: G-1
          description: a série earned-vs-planned + SPI é emitida e recomputada
            automaticamente pelo refresh-state, com deadline no schema.
          status: pending
          verifier:
            kind: shell
            command: node --test tests/emit-series.test.js && node --test
              tests/refresh-state.test.js
    status: pending
    summary: Computa a série earned-vs-planejada e o SPI contra o deadline,
      recomputada no refresh-state.
  - id: F4
    slug: deadline-burnup-forecast-f4-geracao-de-dados-de-calibracao-endu
    title: Geração de dados de calibração + endurecer closedAt
    goal: "gravar os actuals crus por conclusão (calibração: só geração, tratamento
      depois) e promover closedAt de soft para hard no GATE-R2 quando a lacuna
      de instrumentação chegar perto de zero."
    dependsOn:
      - F3
    subPhaseCount: 3
    exitGate:
      summary: 1 criterion to meet
      criteria:
        - id: G-1
          description: actuals crus são gravados por conclusão (no sub-objeto já admitido)
            e closedAt é hard-gated forward-only via corte persistido
            (grandfatheredTaskIds), sem rejeitar legado.
          status: pending
          verifier:
            kind: shell
            command: 'node --test tests/append-completion-actuals.test.js && node --test tests/append-completion-dispatchlog.test.js && node --test tests/validate-state.test.js && node --test tests/harden-closedat.test.js && node --test tests/schema-drift.test.js'
    status: pending
    summary: Grava os actuals crus por conclusão (calibração futura) e endurece
      closedAt forward-only.
  - id: F5
    slug: deadline-burnup-forecast-f5-render-no-aideck-depende-do-redesig
    title: Render no aiDeck (depende do redesign do dashboard)
    goal: "registrar os dataSources burnup/spi no manifest e uma página com
      line-chart (planejada + earnedCount + earnedProxy) + stat SPI, usando só widgets publicados.
      DEPENDÊNCIA EXTERNA: bloqueada até o redesign do dashboard (plano
      fix-aideck-dashboard, F2) aterrissar — o forecast só renderiza sobre o
      dashboard refeito; por isso é a última fase. As fases F0–F4
      (instrumentação de tracking) são independentes e implementáveis já."
    dependsOn:
      - F4
    externalImports:
      - kind: repo-path
        path: .atomic-skills/projects/atomic-skills/fix-aideck-dashboard/plan.md
        label: "BLOQUEANTE: o redesign do dashboard (fix-aideck-dashboard, F2) deve
          aterrissar antes do render — F5 não inicia sem o manifest refeito
          presente."
        inside_repo: true
    subPhaseCount: 1
    exitGate:
      summary: 1 criterion to meet
      criteria:
        - id: G-1
          description: a página de ritmo renderiza com widgets reais ligados a
            burnup.json/spi.json, sobre o dashboard refeito.
          status: pending
          verifier:
            kind: shell
            command: node --test tests/aideck-consumer-manifest.test.js
    status: pending
    summary: Renderiza o burn-up/SPI no dashboard — bloqueada até o redesign do
      dashboard aterrissar.
references: []
planActive: true
planTitle: Deadline Burn-up Forecast (Earned Value / SPI)
---

# Deadline Burn-up Forecast (Earned Value / SPI)

## 1. Context

Burn-up ponderado por complexidade contra um deadline por-plano: mostra se um plano está acima/abaixo do ritmo esperado para a data-alvo, em vez de uma data fixa de conclusão. Implementa a fonte de fluxo (evento done emitido na transição), o peso por task, a série earned-vs-planned e o render no aiDeck. Fonte-de-verdade: design.md deste plano.

## 2. Inviolable principles

- **P1 Sinal antes de cálculo** — Primeiro tornar o fluxo observável (a transição done emite evento verificável); o forecast é consequência. O RED da feature é "a transição done emite um evento?" — hoje não emite.
- **P2 Capturar imutável agora, tratar depois** — Eventos e actuals são gravados crus no instante em que acontecem; regressão/calibração é fase posterior. Nenhuma fonte derivada lossy substitui o log de eventos.
- **P3 Forward-only, sem histórico cosmético** — Enforcement de closedAt vale só para frente; legado fica closedAt:null. Proibido inventar closedAt retroativo em lote — colapsa a curva num degrau falso.
- **P4 Uma fonte, não duas** — O evento de conclusão é efeito colateral atômico do próprio comando done/phase-done/reconcile, não um arquivo paralelo mantido à mão que diverge do tracker.

## 3. Phase tree

_(Canonical list in frontmatter `phases:`. aiDeck renders the tree visually when running.)_
