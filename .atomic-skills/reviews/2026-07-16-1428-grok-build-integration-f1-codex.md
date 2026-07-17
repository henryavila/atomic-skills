---
date: 2026-07-16T14:29:05Z
topic: grok-build-integration-f1
artifact: c0be0fb..HEAD
skill: review-code
reviewer: gpt-5-codex
final_verdict: needs_changes
counts_final: {blocker: 0, critical: 0, major: 5, minor: 0, nit: 0}
mode: codex
schema_version: "1.0"
---

# Cross-Model Review — F1

---
verdict: needs_changes
counts: {blocker: 0, critical: 0, major: 5, minor: 0, nit: 0}
reviewer: gpt-5-codex
pass: blind
schema_version: "1.0"
---

## Summary
The Grok runtime does not satisfy its host contract. User-level Soft hooks reference scripts that are not installed at their command paths, native SessionStart output cannot deliver the update notification, workspace-root resolution ignores Grok’s documented environment, Strict setup mutates an installer-owned file that uninstall deliberately preserves, and auto-update command paths are shell-injection-prone.

## Findings

### F-001 [major] integration — src/providers/skills-file-set.js:223-237

**Evidence:**
```js
function generatePluginHooksSoft() {
  const cmd = (script) =>
    `bash "\${CLAUDE_PROJECT_DIR:-\$PWD}/.atomic-skills/status/hooks/${script}"`;
  const envelope = {
    hooks: {
      SessionStart: [
        {
          hooks: [{ type: 'command', command: cmd('session-start.sh') }],
        },
      ],
      PreToolUse: [
        {
          matcher: 'Edit|Write|MultiEdit|search_replace|write',
          hooks: [{ type: 'command', command: cmd('pre-write.sh') }],
        },
```

**Claim:** A user-scope Grok plugin registers global Soft hooks whose commands target project-local scripts that the install does not place there.

**Impact:** Grok loads enabled user plugins globally, but the scripts are installed under the plugin’s `_assets/hooks/` directory and are copied into `.atomic-skills/status/hooks/` only during optional project setup; therefore ordinary sessions execute missing commands, record hook failures, and allow PreToolUse operations without the advertised provenance gate because crashes fail open under the [Grok hook contract](https://docs.x.ai/build/features/hooks).

**Recommendation:** Either register Soft hooks only during project setup in `<repo>/.grok/hooks/`, or execute bundled scripts through `GROK_PLUGIN_ROOT`; ensure an unconfigured repository produces neither missing-command failures nor a falsely advertised gate.

**Confidence:** high

---

### F-002 [major] compatibility — skills/shared/auto-update-hook/version-check.sh:83-87

**Evidence:**
```bash
# Emit additionalContext
if command -v jq >/dev/null 2>&1; then
  jq -n --arg ctx "$msg" \
    '{hookSpecificOutput: {hookEventName: "SessionStart", additionalContext: $ctx}}' 2>/dev/null || true
fi
```

**Claim:** The Grok auto-update hook attempts to deliver its notification through Claude-specific SessionStart stdout that Grok ignores.

**Impact:** The native Grok registration runs the version check but users never receive the update message, because Grok documents that stdout from passive events such as SessionStart is ignored in its [script contract](https://docs.x.ai/build/features/hooks).

**Recommendation:** Implement a Grok-supported user-visible notification channel and add an end-to-end Grok test that observes the notice; do not treat process stdout or `hookSpecificOutput.additionalContext` as successful native delivery.

**Confidence:** high

---

### F-003 [major] path-resolution — skills/shared/project-assets/hooks/pre-write.sh:28-31

**Evidence:**
```bash
PROJ_DIR="${CLAUDE_PROJECT_DIR:-$PWD}"
ASKILLS_DIR="$PROJ_DIR/.atomic-skills"
CONFIG="$ASKILLS_DIR/status/config.json"
LOG="$ASKILLS_DIR/status/emergent-drift.log"
```

**Claim:** The Grok hook scripts ignore the host’s documented `GROK_WORKSPACE_ROOT` and instead depend on an undocumented Claude variable or the invocation directory.

**Impact:** When Grok starts below the repository root, the hooks can inspect the wrong `.atomic-skills` tree, causing SessionStart context to disappear and PreToolUse to fail open because its configuration and gated files are not found; Grok explicitly supplies `GROK_WORKSPACE_ROOT` in the [hook environment](https://docs.x.ai/build/features/hooks).

**Recommendation:** Resolve `PROJ_DIR` as `${GROK_WORKSPACE_ROOT:-${CLAUDE_PROJECT_DIR:-$PWD}}` in every shared hook and use the same precedence in generated command wrappers; test execution from a nested working directory.

**Confidence:** high

---

### F-004 [major] uninstall-correctness — skills/shared/project-assets/project-setup.md:60-64

**Evidence:**
```md
For eligible hosts only, option (b): copy `session-start.sh` and `pre-write.sh` (from `{{ASSETS_PATH}}/hooks/`) to `.atomic-skills/status/hooks/`, then register only `SessionStart` and `PreToolUse` in the host hook config with merge-only changes. Option (c) does the same and additionally copies/registers `stop.sh` as `Stop`.

- Claude Code: `.claude/settings.local.json`
- Codex: `.codex/hooks.json`
- Grok Build: `.grok/plugins/atomic-skills/hooks/hooks.json` (Soft already ships with the plugin package on install; re-merge if the file was wiped, and for Strict merge-add `Stop`)
```

**Claim:** Strict setup modifies the same `hooks/hooks.json` file that `reconcileFileSet` owns as a generated package artifact.

**Impact:** Adding Stop changes the file hash, after which the reconciler preserves it as user-modified during updates and uninstall; Soft hook updates stop applying, and uninstall leaves a stale plugin hook file referencing scripts that were removed.

**Recommendation:** Store Strict registration in a separate project hook file such as `.grok/hooks/atomic-skills-strict.json` and manage it with a journaled merge effect that surgically removes Stop on uninstall.

**Confidence:** high

---

### F-005 [major] command-injection — src/runtime-layers/auto-update.js:52-55

**Evidence:**
```js
function sessionStartEntry(destAbs, { withMatcher = true } = {}) {
  const entry = {
    hooks: [{ type: 'command', command: destAbs }],
  };
```

**Claim:** An absolute filesystem path is inserted verbatim into a shell-command field without shell quoting.

**Impact:** Install roots containing spaces make auto-update fail, while roots containing shell syntax such as semicolons or `$()` cause injected commands to execute on every SessionStart because Grok treats `command` as a shell command.

**Recommendation:** Encode the executable path with a tested POSIX shell-quoting function or invoke it through `bash` with a safely quoted argument; add cases for spaces, single quotes, semicolons, and command-substitution characters.

**Confidence:** high

## Questions (non-findings)

- None.

## Out of scope

- Cross-model bridge and review-code provider modes.
- Marketplace publication behavior.
- Grok transcript schema beyond the supplied dual-vocabulary fixtures.

## Triage

| # | Action |
|---|--------|
| F-001 | **applied** — Soft plugin hooks use GROK_PLUGIN_ROOT/_assets/hooks |
| F-002 | **deferred** — Grok SessionStart stdout contract needs F4/F5 notification channel (version-check still runs) |
| F-003 | **applied** — PROJ_DIR prefers GROK_WORKSPACE_ROOT |
| F-004 | **applied** (docs) — Strict via separate .grok/hooks/atomic-skills-strict.json |
| F-005 | **applied** — shellQuote on auto-update command paths |

**Final status:** approved with caveats (F-002 deferred)
**HEAD:** 4e3fa7749cd6ea21b25b6281e0c51a4e66831e52
