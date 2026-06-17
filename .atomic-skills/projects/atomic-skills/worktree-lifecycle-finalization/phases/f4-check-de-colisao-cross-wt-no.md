---
schemaVersion: "0.1"
slug: worktree-lifecycle-finalization-f4-check-de-colisao-cross-wt-no
title: Check de colisão cross-WT no finalize (Decisão 7)
goal: "adicionar ao finalize uma detecção de colisão entre ≥2 worktrees vivas,
  GENÉRICA (qualquer projeto-alvo): um gate determinístico (detecção dos
  comandos build/test do projeto-alvo + merge especulativo + exit code) como
  token de entrada, e um workflow advisory de agentes LLM read-only (Agente A
  semântico-comportamental + Agente B recurso/contrato) escopados ao diff, que
  nunca gateiam."
status: active
branch: plan/worktree-lifecycle-finalization
started: 2026-06-17T18:52:47Z
lastUpdated: 2026-06-17T20:05:00Z
nextAction: "T-001 DONE (Mode 2/Codex; verifier 16/16 na primária MERGED
  5e1328d). Próximo: Start T-002 (workflow advisory cross-WT em
  project-finalize.md) em Mode 1 inline — doc auto-referencial; verifier grep
  'cross-wt-collision'+'advisory' + npm run validate-skills. Depois T-003 (Mode
  1)."
parentPlan: worktree-lifecycle-finalization
phaseId: F4
tasksDone: 1
tasksTotal: 3
gatesMet: 0
gatesTotal: 2
exitGates:
  - id: G-1
    description: "Gate determinístico: detecção genérica de comandos, ativa só com
      ≥2 WTs, conflito textual é 1º gate, projeto sem comando é skip registrado
      (não passe silencioso); suite verde."
    status: pending
    verifier:
      kind: test
      runner: node
      pattern: tests/cross-wt-gate.test.js
    verifierLabel: "test: node tests/cross-wt-gate.test.js"
  - id: G-2
    description: Workflow advisory (agentes A/B read-only ao diff, nunca gateiam,
      fallback portátil) documentado no finalize; skills válidos.
    status: pending
    verifier:
      kind: shell
      command: grep -qi 'cross-wt-collision'
        skills/shared/project-assets/project-finalize.md && grep -qi 'advisory'
        skills/shared/project-assets/project-finalize.md && npm run
        validate-skills
    verifierLabel: "shell: grep -qi 'cross-wt-collision' skills/shared/project-assets/…"
stack:
  - id: 1
    title: Check de colisão cross-WT no finalize (Decisão 7)
    type: task
    openedAt: 2026-06-16T22:50:35.627Z
tasks:
  - id: T-001
    title: "Gate determinístico: detecção genérica de build/test + merge especulativo"
    status: done
    closedAt: 2026-06-17T20:05:00Z
    lastUpdated: 2026-06-17T20:05:00Z
    summary: "Gate determinístico: detecta build/test do projeto-alvo e faz merge
      especulativo."
    outputs:
      - kind: file
        path: scripts/cross-wt-gate.js
      - kind: test
        path: tests/cross-wt-gate.test.js
    scopeBoundary:
      - dispara só com ≥2 worktrees vivas (feature solo não tem com o que
        colidir)
      - detecção dos comandos NUNCA hardcoded à stack deste repo (deriva de
        package.json scripts / Makefile / pyproject / config de CI)
      - um conflito textual no merge especulativo é o PRIMEIRO gate (exit≠0)
      - projeto sem comando build/test detectável não dá "passou" silencioso — é
        skip REGISTRADO (WARN) ou bloqueio.
    acceptance:
      - "`detectProjectCommands` descobre build/typecheck/test/lint a partir de
        fontes genéricas (package.json scripts, Makefile, pyproject) sem
        hardcode da stack"
      - "`cross-wt-gate` só ativa com ≥2 worktrees vivas e retorna no-op com <2"
      - um merge especulativo que conflita textualmente retorna exit≠0 ANTES de
        tentar o build (primeiro gate)
      - um projeto sem comando detectável retorna um desfecho `skip` REGISTRADO
        com WARN, nunca um passe silencioso
      - a função é pura sobre inputs injetados (não executa git/build real no
        teste).
    verifier:
      kind: test
      runner: node
      pattern: tests/cross-wt-gate.test.js
    evidence:
      verifierKind: test
      verifiedAt: 2026-06-17T20:05:00Z
      exitCode: 0
      testsCollected: 16
      passed: true
      outputSummary: "node --test tests/cross-wt-gate.test.js @ 5e1328d (merged
        primary): tests 16, pass 16, fail 0, exit 0. Mode 2 (Codex) exec em
        impl/wlf-t-001; re-verificado na primária MERGED (auto-report -o do
        Codex 'tests 1' DESCARTADO per wlf-f0-nascimento L-001 — contagem real
        16)."
  - id: T-002
    title: Workflow advisory de agentes read-only escopados ao diff
    status: pending
    lastUpdated: 2026-06-16T22:50:35.627Z
    summary: Workflow advisory de agentes A/B read-only escopados ao diff (nunca
      gateiam).
    outputs:
      - kind: file
        path: skills/shared/project-assets/project-finalize.md
    scopeBoundary:
      - "os agentes são ADVISORY (nunca o gate — o gate é o piso determinístico
        de T-001) e READ-ONLY (Iron Law: leitura paraleliza, merge/código
        serial)"
      - escopados ao footprint dos diffs + vizinhança imediata (leem o diff, não
        a árvore inteira)
      - fallback PORTÁVEL (agentes sequenciais ou skip registrado) onde a tool
        de workflow não existe
      - NÃO auto-resolver colisão (sinaliza/roteia para humano).
    acceptance:
      - "`project-finalize.md` documenta o Agente A (interferência
        comportamental/semântica) e o Agente B (colisão de
        recurso-compartilhado/contrato), ambos read-only e escopados ao diff,
        disparados só com ≥2 worktrees vivas, operator-prompted"
      - documenta que os agentes self-check mas NUNCA self-certify (o gate
        determinístico é a prova) e o fallback portátil
      - com a âncora `cross-wt-collision`
      - "`npm run validate-skills` passa."
    verifier:
      kind: shell
      command: grep -qi 'cross-wt-collision'
        skills/shared/project-assets/project-finalize.md && grep -qi 'advisory'
        skills/shared/project-assets/project-finalize.md && npm run
        validate-skills
  - id: T-003
    title: Wire archive teardown to read the recorded PR identity
    status: pending
    lastUpdated: 2026-06-17T19:35:52Z
    summary: archive passa integrationRef+prIdentity (do pr-url gravado) ao
      isTeardownSafe, fechando o handoff finalize→teardown.
    outputs:
      - kind: file
        path: skills/shared/project-assets/project-transitions.md
    scopeBoundary:
      - só o wiring da chamada isTeardownSafe no fluxo archive (lê o pr-url do
        references[] do plano + resolveBaseRef para {integrationRef, baseRef})
      - NÃO mudar o contrato de isTeardownSafe (scripts/worktree-teardown.js)
      - NÃO auto-remover worktrees — a guarda segue operator-prompted, fail-safe
        BLOQUEIA na dúvida
    acceptance:
      - "`project-transitions.md` archive resolve `{integrationRef, baseRef}`
        via `resolveBaseRef`, lê o `pr-url` do `references[]` do plano, e chama
        `isTeardownSafe({ branch, baseRef, integrationRef, prIdentity })`"
      - documenta que `indeterminate-base`/`pr-identity-missing` não disparam
        mais para um plano mergeado cujo pr-url está gravado
      - "`npm run validate-skills` passa."
    verifier:
      kind: shell
      command: grep -q 'prIdentity'
        skills/shared/project-assets/project-transitions.md && grep -q
        'integrationRef' skills/shared/project-assets/project-transitions.md &&
        npm run validate-skills
    provenance:
      surfacedAt: 2026-06-17T19:35:52Z
      surfacedDuring: F3
      surfacedBy: ai
      originalPhaseId: F3
    context:
      solves: "Fecha o handoff produtor(finalize)→consumidor(teardown): o finalize
        grava o pr-url, mas o archive chama isTeardownSafe({branch, baseRef})
        sem integrationRef/prIdentity, retornando indeterminate-base e nunca
        lendo a identidade — todo plano mergeado bloqueia o teardown."
      trigger: Review de phase-done F3 (local L#1 + Codex blind F-003, concordantes
        cross-model); o informed dropou o finding por transitions.md estar fora
        do escopo da T-001, mas o gap subjacente é real.
      assumesStillValid:
        - O contrato isTeardownSafe({branch, baseRef, integrationRef,
          prIdentity}) de F2 (scripts/worktree-teardown.js) permanece o ponto de
          entrada da remoção.
        - A gravação do pr-url no references[] do plano por F3 (finalize.md Step
          4) permanece a fonte da identidade do PR.
      ratifiedAt: 2026-06-17T19:35:52Z
      ratifiedBy: human
      lastReviewedAt: 2026-06-17T19:35:52Z
parked: []
emerged: []
summary: "No finalize, detecta colisão entre worktrees: gate build/test +
  agentes advisory ao diff."
planTitle: Finalização do ciclo de vida da worktree-do-plano
planActive: true
current: true
---

# Narrative / notes

Initiative for phase **F4 — Check de colisão cross-WT no finalize (Decisão 7)**.

## Session handoff
- **Narrative:** **F4 ATIVA**, `implement` em curso. **T-001 DONE** (1/3 tasks; gates 0/2 ainda — resolvem no phase-done). Gate determinístico cross-WT (`scripts/cross-wt-gate.js` + `tests/cross-wt-gate.test.js`) executado em **Mode 2 (Codex)**, merged FF na primária (`5e1328d`) e re-verificado na MERGED: `node --test tests/cross-wt-gate.test.js` → tests 16, pass 16, exit 0. Worktree `impl/wlf-t-001` removida pós-merge. Lessons F4 aplicadas (wlf-f2 L-002 OR-guard+mutation, wlf-f2 L-003 adapter `try/catch→block`, wlf-f1 L-001 `Object.hasOwn`).
- **Decision log:** (1) T-001 → Mode 2 por escolha do operador (AskUserQuestion); adjudicador = re-run na primária MERGED; auto-report `-o` do Codex (disse "tests 1") DESCARTADO — contagem real 16 (wlf-f0-nascimento L-001 RECONFIRMADA). (2) Contrato da API foi FIXADO por Opus no work-order (papel PLANS), espelhando `isTeardownSafe`/`resolveIntegrationRef`. (3) T-002+T-003 ficam **Mode 1 inline** (doc auto-referencial das próprias skills; verifier grep não captura qualidade de prosa).
- **Single nextAction:** Start **T-002** (Mode 1 inline): documentar em `skills/shared/project-assets/project-finalize.md` o workflow advisory cross-WT (Agente A comportamental/semântico + Agente B recurso/contrato, ambos read-only escopados ao diff, ≥2 WTs, operator-prompted, self-check≠self-certify, fallback portátil, âncora `cross-wt-collision`). Verifier: `grep -qi 'cross-wt-collision' … && grep -qi 'advisory' … && npm run validate-skills`.
- **Verbatim state:** T-001 verifier (re-run MERGED): `node --test tests/cross-wt-gate.test.js` → exit 0, tests 16, pass 16, fail 0. Commit source: `5e1328d feat(cross-wt-gate)`. Dispatch telemetry: `.atomic-skills/status/dispatch-log.json` (entry T-001, executor codex, verifierPassed true). T-002 verifier verbatim: `grep -qi 'cross-wt-collision' skills/shared/project-assets/project-finalize.md && grep -qi 'advisory' skills/shared/project-assets/project-finalize.md && npm run validate-skills`. **Follow-ups herdados:** install/detect suite RED pré-existente (base 4fbfb12); PROJECT-STATUS.md stale.
- **Uncommitted changes:** após o commit de state (`chore(project): done F4/T-001`) → árvore LIMPA. Source de T-001 já em `5e1328d`.

## Decisions

_(record decisions here as they are made)_

## Links

_(plan doc, external refs)_
