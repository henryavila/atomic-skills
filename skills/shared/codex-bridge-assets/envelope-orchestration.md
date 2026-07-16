# Cross-model sealed-envelope orchestration (shared skeleton)

The two-pass sealed-envelope sub-flow is **byte-identical** between
`review-code` and `review-plan` except for a handful of artifact-specific slots
and the external **provider** (`codex` | `grok`). This file is the single source
for the orchestration skeleton; each caller references it and binds only the
`«SLOTS»` listed under **Artifact bindings**.

Logical module: **`cross-model-bridge`** (`codex-bridge` is a compatibility
alias). On-disk assets live under `skills/shared/codex-bridge-assets/`
(`{{ASSETS_PATH}}/…`). Provider-specific preflight and invocation live under
`{{ASSETS_PATH}}/providers/«PROVIDER»/`. Shared templates (anti-framing, Pass 1/2
outputs, review file) stay provider-agnostic at the assets root.

**Before binding `«PROVIDER»`:** resolve host vs requested mode with
`{{ASSETS_PATH}}/host-default-external.md` and the pure helper
`src/cross-model-host-default.js` (`resolveReviewRoute`). Same-family interactive
→ confirm→`local`; non-interactive → **HARD ABORT** unless
`--accept-same-family-as-local`. Never invoke a provider leaf when the route
resolved to `local`.

Do NOT inline-rewrite the leaf assets; reference them and substitute
placeholders. Do NOT re-inline this skeleton back into a caller — one definition,
two callers.

### external-both (multi-provider callers)

When the caller mode is `external-both`, invoke this skeleton **once per
provider** in order (Codex then Grok) on the same cleaned artifact, then merge
finding lists with `src/external-both-merge.js` (`mergeExternalBothFindings`):
merge key = `file:line` + normalized claim; severity conflict keeps higher
severity with dual provenance; partial provider failure keeps the successful
half and surfaces the error. Human triage only — never auto-apply.

## Artifact bindings (each caller supplies these)

| Slot | Bound by the caller to |
|------|------------------------|
| `«PROVIDER»` | external provider id: `codex` or `grok` (never the host family without same-family routing — see `host-default-external.md`) |
| `«INPUT»` | what the captured/validated input is, and how it is obtained (no re-capture) |
| `«PASS1_TEMPLATE»` | the `{{ASSETS_PATH}}/pass1-briefing-template-*.txt` for this artifact |
| `«CONSTRAINTS»` | how externally-verifiable factual constraints are gathered |
| `«ARTIFACT»` | what fills the Pass-1 template's artifact placeholder(s): always `{{ARTIFACT}}`, plus `{{ARTIFACT_PATH}}` when the caller's template carries it |
| `«SIZE_BUDGET»` | the briefing size ceiling (tokens), excluding the artifact portion |
| `«TRIAGE_TARGET»` | what an `apply` edit operates on (the file(s) under review) |
| `«TRIAGE_NOTES»` | artifact-specific triage pre/postamble (a summary line to show first, an early-exit condition, a post-fix suggestion) — empty if none |

## Steps

1. **Pre-flight checks** — follow
   `{{ASSETS_PATH}}/providers/«PROVIDER»/preflight-checks.txt` (legacy root
   `{{ASSETS_PATH}}/preflight-checks.txt` remains the Codex leaf for older
   callers). ABORT if any check fails. (`--allow-dirty` passes through from the
   argument contract; the dirty-tree check in the ref-validation step has
   already filtered this where applicable.)

2. **Input** — `«INPUT»`. Both phases use the same captured/validated material;
   do NOT re-capture (no fresh `git diff`, no re-read past validation). In
   `mode == both`, the input is the CLEANED artifact (post-local-fixes).

3. **Curate Pass 1 briefing (factual minimal)**
   - {{READ_TOOL}} `«PASS1_TEMPLATE»`.
   - Identify externally verifiable factual constraints: `«CONSTRAINTS»`.
   - Identify non-goals (short, no rationale).
   - **DO NOT** include intent, curated memory, authorship, or (when
     `mode == both`) any reference to the prior local review or fix log.
   - Substitute placeholders:
     - `{{ANTI_FRAMING_DIRECTIVE}}` ← contents of `{{ASSETS_PATH}}/anti-framing-directive.txt`
     - `{{NON_GOALS_LIST}}` ← short bullet list with no rationale
     - `{{ARTIFACT}}` ← `«ARTIFACT»`
     - `{{ARTIFACT_PATH}}` ← the artifact's path — **only when the caller's Pass-1 template carries this placeholder** (review-plan binds it to `plan_path`; review-code's template has none, so skip it there)
     - `{{OUTPUT_TEMPLATE_PASS1}}` ← contents of `{{ASSETS_PATH}}/output-template-pass1.txt`
   - Save to `/tmp/cross-model-briefing-pass1-<PROVIDER>-<timestamp>.md`.
   - Size check (compute excluding the artifact portion): must stay within
     `«SIZE_BUDGET»`. Over budget → likely residual framing; request extra approval.

4. **Briefing confirmation** — show the user a compact summary (artifact/ref,
   modified files or artifact path, factual constraints/callers, estimated
   tokens). Ask `approve / edit / cancel`. On cancel: abort.

5. **Pass 1 invocation (blind)** — follow
   `{{ASSETS_PATH}}/providers/«PROVIDER»/invocation-canonical.txt` (legacy root
   `{{ASSETS_PATH}}/invocation-canonical.txt` remains the Codex leaf for older
   callers), substituting `<BRIEFING_PATH>` (file from step 3), `<OUTPUT_PATH>`
   (`/tmp/cross-model-output-pass1-<PROVIDER>-<ts>.md`), `<TIMEOUT_SECONDS>` =
   600, `<MODEL_FLAG>` empty by default (provider resolves its own default;
   user can override with `model:<id>`). Capture the exit code: 124 (GNU
   timeout) / 142 (perl alarm fallback) → timeout, abort with retry suggestion;
   other non-zero → provider error, abort.

6. **Pass 1 validation** — `{{ASSETS_PATH}}/validation-checklist.txt` (universal
   checks 1-9). Failure → 1 corrective retry. Failure again → escalate raw.

7. **Build Pass 2 briefing (informed)** — Pass 1 briefing (without
   `Begin review now.`) + contents of `{{ASSETS_PATH}}/pass2-prompt-suffix.txt`,
   substituting `{{CONSTRAINTS_LIST}}` (factual constraints from step 3),
   `{{PASS_1_OUTPUT}}` (Pass 1 output), `{{OUTPUT_TEMPLATE_PASS2}}` (contents of
   `{{ASSETS_PATH}}/output-template-pass2.txt`). Save to
   `/tmp/cross-model-briefing-pass2-<PROVIDER>-<ts>.md`.

8. **Pass 2 invocation (informed)** — same command as step 5 with the pass-2
   briefing path and output path.

9. **Pass 2 validation** — universal checks 1-9 + Pass-2-only checks 10-13 from
   `{{ASSETS_PATH}}/validation-checklist.txt`. Failure → 1 corrective retry.
   Failure again → escalate raw.

10. **Persistence**
    - {{BASH_TOOL}}: `mkdir -p .atomic-skills/reviews/`
    - {{READ_TOOL}} `{{ASSETS_PATH}}/review-file-template.txt`. Substitute
      placeholders. When `mode == both`, the review file MUST include both the
      local fix log (audit trail) AND external provider findings (record
      `provider: «PROVIDER»`).
    - Save to `.atomic-skills/reviews/YYYY-MM-DD-HHMM-<slug>.md`.
    - Update `.atomic-skills/reviews/INDEX.md` (create if missing) with a row
      from `{{ASSETS_PATH}}/index-row-template.txt`.

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

12. **Closing** — proceed to the caller's "Closing" section.
