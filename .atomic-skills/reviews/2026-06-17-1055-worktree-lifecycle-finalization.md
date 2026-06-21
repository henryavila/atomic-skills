# review-plan — worktree-lifecycle-finalization

- **Mode:** local (internal)
- **Cross-ref:** `.atomic-skills/projects/atomic-skills/worktree-lifecycle-finalization/design.md`
- **Initiatives discovered:** 8/8 phases (F0–F7), 13 tasks total
- **Iterations (local):** 1 + targeted verification pass
- **Counts (local):** critical: 0, significant: 1, minor: 4, nit: 1
- **Final status:** approved with caveats (no blocker to F0; 1 significant caveat at the F2/F3 boundary)

## Evidence base (verified this session)

- File existence: all 16 tasks-modify input files present; all 11 task-create deliverables absent (correct pre-impl state).
- `project-review.md` confirmed OUTSIDE this branch (`git ls-files` empty; present only in `9406177`/`ecaae5b`) → design.md:276 claim TRUE; Layer B via work-order (F7/T-004) is correct.
- `develop` / `origin/develop` absent → design.md:62 claim TRUE.
- `project-verify.md` has exactly 8 checks (§1–§8), #5 = Orphan detection → F6 "9th after 8" + design.md:124-126 TRUE.
- `review-code.md:218` "Codex only — Skip local" present; no `last-review.json` write path in review-code.md → design.md:182-186 TRUE.
- `project-drift.md:84-86` pointer shape `{lastReviewedCommit, lastReviewedAt, reviewFile}` → design.md:176 TRUE.
- `scripts/plan-branch-policy.js:10` `shouldForkPlanBranch` returns `activePlans.length >= 1` (lazy) → F0/T-001 flips to unconditional `true`; implementable.
- G2 soft-language: 0 occurrences in plan.md + all 8 phase files.
- Coverage: all 8 decisions D1–D8 map 1:1 to F0–F7; the design's one hard SPEC-GATE (the squash CI oracle, design.md:327-329) is realized in F2/T-001 acceptance (oracles A+B).

## Findings (recorded — initiative HARD-GATE: not auto-edited)

### SIGNIFICANT
**S1 — finalize writes `pr-url` that teardown's spec never consumes; design says it must.**
design.md:66-68 (D3) — finalize "(c) grava a pr-url/identidade no estado do plano (que o invariante da Decisão 4 consulta)"; design.md:79 (D4) resolves via `gh pr view <branch>` AND design.md:326 (open q) intends the stored identity to disambiguate multiple PRs on one branch. But `phases/f2…:64-76` (F2/T-001) resolves by head branch and on ambiguity **BLOCKS** (line 75) — it never reads the stored `pr-url`. Consequence: (a) F3's `pr-url` write is unconsumed; (b) teardown over-blocks the multi-PR case the stored identity was designed to resolve; (c) if resolved toward design (F2 consumes `pr-url`), F2 would depend on F3's state field, contradicting the current `F3 dependsOn F2` order (plan.md:184-185). Plan diverges from source-of-truth design → needs an operator decision (align to design, or record as intentional alignment note keeping gh-by-branch + block-on-ambiguity).

### MINOR
**M1 — F2/T-001 does not explicitly consume F1's resolver.** `phases/f2…:65-66` says `resolveBaseRef` resolves the configurable `integrationRef` but never names `scripts/integration-ref.js` (`resolveIntegrationRef`, F1/T-002). `dependsOn: F1` is declared (plan.md:150-151) and acceptance implies it; risk of re-implementing ref resolution. Make the import explicit.

**M2 — F4/T-002 omits read-caps + no-silent-caps logging.** design.md:337-340 flags read caps "(com log do que ficou de fora — no-silent-caps)" for big repos as a SPEC item; `phases/f4…:104-111` documents agents A/B (read-only, diff-scoped, self-check, fallback) but not the caps/logging. Safe by fail-open advisory, but the design SPEC item didn't land in acceptance.

**M3 — F7/T-004 work-order omits two design caveats.** design.md:347-353 (verify-leg reads git/working-tree state OUTSIDE the `.atomic-skills/` subtree → sub-keying risk) and design.md:364-367 (authoritative `last-review.json` copy under `merge=union` divergence at composition). `phases/f7…:151-160` describes the per-leg run-record + append-only carve-out but not these two caveats. Work-order to skill author; fail-safe→re-run keeps it safe.

**M4 — F7/T-003 patch-id oracle covers squash only.** design.md:357-359 asks to confirm patch-id under interactive-rebase/fixup, not just pure squash; `phases/f7…:125-131` oracles squash + miss→re-review only. Fail-safe→re-review keeps safe; coverage gap, not a correctness hole.

### NIT
**N1 — F2 G-2 and F5 G-2 run `validate-skills` as exit gate on phases that modify no skill file** (`phases/f2…:33-38`, `phases/f5…:32-38`). Functions as a regression guard; slightly vacuous but harmless.

## Self-review against code-quality gates

- G1 read-before-claim: every claim about existing code cites pasted/grepped source lines (plan-branch-policy.js:10, review-code.md:218, project-drift.md:84-86, project-verify.md §1–§8).
- G2 soft-language: ran ban-list grep over plan.md + 8 phase files → 0 occurrences.
- G6 reference-or-strike: plan principles carry `verified_by:` (plan.md:17-18, 27-28, 41-43, 48-53); design carries `verified_by:`/URLs throughout; unverifiable items live in design "Open questions" as questions, not assertions.
- Initiative-depth: 8/8 initiatives discovered; gate-task alignment: 16 gates checked, 16 covered, 0 uncovered; subPhaseCount == tasks.length for all 8 phases; no cross-phase broken deps (linear F0←…←F7, all deps satisfied in order).

## Action log

- **S1 RESOLVED** — operator chose "align to design (consume pr-url)". Applied via `atomic-skills:project` to `phases/f2…` F2/T-001 acceptance bullet 5: teardown now resolves the PR identity from the recorded `pr-url`/identity (populated by finalize/F3) to disambiguate, blocking only when gh is unauthenticated / `headRefOid`/ref absent / the recorded identity is absent-or-ambiguous. Co-dependent framing chosen (no F2↔F3 reorder): the `pr-url` contract is defined+consumed in F2, populated by F3; `F3 dependsOn F2` holds. Noted on the T-001 summary. `validate-state` green (58 files).
- **M1 FOLDED** into the same edit — F2/T-001 acceptance bullet 1 now names `resolveIntegrationRef` from `scripts/integration-ref.js` (F1) as the consumed resolver.
- **M2, M3, M4, N1 RECORDED** (minor/nit; below the major+ reapply threshold) — to be applied via `atomic-skills:project` when F4/F7 approach; none block F0.
- **Final status (post-fix): plan approved** — 0 significant open, 4 minor + 1 nit recorded.
