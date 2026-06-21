---
schemaVersion: "0.1"
slug: bmad-porting-research
title: "Pesquisa: Porting de Módulos BMAD para Atomic Skills"
goal: Pesquisa aprofundada sobre viabilidade, design e custo de portar
  party-mode e incorporar conceitos do doc-architect como skills atômicos
status: archived
branch: null
started: 2026-05-27T18:00:00Z
lastUpdated: 2026-05-27T18:00:00Z
nextAction: Iniciar pesquisa T-001 (party-mode) — mapear arquitetura,
  dependências BMAD, e design da skill
tasksDone: 0
tasksTotal: 2
gatesMet: 0
gatesTotal: 2
weightDone: 0
weightTotal: 2
exitGates:
  - id: G-1
    description: Documento de design do party-mode skill com arquitetura, roster,
      orquestração e decisões de trade-off
    status: pending
    verifier:
      kind: manual
      description: "Revisar documento de design e confirmar que cobre: agent roster,
        spawn pattern, context management, integração com skills existentes"
    verifierLabel: manual
  - id: G-2
    description: Mapeamento de conceitos do doc-architect absorvíveis por skills
      existentes (review-code, hunt, review-plan)
    status: pending
    verifier:
      kind: manual
      description: Revisar mapeamento e confirmar que cada conceito tem skill-alvo,
        ponto de inserção e justificativa
    verifierLabel: manual
scope:
  paths:
    - skills/core/
    - docs/
stack:
  - id: 1
    title: Pesquisa BMAD Porting
    type: research
    openedAt: 2026-05-27T18:00:00Z
tasks:
  - id: T-001
    title: "Pesquisa: design do party-mode como skill atômico"
    status: pending
    lastUpdated: 2026-05-27T18:00:00Z
    description: >
      Pesquisa aprofundada para projetar o party-mode como skill do
      atomic-skills. Inclui: (1) mapear arquitetura do BMAD party-mode (SKILL.md
      128 lines, agent roster, spawn via Agent tool, context management <400
      words); (2) design do roster system simplificado (YAML flat vs TOML
      4-layer do BMAD); (3) definir personas default (quais agentes fazem
      sentido fora do BMAD — PM, Architect, Dev, UX, QA?); (4) orquestração:
      pick voices, parallel spawn, cross-talk, context summarization; (5)
      integração com skills existentes (review-plan como roundtable, review-code
      como debate técnico); (6) Iron Law e HARD-GATEs candidatos; (7) --solo
      mode e --model flag; (8) tool abstraction ({{INVESTIGATOR_TOOL}} para
      spawn cross-IDE). Output: documento de design com decisões e trade-offs,
      não código.
    tags:
      - research
      - party-mode
      - design
  - id: T-002
    title: "Pesquisa: conceitos do doc-architect absorvíveis pelo atomic-skills"
    status: pending
    lastUpdated: 2026-05-27T18:00:00Z
    description: >
      Pesquisa aprofundada para identificar conceitos do bmad-doc-architect que
      podem enriquecer skills existentes (sem portar o módulo inteiro). Inclui:
      (1) Hierarchy of Trust (Tests > Code > Config > Docs) → como incorporar no
      review-code e hunt para priorizar evidência; (2) Findings system com
      fingerprint-based dedup + state tracking (open → exported → resolved) →
      pattern reutilizável para qualquer skill que emite reports; (3) 5D review
      dimensions (accuracy, permissions, type-purity, completeness, quality) →
      expandir dimensões do review-code além do atual; (4) Diataxis type purity
      → aplicável a docs gerados por skills?; (5) Red flags forensic patterns
      (métodos com nomes simples mas corpo longo, contradições code↔test) →
      enriquecer hunt com heurísticas de investigação; (6) Custo/benefício de
      cada incorporação — o que é universal vs Laravel-specific. Output:
      mapeamento conceito → skill-alvo → ponto de inserção → justificativa.
    tags:
      - research
      - doc-architect
      - concepts
parked: []
emerged: []
references:
  - kind: repo-path
    path: /Volumes/External/code/BMAD-METHOD/src/core-skills/bmad-party-mode/SKILL.md
    label: BMAD party-mode — skill source (128 lines)
    inside_repo: false
  - kind: repo-path
    path: /Volumes/External/code/BMAD-METHOD/src/bmm-skills/
    label: BMAD named agents — roster e personas
    inside_repo: false
  - kind: repo-path
    path: /Volumes/External/code/bmad-dev-productivity/bmad-doc-architect/
    label: bmad-doc-architect — módulo completo (45 files, 13-step pipeline)
    inside_repo: false
  - kind: repo-path
    path: .atomic-skills/initiatives/bmad-af-learnings.md
    label: Iniciativa anterior — learnings já absorvidos do BMad AF
    inside_repo: true
parentPlan: bmad-porting-research
phaseId: F0
summary: Pesquisa de viabilidade/design/custo de portar party-mode e incorporar
  conceitos do doc-architect como skills atômicos.
planTitle: "Pesquisa: Porting de Módulos BMAD para Atomic Skills"
---

# Pesquisa: Porting de Módulos BMAD para Atomic Skills

## Contexto

Análise profunda de dois módulos BMAD revelou oportunidades distintas:

- **party-mode**: skill leve (128 lines), universal, preenche gap real no atomic-skills.
  Candidato a porting direto como skill atômico com roster simplificado.
- **doc-architect**: sistema pesado (45 files, 13-step pipeline), Laravel-locked.
  NÃO é candidato a porting, mas contém conceitos valiosos absorvíveis por skills existentes.

## Decisões Preliminares

- Party-mode será portado como skill novo — pesquisa foca em design, não implementação
- Doc-architect NÃO será portado — pesquisa foca em extrair conceitos universais
- Ambas as tasks produzem documentos de design, não código
- Implementação será uma iniciativa separada após validação dos designs

## Análise Prévia (conversa de origem)

A análise comparativa que motivou esta iniciativa identificou:

| Critério | doc-architect | party-mode |
|----------|--------------|------------|
| Atomicidade | Viola (45 files) | Encaixa (128 lines) |
| Portabilidade | Baixa (Laravel) | Alta (universal) |
| BMAD coupling | Alto | Baixo (só roster) |
| Esforço | Alto (~2-3 dias) | Baixo (~4-6h) |
| Valor | Nicho | Universal, gap real |
| Recomendação | Extrair conceitos | Portar como skill |
