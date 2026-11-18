# Decision package — project-flow F0

Present-before-PASS. Operator evaluates at plan-end (`userValidatedAt`). This file is the package body.

## Decisions (F0.jsonl)

1. **routing** — Automate default + review-code --mode=local; go through F0→F2; operator evaluates at plan-end.
2. **manual-gate-delegation** — Ratify F0 phase-start package as already-materialized BI; spawn F0 writer.
3. **routing** — Drop overlapping base/head; exclusive commitShas; merge writer; clear lease.
4. **review-disposition** — T-002 complex close via operator-disposition accept + local review.

## Product tradeoffs from writer

None recorded beyond MODEL as specified.

## Operator action

decision-review PASS | FAIL is operator-owned. Not stamped passed by the host.
