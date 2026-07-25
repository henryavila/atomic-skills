# Decision log — durable per-phase append path (lazy asset)

Consumed by `skills/core/implement.md` when `isAutomateActive` (pure maestro). The
**decision log** is the durable, machine-addressable record of load-bearing
automate decisions for a phase. Chat-only notes and handoff prose do **not**
count as recorded decisions for decision-review.

Not a top-level skill. Machine helpers: `src/decision-log.js`
(`appendDecision`, `listDecisions`, `decisionLogPath`). Operator mental model:
`docs/kb/implement-decision-log.md`.

---

## Durable path (per phase)

Canonical append-only JSONL under the plan tree:

```text
.atomic-skills/projects/<project-id>/<plan-slug>/decisions/<phaseId>.jsonl
```

| Segment | Meaning | Example |
|---------|---------|---------|
| `project-id` | Nested project id | `atomic-skills` |
| `plan-slug` | Plan slug | `implement-phase-agents` |
| `phaseId` | Phase id as on the plan (`F0`…`Fn`) | `F1` |

Examples:

```text
.atomic-skills/projects/atomic-skills/implement-phase-agents/decisions/F1.jsonl
```

Resolve **only** via `decisionLogPath({ statusRoot, projectId, planSlug, phaseId })`
segments. `appendDecision` / `listDecisions` require `projectId` + `planSlug` +
`phaseId` (with optional `statusRoot`); arbitrary absolute/relative path overrides
that escape the `decisions/` tree are **rejected**. Path id segments are
allowlisted `[A-Za-z0-9._-]+`.

**Format:** one JSON object per line (JSONL). Append-only — never rewrite prior
lines to invent history. Empty file or missing file means zero entries. New log
files are created mode `0o600` when possible.

---

## Required entry fields

Every decision entry **MUST** include:

| Field | Type | Meaning |
|-------|------|---------|
| `id` | string | Stable unique id for the entry (e.g. UUID or `dec-<ISO>-<n>`). Auto-generated when omitted. |
| `category` | string | One of the categories below (required; missing rejected). |
| `decision` | string | What was decided (required; empty/whitespace rejected). |
| `why` | string | Rationale so the next session / operator does not re-litigate (**required; non-empty after trim**). |
| `evidencePath` | string | Path or URI to supporting evidence (claim report path, review receipt, verifier transcript path). **Defaults to `none` only when the field is omitted**; empty string when provided is rejected. |
| `impact` | string | What changes because of this decision (routing, scope, close path, risk) (**required; non-empty after trim**). |
| `at` | string | ISO-8601 timestamp when the decision was recorded. Auto-now when omitted; **invalid provided values throw** (no silent replace). |

Optional fields (allowed, never required for append): `phaseId`, `taskId`,
`actor` (`maestro` \| `phase-writer` \| `evaluator` \| `operator` \| `host`),
`relatedCommitShas`, `notes`.

### Categories (minimum set)

| Category | Use when |
|----------|----------|
| `routing` | Re-dispatch, stop, leave-automate, Mode-1 re-entry, spawn/skip phase agent. |
| `tradeoff` | Product/eng tradeoff that changes behavior beyond pure task text. |
| `review-disposition` | Review severity disposition: `accept` \| `defer` \| `fix` (or equivalent). |
| `scope-exit` | Required violation of `scopeBoundary` / runtime scope exit. |
| `manual-gate-delegation` | Manual gate parked, delegated, or operator-owned step deferred with reason. |
| `env` | Verifier environment / tool / runtime choice that affects reproducibility. |

Other categories may be appended later; helpers should accept known extensions
without inventing silent PASS semantics.

---

## Who writes what (HARD)

| Actor | May | Must not |
|-------|-----|----------|
| **Agent** (maestro host, phase writer brief notes via orchestrator, evaluator surfaces) | **Append** decision entries only (`appendDecision`) | Write **decision-review PASS**; invent chat-only as durable; store secrets |
| **Operator** | Append entries if desired; **write decision-review PASS** (or FAIL) on the manual hardgate | Be replaced by silent auto-PASS |

**Rule.** Only the **operator** writes **decision-review PASS**, and only via an
**explicit same-turn token** (e.g. `decision-review PASS` / `ratify decision-review`).
Host/agent **never** stamp `phases[].decisionReview status=passed` without that
token. Agents **only append decision entries**. Silent auto-PASS of
decision-review is forbidden. The evaluation agent never auto-PASS
decision-review; review-code receipts never substitute. Machine stamp uses
`buildDecisionReview` / schema field `decisionReview` separately from this
append path — `appendDecision` **never** sets `decisionReview.status` to
`PASS` / `passed`.

### Secrets fence

**Do not** store secrets, API keys, writer-lease secrets, lease token hashes, or
acquire secrets in the decision log. Reference lease *existence* or public
identity fields only when needed; never the clear secret.

Helpers reject **high-signal** shapes in `decision` / `why` / `impact` / `notes`
(e.g. long 64-hex digests, `sk-…` tokens, `Bearer …`, `api_key=…`,
`Authorization:` headers). This is a minimal fence — **residual secret hygiene
is caller duty**; shapes that evade the regexes must still never be appended.

---

## When to append (automate)

Before continuing after any of the following, append a decision log entry
(category in parentheses):

1. **Re-dispatch** of a code-only fix agent (`routing`)
2. **Skip** of a step that would otherwise run under automate (`routing` or `manual-gate-delegation`)
3. **Review disposition** `accept` \| `defer` \| `fix` (`review-disposition`)
4. **Scope exit** required by implementation (`scope-exit`)
5. **Product/eng tradeoff** that changes behavior outside pure task text (`tradeoff`)
6. **Leave-automate** / `--clear-execution-mode` / Mode-1 re-entry (`routing` or `env` as appropriate)
7. **Manual-gate delegation** or operator stop after max re-dispatch (`manual-gate-delegation` / `routing`)

Chat narrative and `## Session handoff` **Decision log** bullets may *summarize*
entries; they do not replace JSONL append for decision-review audit.

---

## decision-review (operator PASS procedure)

Under automate, **decision-review** is a mandatory **manual hardgate** after
evaluation and **before / as part of** phase-done preflight. Fixed order:

```text
tasks done → evaluation agent → evaluationGate stamp
  → decision-review operator PASS (this section)
  → stamp phases[].decisionReview (status=passed + verifiedAt)
  → canRunPhaseDone / assert-automate-gate --gate phase-done
  → phase-done with review-code --mode=both
```

### Operator PASS (closes the gate)

1. Operator reads the phase `decisions/<phaseId>.jsonl` (and linked evidence).
2. Operator issues an **explicit token in the same turn** that authorizes PASS
   (e.g. `decision-review PASS`, `ratify decision-review`, or equivalent clear
   PASS language). Chat from a prior turn does **not** authorize a new stamp.
3. **Only then** may the host stamp `phases[].decisionReview` via
   `buildDecisionReview({ status: 'passed', verifiedAt: <ISO>, evidencePath? })`.
4. Host/agent **never** writes `decisionReview status=passed` without that
   explicit operator token in the **same turn**. Silent auto-PASS is forbidden.
5. Evaluation agent output, `evaluationGate`, and review-code receipts **must
   not** substitute for decision-review PASS.

### Operator FAIL (does not advance)

1. Operator records **FAIL** on decision-review (same-turn explicit FAIL token).
2. Host stamps `phases[].decisionReview` `{ status: 'failed', verifiedAt: <ISO> }`.
3. **Do not** run phase-done terminal write; **do not advance** `currentPhase`.
4. Resume path: reopen / re-dispatch / park; re-run decision-review after fixes
   until a later operator PASS.

### Machine check

- `decisionReviewAllowsPhaseDone` / `canRunPhaseDone` require `status=passed`
  + `verifiedAt` under durable automate; pending / failed / absent → block.
- `assert-automate-gate --gate phase-done` fails closed without both
  evaluationGate and decisionReview passed.
- Non-automate plans: decisionReview field optional; gate inactive.

---

## Helper surface (`src/decision-log.js`)

| Function | Role |
|----------|------|
| `decisionLogPath({ statusRoot, projectId, planSlug, phaseId })` | Resolve durable path |
| `appendDecision(statusRootOrPath, entry)` | Validate + append one entry; returns written row |
| `listDecisions(statusRootOrPath, opts?)` | Read/parse entries for a phase path |
| `DECISION_CATEGORIES` | Frozen minimum category list |
| `REQUIRED_DECISION_FIELDS` | Frozen required field names |

Validation rejects missing `category`, empty `decision` / `why` / `impact`,
invalid provided `at`, high-signal secret shapes, and path escapes outside
`decisions/`. No network I/O. No API stamps decision-review PASS.

---

## Cross-links

- Maestro loop: `skills/shared/implement-automate-maestro.md`
- Phase writer: `skills/shared/implement-phase-writer.md`
- Implement skill: `skills/core/implement.md`
- Evaluation order: `skills/shared/implement-phase-evaluator.md`
- KB summary: `docs/kb/implement-decision-log.md`
