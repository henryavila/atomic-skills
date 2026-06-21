---
schemaVersion: "0.1"
slug: fix-superpowers-integration
title: Consertar integração project-plan ↔ superpowers
goal: Fazer project-plan detectar e usar superpowers:brainstorming +
  writing-plans para gerar planos mais robustos
status: archived
branch: null
started: 2026-05-25T17:30:00.000Z
lastUpdated: 2026-06-08T01:47:16Z
nextAction: Fix detecção de superpowers em project-plan.md
  (installed_plugins.json em vez de path errado)
tasksDone: 0
tasksTotal: 5
gatesMet: 0
gatesTotal: 3
weightDone: 0
weightTotal: 5
exitGates:
  - id: G-1
    description: project-plan detecta superpowers v5.1.0 como available
    status: pending
    verifier:
      kind: shell
      command: grep -q superpowers ~/.claude/plugins/installed_plugins.json && echo pass
      expectExitCode: 0
    verifierLabel: "shell: grep -q superpowers ~/.claude/plugins/installed_plugins.jso…"
  - id: G-2
    description: Stage 3 Branch A invoca superpowers:brainstorming (nome correto) e
      recebe design doc
    status: pending
    verifier:
      kind: manual
      description: Rodar project-plan com superpowers available, escolher Branch A,
        verificar brainstorming executa
    verifierLabel: manual
  - id: G-3
    description: Output do brainstorming alimenta decomposePlan com sucesso
    status: pending
    verifier:
      kind: manual
      description: Verificar que o plan source gerado apos brainstorming e parseavel
        por decomposePlan
    verifierLabel: manual
stack:
  - id: 1
    title: Consertar integração project-plan ↔ superpowers
    type: task
    openedAt: 2026-05-25T17:30:00.000Z
tasks:
  - id: T-001
    title: "Fix detecção: usar installed_plugins.json em vez de path direto"
    status: pending
    lastUpdated: 2026-05-25T17:30:00.000Z
    description: skills/core/project-plan.md:223 — substituir test -d por grep em
      installed_plugins.json
  - id: T-002
    title: "Fix nomes de skills: brainstorm→brainstorming,
      write-execution-plan→writing-plans"
    status: pending
    lastUpdated: 2026-05-25T17:30:00.000Z
    description: skills/core/project-plan.md:252-253
  - id: T-003
    title: Redesenhar Stage 3 Branch A para usar brainstorming como spec input (não
      como plan source direto)
    status: pending
    lastUpdated: 2026-05-25T17:30:00.000Z
    description: "Opção B do diagnóstico: superpowers faz brainstorm/spec,
      project-plan materializa. Adapter não necessário."
  - id: T-004
    title: Atualizar test C.T-003 com nomes corretos e novo fluxo
    status: pending
    lastUpdated: 2026-05-25T17:30:00.000Z
    description: tests/project-plan.test.js
  - id: T-005
    title: "Teste end-to-end: rodar project-plan com superpowers available"
    status: pending
    lastUpdated: 2026-05-25T17:30:00.000Z
parked: []
emerged: []
parentPlan: fix-superpowers-integration
phaseId: F0
summary: Faz o project-plan detectar e usar superpowers:brainstorming +
  writing-plans para planos mais robustos.
planTitle: Consertar integração project-plan ↔ superpowers
---


# Consertar integração project-plan ↔ superpowers

## Contexto

Diagnóstico completo em `docs/analysis/2026-05-25-superpowers-integration-diagnosis.md`.

3 bugs encontrados:
1. Detecção testa path errado (`~/.claude/plugins/superpowers/` vs `cache/claude-plugins-official/superpowers/`)
2. Nomes de skills errados (`brainstorm` vs `brainstorming`, `write-execution-plan` vs `writing-plans`)
3. Formato de output incompatível (superpowers checkboxes vs decomposePlan phases)

Abordagem escolhida: Opção B — superpowers faz brainstorm/spec, project-plan materializa.

## Links

- [Diagnóstico](../../docs/analysis/2026-05-25-superpowers-integration-diagnosis.md)
- `skills/core/project-plan.md` — skill a corrigir
- `tests/project-plan.test.js` — testes a atualizar
