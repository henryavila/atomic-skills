---
schemaVersion: "0.1"
slug: skills-restructuring-f6-focus-json-auto-refresh
title: focus.json não drifta silenciosamente
goal: garantir que o focus.json (digest da statusline) reflita o estado sem
  depender de um passo de setup interativo opcional — fechar o gap em que
  `atomic-skills install` sozinho deixa o digest stale.
status: active
branch: null
started: 2026-06-16T14:10:57Z
lastUpdated: 2026-06-16T14:28:01Z
nextAction: "T6.1 done (project-transitions.md usa refresh-state). Start T6.2:
  src/install.js conecta os hooks de project-status com paridade uninstall."
parentPlan: skills-restructuring
phaseId: F6
tasksDone: 1
tasksTotal: 2
gatesMet: 0
gatesTotal: 1
exitGates:
  - id: F6-G1
    description: O fluxo de transição regenera o focus.json e os verifiers de
      T6.1+T6.2 passam (desacoplado das 8 falhas de contagem delegadas).
    status: pending
    verifier:
      kind: shell
      command: grep -q 'refresh-state'
        skills/shared/project-assets/project-transitions.md && node --test
        tests/install-uninstall-roundtrip.test.js && npm run validate-skills
      expectExitCode: 0
    verifierLabel: "shell: grep -q 'refresh-state' skills/shared/project-assets/projec…"
stack:
  - id: 1
    title: focus.json não drifta silenciosamente
    type: task
    openedAt: 2026-06-16T14:10:57Z
tasks:
  - id: T6.1
    title: Fluxo de transição regenera o focus.json (fix portável)
    status: done
    closedAt: 2026-06-16T15:38:11Z
    lastUpdated: 2026-06-16T15:38:11Z
    summary: done/phase-done/reconcile/switch usam refresh-state, não só compute-rollups
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-16T15:38:11Z
      passed: true
      exitCode: 0
      outputSummary: grep 'refresh-state' project-transitions.md → presente nas 4
        transições (done L86, reconcile L106, phase-done L138, switch L234) +
        seção canônica L172 (agregador); componentes
        compute-rollups/reconcile-focus preservados; npm run validate-skills →
        '✓ All 15 skills valid (schema_version 0.2)'; exit 0.
    description: "O passo de recompute das transições (done step 3, reconcile step
      4, phase-done, switch) hoje roda `node scripts/compute-rollups.js`, que
      atualiza rollups + (via reconcile-focus) os focus markers, mas NÃO emite o
      `focus.json` (digest flat da statusline claudebar). Resultado: o digest só
      refresca por hook/refresh-state manual e drifta entre sessões. Trocar a
      invocação dessas transições para `node scripts/refresh-state.js`
      (compute-rollups + reconcile-focus + emit-focus num passo só), tornando o
      focus.json fresco após cada mutação de estado, independente de hook/IDE.
      Arquivos: skills/shared/project-assets/project-transitions.md"
    scopeBoundary:
      - trocar apenas a invocação do passo de recompute (compute-rollups.js →
        refresh-state.js) nas transições done/reconcile/phase-done/switch
      - não alterar a semântica de GATE-R2 nem o que cada transição faz além de
        adicionar a regeneração do digest
      - não tocar nos scripts (refresh-state.js já existe e agrega os três
        passos)
    acceptance:
      - o passo de recompute de done/reconcile/phase-done/switch invoca
        refresh-state (rollups + focus markers + focus.json)
      - project-transitions.md menciona refresh-state como o agregador do
        recompute
      - npm run validate-skills passa
    verifier:
      kind: shell
      command: grep -q 'refresh-state'
        skills/shared/project-assets/project-transitions.md && npm run
        validate-skills
      expectExitCode: 0
    outputs:
      - kind: file
        path: skills/shared/project-assets/project-transitions.md
    tags:
      - portability
      - state-hygiene
  - id: T6.2
    title: install conecta os hooks de project-status, com paridade uninstall
    status: pending
    lastUpdated: 2026-06-16T14:10:57Z
    summary: atomic-skills install instala+registra session-start/stop hooks;
      uninstall reverte
    description: "O `src/install.js` hoje só instala o hook de auto-update
      (version-check.sh → SessionStart em settings.json); os hooks de
      project-status (session-start.sh/stop.sh que rodam refresh-state →
      focus.json) são instalados só pelo passo interativo opcional project-setup
      §5. Fazer o install instalar
      `.atomic-skills/status/hooks/{session-start,stop,pre-write}.sh`+`config.j\
      son` e registrar SessionStart+Stop (nível configurável; dry-run por
      default) com a reversão correspondente em src/uninstall.js (HARD RULE de
      paridade) e cobertura no teste de round-trip. Arquivos: src/install.js,
      src/uninstall.js, tests/install-uninstall-roundtrip.test.js"
    scopeBoundary:
      - não tocar no hook de auto-update existente (version-check.sh)
      - preservar a paridade install↔uninstall — o round-trip deve voltar ao
        baseline byte-a-byte (ou registrar allowlist deliberada na CLAUDE.md)
      - registrar hooks em settings.local.json/settings.json conforme a
        convenção já usada pelo project-setup
    acceptance:
      - install instala os hooks de project-status em
        .atomic-skills/status/hooks/ e registra SessionStart+Stop
      - uninstall reverte os hooks e o registro
      - tests/install-uninstall-roundtrip.test.js passa (sem resíduo, sem
        deleção de baseline)
    verifier:
      kind: test
      runner: node --test
      pattern: tests/install-uninstall-roundtrip.test.js
    outputs:
      - kind: file
        path: src/install.js
      - kind: file
        path: src/uninstall.js
      - kind: file
        path: tests/install-uninstall-roundtrip.test.js
    tags:
      - install-parity
      - toolchain
parked: []
emerged: []
summary: "Fecha o gap do focus.json stale: transição usa refresh-state + install
  conecta os hooks (com paridade uninstall)."
planTitle: Reestruturação das skills atomic-skills
planActive: true
current: true
---

# Narrative / notes

Initiative for phase **F6 — focus.json não drifta silenciosamente**.

Fase emergente (rung 6, ratify-gated) surgida na sessão 2026-06-16 ao investigar por que o `focus.json` estava stale: o auto-refresh depende do passo interativo opcional `project-setup §5`, então `atomic-skills install` sozinho deixa o digest drifting. Os hooks foram conectados manualmente nesta sessão (commit que instala `.atomic-skills/status/hooks/` + `settings.local.json`); esta fase torna o fix estrutural — portável (T6.1) e instalável (T6.2). Provenance + context vivem no descriptor `plan.phases[F6]`.

## Decisions

- **F6-G1 desacoplado de `npm test`.** O bloco ratificado usava `npm test`, mas as 8 falhas de contagem (`countSkills`/`installSkills`) estão delegadas à branch de finalização; usar `npm test` bloquearia o phase-done de F6 aqui. O gate usa `node --test tests/install-uninstall-roundtrip.test.js && npm run validate-skills` (cobre T6.1+T6.2 sem depender dos 8 erros alheios). Sinalizado ao usuário.

## Session handoff
- **Narrative:** F6 em andamento (Mode 1, single-threaded). **T6.1 fechada com PASS verificado** (`project-transitions.md` agora roda `node scripts/refresh-state.js` no passo de recompute de done/reconcile/phase-done/switch + a seção canônica "Dashboard rollups & focus markers" nomeia refresh-state como o agregador; componentes compute-rollups/reconcile-focus preservados). Recompute do `done` flow dogfoodou a própria mudança (refresh-state, rollups 0→1). **T6.2 pendente** (1/2 tasks done). Reconciliação prévia confirmou: os status `pending` batem com a realidade — os 3 scripts de hook existem em `.atomic-skills/status/hooks/`, mas nem T6.1 (já feita agora) nem T6.2 (install.js) tinham landado o fix estrutural. F1 foi fechada+commitada antes (`d4414fc`).
- **Decision log:** (1) T6.1 rodada em **Mode 1** (edição de 1 arquivo doc; Codex/Mode 2 seria cerimônia desproporcional — operador optou OUT, casando com F1). (2) Os 5 pontos editados em project-transitions.md: done L86, reconcile L106, phase-done L138 (step 8d), switch L234, + seção canônica L172. (3) refresh-state.js (scripts/refresh-state.js) agrega compute-rollups → reconcile-focus → emit-focus; não foi tocado (scopeBoundary). (4) **Pendente de F1:** o follow-up **FU-F1-1** (`atomic-skills:fix`) — gate `isDeterministicVerifier` (lint-source.js:275-276) admite `verifier: kind shell` sem command, mas `parseTaskVerifier` (decompose.js) materializa inválido → validate-state HARD-FALHA. Registrado em `.atomic-skills/reviews/2026-06-16-1428-skills-restructuring-f1.md`. Fora do escopo de F6.
- **Single nextAction:** Iniciar **T6.2** — `src/install.js` instala `.atomic-skills/status/hooks/{session-start,stop,pre-write}.sh`+`config.json` e registra SessionStart+Stop, com a reversão correspondente em `src/uninstall.js` (HARD RULE de paridade) e cobertura no round-trip test. Hoje `install.js` só wira `version-check.sh` (L220); os hooks de project-status só são instalados pelo passo interativo opcional project-setup §5 — esse é o gap. Verifier de T6.2: `node --test tests/install-uninstall-roundtrip.test.js` (kind test).
- **Verbatim state:** T6.1 verifier (PASS exit 0): `grep -q 'refresh-state' skills/shared/project-assets/project-transitions.md && npm run validate-skills` → `✓ All 15 skills valid (schema_version 0.2)`. F6-G1 exit gate (ainda FAIL até T6.2): `grep -q 'refresh-state' skills/shared/project-assets/project-transitions.md && node --test tests/install-uninstall-roundtrip.test.js && npm run validate-skills`. Round-trip test atual: `node --test tests/install-uninstall-roundtrip.test.js` → 4/4 pass (baseline ANTES do wiring — T6.2 deve adicionar o wiring mantendo verde). **8 falhas pré-existentes de `npm test`** (`countSkills`/`installSkills`) seguem delegadas à branch de finalização — NÃO tratar em F6 (F6-G1 desacoplado de `npm test` de propósito). CLAUDE.md "Install/Uninstall parity (HARD RULE)" + "install.js ↔ uninstall.js map" governam T6.2.
- **Uncommitted changes:** T6.1 ainda NÃO commitada. `git status --porcelain`:
  ` M .atomic-skills/focus.json`
  ` M .atomic-skills/projects/atomic-skills/skills-restructuring/phases/f6-focus-json-auto-refresh.md`
  ` M skills/shared/project-assets/project-transitions.md`

## Links

_(plan doc, external refs)_
