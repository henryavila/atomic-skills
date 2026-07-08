# project — verifier execution patterns (canonical single source · lazy detail)

This is the **single source** for the Verifier execution patterns (`verify_exit_gate` workflow). It was extracted out of `project-transitions.md` (T1.4) so every caller — `phase-done`, per-task `verifier:` fields, `archive`'s gate-resolution step, `reconcile`, `atomic-skills:verify-claim`, and the `implement` driver's verify-on-done — references **one** definition instead of re-deriving it (P1 single-source-of-truth). `project-transitions.md` now points here; do not inline this executor into the callers (that is the scope-boundary the extraction protects).

## Verifier execution patterns (`verify_exit_gate` workflow)

Applies to **each** `ExitCriterion` with `status === 'pending'` (or any criterion the user asks to re-verify). Used by `phase-done`, by per-task `verifier:` fields, by `archive`'s gate-resolution step, and by ad-hoc verification from the user.

The output of every successful (or attempted) verification is stamped into the criterion's optional `evidence` block. The shape is:

```yaml
evidence:
  verifierKind: shell | query | test | manual
  verifiedAt: <ISO8601>
  passed: true | false
  exitCode: <integer>          # shell / test — observed process exit code
  testsCollected: <integer>    # test only — number of tests the runner actually ran
  rowCount: <integer>          # query only
  outputSummary: "<≤500 chars excerpt or user note>"
  mutation:                    # test only, OPTIONAL (G9 mutation-kill)
    target: "<file:line>"
    change: "<behavioral mutation applied at target>"
    killedBy: ["<test(s) that went RED on the mutation>"]
    killTranscript: "<≤500-char inject → RED → revert → GREEN excerpt>"
```

`evidence` is REQUIRED to set `status: met` when a deterministic verifier (`shell`/`test`/`query`) is present. This is not advisory: **`scripts/validate-state.js` enforces the met-invariant (GATE-R2)** and HARD-FAILS any `met` criterion (or `done` task) whose `shell`/`test`/`query` verifier lacks `evidence.passed === true` — plus, for `kind: test`, `evidence.testsCollected > 0` (a pattern matching 0 tests is **never** `met`), and for `kind: query`, a numeric `evidence.rowCount`. So a verifier result must come from a REAL run, not an assertion. Without passing evidence, the criterion stays `pending` (manual override → `deferred` with `deferredReason`). `kind: manual` and verifier-absent criteria are not gated by GATE-R2 (the manual-acceptance gate and user-overrides govern those).

### `kind: shell`

1. Present the criterion `id` + `description` + the full `command` to the user.
2. Ask: "Run this verifier? (y/N)" — intrusive-actions rule applies.
3. On `y`: execute with {{BASH_TOOL}}, capture exit code AND a tail of stdout (≤500 chars). Compare exit code with `expectExitCode` (default `0`).
4. Write `evidence`:
   - `verifierKind: shell`, `verifiedAt: <now>`
   - `exitCode: <observed>`, `passed: <bool>`
   - `outputSummary: <stdout tail>`
5. If `passed === true`: set `status: met`, `metAt: <now>`.
6. If `passed === false`: ask "Mark `deferred` with a reason, retry, or leave pending?".
   - On `deferred`: keep the `evidence` block (so the failed run is recorded), set `status: deferred`, capture `deferredReason`.
   - On retry: loop back to step 3.
   - On leave-pending: keep `evidence` (records the failed attempt) but leave `status: pending`.

### `kind: manual`

1. Present the criterion `id` + `description` + the verifier's `description`.
2. Ask: "Confirm this criterion is met? (y/n/defer)".
3. Write `evidence`:
   - `verifierKind: manual`, `verifiedAt: <now>`
   - `passed: <true if y else false>`
   - `outputSummary: <user's note, or empty>`
4. On `y`: set `status: met`, `metAt: <now>`.
5. On `n`: ask "Mark `deferred` (with reason) or leave `pending`?". Apply.
6. On `defer`: capture `deferredReason`, set `status: deferred`.

### `kind: query` (DEFERRED-BY-DESIGN — no DB connection)

This repository assumes **no live DB connection**, so `kind: query` is deferred by design — NOT a silent stub. A user-pasted row count must **never** flip a criterion to `met`: that is exactly the fabricated-pass hole the gate system exists to kill (GATE-R2 hard-fails a `met` query criterion that lacks a numeric `evidence.rowCount` from a real run).

1. Present the criterion `id` + `description` + `sql` + `expectRowCount` (if any).
2. **Escape hatch (only path to `met`):** if — and only if — the caller supplies a real connection command, execute it with {{BASH_TOOL}}, capture the actual `rowCount`, and write `evidence` (`verifierKind: query`, `verifiedAt: <now>`, `rowCount: <observed integer>`, `passed: <rowCount === expectRowCount>`, `outputSummary`). Set `status: met` only when `passed === true`.
3. **Default (no connection command):** set `status: deferred`, write `deferredReason` (e.g. `"query verifiers run out-of-band; no DB connection in this repo"`), and write `evidence` with `passed: false` and NO fabricated `rowCount`. Do not ask the user to type a row count — a self-reported number is not evidence.

### `kind: test`

Mirrors `kind: shell` — the runner is executed for real and its result, not a self-report, is the evidence.

1. Present the criterion `id` + `description` + `runner` + `pattern`.
2. Ask: "Run the test pattern (`<runner> <pattern>`)? (y/N)" — intrusive-actions rule applies.
3. On `y`: execute `<runner> <pattern>` with {{BASH_TOOL}}, capture the exit code AND a tail of stdout (≤500 chars). **Parse the number of tests the runner actually collected/ran** from its output (e.g. node `# tests N` / `ℹ tests N`; jest `Tests: … total`; pytest `collected N items`). A run is `passed` only when the **exit code is 0 AND `testsCollected > 0`**.
4. Write `evidence`:
   - `verifierKind: test`, `verifiedAt: <now>`
   - `exitCode: <observed>`, `testsCollected: <parsed integer>`, `passed: <bool>`
   - `outputSummary: <stdout tail>`
5. If `passed === true`: set `status: met`, `metAt: <now>`.
6. If `passed === false` — **including the paranoid false-greens: non-zero exit, 0 tests collected, runner-not-found / count unparseable** (treat all three as `passed: false`, never `met`) — ask "Mark `deferred` with a reason, retry, or leave pending?".
   - On `deferred`: keep the `evidence` block (records the failed/empty run), set `status: deferred`, capture `deferredReason`.
   - On retry: loop back to step 3.
   - On leave-pending: keep `evidence`, leave `status: pending`.

> **G9 mutation-kill (optional, behavioral-test gate):** for a `kind: test` criterion guarding a NAMED acceptance criterion, after a GREEN run you MAY inject one adversarially-chosen behavioral mutation at a recorded `file:line`, re-run, and confirm a test goes RED (then revert → GREEN). Record it in `evidence.mutation` (`target`/`change`/`killedBy`/`killTranscript`). A surviving behavioral mutant = tautological/mock-only test = HARD FAIL — do not mark `met`.

### No verifier present

Treat as `kind: manual` with an empty `description`. Ask the user for explicit ack before marking `met`.

### Per-task verifiers (`tasks[].verifier`)

When closing a task (`done <task-id>`) whose entry has a non-empty `verifier:`, the `done` flow itself executes this per-kind workflow **before** marking the task done. There is no evidence handoff from `verify-claim`: a pre-close `verify-claim` run can inform the operator, but `tasks[].evidence` is written only from the verifier run performed by `done`. Write the result into the task's own `evidence:` block (schemaVersion 0.2, `tasks[].evidence`, the exact same shape as criterion evidence) and stamp `closedAt` only after passing evidence exists. If a deterministic verifier fails, is skipped, or cannot produce required evidence, leave the task status unchanged; task statuses do not have a `deferred` value. Do NOT record the result as a free-text note in `description` — a prose string is unparseable, so it can never be machine-enforced. GATE-R2 covers `done` tasks identically: a task with a `shell`/`test`/`query` verifier that is `done` without passing `evidence` HARD-FAILS `validate-state`.
