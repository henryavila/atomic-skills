---
schemaVersion: "0.1"
slug: skills-restructuring-f6-focus-json-auto-refresh
title: focus.json não drifta silenciosamente
goal: garantir que o focus.json (digest da statusline) reflita o estado sem
  depender de um passo de setup interativo opcional — fechar o gap em que
  `atomic-skills install` sozinho deixa o digest stale.
status: done
branch: null
started: 2026-06-16T14:10:57Z
lastUpdated: 2026-06-16T16:50:35Z
nextAction: null
parentPlan: skills-restructuring
phaseId: F6
tasksDone: 2
tasksTotal: 2
gatesMet: 1
gatesTotal: 1
exitGates:
  - id: F6-G1
    description: O fluxo de transição regenera o focus.json e os verifiers de
      T6.1+T6.2 passam (desacoplado das 8 falhas de contagem delegadas).
    status: met
    metAt: 2026-06-16T16:29:42Z
    verifier:
      kind: shell
      command: grep -q 'refresh-state'
        skills/shared/project-assets/project-transitions.md && node --test
        tests/install-uninstall-roundtrip.test.js && npm run validate-skills
      expectExitCode: 0
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-16T16:50:35Z
      passed: true
      exitCode: 0
      outputSummary: grep refresh-state (project-transitions.md) OK; node --test
        tests/install-uninstall-roundtrip.test.js → tests 8, pass 8, fail 0
        (após os 3 fixes do review gate); validate-skills → '✓ All 15 skills
        valid (schema_version 0.2)'; exit 0.
    verifierLabel: "shell: grep -q 'refresh-state' skills/shared/project-assets/projec…"
    evidenceSummary: passed · 2026-06-16
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
    status: done
    closedAt: 2026-06-16T16:07:15Z
    lastUpdated: 2026-06-16T16:07:15Z
    summary: atomic-skills install instala+registra session-start/stop hooks;
      uninstall reverte
    evidence:
      verifierKind: test
      verifiedAt: 2026-06-16T16:07:15Z
      passed: true
      exitCode: 0
      testsCollected: 5
      outputSummary: "node --test tests/install-uninstall-roundtrip.test.js → tests 5,
        pass 5, fail 0. Novo teste positivo (hooks staged em
        .atomic-skills/status/hooks/ + SessionStart/Stop em settings.local.json,
        revertidos no uninstall) PASS; o teste #4 baseline-restoration (guard da
        HARD RULE de paridade) continua verde. installProjectStatusHooks +
        removeProjectStatusHooks + settingsLocalCreated no manifest. Baseline
        com git stash: 5 falhas pré-existentes de installSkills idênticas
        com/sem a mudança → 0 líquidas. validate-skills: 15 skills válidas."
      mutation:
        target: src/install.js:installProjectStatusHooks (staging dos hooks)
        change: implementação ausente (estado pré-T6.2)
        killedBy:
          - project scope installs + registers the project-status hooks, and
            uninstall reverts them
        killTranscript: "RED antes da impl: ✖ 'project-status hook staged:
          session-start.sh' (actual false) → impl → GREEN 5/5."
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
---

# Narrative / notes

Initiative for phase **F6 — focus.json não drifta silenciosamente**.

Fase emergente (rung 6, ratify-gated) surgida na sessão 2026-06-16 ao investigar por que o `focus.json` estava stale: o auto-refresh depende do passo interativo opcional `project-setup §5`, então `atomic-skills install` sozinho deixa o digest drifting. Os hooks foram conectados manualmente nesta sessão (commit que instala `.atomic-skills/status/hooks/` + `settings.local.json`); esta fase torna o fix estrutural — portável (T6.1) e instalável (T6.2). Provenance + context vivem no descriptor `plan.phases[F6]`.

## Decisions

- **F6-G1 desacoplado de `npm test`.** O bloco ratificado usava `npm test`, mas as 8 falhas de contagem (`countSkills`/`installSkills`) estão delegadas à branch de finalização; usar `npm test` bloquearia o phase-done de F6 aqui. O gate usa `node --test tests/install-uninstall-roundtrip.test.js && npm run validate-skills` (cobre T6.1+T6.2 sem depender dos 8 erros alheios). Sinalizado ao usuário.

## Session handoff
- **Narrative:** F6 **2/2 tasks fechadas com PASS verificado** (Mode 1, single-threaded). T6.1: `project-transitions.md` roda `refresh-state` no recompute de done/reconcile/phase-done/switch + seção canônica nomeia o agregador (commitada `4f1fda3`). T6.2: `src/install.js` agora stageia os hooks de project-status em `.atomic-skills/status/hooks/` + registra SessionStart+Stop em `settings.local.json`, com reversão em `src/uninstall.js` (`removeProjectStatusHooks` + `settingsLocalCreated` no manifest) — round-trip test 5/5 (uncommitted). **Última task de F6 fechada → `done` flow oferece phase-done.** F1 fechada+commitada antes (`d4414fc`).
- **Decision log:** (1) Ambas tasks em **Mode 1** (operador optou OUT do Codex; T6.1 doc-edit trivial, T6.2 paridade sutil melhor no contexto que já tem o install↔uninstall map). (2) T6.2 settled: convenção `settings.local.json` (não settings.json), **project-scope only** (hooks rodam sobre `.atomic-skills/` de um projeto), comando `"$CLAUDE_PROJECT_DIR/.atomic-skills/status/hooks/<script>.sh"` (espelha o que F1 registrou neste repo). PreToolUse/pre-write staged mas NÃO registrado (enforcement é do project-setup). config.json copiado raw (REPLACE_DATE inerte até enforcement ativar). (3) **Paridade provada:** baseline com `git stash` → 5 falhas `installSkills` idênticas com/sem T6.2 = **0 líquidas**; round-trip teste #4 (baseline-restoration) verde = reversão completa. (4) **Follow-up de F1 pendente:** FU-F1-1 (`atomic-skills:fix`, gate↔materialize↔schema do verifier) em `.atomic-skills/reviews/2026-06-16-1428-skills-restructuring-f1.md`. Fora de F6.
- **Single nextAction:** Rodar **phase-done F6** — verifica F6-G1 (`grep -q 'refresh-state' skills/shared/project-assets/project-transitions.md && node --test tests/install-uninstall-roundtrip.test.js && npm run validate-skills`, agora deve PASS) + o gate `review-code` sobre o diff de F6, distila lessons, avança o plano. **Usuário opta** (intrusive). Antes, commitar T6.2.
- **Verbatim state:** T6.2 verifier (PASS): `node --test tests/install-uninstall-roundtrip.test.js` → `tests 5, pass 5, fail 0`. T6.1 verifier (PASS exit 0): `grep -q 'refresh-state' skills/shared/project-assets/project-transitions.md && npm run validate-skills`. F6-G1 deve passar agora (as 3 condições verdes). **8 falhas pré-existentes** (`countSkills`/`installSkills`, red desde F5) seguem delegadas à branch de finalização; baseline com `git stash` confirmou 0 líquidas em T6.2. Range de diff de F6 para o review-code: começa no fim de F1 (`d4414fc` é o phase-done de F1) — escopo provável `d4414fc..HEAD` após commitar T6.2 (verificar que captura só T6.1+T6.2, sem poluição).
- **Uncommitted changes:** T6.2 NÃO commitada. `git status --porcelain`:
  ` M .atomic-skills/focus.json`
  ` M .atomic-skills/projects/atomic-skills/skills-restructuring/phases/f6-focus-json-auto-refresh.md`
  ` M src/install.js`
  ` M src/uninstall.js`
  ` M tests/install-uninstall-roundtrip.test.js`

## Self-review against code-quality gates (phase-done F6)

- **G1 read-before-claim:** applied — T6.1+T6.2 fechadas com `evidence` linkada a runs reais (T6.1 shell exit 0; T6.2 test 5/5 → depois 8/8 após fixes); F6-G1 met por run real (exit 0, 8/8, 15 skills).
- **G2 soft-language:** `nextAction` agora `null`; descrições e evidências afirmam fatos (PASS/exit 0/8 pass), sem should/probably.
- **G6 reference-or-strike:** F6-G1 met com `evidence` populado; review-code citou file:line verbatim (install.js:479, uninstall.js:123, project-transitions.md:235-240).
- **Codex review:** SKIPPED at phase-done — review em `--mode=local` (DESTRUCTIVE=false; diff aditivo 247/27). Override explícito registrado.
- **Review gate (G2):** `reviewGate: { status: passed, at: 3a4faf2, mode: local, reviewFile: .atomic-skills/reviews/2026-06-16-1650-skills-restructuring-f6.md }` no descriptor (GATE-R3). 4 findings reais achados E corrigidos in-phase (1 major ex-critical + 1 major + 2 minor), TDD RED→GREEN; o fix sticky-flag também fechou o resíduo idêntico no precedente auto-update.
- **Lessons (G1):** 1 lesson destilada (L-F6-1, reusable/open) em `lessons/skills-restructuring-f6-focus-json-auto-refresh.md`, ratificada — invariante de round-trip deve testar o re-apply path + simetria de escopo install↔reversal.

## Links

_(plan doc, external refs)_
