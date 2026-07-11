# project — `verify` (lazy detail · NEW in v2.0.0)

Loaded by the router when the user runs `/atomic-skills:project verify`.

`verify` reconciles `.atomic-skills/` state against the actual repository — schema validity, branch coherence, scope coverage, orphaned files, completion drift (open entries that look done in the repo), and (when aiDeck is reachable) the dashboard's view of the same state. It is the single coherence command that did not exist before the unification: previously schema-validation (`validate-state`), drift (`scope-creep`), branch-match (default view), and aiDeck STATE_ERROR each lived in different places and the user had to run them separately.

---

## Contract

### Inputs
- **Implicit:** the `.atomic-skills/` tree in the CWD, the current git branch + working tree, and (optionally) a running aiDeck instance.
- **Optional args:**
  - `--fix` — explicit authorization to apply the deterministic, safe repairs the read-only pass identifies (schema normalization via `src/normalize.js`, nothing else). Without `--fix`, `verify` is strictly read-only and mutates nothing.
  - `--slug <slug>` — scope the verification to one plan/initiative instead of the whole tree.

### Output
A sectioned report (PASS / WARN / FAIL per check) printed to the terminal, ending with an overall verdict line:
`VERIFY: <PASS | N warning(s) | N failure(s)>`.
Exit-style semantics for the agent: on any FAIL, do NOT silently continue into a mutating command in the same turn — surface the failures and let the user decide.

### Mutation policy
`verify` (no flag) is **READ-ONLY**. It runs checks and reports; it writes nothing.
`verify --fix` is the explicit mutation gate. Before any `--fix` write, print the target scope and the normalization classes that may be applied, then run only
the deterministic normalizer. The allowed repairs are the same normalization the
status view may offer after a STATE_ERROR gate (`src/normalize.js`): gate-status
synonyms → `met`/`pending`, `references[]` `kind`/`label` backfill, missing
required initiative arrays → `[]`. `--fix` NEVER touches plan files
structurally, NEVER advances phases, NEVER closes tasks, NEVER edits the
markdown body. Anything beyond normalization is reported as a finding for the
user to resolve with the appropriate command (`migrate`, `re-ratify`,
`detect-scope`, `phase-done`, …) — `verify` does not perform those itself.

---

## Checks (in order)

`verify` is a thin orchestrator over existing machinery. It does not re-implement any check; it wraps and reports them.

### 0. Runtime resolvability (read-only; diagnoses the `package-root` gotcha — C-8)
- Every check below runs `node "$(cat "$HOME/.atomic-skills/package-root" 2>/dev/null || echo .)/scripts/<x>.js"`. That `|| echo .` fallback only fires when `package-root` is ABSENT; a **stale** file (present but pointing at an old/removed checkout) is read successfully, so the scripts run against a dead path and every detector silently fail-opens (drift/lessons/rollup checks quietly pass) or dies with a cryptic `Cannot find module`. Diagnose it deterministically FIRST: resolve `ROOT="$(cat "$HOME/.atomic-skills/package-root" 2>/dev/null || echo .)"` and test `[ -f "$ROOT/scripts/validate-state.js" ]`.
- **PASS:** the resolved `scripts/validate-state.js` exists → the runtime is live.
- **FAIL (blocks the rest with an actionable message, not a cryptic ENOENT):** `FAIL runtime: package-root resolves to '<ROOT>' but <ROOT>/scripts/ is missing — stale/absent runtime. Fix: re-run \`atomic-skills\` install, or from the repo root the fallback \`.\` is used.` If `ROOT` is the fallback `.` and the repo root also lacks `scripts/`, say so (you are not at the package root).

### 1. Schema validity (wraps `validate-state`)
- Run `node "$(cat "$HOME/.atomic-skills/package-root" 2>/dev/null || echo .)/scripts/validate-state.js" .atomic-skills/` (or `--slug`-scoped file paths).
- **PASS:** all files valid.
- **FAIL:** print the validator's errors verbatim. If `--fix` was passed, first run `node "$ROOT/src/normalize.js" .atomic-skills/`, using the package root already validated by check 0, then re-run `validate-state`. Report what normalization changed. If files still fail after normalization, the failure is structural (not drift) — report it and recommend `migrate <slug>` for legacy files or manual repair.
- **Failure message (no fix):** `FAIL schema: <file> — <validator message>. Run \`verify --fix\` for safe normalization, or \`migrate <slug>\` if legacy.`

### 2. Legacy detection (read-only)

Two independent legacy conditions, each recommending a different `migrate` mode.

**2a. Legacy SCHEMA** — for each entity file (flat `initiatives/*.md` + `plans/*.md` AND nested `projects/<id>/<slug>/{plan.md,phases/*.md}`), parse frontmatter; collect files where `schemaVersion` is absent.
- **WARN** per legacy-schema file: `WARN legacy-schema: <slug> has no schemaVersion. Run \`migrate <slug>\` before mutating it.`
- `--fix` does NOT migrate (schema migration requires the standalone-vs-in-plan decision — that is interactive, owned by `migrate`).

**2b. Legacy LAYOUT (R-MIG-19)** — detect the pre-unification FLAT tree: any `.atomic-skills/plans/*.md` or `.atomic-skills/initiatives/*.md` present (count `*.md` direct children; ignore `archive/`).
- **WARN** (default — the flat and nested trees coexist during the migration window): `WARN legacy-layout: <N> file(s) still in the flat plans//initiatives/ layout. Run \`project migrate\` to move them under projects/<id>/<slug>/.` — then list the flat files.
- A **pure nested tree** (only `projects/<id>/<slug>/...`, with no flat `plans/`/`initiatives/` `*.md`) → **no finding**.
- `--fix` does NOT perform the layout move: that is the irreversible copy-verify-delete cut-over owned by `migrate` (it needs a tar snapshot of the live state first — it is not reliably git-restorable). `verify` only flags it.

### 3. Branch match (read-only; wraps default-view branch logic)
- `branch=$(git rev-parse --abbrev-ref HEAD)`.
- Find active initiatives whose `branch:` equals the current branch.
- **PASS:** exactly one active initiative matches (or the user is on the plan's expected branch).
- **WARN:** zero matches → `WARN branch: no active initiative anchored to \`<branch>\`. You are working unanchored (Iron Law). Run \`status\` to disambiguate or open an initiative.`
- **FAIL:** more than one match → `FAIL branch: <N> active initiatives claim \`<branch>\`: <slugs>. At most one active plan may claim a tree (Iron Law). Give each its own tree (\`git worktree add -b plan/<slug>\`) + stamp a distinct \`branch:\`, \`pause\` all but one, or stamp distinct \`branch:\` values so they stop sharing \`<branch>\`.` This is the **hard** end of the soft→strict ladder whose **soft** form is `create-plan` Stage 6's single-focus pre-flight (R-FOCUS-01): create-plan warns + guides at materialization; `verify` is where a multi-active that already shares a tree fails the coherence pass.
- Also flag: an active plan whose `currentPhase` initiative `branch:` does not match the current branch → `WARN phase-branch: active plan \`<plan>\` currentPhase \`<id>\` is on branch \`<x>\`, you are on \`<branch>\`.`

### 4. Scope coverage (read-only; wraps `detect-scope` data, no write)
- For the active initiative that has a `scope.paths`, compare against recent git activity: run `node "$(cat "$HOME/.atomic-skills/package-root" 2>/dev/null || echo .)/scripts/detect-scope.js" --json --branch=<branch> --limit=20`.
- **WARN** when recent commits touch paths NOT covered by any `scope.paths` glob → `WARN scope: recent commits touch <paths> outside the initiative's declared scope. Run \`detect-scope\` to update, or this may be scope creep — see \`scope-creep\`.`
- Initiatives without `scope.paths` are skipped (scope is optional), not failed.

### 5. Orphan detection (read-only; layout-aware per R-ORCH-38)
Resolve every entity in BOTH layouts: flat (`plans/`, `initiatives/`) and nested (`projects/<id>/<slug>/{plan.md,phases/*.md}`). A phase initiative's parent is resolved within its own project folder first (nested `projects/<id>/<parentPlan>/plan.md`), then the flat `plans/<parentPlan>.md`.
- **Orphan initiative:** a phase initiative (nested `projects/<id>/<slug>/phases/*.md` or flat `initiatives/<slug>.md`) with `parentPlan: <p>` where no `plan.md` resolves for `<p>` in either layout (and the parent is not under an `archive/`). → `FAIL orphan: initiative \`<slug>\` references missing parent plan \`<p>\`.` A standalone initiative with NO `parentPlan` is not an orphan — it is a 1-phase plan (or, pre-migration, a flat standalone awaiting `migrate`).
- **Orphan phase reference:** a plan `currentPhase` / phase `dependsOn[]` id that no `phases[]` entry declares (use `src/transition.js`:`unknownDeps(plan)`). → `FAIL orphan: plan \`<plan>\` has dangling phase reference(s): <ids>.`
- **Stranded active:** an initiative with `status: active` under a plan phase whose `status` is `done`/`archived`. → `WARN stranded: initiative \`<slug>\` is active but its phase \`<id>\` is \`<status>\`. Run \`phase-reopen\` or \`archive\`.`
- **Untracked PROJECT-STATUS rows:** rows in `PROJECT-STATUS.md` whose slug has no matching file (or vice-versa). → `WARN index: PROJECT-STATUS.md is out of sync (<slug> listed but file missing / file present but unlisted).`
- **Descriptor-only phases are VALID, not orphans (D1 lazy):** a plan `phases[]` entry with NO matching initiative file in `phases/` (materialized only at activation via `materialize <phase>`) is the descriptor-only state — `verify` MUST NOT FAIL or WARN it as a missing/orphan initiative. The schema check (#1) validates the phase descriptor itself; `crossValidate` only inspects `status: done` phases, so a pending descriptor-only phase is simply absent from the initiative set. The distinction is the initiative FILE's absence, never `subPhaseCount` (`subPhaseCount:0` is an honest "unknown until materialized").
- `--fix` does NOT auto-resolve orphans (resolution is a judgement call: re-parent, archive, or delete). It only reports.

### 6. aiDeck coherence (read-only; only if aiDeck reachable)
- Reuse the ensure-aideck script from `{{ASSETS_PATH}}/project-view.md` to get `AIDECK_URL` and `STATE_ERROR` (this is the only place `verify` touches the AIDECK CONTRACT — it does not duplicate the domain string; it delegates to `project-view.md`).
- **PASS:** `AIDECK_URL` non-empty AND `STATE_ERROR` empty.
- **WARN:** `AIDECK_URL` empty → `WARN aideck: dashboard not running; skipped the live-state cross-check. Run \`atomic-skills install\` / \`status --browser\`.`
- **FAIL:** `STATE_ERROR` non-empty → `FAIL aideck: dashboard would render \`⊘ failed to load\` — <STATE_ERROR>. Run \`verify --fix\` (normalizes) or \`status --browser\` (offers the gated repair/open flow).`
- When `--fix` is passed and aiDeck reports a STATE_ERROR, run the same normalization as check 1's fix path, then re-check.

### 7. Completion drift (read-only; wraps `detect-completion`)
- Run `node "$(cat "$HOME/.atomic-skills/package-root" 2>/dev/null || echo .)/scripts/detect-completion.js" --json` (the deterministic, zero-token detector — `--project <id>` to disambiguate same-slug plans). It classifies each open task / pending criterion by a *changed-deliverable* signal (`output-exists` / `commit-ref`); a `verifier:`'s presence alone is never a signal, and `acceptance[]` prose is never parsed.
- **PASS:** `drift` is false — no open entry looks done in the repo.
- **WARN** (report-only): `WARN completion: <N> task(s)/gate(s) look done in the repo but are still open — run \`reconcile\`.` — then list each candidate's `kind`, `id`, and `evidence`.
- This check is **strictly report-only**, consistent with `verify`'s read-only contract. `verify --fix` is **NOT** extended to reconcile — closing tasks/gates is a judgement call (verifier-aware, GATE-R2-gated) owned by the `reconcile` verb. `--fix` stays schema-normalization only.

### 8. Phase review gate (read-only; G2 backward-compat surface)
- For each plan phase with `status: done`, check whether it carries a `reviewGate` block (the structured phase-done review outcome).
- **PASS:** every done phase carries a `reviewGate` (its honesty — `passed`⟹`at`, `skipped`⟹`reason` — is already HARD-enforced by `validate-state` GATE-R3 in check #1, so a malformed one surfaces there as a FAIL).
- **Mode-aware sub-report (C-7 — do not conflate the two "is it reviewed?" surfaces).** A `reviewGate` records its `mode` (`local` self-loop vs external `codex`/`grok`/`both*`/`external-both` CROSS-MODEL REVIEW). This check answers "was a review recorded?", NOT "was it cross-model reviewed?" — those are different surfaces, and a `mode: local` phase reads green HERE while the CROSS-MODEL REVIEW line (`project-drift.md`) independently reports external cadence as unrun. So when a done phase's `reviewGate.mode` is `local` (never an external/cross-model mode), add: `INFO review-gate: <plan>/<phaseId> reviewed local-only — cross-model review not run (see the CROSS-MODEL REVIEW line / \`review-due\`)`. This keeps `verify [8] PASS` from implying cross-model review that never happened.
- **WARN** (report-only): `WARN review-gate: <N> done phase(s) carry no recorded review gate (closed before the gate existed, or review-code was never run) — <plan>/<phaseId>…`. This is the deterministic surface for the legacy/missed case that GATE-R3 deliberately tolerates (absent ≠ malformed); it never mutates and `--fix` does not backfill it (the review must actually run — `phase-done` / `review-due` is the only path that writes a truthful `reviewGate`).

### 9. Orphan worktrees (read-only; PR→develop lifecycle backstop)
Derives live from `git worktree list --porcelain` + `merge-base` ancestry + plan status, and flags orphans of the PR→develop model. The detection is a pure function — `scripts/detect-orphan-worktrees.js` (`findOrphanWorktrees`) — that never runs git itself (the orchestrator passes parsed worktrees + plan slices + an injected ancestry predicate) and never mutates or removes anything. `merged-feature-worktree` remains a recoverable WARN; archived plans that skipped publication or merge are lifecycle FAIL findings because the terminal state lost required integration proof.
- **WARN merged-feature-worktree:** a live worktree whose feature branch is already merged into the integration ref (PR `state: MERGED` or `merge-base` ancestry) → `WARN worktrees: feature \`<branch>\` is merged but its worktree \`<path>\` is still live — teardown pending (run \`archive\` after the PR merge, or \`git worktree remove\`).`
- **FAIL archived-never-pr:** an archived plan with a branch that has no PR/publication proof and never reached the integration ref. A plan with no own branch (`branch: null`/missing) is not blocked by this check; it must carry its local-integration justification through the lifecycle guard before archive. → `FAIL worktrees: archived plan \`<slug>\` branch \`<branch>\` has no PR/integration proof and never reached \`<integrationRef>\` — run \`finalize <slug>\`, merge the PR, then rerun \`archive <slug>\`.`
- **FAIL archived-pr-open-unmerged:** an archived plan whose PR is still OPEN and whose branch never reached the integration ref. → `FAIL worktrees: archived plan \`<slug>\` branch \`<branch>\` has an open/unmerged PR and never reached \`<integrationRef>\` — merge the PR, then rerun \`archive <slug>\`.`
- A branch that DID reach the integration ref (PR `state: MERGED` **or** `merge-base` ancestry) is the healthy terminal state and is NOT flagged, even when no PR identity was recorded.
- A clean/active state (no merged-but-live worktree, no archived-unreached branch) → no finding.
- `--fix` does NOT teardown or remove anything — removal stays operator-prompted and fail-closed (owned by \`archive\` / the teardown guard). This check only reports.

### 10. Plan review receipt (read-only; creation-gate backstop)
Run `node "$ROOT/scripts/find-unreviewed-plans.js" .atomic-skills` (deterministic, zero-token, using the package root already validated by check 0). It reports every non-archived materialized plan whose body lacks a `## Reviews` section carrying a `- internal:` line — i.e. the mandatory adversarial review (project-create-plan.md Stage 8a) either never ran or left no receipt.
- **PASS:** every plan carries an internal-review receipt.
- **WARN** (report-only): `WARN review: <N> plan(s) carry no adversarial-review receipt (created before the gate existed, or materialized in a batch that bypassed Stage 8) — <projectId>/<slug>…`. This is the **warn** end of the soft→strict ladder whose **hard** end is `create-plan` Stage 8c (which HARD-BLOCKS a freshly-created plan with no receipt). Like check #8, `--fix` does NOT backfill it — the review must actually run: `atomic-skills:review-plan --mode=internal <plan>` writes a truthful receipt. A batch of plans materialized outside the creation flow (e.g. via `materializeDecomposition` directly) is exactly the case this surfaces.

---

## Report shape

```
project verify — <repo-name> @ <branch>

[1] schema      PASS   (4 files valid)
[2] legacy      WARN   layout: 17 flat file(s) → run `project migrate`; schema: 1 (sample-legacy)
[3] branch      PASS   anchored to v3-redesign-f0-foundation
[4] scope       WARN   commits touch src/parser/ outside scope.paths
[5] orphans     PASS
[6] aideck      WARN   dashboard not running (cross-check skipped)
[7] completion  WARN   2 task(s) look done in the repo but still open → run `reconcile`
[8] review-gate WARN   1 done phase has no recorded reviewGate (aideck-multi-project/F2)
[9] worktrees   FAIL   archived plan demo branch plan/demo has no PR/integration proof — run `finalize demo`, merge, then `archive demo`
[10] review     WARN   2 plan(s) carry no adversarial-review receipt (curta/refatoracao, curta/web-app)

VERIFY: 6 warning(s), 1 failure(s)
```

## Red flags

- "verify can just auto-fix everything it finds" — NO. Only schema normalization is safe to auto-apply. Migration, scope edits, orphan resolution, and phase transitions are judgement calls that belong to their own commands. `--fix` is deliberately narrow.
- "verify failed schema but I'll mutate anyway" — NO. A schema FAIL means a downstream skill (or aiDeck) will reject the state. Fix before mutating.
- "no branch match is fine, I'll just edit" — that is exactly the Iron Law violation the router guards. Anchor first.
