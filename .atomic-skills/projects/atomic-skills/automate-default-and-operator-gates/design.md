# Design — Automate default + operator gates

## Context

`atomic-skills:implement` gained pure-maestro **automate** mode via archived plans
`implementation-automate-mode`, `automate-skill-discipline`, and `implement-phase-agents`.
Automate was deliberately **opt-in** (`--mode=automate` + durable stamp). Decision-review
and plan-end gates exist in prose and machine helpers, but the first real multi-phase
dogfood (Lekto `llm-api-integration`, dump
`2026-07-24-implement-automate-session.md`) showed three operator-facing failures:

1. Operators expect **automate by default** when they run `implement`, not Mode 1
   session-writer. Original design Decision 1 (“Opt-in mode, not a new default”) is
   reversed by product demand after dogfood.
2. **decision-review PASS** is asked without the host **displaying** the phase decision
   log — operators approve blind (0 FAIL across F0–F7 in dogfood). Prose says “open
   `decisions/<phaseId>.jsonl`”; the hardgate turn does not present it.
3. Plan-end **external-both** can pass as a generic code review. It does not force a
   structured comparison of **what the plan said would be built** (BI, goals, tasks,
   acceptance) vs **what landed** (merged tree + durable state).

Ground truth (G1):

```
src/implement-mode.js:183
 * Automate is OFF by default when nothing is set.

src/implement-mode.js:225
  return false;

skills/shared/implement-decision-log.md (operator PASS procedure)
1. Operator reads the phase decisions/<phaseId>.jsonl (and linked evidence).
2. Operator issues an explicit token in the same turn that authorizes PASS

src/plan-end-review.js:4-14
 * planEndReviewOk =
 *   receipt exists
 *   AND ( count(succeeded family-different external legs) ≥ 1
 *         AND non-empty reviewFile AND mode is 'external-both' ...
```

verified_by: lines cited from this repo and dogfood dump §2 / §6.11 / §20.8.

## Contraste: intenção × previsão × pressupostos

Three columns the plan must keep separate (also mirrored in `plan.md` §1b).

### Intenção (resolve)

1. Bare `implement` runs pure-maestro (no mode flag required).
2. Operator never decision-review PASSes without seeing the decision package first.
3. Plan-end cross-model answers “did we deliver what the plan promised?” not only “is the diff ok?”.
4. Machine `passed` stamps do not lie about those human contracts.

### O que o plano prevê (deliver)

- F0: default `isAutomateActive` + Mode 1 escape + prose/tests.
- F1: decision package builder + present-before-PASS + machine present evidence.
- F2: intent/delivered surfaces + `intentVsDelivered` on plan-end receipt + finalize gate.
- F3: dogfood checklist.

**Not predicted here:** phase review dual-leg authenticity, post-merge e2e re-run,
archive `validate-state` join, phase-end session-break UX, auto-merge.

### O que o plano assume (may not exist)

| Assumption | Evidence it can fail |
|------------|----------------------|
| Host obeys maestro prose (present package) | Dogfood blind PASS with 0 FAIL |
| Decision JSONL reliably appended at canonical path | F7 wrong `statusRoot` / double projects |
| External codex/bridge available for plan-end | Missing GNU `timeout`; corrupt F3 receipt |
| Intent/delivered surfaces reconstructible from state | Unpersisted claims; thin evaluations |
| external-both accepts extra brief context | Bridge may ignore/truncate prompt |
| Operator reads chat / AskUserQuestion | Decline → host accept judgment (F7 P2) |
| Session default activates same durable gates as stamp | Critic F-001; stamp-only call sites |
| Mode 1 escape remains known | Legacy bare implement was Mode 1 |

**Rule:** delivery (F0–F3) must fail closed when a load-bearing assumption is missing,
not mark intention “done” by prose alone.

## Decisions

1. **Automate becomes the default implement path.** When the operator runs
   `implement [<plan>]` with **no** explicit non-automate mode and without
   `--clear-execution-mode`, pure-maestro is active (`isAutomateActive` → true).
   Mode 1 session-writer requires an **explicit** escape hatch (`--mode=1` /
   `mode:1` / equivalent). This **supersedes** `implementation-automate-mode`
   Decision 1 / principle P1 (“Opt-in only”). unverified: exact migration messaging
   in release notes until docs task lands.

2. **Durable stamp remains useful but is not the only entry.** First automate session
   may still stamp `executionMode: automate` for plan-end durable gates and re-entry
   UX. Absence of CLI mode no longer means Mode 1. Clear path
   (`--clear-execution-mode` + stamp removal + lease HARD-GATE) stays.
   **Gate activation rule (critic F-001):** any path that runs pure-maestro under
   automate-default MUST feed the same activation into durable/machine gates used by
   `canRunPhaseDone` / `automatePlanEndGatesOk` — either via stamp **or** by passing
   `automateActive: true` (session default) into those call sites — so
   present-before-PASS and intentVsDelivered cannot be skipped in the
   first-session-before-stamp window. F0/F1 tests cover `{no CLI, no stamp}`.

3. **Host-thin Iron Law is unchanged.** Defaulting automate must not relax: no host
   product source edits, code-only phase writers, never self-certify, never silent
   Mode-1 fallback, operator-owned decision-review PASS and userValidationOk.

4. **decision-review is read-before-PASS.** Under automate, the host **must present** a
   **decision package** (rendered summary of `decisions/<phaseId>.jsonl` + path +
   evidence links) in the operator-visible channel **before** asking PASS/FAIL.
   A PASS token without a same-gate present step is invalid. Empty logs still require
   an explicit empty-package presentation (operator may FAIL or ack empty).

5. **Machine evidence of present is required for phase-done under automate.**
   `decisionReview` (or a sibling field) records that the package was presented
   (e.g. `packagePresentedAt` ISO and/or `packagePath` / hash of rendered body).
   `decisionReviewAllowsPhaseDone` / `canRunPhaseDone` fail closed without it when
   automate is active for the session **or** the plan stamp is automate (same
   activation rule as Decision 2 — not stamp-only). Agents still never write PASS.

6. **Plan-end review is intent-vs-delivered under automate.** Before finalize/archive,
   cross-model plan-end (`external-both`) runs with a brief built from:
   - **Intent surface:** phase goals, businessIntent spine, tasks + acceptance,
     exit criteria.
   - **Delivered surface:** task done/evidence, outputs paths, claim/commit SHAs
     when available.
   The receipt must carry a structured `intentVsDelivered` section (per phase or
   plan-level rows: `matched|partial|missing|extra` + notes). Missing section ⇒
   plan-end gates fail under durable automate (AND into `automatePlanEndGatesOk` or
   equivalent). Generic “clean diff” alone is insufficient.

7. **Existing planEndReviewOk floors stay.** ≥1 succeeded family-different external
   leg, mode `external-both`, non-empty reviewFile, verifiedAt. Skip remains
   HARD-CLOSED under durable automate. This plan **adds** intent-vs-delivered; it
   does not remove the external leg requirement.

8. **Surface = extend implement + pure helpers + tests.** No new top-level
   `skills/core/automate.md`. Touch `src/implement-mode.js`, decision-log /
   decision-review gates, plan-end review, maestro/decision-log skill assets, KB.

9. **F4 absorbs first hardening slice (operator-ratified 2026-07-25):** phase review
   dual-leg authenticity (medium floor), evaluation content floor, major disposition
   tokens, decisionLog statusRoot normalize, phase-done mirror/assert + hand-edit ban.
   **Still out of scope:** post-merge Playwright re-run, full validate-state auto-join
   of all archives (optional later), phase-done-apply atomic script, session-break
   AskUserQuestion, Layer 4 daemon.

## Chosen approach

**Name: Default pure-maestro + present-before-PASS + intent-vs-delivered plan-end.**

### Runtime (happy path)

```
implement <plan>                    # no mode flag → automate active
  → (optional) stamp executionMode automate on first confirm if absent
  → pure-maestro A–I (host-thin)
  …
  Step G decision-review:
    1. buildDecisionPackage(listDecisions(phase))
    2. render package to operator (chat / AskUserQuestion body)
    3. record packagePresentedAt
    4. ask PASS | FAIL
    5. only on operator PASS → stamp decisionReview
  …
  Step I plan-end:
    1. build intent + delivered surfaces from plan/state
    2. external-both with intent-vs-delivered brief
    3. receipt must include intentVsDelivered
    4. operator userValidationOk
    5. finalize (no auto-merge)
```

### Why this approach

- **Default automate** matches how operators already run multi-phase work after dogfood;
  Mode 1 remains one explicit flag away.
- **Present-before-PASS** fixes the proven blind-approval failure without removing the
  manual hardgate (agents still cannot PASS).
- **Structured intentVsDelivered** makes “did we build what we planned?” a gate, not a
  hope that the model notices BI drift in a raw diff.

### Approaches weighed

| Area | Options | Winner |
|------|---------|--------|
| Default entry | A) session default when no flag; B) always auto-stamp only; C) global config file | **A** (+ keep stamp for durable finalize); C deferred |
| decision-review UX | A) prose-only “please open the file”; B) machine `packagePresentedAt`; C) two-step AskUserQuestion | **B+C** |
| plan-end intent | A) prompt-only soft rubric; B) structured receipt field gated; C) separate pre-review skill | **B** (prompt feeds the field) |

## Blast radius

| Decision | Cost if wrong | Containment |
|----------|---------------|-------------|
| Automate default | Operators who relied on bare `implement` as Mode 1 session-writer get pure-maestro (lease/worktree/spawn) unexpectedly | Explicit `--mode=1`; docs + antipattern; stamp clear path; unit matrix for parse/isAutomateActive |
| Schema fields on decisionReview / planEndReview | Old plans without new fields | Fail closed **only under durable automate**; non-automate gates ignore new fields; optional backfill not required for archive of old plans |
| intentVsDelivered required | Blocks finalize until receipt shape lands | Clear error from `planEndReviewOk` / assert-automate-gate; skip still HARD-CLOSED under automate (no silent skip) |

This is a **behavioral public-contract** change for `implement` defaults, not a data
migration of user product DBs. Treat docs and tests as the rollback path (restore
opt-in default via flag/docs if needed).

## Non-goals

- Auto-merge / auto-archive after plan-end.
- Layer 4 daemon / multi-host supervisor.
- Removing Mode 1.
- Lekto product backlog (polling, failover, worker timeout).
- Full phase-review stub/corrupt authenticity hardgate (follow-up).
- Forcing two external providers when only one family-different leg is available.

## Open questions

1. Should first bare `implement` still require interactive `y` before durable stamp, or
   only stamp silently when automate-default is already active?  
   **Recommendation:** keep a light confirm on **first stamp** for durability; do not
   require `--mode=automate` CLI. unverified until F0 implements UX copy.
2. Exact schema field names (`packagePresentedAt` vs `decisionPackage.presentedAt`).  
   **Recommendation:** prefer nested `decisionReview.package: { presentedAt, path }` if
   schema allows additive object; else flat ISO field. Decide in F1 with schema tests.
3. Minimum rows in `intentVsDelivered` (per-phase vs single plan rollup).  
   **Recommendation:** at least one row per plan phase with status enum; empty array fails.

## Rejected alternatives

1. **Keep opt-in only (original P1).** Rejected — operator demand after dogfood; bare
   `implement` already expected to “just run the plan” under maestro.
2. **Prose-only “please open decisions JSONL”.** Rejected — dogfood proved it does not
   happen; blind PASS with 0 FAIL.
3. **Prompt-only intent-vs-delivered without receipt field.** Rejected — unenforceable;
   same class of failure as stub review receipts (`reviewGate.passed` without dual-leg).
4. **Global config file as sole default switch.** Deferred — higher setup cost; session
   default + explicit Mode 1 is enough for v1.
5. **Auto-PASS decision-review when evaluationGate is pass.** Rejected — violates
   operator authority (implement-phase-agents P5).

## Self-review against code-quality gates

- G1 read-before-claim: applied — default-off and planEndReviewOk cited from
  `src/implement-mode.js` / `src/plan-end-review.js`; decision-review steps from
  `implement-decision-log.md`; dogfood blind PASS from dump §2.
- G2 soft-language: applied — scanned; avoided “should work” / “probably”.
- G6 reference-or-strike: applied — open UX stamp confirm and exact schema names marked
  unverified with recommendations.
