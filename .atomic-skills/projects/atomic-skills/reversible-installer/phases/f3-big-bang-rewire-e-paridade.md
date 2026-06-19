---
schemaVersion: "0.1"
slug: reversible-installer-f3-big-bang-rewire-e-paridade
title: Big-bang rewire e paridade
goal: religar o atomic-skills sobre o kernel do pacote
  @henryavila/tooling-installer (SkillsProvider + aiDeck/hooks/auto-update como
  runtime layers), substituir o install/uninstall legados pelo Driver, remover
  src/kernel/ in-repo, e provar a paridade com o round-trip e a suíte completa
  atravessando a dependência.
status: active
branch: plan/reversible-installer
started: 2026-06-17T15:13:50.418Z
lastUpdated: 2026-06-19T18:05:00.000Z
nextAction: "T-F3-4 (FLIP COMPLETO, Opção B) EM ANDAMENTO — Stage 1/5 DONE+commitado
  (5b7b859: src/installer.js buildInstaller + test verde, suíte 872/858/2). Gate de merge
  DIFERIDO pelo usuário (faça tudo na branch atual). PRÓXIMO = Stage 2 (corte ONE-WAY,
  manifesto→journal híbrido): reescrever installSkills p/ delegar a buildInstaller +
  gravar manifesto híbrido {effects}+files+metadata e retornar {files:[{path,hash}]}
  derivado de journal.effects; rodar node --test tests/install.test.js e iterar. Plano
  completo Stage 2-5 + gotchas no bloco ## Session handoff. T-F3-5 (paridade final) =
  blockedBy T-F3-4."
parentPlan: reversible-installer
phaseId: F3
current: true
tasksDone: 4
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
      ../../../tooling-installer ao package.json (path dev-only
      worktree-relativo; trocar por ^0.1.0 no publish) e um smoke test que
      instala+desinstala via a dependência linkada."
    scopeBoundary:
      - só package.json + o smoke test; não toca install.js nem a engine in-repo
    acceptance:
      - "package.json declara a dependência file: para o pacote"
      - smoke test instala e desinstala atravessando o pacote linkado
        (round-trip)
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
      outputSummary: "node --test tests/tooling-installer-link.test.js — tests 1, pass
        1, fail 0. Smoke: install+uninstall round-trip atravessa a dependência
        file: linkada (@henryavila/tooling-installer @ ~/tooling-installer).
        Commit 20cf7c7; package.json:62 file:../../../tooling-installer."
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
        shared assets incl. o subdir aninhado project-assets/hooks/
        (preRenderFiles omite a recursão; o provider casa com installSkills, o
        ground truth). scopeBoundary respeitado: só src/providers/
        (skills-provider.js + skills-file-set.js) + test/providers/; git diff de
        install.js/uninstall.js/ render.js/config.js vazio. Full suite: tests
        866, pass 852, fail 2 (as 2 falhas pré-existentes do dashboard-bundle;
        zero regressão)."
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
      - o desired reproduz os paths+conteúdo de preRenderFiles/installSkills
        para a matriz de IDEs e o idioma configurados
      - teste de paridade afirma que o desired planejado == saída de
        preRenderFiles byte-a-byte (paths e conteúdo)
      - install.js permanece intocado
    verifier:
      kind: test
      runner: node --test
      pattern: test/providers/skills-provider.test.js
  - id: T-F3-3
    title: Runtime layers (aiDeck/auto-update) sobre defineInstaller (módulos novos,
      aditivo)
    status: done
    lastUpdated: 2026-06-19T16:57:18.000Z
    closedAt: 2026-06-19T16:57:18.000Z
    evidence:
      verifierKind: test
      verifiedAt: 2026-06-19T16:57:18.000Z
      passed: true
      exitCode: 0
      testsCollected: 3
      outputSummary: "node --test test/runtime-layers/atomic-skills.test.js — tests 3,
        pass 3, fail 0. (1) aiDeck layer estaca bin shim + dashboard
        (binary-safe, asset 0xFF sobrevive ao cpSync) + consumer + provisioner +
        package-root via efeito custom stageRuntimeArtifacts e reverte pelo
        journal ao baseline. (2) auto-update: version-check.sh estacado com mode
        0o755 (executável) + jsonMerge adiciona a entrada SessionStart;
        uninstall reverte cirúrgico (hook de terceiro + setting 'theme'
        sobrevivem; settings.json byte-a-byte ao baseline). (3) os dois
        providers + efeito custom compõem num defineInstaller e round-trip.
        scopeBoundary respeitado: só src/runtime-layers/ + test/runtime-layers/;
        git diff de install.js/ uninstall.js vazio. DEPENDÊNCIA CROSS-REPO:
        exigiu o fix do pacote ~/tooling-installer @02dbba3 (jsonMerge
        revertível via Driver) — o publish do pacote (^0.1.x) precisa incluí-lo.
        Full suite: 869 tests, 855 pass, 2 fail (as 2 pré-existentes do
        dashboard; zero regressão)."
    summary: aiDeck staging e auto-update re-expressos como runtime layers que
      revertem pelo journal, registrados via defineInstaller, sem tocar
      install.js.
    description: Re-expressa installRuntimeArtifacts (src/install.js:70-132) e
      installAutoUpdateHook (src/install.js:584) como runtime layers (provider
      e/ou efeito custom) em módulos novos sob src/runtime-layers/, registrados
      via defineInstaller({effects}/{providers}). Aditivo — NÃO toca install.js.
    scopeBoundary:
      - só módulos novos sob src/runtime-layers/ + o teste novo; não modifica
        install.js nem uninstall.js
    acceptance:
      - staging do aiDeck (~/.atomic-skills/{bin,dashboard,aideck-consumer,src})
        roda via runtime layer e reverte pelo journal (apply→revert restaura
        baseline; espelha installRuntimeArtifacts↔removeRuntimeArtifacts)
      - auto-update usa o efeito jsonMerge para a entrada SessionStart em
        settings.json + o efeito custom stageRuntimeArtifacts (binary-safe +
        chmod 0o755) para version-check.sh, revertendo cirurgicamente (hook de
        terceiro sobrevive; espelha installAutoUpdateHook↔removeAutoUpdateHook)
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
      finos (montam a config → chamam defineInstaller/Driver com SkillsProvider
      + runtime layers) e remove src/kernel/ in-repo (effects, effect.js,
      journal.js, reconciler.js) — a engine passa a vir do pacote via file:
      link. Absorve as adições do skills-restructuring (installAutoUpdateHook
      etc.) como runtime-layers/provider. Rewrite limpo sobre o já-mergeado, sem
      3-way."
    scopeBoundary:
      - preserva os flags da CLI atuais (--yes, --project, --ide, --lang);
        remove src/kernel/; não muda o footprint observável da instalação
    acceptance:
      - "install, uninstall, detect e status funcionam via
        defineInstaller/Driver consumindo a engine do pacote (file: link)"
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
      pacote, com src/kernel/ removido; mapa install↔uninstall do CLAUDE.md
      atualizado.
    description: "Prova a paridade final — o round-trip parity test mais as três
      fixtures adversárias voltam byte-a-byte ao baseline com a engine vinda do
      pacote (file: link), a suíte completa passa, e o mapa install↔uninstall no
      CLAUDE.md reflete o Driver, os efeitos e os runtime layers."
    scopeBoundary:
      - só testes e documentação; nenhuma mudança de comportamento do kernel ou
        dos efeitos
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
    status: done
    lastUpdated: 2026-06-19T17:35:34.000Z
    closedAt: 2026-06-19T17:35:34.000Z
    evidence:
      verifierKind: test
      verifiedAt: 2026-06-19T17:35:34.000Z
      passed: true
      exitCode: 0
      testsCollected: 2
      outputSummary: "node --test tests/migration-legacy-install.test.js — tests 2,
        pass 2, fail 0 (exit 0, run 2026-06-19T17:35:34Z). (1)
        migrateLegacyManifest adota cada entry de files com installed_hash
        verificável em UM efeito reconcileFileSet
        (beforeState=[{path,installedHash}], a prova de ownership) e marca
        entries sem hash como unmanaged; idempotente em manifest já-journal;
        descarta o files map legado (superado por effects). (2) Fixture
        round-trip ATRAVESSANDO a dependência @henryavila/tooling-installer
        (file: link): install pré-kernel (manifest legado
        {files:{path:{installed_hash,source}}}, sem effects) →
        migrateLegacyInstall → update via defineInstaller/Driver → uninstall
        reverte SÓ o provado-e-não-modificado (a.md removido), preserva o
        user-editado (b.md sobrevive — P3, revert só apaga se
        disco==installedHash), o unmanaged (c.md sem hash) e o não-rastreado
        (mine.md). scopeBoundary respeitado: só arquivos NOVOS
        src/migrate-legacy-install.js + tests/migration-legacy-install.test.js;
        git diff de install.js/uninstall.js vazio. Full suite: tests 871, pass
        857, fail 2 (as 2 pré-existentes do dashboard-bundle: DEFAULT_BUNDLE_DIR
        + 'bundle has been built' — zero regressão; +2 do novo teste)."
    summary: Adota o manifesto legado em registros de ownership do journal;
      não-verificável vira unmanaged (não-removível), com fixtures de
      pré-kernel. Prereq do flip (T-F3-4).
    description: Antes do flip (T-F3-4), converte o estado do manifesto legado (sem
      journal/before-state) em registros de ownership do journal onde for
      seguro; marca entradas não-verificáveis como unmanaged (nunca removidas
      pelo uninstall). Prerequisito de T-F3-4.
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
- **T-F3-3 staging via efeito custom `stageRuntimeArtifacts`, não reconcileFileSet**
  (decisão do usuário, 2026-06-19): `reconcileFileSet` grava string utf8 a 0o644 —
  não é binary-safe (dashboard pode ter assets binários) nem preserva o +x do
  `version-check.sh`. O efeito custom (binary-safe `cpSync`/`copyFileSync` + chmod,
  before-state = só o criado → revert P3) é registrado via `defineInstaller({effects})`
  (P4 — catálogo fechado, consumidor estende sem reabrir o kernel). `jsonMerge`
  (built-in) cobre a entrada SessionStart do settings.json.
- **Bug do pacote corrigido (cross-repo): jsonMerge não revertia via Driver**
  (decisão do usuário "corrigir o pacote", 2026-06-19). O journal do pacote grava
  só `{type, beforeState}` e `replayReverse` passa `ctx={basePath, manifestDir}` —
  mas `jsonMerge.revert` lia `path` do ctx → crash no uninstall. Fix em
  `~/tooling-installer` **@02dbba3**: `apply` guarda `path` no before-state (como o
  reconcileFileSet), `revert` lê de lá (fallback `ctx.path` p/ chamadas diretas) +
  teste de integração `test/driver/json-merge-roundtrip.test.js` (suíte do pacote
  58→60). **Pendência de publish:** o `^0.1.x` publicado precisa incluir 02dbba3.
- **2026-06-19 — T-F3-4 = FLIP COMPLETO (Opção B), escolhido pelo usuário após a
  investigação revelar que "fino sobre o Driver" colide com o contrato de testes.**
  Achados que guiam a execução: (a) `src/kernel/` não é importado por nada em `src/`
  (só `test/kernel/*`) — o install.js sempre teve lógica bespoke; (b) tornar fino troca
  o manifesto `{files:{}}` → journal `{effects:[]}`, com ripple nos leitores
  `uninstall.js`/`status.js`/`normalize.js`/`ui.js`; (c) 8 arquivos de teste prendem
  `install`/`installSkills`/`installRuntimeArtifacts`/`registerInstall`/
  `removeAutoUpdateHook` + comportamento exato → serão migrados; (d) **refcount + runtime
  global ficam ORQUESTRADOS FORA do journal** (o `replayReverse` descarta o
  `lastOwnerReleased` do `refcount.revert`; parte explícita da Opção B escolhida) —
  `installRuntimeArtifacts`/`removeRuntimeArtifacts`/`registerInstall`/`unregisterInstall`
  permanecem como helpers orquestrados (G-3: allowlist documentada). Plano: (1)
  `src/installer.js` (defineInstaller do install-base: skills+autoUpdate providers +
  stageRuntimeArtifacts effect); (2) manifesto→journal + migrar leitores; (3)
  install/uninstall finos + migrar 8 testes; (4) remover `src/kernel/`+`test/kernel/`,
  podar bespoke morto, atualizar mapa CLAUDE.md; (5) suíte verde + round-trip + matriz.
  ONE-WAY: a suíte fica vermelha durante; só fecha com `npm test` verde.
- **2026-06-19 — 🚧 GATE DE MERGE DIFERIDO por decisão do usuário ("faça tudo na branch
  atual, o merge será feito depois").** T-F3-4 (flip) e T-F3-5 (paridade) serão feitos
  AGORA sobre o `install.js`/`uninstall.js` ATUAIS desta branch (`plan/reversible-installer`),
  NÃO sobre o já-mergeado. Consequência aceita pelo usuário: o merge posterior de
  `plan/skills-restructuring` (==`plan/plan-fork`, `5e54974`, +153 linhas aditivas em
  `install.js`: `installSkills`/`installAutoUpdateHook`/`removeAutoUpdateHook`) NÃO será
  auto-mergeável — o flip reescreve/remove a estrutura do `install.js`, então o merge
  exigirá resolução manual (mapear as adições daquela branch para o provider/runtime-layers
  novos). O `install.js` atual JÁ contém `installAutoUpdateHook`/`installSkills`; conferir
  na investigação se skills-restructuring adiciona algo além disso.
- **2026-06-19 — T-F3-6 (migração legada) DONE em Mode 1.** Roteamento: Mode 1 (Opus
  single-threaded), NÃO Codex — F1 spec-readiness não cumprida ao dispatch (path do
  módulo + mecanismo de adoção legado→journal não fechados) e é trabalho crítico de
  segurança de dados (P3 / codex F-002). Implementação `src/migrate-legacy-install.js`:
  `migrateLegacyManifest(manifest)` é um transform puro (legacy `{files:{path:
  {installed_hash,source}}}` → journal `{effects:[{type:'reconcileFileSet',
  beforeState:[{path,installedHash}]}], unmanaged:[...], legacyMigrated:true}`,
  idempotente em manifest já-journal, descarta o `files` map); `migrateLegacyInstall(
  projectDir, manifestDir)` lê→transforma→grava via `readManifest`/`writeManifest` do
  pacote (no-op se não há install ou já é journal). **Prova de ownership = o
  `installed_hash` legado** (parity sha256/hex/utf8 entre `src/hash.js` e o `hashContent`
  do pacote, conferida) usado direto como `installedHash`; o revert do reconcileFileSet
  só apaga se `disco==installedHash`, então arquivo editado pelo usuário sobrevive.
  **Sem before-state verificável (entry de `files` sem `installed_hash` string; o
  SessionStart merge legado que só registrava `settingsCreated:bool`) → `unmanaged[]`,
  nunca entra num efeito, nunca removido** (P3 "sem prova de propriedade, não apaga").
  Verifier `node --test tests/migration-legacy-install.test.js` 2/2; round-trip da
  fixture atravessa a dependência `@henryavila/tooling-installer` via `defineInstaller`/
  Driver. Blocker de T-F3-4 limpo — só o 🚧 gate de merge bloqueia o flip agora.

## Links

- Plano: `../../plan.md` · Design: `../../design.md` · Proposta package-first:
  `../../PROPOSAL-f2-f3-package-first.md` · Lessons F0:
  `../lessons/reversible-installer-f0-effect-kernel-file-reconciler.md`

## Session handoff
- **Narrative:** F3 em **4/6 done** (T-F3-1/2/3/6). **T-F3-4 (flip completo) EM ANDAMENTO
  — Stage 1 de 5 DONE e commitado (`5b7b859`).** O usuário escolheu o FLIP COMPLETO
  (Opção B) e DIFERIU o gate de merge ("faça tudo na branch atual, o merge será feito
  depois"). Stage 1 = `src/installer.js` (`buildInstaller()` monta o journal do
  install-base via `defineInstaller`: SkillsProvider+autoUpdate providers +
  stageRuntimeArtifacts effect) + `test/installer.test.js` (round-trip real verde).
  Suíte 872/858/2 (baseline; 2 falhas dashboard-bundle pré-existentes). **Stages 2-5 são
  um rewrite ONE-WAY** — não começados (corte manifesto→journal deixa a suíte vermelha
  até toda a migração).
- **Decision log (T-F3-4):** (1) **Manifesto HÍBRIDO journal-autoritativo** (decisão de
  execução, mais segura que pure-journal): manifesto = `{effects[]}` (journal,
  AUTORITATIVO p/ uninstall via `Driver.uninstall`) **+ `files{}` derivado + metadata
  `{version,language,ides,modules}`** p/ os leitores de compat (`status.js`, install.test,
  skills-provider oracle, cli.test ficam VERDES). `result.files` preservado (counts exatos
  de install.test incluem hook+namespace root). (2) **DROP da UI de conflito/órfão
  interativa** — o `reconcileFileSet` faz no-clobber (mantém edição do usuário, P3) +
  remove órfão não-modificado, NÃO-interativo; o flip remove `preRenderFiles` + 3-hash
  bespoke + prompts. (3) **Runtime global + refcount + legacy-prune ORQUESTRADOS FORA do
  journal** (replayReverse descarta `lastOwnerReleased`): manter
  `installRuntimeArtifacts`/`removeRuntimeArtifacts`/`registerInstall`/`unregisterInstall`/
  `findLegacyOrphans`/`removeLegacyOrphans`/`isAtomicSkillsArtifact` como helpers (G-3
  allowlist). (4) `src/kernel/` é importado SÓ por `test/kernel/*` (nada em src/) → o flip
  remove ambos; engine = pacote.
- **Single nextAction:** Stage 2 — reescrever `installSkills(projectDir,options)` p/
  delegar a `buildInstaller(options).install({projectDir})` e então gravar o manifesto
  híbrido (patch `{version,language,ides,modules,files}` por cima do journal) + retornar
  `{files:[{path,hash}]}` derivado de `journal.effects` (reconcileFileSet.beforeState +
  stageRuntimeArtifacts.created p/ o hook). Rodar `node --test tests/install.test.js`
  (esperar quebra nos counts/paths) e iterar.
- **Plano Stage 2-5 (validado por leitura do código):** S2 = reescrever `installSkills`
  (Driver+manifesto híbrido+return), reescrever `install()` thin (remover
  preRenderFiles/3-hash/conflict/orphan prompts; MANTER CLI flags/scope/detect/UI
  intro/legacy-prune/SIGINT + `installRuntimeArtifacts()`+`registerInstall()`), reescrever
  `uninstall()` (`buildInstaller({}).uninstall({projectDir:base})` p/ replayReverse +
  `unregisterInstall`+`removeRuntimeArtifacts` se último; jsonMerge.revert cuida do
  settings → REMOVER `installAutoUpdateHook`/`removeAutoUpdateHook`). S3 = migrar testes:
  `uninstall.test.js` (remover bloco `describe('removeAutoUpdateHook')` + import),
  `install.test.js` (linha 150 `.source`; checar conflito), `update.test.js` (reconstrói
  lógica 3-hash via `installSkills` return — checar), `status.test.js` (híbrido mantém
  `manifest.files` → provável verde), `skills-provider.test.js` (vira tautológico, manter).
  S4 = remover `src/kernel/` + `test/kernel/`, podar morto, atualizar mapa CLAUDE.md. S5 =
  `npm test` verde + round-trip + matriz adversária → fecha T-F3-4; T-F3-5 = paridade final.
- **GOTCHAS achados:** (a) `scope=undefined` (status.test/install.test chamam installSkills
  SEM scope) — o auto-update LAYER usa basePath=projectDir p/ o hook, mas o legado usava
  homedir quando scope!=='project'; conferir counts/paths de install.test após o rewrite.
  (b) counts EXATOS em install.test (53/54/105/53) incluem namespace root + auto-update
  hook — o return DEVE incluir o hook (de stageRuntimeArtifacts.created). (c) metadata
  (version/language/ides) NÃO vem no manifesto do Driver → patch obrigatório.
- **Verbatim state:** HEAD `5b7b859` (Stage 1). Árvore limpa antes deste edit (só este
  phase file muda agora). Suíte: `npm test` → 872/858/2 (as 2 dashboard-bundle:
  `DEFAULT_BUNDLE_DIR resolves to <pkg>/dist/dashboard` + `the dashboard bundle has been
  built (E.T-005 prerequisite)`). Stage-1 test: `node --test test/installer.test.js` → 1/1.
  Pacote `~/tooling-installer` HEAD `02dbba3` (60/60), `package.json`:
  `"@henryavila/tooling-installer":"file:../../../tooling-installer"`. Arquivos-chave:
  `src/installer.js` (novo, buildInstaller), `src/providers/skills-{provider,file-set}.js`,
  `src/runtime-layers/{aideck,auto-update}.js` + `effects/stage-runtime-artifacts.js`.
  Engine: `~/tooling-installer/src/{driver,define-installer,kernel/journal,kernel/reconciler,
  kernel/effects/*}.js`. Exit-gates F3: G-1 `node --test tests/install-uninstall-roundtrip.test.js`,
  G-2 `npm test`, G-3 manual. Branch `plan/reversible-installer`.
- **Uncommitted changes:** só este phase file (handoff/nextAction p/ T-F3-4 Stage 1 done).
  Stage 1 (`src/installer.js`+`test/installer.test.js`) já commitado em `5b7b859`.
