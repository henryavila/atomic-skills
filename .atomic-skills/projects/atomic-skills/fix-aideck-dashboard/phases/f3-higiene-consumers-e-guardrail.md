---
schemaVersion: "0.1"
slug: fix-aideck-dashboard-f3-higiene-consumers-e-guardrail
title: "Higiene: consumers legados + guardrail CI"
goal: "Remover os consumers legados (arch/lekto/dispatch-test em
  ~/.aideck/consumers/) → UM consumer atomic-skills + repos como PROJETOS. Add
  teste CI: todo widget/feature do manifest ∈ registry do aiDeck instalado (mata
  o false-green do widget z.string)."
status: active
branch: plan/fix-aideck-dashboard
started: 2026-06-16T11:57:08.891Z
lastUpdated: 2026-06-20T00:00:00Z
parentPlan: fix-aideck-dashboard
phaseId: F3
nextAction: "G-2 MET (guardrail widget∈registry, verde: node --test
  tests/aideck-manifest-widget-registry.test.js → 4/4). Resta o gate G-1 (kind:
  manual): validação VISUAL do owner — 1 consumer (atomic-skills) +
  arch/lekto/atomic-skills como PROJETOS na sidebar; depende do shell F1."
summary: "G-2 MET: guardrail vendoriza o widgetMap do source
  (meta/aideck-widget-registry.json), gateia o manifest (widget ∈ registry) e
  RED-bita num widget inexistente — fecha o false-green widget:z.string. G-1:
  consumers legados arch/lekto/dispatch-test REMOVIDOS de ~/.aideck/consumers/
  (sobra só atomic-skills); validação visual (1 consumer + projetos na sidebar)
  PENDENTE do shell F1."
tasksDone: 0
tasksTotal: 0
gatesMet: 1
gatesTotal: 2
exitGates:
  - id: G-1
    description: A sidebar mostra UM consumer (atomic-skills) com
      arch/lekto/atomic-skills como PROJETOS; nenhum consumer legado.
    status: pending
    verifier:
      kind: manual
      description: Verify exit-gate prose with the user during phase-done.
    verifierLabel: manual
  - id: G-2
    description: Existe um teste que falha (RED) quando o manifest referencia um
      widget/feature ausente no registry do aiDeck instalado.
    status: met
    verifier:
      kind: shell
      command: node --test tests/aideck-manifest-widget-registry.test.js
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-20T00:00:00Z
      passed: true
      exitCode: 0
    verifierLabel: "shell: node --test tests/aideck-manifest-widget-registry.test.js"
    evidenceSummary: passed · 2026-06-20
stack: []
tasks: []
parked: []
emerged: []
planTitle: "fix-aideck-dashboard: corrigir a integração com aiDeck"
planActive: true
---

# F3 · Higiene: consumers legados + guardrail CI

Fase **ativa**. **G-2 MET**: o guardrail vendoriza o `widgetMap` do source, gateia o
manifest (widget ∈ registry) e RED-bita num widget inexistente — verde agora na árvore
limpa: `node --test tests/aideck-manifest-widget-registry.test.js` → 4/4 (tests=4).
G-1 (`kind: manual`): consumers legados já REMOVIDOS de `~/.aideck/consumers/` (sobra só
`atomic-skills`); a **validação VISUAL** (1 consumer + arch/lekto/atomic-skills como
PROJETOS na sidebar) depende do shell F1 e é gate do owner.
