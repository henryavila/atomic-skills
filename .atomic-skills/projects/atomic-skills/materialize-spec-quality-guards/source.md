# materialize-spec-quality-guards

Endurecer os tres buracos residuais do ciclo materialize→implement: rubber-stamp de businessIntent (R1), SPEC/verifier fraco no admit (R2), e rewrite de tasks no publish (R3), com detectores zero-token fail-closed e instrumentacao D9 measure — sem LLM no path critico e sem auto-preencher spine.

## Principles

- **P1 Zero-token no path critico** — Gates de qualidade e fingerprint sao scripts node exit-0/1, identicos em todo host.
- **P2 Operador e autoridade da spine** — Nunca pre-preencher businessIntent com LLM; blank-field + proof-of-work.
- **P3 Fail closed no publish** — materialize-state recusa initiative cujo core SPEC diverge do sidecar live.
- **P4 Lazy F0 permanece** — Este plano nao re-materializa F1..N no new plan; so endurece os gates existentes.
- **P5 D9 e medida, nao prova** — Analytics registram atrito/rework; nao afirmam causalidade anti-rubber-stamp.

## Glossary

- **spine quality lint** — detector que rejeita businessIntent presente-mas-vazio (curto, soft-language, outOfScope eco, doneWhen sem observavel).
- **tasks core** — id, title normalizado, files paths, scopeBoundary, acceptance, verifier canonico — o que o fingerprint protege.
- **allowlist materialize** — summary, weight, businessIntent, startedCommit, status, nextAction, rollups, evidence.
- **verifier smoke** — ban de comandos tautologicos no SPEC admit (exit 0, true, :, echo ok, corpo vazio).
- **D9 measure** — eventos + relatorio de lint-fail 1a tentativa, fingerprint refuse, reopen window.

## F0 — Spine quality lint + skill UX (P0)

Goal: Detector HARD de qualidade da spine + wiring em materialize e new-plan F0 + skill proof-of-work; golden tests PT/EN.

### T-001 Detector find-weak-business-intent

- Files: scripts/find-weak-business-intent.js, tests/find-weak-business-intent.test.js
- scopeBoundary: Do not change presence-only contract of find-missing-business-intent.js beyond clear composition. Do not call LLM. Do not mutate state files.
- acceptance: it - script reports first quality failure per surface plan descriptor and initiative.; it - exit 0 on strong-spine fixtures and exit 1 on documented weak-spine fixtures.; it - ban-list includes soft-language tokens aligned with docs/kb/code-quality-gates.md G2.
- verifier: { kind: test, command: "node --test tests/find-weak-business-intent.test.js", expectExitCode: 0 }

### T-002 Wire quality lint into materialize and new plan F0

- Files: skills/shared/project-assets/project-materialize.md, skills/shared/project-assets/project-create-plan.md, skills/core/project.md
- scopeBoundary: Do not auto-fill businessIntent. Do not make quality lint WARN-only. Do not edit materialize-state.js in this task.
- acceptance: it - project-materialize invokes find-weak-business-intent after presence detector.; it - project-create-plan Stage 6 F0 gate cites the same detector.; it - failure message tells operator to rewrite fields not approve-anyway without test override.
- verifier: { kind: shell, command: "rg -n 'find-weak-business-intent' skills/shared/project-assets/project-materialize.md skills/shared/project-assets/project-create-plan.md", expectExitCode: 0 }

### T-003 Skill UX proof-of-work anti-prefill

- Files: skills/shared/project-assets/project-materialize.md, skills/shared/project-assets/project-create-plan.md
- scopeBoundary: Do not add LLM detector. Do not change businessIntent schema keys.
- acceptance: it - BusinessIntent Gate states agent must not paste draft values into the five user fields.; it - generic ok/yes/do-it re-prompts like ratify.; it - derived array remains ungated.
- verifier: { kind: shell, command: "rg -n 'proof-of-work|pre-fill|pré-preench|ok genérico|generic ok' skills/shared/project-assets/project-materialize.md skills/shared/project-assets/project-create-plan.md", expectExitCode: 0 }

```yaml
exit_gate:
  - id: F0-G1
    description: find-weak-business-intent golden tests pass
    verifier: { kind: test, command: "node --test tests/find-weak-business-intent.test.js", expectExitCode: 0 }
  - id: F0-G2
    description: materialize and create-plan wire quality detector
    verifier: { kind: shell, command: "rg -n 'find-weak-business-intent' skills/shared/project-assets/project-materialize.md skills/shared/project-assets/project-create-plan.md", expectExitCode: 0 }
```

## F1 — Sidecar fingerprint + materialize-state refuse (P1)

Goal: Hash live do tasks core do sidecar vs initiative; allowlist; refuse no publish; skill red-flag R3.

### T-001 Pure hash tasks core and allowlist

- Files: src/tasks-fingerprint.js, tests/tasks-fingerprint.test.js
- scopeBoundary: Do not write project state outside tests. Do not include summary or weight in core. Title normalize is trim plus collapse whitespace.
- acceptance: it - same core yields same hash; changing acceptance verifier files id or title changes hash.; it - allowlist-only field changes do not change hash.; it - legacy sidecar without tasksFingerprint field still compares via live hash.
- verifier: { kind: test, command: "node --test tests/tasks-fingerprint.test.js", expectExitCode: 0 }

### T-002 Wire refuse in materialize-state

- Files: scripts/materialize-state.js, tests/materialize-state-fingerprint.test.js
- scopeBoundary: Do not remove atomic rename or marker recovery. Do not refuse solely because tasksFingerprint field is absent on sidecar. Do not allow silent core rewrite.
- acceptance: it - publish with rewritten tasks exits non-zero and does not rename live targets.; it - publish with only summary weight businessIntent changes exits 0.; it - integration test covers both cases.
- verifier: { kind: test, command: "node --test tests/materialize-state-fingerprint.test.js", expectExitCode: 0 }

### T-003 Skill red-flag R3 and re-spec path docs

- Files: skills/shared/project-assets/project-materialize.md, docs/kb/project-lazy-materialization.md
- scopeBoundary: Do not implement full re-spec CLI if decision is edit-source-plus-re-capture — document minimum path only. Do not auto-fix fingerprint mismatch.
- acceptance: it - red flag stops rewrite-of-sidecar-tasks thought.; it - docs describe live hash adjudicator vs initiative core.; it - path to change SPEC is explicit without materialize side-effect.
- verifier: { kind: shell, command: "rg -n 'tasksFingerprint|fingerprint|re-spec|tasks core' skills/shared/project-assets/project-materialize.md docs/kb/project-lazy-materialization.md", expectExitCode: 0 }

```yaml
exit_gate:
  - id: F1-G1
    description: fingerprint unit tests and materialize-state fingerprint tests pass
    verifier: { kind: test, command: "node --test tests/tasks-fingerprint.test.js tests/materialize-state-fingerprint.test.js", expectExitCode: 0 }
  - id: F1-G2
    description: skill and kb document refuse and re-spec path
    verifier: { kind: shell, command: "rg -n 'fingerprint|re-spec|tasks core' skills/shared/project-assets/project-materialize.md docs/kb/project-lazy-materialization.md", expectExitCode: 0 }
```

## F2 — SPEC smoke, overlap, sidecar age (P2)

Goal: Verifier tautologico HARD no admit; overlap WARN/HARD; age gate opt-in no materialize.

### T-001 Verifier smoke ban in lint-source --spec

- Files: scripts/lint-source.js, tests/lint-source-verifier-smoke.test.js
- scopeBoundary: Do not relax existing four HOW fields. Use exact-match on command body after kind not aggressive substring bans. Do not auto-mutate old plan sources.
- acceptance: it - kind shell commands exit 0 true colon echo ok and empty body fail SPEC.; it - legitimate node --test path verifier passes smoke.; it - pass and fail fixtures are asserted in tests.
- verifier: { kind: test, command: "node --test tests/lint-source-verifier-smoke.test.js", expectExitCode: 0 }

### T-002 Acceptance verifier overlap heuristic

- Files: scripts/lint-source.js, tests/lint-source-overlap.test.js, skills/shared/project-assets/plan-initiative-depth.md
- scopeBoundary: Heuristic uses basenames plus argv tokens only per design. Do not invent new schema keys.
- acceptance: it - design pass fixture and HARD-fail fixture assert correctly.; it - review-plan initiative-depth mentions overlap check.; it - messages include task id.
- verifier: { kind: test, command: "node --test tests/lint-source-overlap.test.js", expectExitCode: 0 }

### T-003 Sidecar age opt-in gate on materialize

- Files: skills/shared/project-assets/project-materialize.md, src/sidecar-age.js, tests/sidecar-age.test.js
- scopeBoundary: Do not auto re-decompose. Age uses capturedAt then mtime then plan.started. Do not block when operator continues.
- acceptance: it - helper returns shouldPrompt boolean with reasons.; it - skill preflight documents question and defaults N=14 K=12.; it - tests cover capturedAt vs mtime fallback.
- verifier: { kind: test, command: "node --test tests/sidecar-age.test.js", expectExitCode: 0 }

```yaml
exit_gate:
  - id: F2-G1
    description: smoke and overlap unit tests pass
    verifier: { kind: test, command: "node --test tests/lint-source-verifier-smoke.test.js tests/lint-source-overlap.test.js", expectExitCode: 0 }
  - id: F2-G2
    description: sidecar-age tests pass
    verifier: { kind: test, command: "node --test tests/sidecar-age.test.js", expectExitCode: 0 }
```

## F3 — D9 measure + docs (P3)

Goal: Eventos analytics + script de relatorio; docs atualizam D9 como medido; sem prova causal.

### T-001 Emit quality events

- Files: src/plan-quality-events.js, scripts/append-plan-quality-event.js, tests/plan-quality-events.test.js
- scopeBoundary: Fail-open if analytics path missing. Do not block materialize if append fails. No PII beyond plan slugs and ids already in repo.
- acceptance: it - append writes JSONL with kind planSlug phaseId ts.; it - kinds include spine_quality_fail fingerprint_refuse phase_reopen task_reopen.; it - unit test uses temp dir.
- verifier: { kind: test, command: "node --test tests/plan-quality-events.test.js", expectExitCode: 0 }

### T-002 Report plan quality script

- Files: scripts/report-plan-quality.js, tests/report-plan-quality.test.js
- scopeBoundary: Read-only over JSONL. Do not mutate plans.
- acceptance: it - CLI prints counts by kind for window default 14d.; it - exit 0 with zero events.; it - test uses fixture JSONL.
- verifier: { kind: test, command: "node --test tests/report-plan-quality.test.js", expectExitCode: 0 }

### T-003 Wire emits and D9 docs

- Files: scripts/materialize-state.js, skills/shared/project-assets/project-materialize.md, docs/kb/project-lazy-materialization.md, docs/kb/automate-orchestrator-realism.md
- scopeBoundary: Do not claim rubber-stamp reduction as proven. Do not add D10 constitution.
- acceptance: it - lazy-materialization D9 cites report-plan-quality and event kinds.; it - fingerprint refuse path emits event.; it - realism reaffirms no LLM-filled spine.
- verifier: { kind: shell, command: "rg -n 'report-plan-quality|spine_quality_fail|fingerprint_refuse|D9' docs/kb/project-lazy-materialization.md docs/kb/automate-orchestrator-realism.md", expectExitCode: 0 }

```yaml
exit_gate:
  - id: F3-G1
    description: events and report unit tests pass
    verifier: { kind: test, command: "node --test tests/plan-quality-events.test.js tests/report-plan-quality.test.js", expectExitCode: 0 }
  - id: F3-G2
    description: docs cite measure kinds
    verifier: { kind: shell, command: "rg -n 'report-plan-quality|spine_quality_fail|fingerprint_refuse' docs/kb/project-lazy-materialization.md", expectExitCode: 0 }
```

## F4 — Integration and regression

Goal: Suite cobre R1/R2/R3 end-to-end; validate-skills; dogfood dos gates.

### T-001 Integration suite three risks

- Files: tests/plan-quality-guards-integration.test.js
- scopeBoundary: Use tmp dirs only. No external network. Do not mutate live monorepo .atomic-skills plans outside fixtures.
- acceptance: it - R1 weak spine fails closed.; it - R2 tautological verifier fails SPEC.; it - R3 core mismatch refuses publish.; it - happy-path strong spine and matching core publishes.
- verifier: { kind: test, command: "node --test tests/plan-quality-guards-integration.test.js", expectExitCode: 0 }

### T-002 validate-skills and plan self-review

- Files: docs/kb/project-lazy-materialization.md, .atomic-skills/projects/atomic-skills/materialize-spec-quality-guards/plan.md
- scopeBoundary: Do not invent new top-level skills. Self-review G1 G2 G6 on plan body.
- acceptance: it - npm run validate-skills exits 0.; it - plan.md has Self-review against code-quality gates after Reviews.
- verifier: { kind: shell, command: "npm run validate-skills", expectExitCode: 0 }

```yaml
exit_gate:
  - id: F4-G1
    description: integration suite passes
    verifier: { kind: test, command: "node --test tests/plan-quality-guards-integration.test.js", expectExitCode: 0 }
  - id: F4-G2
    description: validate-skills passes
    verifier: { kind: shell, command: "npm run validate-skills", expectExitCode: 0 }
```
