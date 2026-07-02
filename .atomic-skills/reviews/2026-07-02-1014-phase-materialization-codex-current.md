---
date: 2026-07-02T10:14:00-03:00
topic: phase-materialization-current
artifact: origin/develop...HEAD (branch scope)
skill: review-code
reviewer: gpt-5-codex
codex_version: codex-cli 0.142.5
final_verdict: needs_changes->fixed
counts_final: {blocker: 0, critical: 0, major: 1, minor: 0, nit: 0}
counts_blind: {blocker: 0, critical: 0, major: 2, minor: 0, nit: 0}
framing_delta: {dropped: 1, maintained: 1, emerged: 0}
schema_version: "1.0"
---

# Cross-Model Review - phase-materialization-current

## Capture Metadata

- Scope: branch (`origin/develop...HEAD`)
- Reviewed commit: `59ecaca7578969ec7649568deafe15017e41e03b`
- Merge base: `0b95bef37d70d30176a17bc17ae613cba4e44afd`
- Patch id: `8ff622764a76eeea934bc4fbf93d26feb579abe1`
- Captured diff: `/tmp/review-code-phase-materialization-current-20260702T130000Z/captured.diff` (`556701` bytes)
- Modified files: `62`
- Invocation note: both passes consumed the frozen captured diff by path; no fresh scope was taken inside the subagent.

## Pass 1

```yaml
verdict: needs_changes
counts: {blocker: 0, critical: 0, major: 2, minor: 0, nit: 0}
```

Pass 1 reported:

- F-001 [major]: descriptor-only sidecars did not retain raw phase source.
- F-002 [major]: `project-create-plan.md` still described one emitted `.md` initiative per phase and directory-level validation.

## Pass 2

```yaml
verdict: needs_changes
counts: {blocker: 0, critical: 0, major: 1, minor: 0, nit: 0}
```

Pass 2 dropped F-001 after checking the documented current contract: parsed `.source.json` sidecars are intentional for capture version `0.1`.

Pass 2 maintained F-002:

> `project-create-plan.md` still tells agents that `new plan` emits one `.md` initiative per phase and should index each phase initiative. That contradicts the current lazy contract where only F0 is an initiative markdown and F1..N are descriptor entries plus `.source.json` sidecars.

## Remediation

Fixed after review:

- Updated `skills/shared/project-assets/project-create-plan.md` Stage 6 to list `plan.md`, only the F0 `.md` initiative, and F1+ `.source.json` sidecars.
- Changed Stage 6 validation to validate the explicit F0 `.md` initiative rather than the `phases/` directory.
- Updated `adopt <file.md>` to collect/pass F0 `businessIntent`, run the businessIntent detector, validate explicit F0 output, and index only the materialized F0 initiative.
- Added regression coverage in `tests/project.test.js` for default Stage 6 and `adopt`.

## Verification

- `rtk npm test -- tests/project.test.js`
- Result: 1524 tests, 1516 pass, 0 fail, 8 skipped.
