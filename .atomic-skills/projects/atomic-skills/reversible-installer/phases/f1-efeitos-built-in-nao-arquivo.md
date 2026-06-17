---
schemaVersion: "0.1"
slug: reversible-installer-f1-efeitos-built-in-nao-arquivo
title: Efeitos built-in não-arquivo
goal: implementar os 3 efeitos não-arquivo com before-state preciso e revert sem
  hack, e provar a segurança de dados com a matriz adversária no round-trip.
status: active
branch: plan/reversible-installer
started: 2026-06-17T16:41:21.000Z
lastUpdated: 2026-06-17T18:19:31.000Z
nextAction: "Start T-002: — Efeito refcount (marcadores por-dono)"
parentPlan: reversible-installer
phaseId: F1
tasksDone: 1
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
    status: pending
    lastUpdated: 2026-06-17T15:20:11.565Z
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
    status: pending
    lastUpdated: 2026-06-17T15:20:11.565Z
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
    status: pending
    lastUpdated: 2026-06-17T15:20:11.565Z
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

## Session handoff
- **Narrative:** F1 em 1/4. **T-001 (json-merge) DONE** via Codex (worktree `impl/ri-f1-t001`, merge-back FF → primária `5e0261b`); re-run na árvore mesclada `node --test test/kernel/effects/json-merge.test.js` = tests 9, pass 9, fail 0 (self-report do Codex sub-contou tests=1, L-003). GATE-R2 verde no arquivo da fase, telemetria gravada (dispatch-log 9 records). Próxima: T-002 refcount. Prestes a commitar o estado `.atomic-skills` (a impl de T-001 já está em `5e0261b`).
- **Decision log:** (1) Mode 2/Codex para as 4 tasks F1 — disqualificador F1 (design não-assentado, design.md:77) resolvido como em F0: Opus assenta o design no briefing → spec-ready; Codex executa; Opus re-verifica na árvore mesclada. (2) **json-merge LANDED** (`src/kernel/effects/json-merge.js`, type id `jsonMerge` camelCase como `reconcileFileSet`): deep-merge aditivo, recusa overwrite de escalar, union-append idempotente, before-state `{fileCreated,inserts,createdContainers}`, revert subtrai delta + poda created containers + apaga arquivo se fileCreated&&vazio; "achar matcher '*'" é problema do consumidor F3. (3) **T-002 refcount — direção de design (assentar no briefing):** efeito `refcount` com marcadores por-dono `owners/<hash(ownerId)>` (D8, NÃO o array mutável installs.json); marker guarda o caminho do manifesto do dono. apply cria o marker do dono (before-state inclui `markerExisted` p/ idempotência — revert remove SÓ o marker que este apply criou). revert: remove o marker do dono, valida markers restantes contra o manifesto de cada dono (poda órfãos cujo manifesto sumiu), e se `owners/` ficar vazio reclama o artefato compartilhado + remove `owners/`. Sem passo de decremento → crash-safe/self-healing. Interface exata (artifactDir/ownerId/ownerManifestPath) a fixar no briefing. (4) `reviewGate`/GATE-R3 e infra `lessons/` NÃO existem nesta versão — review em prosa + review file.
- **Single nextAction:** Despachar T-002 (refcount) a um novo worktree `/home/henry/atomic-skills/.worktrees/wt-ri-f1-t002` (branch `impl/ri-f1-t002`, base = HEAD da primária após o commit do estado de T-001), verifier `node --test test/kernel/effects/refcount.test.js`. Criar `src/kernel/effects/refcount.js` + `test/kernel/effects/refcount.test.js`. Porta/substitui `src/install.js:135-173` (installsRegistryPath + register/unregisterInstall).
- **Verbatim state:** HEAD impl T-001 = `5e0261b` (commit do estado `.atomic-skills` segue logo após). Verifiers F1: T-001 `test/kernel/effects/json-merge.test.js` (DONE 9/9), T-002 `test/kernel/effects/refcount.test.js`, T-003 `test/kernel/effects/legacy-prune.test.js`, T-004 `node --test tests/install-uninstall-roundtrip.test.js`. Exit-gate F1 G-1: `node --test tests/install-uninstall-roundtrip.test.js`. Falhas pré-existentes (NÃO bloqueiam): `serve constants > DEFAULT_BUNDLE_DIR resolves to <pkg>/dist/dashboard` + `the dashboard bundle has been built (E.T-005 prerequisite)`. Branch: `plan/reversible-installer`.
- **Uncommitted changes:** arquivo da fase F1 (status/evidence/rollups de T-001 + este handoff) + `.atomic-skills/status/dispatch-log.json` — prestes a commitar.
