Turn a claim of completion ("the task is done", "the tests pass", "the bug is fixed") into a **verified fact** backed by the observed result of a fresh run — or a binary FAIL. verify-claim is the completion-evidence gate `implement` calls before any task is marked done: it runs the task's deterministic verifier for real, derives a binary verdict from the actual result, and cites the evidence. A producer never grades its own work.

If {{ARG_VAR}} was provided, use it as the claim under verification (e.g. a task id, a criterion, or "the X feature works"). If not, ask the user: "What is being claimed done, and what is the deterministic verifier (the `runner`/`pattern`, shell `command`, or query) that proves it?"

## Iron Law

NO SUCCESS CLAIM WITHOUT FRESH VERIFICATION.

A claim that something works, passes, or is done is an **opinion** until a fresh run produces the evidence. The verdict is derived from the observed result of executing the verifier — never from the producer's report, narrative, or summary. When the work was produced by another agent (a cheap-tier or cross-provider executor), the evidence is the **committed diff and the re-executed verifier**, not what the executor said it did.

<HARD-GATE>
If you are about to mark a task done because the implementer (you, a subagent, or Codex) *reported* success: STOP. Read the VCS diff and run the verifier yourself. The report is the claim, not the evidence.
If you are about to accept `passed: true` that was written without a captured run: STOP. A self-asserted pass is the exact fabricated-met hole the gate system exists to kill.
</HARD-GATE>

## Mindset

A self-graded claim is worthless precisely when it matters most — the producer is the party least able to see its own blind spot. verify-claim exists to make the cheap, honest path (run the verifier, paste the output) cheaper than the dishonest one (assert it works). The verdict is **binary**: PASS only when the real run says so; everything else is FAIL, which routes back to work, not forward to done.

"Cheap model never self-certifies" is the same rule pointed at a foreign executor. A Haiku/Sonnet/Codex run can self-**check** (run the verifier before returning), but the only paths to done are: the verifier passes on re-execution, OR a stronger model reviews and approves. The executor's own "I'm confident this is correct" certifies nothing.

## The gate function

Run these five steps; the verdict comes out of step 4, never out of step 1.

1. **Name the claim and its verifier.** State exactly what is asserted done and the deterministic verifier admitted at SPEC time (the task's `verifier:` — `kind shell|test|query`). If the claim has no deterministic verifier, it is not verify-claim's to pass: a `kind: manual` / human-judgement claim routes to the manual-acceptance gate (`{{ASSETS_PATH}}/project-transitions.md` § `kind: manual`), not here. No verifier at all ⇒ the task should not have been admitted (R-ORCH-23) — surface that, do not invent a pass.
2. **Read the diff, not the report.** Run `git diff` (and `git -C <worktree> diff` for an isolated executor) to see what actually changed. Confirm the change exists and is in scope; a claim of "done" over an empty or out-of-scope diff is FAIL before any test runs.
3. **Execute the verifier for real.** Follow the canonical **Verifier execution patterns** — the single source is `{{ASSETS_PATH}}/verifier-exec.md` (`project-transitions.md` delegates there); do not re-implement or diverge from it. Capture exactly what that spec mandates: the exit code, and for `kind: test` the parsed tests-collected count; for `kind: shell` a ≤500-char stdout tail.
4. **Derive the binary verdict from the observed result** — using the canonical per-kind PASS rule in `{{ASSETS_PATH}}/verifier-exec.md` (do not re-derive it here), never a hardcoded exit-0. PASS only when the observed result matches the verifier's expectation: for `kind: shell`, the **exit code equals the verifier's `expectExitCode` (default `0`)** — a shell verifier may legitimately expect a non-zero code (e.g. a `grep` that should match nothing); for `kind: test`, **exit code `0` AND `testsCollected > 0`**. The three paranoid false-greens are each a FAIL, never a pass (R-XAGENT-07): a **mismatched exit code**, **0 tests collected** (a pattern that matched nothing — vitest/jest/node all exit 0 on an empty selection), and **runner-not-found / count unparseable**. "The suite is green" with zero tests collected is the literal false-green this gate exists to catch.
5. **Cite the evidence.** Write the canonical `evidence` block (the shape lives in `{{ASSETS_PATH}}/verifier-exec.md`: `verifierKind`, `verifiedAt`, `passed`, `exitCode`, `testsCollected`, `outputSummary` ≤500 chars). `status: met` / task `done` is admissible ONLY when `passed === true` AND the evidence is present — which `scripts/validate-state.js` (GATE-R2) then re-enforces deterministically. On FAIL, the evidence block is still written (it records the failed run) and the claim stays open: route to `atomic-skills:fix`, retry, or surface — never to done.

## Claim → evidence (what actually counts)

| The claim | NOT evidence | Evidence |
|-----------|--------------|----------|
| "The tests pass" | "I ran them and they're green" | the runner output pasted, with a non-zero tests-collected count and exit 0 |
| "The bug is fixed" | "I made the change" | the regression test that failed now passes + the `git diff` |
| "The task is done" | the implementer's status report | the verifier re-executed by you + the in-scope diff |
| "Codex/the subagent finished it" | the executor's narrative / self-rated confidence | the committed diff read directly + the verifier re-run on the merged tree |
| "It builds / lints clean" | "should be clean now" | the build/lint command's exit code captured this run |
| "Nothing else broke" | "the change is small" | the full suite re-run, exit 0, count unchanged-or-higher |

The pattern is one rule: the left column is what a producer *says*; the right column is what a fresh execution *shows*. Only the right column moves a claim to met.

## Cross-agent note

The verifier runs via {{BASH_TOOL}} and the evidence persists to durable `.atomic-skills/` state — zero host-orchestration tooling, identical on every IDE. When the heavy reading of a large diff would flood the main context, delegate it to a read-only {{INVESTIGATOR_TOOL}} subagent that returns a distilled summary (the verdict still comes from the executed verifier, not the subagent's opinion).

## Code-quality gates

This flow is bound by `docs/kb/code-quality-gates.md`:

- **G1 read-before-claim** — paste the verifier output / diff lines the verdict rests on; never infer a pass from a description.
- **G2 soft-language ban** — the verdict carries no `should`/`probably`/`works`/`looks good`; it is `passed: true|false` with the observed result.
- **G6 reference-or-strike** — the `evidence.outputSummary` cites the real run; a bare `passed: true` with no captured output is struck.

## Self-review against gates

Before returning the verdict, append:

```
- G1 read-before-claim: applied — <verifier output / diff pasted> 
- G2 soft-language: applied — verdict is binary passed:true|false, no "works"/"looks good"
- G6 reference-or-strike: applied — evidence.outputSummary cites the captured run
```

Silent application is forbidden; the checkpoint ships with the verdict.

## Red Flags

- "The implementer reported success, I'll mark it done." → The report is the claim. Read the diff and run the verifier (HARD-GATE).
- "The suite is green, ship it." → Green with zero tests collected is the false-green. Check the count, not just the exit code.
- "The verifier's runner isn't installed here, I'll assume it would pass." → runner-not-found is a FAIL, never a met. Surface it.
- "Codex says it's confident, that's good enough." → A cheap/foreign executor never self-certifies. Re-execute the verifier; the only paths to done are verifier-pass or strong-model approval.
- "I'll write `passed: true` and capture the output later." → A pass without a captured run is fabricated-met. The evidence is the entry token, not a follow-up.
- "The diff is empty but the task is obviously trivial, mark it done." → A claim of done over an empty/out-of-scope diff is FAIL at step 2, before any test.
- "It's manual/judgement, I'll just press y." → Human-judgement claims route to the manual-acceptance gate with a pasted observation — not a bare y here.
- "Exit 0 — if zero tests ran that's the framework's problem, and CI will catch it anyway." → The 0-count IS the result you must read, not a framework footnote; deferring to CI ships the false-green downstream; and hours already spent are not evidence. PASS needs exit 0 AND a non-zero tests-collected count, derived here, now.

If you thought any of the above: STOP. Go back to the gate function and run the verifier.

## Rationalization

| Temptation | Reality |
|------------|---------|
| "I just wrote the code, of course it works" | The author is the worst judge of their own blind spot. The fresh run is the judge, not your confidence. |
| "Re-running the verifier is redundant, the executor already ran it" | The executor *self-checks*; it cannot *self-certify*. Re-execution against the committed/merged tree is the only adjudicator (R-EXEC-28). |
| "Exit code 0 means it passed" | Not for `kind: test` — exit 0 with 0 tests collected is a vacuous pass. PASS needs exit 0 AND a non-zero collected count. |
| "The output is long, I'll trust the summary" | Trust the captured tail you read this run; delegate the bulk read to a read-only subagent, but derive the verdict from the executed result, not the summary's adjective. |
| "Failing verifier, but the change is clearly right — mark it done, fix later" | A FAIL routes to `fix`, never to done. "Fix later" is how a fabricated-met enters the state and GATE-R2 then HARD-FAILS validate-state. |
| "No verifier on this task, I'll just confirm it manually" | A task with no deterministic verifier failed the SPEC admission gate (R-ORCH-23). Surface the missing verifier; do not paper over it with a press of y. |
| "Zero tests is a framework issue, and CI catches it downstream" | The 0-count is the verdict, not someone else's bug — a vacuous pass is exactly the false-green this gate kills. Deferring to CI ships the fabricated-met forward; verify here. Sunk hours do not lower the bar. |

## Closing

Output of a clean run: a binary verdict (`passed: true|false`), a written `evidence` block citing the real run (exit code + the tests-collected count for tests, output tail), and the in-scope `git diff` confirmed. On PASS the caller (`implement` / `done <task-id>`) may close the task; on FAIL the claim stays open and routes to `fix` or the user. verify-claim never advances a claim it could not execute.
