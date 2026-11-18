# Task <ID>: <the result, in one sentence>

Base: `<branch>` at `<commit>`. You are already in the right worktree and branch; do not switch branches.

Work **only** inside this worktree. Do not touch another worktree or the main checkout, do not `push`, and do not run `git stash`, `reset --hard`, `checkout --` or `clean`.

Read first: the project's instruction file (CLAUDE.md / AGENTS.md) and its quality rules.

## The decision

<What must be true when you finish, stated by its result. Why it matters, in two lines.>

## What changes

1. `<path>:<line>` — <what to change, quoting the text to find if lines may have moved>.

## What does not change

- <files, behaviours and contracts that must stay as they are>

## Tests

Write the failing test first, with the suite that already exists. No new dependency.

## How to check

- `<the project's gate command>` exits 0.
- Final grep: `<pattern>` finds <N> matches before and <M> after.

## Delivery

Small commits as you go, in the repository's commit style, no co-author line. End with a report: commits (short hash and subject), what you checked and its output, and anything you did **not** do.
