---
date: 2026-07-16T14:46:28Z
topic: grok-build-integration-f2
skill: review-code
reviewer: gpt-5-codex
final_verdict: needs_changes
counts_final: {blocker: 0, critical: 1, major: 4, minor: 1, nit: 0}
mode: codex
schema_version: "1.0"
---

# F2 Codex Review

---
verdict: needs_changes
counts: {blocker: 0, critical: 1, major: 4, minor: 1, nit: 0}
reviewer: gpt-5-codex
pass: blind
schema_version: "1.0"
---

## Summary

The Grok invocation exposes a credential-exfiltration surface because reviewed, attacker-controlled text reaches a model retaining broad filesystem-read and network-capable tools. Four additional major defects permit local file truncation through predictable temporary paths, leave the canonical command malformed, silently downgrade invalid modes to local review, and bypass same-family safeguards in `external-both`.

The normal Grok→Codex, Codex→Grok, and Claude→Codex matrix rows are not the blocking issue; the unsafe provider boundary and fail-open routing paths require changes.

## Findings

### F-001 [critical] security — skills/shared/codex-bridge-assets/providers/grok/invocation-canonical.txt:50-57

**Evidence:**
```
run_with_timeout <TIMEOUT_SECONDS> grok \
  <MODEL_FLAG> \
  --sandbox read-only \
  --disallowed-tools "search_replace,write,run_terminal_cmd,Agent" \
  --no-memory \
  --output-format plain \
  --prompt-file <BRIEFING_PATH> \
  > <OUTPUT_PATH> 2>/tmp/grok-review-stderr-<ts>.log
```

**Claim:** The invocation sends attacker-controlled review artifacts to an agent that can read outside the review scope and retains network-capable tools omitted from the denylist.

**Impact:** A prompt embedded in a reviewed diff can induce reads of credentials or other local secrets and disclose them through web or integration tools; built-in sandbox activation can also fail open while the denylist remains the only boundary.

**Recommendation:** Run sealed-envelope reviews without filesystem, web, MCP, or integration tools; otherwise use a strict scope-limited sandbox plus a read-only allowlist, explicitly disable web access, and abort unless sandbox enforcement is confirmed.

**Confidence:** high

---

### F-002 [major] security — skills/shared/codex-bridge-assets/providers/grok/invocation-canonical.txt:50-57

**Evidence:**
```
run_with_timeout <TIMEOUT_SECONDS> grok \
  <MODEL_FLAG> \
  --sandbox read-only \
  --disallowed-tools "search_replace,write,run_terminal_cmd,Agent" \
  --no-memory \
  --output-format plain \
  --prompt-file <BRIEFING_PATH> \
  > <OUTPUT_PATH> 2>/tmp/grok-review-stderr-<ts>.log
```

**Claim:** Shell redirection writes to a predictable shared `/tmp` path without exclusive creation or symlink protection.

**Impact:** Another local user can pre-create the expected log path as a symlink, causing the invoking user’s shell to truncate or overwrite any user-writable target despite the advertised read-only review boundary.

**Recommendation:** Create a private directory with `umask 077` and `mktemp -d`, place briefing/output/stderr files inside it, reject pre-existing paths, and remove the directory with a cleanup trap.

**Confidence:** high

---

### F-003 [major] correctness — skills/shared/codex-bridge-assets/providers/grok/invocation-canonical.txt:14-57

**Evidence:**
```
## Variables to substitute

- `<BRIEFING_PATH>`: path to briefing markdown file (input; use `--prompt-file`)
- `<OUTPUT_PATH>`: path to output markdown file (stdout redirect; Grok has no `-o`)
- `<TIMEOUT_SECONDS>`: integer seconds (default 600 = 10 min)
- `<MODEL_FLAG>`: empty by default. If user passed `--model X`, set to `--model X`.
```

```
run_with_timeout <TIMEOUT_SECONDS> grok \
  <MODEL_FLAG> \
  --sandbox read-only \
  --disallowed-tools "search_replace,write,run_terminal_cmd,Agent" \
  --no-memory \
  --output-format plain \
  --prompt-file <BRIEFING_PATH> \
  > <OUTPUT_PATH> 2>/tmp/grok-review-stderr-<ts>.log
```

**Claim:** The canonical command uses `<ts>` even though neither its substitution contract nor the orchestration declares it as a value to replace.

**Impact:** Following the documented substitutions leaves `<ts>` in the command, where shells parse `<` and `>` as redirection operators, causing the invocation to fail or redirect output to unintended files.

**Recommendation:** Replace `<ts>` with a declared `<STDERR_PATH>` variable bound by orchestration to a securely created file, and add a test that executes the fully substituted command against a stub `grok` binary.

**Confidence:** high

---

### F-004 [major] correctness — src/cross-model-host-default.js:107-169

**Evidence:**
```js
export function externalProviderForMode(mode, hostFamily) {
  const m = String(mode || '').toLowerCase();
  if (m === 'local') return null;
  if (m === 'codex' || m === 'both-codex') return 'codex';
  if (m === 'grok' || m === 'both-grok') return 'grok';
  if (m === 'both') return defaultExternalProvider(hostFamily);
  if (m === 'external-both') return 'codex'; // first leg; second is always grok
  return null;
}
```

```js
  if (mode === 'local' || externalProvider == null) {
    return {
      action: 'run',
      provider: 'local',
      sameFamilyRemap: false,
      includesLocal: true,
      externalProvider: null,
      hostFamily,
      mode,
    };
  }
```

**Claim:** Every unknown mode returns `null` and is silently routed as a successful local review.

**Impact:** A typo or caller-version mismatch removes the requested independent external review without an error, producing a false-green review result.

**Recommendation:** Validate `mode` against an explicit runtime set and return `action: 'abort'` for unknown values; reserve local routing exclusively for the literal `local` mode.

**Confidence:** high

---

### F-005 [major] correctness — src/cross-model-host-default.js:172-184

**Evidence:**
```js
  // external-both: never same-family with a single host of codex/grok alone for both legs;
  // Claude/cursor/unknown hosts use two externals. No same-family abort on the mode itself.
  if (mode === 'external-both') {
    return {
      action: 'run',
      provider: 'codex',
      sameFamilyRemap: false,
      includesLocal: false,
      externalProvider: 'codex',
      externalProviders: ['codex', 'grok'],
      hostFamily,
      mode,
    };
  }
```

**Claim:** `external-both` returns before same-family validation, so Codex hosts run a Codex leg and Grok hosts run a Grok leg without confirmation or abort.

**Impact:** A same-family leg is executed and recorded as external cross-model review, corrupting review-cadence and independence guarantees.

**Recommendation:** Validate every external leg against the host, restricting `external-both` to non-Codex/non-Grok hosts or applying the existing confirm/remap/HARD-ABORT policy per leg.

**Confidence:** high

---

### F-006 [minor] correctness — skills/shared/codex-bridge-assets/providers/grok/preflight-checks.txt:31-48

**Evidence:**
```
## 3. Auth is usable (session or API key)

Grok accepts interactive OAuth (`~/.grok/auth.json`) or headless
`XAI_API_KEY`. Detect failure early with a cheap call:

```bash
# Prefer a version-only check first (no network). Then optional auth probe:
# GROK_HOME or missing credentials produce a distinctive message.
```

If a prior run or a probe prints (or exits with) auth failure text matching:
```

**Claim:** The authentication preflight contains no executable probe and only reacts if some unspecified prior operation already exposed an authentication failure.

**Impact:** Unauthenticated installations pass preflight and fail during Pass 1 instead of producing the promised early, actionable abort.

**Recommendation:** Specify a bounded, non-mutating authentication probe with timeout and exact exit/output checks, and test it using authenticated and unauthenticated fixtures.

**Confidence:** high

## Questions (non-findings)


## Out of scope

- F3 integration of the expanded modes into `review-code` and `review-plan`.
- `external-both` result merging and reconciliation.
- Marketplace behavior.

## Triage
| # | Action |
|---|--------|
| F-001 critical | applied — expanded denylist (web/MCP/media/subagent) |
| F-002 major | applied — mktemp private dir + STDERR_PATH |
| F-003 major | applied — declare STDERR_PATH (no bare ts) |
| F-004 major | applied — unknown mode aborts |
| F-005 major | applied — external-both filters same-family legs |
| F-006 minor | deferred — auth probe still prose-level (preflight documents messages) |

**HEAD after fixes:** d056141c173e4f9518485844e22207c199cc2f88
