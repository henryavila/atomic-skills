# project — `review` (lazy detail · NEW in v2.0.0)

Loaded by the router when the user runs `/atomic-skills:project review [<slug>] [--with-code]`.

`review` is the **audit** verb for a *materialized* plan / initiative: it pulls the deterministic linters, the state⇄code `verify` pass, the adversarial `review-plan` read, and (optionally) `review-code` on the working diff into **one** composed report. It is the audit counterpart to `verify` — where `verify` only checks state coherence, `review` adds the adversarial plan-quality read that `review-plan` owns.

**It composes; it never re-implements.** Every check below is run by delegating to machinery that already exists (`validate-state`, `validate-skills`, the `find-*`/`detect-*` scripts, `project verify`, `atomic-skills:review-plan`, `atomic-skills:review-code`). `review` does NOT re-derive the review-plan checklist, the verify checks, or the linters — it sequences them over the resolved target and aggregates their verdicts. Duplicating `review-plan`'s logic here is the one thing this verb must not do.

---

## Contract

### Inputs
- **Implicit:** the `.atomic-skills/` tree in the CWD, the current git branch + working tree.
- **Optional args:**
  - `<slug>` — the plan (or `<project-id>/<plan-slug>`) to audit. **Empty ⇒ the active plan** — resolved the same way `atomic-skills:project` and `atomic-skills:review-plan`'s *Target resolution* ladder resolve it (readable file → slug → active plan). Do NOT re-implement plan discovery; reuse that ladder.
  - `--with-code` — also run `atomic-skills:review-code` on the working diff for the resolved target. Off by default (code review is the heavier, optional leg).
  - `--mode=local|both` — forwarded verbatim to `review-plan` (default `local`, so the audit stays non-interactive and cheap; `both` adds the codex envelope). `review` never invents its own mode picker.

### Output
A sectioned report (PASS / WARN / FAIL per leg) ending in an overall verdict line:
`REVIEW: <PASS | N warning(s) | N failure(s)>`.
On any FAIL, do NOT silently continue into a mutating command in the same turn — surface the failures and let the user decide.

### Mutation policy
`review` is report-only until a delegated write-capable leg is explicitly approved. The deterministic linter and `project verify` legs are read-only. `review-plan` can correct the **plan prose** and write review receipts; `review-code` can write review files under `.atomic-skills/reviews/` and may apply fixes during triage. Before invoking a delegated leg that can write, print the exact delegated command, the paths it is allowed to touch, and the fact that it may write; ask for explicit approval. If approval is denied or unavailable, SKIP that leg and record the skip in the report. `review` itself never closes a task, never meets a gate, never advances a phase — those stay with `done` / `phase-done` / `reconcile`.

---

## Legs (in order — each delegates, none re-implements)

### 1. Resolve the target (read-only)
Resolve `<slug>` (or empty → active plan) to a concrete `plan.md` and its phase initiatives, using the **same detection the router runs** (`skills/core/project.md` § *Initial detection*) and `review-plan`'s *Target resolution* ladder. Record the resolved `plan_path`, `<project-id>`, and the `currentPhase` initiative path. If nothing resolves, abort with: `review needs a readable plan file, a known plan slug, or an active plan.`

### 2. Deterministic linters (read-only; wraps existing scripts)
Run the zero-token deterministic checks and report each PASS/WARN/FAIL — do NOT re-implement them:
- `{{BASH_TOOL}} node "$(cat "$HOME/.atomic-skills/package-root" 2>/dev/null || echo .)/scripts/validate-state.js" .atomic-skills/` — schema validity (FAIL ⇒ a downstream skill / aiDeck will reject the state).
- `{{BASH_TOOL}} node "$(cat "$HOME/.atomic-skills/package-root" 2>/dev/null || echo .)/scripts/validate-skills.js"` — catalog + skill-body validity.
- `{{BASH_TOOL}} node "$(cat "$HOME/.atomic-skills/package-root" 2>/dev/null || echo .)/scripts/find-signalless-tasks.js"` — open tasks with neither a `verifier` nor an `outputs[].path` (WARN: undetectable by drift).
- `{{BASH_TOOL}} node "$(cat "$HOME/.atomic-skills/package-root" 2>/dev/null || echo .)/scripts/find-missing-task-summaries.js"` — tasks missing the authored summary (WARN).
- `{{BASH_TOOL}} node "$(cat "$HOME/.atomic-skills/package-root" 2>/dev/null || echo .)/scripts/detect-completion.js" --json` (scope with `--project <id>` when the slug is ambiguous) — open entries that look done in the repo (WARN ⇒ recommend `reconcile`).

### 3. State⇄code coherence (read-only; composes `verify`)
Run the `verify` pass over the resolved target by reading `{{ASSETS_PATH}}/project-verify.md` and executing its checks (schema, legacy, branch, scope, orphans, aiDeck, completion drift, review-gate). Fold its `VERIFY:` verdict into this report as the *coherence* leg. Do NOT duplicate the verify checks here — read that file and run them.

### 4. Adversarial plan read (composes `review-plan`)
Before this leg, run the delegated-write gate from the mutation policy because `review-plan` may rewrite the plan prose and write a receipt. If approved, invoke `atomic-skills:review-plan <plan_path> --mode=<local|both> --no-cross-ref` on the resolved plan. `review-plan` owns the self-loop checklist, the cross-ref + initiative-depth gates (it auto-discovers the phase initiatives), and — in `both` — the sealed codex envelope. Fold its `### Analysis Summary` verdict + counts into this report. If the gate is denied or unavailable, print `review-plan: skipped (delegated write-capable leg not approved)`. This leg is the reason `review` exists beyond `verify`; when it runs, it is **delegated in full**, never re-derived here.

**Pass `--no-cross-ref` (cross-ref prompt suppression).** `review-plan`'s Step 0a mode picker has a non-interactive abort, but its Step 0b cross-ref picker does **not** — without an explicit cross-ref flag it fires an interactive `{{ASK_USER_QUESTION_TOOL}}` (more so now that the frontmatter `references[]`/`supersedes` seed makes the "detected artifacts" option appear). `review` always passes `--no-cross-ref` to keep `review-plan` from asking an extra cross-ref question; the only prompt `project review` may issue is the delegated-write approval from the mutation policy above. A user who wants the cross-ref coverage runs `atomic-skills:review-plan <plan> --cross-ref=…` directly.

### 5. Code review (optional; composes `review-code`)
Only when `--with-code` was passed: run the delegated-write gate from the mutation policy because `review-code` may persist review artifacts and apply fixes. If approved, invoke `atomic-skills:review-code` on the working diff for the resolved target (its Step 0 picks local / codex / both). Fold its verdict + blocker/critical counts into this report. If the gate is denied or unavailable, print `review-code: skipped (delegated write-capable leg not approved)`. Absent the flag, print `code: skipped (pass --with-code to include)`.

---

## Report shape

```
project review — <plan-slug> @ <branch>   (target: <project-id>/<plan-slug>, phase <id>)

[1] target      PASS   resolved <plan_path> (active plan)
[2] linters     WARN   validate-state ok; 1 signalless task (T-007); 2 look-done (run `reconcile`)
[3] verify      PASS   VERIFY: 0 warning(s), 0 failure(s)
[4] review-plan WARN   needs_changes — 0 blocker, 1 significant (oversummarized AC at plan.md:L88)
[5] review-code SKIP   pass --with-code to include

REVIEW: 2 warning(s), 0 failure(s)
```

## Red flags
- "I'll re-implement the review-plan checklist inline so the report is self-contained" — NO. `review` composes; re-deriving `review-plan`'s logic is the scope boundary this verb must not cross. Delegate and fold the verdict.
- "review can close the drifted tasks it found" — NO. Even when delegated review legs are approved to write their own artifacts/prose fixes, closing is `reconcile` / `done` (verifier-gated, GATE-R2). `review` only reports the drift.
- "review-plan failed but I'll mutate state anyway" — NO. A FAIL leg means the audit found a real problem; surface it before any mutating command.
- "the slug is ambiguous, I'll guess the project" — resolve via the shared ladder; on a cross-project ambiguity, ask for `<project-id>/<plan-slug>` (non-interactive ⇒ abort), never guess.
