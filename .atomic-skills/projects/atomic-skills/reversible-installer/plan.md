---
schemaVersion: "0.1"
slug: reversible-installer
title: Reversible Installer — motor de instalação reversível e reutilizável
version: "1.0"
status: active
started: 2026-06-17T15:13:50.418Z
lastUpdated: 2026-06-17T15:20:11.565Z
branch: plan/reversible-installer
currentPhase: F0
parallelismAllowed: false
principles:
  - id: P1
    title: Paridade por construção
    body: Toda mutação passa por um efeito tipado com `apply()` +
      `revert(beforeState)`. Uninstall reverte o journal; nenhum consumidor
      escreve lógica de reversão. O round-trip parity test é a verificação, não
      a garantia.
  - id: P2
    title: Mecanismo casa com a forma do risco
    body: Arquivos usam reconciliação declarativa (estado idempotente, derivável da
      config). Mutações não-arquivo usam efeito-com-before-state (o passado não
      é derivável do disco). Nenhum dos dois domínios é forçado para o mecanismo
      do outro.
  - id: P3
    title: Sem prova de propriedade, não apaga
    body: Qualquer remoção (órfão, legado, entrada de settings) só ocorre sobre algo
      que o efeito provou ter criado. Ausência de prova é um não-apague. É a
      defesa central de segurança de dados.
  - id: P4
    title: Catálogo de efeitos fechado mas extensível
    body: O kernel traz 3 tipos built-in e expõe um contrato de registro; um runtime
      layer adiciona um tipo novo com seu par apply/revert + fixtures, sem
      reabrir o kernel.
glossary:
  - term: Efeito
    definition: unidade tipada de mutação reversível (apply/revert/before-state).
  - term: Journal
    definition: ledger de efeitos aplicados + before-state; extensão do manifesto atual.
  - term: Reconciler
    definition: diff(desejado, journal, disco) para o conjunto de arquivos.
  - term: Runtime layer
    definition: "provider acoplado pelo consumidor que emite efeitos (ex.: aiDeck, hooks)."
  - term: Provider
    definition: planejador puro que emite efeitos sem executá-los.
phases:
  - id: F0
    slug: reversible-installer-f0-effect-kernel-file-reconciler
    title: Effect Kernel + file reconciler
    goal: estabelecer o contrato fechado de efeito (apply/revert/before-state) + o
      journal + o efeito de reconciliação de arquivos portado da lógica 3-hash
      atual, sem tocar no instalador legado.
    dependsOn: []
    subPhaseCount: 3
    exitGate:
      summary: 2 criteria to meet
      criteria:
        - id: G-1
          description: O efeito reconcileFileSet reproduz o comportamento de
            install/update/uninstall de arquivos dos testes atuais.
          status: pending
          verifier:
            kind: test
            runner: node --test
            pattern: test/kernel/reconciler.test.js
        - id: G-2
          description: O contrato de efeito tem fixture de round-trip que prova apply
            seguido de revert restaurando o baseline.
          status: pending
          verifier:
            kind: test
            runner: node --test
            pattern: test/kernel/effect.test.js
    status: active
    summary: "Funda o kernel: contrato de efeito reversível, journal e o reconciler
      de arquivos (porta do 3-hash)."
  - id: F1
    slug: reversible-installer-f1-efeitos-built-in-nao-arquivo
    title: Efeitos built-in não-arquivo
    goal: implementar os 3 efeitos não-arquivo com before-state preciso e revert sem
      hack, e provar a segurança de dados com a matriz adversária no round-trip.
    dependsOn:
      - F0
    subPhaseCount: 4
    exitGate:
      summary: 1 criterion to meet
      criteria:
        - id: G-1
          description: As três fixtures adversárias (hook de terceiro, refcount 2-install
            com crash, arquivo do usuário em path legado) estão presentes e
            passam.
          status: pending
          verifier:
            kind: shell
            command: node --test tests/install-uninstall-roundtrip.test.js
            expectExitCode: 0
    status: pending
    summary: Os 3 efeitos não-arquivo (json-merge/refcount/legacy-prune) com
      before-state + matriz adversária no round-trip.
  - id: F2
    slug: reversible-installer-f2-providers-e-config-two-tier
    title: Providers e config two-tier
    goal: expor a config declarativa two-tier e portar a instalação de skills para
      um provider sobre o kernel, mantendo o render multi-IDE e o
      COMMUNICATION_LANGUAGE opt-out.
    dependsOn:
      - F1
    subPhaseCount: 3
    exitGate:
      summary: 2 criteria to meet
      criteria:
        - id: G-1
          description: O SkillsProvider reproduz a instalação de skills atual (paths e
            conteúdo) via reconcileFileSet.
          status: pending
          verifier:
            kind: test
            runner: node --test
            pattern: test/providers/skills-provider.test.js
        - id: G-2
          description: Um runtime layer registra e reverte um tipo de efeito novo sem
            reabrir o kernel.
          status: pending
          verifier:
            kind: test
            runner: node --test
            pattern: test/kernel/runtime-layer.test.js
    status: pending
    summary: Config two-tier + SkillsProvider (IDE matrix/render, COMM_LANG opt-out)
      + API de registro de runtime layer.
  - id: F3
    slug: reversible-installer-f3-big-bang-rewire-e-paridade
    title: Big-bang rewire e paridade
    goal: religar o atomic-skills sobre o kernel (aiDeck, hooks, auto-update como
      runtime layers), substituir o install/uninstall legados pelo driver, e
      provar a paridade com o round-trip e a suíte completa.
    dependsOn:
      - F2
    subPhaseCount: 4
    exitGate:
      summary: 2 criteria to meet
      criteria:
        - id: G-1
          description: O round-trip parity test mais as três fixtures adversárias passam
            com retorno byte-a-byte ao baseline.
          status: pending
          verifier:
            kind: shell
            command: node --test tests/install-uninstall-roundtrip.test.js
            expectExitCode: 0
        - id: G-2
          description: A suíte completa passa via driver, com install.js e uninstall.js
            legados removidos.
          status: pending
          verifier:
            kind: shell
            command: npm test
            expectExitCode: 0
    status: pending
    summary: Religa atomic-skills sobre o kernel (aiDeck/hooks/auto-update como
      runtime layers) e prova paridade.
references: []
planActive: true
planTitle: Reversible Installer — motor de instalação reversível e reutilizável
---

# Reversible Installer — motor de instalação reversível e reutilizável

## 1. Context

Extrair o instalador do atomic-skills num kernel genérico de sincronização reversível de arquivos templados, consumível por qualquer projeto via dependência + config. Uninstall é propriedade estrutural do kernel (replay reverso do journal + reconcile do file set para vazio), não código que cada consumidor escreve. Fonte-de-verdade: `design.md` desta pasta (aprovado pelo critic).

## 2. Inviolable principles

- **P1 Paridade por construção** — Toda mutação passa por um efeito tipado com `apply()` + `revert(beforeState)`. Uninstall reverte o journal; nenhum consumidor escreve lógica de reversão. O round-trip parity test é a verificação, não a garantia.
- **P2 Mecanismo casa com a forma do risco** — Arquivos usam reconciliação declarativa (estado idempotente, derivável da config). Mutações não-arquivo usam efeito-com-before-state (o passado não é derivável do disco). Nenhum dos dois domínios é forçado para o mecanismo do outro.
- **P3 Sem prova de propriedade, não apaga** — Qualquer remoção (órfão, legado, entrada de settings) só ocorre sobre algo que o efeito provou ter criado. Ausência de prova é um não-apague. É a defesa central de segurança de dados.
- **P4 Catálogo de efeitos fechado mas extensível** — O kernel traz 3 tipos built-in e expõe um contrato de registro; um runtime layer adiciona um tipo novo com seu par apply/revert + fixtures, sem reabrir o kernel.

## 3. Phase tree

_(Canonical list in frontmatter `phases:`. aiDeck renders the tree visually when running.)_
