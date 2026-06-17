---
schemaVersion: "0.1"
slug: reversible-installer-f3-big-bang-rewire-e-paridade
title: Big-bang rewire e paridade
goal: religar o atomic-skills sobre o kernel (aiDeck, hooks, auto-update como
  runtime layers), substituir o install/uninstall legados pelo driver, e provar
  a paridade com o round-trip e a suíte completa.
status: pending
branch: plan/reversible-installer
started: 2026-06-17T15:13:50.418Z
lastUpdated: 2026-06-17T15:45:46.247Z
nextAction: "Start T-001: — Driver (install / uninstall / update)"
parentPlan: reversible-installer
phaseId: F3
tasksDone: 0
tasksTotal: 5
gatesMet: 0
gatesTotal: 3
exitGates:
  - id: G-1
    description: O round-trip parity test mais as três fixtures adversárias passam
      com retorno byte-a-byte ao baseline.
    status: pending
    verifier:
      kind: shell
      command: node --test tests/install-uninstall-roundtrip.test.js
      expectExitCode: 0
    verifierLabel: "shell: node --test tests/install-uninstall-roundtrip.test.js"
  - id: G-2
    description: A suíte completa passa via driver, com install.js e uninstall.js
      legados removidos.
    status: pending
    verifier:
      kind: shell
      command: npm test
      expectExitCode: 0
    verifierLabel: "shell: npm test"
  - id: G-3
    description: "Inventário: cada mutação persistente emitida por cada runtime
      layer (aiDeck/hooks/auto-update) está mapeada a um efeito registrado, uma
      fixture de round-trip, ou uma entrada de allowlist documentada."
    status: pending
    verifier:
      kind: manual
      description: Auditar o inventário de mutações por runtime layer durante phase-done.
    verifierLabel: manual
stack:
  - id: 1
    title: Big-bang rewire e paridade
    type: task
    openedAt: 2026-06-17T15:13:50.418Z
tasks:
  - id: T-001
    title: Driver (install / uninstall / update)
    status: pending
    lastUpdated: 2026-06-17T15:20:11.565Z
    summary: Driver orquestra providers→efeitos→journal; uninstall reverte journal +
      reconcilia arquivos p/ vazio.
    description: Orquestra providers, efeitos e journal; uninstall reverte o journal
      e reconcilia o file set para vazio; update reconcilia preservando edições
      do usuário.
    scopeBoundary:
      - orquestra providers, efeitos e journal; não reescreve a CLI nem a UI
        ainda
    acceptance:
      - install aplica os efeitos e grava o journal
      - uninstall reverte o journal e reconcilia o file set para vazio
      - update reconcilia preservando edições do usuário
    verifier:
      kind: test
      runner: node --test
      pattern: test/kernel/driver.test.js
  - id: T-002
    title: Runtime layers do atomic-skills
    status: pending
    lastUpdated: 2026-06-17T15:20:11.565Z
    summary: aiDeck/hooks/auto-update re-expressos como runtime layers que revertem
      pelo journal.
    description: Re-expressa installRuntimeArtifacts de src/install.js:70-132 e o
      auto-update hook como runtime layers sobre o kernel.
    scopeBoundary:
      - não muda o comportamento observável da instalação; só re-expressa em
        efeitos
    acceptance:
      - staging do aiDeck roda via runtime layer e reverte pelo journal
      - auto-update hook usa o efeito json-merge
      - cada runtime layer reverte out-of-the-box
    verifier:
      kind: test
      runner: node --test
      pattern: test/runtime-layers/atomic-skills.test.js
  - id: T-003
    title: Religar a CLI e remover o install/uninstall legados
    status: pending
    lastUpdated: 2026-06-17T15:45:46.247Z
    summary: CLI chama o driver via defineInstaller; remove install.js/uninstall.js
      legados, preserva flags.
    description: A CLI passa a chamar o driver via defineInstaller; remove os
      arquivos install.js e uninstall.js legados, preservando os flags atuais.
    scopeBoundary:
      - preserva os flags da CLI atuais (--yes, --project, --ide, --lang); não
        muda a saída de UX além do necessário
    acceptance:
      - install, uninstall, detect e status funcionam via driver
      - flags da CLI preservados
      - src/install.js e src/uninstall.js legados removidos
    verifier:
      kind: shell
      command: npm test
      expectExitCode: 0
    blockedBy:
      - T-005
  - id: T-004
    title: Paridade verde e doc atualizada
    status: pending
    lastUpdated: 2026-06-17T15:20:11.565Z
    summary: round-trip + 3 fixtures verdes, npm test verde, mapa install↔uninstall
      do CLAUDE.md atualizado.
    description: Round-trip parity test volta byte-a-byte ao baseline, a suíte
      completa passa via driver, e o mapa install vs uninstall no CLAUDE.md
      reflete o driver e os efeitos.
    scopeBoundary:
      - só testes e documentação; nenhuma mudança de comportamento do kernel
    acceptance:
      - round-trip parity test volta byte-a-byte ao baseline
      - npm test passa inteiro
      - mapa install vs uninstall no CLAUDE.md reflete o driver e os efeitos
    verifier:
      kind: shell
      command: npm test
      expectExitCode: 0
  - id: T-005
    title: Migração de installs legados para o journal
    status: pending
    summary: Adota o manifesto legado em registros de ownership do journal;
      não-verificável vira unmanaged (não-removível), com fixtures de
      pré-kernel.
    description: Antes do rewire, converte o estado do manifesto legado (sem
      journal/before-state) em registros de ownership do journal onde for
      seguro; marca entradas não-verificáveis como unmanaged (nunca removidas
      pelo uninstall). Prerequisito de T-003.
    scopeBoundary:
      - não remove nada do install legado; só adota/marca; preserva arquivos sem
        prova de ownership
    acceptance:
      - manifesto legado é lido e adotado em registros de ownership do journal
      - entradas sem before-state verificável são marcadas unmanaged e nunca
        removidas no uninstall
      - "fixture: install pré-kernel → migra → update → uninstall reverte só o
        provado e preserva o resto"
    verifier:
      kind: test
      runner: node --test
      pattern: tests/migration-legacy-install.test.js
    lastUpdated: 2026-06-17T15:45:46.247Z
    provenance:
      surfacedAt: 2026-06-17T15:45:46.247Z
      surfacedDuring: review-plan codex (F-002)
      surfacedBy: ai
      originalPhaseId: F3
    context:
      solves: uninstall novo não consegue reverter installs pré-kernel (sem
        journal/before-state)
      trigger: codex review F-002 (crítico)
      assumesStillValid:
        - existe base instalada com o manifesto antigo a preservar
      ratifiedAt: 2026-06-17T15:45:46.247Z
      ratifiedBy: human
      lastReviewedAt: 2026-06-17T15:45:46.247Z
parked: []
emerged: []
summary: Religa atomic-skills sobre o kernel (aiDeck/hooks/auto-update como
  runtime layers) e prova paridade.
planTitle: Reversible Installer — motor de instalação reversível e reutilizável
planActive: true
---

# Narrative / notes

Initiative for phase **F3 — Big-bang rewire e paridade**.

## Decisions

_(record decisions here as they are made)_

## Links

_(plan doc, external refs)_
