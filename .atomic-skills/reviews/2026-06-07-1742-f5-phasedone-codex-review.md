---
date: 2026-06-07T17:42:28Z
topic: f5-phasedone-codex-review
artifact: de9f9e9..HEAD (scoped to executable JS + JSON schemas, 29 files / 129KB)
skill: review-code
reviewer: gpt-5-codex
codex_version: codex-cli 0.128.0
final_verdict: needs_changes
counts_final: {blocker: 0, critical: 0, major: 4, minor: 0, nit: 0}
counts_blind: {blocker: 0, critical: 0, major: 4, minor: 0, nit: 0}
framing_delta: {dropped: 0, maintained: 4, emerged: 0}
pass2_status: BLOCKED — codex usage limit (retry after 2026-07-07)
schema_version: "1.0"
---

# Cross-Model Review — f5-phasedone-codex-review

**Context:** review gate at `phase-done F5` (project-orchestrator-redesign).
Range `de9f9e9..HEAD` is 3.3MB / 208 files; scoped to the executable surface
(src/ scripts/ bin/ assets/aideck-consumer/handlers/ + JSON schemas = 29 files /
129KB) because the raw diff is dominated by vendored-runtime removal + state
files (non-code). Vendor/ removal, `.atomic-skills/` state, and docs/skills prose
were declared out-of-scope.

## Pass 1 (blind)

---
verdict: needs_changes
counts: {blocker: 0, critical: 0, major: 4, minor: 0, nit: 0}
reviewer: gpt-5-codex
pass: blind
schema_version: "1.0"
---

### F-001 [major] correctness — scripts/detect-completion.js:310-318
**Claim:** `detect-completion --plan <slug>` scans every phase initiative, but
`classifyEntry()` treats a commit subject containing `T-001` as evidence for
every open `T-001` in every phase (task IDs are phase-local).
**Impact:** A commit `finish T-001` for phase F1 can make unrelated open `T-001`
tasks in F2/F3 appear done → wrong reconcile prompts.
**Recommendation:** For widened scans, require commit-subject matches to include
phase/initiative context, or disable id-only commit matching unless task IDs are
proven globally unique; path-based evidence can stay global.
**Confidence:** high

### F-002 [major] install/runtime — src/install.js:108-119
**Claim:** Normal installs do not stage `scripts/detect-completion.js` (or its
sibling detectors) into `~/.atomic-skills/scripts`, even though hooks resolve
those scripts from repo / global npm / that runtime dir.
**Impact:** In a project that installed via `npx` (non-global) the consuming repo
has no `scripts/`, global npm may not exist, and `~/.atomic-skills/scripts` is
never created → completion-drift detection silently never runs in the hooks.
**Recommendation:** Stage the runtime detector scripts under
`~/.atomic-skills/scripts`, or change hook/skill resolution to a path install
actually writes.
**Confidence:** high

### F-003 [major] rollback — src/uninstall.js:120-123
**Claim:** Shared runtime artifacts are removed by user-scope uninstall without
checking whether project-scope installs still exist.
**Impact:** With both a user install and project install(s), user-scope
`uninstall --yes` deletes `~/.atomic-skills/{bin,dashboard,aideck-consumer,
src/provision-consumer.js}`, breaking remaining project installs until reinstall.
**Recommendation:** Track runtime ownership across scopes and remove shared
artifacts only when no manifests remain, or have project installs stage their own
runtime.
**Confidence:** high

### F-004 [major] tenant isolation — src/provision-consumer.js:48-54
**Claim:** Distinct valid project IDs sharing the same first 32 sanitized chars
produce identical `mcpNamespace` values.
**Impact:** Two consumers register the same MCP tool prefix
(`aideck_<ns>_<tool>`), so one project's aiDeck tools can collide with/shadow the
other's in the shared registry.
**Recommendation:** Preserve uniqueness with a short hash suffix when truncating;
add a collision test for long project IDs.
**Confidence:** high

## Pass 2 (informed) — BLOCKED

The Pass 2 cross-model reconciliation could NOT run: the codex account hit its
usage limit ("You've hit your usage limit ... try again at Jul 7th, 2026"). One
corrective retry hit the same limit. No Pass 2 codex output exists — it was NOT
fabricated.

### Operator verification (substitutes for codex reconciliation, this session)

Each Pass 1 finding was independently verified against the real code by the
operator (Claude). All 4 are REAL; none are blocker/critical.

- **F-001 — REAL, severity refines to minor in practice.** Confirmed: `--plan`
  widens to all phase initiatives (resolveTargets:311-319) and `idInSubject`
  matches phase-local IDs. BUT the default scope (hooks, no-args summary, status
  views) resolves to exactly ONE active initiative (resolveTargets:334-350) — no
  cross-phase bleed there. The detector is pure-read (no write ops in
  detect-completion.js) and only emits a reconcile *prompt*; `reconcile` requires
  per-candidate human disposition (never auto-closes). Real bug only on the
  opt-in `--plan` path, bounded by a human gate.
- **F-002 — REAL, confirmed.** hooks/session-start.sh:130-132 + stop.sh:264-266
  resolve `detect-completion.js` from repo / global-npm / `~/.atomic-skills/
  scripts`; `installRuntimeArtifacts` (install.js:70-118) stages bin/, dashboard/,
  aideck-consumer/, src/provision-consumer.js — NOT scripts/. End-user `npx`
  installs get a no-op detector in the hooks.
- **F-003 — REAL, confirmed.** uninstall.js:123 removes shared runtime on
  user-scope uninstall with no cross-scope manifest check. The install-parity
  round-trip test runs per-scope in isolation, so it does not catch this
  coexistence case.
- **F-004 — REAL, low probability.** sanitizeMcpNamespace slice(0,32) without a
  disambiguating suffix; collision requires two project IDs sharing a 32-char
  sanitized prefix (repo basenames — rare but possible).

## Phase-gate disposition

NO blocker/critical findings → the `phase-done F5` review gate is satisfied
(only blocker/critical MUST-fix before close per Severity→Action). The 4 majors
are real bugs in adjacent work (completion-reconciler Spec 1 + install/uninstall
parity), not F5 (aiDeck consumer) deliverables. Recorded here as follow-up.

## Fixes applied in this session

All 4 majors fixed with TDD (failing test → minimal fix → green). Full unit
suite 791/791 (e2e-smoke excluded — pre-existing env timeout, identical on
baseline); install/uninstall parity 4/4; validate-skills 14/14.

- **F-001 — FIXED.** `scripts/detect-completion.js`: plumbed `idMatchSafe`
  (`detectCompletion` → `scanInitiative` → `classifyEntry`), computed as
  `targets.length === 1`. A widened (`--plan`) scan suppresses the id-in-commit
  half of commit-ref; path-based evidence stays global. Test:
  `tests/detect-completion.test.js` "--plan widening disables id-in-commit
  matching (F-001 cross-phase)".
- **F-002 — FIXED.** `src/install.js` records `~/.atomic-skills/package-root`
  (the package dir with scripts/ + its node_modules); both hooks
  (session-start.sh, stop.sh) add it as a 4th `resolve_detector` candidate, so
  the detector resolves WITH deps for npx/local installs. `removeRuntimeArtifacts`
  removes the record. Test: `tests/runtime-refcount.test.js` (F-002).
- **F-003 — FIXED.** `src/install.js` adds a cross-install registry
  (`~/.atomic-skills/installs.json`) with `registerInstall`/`unregisterInstall`;
  `src/uninstall.js` reclaims shared runtime only when the refcount hits 0
  (replacing the `scope === 'user'` gate). Tests: `tests/runtime-refcount.test.js`
  (F-003) + rewritten `tests/uninstall.test.js` coexistence test.
- **F-004 — FIXED.** `src/provision-consumer.js`: `sanitizeMcpNamespace` appends
  a 6-hex sha1 suffix when (and only when) truncation past 32 chars is needed
  (25 prefix + '_' + 6 hex), keeping long ids distinct while short ids
  (`atomic-skills` → `atomic_skills`) are byte-unchanged. Test:
  `tests/provision-consumer.test.js` (F-004).

### Self-review against code-quality gates
- G1 read-before-claim: each fix's target lines were Read before editing (and
  pasted into the codex operator-verification section above).
- G2 soft-language: fix descriptions state what the code does; no should/probably/may.
- G3 anti-tautology: each new test asserts a behavioral delta (e.g. F-001 default
  scan still flags T-001 via commit-ref while the widened scan drops it — the
  suppression is the mutation that flips the assertion).
- G4 fixture realism: detector fixtures use real git commits + real frontmatter
  (mirrors the existing detect-completion fixtures).
- G7 anti-premature-abstraction: no speculative helpers; registry helpers exist
  because two call sites (install) + one (uninstall) require them.
