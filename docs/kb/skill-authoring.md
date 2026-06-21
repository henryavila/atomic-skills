# Skill-authoring method

The authoring reference for **discipline skills** — skills whose value is a behavioral rule the agent must not rationalize away (an Iron Law, a HARD-GATE, a Red-Flags list, a Rationalization table). Read this *before* writing or extending such a block, because an untested discipline block looks hardened but is not — it ships false confidence, which is strictly worse than renting a block that was already pressure-tested upstream (`docs/design/project-orchestrator/02-superpowers-extraction.md:151`, risk R3).

This is a reference, not a runnable skill. It is not in `meta/catalog.yaml` and carries no Iron Law of its own — like `docs/kb/code-quality-gates.md`, it is injected by reference. It is cited by the pressure-test budget requirements: R-SP-03, R-SP-08 / R-EXEC-31 (`docs/design/project-orchestrator/01-requirements-workflows-dogfood.md:94`), R-SP-22/23, and R-SP-32 (`:119`).

The method below is the repo-local form of T13 — *TDD for documentation* (`docs/kb/analise-superpowers-v5.0.5.md:240-250`). Use the same house style as `code-quality-gates.md`: `##`/`###` headers, `**Rule.**`-style bold leads, every factual claim carries a `file:line` or command citation (G1 + G6), and the G2 ban list (`should`, `probably`, `may`, `typically`, `usually`, `I think`, `it seems`, `in theory`, `tends to`) stays out of the body.

---

## The pressure-test method (RED → GREEN → REFACTOR)

**Rule.** A new discipline block is not done until it has survived a RED-GREEN-REFACTOR cycle run by *subagents under pressure*, with the cycle recorded. Adapted from T13 (`docs/kb/analise-superpowers-v5.0.5.md:244-247`).

### RED — run the scenario WITHOUT the block

Spawn a fresh subagent (constructed context, never your session's history) and put it under a realistic pressure scenario for the exact decision the block governs, with the block absent from its instructions. Capture the rationalizations it produces **verbatim** — those quotes are the raw material for the Rationalization table and Red-Flags list. A block written from imagined excuses misses the ones the model actually reaches for.

A RED pass that produces zero rationalizations means the scenario was not adversarial enough (no real temptation present) — tighten it and re-run, do not declare the block unnecessary.

### GREEN — write the minimal block that counters what you observed

Write the smallest Iron Law / HARD-GATE / Red-Flags / Rationalization entry that refuses the *specific* failures the RED pass surfaced. Map each captured rationalization to a counter:

- a recurring excuse → one Rationalization-table row (`Temptation | Reality`, the captured quote on the left)
- a thought that means "about to violate" → one Red-Flags bullet
- the load-bearing prohibition → the Iron Law sentence (imperative, no exception clause)
- a strong skip-this-step temptation → a `<HARD-GATE>` block at the point of temptation

### REFACTOR — re-run, find the next rationalization, re-counter

Re-run the scenario WITH the block. The agent will find a new way around it ("I'm following the spirit, not the letter", "this case is different because…"). Add the counter (T05 *Letter = Spirit*, `:111-121`, kills the spirit/letter dodge) and re-test. Stop when a pass produces no new rationalization that the block fails to refuse.

**Meta-testing (cheap, high-yield):** after a pass, ask the subagent directly — *"how should the skill have been written so you would have chosen correctly?"* (`:250`). Its answer is often the exact phrasing the block was missing.

---

## The 3+-combined-factor rule

**Rule.** Every NEW (non-rented) Iron Law, Red-Flags list, or Rationalization block ships only after **≥3 combined-pressure scenarios**, each combining **3 or more** pressure factors, dated, and recorded. Source: `docs/kb/analise-superpowers-v5.0.5.md:249`.

A single-factor scenario is too weak — the model complies. Real violations happen when factors stack. Combine at least three of:

| Factor | What it looks like in the scenario |
|---|---|
| Time pressure | "we ship in 20 minutes", "the user is waiting" |
| Sunk cost | "you already wrote 300 lines under the old approach" |
| Fatigue | "this is the 9th task this session, the last 8 passed" |
| Authority | "a senior engineer / the user told you to skip it" |
| Plausibility | "the change is one line, obviously safe" |

The scientific basis for stacking: Meincke et al. (2025), N=28,000 — persuasion techniques moved compliance from 33% to 72% (`:89`). The block has to hold at the 72% end, so the test has to apply that pressure.

"3 scenarios × ≥3 factors" is the floor, not a target to game. A block governing a one-way-door decision (data migration, public contract) earns more.

---

## The rented-phrasing exemption

**Rule.** Phrasing **rented verbatim** from a pressure-tested upstream source (superpowers' T01/T03/T04/T05 blocks, `docs/kb/analise-superpowers-v5.0.5.md:43-121`) is **exempt** from the 3+-combined-factor budget, on two conditions: (a) the phrasing is reused as-is, not adapted, and (b) the source is cited inline by T-number. Established in `docs/design/project-orchestrator/02-superpowers-extraction.md:138` (rent the discipline phrasing) and risk R5 (`:153`).

**Why it is exempt — and why owning it is not free.** The rented block was already pressure-tested upstream, and upstream re-tunes it for free on every model generation (the parahuman premise: a new model rationalizes differently, so a hand-owned block inherits a recurring re-validation bill — `02-superpowers-extraction.md:138`). Renting keeps that bill upstream.

**The exemption does not cover:**

- A block you **adapted** (changed wording, merged two, retargeted to a new decision). Adaptation breaks the upstream test; treat it as new → full budget.
- A block you **authored** for an atomic-skills-specific decision (brainstorm's premature-convergence law, implement's never-force-same-model-retry). No upstream test exists → full budget.
- Phrasing rented **without a citation**. An uncited rented block is indistinguishable from an untested owned one on the next review pass — cite it or it owes the budget.

The RENT *probe* itself (the optional detect-and-degrade for superpowers, `project-create-plan.md`) carries no discipline block of its own, so it is exempt as a whole — it rents phrasing and owns no rule (R-SP-32, `01-requirements-workflows-dogfood.md:119`).

---

## The discipline-block toolkit (where each piece goes)

A discipline skill body uses these together, in this order (matches `skills/core/fix.md`, `skills/core/hunt.md`):

1. **Iron Law** (T01, `:43-54`) — one imperative sentence near the top, no exception clause. The Authority lever: imperative language removes the decision.
2. **`<HARD-GATE>`** (T02, `:58-71`) — an XML-tagged STOP at the precise point of strongest temptation. Iron Law is the general rule; HARD-GATE is the point block. Wrap any host-orchestration tool inside `{{#if ide.claude-code}}` if one appears — the strip-test (`tests/compatibility.test.js`) fails otherwise.
3. **Letter = Spirit** (T05, `:111-121`) — place before the rules to foreclose the "I'm honoring the spirit" dodge, when REFACTOR shows the agent reaching for it.
4. **Red Flags** (T04, `:93-107`) — a bulleted list of the verbatim thoughts that mean "about to violate", closed with the standard "If you thought any of the above: STOP. Go back to the step you were skipping."
5. **Rationalization table** (T03, `:75-89`) — two columns, exactly `Temptation | Reality`; left cell is the captured excuse, right cell is the counter.

Use template variables for every tool/input reference (`{{BASH_TOOL}}`, `{{READ_TOOL}}`, `{{INVESTIGATOR_TOOL}}`, `{{ARG_VAR}}`, `{{ASK_USER_QUESTION_TOOL}}`) — never a hard-coded tool name (`tests/compatibility.test.js` FORBIDDEN_TERMS).

---

## The pressure-test record (the shippable artifact)

**Rule.** The cycle above produces a durable record, dated, cited from wherever the block ships (the increment's implementation notes or the PR body). A block with no record has not been tested — by definition.

Record, per new block:

- the block name + the skill it lives in,
- each scenario: a one-line description, the ≥3 factors it combined, and the date it was run,
- the verbatim rationalization the RED pass captured, and the counter (table row / Red-Flag / Iron Law clause) it produced,
- the REFACTOR delta (new rationalization found → counter added), until a pass found nothing new,
- for any rented block: the T-number it was rented from (which discharges the budget for that block).

Keep it terse — five scenarios is a short list, not a report. The point is falsifiability: a reviewer can re-run any recorded scenario and confirm the block still holds.

---

## The `fork-plan` step (degrau 7.5) — when a phase becomes its own plan

The emergence ladder has a step between `split-phase` and `supersede`: **degrau 7.5, `fork-plan`**. Use it when a phase of an executing plan grows too large for `new-phase`/`split-phase`, but the parent plan stays valid — the phase is forked into a **child plan** linked to the parent by a bidirectional, ratified edge. The parent either **pauses** (mode `pause`) or **runs in parallel** in its own worktree (mode `parallel`), and resumes at the anchor phase when the child completes. Distinct from `supersede` (replacement): `fork-plan` is **additive and reversible**.

Full procedure (ratify gate, cycle-check before any write, the two modes, pause-only fallback): `skills/shared/project-assets/project-emergence.md` → `fork-plan`. Load-bearing contract points:

- **The child is a real plan.** It passes the DESIGN gate (R-ORCH-09) like any plan; `fork-plan` only ratifies the edge and delegates to the `new plan` flow.
- **Intra-project only; `mode` lives on the child.** The parent references the child on its anchor phase (`spawnedPlans`); the child references the parent (`spawnedFrom`).
- **Sidecar as the bridge, inline as the destination.** The edge lives in a non-aiDeck-facing sidecar (`links.json`) while the published aiDeck consumer does not declare the two fields (`spawnedFrom` is `.strict` and drops the card; `spawnedPlans` is silently stripped). It migrates to inline `plan.md` frontmatter only at aiDeck **≥ 0.1.2**.
- **Resume is a transaction.** On the child's archive, the parent writeback **precedes** the child-archive finalize; a declined/failed writeback persists a durable `pendingWriteback` (`op: resumeParent`) and the child does not finalize until recovery. The archive step is a **hard gate**, not a fall-through offer (`project-transitions.md` → `archive` / `fork-resume`).
- **Focus treats parent/child as a hierarchy.** The focus resolver collapses an active parent+child fork pair to the child (no spurious multi-active `⧉`), scoped intra-project (`scripts/emit-focus.js`, `scripts/reconcile-focus.js`).

---

## Self-review against code-quality gates

Before declaring a discipline block done, append (mirrors `docs/kb/code-quality-gates.md:13-24`):

```
## Self-review against code-quality gates
- G1 (read-before-claim): applied — <T-numbers / file:line cited for every claim> / not-applicable — <why>
- G2 (soft-language): applied — scanned the block for the ban list / not-applicable
- G6 (reference-or-strike): applied — every rented block cites its T-number; every owned block cites its pressure-test record / violated — <reason + fix>
```

Silent application is forbidden; the checkpoint is part of the deliverable.
