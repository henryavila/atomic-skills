# `atomic-skills:release` — Chooser + GH Release + npm stage

> **Iron Law:** `NO BUMP WITHOUT THE CHOOSER.`

**Chooser plans bump; ship GH Release; npm stage+2FA only**

Agents invent semver (feature as patch) and run `npm publish` from the laptop. `release` refuses to guess: `scripts/release` classifies the bump from conventional commits + Keep a Changelog Unreleased, applies package.json/CHANGELOG, tags, and opens the GitHub Release. When npm is in scope, the adopted Action stages via OIDC; a human approves with 2FA on the npm UI. No chooser output, no bump.

## Purpose

Plan the next semver with a deterministic chooser, apply version + CHANGELOG, ship a GitHub Release, and — when npm is in scope with a stage Action — leave staging + 2FA approve to CI and the human.

## Usage

**When to use:**
- Ready to cut a version / GitHub Release
- Need the next semver without inventing patch/minor/major
- Public npm package should stage via Trusted Publisher after Release

**When NOT to use:**
- Still implementing; no release candidate yet
- Only need to commit/push a work branch (use save-and-push)
- Want to publish npm directly from the agent laptop

## Reference

**Arguments:**

| Name | Kind | Required | Description |
|------|------|----------|-------------|
| `mode` | positional | optional | Optional subcommand hint: plan (default), apply, ship, or adopt. |

**Examples:**
- `/atomic-skills:release` — Plan next version via scripts/release chooser
- `/atomic-skills:release apply` — Apply package.json + CHANGELOG from chooser plan
- `/atomic-skills:release ship` — Tag + GitHub Release (stage Action handles npm)
- `/atomic-skills:release adopt` — Check/diff/consent adopt of stage or GH-only workflow

## Metadata

**Dependencies:** `git`, `node`, `gh`

**Related:** `save-and-push`, `project`

**Tags:** `workflow`, `git`, `release`, `npm`, `core`

**Version added:** `2.5.0`
