---
schemaVersion: "0.1"
slug: worktree-lifecycle-finalization-f4-check-de-colisao-cross-wt-no
title: Check de colisão cross-WT no finalize (Decisão 7)
goal: "adicionar ao finalize uma detecção de colisão entre ≥2 worktrees vivas,
  GENÉRICA (qualquer projeto-alvo): um gate determinístico (detecção dos
  comandos build/test do projeto-alvo + merge especulativo + exit code) como
  token de entrada, e um workflow advisory de agentes LLM read-only (Agente A
  semântico-comportamental + Agente B recurso/contrato) escopados ao diff, que
  nunca gateiam."
status: done
branch: plan/worktree-lifecycle-finalization
started: 2026-06-17T18:52:47Z
lastUpdated: 2026-06-17T20:30:00Z
nextAction: null
parentPlan: worktree-lifecycle-finalization
phaseId: F4
tasksDone: 3
tasksTotal: 3
gatesMet: 2
gatesTotal: 2
weightDone: 3
weightTotal: 3
exitGates:
  - id: G-1
    description: "Gate determinístico: detecção genérica de comandos, ativa só com
      ≥2 WTs, conflito textual é 1º gate, projeto sem comando é skip registrado
      (não passe silencioso); suite verde."
    status: met
    metAt: 2026-06-17T20:30:00Z
    verifier:
      kind: test
      runner: node
      pattern: tests/cross-wt-gate.test.js
    evidence:
      verifierKind: test
      verifiedAt: 2026-06-17T20:30:00Z
      exitCode: 0
      testsCollected: 22
      passed: true
      outputSummary: "node --test tests/cross-wt-gate.test.js @ cf07d12 (post
        review-gate fixes, merged primary): tests 22, pass 22, fail 0, exit 0.
        Inclui fail-closed (merge-indeterminate / runner-malformed-result) +
        never-throws (crossWtGate(null)) + OR-guard halves isoladas."
    verifierLabel: "test: node tests/cross-wt-gate.test.js"
    evidenceSummary: passed · 22 tests · 2026-06-17
  - id: G-2
    description: Workflow advisory (agentes A/B read-only ao diff, nunca gateiam,
      fallback portátil) documentado no finalize; skills válidos.
    status: met
    metAt: 2026-06-17T20:30:00Z
    verifier:
      kind: shell
      command: grep -qi 'cross-wt-collision'
        skills/shared/project-assets/project-finalize.md && grep -qi 'advisory'
        skills/shared/project-assets/project-finalize.md && npm run
        validate-skills
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-17T20:30:00Z
      exitCode: 0
      passed: true
      outputSummary: "Full chain exit 0 @ cf07d12: grep -qi 'cross-wt-collision' (2)
        && grep -qi 'advisory' (7) em project-finalize.md && npm run
        validate-skills → All 15 skills valid. Step 1.5 documenta o gate
        determinístico (a prova) + agentes advisory A/B."
    verifierLabel: "shell: grep -qi 'cross-wt-collision' skills/shared/project-assets/…"
    evidenceSummary: passed · 2026-06-17
stack:
  - id: 1
    title: Check de colisão cross-WT no finalize (Decisão 7)
    type: task
    openedAt: 2026-06-16T22:50:35.627Z
tasks:
  - id: T-001
    title: "Gate determinístico: detecção genérica de build/test + merge especulativo"
    status: done
    closedAt: 2026-06-17T20:05:00Z
    lastUpdated: 2026-06-17T20:05:00Z
    summary: "Gate determinístico: detecta build/test do projeto-alvo e faz merge
      especulativo."
    outputs:
      - kind: file
        path: scripts/cross-wt-gate.js
      - kind: test
        path: tests/cross-wt-gate.test.js
    scopeBoundary:
      - dispara só com ≥2 worktrees vivas (feature solo não tem com o que
        colidir)
      - detecção dos comandos NUNCA hardcoded à stack deste repo (deriva de
        package.json scripts / Makefile / pyproject / config de CI)
      - um conflito textual no merge especulativo é o PRIMEIRO gate (exit≠0)
      - projeto sem comando build/test detectável não dá "passou" silencioso — é
        skip REGISTRADO (WARN) ou bloqueio.
    acceptance:
      - "`detectProjectCommands` descobre build/typecheck/test/lint a partir de
        fontes genéricas (package.json scripts, Makefile, pyproject) sem
        hardcode da stack"
      - "`cross-wt-gate` só ativa com ≥2 worktrees vivas e retorna no-op com <2"
      - um merge especulativo que conflita textualmente retorna exit≠0 ANTES de
        tentar o build (primeiro gate)
      - um projeto sem comando detectável retorna um desfecho `skip` REGISTRADO
        com WARN, nunca um passe silencioso
      - a função é pura sobre inputs injetados (não executa git/build real no
        teste).
    verifier:
      kind: test
      runner: node
      pattern: tests/cross-wt-gate.test.js
    evidence:
      verifierKind: test
      verifiedAt: 2026-06-17T20:05:00Z
      exitCode: 0
      testsCollected: 16
      passed: true
      outputSummary: "node --test tests/cross-wt-gate.test.js @ 5e1328d (merged
        primary): tests 16, pass 16, fail 0, exit 0. Mode 2 (Codex) exec em
        impl/wlf-t-001; re-verificado na primária MERGED (auto-report -o do
        Codex 'tests 1' DESCARTADO per wlf-f0-nascimento L-001 — contagem real
        16)."
  - id: T-002
    title: Workflow advisory de agentes read-only escopados ao diff
    status: done
    closedAt: 2026-06-17T20:12:00Z
    lastUpdated: 2026-06-17T20:12:00Z
    summary: Workflow advisory de agentes A/B read-only escopados ao diff (nunca
      gateiam).
    outputs:
      - kind: file
        path: skills/shared/project-assets/project-finalize.md
    scopeBoundary:
      - "os agentes são ADVISORY (nunca o gate — o gate é o piso determinístico
        de T-001) e READ-ONLY (Iron Law: leitura paraleliza, merge/código
        serial)"
      - escopados ao footprint dos diffs + vizinhança imediata (leem o diff, não
        a árvore inteira)
      - fallback PORTÁVEL (agentes sequenciais ou skip registrado) onde a tool
        de workflow não existe
      - NÃO auto-resolver colisão (sinaliza/roteia para humano).
    acceptance:
      - "`project-finalize.md` documenta o Agente A (interferência
        comportamental/semântica) e o Agente B (colisão de
        recurso-compartilhado/contrato), ambos read-only e escopados ao diff,
        disparados só com ≥2 worktrees vivas, operator-prompted"
      - documenta que os agentes self-check mas NUNCA self-certify (o gate
        determinístico é a prova) e o fallback portátil
      - com a âncora `cross-wt-collision`
      - "`npm run validate-skills` passa."
    verifier:
      kind: shell
      command: grep -qi 'cross-wt-collision'
        skills/shared/project-assets/project-finalize.md && grep -qi 'advisory'
        skills/shared/project-assets/project-finalize.md && npm run
        validate-skills
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-17T20:12:00Z
      exitCode: 0
      passed: true
      outputSummary: "Full chain exit 0: grep -qi 'cross-wt-collision' (2 hits) &&
        grep -qi 'advisory' (7 hits) em project-finalize.md && npm run
        validate-skills → ✓ All 15 skills valid (schema_version 0.2). Step 1.5
        documenta gate determinístico (scripts/cross-wt-gate.js, a prova) +
        agentes advisory A/B read-only escopados ao diff, ≥2 WTs,
        operator-prompted, self-check≠self-certify, fallback portátil."
  - id: T-003
    title: Wire archive teardown to read the recorded PR identity
    status: done
    closedAt: 2026-06-17T20:18:00Z
    lastUpdated: 2026-06-17T20:18:00Z
    summary: archive passa integrationRef+prIdentity (do pr-url gravado) ao
      isTeardownSafe, fechando o handoff finalize→teardown.
    outputs:
      - kind: file
        path: skills/shared/project-assets/project-transitions.md
    scopeBoundary:
      - só o wiring da chamada isTeardownSafe no fluxo archive (lê o pr-url do
        references[] do plano + resolveBaseRef para {integrationRef, baseRef})
      - NÃO mudar o contrato de isTeardownSafe (scripts/worktree-teardown.js)
      - NÃO auto-remover worktrees — a guarda segue operator-prompted, fail-safe
        BLOQUEIA na dúvida
    acceptance:
      - "`project-transitions.md` archive resolve `{integrationRef, baseRef}`
        via `resolveBaseRef`, lê o `pr-url` do `references[]` do plano, e chama
        `isTeardownSafe({ branch, baseRef, integrationRef, prIdentity })`"
      - documenta que `indeterminate-base`/`pr-identity-missing` não disparam
        mais para um plano mergeado cujo pr-url está gravado
      - "`npm run validate-skills` passa."
    verifier:
      kind: shell
      command: grep -q 'prIdentity'
        skills/shared/project-assets/project-transitions.md && grep -q
        'integrationRef' skills/shared/project-assets/project-transitions.md &&
        npm run validate-skills
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-17T20:18:00Z
      exitCode: 0
      passed: true
      outputSummary: "Full chain exit 0: grep -q 'prIdentity' (2 hits) && grep -q
        'integrationRef' (2 hits) em project-transitions.md && npm run
        validate-skills → ✓ All 15 skills valid. archive Step 5 agora resolve
        {integrationRef, baseRef} via resolveBaseRef, lê o pr-url do
        references[] como prIdentity, e chama isTeardownSafe({ branch, baseRef,
        integrationRef, prIdentity }); contrato de isTeardownSafe intocado; doc
        nota que indeterminate-base/pr-identity-missing não disparam mais para
        plano mergeado com pr-url gravado (wlf-f3 L-003 fechada)."
    provenance:
      surfacedAt: 2026-06-17T19:35:52Z
      surfacedDuring: F3
      surfacedBy: ai
      originalPhaseId: F3
    context:
      solves: "Fecha o handoff produtor(finalize)→consumidor(teardown): o finalize
        grava o pr-url, mas o archive chama isTeardownSafe({branch, baseRef})
        sem integrationRef/prIdentity, retornando indeterminate-base e nunca
        lendo a identidade — todo plano mergeado bloqueia o teardown."
      trigger: Review de phase-done F3 (local L#1 + Codex blind F-003, concordantes
        cross-model); o informed dropou o finding por transitions.md estar fora
        do escopo da T-001, mas o gap subjacente é real.
      assumesStillValid:
        - O contrato isTeardownSafe({branch, baseRef, integrationRef,
          prIdentity}) de F2 (scripts/worktree-teardown.js) permanece o ponto de
          entrada da remoção.
        - A gravação do pr-url no references[] do plano por F3 (finalize.md Step
          4) permanece a fonte da identidade do PR.
      ratifiedAt: 2026-06-17T19:35:52Z
      ratifiedBy: human
      lastReviewedAt: 2026-06-17T19:35:52Z
parked: []
emerged: []
summary: "No finalize, detecta colisão entre worktrees: gate build/test +
  agentes advisory ao diff."
planTitle: Finalização do ciclo de vida da worktree-do-plano
planActive: true
current: false
---

# Narrative / notes

Initiative for phase **F4 — Check de colisão cross-WT no finalize (Decisão 7)**.

## Session handoff
- **Narrative:** **F4 — TODAS as 3 tasks DONE** (3/3); **gates 0/2 ainda pending** (resolvem no `phase-done`). PHASE BOUNDARY atingido. T-001 (gate determinístico `scripts/cross-wt-gate.js` + teste) em **Mode 2/Codex**, merged FF `5e1328d`, re-verificado MERGED 16/16. T-002 (Step 1.5 cross-WT advisory em `project-finalize.md`) + T-003 (wiring archive→`isTeardownSafe({branch,baseRef,integrationRef,prIdentity})` em `project-transitions.md`) em **Mode 1 inline**, verifiers shell exit 0.
- **Decision log:** (1) T-001 → Mode 2 (operador); auto-report `-o` do Codex "tests 1" DESCARTADO — real 16 (wlf-f0-nascimento L-001 RECONFIRMADA). (2) T-002/T-003 → Mode 1 inline (doc auto-referencial). (3) T-003 fecha o handoff produtor(finalize)→consumidor(teardown) que a wlf-f3 L-003 surfaceou: o `archive` agora lê o `pr-url` gravado e passa `integrationRef`+`prIdentity`, então plano mergeado não bloqueia mais em `indeterminate-base`. (4) `phase-done` é operator-prompted — NÃO auto-rodado.
- **Single nextAction:** **(operator-prompted)** Rodar `phase-done F4`: executa exit-gates G-1 (`node --test tests/cross-wt-gate.test.js`) + G-2 (`grep cross-wt-collision + advisory + validate-skills`), o `review-code --mode=both` no diff da fase, distila lessons (ratify-gate), grava `phases[F4].reviewGate` no `plan.md` (GATE-R3) e avança `currentPhase` F4→F5.
- **Verbatim state:** Commits desta sessão: `5e1328d` (T-001 source, feat), `13d35a1` (chore done T-001), `234b47c` (chore done T-002), próximo: chore done T-003. Exit-gate verifiers F4: G-1 `node --test tests/cross-wt-gate.test.js` (passou 16/16 como verifier da T-001); G-2 `grep -qi 'cross-wt-collision' skills/shared/project-assets/project-finalize.md && grep -qi 'advisory' … && npm run validate-skills` (passou na T-002). **Follow-ups herdados:** install/detect suite RED pré-existente (base 4fbfb12); PROJECT-STATUS.md stale.
- **Uncommitted changes:** após o commit `chore(project): done F4/T-003` → árvore LIMPA.

## Decisions

- T-001 roteada a Mode 2 (Codex) por escolha do operador (AskUserQuestion); T-002/T-003 Mode 1 inline (doc auto-referencial). Routing per-task, não per-feature.
- Adjudicador de toda task = re-run do verifier determinístico na primária MERGED; auto-report `-o` do Codex descartado (wlf-f0-nascimento L-001 reconfirmada: disse "tests 1", real 16).

## Self-review against gates (implement, F4 — pré-`phase-done`)

- **G1 read-before-claim:** applied — cada task fechada linka a fonte/o run do verifier que a fechou (T-001 `node --test tests/cross-wt-gate.test.js` 16/16 @ 5e1328d MERGED; T-002 grep `cross-wt-collision`/`advisory` + validate-skills exit 0; T-003 grep `prIdentity`/`integrationRef` + validate-skills exit 0). Diff do Codex lido antes de alegar (não o narrative).
- **G2 soft-language:** applied — claims de conclusão são evidência `passed: true` (GATE-R2 validado em cada task), sem should/probably/works no handoff.
- **G6 reference-or-strike:** applied — literais do handoff são paths/commands/SHAs verbatim (`5e1328d`, `13d35a1`, `234b47c`, comandos de verifier completos).
- **Iron Law:** coding single-threaded; Mode 2 (T-001) com merge-back serial + re-verify na primária MERGED; worktree `impl/wlf-t-001` removida pós-merge (`git branch -d`, não-force).

## Links

- design.md Decisão 7 (gate determinístico + workflow advisory): `.atomic-skills/projects/atomic-skills/worktree-lifecycle-finalization/design.md`
- T-001 source: `scripts/cross-wt-gate.js` + `tests/cross-wt-gate.test.js` (`5e1328d`)
- T-002: `skills/shared/project-assets/project-finalize.md` (Step 1.5)
- T-003: `skills/shared/project-assets/project-transitions.md` (archive Step 5)
