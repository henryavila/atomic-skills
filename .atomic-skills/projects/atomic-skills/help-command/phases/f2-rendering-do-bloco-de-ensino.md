---
schemaVersion: "0.1"
slug: help-command-f2-rendering-do-bloco-de-ensino
title: Rendering do bloco de ensino
goal: O asset chama compute-help.js e formata o bloco de 5 linhas + mini-mapa
  ASCII com "você está aqui"; adicionar a flag help --html que abre o guia
  visual pelo caminho de contrato fixo, fail-open quando ausente.
summary: Renderiza o bloco de ensino do `help` no terminal e liga `help --html`
  ao guia visual fixo.
status: active
branch: develop
started: 2026-07-07T19:33:21Z
lastUpdated: 2026-07-07T19:47:35Z
nextAction: Rode `done T-002` depois de implementar `help --html` com mock do
  opener e fail-open.
startedCommit: dbf9b212267e5a95b803b6e3cc721b56b2539ec1
parentPlan: help-command
phaseId: F2
businessIntent:
  value: "Transforma o helper determinístico compute-help.js em uma experiência de
    retomada legível no terminal: bloco de 5 linhas, mini-mapa com posição atual
    e comando exato de próximo passo. Para o usuário, reduz ambiguidade ao
    voltar a um plano e oferece acesso opcional ao guia visual via help --html."
  workflow: "Retomada de projeto: o dev roda /atomic-skills:project help para
    entender onde está e qual comando executar; quando precisa do guia visual,
    roda help --html."
  rules: Read-only, zero-mutação e fail-open; o render exibe nextStep.command
    vindo do helper verbatim, sem recomputar; help --html usa o caminho fixo
    docs/design/project-onboarding/index.html e o helper canônico open_url de
    project-view.md; testes não abrem navegador real.
  outOfScope: Não muda a lógica de classificação do compute-help.js; não altera o
    resumo no-args; não gera nem valida o HTML do guia; não toca aiDeck.
  doneWhen: render-smoke.test.js e html-resolve.test.js passam, e o eyeball em
    projeto real registra comando exato, plano alvo, trecho renderizado, data e
    resultado pass/fail.
  derived:
    - question: Como F0/L-001 altera a F2?
      answer: F0/L-001 foi aplicado ao contrato do opener canônico em T-002.
    - question: Como F1/L-001 e F1/L-002 alteram a F2?
      answer: F1/L-001 e F1/L-002 foram aplicados ao render verbatim e à cobertura da
        costura IO→render em T-001.
tasksDone: 1
tasksTotal: 2
gatesMet: 0
gatesTotal: 3
weightDone: 3
weightTotal: 5
exitGates:
  - id: G-1
    description: smoke de render verde contra fixture
    status: pending
    verifier:
      kind: test
      runner: node --test
      pattern: tests/help/render-smoke.test.js
    verifierLabel: "test: node --test tests/help/render-smoke.test.js"
  - id: G-2
    description: html-resolve.test.js verde
    status: pending
    verifier:
      kind: test
      runner: node --test
      pattern: tests/help/html-resolve.test.js
    verifierLabel: "test: node --test tests/help/html-resolve.test.js"
  - id: G-3
    description: eyeball num projeto real registrado como evidência
    status: pending
    verifier:
      kind: manual
      description: "Rodar `help` num projeto real e registrar a evidência no
        phase-done da F2 (initiative evidence/lessons) com estes campos: comando
        exato rodado, projeto/plano-slug alvo, trecho do bloco renderizado
        observado, data, e resultado pass/fail. Uma nota sem esses campos NÃO
        satisfaz o gate."
    verifierLabel: manual
stack:
  - id: 1
    title: Rendering do bloco de ensino
    type: task
    openedAt: 2026-07-07T19:33:21Z
tasks:
  - id: T-001
    title: — Render em `project-help.md`
    summary: Renderiza o JSON do `compute-help.js` no asset `project-help.md` como
      bloco de 5 linhas e mini-mapa, usando o comando do helper verbatim e
      cobrindo fail-open por smoke test.
    weight: 3
    description: 'O asset chama compute-help.js, formata o bloco de 5 linhas + o
      mini-mapa ASCII com "você está aqui" na spineStage. Fail-open: se o helper
      falhar, cai para o resumo no-args e diz onde travou. A formatação vive
      numa função pura testável (formatHelp(json)) para o gate ter o que
      verificar. Documenta a relação com o no-args e os aliases decididos.
      Aplica F1/L-001: o render usa nextStep.command vindo do compute-help.js
      verbatim, sem recomputar fase/comando. Aplica F1/L-002: o smoke cobre a
      costura IO→render, não só o formatador puro.'
    status: done
    lastUpdated: 2026-07-07T19:47:35Z
    closedAt: 2026-07-07T19:47:35Z
    evidence:
      verifierKind: test
      verifiedAt: 2026-07-07T19:47:35Z
      exitCode: 0
      testsCollected: 3
      passed: true
      outputSummary: "node --test tests/help/render-smoke.test.js → tests 3, pass
        3, fail 0"
    scopeBoundary:
      - só o render do asset + o formatador puro + seu smoke; não altera a
        lógica de classificação do helper.
    acceptance:
      - rodar help num projeto real imprime o bloco com PROXIMO PASSO batendo
        com o nextAction persistido; mini-mapa marca a fase certa; SE TRAVAR
        lista why/status --browser/help.
      - O render usa nextStep.command produzido pelo helper verbatim; não deriva
        comando/fase da iniciativa resolvida por fallback.
      - O smoke cobre pelo menos um caminho de integração IO→render além do
        formatador puro.
    verifier:
      kind: test
      runner: node --test
      pattern: tests/help/render-smoke.test.js
    outputs:
      - kind: file
        path: skills/shared/project-assets/project-help.md
      - kind: file
        path: scripts/compute-help.js
      - kind: file
        path: tests/help/render-smoke.test.js
  - id: T-002
    title: — Flag `help --html` (abrir o guia visual)
    summary: Implementa `help --html` com caminho fixo do guia visual, abertura via
      `open_url` e fail-open testado sem abrir navegador real.
    weight: 2
    description: Implementar a checagem de existência do caminho de contrato fixo
      (docs/design/project-onboarding/index.html) + abertura via open_url;
      fail-open quando ausente (mensagem + exit 0). Imprime a linha GUIA VISUAL
      no help normal só quando o HTML existe. Reusa o mecanismo de abertura de
      status --browser pelo helper canônico `open_url` em `project-view.md`; não
      chama open/xdg-open diretamente.
    status: pending
    lastUpdated: 2026-07-07T19:33:21Z
    scopeBoundary:
      - só a checagem do caminho fixo + abertura; NÃO gera nem valida o HTML;
        nenhuma dependência de rede; sem fallback configurável.
    acceptance:
      - "Contrato runtime de help --html testado (mock do opener): HTML presente
        no caminho de contrato -> invoca open_url atrás de checagem de
        existência e sai 0; HTML ausente -> imprime mensagem clara apontando o
        caminho esperado e sai 0 (fail-open); falha do opener -> fail-open (não
        propaga erro, sai 0); a linha GUIA VISUAL aparece no help sem-flag
        apenas quando o arquivo existe. O teste mocka a invocação do opener (não
        abre navegador real, roda headless)."
      - Não usa `open`/`xdg-open` cru; cita e reutiliza o helper canônico
        `open_url` de `project-view.md`.
    verifier:
      kind: test
      runner: node --test
      pattern: tests/help/html-resolve.test.js
    outputs:
      - kind: file
        path: skills/shared/project-assets/project-help.md
      - kind: file
        path: scripts/compute-help.js
      - kind: file
        path: tests/help/html-resolve.test.js
parked: []
emerged: []
planTitle: Comando `help` — GPS de terminal da skill `project`
planActive: true
current: true
---

# Narrative / notes

Initiative for phase **F2 — Rendering do bloco de ensino**.

## Decisions

- Lessons gate applied F0/L-001 to T-002 and F1/L-001 + F1/L-002 to T-001 before
  activation.

## Links

_(plan doc, external refs)_

## Session handoff

- **Narrative:** F2 segue ativa em `help-command`/`F2`; `T-001` foi fechada com
  evidência `node --test tests/help/render-smoke.test.js → tests 3, pass 3, fail
  0`. Resta `T-002` pendente para `help --html`, com 3 gates de fase ainda
  pendentes.
- **Decision log:** A materialização aplicou F0/L-001 em T-002 e F1/L-001 +
  F1/L-002 em T-001 antes da ativação; `T-001` manteve o comando vindo de
  `nextStep.command` verbatim e deixou `help --html` para `T-002`.
- **Single nextAction:** Implementar `T-002` em
  `skills/shared/project-assets/project-help.md`, `scripts/compute-help.js` e
  `tests/help/html-resolve.test.js`, começando pelo verifier
  `node --test tests/help/html-resolve.test.js`.
- **Verbatim state:** `.atomic-skills/projects/atomic-skills/help-command/phases/f2-rendering-do-bloco-de-ensino.md`;
  `.atomic-skills/projects/atomic-skills/help-command/plan.md`; `git status --porcelain`;
  `node --test tests/help/render-smoke.test.js`; `e0b9bfe feat(T-001): render
  project help block`.
- **Uncommitted changes:** clean tree

## Self-review against code-quality gates

- **Lessons review:** Applied F0/L-001, F1/L-001, and F1/L-002 at phase start.
- **G1 read-before-claim:** materialização baseada no `plan.md`, no sidecar F2 e
  nas lessons files carregadas antes da escrita.
- **G2 soft-language:** `nextAction` é um comando concreto de retomada da primeira
  task; summaries e acceptance evitam promessa sem verifier.
- **G6 reference-or-strike:** F2 nasce com verifiers/outputs por task e exit-gates
  com verifiers explícitos.
