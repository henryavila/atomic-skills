---
schemaVersion: "0.1"
slug: real-automate-f0-partida-que-recusa
title: Partida que recusa
goal: "`--automate` deixa de ser a sessão que escreve. O programa recusa sem
  caneta real no host, sem flow, sem revisão do plano e sem ground truth, e
  também recusa enquanto os detectores de cartão e protótipo não existem. Caneta
  real significa duas provas. Um lock de prova isolado, que não é o pen.lock,
  faz o script do hook sair 2 num payload de escrita e sair 0 sem lock. Além
  disso, uma chamada de escrita do próprio host (Claude, Codex ou Grok) tem de
  ser recusada e não pode deixar arquivo no disco. Sem essa segunda prova o
  programa não parte. O teste de recusa aponta um plan.md fixture sem flow, não
  o source.md. Não dispara writer."
status: active
branch: plan/real-automate
started: 2026-09-25T03:17:12.483Z
lastUpdated: 2026-09-25T10:50:00.000Z
nextAction: "Start T-001: Caneta dos três hosts"
parentPlan: real-automate
phaseId: F0
businessIntent:
  value: O comando automate deixa de ser a mesma sessão que escreve. Quem corre
    node scripts/automate-run.js vê a partida recusada até a caneta do host, o
    flow, a revisão do plano e o ground truth existirem, e também enquanto os
    detectores de cartão e protótipo não existem.
  workflow: O operador passa --host claude-code, codex ou grok e --plan. O
    programa lê o hook daquele host, cria um lock de prova isolado (não o
    pen.lock), exige status 2 no script e status 0 sem lock, dispara uma escrita
    real pela ferramenta do host e só segue se ela for recusada e não gravar
    arquivo, apaga o lock de prova, roda find-missing-flow.js --strict,
    find-unreviewed-plans.js --require-external e
    find-plans-missing-ground-truth.js, e confere se
    find-missing-architecture.js e find-missing-ui.js existem.
    `--require-external` sai 1 quando a única linha de review é `- internal:`.
    Qualquer falha imprime a lista e sai 1. Não grava pen.lock e não dispara
    writer.
  rules: Só Claude Code, Codex e Grok. Sem lock a caneta sai 0. Com lock, escrita
    fora do worktree e shell saem 2. SKIP e SKIP-EMERGENT não desligam a caneta.
    `pre-write.sh` permanece ao lado dela, com o matcher atual. `stop.sh` fica
    fora. A skill de implement não ganha parágrafos novos no lugar do programa.
  outOfScope: Cartão de bloco, protótipo, spawn do writer, merge, review both,
    audit do flow, página e a fase seguinte. Também substituir ou apagar
    `pre-write.sh`, e alterar o `stop.sh`.
  doneWhen: node --test tests/automate-host-pen.test.js passa, o hook sai 0 sem
    lock e sai 2 com lock de prova isolado, uma escrita real do host ativo é
    recusada e não cria arquivo, e node scripts/automate-run.js --host codex
    --plan num fixture plan.md sem flow sai com exit 1 citando automate-pen.sh e
    find-missing-architecture.js.
tasksDone: 0
tasksTotal: 3
gatesMet: 0
gatesTotal: 1
weightDone: 0
weightTotal: 3
exitGates:
  - id: G-1
    description: "`node --test tests/automate-host-pen.test.js` verde. Sem lock o
      hook sai 0. Com lock de prova isolado, um payload de escrita sai 2. Uma
      escrita real do host ativo é recusada e não cria arquivo. `node
      scripts/automate-run.js --host codex --plan <fixture plan.md sem flow>`
      sai 1 citando `automate-pen.sh` e `find-missing-architecture.js`."
    status: pending
    verifier:
      kind: manual
      description: Verify exit-gate prose with the user during phase-done.
    verifierLabel: manual
stack:
  - id: 1
    title: Partida que recusa
    type: task
    openedAt: 2026-09-25T03:17:12.483Z
tasks:
  - id: T-001
    title: Caneta dos três hosts
    description: "`src/automate-host-pen.js`, `scripts/automate-pen-hook.js` e
      `skills/shared/project-assets/hooks/automate-pen.sh` negam
      `Write`/`Edit`/`MultiEdit`/`Bash`, `apply_patch`/`shell` e
      `write`/`search_replace`/`run_terminal_command` enquanto o lock existe.
      Sem lock, exit 0. O lock de prova é `probe.lock`, não `pen.lock`.
      Verifier: `node --test tests/automate-host-pen.test.js`."
    status: pending
    lastUpdated: 2026-09-25T03:17:12.483Z
  - id: T-002
    title: Registro no plugin Grok e no setup
    description: "`src/providers/skills-file-set.js` e
      `skills/shared/project-assets/project-setup.md` registram
      `automate-pen.sh` ao lado de `pre-write.sh`, sem apagar esse hook e sem
      trocar o matcher dele. O matcher da caneta inclui `apply_patch`, `Bash`,
      `shell` e `run_terminal_command`, além das ferramentas de arquivo.
      Verifier: `node --test tests/automate-host-pen.test.js`."
    status: pending
    lastUpdated: 2026-09-25T10:50:00.000Z
  - id: T-003
    title: Partida que lista o que falta
    description: "`scripts/automate-run.js --host <claude-code|codex|grok> --plan
      <plan.md>` cria e apaga um `probe.lock` isolado, exige exit 2 e depois 0
      no script, e só segue se uma escrita real do host for recusada sem criar
      arquivo. Um `assessHostWrite` chamado com a prova desligada não conta.
      Plano cuja única review é `- internal:` também sai 1. Sai 1 com a lista de
      bloqueios e não cria `pen.lock`. Verifier: `node scripts/automate-run.js
      --host codex --plan <fixture plan.md sem flow>` sai 1 citando
      `automate-pen.sh` e `find-missing-architecture.js`."
    status: pending
    lastUpdated: 2026-09-25T10:50:00.000Z
parked: []
emerged: []
---

# Narrative / notes

Initiative for phase **F0 — Partida que recusa**.

## Decisions

- 2026-09-25: a caneta é o segundo PreToolUse. `pre-write.sh` permanece, com o matcher atual. `SKIP` e `SKIP-EMERGENT` desligam esse hook por 24h e não desligam a caneta. `stop.sh` fica fora da F0. A prova de escrita do host não pode ser um `assessHostWrite` com a prova desligada.

## Links

_(plan doc, external refs)_
