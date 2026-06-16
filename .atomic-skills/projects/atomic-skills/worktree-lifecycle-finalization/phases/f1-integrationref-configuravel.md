---
schemaVersion: "0.1"
slug: worktree-lifecycle-finalization-f1-integrationref-configuravel
title: integrationRef configurável + branch develop (Decisão 2)
goal: 'introduzir um ref de integração configurável (default `develop`)
  repo-global em `routing.json`, estendendo o schema (que hoje é
  `additionalProperties: false` e descrito como "Mode 2 routing"), e um
  resolvedor que lê o ref, aplica o default e sinaliza ausência para o prompt
  lazy no ponto de consumo (o finalize, F3).'
status: pending
branch: plan/worktree-lifecycle-finalization
started: 2026-06-16T22:50:35.627Z
lastUpdated: 2026-06-16T22:50:35.627Z
nextAction: "Start T-001: Estender o schema de routing com integrationRef"
parentPlan: worktree-lifecycle-finalization
phaseId: F1
tasksDone: 0
tasksTotal: 2
gatesMet: 0
gatesTotal: 2
exitGates:
  - id: G-1
    description: Schema aceita integrationRef e rejeita chave desconhecida;
      resolvedor aplica default develop e sinaliza ausência sem assumir; suite
      verde.
    status: pending
    verifier:
      kind: test
      runner: node
      pattern: tests/integration-ref.test.js
    verifierLabel: "test: node tests/integration-ref.test.js"
  - id: G-2
    description: routing.schema.json válido e skills válidos.
    status: pending
    verifier:
      kind: shell
      command: node --test tests/routing-schema.test.js && npm run validate-skills
    verifierLabel: "shell: node --test tests/routing-schema.test.js && npm run validat…"
stack:
  - id: 1
    title: integrationRef configurável + branch develop (Decisão 2)
    type: task
    openedAt: 2026-06-16T22:50:35.627Z
tasks:
  - id: T-001
    title: Estender o schema de routing com integrationRef
    status: pending
    lastUpdated: 2026-06-16T22:50:35.627Z
    summary: Adiciona integrationRef ao schema de routing, preservando
      additionalProperties:false.
    outputs:
      - kind: file
        path: meta/schemas/routing.schema.json
      - kind: test
        path: tests/routing-schema.test.js
    scopeBoundary:
      - NÃO mudar os campos existentes de Mode 2 routing
      - NÃO colocar o ref no frontmatter do plano (é repo-global)
      - apenas adicionar a propriedade e generalizar a descrição do arquivo de
        "Mode 2 routing" para "config de roteamento/integração do repo".
    acceptance:
      - "`meta/schemas/routing.schema.json` aceita um `integrationRef` string
        opcional e segue rejeitando propriedades desconhecidas
        (`additionalProperties: false` preservado)"
      - a descrição do schema é generalizada de "Mode 2 routing" para incluir
        integração
      - o teste valida que um `routing.json` com `integrationRef` passa e um com
        chave desconhecida falha.
    verifier:
      kind: test
      runner: node
      pattern: tests/routing-schema.test.js
  - id: T-002
    title: Resolvedor de integrationRef com default e sinal-de-ausência
    status: pending
    lastUpdated: 2026-06-16T22:50:35.627Z
    summary: Resolvedor lê o ref, aplica default develop e sinaliza ausência para o
      prompt.
    outputs:
      - kind: file
        path: scripts/integration-ref.js
      - kind: test
        path: tests/integration-ref.test.js
    scopeBoundary:
      - função pura sobre o conteúdo de `routing.json` já lido — NÃO executa git
        nem rede no teste
      - NÃO cria a branch develop (isso é ação prompted no finalize, F3)
      - ausência NUNCA é assumida em silêncio nem falha — é sinalizada para o
        prompt.
    acceptance:
      - "`resolveIntegrationRef` retorna o `integrationRef` declarado quando
        presente"
      - aplica o default `develop` quando o campo está ausente mas o arquivo
        existe
      - retorna um sinal explícito de "ausente/não-configurado" (para o prompt
        lazy) quando `routing.json` não existe, nunca lançando nem assumindo
      - o resolvedor não muta o input.
    verifier:
      kind: test
      runner: node
      pattern: tests/integration-ref.test.js
parked: []
emerged: []
summary: Ref de integração configurável (default develop) em routing.json, com
  resolvedor e prompt-quando-ausente.
planTitle: Finalização do ciclo de vida da worktree-do-plano
planActive: true
---

# Narrative / notes

Initiative for phase **F1 — integrationRef configurável + branch develop (Decisão 2)**.

## Decisions

_(record decisions here as they are made)_

## Links

_(plan doc, external refs)_
