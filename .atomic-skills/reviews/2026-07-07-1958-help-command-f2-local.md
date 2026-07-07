---
date: 2026-07-07T19:58:17Z
topic: help-command-f2-local
artifact: dbf9b212267e5a95b803b6e3cc721b56b2539ec1..1ed2f9e
skill: review-code
reviewer: gpt-5-codex
mode: local-degraded-inline
final_verdict: approved_with_remediation
counts_final: {blocker: 0, critical: 0, major: 1, minor: 0, nit: 0}
schema_version: "1.0"
---

# Local Review — help-command F2

## Scope

- Ref/scope: `dbf9b212267e5a95b803b6e3cc721b56b2539ec1..HEAD`
- Mode: local fallback inline; subagent isolation degraded by session tool policy.
- Files reviewed: `scripts/compute-help.js`, `skills/shared/project-assets/project-help.md`, `tests/help/render-smoke.test.js`, `tests/help/html-resolve.test.js`.
- Destructive signal: false.

## Findings

| # | Summary | Severity | File:line | Mechanism | Impact | Recommendation | Action |
|---|---------|----------|-----------|-----------|--------|----------------|--------|
| 1 | Directory at `docs/design/project-onboarding/index.html` counted as present HTML | major | `scripts/compute-help.js:230` | `resolveHtmlGuide` used path existence, not regular-file status | `help` could show `GUIA VISUAL` and `help --html` could try to open a directory | Require `statSync(path).isFile()` and add a regression test | Applied in `1ed2f9e fix(T-002): require html guide file` |

## Verification

- `node --test tests/help/html-resolve.test.js` → tests 7, pass 7, fail 0.
- `node --test tests/help/compute-help.test.js tests/help/render-smoke.test.js tests/help/html-resolve.test.js` → tests 37, pass 37, fail 0.

## Self-review against code-quality gates

- G1 read-before-claim: applied — reviewed `scripts/compute-help.js:230-241` before the fix and `scripts/compute-help.js:230-245` after the fix.
- G2 soft-language: applied — fix description and finding text scanned for completion claims without evidence.
- G3 anti-tautology: applied — regression test creates a directory at the contract path and expects `htmlGuideExists(dir) === false`.
- G4 fixture realism: applied — fixture uses the real contract path `docs/design/project-onboarding/index.html`.
- G7 anti-premature-abstraction: applied — reused local `isFile` predicate beside existing `isDir`.
