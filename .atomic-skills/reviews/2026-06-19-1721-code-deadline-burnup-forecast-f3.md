---
date: 2026-06-19T17:21:34Z
topic: code-deadline-burnup-forecast-f3
artifact: fef1c2b..HEAD (F3 source diff)
skill: review-code
mode: both
reviewer: gpt-5-codex (+ local Claude agent, clean context)
codex_version: codex-cli 0.141.0
final_verdict: needs_changes→blocker/critical all resolved; 1 major surfaced for user decision
counts_local: 0B/1C/2M/2m
counts_codex_blind: 0B/0C/2M/2m
counts_codex_final: 0B/0C/1M/2m
framing_delta: 2 dropped (constraint-driven), 1 new (constraint-driven)
schema_version: "1.0"
---

# Cross-Model Review — F3 (Série earned-vs-planned + deadline + wiring de recompute)

Phase-done review gate, `--mode=both`. Local Claude agent (clean context) first,
then OpenAI Codex two-pass sealed envelope (blind → informed) on the SAME source
diff. Neither reviewer saw the other's findings; codex briefings carried no intent
and no mention of the local pass.

## Local pass (Claude agent, clean context) — 0B/1C/2M/2m

- **#1 CRITICAL — phase-done double-count** (`scripts/emit-consumer-state.js` earned loops). `buildSeries` summed every event's weight; per `project-transitions.md:138` + `lint-transition-emits.js:31`, `phase-done` emits N per-task `task-done` events PLUS one aggregate `phase-done` event (taskId null, helper-default weight 1/count). Summing the aggregate on top double-counts earned on every phase close → inflated SPI/burn-up. **FIXED** @41641bf: earned sums `event === 'task-done'` only (covers done + reconcile + bulk-close per-task; excludes the aggregate). Test lock + mutation-kill (revert filter → emit-series RED, `earnedCount 2 !== 1`).
- **#2 MAJOR — refresh-state empty catch** swallowed emit errors silently (`seriesWritten:0` indistinguishable from a repo with no plans). **FIXED** @41641bf: `console.error` + `seriesError` on the summary (stays fail-open).
- **#3 MAJOR — validateAideckState never validated burnup/spi** (built from `buildState` only). **FIXED** @41641bf: reads completions + `buildSeries`, merges, validates `#/definitions/burnup|spi`.
- **#4 minor** — overdue plans (now > deadline) emit null SPI. Ratified design (SPEC: null outside [started,deadline]). RECORDED, no change; flagged to user as a possible F4/F5 refinement.
- **#5 minor** — `eventWeightOf` default 0 vs producer default 1. Dead branch after #1 (only `task-done` events, which schema-require weight). RECORDED, no change.

## Codex Pass 1 (blind, gpt-5-codex) — 0B/0C/2M/2m

- F-001 [major] earnedCount doesn't count proxy-basis task-done.
- F-002 [major] corrupted JSONL silently dropped in emit + validation.
- F-003 [minor] plannedValue at start-of-day vs earned end-of-day.
- F-004 [minor] zero-event plans emit no burnup baseline.

(Full output: /tmp/codex-output-pass1.md, captured this session.)

## Codex Pass 2 (informed) — 0B/0C/1M/2m

Reconciliation against verifiable constraints (per-basis split is by-design; only
task-done counts; appendCompletion validates writes; sparse series is by-design):

- **Dropped:** F-001-blind (per-basis split is the ratified contract — proxy events must NOT increment count); F-004-blind (sparse series is by-design).
- **F-001 [minor] data integrity** (was blind F-002, REFINED major→minor): corrupted/manual/partial JSONL hidden by lenient parse in emit + validation. **FIXED** @<codex-remediation>: `validateAideckState` now validates each completions line (JSON parse + `validateCompletionEvent`) → a corrupted append-only log fails the gate.
- **F-002 [minor] correctness** (was blind F-003, MAINTAINED): plannedValue at start-of-day vs earned-through-day. **ADDRESSED** @<codex-remediation>: bucket semantics documented explicitly in `buildSeries` (row = cumulative earned THROUGH day vs planned at START of day; spi.json is the point-in-time signal). No math change (clean daily convention; ≤1-day uniform bias; spi is the schedule signal).
- **F-003 [major] contract (NEW, constraint-driven)** — the sparse-series recovery path I asserted (reconstruct the planned baseline from emitted state) is NOT satisfiable: `plans.json` omits `deadline` and plan-wide totals, and zero-completion plans emit no burnup rows. So an untouched plan cannot show its planned line / schedule pressure from emitted state alone. **PENDING USER DECISION** (one-way-door contract): extend `spi.json` (per plan) with `started`/`deadline`/`weightTotal`/`tasksTotal` now (F3, makes the series render-self-sufficient), OR defer to F5 (render reads plan frontmatter). Severity major but not a F3 gate-blocker (the series + SPI ARE emitted; gate G-1 met).

(Full output: /tmp/codex-output-pass2.md, captured this session.)

## Fixes applied in this session

- @41641bf (local remediation): #1 task-done filter (CRITICAL, with mutation-killed test lock); #2 refresh-state error log + seriesError; #3 validateAideckState covers burnup/spi.
- @<codex-remediation commit>: F-001 completions-line validation in validateAideckState (parse + validateCompletionEvent); F-002 bucket-semantics doc comment.
- Suite after all fixes: 927 tests, 913 pass, 8 fail PRE-EXISTING (install/countSkills, out of scope), 0 new regressions.

## Open for user decision

- **F-003 (major):** extend `spi.json` with planned-line params now vs defer to F5. See above.
- **#4 (minor):** overdue→null SPI — keep (ratified) vs saturate planned at deadline so overdue plans yield sub-1 SPI. Candidate F4/F5 refinement.

## Self-review against code-quality gates

- G1 read-before-claim: each fix verified against pasted source lines (the earned loops, the catch block, the validator read, the burnup.push); evidence is the test runs + mutation-kill.
- G2 soft-language: fix descriptions are passed:true evidence (verifier + mutation-kill), no should/probably/works.
- G3 anti-tautology: the #1 test lock names + executes its mutation (revert task-done filter → earnedCount 2 !== 1 → RED; revert restores GREEN).
- G4 fixture realism: the phase-done fixture mirrors the real producer (taskId null, weight default 1/count per project-transitions.md:138).
- G7 anti-premature-abstraction: the completions log-read is inlined in both emitConsumerState and validateAideckState (2 sites < 3-site floor); no shared helper introduced.
