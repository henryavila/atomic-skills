# Project skill coherence repair

Source: unverified: audit of the `project` skill universe on 2026-07-02; the
audit source was not included with this plan. This plan turns the six
highest-leverage repair themes into six phases. Run each phase in a
fresh session; do not carry implementation context from one phase into the next
except through this file, commits, and test results.

## Operating rules

- Execute exactly one phase per session.
- Start each session by reading this plan, the phase's listed files, and `AGENTS.md`.
- Keep each phase scoped; do not opportunistically fix later phases.
- End each session with tests, a brief note in the phase checklist, and a clean
  or explicitly explained worktree.
- Preserve existing user changes. The audit observed pre-existing changes in
  `package-lock.json` and `.atomic-skills/projects/atomic-skills/phase-materialization/source.md`;
  do not revert them unless the user asks.

## Evidence policy

- unverified: problem summaries are audit-derived hypotheses until the phase
  implementer verifies them against source lines in the listed files.
- verified_by: `rtk node -e <listed-file existence check>` on 2026-07-02 found
  all listed existing files present after this review; files marked `(new)` are
  planned deliverables.

## F1 - Completion gates: `done`, `phase-done`, verifier evidence

**Goal:** make task and phase closure impossible without honest verifier/gate
state.

**Problem summary:** unverified: `done` currently marks a task done before
verifier handling is the first step, and `phase-done` can turn deferred or
pending gates into `met`. This threatens GATE-R2/GATE-R3 integrity.

**Likely files:**

- `skills/shared/project-assets/project-transitions.md`
- `skills/shared/project-assets/verifier-exec.md`
- `skills/core/implement.md`
- `tests/transition.test.js`
- `tests/validate-state.test.js`
- `scripts/lint-transition-emits.js`
- `tests/transition-emits.test.js`

**Tasks:**

- Move task verifier handling to the beginning of the `done <task-id>` flow.
- Define whether `done` consumes evidence written by `verify-claim` or reruns
  the verifier itself; document exactly one path.
- Fix `phase-done` so `deferred` gates stay `deferred`, `pending` gates block,
  and manual override sets `status: deferred` plus `deferredReason`.
- Resolve the duplicate close-commit ownership between `implement` and
  `project done`.
- Add regression tests or text-structure tests that fail on the old ordering.

**Exit gate:** a task with a deterministic verifier cannot reach `done` without
passing evidence, and a phase cannot convert `pending`/`deferred` gates into
fake `met` gates.

**Implementation note (2026-07-02):** F1 implemented for the Markdown transition
surface and structural lint: `done` now runs per-task verifier handling before
`status: done`, `phase-done` preserves `deferred` gates and blocks/defers
`pending` gates instead of bulk-marking them `met`, and `implement` delegates
state close commits to `done`. Verified with `rtk node scripts/lint-transition-emits.js`,
`rtk node --test tests/transition-emits.test.js`, `rtk node --test tests/transition.test.js`,
and `rtk node --test tests/validate-state.test.js`.

**Fresh-session prompt:**

> Implement F1 from `docs/plans/2026-07-02-project-skill-coherence-repair.md`.
> Only repair completion gate semantics for `done`, `phase-done`, verifier
> evidence, and commit ownership. Do not touch layout/docs parity/schema work.

## F2 - Nested-first resolver everywhere

**Goal:** make all project state readers and mutators resolve the canonical
`.atomic-skills/projects/<project-id>/...` layout first, with flat layout only
as a legacy fallback.

**Problem summary:** unverified: hooks, terminal status, migrate/re-bootstrap,
and some views still hardcode flat `plans/` and `initiatives/` paths.

**Likely files:**

- `skills/shared/project-assets/project-view.md`
- `skills/shared/project-assets/project-migrate.md`
- `skills/shared/project-assets/hooks/session-start.sh`
- `skills/shared/project-assets/hooks/stop.sh`
- `skills/shared/project-assets/project-dependencies.md`
- `tests/hooks/session-start.test.sh`
- `tests/hooks/stop.test.sh`
- `tests/project.test.js`

**Tasks:**

- Extract or document one nested-first resolution pattern for plan, phase
  initiative, standalone plan, archive path, and project index.
- Update `status --terminal` and hooks to use nested-first resolution.
- Update `migrate <slug>` / `re-bootstrap <slug>` to resolve nested state after
  layout migration, with flat-only behavior retained as fallback.
- Make `depend` accept or request `--project <id>` when project inference is
  ambiguous.
- Add nested-only fixtures for hooks/status/migrate behavior.

**Exit gate:** a nested-only project works in session hooks, terminal status,
migrate/re-bootstrap, and dependency commands without relying on flat files.

**Fresh-session prompt:**

> Implement F2 from `docs/plans/2026-07-02-project-skill-coherence-repair.md`.
> Only repair nested-first resolution in hooks, status/view, migrate/re-bootstrap,
> and dependency targeting. Do not change verifier gates or docs/catalog parity.

## F3 - Router, catalog, docs, and command-surface parity

**Goal:** make the public command surface match the router and make docs clear
about slash-command vs CLI behavior.

**Problem summary:** unverified: the router lists commands omitted from
catalog/docs, docs still advertise flat artifacts, `migrate` without slug is
used but not routed, and the CLI `status` command means installer status rather
than project status.

**Likely files:**

- `skills/core/project.md`
- `meta/catalog.yaml`
- `docs/skills/project.md`
- `README.md`
- `scripts/generate-skill-docs.js`
- `scripts/generate-readme.js`
- `scripts/generate-catalog-json.js`
- `tests/project.test.js`
- `tests/generate-skill-docs.test.js` (new)
- `tests/generate-readme.test.js`

**Tasks:**

- Decide and document whether `/atomic-skills:project` is slash-command-only or
  whether `atomic-skills project <subcommand>` is part of the supported surface.
- Audit the router grammar/dispatch table and add every routed public command
  to catalog/docs; only commands listed in an explicit hidden allowlist remain
  omitted.
- Update docs/catalog output artifacts to nested-first paths.
- Align `new plan` stage count and examples with the actual 9-stage flow.
- Add a parity test: router grammar/dispatch table vs catalog/docs, with a small
  allowlist for intentionally hidden power-user commands.
- Add a docs-generation regression test for `scripts/generate-skill-docs.js`;
  create `tests/generate-skill-docs.test.js` because no direct test exists.

**Exit gate:** generated README/docs/catalog no longer contradict the router,
and tests catch future router/catalog drift.

**Fresh-session prompt:**

> Implement F3 from `docs/plans/2026-07-02-project-skill-coherence-repair.md`.
> Only repair router/catalog/docs command parity and public wording. Do not
> change transition semantics or schemas except where docs need references.

## F4 - Schema and versioning cleanup

**Goal:** make state schema definitions unambiguous and aligned with the current
layout/version contract.

**Problem summary:** unverified: `schemaVersion` is described as canonical
`0.1` while schemas/tests accept `0.2`, and `plan.schema.json` contains
duplicate JSON keys that `JSON.parse` silently overwrites.

**Likely files:**

- `skills/core/project.md`
- `meta/schemas/common.schema.json`
- `meta/schemas/plan.schema.json`
- `meta/schemas/initiative.schema.json`
- `scripts/validate-state.js`
- `src/links-sidecar.js`
- `tests/validate-state.test.js`
- `tests/schema-drift.test.js`

**Tasks:**

- Declare the canonical version policy for new files: either `0.2`, or explicit
  `0.1/0.2` coexistence with one preferred writer version.
- Remove duplicate schema keys (`spawnedFrom`, `spawnedPlans`) and preserve the
  intended definitions.
- Add a duplicate-key lint/test for `meta/schemas/*.json`.
- Decide where fork-plan ratified `context`/`provenance` lives; either add
  schema fields for the edge or stop promising they are persisted on the edge.
- Update schema descriptions from flat-first language to nested-first language.

**Exit gate:** schema files parse without duplicate keys, new-file version policy
is explicit, and fork-plan edge persistence matches the schema.

**Fresh-session prompt:**

> Implement F4 from `docs/plans/2026-07-02-project-skill-coherence-repair.md`.
> Only repair schemas, version wording, duplicate-key tests, and fork-plan edge
> schema promises. Do not change command docs beyond necessary references.

## F5 - Mutation honesty for review/status/verify/materialize

**Goal:** make commands that claim read-only behavior actually read-only, or make
their mutation policy explicit and gated.

**Problem summary:** unverified: `review` and `status` can write; `verify --fix`
exists in the detail file while the router describes verify as read-only;
`new-phase` materializes an initiative without the `businessIntent` gate
required by materialized phases.

**Likely files:**

- `skills/core/project.md`
- `skills/shared/project-assets/project-review.md`
- `skills/shared/project-assets/project-view.md`
- `skills/shared/project-assets/project-verify.md`
- `skills/shared/project-assets/project-emergence.md`
- `skills/shared/project-assets/project-materialize.md`
- `scripts/find-missing-business-intent.js`
- `tests/project.test.js`
- `tests/phase-materialization/*.test.js`

**Tasks:**

- Choose one contract for `review`: report-only by default, or explicitly
  mutating with prompt/gate before delegated writes.
- Split `status` display from refresh/repair behavior, or document and gate the
  refresh/repair writes.
- Align router and detail policy for `verify --fix`.
- Make `new-phase` either descriptor-only until `materialize`, or collect
  `businessIntent` and lessons before writing an initiative file.
- Standardize lessons command invocation with `--project --plan --phase`.
- Add regression tests that fail when `review`, `status`, or `verify` mutate
  contrary to their documented policy, and when materialized phases omit
  `businessIntent`.

**Exit gate:** every command's mutation policy is truthful in router, detail
file, docs, and tests; materialized phases always satisfy `businessIntent`.

**Implementation note (2026-07-02):** F5 implemented for the project skill
router and lazy detail files. `review` is now a mutation-gated audit instead of
claiming unconditional read-only behavior, `status` refresh/repair writes require
explicit prompts, `verify [--fix]` is aligned between router and detail policy,
and `new-phase` now runs lessons plus `businessIntent` gates before writing a
materialized initiative. Verified with `rtk node --test tests/project.test.js`,
`rtk node --test tests/phase-materialization/*.test.js`,
`rtk node --test tests/skill-byte-budget.test.js`, and `rtk npm test`.

**Fresh-session prompt:**

> Implement F5 from `docs/plans/2026-07-02-project-skill-coherence-repair.md`.
> Only repair mutation policy/read-only honesty and materialization gates. Do
> not fix schema duplicate keys or command catalog parity here.

## F6 - Durable run state for long and interruptible flows

**Goal:** make long flows resumable without inference after cancellation,
crashes, or context loss.

**Problem summary:** unverified: `pop --park/--emerge`, `new plan/adopt`,
`discover --commit`, `consolidate`, `reconcile`, and `finalize` each have
points where state can be partially applied or inferred from the repo instead
of a run record.

**Likely files:**

- `skills/shared/project-assets/project-transitions.md`
- `skills/shared/project-assets/project-create-plan.md`
- `skills/shared/project-assets/project-discover.md`
- `skills/shared/project-assets/project-consolidate.md`
- `skills/shared/project-assets/project-finalize.md`
- `skills/shared/project-assets/project-idea.md`
- `scripts/consolidate.mjs`
- `scripts/finalize-plan-scope.js`
- `tests/consolidate-script.test.js`
- `tests/finalize-plan-scope.test.js`

**Tasks:**

- Make `pop --park/--emerge` transactional: remove the frame only when delegated
  ratify flow returns applied.
- Add draft or `creationGate` state for `new plan/adopt` until final semantic
  gates pass, or document rollback/resume precisely.
- Persist `discover-run.json` with run id, candidates, decisions, and commit
  eligibility.
- Persist `consolidate-run.json` with candidates, merged/ejected/skipped state,
  and `--resume` semantics.
- Re-read target files before every `reconcile` write to avoid stale snapshot
  writes.
- Align `finalize` grammar with the implementation: either `finalize <slug>` or
  an explicit prompt before `finalize-plan-scope.js`.
- Add resume/cancel regression tests for each run record or transaction boundary
  changed above.

**Exit gate:** every long flow has either transactional no-op-on-cancel behavior
or a durable run record that makes resume deterministic.

**Fresh-session prompt:**

> Implement F6 from `docs/plans/2026-07-02-project-skill-coherence-repair.md`.
> Only repair transactional/resume semantics for pop, new/adopt, discover,
> consolidate, reconcile, and finalize. Do not change earlier phase contracts.

## Suggested execution order

1. F1 completion gates
2. F2 nested-first resolver
3. F4 schema/versioning cleanup
4. F5 mutation honesty
5. F3 docs/catalog parity
6. F6 durable run state

F3 is listed after F5 because docs describe the corrected behavior, not the
transitional one.

## Self-review against code-quality gates

- G1 read-before-claim: verified_by: `rtk rg -n "verified_by:|unverified:" docs/plans/2026-07-02-project-skill-coherence-repair.md`; claim-bearing audit summaries are marked `unverified:` because the audit source was not included with this plan.
- G2 soft-language: verified_by: `rtk rg -n <G2-ban-list-regex> docs/plans/2026-07-02-project-skill-coherence-repair.md`; final pass returns 0 matches.
- G6 reference-or-strike: verified_by: `rtk rg -n "verified_by:|unverified:" docs/plans/2026-07-02-project-skill-coherence-repair.md`; claim-bearing audit/evidence assertions have either `verified_by:` or `unverified:`.
- Initiative-depth: verified_by: this file has no YAML frontmatter `phases:` array, so initiative discovery is N/A.
