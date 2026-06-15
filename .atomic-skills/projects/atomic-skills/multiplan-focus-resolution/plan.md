---
schemaVersion: "0.1"
slug: multiplan-focus-resolution
title: Resolução de foco em camadas + enforcer worktree-por-plano
version: "1.0"
status: paused
started: 2026-06-15T19:42:12Z
lastUpdated: 2026-06-15T19:42:12Z
currentPhase: F0
parallelismAllowed: false
phases:
  - id: F0
    slug: multiplan-focus-resolution
    title: Resolução de foco em camadas + enforcer worktree-por-plano
    goal: Tornar o foco da statusline determinístico com mais de um plano ativo, via
      resolução em camadas e um enforcer que isola planos concorrentes em
      worktrees.
    dependsOn: []
    subPhaseCount: 4
    exitGate:
      summary: 1 criterion to meet
      criteria:
        - id: F0-G1
          description: Enforcer soft implementado e foco determinístico com multi-plano
            demonstrado (statusline mostra o plano certo + marcador de
            ambiguidade).
          status: pending
          verifier:
            kind: manual
            description: Validar com o usuário que o foco resolve corretamente com 2+ planos
              ativos e que o enforcer força/oferece worktree.
    status: pending
    summary: "Foco determinístico para multi-plano: resolução em camadas + enforcer
      worktree."
references:
  - kind: file
    path: docs/design/statusline-focus-integration.md
    label: Spec da integração statusline/focus (digest, 4 camadas de frescor, D1–D6)
planTitle: Resolução de foco em camadas + enforcer worktree-por-plano
---

# Resolução de foco em camadas + enforcer worktree-por-plano

## 1. Context

Iniciativa standalone (paused — queued para build) que dá continuidade à integração
`atomic-skills:project` ↔ claudebar. O produtor do digest `focus.json` já foi entregue
(commit `72c7f35`): resolução em camadas no `emit-focus` (branch-match → recência),
schema, `refresh-state` e os hooks de frescor. Falta o que exige design colaborativo:
o **enforcer** que torna o foco determinístico quando há mais de um plano ativo, ancorado
no invariante "≤1 plano ativo por branch/worktree". Spec base:
`docs/design/statusline-focus-integration.md`.

## 2. Phase tree

_(Plano degenerado de 1 fase — F0 carrega o trabalho. Lista canônica no frontmatter `phases:`.)_

- **F0 — Resolução de foco em camadas + enforcer worktree-por-plano**
