# Conventional commits — shared release asset

Commit-message contract shared by `save-and-push` (session close / push) and
the future `release` skill (semver chooser / CHANGELOG). Agents MUST use these
prefixes so release classification stays deterministic.

## Prefixes (type)

| Prefix | Meaning | Typical use |
|--------|---------|-------------|
| `feat:` | New user-visible capability or behavior | Feature work, API additions |
| `fix:` | Bug fix without new capability | Correctness repairs |
| `perf:` | Performance improvement (same behavior) | Faster path, less work |
| `docs:` | Documentation only | README, skill docs, comments-as-docs |
| `refactor:` | Internal change, no behavior change | Restructure without feat/fix |
| `test:` | Tests only | Add/adjust coverage |
| `chore:` | Tooling, deps, housekeeping | Build, CI, lockfiles |
| `ci:` | CI configuration | Workflows, matrix |

Use the form `type: short description` (optional scope: `type(scope): …`).

## Breaking changes

Mark a breaking change with **either**:

- `BREAKING CHANGE:` footer in the commit body, or
- `!` after the type/scope: `feat!: …` / `fix!: …`

Breaking commits are never silent. Callers that classify bumps must treat them
as breaking evidence (see mapping below).

## Semver / release mapping (chooser input)

When a future `release` chooser classifies commits since the last release:

| Evidence | Bump kind |
|----------|-----------|
| Any `feat:` / Added / Changed (Keep a Changelog) | **minor** |
| Only `fix:` / Fixed (no feat/perf/breaking) | **patch** |
| `perf:` alone (no feat/breaking) | **patch** (behavior-preserving speedup) unless product policy elevates |
| Breaking (`!` or `BREAKING CHANGE:`) on **0.x** | **minor** — never auto-bump to `1.0.0` |
| Breaking on **≥1.0.0** | **major** |
| No classifiable commits | **none** — refuse inventing a bump |

`save-and-push` does not bump versions; it only writes conventional messages so
this mapping stays honest for later release runs.

## Red flags

- Inventing `feat:` for a pure fix (inflates minor).
- Using `fix:` for a new capability (hides minor).
- Omitting breaking markers when the public contract changes.
- Non-conventional free-form subjects when the skill asked for conventional prefixes.
