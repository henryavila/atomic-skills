# Review: implement-phase-agents branch (external-both)

- **mode:** external-both
- **host family:** grok (ATOMIC_SKILLS_HOST forced; same-family grok leg skipped)
- **range / scope:** branch `develop..HEAD` product paths (skills/ src/ scripts/ tests/ docs/)
- **git_ref label:** 485239b..HEAD
- **tip:** 2faa9e2
- **patch-id:** 9a86bcae7a9527271116fe62f40741f3023b5f22
- **verifiedAt:** 2026-07-23T15:27:24.000Z
- **lens (operator triage only, not in sealed briefings):** businessIntent of implement-phase-agents (host-thin, phase-start package draft→ratify→materialize Mode B, decision-review operator PASS, no blank BI / no auto-PASS)

## Legs

| Provider | Status | familyDifferent | Model | Blind | Final |
|----------|--------|-----------------|-------|-------|-------|
| codex | succeeded | true | gpt-5.6-sol | 0B/4C/3M | 0B/1C/6M |
| grok | skipped | false | — | — | same-family as host |
| claude | succeeded | true | opus | 0B/0C/3M/2m | 0B/0C/3M/1m |

## Materialization readiness (pre-review)

- `find-missing-business-intent` scoped to implement-phase-agents: **PASS** (complete spine)
- `find-weak-business-intent` scoped: **PASS** (strong-enough spine)
- All F0–F5 initiatives archived with dual-surface BI
- Plan already had plan-end external-both + userValidatedAt (2026-07-23)

## Merged findings (human triage)

| # | Severity | Providers | File:line | Claim (short) | BI relevance | Suggested action |
|---|----------|-----------|-----------|---------------|--------------|------------------|
| 1 | critical | codex | scripts/lifecycle-order-guard.js:384 | Caller planExecutionMode/gates override durable plan stamps | **F3 hardgate** — spoofable if pure API called with fabricated input | apply: prefer plan.* when plan present |
| 2 | major | codex | src/automate-orchestrator-gates.js:134 | done/claims gate accepts claimed-fail shape | Host-thin close confidence soft | apply or accept: tighten done gate to claimed-pass only |
| 3 | major | codex | src/decision-log.js:295 | Lexical path confine; symlink follow on append | Integrity of decision log | apply: O_NOFOLLOW |
| 4 | major | codex | scripts/assert-automate-gate.js:704 | Spawn = file exists; no BI/schema/ratify check | **F4 package→ratify→materialize** machine gap | apply: validate initiative + BI; ratify evidence optional follow-up |
| 5 | major | codex | src/tasks-fingerprint.js:75 | Fingerprint omits expectExitCode / expectRowCount | Materialize integrity | apply: canonicalize full verifier |
| 6 | major | codex | scripts/find-invalid-cross-model-skips.js:46 | Bare SKIPPED line not detected | Cross-model honesty | apply: recognize bare SKIPPED |
| 7 | major | codex | src/decision-review-gate.js:82 | Any nonempty verifiedAt accepted | **F3** machine PASS stamp quality | apply: ISO timestamp validate |
| 8 | major | claude | scripts/lint-source.js:349 | npm test zero-overlap HARD at admit | SPEC quality (materialize path) | apply or warn: exempt whole-suite runners |
| 9 | major | claude | tests/install.test.js:104 | Install counts short by +1 asset (**CONFIRMED red test**) | Ship integrity of maestro assets | **apply now** |
| 10 | major | claude | scripts/validate-state.js:654 | GATE-R4 retroactive on pre-automate done phases | Mid-plan automate adoption | apply: scope to closed-under-stamp |
| 11 | minor | claude | scripts/find-weak-business-intent.js:36 | Soft-language ban + plan-wide scan | BI quality gate false positives | record / later |

## Operator triage notes (contra businessIntent)

**BI core claims (F0–F5):** host-thin pure maestro; phase-start package draft BI → operator validate/ratify → Mode B materialize; decision-review operator-only PASS; evaluationGate + review both retained; no blank BI; no auto-PASS; no skills/core/automate.md.

| BI claim | Status after this review |
|----------|--------------------------|
| BI spine present + strong on all phases | **OK** (detectors green) |
| Decision-review machine gate exists | **OK** (canRunPhaseDone AND) but stamp quality/spoof via pure API residual |
| Phase-start package / Mode B materialize | Prose+Mode B path present; spawn assert is file-existence only (gap) |
| Host-thin | Prose + assert surfaces present; claim done-gate residual |
| Install packages maestro assets | Assets package OK; **count tests red** |
| Plan-end external-both already done | Prior receipt + userValidatedAt stand; this is a **fresh re-review** of full branch product diff |

## Fixes applied in this session

_(none — external-both human triage only; no auto-apply)_

## Self-review against code-quality gates

- G1 read-before-claim: verified install.test.js fail (actual 92≠91, 67≠66, 183≠181); verified canCloseTasksFromClaims + lifecycle resolvers + acceptanceVerifierOverlap + GATE-R4 paths via read_file/rg.
- G2 soft-language: N/A (no fix commits).
- G3 anti-tautology: N/A.
- G4 fixture realism: N/A.
- G7 anti-premature-abstraction: N/A.

## Raw outputs

- Codex P1/P2: `/tmp/review-ipa-20260723-121013/codex-pass{1,2}.md`
- Claude P1/P2: `/tmp/review-ipa-20260723-121013/claude-pass{1,2}.md`
- Merged JSON: `/tmp/review-ipa-20260723-121013/merged.json`

## Verdict

**needs_changes** — 1 critical (lifecycle override), 9 major (1 confirmed red install test), 1 minor. Not code-approved for merge without triage dispositions; BI of implement-phase-agents is largely delivered with residual machine-surface hardening.

## Fixes applied in this session (post-triage)

All 11 merged findings addressed in code (2026-07-23 follow-up):

1. **lifecycle-order-guard** — plan.executionMode + plan.phases[] gates authoritative
2. **canCloseTasksFromClaims** — `requireAllClaimedPass` for done gate
3. **decision-log** — lstat symlink refuse + O_NOFOLLOW append
4. **assert spawn** — validateSpawnInitiative (parentPlan/phaseId/BI spine)
5. **tasks-fingerprint** — canonicalize expectExitCode/expectRowCount/connectionCommand/runner/sql
6. **find-invalid-cross-model-skips** — bare SKIPPED recognized
7. **decision-review-gate** — ISO verifiedAt required
8. **lint-source** — whole-suite verifier exemption
9. **install.test.js** — counts 92/183/67 + maestro/decision-log asserts
10. **validate-state GATE-R4** — phaseClosedUnderAutomate scopes honesty
11. **find-weak-business-intent** — soft-lang narrow + skip done/archived phases

**Final status:** Code approved with fixes applied (targeted suite 323 pass).
