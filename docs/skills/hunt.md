# `atomic-skills:hunt` — Adversarial Tests

> **Iron Law:** `NO HUNT WITHOUT BOUNDED SCOPE.`

**Write adversarial tests to break code, not confirm it**

Your tests confirm the happy path. `hunt` writes adversarial tests to *break* your code — edge cases, boundary conditions, error paths you didn't think of. Bounded to one class or function per run.

## Purpose

Write adversarial tests to break code and find hidden bugs. Bounded to one class or function per run.

## Usage

**When to use:**
- Code lacks tests
- You suspect untested edge cases
- Pre-merge quality check

**When NOT to use:**
- Scope larger than 1 class or function
- Existing test suite is already comprehensive
- You want to add features (use prompt instead)

## Reference

**Arguments:**

| Name | Kind | Required | Description |
|------|------|----------|-------------|
| `target` | positional | required | File, directory, or function/class to hunt. Directory mode caps at 30 files. |

**Examples:**
- `/atomic-skills:hunt src/matcher.php` — Hunt bugs in a single file
- `/atomic-skills:hunt src/auth/` — Triage mode for directory (max 30 files)

## Metadata

**Dependencies:** `git`

**Related:** `fix`, `review-code`

**Tags:** `testing`, `quality`, `pre-implementation`

**Version added:** `1.0.0`
