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
status: active
branch: plan/worktree-lifecycle-finalization
started: 2026-06-17T18:52:47Z
lastUpdated: 2026-06-17T20:12:00Z
nextAction: "T-001 + T-002 DONE (2/3). Próximo: Start T-003 (Mode 1 inline) —
  wire archive em skills/shared/project-assets/project-transitions.md para
  resolver {integrationRef, baseRef} via resolveBaseRef, ler o pr-url do
  references[] do plano, e chamar isTeardownSafe({ branch, baseRef,
  integrationRef, prIdentity }). Verifier: grep 'prIdentity' && grep
  'integrationRef' em project-transitions.md && npm run validate-skills. Depois:
  phase-done F4 (exit-gates G-1/G-2 + review-code --mode=both + lessons)."
parentPlan: worktree-lifecycle-finalization
phaseId: F4
tasksDone: 2
tasksTotal: 3
gatesMet: 0
gatesTotal: 2
exitGates:
  - id: G-1
    description: "Gate determinístico: detecção genérica de comandos, ativa só com
      ≥2 WTs, conflito textual é 1º gate, projeto sem comando é skip registrado
      (não passe silencioso); suite verde."
    status: pending
    verifier:
      kind: test
      runner: node
      pattern: tests/cross-wt-gate.test.js
    verifierLabel: "test: node tests/cross-wt-gate.test.js"
  - id: G-2
    description: Workflow advisory (agentes A/B read-only ao diff, nunca gateiam,
      fallback portátil) documentado no finalize; skills válidos.
    status: pending
    verifier:
      kind: shell
      command: grep -qi 'cross-wt-collision'
        skills/shared/project-assets/project-finalize.md && grep -qi 'advisory'
        skills/shared/project-assets/project-finalize.md && npm run
        validate-skills
    verifierLabel: "shell: grep -qi 'cross-wt-collision' skills/shared/project-assets/…"
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
    status: pending
    lastUpdated: 2026-06-17T19:35:52Z
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
current: true
---

# Narrative / notes

Initiative for phase **F4 — Check de colisão cross-WT no finalize (Decisão 7)**.

## Session handoff
- **Narrative:** **F4 ATIVA**, `implement` em curso. **T-001 + T-002 DONE** (2/3; gates 0/2 — resolvem no phase-done). T-001 (gate determinístico `scripts/cross-wt-gate.js` + teste) em **Mode 2/Codex**, merged FF `5e1328d`, re-verificado MERGED 16/16. T-002 (Step 1.5 cross-WT advisory em `project-finalize.md`) em **Mode 1 inline**: âncora `cross-wt-collision` + agentes A/B read-only ao diff + fallback portátil; verifier shell exit 0 (`All 15 skills valid`). Falta só **T-003**.
- **Decision log:** (1) T-001 → Mode 2 (operador); auto-report `-o` do Codex "tests 1" DESCARTADO — real 16 (wlf-f0-nascimento L-001 RECONFIRMADA). (2) T-002/T-003 → Mode 1 inline (doc auto-referencial). (3) T-002: o gate determinístico (T-001) é documentado como A PROVA; os agentes LLM são advisory/read-only e NUNCA gateiam (self-check≠self-certify). Ripple sites (wlf-f0 L-001) atualizados: "What finalize does" + "Scope".
- **Single nextAction:** Start **T-003** (Mode 1 inline) em `skills/shared/project-assets/project-transitions.md` (fluxo `archive`): resolver `{integrationRef, baseRef}` via `resolveBaseRef`, ler o `pr-url` do `references[]` do plano, e chamar `isTeardownSafe({ branch, baseRef, integrationRef, prIdentity })` (fecha o handoff produtor finalize→consumidor teardown — wlf-f3 L-003). NÃO mudar o contrato de `isTeardownSafe`; NÃO auto-remover worktrees.
- **Verbatim state:** T-003 verifier verbatim: `grep -q 'prIdentity' skills/shared/project-assets/project-transitions.md && grep -q 'integrationRef' skills/shared/project-assets/project-transitions.md && npm run validate-skills`. Commits desta sessão: `5e1328d` (T-001 source), `13d35a1` (chore done T-001), próximo: chore done T-002. **Follow-ups herdados:** install/detect suite RED pré-existente (base 4fbfb12); PROJECT-STATUS.md stale.
- **Uncommitted changes:** após o commit `chore(project): done F4/T-002` → árvore LIMPA.

## Decisions

_(record decisions here as they are made)_

## Links

_(plan doc, external refs)_
