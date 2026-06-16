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
`review` is **READ-ONLY**. It runs linters and adversarial reviews and reports; it writes no `.atomic-skills/` state and advances nothing. The composed legs keep their own contracts: `review-plan` may correct the **plan prose** (its own HARD-GATE — never the initiative/artifact files), and `review-code` writes only its review file under `.atomic-skills/reviews/`. `review` itself never closes a task, never meets a gate, never advances a phase — those stay with `done` / `phase-done` / `reconcile`.

---

## Legs (in order — each delegates, none re-implements)

### 1. Resolve the target (read-only)
Resolve `<slug>` (or empty → active plan) to a concrete `plan.md` and its phase initiatives, using the **same detection the router runs** (`skills/core/project.md` § *Initial detection*) and `review-plan`'s *Target resolution* ladder. Record the resolved `plan_path`, `<project-id>`, and the `currentPhase` initiative path. If nothing resolves, abort with: `review needs a readable plan file, a known plan slug, or an active plan.`

### 2. Deterministic linters (read-only; wraps existing scripts)
Run the zero-token deterministic checks and report each PASS/WARN/FAIL — do NOT re-implement them:
- `{{BASH_TOOL}} npm run validate-state .atomic-skills/` — schema validity (FAIL ⇒ a downstream skill / aiDeck will reject the state).
- `{{BASH_TOOL}} npm run validate-skills` — catalog + skill-body validity.
- `{{BASH_TOOL}} node scripts/find-signalless-tasks.js` — open tasks with neither a `verifier` nor an `outputs[].path` (WARN: undetectable by drift).
- `{{BASH_TOOL}} node scripts/find-missing-task-summaries.js` — tasks missing the authored summary (WARN).
- `{{BASH_TOOL}} node scripts/detect-completion.js --json` (scope with `--project <id>` when the slug is ambiguous) — open entries that look done in the repo (WARN ⇒ recommend `reconcile`).

### 3. State⇄code coherence (read-only; composes `verify`)
Run the `verify` pass over the resolved target by reading `{{ASSETS_PATH}}/project-verify.md` and executing its checks (schema, legacy, branch, scope, orphans, aiDeck, completion drift, review-gate). Fold its `VERIFY:` verdict into this report as the *coherence* leg. Do NOT duplicate the verify checks here — read that file and run them.

### 4. Adversarial plan read (composes `review-plan`)
Invoke `atomic-skills:review-plan <plan_path> --mode=<local|both>` on the resolved plan. `review-plan` owns the self-loop checklist, the cross-ref + initiative-depth gates (it auto-discovers the phase initiatives), and — in `both` — the sealed codex envelope. Fold its `### Analysis Summary` verdict + counts into this report. This leg is the reason `review` exists beyond `verify`; it is **delegated in full**, never re-derived here.

### 5. Code review (optional; composes `review-code`)
Only when `--with-code` was passed: invoke `atomic-skills:review-code` on the working diff for the resolved target (its Step 0 picks local / codex / both). Fold its verdict + blocker/critical counts into this report. Absent the flag, print `code: skipped (pass --with-code to include)`.

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
- "review can close the drifted tasks it found" — NO. `review` is read-only; closing is `reconcile` / `done` (verifier-gated, GATE-R2). It only reports the drift.
- "review-plan failed but I'll mutate state anyway" — NO. A FAIL leg means the audit found a real problem; surface it before any mutating command.
- "the slug is ambiguous, I'll guess the project" — resolve via the shared ladder; on a cross-project ambiguity, ask for `<project-id>/<plan-slug>` (non-interactive ⇒ abort), never guess.
