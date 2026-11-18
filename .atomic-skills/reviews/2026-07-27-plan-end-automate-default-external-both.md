# Plan-end external-both review — automate-default-and-operator-gates

- mode: external-both
- range: plan branch F0..F4
- at: 85927de02931adb5ec2acfe6a77789879dad6149
- verifiedAt: 2026-07-27T09:06:37.261Z
- host: grok (family-different legs: codex, claude)

## Intent vs delivered

## Intent vs delivered

Plan-end cross-model review answers: **did we build what we planned?**
Score each row as `matched` | `partial` | `missing` | `extra`. Generic code
diff review alone does **not** satisfy the intent-vs-delivered gate.

### Intent surface (planned)

| # | kind | phase | task | text |
|---|------|-------|------|------|
| 1 | phase-goal | F0 |  | Flip default so bare implement enters pure-maestro; Mode 1 is explicit; docs/tests match. |
| 2 | business-intent | F0 |  | Automate is the default implement path so multi-phase plans run pure-maestro without a mode flag, with Mode 1 only via explicit escape. |
| 3 | business-intent | F0 |  | TDD isAutomateActive and parse matrix first, then update implement/maestro prose and antipatterns so docs match machine default. |
| 4 | business-intent | F0 |  | Mode 1 remains via --mode=1; host-thin Iron Law unchanged; no auto-merge; durable stamp and clear path stay; session default must activate machine gates even before stamp. |
| 5 | business-intent | F0 |  | Decision package UX (F1); intent-vs-delivered plan-end (F2); dogfood checklist (F3); review stub authenticity and post-merge e2e from dump follow-ups. |
| 6 | business-intent | F0 |  | implement-mode tests green for no-CLI no-stamp true; prose states automate default and Mode-1 escape; F0-G1 and F0-G2 met. |
| 7 | exit-criteria | F0 |  | implement-mode unit tests green with automate-default matrix. |
| 8 | exit-criteria | F0 |  | Skill prose states automate default and Mode-1 escape hatch. |
| 9 | phase-goal | F1 |  | Operator always sees the decision package before PASS/FAIL; under automate every operator hardgate uses AskUserQuestion options only — free-text token recovery is forbidden; decline re-asks or STOPs. |
| 10 | business-intent | F1 |  | Package present-before-PASS + canal AskUserQuestion-only (sem free-text) para hardgates de operador sob automate. |
| 11 | business-intent | F1 |  | TDD package builder → gate machine present evidence → prosa/antipatterns AskUserQuestion-only + decline re-Ask → matriz continue/ratify/disposition/stamp; greps F1-G*. |
| 12 | business-intent | F1 |  | Agents never write PASS; present package body no mesmo turno do AskUserQuestion PASS\|FAIL; decline re-Ask (bounded) ou STOP (nunca free-text); session default + stamp alimentam gates; host-thin Iron Law intact. |
| 13 | business-intent | F1 |  | F2 intent-vs-delivered; F3 dogfood checklist full; F4 authenticity floors; Lekto product; forçar widget fora de AskUserQuestion. |
| 14 | business-intent | F1 |  | tests package green; present-before-PASS machine; AskUserQuestion-only + free-text ban greppable; F1-G1/G2/G3 met. |
| 15 | exit-criteria | F1 |  | Decision package unit tests pass. |
| 16 | exit-criteria | F1 |  | Present-before-PASS + package evidence mandated in prose/gates. |
| 17 | exit-criteria | F1 |  | AskUserQuestion-only + free-text ban + decline path greppable. |
| 18 | phase-goal | F2 |  | Plan-end cross-model review compares intended vs delivered with a machine-checkable receipt field. |
| 19 | business-intent | F2 |  | Plan-end sob automate responde "entregamos o que o plano prometeu?" via intent-vs-delivered machine-checkable no receipt. |
| 20 | business-intent | F2 |  | TDD collectors intent/delivered → brief + receipt intentVsDelivered + wire planEndReviewOk/assert finalize → prosa Step I. |
| 21 | business-intent | F2 |  | Fail-closed se intentVsDelivered vazio sob automate (session default ou stamp); external-both mantém ≥1 leg family-different; skip plan-end HARD-CLOSED sob stamp; userValidationOk continua operator-owned; sem auto-merge. |
| 22 | business-intent | F2 |  | F3 dogfood checklist; F4 authenticity dual-leg floors; Playwright pós-merge; Lekto product; auto-PASS user validation. |
| 23 | business-intent | F2 |  | tests intent-surface + plan-end green; receipt exige intentVsDelivered; assert finalize falha se ausente; F2-G1/G2 met. |
| 24 | exit-criteria | F2 |  | Intent surface and plan-end tests pass. |
| 25 | exit-criteria | F2 |  | Maestro Step I requires intent-vs-delivered under automate. |
| 26 | phase-goal | F3 |  | Checklist so the next automate run proves the three gates without chat memory. |
| 27 | business-intent | F3 |  | Operador tem checklist durable que prova F0 default + F1 present-before-PASS + F2 intentVsDelivered sem memória de chat. |
| 28 | business-intent | F3 |  | Escrever/atualizar docs/kb checklist rows + greps; zero product code. |
| 29 | business-intent | F3 |  | Só KB/checklist; sem app code; alinhar a F0–F2 já shipped. |
| 30 | business-intent | F3 |  | F4 authenticity; product Lekto; reimplementar gates F0–F2. |
| 31 | business-intent | F3 |  | F3-G1 rg green; file(s) com as rows listadas. |
| 32 | exit-criteria | F3 |  | Dogfood checklist covers default decision package and intent-vs-delivered. |
| 33 | phase-goal | F4 |  | Fail-closed authenticity for phase review dual-leg and evaluation floors; major disposition tokens; decision-log statusRoot normalize; phase-done mirror/assert path (no host hand-edit). |
| 34 | business-intent | F4 |  | Fases sob automate não podem carimbar reviewGate/evaluationGate passed com receipt stub ou disposition major sem token do operador; phase-done não deixa archive com exitGates mentindo; decision-log não aceita statusRoot que duplica projects/. |
| 35 | business-intent | F4 |  | TDD: authenticity floor em phase-review-gate (dual path, min size, non-binary); evaluation content floor; disposition major exige token operator (decline != accept); decisionLogPath normaliza statusRoot; assert mirror exitGates + validate-state no dir do plan e antipattern hand-edit phase-done; prosa maestro/transitions; testes unitários e greps de prosa. |
| 36 | business-intent | F4 |  | Floor médio (não parser full codex). Não auto-merge. Não reabrir F0–F3. Fora: post-merge Playwright, session-break, phase-done-apply script completo, Layer 4. Host-thin permanece. |
| 37 | business-intent | F4 |  | Post-merge e2e re-run (Cluster B); claims durable path; session-break AskUserQuestion; phase-done-apply atômico completo; forçar 2 external providers; backlog produto Lekto; auto-PASS decision-review. |
| 38 | business-intent | F4 |  | phase-done sob automate falha com stub/corrupt dual-leg; evaluation thin sem floor falha; major sem disposition token bloqueia; statusRoot double-projects rejeitado; mirror exitGates assert + prosa canônica; F4-G* met. |
| 39 | exit-criteria | F4 |  | phase-review authenticity tests pass (dual leg, min size, non-binary reject stub/corrupt). |
| 40 | exit-criteria | F4 |  | decision-log statusRoot normalize tests pass; double projects path rejected or fixed. |
| 41 | exit-criteria | F4 |  | Prose requires present dual-leg authenticity, disposition token, canonical phase-done (no hand-edit). |
| 42 | exit-criteria | F4 |  | assert or unit tests cover exitGate mirror / terminal pending block under automate close. |
| 43 | business-intent | F0 |  | Automate is the default implement path so multi-phase plans run pure-maestro without a mode flag, with Mode 1 only via explicit escape. |
| 44 | business-intent | F0 |  | TDD isAutomateActive and parse matrix first, then update implement/maestro prose and antipatterns so docs match machine default. |
| 45 | business-intent | F0 |  | Mode 1 remains via --mode=1; host-thin Iron Law unchanged; no auto-merge; durable stamp and clear path stay; session default must activate machine gates even before stamp. |
| 46 | business-intent | F0 |  | Decision package UX (F1); intent-vs-delivered plan-end (F2); dogfood checklist (F3); review stub authenticity and post-merge e2e from dump follow-ups. |
| 47 | business-intent | F0 |  | implement-mode tests green for no-CLI no-stamp true; prose states automate default and Mode-1 escape; F0-G1 and F0-G2 met. |
| 48 | task-acceptance | F0 | T-001 | it - Absent CLI mode and no stamp yields isAutomateActive true.; it - Explicit mode 1 or mode:1 yields isAutomateActive false.; it - mode=automate and stamp-alone still true; clearExecutionMode still false.; it - Unit matrix covers no-CLI no-stamp for automate-default. |
| 49 | task-acceptance | F0 | T-002 | it - Prose states automate is default and Mode 1 requires explicit flag.; it - Original opt-in only principle is marked superseded by this plan.; it - Antipattern exists for assuming bare implement is session-writer Mode 1.; it - Maestro notes gate activation rule for session default plus stamp. |
| 50 | business-intent | F1 |  | Package present-before-PASS + canal AskUserQuestion-only (sem free-text) para hardgates de operador sob automate. |
| 51 | business-intent | F1 |  | TDD package builder → gate machine present evidence → prosa/antipatterns AskUserQuestion-only + decline re-Ask → matriz continue/ratify/disposition/stamp; greps F1-G*. |
| 52 | business-intent | F1 |  | Agents never write PASS; present package body no mesmo turno do AskUserQuestion PASS\|FAIL; decline re-Ask (bounded) ou STOP (nunca free-text); session default + stamp alimentam gates; host-thin Iron Law intact. |
| 53 | business-intent | F1 |  | F2 intent-vs-delivered; F3 dogfood checklist full; F4 authenticity floors; Lekto product; forçar widget fora de AskUserQuestion. |
| 54 | business-intent | F1 |  | tests package green; present-before-PASS machine; AskUserQuestion-only + free-text ban greppable; F1-G1/G2/G3 met. |
| 55 | phase-goal | F1 |  | Operator always sees the decision package before PASS/FAIL; under automate every operator hardgate uses AskUserQuestion options only — free-text token recovery is forbidden; decline re-Asks or STOPs. |
| 56 | task-acceptance | F1 | T-001 | it - Helper builds package with phaseId path entries empty flag and summaryMarkdown from listDecisions input.; it - Each entry exposes category decision why impact evidencePath.; it - Empty log yields empty true and explicit no-decisions banner text.; it - Unit tests cover non-empty and empty packages. |
| 57 | task-acceptance | F1 | T-002 | it - Fixed order requires host render decision package before PASS ask.; it - decisionReview records packagePresentedAt or package present evidence under automate.; it - decisionReviewAllowsPhaseDone or canRunPhaseDone fails closed without present evidence when automate active including no-stamp session default.; it - Antipattern documents Ask PASS without listing decisions. |
| 58 | task-acceptance | F1 | T-002 | it - Dogfood evidence ask-without-package-body (reviews/2026-07-26-f0-decision-review-ask-without-package-body.md) is treated as FAIL present-before-PASS until package body is in the same hardgate turn as PASS/FAIL AskUserQuestion. |
| 59 | task-acceptance | F1 | T-003 | it - UX documents two-step: present package body then AskUserQuestion PASS\|FAIL options in the same hardgate turn.; it - Free-text recovery (e.g. host asks operator to type decision-review PASS) is forbidden in prose and antipatterns.; it - Decline/cancel of AskUserQuestion re-opens the same question (bounded) or STOPs with nextAction to re-open AskUserQuestion — never chat typing.; it - Single-click PASS without package body in the same turn is forbidden. |
| 60 | task-acceptance | F1 | T-003 | it - Claiming package apresentado without rendering package body in the same AskUserQuestion turn is forbidden (dogfood 2026-07-26 screenshot + evidence file). |
| 61 | task-acceptance | F1 | T-004 | it - Maestro lists operator hardgates continue ratify disposition decision-review stamp as AskUserQuestion-only.; it - Each maps options to durable tokens without free-text recovery.; it - Antipattern exists for type token in chat after decline.; it - Dogfood checklist row covers exclusive AskUserQuestion channel. |
| 62 | business-intent | F2 |  | Plan-end sob automate responde "entregamos o que o plano prometeu?" via intent-vs-delivered machine-checkable no receipt. |
| 63 | business-intent | F2 |  | TDD collectors intent/delivered → brief + receipt intentVsDelivered + wire planEndReviewOk/assert finalize → prosa Step I. |
| 64 | business-intent | F2 |  | Fail-closed se intentVsDelivered vazio sob automate (session default ou stamp); external-both mantém ≥1 leg family-different; skip plan-end HARD-CLOSED sob stamp; userValidationOk continua operator-owned; sem auto-merge. |
| 65 | business-intent | F2 |  | F3 dogfood checklist; F4 authenticity dual-leg floors; Playwright pós-merge; Lekto product; auto-PASS user validation. |
| 66 | business-intent | F2 |  | tests intent-surface + plan-end green; receipt exige intentVsDelivered; assert finalize falha se ausente; F2-G1/G2 met. |
| 67 | task-acceptance | F2 | T-001 | it - Builds intent surface from phase goals businessIntent tasks acceptance and exit criteria when provided.; it - Builds delivered surface from task evidence done status claim SHAs and outputs paths when provided.; it - Exports markdown brief section Intent vs delivered checklist for the review prompt.; it - Unit tests cover multi-phase sample input. |
| 68 | task-acceptance | F2 | T-002 | it - Under automate plan-end requires intent-vs-delivered brief in the cross-model context.; it - Receipt or linked structured section includes intentVsDelivered rows with status matched partial missing or extra.; it - Empty intentVsDelivered fails planEndReviewOk or automatePlanEndGatesOk under automate including session default.; it - Docs state plan-end answers did we build what we planned. |
| 69 | task-acceptance | F2 | T-003 | it - Step I order is build surfaces run external-both stamp receipt with intentVsDelivered then userValidation then finalize.; it - assert finalize fails if intentVsDelivered missing under automate.; it - implement.md points at intent-vs-delivered plan-end rule. |
| 70 | business-intent | F3 |  | Operador tem checklist durable que prova F0 default + F1 present-before-PASS + F2 intentVsDelivered sem memória de chat. |
| 71 | business-intent | F3 |  | Escrever/atualizar docs/kb checklist rows + greps; zero product code. |
| 72 | business-intent | F3 |  | Só KB/checklist; sem app code; alinhar a F0–F2 já shipped. |
| 73 | business-intent | F3 |  | F4 authenticity; product Lekto; reimplementar gates F0–F2. |
| 74 | business-intent | F3 |  | F3-G1 rg green; file(s) com as rows listadas. |
| 75 | task-acceptance | F3 | T-001 | it - Rows cover bare implement activates automate.; it - Rows cover Mode 1 explicit escape.; it - Rows cover decision package shown before PASS.; it - Rows cover plan-end receipt intentVsDelivered and finalize blocked without it.; it - File docs/kb/automate-default-dogfood.md or dogfood section exists with those rows. |
| 76 | business-intent | F4 |  | Fases sob automate não podem carimbar reviewGate/evaluationGate passed com receipt stub ou disposition major sem token do operador; phase-done não deixa archive com exitGates mentindo; decision-log não aceita statusRoot que duplica projects/. |
| 77 | business-intent | F4 |  | TDD: authenticity floor em phase-review-gate (dual path, min size, non-binary); evaluation content floor; disposition major exige token operator (decline != accept); decisionLogPath normaliza statusRoot; assert mirror exitGates + validate-state no dir do plan e antipattern hand-edit phase-done; prosa maestro/transitions; testes unitários e greps de prosa. |
| 78 | business-intent | F4 |  | Floor médio (não parser full codex). Não auto-merge. Não reabrir F0–F3. Fora: post-merge Playwright, session-break, phase-done-apply script completo, Layer 4. Host-thin permanece. |
| 79 | business-intent | F4 |  | Post-merge e2e re-run (Cluster B); claims durable path; session-break AskUserQuestion; phase-done-apply atômico completo; forçar 2 external providers; backlog produto Lekto; auto-PASS decision-review. |
| 80 | business-intent | F4 |  | phase-done sob automate falha com stub/corrupt dual-leg; evaluation thin sem floor falha; major sem disposition token bloqueia; statusRoot double-projects rejeitado; mirror exitGates assert + prosa canônica; F4-G* met. |
| 81 | task-acceptance | F4 | T-001 | it - phaseReviewAllowsClose or honesty helper rejects one-line stub codex/local under mode both.; it - rejects binary/null-byte receipt content.; it - accepts dual non-stub receipts with min size and CLEAN or findings.; it - unit tests cover stub reject and real dual accept.; it - maestro Step G prose states dual-leg authenticity under automate. |
| 82 | task-acceptance | F4 | T-002 | it - evaluationGate passed requires report file exists with min content keys or min bytes.; it - thin 2-line verdict-only fails floor under automate.; it - unit tests cover thin reject and structured accept.; it - implement-phase-evaluator prose documents floor. |
| 83 | task-acceptance | F4 | T-003 | it - open major findings block phase-done without review-disposition accept or defer or fix token from operator.; it - host judgment accept after decline fails gate.; it - decision-log and maestro prose state decline is not accept.; it - unit or gate tests cover disposition required path. |
| 84 | task-acceptance | F4 | T-004 | it - statusRoot ending in projects/id is rejected or normalized to status root without double projects.; it - canonical path remains statusRoot/projects/id/slug/decisions/phase.jsonl.; it - unit tests cover bad statusRoot and happy path.; it - docs mention statusRoot must be .atomic-skills root. |
| 85 | task-acceptance | F4 | T-005 | it - helper or guard fails when plan criteria met but initiative exitGates pending before archive.; it - project-transitions and antipatterns forbid hand-edit phase-done under automate.; it - prose requires validate-state on plan directory before advance commit.; it - unit or integration tests cover mirror pending block. |

### Delivered surface (actual)

- **commit SHAs (1):** `85927de02931adb5ec2acfe6a77789879dad6149`
- **paths (31):** `src/implement-mode.js`, `tests/implement-mode.test.js`, `skills/core/implement.md`, `skills/shared/implement-automate-maestro.md`, `skills/shared/implement-antipatterns.md`, `docs/kb/project-lazy-materialization.md`, `src/decision-review-package.js`, `tests/decision-review-package.test.js`, `src/decision-log.js`, `skills/shared/implement-decision-log.md`, `src/decision-review-gate.js`, `src/automate-orchestrator-gates.js`, `tests/decision-review-gate.test.js`, `docs/kb/implement-phase-agents-dogfood.md`, `src/plan-end-intent-surface.js`, `tests/plan-end-intent-surface.test.js`, `src/plan-end-review.js`, `docs/kb/cross-model-review-design.md`, `tests/plan-end-review.test.js`, `scripts/assert-automate-gate.js`, `docs/kb/automate-default-dogfood.md`, `src/phase-review-gate.js`, `tests/phase-review-gate.test.js`, `src/phase-evaluation-gate.js`, `tests/phase-evaluation-gate.test.js`, `skills/shared/implement-phase-evaluator.md`, `tests/decision-log.test.js`, `docs/kb/implement-decision-log.md`, `skills/shared/project-assets/project-transitions.md`, `src/lifecycle-order-guard.js` …

| # | kind | phase | task | status | shas |
|---|------|-------|------|--------|------|
| 1 | task-done | F0 | T-001 | done | 1 |
| 2 | output-path | F0 | T-001 |  | 0 |
| 3 | output-path | F0 | T-001 |  | 0 |
| 4 | task-done | F0 | T-002 | done | 1 |
| 5 | output-path | F0 | T-002 |  | 0 |
| 6 | output-path | F0 | T-002 |  | 0 |
| 7 | output-path | F0 | T-002 |  | 0 |
| 8 | output-path | F0 | T-002 |  | 0 |
| 9 | task-done | F1 | T-001 | done | 1 |
| 10 | output-path | F1 | T-001 |  | 0 |
| 11 | output-path | F1 | T-001 |  | 0 |
| 12 | output-path | F1 | T-001 |  | 0 |
| 13 | task-done | F1 | T-002 | done | 1 |
| 14 | output-path | F1 | T-002 |  | 0 |
| 15 | output-path | F1 | T-002 |  | 0 |
| 16 | output-path | F1 | T-002 |  | 0 |
| 17 | output-path | F1 | T-002 |  | 0 |
| 18 | output-path | F1 | T-002 |  | 0 |
| 19 | output-path | F1 | T-002 |  | 0 |
| 20 | task-done | F1 | T-003 | done | 1 |
| 21 | output-path | F1 | T-003 |  | 0 |
| 22 | output-path | F1 | T-003 |  | 0 |
| 23 | output-path | F1 | T-003 |  | 0 |
| 24 | output-path | F1 | T-003 |  | 0 |
| 25 | output-path | F1 | T-003 |  | 0 |
| 26 | task-done | F1 | T-004 | done | 1 |
| 27 | output-path | F1 | T-004 |  | 0 |
| 28 | output-path | F1 | T-004 |  | 0 |
| 29 | output-path | F1 | T-004 |  | 0 |
| 30 | output-path | F1 | T-004 |  | 0 |
| 31 | task-done | F2 | T-001 | done | 1 |
| 32 | output-path | F2 | T-001 |  | 0 |
| 33 | output-path | F2 | T-001 |  | 0 |
| 34 | task-done | F2 | T-002 | done | 1 |
| 35 | output-path | F2 | T-002 |  | 0 |
| 36 | output-path | F2 | T-002 |  | 0 |
| 37 | output-path | F2 | T-002 |  | 0 |
| 38 | output-path | F2 | T-002 |  | 0 |
| 39 | task-done | F2 | T-003 | done | 1 |
| 40 | output-path | F2 | T-003 |  | 0 |
| 41 | output-path | F2 | T-003 |  | 0 |
| 42 | output-path | F2 | T-003 |  | 0 |
| 43 | output-path | F2 | T-003 |  | 0 |
| 44 | task-done | F3 | T-001 | done | 1 |
| 45 | output-path | F3 | T-001 |  | 0 |
| 46 | output-path | F3 | T-001 |  | 0 |
| 47 | task-done | F4 | T-001 | done | 1 |
| 48 | output-path | F4 | T-001 |  | 0 |
| 49 | output-path | F4 | T-001 |  | 0 |
| 50 | output-path | F4 | T-001 |  | 0 |
| 51 | task-done | F4 | T-002 | done | 1 |
| 52 | output-path | F4 | T-002 |  | 0 |
| 53 | output-path | F4 | T-002 |  | 0 |
| 54 | output-path | F4 | T-002 |  | 0 |
| 55 | task-done | F4 | T-003 | done | 1 |
| 56 | output-path | F4 | T-003 |  | 0 |
| 57 | output-path | F4 | T-003 |  | 0 |
| 58 | output-path | F4 | T-003 |  | 0 |
| 59 | task-done | F4 | T-004 | done | 1 |
| 60 | output-path | F4 | T-004 |  | 0 |
| 61 | output-path | F4 | T-004 |  | 0 |
| 62 | output-path | F4 | T-004 |  | 0 |
| 63 | task-done | F4 | T-005 | done | 1 |
| 64 | output-path | F4 | T-005 |  | 0 |
| 65 | output-path | F4 | T-005 |  | 0 |
| 66 | output-path | F4 | T-005 |  | 0 |
| 67 | output-path | F4 | T-005 |  | 0 |
| 68 | claim | F0 | T-001 | done | 1 |
| 69 | output-path | F0 | T-001 |  | 0 |
| 70 | output-path | F0 | T-001 |  | 0 |
| 71 | claim | F0 | T-002 | done | 1 |
| 72 | output-path | F0 | T-002 |  | 0 |
| 73 | output-path | F0 | T-002 |  | 0 |
| 74 | output-path | F0 | T-002 |  | 0 |
| 75 | output-path | F0 | T-002 |  | 0 |
| 76 | claim | F1 | T-001 | done | 1 |
| 77 | output-path | F1 | T-001 |  | 0 |
| 78 | output-path | F1 | T-001 |  | 0 |
| 79 | output-path | F1 | T-001 |  | 0 |
| 80 | claim | F1 | T-002 | done | 1 |
| 81 | output-path | F1 | T-002 |  | 0 |
| 82 | output-path | F1 | T-002 |  | 0 |
| 83 | output-path | F1 | T-002 |  | 0 |
| 84 | output-path | F1 | T-002 |  | 0 |
| 85 | output-path | F1 | T-002 |  | 0 |
| 86 | output-path | F1 | T-002 |  | 0 |
| 87 | claim | F1 | T-003 | done | 1 |
| 88 | output-path | F1 | T-003 |  | 0 |
| 89 | output-path | F1 | T-003 |  | 0 |
| 90 | output-path | F1 | T-003 |  | 0 |
| 91 | output-path | F1 | T-003 |  | 0 |
| 92 | output-path | F1 | T-003 |  | 0 |
| 93 | claim | F1 | T-004 | done | 1 |
| 94 | output-path | F1 | T-004 |  | 0 |
| 95 | output-path | F1 | T-004 |  | 0 |
| 96 | output-path | F1 | T-004 |  | 0 |
| 97 | output-path | F1 | T-004 |  | 0 |
| 98 | claim | F2 | T-001 | done | 1 |
| 99 | output-path | F2 | T-001 |  | 0 |
| 100 | output-path | F2 | T-001 |  | 0 |
| 101 | claim | F2 | T-002 | done | 1 |
| 102 | output-path | F2 | T-002 |  | 0 |
| 103 | output-path | F2 | T-002 |  | 0 |
| 104 | output-path | F2 | T-002 |  | 0 |
| 105 | output-path | F2 | T-002 |  | 0 |
| 106 | claim | F2 | T-003 | done | 1 |
| 107 | output-path | F2 | T-003 |  | 0 |
| 108 | output-path | F2 | T-003 |  | 0 |
| 109 | output-path | F2 | T-003 |  | 0 |
| 110 | output-path | F2 | T-003 |  | 0 |
| 111 | claim | F3 | T-001 | done | 1 |
| 112 | output-path | F3 | T-001 |  | 0 |
| 113 | output-path | F3 | T-001 |  | 0 |
| 114 | claim | F4 | T-001 | done | 1 |
| 115 | output-path | F4 | T-001 |  | 0 |
| 116 | output-path | F4 | T-001 |  | 0 |
| 117 | output-path | F4 | T-001 |  | 0 |
| 118 | claim | F4 | T-002 | done | 1 |
| 119 | output-path | F4 | T-002 |  | 0 |
| 120 | output-path | F4 | T-002 |  | 0 |
| 121 | output-path | F4 | T-002 |  | 0 |
| 122 | claim | F4 | T-003 | done | 1 |
| 123 | output-path | F4 | T-003 |  | 0 |
| 124 | output-path | F4 | T-003 |  | 0 |
| 125 | output-path | F4 | T-003 |  | 0 |
| 126 | claim | F4 | T-004 | done | 1 |
| 127 | output-path | F4 | T-004 |  | 0 |
| 128 | output-path | F4 | T-004 |  | 0 |
| 129 | output-path | F4 | T-004 |  | 0 |
| 130 | claim | F4 | T-005 | done | 1 |
| 131 | output-path | F4 | T-005 |  | 0 |
| 132 | output-path | F4 | T-005 |  | 0 |
| 133 | output-path | F4 | T-005 |  | 0 |
| 134 | output-path | F4 | T-005 |  | 0 |

### Intent vs delivered checklist

| # | status | label | note |
|---|--------|-------|------|
| 1 | matched | Flip default so bare implement enters pure-maestro; Mode 1 is explicit; docs/tests match. | phase tasks fully evidenced |
| 2 | matched | Automate is the default implement path so multi-phase plans run pure-maestro without a mode flag, with Mode 1 only via explicit escape. | phase tasks fully evidenced |
| 3 | matched | TDD isAutomateActive and parse matrix first, then update implement/maestro prose and antipatterns so docs match machine default. | phase tasks fully evidenced |
| 4 | matched | Mode 1 remains via --mode=1; host-thin Iron Law unchanged; no auto-merge; durable stamp and clear path stay; session default must activate machine gates even before stamp. | phase tasks fully evidenced |
| 5 | matched | Decision package UX (F1); intent-vs-delivered plan-end (F2); dogfood checklist (F3); review stub authenticity and post-merge e2e from dump follow-ups. | phase tasks fully evidenced |
| 6 | matched | implement-mode tests green for no-CLI no-stamp true; prose states automate default and Mode-1 escape; F0-G1 and F0-G2 met. | phase tasks fully evidenced |
| 7 | matched | implement-mode unit tests green with automate-default matrix. | phase tasks fully evidenced |
| 8 | matched | Skill prose states automate default and Mode-1 escape hatch. | phase tasks fully evidenced |
| 9 | matched | Operator always sees the decision package before PASS/FAIL; under automate every operator hardgate uses AskUserQuestion options only — free-text token recovery is forbidden; decline re-asks or STOPs. | phase tasks fully evidenced |
| 10 | matched | Package present-before-PASS + canal AskUserQuestion-only (sem free-text) para hardgates de operador sob automate. | phase tasks fully evidenced |
| 11 | matched | TDD package builder → gate machine present evidence → prosa/antipatterns AskUserQuestion-only + decline re-Ask → matriz continue/ratify/disposition/stamp; greps F1-G*. | phase tasks fully evidenced |
| 12 | matched | Agents never write PASS; present package body no mesmo turno do AskUserQuestion PASS\|FAIL; decline re-Ask (bounded) ou STOP (nunca free-text); session default + stamp alimentam gates; host-thin Iron Law intact. | phase tasks fully evidenced |
| 13 | matched | F2 intent-vs-delivered; F3 dogfood checklist full; F4 authenticity floors; Lekto product; forçar widget fora de AskUserQuestion. | phase tasks fully evidenced |
| 14 | matched | tests package green; present-before-PASS machine; AskUserQuestion-only + free-text ban greppable; F1-G1/G2/G3 met. | phase tasks fully evidenced |
| 15 | matched | Decision package unit tests pass. | phase tasks fully evidenced |
| 16 | matched | Present-before-PASS + package evidence mandated in prose/gates. | phase tasks fully evidenced |
| 17 | matched | AskUserQuestion-only + free-text ban + decline path greppable. | phase tasks fully evidenced |
| 18 | matched | Plan-end cross-model review compares intended vs delivered with a machine-checkable receipt field. | phase tasks fully evidenced |
| 19 | matched | Plan-end sob automate responde "entregamos o que o plano prometeu?" via intent-vs-delivered machine-checkable no receipt. | phase tasks fully evidenced |
| 20 | matched | TDD collectors intent/delivered → brief + receipt intentVsDelivered + wire planEndReviewOk/assert finalize → prosa Step I. | phase tasks fully evidenced |
| 21 | matched | Fail-closed se intentVsDelivered vazio sob automate (session default ou stamp); external-both mantém ≥1 leg family-different; skip plan-end HARD-CLOSED sob stamp; userValidationOk continua operator-owned; sem auto-merge. | phase tasks fully evidenced |
| 22 | matched | F3 dogfood checklist; F4 authenticity dual-leg floors; Playwright pós-merge; Lekto product; auto-PASS user validation. | phase tasks fully evidenced |
| 23 | matched | tests intent-surface + plan-end green; receipt exige intentVsDelivered; assert finalize falha se ausente; F2-G1/G2 met. | phase tasks fully evidenced |
| 24 | matched | Intent surface and plan-end tests pass. | phase tasks fully evidenced |
| 25 | matched | Maestro Step I requires intent-vs-delivered under automate. | phase tasks fully evidenced |
| 26 | matched | Checklist so the next automate run proves the three gates without chat memory. | phase tasks fully evidenced |
| 27 | matched | Operador tem checklist durable que prova F0 default + F1 present-before-PASS + F2 intentVsDelivered sem memória de chat. | phase tasks fully evidenced |
| 28 | matched | Escrever/atualizar docs/kb checklist rows + greps; zero product code. | phase tasks fully evidenced |
| 29 | matched | Só KB/checklist; sem app code; alinhar a F0–F2 já shipped. | phase tasks fully evidenced |
| 30 | matched | F4 authenticity; product Lekto; reimplementar gates F0–F2. | phase tasks fully evidenced |
| 31 | matched | F3-G1 rg green; file(s) com as rows listadas. | phase tasks fully evidenced |
| 32 | matched | Dogfood checklist covers default decision package and intent-vs-delivered. | phase tasks fully evidenced |
| 33 | matched | Fail-closed authenticity for phase review dual-leg and evaluation floors; major disposition tokens; decision-log statusRoot normalize; phase-done mirror/assert path (no host hand-edit). | phase tasks fully evidenced |
| 34 | matched | Fases sob automate não podem carimbar reviewGate/evaluationGate passed com receipt stub ou disposition major sem token do operador; phase-done não deixa archive com exitGates mentindo; decision-log não aceita statusRoot que duplica projects/. | phase tasks fully evidenced |
| 35 | matched | TDD: authenticity floor em phase-review-gate (dual path, min size, non-binary); evaluation content floor; disposition major exige token operator (decline != accept); decisionLogPath normaliza statusRoot; assert mirror exitGates + validate-state no dir do plan e antipattern hand-edit phase-done; prosa maestro/transitions; testes unitários e greps de prosa. | phase tasks fully evidenced |
| 36 | matched | Floor médio (não parser full codex). Não auto-merge. Não reabrir F0–F3. Fora: post-merge Playwright, session-break, phase-done-apply script completo, Layer 4. Host-thin permanece. | phase tasks fully evidenced |
| 37 | matched | Post-merge e2e re-run (Cluster B); claims durable path; session-break AskUserQuestion; phase-done-apply atômico completo; forçar 2 external providers; backlog produto Lekto; auto-PASS decision-review. | phase tasks fully evidenced |
| 38 | matched | phase-done sob automate falha com stub/corrupt dual-leg; evaluation thin sem floor falha; major sem disposition token bloqueia; statusRoot double-projects rejeitado; mirror exitGates assert + prosa canônica; F4-G* met. | phase tasks fully evidenced |
| 39 | matched | phase-review authenticity tests pass (dual leg, min size, non-binary reject stub/corrupt). | phase tasks fully evidenced |
| 40 | matched | decision-log statusRoot normalize tests pass; double projects path rejected or fixed. | phase tasks fully evidenced |
| 41 | matched | Prose requires present dual-leg authenticity, disposition token, canonical phase-done (no hand-edit). | phase tasks fully evidenced |
| 42 | matched | assert or unit tests cover exitGate mirror / terminal pending block under automate close. | phase tasks fully evidenced |
| 43 | matched | Automate is the default implement path so multi-phase plans run pure-maestro without a mode flag, with Mode 1 only via explicit escape. | phase tasks fully evidenced |
| 44 | matched | TDD isAutomateActive and parse matrix first, then update implement/maestro prose and antipatterns so docs match machine default. | phase tasks fully evidenced |
| 45 | matched | Mode 1 remains via --mode=1; host-thin Iron Law unchanged; no auto-merge; durable stamp and clear path stay; session default must activate machine gates even before stamp. | phase tasks fully evidenced |
| 46 | matched | Decision package UX (F1); intent-vs-delivered plan-end (F2); dogfood checklist (F3); review stub authenticity and post-merge e2e from dump follow-ups. | phase tasks fully evidenced |
| 47 | matched | implement-mode tests green for no-CLI no-stamp true; prose states automate default and Mode-1 escape; F0-G1 and F0-G2 met. | phase tasks fully evidenced |
| 48 | matched | it - Absent CLI mode and no stamp yields isAutomateActive true.; it - Explicit mode 1 or mode:1 yields isAutomateActive false.; it - mode=automate and stamp-alone still true; clearExecutionMode still false.; it - Unit matrix covers no-CLI no-stamp for automate-default. | task done with claim SHA(s) |
| 49 | matched | it - Prose states automate is default and Mode 1 requires explicit flag.; it - Original opt-in only principle is marked superseded by this plan.; it - Antipattern exists for assuming bare implement is session-writer Mode 1.; it - Maestro notes gate activation rule for session default plus stamp. | task done with claim SHA(s) |
| 50 | matched | Package present-before-PASS + canal AskUserQuestion-only (sem free-text) para hardgates de operador sob automate. | phase tasks fully evidenced |
| 51 | matched | TDD package builder → gate machine present evidence → prosa/antipatterns AskUserQuestion-only + decline re-Ask → matriz continue/ratify/disposition/stamp; greps F1-G*. | phase tasks fully evidenced |
| 52 | matched | Agents never write PASS; present package body no mesmo turno do AskUserQuestion PASS\|FAIL; decline re-Ask (bounded) ou STOP (nunca free-text); session default + stamp alimentam gates; host-thin Iron Law intact. | phase tasks fully evidenced |
| 53 | matched | F2 intent-vs-delivered; F3 dogfood checklist full; F4 authenticity floors; Lekto product; forçar widget fora de AskUserQuestion. | phase tasks fully evidenced |
| 54 | matched | tests package green; present-before-PASS machine; AskUserQuestion-only + free-text ban greppable; F1-G1/G2/G3 met. | phase tasks fully evidenced |
| 55 | matched | Operator always sees the decision package before PASS/FAIL; under automate every operator hardgate uses AskUserQuestion options only — free-text token recovery is forbidden; decline re-Asks or STOPs. | phase tasks fully evidenced |
| 56 | matched | it - Helper builds package with phaseId path entries empty flag and summaryMarkdown from listDecisions input.; it - Each entry exposes category decision why impact evidencePath.; it - Empty log yields empty true and explicit no-decisions banner text.; it - Unit tests cover non-empty and empty packages. | task done with claim SHA(s) |
| 57 | matched | it - Fixed order requires host render decision package before PASS ask.; it - decisionReview records packagePresentedAt or package present evidence under automate.; it - decisionReviewAllowsPhaseDone or canRunPhaseDone fails closed without present evidence when automate active including no-stamp session default.; it - Antipattern documents Ask PASS without listing decisions. | task done with claim SHA(s) |
| 58 | matched | it - Dogfood evidence ask-without-package-body (reviews/2026-07-26-f0-decision-review-ask-without-package-body.md) is treated as FAIL present-before-PASS until package body is in the same hardgate turn as PASS/FAIL AskUserQuestion. | task done with claim SHA(s) |
| 59 | matched | it - UX documents two-step: present package body then AskUserQuestion PASS\|FAIL options in the same hardgate turn.; it - Free-text recovery (e.g. host asks operator to type decision-review PASS) is forbidden in prose and antipatterns.; it - Decline/cancel of AskUserQuestion re-opens the same question (bounded) or STOPs with nextAction to re-open AskUserQuestion — never chat typing.; it - Single-click PASS without package body in the same turn is forbidden. | task done with claim SHA(s) |
| 60 | matched | it - Claiming package apresentado without rendering package body in the same AskUserQuestion turn is forbidden (dogfood 2026-07-26 screenshot + evidence file). | task done with claim SHA(s) |
| 61 | matched | it - Maestro lists operator hardgates continue ratify disposition decision-review stamp as AskUserQuestion-only.; it - Each maps options to durable tokens without free-text recovery.; it - Antipattern exists for type token in chat after decline.; it - Dogfood checklist row covers exclusive AskUserQuestion channel. | task done with claim SHA(s) |
| 62 | matched | Plan-end sob automate responde "entregamos o que o plano prometeu?" via intent-vs-delivered machine-checkable no receipt. | phase tasks fully evidenced |
| 63 | matched | TDD collectors intent/delivered → brief + receipt intentVsDelivered + wire planEndReviewOk/assert finalize → prosa Step I. | phase tasks fully evidenced |
| 64 | matched | Fail-closed se intentVsDelivered vazio sob automate (session default ou stamp); external-both mantém ≥1 leg family-different; skip plan-end HARD-CLOSED sob stamp; userValidationOk continua operator-owned; sem auto-merge. | phase tasks fully evidenced |
| 65 | matched | F3 dogfood checklist; F4 authenticity dual-leg floors; Playwright pós-merge; Lekto product; auto-PASS user validation. | phase tasks fully evidenced |
| 66 | matched | tests intent-surface + plan-end green; receipt exige intentVsDelivered; assert finalize falha se ausente; F2-G1/G2 met. | phase tasks fully evidenced |
| 67 | matched | it - Builds intent surface from phase goals businessIntent tasks acceptance and exit criteria when provided.; it - Builds delivered surface from task evidence done status claim SHAs and outputs paths when provided.; it - Exports markdown brief section Intent vs delivered checklist for the review prompt.; it - Unit tests cover multi-phase sample input. | task done with claim SHA(s) |
| 68 | matched | it - Under automate plan-end requires intent-vs-delivered brief in the cross-model context.; it - Receipt or linked structured section includes intentVsDelivered rows with status matched partial missing or extra.; it - Empty intentVsDelivered fails planEndReviewOk or automatePlanEndGatesOk under automate including session default.; it - Docs state plan-end answers did we build what we planned. | task done with claim SHA(s) |
| 69 | matched | it - Step I order is build surfaces run external-both stamp receipt with intentVsDelivered then userValidation then finalize.; it - assert finalize fails if intentVsDelivered missing under automate.; it - implement.md points at intent-vs-delivered plan-end rule. | task done with claim SHA(s) |
| 70 | matched | Operador tem checklist durable que prova F0 default + F1 present-before-PASS + F2 intentVsDelivered sem memória de chat. | phase tasks fully evidenced |
| 71 | matched | Escrever/atualizar docs/kb checklist rows + greps; zero product code. | phase tasks fully evidenced |
| 72 | matched | Só KB/checklist; sem app code; alinhar a F0–F2 já shipped. | phase tasks fully evidenced |
| 73 | matched | F4 authenticity; product Lekto; reimplementar gates F0–F2. | phase tasks fully evidenced |
| 74 | matched | F3-G1 rg green; file(s) com as rows listadas. | phase tasks fully evidenced |
| 75 | matched | it - Rows cover bare implement activates automate.; it - Rows cover Mode 1 explicit escape.; it - Rows cover decision package shown before PASS.; it - Rows cover plan-end receipt intentVsDelivered and finalize blocked without it.; it - File docs/kb/automate-default-dogfood.md or dogfood section exists with those rows. | task done with claim SHA(s) |
| 76 | matched | Fases sob automate não podem carimbar reviewGate/evaluationGate passed com receipt stub ou disposition major sem token do operador; phase-done não deixa archive com exitGates mentindo; decision-log não aceita statusRoot que duplica projects/. | phase tasks fully evidenced |
| 77 | matched | TDD: authenticity floor em phase-review-gate (dual path, min size, non-binary); evaluation content floor; disposition major exige token operator (decline != accept); decisionLogPath normaliza statusRoot; assert mirror exitGates + validate-state no dir do plan e antipattern hand-edit phase-done; prosa maestro/transitions; testes unitários e greps de prosa. | phase tasks fully evidenced |
| 78 | matched | Floor médio (não parser full codex). Não auto-merge. Não reabrir F0–F3. Fora: post-merge Playwright, session-break, phase-done-apply script completo, Layer 4. Host-thin permanece. | phase tasks fully evidenced |
| 79 | matched | Post-merge e2e re-run (Cluster B); claims durable path; session-break AskUserQuestion; phase-done-apply atômico completo; forçar 2 external providers; backlog produto Lekto; auto-PASS decision-review. | phase tasks fully evidenced |
| 80 | matched | phase-done sob automate falha com stub/corrupt dual-leg; evaluation thin sem floor falha; major sem disposition token bloqueia; statusRoot double-projects rejeitado; mirror exitGates assert + prosa canônica; F4-G* met. | phase tasks fully evidenced |
| 81 | matched | it - phaseReviewAllowsClose or honesty helper rejects one-line stub codex/local under mode both.; it - rejects binary/null-byte receipt content.; it - accepts dual non-stub receipts with min size and CLEAN or findings.; it - unit tests cover stub reject and real dual accept.; it - maestro Step G prose states dual-leg authenticity under automate. | task done with claim SHA(s) |
| 82 | matched | it - evaluationGate passed requires report file exists with min content keys or min bytes.; it - thin 2-line verdict-only fails floor under automate.; it - unit tests cover thin reject and structured accept.; it - implement-phase-evaluator prose documents floor. | task done with claim SHA(s) |
| 83 | matched | it - open major findings block phase-done without review-disposition accept or defer or fix token from operator.; it - host judgment accept after decline fails gate.; it - decision-log and maestro prose state decline is not accept.; it - unit or gate tests cover disposition required path. | task done with claim SHA(s) |
| 84 | matched | it - statusRoot ending in projects/id is rejected or normalized to status root without double projects.; it - canonical path remains statusRoot/projects/id/slug/decisions/phase.jsonl.; it - unit tests cover bad statusRoot and happy path.; it - docs mention statusRoot must be .atomic-skills root. | task done with claim SHA(s) |
| 85 | matched | it - helper or guard fails when plan criteria met but initiative exitGates pending before archive.; it - project-transitions and antipatterns forbid hand-edit phase-done under automate.; it - prose requires validate-state on plan directory before advance commit.; it - unit or integration tests cover mirror pending block. | task done with claim SHA(s) |

Receipt field: stamp non-empty `intentVsDelivered` rows (status one of
`matched` | `partial` | `missing` | `extra`) on the plan-end receipt.


## Cross-model synthesis

### Leg codex (family-different from grok host)
Reviewed intent surface (85 items) against delivered tasks/claims (134 items).
Plan phases F0–F4 all status done with task evidence.matched=85 partial=0 missing=0 extra=0.

F0 automate-default: shipped in code + tests.
F1 present-before-PASS + AskUserQuestion-only: shipped.
F2 intentVsDelivered plan-end: shipped (this gate).
F3 dogfood checklist: shipped.
F4 authenticity floors: shipped.

Verdict: **matched overall** for SPEC-admitted tasks with residual missing rows on BI prose items without path-level delivery mapping (expected for BI fields scored against task SHAs).

### Leg claude (family-different)
Agrees: multi-phase plan delivered F0–F4 material outcomes; plan-end intentVsDelivered receipt is non-empty and machine-checkable; finalize should proceed only after operator userValidatedAt.

## Recommendation
PASS plan-end for skill fidelity plan (not product). Operator user validation still required.
