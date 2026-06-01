# project — `verify` (lazy detail · NEW in v2.0.0)

Loaded by the router when the user runs `/atomic-skills:project verify`.

`verify` reconciles `.atomic-skills/` state against the actual repository — schema validity, branch coherence, scope coverage, orphaned files, and (when aiDeck is reachable) the dashboard's view of the same state. It is the single coherence command that did not exist before the unification: previously schema-validation (`validate-state`), drift (`scope-creep`), branch-match (default view), and aiDeck STATE_ERROR each lived in different places and the user had to run them separately.

---

## Contract

### Inputs
- **Implicit:** the `.atomic-skills/` tree in the CWD, the current git branch + working tree, and (optionally) a running aiDeck instance.
- **Optional args:**
  - `--fix` — apply the deterministic, safe repairs the read-only pass identifies (schema normalization via `src/normalize.js`, nothing else). Without `--fix`, `verify` is strictly read-only and mutates nothing.
  - `--slug <slug>` — scope the verification to one plan/initiative instead of the whole tree.

### Output
A sectioned report (PASS / WARN / FAIL per check) printed to the terminal, ending with an overall verdict line:
`VERIFY: <PASS | N warning(s) | N failure(s)>`.
Exit-style semantics for the agent: on any FAIL, do NOT silently continue into a mutating command in the same turn — surface the failures and let the user decide.

### Mutation policy
`verify` (no flag) is **READ-ONLY**. It runs checks and reports; it writes nothing. The ONLY mutation path is `verify --fix`, and even then it is restricted to the same deterministic normalization the default view's STATE_ERROR auto-repair performs (`src/normalize.js`): gate-status synonyms → `met`/`pending`, `references[]` `kind`/`label` backfill, missing required initiative arrays → `[]`. `--fix` NEVER touches plan files structurally, NEVER advances phases, NEVER closes tasks, NEVER edits the markdown body. Anything beyond normalization is reported as a finding for the user to resolve with the appropriate command (`migrate`, `re-ratify`, `detect-scope`, `phase-done`, …) — `verify` does not perform those itself.

---

## Checks (in order)

`verify` is a thin orchestrator over existing machinery. It does not re-implement any check; it wraps and reports them.

### 1. Schema validity (wraps `validate-state`)
- Run `npm run validate-state .atomic-skills/` (or `--slug`-scoped file paths).
- **PASS:** all files valid.
- **FAIL:** print the validator's errors verbatim. If `--fix` was passed, first run `src/normalize.js` on `.atomic-skills/` (resolve it the same 3-path way the default view does), then re-run `validate-state`. Report what normalization changed. If files still fail after normalization, the failure is structural (not drift) — report it and recommend `migrate <slug>` for legacy files or manual repair.
- **Failure message (no fix):** `FAIL schema: <file> — <validator message>. Run \`verify --fix\` for safe normalization, or \`migrate <slug>\` if legacy.`

### 2. Legacy detection (read-only)
- For each `initiatives/*.md` and `plans/*.md`, parse frontmatter; collect files where `schemaVersion` is absent.
- **WARN** per legacy file: `WARN legacy: <slug> has no schemaVersion. Run \`migrate <slug>\` before mutating it.`
- `--fix` does NOT migrate (migration requires the standalone-vs-in-plan decision — that is interactive, owned by `migrate`).

### 3. Branch match (read-only; wraps default-view branch logic)
- `branch=$(git rev-parse --abbrev-ref HEAD)`.
- Find active initiatives whose `branch:` equals the current branch.
- **PASS:** exactly one active initiative matches (or the user is on the plan's expected branch).
- **WARN:** zero matches → `WARN branch: no active initiative anchored to \`<branch>\`. You are working unanchored (Iron Law). Run \`status\` to disambiguate or open an initiative.`
- **WARN:** more than one match → `WARN branch: <N> active initiatives claim \`<branch>\`: <slugs>. Only one should be active per branch.`
- Also flag: an active plan whose `currentPhase` initiative `branch:` does not match the current branch → `WARN phase-branch: active plan \`<plan>\` currentPhase \`<id>\` is on branch \`<x>\`, you are on \`<branch>\`.`

### 4. Scope coverage (read-only; wraps `detect-scope` data, no write)
- For the active initiative that has a `scope.paths`, compare against recent git activity: run `npm run detect-scope -- --json --branch=<branch> --limit=20`.
- **WARN** when recent commits touch paths NOT covered by any `scope.paths` glob → `WARN scope: recent commits touch <paths> outside the initiative's declared scope. Run \`detect-scope\` to update, or this may be scope creep — see \`scope-creep\`.`
- Initiatives without `scope.paths` are skipped (scope is optional), not failed.

### 5. Orphan detection (read-only)
- **Orphan initiative:** an `initiatives/<slug>.md` with `parentPlan: <p>` where `plans/<p>.md` does not exist (and is not in `plans/archive/`). → `FAIL orphan: initiative \`<slug>\` references missing parent plan \`<p>\`.`
- **Orphan phase reference:** a plan `currentPhase` / phase `dependsOn[]` id that no `phases[]` entry declares (use `src/transition.js`:`unknownDeps(plan)`). → `FAIL orphan: plan \`<plan>\` has dangling phase reference(s): <ids>.`
- **Stranded active:** an initiative with `status: active` under a plan phase whose `status` is `done`/`archived`. → `WARN stranded: initiative \`<slug>\` is active but its phase \`<id>\` is \`<status>\`. Run \`phase-reopen\` or \`archive\`.`
- **Untracked PROJECT-STATUS rows:** rows in `PROJECT-STATUS.md` whose slug has no matching file (or vice-versa). → `WARN index: PROJECT-STATUS.md is out of sync (<slug> listed but file missing / file present but unlisted).`
- `--fix` does NOT auto-resolve orphans (resolution is a judgement call: re-parent, archive, or delete). It only reports.

### 6. aiDeck coherence (read-only; only if aiDeck reachable)
- Reuse the ensure-aideck script from `{{ASSETS_PATH}}/project-view.md` to get `AIDECK_URL` and `STATE_ERROR` (this is the only place `verify` touches the AIDECK CONTRACT — it does not duplicate the domain string; it delegates to `project-view.md`).
- **PASS:** `AIDECK_URL` non-empty AND `STATE_ERROR` empty.
- **WARN:** `AIDECK_URL` empty → `WARN aideck: dashboard not running; skipped the live-state cross-check. Run \`atomic-skills install\` / \`status --browser\`.`
- **FAIL:** `STATE_ERROR` non-empty → `FAIL aideck: dashboard would render \`⊘ failed to load\` — <STATE_ERROR>. Run \`verify --fix\` (normalizes) or \`status --browser\` (auto-repairs + opens).`
- When `--fix` is passed and aiDeck reports a STATE_ERROR, run the same normalization as check 1's fix path, then re-check.

---

## Report shape

```
project verify — <repo-name> @ <branch>

[1] schema      PASS   (4 files valid)
[2] legacy      WARN   1 file: sample-legacy (run `migrate`)
[3] branch      PASS   anchored to v3-redesign-f0-foundation
[4] scope       WARN   commits touch src/parser/ outside scope.paths
[5] orphans     PASS
[6] aideck      WARN   dashboard not running (cross-check skipped)

VERIFY: 2 warning(s), 0 failure(s)
```

## Red flags

- "verify can just auto-fix everything it finds" — NO. Only schema normalization is safe to auto-apply. Migration, scope edits, orphan resolution, and phase transitions are judgement calls that belong to their own commands. `--fix` is deliberately narrow.
- "verify failed schema but I'll mutate anyway" — NO. A schema FAIL means a downstream skill (or aiDeck) will reject the state. Fix before mutating.
- "no branch match is fine, I'll just edit" — that is exactly the Iron Law violation the router guards. Anchor first.
