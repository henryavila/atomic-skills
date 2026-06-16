---
schemaVersion: "0.1"
slug: worktree-lifecycle-finalization-f5-coupling-interim-de-atomic-s
title: Coupling interim de .atomic-skills/ (Decisão 5)
goal: conter com o mínimo o coupling do tree `.atomic-skills/` entre feature-PRs
  — `focus.json` (estado-de-sessão regenerável) vai para `.gitignore` como
  carve-out explícito ao "tree versionado", e os JSON append-only de `status/*`
  ganham `.gitattributes merge=union`; a partição estrutural fica como plano
  separado.
status: pending
branch: plan/worktree-lifecycle-finalization
started: 2026-06-16T22:50:35.627Z
lastUpdated: 2026-06-16T22:50:35.627Z
nextAction: "Start T-001: focus.json git-ignore + status/* merge=union, com
  round-trip preservado"
parentPlan: worktree-lifecycle-finalization
phaseId: F5
tasksDone: 0
tasksTotal: 1
gatesMet: 0
gatesTotal: 2
exitGates:
  - id: G-1
    description: focus.json ignorado + status/* merge=union; round-trip
      install/uninstall verde com focus.json não-rastreado.
    status: pending
    verifier:
      kind: shell
      command: grep -q 'focus.json' .gitignore && grep -qi 'merge=union'
        .gitattributes && node --test tests/install-uninstall-roundtrip.test.js
    verifierLabel: "shell: grep -q 'focus.json' .gitignore && grep -qi 'merge=union' .…"
  - id: G-2
    description: Suite e skills válidos após o carve-out.
    status: pending
    verifier:
      kind: shell
      command: npm run validate-skills
    verifierLabel: "shell: npm run validate-skills"
stack:
  - id: 1
    title: Coupling interim de .atomic-skills/ (Decisão 5)
    type: task
    openedAt: 2026-06-16T22:50:35.627Z
tasks:
  - id: T-001
    title: focus.json git-ignore + status/* merge=union, com round-trip preservado
    status: pending
    lastUpdated: 2026-06-16T22:50:35.627Z
    summary: focus.json no .gitignore + status/* com merge=union, sem quebrar o
      round-trip.
    outputs:
      - kind: file
        path: .gitignore
      - kind: file
        path: .gitattributes
    scopeBoundary:
      - carve-out MÍNIMO (só `focus.json` ignorado + `status/*` append-only com
        union) — NÃO particionar estruturalmente o tree (plano separado)
      - a mudança no `.gitignore` é repo-policy manual, FORA do contrato
        install/uninstall (o installer não cria nem ignora `focus.json`)
      - NÃO aplicar `merge=union` a JSON pontual (só append-only seguro).
    acceptance:
      - '`.gitignore` passa a ignorar `focus.json` (carve-out documentado ao
        princípio "tree versionado")'
      - "`.gitattributes` aplica `merge=union` aos JSON append-only de
        `.atomic-skills/status/` (lista concreta, não pontuais)"
      - o teste de round-trip install/uninstall segue verde com `focus.json`
        não-rastreado (gerado em runtime, só não commitado)
      - o consumidor statusline ainda encontra `focus.json` (regenerável).
    verifier:
      kind: shell
      command: grep -q 'focus.json' .gitignore && grep -qi 'merge=union'
        .gitattributes && node --test tests/install-uninstall-roundtrip.test.js
parked: []
emerged: []
summary: "Contém o coupling de .atomic-skills: focus.json ignorado + status/*
  com merge=union."
planTitle: Finalização do ciclo de vida da worktree-do-plano
planActive: true
---

# Narrative / notes

Initiative for phase **F5 — Coupling interim de .atomic-skills/ (Decisão 5)**.

## Decisions

_(record decisions here as they are made)_

## Links

_(plan doc, external refs)_
