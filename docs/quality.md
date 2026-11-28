# Code quality rules

These are the rules the quality gate enforces in this repository. The gate is
one script, `scripts/qa.sh`. Every hook and every CI job calls it; nothing else
lists quality tools on its own.

The owner approved the ceilings on 2026-11-27. The first audit is in
`.atomic-skills/reviews/2026-11-27-quality-audit.md`.

## Stacks

| Stack | Language | Code |
|---|---|---|
| `js` | JavaScript | `src/`, `scripts/`, `bin/` (production); `tests/`, `test/` (tests) |
| `py` | Python | `skills/shared/**/*.py` |
| `sh` | Shell | `.husky/`, `skills/shared/auto-update-hook/`, `tests/hooks/` |

`site/dist/`, `docs/plans/` and `test/app-map/fixtures/` are generated or
fixture code and are not measured.

## Rules

Each rule is one metric in `qa/ceilings.tsv`. An item above the ceiling is
debt. Size, typing, error and duplication rules cover production code; the
test rules cover test files.

| Metric | Ceiling | Stacks | Reason |
|---|---|---|---|
| `import-cycles` | 0 | js | A cycle makes load order matter and blocks testing a module alone. |
| `complexity` | 15 per function | js, py | A function with more paths than that is not covered by the tests we write. |
| `function-lines` | 80 | js, py | A function must fit on one screen to be reviewed. |
| `file-lines` | 800 | js, py, sh | A larger file holds more than one job. |
| `params` | 5 per function | js, py | Long positional lists get swapped by callers. |
| `type-errors` | 0 per file | js, py | The checker runs in non-strict mode; what it reports is a real mismatch. |
| `silent-errors` | 0 | js, py | An empty `catch` with no comment, or a broad `except` that drops the error, hides failures in code that changes the user's home directory. |
| `duplication` | 0 duplicated blocks | js, py | A rule copied twice is changed once. |
| `uncovered-pct` | 20 per file | js, py | A production file with less than 80% of its lines run by the tests. |
| `fixed-sleeps` | 0 | js tests | A fixed wait is slow when it passes and flaky when it fails. |
| `unowned-skips` | 0 | js tests | A skipped test with no owner and date in its reason is never looked at again. |
| `suppressions` | 0 | all | A comment that silences a tool hides debt from the ratchet. |
| `vulnerable-deps` | 0 high or critical | js | Known-vulnerable dependencies ship to every install. |
| `secrets` | 0 | all | No credential in the tree. |
| `static-security` | 0 | py, sh | Findings of the security analyzer (medium or high) and of ShellCheck. |

## Debt

The debt that existed when a stack was frozen is listed item by item in
`qa/debt/<stack>.<metric>.tsv`, keyed by `path::symbol`. It only goes down:

- a new item fails the gate;
- an item worse than recorded fails the gate;
- a debt file that grew against the base branch fails the pull request;
- a raised ceiling fails the pull request.

When a change pays an item, it runs `python3 -I qa/ratchet.py lower` and
commits the smaller file. Code that moves keeps its debt with
`ratchet.py move`, on a branch whose name starts with `qa/`.

## When the gate is red

There are three exits, and no other:

1. Fix the code.
2. Change the rule, with the owner, in this file and in `qa/ceilings.tsv`.
3. Add a line to `qa/exceptions.tsv` with the reason. At most 10 per stack.

Raising a ceiling, adding a debt line by hand, adding a suppression comment and
skipping a test are not exits.

## Where the gate runs

| Layer | When | Mode |
|---|---|---|
| 1 | commit | `scripts/qa.sh changed` |
| 2 | push | `scripts/qa.sh fast` |
| 3 | pull request (CI) | `scripts/qa.sh full`, plus `ratchet.py diff` against `main` |

Not wired: the agent-session hook (layer 0) and scheduled slow checks
(layer 4).

## What this regime does not cover

- **Merge refusal.** `main` has no branch protection (free GitHub plan), so a
  red pull request can still be merged. Do not merge a red pull request.
- **Layers and direction.** No measurer; `status` shows it as `no measurer`,
  which is not strong.
- **Strict typing.** The checkers run in non-strict mode.
- **Shell.** Only file size, suppressions, secrets and ShellCheck are measured.
- **Mutation testing, taint analysis and history-wide secret scans.**
- **Analyzer upgrades.** Versions are pinned. An upgrade is its own change, on
  a `qa/` branch: bump, measure, then fix or record what the new version finds.
