---
schemaVersion: "0.1"
slug: design-brief-source-of-truth-f1-reconstrucao-artefato-e-codigo
title: Reconstrução (artefato e código) e reconciliação
goal: gerar o catálogo cruzando artefatos e código, com regime por-página e
  inputsHash de staleness, nunca resolvendo conflito no silêncio.
status: pending
branch: plan/skills-restructuring
started: 2026-06-15T19:46:08.157Z
lastUpdated: 2026-06-15T17:00:00.000Z
nextAction: "Start T-001: Discovery das fontes"
parentPlan: design-brief-source-of-truth
phaseId: F1
tasksDone: 0
tasksTotal: 4
gatesMet: 0
gatesTotal: 1
exitGates:
  - id: G-1
    description: o catálogo sai com existence, conflicts, regime e inputsHash;
      nenhum conflito é resolvido automaticamente; conflito não-resolvido tem
      fluxo de operador definido.
    status: pending
    verifier:
      kind: shell
      command: node --test test/app-map/sources.test.js test/app-map/reconcile.test.js
        test/app-map/regime.test.js test/app-map/resolve.test.js
    verifierLabel: "shell: node --test test/app-map/sources.test.js test/app-map/recon…"
stack:
  - id: 1
    title: Reconstrução (artefato e código) e reconciliação
    type: task
    openedAt: 2026-06-15T19:46:08.157Z
tasks:
  - id: T-001
    title: Discovery das fontes
    status: pending
    lastUpdated: 2026-06-15T19:46:08.157Z
    summary: Descobre as fontes (brainstorms, docs, plano, memória) com proveniência
      por campo.
    description: "Descobre o conjunto fixo de fontes da reconstrução e emite
      proveniência por campo. Files: src/app-map/sources.js,
      test/app-map/sources.test.js"
    scopeBoundary:
      - só leitura das fontes; não cruza nem escreve catálogo; jamais muta os
        artefatos.
    acceptance:
      - descobre brainstorms, design docs, plano e iniciativas do project, e
        memória, com roots e precedência fixos
      - cada campo extraído carrega a fonte que o fixou.
    verifier:
      kind: shell
      command: node --test test/app-map/sources.test.js
  - id: T-002
    title: Cross-reference e reconciliação
    status: pending
    lastUpdated: 2026-06-15T19:46:08.157Z
    summary: Cruza artefato e código; conflito vira pending, nunca auto-resolvido.
    description: "Cruza artefato e código em dois eixos e nunca auto-resolve
      conflito. Files: src/app-map/reconcile.js, test/app-map/reconcile.test.js"
    scopeBoundary:
      - nunca escolher um lado automaticamente; não muta fontes.
    acceptance:
      - produz existence entre confirmed, artefact-only, code-only e
        possible-alias
      - conflito de campo vira conflicts com proveniência e resolution pending
      - público discordante fica pending, não auto-escolhido.
    verifier:
      kind: shell
      command: node --test test/app-map/reconcile.test.js
  - id: T-003
    title: Regime por-página e inputsHash
    status: pending
    lastUpdated: 2026-06-15T17:00:00.000Z
    summary: Deriva o regime por-página e o inputsHash de staleness.
    description: "Deriva regime da evidência de código de cada página e calcula o
      hash de staleness. Files: src/app-map/regime.js, src/app-map/hash.js,
      test/app-map/regime.test.js"
    scopeBoundary:
      - regime derivado só da evidência de código da própria página; nunca usar
        o conjunto global de rotas como critério.
    acceptance:
      - greenfield quando a página não tem código próprio e brownfield quando tem
      - inputsHash é hash de conteúdo das fontes e muda quando uma fonte muda.
      - inputsHash = sha256 sobre sorted(path + conteúdo) das fontes, gravado no
        catálogo; Step 2 recomputa e compara para decidir reconstrução.
    verifier:
      kind: shell
      command: node --test test/app-map/regime.test.js
  - id: T-004
    title: Resolução de conflito pelo operador
    status: pending
    lastUpdated: 2026-06-15T17:00:00.000Z
    summary: Pergunta o conflito ao operador, grava a resolução no catálogo e define
      a regra do Step 2 para não-resolvidos.
    description: "Define o caminho do prompt de resolução (via ASK_USER_QUESTION), o
      shape da resolução persistida no app-map.json e a regra que o Step 2 segue
      quando há conflito não-resolvido. Files: src/app-map/resolve.js,
      test/app-map/resolve.test.js"
    scopeBoundary:
      - nunca auto-resolve; não muta os artefatos; grava resolução só no
        catálogo.
    acceptance:
      - o operador resolve campo-a-campo via prompt; a escolha grava no
        conflicts[].resolution com resolvedBy/resolvedAt
      - fingerprint da evidência suprime conflito já respondido na regeneração
      - Step 2 com conflito não-resolvido deixa audience/accessTier null e
        para-e-pergunta, nunca consome silenciosamente
    verifier:
      kind: shell
      command: node --test test/app-map/resolve.test.js
parked: []
emerged: []
summary: Constrói o motor que cruza artefato e código e gera o catálogo com
  regime e staleness.
planTitle: "design-brief: reconstrução da fonte-de-verdade (catálogo app-map)"
planActive: true
current: true
---

# Narrative / notes

Initiative for phase **F1 — Reconstrução (artefato e código) e reconciliação**.

## Decisions

_(record decisions here as they are made)_

## Links

_(plan doc, external refs)_
