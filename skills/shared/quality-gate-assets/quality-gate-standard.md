# Quality gate standard

Reference for the `quality-gate` skill. It names objectives, not tools: each
stack meets an objective with whatever its ecosystem offers.

## Strong

A dimension is strong in a stack when four conditions hold together:

1. **Declared.** The rule is in `docs/quality.md`, with its reason.
2. **Enforced.** A command of the gate script refuses the violation, and that
   command runs where a merge can be refused.
3. **Followed.** The debt files of its metrics are empty. What remains is in
   `qa/exceptions.tsv`, with a reason, inside the limit.
4. **Confirmed from outside.** Auditors with no context of the work, given the
   brief of the first audit, grade it strong.

Grades below strong: `adequate` (mostly followed, not enforced), `weak`
(violated often), `absent` (no rule and no practice).

## Dimensions

| Dimension | Objective | What a gate can measure |
|---|---|---|
| Modularity | Modules have one job and no cycles | import cycles, imports of private names, catch-all modules |
| Size and cohesion | Files and functions stay small enough to hold in mind | lines per file, complexity and length per function, parameters |
| Layers and direction | Dependencies point one way; each layer does only its work | architecture tests over the real import graph |
| Typing | The types say what the data is, at the borders too | checker in strict mode with zero errors, escape hatches counted |
| Error handling | One error model; nothing fails in silence | broad catches, swallowed errors, error codes checked against a catalogue |
| Duplication | Each rule exists once | duplicated blocks, the same rule copied across stacks |
| Testability | The code that decides is covered by tests that run in CI | coverage of lines and branches per area, suites in CI |
| Test quality | Tests fail when the behaviour breaks | tests with no assertion, fixed sleeps, mocks of the unit under test, mutation score |
| Security | No secret, no known-vulnerable dependency, no injectable path | secret scan, dependency audit, taint or static security analysis |

Seams between stacks get their own column: a versioned contract checked in CI,
types of each consumer checked against it, and one copy of each shared rule.

A dimension with no measurer in a stack shows as `no measurer` in `status`. It
is not strong, and it is not hidden.

## Layers

Each check goes in the cheapest layer that can run it. All layers call the
same gate script.

| Layer | When | Gate mode | Rule |
|---|---|---|---|
| 0 | agent session (stop hook, tool hooks) | `changed` | seconds; tells the agent what to fix before it claims done |
| 1 | commit | `changed` | staged files only; never rewrites them |
| 2 | push | `fast` | under 60 seconds, so many agents can push from one machine |
| 3 | pull request | `full`, plus `ratchet.py diff` | the only layer that can refuse a merge; required check |
| 4 | schedule | slow checks | mutation, taint, dynamic scans; opens an issue, does not block |

Write down, per layer, what does not run there. A layer the repository cannot
have (no CI, no hooks on the host) is recorded as missing, and the dimensions
that depend on it are not strong.

## Files

Everything lives in `qa/` at the repository root. Columns are separated by one
tab. Every file except the debt files starts with a header line; lines that
start with `#` are ignored.

| File | Columns | Notes |
|---|---|---|
| `stacks.tsv` | stack, language, roots, generated, tests, group | roots are comma separated paths from the repository root; `group` joins stacks frozen together |
| `ceilings.tsv` | metric, ceiling, applies_to | `applies_to` is a comma separated list of languages |
| `dimensions.tsv` | dimension, metric | one line per metric that counts for the dimension |
| `exceptions.tsv` | stack, metric, key, limit, reason | the item may reach `limit`; at most 10 per stack |
| `moves.tsv` | metric, from, to, value | written by `move`; do not edit by hand |
| `debt/<stack>.<metric>.tsv` | key, value | no header, sorted by key; written by `freeze`, `lower` and `move` |

Stack names carry no `.` and no `/`.

## Measurers

A measurer prints one line per item **above its ceiling** and nothing else on
standard output:

```text
<stack> TAB <metric> TAB <key> TAB <value>
```

- **Key:** `<path from the repository root>::<symbol>`, or `::*` for a whole
  file. Never a line number: an edit above the item must not rename it.
- **Value:** a number where higher is worse. For a rule that is only present or
  absent, count the occurrences in the symbol or file.
- **Exit:** 0 when it measured, even if it found items; 3 when its tool is not
  installed, which the gate script turns into exit 2.
- **Scope:** generated code and vendored code are excluded by the measurer.
- **Order of preference:** the native tool's machine-readable report, then a
  native baseline file read item by item, then a small script of your own.

## Ratchet commands

Run as `python3 -I qa/ratchet.py [--root qa] <command>`. Python 3 standard
library only. Exit 0 passes, 1 is a ratchet failure, 2 is a usage or table
error. Failures are lines that start with `FAIL`.

| Command | Use |
|---|---|
| `check --measures F... [--stack S...] [--metric M...]` | fails on a new item, an item worse than recorded, an exceeded or unexplained exception, or too many exceptions |
| `lower --measures F... [--stack S...] [--metric M...]` | rewrites the debt files with what was paid; never adds and never raises |
| `freeze --stack S... --measures F...` | writes the first debt files of a stack; never rewrites one |
| `diff --base DIR --branch NAME` | compares `qa/` with the base revision: fails on a new debt line, a raised value, a raised ceiling |
| `move --metric M --from KEY --to KEY=VALUE...` | carries the debt of moved code; the destinations may not add up to more than the origin |
| `status` | one line per stack and dimension: `strong`, `debt N`, `not frozen`, `no measurer`; exit 0 only when every line is strong |

`--measures -` reads standard input.

**Scope matters.** `check` and `lower` treat every stack and metric in scope as
fully measured: a recorded item absent from the measures counts as paid. When
the measures cover part of the repository, pass `--stack` and `--metric`, or
`lower` deletes debt nobody measured. The `changed` mode of the gate runs
`check` only, never `lower`.

**What `diff` accepts.** The first debt files of a stack, on a branch named
`qa/freeze-<stack>` or `qa/freeze-<group>`. A new debt file for a metric that
starts to apply to the language of a stack already frozen. Lines recorded in
`moves.tsv`, on a branch whose name starts with `qa/`. Anything removed or
lowered. Both prefixes can be changed with `--freeze-prefix` and
`--move-prefix`.

## No silencing

- No suppression comment (`noqa`, `eslint-disable`, `@phpstan-ignore`,
  `swiftlint:disable` and the like) outside a listed border. One measurer
  counts them, with ceiling 0.
- No skipped test without an owner and a date in the skip reason.
- A red gate has three exits: fix the code; change the rule, with the user and
  in `docs/quality.md`; or add a line to `exceptions.tsv` with the reason.
- Raising a ceiling fails `diff`. It takes a decision of the user and a change
  the reviewer can see.
- Upgrading an analyzer is its own change: bump the pinned version, measure,
  fix or record what the new version finds, on a `qa/` branch.

## Profiles

| Profile | When | Freeze | Path to strong |
|---|---|---|---|
| Greenfield | new code, little or no debt | empty debt files from day one | stays strong; the gate blocks from the first commit |
| Legacy, planned stop | debt is large and the owner can pause feature work | everything frozen, per stack or group | waves that pay debt by dimension, then `reaudit` |
| Legacy, pay as you go | feature work cannot stop | everything frozen | each change pays what it touches; `lower` on every merge; `reaudit` when `status` is green |

## Outside this version

- Locks that keep two agents out of the same area during a paying wave.
- Requiring a green CI before merge at the hosting service. Recommend it; it
  is a setting of the host, changed by the owner.
- Automated runners that pay debt unattended.
