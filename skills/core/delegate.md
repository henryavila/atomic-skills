Keep Claude for the two things only it should do here — **create** the task card and **validate** the result — and hand every action (implementing, fixing, mechanical edits, scripted checks) to an external executor: DeepSeek through OpenCode, Codex (`codex`), or Antigravity (`agy`). Every run is measured and appended to one audit log, so the skill can be judged and improved from data.

If {{ARG_VAR}} was provided, treat it as the task or list of tasks to delegate (ids, a plan file, or a description). If not, ask the user what to delegate.

## Iron Law

CLAUDE CREATES AND VALIDATES; EXECUTORS ACT; NOTHING RUNS BEFORE THE USER CONFIRMS THE MODEL.

Do not implement the task yourself "because it is small", and do not spawn a Claude subagent to implement it. The model choice decides cost and quota, so the user approves it per batch. An executor's report is a claim, never evidence: only the gate you run on the host and the review decide.

<HARD-GATE>
About to edit product code yourself, or to launch a Claude agent to implement or fix? STOP — write a card and delegate.
About to run an executor without having shown the batch table and received an explicit yes in this conversation? STOP.
About to record `gate_host: pass` from the executor's own words? STOP — run the gate yourself or record `not_run`.
</HARD-GATE>

## Executors and model classes

| Profile | CLI and model | Use for |
|---|---|---|
| `deepseek-pro` | OpenCode, `opencode-go/deepseek-v4-pro` | implement and fix: the default executor |
| `deepseek-light` | OpenCode, `opencode-go/deepseek-v4.1-flash` | mechanical work: renames, sweeps, scripted edits, docs, test scaffolds |
| `agy` | Antigravity, `gemini-4-hydrogen-high` | implement or fix when DeepSeek is unavailable or in its peak window; second opinion on a failed task |
| `agy-review` | Antigravity, `gemini-4-hydrogen-xhigh`, plan mode; the runner fails the run if the review changed the tree | review of DeepSeek's or Codex's work |
| `codex` | Codex, `gpt-6-astra` (override: `DELEGATE_CODEX_MODEL`) | implement or fix when DeepSeek is out of quota or in its peak window |
| `codex-review` | Codex, `gpt-6-astra`, read-only sandbox | read-only sandbox; review of DeepSeek or `agy` work |

- **Prefer DeepSeek**, and prefer running it **outside its peak window** (peak is 22:00–07:00, UTC−3, so off-peak is 07:01–21:59; override with `DELEGATE_PEAK_START`, `DELEGATE_PEAK_END`, `DELEGATE_PEAK_TZ_OFFSET`). Inside the window the runner refuses DeepSeek unless the user allowed it for the batch: queue the task for off-peak, route it to `codex` or `agy`, or ask.
- **The reviewer is never the family that wrote the code.** Families are `deepseek`, `gemini`, `openai`; the reviewer profile must be of another family. Prefer `codex-review` or `agy-review` because the runner fails reviews that change the tree.
- **Check availability and switch on quota limits.** Before building the batch table, run `python3 {{ASSETS_PATH}}/delegate.py profiles`; and when a `run` record says `"failure": "provider_limit"`, do not retry that executor — rebuild the table with the next available one (order: `deepseek-pro`, `codex`, `agy`) and ask for a new yes.
- **Claude reviews only on escalation:** the cross-family review and the executor disagree after two fix rounds, the change touches auth, money, data deletion or a migration, or the user asks. Say so in the batch table.
- The runner finds the CLIs itself: PATH, the usual bin folders, and for OpenCode the `opencode-cli` inside `OpenCode.app` (the desktop app does not add it to PATH). Do not conclude an executor is missing from `which`; run the runner.
- Always pass a model. `agy` without `--model` can hang on its default; the runner always passes one.

## The loop

1. **Batch table and confirmation.** Before launching anything, show one table and wait for an explicit yes:

   | # | Task | Role | Model | Executor | Reviewer | When |
   |---|---|---|---|---|---|---|

   Roles: `implement`, `fix`, `mechanical`, `test`, `review`. "When" is `now` or `off-peak`. The yes covers that batch only; a new batch, or reusing an executor for a new task, needs a new yes. If the user is on a remote client, ask in the message text.

2. **Isolate.** Commit your own work first. One worktree per task, cut from the integration branch, dependencies installed in it (`skills/shared/worktree-isolation.md`). Two executors never share a worktree.

3. **Write the card** — the only code-shaped thing Claude produces. Use `{{ASSETS_PATH}}/card-template.md`. State the rule by its **result** ("a visitor never sees X on any route"), not only by a file list; name files with lines, what must not change, how to check, a final grep, and the delivery (commits, no push). Tell the executor to stay inside the worktree, to write a failing test first, and to commit early.

4. **Run the executor** in the background through the runner, never by hand:

   ```bash
   python3 {{ASSETS_PATH}}/delegate.py run --id <ID> --task "<short title>" --role implement \
     --profile deepseek-pro --cwd <worktree> --card <card.md> --confirmed
   ```

   The runner enforces the timeout (default 90 min), kills the whole process group, captures output outside the repo, and appends a `run` record with what it measured: duration, exit code, timeout, commits, files changed, peak flag. `--confirmed` asserts step 1 happened; never pass it otherwise. A non-zero exit or a timeout is a failed run: read the stderr file, then retry once, switch profile, or surface it. A `run` record with `"uncommitted": true` means the executor changed files but could not commit (Codex's sandbox denies writes to git metadata in a linked worktree); read the diff, commit it yourself with a message that names the task, and write that in `--deviation` when recording the verdict.

5. **Host gate.** In the worktree, run the project's real gate yourself (its QA script, test suite, type check) and read the diff from the base commit — `git diff <base>...HEAD`. Use `atomic-skills:verify-claim` semantics: exit code and a non-zero test count, never the executor's narrative. An empty or out-of-scope diff is a fail before any test runs.

6. **Cross-family review.** Launch the reviewer profile on a review card (`{{ASSETS_PATH}}/review-card-template.md`) that points at the diff range. Findings come back with id, severity (`major`, `medium`, `minor`) and `file:line`. Expect findings: in the pilot the first review of executor code never came back empty (0 of 76), and 26 of 76 had a major one. Triage them yourself — you decide which are real. A review run with `"failure": "empty_output"` is not a review; fix the cause or switch reviewer.

7. **Fix round.** Real findings go back to the **same executor** as a fix card (role `fix`, `--attempt 2`), then the host gate runs again. Stop at three rounds; after that escalate to a Claude review or the user.

8. **Record the verdict**, always, including failures:

   ```bash
   python3 {{ASSETS_PATH}}/delegate.py record --id <ID> --gate-host pass --gate-claim pass \
     --delivered yes --review-by agy-review --review-rounds 1 \
     --findings-major 0 --findings-medium 2 --findings-minor 3 --rework none
   ```

   `--gate-host` is what **you** observed (`pass`, `fail`, `not_run`); `--gate-claim` is what the executor said. Keeping them apart is the point: in the pilot they were one field and 67 of 150 rows could not say who ran the gate. `--rework` is how much you had to do by hand (`none`, `small`, `large`); `--deviation` and `--note` are one short line each.

9. **Hand off.** Push the branch and open the PR. Whether a green PR is merged without asking is the project's rule, not this skill's — follow the project instructions, and ask when there are none.

## The audit log

One append-only JSONL file for every project and agent on the machine: `~/.atomic-skills/delegate/runs.jsonl` (or `$ATOMIC_SKILLS_HOME/delegate/runs.jsonl`). `run` records are written by the runner; `verdict` records by step 8; both share the task id. Values are enums and numbers so the log can be compared across executors.

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

- "It's a two-line change, I'll just do it." — That is how Claude usage creeps back. Card it; `deepseek-light` exists for this.
- "The executor says the tests pass." — Record that as `--gate-claim`. Run the gate.
- "The review found nothing." — Possible, but rare. Check that the reviewer actually read the diff range.
- "Peak window, but it's urgent." — Ask the user, or use `agy`. Do not pass `--allow-peak` on your own.
- "I'll log it later." — The runner already wrote the `run` row; an id without a `verdict` shows up in the report as "no verdict".
