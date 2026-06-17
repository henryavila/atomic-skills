---
schemaVersion: "0.1"
slug: reversible-installer-f1-efeitos-built-in-nao-arquivo
title: Efeitos built-in não-arquivo
goal: implementar os 3 efeitos não-arquivo com before-state preciso e revert sem
  hack, e provar a segurança de dados com a matriz adversária no round-trip.
status: active
branch: plan/reversible-installer
started: 2026-06-17T16:41:21.000Z
lastUpdated: 2026-06-17T16:41:21.000Z
nextAction: "Start T-001: — Efeito json-merge (subtração de delta)"
parentPlan: reversible-installer
phaseId: F1
tasksDone: 0
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
    status: pending
    lastUpdated: 2026-06-17T15:20:11.565Z
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
- **Narrative:** F0 fechada e arquivada-em-lugar (status done, 3/3 tasks, 2/2 gates, review local 2-major-fixed). Plano avançou para F1 (currentPhase F1, esta iniciativa agora active). F1 ainda em 0/4 — nada começado. HEAD primário `8869e31`, árvore limpa após o commit do phase-done.
- **Decision log:** Mode 2/Codex segue como executor default (lane on); as 4 tasks de F1 são spec-ready com verifier determinístico (3 `kind:test` + T-004 `kind:shell` no round-trip). Aplicar as lessons L-001/L-002/L-003 de F0 nos work-orders. `reviewGate`/GATE-R3 e a infra de `lessons/` (schema + list-lessons.js) NÃO existem nesta versão — registrar review em prosa + review file; lessons file é durável mas ainda não consumido por gate.
- **Single nextAction:** Iniciar F1 T-001 (Efeito json-merge, subtração de delta) — Mode 2/Codex, base ref HEAD `8869e31`, verifier `node --test test/kernel/effects/json-merge.test.js`. Porta `src/install.js:219-262` (removeAutoUpdateHook cirúrgico) + `584-637` (merge aditivo). Reverte por subtração do delta, NUNCA por snapshot.
- **Verbatim state:** HEAD primário `8869e31`. Verifiers F1: T-001 `test/kernel/effects/json-merge.test.js`, T-002 `test/kernel/effects/refcount.test.js`, T-003 `test/kernel/effects/legacy-prune.test.js`, T-004 `node --test tests/install-uninstall-roundtrip.test.js`. Exit-gate F1 G-1: `node --test tests/install-uninstall-roundtrip.test.js`. Falhas pré-existentes (NÃO bloqueiam): `serve constants > DEFAULT_BUNDLE_DIR resolves to <pkg>/dist/dashboard` + `the dashboard bundle has been built (E.T-005 prerequisite)`. Branch: `plan/reversible-installer`.
- **Uncommitted changes:** clean tree após o commit do phase-done (este snapshot incluso).
