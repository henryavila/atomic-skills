# Inc0 + Inc1 — implementation notes & verified ground-truth corrections

> **Status:** Inc0 DONE; Inc1 in progress (2026-06-01). Branch `dogfood/self-host-migration`.
> This file is the durable record of what was BUILT (vs. designed) and where the appendices' `file:line` claims drifted from the real code. A ground-truth verification sweep (6 parallel readers) ran before any code; its corrections are recorded here so future sessions trust the code, not the snapshot in 01/05.

## Ground-truth verification — 5 material corrections to the appendices

The design held up ~90% (decompose.js line numbers were byte-exact despite the file growing to 899 lines). Five places diverged enough to change the build:

1. **The strip-test is EASIER than the design feared (R-XAGENT-01).** `src/render.js:renderTemplate(content, vars, modules, ideId)` already does handlebars-like `{{#if ide.X}}` stripping, and `tests/compatibility.test.js` already imports it. No renderer needed to be built. **But** the host-orchestration tokens could NOT just be appended to the existing `FORBIDDEN_TERMS` lint — its heuristic is naive (first-occurrence only, 2-char `{{ }}` adjacency) and `TaskCreate(` is legitimately allowed *inside* an `ide.claude-code` block. The correct mechanism = render for gemini (strips CC blocks) then detect code-shaped tool refs in the remainder. Also `Monitor`/`Workflow` are common English words → detection uses call-shaped `Tool(` + backtick `` `Tool` `` only, never bare `\bword\b`.

2. **`ATOMIC_SKILLS_DIR` is wired NOWHERE (F-D1 / R-XAGENT-09).** grep across `src/` + `scripts/` = 0 hits. The "~75% already present, ~2-line decompose plumb" is true only in the weak sense that `normalizeStateDir(dir)`, `deriveProjectId(rootDir)`, and validate-state `collectTargets(args)` accept a *positional* root. None reads the env var, and `serve.js` never threads `rootDir` to `deriveProjectId` (both callsites @222/@295 hardcode `process.cwd()`). Adopting the named env-var mechanism touches ~4 files (decompose + normalize CLI + validate-state default + serve callsites), not 1. **See the dogfood-leak guardrail below.**

3. **The paranoid REDs (R-XAGENT-07) are mis-homed — the biggest reframe.** Verify-on-done verifier *execution* is **markdown prose** in `project-transitions.md` (`:178` query, `:192` test), not JS. `src/transition.js` is unrelated phase-graph code with no callable verifier-exec surface. So the REDs cannot live in `transition.test.js`. The only machine-testable enforcement is the **GATE-R2 met-invariant**, authored as an exported `checkMetInvariant()` in `scripts/validate-state.js` with the REDs in `validate-state.test.js`. This is exactly F-B2's "the invariant hoists into validate-state.js." **Inc1's real teeth = the JS met-invariant; the markdown un-stub is the (untestable-as-JS) prose half.** Decision (user-delegated, 2026-06-01): keep it in validate-state.js as an exported pure function — promote to `src/verify.js` only in Inc5 if the Mode-2 escalation judge proves it worth sharing (lossless move, real consumer in hand).

4. **`kind:test` needs a test-count field in TWO places.** The evidence shape (both the markdown block in `project-transitions.md` and the JSON `common.schema.json` evidence `$defs`) had only `exitCode` (shell) + `rowCount` (query). "0 tests collected ≠ met" requires a `testsCollected` field → it rides into the F-B5 0.2 delta.

5. **Schema + migration + met-invariant must land atomically.** A `schemaVersion:'0.2'` stamp fails validation until the `const "0.1" → enum ["0.1","0.2"]` change lands (existing test `validate-state.test.js` asserts wrong-version fails). And deleting the description-note workaround (F-B4) needs `task.evidence` in the schema first. Bonus simplifications confirmed: `schemaVersion` is defined once in `common.schema.json` (plan+initiative `$ref` it) → enum bump is a single-point edit; the F-B4 `$ref` must be `common.schema.json#/$defs/exitCriterion/properties/evidence` (the `/properties/` segment, or Ajv won't resolve).

## Inc0 — what was built (DONE)

- **R-XAGENT-08** — `scripts/validate-state.js` `kindFromPath`: added nested-layout inference (`phases/` → initiative as the LAST check in the loop; `plan.md` under a `projects/` ancestor → plan, after the loop). Flat walk byte-untouched. 6 new tests in `validate-state.test.js` (nested plan/phase/archive infer + validate, flat regression, no-kind error, plan.md-outside-projects guard).
- **R-XAGENT-01** — `tests/compatibility.test.js`: new describe `Cross-Agent Portability — host-orchestration ban + strip-test`. Per-skill byte-runnable-when-stripped (render for gemini → assert no `{{#if`/`{{/if}}`/`ide.claude-code` residue + no host-orchestration tool survives) + 3 synthetic discrimination tests (flags-outside-block / allows-inside-block / no-prose-false-positive). The old `FORBIDDEN_TERMS` lint is left untouched (appending these tokens there would wrongly ban legitimate in-CC-block usage). Banned set: `Workflow, TaskCreate/Update/Stop/Get/List/Output, Monitor, EnterWorktree/ExitWorktree, CronCreate/Delete/List`. Today every skill passes (zero usage) — the guardrail lands GREEN *before* orchestration tokens are introduced, which is the intent.

### R-XAGENT-02 — investigator write-capability probe (RECORDED; informs Inc3/Inc5 only, not v1)

A live probe of Gemini's `codebase_investigator` is not runnable from this environment; recording the load-bearing facts from `src/render.js` + tool semantics:

- **Claude Code:** `{{INVESTIGATOR_TOOL}}` → `Agent` (render.js:56). Agent/Task subagents CAN write files + use tools and spawn fresh-context. So a same-provider fresh isolated subagent is available for both the Mode-2 cheap-tier executor *and* the critic.
- **Gemini CLI:** `{{INVESTIGATOR_TOOL}}` → `codebase_investigator` (render.js:45) — a read-only code-investigation tool, not a general write-capable agent. Treat as **read-only** until proven otherwise.
- **Policy (confirms F-A2 / F-C1):** Mode-2 executor is **Codex-only on every host in v1** (the Anthropic subagent-executor tier is deferred entirely, not CC-gated). Critic provider is **tiered**: same-provider-fresh where host-isolated (Claude Code) → codex critic where isolation is unverified (Gemini) → solo-advisory refusal-to-gate otherwise. This is exactly why the R-XAGENT-01 strip-test (above) matters: the Codex lane + its `git worktree` primitive must survive the gemini strip.

### R-XAGENT-09 — state-root convention (RECORDED + guardrail; plumb deferred to Inc2 per F-D1)

- **Convention:** the four tools accept a positional/explicit state root today (`normalize <dir>`, `validate-state <dir|file…>`); `decompose.js materializeDecomposition` does NOT — it inlines the literal `.atomic-skills/` prefix at `:750` (plan) and `:803` (phase). The `opts.stateRoot` plumb is the SAME edit as the Inc2 `projects/<id>/<slug>/` path-emit, so it folds into Inc2 (not an Inc0 refactor). The named `ATOMIC_SKILLS_DIR` env var is currently wired nowhere; wiring it (decompose + normalize CLI + validate-state default + serve callsites) is an Inc2 task, not Inc0.
- **🚧 DOGFOOD-LEAK GUARDRAIL (load-bearing):** because `decompose.js` hardcodes the `.atomic-skills/` prefix and `.atomic-skills/` is gitignored (not git-restorable), **do NOT run `decompose materialize` against live state before the Inc2 stateRoot plumb lands.** Until then any materialize writes into the live tree, violating R-XAGENT-09's "live tree byte-frozen until D7." Inc0/Inc1 do not run materialize, so they are safe; the hazard is the migration dogfood (D1+), which must wait for Inc2.

## Inc1 — what is being built

See tasks; sequence (strict, per correction #5): (1) `common.schema.json` 0.2 delta + `initiative.schema.json` `task.evidence` → (2) `src/migrate.js` `migrate01to02` + tests → (3) `validate-state.js` `checkMetInvariant` (GATE-R2) + 3 paranoid REDs → (4) `project-transitions.md` prose un-stub. Each step lands with its tests green before the next.
