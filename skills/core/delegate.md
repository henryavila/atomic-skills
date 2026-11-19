This skill is for the orchestrator. An agent holding a task or review card is the executor or reviewer: do the card’s work yourself, without opening this skill, delegating again or asking for confirmation.

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

## The loop

1. **Batch table and confirmation.** Before launching anything, show one table and wait for an explicit yes:

   | # | Task | Role | Route | Review route | When |
   |---|---|---|---|---|---|

   Roles: `implement`, `fix`, `mechanical`, `test`. "When" is `now` or `off-peak`. The batch table shows the **route** and the user's yes covers every profile in it; a new batch, or reusing an executor for a new task, needs a new yes. If the user is on a remote client, ask in the message text.

2. **Isolate.** Commit your own work first. One worktree per task, cut from the integration branch, dependencies installed in it (`skills/shared/worktree-isolation.md`). Two executors never share a worktree.

3. **Write the card** — the only code-shaped thing the orchestrator produces. Use `{{ASSETS_PATH}}/card-template.md`; every task card starts with its executor sentence, and every review card starts with the reviewer sentence in `{{ASSETS_PATH}}/review-card-template.md`. State the rule by its **result** ("a visitor never sees X on any route"), not only by a file list; name files with lines, what must not change, how to check, a final grep, and the delivery (commits, no push). Tell the executor to stay inside the worktree, to write a failing test first, and to commit early.

4. **Pipeline (executor, host gate, cross-family review)** — the default way to run the executor, commit, gate and review in one call. Create a filled review card at `<review.md>` from `{{ASSETS_PATH}}/review-card-template.md`: replace the task ID, title and `<path to the task card>` with this task’s values and the absolute path of `<card.md>`. Leave `{{DIFF_RANGE}}` for the runner to fill:

   ```bash
   python3 {{ASSETS_PATH}}/delegate.py pipeline --id <ID> --task "<short title>" --role implement \
     --cwd <worktree> --card <card.md> --route flash,codex,agy \
     --gate "<gate shell command>" \
     --review-card <review.md> \
     --review-route codex-review,agy-review --confirmed
   ```

   The runner executes the task end-to-end:
   - **Executor step:** Tries profiles in `--route` in order. On `provider_limit` it falls back to the next profile.
   - **Commit step:** If the executor left changes uncommitted, the runner stages everything and commits with message `<ID>: <task> (committed by the delegate runner)` (`auto_committed: true`). If the executor changed nothing (no commits and clean tree), the pipeline ends with outcome `no_changes`.
   - **Gate step:** Runs `--gate` in `<worktree>` via `bash -lc`, capturing output to `<out>/<ID>.gate.log`. Non-zero ends the pipeline with outcome `gate_failed` without running review.
   - **Review step:** Picks the first profile in `--review-route` whose family differs from the executor family; a review route that names `flash` resolves to `flash-review`, and both are skipped when the executor is Flash. Replaces `{{DIFF_RANGE}}` in the review card with `<base>...HEAD` (from the pre-run commit); retries on `provider_limit`, `empty_output`, or `incomplete_review`.
   - **Review cards for signal or process-group code:** forbid probes that signal processes — a Flash review run was killed by its own probe.
   - **Summary:** You are woken once, read `<ID>.summary.md` instead of the full outputs, triage the findings, send a fix card (another `pipeline` with `--role fix`), then `record` the verdict.

   To run a single step standalone (debugging or manual retry), use `run`:

   ```bash
   python3 {{ASSETS_PATH}}/delegate.py run --id <ID> --task "<short title>" --role implement \
     --profile flash --cwd <worktree> --card <card.md> --confirmed
   ```

   The runner enforces the timeout (default 90 min), kills the whole process group, captures output outside the repo, and appends a `run` record with what it measured: duration, exit code, timeout, commits, files changed, peak flag. `--confirmed` asserts step 1 happened; never pass it otherwise. A non-zero exit or a timeout is a failed run: read the stderr file, then retry once only when the routing rules allow it and the failed profile and failure are neither `flash` nor `provider_limit`; otherwise switch profile according to the routing table or surface it. Obtain a new yes for any profile outside the approved route. A `run` record with `"uncommitted": true` means the executor changed files but could not commit (Codex's sandbox denies writes to git metadata in a linked worktree); read the diff, commit it yourself with a message that names the task, and write that in `--deviation` when recording the verdict.

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

The provider quotas are shared across the whole machine; the runner limits concurrent executors to prevent starvation (at most `DELEGATE_MAX_OPENCODE` default 2, `DELEGATE_MAX_CODEX` default 1, `DELEGATE_MAX_AGY` default 2 processes at once across all orchestrators).
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
- "I'll log it later." — The runner already wrote the `run` row; an id without a verdict shows up in the report as "no verdict".
