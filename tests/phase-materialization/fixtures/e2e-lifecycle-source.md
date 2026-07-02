# E2E Lifecycle Plan

This source exercises the full lazy lifecycle: F0 starts materialized, F1 and
F2 begin as descriptor-only phases, and F1 is later materialized from its
retained source.

## Inviolable principles

- **P1 Lazy boundary** — Future phases stay descriptor-only until activation.
- **P2 Business gate** — A materialized phase carries a businessIntent spine in
  the plan descriptor and the initiative frontmatter.

## Glossary

- **Descriptor-only phase** — A plan phase with no initiative markdown file yet.
- **Materialized phase** — A phase with an initiative markdown file under
  `phases/`.

## F0 — Intake baseline

Goal: establish the first active phase before any downstream work is expanded.

```yaml
exit_gate:
  - id: F0-G1
    description: Intake fixture verifier passes
    verifier: { kind: shell, command: "node --test tests/e2e/f0.test.js", expectExitCode: 0 }
```

### T-001 Capture intake fixture

Create the fixture input used by the first phase.

- Files: tests/e2e/f0.test.js
- ScopeBoundary: only the F0 fixture test path; do not alter lifecycle code
- Acceptance: F0 can close with a deterministic shell verifier
- Verifier: { kind: shell, command: "node --test tests/e2e/f0.test.js", expectExitCode: 0 }

## F1 — Customer handoff

Goal: materialize the customer-facing handoff work only after the business gate
is answered.

```yaml
exit_gate:
  - id: F1-G1
    description: Handoff fixture verifier passes
    verifier: { kind: shell, command: "node --test tests/e2e/f1.test.js", expectExitCode: 0 }
```

### T-002 Build handoff checklist

Create the first handoff artifact after the phase is materialized.

- Files: tests/e2e/f1-checklist.test.js
- ScopeBoundary: only the F1 checklist test path; do not alter lifecycle code
- Acceptance: materialized F1 carries tasks parsed from the retained source
- Verifier: { kind: shell, command: "node --test tests/e2e/f1-checklist.test.js", expectExitCode: 0 }

### T-003 Verify handoff routing

Create the second handoff artifact after the phase is materialized.

- Files: tests/e2e/f1-routing.test.js
- ScopeBoundary: only the F1 routing test path; do not alter lifecycle code
- Acceptance: F1 activation updates the plan descriptor without timestamp fields
- Verifier: { kind: shell, command: "node --test tests/e2e/f1-routing.test.js", expectExitCode: 0 }

## F2 — Renewal loop

Goal: keep the next phase descriptor-only after F1 activation.

### T-004 Draft renewal fixture

Create a later-phase fixture that must not materialize during the F1 lifecycle.

- Files: tests/e2e/f2-renewal.test.js
- ScopeBoundary: only the F2 renewal test path; do not alter lifecycle code
- Acceptance: F2 remains descriptor-only while F1 is active
- Verifier: { kind: shell, command: "node --test tests/e2e/f2-renewal.test.js", expectExitCode: 0 }
