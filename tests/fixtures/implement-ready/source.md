# Implement Ready Demo

End-to-end fixture for the implement-ready path: lintSpec → decompose → schema →
target resolution → verifier → done → resume.

## Inviolable principles

- **P1 Spec admitted** — every task carries outputs, exclusions, acceptance, and a deterministic verifier.

## Glossary

- implement-ready — a task that implement can execute without inventing SPEC fields.

## F0 — Bootstrap ready task

Goal: materialize one task that closes through a real shell verifier.

### T-001 Write the ready marker

- Files: src/ready-marker.js, tests/ready-marker.test.js
- scopeBoundary: do not touch package-lock.json; never edit src/secret.js
- acceptance: ready-marker exports MARKER and its test passes with exit 0
- verifier: { kind: shell, command: "node --test tests/ready-marker.test.js", expectExitCode: 0 }
