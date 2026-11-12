# Verifier execution patterns (canonical single source)

This is the **single source** for how `atomic-skills:verify-claim` runs a verifier and records the result. Do not re-derive the PASS rule or the `evidence` shape in the caller.

## Verifier execution patterns

Applies to one claim whose verifier is `kind: shell`, `kind: test`, `kind: query`, or `kind: manual`.

The output of every successful or attempted verification is an `evidence` block:

```yaml
evidence:
  verifierKind: shell | query | test | manual
  verifiedAt: <ISO8601>
  verifiedCommit: <git SHA>    # HEAD at run time (`git rev-parse HEAD`)
  passed: true | false
  exitCode: <integer>          # shell / test — observed process exit code
  testsCollected: <integer>    # test only — number of tests the runner actually ran
  rowCount: <integer>          # query only
  outputSummary: "<≤500 chars excerpt or user note>"
  mutation:                    # test only, OPTIONAL
    target: "<file:line>"
    change: "<behavioral mutation applied at target>"
    killedBy: ["<test(s) that went RED on the mutation>"]
    killTranscript: "<≤500-char inject → RED → revert → GREEN excerpt>"
```

A deterministic verifier (`shell` / `test` / `query`) is a pass only when `evidence.passed === true` and the kind-specific fields below are present. The result must come from a real run. `kind: manual` is a human acknowledgement, not a deterministic pass.

**HEAD anchor.** Every successful run stamps `verifiedCommit: $(git rev-parse HEAD)` (full or abbreviated lowercase hex, 7–40 chars). When later edits move HEAD, the previous evidence is stale — run the verifier again and refresh `verifiedCommit`.

### `kind: shell`

1. Present the claim and the full `command`.
2. Ask: "Run this verifier? (y/N)" — intrusive-actions rule applies.
3. On `y`: execute with {{BASH_TOOL}}, capture the exit code and a tail of stdout (≤500 chars). Compare the exit code with `expectExitCode` (default `0`).
4. Write `evidence`:
   - `verifierKind: shell`, `verifiedAt: <now>`, `verifiedCommit: $(git rev-parse HEAD)`
   - `exitCode: <observed>`, `passed: <bool>`
   - `outputSummary: <stdout tail>`
5. `passed === true` only when the observed exit code equals `expectExitCode`.

### `kind: manual`

1. Present the claim and the verifier's `description`.
2. Ask: "Confirm this claim is met? (y/n)".
3. Write `evidence`:
   - `verifierKind: manual`, `verifiedAt: <now>`, `verifiedCommit: $(git rev-parse HEAD)`
   - `passed: <true if y else false>`
   - `outputSummary: <user's note, or empty>`
4. A manual claim is not a deterministic pass. Say so in the verdict.

### `kind: query`

A `kind: query` verifier is incomplete without both `sql` and a numeric `expectRowCount`. Without an expected count there is no equality to evaluate. Optional `connectionCommand` is the only path to a real run.

When `connectionCommand` is absent, the claim is **not a pass** — do not invent a row count. A user-typed number is not evidence.

1. **Admit check.** If `sql` or `expectRowCount` is missing, refuse the verifier as incomplete.
2. Present `sql`, `expectRowCount`, and `connectionCommand` (if any).
3. **Real run:** if `connectionCommand` is present, execute it with {{BASH_TOOL}}, capture the actual `rowCount`, and write `evidence` (`verifierKind: query`, `verifiedAt`, `verifiedCommit`, `rowCount`, `passed: <rowCount === expectRowCount>`, `outputSummary`). `passed === true` only when the observed count equals `expectRowCount`.
4. **No connection command:** write `evidence` with `passed: false` and no fabricated `rowCount`.

### `kind: test`

The runner is executed for real. Its output, not a self-report, is the evidence.

1. Present `runner` and `pattern`.
2. Ask: "Run the test pattern (`<runner> <pattern>`)? (y/N)".
3. On `y`: execute `<runner> <pattern>` with {{BASH_TOOL}}. Capture the exit code and a tail of stdout (≤500 chars). **Parse the number of tests the runner actually collected** (node `# tests N` / `ℹ tests N`; jest `Tests: … total`; pytest `collected N items`).
4. Write `evidence`:
   - `verifierKind: test`, `verifiedAt: <now>`, `verifiedCommit: $(git rev-parse HEAD)`
   - `exitCode: <observed>`, `testsCollected: <parsed integer>`, `passed: <bool>`
   - `outputSummary: <stdout tail>`
5. `passed === true` only when the **exit code is 0 AND `testsCollected > 0`**. A non-zero exit, 0 tests collected, or an unparseable count is `passed: false`.

> **Optional mutation check:** after a green run you may inject one behavioral mutation at a recorded `file:line`, re-run, and confirm a test goes red, then revert. Record it in `evidence.mutation`. A surviving mutant is a fail — do not report a pass.

### No verifier present

There is nothing to execute. Report that the claim has no deterministic verifier. Do not invent a pass.
