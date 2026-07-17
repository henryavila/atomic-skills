---
date: 2026-07-16T14:06:25Z
topic: grok-build-integration-f0
artifact: 9d24fbe..HEAD (src/ tests/ docs/kb/grok-build-compatibility.md)
skill: review-code
reviewer: gpt-5-codex
codex_version: codex-cli 0.144.4
final_verdict: needs_changes
counts_final: {blocker: 0, critical: 0, major: 4, minor: 1, nit: 0}
counts_blind: {blocker: 0, critical: 0, major: 4, minor: 1, nit: 0}
schema_version: "1.0"
mode: codex
---

# Cross-Model Review — grok-build-integration F0

## Pass 1 (blind)

---
verdict: needs_changes
counts: {blocker: 0, critical: 0, major: 4, minor: 1, nit: 0}
reviewer: gpt-5-codex
pass: blind
schema_version: "1.0"
---

## Summary

The plugin file set remains lexically confined to `.grok/plugins/atomic-skills/`, but the rendered tool profiles contain invalid host tool identifiers. Grok writes target `write` instead of `write_file`, while Codex skills reference standalone filesystem tools that Codex does not register by default.

Grok was also added to the public host list without updating interactive selection or the existing exhaustive host matrix, causing an inaccessible workflow and a deterministic test failure. The interactive completion message reports a nonexistent Grok path.

## Findings

### F-001 [major] correctness — src/render.js:116-128

**Evidence:**
```js
if (ideId === 'codex') {
  // Codex CLI agent tools — not Claude names (Bash / Read tool).
  return {
    BASH_TOOL: 'shell',
    READ_TOOL: 'read_file',
    WRITE_TOOL: 'apply_patch',
    REPLACE_TOOL: 'apply_patch',
    GREP_TOOL: 'grep_files',
    GLOB_TOOL: 'list_dir',
    INVESTIGATOR_TOOL: 'spawn_agent',
    ARG_VAR: '$ARGUMENTS',
    ASK_USER_QUESTION_TOOL: noNativeAskTool,
  };
}
```

**Claim:** The Codex profile substitutes `read_file`, `grep_files`, and `list_dir`, although these are not default tools registered by current [Codex core](https://github.com/openai/codex/blob/main/codex-rs/core/src/tools/spec_plan.rs).

**Impact:** Many rendered skills explicitly require those identifiers for mandatory reads and searches, so normal Codex workflows can issue unsupported tool calls or stall before completing their preflight steps.

**Recommendation:** Model Codex reads, searches, and file enumeration through its supported command-execution tool, or introduce host-specific instruction templates that emit concrete `rg`, `rg --files`, and file-reading commands; validate the result against Codex’s advertised tool registry.

**Confidence:** high

---

### F-002 [major] correctness — src/render.js:101-114

**Evidence:**
```js
if (ideId === 'grok') {
  // Provisional Grok Build map (design D2). Locked by render tests; F2 may
  // adjust if headless CLI tool ids differ from the interactive surface.
  return {
    BASH_TOOL: 'run_terminal_command',
    READ_TOOL: 'read_file',
    WRITE_TOOL: 'write',
    REPLACE_TOOL: 'search_replace',
    GREP_TOOL: 'grep',
    GLOB_TOOL: 'list_dir',
    INVESTIGATOR_TOOL: 'spawn_subagent',
    ARG_VAR: '$ARGUMENTS',
    ASK_USER_QUESTION_TOOL: 'ask_user_question',
  };
}
```

**Claim:** `WRITE_TOOL` resolves to `write`, but Grok Build exposes the write tool as `write_file`, as reflected in the current [Grok Build changelog](https://x.ai/build/changelog).

**Impact:** Eight shipped skill or asset instructions use `{{WRITE_TOOL}}`; Grok renders them with an unsupported identifier, breaking state-file and dispatch-plan creation in those workflows.

**Recommendation:** Change `WRITE_TOOL` to `write_file` and replace the tautological constant test with a headless Grok smoke test or fixture sourced from Grok’s advertised tool schema.

**Confidence:** high

---

### F-003 [major] integration — src/ui.js:119-120

**Evidence:**
```js
// Primary IDE IDs exposed to users (gemini-commands is internal)
const PRIMARY_IDE_IDS = ['claude-code', 'cursor', 'gemini', 'codex', 'opencode', 'github-copilot'];
```

**Claim:** Grok is public in `PUBLIC_IDE_IDS` but absent from the interactive IDE selection allowlist.

**Impact:** Users cannot select Grok during a first interactive install unless it was already detected, and customizing an auto-detected selection removes Grok from the available choices.

**Recommendation:** Derive the interactive choices from `PUBLIC_IDE_IDS`, or add Grok to `PRIMARY_IDE_IDS`, and add an interactive-selection test covering every public host.

**Confidence:** high

---

### F-004 [major] testing — tests/project.test.js:403-407

**Evidence:**
```js
assert.deepStrictEqual(
  HOST_HOOK_MATRIX.map(({ ideId }) => ideId),
  PUBLIC_IDE_IDS,
  'host matrix must cover every declared public host in order',
);
```

**Claim:** Adding Grok to `PUBLIC_IDE_IDS` without adding it to `HOST_HOOK_MATRIX` makes this exhaustive matrix assertion fail deterministically.

**Impact:** The full test suite cannot pass, and the project-setup artifact lacks the newly public Grok skill installation path.

**Recommendation:** Add a Grok matrix entry with its plugin skill path and no project-hook contract, or keep Grok out of `PUBLIC_IDE_IDS` until all exhaustive public-host consumers are updated.

**Confidence:** high

---

### F-005 [minor] correctness — src/ui.js:214-216

**Evidence:**
```js
const dirLabel = `${cfg.dir}/${SKILL_NAMESPACE}/`;
const detail = assets > 0 ? ` ${pc.dim(`(+${assets} assets)`)}` : '';
p.log.success(`${pc.bold(ideDisplayName(id))}  ${m.skillsCount(skills)}${detail} → ${pc.dim(dirLabel)}`);
```

**Claim:** For Grok, this constructs `.grok/plugins/atomic-skills/skills/atomic-skills/`, which is not an installed directory.

**Impact:** Successful interactive installation directs users to a nonexistent path, obscuring where the plugin was installed.

**Recommendation:** Add a configuration helper for each host’s displayed install root and return `.grok/plugins/atomic-skills/` for plugin delivery.

**Confidence:** high

## Questions (non-findings)

- src/render.js:105 — What minimum Grok Build version is supported, and is `run_terminal_command` guaranteed as an alias for the newer `run_terminal_cmd` identifier?

## Out of scope

- Soft/Strict Grok project-hook content beyond the empty hooks stub.
- Cross-model bridge provider implementation.
- Sealed-envelope review-science redesign.
- Plan/state markdown under `.atomic-skills/`.

## Triage (orchestrator)

| # | Finding | Severity | Action |
|---|---------|----------|--------|
| F-001 | Codex tool map may not match Codex core registry | major | **deferred** to F2 invocation smoke (design D2 provisional; F0 acceptance only required non-Claude names) |
| F-002 | Grok WRITE should be write_file | major | **dismissed** — live Grok Build tools in this environment expose `write` (and design D2 locks `write`) |
| F-003 | PRIMARY_IDE_IDS missing grok | major | **applied** — `src/ui.js` |
| F-004 | HOST_HOOK_MATRIX missing grok | major | **applied** — tests + project-setup + hooks README |
| F-005 | dirLabel double-namespace for plugin | major | **applied** — plugin delivery uses `cfg.dir/` only |

## Fixes applied in this session

- `src/ui.js`: PRIMARY_IDE_IDS + delivery-aware dirLabel
- `tests/project.test.js`: Grok Build matrix row + no-op string updates
- `skills/shared/project-assets/project-setup.md`, `hooks/README.md`, `.atomic-skills/status/hooks/README.md`

## Self-review against code-quality gates

- G1 read-before-claim: applied — F-004 reproduced via failing project.test.js; F-002 dismissed against live tool list
- G2 soft-language: applied
- G3 anti-tautology: N/A for matrix extension assertions
- G4 fixture realism: N/A
- G7 anti-premature-abstraction: no new helper; inline delivery check in dirLabel

**Final status:** Code approved with caveats (F-001 deferred to F2)
**Reviewed HEAD:** 6b123f0c6581cfd0c053d35ab9c45c9441ff97b6
