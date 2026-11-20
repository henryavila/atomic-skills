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
- **Check availability and switch on quota limits.** Before building the batch table, run `python3 {{ASSETS_PATH}}/delegate.py route --role <role>` (add `--open-design` for the third row of the table above; `--json` for a machine-readable answer). It prints the route and the review route for each executor in it, with the profiles that can run now first, one `cooling:` line per provider limit still in force with the time it ends, and a `warning:` line when the work of an executor would have no usable reviewer. A limit is read from the log: it belongs to the executor and model of the run that hit it, ends at the reset time the CLI printed (`try again at 5:51 PM` for Codex, `Resets in 107h24m20s` for Antigravity) or after 60 minutes when the message has none (`DELEGATE_COOLDOWN_<EXECUTOR>` changes that), and ends early when a later run of the same executor and model reached the provider. `python3 {{ASSETS_PATH}}/delegate.py profiles` shows the access each profile gets; when a `run` record says `"failure": "provider_limit"`, do not retry that executor. Switch according to the routing table. A pipeline automatically tries the next profile in its approved route; ask for a new yes only for a profile outside the approved route. For standalone `run`, show and confirm the fallback if it was not already approved.
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
python3 {{ASSETS_PATH}}/delegate.py remote-clean --host devbox --id <ID>   # drop the checkout and kept copies
```

The runner refuses a dirty worktree (`failure: "dirty_worktree"`) before sending anything. It ships the exact branch HEAD as a git bundle in a dedicated throwaway staging repository inside the worktree that holds only the bundle, prompt, diff, attachments and scripts; that staging repository — never the worktree — is what `remote-runner sync` copies, so ignored files such as `.env*` never leave the machine. The bundle is fetched into a per-task checkout under `~/.atomic-skills/delegate/remote/<project>/<id>-<hash>` on the host, where `<hash>` is a short hash of the raw id so ids that sanitize alike stay apart; that needs only git on the host. The composed prompt, diff and attachments travel as files in a per-run directory outside that checkout, never in the remote-runner argv. The executor runs with the same role policy, with the worktree, git common directory and review inputs rewritten to their remote paths. The executor must be an enabled integration on the host and signed in: `doctor`/`auth` missing or signed-out stops the run with `failure: "remote_not_ready"` and the one-line fix, and the operator signs in on the host with `remote-runner auth <integration> --host <host> --login` (the runner never copies credentials). The host's `remote-runner` configuration must keep git metadata in its sync (the default); with `syncGit: false` the shipped bundle never arrives and every run ends as `remote_error`. Antigravity's integration id is `antigravity` (binary `agy`), and the runner maps the executor name to it for every check and suggested command.

When the executor ends, new remote commits are fetched into the local task branch as a fast-forward only while that branch is still checked out; uncommitted remote changes are committed on the host with the same `<ID>: <task> (committed by the delegate runner)` message and fetched. A failed host auto-commit is `failure: "remote_error"` with git's exit code and last line. A non-fast-forward, a worktree switched to another branch, or a fast-forward refused because local edits overlap the result is `failure: "diverged"`: the remote branch is fetched to `refs/delegate/<ID>`, the local branch is left alone, and `remote_error` says which case it was. The run record gains `host`, `remote_dir`, `sync.sent`/`sync.received` and the `send_s`, `run_s` and `fetch_s` durations; after a failure once the executor ran it also gains `remote_work_kept` with the directory, branch and sent commit of the checkout this run worked in, `previous` (directory and HEAD) when an earlier checkout was moved aside for it, plus the local ref for a diverged result. An existing checkout is reused when it is clean and on the task branch and its commit is the one being sent or an ancestor of it (it is then moved forward in place); any other checkout is moved aside as `kept-<UTC timestamp>` rather than deleted. A result is accepted only when it carries this run's own token, so a leftover result of an earlier run of the same id and commit is `failure: "remote_error"`, never a success. A remote run takes no local executor slot; the host's capacity is `remote-runner`'s load control. Queue time is not executor time: `--wait` bounds the wait for capacity (`failure: "slot_timeout"` on expiry, and the local runner stops waiting shortly after `--wait`), and the timeout starts when the run reports that it is active. A timeout, TERM/INT/HUP and the orphan watcher stop the run through `remote-runner kill <run id>`; the id is `REMOTE_RUNNER_RUN_ID` when the host's `remote-runner` exports it, otherwise the run record whose recorded pid is an ancestor of the driver script, never the first new id, and the record says `remote_kill: ok|failed|no_id`, with a limit line when the stop was not confirmed. Leftover-process cleanup on the host is only what that kill guarantees, and a stop signal skips the pull and merge. The per-run directory and the shipped stage are removed on every path; the checkout is reused next time or, when it held work that never reached the local branch, kept beside it until `remote-clean` removes it with the other kept copies. The host gate still runs locally, by you, after the fetch.

## What an executor can do

The runner applies one access policy by **role** to every executor, as far as its CLI can express it. Implement, fix, mechanical and test runs may write the worktree and the repository's git directory (the main `.git` resolved with `git rev-parse --git-common-dir`, so a commit works in a linked worktree); review runs may not write either through the edit tool. Both roles read the whole repository, that git directory, and the cards and outputs under the runner's home, and use the network. Codex and Antigravity reviewers are given read-only git commands; implementers may commit. OpenCode's shell is unrestricted, so its reviewer can run any command and its record says so in `limits`. Nothing else is writable, and no role may `git push`, change remotes or touch another worktree — that remains a card rule. The runner refuses a git common directory that lacks `HEAD` and `objects`, and when it makes that directory writable it records that git write includes the main repository's config, hooks and other worktrees' refs.

The `run` record carries the result as `access`: `network`, `git_write`, `extra_read` (the directories granted for reading) and `limits` (what that CLI could not be given). `python3 {{ASSETS_PATH}}/delegate.py profiles` prints the effective access and limits per profile and role. Per CLI:

- **Codex implementers** run `--sandbox workspace-write` with `-c sandbox_workspace_write.network_access=true` and `--add-dir <git common dir>`; the flag is needed even in a plain checkout because Codex protects `<workspace>/.git` as read-only. **Codex reviewers** stay `--sandbox read-only`; the network switch only exists for `workspace-write`, and switching would allow writes in the worktree, so their network stays off and the limit is recorded.
- **OpenCode** has no sandbox. The runner starts a private server (`--standalone`) and passes explicit permission rules instead of `--auto` (the V2 `permissions` array of `{action, resource, effect}` rules): OpenCode gives internal paths relative to the worktree, so implementers get `edit *` for the worktree plus the absolute git common directory, while project-parent paths (`../*`) and the read-only cards and output directories are denied for `edit`; `external_directory` allows only the git common directory, cards and outputs, not every directory. Reviewers have the edit tool denied. Its shell runs with the host user's filesystem and network authority, so a reviewer can still write through the shell, `git_write` is recorded as true and the `review_wrote` check still fails a review that changes the tree. Web search is denied for every role: under an allow rule OpenCode's Web Search asks for input a headless run cannot give and the run exits 1 with its work already done; `webfetch` and the shell keep network access.
- **Antigravity** runs with `--sandbox` and a per-session `--settings` object: `read_url(*)` for network, `read_file` for the repository, git directory, cards and outputs, `write_file` for the worktree and git directory only for implementers, and `command(git)` for implementers. Reviewers may run only `git diff`, `git log`, `git show`, `git status` and `git rev-parse` (`command(<prefix>)` rules); reviewer writes are denied in settings, but the sandbox keeps the worktree read-write, so the `review_wrote` check remains the guarantee. The terminal sandbox lets git read `~/.gitconfig` but not a file that config includes (`[include]` or `[includeIf]`); when the global config has one, a local run gives git a copy with the includes already resolved (`GIT_CONFIG_GLOBAL`, a file inside the worktree's git directory, removed when the run ends) and says so under `limits`. In print mode a command that needs approval is denied and the whole answer is lost: `empty_output` with `a tool required the "command" permission` in the `.err` file means the model asked for a command outside its rules or tried to leave the sandbox after a command failed there. The Antigravity log of that run (`~/.gemini/antigravity-cli/log/`, by start time) says which.

`--access strict` on `run` and `pipeline` is tighter than the default: no network, nothing outside the worktree. It is not a bypass, and the runner never adds an approval flag in any mode. Codex keeps its per-role `--sandbox` (workspace-write for implementers, read-only for reviewers) but drops `sandbox_workspace_write.network_access` and `--add-dir <git common dir>`; its record says `network: false`, `git_write: false` and `extra_read: []`. OpenCode keeps `--standalone` and its explicit permission rules, denies `webfetch`, `websearch` and every `external_directory`, and lets implementers edit only the worktree; because its shell has no sandbox, the record keeps that limit and still says `network: true` and `git_write: true`. Antigravity keeps `--sandbox`, drops `read_url(*)`, the git common directory and every outside read except the cards and outputs used as review inputs, and never adds the common directory; its record says `network: false` and `git_write: false`. When an executor cannot work under the default policy, the answer is another executor, not a bypass and not `--access strict`. A review input above 600 KB is refused with a recorded `review_input_too_large`; OpenCode also refuses a prompt at or above 131072 bytes (the Linux per-argument limit) with `input_too_large` (or `review_input_too_large` for a review), while Codex and Antigravity receive the prompt on stdin.

## The loop

1. **Batch table and confirmation.** Before launching anything, show one table and wait for an explicit yes:

   | # | Task | Role | Route | Review route | When |
   |---|---|---|---|---|---|

   Roles: `implement`, `fix`, `mechanical`, `test`. "When" is `now` or `off-peak`. The batch table shows the **route** and the user's yes covers every profile in it; a new batch, or reusing an executor for a new task, needs a new yes. If the user is on a remote client, ask in the message text.

2. **Isolate.** Commit your own work first. One worktree per task, cut from the integration branch, dependencies installed in it (`skills/shared/worktree-isolation.md`). Two executors never share a worktree.

3. **Write the card** — the only code-shaped thing the orchestrator produces. Use `{{ASSETS_PATH}}/card-template.md`; every task card starts with its executor sentence, and every review card starts with the reviewer sentence in `{{ASSETS_PATH}}/review-card-template.md`. State the rule by its **result** ("a visitor never sees X on any route"), not only by a file list; name files with lines, what must not change, how to check, and the delivery (commits, no push). Tell the executor to stay inside the worktree, to write a failing test first, and to commit early. A card that asks for documentation must also say that every statement about behaviour has to be checked against the code before it is written (command, flag, default, file path, exit code); a review card for a diff that touches documentation must ask the reviewer to verify each such statement against the code and to report a contradicted one as `major`. The final check of a card is evidence of the result, not the target: prefer a check that runs behaviour (a test, or a command with its exit code) over a text match, and say that if a check can only pass by renaming or rewording, the executor must stop and report instead. A card must also say that a test which starts a detached process, a server or a busy loop ends it in `afterEach`/`finally`, and that the executor checks `ps` for leftovers of its own tests before finishing. Gates that need Xcode, a simulator or any GUI/host service are never asked of a sandboxed executor: the card says the executor skips them and the orchestrator runs them in the host gate.

   Keep cards small and cheap to run:
   - **One subject per card.** A card has one result and at most five numbered requirements. An unrelated "also in this task" item becomes its own card. Two cards that touch the same file run one after the other, or in parallel only when you accept writing a merge card afterwards.
   - **Tests during the work.** The card names the command that runs only the tests of the area it touches, and the executor uses that while working; it runs the project's full suite once, at the end. The host gate stays the proof.
   - **Gate like CI.** When the project's CI runs on another system than the host (Linux CI, macOS host), the host gate includes the same suite in an environment equivalent to CI, a container or a remote host, before any push. The card template has a line for that command.

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
   - **Order:** Before the first attempt the runner moves the profiles of both routes that are under a provider limit, or whose CLI is missing, to the end of their route. Nothing is removed. When that changes the order, the summary and the pipeline record (`reordered`) name the profiles tried last.
   - **Executor step:** Tries profiles in `--route` in order. On `provider_limit`, `slot_timeout` or `input_too_large` it falls back to the next profile; an exhausted route ends the pipeline. An executor that exits with `error` after leaving new commits and a clean tree does not end the pipeline: the gate and the review run, and the summary and the pipeline record (`executor_error_after_commit: true`) say so. With no new commit, or a dirty tree, the outcome is `executor_failed`.
   - **Commit step:** If the executor left changes uncommitted, the runner stages everything and commits with message `<ID>: <task> (committed by the delegate runner)` (`auto_committed: true`). If the executor changed nothing (no commits and clean tree), the pipeline ends with outcome `no_changes`.
   - **Gate step:** Runs `--gate` locally in `<worktree>` via `bash --noprofile --norc -p -c`, capturing output to `<out>/<ID>.gate.log`; this is also true with `--host`, after the fetch. Non-zero ends the pipeline with outcome `gate_failed` without running review.
   - **Review step:** Picks the first profile in `--review-route` whose family differs from the executor family; a review route that names `flash` resolves to `flash-review`, and both are skipped when the executor is Flash. Custom review cards may still use `{{DIFF_RANGE}}`, which the runner replaces with `<base>...HEAD` (from the pre-run commit); retries on `provider_limit`, `slot_timeout`, `empty_output`, or `incomplete_review`. A review route in which every attempt ended in `provider_limit` or `slot_timeout` ends with `review_pending`: the work passed the gate and no reviewer could read it. Any other exhausted review route ends with `no_reviewer`.
   - **Pending review:** `review_pending` writes `~/.atomic-skills/delegate/pending/<project>/<ID>.json` (worktree, base and gated commit, review card, attachments, review route) and the summary says who returns first. `python3 {{ASSETS_PATH}}/delegate.py review-pending` lists what is pending and `status` counts it. Finish one with `python3 {{ASSETS_PATH}}/delegate.py review-pending --id <ID> --confirmed` (`--project` when the id is pending in two projects): it runs the same review step over the same range, prints the summary, appends a pipeline record with `resumed_from: "review_pending"` and removes the file. The user's yes for the pipeline already covered that review route, so this needs no new yes. If the reviewers are still out, the file stays and the exit code is 1. It refuses, launching nothing, when the worktree's HEAD is no longer the gated commit or the tree is dirty: run the gate again, review with `run --role review --diff-range`, and delete the pending file. Do not start a fix round or record a verdict for a task whose review is pending.
   - **Review cards for signal or process-group code:** forbid probes that signal processes — a Flash review run was killed by its own probe.
   - **Summary:** You are woken once, read `<ID>.summary.md` instead of the full outputs, triage the findings, send a fix card (another `pipeline` with `--role fix`), then `record` the verdict.

   To run a single step standalone (debugging or manual retry), use `run`:

   ```bash
   python3 {{ASSETS_PATH}}/delegate.py run --id <ID> --task "<short title>" --role implement \
     --profile flash --cwd <worktree> --card <card.md> --confirmed
   ```

   **Time limits.** A local run has two limits. The idle limit (`--idle-timeout`, default 20 minutes) stops an executor that shows no progress for that long and records `"failure": "stalled"` with `idle_s`; progress is new bytes in the captured stdout or stderr, a new commit on the branch, or a change in the working tree (the `git status` entries, and the size and modification time of each listed path), checked every 10 seconds or less. The cap (`--timeout`, default 240 minutes) stops the run however busy it is and records `"failure": "timeout"`. Every time option (`--timeout`, `--idle-timeout`, `--wait`, and `--review-timeout` of `pipeline`) takes seconds, or a number with a unit: `300`, `300s`, `90m`, `2h`. A `--timeout` or `--review-timeout` below 60 seconds is refused unless `--allow-short-timeout` is given, because a number without a unit is seconds, not minutes. `--idle-timeout 0` turns the idle limit off: use it for an executor that prints nothing and changes no file for long stretches. `pipeline` takes the same options and applies the idle limit to its executor and review runs, not to the gate. `status` shows, for each active run, its age and the minutes since its last progress (`| 42m | idle 3m`). A `--host` run has the cap only: the idle limit, the checkpoint and the idle column do not apply to it.

   **A stopped run keeps its work.** When a local run of a role other than `review` is stopped (idle limit, cap, a stop signal to the runner, or the runner losing its parent), the runner waits for the executor's processes to end and then, if the working tree is dirty, commits everything as `<ID>: work in progress (checkpoint by the delegate runner)`. It also writes `<ID>.resume.md` beside the outputs: why the run stopped, the commits made in the run, `git status` before the checkpoint, and the last 60 non-empty lines of the executor's output. The record gains `"checkpoint": {"commit": <sha or null>, "resume": <path>}`; `commit` is null when the tree was clean or the commit was refused (a failing hook, for example), and the note says which. To continue, run the same id with `--resume`:

   ```bash
   python3 {{ASSETS_PATH}}/delegate.py run --id <ID> --task "<short title>" --role implement \
     --profile flash --cwd <worktree> --card <card.md> --resume --confirmed
   ```

   The prompt is the card followed by a section that tells the executor it is resuming, to read the commits and continue instead of redoing, and the resume note. The record carries `resumed_from` (the completion time of the stopped run), `resume_note`, and an `attempt` one above the stopped run's. The profile may differ from the one that was stopped. `--resume` is refused when the last recorded run of that id in the project left no checkpoint. After `stalled`: read the resume note, resume once; if it stalls again, switch profile according to the routing table. After `timeout`: resume, or split the card.

   The runner kills the executor's process group, then ends every descendant it saw while the executor ran. On Linux it makes itself a child subreaper for the run (through `prctl(PR_SET_CHILD_SUBREAPER)`, falling back silently when that call fails), so an orphan of the executor is reparented to the runner and found by its parent pid; it reaps those children after ending them. It polls the process table every 0.5 s for the first 10 s and then every 3 s, reading `/proc` on Linux and `ps` (`ps -axo pid,ppid,pgid,state`) on macOS, and remembers each descendant by pid and kernel start time plus every session and process group it saw the executor create. A child that detached into another group or was reparented is therefore still ended (TERM, a short grace, KILL), while a reused pid or a process it never saw is never signalled. With `"method": "poll"` (macOS) a daemon that double-forks between two polls can still be missed. It captures output outside the repo and appends a `run` record with what it measured: duration, exit code, timeout, commits, files changed, peak flag, the effective `access`, and `orphans` (`found`, `killed`, up to five sample commands cut at 80 characters, `tracked`, `polls`, and `method` of `subreaper+poll` or `poll`); `status` warns when any of the last 10 runs left orphans. A runner that is itself killed outright (SIGKILL, a crash) can do none of this: its executor works on alone. `status` marks that run `runner gone` and says to stop it with `kill <ID>`; when its slot is cleared (by `kill`, or after the executor ends on its own) the log gets a record with `"failure": "runner_lost"` and no result, so check the worktree for what it left. A `--host` run keeps the local process tracker off the remote pids, records `orphans` as zero locally, and its `limits` states that leftover-process cleanup on the host is only what `remote-runner kill <run id>` guarantees. Each round keeps its own output files: a fresh id or the first attempt writes `<ID>.*`, while a repeated id or a later attempt writes `<ID>.attempt<N>.*`, and the record points at that round's files; the same names apply to `--host` runs. A review run whose executor exits 0 with empty output is recorded as `empty_output` and exits non-zero, and a review card that still contains the literal `{{DIFF_RANGE}}` without `--diff-range` is refused before anything is launched; both hold for `--host` runs too. `--confirmed` asserts step 1 happened; never pass it otherwise. A non-zero exit, a timeout or a stall is a failed run: read the stderr file (and the resume note when there is one), then retry once only when the routing rules allow it and the failed profile and failure are neither `flash` nor `provider_limit`; otherwise switch profile according to the routing table or surface it. Obtain a new yes for any profile outside the approved route. Executors commit their own work; the pipeline's automatic commit remains the fallback for a `run` record with `"uncommitted": true` (only possible when a CLI's limit denied git write). In that fallback, read the diff, commit it with a message that names the task, and write that in `--deviation` when recording the verdict.

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
