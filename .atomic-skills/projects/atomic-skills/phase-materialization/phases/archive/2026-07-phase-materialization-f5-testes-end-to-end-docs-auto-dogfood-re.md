---
schemaVersion: "0.1"
slug: phase-materialization-f5-testes-end-to-end-docs-auto-dogfood-re
title: Testes end-to-end + docs + auto-dogfood/review
goal: Fechar com testes de integração do fluxo completo (new plan → lazy →
  materialize → gate → tasks → phase-done advance), atualização de docs e o
  auto-dogfood do próprio mecanismo. D9 (gate-como-hipótese) é postura declarada
  no design, não código — fica documentada, não implementada como instrumento
  (não-entregável). D10 (constituição de anti-patterns) é non-goal explícito
  (iniciativa separada).
status: done
branch: plan/phase-materialization
started: 2026-06-29T13:19:41.314Z
lastUpdated: 2026-07-01T21:05:39.338Z
nextAction: null
parentPlan: phase-materialization
phaseId: F5
tasksDone: 2
tasksTotal: 2
gatesMet: 2
gatesTotal: 2
weightDone: 3
weightTotal: 3
exitGates:
  - id: F5-G1
    description: Suíte completa verde (npm test) e fluxo e2e new plan → materialize
      → advance coberto por teste
    status: met
    verifier:
      kind: shell
      command: npm test
      expectExitCode: 0
    metAt: 2026-07-01T20:51:49.000Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-01T20:51:49.000Z
      passed: true
      exitCode: 0
      outputSummary: rtk npm test -> exit 0; tests 1517 / pass 1509 / fail 0 / skipped
        8; duration_ms 6633.03625.
    verifierLabel: "shell: npm test"
    evidenceSummary: passed · 2026-07-01
  - id: F5-G2
    description: Docs refletem o comportamento lazy e declaram D9 (hipótese) + D10
      (non-goal); auto-dogfood do mecanismo no próprio plano
    status: met
    verifier:
      kind: manual
      description: Revisar CLAUDE.md + docs/kb; confirmar que o verbo materialize e a
        distinção descriptor-only estão documentados e D9/D10 registrados como
        postura/non-goal
    metAt: 2026-07-01T21:05:39.338Z
    evidence:
      verifierKind: manual
      verifiedAt: 2026-07-01T21:05:39.338Z
      passed: true
      outputSummary: rtk rg confirmed CLAUDE.md and
        docs/kb/project-lazy-materialization.md document lazy materialization,
        descriptor-only/materialized distinction, materialize <phase>, D9 as
        hypothesis, and D10 as non-goal; ban-list scan returned no matches.
    verifierLabel: manual
    evidenceSummary: passed · 2026-07-01
stack:
  - id: 1
    title: Testes end-to-end + docs + auto-dogfood/review
    type: task
    openedAt: 2026-06-29T13:19:41.314Z
tasks:
  - id: T-012
    title: Teste de integração do fluxo completo (new plan → lazy → materialize →
      advance)
    description: "Adiciona um teste end-to-end em
      `tests/phase-materialization/e2e-lifecycle.test.js` que exercita o fluxo
      inteiro: `new plan` (via `decomposePlan`+`materializeDecomposition`) sobre
      um source com F0+F1+F2 produz só o initiative de F0 + descritores F1/F2;
      simula `materialize F1` (gate de businessIntent + decomposeOnePhase +
      write + detector exit 0); valida que `phases/f1-*.md` é escrito com tasks
      + businessIntent e F1 vira `active`. Cobre o caminho feliz; não testa
      eficácia anti-rubber-stamp (D9 = hipótese não-provada, contrafactual
      inobservável)."
    status: done
    lastUpdated: 2026-07-01T20:22:58.000Z
    closedAt: 2026-07-01T20:22:58.000Z
    scopeBoundary:
      - novo arquivo de teste e2e + fixtures sob
        `tests/phase-materialization/fixtures/`; NÃO alterar código prod (este
        teste consome a API estável)
    acceptance:
      - o teste e2e passa verde sobre o fluxo new plan → lazy descriptors →
        materialize F1 → initiative escrita → F1 active; falha (regression
        guard) se `materializeDecomposition` voltar a materializar todas as
        fases
      - "F4/L-001 applied: the e2e lifecycle test must validate the mutated plan
        state and guard that phase descriptors do not receive schema-invalid
        timestamp fields; timestamps belong at plan root or initiative level."
    verifier:
      kind: test
      runner: node --test
      pattern: tests/phase-materialization/e2e-lifecycle.test.js
    outputs:
      - kind: file
        path: tests/phase-materialization/e2e-lifecycle.test.js
    summary: "Teste e2e: new plan → descritores lazy → materialize F1 → initiative
      com tasks → F1 active."
    weight: 2
    evidence:
      verifierKind: test
      verifiedAt: 2026-07-01T20:22:58.000Z
      passed: true
      exitCode: 0
      testsCollected: 1
      outputSummary: rtk node --test tests/phase-materialization/e2e-lifecycle.test.js
        -> exit 0; tests 1 / pass 1 / fail 0; duration_ms 132.290292.
  - id: T-013
    title: "Docs: CLAUDE.md + kb + declaration da postura D9/D10 non-goals"
    description: "Atualiza a documentação para refletir o novo comportamento: (a)
      `skills/core/project.md` (router) já menciona o verbo `materialize`
      (F3/T-008); (b) um nota curta em `CLAUDE.md` (seção `## Rastreamento de
      iniciativas`) ou `docs/kb/` descrevendo que `new plan` agora materializa
      lazy (F0 ativa, F1..N descriptor-only até `materialize`); (c) registra a
      **postura D9** (gate-como-hipótese, instrumento Open, não-entregável) e o
      **non-goal D10** (constituição de anti-patterns = iniciativa separada) no
      plano/ docs para que não sejam esquecidos como pendências implícitas."
    status: done
    lastUpdated: 2026-07-01T20:25:20.000Z
    closedAt: 2026-07-01T20:25:20.000Z
    scopeBoundary:
      - a seção de rastreamento em CLAUDE.md + novo doc kb; NÃO alterar
        schemas/scripts/skill-assets de fluxo (apenas docs)
    acceptance:
      - CLAUDE.md descreve o comportamento lazy; o doc kb explica
        descriptor-only vs materializada + o verbo materialize + a postura D9 e
        non-goal D10; `npm run validate-skills` verde
    verifier:
      kind: shell
      command: npm run validate-skills
      expectExitCode: 0
    outputs:
      - kind: file
        path: CLAUDE.md
      - kind: file
        path: docs/kb/project-lazy-materialization.md
    summary: Docs (CLAUDE.md + kb) descrevem o lazy e registram D9 (hipótese) e D10
      (non-goal).
    weight: 1
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-01T20:25:20.000Z
      passed: true
      exitCode: 0
      outputSummary: rtk npm run validate-skills -> exit 0; node
        scripts/validate-skills.js; All 15 skills valid (schema_version 0.2).
parked: []
emerged: []
summary: Teste e2e do fluxo completo + docs que declaram a postura D9 (hipótese)
  e o non-goal D10 (constituição separada).
planTitle: Materialização lazy de fases + gate de validação de negócio
---


# Narrative / notes

Initiative for phase **F5 — Testes end-to-end + docs + auto-dogfood/review**.

## Decisions

- **Phase-start lessons gate executado para F5.** F4/L-001 Apply em T-012: o e2e lifecycle deve validar o estado mutado e guardar contra `lastUpdated` schema-invalid dentro de `phases[]`.

## Links

_(plan doc, external refs)_

## Session handoff

- **Narrative:** F5 has both tasks closed with verifier evidence. T-012 added the lifecycle e2e test; T-013 documented lazy materialization in `CLAUDE.md` and `docs/kb/project-lazy-materialization.md`.
- **Decision log:** T-012 stayed in Mode 1 because this session's main executor is already Codex and no separate cross-provider writing lane was dispatchable from the current host. T-013 kept docs-only scope: `CLAUDE.md` plus the new KB, with no schema/script/skill-flow edits.
- **Single nextAction:** Run `atomic-skills:project phase-done` for F5 after explicit user approval.
- **Verbatim state:** `rtk node --test tests/phase-materialization/*.test.js` -> `ℹ tests 46`; `ℹ pass 46`; `ℹ fail 0`; `rtk npm run validate-skills` -> `✓ All 15 skills valid (schema_version 0.2)`; `rtk rg -n "\b(should|probably|may|typically|usually|tends to|in theory|deveria|provavelmente|talvez|normalmente|geralmente)\b" CLAUDE.md docs/kb/project-lazy-materialization.md` -> exit 1 / no matches.
- **Uncommitted changes:** `.atomic-skills/analytics/completions.jsonl`; `.atomic-skills/projects/atomic-skills/phase-materialization/phases/f5-testes-end-to-end-docs-auto-dogfood-re.md`; `CLAUDE.md`; `docs/kb/project-lazy-materialization.md`; `tests/phase-materialization/e2e-lifecycle.test.js`; `tests/phase-materialization/fixtures/e2e-lifecycle-source.md`.

## Self-review against code-quality gates

- **G1 read-before-claim**: T-012 and T-013 were closed from verifier evidence; the F5 review finding cites the corrected post-transition filesystem assertion in `tests/phase-materialization/e2e-lifecycle.test.js`.
- **G2 soft-language**: scanned `nextAction`, task descriptions, and criterion descriptions in the F5 initiative state; no banned soft-language terms were introduced by the closure update.
- **G6 reference-or-strike**: 2 exit criteria, 2 met with `evidence` populated, 0 deferred, 0 unverified.
- **Codex review**: local inline fallback review at HEAD `ac484de06cf99f37444dcc990c0a9d7454ebbdd8`, verdict `passed-after-fix`, file `.atomic-skills/reviews/2026-07-01-2051-phase-materialization-f5.md`.
- **Review gate (G2)**: recorded on the phase descriptor as `reviewGate: { status: passed, at: ac484de06cf99f37444dcc990c0a9d7454ebbdd8, mode: local, reviewFile: .atomic-skills/reviews/2026-07-01-2051-phase-materialization-f5.md }`.
- **Lessons (G1)**: distilled 1 reusable lesson into `lessons/phase-materialization-f5-testes-end-to-end-docs-auto-dogfood-re.md`; ratified by the user on 2026-07-01T21:05:39.338Z.
