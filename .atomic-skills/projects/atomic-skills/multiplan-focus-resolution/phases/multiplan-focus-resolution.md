---
schemaVersion: "0.1"
slug: multiplan-focus-resolution
title: Resolução de foco em camadas + enforcer worktree-por-plano
goal: Tornar o foco da statusline determinístico com mais de um plano ativo, via
  resolução em camadas e um enforcer que isola planos concorrentes em worktrees.
status: pending
branch: null
started: 2026-06-15T19:42:12Z
lastUpdated: 2026-06-15T19:42:12Z
nextAction: Desenhar o invariante '≤1 plano ativo por branch/worktree' e o ponto
  de enforcement (transição de ativação) antes de finalizar as tasks.
parentPlan: multiplan-focus-resolution
phaseId: F0
tasksDone: 0
tasksTotal: 4
gatesMet: 0
gatesTotal: 1
exitGates:
  - id: F0-G1
    description: Enforcer soft implementado e foco determinístico com multi-plano
      demonstrado.
    status: pending
    verifier:
      kind: manual
      description: Validar com o usuário que o foco resolve corretamente com 2+ planos
        ativos e que o enforcer força/oferece worktree.
    verifierLabel: manual
stack:
  - id: 1
    title: Resolução de foco em camadas + enforcer worktree-por-plano
    type: task
    openedAt: 2026-06-15T19:42:12Z
tasks:
  - id: T-001
    title: Desenhar invariante + ponto de enforcement
    status: pending
    lastUpdated: 2026-06-15T19:42:12Z
    summary: Definir '≤1 plano ativo/branch' e onde o enforcer roda.
    description: "Especificar o invariante e escolher o seam (transição de ativação
      em project-transitions.md) onde o enforcer dispara: ativar/criar plano
      active com outro já ativo na mesma branch."
  - id: T-002
    title: Enforcer soft na ativação + carimbar branch
    status: pending
    lastUpdated: 2026-06-15T19:42:12Z
    summary: Warn + oferta de auto-worktree e stamp do campo branch do plano.
    description: "Na transição de ativação: se já há plano ativo na branch, oferecer
      criar worktree+branch e carimbar plan.branch. Soft (dry-run/aviso)
      primeiro, promovível a hard."
  - id: T-003
    title: Promover warn→fail no project-verify
    status: pending
    lastUpdated: 2026-06-15T19:42:12Z
    summary: verify falha com ≥2 ativos sem branch distinto.
    description: Elevar o check de multi-ativo de WARN para FAIL quando ≥2 planos
      active não têm branch distinto, consistente com o enforcer.
  - id: T-004
    title: "claudebar: chip do focus.json + render do marcador de multi-plano"
    status: pending
    lastUpdated: 2026-06-15T19:42:12Z
    summary: Implementar o consumidor a partir do handoff (desktop-only).
    description: Implementar project_chip() no claudebar conforme
      ~/claudebar/docs/atomic-skills-focus-integration.md, incl. o marcador de
      multipleActivePlans. Cross-repo (~/claudebar).
parked: []
emerged: []
summary: "Foco determinístico para multi-plano: resolução em camadas + enforcer
  worktree."
planTitle: Resolução de foco em camadas + enforcer worktree-por-plano
---

# Narrative / notes

Initiative standalone para a feature de foco multi-plano da statusline.

## Feito até aqui (commit 72c7f35)

- Resolução em camadas no `emit-focus`: branch-match → recência (Camadas 1–2).
- Digest `focus.json` + schema + `refresh-state` + hooks de frescor (session-start/stop).
- Handoff do claudebar com render do marcador `⧉` (`flags.multipleActivePlans`).

## A desenhar (colaborativo)

- Invariante "≤1 plano ativo por branch/worktree" e o ponto de enforcement.
- Enforcer soft (warn + oferta de auto-worktree, carimba `branch:`) → promovível a hard.

## Links

- `docs/design/statusline-focus-integration.md` — spec do digest + camadas de frescor.
