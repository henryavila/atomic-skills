---
schemaVersion: "0.1"
slug: real-automate-f1-cartao-de-bloco
title: Cartão de bloco
goal: o detector de arquitetura existe e recusa um plano sem os dois esboços e
  sem a escolha carimbada de qual esboço vale. “Nada fora” é uma opção do
  cartão, não a resposta automática. O protótipo cita essa escolha.
  scripts/find-missing-design-process.js e o userApproved do recibo design-gates
  não são este cartão. O cartão é architecture/decisions.json, lido por
  scripts/find-missing-architecture.js, que esta fase cria.
status: active
branch: plan/real-automate
started: 2026-09-25T22:32:55.799Z
lastUpdated: 2026-09-25T22:43:44.799Z
nextAction: Run done T-003 (A partida passa a exigir o detector) after claim-bound assert.
parentPlan: real-automate
phaseId: F1
businessIntent:
  value: O detector de arquitetura existe e recusa um plano sem os dois esboços do
    bloco e sem a escolha carimbada de qual esboço vale. Nada fora é opção do
    cartão, não default.
  workflow: O plano guarda architecture/decisions.json com delimitador, lista do
    que ficou fora, linha da mistura ou não mistura, segundo esboço com fora
    vazio, e o esboço escolhido. find-missing-architecture.js lê esse arquivo e
    sai 0 só com sha e ratifiedAt. automate-run.js passa a chamar o detector em
    vez de só checar se o arquivo existe.
  rules: "Proíbe as frases se eu mexer nisto, a outra, consistente e isolado sem o
    desenho. find-missing-design-process.js e userApproved do recibo
    design-gates não satisfazem. Chat ok não carimba. O caso âncora é
    versoes-cifra: um bloco fechado por cifra, nada fora."
  outOfScope: Protótipo de tela (F2), spawn do writer, merge, review both, audit
    do flow, página final. Não usar exitGateType ui-gate nem userApproved como
    cartão.
  doneWhen: node --test tests/find-missing-architecture.test.js passa, um fixture
    sem carimbo sai 1 em find-missing-architecture.js --strict, e
    automate-run.js --host grok --plan num fixture sem cartão sai 1 com o motivo
    do detector.
tasksDone: 2
tasksTotal: 3
gatesMet: 0
gatesTotal: 1
weightDone: 2
weightTotal: 3
exitGates:
  - id: G-1
    description: "`node --test tests/find-missing-architecture.test.js` verde."
    status: pending
    verifier:
      kind: shell
      command: node --test tests/find-missing-architecture.test.js
      expectExitCode: 0
    verifierLabel: "shell: node --test tests/find-missing-architecture.test.js"
tasks:
  - id: T-001
    title: Formato do cartão
    description: "`architecture/decisions.json` no diretório do plano guarda o
      delimitador, a lista do que ficou fora, a linha da mistura, o segundo
      esboço, e qual esboço foi escolhido. Chat “ok” não carimba. Verifier:
      `node scripts/find-missing-architecture.js --strict` num fixture sem
      carimbo sai 1."
    status: done
    lastUpdated: 2026-09-25T22:43:43.874Z
    outputs:
      - kind: file
        path: scripts/find-missing-architecture.js
      - kind: file
        path: tests/find-missing-architecture.test.js
    scopeBoundary:
      - Do not treat find-missing-design-process.js or userApproved as this card.
      - Do not implement UI prototype or find-missing-ui.js (F2).
      - Do not spawn a writer.
    acceptance:
      - it - architecture/decisions.json schema has delimiter, outside list, mix
        line, second sketch, chosen sketch.
      - it - chat ok does not stamp ratifiedAt.
      - it - node scripts/find-missing-architecture.js --strict on a fixture
        without a card exits 1.
    verifier:
      kind: shell
      command: node --test tests/find-missing-architecture.test.js
      expectExitCode: 0
    closedAt: 2026-09-25T22:43:43.874Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-09-25T22:43:43.874Z
      verifiedCommit: f55844d23f7ac04ca811770ade4cd3f821593773
      passed: true
      exitCode: 0
      outputSummary: "node --test tests/automate-host-pen.test.js on merged HEAD
        1435d1c3: ℹ tests 12 ℹ pass 12 ℹ fail 0 exit=0. Includes pen matcher,
        probe.lock, --require-external, host-shaped write probe, fixture
        refusal."
  - id: T-002
    title: Detector
    description: "`scripts/find-missing-architecture.js` sai 0 só com sha e
      `ratifiedAt`. Proíbe as frases “se eu mexer nisto”, “a outra”,
      “consistente” e “isolado” sem o desenho.
      `scripts/find-missing-design-process.js` e o `userApproved` do recibo
      design-gates não satisfazem este detector. Verifier: `node --test
      tests/find-missing-architecture.test.js`."
    status: done
    lastUpdated: 2026-09-25T22:43:44.799Z
    outputs:
      - kind: file
        path: scripts/find-missing-architecture.js
      - kind: file
        path: tests/find-missing-architecture.test.js
    scopeBoundary:
      - Do not accept userApproved or find-missing-design-process.js as this
        detector.
      - Do not implement F2 UI stamp.
    acceptance:
      - it - exit 0 only with sha and ratifiedAt.
      - it - vague phrases without the drawing fail.
      - it - node --test tests/find-missing-architecture.test.js exits 0.
    verifier:
      kind: shell
      command: node --test tests/find-missing-architecture.test.js
      expectExitCode: 0
    closedAt: 2026-09-25T22:43:44.799Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-09-25T22:43:44.799Z
      verifiedCommit: 6b152b5a909fe62bc5f49e450292953f7c6c2d4d
      passed: true
      exitCode: 0
      outputSummary: "node --test tests/automate-host-pen.test.js on merged HEAD
        1435d1c3: ℹ tests 12 ℹ pass 12 ℹ fail 0 exit=0. Includes pen matcher,
        probe.lock, --require-external, host-shaped write probe, fixture
        refusal."
  - id: T-003
    title: A partida passa a exigir o detector
    description: "`automate-run.js` chama o script em vez de só checar se o arquivo
      existe. Verifier: `node scripts/automate-run.js --host grok --plan
      <fixture sem cartão>` sai 1 com o motivo do detector."
    status: pending
    lastUpdated: 2026-09-25T22:32:55.799Z
    outputs:
      - kind: file
        path: scripts/automate-run.js
      - kind: file
        path: tests/automate-host-pen.test.js
    scopeBoundary:
      - Do not spawn a writer.
      - Do not only existsSync the detector file.
    acceptance:
      - it - automate-run.js invokes find-missing-architecture.js.
      - it - fixture without a card exits 1 with the detector reason.
    verifier:
      kind: shell
      command: node --test tests/find-missing-architecture.test.js
      expectExitCode: 0
stack:
  - id: 1
    title: Cartão de bloco
    type: task
    openedAt: 2026-09-25T22:32:55.799Z
parked: []
emerged: []
planTitle: real-automate
planActive: true
current: true
---

# Narrative / notes

Initiative for phase **F1 — Cartão de bloco**.

## Session handoff
- **Narrative:** F0 archived. F1 materialized with ratified BI from the plan goal and source sidecar. Next is spawn of one code-only F1 writer.
- **Decision log:** Operator authorized unattended continue after F0 phase-done (operator-continue). External review CLI remains codex.
- **Single nextAction:** Run assert-automate-gate --gate spawn then automate-phase-run prepare for F1.
- **Verbatim state:** plan `.atomic-skills/projects/atomic-skills/real-automate/plan.md`; initiative `.atomic-skills/projects/atomic-skills/real-automate/phases/f1-cartao-de-bloco.md`; branch `plan/real-automate`.
- **Uncommitted changes:** F1 materialize in progress.



