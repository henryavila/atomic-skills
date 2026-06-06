---
date: 2026-05-20T10:35:43Z
topic: phase-d-hooks-aideck
artifact: 74c3231..fc700c5
skill: review-code-with-codex
reviewer: gpt-5-codex
codex_version: codex-cli 0.130.0
final_verdict: needs_changes
counts_final: {blocker: 0, critical: 1, major: 3, minor: 0, nit: 0}
counts_blind: {blocker: 0, critical: 1, major: 3, minor: 0, nit: 0}
framing_delta: {dropped: 0, maintained: 4, emerged: 0}
schema_version: "1.0"
---

# Cross-Model Review — phase-d-hooks-aideck

## Pass 1 (blind)

---
verdict: needs_changes
counts: {blocker: 0, critical: 1, major: 3, minor: 0, nit: 0}
reviewer: gpt-5-codex
pass: blind
schema_version: "1.0"
---

## Summary
The main risk is that the new Stop hook can silently miss the writes it is supposed to police, especially with real Claude Code transcript structure. There are also correctness gaps in scope matching and phase-transition detection that can produce false in-scope results or premature phase completion prompts.

## Findings

### F-001 [critical] Correctness — skills/shared/project-status-assets/hooks/stop.sh:129-137

**Evidence:**
```bash
jq -r --arg ts "$last_user_ts" '
  select(.timestamp > $ts
    and .tool_use != null
    and (.tool_use.name == "Write"
      or .tool_use.name == "Edit"
      or .tool_use.name == "MultiEdit"
      or .tool_use.name == "NotebookEdit"))
  | .tool_use.input.file_path // empty
' "$transcript" 2>/dev/null | sort -u
```

**Claim:** Real Claude Code transcript entries with tool uses nested under message content, for example `.message.content[] | select(.type=="tool_use")`, produce no written files here because this filter only reads top-level `.tool_use`.

**Impact:** `written` becomes empty, so the Stop hook exits at `total == 0` and never logs or blocks scope drift in normal sessions.

**Recommendation:** Parse the actual transcript schema, including nested assistant message `tool_use` entries, and add a fixture copied from a real Claude Code transcript.

**Confidence:** high

---

### F-002 [major] Security — skills/shared/project-status-assets/hooks/stop.sh:142-156

**Evidence:**
```bash
case "$file" in
  "$PROJ_DIR"/*) relative="${file#$PROJ_DIR/}" ;;
  /*) return 1 ;; # absolute path outside repo — out of scope
esac
for prefix in "$@"; do
  # Treat trailing slash as directory, no slash as exact-or-prefix match.
  case "$prefix" in
    .) return 0 ;;
    ./*) prefix="${prefix#./}" ;;
  esac
  if [[ "$relative" == "$prefix" || "$relative" == "$prefix"/* || "$relative" == "${prefix%/}"/* ]]; then
    return 0
  fi
done
```

**Claim:** A write path like `$PROJ_DIR/src/../lib/secret.js` is classified in-scope for `scope.paths: [src/]` even though the actual target is outside `src/`.

**Impact:** Strict mode can be bypassed by non-canonical paths, allowing lateral writes outside the initiative scope without a drift warning.

**Recommendation:** Canonicalize both repo-relative write paths and scope roots before comparison, and reject paths that resolve outside the repository or outside the canonical scope.

**Confidence:** high

---

### F-003 [major] Correctness — skills/shared/project-status-assets/hooks/session-start.sh:63-65

**Evidence:**
```bash
fm == 1 && /^tasks:[[:space:]]*$/ { in_tasks = 1; next }
fm == 1 && in_tasks && /^[A-Za-z][A-Za-z0-9_]*:/ { in_tasks = 0 }
fm == 1 && in_tasks && /^[[:space:]]+status:[[:space:]]*(pending|active)([[:space:]]|$)/ { count++ }
```

**Claim:** An initiative with only `status: blocked` tasks is counted as having zero remaining tasks, even though the command spec treats `blocked` as unfinished.

**Impact:** SessionStart prompts `phase-done` while blocked work remains, which can lead users to close or advance a phase prematurely.

**Recommendation:** Count `blocked` as remaining work and handle quoted YAML scalars such as `status: "pending"`.

**Confidence:** high

---

### F-004 [major] Data integrity — src/transition.js:24-70

**Evidence:**
```js
const TERMINAL_STATUSES = new Set(['done', 'archived']);
...
if (p.id === completedPhaseId) continue;
if (TERMINAL_STATUSES.has(p.status)) continue;
const deps = Array.isArray(p.dependsOn) ? p.dependsOn : [];
const allSatisfied = deps.every((d) => {
  if (!phaseById.has(d)) return false; // unknown dep — never satisfiable
  return doneIds.has(d);
});
if (allSatisfied) eligible.push(p.id);
```

**Claim:** Already `active` or `paused` phases become eligible because the function excludes only `done` and `archived`.

**Impact:** `phase-done` can propose advancing to an already-active phase and seed a duplicate successor initiative, corrupting plan state in parallel or resumed-plan workflows.

**Recommendation:** Restrict eligibility to phases whose status is actually startable, likely `pending`, and add tests covering active and paused dependent phases.

**Confidence:** high

## Questions (non-findings)

- skills/shared/project-status-assets/hooks/session-start.sh:213 — Should aiDeck env parsing accept bare `AIDECK_URL=` as documented, or only `export AIDECK_URL=`?

## Out of scope

- aiDeck-side implementation under `/Volumes/External/code/aideck/`.
- Frozen `.atomic-skills/` frontmatter schema names and required fields.

## Pass 2 (informed)

---
verdict: needs_changes
counts: {blocker: 0, critical: 1, major: 3, minor: 0, nit: 0}
reviewer: gpt-5-codex
pass: informed
schema_version: "1.0"
---

## Summary
The Stop hook’s core detection path does not match real Claude Code transcript JSONL, so scope drift enforcement still never fires in normal sessions. The remaining issues are state correctness bugs: path scope checks can be bypassed with non-canonical paths, blocked tasks are treated as complete, and phase advancement can reselect already active or paused phases.

## Findings

### F-001 [critical] Correctness — skills/shared/project-status-assets/hooks/stop.sh:129

**Evidence:**
```bash
last_user_ts=$(grep '"role":"user"' "$transcript_path" 2>/dev/null | tail -1 \
  | jq -r '.timestamp // empty' 2>/dev/null || echo "")
```

```bash
jq -r --arg ts "$last_user_ts" '
  select(.timestamp > $ts
    and .tool_use != null
    and (.tool_use.name == "Write"
      or .tool_use.name == "Edit"
      or .tool_use.name == "MultiEdit"
      or .tool_use.name == "NotebookEdit"))
    | .tool_use.input.file_path // empty
  ' "$transcript" 2>/dev/null | sort -u
```

**Claim:** Real Claude Code transcripts identify user turns with `.type=="user"` and tool uses under `.message.content[]`, so this code finds no turn timestamp or no written files.

**Impact:** The hook exits before drift detection, so strict mode and dry-run logging do not work in normal Claude Code sessions.

**Recommendation:** Parse the real transcript schema for both user turns and nested tool_use content, and add a real transcript fixture.

**Confidence:** high

---

### F-002 [major] Security — skills/shared/project-status-assets/hooks/stop.sh:142

**Evidence:**
```bash
case "$file" in
  "$PROJ_DIR"/*) relative="${file#$PROJ_DIR/}" ;;
  /*) return 1 ;; # absolute path outside repo — out of scope
esac
...
if [[ "$relative" == "$prefix" || "$relative" == "$prefix"/* || "$relative" == "${prefix%/}"/* ]]; then
  return 0
fi
```

**Claim:** `$PROJ_DIR/src/../lib/secret.js` is classified in-scope for `scope.paths: [src/]` even though it resolves outside `src`.

**Impact:** Strict mode can be bypassed with non-canonical paths, allowing lateral writes without a drift warning.

**Recommendation:** Canonicalize write paths and scope roots before comparison, and reject paths resolving outside the repository or canonical scope.

**Confidence:** high

---

### F-003 [major] Correctness — skills/shared/project-status-assets/hooks/session-start.sh:63

**Evidence:**
```bash
fm == 1 && in_tasks && /^[[:space:]]+status:[[:space:]]*(pending|active)([[:space:]]|$)/ { count++ }
```

**Claim:** Tasks with `status: blocked` are counted as no remaining work even though `blocked` is an unfinished task state.

**Impact:** SessionStart can prompt `phase-done` while blocked tasks remain, encouraging premature phase closure.

**Recommendation:** Count `blocked` as remaining work and test pending, active, blocked, and quoted status scalars.

**Confidence:** high

---

### F-004 [major] Data integrity — src/transition.js:24

**Evidence:**
```js
const TERMINAL_STATUSES = new Set(['done', 'archived']);
...
if (p.id === completedPhaseId) continue;
if (TERMINAL_STATUSES.has(p.status)) continue;
...
if (allSatisfied) eligible.push(p.id);
```

**Claim:** `active` and `paused` phases are eligible for advancement because only terminal statuses are excluded.

**Impact:** `phase-done` can propose an already-active or paused phase and seed duplicate successor initiative state.

**Recommendation:** Restrict eligibility to startable phases, likely `status === "pending"`, and add active/paused regression tests.

**Confidence:** high

## Questions (non-findings)

- _(none)_

## Out of scope

- aiDeck-side implementation under `/Volumes/External/code/aideck/`.
- Frozen `.atomic-skills/` frontmatter schema names and required fields.
- macOS bash 3.2 portability for the hook scripts.
- Per-file gitignore rules for `.atomic-skills/status/*.log`.

## Pass 2 reconciliation

### Dropped from blind pass

- _(none)_

### Maintained

- F-001-blind → F-001-final [critical] — same; expanded with the verified `.type=="user"` mismatch from the real transcript schema constraint.
- F-002-blind → F-002-final [major] — same; confirmed by the constraint that Write/Edit paths may contain `..` segments and symlinks.
- F-003-blind → F-003-final [major] — same; confirmed by the task status enum constraint that `blocked` is unfinished.
- F-004-blind → F-004-final [major] — same; confirmed by the phase status enum constraint that only `pending` is not yet started.

### Emerged

- _(none)_

## Briefings used

<details>
<summary>Pass 1 briefing (truncated)</summary>



</details>

<details>
<summary>Pass 2 briefing (truncated)</summary>



</details>

## Fixes applied in this session

- F-001 (critical) — **APPLIED**. `stop.sh` `list_files_written()` rewritten to parse the real transcript schema: assistant turns with `type == "assistant"` and nested `message.content[] | select(.type == "tool_use")`; pulls `input.file_path` and falls back to `input.notebook_path` for NotebookEdit. `last_user_ts` extraction now filters on `.type == "user"` (was `.role == "user"`). Test 3b uses a transcript that mirrors the on-disk shape sampled from `~/.claude/projects/`.
- F-002 (major) — **APPLIED**. Added `canonicalize_path()` (lexical, no symlink resolution) and rewrote `path_in_scope()` to canonicalize both file and scope prefixes before prefix-match. Out-of-scope detection for `$PROJ_DIR/src/../lib/secret.js` now works (Test 10a). Bash 3.2-compatible array handling — no `${out[-1]}` syntax.
- F-003 (major) — **APPLIED**. `count_pending_tasks()` in `session-start.sh` now includes `blocked` in the unfinished-task regex, and accepts quoted scalars (`status: "pending"` or `status: 'pending'`). Test 6b confirms blocked tasks suppress the phase-transition signal.
- F-004 (major) — **APPLIED**. `nextEligiblePhases()` in `src/transition.js` now requires `status === 'pending'` (was: not in TERMINAL_STATUSES). Two new test cases cover active and paused dependent phases being correctly skipped.

Verification: `npm test` → 334 passed, 0 failed. `npm run test:hooks` → 47 passed across both hook suites.
