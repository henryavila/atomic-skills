Identify the root cause of the problem and fix it with TDD.

If {{ARG_VAR}} was provided, use it as the problem description.
If not, ask the user: "What is the problem? Describe the observed symptom."

## Iron Law

NO FIX WITHOUT ROOT CAUSE.
Do not write fix code without first having identified and documented
the root cause. "I think that's it" is not a root cause — it's a hypothesis.
Root cause = you know EXACTLY which line/condition causes the problem AND why.

<HARD-GATE>
If you are about to modify production code without having a test
that reproduces the bug: STOP. Write the test first.
The only exception is if the problem is in the test setup itself.
</HARD-GATE>

## Mindset

You are a detective, not a firefighter. Investigate first, act later.
The urgency to "fix it quickly" is what causes wrong fixes and regressions.

Finding one bug means more bugs likely live nearby (defect clustering).
A single test for the exact symptom is the minimum — not the finish line.

## Process

### Phase 1: Observe

Collect evidence WITHOUT forming hypotheses yet.

- Read the problem description (argument or question to user)
- Run relevant commands to reproduce/observe:
  - Tests: identify the project's test command (check `composer.json`, `package.json`,
    `Makefile`, `pyproject.toml`, or `CLAUDE.md`) and run it
  - Logs: run `{{GREP_TOOL}} -rn "[symptom error message]"` on relevant files
  - State: run `git log --oneline -5` to see recent changes
- Read relevant files with the {{READ_TOOL}} — cite line numbers

Record the collected evidence:
> **Symptom:** [what happens]
> **Where:** [file:line]
> **When:** [under what condition]
> **Evidence:** [command output, line numbers]

**Boundary instrumentation (conditional — when the symptom crosses modules).** If the bug spans ≥2 modules/components and you cannot yet say which side is wrong, instrument the seams BEFORE forming hypotheses — capture the value entering and leaving each boundary on the path from input to symptom (the technique is `skills/shared/debug-techniques.md` §2). The first boundary where input is correct but output is wrong owns the bug. This replaces a string of blind cross-module guesses with one evidence-localized target. Remove the instrumentation before committing — a left-in debug print is its own defect.

Present the evidence to the user: "Phase 1 complete. Evidence collected above. Moving to diagnosis."

### Phase 2: Diagnose

Form hypotheses and test each one. Trace the symptom backward to its origin — the cause is the FIRST hop where the value is wrong, not the site where it surfaced; when the chain is long or the regression is recent, bisect (`git bisect`, halving the input/code) instead of reading linearly (technique: `skills/shared/debug-techniques.md` §1).

For each hypothesis:
1. Declare: "Hypothesis: [root cause candidate] at [file:line]"
2. Test: run a command via {{BASH_TOOL}} or read with the {{READ_TOOL}} to confirm/refute
3. Result: "Confirmed" or "Refuted because [evidence]"

Maximum 5 hypotheses. If none is confirmed after 5:
STOP and escalate to the user — the problem may be more complex.

When a hypothesis is confirmed, document:
> **Root cause:** [precise description]
> **File:** [path:line]
> **Why it happens:** [mechanism — not just "it's wrong"]

### Phase 3: Fix with TDD

**3a. Enumerate the test surface:**
BEFORE writing any test, read the affected function and create a Test List:

1. **Regression test**: the exact case from the bug report
2. **Equivalence partitions**: for each input parameter of the affected function, identify classes:
   zero, negative, normal, boundary, overflow/max — at minimum one test per relevant partition
3. **Boundary values**: edges between partitions (off-by-one, exact threshold, threshold ± 1)
4. **Error inputs**: values the function should reject or handle gracefully

Present the Test List to the user:
> Test List for [function]:
> 1. [regression] exact reported case: [input] → [expected]
> 2. [boundary] [description]
> 3. [edge] [description]
> ...
> Minimum 3, typical 5-8. Proceed?

Wait for user approval.

**3b. Write the regression test:**
- The exact case from the bug report — must FAIL in the current state
- Run the test — confirm it fails for the expected reason
- If the test passes (bug not reproduced): your root cause is wrong.
  Go back to Phase 2. If you already went back 2 times: STOP and escalate to the user.

**3c. Fix the code:**
- Make the minimum necessary fix to pass the regression test
- Run the test — confirm it now passes
- Run the full suite — confirm nothing else broke

**3d. Write the boundary and edge tests:**
Work through the remaining Test List items, one test at a time.
- Each test should PASS if the fix correctly addresses the root cause
- **If a test FAILS**, determine the cause:
  - **Related to root cause** (same class of bug): the fix was too narrow — expand it.
    Do NOT narrow the test to match the broken behavior.
  - **Unrelated** (separate pre-existing bug): register as a separate finding.
    Do NOT try to fix it now — it's outside the current root cause scope. Continue hunting.

**3e. Spot-check via mental mutation:**
For each condition in your fix, ask:
- "If I changed `>=` to `>`, would a test catch it?"
- "If I removed this null check, would a test catch it?"
- "If I used `+` instead of `-`, would a test catch it?"

If any answer is "no": add a test that would catch it.

**3f. Refactor (if needed):**
- If the fix introduced duplication or ugly code: refactor
- Run the tests again after refactoring
- Closing the bug class: if the root cause is a *class* that can recur, add ONE guard at the cheapest-enforceable layer (boundary / construction / invariant) per `skills/shared/debug-techniques.md` §3 — bounded by G7 (the three-site abstraction floor; no speculative guard for cases you did not observe).

### Phase 3g: Fix-attempt circuit-breaker (architectural escalation)

Count **distinct fix attempts against the SAME root cause** — each time you change production code to make the symptom go away and it does not (the regression test still fails, or the bug recurs in a sibling case), that is one attempt. The counter is over **code changes against the same persisting symptom, NOT over diagnoses** — revising your theory of the root cause mid-stream does **not** reset it. "Attempts 1–3 had the wrong cause, so they don't count and this 4th is really my first real fix" is the reset-the-counter dodge: three patches that did not make the symptom go is the architectural signal, whatever you now believe the cause is.

**After 3 failed fixes for the same root cause: STOP. Do not apply a 4th.** Three patches that did not hold is the signal that the problem is **architectural**, not local — the diagnosed root cause is a symptom of a deeper one, or the design itself is the defect (a wrong abstraction boundary, a contract two modules disagree on, state that should not exist). A 4th patch on the same spot deepens the workaround and hides the real cause further.

On the circuit-break: escalate OUT of fix-mode — surface to the user that the bug is likely architectural, summarize the 3 attempts and why each failed, and propose a design-level review (`atomic-skills:brainstorm` for a one-way-door redesign, or `atomic-skills:review-plan`/architecture discussion) rather than a 4th code edit.

This is **distinct** from the two other caps: the **5-hypothesis cap** (Phase 2) bounds *diagnosis* attempts; **Phase 3b's "go back twice"** bounds *re-diagnosis* when the regression test unexpectedly passes; this circuit-breaker bounds *fix* attempts against a confirmed-but-unyielding root cause. All three escalate; they count different things.

### Phase 4: Verify

- Run `git diff` — review the changes
- Confirm the fix is minimal (does not touch unrelated code)
- Run the full test suite one last time
- **Completion check** (all three must be true):
  1. Test List is empty (all items implemented)
  2. Every input partition has at least one test
  3. Mental mutation found no uncaught cases

## Red Flags

- "I already know what it is, I'll fix it directly"
- "It's obvious, I don't need a test for this"
- "I'll fix it and test later"
- "The test is hard to write, I'll test manually"
- "I'll take this opportunity to refactor the whole module"
- "The test suite is slow, I'll only run the test I wrote"
- "One test for the exact bug is enough"
- "The boundary tests are overkill, the fix is simple"
- "The test failed after my fix — I'll narrow the test"
- "The last fix was almost right — one more patch will land it" (after 3 failed fixes for the same root cause)
- "Attempts 1–3 had the wrong diagnosis, so they don't count — this 4th is the first real fix" (the reset-the-counter dodge — the breaker counts patches against the persisting symptom, not diagnoses)
- "It's only 15 minutes and I might get lucky — either it fixes it or gives me data" (a 4th patch is not a probe; if you want data, instrument — don't gamble a patch)
- "It's a cross-module bug, I'll just patch where it surfaced" (without instrumenting the boundaries first)
- "The lead said it's obviously module X — I'll patch it to rule it out, instrument only if that fails" (a patch is not a hypothesis test; instrument the boundary first)

If you thought any of the above: STOP. Go back to the phase you were skipping.

## Code-quality gates

This skill is bound by the gates defined in `docs/kb/code-quality-gates.md`. Apply the rules below for THIS skill; consult the KB for full rule definition + good/bad examples.

- **G1 read-before-claim** — before stating what the broken code does, paste the relevant source lines (the buggy lines and the function signature). Inferring from the name is forbidden.
- **G2 soft-language ban** — words like `should`, `probably`, `may`, `typically` are forbidden in the root-cause statement. The cause is what the code does, not what it might do. Convert to verified statement or mark explicitly `unverified: <why>`.
- **G3 anti-tautology in tests** — for each regression/boundary/edge test, name the mutation in the implementation that would break the test. If "none" or "I'd change the test too" — the assertion is tautological. Rewrite.
- **G4 fixture realism** — before writing test fixtures, sample a real example of the broken input. Synthesizing the shape from intuition is forbidden (Phase D's stop hook failed exactly this way — synthetic JSONL didn't match the real Claude Code transcript schema).
- **G5 red phase mandatory** — paste the failing test output BEFORE writing the fix. The output of the test runner showing the failing assertion is the entry token to the green phase.
- **G7 premature-abstraction ban** — three is the abstraction floor. The fix touches one function unless three independent sites have the same root cause. Adding a helper "for future use" is forbidden.

## Self-review against gates

Before reporting the fix as done, append to the report a `## Self-review against code-quality gates` block of the form:

```
- G1 read-before-claim: applied — <paste of source lines used>
- G2 soft-language: applied — no banned words in root-cause / not-applicable
- G3 anti-tautology: applied — for each test, the mutation that breaks it is: <…>
- G4 fixture realism: applied — fixtures sampled from <real source> / not-applicable (pure-function fix)
- G5 red phase: applied — failing output pasted above
- G7 anti-premature-abstraction: applied — touched N files, no new helper / not-applicable
```

If you violated any gate, write `violated — <reason + remediation>`. Do not skip the checkpoint; silent application is forbidden.

## Rationalization

| Temptation | Reality |
|------------|---------|
| "The cause is obvious" | Obvious to whom? Document and prove with evidence |
| "I don't need a test, it's a small change" | Small changes break big things. HARD-GATE |
| "I'll fix first, test later" | Inverted TDD is not TDD — it's hope |
| "The suite is too big to run entirely" | Running partial = not knowing if you broke something |
| "I've tried 5 hypotheses, I'll guess the 6th" | 5 failures = escalate to the user, don't guess |
| "One regression test is enough" | One test catches one case. Bugs cluster — if you found one, there are more nearby |
| "The boundary test failed, I'll adjust the test" | If the code doesn't match the spec at the boundary, that's a SECOND bug — fix the code, not the test |
| "I'll skip the Test List, the bug is straightforward" | Straightforward bugs have straightforward siblings. List them or miss them |
| "The 4th fix will surely land it this time" | Three fixes that didn't hold means the cause is deeper or the design is the defect. A 4th patch buries it — escalate to architecture (Phase 3g circuit-breaker) |
| "The first three fixes had the wrong diagnosis, so the 4th is really attempt #1" | The breaker counts code changes against the same unresolved symptom, not your diagnosis revisions. Re-diagnosing mid-stream is the reset-the-counter dodge — 3 patches that didn't hold = escalate (Phase 3g) |
| "One more patch is only 15 minutes, might get lucky or learn something" | A 4th patch as a cheap EV bet is the workaround-deepening the breaker exists to stop. If you want information, instrument the boundary; luck is not a root-cause fix |
| "I can tell which module is broken without instrumenting" | Across a boundary, the surface site is rarely the owner. One boundary trace localizes it; N blind patches do not (Phase 1 / debug-techniques §2) |
| "I'll patch the lead's guess first to rule it out, instrument only if it fails" | A patch is not a probe — a passing patch on the wrong module buries the bug; a failing one is a worse signal than one boundary trace. Instrument before patching; "obviously X" is a hypothesis, not a verdict |

## Closing

Report:
- Problem: [original description]
- Root cause: [file:line — description]
- Hypotheses tested: [count, which were refuted]
- Tests created: [count] (regression: 1, boundary: N, edge: N)
- Fix: [summary of change]
- Test List completion: [all items done / N remaining]
- Mental mutation: [N conditions checked, N tests added]
- Full suite: [passed/failed]
