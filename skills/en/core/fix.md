Identify the root cause of the problem and fix it with TDD.

If $ARGUMENTS was provided, use it as the problem description.
If not, ask the user: "What is the problem? Describe the observed symptom."

## Fundamental Rule

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

## Process

### Phase 1: Observe

Collect evidence WITHOUT forming hypotheses yet.

- Read the problem description (argument or question to user)
- Run relevant commands to reproduce/observe:
  - Tests: identify the project's test command (check `package.json` scripts,
    `Makefile`, `pyproject.toml`, or `CLAUDE.md`) and run it
  - Logs: run `grep -rn "[symptom error message]"` on relevant files
  - State: run `git log --oneline -5` to see recent changes
- Read relevant files with the Read tool — cite line numbers

Record the collected evidence:
> **Symptom:** [what happens]
> **Where:** [file:line]
> **When:** [under what condition]
> **Evidence:** [command output, line numbers]

Present the evidence to the user: "Phase 1 complete. Evidence collected above. Moving to diagnosis."

### Phase 2: Diagnose

Form hypotheses and test each one.

For each hypothesis:
1. Declare: "Hypothesis: [root cause candidate] at [file:line]"
2. Test: run a command via Bash or read with the Read tool to confirm/refute
3. Result: "Confirmed" or "Refuted because [evidence]"

Maximum 5 hypotheses. If none is confirmed after 5:
STOP and escalate to the user — the problem may be more complex.

When a hypothesis is confirmed, document:
> **Root cause:** [precise description]
> **File:** [path:line]
> **Why it happens:** [mechanism — not just "it's wrong"]

### Phase 3: Fix with TDD

**3a. Write a test that reproduces the bug:**
- Create a test that FAILS in the current state
- Run the test — confirm it fails for the expected reason
- If the test passes (bug not reproduced): your root cause is wrong.
  Go back to Phase 2. If you already went back 2 times: STOP and escalate to the user.

**3b. Fix the code:**
- Make the minimum necessary fix
- Run the test — confirm it now passes
- Run the full suite — confirm nothing else broke

**3c. Refactor (if needed):**
- If the fix introduced duplication or ugly code: refactor
- Run the tests again after refactoring

### Phase 4: Verify

- Run `git diff` — review the changes
- Confirm the fix is minimal (does not touch unrelated code)
- Run the full test suite one last time

## Red Flags

- "I already know what it is, I'll fix it directly"
- "It's obvious, I don't need a test for this"
- "I'll fix it and test later"
- "The test is hard to write, I'll test manually"
- "I'll take this opportunity to refactor the whole module"
- "The test suite is slow, I'll only run the test I wrote"

If you thought any of the above: STOP. Go back to the phase you were skipping.

## Rationalization

| Temptation | Reality |
|------------|---------|
| "The cause is obvious" | Obvious to whom? Document and prove with evidence |
| "I don't need a test, it's a small change" | Small changes break big things. HARD-GATE |
| "I'll fix first, test later" | Inverted TDD is not TDD — it's hope |
| "The suite is too big to run entirely" | Running partial = not knowing if you broke something |
| "I've tried 5 hypotheses, I'll guess the 6th" | 5 failures = escalate to the user, don't guess |

## Closing

Report:
- Problem: [original description]
- Root cause: [file:line — description]
- Hypotheses tested: [count, which were refuted]
- Test created: [test path]
- Fix: [summary of change]
- Full suite: [passed/failed]
