---
schemaVersion: "0.1"
slug: fix-aideck-dashboard-f0-auditoria-design-vs-contrato-aideck
title: Auditoria do design contra o contrato real do aiDeck (3D)
goal: O agente de design audita o template do dashboard contra o contrato REAL
  do aiDeck (widgets + gramática + shell/nav) e devolve um GAP report em 3
  partes (B widgets, C gramática, D shell/nav).
status: done
branch: plan/fix-aideck-dashboard
started: 2026-06-16T11:57:08.891Z
lastUpdated: 2026-06-20T00:00:00Z
parentPlan: fix-aideck-dashboard
phaseId: F0
nextAction: Fase concluída — gap report 3D validado contra o source do aiDeck; o
  escopo real seguiu para F1 (shell nav.style:'projects') e B (publicar v2.1).
summary: "F0 DONE: gap report 3D recebido e validado contra o source do aiDeck
  (3 gaps de gramática eram falsos — linkTo/cell-slots/record-switcher já
  existem). Escopo real = D shell nav.style:'projects' + B publicar v2.1."
tasksDone: 0
tasksTotal: 0
gatesMet: 1
gatesTotal: 1
exitGates:
  - id: G-1
    description: "Gap report 3D recebido e revisado: cada item
      (widget/feature/shell) classificado existe / precisa-extensão /
      não-expressável, com spec acionável."
    status: met
    verifier:
      kind: manual
      description: Verify exit-gate prose with the user during phase-done.
    verifierLabel: manual
    evidenceSummary: met
stack: []
tasks: []
parked: []
emerged: []
planTitle: "fix-aideck-dashboard: corrigir a integração com aiDeck"
---

# F0 · Auditoria do design contra o contrato real do aiDeck (3D)

Fase **concluída**. O agente de design auditou o template contra o contrato REAL
do aiDeck (widgets + gramática + shell/nav). Resultado: 3 gaps de gramática
apontados eram falsos (`linkTo`/`cell-slots`/`record-switcher` já existem no
source). O escopo real ficou: **D** — shell `nav.style:'projects'` (→ F1) + **B**
— publicar a v2.1 (último passo, gate do owner).
