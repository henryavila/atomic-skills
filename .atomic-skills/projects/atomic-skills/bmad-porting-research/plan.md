---
schemaVersion: "0.1"
slug: bmad-porting-research
title: "Pesquisa: Porting de Módulos BMAD para Atomic Skills"
version: "1.0"
status: paused
started: 2026-05-27T18:00:00Z
lastUpdated: 2026-06-02T12:33:02Z
currentPhase: F0
parallelismAllowed: false
phases:
  - id: F0
    slug: bmad-porting-research
    title: "Pesquisa: Porting de Módulos BMAD para Atomic Skills"
    goal: Pesquisa aprofundada sobre viabilidade, design e custo de portar
      party-mode e incorporar conceitos do doc-architect como skills atômicos
    dependsOn: []
    subPhaseCount: 2
    exitGate:
      summary: 2 criteria to meet
      criteria:
        - id: G-1
          description: Documento de design do party-mode skill com arquitetura, roster,
            orquestração e decisões de trade-off
          status: pending
          verifier:
            kind: manual
            description: "Revisar documento de design e confirmar que cobre: agent roster,
              spawn pattern, context management, integração com skills
              existentes"
        - id: G-2
          description: Mapeamento de conceitos do doc-architect absorvíveis por skills
            existentes (review-code, hunt, review-plan)
          status: pending
          verifier:
            kind: manual
            description: Revisar mapeamento e confirmar que cada conceito tem skill-alvo,
              ponto de inserção e justificativa
    status: paused
    summary: Pesquisa de viabilidade/design/custo de portar party-mode e incorporar
      conceitos do doc-architect como skills atômicos.
references: []
planTitle: "Pesquisa: Porting de Módulos BMAD para Atomic Skills"
---

# Pesquisa: Porting de Módulos BMAD para Atomic Skills

> Migrated standalone initiative — degenerate 1-phase plan (single phase `F0`).
> The phase initiative under `phases/` holds the real work; this plan is the layout wrapper.

**Goal:** Pesquisa aprofundada sobre viabilidade, design e custo de portar party-mode e incorporar conceitos do doc-architect como skills atômicos
