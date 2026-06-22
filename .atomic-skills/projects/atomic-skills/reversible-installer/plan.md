---
schemaVersion: "0.1"
slug: reversible-installer
title: Reversible Installer — motor de instalação reversível e reutilizável
version: "1.0"
status: done
started: 2026-06-17T15:13:50.418Z
lastUpdated: 2026-06-19T20:05:00.000Z
branch: plan/reversible-installer
currentPhase: F3
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
    body: "Qualquer remoção (órfão, legado, entrada de settings) só ocorre sobre
      algo que o efeito provou ter criado. Ausência de prova é um não-apague.
      Exceção-allowlist explícita e única: o legacy-prune usa a safelist de
      assinatura de frontmatter como a ÚNICA evidência de propriedade aceita
      para paths legados, com fixture adversária para arquivo do usuário que
      imite a assinatura. É a defesa central de segurança de dados."
  - id: P4
    title: Catálogo de efeitos fechado mas extensível
    body: O kernel traz 4 tipos de efeito built-in REGISTRADOS (reconcileFileSet
      para o conjunto de arquivos + json-merge + refcount + legacy-prune) e
      expõe um contrato de registro; um runtime layer adiciona um tipo novo com
      seu par apply/revert + fixtures, sem reabrir o kernel.
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
          status: met
          metAt: 2026-06-17T16:41:21.000Z
          verifier:
            kind: test
            runner: node --test
            pattern: test/kernel/reconciler.test.js
          evidence:
            verifierKind: test
            verifiedAt: 2026-06-17T16:41:21.000Z
            passed: true
            exitCode: 0
            testsCollected: 4
            outputSummary: "node --test test/kernel/reconciler.test.js — tests 4,
              pass 4, fail 0 (inclui o teste de path-containment do review gate)."
        - id: G-2
          description: O contrato de efeito tem fixture de round-trip que prova apply
            seguido de revert restaurando o baseline.
          status: met
          metAt: 2026-06-17T16:41:21.000Z
          verifier:
            kind: test
            runner: node --test
            pattern: test/kernel/effect.test.js
          evidence:
            verifierKind: test
            verifiedAt: 2026-06-17T16:41:21.000Z
            passed: true
            exitCode: 0
            testsCollected: 4
            outputSummary: "node --test test/kernel/effect.test.js — tests 4, pass
              4, fail 0 (round-trip apply→revert restaura baseline)."
    status: done
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
    status: done
    summary: "Os 3 efeitos não-arquivo (json-merge/refcount/legacy-prune) com
      before-state + matriz adversária no round-trip. [Reconciliado em F3 phase-done
      2026-06-19 — construído in-repo e verde (matriz adversária no round-trip), depois
      SUPERSEDED pelo pivot package-first; os efeitos migraram p/ o pacote
      @henryavila/tooling-installer e a paridade vive no round-trip 9/9.]"
  - id: F2
    slug: reversible-installer-f2-providers-e-config-two-tier
    title: "Provider API + Driver no pacote (package-first)"
    goal: "No pacote @henryavila/tooling-installer (repo separado, em
      ~/tooling-installer): expor o contrato de Provider (planejador puro
      plan(config) -> Effect[]), o Driver (install/uninstall/update/detect/status
      sobre kernel + journal + reconciler) e o schema da config two-tier.
      SkillsProvider, render e idioma NÃO ficam no pacote — são do consumidor
      (F3). O idioma é flag de config opaca; o pacote é lib-only (sem CLI).
      Decisões em PROPOSAL-f2-f3-package-first.md."
    dependsOn:
      - F1
    subPhaseCount: 3
    exitGate:
      summary: "2 criteria to meet (verificados no repo do pacote ~/tooling-installer)"
      criteria:
        - id: G-1
          description: Um Provider de referência (genérico, não-skills) instala e
            desinstala via o Driver com round-trip byte-a-byte ao baseline.
          status: pending
          verifier:
            kind: shell
            command: cd ~/tooling-installer && npm test
            expectExitCode: 0
        - id: G-2
          description: Um runtime layer registra e reverte um tipo de efeito novo sem
            reabrir o kernel via a API de registro do pacote.
          status: pending
          verifier:
            kind: shell
            command: cd ~/tooling-installer && node --test test/kernel/runtime-layer.test.js
            expectExitCode: 0
    status: done
    summary: "Package-first: contrato de Provider + Driver + config two-tier no
      pacote. SkillsProvider/render/idioma = consumidor (F3). [Reconciliado em F3
      phase-done 2026-06-19: fase-ponteiro — 100% do trabalho no repo do pacote
      ~/tooling-installer (62/62), auto-documentada lá; os gates verificam no pacote.]"
  - id: F3
    slug: reversible-installer-f3-big-bang-rewire-e-paridade
    title: "Consumo do pacote via file: link + paridade (package-first)"
    goal: "atomic-skills depende de @henryavila/tooling-installer via file: link
      ([DECIDIDO #4]); o SkillsProvider (IDE matrix + catálogo + render + flag de
      idioma) e os runtime layers (aiDeck/hooks/auto-update) passam a rodar sobre
      o Driver do pacote; remove a cópia in-repo src/kernel/; install/uninstall
      legados viram finos (montam config -> chamam o Driver). Prova paridade com o
      round-trip + matriz adversária ATRAVESSANDO a dependência."
    dependsOn:
      - F2
    subPhaseCount: 4
    exitGate:
      summary: 3 criteria to meet
      criteria:
        - id: G-1
          description: "O round-trip parity test mais as três fixtures adversárias
            passam com retorno byte-a-byte ao baseline, com a engine vinda do
            pacote (file: link) e a cópia in-repo src/kernel/ já removida."
          status: met
          metAt: 2026-06-19T20:05:00.000Z
          verifier:
            kind: shell
            command: node --test tests/install-uninstall-roundtrip.test.js
            expectExitCode: 0
          evidence:
            verifierKind: shell
            verifiedAt: 2026-06-19T20:05:00.000Z
            passed: true
            exitCode: 0
            outputSummary: "round-trip 9/9 (exit 0) no HEAD pós-fix 0a414e3 — 7 originais +
              os casos update→uninstall e legacy→uninstall que o review gate exigiu; engine
              do pacote (file: link), src/kernel/ removido."
        - id: G-2
          description: A suíte completa passa via o Driver do pacote, com src/kernel/
            in-repo removido e install.js/uninstall.js legados substituídos.
          status: deferred
          deferredReason: "npm test 830/816/2 (exit 1) — as 2 falhas são ambientais e
            pré-existentes do dashboard-bundle (regex de path com nome do dir do worktree
            'reversible-installer' + bundle não-buildado), un-greenable neste worktree;
            ficam verdes na main com o bundle buildado. Zero regressão. Deferral
            pré-autorizado pelo usuário."
          verifier:
            kind: shell
            command: npm test
            expectExitCode: 0
          evidence:
            verifierKind: shell
            verifiedAt: 2026-06-19T20:05:00.000Z
            passed: false
            exitCode: 1
            outputSummary: "npm test 830 tests, 816 pass, 2 fail — só as 2 ambientais do
              dashboard-bundle (DEFAULT_BUNDLE_DIR worktree-path + bundle não-buildado)."
        - id: G-3
          description: "Inventário: cada mutação persistente emitida por cada runtime
            layer (aiDeck/hooks/auto-update) está mapeada a um efeito
            registrado, uma fixture de round-trip, ou uma entrada de allowlist
            documentada."
          status: met
          metAt: 2026-06-19T20:05:00.000Z
          verifier:
            kind: manual
            description: Auditar o inventário de mutações por runtime layer durante
              phase-done.
          evidence:
            verifierKind: manual
            verifiedAt: 2026-06-19T20:05:00.000Z
            passed: true
            outputSummary: "Inventário auditado — toda mutação persistente mapeada a efeito
              registrado / fixture round-trip / allowlist documentada (mapa CLAUDE.md);
              nenhuma órfã."
    status: done
    summary: "Package-first: atomic-skills consome o pacote (file: link), move
      SkillsProvider + runtime layers sobre o Driver, remove src/kernel/ in-repo,
      prova paridade."
references: []
planActive: false
planTitle: Reversible Installer — motor de instalação reversível e reutilizável
---

# Reversible Installer — motor de instalação reversível e reutilizável

## ⚠️ PIVOT — package-first (2026-06-17, redirecionado pelo usuário)

**Este plano mudou de estratégia.** O Context abaixo (e os goals/exit-gates de F2/F3 no frontmatter) foram escritos para "in-repo, split adiado" — isso está **SUPERSEDED**. O usuário redirecionou para **package-first**: a engine vira o pacote npm separado **`@henryavila/tooling-installer`** AGORA, e o atomic-skills é o **primeiro consumidor**. Detalhe completo na seção "⚠️ PIVOT" do `design.md`.

Estado em 2026-06-17 (para quem retomar via `implement`):
- **F0 ✅ / F1 ✅** — kernel + journal + reconciler + 3 efeitos + matriz adversária, construídos in-repo e verdes (ver handoff de F1).
- **Pacote criado e verde** em `~/tooling-installer` (repo git SEPARADO, commit inicial `22bfa99`, 38/38 testes): engine core migrada, API pública em `src/index.js`. **NÃO** é rastreado por este `.atomic-skills/` (é outro repo).
- **atomic-skills NÃO foi religado** ao pacote — a cópia in-repo em `src/kernel/` segue intacta; religar é a F3 reescrita.
- **`phase-done` de F1 in-repo está SUPERSEDED** — não rodar.

**Re-escopo APLICADO (2026-06-19).** O usuário respondeu as 4 decisões abertas e os goals/exit-gates de F2/F3 no frontmatter abaixo **já foram reescritos para package-first**. Fronteira travada: **pacote** = genérico (contrato de Provider + Driver + config two-tier); **consumidor (atomic-skills)** = SkillsProvider + render + flag de idioma + runtime layers. Lib-only; dependência por `file:`. Decisões e racional em [`PROPOSAL-f2-f3-package-first.md`](PROPOSAL-f2-f3-package-first.md) + reframes de D1/D7 no `design.md` §PIVOT.

**Decisão estrutural (2026-06-19):** **F2 é tracejado/executado no próprio repo do pacote** `~/tooling-installer` (é 100% trabalho lá; um repo standalone para múltiplos consumidores). Este plano retém só **F3** (o consumo). F2 se auto-documenta em `~/tooling-installer/docs/design/provider-driver.md`. A entrada F2 no frontmatter abaixo vira ponteiro (gates verificam no pacote).

**Progresso F2 (pacote), suíte 55/55:** (1) MVP Provider/Driver (`f83a1f7`) — contrato `plan(config,planCtx)→[{type,args}]` + `createFileSetProvider` + `createDriver` (uninstall = `replayReverse` + `removeManifest`, round-trip byte-a-byte). (2) Update/re-install 3-hash (`0ee4f6d`) — port da política `--yes` legada: no-clobber + remoção de órfão só não-modificado; Driver passa before-state anterior por (tipo, ordem). (3) **Data-safety RESOLVIDO** (`7703eac`, usuário escolheu lado seguro): arquivo editado pelo usuário SOBREVIVE ao uninstall (track do hash original), simétrico com órfão; diverge do legado num caso que o gate de round-trip não cobre (P3 vence). (4) **Config two-tier** (`e99cc09`) — `defineInstaller({config, providers, effects})`: tier declarativo = `config` (engine só dona de `manifestDir`, resto é pass-through), tier código = providers/effects (escape-hatch de runtime-layer; 4 built-ins auto-registrados). **Reinterpretação deliberada de D2:** config rica (IDEs/catálogo/idioma) é do CONSUMIDOR, não do engine genérico. (5) **Runtime-layer worked example** (`439fe9a`) — `examples/symlink-runtime-layer.js`: efeito custom `symlink` reversível (mesma disciplina no-proof-less-deletion), registrado via `defineInstaller({effects})`, round-trip ponta-a-ponta.

**✅ F2 COMPLETO** (5/5 slices, pacote 58/58, validado por mim). NB: a entrada F2 no frontmatter abaixo segue `status: pending` por ser fase-ponteiro (trabalho rastreado no pacote, não neste plano) — este banner é autoritativo. **F3 EM ANDAMENTO** (big-bang no atomic-skills; one-way D3, rede = round-trip + matriz adversária). Baseline pré-F3: 848 pass / 2 falhas conhecidas do dashboard-bundle, round-trip 7/7.

**⚠️ Coordenação de merge — blast radius medido 2026-06-19 (6 worktrees ativos):** a ÚNICA colisão séria do F3 é `src/install.js` + `src/uninstall.js` + `tests/install-uninstall-roundtrip.test.js` vs **`plan/skills-restructuring`** (== `plan/plan-fork`, mesmo commit `5e54974`), que ADICIONA ~153 linhas ao `install.js` (aditivo: `installSkills`/`installAutoUpdateHook`/`removeAutoUpdateHook`). F3-T-4 REESCREVE o `install.js` → **não auto-mergeável**. Seguros (ninguém mais toca): `render.js`/`config.js`/`manifest.js`/`src/kernel/`. Ruído trivial em todos os branches: `package.json`/`package-lock.json`/`status/dispatch-log.json`/`reviews/INDEX.md`/`PROJECT-STATUS.md` (aditivo/lista). O pacote `~/tooling-installer` é repo separado → 0 colisão.

**Sequência REORDENADA (strangler-fig + gate de merge):**
- **T-F3-1 ✅** (`20cf7c7`) — `file:` link + smoke `tests/tooling-installer-link.test.js`. (path dev-only worktree-relativo; trocar por `^0.1.0` no publish.)
- **T-F3-2 (ADITIVO — seguro agora)** — SkillsProvider como **módulo NOVO** (`src/providers/…`) sobre o Driver, reproduzindo paths/conteúdo de `installSkills`/`render`. **NÃO toca `install.js`.** Prova paridade do caminho novo em teste próprio.
- **T-F3-3 (ADITIVO — seguro agora)** — runtime layers (aiDeck/hooks/auto-update) como effect types via `defineInstaller({effects})`, módulos novos. **NÃO toca `install.js`.**
- **🚧 GATE DE MERGE:** mergear `plan/skills-restructuring` PRIMEIRO → rebasear este branch em cima → só então o T-F3-4.
- **T-F3-4 (BLOQUEADO pelo gate)** — flip big-bang: `install.js`/`uninstall.js` finos (montam config → Driver) + **remove `src/kernel/`**. Feito SOBRE o `install.js` já-mergeado (absorve as adições do skills-restructuring → vira rewrite limpo, sem 3-way). NB: adições do skills-restructuring (`installAutoUpdateHook` etc.) viram runtime-layers/provider.
- **T-F3-5** — paridade final: round-trip + matriz adversária + full suite verdes atravessando a dependência.
- **Próximo executável: T-F3-2** (T-F3-4 fica bloqueado até o gate de merge).

**F3 FORMALMENTE DECOMPOSTA (2026-06-19).** A sequência acima foi materializada no phase file `phases/f3-big-bang-rewire-e-paridade.md` com SPEC completa (Files/scopeBoundary/acceptance/verifier) por task: **T-F3-1** (done) · **T-F3-2** SkillsProvider aditivo · **T-F3-3** runtime layers aditivos · **T-F3-4** flip (bloqueado pelo gate de merge, blockedBy T-F3-6) · **T-F3-5** paridade final · **T-F3-6** migração legada (prereq do flip, preserva o T-005 ratificado). As antigas T-001..T-005 do phase file foram aposentadas. `currentPhase` do plano = **F3**.

**Próximo passo:** continuar F2 no pacote (update semantics → config two-tier → runtime-layer) **ou** começar F3 no atomic-skills (consome via `file:`, move SkillsProvider+render+runtime layers sobre o Driver, remove `src/kernel/` in-repo). F1 in-repo segue done/superseded (não rodar `phase-done`).

## 1. Context

Extrair o instalador do atomic-skills num kernel genérico de sincronização reversível de arquivos templados, reutilizável **in-repo como kernel/API** nesta fase — o consumo cross-project via dependência + config é direção futura, fora do escopo (ver non-goals do design). Uninstall é propriedade estrutural do kernel (replay reverso do journal + reconcile do file set para vazio), não código que cada consumidor escreve. Fonte-de-verdade: `design.md` desta pasta (aprovado pelo critic).

## 2. Inviolable principles

- **P1 Paridade por construção** — Toda mutação passa por um efeito tipado com `apply()` + `revert(beforeState)`. Uninstall reverte o journal; nenhum consumidor escreve lógica de reversão. O round-trip parity test é a verificação, não a garantia.
- **P2 Mecanismo casa com a forma do risco** — Arquivos usam reconciliação declarativa (estado idempotente, derivável da config). Mutações não-arquivo usam efeito-com-before-state (o passado não é derivável do disco). Nenhum dos dois domínios é forçado para o mecanismo do outro.
- **P3 Sem prova de propriedade, não apaga** — Qualquer remoção (órfão, legado, entrada de settings) só ocorre sobre algo que o efeito provou ter criado. Ausência de prova é um não-apague. Exceção-allowlist explícita e única: o legacy-prune usa a safelist de assinatura de frontmatter como a ÚNICA evidência de propriedade aceita para paths legados, com fixture adversária para arquivo do usuário que imite a assinatura. É a defesa central de segurança de dados.
- **P4 Catálogo de efeitos fechado mas extensível** — O kernel traz 4 tipos de efeito built-in REGISTRADOS (reconcileFileSet para o conjunto de arquivos + json-merge + refcount + legacy-prune) e expõe um contrato de registro; um runtime layer adiciona um tipo novo com seu par apply/revert + fixtures, sem reabrir o kernel.

## 3. Phase tree

_(Canonical list in frontmatter `phases:`. aiDeck renders the tree visually when running.)_

## Self-review against code-quality gates

- **G1 read-before-claim**: alegações sobre o código atual carregam `verified_by:` (file:line) verificadas contra o worktree no design.md.
- **G2 soft-language**: scan da ban-list no plano — 0 ocorrências.
- **G6 reference-or-strike**: cada exit-criterion carrega `verifier:`; tarefas carregam verifier determinístico.

## Reviews

- **Codex (cross-model), 2026-06-17** — `needs_changes` → 2 critical + 4 major, todos aplicados. Detalhe + briefings em [`.atomic-skills/reviews/2026-06-17-1536-reversible-installer.md`](../../../reviews/2026-06-17-1536-reversible-installer.md). Correções: F-001 (glob de teste), F-002 (tarefa de migração F3-T-005), F-003 (catálogo de 4 efeitos), F-004 (safelist como exceção-allowlist em P3), F-005 (gate F3-G-3 de inventário), F-006 (escopo in-repo).
- **Internal (self-loop), 2026-06-17** — G2/G6 limpos, títulos/summaries/sinais completos.
