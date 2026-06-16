---
schemaVersion: "0.1"
slug: multiplan-focus-resolution
title: Resolução de foco em camadas + enforcer worktree-por-plano
version: "1.0"
status: active
started: 2026-06-15T19:42:12Z
lastUpdated: 2026-06-16T12:00:18Z
currentPhase: F0
branch: plan/multiplan-focus
parallelismAllowed: false
phases:
  - id: F0
    slug: multiplan-focus-resolution
    title: Resolução de foco em camadas + enforcer worktree-por-plano
    goal: Tornar o foco da statusline determinístico com mais de um plano ativo, via
      resolução em camadas e um enforcer que isola planos concorrentes em
      worktrees.
    dependsOn: []
    subPhaseCount: 6
    exitGate:
      summary: 1 criterion to meet
      criteria:
        - id: F0-G1
          description: Enforcer soft implementado e foco determinístico com multi-plano
            demonstrado (statusline mostra o plano certo + marcador de
            ambiguidade).
          status: met
          metAt: 2026-06-16T13:08:36Z
          verifier:
            kind: manual
            description: Validar com o usuário que o foco resolve corretamente com 2+ planos
              ativos e que o enforcer força/oferece worktree.
          evidence:
            verifierKind: manual
            verifiedAt: 2026-06-16T13:08:36Z
            passed: true
            outputSummary: "Usuário confirmou met. Evidência viva: 4 planos ativos,
              cada um com branch plan/<slug> distinto + worktree própria; focus.json
              da árvore plan/multiplan-focus resolve para multiplan-focus-resolution
              com drift:false e multipleActivePlans:false (tree-relative). Enforcer
              nos 3 pontos: create-plan Stage 6 (soft), verify §3 WARN→FAIL (hard),
              implement Step 0.5 (materializa/instrui)."
    reviewGate:
      status: passed
      at: a194db1
      mode: local
      reviewFile: .atomic-skills/reviews/2026-06-16-1308-code-multiplan-focus-phasedone.md
      verifiedAt: 2026-06-16T13:08:36Z
    status: done
    summary: "Foco determinístico para multi-plano: resolução em camadas + enforcer
      worktree."
references:
  - kind: file
    path: docs/design/statusline-focus-integration.md
    label: Spec da integração statusline/focus (digest, 4 camadas de frescor, D1–D6)
planTitle: Resolução de foco em camadas + enforcer worktree-por-plano
planActive: true
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
