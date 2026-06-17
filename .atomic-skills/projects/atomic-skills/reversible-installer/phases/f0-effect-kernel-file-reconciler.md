---
schemaVersion: "0.1"
slug: reversible-installer-f0-effect-kernel-file-reconciler
title: Effect Kernel + file reconciler
goal: estabelecer o contrato fechado de efeito (apply/revert/before-state) + o
  journal + o efeito de reconciliação de arquivos portado da lógica 3-hash
  atual, sem tocar no instalador legado.
status: active
branch: plan/reversible-installer
started: 2026-06-17T15:13:50.418Z
lastUpdated: 2026-06-17T15:45:46.247Z
nextAction: "Start T-001: — Contrato e registry de efeitos"
parentPlan: reversible-installer
phaseId: F0
tasksDone: 0
tasksTotal: 3
gatesMet: 0
gatesTotal: 2
exitGates:
  - id: G-1
    description: O efeito reconcileFileSet reproduz o comportamento de
      install/update/uninstall de arquivos dos testes atuais.
    status: pending
    verifier:
      kind: test
      runner: node --test
      pattern: test/kernel/reconciler.test.js
    verifierLabel: "test: node --test test/kernel/reconciler.test.js"
  - id: G-2
    description: O contrato de efeito tem fixture de round-trip que prova apply
      seguido de revert restaurando o baseline.
    status: pending
    verifier:
      kind: test
      runner: node --test
      pattern: test/kernel/effect.test.js
    verifierLabel: "test: node --test test/kernel/effect.test.js"
stack:
  - id: 1
    title: Effect Kernel + file reconciler
    type: task
    openedAt: 2026-06-17T15:13:50.418Z
tasks:
  - id: T-001
    title: Contrato e registry de efeitos
    status: pending
    lastUpdated: 2026-06-17T15:45:46.247Z
    summary: Interface Effect (apply/revert/before-state) + registry que rejeita
      tipo duplicado e efeito sem revert.
    description: "Define a interface Effect (type, apply(ctx), revert(ctx,
      beforeState)) e registerEffectType com validação de unicidade e presença
      de revert. Primeiro passo: ampliar o glob do `npm test` para incluir os
      testes do kernel (hoje a suíte é só tests/*.test.js)."
    scopeBoundary:
      - não edita src/install.js, src/uninstall.js nem src/providers; só o
        contrato e o registry
    acceptance:
      - registry rejeita tipo duplicado
      - efeito registrado sem função revert é rejeitado no registro
      - round-trip de um efeito de teste restaura o baseline
      - package.json `test` é ampliado para `node --test tests/**/*.test.js
        test/**/*.test.js` (1º passo da fase) para que os verifiers de kernel
        sob test/ rodem no npm test
    verifier:
      kind: test
      runner: node --test
      pattern: test/kernel/effect.test.js
  - id: T-002
    title: Journal como extensão do manifesto
    status: pending
    lastUpdated: 2026-06-17T15:20:11.565Z
    summary: "Journal estende o manifesto: before-state por efeito, revert em ordem
      inversa, lê manifesto antigo."
    description: Persiste por efeito aplicado o type + before-state mínimo; expõe
      replayReverse iterando do efeito mais novo ao mais antigo.
    scopeBoundary:
      - não altera o schema de arquivos do manifesto além de acrescentar o array
        effects; mantém leitura do manifesto antigo
    acceptance:
      - o journal grava e relê o before-state de um efeito
      - replay reverso chama revert na ordem inversa de apply
      - manifesto antigo sem o array effects é lido sem erro
    verifier:
      kind: test
      runner: node --test
      pattern: test/kernel/journal.test.js
  - id: T-003
    title: Efeito reconcileFileSet (porta da lógica 3-hash)
    status: pending
    lastUpdated: 2026-06-17T15:20:11.565Z
    summary: Efeito reconcileFileSet portando 3-hash + remoção de órfão unmodified-only.
    description: Porta a detecção 3-hash de src/install.js:1049-1083 e a remoção de
      órfão unmodified-only de src/install.js:896-918 para um efeito
      reutilizável.
    scopeBoundary:
      - só o conjunto de arquivos; não toca settings.json, refcount nem paths
        legados
    acceptance:
      - arquivo instalado e não-modificado é removido no uninstall
      - arquivo modificado pelo usuário é preservado
      - conflito é detectado quando disco e pacote divergem ambos do hash
        registrado
    verifier:
      kind: test
      runner: node --test
      pattern: test/kernel/reconciler.test.js
parked: []
emerged: []
summary: "Funda o kernel: contrato de efeito reversível, journal e o reconciler
  de arquivos (porta do 3-hash)."
planTitle: Reversible Installer — motor de instalação reversível e reutilizável
planActive: true
current: true
---

# Narrative / notes

Initiative for phase **F0 — Effect Kernel + file reconciler**.

## Decisions

_(record decisions here as they are made)_

## Links

_(plan doc, external refs)_
