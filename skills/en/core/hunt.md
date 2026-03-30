Write adversarial tests for existing code to find hidden bugs and add meaningful coverage.

If {{ARG_VAR}} was provided, use as the target (file path, class, function, or directory).
If not, ask: "Which file, function, or directory do you want to hunt bugs in?"

## Fundamental Rule

NO HUNT WITHOUT BOUNDED SCOPE.
One class or one public function per execution. If a single file exceeds ~300 lines,
suggest splitting by method. Breadth finds nothing — depth finds bugs.
For directories: max 30 files per triage run. Narrow the scope if the directory has more.

<HARD-GATE>
BEFORE writing any assertion, answer:
"Does this expected value come from the SPEC or from the CODE?"
If from the code: STOP. Derive it from the spec, docs, method name, or ask the user.
Tests that mirror implementation logic are tautological — they confirm bugs instead of catching them.
</HARD-GATE>

## Mindset

You are a penetration tester, not a QA checklist runner.
Your job is to BREAK the code, not confirm it works.
If all your tests pass, question whether you were aggressive enough — did you cover
error paths, boundaries, and invalid state? Well-written code can legitimately pass,
but only after you've genuinely tried to break it.

## Process

### Phase 0: Triage (directory targets only)

If {{ARG_VAR}} is a directory, run triage mode. If it is a single file or function, skip to Phase 1.

**0a. Scan and rank:**
```bash
find [directory] -type f \( -name "*.php" -o -name "*.ts" -o -name "*.py" \) | sort
```

If the directory contains more than 30 files, warn:
> "[directory] has [N] files. The triage limit is 30 files per run.
> A) Show top 30 by risk (recommended)
> B) Narrow scope — suggest a subdirectory
> C) Cancel"

Wait for user response before proceeding.

For each file (up to 30), assess risk:
```bash
# Line count
wc -l [file]

# Recent activity (more commits = more changes = more risk)
git log --oneline --since="3 months ago" -- [file] | wc -l

# Test references ({{GREP_TOOL}} lines mentioning class name in tests/)
{{GREP_TOOL}} -rn "ClassName" tests/ --include="*.php" --include="*.ts" --include="*.py" 2>/dev/null | wc -l
```

**0b. Filter out non-huntable files:**
Skip: interfaces, enums, DTOs with no logic, files < 20 lines, config files.

**0c. Present ranked list to user:**
> Found [N] huntable files (from [total] scanned):
>
> | # | File | Lines | Commits (3mo) | Test refs | Risk |
> |---|------|-------|---------------|-----------|------|
> | 1 | ImportService.php | 220 | 12 | 0 | HIGH |
> | 2 | DeduplicationService.php | 168 | 6 | 14 | MEDIUM |
> | 3 | KpiCalculator.php | 85 | 2 | 8 | LOW |
>
> A) Hunt all ([N] isolated subagents)
> B) Select which to hunt
> C) Cancel

Risk = HIGH when 0 test refs OR > 8 recent commits. MEDIUM when < 5 test refs AND > 3 commits. LOW otherwise.
"Test refs" = lines mentioning the class in test files. NOT the number of tests — it's a proxy.
Flag files > 300 lines with ⚠ in the table — subagents will auto-split these by method.

Wait for user approval.

**0d. Detect project test conventions (once, shared with all subagents):**
Before spawning subagents, detect conventions that apply project-wide:
- Framework (Pest/PHPUnit/Jest/pytest) — check vendor/, node_modules/, or project config
- Test location pattern (`tests/Unit/`, `tests/Feature/`, `__tests__/`)
- Read ONE existing test file to extract patterns (beforeEach, factories, mocks)

**0e. Execute hunts:**
For EACH approved file, spawn an **isolated subagent** via the {{INVESTIGATOR_TOOL}} tool.

The subagent prompt MUST be self-contained — do NOT reference `/as-hunt` (subagents cannot
invoke skills). Build the prompt including:
- Target file path
- The HARD-GATE for tautological tests (copy verbatim)
- The Mindset section
- Test conventions detected in step 0d
- Phases 1-6 with these instructions for each phase:
  - Phase 1: Read target, count lines, find existing tests via {{GREP_TOOL}} in tests/
  - Phase 2: Find intent from docblock, git log, docs, callers
  - Phase 3: Map every execution path as table (COVERED / NOT / PARTIAL)
  - Phase 4: Create test list by category (business rules, edge cases, errors, happy path)
  - Phase 5: Write one test at a time, run each, distinguish setup error vs real bug
  - Phase 6: Return a Hunt Report with the table template from this skill

**Subagent AUTONOMOUS mode — critical differences from interactive mode:**
Subagents run without user interaction. They MUST follow these overrides:
- **Scope > 300 lines:** auto-split by largest public methods. Hunt each separately within the same subagent. Do NOT ask the user.
- **Test list approval:** proceed with own judgment. Do NOT wait for approval. Include the test list in the report so the main agent can review.
- **Bug found:** ALWAYS continue hunting (automatic choice B). Do NOT invoke /as-fix. List all bugs in the Hunt Report for the main agent to handle.
- **Memory save:** do NOT write to memory files. The main agent handles this in Phase 7.

Each subagent runs independently with clean context.
This isolation prevents tautological cross-file knowledge leaks.

Collect the Hunt Report output from each subagent before proceeding.
After all subagents complete, proceed to Phase 7 (Consolidated Report).

### Phase 1: Read the Target

Read the target file/function completely with the {{READ_TOOL}}. Register:

> **Target:** [file:lines or class::method]
> **Lines of code:** [count]
> **Dependencies:** [what it calls, what calls it]
> **Existing tests:** [path if they exist, "none" if not]

**Scope check:** if the target exceeds ~300 lines, STOP and suggest splitting:
> "Target has [N] lines. I recommend splitting:
> A) Hunt [class::methodA] first (~120 lines)
> B) Hunt [class::methodB] first (~80 lines)
> C) Proceed anyway (depth will be reduced)"

Search for existing tests beyond obvious paths:
```bash
{{GREP_TOOL}} -rn "ClassName\|method_name" tests/ --include="*.php" --include="*.ts" --include="*.py" 2>/dev/null
```

If existing tests exist, read them to understand what is ALREADY covered.

### Phase 2: Understand Intent

The code does what it DOES. You need to know what it SHOULD do.

Search for intent sources (execute EACH, don't skip):
- Method/class name and docblock — what does the name promise?
- `git log --oneline -10 -- [file]` — why was it created/changed?
- {{GREP_TOOL}} for the class/method name in docs/, specs, README, or CLAUDE.md
- Read callers ({{GREP_TOOL}} for the class/method name in app/) — how is it used?

If intent is ambiguous, ask the user: "What should [function] do when [scenario]?"

Register:
> **Intent:** [what the code SHOULD do, in domain language]
> **Source of intent:** [docblock / commit message / spec / user clarification]

### Phase 3: Map Coverage Gaps

Compare "what the code does" against "what is tested":

1. List every execution path (branches, conditions, early returns, catch blocks)
2. For each path, check: does an existing test exercise this? (cite test file:line)
3. Mark: COVERED / NOT COVERED / PARTIALLY COVERED

Present the gap map as a table:

| # | Path | Code location | Tested? | Test location |
|---|------|--------------|---------|---------------|
| 1 | [description] | file:line | COVERED / NOT / PARTIAL | test:line or — |

> **Paths found:** [N] | **Covered:** [N] | **Gaps:** [N]

### Phase 4: Plan the Attack

Transform each gap from Phase 3 into a test. Also add tests for behaviors that ARE covered
but only on the happy path — adversarial edge cases on covered paths count as gaps.

Create a test list organized by category. Present to the user BEFORE writing any test.

**Categories (in priority order):**
1. **Business rules** — calculations, validations, state transitions that enforce domain logic
2. **Edge cases** — null, empty collection, zero, one, max, boundary values
3. **Error paths** — invalid input, missing dependencies, exception handling, timeouts
4. **Happy path** — only if no existing test covers the basic scenario

For each test, write ONE LINE describing the behavior being tested:
```
1. [business] returns zero when no vulnerabilities in period
2. [edge] handles empty scan results without exception
3. [error] throws when import file is malformed
4. [edge] boundary: exactly 30 days returns current month, 31 returns previous
```

> Test list ready. [N] tests planned across [categories]. Proceed?

Wait for user approval. The user may reorder, add, or remove tests.

### Phase 5: Write Tests

**Detect test conventions** (skip if already detected in Phase 0d):
Check existing tests near the target, CLAUDE.md, or project config to determine:
- Framework (Pest/PHPUnit/Jest/pytest/etc.)
- Naming pattern (`{Class}Test.php`, `{class}.test.ts`, `test_{module}.py`)
- Location (`tests/Unit/`, `tests/Feature/`, `__tests__/`)
- Patterns (beforeEach, factories, mocks — read the closest existing test)

For EACH test in the approved list, one at a time:

**5a. Write the test:**
- One behavior per test. If the test name contains "and", split it.
- Expected values from the SPEC (Phase 2), NEVER from reading the implementation.
- Follow detected conventions.

**5b. Run the test:**
- Execute the test in isolation. Register the result.
- **If it PASSES:** behavior confirmed. Mark as coverage added. Move to next test.
- **If it FAILS:** distinguish the cause:
  - **Setup error** (missing factory, DB issue, wrong mock): fix the TEST, not the code. Re-run.
  - **Actual code bug** (assertion mismatch on real behavior): register as bug found.

  For bugs found, register and offer:
  > **Bug found:** [test name]
  > **Expected:** [what spec says]
  > **Actual:** [what code does]
  > **Location:** [file:line where the bug likely lives]
  > A) Fix now with /as-fix (recommended — test already reproduces the bug)
  > B) Continue hunting (fix later)
  > C) Mark and decide later

  If user picks A: invoke `/as-fix` with the bug context. After as-fix completes,
  RESUME the hunt from the next test in the list. The fixed test is done — continue with test N+1.
  If user picks B or C: register the bug and continue with next test.

**5c. Discovery:**
- While writing test N, if you discover a new edge case or path, add it to the test list.
- Do NOT pursue it now — finish the current test first.

### Phase 6: Report

Present the final report:

### Hunt Report

**Target:** [file/function]
**Intent source:** [where the spec came from]
**Tests written:** [N] (business: X, edge: Y, error: Z, happy: W)

| # | Test | Category | Result | Finding |
|---|------|----------|--------|---------|
| 1 | [name] | business | PASS | coverage added |
| 2 | [name] | edge | FAIL | bug: [description] at [file:line] |
| 3 | [name] | error | SETUP | fixed test setup, re-ran — PASS |

**Bugs found:** [N] (fixed via as-fix: X, deferred: Y)
**Coverage added:** [N] tests for [N] previously uncovered paths
**Suggested next runs:** [other files/functions that should be hunted]

{{#if modules.memory}}
**Save to memory:** update `{{memory_path}}` — create or update a `hunt-log.md` file with:
- Files hunted and date
- Bugs found and their status (fixed/deferred)
- Coverage gaps remaining (suggested next runs)
Update existing entries instead of creating duplicates. Keep `MEMORY.md` index updated.
{{/if}}

**Mutation testing (optional):** to validate test quality, consider running mutation testing
if available in the project (Infection for PHP, Stryker for JS, mutmut for Python).
Surviving mutants reveal tautological or weak tests.

### Phase 7: Consolidated Report (directory mode only)

If Phase 0 was executed (directory triage), consolidate the Hunt Report collected from
each subagent's output into a single report:

### Consolidated Hunt Report

**Directory:** [path]
**Files hunted:** [N] / [total huntable]
**Triage limit:** [N] files scanned (max 30 per run)

| # | File | Tests added | Bugs found | Risk before | Status |
|---|------|------------|------------|-------------|--------|
| 1 | ImportService.php | 12 | 2 | HIGH | 2 bugs deferred |
| 2 | DeduplicationService.php | 8 | 0 | MEDIUM | clean |

**Total tests added:** [N]
**Total bugs found:** [N] (all deferred — subagents do not fix)
**Remaining high-risk files:** [files not hunted or with deferred bugs]

**Post-triage actions:**
For each deferred bug, offer: "Fix [bug description] with /as-fix? The reproducing test already exists."

{{#if modules.memory}}
**Save to memory:** the main agent (not subagents) writes to `{{memory_path}}hunt-log.md`:
- All files hunted, dates, and results consolidated from subagent reports
- All bugs found and their status
- Remaining gaps and suggested next runs
{{/if}}

## Red Flags

- "The code looks straightforward, I'll just write a few happy path tests"
- "I already know how this works, I don't need to read callers"
- "I'll calculate the expected value from the code to make sure my test is right"
- "This edge case is unlikely, I'll skip it"
- "The test failed — must be my test that's wrong, I'll adjust the assertion"
- "I'll test the private methods to be thorough"
- "The scope is big but I can handle it in one run"
- "All tests pass, nothing left to do"
- "I'll hunt all files in my own context instead of using subagents"
- "30 files is just a guideline, I can scan more"

If you thought any of the above: STOP. Go back to the step you were skipping.

## Rationalization

| Temptation | Reality |
|-----------|---------|
| "I'll derive expected values from the code" | That's a tautological test — confirms bugs instead of catching them. HARD-GATE |
| "This function is simple, no edge cases" | Simple functions hide the subtlest bugs. Null, empty, boundary — always check |
| "All tests pass, my job is done" | Did you cover error paths and boundaries? If yes, the code may be solid. If no, hunt deeper |
| "The scope is only 400 lines, close enough to 300" | Depth degrades linearly with scope. Split and hunt each part properly |
| "I'll test internals for better coverage" | Test BEHAVIOR, not implementation. Internal tests break on refactoring |
| "I can hunt multiple files in one context" | Cross-file knowledge causes tautological tests. Isolated subagents prevent this |
| "No spec exists, I'll use the code as spec" | Code IS the current behavior, not the INTENDED behavior. Ask the user |
| "I'll write all tests first, then run them" | One at a time. Each test must be observed individually to catch the right thing |
| "The test failed, I'll adjust my expected value to match" | If the code doesn't match the spec, that's a BUG, not a wrong test. Verify intent first |
| "I'll fix the bug myself instead of using as-fix" | as-fix has its own TDD discipline. The failing test is already the reproducing test — hand it off |
