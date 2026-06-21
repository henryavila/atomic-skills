---
schemaVersion: "0.1"
slug: fix-aideck-dashboard-f2-realinhar-manifest-ao-design
title: Realinhar o manifest ao design
goal: "Realinhar assets/aideck-consumer/manifest.yaml ao manifest.sample do
  design: foco-agora/visão-geral (não foco/planos), headline-banner no Foco,
  dobrar a página phase no detalhe do plano, ajuda via botão ? (não item de
  sidebar). Gerado a partir do mapa-por-tela (parte A da auditoria)."
status: done
branch: plan/fix-aideck-dashboard
started: 2026-06-16T11:57:08.891Z
lastUpdated: 2026-06-20T00:00:00Z
parentPlan: fix-aideck-dashboard
phaseId: F2
nextAction: "Código FEITO e committado aqui (16e7e91 etc.); substrate
  determinístico verde (node --test tests/aideck-consumer-manifest.test.js →
  26/26). Resta o gate G-1 (kind: manual): render do manifest no shell projects
  vs imagens de referência, que depende do shell F1 (validação VISUAL do
  owner)."
summary: Manifest realinhado ao design (foco→foco-agora, planos→visao-geral 6
  stats por-projeto + Frentes vivas, headline-banner no Foco agora com contrato
  REAL do widget, page phase DOBRADA no plan, commandPalette só plans). VALIDADO
  contra o engine source (parseManifest OK, 0 unknown widgets, todos refs
  resolvem, testes verdes). G-1 (render vs imagens de referência via CDP)
  PENDENTE do shell F1.
tasksDone: 0
tasksTotal: 0
gatesMet: 0
gatesTotal: 1
exitGates:
  - id: G-1
    description: O manifest corresponde ao design (páginas/widgets/bindings) e o
      render validado (CDP, 0 unknown widgets) bate com as imagens de
      referência.
    status: deferred
    deferredReason: Owner valida visualmente após o merge (decisão do owner, 2026-06-20).
    verifier:
      kind: manual
      description: Verify exit-gate prose with the user during phase-done.
    verifierLabel: manual
    evidenceSummary: "deferred: Owner valida visualmente após o merge (decisão do
      owner, 2026-06-20)."
stack: []
tasks: []
parked: []
emerged: []
planTitle: "fix-aideck-dashboard: corrigir a integração com aiDeck"
---

# F2 · Realinhar o manifest ao design

Fase **ativa**, código **feito e committado** aqui (`16e7e91` etc.). O substrate
determinístico do manifest está verde: `node --test tests/aideck-consumer-manifest.test.js`
→ 26/26 (parseManifest contra o engine source, 0 unknown widgets, todos os refs resolvem).
O gate de saída **G-1** é `kind: manual` — render do manifest no shell projects vs imagens
de referência, dependente do shell F1 (**validação VISUAL do owner**).
