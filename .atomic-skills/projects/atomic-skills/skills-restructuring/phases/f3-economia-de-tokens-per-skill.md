---
schemaVersion: "0.1"
slug: skills-restructuring-f3-economia-de-tokens-per-skill
title: "Economia de tokens: per-skill"
goal: mover blocos mode-gated e branch-only de cada skill grande para assets
  lazy, carregando só o branch que roda.
status: done
branch: null
started: 2026-06-16T19:00:49Z
lastUpdated: 2026-06-16T19:46:28Z
nextAction: null
parentPlan: skills-restructuring
phaseId: F3
tasksDone: 5
tasksTotal: 5
gatesMet: 1
gatesTotal: 1
weightDone: 5
weightTotal: 5
exitGates:
  - id: F3-G1
    description: A suite de validação passa após os movimentos per-skill.
    status: met
    metAt: 2026-06-16T19:32:13Z
    verifier:
      kind: shell
      command: npm run validate-skills
      expectExitCode: 0
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-16T19:32:13Z
      exitCode: 0
      passed: true
      outputSummary: All 15 skills valid (schema_version 0.2)
    verifierLabel: "shell: npm run validate-skills"
    evidenceSummary: passed · 2026-06-16
stack:
  - id: 1
    title: "Economia de tokens: per-skill"
    type: task
    openedAt: 2026-06-15T13:37:12.477Z
tasks:
  - id: T3.1
    title: review-code — mover blocos mode-gated e diff-capture
    status: done
    closedAt: 2026-06-16T19:16:22Z
    lastUpdated: 2026-06-16T19:16:22Z
    summary: "review-code: blocos mode-gated e diff-capture para asset"
    description: "Mover os blocos local-review e codex-subflow e os branches de
      captura de diff para local-review-assets, carregados só no modo que roda.
      Arquivos: skills/core/review-code.md,
      skills/shared/local-review-assets/diff-capture.md"
    scopeBoundary:
      - não tocar o Step 0 mode-picker resident; preservar o algoritmo de shape
        do diff intacto.
    acceptance:
      - o asset de diff-capture existe
      - review-code encolhe abaixo de 20000 bytes.
    verifier:
      kind: shell
      command: test -f skills/shared/local-review-assets/diff-capture.md && test $(wc
        -c < skills/core/review-code.md) -lt 20000
      expectExitCode: 0
    outputs:
      - kind: file
        path: skills/core/review-code.md
      - kind: file
        path: skills/shared/local-review-assets/diff-capture.md
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-16T19:16:22Z
      exitCode: 0
      passed: true
      outputSummary: verifier exit 0 — diff-capture.md exists; review-code.md 14797
        bytes (< 20000)
  - id: T3.2
    title: review-plan — mover initiative-depth e closing para asset
    status: done
    closedAt: 2026-06-16T19:20:24Z
    lastUpdated: 2026-06-16T19:20:24Z
    summary: "review-plan: initiative-depth e closing para asset lazy"
    description: "Mover Step 0c initiative-discovery, checks 14-20 e o closing
      template para um asset lazy; manter o HARD-GATE de iniciativa resident.
      Arquivos: skills/core/review-plan.md,
      skills/shared/project-assets/plan-initiative-depth.md"
    scopeBoundary:
      - não tocar o HARD-GATE de iniciativa nem o Step 0 mode-picker.
    acceptance:
      - o asset de initiative-depth existe
      - review-plan encolhe abaixo de 24000 bytes.
    verifier:
      kind: shell
      command: test -f skills/shared/project-assets/plan-initiative-depth.md && test
        $(wc -c < skills/core/review-plan.md) -lt 24000
      expectExitCode: 0
    outputs:
      - kind: file
        path: skills/core/review-plan.md
      - kind: file
        path: skills/shared/project-assets/plan-initiative-depth.md
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-16T19:20:24Z
      exitCode: 0
      passed: true
      outputSummary: verifier exit 0 — plan-initiative-depth.md exists; review-plan.md
        22631 bytes (< 24000)
  - id: T3.3
    title: hunt — mover directory-triage para asset
    status: done
    closedAt: 2026-06-16T19:23:31Z
    lastUpdated: 2026-06-16T19:23:31Z
    summary: "hunt: directory-triage para asset, convention unificada"
    description: "Mover Phase 0 directory-triage e o consolidated report para
      hunt-assets, deixando ponteiro de duas linhas; unificar a
      convention-detection. Arquivos: skills/core/hunt.md,
      skills/shared/hunt-assets/directory-triage.md"
    scopeBoundary:
      - preservar a Iron Law e o escopo canônico single-file da hunt.
    acceptance:
      - o asset de directory-triage existe
      - hunt encolhe abaixo de 14000 bytes.
    verifier:
      kind: shell
      command: test -f skills/shared/hunt-assets/directory-triage.md && test $(wc -c <
        skills/core/hunt.md) -lt 14000
      expectExitCode: 0
    outputs:
      - kind: file
        path: skills/core/hunt.md
      - kind: file
        path: skills/shared/hunt-assets/directory-triage.md
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-16T19:23:31Z
      exitCode: 0
      passed: true
      outputSummary: verifier exit 0 — directory-triage.md exists; hunt.md 11476 bytes
        (< 14000)
  - id: T3.4
    title: debate — mover gate-mode e remover redundância
    status: done
    closedAt: 2026-06-16T19:25:31Z
    lastUpdated: 2026-06-16T19:25:31Z
    summary: "debate: gate-mode para asset, seções redundantes removidas"
    description: 'Mover o bloco gate-mode para debate-assets/gate-mode.md e deletar
      as seções redundantes "why this matters" e "where this fits". Arquivos:
      skills/core/debate.md, skills/shared/debate-assets/gate-mode.md'
    scopeBoundary:
      - não tocar a Iron Law spawn-don't-roleplay nem o Synthesis Handoff.
    acceptance:
      - o asset gate-mode existe
      - debate encolhe abaixo de 15000 bytes.
    verifier:
      kind: shell
      command: test -f skills/shared/debate-assets/gate-mode.md && test $(wc -c <
        skills/core/debate.md) -lt 15000
      expectExitCode: 0
    outputs:
      - kind: file
        path: skills/core/debate.md
      - kind: file
        path: skills/shared/debate-assets/gate-mode.md
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-16T19:25:31Z
      exitCode: 0
      passed: true
      outputSummary: verifier exit 0 — gate-mode.md exists; debate.md 12431 bytes (<
        15000); Why-this-matters + Where-this-fits removidas
  - id: T3.5
    title: init-memory — mover Step 5 e Critical Context para asset
    status: done
    closedAt: 2026-06-16T19:27:37Z
    lastUpdated: 2026-06-16T19:27:37Z
    summary: "init-memory: Step 5 e Critical Context para asset"
    description: "Introduzir scaffold router mais asset e mover Step 5 Connect e
      Critical Context para um asset lazy. Arquivos:
      skills/modules/memory/init-memory.md,
      skills/modules/memory/_assets/connect.md"
    scopeBoundary:
      - não tocar os passos iniciais de criação da estrutura de memória.
    acceptance:
      - o asset de connect existe
      - init-memory encolhe abaixo de 7800 bytes.
    verifier:
      kind: shell
      command: test -f skills/modules/memory/_assets/connect.md && test $(wc -c <
        skills/modules/memory/init-memory.md) -lt 7800
      expectExitCode: 0
    outputs:
      - kind: file
        path: skills/modules/memory/init-memory.md
      - kind: file
        path: skills/modules/memory/_assets/connect.md
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-16T19:27:37Z
      exitCode: 0
      passed: true
      outputSummary: verifier exit 0 — connect.md exists; init-memory.md 7108 bytes (< 7800)
parked: []
emerged: []
summary: Move blocos mode-gated de cada skill grande para assets lazy.
planTitle: Reestruturação das skills atomic-skills
---

# Narrative / notes

Initiative for phase **F3 — Economia de tokens: per-skill**.

## Decisions

- **Routing F3 = Mode 1 (Opus serial), opt-out do lane Codex.** O lane está
  `mode2Enabled: true` + `codexLane.enabled: true` (Codex seria o default), mas o
  operador escolheu Mode 1: o verifier de cada task é proxy fraco (só `asset existe`
  + `arquivo < N bytes`), não captura preservação semântica das core skills. Opus
  edita single-threaded com fidelidade; review-code de fim de fase é o check semântico.
- **T3.1 — move verbatim, não paráfrase.** A maquinaria de captura de diff
  (`## Argument & diff capture contract` + `## Destructive-diff signal`) foi movida
  por slice programático (`sed -n '38,197p'`) para garantir o algoritmo intacto
  (scopeBoundary). Step 0 mode-picker e as seções `Local review agent`/`Codex sub-flow`
  ficaram resident; as referências "(below)" continuam resolvendo.
- **Lição F2 (open, reusable) aplica a F3:** ao consolidar blocos compartilhados num
  asset parametrizado, enumerar a UNIÃO dos placeholders de todos os callers +
  templates-folha (não a interseção); grep dos templates por `{{...}}` antes de fechar.

## Session handoff

- **Narrative:** F3 (economia de tokens per-skill) com IMPLEMENTAÇÃO COMPLETA, Mode 1
  Opus serial. As 5 tasks (T3.1 review-code, T3.2 review-plan, T3.3 hunt, T3.4 debate,
  T3.5 init-memory) fechadas com `evidence.passed: true`. No phase boundary: falta
  apenas rodar `phase-done` (exit-gate F3-G1 + review-code phase-diff gate + lessons +
  advance), que o operador opta por rodar — NÃO auto-executado.
- **Decision log:** ver bloco `## Decisions` acima — Mode-1 opt-out; move verbatim via
  slice; deleção de seções redundantes (T3.4); convention-detection unificada (T3.3);
  lição F2 (UNIÃO de placeholders) aplica.
- **Single nextAction:** rodar `atomic-skills:project phase-done` para F3 (executa o
  exit-gate `npm run validate-skills`, o review-code obrigatório sobre o diff de fase
  `c895e50..HEAD`, distila lessons e avança o plano). Pré-check já verde: `npm run
  validate-skills` → "All 15 skills valid".
- **Verbatim state (verifiers, todos exit 0):**
  - T3.1: `test -f skills/shared/local-review-assets/diff-capture.md && test $(wc -c < skills/core/review-code.md) -lt 20000` → review-code.md 23905→14797; diff-capture.md 10410.
  - T3.2: `test -f skills/shared/project-assets/plan-initiative-depth.md && test $(wc -c < skills/core/review-plan.md) -lt 24000` → review-plan.md 27844→22631; plan-initiative-depth.md 7168.
  - T3.3: `test -f skills/shared/hunt-assets/directory-triage.md && test $(wc -c < skills/core/hunt.md) -lt 14000` → hunt.md 16069→11476; directory-triage.md 5723.
  - T3.4: `test -f skills/shared/debate-assets/gate-mode.md && test $(wc -c < skills/core/debate.md) -lt 15000` → debate.md 15522→12431; gate-mode.md 3040.
  - T3.5: `test -f skills/modules/memory/_assets/connect.md && test $(wc -c < skills/modules/memory/init-memory.md) -lt 7800` → init-memory.md 8597→7108; connect.md 2725.
  - Exit-gate F3-G1 (pending até phase-done): `npm run validate-skills` (pré-check: All 15 skills valid).
- **Uncommitted changes:**
  ```
   M .atomic-skills/focus.json
   M .atomic-skills/projects/atomic-skills/skills-restructuring/phases/f3-economia-de-tokens-per-skill.md
   M .atomic-skills/status/last-session.json
   M skills/core/debate.md
   M skills/core/hunt.md
   M skills/core/review-code.md
   M skills/core/review-plan.md
   M skills/modules/memory/init-memory.md
  ?? skills/modules/memory/_assets/
  ?? skills/shared/debate-assets/gate-mode.md
  ?? skills/shared/hunt-assets/
  ?? skills/shared/local-review-assets/diff-capture.md
  ?? skills/shared/project-assets/plan-initiative-depth.md
  ```
  (`.atomic-skills/focus.json` e `status/last-session.json` = ruído de tracking do hook, benigno.)

## Self-review against code-quality gates (implement)

- **G1 read-before-claim**: applied — cada task fechada cita a run do verifier (exit 0) e
  os bytes observados; os blocos movidos foram extraídos por slice verbatim (lidos antes
  de mover), não parafraseados.
- **G2 soft-language**: applied — nenhuma claim de conclusão usa should/probably/works;
  cada task é `done` com `evidence.passed: true` da run real. Handoff varrido pela ban list.
- **G6 reference-or-strike**: applied — os literais do handoff são comandos/paths/bytes
  verbatim (verifiers completos, contagens antes→depois, lista `git status --porcelain`).

## Self-review against code-quality gates (phase-done)

- **G1 read-before-claim**: 5 tasks fechadas, cada uma com `outputs[]` + `evidence`
  ligada à run real do verifier; blocos movidos extraídos por slice verbatim (lidos
  antes de mover).
- **G2 soft-language**: scaneado `nextAction` + descrições de tasks + critério do gate
  pela ban list; 0 violações.
- **G6 reference-or-strike**: 1 exit criterion (F3-G1) `met` com `evidence` populada
  (validate-skills exit 0); 0 deferred, 0 unverified.
- **Codex review**: NÃO rodado — review de fase em `--mode=local` (sealed envelope,
  clean-context agent) sobre `c895e50..1c55a32`. Sinal DESTRUCTIVE deu TRUE mas é
  falso-positivo (doc de tokens realocada); override destructive→local registrado e
  confirmado pelo operador.
- **Review gate (G2)**: `reviewGate: { status: passed, at: aa1c16c, mode: local }` no
  descriptor de F3 no plan.md. 2 findings minor (verbatim-move dangling refs), ambos
  aplicados em `aa1c16c`; 0 blocker/critical/major. Review file:
  `.atomic-skills/reviews/2026-06-16-1941-skills-restructuring-f3.md`.
- **Lessons (G1)**: distiladas 2 lições (L-001, L-002 — ambas reusable) em
  `lessons/skills-restructuring-f3-economia-de-tokens-per-skill.md`, ratificadas pelo
  operador. A fase-start de F4 dispõe as reusable+open via `list-lessons.js --phase F4`.

## Links

_(plan doc, external refs)_
