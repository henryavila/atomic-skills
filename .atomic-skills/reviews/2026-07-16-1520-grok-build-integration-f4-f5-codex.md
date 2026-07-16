---
date: 2026-07-16T15:22:33Z
topic: grok-build-integration-f4-f5
skill: review-code
reviewer: gpt-5-codex
final_verdict: needs_changes
counts_final: {blocker: 0, critical: 0, major: 4, minor: 1, nit: 0}
mode: codex
schema_version: "1.0"
---

# F4+F5 Codex Review

---
verdict: needs_changes
counts: {blocker: 0, critical: 0, major: 4, minor: 1, nit: 0}
reviewer: gpt-5-codex
pass: blind
schema_version: "1.0"
---

## Summary
The external-both workflow cannot reliably deliver its merge contract. Provider failures terminate orchestration, provider-specific triage occurs before merging, filtered providers are falsely reported as successful, and installed skills lack an executable bridge from provider Markdown to the merge helper. The documented plugin verification also compares against the consuming project's package version.

## Findings

### F-001 [major] orchestration — skills/shared/codex-bridge-assets/envelope-orchestration.md:81-89

**Evidence:**
```md
5. **Pass 1 invocation (blind)** — follow
   `{{ASSETS_PATH}}/providers/«PROVIDER»/invocation-canonical.txt` (legacy root
   `{{ASSETS_PATH}}/invocation-canonical.txt` remains the Codex leaf for older
   callers), substituting `<BRIEFING_PATH>` (file from step 3), `<OUTPUT_PATH>`
   (`/tmp/cross-model-output-pass1-<PROVIDER>-<ts>.md`), `<TIMEOUT_SECONDS>` =
   600, `<MODEL_FLAG>` empty by default (provider resolves its own default;
   user can override with `model:<id>`). Capture the exit code: 124 (GNU
   timeout) / 142 (perl alarm fallback) → timeout, abort with retry suggestion;
   other non-zero → provider error, abort.
```

**Claim:** A failure in the first external-both provider aborts the shared sub-flow instead of continuing to the second provider and returning a partial result.

**Impact:** If Codex times out or fails, Grok is never invoked, so the promised successful half cannot be collected or surfaced.

**Recommendation:** In external-both mode, convert preflight, invocation, and validation failures into provider-specific error results, continue the remaining provider, and abort immediately only in single-provider modes.

**Confidence:** high

---

### F-002 [major] orchestration — skills/shared/codex-bridge-assets/envelope-orchestration.md:118-128

**Evidence:**
```md
11. **Triage + fix proposals**
    - Apply any `«TRIAGE_NOTES»` pre-step (e.g. show a one-line verdict/counts
      summary first; honour an early-exit when no blocker/critical remains).
    - For each finding with severity ∈ {blocker, critical}:
      - Show ID, severity, file:line, claim, recommendation.
      - {{READ_TOOL}} `«TRIAGE_TARGET»` and formulate a concrete edit.
      - Ask `apply / edit / skip`. `apply` uses {{REPLACE_TOOL}} on `«TRIAGE_TARGET»`;
        `edit` receives a new proposal, validates, applies; `skip` records
        `skipped: <reason>` appended to the review file.
    - Major/minor/nit: record in the review file, no required action.
    - Apply any `«TRIAGE_NOTES»` post-step (e.g. suggest running tests after fixes).
```

**Claim:** Invoking the complete skeleton once per provider performs provider-specific triage and edits before the second leg and before the merged list exists.

**Impact:** Applying a Codex finding can dirty the worktree and make Grok's clean-tree preflight abort, while users also triage duplicate unmerged findings instead of the contracted merged result.

**Recommendation:** Split orchestration into a non-mutating provider leg that ends after validated output collection and a single persistence/triage phase that runs only after all available legs are merged.

**Confidence:** high

---

### F-003 [major] state-accounting — src/external-both-merge.js:241-250

**Evidence:**
```js
  /** @type {ExternalProvider[]} */
  const providersFailed = [];
  /** @type {ExternalProvider[]} */
  const providersSucceeded = [];
  if (codexError) providersFailed.push('codex');
  else providersSucceeded.push('codex');
  if (grokError) providersFailed.push('grok');
  else providersSucceeded.push('grok');

  const partial = providersFailed.length > 0 && providersSucceeded.length > 0;
```

**Claim:** An absent provider is classified as successful solely because it has no error.

**Impact:** On Codex and Grok hosts, where same-family routing intentionally removes one leg, results falsely report that both providers succeeded; if the sole invoked leg fails, the omitted leg is still reported successful and `partial` becomes true despite no successful review.

**Recommendation:** Require explicit per-provider status such as `succeeded`, `failed`, or `skipped`, derive success only from that status, and add tests combining filtered routes with successful and failed remaining legs.

**Confidence:** high

---

### F-004 [major] integration — skills/core/review-code.md:148-152

**Evidence:**
```md
1. Run **External sealed-envelope sub-flow** for each remaining provider in order
   (**Codex then Grok** when both remain) on the **same** `CAPTURED_DIFF` (no
   re-capture between legs).
2. **Merge findings for triage** with `src/external-both-merge.js`
   (`mergeExternalBothFindings`) — contract:
```

**Claim:** The installed skill provides neither a resolvable runtime command nor a parser that converts the providers' Markdown outputs into the helper's `FindingInput[]` API.

**Impact:** Outside this repository, `src/external-both-merge.js` resolves against the consumer project and normally does not exist, leaving external-both dependent on an ad hoc manual merge rather than the tested helper.

**Recommendation:** Add a package-root-resolved CLI that parses validated Pass 2 Markdown, invokes `mergeExternalBothFindings`, and emits the merged result; install or expose that entry point and give the skill an exact command using the runtime package-root marker.

**Confidence:** high

---

### F-005 [minor] documentation — docs/kb/grok-build-compatibility.md:105-120

**Evidence:**
```md
# Required keys + version pin
node -e "
const fs=require('fs');
const p=JSON.parse(fs.readFileSync('.grok/plugins/atomic-skills/plugin.json','utf8'));
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
for (const k of ['name','version','description','skills','hooks']) {
  if (!(k in p)) { console.error('missing', k); process.exit(1); }
}
if (p.name !== 'atomic-skills') process.exit(1);
if (p.version !== pkg.version) process.exit(1);
if (p.skills !== './skills/' || p.hooks !== './hooks/hooks.json') process.exit(1);
console.log('plugin.json OK', p.name, p.version);
"
```

**Claim:** The documented verification compares the plugin version with the consumer repository's `package.json`, not the installed atomic-skills package.

**Impact:** Normal project and user-scope installations fail verification when the consumer has a different version or no package file, while an accidental matching application version could produce a false pass.

**Recommendation:** Resolve the expected version from the installed atomic-skills runtime/package-root or its CLI, parameterize the plugin root for project versus user scope, and run Grok's plugin validation command against that root.

**Confidence:** high

## Questions (non-findings)


## Out of scope

## Triage
| # | Action |
|---|--------|
| F-001 | applied — envelope external-both continues on leg failure |
| F-002 | applied — collect-merge-triage order |
| F-003 | applied — explicit provider status skipped/succeeded/failed |
| F-004 | applied — scripts/merge-external-both.js CLI via package-root |
| F-005 | applied — plugin version pin from installed package |

**Fix commit:** ae39c0c
