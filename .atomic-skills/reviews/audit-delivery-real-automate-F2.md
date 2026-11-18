# audit-delivery — real-automate F2
**verdict:** CLOSED
**HEAD:** 48b943e3a6b788f0dfb151067083e0625c27e8ea
**mode:** audit light, axes product+residual
**intent-source:** `.atomic-skills/projects/atomic-skills/real-automate/phases/f2-prototipo.md` businessIntent
**evaluatedAt:** 2026-10-02T11:33:00Z

## Intent Package
Spine:
- D1: `ui/ui.json` is the prototype stamp (`screens[]` with path+sha, or `{none:true, reason}`).
- D2: `scripts/find-missing-ui.js` reads the stamp; `exitGateType: ui-gate` is not the stamp.
- D3: `none: true` is refused when plan.md or `phases/*.md` (not archive) touches Vue/sheet/viewer/editor.
- D4: The stamp cites the architecture card sha when `architecture/decisions.json` exists; divergent/missing/malformed citations fail.
- D5: `automate-run.js` spawns `find-missing-ui.js --strict` (not existsSync-only).
- P1: Missing `screens[].path` on disk must fail (F-001 silent pass).

Acceptance / doneWhen: `node --test tests/find-missing-ui.test.js` exit 0; `--strict` on empty/inconsistent fixture exit 1; automate-run cites the detector when the stamp is missing.

Vocabulary: none (additive) — new detector; no user-facing rename.

Surfaces (3): `scripts/find-missing-ui.js`, `tests/find-missing-ui.test.js`, `scripts/automate-run.js`.

Non-goals: writer spawn / merge (F3), review-both loop (F4), final page (F5); do not change the architecture detector.

## Matrix
| ID | Status | Evidence |
|----|--------|----------|
| D1 | RESOLVED | `scripts/find-missing-ui.js:5-9` formats; empty `{}` exits 1 `missing screens or none: true with reason` (eval independentConfirmations) |
| D2 | RESOLVED | `scripts/find-missing-ui.js:270-276` `exitGateType: ui-gate does not satisfy ui/ui.json`; independent run exit 1 with both lines |
| D3 | RESOLVED | `collectUiKeywords` scans plan + `phases/*.md`, skips archive; `none:true` + phase Vue exit 1; `outOfScope` / `## Out of scope` exit 0 |
| D4 | RESOLVED | `checkArchitectureCitation` `scripts/find-missing-ui.js:205-212`; omitted sha with card present exit 1; mismatch exit 1 |
| D5 | RESOLVED | `scripts/automate-run.js:360` `['find-missing-ui.js', '--strict', plan]` via `runDetector` `:83-88` spawnSync; grep `existsSync(.*find-missing-ui` → 0 |
| P1 | RESOLVED | `screenPathIssue` `:244` `missing prototype file`; fixture `ui/missing.html` exit 1 |

## Residual hunt
OLD terms: `existsSync` UI detector, `ui-gate` as stamp, silent skip of missing screen path.
- automate-run no longer existsSync-only for UI (D5 RESOLVED).
- ui-gate still in schema; detector refuses it as stamp (D2).
- missing screen path now issues (P1).
Header comment `scripts/automate-run.js:7-8` still says the UI detector is not in this tree (stale comment, not a teaching surface for consumers). Zero CRITICAL.

Open HIGH robustness (not delivery NO):
- unclosed/nested/mixed fences drop remaining scan text
- lexical path containment follows symlinks
- unreadable `phases/*.md` skipped (fail-open)

## Accept Records
| Finding | Risk | Mitigation | Operator | At | Expires |
|---------|------|------------|----------|-----|---------|
| H-fence | Unclosed or mixed fences hide later UI keywords from `none:true` | L-F2-2 size-cap; 10-line fence skip is the contracted model; operator accept local F-001 + Codex mixed-fence | operator | 2026-10-02T11:06:37Z | — |
| H-symlink | Relative `screens[].path` via symlink can hash a file outside planDir | ui.json is operator-authored stamp, not attacker input; lexical `..` and absolute paths still fail | operator | 2026-10-02T11:30:27Z | — |
| H-phase-io | EACCES on a phase file omits its keywords | Rare; architecture detector still runs first; operator accept Codex EACCES major | operator | 2026-10-02T11:30:27Z | — |

## findings
Zero CRITICAL. HIGH items have Accept Records. Product Dn/Pn RESOLVED.

## Verdict CLOSED
Load-bearing D1–D5 and P1 RESOLVED. Residual valid (not excluded). Accept Records cover remaining HIGH. Green suite 28/28 is evidence for rows, not a substitute.
