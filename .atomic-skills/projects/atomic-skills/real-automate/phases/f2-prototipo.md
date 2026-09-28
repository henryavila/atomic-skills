---
schemaVersion: "0.1"
slug: real-automate-f2-prototipo
title: Protótipo
goal: |
  o detector de tela existe. Plano sem superfície visível carimba “sem
  tela”. “Sem tela” com task que toca Vue, sheet, viewer ou editor é
  recusado. O carimbo da tela cita o sha do cartão. `exitGateType: ui-gate`
  não é o carimbo. O carimbo é `ui/ui.json`, lido por
  `scripts/find-missing-ui.js`, que esta fase cria.
status: active
branch: plan/real-automate
started: 2026-09-28T14:10:00.000Z
lastUpdated: 2026-09-28T14:10:00.000Z
nextAction: implement F2 T-001
parentPlan: real-automate
phaseId: F2
businessIntent:
  value: |
    O detector de tela existe e recusa planos sem carimbo de protótipo de UI.
    Planos sem superfície visível registram explicitamente "sem tela" com justificativa,
    e tasks que tocam UI (Vue, sheet, viewer, editor) são impedidas de usar "sem tela".
    O carimbo da tela vincula o sha do cartão de arquitetura.
  workflow: |
    O plano guarda ui/ui.json listando telas com path do protótipo e sha,
    ou { "none": true, "reason": "..." }. scripts/find-missing-ui.js lê esse arquivo,
    valida a ausência de toque em UI quando none: true, confere consistência com o
    sha do cartão (architecture/decisions.json) e sai 0 apenas com carimbo íntegro.
    automate-run.js passa a executar esse detector em vez de apenas verificar existsSync.
  rules: |
    exitGateType: ui-gate no plano não substitui o carimbo ui/ui.json.
    "Sem tela" (none: true) é proibido se qualquer task do plano tocar Vue, sheet,
    viewer ou editor. Sha divergente do cartão de arquitetura é recusado. Chat ok não carimba.
  outOfScope: |
    Spawn de writer, criação de worktree de writer, merge (F3), review-both e
    fechamento de fase no loop automate (F4), página final (F5). Não altera o detector de arquitetura.
  doneWhen: |
    node --test tests/find-missing-ui.test.js passa (verde), node scripts/find-missing-ui.js
    --strict em fixture vazio ou inconsistente sai 1, e automate-run.js invoca find-missing-ui.js
    reportando o motivo do detector quando o carimbo falta.
tasksDone: 0
tasksTotal: 3
gatesMet: 0
gatesTotal: 1
weightDone: 0
weightTotal: 3
exitGates:
  - id: G-1
    description: "`node --test tests/find-missing-ui.test.js` verde."
    status: pending
    verifier:
      kind: manual
      description: Verify exit-gate prose with the user during phase-done.
tasks:
  - id: T-001
    title: Formato
    description: "`ui/ui.json` lista telas com path do protótipo e sha, ou `{ \"none\": true }` com motivo. Verifier: `node scripts/find-missing-ui.js --strict` num fixture vazio sai 1."
    status: pending
  - id: T-002
    title: Detector
    description: "`scripts/find-missing-ui.js` recusa `none: true` quando o plano toca superfície de UI, e recusa sha de arquitetura divergente. `exitGateType: ui-gate` não é o carimbo. Verifier: `node --test tests/find-missing-ui.test.js`."
    status: pending
  - id: T-003
    title: A partida exige o detector
    description: "`automate-run.js` chama `find-missing-ui.js`. Verifier: o mesmo comando de T-003 da F1, agora também citando o detector de UI quando o carimbo falta."
    status: pending
stack:
  - id: 1
    title: Protótipo
    type: task
    openedAt: 2026-09-28T14:10:00.000Z
parked: []
emerged: []
---

# Narrative / notes

Initiative for phase **F2 — Protótipo**.

## Session handoff
- **Narrative:** F1 archived. F2 materialized with ratified BI from the plan goal and source sidecar. Next is implementing find-missing-ui.js and tests.
- **Decision log:** Operator authorized continue after F1.
- **Single nextAction:** implement F2 T-001, T-002, T-003.
- **Verbatim state:** plan `.atomic-skills/projects/atomic-skills/real-automate/plan.md`; initiative `.atomic-skills/projects/atomic-skills/real-automate/phases/f2-prototipo.md`; branch `plan/real-automate`.
- **Uncommitted changes:** F2 materialize in progress.
