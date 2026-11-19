You are the executor of this card: do the work yourself, do not open the `delegate` skill, do not delegate, and do not ask for confirmation.

# Task <ID>: <the result, in one sentence>

Base: `<branch>` at `<commit>`. You are already in the right worktree and branch; do not switch branches.

Work **only** inside this worktree. Commit your work as you go; you have network access. Never `push`, never change remotes, never touch another worktree or the main checkout, and do not run `git stash`, `reset --hard`, `checkout --` or `clean`.

Read first: the project's instruction file (CLAUDE.md / AGENTS.md) and its quality rules.

If this card asks for documentation, check every statement about behaviour (command, flag, default, file path, exit code) against the code before you write it. Do not document what you have not verified.

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
- `<a test or command that exercises the behaviour>`, with its exit code.
- Final check: `<a behavioural check, or a text match only when no behavioural check exists>`. This check is evidence of the result, not the target: if it can only pass by renaming a field, rewording a line or otherwise fitting the code to the check, stop and report instead.

## Delivery

Small commits as you go, in the repository's commit style, no co-author line. End with a report: commits (short hash and subject), what you checked and its output, and anything you did **not** do.
