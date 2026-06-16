---
date: 2026-06-16T16:50:35Z
topic: skills-restructuring-f6
artifact: d4414fc..HEAD (F6 — focus.json auto-refresh: T6.1 transições + T6.2 install wiring)
skill: atomic-skills:review-code
mode: local
reviewer: claude-opus-4-8 (sealed-envelope agent, clean context)
final_verdict: needs_changes_all_fixed
counts: blocker=0 critical=0 major=2 minor=2 (1 reclassified critical→major)
schema_version: "1.0"
---

# Local Review — skills-restructuring F6

**Ref:** `d4414fc..HEAD` (clean range: T6.1 `4f1fda3` + T6.2 `d85ac53`; F1's phase-done `d4414fc` is the boundary — no pollution).
**Mode:** local (sealed-envelope agent, clean context). DESTRUCTIVE=false (247 ins/27 del, additive).
**Files reviewed (code-only):** src/install.js, src/uninstall.js, tests/install-uninstall-roundtrip.test.js, skills/shared/project-assets/project-transitions.md.
**Passes:** 2.

## Findings — all 4 confirmed real, all FIXED this session (TDD)

| # | Summary | Severity | File:line | Disposition |
|---|---------|----------|-----------|-------------|
| 1 | Re-install (update path) leaves `settings.local.json`=`{}` + `.claude/` as residue: `manifestMeta` is fresh per install, so the 2nd install computes `settingsLocalCreated=false` (file now pre-exists), and uninstall writes `{}` instead of deleting. Same flaw in the precedent `settingsCreated` (auto-update). | critical → **major** (reclassified: bounded empty-file residue, no data loss, pre-existing pattern — but a HARD-RULE parity break on a common path) | install.js:479 (fresh manifestMeta); manifest write | **FIXED** — sticky flags: read prior manifest, OR-in `settingsCreated` + `settingsLocalCreated` so a re-install never demotes true→false. Generic (covers the auto-update precedent too). Guarded by new test "project scope re-install then uninstall leaves no residue". |
| 2 | User-scope uninstall corrupts a user-owned `~/.claude/settings.local.json` on command-string collision: `removeProjectStatusHooks` called unconditionally (uninstall.js:123) though install is project-gated. | major | uninstall.js:123 | **FIXED** — scope-gated the call to `scope === 'project'`. Guarded by new test "user scope uninstall does not touch a user-owned settings.local.json". |
| 3 | New round-trip test missed the pre-existing-file preservation + update-path cases (let #1 slip through). | minor | test:149-188 | **FIXED** — added 3 cases: re-install→uninstall no-residue (#1 guard), user-scope scope-isolation (#2 guard), project-scope pre-existing settings.local.json preservation. |
| 4 | `project-transitions.md:172` claims `switch` funnels through refresh-state, but the initiative-switch branch (step 3) had no recompute call → digest drift after an initiative switch. | minor | project-transitions.md:235-240 | **FIXED** — added `node scripts/refresh-state.js` to the initiative-switch branch (step 3). The line-172 claim now holds for both switch branches. |

## Verification of the fixes (RED → GREEN)

- Added 3 tests FIRST; ran → #1 (re-install) and #2 (scope-isolation) **RED** as predicted; #3b (preservation) green.
- Applied the 3 fixes (sticky flags / scope-gate / doc) → round-trip test **8/8 pass**.
- Broader suite (install.test.js + uninstall.test.js + manifest.test.js): **55 tests, 50 pass, 5 fail** — byte-identical to the pre-fix baseline (the 5 pre-existing `installSkills` count failures, delegated to the finalization branch). The sticky-flag fix (which touches `settingsCreated`/auto-update) introduced **0 net-new failures**; the existing "preserves a pre-existing settings.json" test stays green, proving the sticky OR-in never over-deletes a user file.
- F6-G1 exit gate re-verified on the fixed tree: exit 0 (refresh-state present, round-trip 8/8, validate-skills 15 valid).

## Self-review against code-quality gates (F6 review + fixes)

- **G1 read-before-claim:** applied — each finding verified by reading the cited source (install.js:479/manifest-write, uninstall.js:123, project-transitions.md:235-240) before fixing.
- **G2 soft-language:** applied — dispositions state facts (writes `{}`/corrupts/drift), fixes state what they do.
- **G3 anti-tautology:** the 2 fix-guard tests were observed RED before the fix and GREEN after — non-tautological by construction.
- **G4 fixture realism:** N/A — fixtures are settings.json shapes mined from this repo's own settings.local.json (the F1-landed registration shape).
- **G7 anti-premature-abstraction:** the sticky-flag OR-in is inline at the single manifest-write site (2 flags), no helper introduced.

## Note

The sticky-flag fix (#1) also closes the identical latent residue in the auto-update precedent (`settingsCreated`) — a pre-existing bug surfaced by this review, fixed generically since the mechanism is shared and the fix is strictly safe (deletion stays gated on emptiness).
