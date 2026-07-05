---
schemaVersion: "0.1"
slug: help-command-f1-o-mapa-estado-proximo-passo-como-helper
title: O mapa estado→próximo-passo como helper determinístico
goal: Construir scripts/compute-help.js (puro-leitura, fail-open) que classifica
  o estado pela lista de precedência e lê nextAction verbatim, coberto por
  fixtures um-por-estado + sobrepostos que provam a ordem.
status: active
branch: null
started: 2026-07-05T12:58:58Z
lastUpdated: 2026-07-05T12:58:58Z
nextAction: "Rodar `done T-001` após criar scripts/compute-help.js e vê-lo verde
  em node --test tests/help/compute-help.test.js."
startedCommit: abcf00ce480fab58c569a4565ff76d85d0d95725
parentPlan: help-command
phaseId: F1
businessIntent:
  value: "F1 constrói o cérebro determinístico do `help`: o helper puro-leitura
    compute-help.js que classifica o estado real (projeto/plano/fase, rollups,
    drift) em spineStage + próximo-passo. Valor: a resposta \"onde estou / qual o
    próximo passo\" passa a vir de lógica testável e reutilizável, não de prosa que
    raciocina do zero — habilitando o render da F2. Valor pro usuário:
    confiabilidade (lê nextAction verbatim, degrada graciosamente)."
  workflow: "Retomada de projeto — o dev roda `help` e precisa saber, numa tela, o
    estágio do ciclo de vida e o comando exato a rodar em seguida."
  rules: "puro-leitura / zero-mutação / fail-open (P1); nextStep.command =
    nextAction persistido lido verbatim, precedência só como fallback (P2); reusa
    o grafo de transições real e detect-completion.js — não reimplementa (P3);
    contrato de exit-code do detector honrado (parsear JSON em exit 0 e 1;
    fail-open só em exit 2, stdout não-parseável ou falha de spawn)."
  outOfScope: "Nenhum rendering do bloco de ensino nem mini-mapa ASCII (isso é
    F2); não gera nem abre o HTML; não toca aiDeck; não altera o resumo no-args de
    5 linhas."
  doneWhen: "compute-help.test.js verde com o mapa de decisão coberto (um fixture
    por estado da precedência + os 3 sobrepostos que provam a ordem + o par
    presente/ausente de commandSource) e o fail-open provado."
tasksDone: 0
tasksTotal: 2
gatesMet: 0
gatesTotal: 1
weightDone: 0
weightTotal: 5
exitGates:
  - id: G-1
    description: compute-help.test.js passa (mapa de decisão coberto + fail-open
      provado)
    status: pending
    verifier:
      kind: test
      runner: node --test
      pattern: tests/help/compute-help.test.js
    verifierLabel: "test: node --test tests/help/compute-help.test.js"
stack:
  - id: 1
    title: O mapa estado→próximo-passo como helper determinístico
    type: task
    openedAt: 2026-07-05T12:58:58Z
tasks:
  - id: T-001
    title: — `scripts/compute-help.js`
    summary: Helper puro-leitura que classifica o estado (projeto/plano/fase,
      rollups, drift via detect-completion.js) em spineStage + próximo-passo,
      lendo nextAction verbatim (fallback só quando ausente); fail-open, zero
      mutação.
    weight: 3
    description: "Helper puro-leitura, zero-token, fail-open. Resolve
      projeto/plano/fase ativos, lê rollups e status da fase, classifica pela
      lista de precedência para derivar spineStage/reason/why. O nextStep.command
      é o nextAction persistido lido verbatim (commandSource persisted); a
      precedência só fornece o comando quando nextAction está ausente/vazio
      (commandSource fallback). Contrato do detector de drift: detect-completion.js
      --json sai 1 quando há drift, 0 sem drift, 2 em bad-args — parsear stdout
      como JSON tanto em exit 0 quanto 1; fail-open só em stdout não-parseável,
      exit 2 ou falha de spawn."
    status: pending
    lastUpdated: 2026-07-05T12:58:58Z
    scopeBoundary:
      - só leitura + classificação + leitura do nextAction; NUNCA escreve estado;
        reusa detect-completion.js (não reimplementa).
    acceptance:
      - nextAction presente vira command igual ao nextAction e commandSource
        persisted; drift simulado (JSON válido + exit 1) vira spineStage reconcile
        e fallback reconcile; erro de I/O / exit 2 / stdout não-parseável vira
        saída parcial exit 0; zero mutação no state tree.
    verifier:
      kind: test
      runner: node --test
      pattern: tests/help/compute-help.test.js
    outputs:
      - kind: file
        path: scripts/compute-help.js
  - id: T-002
    title: — Fixtures dos estados
    summary: Um fixture por item da lista de precedência + 3 sobrepostos que
      provam a ordem (blocked+pending→switch; drift+pending→reconcile;
      active-24h+descriptor-only→reconcile) + par presente/ausente de
      commandSource, no teste compute-help.test.js.
    weight: 2
    description: "Um fixture por item da lista de precedência + fixtures
      sobrepostos que provam a ordem: blocked+pending vira switch (não implement);
      drift+pending vira reconcile (não implement); active-mais-de-24h +
      descriptor-only vira reconcile (não materialize). Mais um par de
      fonte-do-comando: um com nextAction presente e um sem."
    status: pending
    lastUpdated: 2026-07-05T12:58:58Z
    scopeBoundary:
      - só fixtures + o teste do helper; não altera o helper nem outros testes.
    acceptance:
      - cada item da precedência coberto; os 3 fixtures sobrepostos asseguram o
        comando de maior prioridade; o par presente/ausente cobre as duas
        commandSource.
    verifier:
      kind: test
      runner: node --test
      pattern: tests/help/compute-help.test.js
    outputs:
      - kind: file
        path: tests/help/fixtures
      - kind: file
        path: tests/help/compute-help.test.js
parked: []
emerged: []
planTitle: Comando `help` — GPS de terminal da skill `project`
planActive: true
current: true
---

# Narrative / notes

Initiative for phase **F1 — O mapa estado→próximo-passo como helper determinístico**.

## Decisions

_(record decisions here as they are made)_

## Links

_(plan doc, external refs)_

## Session handoff

- **Narrative:** F1 materializada a partir do sidecar `f1-…source.json` (2 tasks:
  T-001 helper `compute-help.js`, T-002 fixtures+teste). businessIntent ratificado
  pelo usuário. Nenhuma lição de start-gate aplicável. Implementação ainda não
  começou.
- **Single nextAction:** Rodar `done T-001` após criar `scripts/compute-help.js`
  e vê-lo verde em `node --test tests/help/compute-help.test.js`.
- **Verbatim state:** exit-gate F1/G-1 = `node --test tests/help/compute-help.test.js`.
  startedCommit = `abcf00c`.
