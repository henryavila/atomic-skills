---
schemaVersion: "0.1"
slug: design-brief-source-of-truth-f0-schema-e-validacao-do-catalogo
title: Schema e validação do catálogo
goal: estabelecer o contrato persistido do catálogo — schema JSON, validação na
  emissão e cobertura pelo validate-state — antes de qualquer reconstrução
  consumi-lo.
status: active
branch: plan/skills-restructuring
started: 2026-06-15T19:46:08.157Z
lastUpdated: 2026-06-15T17:00:00.000Z
nextAction: "Start T-001: Schema JSON do catálogo"
parentPlan: design-brief-source-of-truth
phaseId: F0
tasksDone: 0
tasksTotal: 3
gatesMet: 0
gatesTotal: 1
exitGates:
  - id: G-1
    description: O schema define e valida TODOS os campos do contrato (existence,
      conflicts, regime, inputsHash, provenance, audience, accessTier, status,
      purpose, label, id); o validador emit-time rejeita catálogo malformado; o
      validate-state cobre o catálogo durável.
    status: pending
    verifier:
      kind: shell
      command: node --test test/app-map/schema.test.js test/app-map/validate.test.js
        && npm run validate-state test/fixtures
stack:
  - id: 1
    title: Schema e validação do catálogo
    type: task
    openedAt: 2026-06-15T19:46:08.157Z
tasks:
  - id: T-001
    title: Schema JSON do catálogo
    status: pending
    lastUpdated: 2026-06-15T19:46:08.157Z
    summary: Schema JSON com os campos requeridos do contrato e os enums.
    description: "Define o schema do `app-map.json` com os campos requeridos do
      contrato e os enums. Files: meta/schemas/app-map.schema.json"
    scopeBoundary:
      - não alterar os outros schemas em meta/schemas/ nem o src/decompose.js.
    acceptance:
      - required inclui id, label, purpose, audience, accessTier, status,
        regime, existence, provenance e conflicts não-resolvidos
      - declara inputsHash e schemaVersion
      - enums para accessTier, status e existence.
    verifier:
      kind: shell
      command: node --test test/app-map/schema.test.js
  - id: T-002
    title: Validador emit-time
    status: pending
    lastUpdated: 2026-06-15T19:46:08.157Z
    summary: Valida o catálogo na emissão; malformado aborta antes de gravar.
    description: "Valida um catálogo contra o schema antes de gravar; malformado
      aborta a emissão. Files: src/app-map/validate.js,
      test/app-map/validate.test.js"
    scopeBoundary:
      - só validação; não lê fontes nem escreve o catálogo em disco.
    acceptance:
      - catálogo válido passa
      - catálogo malformado lança e a emissão aborta sem gravar arquivo.
    verifier:
      kind: shell
      command: node --test test/app-map/validate.test.js
  - id: T-003
    title: Registro no validate-state com fixture
    status: pending
    lastUpdated: 2026-06-15T19:46:08.157Z
    summary: Registra o catálogo no validate-state, com fixture que prova a falha.
    description: "Faz o catálogo durável ser descoberto e validado pelo
      validate-state, com fixture que prova a falha. Files:
      scripts/validate-state.js, test/app-map/validate-state.test.js,
      test/fixtures/app-map-invalid.json"
    scopeBoundary:
      - não mudar a validação de plan e initiative; só adicionar o app-map ao
        discovery de schemas.
    acceptance:
      - validate-state descobre e valida o app-map.json em árvore tracked
      - a fixture inválida faz o validate-state sair com código não-zero.
    verifier:
      kind: shell
      command: npm run validate-state test/fixtures
parked: []
emerged: []
summary: "Fecha o contrato do catálogo: schema, validação na emissão e cobertura
  pelo validate-state."
---

# Narrative / notes

Initiative for phase **F0 — Schema e validação do catálogo**.

## Decisions

_(record decisions here as they are made)_

## Links

_(plan doc, external refs)_
