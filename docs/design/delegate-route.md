# Delegate: availability, `route` and pending reviews

Status: implemented (2026-11-20) on branch `feat/delegate-route`. The text below is the
design as built; where the first proposal differed, the built version is what is written.

## What the log says

Source: `~/.atomic-skills/delegate/runs.jsonl`, 2026-11-18 to 2026-11-20 (338 runs, 86 pipelines).

| Fact | Number |
|---|---|
| Runs ending in `provider_limit` | 45 (codex 23, agy 21, opencode 1) |
| Of those, on a review run | 41 |
| Of those, repeating a limit of the same executor seen less than 5 h before | 37 |
| Time lost in those runs | median 2 s (codex) and 6 s (agy); 45 min in total, most of it in two runs |
| Pipelines ending `no_reviewer` | 19 of 86 (22%) |
| Cause of every one of those 19 | every reviewer in the route hit `provider_limit` |

Two conclusions:

1. A limit hit on the executor step is already cheap. `pipeline` falls back along `--route`
   on `provider_limit`, and a refused run ends in seconds. Choosing a smarter executor
   saves little.
2. The real loss is the review. Flash writes most of the code, so its reviewer must be
   Codex or Antigravity, and both run out together. One pipeline in five finishes its
   executor and gate and then has nobody to review it. The orchestrator finds out at the
   end and has to run the review by hand later.

So the design targets reviewer capacity, not model choice.

## Goals

- Before a batch, the orchestrator knows which reviewers are usable and, if none is,
  when the first one returns.
- A pipeline whose review cannot run now ends in a state that the runner itself can
  finish later, with one command.
- No new dependency, no model call, no network. Everything is read from the log and the
  slot directory.

Out of scope: an LLM or decision-model judge, memory in cards, a queue daemon.

## 1. Availability

One function, `availability()`, used by everything below. It returns, per profile:

- `cooling_until`: a UTC time, or none. A limit belongs to the pair (executor, model),
  because Antigravity limits each model separately. It is set when the newest
  `provider_limit` of that pair has no later run that reached the provider. The time is
  the reset the provider printed: `try again at 5:51 PM` (Codex, local clock, next day
  when already past), `Resets in 107h24m20s` (Antigravity), `resets 5:10pm
  (America/Sao_Paulo)` (Claude Code). When no reset can be read, it is the limit time
  plus `DELEGATE_COOLDOWN_<EXECUTOR>` (default 60 minutes). `reset_source` says which.
- `slots_free`: `get_max_slots` minus the active slots.
- `found`: the CLI was found (`find_optional`).

`status` keeps its own limit lines; it only gained the count of pending reviews.

## 2. `delegate.py route`

```
delegate.py route --role <implement|fix|mechanical|test> [--open-design] [--json]
```

Prints, and with `--json` returns:

- the executor route, usable profiles first, cooling ones last with their return time;
- the review route for each possible executor family, in the same order;
- one `cooling:` line per limit in force;
- a warning line when no reviewer outside a family is usable now, with the earliest
  return time: `flash: no reviewer usable now; first back: codex-review at <time>; a
  pipeline now ends review_pending; claude-review can review with the operator's yes`.

Order among usable profiles is fixed and comes from the skill's current rules (Flash
first for implement, fix, mechanical and test; the reviewer order per family as written
today). The command reorders by availability only. It does not rank by past gate rate:
three days of data is too little to rank on, and `report` already shows it to the operator.

The orchestrator pastes the output into the batch table. The operator's yes stays as it is.
The fixed review routes move from the skill text into the script, so the text and the
runner cannot disagree.

## 3. Pipeline uses availability

- Both routes are reordered before the first attempt: usable profiles first, cooling
  profiles last. Nothing is removed, so a wrong cooldown costs at most the few seconds a
  refused run costs today. The pipeline record gains `reordered: [<profiles moved back>]`.
- When the review route is exhausted and every attempt was `provider_limit` or
  `slot_timeout`, the outcome is `review_pending` instead of `no_reviewer`. The runner
  writes `~/.atomic-skills/delegate/pending/<project>/<id>.json` with the worktree, base
  and gated commit, review card copy, attachments, review route, executor family and the
  earliest return time. An executor that ends in `error` after committing, with a clean
  tree, still goes to the gate and the review (`executor_error_after_commit`).
  `no_reviewer` remains for the other causes (a review that wrote,
  an error, no reviewer outside the family).

## 4. `delegate.py review-pending`

```
delegate.py review-pending [--id <ID>] [--confirmed]
```

- Without `--id`: lists pending reviews with their return time. `status` shows the count.
- With `--id --confirmed`: checks that the worktree still has the gated commit as HEAD and
  a clean tree (otherwise it stops and says so, and the orchestrator decides), then runs
  the review step exactly as `pipeline` would, writes the same summary and pipeline
  record (`outcome: reviewed`, `resumed_from: review_pending`), and removes the pending
  file. If the reviewers are still out, the file stays and the return time is updated.

The operator's original yes covered the review route, so finishing a pending review needs
no new confirmation from the operator; `--confirmed` is the orchestrator stating that.

## 5. Claude as the fallback reviewer

Operator decision (2026-11-20): when Codex and Antigravity are both out of quota, the
review goes to Claude, and the operator confirms it each time.

- New profile `claude-review`: executor `claude` (the Claude Code CLI in print mode),
  family `anthropic`, review role only. Model `claude-sonnet-5-5` by default,
  `DELEGATE_CLAUDE_MODEL` to change it. There is no `claude` implement profile.
- The family rule is unchanged and now has a fourth family. `claude-review` is refused
  when the code under review was written by a Claude model, which includes work the
  orchestrator implemented itself. The pipeline knows the executor family; a standalone
  `run --role review` takes `--author-family` for that check.
- It is never tried on its own. The runner refuses `claude-review` unless
  `--allow-claude-review` is given, and the skill says that flag is passed only after the
  operator said yes to Claude for that task or batch, with the model named. Two ways to
  get there:
  1. Up front: `route` reports that no other reviewer is usable; the batch table shows
     `claude-review` at the end of the review route; the operator's yes covers it.
  2. Afterwards: the pipeline ended `review_pending`; the orchestrator asks the operator
     and runs `review-pending --id <ID> --reviewer claude-review --allow-claude-review`.
- With the flag, `claude-review` is still the last reviewer tried: a usable Codex or
  Antigravity reviewer goes first. The run and pipeline records carry
  `fallback_reviewer: true`, and the run record `author_family`.
- Access is narrower than the other reviewers: `claude --safe-mode -p` with
  `--tools Read,Grep,Glob --permission-mode dontAsk --no-session-persistence
  --disable-slash-commands`. No shell, no git command, no network, so the runner puts the
  diff in the prompt (`requires_review_diff`, as for Antigravity). It runs only on this
  machine, never on a remote host. `--allow-dangerously-skip-permissions` joined
  `FORBIDDEN_ARGV_FLAGS`. The `review_wrote` check stays the guarantee.
- A Claude session limit ends with exit code 0 and the message on stdout, so
  `classify_failure` has a Claude case that reads stdout.

## Decision-model hook

Not in this version. The failures a judge would classify are rare in the log
(`incomplete_review` 1, `empty_output` 2, `review_wrote` 2 in 338 runs). `classify_failure`
stays the single place where a failure is named, so a judge can be added there later if
the numbers change.

## Cards

All four touch `skills/shared/delegate-assets/delegate.py`, so they run one after the other.

1. **Availability and `route`.** `availability()`, the reset parser written against real
   `.err` files, `route` with `--json`, `status` reading from it, review routes in the
   script. Tests: `tests/delegate-runner-route.test.js`.
2. **Pipeline reordering.** Reorder both routes, `reordered` in the record. Tests in
   `tests/delegate-runner-pipeline.test.js`.
3. **Pending review.** `review_pending` outcome, pending file, `review-pending`, count in
   `status`, skill text and `docs/skills/delegate.md`. Tests:
   `tests/delegate-runner-pending.test.js`.

4. **Claude fallback reviewer.** `claude-review` profile, `--allow-claude-review`,
   `--author-family`, the exit-0 limit case, `--reviewer` on `review-pending`, skill text.
   Tests: `tests/delegate-runner-claude.test.js`.

How to know it worked: after a week, pipelines ending without a review that the runner
cannot finish (`no_reviewer`) drop from 22% to the cases that are real errors, and
`review_pending` entries are closed by `review-pending` without a hand-written `run`.
