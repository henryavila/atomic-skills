# Decision log (automate) — operator mental model

**Canonical asset:** `skills/shared/implement-decision-log.md`  
**Helper:** `src/decision-log.js` (`appendDecision`, `listDecisions`)

## Why it exists

Under `implement --mode=automate`, routing, tradeoffs, review dispositions, and
scope exits must be **durable and auditable** without chat history. The
**decision log** is that record. Chat-only notes do not count for
**decision-review**.

## Path

```text
.atomic-skills/projects/<project-id>/<plan-slug>/decisions/<phaseId>.jsonl
```

One JSON object per line. Append-only.

## Entry fields (required)

`id`, `category`, `decision`, `why`, `evidencePath`, `impact`, `at` (ISO-8601).

**Minimum categories:** `routing`, `tradeoff`, `review-disposition`,
`scope-exit`, `manual-gate-delegation`, `env`.

## Who writes PASS

| Role | Decision entries | decision-review PASS |
|------|------------------|----------------------|
| Agent / host maestro | Append only | **Never** |
| Operator | May append | **Only operator** |

Silent auto-PASS is forbidden. Evaluation agents never auto-PASS
decision-review. No secrets or writer-lease secrets in the log.

## Operator checklist before phase-done

1. Open the phase `decisions/<phaseId>.jsonl`.
2. Confirm every re-dispatch, skip, disposition, and scope exit has an entry.
3. Read linked `evidencePath` receipts when non-`none`.
4. Record **decision-review PASS** (or FAIL) yourself — the agent will not.

Full contract, append triggers, and helper surface live in the skill asset.
