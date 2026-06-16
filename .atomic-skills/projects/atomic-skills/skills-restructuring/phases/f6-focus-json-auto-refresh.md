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
nextAction: "Start T6.1: fluxo de transição usa refresh-state (regenera o
  focus.json a cada mutação)"
parentPlan: skills-restructuring
phaseId: F6
tasksDone: 0
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
    status: pending
    lastUpdated: 2026-06-16T14:10:57Z
    summary: done/phase-done/reconcile/switch usam refresh-state, não só compute-rollups
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
- **Narrative:** F1 fechada via `phase-done` nesta sessão (5/5 tasks done, F1-G1 met com evidência, `reviewGate: passed` no descriptor). `currentPhase` avançou F1→**F6** (decisão acordada: F6 independente vem antes de F2). F6 acabou de ser ativada; nenhuma das suas 2 tasks (T6.1, T6.2) foi iniciada como task formal. Estado do tree validado (`validate-state` 3/3 ✓), digest `skills-restructuring · F6`.
- **Decision log:** (1) Review gate de F1 rodado em `--mode=local` sobre `2d6b618..390d447` (o commit de F1, NÃO o range determinístico poluído de ~40 commits — o `started` de F1 coincide com a criação do plano). (2) Review achou 1 major real (FU-F1-1): `isDeterministicVerifier` (lint-source.js:275-276) admite `verifier: kind shell` sem command, mas `parseTaskVerifier` (decompose.js:362 etc.) materializa `{kind:shell}` schema-inválido → `validate-state` HARD-FALHA. **Deferido a uma task de `fix` dedicada** (toca lint-source.js, fora do diff de F1); não bloqueia F1. (3) Fases done deste plano ficam em `phases/` com `status: done` (precedente F0/F5), NÃO movidas para `phases/archive/`. (4) **Atenção ao iniciar F6:** os hooks de project-status (`session-start.sh`/`stop.sh`/`pre-write.sh`) já foram commitados nesta sessão (parte do objetivo de F6 já landou de fato); ao dirigir F6, reconciliar estado-vs-realidade — T6.1/T6.2 podem estar parcialmente prontas no código mesmo com status `pending`.
- **Single nextAction:** Iniciar **T6.1** (`skills/shared/project-assets/project-transitions.md` usa `refresh-state` no passo de recompute de done/reconcile/phase-done/switch). Antes de codar, verificar se o `refresh-state` já está referenciado lá (o verifier de T6.1 é `grep -q 'refresh-state' skills/shared/project-assets/project-transitions.md && npm run validate-skills`) — pode já estar parcialmente satisfeito.
- **Verbatim state:** F1-G1 verifier (PASS exit 0): `test $(wc -c < skills/core/project.md) -lt 22000 && test $(wc -c < skills/core/implement.md) -lt 22000 && grep -q 'mode2-codex-lane' skills/core/implement.md && grep -q 'verifier-exec' skills/shared/project-assets/project-transitions.md && npm run validate-skills`. Review file: `.atomic-skills/reviews/2026-06-16-1428-skills-restructuring-f1.md`. Lesson: `lessons/skills-restructuring-f1-economia-de-tokens-project-e-implement.md` (L-F1-1, reusable/open). `node scripts/validate-state.js <plan> <f1> <f6>` → `All 3 file(s) valid`. F6-G1 verifier: `grep -q 'refresh-state' skills/shared/project-assets/project-transitions.md && node --test tests/install-uninstall-roundtrip.test.js && npm run validate-skills`. **8 falhas pré-existentes de `npm test`** (`countSkills`/`installSkills`) seguem delegadas à branch de finalização — NÃO tratar em F6 (F6-G1 desacoplado de `npm test` de propósito).
- **Uncommitted changes:** o phase-done de F1 ainda NÃO foi commitado. `git status --porcelain`:
  ` M .atomic-skills/focus.json`
  ` M .atomic-skills/projects/atomic-skills/PROJECT-STATUS.md`
  ` M .atomic-skills/projects/atomic-skills/skills-restructuring/phases/f1-economia-de-tokens-project-e-implement.md`
  ` M .atomic-skills/projects/atomic-skills/skills-restructuring/phases/f6-focus-json-auto-refresh.md`
  ` M .atomic-skills/projects/atomic-skills/skills-restructuring/plan.md`
  ` M .atomic-skills/reviews/INDEX.md`
  ` M .atomic-skills/status/last-session.json`
  `?? .atomic-skills/projects/atomic-skills/skills-restructuring/lessons/skills-restructuring-f1-economia-de-tokens-project-e-implement.md`
  `?? .atomic-skills/reviews/2026-06-16-1428-skills-restructuring-f1.md`

## Links

_(plan doc, external refs)_
