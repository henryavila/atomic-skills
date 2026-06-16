---
schemaVersion: "0.1"
slug: app-map-conflict-arbitration-f0-contrato-schema-0-3-descritor-w
title: "Contrato: schema 0.3 + descritor witnesses"
goal: Estabelecer o contrato 0.3 do conflito — o descritor `witnesses[]` no
  schema + a regra de integridade no validador — validável emit-time, antes de
  qualquer produtor ou consumidor emitir a forma nova.
status: active
branch: plan/design-brief
started: 2026-06-16T18:38:32.145Z
lastUpdated: 2026-06-16T18:38:32.145Z
nextAction: "Start T-001: Schema 0.3 — conflict vira witnesses[]"
parentPlan: app-map-conflict-arbitration
phaseId: F0
tasksDone: 0
tasksTotal: 2
gatesMet: 0
gatesTotal: 1
exitGates:
  - id: F0-G1
    description: O schema 0.3 valida o descritor witnesses, rejeita slots proibidos
      e kind inválido, e mantém 0.1/0.2 válidos; o validador reforça a
      integridade resolution.choice em witnesses.
    status: pending
    verifier:
      kind: shell
      command: node --test test/app-map/schema.test.js test/app-map/validate.test.js
      expectExitCode: 0
stack:
  - id: 1
    title: "Contrato: schema 0.3 + descritor witnesses"
    type: task
    openedAt: 2026-06-16T18:38:32.145Z
tasks:
  - id: T-001
    title: Schema 0.3 — conflict vira witnesses[]
    status: pending
    lastUpdated: 2026-06-16T19:19:00Z
    summary: Adiciona o ramo 0.3 ao schema — conflict vira witnesses[] e rejeita os slots antigos.
    description: "Bump schemaVersion 0.3 (aditivo por if/then) + descritor
      conflict.witnesses[{value,source,kind}] no ramo 0.3; slots
      artefactValue/codeValue removidos; 0.1/0.2 seguem válidos. Files:
      meta/schemas/app-map.schema.json, test/app-map/schema.test.js"
    scopeBoundary:
      - não tocar src/app-map/validate.js (a regra de integridade é T-002).
      - não tocar src/app-map/reconstruct.js nem src/app-map/persist.js (produtor/consumidores são F1); não migrar dados.
      - o ramo condicional 0.1/0.2 permanece intacto (porta de direção única — 0.1/0.2 leem válidos).
    acceptance:
      - o enum de schemaVersion aceita "0.3" e mantém "0.1"/"0.2".
      - um catálogo 0.3 com conflicts[].witnesses array de {value,source,kind} e N>=2 (inclui N=3) valida.
      - um conflito 0.3 que ainda carrega artefactValue/codeValue é REJEITADO (slots removidos no ramo 0.3, additionalProperties false).
      - kind fora de {code, artefact} é REJEITADO pelo schema.
      - catálogos 0.1 e 0.2 existentes seguem válidos sob o ramo condicional aditivo.
    verifier:
      kind: shell
      command: node --test test/app-map/schema.test.js
      expectExitCode: 0
  - id: T-002
    title: Validador — integridade de witnesses + resolution.choice
    status: pending
    lastUpdated: 2026-06-16T19:19:00Z
    summary: Regra pós-schema que exige resolution.choice apontar uma testemunha existente.
    description: "Função de erro pós-schema (estilo duplicatePageIdErrors) que
      reforça resolution.choice referenciando uma testemunha por value+source em
      conflitos 0.3; API validateAppMap/assertValidAppMap intacta. Files:
      src/app-map/validate.js, test/app-map/validate.test.js"
    scopeBoundary:
      - não alterar o schema JSON (forma é T-001); não tocar produtor/consumidores (F1).
      - manter duplicatePageIdErrors e a API pública validateAppMap/assertValidAppMap intactas — só adicionar uma regra pós-schema nova no mesmo estilo, sem novos campos de schema.
    acceptance:
      - uma função de erro pós-schema (estilo duplicatePageIdErrors) reforça que resolution.choice, quando resolution é objeto 0.3, referencia uma testemunha existente por value+source.
      - um conflito 0.3 cujo resolution.choice NÃO casa nenhuma testemunha produz erro e valid vira false.
      - um conflito 0.3 cujo choice casa uma testemunha (value+source) é aceito.
      - a regra só se aplica a conflitos 0.3 com witnesses — catálogos 0.1/0.2 não regridem e os testes existentes seguem verdes.
      - validateAppMap/assertValidAppMap mantêm assinatura e a mensagem de erro formatada legível.
    verifier:
      kind: shell
      command: node --test test/app-map/validate.test.js
      expectExitCode: 0
parked: []
emerged: []
planTitle: "app-map: descritor de conflito rico + canal de arbitragem"
planActive: true
current: true
---

# Narrative / notes

Initiative for phase **F0 — Contrato: schema 0.3 + descritor witnesses**.

## Decisions

- **DECOMPOSE+SPEC completado (2026-06-16):** o plano foi bootstrapado em PLAN mas as tarefas T-001/T-002 (F0 e F1) eram stubs sem o interior SPEC (Files/scopeBoundary/acceptance/verifier), logo não-admitidas ao implement (R-ORCH-23). Autorado `source.md` derivado do `design.md` (D1–D6 + Blast radius), validado por `node scripts/lint-source.js .atomic-skills/projects/atomic-skills/app-map-conflict-arbitration/source.md --spec` → EXIT 0, e o interior transcrito para os 4 tasks (campos de schema existentes, sem novas chaves). `validate-state` → 52/52 válidos.
- **Verifiers por-tarefa (mais granulares que o gate de fase):** F0/T-001 `node --test test/app-map/schema.test.js`; F0/T-002 `node --test test/app-map/validate.test.js`; F1/T-001 `node --test test/app-map/reconstruct.test.js`; F1/T-002 `node --test test/app-map/persist.test.js`.

## Links

- Source SPEC: `.atomic-skills/projects/atomic-skills/app-map-conflict-arbitration/source.md`
- DESIGN (fonte de verdade): `.atomic-skills/projects/atomic-skills/app-map-conflict-arbitration/design.md`

## Session handoff

- **Narrative:** Fase F0 ativa, 0/2 tasks done. A etapa DECOMPOSE+SPEC (faltante) foi concluída nesta sessão: `source.md` autorado + SPEC gate EXIT 0 + interior materializado nos 4 tasks (F0 e F1) + `validate-state` 52/52. Nenhum código de produção foi tocado ainda; o próximo passo é começar a IMPLEMENTAR F0/T-001 (schema 0.3).
- **Decision log:** (1) tasks eram stubs não-admitidos → autorei o SPEC em vez de improvisar (HARD-GATE). (2) Speccei AMBAS as fases (F0+F1) de uma vez para evitar uma segunda parada SPEC no limite F0→F1. (3) Mode 2 (Codex) é o executor DEFAULT pois `routing.json` tem `mode2Enabled:true`+`codexLane.enabled:true` e os tasks agora são spec-ready com verifier determinístico — a escolha de executor (Mode 2 Codex vs Mode 1 Opus direto) está pendente do operador.
- **Single nextAction:** Decidir o executor de F0/T-001 (Mode 2 Codex em worktree vs Mode 1 Opus direto); então implementar T-001 (RED→GREEN em `test/app-map/schema.test.js` + ramo 0.3 em `meta/schemas/app-map.schema.json`) e fechar via `node --test test/app-map/schema.test.js` → EXIT 0.
- **Verbatim state:** SPEC gate: `node scripts/lint-source.js .atomic-skills/projects/atomic-skills/app-map-conflict-arbitration/source.md --spec` → `✓ … SPEC per-task gate clean` EXIT=0. State: `node scripts/validate-state.js .atomic-skills` → `✓ All 52 file(s) valid` EXIT=0. F0/T-001 verifier: `node --test test/app-map/schema.test.js` (expectExitCode 0).
- **Uncommitted changes:** a confirmar via `git status --porcelain` no momento do commit (source.md novo + 2 phase files editados + esta initiative).
