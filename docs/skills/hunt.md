# `atomic-skills:hunt` — Adversarial Tests

> **Iron Law:** `NO HUNT WITHOUT BOUNDED SCOPE.`

**Adversarial tests from the spec, not the code — depth over breadth**

Asking an agent to "add tests" produces happy-path tests that mirror the code — they confirm bugs instead of catching them. `hunt` writes adversarial tests whose expected values come from the spec, not the implementation (a HARD-GATE rejects any assertion derived from the code), and goes deep on one class or function per run instead of skimming. It maps every execution path, then tries to break the boundaries and error cases the code never anticipated.

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
