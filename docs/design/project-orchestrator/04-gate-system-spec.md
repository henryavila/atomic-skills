# Gate System Spec — atomic-skills `project` lifecycle

> Scope: the QUALITY-gate system layered onto `project`'s state machine (DESIGN → PLAN → SPEC → IMPLEMENT → VERIFY). This spec honors the critique: it cuts overclaimed gates, grounds every "builds on" against the actual repo, bounds the ladder, and ships a **minimal hard set of three** plus conditional/advisory extras. Skill bodies are EN-only and use template vars (`{{BASH_TOOL}}`, `{{READ_TOOL}}`, `{{ASK_USER_QUESTION_TOOL}}`, `{{INVESTIGATOR_TOOL}}`).

---

## 1. The principle: what makes a gate MEASURE something

A gate measures something real only if you can name a concrete defect that turns it RED **and** name the laziest output that still passes — and then show that lazy output is foreclosed by a mechanism the producer cannot self-grant. Operationally that means four non-negotiables: **falsifiable** (a real broken state makes it fail), **externally adjudicated** (a separate subagent, an executed command, the schema validator, or the user — never the producing turn grading itself), **stop-the-line** (a RED blocks the next transition; it does not WARN-and-proceed), and **evidence-bearing** (a re-examinable transcript/observation, never a bare `true`). A gate that fails any one of these is theater: if you cannot fill in *"FAILS when ⟨defect⟩; cheapest pass is ⟨X⟩; foreclosed by ⟨mechanism⟩"* the gate measures nothing and must be cut or demoted to advisory.

Two repo-grounded corollaries the critique forces us to internalize: (a) coverage % is banned as evidence everywhere — the gate currency is **killed mutants + classified transcripts**, not numbers (the repo already shipped `parsePort`/F-002: 100% coverage on dead code); (b) any "met-only-when…" invariant that lives only in markdown is self-graded — it must run in `validate-state.js`, the one deterministic check that actually executes today.

---

## 2. THE GATE MAP

Hard/line-stopping gates are **bold**. Conditional gates fire only on a router-evaluable predicate. Advisory gates WARN. Substrate is marked **[extend]** (real today) or **[build-new]** (does not exist — the critique-confirmed vapor).

| Gate | Stage | What it MEASURES (real signal) | Enforcement | Builds on | Fakeable-risk + counter |
|---|---|---|---|---|---|
| **SPEC-LINT (string-scan only)** | spec | A literal placeholder/soft-word in a task/criterion/verifier field. RED when `TODO`/`REPLACE_*`/`FIXME`/`???`/G2 ban-word (unless prefixed `unverified:`) appears. | Deterministic. **[build-new]** function in `scripts/validate-state.js` → `npm run validate-state` exits non-zero. | `validate-state.js` (Ajv validator today, no string scan), G2, G6, `REPLACE_*` convention. | Author paraphrases placeholder into clean-but-vague prose. Counter: this gate **only** claims the byte-level scan; vagueness/EARS is handed to PLAN-REVIEW (judgement, honestly labeled) — not smuggled in as "deterministic". |
| **VERIFY-ON-DONE (executed, paranoid REDs)** | verify-auto | A criterion's shell/test/query verifier actually passes when executed. RED on `exit≠0` / `0-tests-collected` / `runner-not-found`. | Executed via `{{BASH_TOOL}}` behind y/N. **[extend]** `kind:shell` (already runs) to `kind:test`+`kind:query` (today **stubbed**, ask user to run externally). Cross-field met-invariant runs in `validate-state.js`. | `project-transitions.md` §kind:shell; `common.schema.json` evidence (`passed` already stored separately, line 158). | A stub records `passed:true` without running (today's hole); user override silently flips to met. Counter: actually execute; three paranoid REDs keep status `pending`; override writes `passed:false`+`deferredReason` so waved-through ≠ verified. |
| **BEHAVIORAL-TEST / mutation-kill (G9)** | implement | A test asserts observable behavior, not implementation: a named behavioral mutant (`return null`/flip `>=`→`>`/`return []`/swap `+`/`-`) makes ≥1 test go RED, revert restores GREEN. A surviving mutant = tautological/mock-only test → HARD FAIL. | Executed; **wired INTO** VERIFY-ON-DONE for `kind:test` (not just `fix.md` prose). **[build-new]** mutation step + **[extend]** schema. | G3 (mutation question, now executable), `hunt.md`, `fix.md` Phase 3e. | Mutate a structure-only line / dead code → vacuous kill. Counter: mutation must map to a stated acceptance criterion in behavior space; a non-killing behavioral mutation is a HARD FAIL (the F-002 case). |
| **MANUAL-ACCEPTANCE** | verify-manual | The USER, observing the **running** increment, reports a specific observed-vs-expected fact. RED when observed ≠ expected, or app not demoable (→ stays `pending`, never auto-met). | User verdict via `{{ASK_USER_QUESTION_TOOL}}`; demoable-state precond via `{{BASH_TOOL}}`. **[extend]** schema `kind:manual`; **[rewrite]** the y/N rubber stamp. | `common.schema.json` `kind:manual` (prose-only today, line 131); evidence block; built-in `run`/`verify` skills. | Press `y` without running; write "looks good". Counter: must paste the **observed result of the EXPECT step** (a fact only visible from the running app); G2 bans "works"; met requires `passed===true` AND non-empty `outputSummary`. |
| PLAN-REVIEW *(conditional)* | plan | Plan is dependency-sound, internally consistent, free of vague tasks. Returns Issues-Found with plan line numbers; loops to zero major+ findings. | Skill (`review-plan`). Codex cross-model only when stakes justify. **[extend]** existing. | `review-plan.md` (modes exist), G6, G2. | Self-loop rubber-stamps; "ok" with no citation. Counter: Iron Law rejects un-cited "ok"; sealed-envelope strips intent for codex. |
| PHASE-REVIEW *(conditional)* | cross-cutting | Phase diff survives adversarial review before advance. Fires when diff > N lines OR > M files OR `lastReviewedCommit` drift. | Skill (`review-code`) at `phase-done`; `--skip-review` reason **surfaced at archive**. **[extend]** existing. | `review-code.md`, phase-done step 6, last-review tracking. | Routine `--skip-review`. Counter: skip reason recorded verbatim AND surfaced loudly at archive; codex-tracking shows un-reviewed drift. |
| DESIGN-CRITIC *(deferred to v2)* | design | A chosen design survives a fresh, evidence-checked critic that did not produce it. Binary Approved/Issues-Found, ceiling 3, then escalate (never auto-approve). | Subagent critic. **[build-new]** — no critic mechanism or tracked DESIGN stage exists. | `debate.md` (independent subagents exist; the binary-verdict critic + DESIGN stage do not). | Actor grades own brainstorm; orchestrator role-plays critic. Counter: separately-spawned, no actor context, binary verdict, + user approval. **Held for v2** pending the "is DESIGN a tracked stage?" decision. |

**Andon rule (all hard gates):** a RED BLOCKS the transition (`done`/`phase-done`/`archive`). Only an explicit, recorded user override passes a red, stored as `passed:false`+`deferredReason`. WARN is reserved strictly for advisory coherence checks (`verify`'s branch/scope/orphan warnings) — never for correctness gates.

---

## 3. REAL TDD as the implement gate (G9 — Behavioral-test gate)

**Philosophy.** Kent Beck's two load-bearing desiderata define a real test: **BEHAVIORAL** (the result changes iff behavior changes) and **STRUCTURE-INSENSITIVE** (a pure refactor must not change the result). Every fake-TDD anti-pattern violates exactly one — a tautological/mock-verification test is structure-sensitive and behavior-insensitive, so it breaks on refactor yet lets real bugs through. The honest conclusion the critique forces: **red-FIRST is NOT enforceable against an agent** — timestamps are spoofable and a perfect red→green→kill transcript is reproducible at will via `git stash`/pop for 100%-test-after code. So we **rename the gate from "Real-TDD/red-first" to "Behavioral-test gate"** and gate on the one oracle that *is* non-fakeable: the mutation-kill. Test-first stays as cultural guidance (it drives design — keep it in `fix.md`), but it is not the gated claim. This is not a retreat: Beck/Fowler/DHH all agree the universal goal is **self-testing code, not ritual** — a test-after test that kills mutants is acceptable; a test that survives mutation is not, whenever it was written.

**The enforceable rules (non-fakeable):**

1. **Mutation-kill (the gate).** For the behavior being closed, inject ≥1 *behavioral* mutation into production code at a recorded `file:line`, re-run → ≥1 named test must go RED (mutant killed), then revert → GREEN restored. The mutation must live in **behavior space** (a value/branch the spec cares about), mapped to a stated acceptance criterion — never structure space (renaming a private symbol leaves tests green and proves nothing). A surviving behavioral mutant is a HARD FAIL: the test is tautological, tests the mock, or the code is dead (F-002).
2. **Behavior-not-implementation / anti-mock (cultural, oracle-enforced).** Assert return value/observable state, not collaborator interactions on your own code. **Detroit default:** mock ONLY process boundaries (DB/network/clock/filesystem/subprocess). Port obra/superpowers heuristics into the lint + `review-code` checklist: flag (a) assertions on mock call-counts/args, (b) mock-setup > 50% of test body, (c) test passes when the mock is removed, (d) mocking your own code. These are tripwires; the mutation-kill is the real defense (mocking your own collaborator hides the defect behind the mock and makes the kill vacuous — which the scan surfaces first).
3. **RED-proof (downgraded to guidance, not a gate).** Capturing a classified RED transcript (assertion failure, not `ImportError`/`0-tests-collected`) stays in `fix.md`/`hunt.md` as discipline and informs the developer. It is NOT a met-condition, because it is spoofable. Do not manufacture checkbox RED transcripts.

**Wiring into VERIFY-ON-DONE (the critique's key fix).** The mutation-kill is **not** a separate `fix.md`-only artifact. At `done`/`phase-done` for a `kind:test` criterion, the executed flow (one y/N) runs: (a) pattern → GREEN, (b) apply recorded mutation → require RED, (c) revert → GREEN. Without this, VERIFY-ON-DONE green-lights a tautological test — the exact gap the repo already shipped.

**Cross-model case (Codex/Sonnet executor).** Judge from the committed test + its runs, never the executor's narrative. The adjudicator is **re-execution**: re-run pattern at HEAD → GREEN; apply the recorded mutation → RED; revert → GREEN. (Re-running at a `preImplRef` is dropped as a hard requirement — it's the spoofable red-first claim and is "expensive or impossible if test+impl share a commit." The mutation-kill at HEAD is the load-bearing check.)

**Honest enforceable-vs-cultural line (state verbatim in G9 body):**
- ENFORCEABLE (script/CI-checkable): mutation-kill transcript + revert; GREEN pass via executed pattern; mock-heuristic scan; the cross-field met-invariant in `validate-state.js`.
- CULTURAL (judgement; mutation oracle is the real defense): "asserts behavior not implementation", "test-first". Git-timestamp ordering is spoofable — do NOT rely on it. Coverage % is BANNED as evidence (F-002).

**Magnitude floor.** Mutation-kill is required ONLY for criteria touching decision/branch logic OR money/auth/data-integrity paths. Pure wiring, constants, and doc/config changes need a single behavioral test, no mutation ceremony (avoids the DoD-overload that trains rubber-stamping). View-heavy/UX work routes its weight to MANUAL-ACCEPTANCE instead of forced TDD.

---

## 4. THE MANUAL USER-VALIDATION GATE

The user's "immense gain" feature. Today's `kind:manual` (`{kind, description}` + "Confirm met? y/n/defer") is the textbook vanity gate. The upgrade has an **applicability predicate first**, then three jobs, then a real mandate.

**Applicability predicate (cut the critique's "evasion-or-N/A" ambiguity).** A criterion is **user-visible** iff it changes observable runtime behavior a human consumes: a UI page/flow, CLI output a human reads, an API response a human inspects, a rendered report. Refactors, library internals, schema migrations, infra/config have **zero** user-visible criteria → the manual gate is genuinely **N/A (absent, not deferred)**. **Non-UI deterministic checks (`curl | jq` with an expected value) are NOT manual gates** — by the test-pyramid rule they are `kind:shell`/`query` verifiers under VERIFY-ON-DONE. `kind:manual` is reserved strictly for **human-judgement** observations (visual correctness, UX feel, "does the report read right") and must carry a one-line reason why automation cannot make the call, or it is downgraded at review.

**Job 1 — Demoable-state precondition.** Before showing any script, run the verifier's `demoCommand` via `{{BASH_TOOL}}` behind y/N. UI: reuse built-in `run`/`verify` to launch + confirm the path is reachable. If the increment cannot reach a demoable state, the criterion stays `pending` (or `deferred`, reason `not-yet-demoable`) — never auto-met. A gate over un-runnable software measures nothing.

**Job 2 — Generated step-by-step script.** Keep the criterion declarative (UI-stable: Given/When/Then, the `then` is the observable expected result); expand into an **imperative numbered script** a non-author follows literally, with **concrete data** (Spec-by-Example), one behavior, < 10 steps:

```
Manual validation — criterion C-3 "dashboard renders the active initiative"
Demoable state: app running at http://localhost:5173 (verified via `run`)
Steps:
  1. Open http://localhost:5173
  2. In the project picker, select project "atomic-skills"
  3. Click the "Initiatives" tab
EXPECT:
  - One card per initiative in .atomic-skills/initiatives/
  - The active initiative's card is highlighted (left-border accent)
What did you observe? (paste the actual result, e.g. "saw 4 cards, 'v3-foundation' highlighted")
```

**Job 3 — Trustworthy verdict.** Ask the user to **paste the OBSERVED result** of the EXPECT step. Derive `passed` from observed-vs-expected. Stamp `evidence{ verifierKind:manual, verifiedAt, passed, outputSummary:"<observation> — confirmed by <approver> at <ISO>" }`. `status:met` ONLY when `passed===true` AND `outputSummary` non-empty (G2 rejects "works"/"looks good"). On mismatch → route to `atomic-skills:fix`. Record approver via `context.ratifiedBy='human'` for the end gate.

**Elevated schema (`kind:manual`):** add optional-but-linted `demoCommand`, `fallbackKind (ui|cli|library|api)`, `steps[]`, `expected[]`, `data`. `evidence` shape unchanged — only its population changes. Backward compatible (prose-only manual verifiers still validate).

**Two placements + the REAL mandate.**
- **(a) Per-criterion, opportunistic** at `done`/`phase-done` (cheap, scoped — use the scripted flow, not the blanket ack).
- **(b) Mandatory end-of-plan acceptance** at `archive`/`plan-done`. The critique's killer point: today's archive bulk-defers ("mark remaining gates deferred with a reason"), so "mandatory" = type-a-sentence-and-proceed. **Fix the asymmetry so the honest path is the cheap path:** for user-visible criteria, **defer must cost MORE than run** — each deferred user-visible criterion requires a **second explicit human confirmation** and the **deferred count is surfaced loudly** in the archive summary + aiDeck gate-evidence view. N/A criteria (no user-visible surface) are absent, not deferred — so the gate has zero friction where it doesn't apply and real teeth where it does. A completion with > 0 user-visible criteria and zero validated is inadmissible.

---

## 5. New / amended requirements

| id | requirement | acceptance | priority |
|---|---|---|---|
| GATE-R1 | Un-stub `kind:test`+`kind:query` in `project-transitions.md`: execute via `{{BASH_TOOL}}` behind y/N, capture real exitCode/tests-collected/rowCount; enforce 3 paranoid REDs (exit≠0, 0-tests, runner-not-found → stays `pending`). | The two sections no longer say "v0.1: stubbed"; a fixture criterion that is intentionally broken (or collects 0 tests) leaves `status:pending` and `phase-done` refuses to advance; override writes `passed:false`+`deferredReason`. | **blocker** |
| GATE-R2 | Move the cross-field met-invariant into `validate-state.js`: a criterion with `status:met` and `verifier.kind∈{shell,test,query}` MUST have `evidence.passed===true` (and for `test`, mutation-kill fields present); else FAIL. | `npm run validate-state` exits non-zero on a `met` criterion with `passed:false` or missing kill evidence. Invariant runs in CI/`verify`, not skill prose. | **blocker** |
| GATE-R3 | Build SPEC-LINT string-scan in `validate-state.js`: reject `TODO`/`REPLACE_*`/`FIXME`/`???`/G2 ban-words (unless `unverified:`) in task/criterion/verifier fields. Drop the "EARS deterministic" claim; route vagueness to PLAN-REVIEW. | `npm run validate-state` fails red on a spec containing a banned literal; no EARS grammar check in the script. All `decompose.js` references deleted from docs. | **blocker** |
| GATE-R4 | Rewrite `kind:manual` flow: applicability predicate → demoable-state precond (`demoCommand`, blocks if un-demoable) → generated scripted steps with concrete data → observed-result verdict (`passed` from observed-vs-expected). Replace the blanket y/n/defer. | Section specifies precond + script + observed-result capture; `met` requires `passed===true` AND non-empty `outputSummary`; mismatch routes to `fix`; non-UI deterministic checks reclassified to shell/query. | **blocker** |
| GATE-R5 | Make the end-of-plan manual gate genuinely mandatory: N/A criteria are absent; user-visible defers require a **second** human confirmation each + loud count in archive summary + aiDeck. Remove the symmetric bulk-defer. | `archive` on an initiative with > 0 user-visible criteria refuses to complete unless each is met-with-evidence or doubly-confirmed-deferred; deferred count surfaced. | **blocker** |
| GATE-R6 | Add **G9 (Behavioral-test gate)** to `code-quality-gates.md`: mutation-kill as the gated claim; red-first explicitly cultural/spoofable; coverage% banned; anti-mock heuristics + Detroit-default. Wire mutation-kill INTO VERIFY-ON-DONE for `kind:test`. Update rule×skill matrix. | G9 has Rule/Failure-it-catches/Bad/Good/Applies-to + failure-proof line, cites testdesiderata.com + Fowler; matrix row added; `fix.md` Phase 3e + `hunt.md` self-review list the heuristics. | core |
| GATE-R7 | Extend `common.schema.json`: `kind:test` gains mutation fields (`target`,`change`,`killedBy`,`killTranscript`); `kind:manual` gains `demoCommand`/`fallbackKind`/`steps[]`/`expected[]`/`data` — all optional. Resolve schema-bump as a precondition (see §6). | Schema validates new fields; prose-only manual verifiers still validate; schemaVersion decision recorded before R1–R5 start. | core |
| GATE-R8 | Add **G10 (Gate-must-be-able-to-fail)** to `code-quality-gates.md`: every gate carries a failure-proof ("FAILS when ⟨defect⟩; cheapest pass ⟨X⟩; foreclosed by ⟨mechanism⟩"). Wire into `project` + `verify` self-review. | G10 has Bad (`manual: verify it works` / stubbed `passed:true`) vs Good (scripted observation / executed verifier with paranoid REDs); every gate in §2 has a fillable failure-proof. | core |
| GATE-R9 | Calibrate heavy gates with router-evaluable predicates: mutation-kill only on decision-logic/critical-path criteria; PHASE-REVIEW codex only on diff>N lines OR >M files OR review-drift; DESIGN-CRITIC panel only on ≥2-viable-AND-expensive-to-reverse. Gates with no crisp predicate default to **advisory**. | Each conditional gate states its predicate; `--skip-review` reason surfaced at archive. | nice-to-have |
| GATE-R10 | Defer DESIGN-CRITIC to v2: resolve "is DESIGN a tracked lifecycle stage?" + build the critic-spawn procedure before counting it as a gate. | DESIGN-CRITIC not in the v1 hard or conditional set; tracked as a v2 design decision. | nice-to-have |

---

## 6. Minimal-viable set vs full set + open decisions

**Minimal-viable hard set (ship these first, unconditional, line-stopping) — the gates that genuinely earn their cost:**
1. **VERIFY-ON-DONE un-stubbed + paranoid REDs** (GATE-R1/R2) — *highest value*: closes the fabricated-`passed:true` hole that exists in code TODAY.
2. **BEHAVIORAL-TEST / mutation-kill (G9), wired into VERIFY-ON-DONE** (GATE-R6) — the one non-fakeable TDD-adjacent oracle; a surviving mutant is a hard, re-runnable RED.
3. **SPEC-LINT string-scan** (GATE-R3) — the cheapest real gate; a literal `TODO` cannot pass. (String-scan only — EARS dropped.)
4. **MANUAL-ACCEPTANCE for user-visible criteria, mandatory at end with asymmetric defer** (GATE-R4/R5) — the user's headline feature; earns its keep specifically for observable UI/UX behavior.

**Full set adds (conditional/advisory, second iteration):** PLAN-REVIEW (extend existing `review-plan`), PHASE-REVIEW (extend existing `review-code`, with calibrated predicate + surfaced skips), DESIGN-CRITIC (build-new, deferred to v2). These pay off only on medium-to-high divergence / expensive-to-reverse work — gate them behind GATE-R9 predicates so the ladder doesn't go uniform-heavy and get rubber-stamped.

**Cut/demoted per critique:** red-first temporal enforcement (spoofable → cultural, not gated); the EARS "deterministic lint" (judgement → moved to PLAN-REVIEW); `preImplRef` re-execution (impractical → mutation-kill at HEAD instead); DESIGN-CRITIC (vapor → v2); the bulk-defer escape hatch (broke the mandate → asymmetric defer).

**Open decisions for the user:**
1. **Schema bump (precondition, not footnote).** Two blocker gates (R7's `kind:test` mutation fields, `kind:manual` fields) need `common.schema.json` extended; it is frozen at 0.1 and mirrors aiDeck (mid-rewrite). **Decide before R1–R5 start:** (a) bump to 0.2 + migration + aiDeck sync (clean, validatable), or (b) accept evidence-in-`outputSummary` prose and **downgrade** those gates from "machine-checked met-invariant" to "recorded-but-trusted" (and say so honestly). Recommend (a), since 0.1 additions are additive-optional.
2. **Mutation selection authority.** If the executor picks the mutation, it can pick one its test trivially catches. Require the mutation to map to a named acceptance criterion, and/or have `review-code`/DESIGN-CRITIC pick it adversarially?
3. **Task-level evidence home.** Per-task verifier results are a one-line note in the task `description` today; the v0.1 Task schema has no `evidence` block. Add `Task.evidence` (couples to the schema-bump decision) or keep the note workaround until phase-level criteria carry formal evidence?
4. **PHASE-REVIEW thresholds.** Pick concrete N (lines) / M (files) / drift count for the codex-mode predicate (Sonar's 20-new-lines is the cited precedent).
5. **DESIGN as a tracked stage (v2).** Is DESIGN a persisted lifecycle stage in `.atomic-skills/` (with a critic verdict artifact), or a pre-plan `debate`-driven activity whose only output is the plan PLAN-REVIEW then gates?