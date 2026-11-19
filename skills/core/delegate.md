This skill is for the orchestrator. An agent holding a task or review card is the executor or reviewer: do the card’s work yourself, without opening this skill, delegating again or asking for confirmation.

The runner requires Python 3.9 or later on macOS or Linux.

Keep the orchestrator for the two things only it should do here — **create** the task card and **validate** the result — and hand every action (implementing, fixing, mechanical edits, scripted checks) to an external executor: OpenCode (`opencode`), Codex (`codex`), or Antigravity (`agy`). Every run is measured and appended to one audit log, so the skill can be judged and improved from data.

If {{ARG_VAR}} was provided, treat it as the task or list of tasks to delegate (ids, a plan file, or a description). If not, ask the user what to delegate.

## Iron Law

THE ORCHESTRATOR CREATES AND VALIDATES; EXECUTORS ACT; NOTHING RUNS BEFORE THE USER CONFIRMS THE MODEL.

Do not implement the task yourself "because it is small", and do not hand it to a subagent of your own model family. The model choice decides cost and quota, so the user approves it per batch. An executor's report is a claim, not evidence: only the gate you run on the host and the review decide.

<HARD-GATE>
About to edit product code yourself, or to hand it to a subagent of your own model family to implement or fix? STOP — write a card and delegate.
About to run an executor without having shown the batch table and received an explicit yes in this conversation? STOP.
About to record `gate_host: pass` from the executor's own words? STOP — run the gate yourself or record `not_run`.
</HARD-GATE>

## Executors and model classes

| Profile | CLI and model | Use for |
|---|---|---|
| `flash` | OpenCode, `opencode-go/deepseek-v4.1-flash` (`deepseek`) | default for implement, fix, mechanical, test |
| `flash-review` | OpenCode, `opencode-go/deepseek-v4.1-flash` (`deepseek`) | review of `codex` or `agy` work |
| `codex` | Codex, `gpt-6.1-sol` (`openai`; override: `DELEGATE_CODEX_MODEL`) | implement or fix with open design decisions, concurrency, security or migrations |
| `codex-review` | Codex, `gpt-6.1-sol` (`openai`), read-only sandbox | review of `flash` or `agy` work |
| `agy` | Antigravity, `gemini-4-hydrogen-high` (`gemini`) | implement or fix when Codex is unavailable |
| `agy-review` | Antigravity, `gemini-4-hydrogen-xhigh` (`gemini`) | review of `flash` or `codex` work |

### Routing by role

| Role | First | Fallback |
|---|---|---|
| mechanical, test | `flash` | `codex` |
| implement or fix, closed card | `flash` | `codex` (after one failed `flash` attempt; do not retry `flash`) |
| implement or fix with open design decisions, concurrency, security, migrations | `codex` | `agy` |
| review of `flash` work | `codex-review` | `agy-review` |
| review of `codex` work | `flash-review` | `agy-review` |
| review of `agy` work | `codex-review` | `flash-review` |

- **Flash is the default executor.** It is good at a closed card (files, values and tests named), mechanical work, and a fix round with exact `file:line` findings. It is weak at: work with a design decision left open, and hard algorithmic problems; and it can fit the code to the test instead of solving the problem — which is why the host gate and a cross-family review are mandatory for Flash's own work.
- **Flash reviews work of another family.** It is the cheapest reviewer and also the slowest (about an hour on a 600-line diff, against minutes for the others), so prefer `codex-review` when the author is not Codex and time matters.
- **Only Flash is used in OpenCode.** Do not enable or select another OpenCode model, and never one whose terms train on request data. The runner refuses any other OpenCode model and exits before launching.
- **The reviewer is never of the family that wrote the code.** That is the only rule for choosing a reviewer: `flash-review` reviews `codex` and `agy` work, `codex-review` reviews `flash` and `agy` work, `agy-review` reviews `flash` and `codex` work. Not even when the other reviewers are out of quota: wait for the quota or ask the user. Families: `deepseek`, `openai`, `gemini`.
- **Check availability and switch on quota limits.** Before building the batch table, run `python3 {{ASSETS_PATH}}/delegate.py profiles`; when a `run` record says `"failure": "provider_limit"`, do not retry that executor. Switch according to the routing table. A pipeline automatically tries the next profile in its approved route; ask for a new yes only for a profile outside the approved route. For standalone `run`, show and confirm the fallback if it was not already approved.
- **DeepSeek peak hours** (weekdays 01:00–04:00 and 06:00–10:00 UTC) double its price; the runner records it and proceeds. Prefer off-peak for a large batch.
- **The orchestrator reviews only on escalation:** the cross-family review and the executor disagree after two fix rounds, the change touches auth, money, data deletion or a migration, or the user asks. Say so in the batch table.
- The runner finds the CLIs itself: PATH, the usual bin folders, and for OpenCode the `opencode-cli` inside `OpenCode.app` (the desktop app does not add it to PATH). Do not conclude an executor is missing from `which`; run the runner.
- Always pass a model. `agy` without `--model` can hang on its default; the runner always passes one.
- **A capability a card needs must exist in the executor's role policy.** A `codex` reviewer runs read-only with no network: it cannot open SSH, serve a local port or write the git index of a linked worktree, while a `codex` implementer is granted network and the git common directory that holds that index. Run `python3 {{ASSETS_PATH}}/delegate.py profiles` and state what the chosen role still blocks; a card whose check needs a remote suite or a local server must not fall back to an executor that cannot run that check.

The host gate inherits the caller's environment, including PATH, and runs in `--cwd` using `bash` without login or startup files (`--noprofile --norc -p -c`, which also ignores `BASH_ENV`, imported functions and shell option overrides). The runner adds or removes no environment variables; the shell manages `PWD`, `OLDPWD`, `SHLVL` and `_` as part of running the command.

## Running on a remote host (`--host`)

Use `--host <name>` on `run` or `pipeline` when the local machine is under load or a long batch would compete with it: the executor CLI then runs through the separate `remote-runner` CLI on that host and the local machine carries no executor load. It does not relieve provider quota — the same accounts and limits apply — and it does not move the host gate.

```bash
python3 {{ASSETS_PATH}}/delegate.py pipeline --id <ID> --host devbox ...   # executor and reviewer run there
python3 {{ASSETS_PATH}}/delegate.py run --id <ID> --host devbox ...        # one step there
python3 {{ASSETS_PATH}}/delegate.py profiles --host devbox                  # who is ready there
python3 {{ASSETS_PATH}}/delegate.py remote-clean --host devbox --id <ID>   # drop the kept checkout
```

The runner refuses a dirty worktree (`failure: "dirty_worktree"`) before sending anything. It ships the exact branch HEAD as a git bundle inside the repository's git metadata, which `remote-runner` already copies, and fetches it into a clean per-task checkout under `~/.atomic-skills/delegate/remote/<project>/<id>` on the host; that needs only git on the host. The composed prompt, diff and attachments travel as files in a per-run directory outside that checkout, never in the remote-runner argv. The executor runs with the same role policy, with the worktree, git common directory and review inputs rewritten to their remote paths. The executor must be an enabled integration on the host and signed in: `doctor`/`auth` missing or signed-out stops the run with `failure: "remote_not_ready"` and the one-line fix, and the operator signs in on the host with `remote-runner auth` (the runner never copies credentials).

When the executor ends, new remote commits are fetched into the local branch as a fast-forward; uncommitted remote changes are committed on the host with the same `<ID>: <task> (committed by the delegate runner)` message and fetched. A non-fast-forward is `failure: "diverged"`: the remote branch is fetched to `refs/delegate/<ID>` and the local branch is left alone. The run record gains `host`, `remote_dir`, `sync.sent`/`sync.received` and the `send_s`, `run_s` and `fetch_s` durations. A remote run takes no local executor slot; the host's capacity is `remote-runner`'s load control, and the runner passes `--wait` through. Exit 74 becomes `failure: "slot_timeout"` with the host, so the pipeline fallback applies. Local timeout, TERM/INT/HUP and the orphan watcher end the remote run through `remote-runner kill <run id>`; leftover-process cleanup on the host is only what that kill guarantees. The per-run directory is removed; the checkout stays for a fix round until `remote-clean`. The host gate still runs locally, by you, after the fetch.

## What an executor can do

The runner applies one access policy by **role** to every executor, as far as its CLI can express it. Implement, fix, mechanical and test runs may write the worktree and the repository's git directory (the main `.git` resolved with `git rev-parse --git-common-dir`, so a commit works in a linked worktree); review runs may not write either through the edit tool. Both roles read the whole repository, that git directory, and the cards and outputs under the runner's home, and use the network. Codex and Antigravity reviewers are given read-only git commands; implementers may commit. OpenCode's shell is unrestricted, so its reviewer can run any command and its record says so in `limits`. Nothing else is writable, and no role may `git push`, change remotes or touch another worktree — that remains a card rule. The runner refuses a git common directory that lacks `HEAD` and `objects`, and when it makes that directory writable it records that git write includes the main repository's config, hooks and other worktrees' refs.

The `run` record carries the result as `access`: `network`, `git_write`, `extra_read` (the directories granted for reading) and `limits` (what that CLI could not be given). `python3 {{ASSETS_PATH}}/delegate.py profiles` prints the effective access and limits per profile and role. Per CLI:

- **Codex implementers** run `--sandbox workspace-write` with `-c sandbox_workspace_write.network_access=true` and `--add-dir <git common dir>`; the flag is needed even in a plain checkout because Codex protects `<workspace>/.git` as read-only. **Codex reviewers** stay `--sandbox read-only`; the network switch only exists for `workspace-write`, and switching would allow writes in the worktree, so their network stays off and the limit is recorded.
- **OpenCode** has no sandbox. The runner starts a private server (`--standalone`) and passes explicit permission rules instead of `--auto` (the V2 `permissions` array of `{action, resource, effect}` rules): OpenCode gives internal paths relative to the worktree, so implementers get `edit *` for the worktree plus the absolute git common directory, while project-parent paths (`../*`) and the read-only cards and output directories are denied for `edit`; `external_directory` allows only the git common directory, cards and outputs, not every directory. Reviewers have the edit tool denied. Its shell runs with the host user's filesystem and network authority, so a reviewer can still write through the shell, `git_write` is recorded as true and the `review_wrote` check still fails a review that changes the tree.
- **Antigravity** runs with `--sandbox` and a per-session `--settings` object: `read_url(*)` for network, `read_file` for the repository, git directory, cards and outputs, `write_file` for the worktree and git directory only for implementers, and `command(git)` for implementers. Reviewers may run only `git diff`, `git log`, `git show`, `git status` and `git rev-parse` (`command(<prefix>)` rules); reviewer writes are denied in settings, but the sandbox keeps the worktree read-write, so the `review_wrote` check remains the guarantee.

`--access strict` on `run` and `pipeline` is tighter than the default: no network, nothing outside the worktree. It is not a bypass, and the runner never adds an approval flag in any mode. Codex keeps its per-role `--sandbox` (workspace-write for implementers, read-only for reviewers) but drops `sandbox_workspace_write.network_access` and `--add-dir <git common dir>`; its record says `network: false`, `git_write: false` and `extra_read: []`. OpenCode keeps `--standalone` and its explicit permission rules, denies `webfetch`, `websearch` and every `external_directory`, and lets implementers edit only the worktree; because its shell has no sandbox, the record keeps that limit and still says `network: true` and `git_write: true`. Antigravity keeps `--sandbox`, drops `read_url(*)`, the git common directory and every outside read except the cards and outputs used as review inputs, and never adds the common directory; its record says `network: false` and `git_write: false`. When an executor cannot work under the default policy, the answer is another executor, not a bypass and not `--access strict`. A review input above 600 KB is refused with a recorded `review_input_too_large`; OpenCode also refuses a prompt at or above 131072 bytes (the Linux per-argument limit) with `input_too_large` (or `review_input_too_large` for a review), while Codex and Antigravity receive the prompt on stdin.

## The loop

1. **Batch table and confirmation.** Before launching anything, show one table and wait for an explicit yes:

   | # | Task | Role | Route | Review route | When |
   |---|---|---|---|---|---|

   Roles: `implement`, `fix`, `mechanical`, `test`. "When" is `now` or `off-peak`. The batch table shows the **route** and the user's yes covers every profile in it; a new batch, or reusing an executor for a new task, needs a new yes. If the user is on a remote client, ask in the message text.

2. **Isolate.** Commit your own work first. One worktree per task, cut from the integration branch, dependencies installed in it (`skills/shared/worktree-isolation.md`). Two executors never share a worktree.

3. **Write the card** — the only code-shaped thing the orchestrator produces. Use `{{ASSETS_PATH}}/card-template.md`; every task card starts with its executor sentence, and every review card starts with the reviewer sentence in `{{ASSETS_PATH}}/review-card-template.md`. State the rule by its **result** ("a visitor never sees X on any route"), not only by a file list; name files with lines, what must not change, how to check, and the delivery (commits, no push). Tell the executor to stay inside the worktree, to write a failing test first, and to commit early. A card that asks for documentation must also say that every statement about behaviour has to be checked against the code before it is written (command, flag, default, file path, exit code); a review card for a diff that touches documentation must ask the reviewer to verify each such statement against the code and to report a contradicted one as `major`. The final check of a card is evidence of the result, not the target: prefer a check that runs behaviour (a test, or a command with its exit code) over a text match, and say that if a check can only pass by renaming or rewording, the executor must stop and report instead. A card must also say that a test which starts a detached process, a server or a busy loop ends it in `afterEach`/`finally`, and that the executor checks `ps` for leftovers of its own tests before finishing. Gates that need Xcode, a simulator or any GUI/host service are never asked of a sandboxed executor: the card says the executor skips them and the orchestrator runs them in the host gate.

4. **Pipeline (executor, host gate, cross-family review)** — the default way to run the executor, commit, gate and review in one call. Create a filled review card at `<review.md>` from `{{ASSETS_PATH}}/review-card-template.md`: replace the task ID and title with this task’s values.

   ```bash
   python3 {{ASSETS_PATH}}/delegate.py pipeline --id <ID> --task "<short title>" --role implement \
     --cwd <worktree> --card <card.md> --route flash,codex,agy \
     --gate "<gate shell command>" \
     --review-card <review.md> \
     --review-route codex-review,agy-review --confirmed
   ```

   The runner attaches the diff and the author's card automatically; `--review-attach <file>` adds context, while standalone `run` accepts `--diff-range <base>...<head>` (or `<base>..<head>`) and repeatable `--attach <file>`. Refer to “the diff below” and “the attached card” in review cards; Antigravity reviews still require `--diff-range`, and the reviewer can also read this worktree and the directories in the policy and run the read-only git commands listed above. The runner saves the composed prompt beside the outputs and refuses an empty diff or input above 600 KB, or above 131072 bytes for OpenCode, which takes the prompt as one argument, without truncation.

   The runner executes the task end-to-end:
   - **Executor step:** Tries profiles in `--route` in order. On `provider_limit`, `slot_timeout` or `input_too_large` it falls back to the next profile; an exhausted route ends the pipeline.
   - **Commit step:** If the executor left changes uncommitted, the runner stages everything and commits with message `<ID>: <task> (committed by the delegate runner)` (`auto_committed: true`). If the executor changed nothing (no commits and clean tree), the pipeline ends with outcome `no_changes`.
   - **Gate step:** Runs `--gate` locally in `<worktree>` via `bash --noprofile --norc -p -c`, capturing output to `<out>/<ID>.gate.log`; this is also true with `--host`, after the fetch. Non-zero ends the pipeline with outcome `gate_failed` without running review.
   - **Review step:** Picks the first profile in `--review-route` whose family differs from the executor family; a review route that names `flash` resolves to `flash-review`, and both are skipped when the executor is Flash. Custom review cards may still use `{{DIFF_RANGE}}`, which the runner replaces with `<base>...HEAD` (from the pre-run commit); retries on `provider_limit`, `slot_timeout`, `empty_output`, or `incomplete_review`. An exhausted review route ends with `no_reviewer`.
   - **Review cards for signal or process-group code:** forbid probes that signal processes — a Flash review run was killed by its own probe.
   - **Summary:** You are woken once, read `<ID>.summary.md` instead of the full outputs, triage the findings, send a fix card (another `pipeline` with `--role fix`), then `record` the verdict.

   To run a single step standalone (debugging or manual retry), use `run`:

   ```bash
   python3 {{ASSETS_PATH}}/delegate.py run --id <ID> --task "<short title>" --role implement \
     --profile flash --cwd <worktree> --card <card.md> --confirmed
   ```

   For a local run, the runner enforces the timeout (default 90 min), kills the executor's process group, then ends every descendant it saw while the executor ran: it polls the process table (`ps -axo pid,ppid,pgid`) while the run lasts and remembers each descendant by pid and kernel start time, so a child that detached into another group or was reparented to pid 1 is still ended (TERM, a short grace, KILL) and a reused pid or a process it never saw is never signalled. It captures output outside the repo and appends a `run` record with what it measured: duration, exit code, timeout, commits, files changed, peak flag, the effective `access`, and `orphans` (`found`, `killed`, and up to five sample commands cut at 80 characters); `status` prints a warning when recent runs left orphans. A `--host` run keeps the local process tracker off the remote pids, records `orphans` as zero locally, and its `limits` states that leftover-process cleanup on the host is only what `remote-runner kill <run id>` guarantees. Each round keeps its own output files: a fresh id or the first attempt writes `<ID>.*`, while a repeated id or a later attempt writes `<ID>.attempt<N>.*`, and the record points at that round's files; the same names apply to `--host` runs. A review run whose executor exits 0 with empty output is recorded as `empty_output` and exits non-zero, and a review card that still contains the literal `{{DIFF_RANGE}}` without `--diff-range` is refused before anything is launched; both hold for `--host` runs too. `--confirmed` asserts step 1 happened; never pass it otherwise. A non-zero exit or a timeout is a failed run: read the stderr file, then retry once only when the routing rules allow it and the failed profile and failure are neither `flash` nor `provider_limit`; otherwise switch profile according to the routing table or surface it. Obtain a new yes for any profile outside the approved route. Executors commit their own work; the pipeline's automatic commit remains the fallback for a `run` record with `"uncommitted": true` (only possible when a CLI's limit denied git write). In that fallback, read the diff, commit it with a message that names the task, and write that in `--deviation` when recording the verdict.

5. **Fix round.** Real findings go back to the **same executor** as a fix card (role `fix`, `--attempt 2`, or another `pipeline` with `--role fix`), unless it is out of quota or it is the `flash` second attempt (then follow the routing table and ask for a new yes only for a profile outside the approved route), then the host gate runs again. Stop at three rounds; after that escalate to an orchestrator review or the user.

6. **Record the verdict**, always, including failures:

   ```bash
   python3 {{ASSETS_PATH}}/delegate.py record --id <ID> --gate-host pass --gate-claim pass \
     --delivered yes --review-by codex-review --review-rounds 1 \
     --findings-major 0 --findings-medium 2 --findings-minor 3 --rework none
   ```

   `--gate-host` is what **you** observed (`pass`, `fail`, `not_run`); `--gate-claim` is what the executor said. Keeping them apart is the point: in the pilot they were one field and 67 of 150 rows could not say who ran the gate. `--rework` is how much you had to do by hand (`none`, `small`, `large`); `--deviation` and `--note` are one short line each.

7. **Hand off.** Push the branch and open the PR. Whether a green PR is merged without asking is the project's rule, not this skill's — follow the project instructions, and ask when there are none.

## Several orchestrators on one machine

The provider quotas are shared across the whole machine; the runner limits concurrent executors to prevent starvation (at most `DELEGATE_MAX_OPENCODE` default 10, `DELEGATE_MAX_CODEX` default 1, `DELEGATE_MAX_AGY` default 2 processes at once across all orchestrators). OpenCode runs only Flash, the slowest model and the one that stretches the quota furthest, so it gets the largest slot count; Codex stays at one.
- Run `python3 {{ASSETS_PATH}}/delegate.py status` before proposing a batch to check running slots and recent quota resets (`try again at <time>`).
- Never raise the `DELEGATE_MAX_*` values without the user's explicit approval.
- `python3 {{ASSETS_PATH}}/delegate.py pause` is the operator's stop for every agent on the machine: active runs finish, and all agents pause before launching new processes until `python3 {{ASSETS_PATH}}/delegate.py resume`.

## The audit log

One append-only JSONL file for every project and agent on the machine: `~/.atomic-skills/delegate/runs.jsonl` (or `$ATOMIC_SKILLS_HOME/delegate/runs.jsonl`). `run` records are written by the runner; `verdict` records by the verdict step; both share the task id. Values are enums and numbers so the log can be compared across executors.

```bash
python3 {{ASSETS_PATH}}/delegate.py report   # per role/executor/model: host-gate rate, review rounds, majors, time
python3 {{ASSETS_PATH}}/delegate.py peak     # peak | off-peak
```

Never edit or delete past lines. A correction is a new `verdict` line for the same id; the report uses the last one. When the user asks to audit or improve this skill, start from `report`, then read the rows behind any number that looks wrong.

## What this skill does not do

- No plan, no phases, no state machine, no dashboard: a card, a run, a gate, a review, a record.
- It does not choose the tasks. Bring a list; for several independent tasks see `atomic-skills:parallel-dispatch` for scope isolation, then delegate each one.
- It does not let an executor push, merge, touch another worktree, or run destructive git commands. Put that in every card.

## Red flags

- "It's a two-line change, I'll just do it." — That is how orchestrator usage creeps back. Card it; `flash` exists for this.
- "The executor says the tests pass." — Record that as `--gate-claim`. Run the gate.
- "The review found nothing." — Possible, but rare. Check that the reviewer actually read the diff range.
- "Flash failed, I'll run it again." — Do not retry `flash`; switch to `codex` (or follow the routing table); ask for a new yes if the fallback is outside the approved route.
- "Flash can review this, it's cheap." — It can, when another family wrote the code. It is the cheapest reviewer and also the slowest (about an hour on a 600-line diff, against minutes for the others), so prefer `codex-review` when the author is not Codex and time matters; and in a review card for code that sends signals or manages process groups, forbid probes that signal processes — a Flash review run was killed by its own probe.
- "The documentation says it, so the code must do it." — Documentation written by an executor has stated flags, defaults and exit codes the code contradicts. Check every behavioural statement in a docs diff against the code; a contradiction is a `major` finding.
- "The final grep is green." — A text check is evidence, not the target. If a check can only pass by renaming a field or rewording a line, stop and report; a reviewer must look for code or tests changed only to satisfy the card's own check.
- "I'll log it later." — The runner already wrote the `run` row; an id without a verdict shows up in the report as "no verdict".
