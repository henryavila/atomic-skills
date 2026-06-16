---
date: 2026-06-16T14:28:01Z
topic: skills-restructuring-f1
artifact: 2d6b618..390d447 (F1 — economia de tokens em project e implement)
skill: atomic-skills:review-code
mode: local
reviewer: claude-opus-4-8 (sealed-envelope agent, clean context)
final_verdict: approved_with_followup
counts: blocker=0 critical=0 major=1 minor=1 dismissed=1
schema_version: "1.0"
---

# Local Review — skills-restructuring F1

**Ref:** `2d6b618..390d447` (the F1 phase implementation commit).
**Mode:** local (sealed-envelope agent, clean context, no intent leakage).
**Files reviewed (code-only scope):** skills/core/implement.md, skills/core/project.md,
skills/shared/implement-antipatterns.md, skills/shared/project-assets/project-create-plan.md,
skills/shared/project-assets/project-transitions.md, skills/shared/project-assets/verifier-exec.md,
src/decompose.js, tests/decompose.test.js, tests/project.test.js.
**Passes:** 2.

The `.atomic-skills/*.md` phase-tracking files in the raw range were excluded from the
review scope (project-tracking metadata, not code; one was dirty from the in-flight
evidence stamp).

## Findings

| # | Summary | Severity | File:line | Disposition |
|---|---------|----------|-----------|-------------|
| 1 | SPEC gate admits a bare `verifier: kind shell` (no command), but decompose materializes a schema-invalid `{kind:shell}` → `validate-state` HARD-FAILS the materialized initiative. | major (agent said critical; reclassified — loud failure, malformed-input edge case, no data loss) | gate: scripts/lint-source.js:275-276,351-356 · materialize: src/decompose.js:354,362,366,368,370 · spread: src/decompose.js:877 | **Deferred to a dedicated `atomic-skills:fix` task** (touches lint-source.js, outside the F1 diff). Non-blocking for F1 phase-done. |
| 2 | The bare/loose-verifier branch has no test; T1.5 tests (tests/decompose.test.js:643-704) only exercise well-formed flow-maps, so finding #1's regression is invisible to the suite. | minor | tests/decompose.test.js:643-704 | **Bundled with #1** in the follow-up fix (TDD: failing test for the bare-verifier branch first). |
| 3 | `acceptance`/`scopeBoundary` comma lists collapse into a single-element array (not split like `files`). | minor | src/decompose.js:403-404 | **Dismissed — by design, documented** at src/decompose.js:373-377 ("scopeBoundary / acceptance become single-element arrays"). Validates fine (non-empty string); refined later in the lifecycle. |

### Finding #1 — verified mechanism

- `isDeterministicVerifier` (lint-source.js:273-280) decides "deterministic" purely from the
  `kind <X>` token (line 275-276), returning `true` for `shell`/`test`/`query` regardless of
  whether `command`/`runner`/`pattern`/`sql` is present.
- `lintSpec` (lint-source.js:351-356) gates a task's verifier only on existence + `isDeterministicVerifier`
  — no per-kind completeness check. So a task with `verifier: kind shell` (no command) is **admitted**.
- `parseTaskVerifier` (decompose.js:348-371, new in T1.5) returns `{ kind }` for a loose shell/query/manual
  with no payload (lines 362,366,368) and for ALL loose `test` (line 370); the flow-map branch (line 354)
  returns any `{kind:...}` verbatim without checking required sub-fields.
- `materializeDecomposition` spreads it onto the task (decompose.js:877). The result violates
  `common.schema.json#/$defs/exitCriterionVerifier` (`oneOf` + `additionalProperties:false`),
  so `validate-state` HARD-FAILS Stage 6.

Contract drift: **gate admits → materialize emits invalid → validator rejects.** T1.5 (F1) introduced the
per-task verifier materialization, which is what makes the long-standing gate leniency reachable as a hard
failure. Proper fix aligns the three (tighten the gate to reject incomplete verifiers, harden
`parseTaskVerifier`, add the bare-verifier test).

## Verification clean (no findings)

- Content-move integrity: implement.md 18 triggers ↔ implement-antipatterns.md refutations 1:1 (none lost);
  verifier-exec.md carries all per-kind sections + GATE-R2 + G9 + Per-task.
- Verifier-token integrity: `mode2-codex-lane` (implement.md:79), `verifier-exec` (project-transitions.md:172,174)
  present; pointers resolve.
- API contracts: exported `decomposePlan`/`materializeDecomposition`/`previewDecomposition` unchanged;
  new fns module-private.
- Race conditions / error handling / file references: ok.

## Self-review against code-quality gates (review session)

- **G1 read-before-claim:** applied — each finding verified by reading the cited source
  (lint-source.js:273-280/351-356, decompose.js:348-411/877) before classification; no fix applied this session.
- **G2 soft-language:** applied — dispositions state facts (admitted/materializes invalid/HARD-FAILS), no should/probably.
- **G3 anti-tautology:** N/A — no test written this session (the test is part of the deferred fix).
- **G4 fixture realism:** N/A — no fixture written.
- **G7 anti-premature-abstraction:** N/A — no helper introduced.

## Follow-up (tracked)

- **FU-F1-1** — Align the verifier contract: tighten `isDeterministicVerifier`/`lintSpec` (lint-source.js)
  to reject a verifier missing its per-kind required field, harden `parseTaskVerifier` (decompose.js) to never
  emit an incomplete verifier object, and add the bare-verifier regression test (covers findings #1 + #2).
  Run via `atomic-skills:fix`. Surfaced at F1 phase-done review, 2026-06-16.
