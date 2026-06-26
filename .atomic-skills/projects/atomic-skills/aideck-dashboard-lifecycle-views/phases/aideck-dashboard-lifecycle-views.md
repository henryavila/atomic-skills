---
schemaVersion: "0.1"
slug: aideck-dashboard-lifecycle-views
title: Reorganizar ciclo de vida das telas do dashboard
goal: Separar trabalho aberto, concluido recente e arquivado no dashboard aiDeck.
status: done
branch: develop
started: 2026-06-25T12:55:57Z
lastUpdated: 2026-06-26T16:55:14Z
nextAction: null
parentPlan: aideck-dashboard-lifecycle-views
phaseId: F0
tasksDone: 1
tasksTotal: 1
gatesMet: 1
gatesTotal: 1
weightDone: 1
weightTotal: 1
exitGates:
  - id: G-1
    description: "Panorama, Foco agora, Visao geral e Arquivados exibem estados sem
      duplicar listas operacionais: ativos/pausados/travados ficam no fluxo
      aberto; done aparece em Visao geral; archived aparece apenas em
      Arquivados."
    status: met
    metAt: 2026-06-26T16:55:14Z
    verifier:
      kind: manual
      description: Validar no dashboard aiDeck com o projeto atomic-skills.
    evidence:
      verifierKind: manual
      verifiedAt: 2026-06-26T16:55:14Z
      passed: true
      outputSummary: "G-1 validado ao vivo (headless): 14 archived isolados em
        Arquivados; 5 done em Visao geral; pagina concluidos removida; nenhuma
        lista duplica archived."
    verifierLabel: manual
    evidenceSummary: passed · 2026-06-26
stack:
  - id: 1
    title: Reorganizar ciclo de vida das telas do dashboard
    type: task
    openedAt: 2026-06-25T12:55:57Z
tasks:
  - id: T-001
    title: Realinhar labels, filtros e secoes do manifest aiDeck
    status: done
    lastUpdated: 2026-06-26T16:55:14Z
    closedAt: 2026-06-26T16:55:14Z
    summary: Realinha labels, filtros e secoes do manifest aiDeck para o ciclo de
      vida do dashboard.
parked: []
emerged: []
summary: Reorganiza Panorama, Foco, Visao geral e Arquivados por estado operacional.
planTitle: Reorganizar ciclo de vida das telas do dashboard
planActive: false
current: false
---

# Narrative / notes

Initiative for phase **F0 — Reorganizar ciclo de vida das telas do dashboard**.

## Decisions

- `done` remains visible in Visao geral as recent/completed work.
- `archived` moves to Arquivados as cold history.

## Links

_(dashboard references and validation notes)_

## Self-review against code-quality gates

- **G1 read-before-claim**: 1 task fechada (T-001), entregue no commit `b5f78be` (split done/archived no manifest + 4 testes G-1). Gate G-1 validado ao vivo (headless) antes do close.
- **G2 soft-language**: escaneado `nextAction` + descricoes de task/criteria; 0 violacoes.
- **G6 reference-or-strike**: 1 exit criterion (G-1), 1 met com `evidence:` populada (`verifierKind: manual`, `passed: true`).
- **Codex review**: SKIPPED — realinhamento somente de manifest (YAML + testes), sem logica de producao JS; TDD-travado (gate G-1) e validado ao vivo headless. Registrado em `plan.md` `phases[F0].reviewGate` (skipped + reason).
- **Review gate (G2)**: `reviewGate: { status: skipped, reason: <manifest-only>, verifiedAt: 2026-06-26T16:55:14Z }` no descritor da fase — GATE-R3 permite (skipped + reason presente).
- **Lessons (G1)**: nenhuma licao destilada (fase limpa — sem sinal de falha).
