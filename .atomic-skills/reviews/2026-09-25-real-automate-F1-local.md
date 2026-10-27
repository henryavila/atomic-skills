# F1 local adversarial review — architecture detector

**Ref:** F1 architecture detector (`scripts/find-missing-architecture.js`, `scripts/automate-run.js`, `tests/find-missing-architecture.test.js`, `tests/automate-host-pen.test.js`)
**Mode:** local, adversarial. No fixes applied.
**Contract:** `projects/atomic-skills/real-automate/source.md` F1 T-001..T-003; P7 / “Arquitetura — o desenho do bloco” in `.ai/memory/decisao-unattended-bloco.md`.
**Verdict:** needs_changes

**Counts:** blocker 0, critical 1, major 4, minor 4, note 3

| # | Severity | Finding |
|---|----------|---------|
| F-001 | critical | Chosen sketch is not required to be one of the two validated sketches; extra sketches are unvalidated. Exit 0 on a third garbage chosen sketch. |
| F-002 | major | Forbidden-phrase matcher is unanchored substring and fires on a complete drawing. `na outra` dies as `a outra`. Spec is “sem o desenho”. |
| F-003 | major | T-002 forbidden-phrase test is tautological: `/drawing/` matches `sha does not match drawing`. |
| F-004 | major | No test that a wrong sha / mutated drawing fails. T-002 “sai 0 só com sha” never uses a mismatched digest. |
| F-005 | major | Numeric `chosen` is 0-based and 1-based at once. `1` and `2` both select the second of two sketches. |
| F-006 | minor | `--strict` is a no-op (`void strict`). |
| F-007 | minor | Directory with zero plans exits 1 citing `missing architecture/decisions.json`. |
| F-008 | minor | `userApproved` “does not satisfy” is a canned missing-file string, not a substitute check. |
| F-009 | minor | automate-run is not tested against a present invalid card (the existsSync-of-the-file hole). |
| N-001 | note | `chosen` is hashed raw (not trimmed / not resolved). |
| N-002 | note | automate-run prints only the detector’s first line. |
| N-003 | note | Source regex in `automate-host-pen.test.js` can be satisfied by a comment. |

---

## F-001 [critical] chosen sketch can be an unvalidated third drawing

- **File:** `scripts/find-missing-architecture.js:245-276`
- **File:** `scripts/find-missing-architecture.js:273-288`

Schema checks only `sketches[0]` and `sketches[1]`. `sketches.length < 2` is the only length bound. `resolveChosenIndex` may return 2+ and that is enough for `drawingComplete` (`chosenIndex != null`).

Confirmed against the live module: a stamped card with the two required sketches plus `{ id: 'garbage', mix: '', outside: 'not-an-array' }` and `chosen: 'garbage'` returns `{ ok: true, issues: [] }`. The same card with a third sketch that still chooses `nada-fora` also returns ok.

F1’s job is to refuse a plan without two sketches **and** without the stamped choice of which sketch counts (`source.md:71`, T-001 “qual esboço foi escolhido”). The implementer / F2 prototype / F4 brief are supposed to receive that choice. This stamp can ratify an empty unconstrained drawing while the two required sketches sit as decoys. automate-run (`scripts/automate-run.js:355-364`) will treat detector exit 0 as a passed gate.

The suite never asserts `sketches.length === 2` and never asserts the chosen index is 0 or 1.

---

## F-002 [major] forbidden phrases: substring match, and they fail *with* the drawing

- **File:** `scripts/find-missing-architecture.js:24-29`
- **File:** `scripts/find-missing-architecture.js:199-201`
- **File:** `scripts/find-missing-architecture.js:289-295`

T-002 / P7: prohibit “se eu mexer nisto”, “a outra”, “consistente”, “isolado” **sem o desenho**. The matcher is `haystack.includes(phrase)`. Both branches fail:

```
hits && !drawingComplete → "forbidden phrase without the drawing"
hits &&  drawingComplete → "forbidden vague phrase"
```

Confirmed:

- mix line `o parse cola o header na outra cifra` (complete, stamped drawing) → `forbidden vague phrase: a outra`. That is the motivating `versoes-cifra` mix, written in Portuguese.
- mix line `bloco isolado por delimitador, parse cola o header` on an otherwise valid card → `forbidden vague phrase: isolado`.

“a outra” is a substring of “na outra” / “da outra” / “à outra”. The always-on branch means a finished drawing cannot use ordinary Portuguese that contains those tokens. The spec only bans the phrases as a stand-in for a missing drawing.

---

## F-003 [major] forbidden-phrase test matches the sha-mismatch sentence

- **File:** `tests/find-missing-architecture.test.js:178-196`
- **File:** `scripts/find-missing-architecture.js:301-304`

The T-002 case writes one incomplete sketch, `sha: 'deadbeef'`, and asserts:

```
/forbidden phrase|vague phrase|drawing/
```

`deadbeef` always emits `sha does not match drawing: …`. `/drawing/` matches that line even if `FORBIDDEN_PHRASES` and `forbiddenPhraseHits` are deleted. Exit 1 is already guaranteed by “missing two sketches” and the sha mismatch. The test does not lock T-002’s phrase rule.

---

## F-004 [major] stamp match is unimplemented as a test

- **File:** `tests/find-missing-architecture.test.js:210-229`
- **Contrast:** `tests/find-missing-flow.test.js:192-197` (“fails --strict when graph mutated after stamp”)

`exit 0 only with sha and ratifiedAt` covers: no sha, sha without `ratifiedAt`, both present, `ratifiedAt: 'ok'`. It never writes a complete drawing with a wrong digest. `architectureCardSha` is used both to mint the passing sha and (in production) to check it. A helper that returned `card.sha` when present would keep this test green and would accept `sha: 'deadbeef'`.

The production compare at `scripts/find-missing-architecture.js:297-305` does reject a wrong sha (confirmed live). The contract is not pinned.

---

## F-005 [major] numeric `chosen` selects the wrong sketch silently

- **File:** `scripts/find-missing-architecture.js:133-137`

```
if (sketches.some((sketch) => sketch.index === n)) return n;
if (n >= 1 && n <= sketches.length) return n - 1;
```

With two sketches (indexes 0 and 1):

- `chosen: 0` → index 0
- `chosen: 1` → index 1 (0-based hit; 1-based “first sketch” never runs)
- `chosen: 2` → no index 2, 1-based fallback → index 1

`1` and `2` both ratify the second sketch. Confirmed: `chosen: 1` on the fixture that uses ids `header-out` / `nada-fora` is `{ ok: true }` and stamps sketch 1 (`nada-fora`), not sketch 0. F2/F4 read “the chosen sketch”. A 1-based operator value silently ratifies the other drawing. Tests only use string ids (`chosen: 'nada-fora'`).

---

## F-006 [minor] `--strict` does nothing

- **File:** `scripts/find-missing-architecture.js:210-211`
- **File:** `scripts/find-missing-architecture.js:311`
- **File:** `scripts/find-missing-architecture.js:365`

`opts.strict` is read, then `void strict`. Header claims “--strict is the implement-style hard fail (same checks)”. Sibling `find-missing-flow.js:168-195` actually gates sha + `ratifiedAt` on `--strict`. automate-run always passes `--strict` (`scripts/automate-run.js:359`), and today every check already runs, so this is not a startup bypass. It is a dead flag that will copy-paste into a flow-style split later.

Confirmed: unstamped drawing, `{ strict: true }` and `{}` produce the same issues.

---

## F-007 [minor] zero-plan directory lies about the missing card

- **File:** `scripts/find-missing-architecture.js:383-389`

If `findPlanMarkdownFiles` returns `[]` for a directory, CLI writes `missing architecture/decisions.json` and exits 1. Sibling flow detector exits 0 with `no nested plan.md found (ok)` (`scripts/find-missing-flow.js:284-294`). Running the new CLI on repo root hits this because `projects/` (source.md only) wins over `.atomic-skills/projects/` (`scripts/find-missing-architecture.js:330-336`). automate-run passes a file, so this is not the F1 startup path.

---

## F-008 [minor] userApproved issue is hardcoded on the missing-file path

- **File:** `scripts/find-missing-architecture.js:215-220`
- **File:** `tests/find-missing-architecture.test.js:151-176`

Any missing `architecture/decisions.json` appends `userApproved / find-missing-design-process.js do not satisfy …`. The detector does not look at design-gates or `find-missing-design-process.js`. The unit test asserts that canned string. The real contract (those substitutes are not the card) is already implied by requiring the file; the message is theatre. A present invalid card plus `userApproved: true` never mentions the substitutes.

---

## F-009 [minor] automate-run not locked for a present invalid card

- **File:** `tests/find-missing-architecture.test.js:232-254`
- **File:** `tests/automate-host-pen.test.js:898-905`

T-003: call the detector instead of `existsSync` on the script. The spawn fixture has **no** card file and asserts stderr contains `architecture/decisions.json` — that does prove the detector ran for the missing-file case. It does not prove automate-run fails a file that exists but lacks sha / sketches / chosen. `existsSync(architecture/decisions.json)` as a future shortcut would still fail the current fixture. Detector CLI tests cover invalid cards; the process gate does not.

---

## Notes

- **N-001** `architectureCardSha` (`scripts/find-missing-architecture.js:154-167`) hashes `card.chosen` raw. `resolveChosenIndex` trims; the hash does not. `chosen: 'nada-fora'` and `chosen: 'nada-fora '` are different drawings if someone stamps one and stores the other.
- **N-002** `scripts/automate-run.js:376` prints `line.split('\n')[0]`. Architecture emits many issues; the operator one-liner is only `issues[0]`. Same pattern as the other detectors.
- **N-003** `tests/automate-host-pen.test.js:898-905` is a source regex on `find-missing-architecture.js', '--strict'`. A comment would satisfy it. The spawn test is the real T-003 check.

---

## Checked and not raised as defects

- Missing card → CLI exit 1; chat `"ok"` is not an ISO `ratifiedAt` and the detector does not write (`no writeFileSync`).
- `userApproved` alone (no card file) does not exit 0.
- Valid two-sketch card with matching sha + ISO `ratifiedAt` exits 0; choosing `header-out` (the mix sketch) is allowed — “nada fora” is an option, not the default.
- Wrong sha **does** fail in production (`deadbeef` → `sha does not match drawing`). It is the test that is missing (F-004).
- automate-run invokes `find-missing-architecture.js --strict` via `runDetector`, not `existsSync` of the script; UI detector remains an `existsSync` hole (F2).
- `scripts/` is already in `package.json` `files`.

## Gate integrity

- **Verified bypass:** stamped third sketch as `chosen` → `checkPlanArchitecture` ok / CLI would exit 0 (F-001).
- **Verified false refusal:** complete Portuguese mix containing “na outra” or “isolado” → exit 1 (F-002).
- **Verified under-test:** forbidden phrases (F-003), sha divergence (F-004), numeric chosen (F-005), automate-run invalid-present card (F-009).
- **Not a `--strict` bypass today:** flag ignored, checks always on (F-006).
