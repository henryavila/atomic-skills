# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Progress without hand-marked tasks.** The new `progress` skill and its
  `progress.py` collector derive project and milestone percentages from a
  committed `.atomic-skills/marcos.json` map, merge subjects on the integration
  ref, and the delegate runner's `status --json`. Integration comes from merge
  commits, running work from the runner; only milestones, sizes, dependencies
  and human validation live in the map. Only `collect` and `watch` write the
  deterministic panel files, rewriting one only when its bytes changed;
  `validate`, `add`, `remove`, `list` and `status` never write them.
- **The progress collector cannot hang or be misled.** `match` is a literal
  string or a list of literal substrings (case-insensitive, no token boundary),
  and no map value is a regular expression: the collector derives its
  unknown-id prefixes from the map's own card ids (`AB-12` teaches `AB-`,
  `S3` teaches `S`) and scans with one case-sensitive whole-token pattern built
  from those escaped prefixes, so `ABCD-1` never yields `BCD-1` and a map with
  no prefix produces no `card_desconhecido` alert. A hyphenated card id matches
  a merge subject as a whole token case-insensitively (`app-desktop/d-03`
  marks `D-03`), while an id without a hyphen stays case-sensitive (`backup no
  s3` never marks `S3`). Refs are validated before git sees them and resolved
  once per cycle; a bad registry entry gives `registro_invalido` and
  `add`/`remove` keep it with the same content, a failed `git log` or ref gives
  `git_log_falhou` and keeps the last rows under the map id stored at `add` (or
  the folder name for an older entry), a duplicate map id gives `id_duplicado`,
  and an unexpected project error gives `erro_interno` without stopping the
  others or leaving a partial project row. A card is blocked only by a dep that
  is not integrated or validated, and `status` computes live without keeping
  rows. Fetches are contained (`--` before the branch, no prompts, BatchMode SSH
  when unconfigured, no gc or maintenance) and run in their own process group,
  so `watch` stops within two seconds of SIGINT or SIGTERM during a fetch and
  leaves no child behind; it keeps a failure in its alerts until that project's
  fetch succeeds and drops it when the project or its `origin/` ref leaves the
  registry.
- **Progress maps accept zero-weight cards and panel rows carry titles.** An
  explicit `weight` may be `0` (a non-negative integer, not a bool); a map whose
  cards all weigh `0` is invalid. A zero-weight card still counts in `prontos`,
  `bloqueados` and `rodando` and adds nothing to `feito` or `total`; a project
  reaches 100% when every weighted card counts, so a zero-weight card can still
  be pending. A milestone whose cards all weigh `0` reports `pct` 100 when every
  card is ready-counted and `0` otherwise, with `resumo` `sem peso · <prontos>
  de <cards> prontos`; a milestone with no cards reports `pct` 0 and `resumo`
  `sem cartões`. Every `marcos.json` row gains `titulo` (the milestone
  title) and `legenda` (`<n> de <cards> prontos`, then the blocked count with
  the singular `bloqueado`, then the running count); a row kept after a failure
  keeps its old fields, with a missing `titulo` filled from `marco` and a
  missing `legenda` filled with an empty string.
- **A renamed map id is visible and recoverable.** The collector stays read-only
  on the registry: when the map loads with an id different from the entry's
  stored id it raises `id_mapa_mudou` and tells you to run `add <shell-quoted
  path> --ref <stored ref>` again. Running `add` on an already registered path
  updates its ref and stored id, and the duplicate-id check ignores that entry
  and compares each other entry's stored id, or the id its live map loads when
  the entry has no stored id. The stored id changes only through `add`.
- **The macOS panel service installs and removes reversibly.** `progress.py
  panel install --aideck <cli.js> [--port 7777]` writes the panel consumer
  manifest, its `data/` directory, two `launchd` plists, the state
  `~/.atomic-skills/progress/panel.json` and `logs/`, then bootstraps both
  labels; the plists keep the panel on `127.0.0.1` and carry only `PATH` (plus
  `ATOMIC_SKILLS_HOME`) so no secret is copied. `--aideck` must be a built
  aiDeck: the service passes `--static-dir=<directory of cli.js>/client` so the
  panel serves its page as well as its API, and install exits 1 before changing
  anything when `client/index.html` is missing beside `cli.js`. The manifest
  follows the maps'
  live titles, units and ids, and its quoted values escape DEL, C1 controls,
  U+2028/9 and lone surrogates so YAML cannot misread them. `panel uninstall`
  validates the recorded paths first and refuses a symlink at the manifest, a
  plist, the consumer, `data/`, `progress/`, `progress/logs/` or an output file,
  while the shared roots `~/.aideck`, `~/.aideck/consumers`,
  `~/.atomic-skills` and `~/Library/LaunchAgents` may themselves be symlinks;
  it then boots the labels out, deletes the two plists' named log files, removes
  only recorded files whose hash still matches, removes the four panel output
  files only when it created `data/`, and reports any directory it cannot
  remove. It never removes or records the shared roots, including `~/Library`.
  An identical reinstall checks each label and bootstraps only one that is
  down; new arguments reload both. Before stopping anything, install reads the
  files and state it would restore, so an unreadable one exits 1 with the old
  service still running. A failed reinstall restores the old files and state
  and bootstraps again the labels that were loaded before it, naming any label
  still down with the command to load it; if booting out a label this run
  bootstrapped fails, the rollback stops instead, leaves the files on disk,
  writes a state that matches them, names each label still loaded with its
  `launchctl bootout gui/<uid>/<label>` command, points to `panel uninstall` to
  finish the job and exits 1. `launchctl print` counts as not loaded only on
  exit 113 or `Could not find service`; any other failure keeps the state. A
  manifest or plist that is not recorded by the state, a symlink at the
  manifest, a plist, the consumer, `data/`, `progress/`, `progress/logs/` or an
  output file, a pre-existing output file on a first install, a label already
  loaded on a first install, a missing `--aideck` file, an `--aideck` without
  `client/index.html`, a missing `node` or an
  invalid port is refused without changes; outside macOS the commands exit 2
  unless `PROGRESS_LAUNCHCTL` is set. `add` and `remove` regenerate the manifest
  only while it still matches its recorded hash and warn about an invalid state
  instead of failing.
- **Delegate says which machine runs each executor.** Every `run` and
  `pipeline` record gains `machine`: the `--host` name, or the short hostname
  of the local machine. A `--host` run is now listed while it works, in one file
  under `~/.atomic-skills/delegate/running-remote/` that takes no local slot,
  and `status` shows the machine of every active run. `status --json` prints the
  active runs, local and remote, for a panel or a script.
- **Delegate says which repository and milestone each run belongs to.** Every
  `run` and `pipeline` record gains `repo`: `owner/name` from the origin remote
  (never the host or credentials), or the folder name of the main repository
  when there is no usable origin, the same from every linked worktree; `null`
  outside git. `run` and `pipeline` take an optional `--milestone <id>`,
  recorded as `milestone` on the run, pipeline, retry and review records and
  kept through `review-pending`. Slots, remote active files and each entry of
  `status --json` carry both fields.
- **New skill `quality-gate`.** It audits what a repository really enforces
  (nine dimensions per stack, each tool classified as blocking, warning or
  idle), installs one gate script called by every hook and by CI, and closes
  with a re-audit by auditors that saw none of the work. The skill sets the
  objectives and the layers; the agent picks the tools for each stack.
- **A debt ratchet ships with it.** `ratchet.py` (Python standard library) is
  copied into the repository and records debt per item, keyed by path and
  symbol. It fails on a new item, a worse item, a raised ceiling or a debt
  file that grew against the base branch, and carries debt across code moves.
- **Delegate uses all three Antigravity quotas.** New profiles run on the Argon
  quota (`agy-argon`, `agy-argon-review`) and on the Claude and GPT quota
  (`agy-sonnet-review`, and `agy-opus-review` for small items). Sonnet and Argon
  join the default review routes ahead of the Gemini reviewer, and Argon becomes
  a fallback executor. Claude models there only review, and never review code a
  Claude model wrote.
- **`route` shows the real Antigravity quota.** It reads `agy -p /quota`, which
  spends no model quota, and prints what remains in each group and when an
  exhausted group returns.
- **`watch` catches a change made during a collection.** It takes its
  signature before collecting, so a registry, telemetry-log, running-directory
  or ref change made while a collection runs triggers one more collection
  instead of waiting for the 60-second pass. The registry file is part of the
  signature, so even an edit that only touches an invalid entry is noticed, and
  a signature that cannot be computed keeps the previous one without stopping
  the loop. A failed panel rollback prints both the original install error and
  the bootout error, and also names each label that was loaded before the run
  and is now down with the command to load it.
- **A fetch stop does not over-signal or leak a permission error.** The
  collector skips the final `SIGKILL` when its wait already saw the process
  group gone, and catches `OSError` around every `killpg`, so a stop cannot fail
  with `PermissionError`. It also leaves `GIT_SSH` and a configured
  `core.sshCommand` alone, like `GIT_SSH_COMMAND`, instead of overriding them
  with `ssh -o BatchMode=yes`.

### Fixed

- **A stop signal right after the executor starts keeps the run record.** The
  runner used to end the executor without appending a record when the signal
  landed before its first progress read.
- **Delegate works with git older than 2.31.** The runner no longer reads an
  echoed `--path-format=absolute` as part of the git directory path.
- **An Antigravity limit now applies to its whole quota group.** The runner
  treated each model as having its own limit, so it could send work to another
  model of a group that had already run out.
- **A long Antigravity review is no longer stopped as idle.** Antigravity prints
  only when a turn ends, so a working review looked stuck after 20 minutes. The
  runner now also watches the log of that run for progress.
- **Codex resets with a full date are read correctly.** A message such as
  `try again at Nov 25th, 2026 7:44 AM` used to fall back to a 60-minute
  cooldown, so Codex returned to the routes days too early.

## [2.3.0] - 2026-11-23

### Added

- **Delegate shows who can work before a batch.** `route --role <role>` prints
  the executor and review routes with the profiles that can run now first, each
  provider limit still in force and when it ends, and a warning when the work
  would have no usable reviewer.
- **A review with no quota can be finished later.** A pipeline whose reviewers
  are all out of quota or slots now ends `review_pending` instead of
  `no_reviewer`. `review-pending` lists those pipelines and, with `--id`, runs
  the same review over the range that already passed the gate.
- **Claude can be the fallback reviewer when the operator allows it.**
  `claude-review` runs only with a yes for that task, on the local Claude Code
  login and never through an API. It checks the login first and says where and
  how to sign in, and an exhausted balance counts as a provider limit.

### Changed

- **Pipelines try profiles under a provider limit last.** Both routes are
  reordered by availability before the first attempt. Nothing is dropped, and
  the summary and the record name what was moved.

### Fixed

- **An OpenCode run no longer stops on a Web Search prompt.** A headless run
  could not answer it and exited with the work already committed, so the default
  policy now denies web search. A pipeline whose executor errors after leaving
  new commits and a clean tree now goes on to the gate and the review.
- **Antigravity runs no longer end with empty output when the global git config
  includes another file.** Antigravity's terminal sandbox cannot read a file
  that `~/.gitconfig` includes, so every git command failed, the model asked to
  leave the sandbox, and print mode denied that and printed nothing
  (`empty_output`). A local Antigravity run now gives git a copy of the global
  config with the includes resolved, for that run only.
- **A run whose runner was killed is no longer silent.** `status` marks it
  `runner gone` and tells how to stop the executor, and the log gets a
  `runner_lost` record when its slot is cleared.
- **The peak window now ends on the exact minute.** A run started at 04:00 or
  10:00 UTC (01:00 or 07:00 GMT-3) on a weekday was warned and logged as peak
  although the base price had already returned.
- **The peak schedule is now named after OpenCode Go.** The skill and the
  runner's warning called it DeepSeek's, but it is OpenCode Go's own schedule.
  The skill now also gives the hours in GMT-3.

## [2.2.0] - 2026-11-20

### Added

- **Delegate runs on another machine.** `run --host <name>` and `pipeline --host
  <name>` send the task branch to a host registered in `remote-runner`, run the
  executor there, and bring the commits back as a fast-forward of the task
  branch only. A diverged result is kept under a local ref instead of merged.
  `profiles --host` shows what is ready on that host, `remote-clean` removes
  leftover checkouts, and every remote failure still appends a record with the
  kill result. The runner never reads or copies credentials: each CLI is signed
  in on the host by its owner.
- **A run that stops making progress is stopped.** `--idle-timeout` (default 20
  minutes, `0` turns it off) ends a local run whose output, commits and working
  tree have not changed, with `failure: "stalled"`; runs on another host do
  not have it yet. `status` shows how long each run
  has been idle.
- **A stopped run keeps its work.** A local non-review run stopped for lack of
  progress, by the time limit, or by a signal gets a checkpoint commit and a
  note of where it was; `run --resume` continues from them as the next attempt.
- Time limits accept `s`, `m` and `h` suffixes.

### Changed

- **Delegate executor access follows the role.** Implement, fix, mechanical and test
  runs can write the worktree and the repository's git directory, so they commit
  themselves in a linked worktree; reviews stay non-writing. Both roles can read
  the repository, git directory, cards and outputs, run read-only `git`, and use
  the network where the CLI allows it. `run` records now carry
  `access: {network, git_write, extra_read, limits}`, and `profiles` shows the
  effective access and limits. `--access strict` removes grants instead of
  restoring a factory bypass: no network, nothing outside the worktree. Codex
  reviewers keep the read-only sandbox and therefore record the missing network
  as a limit; OpenCode and Antigravity permissions are set explicitly instead of
  relying on an approval-bypass mode.
- **OpenCode concurrency default is 10 slots** (was 2); Codex stays at 1 and
  Antigravity at 2. `DELEGATE_MAX_<EXECUTOR>` still overrides them.
- **Delegate time limit default is 4 hours** (was 90 minutes), because the idle
  limit now catches a stuck run. `--timeout` and `--review-timeout` under 60
  seconds are refused unless `--allow-short-timeout` is passed.
- Delegate cards cover one subject with at most five requirements, run the
  tests of the touched area during the work, and end on the same gate CI runs.
- Delegate card and review templates now require documentation statements to be
  checked against the code, and treat a card's final check as evidence rather
  than a target.

### Fixed

- Antigravity receives its prompt on stdin without `-p`; `agy` 1.5.13 took the
  next argument as the prompt.
- Delegate ends executor descendants that leave the process group, and a stop
  signal at any point of a run still writes its record.
- `node_modules` is ignored when it is a link as well as a directory.

- Delegate composed prompts larger than the Linux per-argument limit are refused
  for CLIs that take the prompt as one argument (Codex uses stdin); non-review
  runs use the role-neutral `input_too_large` failure and a pipeline route
  continues past it. Attachments whose names contain control characters are a
  usage error, and a diff that needed replacement characters is marked in the
  record and in the prompt.

- Delegate runs on Python 3.9 and later on macOS and Linux, using a non-reaping
  libc fallback when Python lacks `os.waitid`. Host gates preserve the caller's
  PATH and environment without sourcing shell startup files; runner tests accept
  `DELEGATE_TEST_PYTHON` for the runner and fake CLIs.

- Delegate reviews receive the diff and author's card inline, with saved prompts,
  safe fences, input size limits, and required diff ranges for Antigravity.
  Executor and reviewer routes now fall back when waiting for a slot times out.

- Global instructions now resolve directory and file symlinks and install directly
  at the destination, preserving the links and user bytes on update, opt-out,
  and uninstall. Status recognizes the destination block. Invalid links refuse
  only that file; repointed links without the owned block leave both destinations
  untouched on removal. Ownership survives moving the same instruction file behind
  a link or back into a real directory. Unreadable owned destinations no longer
  block other agents' installs, and uninstall I/O failures retain the journal with
  retry guidance. Uninstall refusals use the installation's recorded language.

## [2.1.0] - 2026-11-18

### Added

- **Optional global delegation instructions.** `install --global-instructions`
  manages owned blocks in `~/.claude/CLAUDE.md`, `~/.codex/AGENTS.md`,
  `~/.config/opencode/AGENTS.md`, and `~/.gemini/GEMINI.md`.
  `--no-global-instructions` removes them; deleting a block manually opts out
  until the explicit opt-in flag is used again. Card templates and the delegate
  skill text tell executors holding a card to execute it without re-delegating.

- **`release` skill.** Deterministic semver chooser (`plan` / `apply` / `ship`)
  and opt-in adopt of a stage or GitHub-only workflow. Ship uses the chooser
  version, ignores prerelease tags as a baseline, and refuses a default-branch
  push. Runbook: `docs/kb/release-npm-stage.md`. Skill: `skills/core/release.md`.

### Changed

- **npm publish process → Trusted Publisher stage-only.**
  `.github/workflows/publish.yml` now runs `npm stage publish` under OIDC
  (`id-token: write`) after a GitHub Release. A maintainer must **stage
  approve** with 2FA on the npm UI before the version is installable. There is
  no `NODE_AUTH_TOKEN` / bare `npm publish` happy path. Runbook:
  `docs/kb/release-npm-stage.md`.

### Fixed

- **Install GREENFIELD_CONFLICT when expanding IDEs / partial journal.** Pre-existing skill files on disk that were missing from the journal `reconcileFileSet` beforeState (e.g. Claude leftovers while the journal only tracked Grok) no longer abort install. Desired paths already on disk are adopted into the journal before the Driver runs so the 3-hash update can rewrite them. Regression: `tests/install.test.js` + `tests/adopt-preexisting-desired.test.js`.

### Breaking

- **Installer modules concept removed.** There is no optional module selection (`memory`, `auto-update`, `cross-model-bridge` / `codex-bridge` as modules). Features remain always-on:
  - `init-memory` is a **core skill** (always installed); memory path is fixed at `.ai/memory/` (custom `memory_path` is no longer configurable; reinstall warns if an older manifest had a different path).
  - Cross-model sealed-envelope assets remain under `skills/shared/codex-bridge-assets/` (always installed).
  - Auto-update remains a **runtime layer** (SessionStart hook on capable hosts).
- Catalog is **core-only**: top-level `modules` / `module_meta` keys fail `validate-skills`.
- README no longer has a Modules section (markers dropped; generation uses four regions).

### Changed

- Manifest no longer writes a `modules` field.
- Installer UI no longer offers “Change modules”.

### Product docs site cutover

Canonical human product docs: **https://atomic-skills.henryavila.com** (static site under `site/dist/`, CI via `.github/workflows/deploy-docs.yml`). Offline: `npm run generate-site` then open `site/dist/index.html`.

- **Catalog v0.3 product fields.** Top-level `product:` (what_is / what_is_not / docs_url / install.primary) and per-skill `iron_law` are validated SSOT for the README envelope and site generators.
- **Slim README.** npm/GitHub envelope only: positioning, install, host tiers, compact skills table. Long skill blurbs and module essays live on the product docs site, not in README body regions.
- **Engineering archive stays off the product site.** `docs/kb/`, `docs/design/`, plans, audits, and handoffs remain repo MD for agents and maintainers; they are not published as product pages. Generated per-skill Markdown under `docs/skills/` remains a secondary offline/GitHub view (site is the canonical human product surface).

## [2.0.0] - 2026-05-23

### Removed

- **Plan (`project`), implement, and aiDeck.** Cut before this version shipped: they cost more than they helped. Fifteen support skills remain (review-code, review-plan, audit-delivery, verify-claim, fix, hunt, brainstorm, debate, design-brief, prompt, parallel-dispatch, parallel-dispatch-audit, init-memory, save-and-push, release).

First major bump since 1.8.x. Ships the review skills refactor (4 → 2 with a
mode picker), the catalog v0.2 schema + rename to `meta/catalog.yaml`, and a
husky auto-regen pre-commit hook. Notes below that describe `project`,
`implement`, or the aiDeck dashboard record work that was removed before
publish.

### `project` skill unification (supersedes the project-status / project-plan split below)

- **`project-status` + `project-plan` → one `project` skill.** The earlier
  v2.0.0 work split tracking across two sibling skills (VIEW vs CREATE);
  the boundary leaked (each cited the other 17–24×, the reconciliation gate
  and emergence ladder crossed both). Both are now fused into a single
  `atomic-skills:project` skill. Since v2.0.0 has not shipped, this is not a
  field-breaking rename — it rides inside the unreleased 2.0.0 (no extra bump).
- **Thin router + progressive disclosure.** `skills/core/project.md` is a
  ~175-line router holding only the dispatch table, the no-args compact
  summary, and the always-resident invariants (Iron Law, pre-mutation
  gates, gate-status invariant, ratify gate, the emergence-ladder
  magnitude→action table + ambient-trigger recognition, the `new` menu,
  schema quick-ref). Every subcommand's full procedure lives in a lazy
  detail file under `skills/shared/project-assets/project-<x>.md`, read on
  demand via `{{ASSETS_PATH}}`. This is the proven `review-plan` pattern —
  invoking `project` no longer loads ~25k tokens of body up front.
- **Git-style grammar.** `/atomic-skills:project status [--browser|…]`,
  `new plan|initiative`, `done|push|pop|park|emerge|promote|…`,
  `adopt|discover|migrate|split-phase`. Bare `/atomic-skills:project`
  prints a cheap 5-line summary (no browser). `new` exposes only the two
  file entities (plan, initiative); phase/task are intent-driven via the
  ladder (`new-task`/`new-phase` still valid if typed).
- **`verify` (NEW).** Reconciles `.atomic-skills/` against the repo
  in one command — schema validity, legacy detection, branch match, scope
  coverage, orphan detection, aiDeck coherence. Read-only by default;
  `--fix` applies only the safe schema normalization.
- **aiDeck contract quarantined.** All aiDeck coupling (ensure-aideck
  script, STATE_ERROR auto-repair, the `state/project-status` domain
  string) lives in `project-view.md` behind a single named constant
  (`AIDECK_STATE_DOMAIN`). The aiDeck state-domain key stays `project-status`
  — it is a cross-repo contract with the aiDeck parser, NOT the skill name.
- **Asset dirs consolidated.** `project-status-assets/` + `project-plan-assets/`
  → `project-assets/` (flat, files-only — `install.js` copies non-recursively).
- `project-status` and `project-plan` added to
  `HISTORICAL_ATOMIC_SKILLS_NAMES` so update cleanups recognize the old
  names. Orphan docs `docs/skills/project-{status,plan}.md` removed; the
  merged test suite lives in `tests/project.test.js`.

### Project-status / project-plan split (earlier in 2.0.0; now superseded above)

### Project-status / project-plan refactor

- **`project-status` shrinks from 23 → 15 subcommands.** Only view + daily
  mutation commands remain (push, pop, park, emerge, promote, done,
  phase-done, phase-reopen, archive, switch, re-ratify, scope-creep, why,
  detect-scope, review-due). Skill body drops from 1347 → 908 lines.
- **`project-plan` absorbs all CREATE + STRUCTURAL + MIGRATION commands:**
  default bootstrap, `adopt`, `discover` (NEW), `new`, `new-task`,
  `new-phase`, `split-phase`, `migrate`, `re-bootstrap`. Skill body grows
  from 415 → 865 lines.
- **`discover` subcommand (NEW, renamed from the legacy `bootstrap`).**
  Multi-source scan (git, github, docs, roadmap, `.ai/memory/`, custom
  paths via `--scan=<path>`) → cluster → synthesize → propose Plans +
  Initiatives in one preview. Extended with plan-detection heuristic
  (`detectPlanShape` in `src/bootstrap.js`): markdown sources with ≥ 2
  phase headings (`## F0`, `## Phase 0`, `## Fase 0`) route through
  `decomposePlan` + `materializeDecomposition` to become Plans, not just
  standalone Initiatives. Closes the gap where the legacy `bootstrap`
  only produced flat initiatives even when the source had phase structure.
- **Verb-based mental model:** "track existing state" → `project-status`;
  "create or restructure state" → `project-plan`. Single entry-point for
  "I don't know where to start" is `project-plan discover`.
- PROJECT-STATUS.md template + skill cross-references updated to point at
  the new homes for moved commands. No backwards-compat aliases — this
  ships before the v2.0.0 publish.

### Cross-model review fixes (origin/main..HEAD @ 2026-05-24)

Following the local + codex review on the v2.0.0 prep branch
(`.atomic-skills/reviews/20260524-055236-origin-main-to-head-v2-refactor.md`),
the following fixes were applied:

- **Husky pre-commit guard** (F-001 from codex, major): hook now refuses to
  regenerate when `README.md` or `src/dashboard/data/skills.generated.ts`
  have unstaged changes. Without this guard the auto-`git add` would sweep
  unrelated hand-edits into the commit. Shell test in
  `tests/hooks/pre-commit.test.sh` covers the abort path.
- **Safe legacy cleanup** (F-002 from codex blind, dropped via constraints
  but applied anyway): `findLegacyOrphans` now returns `{path, safe}`
  per file; only files whose frontmatter `name:` matches a known
  atomic-skills artifact (current catalog + `HISTORICAL_ATOMIC_SKILLS_NAMES`
  safelist) are deleted in `--yes`. Unrecognized files at the legacy path
  are preserved with a clear warning.
- **Root catalog version validation** (F-003): `validateCatalogVersion`
  enforces `data.version === '0.2'`. Opt-in via `requireCatalogVersion`
  (CLI on, tests off).
- **`release_highlight` validation** (S2): `validateReleaseHighlight`
  rejects garbage `{body: 42}` before the renderer throws.
- **`detectPlanShape` code-block awareness** (T11): state-machine pass
  over lines so phase headings inside fenced code blocks (```python\n##
  Phase 1) don't false-positive as Plan candidates.
- **`removeLegacyOrphans` path-aware boundary** (L1): switched from
  `parent.startsWith(legacyRoot)` to `parent === legacyRoot ||
  parent.startsWith(legacyRoot + path.sep)`. Defensive against
  prefix-collision siblings.
- **Silent failure surfaced** (E1): `removeLegacyOrphans` now logs
  `[atomic-skills] could not remove <path>: <err>` when `unlinkSync`
  fails, instead of swallowing.
- **`bootstrap-index.template.md` command rename** (C1 from local):
  template instruction `atomic-skills:project-status bootstrap --commit`
  → `atomic-skills:project-plan discover --commit` to match the
  project-status/project-plan refactor.
- **Codex invocation portable on macOS** (skill body fix):
  `skills/shared/codex-bridge-assets/invocation-canonical.txt` now
  documents a detector that picks `timeout` / `gtimeout` / `perl -e
  'alarm shift @ARGV; exec @ARGV' --` based on what's available. Native
  macOS users no longer hit `command not found: timeout`.

Test coverage delta: 425 → 474 (+49 new unit tests across
`validateModuleMeta`, `validateReadmeMentions`, `validateCatalogVersion`,
`validateReleaseHighlight`, `findLegacyOrphans`, `removeLegacyOrphans`,
`isAtomicSkillsArtifact`, `detectPlanShape` code-block, `status` forceProject)
plus 3 shell tests for `.husky/pre-commit`.

### Breaking changes

- **Removed `review-plan-internal` and `review-plan-vs-artifacts`** — merged
  into a single `review-plan` with a Step 0 cross-ref picker.
- **Removed `review-plan-with-codex` and `review-code-with-codex`** — merged
  into `review-plan` and `review-code`. The codex cross-model envelope is
  now opt-in via a Step 0 mode picker.

  Migration for all four removals: replace the old slash command with
  `/atomic-skills:review-{plan,code}` and answer the picker (`local`,
  `codex`, `both`, default `both`). Non-interactive callers must pass
  `--mode=<x>`.

- **Catalog schema bumped to `0.2`** — every entry gained the required
  fields `one_liner`, `emoji`, `version_added` (plus optional `subcommands`,
  `args`, `output_artifacts`, `dependencies`). `schema_version: '0.1'` is
  no longer accepted; legacy entries must be migrated before validating.
- **Catalog file renamed `meta/skills.yaml` → `meta/catalog.yaml`** with a
  new top-level `version: '0.2'` field. Consumers within the package
  (installer, detector, validators, generators, dashboard helpview) all
  updated; no external API change since `meta/` ships in the tarball but
  is not a documented public surface.

### Added

- **`review-plan`** — merged same-model + cross-reference plan review with
  `{{ASK_USER_QUESTION_TOOL}}` at Step 0a (mode picker) and Step 0b
  (cross-ref picker, orthogonal). Detects artifacts under common section
  headings, classifies LOCAL paths vs URLs, runs the 7 internal + 6
  cross-ref checks. Activates a HARD-GATE ("plan corrected, artifacts never
  edited") on cross-ref mode.
- **`review-code`** — same-model adversarial review of a git ref. 7-item
  checklist (logic bugs, race conditions, error handling, schema/migrations,
  API contracts, file/function references, test coverage). Range-aware ref
  validation (triple-dot detected first, then double-dot, then single),
  shape-specific diff command that avoids the `git diff <single-ref>`
  worktree-leak bug.
- **Step 0 mode picker (`local` | `codex` | `both`, default `both`)** in
  both review skills. `both` runs local first (cheap, fast) then codex on
  the CLEANED artifact / SAME captured diff. Honors `--mode=...` for
  non-interactive use.
- **Sealed envelope preservation in `both` mode** — the codex briefing
  receives only the cleaned artifact + external constraints, never the
  local findings or fix log. Anti-framing rule baked into the skill body
  and Red Flags table (cites [arXiv 2603.18740](https://arxiv.org/abs/2603.18740)).
- **`review-code` captured-diff invariant** — both phases consume the same
  `CAPTURED_DIFF` materialized once via the shape-specific git command;
  `git diff` is never re-run. Guarantees byte-identical material across
  reviewers.
- **`{{ASK_USER_QUESTION_TOOL}}` template variable** — resolves to
  `AskUserQuestion tool` on Claude Code and to a descriptive plain-text
  fallback on every other IDE. Documented in `CLAUDE.md`, `AGENTS.md`,
  `docs/kb/gemini-cli-compatibility.md`.
- **Argument contract** documented at the top of both review skill bodies:
  `--mode=local|codex|both|internal`, `--no-cross-ref`, `--cross-ref=...`,
  `--allow-dirty`, plus the non-interactive abort policy.
- **G1+G2+G6 code-quality gates** in the merged review skills, plus a
  self-review block printed before closing.
- **README is fully generator-driven for catalog-coupled content.** Five
  marker pairs are populated from `meta/catalog.yaml` (+ `src/config.js`):
  `IDES_TABLE`, `VERSION_NOTE`, `SKILLS_TABLE`, `SKILL_DETAILS`, `MODULES`.
  The 230-line hand-written `<details>` prose duplicate was deleted.
- **Dashboard data generator** (`scripts/generate-helpview-data.js`) emits
  `src/dashboard/data/skills.generated.ts` consumed by HelpView; subcommands
  now render in the detail panel.
- **`module_meta` block** in catalog (sibling of `modules:`, not a reshape)
  carries per-module `title / version_added / intro / features / notes`
  and is cross-checked against `modules` (no orphans, no missing).
- **`release_highlight` block** in catalog carries the editorial body of
  the versioned `> Note (vX.Y.Z):` callout; version is pulled from
  `package.json` so the two cannot disagree.
- **README static-prose lint** in `scripts/validate-skills.js` fails when
  an `atomic-skills:<name>` mention does not resolve to any catalog entry.
- **Husky pre-commit auto-regenerates docs** when any generator input is
  staged (`meta/catalog.yaml`, `skills/en/**`, `src/config.js`,
  `package.json`, renderer code) and re-stages `README.md` +
  `src/dashboard/data/skills.generated.ts` so the commit captures inputs
  and outputs atomically. Hand-edits to README static sections are
  preserved across regen runs.

### Changed

- `review-plan` Step 0 split into Step 0a (mode picker) + Step 0b
  (cross-ref picker). The two pickers are orthogonal — cross-ref selection
  applies to every mode.
- `review-code` Step 0 simplified to a single mode picker; ref validation
  and diff capture moved to a dedicated "Argument & diff capture contract"
  section that runs BEFORE the picker so abort paths (invalid ref, dirty
  tree without `--allow-dirty`) do not depend on TTY.
- `ACCEPTED_SCHEMA_VERSIONS` narrowed to `{ '0.2' }`.
- Skill catalog: 13 → 11 entries (4 review skills removed, 2 added; net -2).
- Body-↔-catalog parity check enforced; `## Iron Law` heading required
  after normalizing 4 bodies that previously used `## Fundamental Rule`.
- `validate-catalog` (= `validate-skills` + `check-docs`) gated by husky
  pre-commit and GitHub Actions `test.yml` on every push/PR.

### Fixed

- `review-code-with-codex` (later removed in this release) had a Step 2 bug
  where `git rev-parse --verify <ref>` rejected revision-range syntax —
  `main..HEAD` failed even when both endpoints existed. The ref-shape
  detection now lives in the new `review-code`.

### Rationale

Empirically verified across two consecutive sessions (2026-05-21 and
2026-05-22), local self-review and codex cross-review catch DISJOINT sets
of findings — neither subsumes the other (literature: arXiv
[2603.12123](https://arxiv.org/abs/2603.12123),
[2410.21819](https://arxiv.org/abs/2410.21819),
[2604.19049](https://arxiv.org/html/2604.19049v1)). The mode picker encodes
the common workflow with a default and lets the user opt down for
cost-sensitive cases. Local runs first in `both` so cheap issues filter out
before the paid codex pass, and so codex sees a CLEANED artifact without
anchoring on local findings (reverse order would let self-preference bias
contaminate the cross-model invariant).

[Unreleased]: https://github.com/henryavila/atomic-skills/compare/v2.3.0...HEAD
[2.3.0]: https://github.com/henryavila/atomic-skills/releases/tag/v2.3.0
[2.2.0]: https://github.com/henryavila/atomic-skills/releases/tag/v2.2.0
[2.1.0]: https://github.com/henryavila/atomic-skills/releases/tag/v2.1.0
