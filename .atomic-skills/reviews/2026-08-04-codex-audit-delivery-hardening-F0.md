# Phase review — codex leg — audit-delivery-hardening F0

**Mode:** codex (both dual-leg)
**At:** 2026-08-04T14:43:36Z
**Range:** 8a2b43f1..HEAD (at review time)
**Provider:** codex exec review --base 8a2b43f1

## Raw codex output (tail of transcript)

366: planTitle: audit-delivery hardening — P0 craft + teeth, P1 evidence, P2 advanced
388:@@ -5,7 +5,7 @@ title: audit-delivery hardening — P0 craft + teeth, P1 evidence, P2 advanced
404:   - id: P2
644:       outOfScope: P2 prosecution/critic/cross; dogfood narrative file.
667:     title: P2 advanced + dogfood close
712: planTitle: audit-delivery hardening — P0 craft + teeth, P1 evidence, P2 advanced
4078: planTitle: audit-delivery hardening — P0 craft + teeth, P1 evidence, P2 advanced
4106: title: audit-delivery hardening — P0 craft + teeth, P1 evidence, P2 advanced
4122:   - id: P2
4398:.atomic-skills/focus.json:7:    "title": "audit-delivery hardening — P0 craft + teeth, P1 evidence, P2 advanced",
5513: - **P2 Runner is the writer channel** — Work-order, lease, sealed brief, claim validate are owned by a package CLI; skill prose points at that CLI, not a second invented protocol.
7436:  ✔ extracts principles from H3 children, deriving ids from numbered prefix (2.1 → P1, 2.2 → P2, …) (1.329709ms)
17820:    'P1/F2/T-004 generating P2 renders `Surgiu de P1 · F2/T-004`; P2 enters\n' +
17844:    actual: '# project — task / phase transitions (lazy detail)\n\nLoaded by the router for: `done`, `phase-done`, `phase-reopen`, `switch`, `archive`, `detect-scope`, `reconcile`, and the per-task / exit-gate **Verifier execution patterns**. The router holds the always-resident pre-mutation gates (migration check, reconciliation gate, gate-status invariant); this file holds the per-command procedures plus the migration-check detail.\n\n## Entity-file resolution (nested-first, flat-fallback)\n\nEvery step below that "loads", "moves", or "archives" a plan/initiative file resolves its path against the **nested** layout first and the legacy **flat** layout only as a fallback (see the router\'s layout model):\n\n- **Plan** `<slug>` → `projects/<project-id>/<slug>/plan.md`; legacy `plans/<slug>.md`.\n- **Phase initiative** of plan `<plan-slug>` → `projects/<project-id>/<plan-slug>/phases/f<N>-<slug>.md`; legacy `initiatives/<slug>.md`. A **standalone** initiative is its own degenerate 1-phase plan (`projects/<project-id>/<slug>/{plan.md,phases/<slug>.md}`).\n- **Archive** → the layout\'s archive dir: nested `projects/<project-id>/<plan-slug>/phases/archive/<YYYY-MM>-<slug>.md` for a phase initiative (a whole plan is archived in place with `status: archived`); legacy flat `initiatives/archive/` + `plans/archive/`.\n- **Index** → that project\'s `projects/<project-id>/PROJECT-STATUS.md`; legacy top-level `.atomic-skills/PROJECT-STATUS.md`.\n\n### Fuzzy identifier resolution (shared — every verb, including lazy-loaded ones)\n\nA user resuming after a break knows *what* they want ("reopen the validation phase") but not the exact token (`f0.5-validation`). **Every** verb that takes a `<slug>` / `<phase-id>` / `<task-id>` — including those that lazy-load other assets (`materialize`, `depend`, `split-phase`, `why`, `switch`, `phase-reopen`, `unblock`, `done`, `finalize`, `archive`) — resolves its argument with the **same** rules (pure helper: `src/project-target-resolver.js` → `resolveFuzzyIdentifier`):\n\n1. **Exact id/slug** → use it.\n2. **Else case-insensitive prefix / substring of the id OR the human `title`/`summary`** across the candidate set (active plan\'s phases/tasks, or plans for `switch`). A single match → use it (echo the resolved id: "Resolved \'validation\' → `f0.5-validation`").\n3. **Multiple matches** → list them and disambiguate via {{ASK_USER_QUESTION_TOOL}} (never guess).\n4. **Zero matches** → print the valid ids for that verb\'s scope (the same list the abort messages already show) so the next attempt is one copy away — never just "not found".\n\nThis is resolution only; it does not relax any gate. Lazy detail files must not invent a stricter "exact only" fork — they inherit this section.\n\nWhere a step writes `initiatives/…`, `plans/…`, or `PROJECT-STATUS.md` below, read it as "the resolved path for the active layout".\n\n## Pre-mutation migration check (detail)\n\nEvery time you load an existing initiative or plan for mutation:\n1. Parse its frontmatter.\n2. If `schemaVersion` is absent or missing, this is a **legacy file**. STOP and prompt the user to invoke `atomic-skills:project migrate <slug>` (which handles the standalone-vs-in-plan choice and calls `src/migrate.js:migrateLegacyInitiative`). Abort the current mutation with: "Mutation cancelled — file is legacy. Run `atomic-skills:project migrate <slug>` first, then retry."\n\nThe pre-mutation check is the **only** way legacy files are touched, and migration itself is delegated to the `migrate` flow (`{{ASSETS_PATH}}/project-migrate.md`). This skill never silently writes legacy-shape YAML.\n\n## Pre-mutation reconciliation gate (detail)\n\nEvery time you load an active initiative for a **mutating** command, use the **same** pre-mutation verb list as the router (`skills/core/project.md` → Pre-mutation gates): `push`, `pop`, `park`, `emerge`, `promote`, `unblock`, `done`, `phase-done`, `phase-reopen`, `finalize`, `consolidate`, `archive`, `switch`, `depend add`, `depend remove`, `depend resolve`, `detect-scope`, `reconcile`, `re-ratify`, `new-task`, `new-phase`, `verify --fix`. Do not maintain a shorter fork of this list here. Run this check AFTER the migration check and BEFORE executing the command. `materialize` can be the command that creates the phase initiative; when no active initiative exists, it skips this active-initiative reconciliation gate and runs its own plan-level pre-flight. When called from `phase-done`/`switch`/`phase-reopen`, the caller has already run this gate.\n\n1. Parse `tasks[]` from the active initiative\'s frontmatter.\n2. Collect tasks where `status` is `active` AND `lastUpdated` is older than 24 hours from now.\n3. If the collected list is empty → skip, proceed to the command.\n4. If the list is non-empty → present a reconciliation prompt using {{ASK_USER_QUESTION_TOOL}}:\n\n   ```\n   ⚠ Unreconciled tasks detected (active >24h):\n\n     T-001 "Add scopeBoundary to schema" — active 3d\n     T-002 "Session-End reconciliation"  — active 1d\n\n   For each: still active? done? blocked?\n   ```\n\n   Present one structured question per stale task (max 4; if more than 4, batch the oldest 4 first). Options per task: `Still active`, `Done`, `Blocked`, `Skip`.\n\n5. Apply user answers immediately:\n   - **Done** → run the `done <task-id>` flow (including auto-transition detection).\n   - **Blocked** → set `status: blocked`, ask for `blockedBy[]` (optional), bump `lastUpdated`.\n   - **Still active** → bump `lastUpdated` to now (acknowledges the task, resets the 24h clock).\n   - **Skip** → no change, proceed.\n6. After reconciliation, proceed to the original command.\n\nThe gate is skipped for read-only commands (`status` views, `why`, `scope-creep`). It is also skipped when the user is already running `done` on one of the stale tasks (avoid double-prompting).\n\nThe 24-hour threshold is configurable via `.atomic-skills/status/config.json` key `reconciliationThresholdHours` (default: 24). Set to `0` to disable.\n\n## `unblock <task-id>` (C-1 / B2#3 — the missing exit from `blocked`)\n\n`blocked` is a first-class open task status (the reconciliation gate sets it, and auto-transition counts it among remaining work), but it had **no documented forward transition** — a blocked task could only be `done` (needs its verifier to pass) or hand-edited, which the Iron Law forbids. `unblock` is that exit. It is a mutating command (subject to the pre-mutation gates); it does NOT close the task — it returns it to workable state.\n\n1. Locate the task `<task-id>` in the active initiative\'s `tasks[]`. If its `status` is not `blocked`, report that and stop (nothing to unblock).\n2. If it carries `blockedBy[]`, show each blocker and its current status. Confirm with the user that the blocker is resolved (or that they want to unblock regardless). A blocker task that is itself still open is a warning, not a hard stop — the user may have unblocked out-of-band.\n3. Set `status: active` (or `pending` if the user has not started it), clear `blockedBy[]`, bump `lastUpdated`. Leave `evidence`/`closedAt` untouched (the task was never closed).\n4. Run `node "$(cat "$HOME/.atomic-skills/package-root" 2>/dev/null || echo .)/scripts/refresh-state.js"` so rollups/focus reflect the reopened work, and save.\n5. **Grok session-todo projection (session-local only; never close authority).** After `refresh-state`, run `node "$(cat "$HOME/.atomic-skills/package-root" 2>/dev/null || echo .)/scripts/project-session-todos.js" --json` and apply the payload with the Grok session checklist tool (`todo_write`) when on Grok. SoT order: mutate → `refresh-state` → `project-session-todos` → `todo_write`. Never mark a phase session todo `completed` unless that phase\'s durable status is already `done` or `archived`.\n\n## Plan dependency block guidance (`dependsOnPlans[]`)\n\nBefore a transition or next-action view tells the operator to execute a plan, it must surface plan-level blockers from `dependsOnPlans[]` separately from phase/task dependencies. Build the project plan graph with `src/plan-dependencies.js` and treat `blockedByPlans[<plan-slug>]` as the operational source of truth; `spawnedFrom` and `phases[].spawnedPlans` explain origin only and never open or close execution by themselves.\n\nWhen a plan is blocked, print the blocked path in this shape: `plan <dependent> is blocked by prerequisite plan <prerequisite> (status: <status>)`. Then print the resume path: switch to the prerequisite plan and finish it when its status is `active`, `paused`, or `pending`; when the prerequisite is `done`, rerun the original transition; when the prerequisite is `archived`, keep the dependent blocked unless the edge records an explicit archived-resolution decision (`release.archived: resolved`). A transition that detects such a blocker stops before changing plan/phase status, so the operator never advances a blocked plan by following stale next-action prose.\n\nUse the same split in dashboard prose and next-action prose: **Caminho de execucao**\nis the operational lane, while **Surgiu de** is lineage. Example:\nP1/F2/T-004 generating P2 renders `Surgiu de P1 · F2/T-004`; P2 enters\n`Bloqueado` only when `dependsOnPlans[]` also names P1 as its prerequisite.\nWithout that edge, the lineage row never blocks execution.\n\n## Microcommit checkpoints\n\nEvery mutating transition that closes a task or advances a phase ends with an explicit-path git checkpoint. Run these via {{BASH_TOOL}} and keep unrelated dirty files unstaged:\n\n- Inspect first: `rtk git status --short` and `rtk git diff --name-only`.\n- Stage only the files written by the transition: `rtk git add <explicit-paths>`.\n- For a single task close, commit the state checkpoint as `rtk git commit -m "chore(project): checkpoint <plan> <phase> <task-id>"`.\n- For a phase boundary, split logical checkpoints when the diff is large (review gate, lessons, archive move, next-phase activation), with the final advance commit shaped as `rtk git commit -m "chore(project): advance <plan> <phase>"`.\n\nNever use `git add .` or `git add -A`. If `git diff -'... 72167 more characters,
23556:The patch leaves generated site output out of sync with the catalog and commits schema-invalid project state. It also weakens the new reaudit entry gate for incomplete Intent Packages.
23558:Full review comments:
23560:- [P2] Regenerate the product site after catalog edits — /Volumes/External/code/atomic-skills/meta/catalog.yaml:1077-1079
23563:- [P2] Use the schema field for lessons-none metadata — /Volumes/External/code/atomic-skills/.atomic-skills/projects/atomic-skills/audit-delivery-hardening/plan.md:80-81
23566:- [P2] Store task verifier evidence in the schema shape — /Volumes/External/code/atomic-skills/.atomic-skills/projects/atomic-skills/audit-delivery-hardening/phases/audit-delivery-hardening-f0-p0-craft-foundation.md:87-95
23569:- [P2] Abort reaudit when either Intent Package half is missing — /Volumes/External/code/atomic-skills/skills/shared/audit-delivery-assets/reaudit-entry.md:40-41

                + cursor step G under stamp + lastAssert written
  finalize      canFinalizeOrArchive (plan-end + userValidatedAt under stamp)
                + cursor step I under stamp

Options:
  --project <id>            Prefer projects/<id>/<slug>/plan.md
  --state-root <path>       Default: ./.atomic-skills
  --status-root <path>      Default: <state-root>/status
  --claim-report <path>     JSON claim report (claims|done)
  --check-reachability      Validate claim SHAs against reachable set
  --reachable-file <path>   Newline-separated SHAs for reachability
  --complex-receipts <path> JSON { "T-001": { mode, reviewFile } } for complex done
  --plan-diff-file <path>   Newline paths for plan-tree product fence (done under stamp)
  --base-ref <sha>          git diff --name-only <base-ref>..HEAD → product fence inject
  --skip-cursor             Skip maestro-cursor step check (debug / recovery only)
  --skip-last-assert        Do not write lastAssert (debug only)
  --help                    Show this help (exit 0)

Maestro cursor (Layer 2.5, under stamp only):
  Path: <status-root>/automate/<slug>.json via src/maestro-cursor.js
  Missing cursor initializes at A (ensureCursor) — still blocks gates that need C/E/G/I.
  lastAssert: { gate, ok, at } written on done/phase-done so skill cannot mutate without assert.
  Non-automate: cursor not required (gate inactive for step check).

Exit codes:
  0  ok
  1  blocked or usage/error

Output:
  ok
  blocked: <reason>
blocked: missing --plan

assert-automate-gate — pure automate STOP gates (Layer 2 + cursor 2.5)

Usage:
  node scripts/assert-automate-gate.js --plan <slug> --gate <gate> [options]

Gates:
  spawn         canSpawnHostThinPhaseWriter (lease missing + initiative present)
                + maestro cursor step C under automate stamp; descriptor-only refuse
  claims        canCloseTasksFromClaims (claim report required under automate stamp)
                + cursor step D|D.5|E under stamp
  done          canDoneFromAutomateClaims under stamp (claim-bound + complex from initiative)
                + reachability ON by default (pass --reachable-file <shas>; use --gate claims for shape-only)
                + cursor step E under stamp + lastAssert written
  phase-done    canRunPhaseDone (evaluation + lessons + review both + decisionReview under durable automate)
                + cursor step G under stamp + lastAssert written
  finalize      canFinalizeOrArchive (plan-end + userValidatedAt under stamp)
                + cursor step I under stamp

Options:
  --project <id>            Prefer projects/<id>/<slug>/plan.md
  --state-root <path>       Default: ./.atomic-skills
  --status-root <path>      Default: <state-root>/status
  --claim-report <path>     JSON claim report (claims|done)
  --check-reachability      Validate claim SHAs against reachable set
  --reachable-file <path>   Newline-separated SHAs for reachability
  --complex-receipts <path> JSON { "T-001": { mode, reviewFile } } for complex done
  --plan-diff-file <path>   Newline paths for plan-tree product fence (done under stamp)
  --base-ref <sha>          git diff --name-only <base-ref>..HEAD → product fence inject
  --skip-cursor             Skip maestro-cursor step check (debug / recovery only)
  --skip-last-assert        Do not write lastAssert (debug only)
  --help                    Show this help (exit 0)

Maestro cursor (Layer 2.5, under stamp only):
  Path: <status-root>/automate/<slug>.json via src/maestro-cursor.js
  Missing cursor initializes at A (ensureCursor) — still blocks gates that need C/E/G/I.
  lastAssert: { gate, ok, at } written on done/phase-done so skill cannot mutate without assert.
  Non-automate: cursor not required (gate inactive for step check).

Exit codes:
  0  ok
  1  blocked or usage/error

Output:
  ok
  blocked: <reason>

exec
/bin/zsh -lc "rtk proxy node scripts/assert-automate-gate.js --plan audit-delivery-hardening --gate phase-done --project atomic-skills --skip-last-assert 2>&1 | sed -n '1,120p'" in /Volumes/External/code/atomic-skills
 succeeded in 469ms:
blocked: maestro cursor step F forbids gate phase-done (need G)

exec
/bin/zsh -lc 'rtk proxy git diff --check 8a2b43f199023c5b3df58fe5c2ea55581a505612' in /Volumes/External/code/atomic-skills
 exited 2 in 0ms:
.atomic-skills/projects/atomic-skills/audit-delivery-hardening/phases/audit-delivery-hardening-f0-p0-craft-foundation.md:243: new blank line at EOF.

codex
The patch leaves generated site output out of sync with the catalog and commits schema-invalid project state. It also weakens the new reaudit entry gate for incomplete Intent Packages.

Full review comments:

- [P2] Regenerate the product site after catalog edits — /Volumes/External/code/atomic-skills/meta/catalog.yaml:1077-1079
  When this catalog text changes, the generated site must be refreshed; `npm run check-docs` now fails with `site/dist is out of sync` for `skills/audit-delivery/index.html`, so the docs validation gate will keep failing until `npm run generate-site` is run and the updated `site/dist` file is committed.

- [P2] Use the schema field for lessons-none metadata — /Volumes/External/code/atomic-skills/.atomic-skills/projects/atomic-skills/audit-delivery-hardening/plan.md:80-81
  For phases with `lessonsState: none`, the plan schema allows `noneReason`, not `lessonsNoneReason` or `lessonsVerifiedAt`; `npm run validate-state` rejects this changed plan because of these added keys, which leaves the active plan invalid for state consumers.

- [P2] Store task verifier evidence in the schema shape — /Volumes/External/code/atomic-skills/.atomic-skills/projects/atomic-skills/audit-delivery-hardening/phases/audit-delivery-hardening-f0-p0-craft-foundation.md:87-95
  For done tasks, `task.evidence` reuses the exit-criterion evidence schema, so each object needs `verifierKind` and cannot include `command` or `closeFingerprint`; `npm run validate-state` now reports this for T-001 through T-005, causing this active initiative to fail schema validation.

- [P2] Abort reaudit when either Intent Package half is missing — /Volumes/External/code/atomic-skills/skills/shared/audit-delivery-assets/reaudit-entry.md:40-41
  In reaudit mode, a recovered report with only one side of the required Intent Package, such as one problem but fewer than two decisions, will proceed because this aborts only when both counts are too low; the fresh audit gate requires aborting if either requirement is missing, so this should use `or` to avoid spawning a reaudit with incomplete intent.
The patch leaves generated site output out of sync with the catalog and commits schema-invalid project state. It also weakens the new reaudit entry gate for incomplete Intent Packages.

Full review comments:

- [P2] Regenerate the product site after catalog edits — /Volumes/External/code/atomic-skills/meta/catalog.yaml:1077-1079
  When this catalog text changes, the generated site must be refreshed; `npm run check-docs` now fails with `site/dist is out of sync` for `skills/audit-delivery/index.html`, so the docs validation gate will keep failing until `npm run generate-site` is run and the updated `site/dist` file is committed.

- [P2] Use the schema field for lessons-none metadata — /Volumes/External/code/atomic-skills/.atomic-skills/projects/atomic-skills/audit-delivery-hardening/plan.md:80-81
  For phases with `lessonsState: none`, the plan schema allows `noneReason`, not `lessonsNoneReason` or `lessonsVerifiedAt`; `npm run validate-state` rejects this changed plan because of these added keys, which leaves the active plan invalid for state consumers.

- [P2] Store task verifier evidence in the schema shape — /Volumes/External/code/atomic-skills/.atomic-skills/projects/atomic-skills/audit-delivery-hardening/phases/audit-delivery-hardening-f0-p0-craft-foundation.md:87-95
  For done tasks, `task.evidence` reuses the exit-criterion evidence schema, so each object needs `verifierKind` and cannot include `command` or `closeFingerprint`; `npm run validate-state` now reports this for T-001 through T-005, causing this active initiative to fail schema validation.

- [P2] Abort reaudit when either Intent Package half is missing — /Volumes/External/code/atomic-skills/skills/shared/audit-delivery-assets/reaudit-entry.md:40-41
  In reaudit mode, a recovered report with only one side of the required Intent Package, such as one problem but fewer than two decisions, will proceed because this aborts only when both counts are too low; the fresh audit gate requires aborting if either requirement is missing, so this should use `or` to avoid spawning a reaudit with incomplete intent.

## Disposition notes (orchestrator)
- Schema findings (lessonsNoneReason, evidence shape) fixed on plan/initiative host state
- Product reaudit-entry OR + site regenerate: fix agent in flight
- P2 only; no blocker/critical
