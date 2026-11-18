# Automate default + operator gates (decision-review + plan-end intent)

Successor plan after archived `implementation-automate-mode`, `automate-skill-discipline`,
and `implement-phase-agents`. First real dogfood (Lekto `llm-api-integration` dump
`2026-07-24-implement-automate-session.md`) proved pure-maestro delivers product end-to-end,
but operator gates and plan-end review still fail the human contract:

1. Automate is still **opt-in**. Operator now wants **automate as the default** for `implement`.
2. **decision-review PASS** asks for approval without **showing** the decision log — blind PASS.
3. Plan-end cross-model review must **compare intended vs delivered** (plan BI / goals / tasks
   vs merged tree + state), not only a generic diff review.

This plan is **skill fidelity + UX of automate**, not product work for Lekto.

## Contraste: intenção × o que o plano prevê × o que o plano assume

### Intenção (dor a fechar)

1. Automate default sem `--mode=automate`.
2. Decision-review nunca PASS cego — pacote de decisões apresentado antes.
3. Plan-end cross-model = intent vs delivered (prometido × entregue).
4. Carimbos `passed` não mentem sobre o contrato humano.

### O que o plano prevê (F0–F3)

| Fase | Entrega |
|------|---------|
| F0 | Default `isAutomateActive` + escape Mode 1 + prosa/testes |
| F1 | Decision package + present-before-PASS + evidência machine |
| F2 | Surfaces + `intentVsDelivered` no receipt + gate finalize |
| F3 | Checklist dogfood |

**Fora da previsão:** authenticity review both por fase; Playwright pós-merge; archive join; session-break pós-fase; auto-merge.

### O que o plano assume (pode não existir)

| Pressuposto | Risco (dogfood / runtime) |
|-------------|---------------------------|
| Host executa prosa do maestro | PASS sem mostrar JSONL |
| Decision log no path canônico | statusRoot duplicado; log vazio enganoso |
| Codex/external no plan-end | timeout ausente; receipt stub/corrupt |
| State reconstrói intent/delivered | claims só no transcript; BI fraco |
| Brief extra no external-both | bridge ignora contexto |
| Operador lê o hardgate | decline → host accept |
| Session default = gates durable | stamp-only call sites (critic F-001) |
| Mode 1 escape conhecido | legados no bare Mode 1 |

**Regra:** se o pressuposto faltar, a fase fail-closed — não declarar intenção resolvida.

Ver versão expandida (colunas A/B/C + mapa) em `plan.md` §1b.

## Principles

### P1 Automate is the default implement path
`implement` without an explicit non-automate mode runs pure-maestro. Escape hatches:
`--mode=1` / `mode:1` / session-writer Mode 1, and durable clear via
`--clear-execution-mode` + stamp removal. First session may still confirm stamp for
durability; absence of CLI mode no longer means Mode 1.

### P2 Host-thin pure maestro stays
Host never edits product source under automate; code-only phase writers; never silent
Mode-1 fallback; never self-certify. Default mode does not relax Iron Law.

### P3 Read-before-PASS on decision-review
Operator cannot PASS decision-review until the host has presented the phase decision
package in the same hardgate turn (rendered summary + path to JSONL + linked evidence).
Token alone without a prior present step in that turn is invalid.

### P4 Plan-end intent-vs-delivered is mandatory under automate
Before finalize/archive, cross-model plan-end review must score intended
(spec/plan/BI/tasks) against delivered (merged tree + durable state). Generic code
review alone does not satisfy the gate.

### P5 Fail closed over looks-approved
Missing decision package present, empty decision log without explicit empty ack, or
plan-end receipt without intent-vs-delivered section blocks phase-done / finalize.

### P6 No new top-level skill
Extend implement + shared assets + pure helpers + tests. No skills/core/automate.md.

### P7 Gate activation matches session default
Any path that runs pure-maestro under automate-default feeds the same activation into
machine gates (`canRunPhaseDone`, `automatePlanEndGatesOk`) via stamp and/or
`automateActive: true` so first-session-before-stamp cannot skip present-before-PASS
or intentVsDelivered.

## Glossary

| Term | Definition |
|------|------------|
| automate-default | implement with no mode flag activates pure-maestro (unless explicit Mode 1 / clear) |
| decision package | Host-rendered view of decisions phase JSONL plus evidence links shown before PASS ask |
| read-before-PASS | Two-step hardgate: present package then operator PASS/FAIL token |
| intent surface | Desired set: plan phase goal/BI, initiative tasks + acceptance, exit criteria |
| delivered surface | Actual set: merged SHAs, claim reports / outputs paths, state tasks done |
| intent-vs-delivered review | Plan-end cross-model review whose brief forces comparison of intent vs delivered |

## F0 — Automate as default mode

Goal: Flip default so bare implement enters pure-maestro; Mode 1 is explicit; docs/tests match.

### T-001 Flip isAutomateActive and parse default

- Files: src/implement-mode.js, tests/implement-mode.test.js
- scopeBoundary: Do not remove Mode 1 path. Do not make finalize auto-merge. Durable stamp and clear-execution-mode lease HARD-GATE stay.
- acceptance: it - Absent CLI mode and no stamp yields isAutomateActive true.; it - Explicit mode 1 or mode:1 yields isAutomateActive false.; it - mode=automate and stamp-alone still true; clearExecutionMode still false.; it - Unit matrix covers no-CLI no-stamp for automate-default.
- verifier: { kind: shell, command: "node --test tests/implement-mode.test.js", expectExitCode: 0 }

### T-002 Skill prose and antipatterns for automate default

- Files: skills/core/implement.md, skills/shared/implement-automate-maestro.md, skills/shared/implement-antipatterns.md, docs/kb/project-lazy-materialization.md
- scopeBoundary: Do not delete host-thin or never self-certify laws. Do not document silent Mode-1 fallback as allowed.
- acceptance: it - Prose states automate is default and Mode 1 requires explicit flag.; it - Original opt-in only principle is marked superseded by this plan.; it - Antipattern exists for assuming bare implement is session-writer Mode 1.; it - Maestro notes gate activation rule for session default plus stamp.
- verifier: { kind: shell, command: "rg -n 'default|Mode 1|--mode=1|pure-maestro' skills/core/implement.md skills/shared/implement-automate-maestro.md && rg -n 'session-writer Mode 1|opt-in' skills/shared/implement-antipatterns.md skills/core/implement.md", expectExitCode: 0 }

<!-- decompose: non-task separator before exit_gate -->

```yaml
exit_gate:
  - id: F0-G1
    description: implement-mode unit tests green with automate-default matrix.
    verifier: { kind: shell, command: "node --test tests/implement-mode.test.js", expectExitCode: 0 }
  - id: F0-G2
    description: Skill prose states automate default and Mode-1 escape hatch.
    verifier: { kind: shell, command: "rg -n 'default|Mode 1|--mode=1' skills/core/implement.md skills/shared/implement-automate-maestro.md", expectExitCode: 0 }
```

## F1 — Decision-review read-before-PASS

Goal: Operator always sees phase decisions before PASS/FAIL. Blind PASS is impossible under automate.

### T-001 Decision package builder

- Files: src/decision-review-package.js, tests/decision-review-package.test.js, src/decision-log.js
- scopeBoundary: Do not stamp decisionReview PASS from this helper. No network I/O.
- acceptance: it - Helper builds package with phaseId path entries empty flag and summaryMarkdown from listDecisions input.; it - Each entry exposes category decision why impact evidencePath.; it - Empty log yields empty true and explicit no-decisions banner text.; it - Unit tests cover non-empty and empty packages.
- verifier: { kind: shell, command: "node --test tests/decision-review-package.test.js", expectExitCode: 0 }

### T-002 Hardgate present then PASS token

- Files: skills/shared/implement-decision-log.md, skills/shared/implement-automate-maestro.md, skills/core/implement.md, src/decision-review-gate.js, src/automate-orchestrator-gates.js, tests/decision-review-gate.test.js
- scopeBoundary: Agents still never write PASS. Do not auto-PASS on empty package.
- acceptance: it - Fixed order requires host render decision package before PASS ask.; it - decisionReview records packagePresentedAt or package present evidence under automate.; it - decisionReviewAllowsPhaseDone or canRunPhaseDone fails closed without present evidence when automate active including no-stamp session default.; it - Antipattern documents Ask PASS without listing decisions.
- verifier: { kind: shell, command: "node --test tests/decision-review-gate.test.js && rg -n 'read-before-PASS|packagePresented|decision package|present' skills/shared/implement-decision-log.md skills/shared/implement-automate-maestro.md", expectExitCode: 0 }

### T-003 Operator UX two-step AskUserQuestion

- Files: skills/shared/implement-decision-log.md, skills/shared/implement-automate-maestro.md, docs/kb/implement-phase-agents-dogfood.md
- scopeBoundary: Do not force a specific IDE widget beyond AskUserQuestion where available.
- acceptance: it - UX documents step present package then PASS or FAIL options.; it - Single-click PASS without package body in the same turn is forbidden in prose.; it - Dogfood checklist row covers decision package shown before PASS.
- verifier: { kind: shell, command: "rg -n 'read-before-PASS|decision package|PASS|FAIL' skills/shared/implement-decision-log.md docs/kb/implement-phase-agents-dogfood.md skills/shared/implement-automate-maestro.md", expectExitCode: 0 }

<!-- decompose: non-task separator before exit_gate -->

```yaml
exit_gate:
  - id: F1-G1
    description: Decision package unit tests pass.
    verifier: { kind: shell, command: "node --test tests/decision-review-package.test.js", expectExitCode: 0 }
  - id: F1-G2
    description: Maestro and decision-log prose mandate present-before-PASS.
    verifier: { kind: shell, command: "rg -n 'read-before-PASS|packagePresented|decision package' skills/shared/implement-decision-log.md skills/shared/implement-automate-maestro.md", expectExitCode: 0 }
```

## F2 — Plan-end intent-vs-delivered cross-model review

Goal: Plan-end cross-model review compares intended vs delivered with a machine-checkable receipt field.

### T-001 Intent and delivered surface collectors

- Files: src/plan-end-intent-surface.js, tests/plan-end-intent-surface.test.js
- scopeBoundary: Pure read of plan and initiative shaped objects plus optional git SHA list. No network. No finalize side effects.
- acceptance: it - Builds intent surface from phase goals businessIntent tasks acceptance and exit criteria when provided.; it - Builds delivered surface from task evidence done status claim SHAs and outputs paths when provided.; it - Exports markdown brief section Intent vs delivered checklist for the review prompt.; it - Unit tests cover multi-phase sample input.
- verifier: { kind: shell, command: "node --test tests/plan-end-intent-surface.test.js", expectExitCode: 0 }

### T-002 Plan-end brief and receipt contract

- Files: src/plan-end-review.js, skills/shared/implement-automate-maestro.md, docs/kb/cross-model-review-design.md, tests/plan-end-review.test.js
- scopeBoundary: Do not auto-merge. Skip path under durable automate stays HARD-CLOSED. Keep at least one family-different leg rule.
- acceptance: it - Under automate plan-end requires intent-vs-delivered brief in the cross-model context.; it - Receipt or linked structured section includes intentVsDelivered rows with status matched partial missing or extra.; it - Empty intentVsDelivered fails planEndReviewOk or automatePlanEndGatesOk under automate including session default.; it - Docs state plan-end answers did we build what we planned.
- verifier: { kind: shell, command: "node --test tests/plan-end-review.test.js tests/plan-end-intent-surface.test.js && rg -n 'intentVsDelivered|intent-vs-delivered' src/plan-end-review.js skills/shared/implement-automate-maestro.md", expectExitCode: 0 }

### T-003 Skill prose and finalize gate wire

- Files: skills/core/implement.md, skills/shared/implement-automate-maestro.md, scripts/assert-automate-gate.js, src/automate-orchestrator-gates.js
- scopeBoundary: userValidationOk remains operator-owned after review. Do not auto-PASS user validation.
- acceptance: it - Step I order is build surfaces run external-both stamp receipt with intentVsDelivered then userValidation then finalize.; it - assert finalize fails if intentVsDelivered missing under automate.; it - implement.md points at intent-vs-delivered plan-end rule.
- verifier: { kind: shell, command: "rg -n 'intent-vs-delivered|intentVsDelivered|Intent vs delivered' skills/shared/implement-automate-maestro.md skills/core/implement.md src/plan-end-review.js scripts/assert-automate-gate.js", expectExitCode: 0 }

<!-- decompose: non-task separator before exit_gate -->

```yaml
exit_gate:
  - id: F2-G1
    description: Intent surface and plan-end tests pass.
    verifier: { kind: shell, command: "node --test tests/plan-end-intent-surface.test.js tests/plan-end-review.test.js", expectExitCode: 0 }
  - id: F2-G2
    description: Maestro Step I requires intent-vs-delivered under automate.
    verifier: { kind: shell, command: "rg -n 'intent-vs-delivered|intentVsDelivered' skills/shared/implement-automate-maestro.md src/plan-end-review.js", expectExitCode: 0 }
```

## F3 — Dogfood checklist

Goal: Checklist so the next automate run proves the three gates without chat memory.

### T-001 Dogfood checklist update

- Files: docs/kb/implement-phase-agents-dogfood.md, docs/kb/automate-default-dogfood.md
- scopeBoundary: Checklist and KB only. No product app code.
- acceptance: it - Rows cover bare implement activates automate.; it - Rows cover Mode 1 explicit escape.; it - Rows cover decision package shown before PASS.; it - Rows cover plan-end receipt intentVsDelivered and finalize blocked without it.; it - File docs/kb/automate-default-dogfood.md or dogfood section exists with those rows.
- verifier: { kind: shell, command: "rg -n 'automate-default|read-before-PASS|intentVsDelivered|intent-vs-delivered|--mode=1' docs/kb/", expectExitCode: 0 }

<!-- decompose: non-task separator before exit_gate -->

```yaml
exit_gate:
  - id: F3-G1
    description: Dogfood checklist covers default decision package and intent-vs-delivered.
    verifier: { kind: shell, command: "rg -n 'read-before-PASS|intentVsDelivered|default' docs/kb/", expectExitCode: 0 }
```
