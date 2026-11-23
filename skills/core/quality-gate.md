Install and enforce a code-quality regime in a repository: one gate script, a
per-item debt ratchet that only goes down, and a definition of "strong" that
needs confirmation from outside the session that did the work. This skill sets
the objectives and the layers. You choose the tools that fit each stack.

If {{ARG_VAR}} was provided, treat it as the mode (`audit` | `install` |
`reaudit`). If omitted: with no `qa/stacks.tsv` in the repository start with
**audit**; otherwise ask which mode with {{ASK_USER_QUESTION_TOOL}}.

Read `skills/shared/quality-gate-assets/quality-gate-standard.md` before any
mode. It holds the nine dimensions, the layers, the measurer contract and the
ratchet commands. This body holds only the order of work and the gates.

## Iron Law

A DIMENSION IS STRONG ONLY WHEN IT IS DECLARED, ENFORCED, FOLLOWED AND CONFIRMED FROM OUTSIDE.

A configuration file that no command runs is not enforcement. A command that
runs and cannot fail the push or the pull request is not enforcement. A number
that no gate checks is not strong. Your own opinion of your own work is not
confirmation.

<HARD-GATE>
About to grade a dimension because a config file exists, without naming the command that runs it and the place that calls that command? STOP.
About to make the gate pass by raising a ceiling, adding a debt line, adding a suppression comment or adding an exception nobody approved? STOP. A red gate has three exits: fix the code, fix the rule with the user, or record an exception with a reason inside the limit.
About to write your own ratchet, or edit the copied `qa/ratchet.py`? STOP. Copy the shipped engine unchanged.
About to freeze a stack before the user saw its counts per metric and said yes? STOP.
About to write a hook, a CI workflow or an agent instruction file without showing the diff and receiving a yes? STOP.
About to call the regime closed from `status` alone, or from a re-audit run by an agent that saw the work? STOP.
</HARD-GATE>

## Mode `audit` (read-only)

Changes nothing in the product tree. It writes one report.

1. **Stacks.** List each stack: language, source roots, generated code, test
   roots. List the seams between stacks (an API contract, a shared schema, a
   rule copied in two languages) as a column of their own.
2. **Tool inventory.** For every quality tool found, record three facts: its
   configuration, the command that runs it, and every place that calls that
   command (agent hook, commit, push, pull request, schedule). Classify it:
   - `blocks`: a call site fails when the tool fails;
   - `warns`: it runs and its result is ignored or advisory;
   - `idle`: configured, and nothing calls it.
3. **Matrix.** Grade every stack in every dimension of the standard as
   `absent`, `weak`, `adequate` or `strong`, each with evidence: a `file:line`
   or the output of a command you ran with {{BASH_TOOL}}. Give the four
   conditions one column each (declared, enforced, followed, confirmed). When
   independent subagents exist, send one per stack with {{INVESTIGATOR_TOOL}}
   and the same brief; do not tell them what you expect to find.
4. **Profile.** Name the one that fits (standard, "Profiles") and say why.
5. **Report.** Write `.atomic-skills/reviews/<YYYY-MM-DD>-quality-audit.md`:
   the brief exactly as the auditors received it, the inventory, the matrix,
   the profile, and the ten worst items per stack. `reaudit` reuses that brief
   word for word.

Stop here and show the matrix. `install` is a separate decision.

## Mode `install`

Needs an audit report. Without one, run `audit` first.

### 1. Agree on the regime

Show one table and wait for an explicit yes: stacks and groups, the metric and
ceiling behind each dimension, the profile, the layers to wire, and what stays
out. A ceiling is the user's decision. Propose values from the audit; do not
pick them alone.

### 2. Declare

Write `docs/quality.md`: each rule with its reason, the three exits of a red
gate, and what the regime does not cover. Add a short pointer to the agent
instruction file the repository already uses. Rules that live only in a plan,
a memory or a chat do not count as declared.

### 3. Copy the engine and write the tables

```sh
mkdir -p qa && cmp -s {{ASSETS_PATH}}/ratchet.py qa/ratchet.py || diff -u qa/ratchet.py {{ASSETS_PATH}}/ratchet.py
```

Show the difference, then copy after the yes. The engine lives in the
repository because CI does not have Atomic Skills installed. Write
`qa/stacks.tsv`, `qa/ceilings.tsv`, `qa/dimensions.tsv` and a
`qa/exceptions.tsv` holding only its header, in the formats of the standard.

### 4. Measurers

One measurer per metric and stack. It prints one line for each item above the
ceiling: `stack`, `metric`, `key`, `value`, separated by tabs. Use the native
tool of the stack first and convert its report; write your own only where no
tool measures the rule. A tool that already keeps a baseline file is read as
items, not as a total. Pin the exact version of every analyzer: a new version
changes the debt with no change in the code.

### 5. One gate script

Write `scripts/qa.sh` (or the name the repository already uses) as the only
entry. Every hook and every CI job calls it; none lists tools on its own.

| Mode | Runs | Budget |
|---|---|---|
| `fast` | static checks and the ratchet | under 60 seconds |
| `changed` | `fast`, limited to the files that differ from the base | seconds |
| `full` | `fast` plus the test suites | what the suites take |
| `strong` | `full` plus `ratchet.py status` | same as `full` |

Exit 0 passes, 1 means a rule failed, 2 means a person is needed (a tool is
missing, a table is malformed). Every failure message says the next step.

### 6. Test the gate

Add tests for the gate itself: plant one violation per metric in a temporary
copy and assert a non-zero exit; assert a clean tree exits 0. A gate that was
never seen failing is not known to work.

### 7. Freeze

For each stack, on a branch named `qa/freeze-<stack or group>`: run its
measurers, show the count per metric, wait for the yes, then

```sh
python3 -I qa/ratchet.py freeze --stack <stack> --measures <files>
```

`freeze` never rewrites an existing debt file. Under the greenfield profile
the files are frozen empty. A stack not yet frozen is reported and does not
fail; say so in the report so nobody reads it as green.

### 8. Wire the layers

Wire each layer of the standard the user accepted, cheapest first, each one
calling the gate script. For each file (agent hook settings, git hook, CI
workflow): show the diff, wait for the yes, write. A hook never commits,
pushes, rewrites files or opens a browser. In the pull request layer add the
comparison against the base, which is what stops a debt file from growing:

```sh
base="$(mktemp -d)" && git archive "origin/<base branch>" qa | tar -x -C "$base"
python3 -I qa/ratchet.py diff --base "$base/qa" --branch "<head branch>"
```

Skip that comparison only in the pull request that creates `qa/`.

### 9. Prove it

Run each of these and paste the output in the report: a planted new violation
fails `check`; a violation made worse fails `check`; a paid item followed by
`lower` shrinks its debt file; a hand-added debt line fails `diff`.

## Paying the debt

Not a mode of this skill. Use `delegate`, `parallel-dispatch` or `fix`, in
waves that do not change behaviour. Each paying change runs `lower` with the
same measures and scope as the gate and commits the smaller files. Code that
moves keeps its debt through `move`, on a branch whose name starts with `qa/`.

## Mode `reaudit`

1. `python3 -I qa/ratchet.py status` must exit 0. If it does not, report the
   cells that are not strong and stop: there is nothing to confirm yet.
2. Run the gate in `strong` mode from a clean checkout of the default branch.
3. Send the saved brief, unchanged, to auditors that have no context of the
   work: fresh subagents, or another model when one is available. Give them the
   repository and the brief, and nothing about what was fixed.
4. Compare the new matrix with the first one. Any cell below `strong`, or any
   cell that got worse, keeps the regime open; list it with its evidence.
5. Append the result to the audit report with the date and who audited.

## Refuse

- Grading from the existence of a config file
- A second entry point beside the gate script
- A baseline kept as one total, or a ceiling written inside a test
- Suppression comments, skipped tests and raised ceilings as a way to green
- An exception with no reason, or beyond the limit per stack
- Hooks that change the repository
- Closing on your own judgement

## Red Flags

- "The linter config is there, so that dimension is enforced"
- "I'll add this one item to the debt file, it was already bad"
- "The gate is slow, the hook can call the tools directly"
- "The ratchet needs one small change for this repository"
- "`status` is green, the re-audit is a formality"

If you thought any of the above: STOP and go back to the gate you were about
to skip.

## Closing

Report:
- Mode run, and the report path
- Matrix: cells strong / with debt / not frozen / with no measurer
- Each layer: wired, declined, or not available in this repository
- Frozen stacks with their item counts per metric; exceptions with reasons
- What was not verified, and what the user still has to decide
