---
schemaVersion: "0.1"
slug: reversible-installer-f1-efeitos-built-in-nao-arquivo
title: Efeitos built-in não-arquivo
goal: implementar os 3 efeitos não-arquivo com before-state preciso e revert sem
  hack, e provar a segurança de dados com a matriz adversária no round-trip.
status: active
branch: plan/reversible-installer
started: 2026-06-17T16:41:21.000Z
lastUpdated: 2026-06-17T18:45:33.000Z
nextAction: "All F1 tasks done — run phase-done to verify exit gate G-1 + review gate, then advance to F2"
parentPlan: reversible-installer
phaseId: F1
tasksDone: 4
tasksTotal: 4
gatesMet: 0
gatesTotal: 1
exitGates:
  - id: G-1
    description: As três fixtures adversárias (hook de terceiro, refcount 2-install
      com crash, arquivo do usuário em path legado) estão presentes e passam.
    status: pending
    verifier:
      kind: shell
      command: node --test tests/install-uninstall-roundtrip.test.js
      expectExitCode: 0
    verifierLabel: "shell: node --test tests/install-uninstall-roundtrip.test.js"
stack:
  - id: 1
    title: Efeitos built-in não-arquivo
    type: task
    openedAt: 2026-06-17T15:13:50.418Z
tasks:
  - id: T-001
    title: Efeito json-merge (subtração de delta)
    status: done
    lastUpdated: 2026-06-17T18:19:31.000Z
    closedAt: 2026-06-17T18:19:31.000Z
    evidence:
      verifierKind: test
      verifiedAt: 2026-06-17T18:19:31.000Z
      passed: true
      exitCode: 0
      testsCollected: 9
      outputSummary: "Re-run on MERGED primary @5e0261b: node --test
        test/kernel/effects/json-merge.test.js — tests 9, pass 9, fail 0.
        Deep-merge aditivo com before-state {fileCreated,inserts,createdContainers};
        revert subtrai exatamente o delta (preserva hook de terceiro), recusa
        overwrite de escalar, union-append idempotente, path-safety em
        apply+revert, JSON inválido → throw sem clobber. Cobre os 3 acceptance +
        contrato de input completo (L-001) + herméticos (L-002). Executor: codex
        lane, worktree impl/ri-f1-t001 (self-report sub-contou tests=1; re-run na
        primária = 9, L-003)."
    summary: json-merge reverte por subtração do delta, preserva hooks de terceiros.
    description: before-state = conjunto exato de chaves inseridas + flag
      fileCreated; generaliza settingsCreated/removeAutoUpdateHook
      (src/install.js:219-262) e o merge aditivo (src/install.js:584-637).
    scopeBoundary:
      - não reescreve o arquivo JSON inteiro; não restaura snapshot; não toca
        outros efeitos
    acceptance:
      - hook de terceiro pré-existente sobrevive ao revert
      - arquivo criado pelo efeito e esvaziado é apagado
      - revert remove só o delta aplicado, nunca por snapshot
    verifier:
      kind: test
      runner: node --test
      pattern: test/kernel/effects/json-merge.test.js
  - id: T-002
    title: Efeito refcount (marcadores por-dono)
    status: done
    lastUpdated: 2026-06-17T18:27:36.000Z
    closedAt: 2026-06-17T18:27:36.000Z
    evidence:
      verifierKind: test
      verifiedAt: 2026-06-17T18:27:36.000Z
      passed: true
      exitCode: 0
      testsCollected: 8
      outputSummary: "Re-run on MERGED primary @ade1120: node --test
        test/kernel/effects/refcount.test.js — tests 8, pass 8, fail 0. Marcadores
        independentes owners/<sha256(ownerId)> (D8, sem array mutável installs.json);
        marker guarda o manifesto do dono p/ validação de órfão. apply com guard
        markerExisted (idempotente); revert remove só o marker que este apply criou,
        poda órfãos, reclama owners/ vazio + pruneEmptyParents (lastOwnerReleased).
        Sem passo de decremento → crash-safe (cura owners/ vazio e marker órfão).
        Cobre os 4 acceptance + path-safety + idempotência (L-001/L-002). Executor:
        codex lane, worktree impl/ri-f1-t002 (self-report sub-contou tests=1; re-run
        na primária = 8, L-003)."
    summary: refcount por marcadores owners/ validados contra manifesto, crash-safe,
      sem installs.json mutável.
    description: Substitui o refcount de src/install.js:135-173 por marcadores
      owners/ validados contra o manifesto de cada dono; reclama o artefato no
      diretório vazio.
    scopeBoundary:
      - não usa o array mutável installs.json; só o diretório owners de
        marcadores independentes
    acceptance:
      - dois installs e um uninstall mantêm o artefato
      - segundo uninstall remove artefato e o diretório owners
      - marcador órfão é podado na validação
      - crash entre decrementar e remover não corrompe o estado
    verifier:
      kind: test
      runner: node --test
      pattern: test/kernel/effects/refcount.test.js
  - id: T-003
    title: Efeito legacy-prune (safelist por frontmatter)
    status: done
    lastUpdated: 2026-06-17T18:38:53.000Z
    closedAt: 2026-06-17T18:38:53.000Z
    evidence:
      verifierKind: test
      verifiedAt: 2026-06-17T18:38:53.000Z
      passed: true
      exitCode: 0
      testsCollected: 8
      outputSummary: "Re-run on MERGED primary @75428bd: node --test
        test/kernel/effects/legacy-prune.test.js — tests 8, pass 8, fail 0.
        Porta isAtomicSkillsArtifact (regex de frontmatter name idêntica) +
        safelist + findLegacyOrphans + removeLegacyOrphans num efeito genérico
        (safelist/legacyDirs são parâmetros do consumidor, kernel não importa
        install.js). apply apaga só arquivo com name: em knownNames (preserva
        sem assinatura — P3, knownNames.has(undefined)=false), grava
        {path,content}; revert restaura byte-a-byte (round-trip exato). Walkback
        path-aware até o namespace root, path-safety em apply+revert. Cobre os 3
        acceptance + path-safety + restore + prune + roots ausentes (L-001/L-002).
        Full npm test: tests 859, pass 845, fail 2 (as 2 pré-existentes do
        dashboard: DEFAULT_BUNDLE_DIR + dashboard bundle built — zero regressão
        do kernel). Executor: codex lane, worktree impl/ri-f1-t003 (self-report
        sub-contou tests=1; re-run na primária = 8, L-003)."
    summary: "legacy-prune com safelist de frontmatter: sem prova de propriedade,
      não apaga."
    description: Porta isAtomicSkillsArtifact (src/install.js:298-314), a safelist
      (src/install.js:280-290) e findLegacyOrphans (src/install.js:327-351).
    scopeBoundary:
      - nunca apaga um arquivo sem assinatura de frontmatter do consumidor; não
        toca paths atuais
    acceptance:
      - arquivo do usuário sem a assinatura sobrevive ao prune
      - arquivo com a assinatura do consumidor é removido
      - ausência de prova de propriedade resulta em preservar
    verifier:
      kind: test
      runner: node --test
      pattern: test/kernel/effects/legacy-prune.test.js
  - id: T-004
    title: Matriz adversária no round-trip parity test
    status: done
    lastUpdated: 2026-06-17T18:45:33.000Z
    closedAt: 2026-06-17T18:45:33.000Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-17T18:45:33.000Z
      passed: true
      exitCode: 0
      outputSummary: "Primary @77cd386: node --test
        tests/install-uninstall-roundtrip.test.js — tests 7, pass 7, fail 0
        (4 existentes + as 3 fixtures adversárias novas). (1) hook de terceiro
        pré-existente sobrevive ao round-trip + settings.json byte-a-byte
        (removeAutoUpdateHook cirúrgico, settingsCreated=false preserva). (2)
        refcount 2 donos (user $HOME + project repo) no mesmo installs.json:
        uninstall de 1 mantém o registry; crash-retry duplicado curado pelo
        filter de unregisterInstall; uninstall do 2º → count 0 → registry +
        runtime removidos → baseline. (3) arquivo do usuário não-assinado em
        .claude/skills/atomic-skills/ preservado (P3, findLegacyOrphans →
        unsafe). Mode 1 self-exec (Opus): design da simulação de crash emergiu
        na implementação (disqualificador F1) + exit-gate verifier + acoplado à
        infra de install/uninstall legada."
    summary: round-trip ganha as 3 fixtures adversárias (hook de terceiro,
      refcount+crash, arquivo do usuário em path legado).
    description: Estende tests/install-uninstall-roundtrip.test.js com as três
      fixtures adversárias que provam a segurança de dados.
    scopeBoundary:
      - só o arquivo de teste; não altera o kernel nem os efeitos
    acceptance:
      - fixture de hook de terceiro pré-existente verde
      - fixture de refcount com dois installs + crash-no-meio verde
      - fixture de arquivo do usuário em path legado fora do safelist verde
    verifier:
      kind: shell
      command: node --test tests/install-uninstall-roundtrip.test.js
      expectExitCode: 0
parked: []
emerged: []
summary: Os 3 efeitos não-arquivo (json-merge/refcount/legacy-prune) com
  before-state + matriz adversária no round-trip.
planTitle: Reversible Installer — motor de instalação reversível e reutilizável
planActive: true
current: true
---

# Narrative / notes

Initiative for phase **F1 — Efeitos built-in não-arquivo**.

## Decisions

_(record decisions here as they are made)_

## Lessons herdadas de F0 (dispor no phase-start)

Ratificadas em `lessons/reversible-installer-f0-effect-kernel-file-reconciler.md` (3 reusable, status open):
- **L-001** Work-order de efeito do kernel deve exigir na acceptance o contrato COMPLETO de input dos módulos pareados (null/vazio/malformado) + segurança de path — não só happy-path. (Aplicar direto em T-001 json-merge, T-002 refcount, T-003 legacy-prune.)
- **L-002** Testes de escape/`..` devem ser herméticos (basePath aninhado sob tempDir limpo). (Relevante p/ T-003 legacy-prune + T-004 matriz adversária.)
- **L-003** Self-report do Codex sub-conta testes — re-run na árvore mesclada é a única evidência.

## Links

- Plano: `../../plan.md` · Design: `../../design.md` · Lessons F0: `../lessons/reversible-installer-f0-effect-kernel-file-reconciler.md`

## Self-review against code-quality gates (implement — F1)

- **G1 read-before-claim**: applied — cada task fechada vincula source lido + a corrida do verifier que a fechou. T-001 `json-merge.js` lido (G1) + re-run 9/9 @`5e0261b`; T-002 `refcount.js` lido + 8/8 @`ade1120`; T-003 `legacy-prune.js` lido + 8/8 @`75428bd` + full suite 859/845/2; T-004 round-trip 7/7 @`77cd386`. Cada `evidence.outputSummary` cita a corrida na árvore mesclada/primária, não o self-report do executor.
- **G2 soft-language**: applied — alegações de conclusão são `passed: true` com contagens exatas; narrativa do handoff varrida pela ban-list (should/probably/works/looks done) — 0 violações.
- **G6 reference-or-strike**: applied — literais do handoff são verbatim (SHAs `5e0261b`/`ade1120`/`75428bd`/`77cd386`/`a13201f`, os comandos de verifier, e as 2 falhas pré-existentes do dashboard nomeadas exatamente).
- **Mode 2 telemetry**: 3 tasks via Codex (T-001/T-002/T-003) + 1 Mode 1 (T-004), registradas em `.atomic-skills/status/dispatch-log.json` (12 records). Re-verify na árvore mesclada pegou o Codex sub-contando testes em todas as 3 (L-003).

## Session handoff
- **Narrative:** **F1 em 4/4 — todas as tasks DONE in-repo.** T-001 json-merge (`5e0261b`, 9/9), T-002 refcount (`ade1120`, 8/8), T-003 legacy-prune (`75428bd`, 8/8) via Codex/Mode 2; T-004 matriz adversária no round-trip (`77cd386`, Mode 1) 7/7. **⚠️ PIVOT (2026-06-17, usuário): package-first.** O usuário redirecionou — a engine vira pacote npm separado AGORA (`@henryavila/tooling-installer`), atomic-skills é o 1º consumidor. **Pacote criado e verde** em `~/tooling-installer` (repo git separado, commit inicial `22bfa99`, 38/38 testes): engine core migrada (kernel+journal+reconciler+3 efeitos+hash+manifest), `MANIFEST_DIR` generalizado, API pública em `src/index.js`. atomic-skills NÃO foi religado (é F3). **`phase-done` do F1 in-repo está SUPERSEDED** — não rodar; F2/F3 serão re-escopados para package-first. Ver seção "⚠️ PIVOT" no `design.md`.
- **Decision log:** (1) Mode 2/Codex para as 4 tasks F1 — disqualificador F1 (design não-assentado, design.md:77) resolvido como em F0: Opus assenta o design no briefing → spec-ready; Codex executa; Opus re-verifica na árvore mesclada. (2) **json-merge LANDED** (`src/kernel/effects/json-merge.js`, type id `jsonMerge` camelCase como `reconcileFileSet`): deep-merge aditivo, recusa overwrite de escalar, union-append idempotente, before-state `{fileCreated,inserts,createdContainers}`, revert subtrai delta + poda created containers + apaga arquivo se fileCreated&&vazio; "achar matcher '*'" é problema do consumidor F3. (3) **T-002 refcount — direção de design (assentar no briefing):** efeito `refcount` com marcadores por-dono `owners/<hash(ownerId)>` (D8, NÃO o array mutável installs.json); marker guarda o caminho do manifesto do dono. apply cria o marker do dono (before-state inclui `markerExisted` p/ idempotência — revert remove SÓ o marker que este apply criou). revert: remove o marker do dono, valida markers restantes contra o manifesto de cada dono (poda órfãos cujo manifesto sumiu), e se `owners/` ficar vazio reclama o artefato compartilhado + remove `owners/`. Sem passo de decremento → crash-safe/self-healing. Interface exata (artifactDir/ownerId/ownerManifestPath) a fixar no briefing. (4) `reviewGate`/GATE-R3 e infra `lessons/` NÃO existem nesta versão — review em prosa + review file.
- **Single nextAction:** AGUARDANDO VALIDAÇÃO DO USUÁRIO (ele saiu — "valido depois"). Quando voltar: (1) validar o pacote `~/tooling-installer` (`cd ~/tooling-installer && npm test` → 38/38; revisar `src/index.js` + README); (2) re-desenhar F2/F3 do plano para package-first (NÃO unilateral — design com o usuário): F2 = API de Provider + Driver/CLI no pacote; F3 = atomic-skills depende via link, remove a cópia in-repo `src/kernel/`, paridade round-trip atravessando a dependência. NÃO rodar o `phase-done` in-repo (superseded pelo pivot).
- **Decision log (T-004):** Mode 1 self-exec (Opus) — disqualificador F1: o design da simulação de crash contra o instalador real emergiu na implementação (não estava assentado pré-dispatch); ademais é o exit-gate verifier e acopla na infra de install/uninstall legada que eu havia internalizado. Crash modelado como entrada DUPLICADA em installs.json (artefato de retry-crashed) curada pelo `filter` de `unregisterInstall` — cenário recuperável que o instalador atual SOBREVIVE (a janela decrement→remove não-recuperável é o risco residual que o efeito refcount de T-002 fecha em F3). Fixture de legado testa só o arquivo NÃO-assinado (P3): um arquivo assinado seria apagado irreversivelmente pelo instalador atual (gap que o efeito legacy-prune fecha em F3).
- **Verbatim state:** HEAD impl T-004 = `77cd386` (commit do estado `.atomic-skills` segue logo após). Verifiers F1 (todos DONE): T-001 `test/kernel/effects/json-merge.test.js` 9/9, T-002 `test/kernel/effects/refcount.test.js` 8/8, T-003 `test/kernel/effects/legacy-prune.test.js` 8/8, T-004 `node --test tests/install-uninstall-roundtrip.test.js` 7/7. Exit-gate F1 G-1: `node --test tests/install-uninstall-roundtrip.test.js` (verde 7/7). Diff range da fase p/ review gate: `c26afe1..HEAD`. Falhas pré-existentes (NÃO bloqueiam): `serve constants > DEFAULT_BUNDLE_DIR resolves to <pkg>/dist/dashboard` + `the dashboard bundle has been built (E.T-005 prerequisite)`. Branch: `plan/reversible-installer`.
- **Uncommitted changes:** arquivo da fase F1 (status/evidence/rollups de T-004 + este handoff) + `.atomic-skills/status/dispatch-log.json` — prestes a commitar.
