# Cross-model review — implementation-automate-mode (full plan)

**Date:** 2026-07-17
**Mode:** both (local sealed + codex external; host=grok)
**Range:** develop merge-base..HEAD
**Post-fix HEAD:** after merge `plan/implementation-automate-mode-xreview-fix`

## Counts (pre-fix)
- Codex: 0B / 2C / 4M
- Local: 0B / 4C / 6M

## Disposition (ALL FIXED)

| ID | Finding | Fix |
|----|---------|-----|
| F1 | Absent mode → default killed stamp re-entry | `mode: undefined` when no flag; stamp re-entry works |
| F2 | Lease public owner token | secret nonce + tokenHash, 0o600, clear requires secret |
| F3 | phaseReviewMode omit → local with stamp | stamp fail-closed → both; override needs reason |
| F4 | Session --mode=1 skipped plan-end durable gates | durable gates stamp-only |
| F5 | planEndReviewOk accepted mode `both` | external-both only |
| F6 | Malformed claims silently dropped | preserve invalid entries |
| F7 | Empty paths on open claims | require ≥1 path |
| F8 | claimed-pass with exitCode null | require exitCode === 0 |
| F9 | Weak range exclusivity | endpoints in exclusivity pool |
| F10 | No assertCanLeaveAutomate | `assertLeaseAbsent` |
| F11 | Weak contract tests | adversarial F11 suite |
| F12 | Cleared residue non-blocking | any non-missing blocks |

## Verification
- targeted automate suites: 161 pass
- npm test: 2331 pass / 0 fail / 11 skipped
- validate-skills: 0

## Codex raw
`2026-07-17-2000-iam-cross-model-codex.md`
