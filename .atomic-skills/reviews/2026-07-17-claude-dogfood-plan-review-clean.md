---
verdict: needs_changes
counts: {blocker: 2, critical: 2, major: 4, minor: 2, nit: 0}
provider: claude
pass: dogfood-plan-review
---

## Summary

The plan has structural gaps in F0 and F2 exit gates that would allow phases to pass without completing required work. F0-G2 verifies only one of two required provider leaf files, and F2 fails to verify the core EXTERNAL_PROVIDERS set change needed for Claude routing. F2-G2's grep pattern is already satisfied by existing documentation, providing a false pass. The design makes unverified claims about Claude model aliases. Several documentation files need updating but aren't verified by exit gates.

## Findings

### plan.md:62-66 — F0-G2 verifier incomplete
**Severity:** blocker  
**Claim:** Exit gate validates "Draft Claude provider leaf files exist"  
**Impact:** Verifier checks only `invocation-canonical.txt` for safe-mode, but glossary defines provider leaf as BOTH `preflight-checks.txt` AND `invocation-canonical.txt` (plan.md:40). Phase goal (line 50) says "draft the provider leaf files" (plural). Incomplete verifier allows phase to complete with missing preflight-checks.txt.  
**Recommendation:** Extend F0-G2 verifier to check both files exist and are non-empty: `test -s skills/shared/codex-bridge-assets/providers/claude/preflight-checks.txt && test -s skills/shared/codex-bridge-assets/providers/claude/invocation-canonical.txt`  
**Confidence:** High

### plan.md:197 — EXTERNAL_PROVIDERS set not verified
**Severity:** blocker  
**Claim:** F2 "Register Claude as an external provider id"  
**Impact:** Current implementation at src/cross-model-host-default.js:24 hardcodes `EXTERNAL_PROVIDERS = new Set(['codex', 'grok'])`. The `isSameFamilyExternal` function (line 95) checks `if (!EXTERNAL_PROVIDERS.has(p)) return false` — it will NOT recognize 'claude' as a valid provider. Line 197 also hardcodes `legs = ['codex', 'grok']` for external-both. F2-G1 runs tests but doesn't verify the source constant is updated. Routing fails without this change.  
**Recommendation:** Add explicit F2 acceptance for EXTERNAL_PROVIDERS including 'claude', and test coverage that `isSameFamilyExternal('claude', 'claude')` returns false (it currently returns false because 'claude' is not in the set, but the semantic gate is wrong).  
**Confidence:** High

### plan.md:153-155 — F2-G2 grep pattern already satisfied
**Severity:** critical  
**Claim:** F2-G2 verifies "host-default-external.md documents Claude external and external-both order"  
**Impact:** The grep pattern `grep -E 'claude|codex → grok|codex.*grok.*claude'` matches EXISTING content at lines 24 and 37 of host-default-external.md ("claude" already present, table already has "codex → grok"). Gate passes before F2 work begins.  
**Recommendation:** Strengthen verifier to check for specific NEW content: the external-both order with Claude (e.g., "codex → grok → claude") and Claude as an available external provider mode.  
**Confidence:** High

### design excerpt D7 — Unverified alias stability claim
**Severity:** critical  
**Claim:** "stable aliases documented by Claude (`opus`, `sonnet`, `haiku`, plus any alias the installed `--help` names)"  
**Impact:** D7 claims these aliases are "stable" and "documented by Claude" but provides no verification. The plan's F0 smoke should include checking `claude --help` for these aliases before building the picker UX. If aliases don't exist or are unstable, the interactive picker design fails.  
**Recommendation:** Add F0 acceptance to record observed aliases from `claude --help` in smoke-notes.md, and include alias verification in F3-G2 model resolution tests.  
**Confidence:** High

### envelope-orchestration.md:46 — Merge CLI example omits third provider
**Severity:** major  
**Claim:** D6 states "CLI compat (lock for F3): keep positional paths in fixed order `codex.json grok.json [claude.json]`"  
**Impact:** envelope-orchestration.md line 46 documents the merge CLI but only shows two positional args: `node .../merge-external-both.js <codex.json|-|skip> <grok.json|-|skip>`. Documentation doesn't reflect the third optional arg needed for Claude. F4 doesn't verify this doc is updated.  
**Recommendation:** Add F4-G1 verification that envelope-orchestration.md merge example shows the third `[claude.json]` argument, or create explicit F4 acceptance for updating this documentation.  
**Confidence:** High

### envelope-orchestration.md:60 — Provider enum excludes Claude
**Severity:** major  
**Claim:** F2 "Register Claude as an external provider id"  
**Impact:** envelope-orchestration.md line 60 table shows `«PROVIDER»` as "external provider id: `codex` or `grok`". F2 doesn't verify this documentation is updated to include Claude.  
**Recommendation:** Add F4-G1 or explicit F2 acceptance to verify envelope-orchestration.md table includes Claude in the provider enum.  
**Confidence:** High

### plan.md:171 — Test file existence not verified
**Severity:** major  
**Claim:** F3-G1 assumes `tests/external-both-merge.test.js` exists  
**Impact:** Verifier runs `node --test tests/external-both-merge.test.js` but if the file doesn't exist or wasn't created in F2, the gate fails with file-not-found rather than a meaningful test failure. Multiple gates (F1-G1, F2-G1, F3-G2, F5-G2) have the same issue.  
**Recommendation:** For gates that run new test files, verify files exist first: `test -f tests/external-both-merge.test.js && node --test tests/external-both-merge.test.js`  
**Confidence:** High

### plan.md:283-285 — SKIPPED cross-model review unverified
**Severity:** major  
**Claim:** "cross-model: SKIPPED — not offered yet at materialize announce (will prompt operator)"  
**Impact:** Plan claims it will "prompt operator" for cross-model review but provides no verification that this prompt exists or works. Reviews section doesn't have acceptance criteria.  
**Recommendation:** Either remove the "will prompt operator" claim (since SKIPPED means it's not implemented), or add explicit acceptance that the prompt is surfaced and working.  
**Confidence:** Medium

### plan.md:62-66 — F0-G1 grep allows false positive
**Severity:** minor  
**Claim:** F0-G1 verifies smoke-notes.md records required elements  
**Impact:** The grep `grep -E 'briefing-channel|tools-allowlist|auth-path|exit-0'` is an OR condition — a file containing just "briefing-channel" would pass without documenting the other three required elements.  
**Recommendation:** Use separate grep checks per required element, or a more precise pattern.  
**Confidence:** High

### plan.md:171-175 — F3-G1 acceptance unclear on optional arg
**Severity:** minor  
**Claim:** "external-both-merge tests green with Claude as third provider and optional third CLI arg"  
**Impact:** It's unclear whether "optional third CLI arg" means the CLI must handle 3 args OR that omitting the 3rd arg means "skipped" behavior. The verifier runs a single test but doesn't specify what scenarios it covers.  
**Recommendation:** Clarify acceptance to specify that tests must cover: 2 args only (legacy compat), 3 args with Claude, 3 args with skip/skip patterns.  
**Confidence:** Medium
