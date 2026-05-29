# `atomic-skills:save-and-push` — Commit + Memory + Push

> **Iron Law:** `NO PUSH WITHOUT FRESH VERIFICATION.`

**Scan for secrets, group commits, save learnings, push safely**

Ending a session sloppily means a leaked `.env`, one giant unrelated blob commit, and learnings lost to context death. `save-and-push` scans the diff for secrets and sensitive files before staging, groups changes into logical commits (never `git add .`), persists durable learnings to memory, and refuses to push to main/master without confirmation. The next session resumes with clean history and context intact.

## Purpose

End-of-session ritual: extract learnings to persistent memory, stage relevant files, commit with conventional message, push to remote.

## Usage

**When to use:**
- You finished a coherent piece of work
- About to switch context or end the session
- You want learnings persisted before forgetting

**When NOT to use:**
- Work in progress, not yet a coherent commit
- Tests still failing
- You only want to commit (use git directly)

## Reference

**Examples:**
- `/atomic-skills:save-and-push` — Full flow: memory + commits + push

## Metadata

**Dependencies:** `git`

**Related:** `project-status`, `init-memory`

**Tags:** `workflow`, `git`, `memory`, `core`

**Version added:** `1.0.0`
