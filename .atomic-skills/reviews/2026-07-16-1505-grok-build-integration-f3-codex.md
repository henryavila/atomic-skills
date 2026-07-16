---
date: 2026-07-16T15:07:32Z
topic: grok-build-integration-f3
skill: review-code
reviewer: gpt-5-codex
final_verdict: needs_changes
counts_final: {blocker: 0, critical: 0, major: 5, minor: 2, nit: 0}
mode: codex
schema_version: "1.0"
---

# F3 Codex Review

---
verdict: needs_changes
counts: {blocker: 0, critical: 0, major: 5, minor: 2, nit: 0}
reviewer: gpt-5-codex
pass: blind
schema_version: "1.0"
---

## Summary
The provider helper tests pass, but the composed skill contracts remain inconsistent. Forced modes can reintroduce same-family execution after routing, plan receipts remain Codex-specific, cadence counting fails open without host context, and active project strings retain the old product name. Receipt serialization and legacy index migration also lose or misalign provider metadata.

## Findings

### F-001 [major] routing — skills/core/review-code.md:128-131

**Evidence:**
```md
2. **EXTERNAL PHASE** — Run External sealed-envelope sub-flow on the SAME
   `CAPTURED_DIFF` with `«PROVIDER»` = host external default (`both`) or the
   forced provider (`both-codex`/`both-grok`). Pass-1 MUST NOT mention local
   findings, fixes, iteration counts, or a prior review.
```

**Claim:** The external phase rederives its provider from the original forced mode instead of using the provider returned by `resolveReviewRoute`.

**Impact:** On a Codex host, `both-codex` followed by the interactive “offer cross-family” decision resolves to Grok, but this flow instructs the operator to run forced Codex, restoring the prohibited same-family external leg; `review-plan` contains the same conflict.

**Recommendation:** Bind every external phase exclusively to `route.externalProvider`, and add tests for `both-codex` and `both-grok` with `sameFamilyDecision: 'offer-cross-family'`.

**Confidence:** high

---

### F-002 [major] receipt-contract — skills/shared/project-assets/plan-initiative-depth.md:152-170

**Evidence:**
```md
Maintain a `## Reviews` section in the plan body, appended after `## Self-review
against code-quality gates` (or at end-of-body if that block is absent). Write ONE
line per review channel; **re-running a channel UPDATES its existing line, never
duplicates** (idempotent — match by the `- internal:` / `- codex:` prefix):

```markdown
## Reviews

- internal: <zero findings | N finding(s) applied> @ <commitSha | uncommitted> (<ISO-8601 UTC>)
- codex: <PASSED | needs_changes (resolved) | SKIPPED — <reason>> — <reviews/<file>.md | n/a>
```

- `mode ∈ {local, both}`: write/refresh the `- internal:` line. Stamp the commit
  with {{BASH_TOOL}} `git rev-parse --short HEAD 2>/dev/null || echo uncommitted`
  and the time with `date -u +%Y-%m-%dT%H:%M:%SZ`; edit the body with
  {{REPLACE_TOOL}}. This line is the **mandatory** receipt.
- `mode ∈ {codex, both}`: write/refresh the `- codex:` line with the verdict and
  the persisted `reviews/<file>.md` path. Optional — codex is offered, not forced;
```

**Claim:** The closing template delegated to by `review-plan` still supports only `codex|both`, writes only a `- codex:` receipt, and has no provider field.

**Impact:** Grok, `both-grok`, and `external-both` plan reviews can be omitted from the plan receipt or falsely recorded as Codex, contradicting the new provider-aware receipt and product-label contracts.

**Recommendation:** Update this canonical closing template for every new mode, emit `- cross-model (<provider>):`, include the routed provider, and define idempotent replacement separately for each provider channel.

**Confidence:** high

---

### F-003 [major] fail-open-cadence — src/review-provider-field.js:179-188

**Evidence:**
```js
export function countsAsCrossModel(input) {
  if (input.sameFamilyRemap === true) return false;
  const provider = normalizeProvider(input.provider);
  if (provider == null || provider === 'local') return false;
  if (input.hostFamily != null && String(input.hostFamily) !== '') {
    return !isSameFamilyExternal(normalizeHostFamily(input.hostFamily), provider);
  }
  // Without host context: any external provider is potentially cross-model
  // (callers with host should always pass hostFamily).
  return true;
}
```

**Claim:** `countsAsCrossModel` returns true when host-family context is absent even though cross-family status cannot be established.

**Impact:** A caller that omits `hostFamily` can advance `lastReviewedCommit` after a same-family Codex or Grok review, falsely rendering the CROSS-MODEL REVIEW cadence green.

**Recommendation:** Require a resolved host family and return false or throw when it is absent; require `review-due` to pass the detected host explicitly.

**Confidence:** high

---

### F-004 [major] product-rename — skills/shared/project-assets/project-transitions.md:223-228

**Evidence:**
```md
- **Codex review**: ran via `atomic-skills:project review-due` at HEAD = `<sha>`, verdict `<v>`, counts `<…>`, file `.atomic-skills/reviews/<…>.md`. / SKIPPED at phase-done per user (`<reason or "no reason given">`).
- **Review gate (G2)**: recorded on the phase descriptor as `reviewGate: { status: <passed|skipped>, at: <sha>, mode: <local|both>, reason: <if skipped> }`. This prose line is the human audit; the descriptor field is the machine-checkable one GATE-R3 enforces — they must agree.
- **Lessons (G1)**: distilled M lesson(s) into `lessons/<initiative-slug>.md` (K reusable, L local), ratified by the user — or `no lessons distilled (clean phase)`. The next phase's start gate dispositions the reusable+open ones.
```

**Claim:** Active phase-transition output still labels provider-neutral reviews as “Codex review.”

**Impact:** Grok-backed reviews are archived and displayed as Codex reviews, leaving the CROSS-MODEL REVIEW rename incomplete and corrupting provider provenance in human audit records.

**Recommendation:** Replace all case variants of “Codex review” in `skills/core` and `skills/shared/project-assets` with the provider-neutral product label, and add a case-insensitive regression test.

**Confidence:** high

---

### F-005 [minor] receipt-serialization — skills/shared/codex-bridge-assets/review-file-template.txt:6-18

**Evidence:**
```md
---
date: {{ISO_TIMESTAMP}}
topic: {{SLUG}}
artifact: {{ARTIFACT_PATH}}
skill: {{SKILL_NAME}}
reviewer: {{MODEL_ID}}
provider: {{PROVIDER}}
provider_version: {{PROVIDER_VERSION}}
final_verdict: {{VERDICT}}
counts_final: {{COUNTS_FINAL}}
counts_blind: {{COUNTS_BLIND}}
framing_delta: {{FRAMING_DELTA}}
schema_version: "1.1"
```

**Claim:** The persisted receipt template omits `sameFamilyRemap` despite the routing contract requiring remapped receipts to record it as true.

**Impact:** Serialized receipts cannot distinguish an explicitly selected local review from a same-family request remapped to local, so the in-memory writer/reader round-trip test does not reflect actual persisted data.

**Recommendation:** Add `same_family_remap` to review-file frontmatter and the documented `last-review.json` shape, then test serialization and parsing of a complete remapped receipt.

**Confidence:** high

---

### F-006 [minor] index-migration — skills/shared/codex-bridge-assets/index-row-template.txt:33-39

**Evidence:**
```md
### Migration note (old INDEX rows)

Pre-F3 INDEX headers lack the **Provider** column (6 columns). When appending
new rows, rewrite the header to the 7-column form above if missing Provider.
When *reading* a 6-column legacy row, assume `provider: codex` for display
only; do not rewrite historical rows in place unless the operator requests a
one-shot INDEX rewrite.
```

**Claim:** Rewriting only the header to seven columns while retaining six-column historical rows shifts every legacy value into the wrong displayed column.

**Impact:** Legacy verdicts appear under Provider, counts appear under Verdict, and framing deltas appear under Counts after the first F3 append.

**Recommendation:** During header migration, insert `codex` into every legacy row atomically, or retain a six-column index until a complete row migration is performed.

**Confidence:** high

---

### F-007 [major] argument-contract — skills/shared/local-review-assets/diff-capture.md:21-38

**Evidence:**
```md
| Flag | Effect |
|---|---|
| `--mode=local` | Skip Step 0 mode picker; force local sealed envelope. |
| `--mode=codex` | Skip Step 0 mode picker; force codex envelope. |
| `--mode=both` | Skip Step 0 mode picker; force local→codex. |
| `--allow-dirty` | Include working-tree changes in the captured diff; suppress the dirty-tree abort. |
| `--max-iterations=N` | Max verification-loop iterations (default 3). Convergence rule (plateau detection) may stop earlier. |

Everything not starting with `--` is `git_ref`. It may be a git ref, a
scope keyword (`wip` | `branch` | `all`), or empty — keyword and empty
forms are handled by **Scope resolution** below, never by guessing a ref.

**Non-interactive abort.** Without a TTY, every interactive prompt in
this skill is unavailable — do NOT invoke {{ASK_USER_QUESTION_TOOL}} in
background. Abort instead when, non-interactively:
- no explicit `--mode=` flag: "review-code invoked without TTY and
  without `--mode=`; pass `--mode=local|codex|both` explicitly."
```

**Claim:** The authoritative argument-capture asset used before `review-code` Step 0 was not updated for `grok`, `both-codex`, `both-grok`, `external-both`, or `--accept-same-family-as-local`.

**Impact:** Implementations following this canonical contract can reject or mishandle the new modes before reaching the new router, while non-interactive diagnostics incorrectly claim only the three legacy modes are valid.

**Recommendation:** Update the canonical flag table, accepted-mode validation, and abort diagnostics, and add contract tests that invoke every new mode through argument capture.

**Confidence:** high

## Questions (non-findings)

- None.

## Out of scope

- F5 external-both finding merge and severity-conflict behavior.
- Marketplace behavior.
- Mode-2 execution.

## Triage
All majors applied in `aa145cf8fddc9213891bf7d1d0e9edeaab57b6c9` (aa145cf). Minors on same_family_remap template + INDEX migration applied.

**Final status:** approved with fixes applied
