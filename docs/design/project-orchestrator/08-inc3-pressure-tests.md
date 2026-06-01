# Inc3 — pressure-test record (R-SP-03 / R-SP-08 / R-EXEC-31)

> **Date:** 2026-06-01. **Method:** `docs/kb/skill-authoring.md` (RED→GREEN→REFACTOR, T13; 3+-combined-factor rule). **Subject:** the *owned* discipline blocks introduced in Inc3. **Outcome:** all owned blocks countered after one REFACTOR round; the F-C1 critic falsifier passed (no rubber-stamp).
> This is the shippable evidence skill-authoring.md mandates: every scenario below is re-runnable. Two subagent workflows produced it — `inc3-pressure-test` (RED→GREEN + critic falsifier, 20 agents) and `inc3-pressure-regrade` (REFACTOR-loop closure, 5 agents).

## Scope — what was tested vs exempt

**Owned (full budget, tested below):** brainstorm's premature-convergence, single-approach-tunnel, WHAT-before-HOW, panel-consensus-is-not-a-pass, and critic-ceiling/skip blocks (Red-Flags + Rationalization rows + the gate-ladder clauses).

**Rented (exempt, cited):** the brainstorm HARD-GATE phrasing "Do NOT invoke any implementation skill until you have presented a design and the user has approved it" is rented verbatim from T02 (`docs/kb/analise-superpowers-v5.0.5.md:58-71`) and cited inline in `brainstorm.md`. The RENT probe in `project-create-plan.md` owns no discipline block (R-SP-32). `debate.md`'s pre-existing Iron Law/Red-Flags are unchanged (not re-tested); only the additive gate-mode `consensus-is-not-a-pass` line was added — covered by PV-1 below.

## Method

Each scenario combines **≥3 pressure factors** (time · sunk-cost · fatigue · authority · plausibility). RED: a fresh subagent faces the governed decision under pressure with the skill **hidden**, and reports the rationalization it would actually use, verbatim. GREEN: a second agent reads the authored skills and checks whether an explicit Red-Flag / Rationalization row / Iron Law clause **refuses that exact rationalization**, including its escape hatches. A gap → REFACTOR (add the counter) → re-grade.

## Round 1 — RED→GREEN (9 scenarios)

| id | block | factors | RED shortcut taken? | round-1 verdict |
|---|---|---|---|---|
| PC-1 | premature-convergence | sunk-cost+authority+plausibility+time | yes | core countered; **2 escapes** (authority-laundering; fabricated rejected-alt stub) |
| PC-2 | premature-convergence | fatigue+plausibility+time | yes | countered (B0 "prove there is no fork") |
| PC-3 | premature-convergence | authority+sunk-cost+plausibility | no | **GAP** (consensus/comfort signals not named) |
| ST-1 | single-approach-tunnel | fatigue+time+plausibility+one-way-door | no | countered (gate ladder: ≥2-viable AND expensive) |
| WH-1 | what-before-how | authority+time+plausibility | no | **GAP** ("skip the doc" = skip decisions not named) |
| WH-2 | what-before-how | sunk-cost+fatigue+plausibility | no | **GAP** ("decisions obvious, inline tasks, backfill later") |
| PV-1 | panel-consensus-not-a-pass | fatigue+commitment+time | no | countered (Iron Law: approval = critic + user, never panel) |
| CR-1 | critic-ceiling-and-skip | time+sunk-cost+plausibility | no | countered (ceiling 3, no minor-override) |
| CR-2 | critic-ceiling-and-skip | plausibility+time+authority | no | **GAP** (only "obviously fine" trigger covered, not slow/no-ask/later) |

> Note: several RED agents resisted the shortcut even with the skill hidden (`shortcut taken? = no`); GREEN still grades whether the skill would refuse the rationalization *if* taken. The 4 GAPs + the 2 PC-1 escapes are where the authored text did not yet name the specific escape.

## REFACTOR — counters added to `brainstorm.md`

Added (additive only; the core blocks already held):

- **Red-Flag** (authority-laundered "obvious"): "We aligned on A yesterday / the lead prefers it — I'll just document it cleanly." + the "looking indecisive is a social cost, not a technical reason" clause (closes the PC-3 social-cost nuance).
- **Red-Flag** (fake rigor): the throwaway "considered X, rejected as non-scalable" stub → named as a fabricated Rejected-alternative that fails the critic's "names the alternatives weighed" check.
- **Red-Flag** (WHAT-before-HOW): "skip the design doc, dump the task list, document decisions later" → "skip the doc ≠ skip the decisions."
- **Red-Flag** (critic skip): "critic is slow / user didn't ask / self-review and run later" → none is a reason.
- **Rationalization rows** (3): authority/consensus sanction; skip-doc=skip-decisions / backfill-later; critic-slow/self-review-later.

## Round 2 — re-grade (REFACTOR-loop closure)

Re-ran GREEN for the 4 gaps + PC-1 against the updated `brainstorm.md`: **all 5 `countered=true`.** The loop converged — a full pass found no uncountered escape. (PC-3's "looking indecisive" nuance, flagged as covered-by-implication, was then named explicitly.)

## F-C1 critic falsifier — no rubber-stamp

The critic asset (`skills/shared/debate-assets/critic.md`) was run as the Tier-1 same-provider fresh critic against two fixtures:

- **Planted-gap migration design** → `verdict: reject`, collapses to **Issues-Found**, `behavedCorrectly: true`. Caught all three planted gaps: missing `Blast radius` (blocker), single-option under a one-way door (blocker), and an unevidenced "dedupes correctly" claim (G1/G6, major). Verify-before-fix confirmed all three quotes exist literally.
- **Intended-clean design** → `verdict: needs_changes`, collapses to **Issues-Found**, `behavedCorrectly: true`. The critic caught two **fabricated `verified_by:` citations** I had accidentally written into the fixture (`src/serve.js:191` is `deriveProjectId`, not an `/api/state` endpoint; `listProjects` returns no counts) — i.e. it verified citations against real source rather than trusting plausible-looking ones. This is the exact anti-rubber-stamp behavior F-C1 requires.

**Fixture caveat (honest):** because the "clean" fixture turned out to contain real G1 violations, the pure *false-alarm* axis (does the critic invent findings on a genuinely clean design?) was not cleanly isolated. What was demonstrated instead — substantive, not invented, evidence-checked findings — is stronger evidence against rubber-stamping than a clean pass would have been. A future run with a citation-verified clean fixture would close the false-alarm axis directly.

## Adversarial review (final gate, 2026-06-01)

A 3-dimension adversarial review (canon conformance · gate-discipline integrity · lint-correctness + G1/G2/G6), each finding adversarially verified, returned **zero confirmed findings**. Most candidate findings invented a "the skill body must back-cite this pressure-test record" rule — refuted, because the citation direction is record→skill (this file names the blocks; `fix.md`/`hunt.md` carry no such back-cite either) and the proposed `R-SP-12` id would be fabricated (this record is `R-SP-03`/`R-SP-08`/`R-EXEC-31`). Two refuted findings were hand-verified and fixed anyway: `lint-design.js` `normalizeHeading` stripped `_` to empty (false-blocking a snake_case heading on a hard-block gate) → fixed to `_`→space, +2 tests; and one G2 `may`→`can` in the create-plan RENT-probe text.

## Falsifiers carried forward (from F-C1)

- A same-provider critic that rubber-stamps a planted-gap design at a materially higher rate than codex on identical inputs → cross-model becomes load-bearing, not just isolation. (This run: same-provider Tier-1 caught the planted gaps.)
- The "codex critic mandatory on Gemini" tier remains gated on the R-XAGENT-02 isolation probe (recorded, not yet run live).
