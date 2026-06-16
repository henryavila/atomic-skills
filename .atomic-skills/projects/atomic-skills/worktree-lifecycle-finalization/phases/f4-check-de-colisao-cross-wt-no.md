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
status: pending
branch: plan/worktree-lifecycle-finalization
started: 2026-06-16T22:50:35.627Z
lastUpdated: 2026-06-16T22:50:35.627Z
nextAction: "Start T-001: Gate determinístico: detecção genérica de build/test +
  merge especulativo"
parentPlan: worktree-lifecycle-finalization
phaseId: F4
tasksDone: 0
tasksTotal: 2
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
    status: pending
    lastUpdated: 2026-06-16T22:50:35.627Z
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
parked: []
emerged: []
summary: "No finalize, detecta colisão entre worktrees: gate build/test +
  agentes advisory ao diff."
planTitle: Finalização do ciclo de vida da worktree-do-plano
planActive: true
---

# Narrative / notes

Initiative for phase **F4 — Check de colisão cross-WT no finalize (Decisão 7)**.

## Decisions

_(record decisions here as they are made)_

## Links

_(plan doc, external refs)_
