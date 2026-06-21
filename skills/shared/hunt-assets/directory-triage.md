# hunt — directory triage & consolidated report (lazy asset)

hunt's canonical scope is ONE class / one public function (Phases 1-6, resident in
the skill). This asset holds the directory-mode machinery, read only when
{{ARG_VAR}} is a directory:

- **Phase 0: Triage** — scan, rank by risk, filter, get approval, detect conventions
  once, spawn one isolated subagent per file.
- **Phase 7: Consolidated Report** — merge each subagent's Hunt Report after Phase 0.

Convention-detection is defined ONCE in the skill's Phase 5; Phase 0d references it.

## Phase 0: Triage (directory targets only)

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
Before spawning subagents, detect conventions project-wide per the skill's
**Phase 5 → Detect test conventions** (framework, naming pattern, location, and
patterns from the closest existing test). Pass the detected set into each subagent
prompt (0e) — this is the single canonical convention-detection.

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
  - Phase 6: Return a Hunt Report with the table template from the hunt skill (hunt.md → Phase 6 Hunt Report)

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


## Phase 7: Consolidated Report (directory mode only)

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
