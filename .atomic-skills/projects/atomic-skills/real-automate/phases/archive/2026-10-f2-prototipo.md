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
status: done
branch: plan/real-automate
started: 2026-09-28T14:10:00.000Z
lastUpdated: 2026-10-02T12:25:10.000Z
nextAction: present phase-start package for F3 validate-only
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
tasksDone: 3
tasksTotal: 3
gatesMet: 1
gatesTotal: 1
weightDone: 3
weightTotal: 3
exitGates:
  - id: G-1
    description: "`node --test tests/find-missing-ui.test.js` verde."
    status: met
    metAt: 2026-10-02T11:33:00.000Z
    verifier:
      kind: shell
      command: node --test tests/find-missing-ui.test.js
      expectExitCode: 0
    verifierLabel: "shell: node --test tests/find-missing-ui.test.js"
    evidence:
      verifierKind: shell
      verifiedAt: 2026-10-02T11:33:00.000Z
      verifiedCommit: 48b943e3a6b788f0dfb151067083e0625c27e8ea
      passed: true
      exitCode: 0
      outputSummary: "node --test tests/find-missing-ui.test.js: ℹ tests 28 ℹ suites 5 ℹ pass 28 ℹ fail 0"
    evidenceSummary: passed · 2026-10-02
tasks:
  - id: T-001
    title: Formato
    description: "`ui/ui.json` lista telas com path do protótipo e sha, ou `{ \"none\": true }` com motivo. Verifier: `node scripts/find-missing-ui.js --strict` num fixture vazio sai 1."
    status: done
    lastUpdated: 2026-09-28T18:20:00.000Z
    closedAt: 2026-09-28T18:20:00.000Z
    outputs:
      - kind: file
        path: scripts/find-missing-ui.js
      - kind: file
        path: tests/find-missing-ui.test.js
    verifier:
      kind: shell
      command: node --test tests/find-missing-ui.test.js
      expectExitCode: 0
    evidence:
      verifierKind: shell
      verifiedAt: 2026-09-28T18:20:00.000Z
      verifiedCommit: d52f496373a2f1e292c914a8a8437e9314e652eb
      passed: true
      exitCode: 0
      outputSummary: "node --test tests/find-missing-ui.test.js: ℹ tests 17 ℹ pass 17 ℹ fail 0. T-001 suite: missing ui/ui.json exits 1, empty fixture exits 1, valid none:true exits 0, valid screens exits 0, chat ok no stamp."
  - id: T-002
    title: Detector
    description: "`scripts/find-missing-ui.js` recusa `none: true` quando o plano toca superfície de UI, e recusa sha de arquitetura divergente. `exitGateType: ui-gate` não é o carimbo. Verifier: `node --test tests/find-missing-ui.test.js`."
    status: done
    lastUpdated: 2026-09-28T18:20:30.000Z
    closedAt: 2026-09-28T18:20:30.000Z
    outputs:
      - kind: file
        path: scripts/find-missing-ui.js
      - kind: file
        path: tests/find-missing-ui.test.js
    verifier:
      kind: shell
      command: node --test tests/find-missing-ui.test.js
      expectExitCode: 0
    evidence:
      verifierKind: shell
      verifiedAt: 2026-09-28T18:20:30.000Z
      verifiedCommit: d52f496373a2f1e292c914a8a8437e9314e652eb
      passed: true
      exitCode: 0
      outputSummary: "node --test tests/find-missing-ui.test.js: ℹ tests 17 ℹ pass 17 ℹ fail 0. T-002 suite: refuses none:true when plan touches Vue/sheet/viewer/editor, exitGateType ui-gate not stamp, refuses divergent arch sha, screen sha mismatch exits 1."
  - id: T-003
    title: A partida exige o detector
    description: "`automate-run.js` chama `find-missing-ui.js`. Verifier: o mesmo comando de T-003 da F1, agora também citando o detector de UI quando o carimbo falta."
    status: done
    lastUpdated: 2026-09-28T18:21:00.000Z
    closedAt: 2026-09-28T18:21:00.000Z
    outputs:
      - kind: file
        path: scripts/automate-run.js
      - kind: file
        path: tests/automate-host-pen.test.js
    verifier:
      kind: shell
      command: node --test tests/find-missing-ui.test.js
      expectExitCode: 0
    evidence:
      verifierKind: shell
      verifiedAt: 2026-09-28T18:21:00.000Z
      verifiedCommit: d52f496373a2f1e292c914a8a8437e9314e652eb
      passed: true
      exitCode: 0
      outputSummary: "node --test tests/find-missing-ui.test.js + node --test tests/automate-host-pen.test.js: 17+34=51 pass / 0 fail. T-003 suite: automate-run calls find-missing-ui.js --strict, fixture without ui/ui.json exits 1 citing find-missing-ui.js. automate-host-pen: startup runs find-missing-ui.js instead of existsSync."
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
- **Narrative:** F2 Protótipo closed. Detector `scripts/find-missing-ui.js` (450 lines) + 28 tests. Review-fix `1de572c9` merged `48b943e3`. Evaluation pass. Lessons L-F2-1/L-F2-2 recorded. Review both residual (local 1 major + Codex 3 majors) operator-accepted. Audit-delivery CLOSED.
- **Decision log:** Operator accept local F-001 fence skip (L-F2-2). Operator accept Codex mixed-fence, symlink, phase EACCES. Decision-review PASS. Runaway 2059-line NLP parser stashed, not shipped.
- **Single nextAction:** present phase-start package for F3 validate-only
- **Verbatim state:** plan `.atomic-skills/projects/atomic-skills/real-automate/plan.md`; archived initiative `.atomic-skills/projects/atomic-skills/real-automate/phases/archive/2026-10-f2-prototipo.md`; eval `.atomic-skills/reviews/eval-real-automate-F2.md`; G-1 `node --test tests/find-missing-ui.test.js` 28 pass / 0 fail at `48b943e3`.
- **Uncommitted changes:** phase-done terminal writes (this archive + plan currentPhase F3).
