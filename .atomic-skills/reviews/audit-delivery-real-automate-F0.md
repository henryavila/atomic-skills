# audit-delivery — real-automate F0

**mode:** audit (read-only)
**depth:** light
**axes:** product, residual
**HEAD:** f94cea27471fb3450cc10c99d7156b7011a7e9e6
**verifiedAt:** 2026-09-25T22:16:17Z
**verdict:** CLOSED

## Intent Package

### Spine (decisions)
- D1: `node scripts/automate-run.js` is the program. It refuses startup without a real host pen proof, flow, external review receipt, ground truth, and the architecture/UI detector files.
- D2: The pen covers Claude Write/Edit/MultiEdit/NotebookEdit/Bash, Codex apply_patch/shell, Grok write/search_replace/run_terminal_command. Isolated probe.lock (tmpdir) is not pen.lock.
- D3: `find-unreviewed-plans.js --require-external` rejects a session `- internal:` line and non-passing CLI receipts.
- D4: Host-write proof is a host-shaped subprocess that invokes the registered `automate-pen.sh` (argv), not `assessHostWrite` with the proof disabled.
- D5: F0 does not spawn a writer, does not write pen.lock, does not delete `pre-write.sh`, does not change `stop.sh`.

### Original problems
- P1: `implement --automate` was the same session writing product. Skill prose was not the enforce.

### Acceptance / doneWhen
- `node --test tests/automate-host-pen.test.js` exit 0
- hook exit 0 without lock, exit 2 with isolated probe lock
- real/host-shaped write refused, no sentinel
- `automate-run.js --host codex --plan <fixture without flow>` exit 1 citing `automate-pen.sh` and `find-missing-architecture.js`

### Vocabulary
- vocabulary: none (additive) — new program files; no rename of pre-write.sh

### Surfaces
- scripts/automate-run.js
- src/automate-host-pen.js + hooks
- tests/automate-host-pen.test.js
single-surface: false (3 surfaces)

### Non-goals
- architecture card, UI stamp, writer spawn, merge loop, flow audit, F5 page

## Matrix A — decisions vs code

| ID | Status | Evidence |
|----|--------|----------|
| D1 | RESOLVED | scripts/automate-run.js main() lists blockers and exits 1; never writes pen.lock |
| D2 | RESOLVED | src/automate-host-pen.js AUTOMATE_HOSTS; automate-pen.sh probe vs pen |
| D3 | RESOLVED | scripts/find-unreviewed-plans.js --require-external; automate-run.js:336 |
| D4 | RESOLVED | runHostWriteProbe + hostShapedWrite spawnSync bash [scriptPath] |
| D5 | RESOLVED | git diff does not touch pre-write.sh or stop.sh; no automate-phase-run.js call |
| P1 | RESOLVED | program entry is node scripts/automate-run.js |

Load-bearing RESOLVED hops: plan BI workflow → automate-run.js detectors → tests/automate-host-pen.test.js 29 pass.

## Matrix C — must-not
- Must not spawn writer in F0 — RESOLVED (exit 2 "writer spawn is not in this build")
- Must not treat - internal: as external — RESOLVED
- Must not count disabled assessHostWrite — RESOLVED

## Residual hunt
OLD_TERMS: --unattended, session-writer as --automate, - internal: as review
NEW_TERMS: automate-run.js, --require-external, probe.lock / AUTOMATE_PROBE_LOCK
Surfaces grepped: scripts/automate-run.js, src/implement-mode.js, skills/core/implement.md
- no --unattended product flag
- implement.md still describes maestro (P2: skill is not the enforce) — accepted residual of F0 outOfScope
- architecture/UI detectors still missing — expected F1/F2, startup lists them

Residual CRITICAL: none. Residual HIGH: none.

## Ledger
No CRITICAL. No HIGH. Notes only: F1/F2 detectors absent by design.

## Verdict
CLOSED — load-bearing D1–D5 and P1 RESOLVED; zero CRITICAL; residual valid; F1/F2 absence is a listed blocker not a missed F0 delivery.

## Self-review
- G1: cites scripts/automate-run.js, src/automate-host-pen.js, tests 29/29
- G2: no should/probably/looks done
- G6: paths verbatim
