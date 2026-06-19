---
schemaVersion: "0.1"
slug: reversible-installer-f3-big-bang-rewire-e-paridade
title: Big-bang rewire e paridade
goal: religar o atomic-skills sobre o kernel do pacote @henryavila/tooling-installer
  (SkillsProvider + aiDeck/hooks/auto-update como runtime layers), substituir o
  install/uninstall legados pelo Driver, remover src/kernel/ in-repo, e provar a
  paridade com o round-trip e a suíte completa atravessando a dependência.
status: active
branch: plan/reversible-installer
started: 2026-06-17T15:13:50.418Z
lastUpdated: 2026-06-19T15:31:48.000Z
nextAction: "Start T-F3-3 (ADITIVO, módulos novos): src/runtime-layers/aideck.js
  + src/runtime-layers/auto-update.js + test/runtime-layers/atomic-skills.test.js.
  Re-expressa installRuntimeArtifacts (src/install.js:70-132 ↔
  removeRuntimeArtifacts:188) e installAutoUpdateHook (src/install.js:584 ↔
  removeAutoUpdateHook:219) como runtime layers que revertem pelo journal,
  registrados via defineInstaller({effects}/{providers}); NÃO toca install.js.
  T-F3-2 done (3/3, paridade byte-a-byte vs installSkills). Sequência restante:
  T-F3-3 (aditivo, seguro agora) → 🚧 GATE: mergear plan/skills-restructuring +
  rebasear → T-F3-4 (flip, bloqueado, blockedBy T-F3-6) → T-F3-5 paridade; T-F3-6
  (migração legada) é prereq de T-F3-4."
parentPlan: reversible-installer
phaseId: F3
current: true
tasksDone: 2
tasksTotal: 6
gatesMet: 0
gatesTotal: 3
exitGates:
  - id: G-1
    description: "O round-trip parity test mais as três fixtures adversárias passam
      com retorno byte-a-byte ao baseline, com a engine vinda do pacote (file:
      link) e a cópia in-repo src/kernel/ já removida."
    status: pending
    verifier:
      kind: shell
      command: node --test tests/install-uninstall-roundtrip.test.js
      expectExitCode: 0
    verifierLabel: "shell: node --test tests/install-uninstall-roundtrip.test.js"
  - id: G-2
    description: A suíte completa passa via o Driver do pacote, com src/kernel/
      in-repo removido e install.js/uninstall.js legados substituídos.
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
  - id: T-F3-1
    title: "file: link + smoke de consumo do pacote"
    status: done
    lastUpdated: 2026-06-19T13:20:00.000Z
    closedAt: 2026-06-19T13:20:00.000Z
    summary: "atomic-skills depende de @henryavila/tooling-installer via file: link,
      com smoke de install+uninstall atravessando a dependência."
    description: "Adiciona @henryavila/tooling-installer via file:
      ../../../tooling-installer ao package.json (path dev-only worktree-relativo;
      trocar por ^0.1.0 no publish) e um smoke test que instala+desinstala via a
      dependência linkada."
    scopeBoundary:
      - só package.json + o smoke test; não toca install.js nem a engine in-repo
    acceptance:
      - "package.json declara a dependência file: para o pacote"
      - smoke test instala e desinstala atravessando o pacote linkado (round-trip)
    verifier:
      kind: test
      runner: node --test
      pattern: tests/tooling-installer-link.test.js
    evidence:
      verifierKind: test
      verifiedAt: 2026-06-19T15:31:48.000Z
      passed: true
      exitCode: 0
      testsCollected: 1
      outputSummary: "node --test tests/tooling-installer-link.test.js — tests 1,
        pass 1, fail 0. Smoke: install+uninstall round-trip atravessa a
        dependência file: linkada (@henryavila/tooling-installer @
        ~/tooling-installer). Commit 20cf7c7; package.json:62
        file:../../../tooling-installer."
  - id: T-F3-2
    title: SkillsProvider sobre o Driver (módulo novo, aditivo)
    status: done
    lastUpdated: 2026-06-19T16:21:02.000Z
    closedAt: 2026-06-19T16:21:02.000Z
    evidence:
      verifierKind: test
      verifiedAt: 2026-06-19T16:21:02.000Z
      passed: true
      exitCode: 0
      testsCollected: 3
      outputSummary: "node --test test/providers/skills-provider.test.js — tests 3,
        pass 3, fail 0. (1) plan() emite um único {type:'reconcileFileSet',
        args:{basePath, desired}} com desired [{path,content}] não-vazio. (2)
        desired reproduz o footprint de installSkills BYTE-A-BYTE (bijeção de
        paths + conteúdo idêntico), oráculo = manifest.files menos o hook
        _hooks/* (auto-update é domínio de runtime layer, T-F3-3). (3) cobre
        shared assets incl. o subdir aninhado project-assets/hooks/ (preRenderFiles
        omite a recursão; o provider casa com installSkills, o ground truth).
        scopeBoundary respeitado: só src/providers/ (skills-provider.js +
        skills-file-set.js) + test/providers/; git diff de install.js/uninstall.js/
        render.js/config.js vazio. Full suite: tests 866, pass 852, fail 2 (as 2
        falhas pré-existentes do dashboard-bundle; zero regressão)."
    summary: SkillsProvider planeja o file set de skills (reconcileFileSet)
      reproduzindo paths/conteúdo de installSkills/preRenderFiles, sem tocar
      install.js.
    description: Cria createSkillsProvider() em src/providers/skills-provider.js —
      um provider puro plan(config,{basePath}) que emite reconcileFileSet com o
      desired = file set que preRenderFiles (src/install.js:652) / installSkills
      (src/install.js:394) produzem para a matriz de IDEs + idioma, reusando
      render.js. Prova paridade do caminho novo em teste próprio; NÃO toca
      install.js (estrangulamento aditivo).
    scopeBoundary:
      - só novos arquivos sob src/providers/ + o teste novo; não modifica
        install.js, uninstall.js, render.js nem config.js
    acceptance:
      - "createSkillsProvider().plan(config,{basePath}) retorna [{type:
        'reconcileFileSet', args:{basePath, desired}}]"
      - o desired reproduz os paths+conteúdo de preRenderFiles/installSkills para a
        matriz de IDEs e o idioma configurados
      - teste de paridade afirma que o desired planejado == saída de preRenderFiles
        byte-a-byte (paths e conteúdo)
      - install.js permanece intocado
    verifier:
      kind: test
      runner: node --test
      pattern: test/providers/skills-provider.test.js
  - id: T-F3-3
    title: Runtime layers (aiDeck/auto-update) sobre defineInstaller (módulos novos, aditivo)
    status: pending
    lastUpdated: 2026-06-19T15:31:48.000Z
    summary: aiDeck staging e auto-update re-expressos como runtime layers que
      revertem pelo journal, registrados via defineInstaller, sem tocar install.js.
    description: Re-expressa installRuntimeArtifacts (src/install.js:70-132) e
      installAutoUpdateHook (src/install.js:584) como runtime layers (provider e/ou
      efeito custom) em módulos novos sob src/runtime-layers/, registrados via
      defineInstaller({effects}/{providers}). Aditivo — NÃO toca install.js.
    scopeBoundary:
      - só módulos novos sob src/runtime-layers/ + o teste novo; não modifica
        install.js nem uninstall.js
    acceptance:
      - staging do aiDeck (~/.atomic-skills/{bin,dashboard,aideck-consumer,src})
        roda via runtime layer e reverte pelo journal (apply→revert restaura
        baseline; espelha installRuntimeArtifacts↔removeRuntimeArtifacts)
      - auto-update usa o efeito jsonMerge para a entrada SessionStart em
        settings.json + reconcile para version-check.sh, revertendo cirurgicamente
        (hook de terceiro sobrevive; espelha installAutoUpdateHook↔removeAutoUpdateHook)
      - cada runtime layer registra e reverte via defineInstaller sem reabrir o
        kernel (P4)
    verifier:
      kind: test
      runner: node --test
      pattern: test/runtime-layers/atomic-skills.test.js
  - id: T-F3-4
    title: Flip big-bang — install/uninstall finos + remove src/kernel/
    status: pending
    lastUpdated: 2026-06-19T15:31:48.000Z
    summary: install.js/uninstall.js viram finos (montam config → defineInstaller/
      Driver) e src/kernel/ in-repo é removido; reescrito sobre o install.js
      já-mergeado.
    description: "Após o 🚧 GATE DE MERGE (mergear plan/skills-restructuring ==
      plan/plan-fork, commit 5e54974, +153 linhas aditivas no install.js +
      rebasear este branch), reescreve src/install.js e src/uninstall.js como
      finos (montam a config → chamam defineInstaller/Driver com SkillsProvider +
      runtime layers) e remove src/kernel/ in-repo (effects, effect.js,
      journal.js, reconciler.js) — a engine passa a vir do pacote via file: link.
      Absorve as adições do skills-restructuring (installAutoUpdateHook etc.) como
      runtime-layers/provider. Rewrite limpo sobre o já-mergeado, sem 3-way."
    scopeBoundary:
      - preserva os flags da CLI atuais (--yes, --project, --ide, --lang); remove
        src/kernel/; não muda o footprint observável da instalação
    acceptance:
      - "install, uninstall, detect e status funcionam via defineInstaller/Driver
        consumindo a engine do pacote (file: link)"
      - src/kernel/ in-repo removido
      - install.js e uninstall.js finos (montam config → Driver), flags da CLI
        preservados
      - adições do skills-restructuring (installAutoUpdateHook etc.) absorvidas
        como runtime-layers/provider
    verifier:
      kind: shell
      command: npm test
      expectExitCode: 0
    blockedBy:
      - T-F3-6
  - id: T-F3-5
    title: Paridade final atravessando a dependência
    status: pending
    lastUpdated: 2026-06-19T15:31:48.000Z
    summary: round-trip + 3 fixtures adversárias + full suite verdes via a engine do
      pacote, com src/kernel/ removido; mapa install↔uninstall do CLAUDE.md atualizado.
    description: "Prova a paridade final — o round-trip parity test mais as três
      fixtures adversárias voltam byte-a-byte ao baseline com a engine vinda do
      pacote (file: link), a suíte completa passa, e o mapa install↔uninstall no
      CLAUDE.md reflete o Driver, os efeitos e os runtime layers."
    scopeBoundary:
      - só testes e documentação; nenhuma mudança de comportamento do kernel ou dos
        efeitos
    acceptance:
      - round-trip parity test + as 3 fixtures adversárias voltam byte-a-byte ao
        baseline com a engine do pacote
      - npm test passa inteiro
      - mapa install↔uninstall no CLAUDE.md reflete o Driver, os efeitos e os
        runtime layers
    verifier:
      kind: shell
      command: npm test
      expectExitCode: 0
    blockedBy:
      - T-F3-4
  - id: T-F3-6
    title: Migração de installs legados para o journal
    status: pending
    lastUpdated: 2026-06-19T15:31:48.000Z
    summary: Adota o manifesto legado em registros de ownership do journal;
      não-verificável vira unmanaged (não-removível), com fixtures de pré-kernel.
      Prereq do flip (T-F3-4).
    description: Antes do flip (T-F3-4), converte o estado do manifesto legado (sem
      journal/before-state) em registros de ownership do journal onde for seguro;
      marca entradas não-verificáveis como unmanaged (nunca removidas pelo
      uninstall). Prerequisito de T-F3-4.
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
      lastReviewedAt: 2026-06-19T15:31:48.000Z
parked: []
emerged: []
summary: Religa atomic-skills sobre o kernel do pacote (SkillsProvider +
  aiDeck/hooks/auto-update como runtime layers), remove src/kernel/ in-repo e
  prova paridade atravessando a dependência.
planTitle: Reversible Installer — motor de instalação reversível e reutilizável
planActive: true
---

# Narrative / notes

Initiative for phase **F3 — Big-bang rewire e paridade** (package-first).

## Decisions

- **2026-06-19 — F3 formalmente decomposta (T-F3-1..6).** A sequência reordenada
  (strangler-fig + gate de merge) que vivia só como prosa no banner do `plan.md`
  foi materializada neste phase file com SPEC completa (Files/scopeBoundary/
  acceptance/verifier) por task. As tasks antigas (T-001..T-005, "in-repo split
  adiado") foram aposentadas — estavam superseded pelo pivot package-first e
  teriam levado o flip a tocar `install.js` antes do gate de merge.
- **Estrangulamento (strangler-fig):** T-F3-2 (SkillsProvider) e T-F3-3 (runtime
  layers) são ADITIVOS — módulos novos sob `src/providers/` e `src/runtime-layers/`
  que NÃO tocam `install.js`. Seguros de fazer agora (zero colisão cross-worktree
  adicional). O caminho legado segue vivo até o flip.
- **🚧 GATE DE MERGE (coordenação, não-task):** a única colisão séria do F3 é
  `src/install.js` + `src/uninstall.js` + `tests/install-uninstall-roundtrip.test.js`
  vs **`plan/skills-restructuring`** (== `plan/plan-fork`, commit `5e54974`, +153
  linhas aditivas a `install.js`). Ordem obrigatória: **mergear
  `plan/skills-restructuring` PRIMEIRO → rebasear este branch → só então T-F3-4.**
  O flip reescreve `install.js` SOBRE o já-mergeado (rewrite limpo, sem 3-way),
  absorvendo `installAutoUpdateHook`/`installSkills` adicionados lá como
  runtime-layers/provider.
- **T-F3-6 (migração legada) preservada** como prereq de T-F3-4 (decisão do
  usuário, 2026-06-19): mantém a task ratificada (codex F-002 crítico) com
  provenance/context intactos, em vez de fold no flip ou park.

## Links

- Plano: `../../plan.md` · Design: `../../design.md` · Proposta package-first:
  `../../PROPOSAL-f2-f3-package-first.md` · Lessons F0:
  `../lessons/reversible-installer-f0-effect-kernel-file-reconciler.md`

## Session handoff
- **Narrative:** F3 formalmente decomposta (T-F3-1..6, SPEC completa). **T-F3-1
  done** (`file:` link + smoke). **T-F3-2 done** — SkillsProvider aditivo
  (`src/providers/skills-provider.js` + `src/providers/skills-file-set.js`) que
  emite um `reconcileFileSet` cujo `desired` reproduz o footprint de
  `installSkills` BYTE-A-BYTE (3/3 verde), incl. o subdir aninhado
  `project-assets/hooks/`; NÃO tocou `install.js`. Próximo aditivo seguro é
  **T-F3-3** (runtime layers aiDeck/auto-update). O flip (T-F3-4) e a paridade
  final (T-F3-5) ficam atrás do 🚧 GATE DE MERGE (mergear
  `plan/skills-restructuring` + rebasear). T-F3-6 (migração legada) é prereq de
  T-F3-4.
- **Decision log:** (1) Oráculo de paridade do T-F3-2 = `installSkills` (ground
  truth), NÃO `preRenderFiles` — descoberto na leitura que `preRenderFiles`
  (`src/install.js:723`) PULA subdirs de assets enquanto `installSkills`
  (`:503-521`) recursa um nível; o provider casa com o que de fato é instalado.
  (2) Hook auto-update excluído do set do provider (domínio de runtime layer,
  T-F3-3) via filtro do source `_hooks/*` no manifesto; teste usa `scope:'project'`
  p/ herметismo (com `scope:'user'` o `installAutoUpdateHook` catalog-driven
  escreveria no `~` real). (3) Walk do catálogo duplicado em
  `skills-file-set.js` (strangler-fig; colapsa no T-F3-4). (4) T-005 preservada
  como T-F3-6 (prereq do flip).
- **Single nextAction:** Codar T-F3-3 — `src/runtime-layers/aideck.js` +
  `src/runtime-layers/auto-update.js` + `test/runtime-layers/atomic-skills.test.js`:
  re-expressa `installRuntimeArtifacts` (`src/install.js:70-132` ↔
  `removeRuntimeArtifacts:188`) e `installAutoUpdateHook` (`:584` ↔
  `removeAutoUpdateHook:219`) como runtime layers que revertem pelo journal via
  `defineInstaller`; NÃO toca `install.js`.
- **Verbatim state:** T-F3-2 verifier: `node --test
  test/providers/skills-provider.test.js` → tests 3, pass 3, fail 0 (run
  2026-06-19T16:21:02Z). Full suite: `npm test` → tests 866, pass 852, fail 2 (as
  2 falhas pré-existentes do dashboard-bundle: `serve constants > DEFAULT_BUNDLE_DIR
  resolves...` + `the dashboard bundle has been built (E.T-005 prerequisite)` —
  zero regressão). Pacote: `~/tooling-installer` HEAD `439fe9a` (repo separado,
  58/58). `package.json:62`: `"@henryavila/tooling-installer":
  "file:../../../tooling-installer"`. Exit-gates F3: G-1 `node --test
  tests/install-uninstall-roundtrip.test.js`, G-2 `npm test`, G-3 manual. Branch:
  `plan/reversible-installer` (HEAD `c764b71` = registro da decomposição).
- **Uncommitted changes:** T-F3-2 — novos `src/providers/skills-provider.js`,
  `src/providers/skills-file-set.js`, `test/providers/skills-provider.test.js` +
  este phase file (T-F3-2 done/rollups/nextAction/handoff) **uncommitted** no
  snapshot — a commitar como `feat(reversible-installer): T-F3-2 — SkillsProvider`.
