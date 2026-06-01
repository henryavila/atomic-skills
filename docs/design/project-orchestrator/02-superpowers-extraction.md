# Decision: Superpowers in atomic-skills — extract what differentiates, drop the rest, depend on the discipline tail

> Status: DECISION · Scope: whether/how to remove the superpowers coupling and which layers to internalize · Audience: atomic-skills maintainers

---

## 1. The decision in one paragraph

**PARTIAL-DROP (own two stages, rent the discipline tail, drop the overlaps) — not a "dependency removal."** The load-bearing reason: there is no dependency to drop. `skills/shared/project-assets/project-create-plan.md:203` says verbatim *"superpowers is an optimization, not a dependency,"* the entire coupling is **two opt-in delegation lines** in a Structured-Options menu (Stage 3 Branch A → `superpowers:brainstorm` + `superpowers:write-execution-plan`) with a complete working Branch B fallback (`minimal-source.template.md`) that "never errors out just because superpowers is absent" (`:277`). So the real decision is **build-only-what-is-differentiated**, judged on its own merit — *not* a dependency-removal pretext that inflates a 2-line edit into a multi-skill program. We OWN exactly two things that head the chain we control and bend a foreign artifact shape if rented: a front-of-pipeline **`brainstorm`/design** stage and an **`implement`** execution driver. We DEPEND (keep the opt-in detect-and-degrade probe) on the **discipline phrasing** (TDD/debugging/verification language) that `fix`+`hunt` already cover the *workflow* for and that is expensive to re-pressure-test on every model bump. We DROP-cleanly the **overlaps** atomic-skills already matches or exceeds (cross-model review, cross-session dispatch, the router, worktrees-via-native-harness).

---

## 2. Value-extraction verdict table

Verdicts: **already-have** (we match) · **EXCEED** (we strictly beat it → drop upstream) · **EXTRACT** (genuine gap, internalize) · **KEEP-OPTIONAL** (rent via detect-and-degrade) · **DROP** (no value / anti-value).

### Layer A — Orchestration / pipeline

| superpowers skill | atomic equivalent | verdict | cost | internal home |
|---|---|---|---|---|
| `brainstorming` | none (gap) — `prompt` is single-task, no approved design doc, no no-impl gate | **EXTRACT** | medium | NEW `skills/core/brainstorm.md` (+ assets) → `.atomic-skills/designs/` |
| `writing-plans` (doc skeleton) | `project`/`decompose` + `minimal-source.template.md` (canonical shape) | **already-have** | trivial | — (decompose owns the `## F0 / ### Tn / exit_gate` shape) |
| `writing-plans` (per-task RIGOR: Files + 5-step TDD + No-Placeholders) | partial — task bodies are prose today | **EXTRACT-light** | small | EXTEND `decompose.js` (No-Placeholders lint) + `minimal-source.template.md` |
| `subagent-driven-development` | **none (biggest gap)** — `project` tracks state, never drives it | **EXTRACT** | large | NEW `skills/core/implement.md` (+ assets) |
| `executing-plans` | degraded-mode-as-flag pattern (`debate --solo`, `review-code local`) | **DROP-as-skill** | trivial | fold into `implement` as one "Degraded mode" paragraph |
| `using-superpowers` router | thin lazy-router is the universal atomic pattern; 1%-rule is anti-value | **DROP** | trivial | — (persuasion-principles already mapped as T01–T23 in `docs/kb`) |

### Layer B — Discipline

| superpowers skill | atomic equivalent | verdict | cost | internal home |
|---|---|---|---|---|
| `test-driven-development` (workflow) | `fix` Phase 3 + G5 red-phase + G3 anti-tautology; `hunt` | **already-have** | trivial | — |
| `test-driven-development` (pressure-tuned language) | T01/T03/T04 scaffolds in 9/10 core skills | **KEEP-OPTIONAL** | — | rent the phrasing; do not re-derive |
| `systematic-debugging` — 4-phase core | `fix` Observe→Diagnose→Fix→Verify | **already-have** | trivial | — |
| `systematic-debugging` — 3-failed-fixes circuit-breaker | none (fix caps hypotheses, not fix-attempts) | **EXTRACT** | small | EXTEND `fix.md` Phase 4 |
| `systematic-debugging` — multi-component boundary instrumentation | none | **EXTRACT** | small | EXTEND `fix.md` Phase 1 (conditional) |
| aux: root-cause-tracing / defense-in-depth / condition-based-waiting | only referenced (T14/T15/T16), never internalized | **EXTRACT-light** | medium | NEW `skills/shared/debug-techniques.md` (cited by `fix`+`hunt`) |
| `verification-before-completion` | none — partial in `save-and-push` (push-scoped only) | **EXTRACT** | small | NEW `skills/core/verify-claim.md` (or G9 in code-quality-gates) |

### Layer C — Operational / social / meta

| superpowers skill | atomic equivalent | verdict | cost | internal home |
|---|---|---|---|---|
| `dispatching-parallel-agents` | `parallel-dispatch` + `parallel-dispatch-audit` (Q1–Q4 gate, grep-proven disjointness, batch-id, audit) | **EXCEED → DROP** | trivial | replace the 2-line superpowers defer in `parallel-dispatch` with an in-session degraded paragraph |
| `requesting-code-review` | `review-code` (cross-model two-pass, Step-0 mode picker) | **EXCEED → DROP** | trivial | — (optional severity-phrasing tweak) |
| `receiving-code-review` (apply-feedback discipline) | partial — `review-code/plan` apply/edit/skip lacks verify-before-apply + YAGNI-grep | **EXTRACT-light** | small | ~6-line "Receiving findings" block in `review-code` + `review-plan` |
| `finishing-a-development-branch` | `save-and-push` (commit/push/secret-scan/memory) + native `ExitWorktree` | **already-have** | trivial | teardown-ordering caution → `worktree-isolation` helper |
| `using-git-worktrees` | **none (real gap)** — parallel-dispatch concedes lockfile/build collision class it can't solve | **EXTRACT-light** | small | NEW `skills/shared/worktree-isolation.md` (helper, not a core skill) |
| `writing-skills` (CSO + TDD-for-docs methodology) | mechanical only (`new-skill.js` + catalog gate + `validate-skills`) | **EXTRACT-light** | medium | NEW `docs/kb/skill-authoring.md` (authoring reference, NOT runtime) |

**What we already MATCH or EXCEED (drop without replacement):** the router, `dispatching-parallel-agents`, `requesting-code-review`, `finishing-a-development-branch`, `executing-plans`, the TDD/debugging *workflows*. **Genuine gaps to extract:** `brainstorm`/design, the `implement` driver, the per-task No-Placeholders rigor, the debugging circuit-breaker + boundary-instrumentation, a completion-evidence gate, the worktree-isolation helper, and the authoring reference.

---

## 3. New skills to CREATE · existing skills to EXTEND

### Create

| Skill / asset | One-liner | Core mechanism ported |
|---|---|---|
| `skills/core/brainstorm.md` | Idea → committed, approved design doc; heads the chain and removes the lone superpowers delegation. | brainstorming's `NO PLAN WITHOUT AN APPROVED DESIGN` HARD-GATE + one-question-at-a-time discovery + 2-3-approaches-with-recommendation + **the actual gate = a fresh independent design-doc reviewer subagent** (the ported spec-document-reviewer rubric, calibrated "approve unless serious gaps", ceiling 3). |
| `skills/core/implement.md` | The execution driver atomic-skills lacks: read materialized Tasks from `project`, drive them to DONE. | subagent-driven-development: fresh implementer per Task (constructed-never-inherited context), model-tiering (cheap/standard/most-capable), 4-status protocol (DONE/CONCERNS/NEEDS_CONTEXT/BLOCKED, never-force-same-model-retry), strictly-sequential coding, ordered two-stage review (spec-compliance verifier THEN `review-code` for quality). Absorbs `executing-plans` as degraded mode. |
| `skills/core/verify-claim.md` | Per-task completion-evidence gate: no success claim without fresh verification. | verification-before-completion: the 5-step Gate Function + the claim→evidence table (esp. *agent-reports-success → check the VCS diff, not the report*). The convergent completion gate `implement` invokes before marking a Task DONE. |
| `skills/shared/debug-techniques.md` | One lazy reference asset: root-cause-tracing + defense-in-depth + condition-based-waiting. | The three systematic-debugging aux files, language-neutral + template-var'd. Cited by `fix` (Phase 1/2/3) and `hunt` (time-sensitive tests). |
| `skills/shared/worktree-isolation.md` | Helper (not a core skill — no "make me a worktree" user intent) for per-agent filesystem isolation. | using-git-worktrees Step-0 detect-existing-isolation + submodule guard + **prefer native `EnterWorktree`/`ExitWorktree`** (git fallback is the degraded branch) + check-ignore safety + merge-before-remove/provenance teardown. Consumed by `parallel-dispatch` and `implement`. |
| `docs/kb/skill-authoring.md` | Authoring methodology reference (read before writing a skill; NOT callable). | writing-skills CSO finding (description = WHEN-not-WHAT, the basis of the thin-router pattern) + TDD-for-docs pressure-testing recipe (3+ combined pressures), reconciled with template-var + lazy-router conventions. |

### Extend

| Skill | Change |
|---|---|
| `skills/core/debate.md` | Add a **thin gate-mode** that PRODUCES (bounded agenda, mandatory per-round contrarian, structured `ready_for_validation` Synthesis verdict) — it does **not** decide (see §5). |
| `skills/core/fix.md` | Phase 4: fix-attempt counter + 3-failed-fixes architectural circuit-breaker (distinct from the 5-hypothesis cap). Phase 1: conditional boundary-instrumentation step. Cite `debug-techniques.md` lazily. |
| `skills/core/review-code.md` + `review-plan.md` | ~6-line "Receiving findings" block (verify-before-apply, YAGNI-grep, clarify-all) before the apply/edit/skip step — matters most for cross-model codex findings. |
| `src/decompose.js` + `minimal-source.template.md` | No-Placeholders lint (reject/warn `TBD` / "add error handling" / "similar to Task N" / undefined-type refs) **as an enforced check, not advisory**; enrich per-task template with Files block + RED-GREEN checklist. |
| `skills/core/parallel-dispatch.md` | Replace the 2-line superpowers defer with an in-session degraded paragraph; add optional "offer per-agent worktrees via `worktree-isolation` when tasks share lockfile/build/root-config" step. |
| `skills/shared/project-assets/project-create-plan.md` | Rewire Stage 3 Branch A: replace `superpowers:brainstorm` + `superpowers:write-execution-plan` with `invoke atomic-skills:brainstorm → project new plan`. **Sequence after `brainstorm` exists** to avoid a dangling reference. |

---

## 4. The 4-stage model → **collapse to 3**

The user's `brainstorm → design → plan → spec` is **one stage too many and mis-orders WHAT vs HOW.** Both reference SDD systems independently converged on **three** stages and both **fuse "decisions" and "how" into one design stage**: spec-kit (`Specify[WHAT] → Plan[HOW] → Tasks`) even names its HOW-stage "Plan" — the *opposite* of the user's `plan=what` label; Kiro (`requirements[WHAT] → design[HOW+decisions] → tasks`) explicitly "collapses plan into design — no separate planning document." Neither ships a standalone "what" doc followed by a standalone "how" doc, because the WHAT (task title) and HOW (task body) are the **same node** — splitting them into two documents is pure redundancy that `decompose.js` would have to re-merge.

**What collapses:** (a) **brainstorm is not a peer stage** — it is the divergent front-half of DESIGN (a `debate` run feeding the design doc's Decisions section, no separate artifact). (b) **plan(what)/spec(how) collapse** — HOW is not a 4th document; it is the per-task interior carried inside `### Tn` bodies and materialized into existing `initiative.schema.json` fields.

### The 3 stages atomic-skills owns

```
 DESIGN ─gate→ PLAN ─gate→ DECOMPOSE+SPEC ─gate→ IMPLEMENT
```

| Stage | Owning skill | Artifact | Lands in `.atomic-skills/` | Gate | Feeds decompose |
|---|---|---|---|---|---|
| **1. DESIGN** (brainstorm front-half + decisions + WHAT + chosen approach) | NEW `brainstorm` (delegates divergence to `debate`) | committed multi-section design doc (Context/Problem · Decisions[WHAT/WHY] · Chosen-approach[HOW, 2-3 options + recommendation] · Non-goals · Open-questions) | **`designs/<slug>-design.md`** (NEW canonical dir; retire `docs/superpowers/specs/` as a write target, archive existing) | `debate` gate-mode (panel argues) **THEN** an independent design-doc reviewer subagent emits the binary verdict **THEN** user-approval HARD-GATE | Approved Decisions+Approach seed the PLAN source markdown; terminal action = `project new plan` |
| **2. PLAN** (the WHAT map) | EXISTING `project` `new plan` + `decompose.js` (NO new skill, NO 4th doc) | decompose-shaped source markdown (`## F0/F1` phases + `Goal:` + `### Tn` + fenced `exit_gate` YAML) | `_drafts/<slug>-source.md` (transient) → `plans/<slug>.md` + `initiatives/<slug>-<phaseId>.md` | `debate` gate-mode (only on a genuine fork) **THEN** `review-plan` (cross-model + cross-artifact + initiative-depth) | `decomposePlan()` → `materializeDecomposition()` |
| **3. DECOMPOSE+SPEC** (the per-task HOW) | `decompose.js` transform + `project` materialize | materialized Task fields: `description` (HOW prose), `acceptance[]` (testable spec, ≤5), `scopeBoundary[]`, `verifier`, phase `exitGates[]` | `initiatives/*.md` | `review-plan` initiative-depth checks (every exit gate has a covering task) **THEN** at execution, `implement`'s `verify-claim` completion gate | Tasks read by `implement` |

**WHAT/HOW mapping onto the schema (proves no 4th doc is needed):** WHAT = `Plan.phases[].goal` + `Initiative.tasks[].title`; HOW = `task.description` + `acceptance[]` + `scopeBoundary[]` + `verifier` + `exit_gate.criteria[]` — **all already in `initiative.schema.json`.** `decompose.js` stays unchanged: the `## F0 / ### Tn / exit_gate` contract IS the canonical PLAN shape, we own the target format, so no adapter is needed — only the per-task RIGOR transplant.

---

## 5. The debate-as-stage-gate engine — and the honest gate rule

### Resolve divergent-vs-convergent: debate PRODUCES, it does not DECIDE

The marquee "debate replicates AND exceeds the reviewer loop" claim is **rejected as stated** — it inverts debate's load-bearing identity. `debate.md:5-6` ("you facilitate — you never speak for the agents… recommendation only as a closing move, on demand or at exit"), `:188` (stuck panel → "ask the user which angle to explore next"), `:215` (no running synthesis). A gate must DECIDE and run automatically at stage close; debate measures *perspective spread*, not *artifact completeness*. The cited MAD literature (arXiv 2509.23055, 2509.05396) shows a consensus panel is a **worse** gate — sycophancy/conformity make it converge on a wrong answer and commit it as PASS.

**The architecture is actor-critic, and the gate is the critic:**
- **Actor = `debate`** (R1 divergence + R2 Orchestrator Synthesis): produces the artifact and preserved dissent. Genuinely exceeds superpowers' single reviewer *at producing divergence*.
- **Critic = a separate fresh, evidence-checked validator subagent** (R3): emits the binary `Approved / Issues-Found` verdict. This is honestly a **re-derivation of superpowers' spec-document-reviewer** — so we port *that* rubric directly rather than pretending debate replaces it.

Wire gate-pass to **R3, never to "the panel agreed."** A future edit collapsing R3 into panel-consensus breaks the gate.

### The `brainstorm` engine (replaces the lone delegation)

`B0 Frame` (no subagents: glob/grep/read, multi-subsystem scope check, frame 3–7 decision questions = the debate agenda) → `B1 Diverge/R1` (`atomic-skills:debate`, default 3 **heterogeneous** voices + **mandatory contrarian**) → `B2 Decide/R2` (Orchestrator Synthesis; **ratified by the USER, not the panel**; dissent → Rejected-alternatives) → `B3 Write` design doc under G1/G2/G6 + commit → `B4 Validate/R3` (**the actual gate**: independent design-doc reviewer subagent, fresh context, *not* a debate persona, most-capable tier, binary verdict, **ceiling 3**, escalate-never-iterate-4-never-silent-advance; verify-before-fix to defend against critic hallucination) → `B5 Handoff` to `project new plan`.

**Net-new debate work (the only change to `debate.md`):** a thin gate-mode that (1) bounds the agenda (not open chat), (2) mandates a per-round contrarian (today reactive only), (3) emits a structured machine-readable Synthesis verdict (`ready_for_validation: yes/no` + `open_questions`), (4) guarantees heterogeneity. The cap **bounds cost, not ambiguity** — R3 still decides.

### The honest, magnitude-scaled gate ladder

| Stage | Divergence value | Gate |
|---|---|---|
| **DESIGN** | high (≥2 viable approaches, expensive-to-reverse: architecture / data-model / public contract / one-way-door) | `debate` panel (earns its multiplicative cost) **THEN** independent R3 design-doc reviewer (decides) + user approval |
| **PLAN** | occasional (phase boundaries, sequencing) | `review-plan --mode=local` single pass (already exists, max-3) — `debate` **only** if a real fork survives DESIGN |
| **SPEC / per-task** | ~none (mechanical authoring) | **No panel.** No-Placeholders **lint** (deterministic, zero-token) + `review-plan` task-ambiguity checks |

Rationale: a 2-4-voice panel per round × up-to-3 iterations × 4 stages ≈ 36–60 subagent spawns before one line of code — defensible at DESIGN, pure ceremony at PLAN/SPEC where a lint + one reviewer strictly dominate. **R1 is conditional on divergence-worthiness; the gate (R3 / lint) applies at every stage; R2 only when R1 ran.** This mirrors the existing `parallel-dispatch` Q1–Q4 "prove the benefit before spawning" pattern.

---

## 6. Own-vs-depend: the final call

**PARTIAL drop, not full drop.** The break-even rule:

- **OWN** when the artifact format or state model is atomic-skills-specific → `brainstorm`/design and `implement`. These head the `brainstorm→plan→decompose→implement` chain we control, consume the Plan/Initiative/Task state + decompose-shaped markdown only we produce, and superpowers' equivalents are coupled to a foreign format (`### Task N` that `decompose.js` THROWS on) or to four other superpowers skills. Depending would force our core workflow to bend around a foreign artifact shape.
- **RENT (KEEP-OPTIONAL detect-and-degrade)** when the value is pressure-tuned discipline *phrasing* over a workflow we already own → the discipline trio (TDD language, debugging aux, pressure calibration). `fix`+`hunt` own the workflow; the only residual value is model-specific, upstream-maintained phrasing — **expensive to reproduce and expensive to re-pressure-test on every model bump, and not a differentiator.** Owning it inherits a recurring re-validation bill (the parahuman premise of persuasion-principles means a new model rationalizes differently); upstream re-tunes this across versions for free. The marginal cost of leaving the existing opt-in detection probe in place is ~zero, and it already degrades gracefully.
- **DROP-cleanly** when we already meet-or-exceed → cross-model review, cross-session dispatch, the router, worktrees-via-native-harness, branch-finish.

**Full drop is wrong** because it pushes uniformly across all three lines, maximizing NIH waste on the rent/drop categories to "remove" a dependency the repo itself calls "an optimization, not a dependency."

---

## 7. Risks & mitigations

| # | Risk | Sev | Mitigation |
|---|---|---|---|
| R1 | **False premise** — "drop the dependency" inflates a 2-line edit into a multi-skill build. | **BLOCKER** | Reframe to "delete the 2 opt-in delegation lines + build only what's differentiated." Judge each new skill on its own cost, not a dependency-removal banner. (§1, §6) |
| R2 | **debate-as-gate inverts debate's identity** — a gate must DECIDE; debate must NOT. | **BLOCKER** | Keep `debate` as the divergent facilitator (actor). The GATE is a separate fresh evidence-checked validator (R3), which is the ported spec-document-reviewer. Never wire pass to panel consensus. (§5) |
| R3 | **Pressure-test provenance discarded** — hand-written Iron-Law/Red-Flags blocks LOOK hardened but aren't tested → false confidence, strictly worse than renting. | **MAJOR** | **Budget pressure-testing as a first-class line item:** for every new Iron Law / Red-Flags / Rationalization block in `brainstorm`+`implement`, run the testing-skills-with-subagents recipe (3+ combined-pressure scenarios via subagents) BEFORE shipping. `skill-authoring.md` is the method; *running it* is part of build cost. |
| R4 | **`implement` mis-sized** — it drags in 4 coupled superpowers skills (worktrees, review, branch-finish, 3 prompt assets) + must agree with `project` transitions. | **MAJOR** | Right-size: skill + `worktree-isolation` helper (defer to native `EnterWorktree`/`ExitWorktree`) + a NEW spec-compliance verifier (distinct from `review-code`'s quality lens) + 3 prompt assets + degraded inline fallback + project-transition wiring. Build AFTER `brainstorm`. |
| R5 | **Maintenance/drift tail uncounted** — owned discipline language needs re-validation per model generation; upstream gets it free. | **MAJOR** | Keep the discipline layer RENTED (KEEP-OPTIONAL); leave the detect-and-degrade probe in place as a reversibility hedge. Only OWN what is differentiated (design, implement, the lint). |
| R6 | **Conformity false-pass** — cheapest impl of "debate gates" is "advance when panel agrees" (a conformity trap per cited MAD literature). | **MAJOR** | Gate-pass comes only from R3 + mandatory per-round contrarian + heterogeneous roster + dissent preserved. (§5) |
| R7 | **Cost multiplicative on cheap stages** — panel × rounds × stages is overkill at PLAN/SPEC. | **MAJOR** | Magnitude-scaled ladder: panel at DESIGN only; `review-plan` single-pass at PLAN; lint at SPEC. (§5) |
| R8 | **No standalone SPEC doc** — if task bodies are written thin, HOW is lost with no document to catch it. | MAJOR | The No-Placeholders **lint must be enforced, not advisory** — it is the only backstop. (§3, §4) |
| R9 | **Naming collision** — spec-kit "Plan" = HOW; atomic "plan" = WHAT-map. | MINOR | Docs state explicitly: atomic-skills PLAN = decompose source (WHAT map); HOW = task interior. |
| R10 | **`designs/` unknown to `project verify` + schemas** — schemaless v0.1 leaves malformed docs uncaught. | MINOR | Ship prose-only at v0.1 (acceptable for narrative); optionally add `meta/schemas/design.schema.json` + verify coverage later if the "everything validates" invariant must hold. |
| R11 | **Sequencing** — rewiring project-create-plan before `brainstorm` exists leaves a dangling reference. | MINOR | Build `brainstorm` first; rewire Stage 3 only after. (§8) |
| R12 | **Roster homogeneity** — default roster is one software team → correlated, not orthogonal, voices. | MINOR | Require cross-domain voices + ≥1 mandatory contrarian per round when debate IS used. |

---

## 8. Build sequence (smallest valuable increment first)

> **The fix-superpowers-wiring item on the earlier roadmap is MOOT.** We are not fixing the delegation — Step 0 deletes/replaces it once `brainstorm` exists. Do not invest in repairing Branch A's superpowers calls.

**Increment 0 — trivial, ship today, no `project` changes, no new skills.** Replace the 2-line superpowers defer in `parallel-dispatch.md` with an in-session degraded paragraph; remove the `using-superpowers`/router framing. Pure housekeeping; reversible.

**Increment 1 — cheap discipline + verification wins (no `project`, no `implement`).**
1. NEW `skills/core/verify-claim.md` (completion-evidence gate — small, highest-leverage, citeable everywhere). **Pressure-test before shipping.**
2. EXTEND `fix.md` (3-failed-fixes circuit-breaker + boundary-instrumentation) + NEW `skills/shared/debug-techniques.md`.
3. "Receiving findings" block in `review-code` + `review-plan`.
4. NEW `docs/kb/skill-authoring.md` (the methodology we need *before* writing increments 2-3 — sequence it here so the new skills are pressure-tested, not decorative).

**Increment 2 — the `brainstorm`/DESIGN stage (medium; first thing that touches the chain).**
5. NEW `skills/core/brainstorm.md` + assets (B0–B5; R3 independent reviewer; ceiling 3). **Pressure-test the Iron Law/Red-Flags.**
6. Add the thin **gate-mode** to `debate.md` (bounded agenda, mandatory contrarian, structured verdict).
7. NEW `.atomic-skills/designs/` dir; retire `docs/superpowers/specs/` as write target (archive existing).
8. **Only now** rewire `project-create-plan.md` Stage 3 Branch A → `invoke atomic-skills:brainstorm → project new plan`.

**Increment 3 — PLAN per-task rigor (small; extends `project`/decompose).**
9. No-Placeholders **enforced lint** in `decompose.js` + enriched `minimal-source.template.md`. Front the plan stage with `debate` (fork-only) → `review-plan`.

**Increment 4 — the `implement` execution driver (large; HIGHEST value, most coupling; build last).**
10. NEW `skills/shared/worktree-isolation.md` helper (defer to native `EnterWorktree`/`ExitWorktree`).
11. NEW `skills/core/implement.md`: read Tasks from `project`, fresh implementer per Task, model-tiering, 4-status protocol, sequential coding, spec-compliance verifier THEN `review-code`, drive `project` transitions on DONE, gate each completion with `verify-claim` (from Increment 1), absorb `executing-plans` as degraded mode.

**What ships without touching `project`:** Increments 0, 1, and the `debate` gate-mode + `brainstorm` skill body (the `project-create-plan` rewire in step 8 is the only `project`-adjacent touch in Increment 2). Increments 3-4 are where `project`/decompose integration concentrates.