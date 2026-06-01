# project → lifecycle orchestrator — design CANON & session handoff

> **Status:** DESIGN COMPLETE (6 design sessions, 2026-06-01), pre-implementation. Nothing built yet except one forward-declared initiative.
> **This file is the durable handoff.** A fresh session: read THIS first, then pull the appendix for the area you touch. The appendices hold the full requirement registries / specs; this file holds the decisions + build order + resume point.

## What this is

Evolve `atomic-skills:project` from a **state tracker** into a thin **lifecycle ORCHESTRATOR above SDD**. project is the **maestro** (state machine + cross-stage sequencing + always-resident gates) that **delegates** each heavy stage to its own skill. Locked framing: **project = maestro, skills = stages.**

Lifecycle (3 stages, collapsed from the user's brainstorm→design→plan→spec):

```
TRIAGE → DESIGN → PLAN → DECOMPOSE+SPEC → IMPLEMENT → VERIFY
(project) (brainstorm)  (project+decompose)   (implement)  (verify-claim + manual gate)
```

## Appendices (full detail — durable copies of the workflow syntheses)

- `01-requirements-workflows-dogfood.md` — **master**: the consolidated requirement registry (R-ORCH / R-EXEC / R-SP / R-MIG / R-XAGENT), the workflow map, the incorporation decision, the dogfooding sequence, the build order.
- `02-superpowers-extraction.md` — the partial-drop verdict + per-skill value table + new/extend/rent/drop.
- `03-execution-mode2-spec.md` — Mode 2 purpose + spec (Codex-only verdict).
- `04-gate-system-spec.md` — the gate system (anti-vanity principle, behavioral-test/mutation-kill, manual gate).
- `05-fork-resolutions.md` — **RESOLVED open forks** (16 decisions + consistency/completeness critique, 2026-06-01). Closes the "Open decisions still pending" list below. Read it before touching any increment — it pins the concrete specs (0.2 schema delta, no-4th-content-schema, redirectable-root cost, Mode-2-Codex-only label, critic home/provider, DESIGN v1-vs-v2 line, phase-review escalation).
- `06-session-boundary-and-telemetry.md` — **POST-resolution refinements** (2026-06-01, session 2): F-E1 Mode-1 session cut-over (relatedness-driven, advisory; reuses F-A7 grep over `scopeBoundary[]`; context-% fence is a hard falsifier) + F-E2 skill telemetry & decision-validation loop (observe-only sidecar generalizing F-A6's dispatch-log; falsifier-tracking, anti-Goodhart). Both are **R-ORCH-32 refinements**, v1-advisory/observe-only.

## Decision log (CONFIRMED across the 6 sessions)

1. **project = orchestrator above SDD**; owns the portfolio (dedup, tracking, drift, verify, mode-selection), delegates spec/plan authoring. Confirmed: maestro = state machine + sequencing + gates; stages = own skills (brainstorm, implement, verify-claim) that project invokes. Orchestration spine is added as ONE new lazy detail file (`project-lifecycle.md`) + one dispatch-table row + a `stage` field — zero new resident prose.
2. **Superpowers = PARTIAL-DROP**, not a dependency removal (it is already "an optimization, not a dependency", `project-create-plan.md:203`; coupling = 2 opt-in lines). **OWN** brainstorm/DESIGN + implement; **RENT** the discipline phrasing (TDD/debug/verify — fix+hunt own the workflow; keep the detect-and-degrade probe); **DROP** the overlaps we already match/exceed (router, dispatching-parallel-agents→parallel-dispatch, requesting/receiving-code-review→review-code/plan, finishing-branch→save-and-push, executing-plans→fold as degraded mode, worktrees→native harness). **The "fix superpowers wiring" item is MOOT** (we replace the delegation, not fix it).
3. **New skills to CREATE:** `skills/core/brainstorm.md`, `skills/core/implement.md`, `skills/core/verify-claim.md`, `skills/shared/debug-techniques.md`, `skills/shared/worktree-isolation.md`, `docs/kb/skill-authoring.md`. **EXTEND:** debate (thin gate-mode), fix (3-failed-fixes circuit-breaker + boundary instrumentation), review-code/plan (receiving-findings block), decompose.js + minimal-source.template (No-Placeholders lint), parallel-dispatch (drop superpowers defer), project-create-plan (rewire to internal brainstorm).
4. **3-stage model:** brainstorm = divergent front-half of DESIGN (not a peer stage). HOW lives in the per-task interior (description + acceptance[] + scopeBoundary[] + verifier — all already in `initiative.schema.json`); **no 4th document; `decompose.js` format UNCHANGED** (`## F0/F1` + `### Tn` + `exit_gate` YAML).
5. **Gate architecture = ACTOR-CRITIC:** debate = ACTOR (divergence + Orchestrator Synthesis, does NOT decide); a SEPARATE fresh evidence-checked CRITIC subagent (ported spec-document-reviewer) emits the binary verdict; **gate-pass NEVER from panel consensus** (MAD-conformity false-pass trap). DESIGN-CRITIC build deferred to v2.
6. **Gate system (anti-vanity):** a gate measures something only if you can fill "FAILS when ⟨defect⟩; cheapest pass is ⟨X⟩; foreclosed by ⟨mechanism⟩" — 4 non-negotiables: falsifiable, externally adjudicated (never self-graded), stop-the-line (RED blocks, not WARN), evidence-bearing. **Minimal hard set of 4:** SPEC-LINT (string-scan), VERIFY-ON-DONE (un-stubbed + paranoid REDs), BEHAVIORAL-TEST/mutation-kill (G9), MANUAL-ACCEPTANCE. Coverage% BANNED as evidence (F-002 dead-code case). Magnitude-scaled ladder (heavy gates only where they earn it).
7. **Real TDD → "Behavioral-test gate (G9)":** red-FIRST is NOT enforceable against an agent (timestamps spoofable; red→green transcript reproducible via git stash). Gate on the one non-fakeable oracle: the **mutation-kill** (inject a behavioral mutation at a recorded file:line → a test must go RED → revert → GREEN; surviving behavioral mutant = HARD FAIL = tautological/mock-only). Wires INTO verify-on-done for `kind:test`. Test-first stays cultural (drives design, in fix.md), not the gated claim. Mutation must map to a NAMED acceptance criterion + adversarial pick (fork-3).
8. **Manual user-validation gate:** applicability predicate (only USER-VISIBLE criteria — UI/CLI-output/API-response/report; refactor/internals/migration/infra = N/A *absent, not deferred*; non-UI deterministic checks are shell/query verifiers, not manual). Job1 demoable-state precondition (run demoCommand; not demoable → stays pending). Job2 generated numbered script (Given/When/Then → imperative <10 steps, concrete data). Job3 mandate: user pastes the OBSERVED result of the EXPECT step; `met` requires `passed===true` AND non-empty outputSummary; asymmetric defer (no free bulk-defer).
9. **Layout (Project as a real level above Plan):** `.atomic-skills/projects/<project-id>/<plan-slug>/{ plan.md, design.md, source.md(gitignored draft), reviews/, phases/f<N>-*.md }`; per-project `PROJECT-STATUS.md` (holds the Ad-Hoc Sessions Log). **projectId = the folder name** (replaces `deriveProjectId` path-basename + in-memory registry → enumerate `projects/*`). **standalone initiative = degenerate 1-phase plan** (unify into one plan shape). **ad-hoc = a log line, NOT a folder.** Rule: walk `projects/*/` → each subfolder with `plan.md` is a unit; phases in `phases/*.md`.
10. **Execution — Mode 1 (DEFAULT):** single strong model, sequential coding, durable `.atomic-skills/` state = the snapshot. The 60% ceiling is NOT a self-measured gate (agent can't read own context %, loss silent, auto-compact ~95%) — it is an EVENT-DRIVEN snapshot cadence (after each task / before each dispatch / phase boundary / on request) + advisory host meter. `## Session handoff` block = narrative + decision log + single nextAction + VERBATIM paths/commands/errors + uncommitted-change list. `resume` refuses on stale git / TODO placeholders. Coding single-threaded; subagents isolate token-heavy READS only.
11. **Execution — Mode 2 = CODEX-ONLY v1 (default OFF):** Opus PLANS+REVIEWS only; **OpenAI Codex EXECUTES** via a `--sandbox workspace-write` extension of the read-only codex bridge, in a dedicated git worktree (keep `-a never exec`, portable `run_with_timeout` 124+142, no `--yolo`/`--full-auto`; drop only the clean-tree preflight for the worktree). PURPOSE (codified): conserve the scarce flat-rate resources — Opus weekly rate-limit (PRIMARY), cross-provider Codex offload (SECONDARY, sole lever that leaves the Claude account, sole Gemini lane), throughput (TERTIARY). **NOT $/token** (dead under flat-rate — explicit non-goal). 2-question gate: **F1** independent+mechanical (HARD DISQ if cohesive), **F2** every task has a deterministic test/shell verifier (auto-checked), enable iff `F1∧F2∧precondition∧T1(idle-Codex/deadline)`. Acceptance test (the mutation-kill verifier) = near-free escalation judge; cheap/Codex NEVER self-certifies; merge-back v1 = operator-prompted manual + MANDATORY post-merge re-verify; degraded fallback to Mode 1. **The Anthropic Sonnet/Haiku tier is DEFERRED** → `projects/atomic-skills/mode2-anthropic-subagent-tier/initiative.md` (already created).
12. **Workflows incorporated PORTABLY:** orchestration spine = `{{INVESTIGATOR_TOOL}}` subagent dispatch + `{{BASH_TOOL}}` + the codex bridge + durable state. The Claude-Code-only Workflow/Task/EnterWorktree tooling is admitted ONLY behind `{{#if ide.claude-code}}` as an accelerator. **The portability rule is UNENFORCED today** (`tests/compatibility.test.js` FORBIDDEN_TERMS lacks `Workflow`/`TaskCreate`/`EnterWorktree`/`Monitor` + no strip-test) → **R-XAGENT-01 lands first.** On Gemini the investigator tool is likely read-only → Mode 2 = Codex-only there anyway.
13. **Dogfooding the migration:** dogfood ONLY the mechanical/deterministic plumbing; build cognitive skills (brainstorm/critic/Mode2) conventionally on a throwaway and REPLAY over the migration as regression. D7 cut-over = **copy-verify-delete, never destructive-move**. Codex write-mode FENCED OUT of the live migration. Run against a **redirectable state root** (`ATOMIC_SKILLS_DIR`, R-XAGENT-09) because **`.atomic-skills/` is fully gitignored** (`/.gitignore:5`) → `git checkout` cannot restore it → tar snapshot before D7.

## Answered forks (this session)

- **Fork 1:** Mode 2 = Codex-only v1; Sonnet/Haiku tier → deferred (initiative created). ✅
- **Fork 2:** Schema `0.1`→`0.2` + migration + aiDeck sync (precondition for the hard gates' machine-checked met-invariants + Mode 2 telemetry). ✅
- **Fork 3:** Mutation maps to a NAMED acceptance criterion + adversarial selection. ✅

## Build order (hard dependency chain — see appendix 01 §6)

- **Inc0 — enforcement & isolation prereqs (FIRST):** R-XAGENT-01 (extend `compatibility.test.js` + strip-test), R-XAGENT-08 (`validate-state` kindFromPath for `projects/*/`, flat-walk intact), R-XAGENT-09 (redirectable state root), R-XAGENT-02 (probe investigator write-capability + critic isolation).
- **Inc1 — verify-on-done teeth (THE LINCHPIN):** un-stub `kind:test`/`kind:shell` auto-exec in `project-transitions.md` (today stubbed at `:178,:192`) + paranoid REDs (exit≠0 / 0-tests-collected / runner-not-found ≠ met) + wire the mutation-kill (G9). **Shared first brick for BOTH gates AND Mode 2.** Then verify-claim, debug-techniques, worktree-isolation, skill-authoring, fix extensions, receiving-findings.
- **Inc2 — layout JS-side:** decompose path-emit (`projects/<id>/<slug>/`), normalize walk, serve projectId enumeration; lands the `projects/` tree so the first plan (the migration) materializes there.
- **Inc3 — DESIGN cognition:** brainstorm + debate gate-mode + critic + DESIGN gate ladder + design-doc lint + rewire create-plan. Pressure-test every new Iron Law (3+ scenarios) before ship.
- **Inc4 — No-Placeholders lint + SPEC gate.**
- **Inc5 — implement LAST:** Mode 1 first; Mode 2 Codex-only only after merge-back + routing config specified.
- **Inc6 — verify+migrate command + dogfood cut-over (D7, copy-verify-delete).**
- **Inc7 — aiDeck-side + prose/schema long tail (WITH the aiDeck rewrite; advisory during the dogfood window).**

Ordering hazards: implement ⊀ verify-on-done; kind-inference (R-XAGENT-08) before any path-emit writes a real `phases/*.md`; PLAN "panel only if a DESIGN fork survived" defaults to no-panel.

## Open decisions — RESOLVED 2026-06-01 (see `05-fork-resolutions.md`)

All 16 are decided + critic-checked. Quick index (full decision + falsifier in appendix 05):
- Verifier un-stub home → **`project-transitions.md`** (single canonical exec workflow; met-invariant hoists to `validate-state.js`). [F-B2]
- Opus-headroom readout → **human-attested estimate, never gated**; 3 falsifiable substitute series carry telemetry. [F-A4]
- `minBatchTasks` K floor → **K=4**, labeled interpolated-pending-data; token-weighting in v2. [F-A5]
- Telemetry home → **sidecar `status/dispatch-log.json`**, no schema bump. [F-A6]
- Codex worktree primitive → **raw `git worktree`** canonical; native `EnterWorktree` = CC-only accelerator for read-only panel/critic fan-out. [F-A3]
- Cohesion classification → **user-confirmed, evidence-assisted** (auto pairwise-grep → binary user call → disagreement HALTs to Mode 1). [F-A7]
- `validate-state.js` schema wiring → **NO 4th content schema**; extend `kindFromPath` for `phases/` only (flat walk intact); `routing.schema.json` is a separate config schema (Inc5). [F-B3]
- `Task.evidence` block → **add optional, reuse `exitCriterion.evidence` shape**, in the 0.2 bump; delete the description-note workaround. [F-B4]
- PHASE-REVIEW → **two-layer** (Layer 1 free local review every phase-done = hard floor; Layer 2 codex escalation = **RED auto-runs mandatory** w/ degraded-confirm if codex absent, yellow advisory); **no hard size-block**. [F-C3]
- DESIGN as a persisted tracked stage → **v1 = committed `design.md` + section lint + hard PLAN-precondition; tracked `stage`-object + DESIGN-CRITIC = v2.** [F-C2]
- `kind:query` verifier → **DEFERRED-BY-DESIGN** w/ explicit validator-enforced state (+ escape hatch); never `met` without a real rowCount. [F-B1]
- 0.2 schema delta → **minimal additive-optional** (mutation fields, manual fields, `task.evidence`); `schemaVersion`→`enum['0.1','0.2']` for coexistence; **one-shot `src/migrate.js`** migration. [F-B5]
- Critic home/provider → **`skills/shared/debate-assets/critic.md`** (non-callable asset) + **tiered provider** (same-provider-fresh where host-isolated → codex critic → solo-advisory). [F-C1]
- State isolation → **redirectable root** (`ATOMIC_SKILLS_DIR`); grep proved ~75% already wired, only a ~2-line decompose.js plumb folded into Inc2 — **NOT an Inc0 refactor**. [F-D1]
- Mode 2 merge-back v1 → **operator-prompted + mandatory skill-owned post-merge re-verify**; keep worktree isolation. [F-A1]
- Mode 2 honest label → **Codex-only on EVERY host in v1**; the Anthropic-subagent executor tier is **DEFERRED entirely** (not CC-gated). [F-A2]

**Post-resolution refinements (session 2, see `06-`):**
- Mode-1 session cut-over → **relatedness-driven, ADVISORY**: at `done <task-id>`, F-A7 pairwise-grep (inverse) over recent-working-set vs next-task `scopeBoundary[]`; phase boundary primary + relatedness modifier; recommend (never force) a fresh session; budget X is **purely structural** (context-% fence = hard falsifier). Refines R-ORCH-32, v1. [F-E1]
- Skill telemetry → **observe-only sidecar `.atomic-skills/status/telemetry.jsonl`** generalizing F-A6's dispatch-log; falsifier-tracking (not activity-counting), anti-vanity (coverage% banned), no self-read context-%; 4-layer rollout (observe → digest → human-re-decide → data-weighted defaults); skill never auto-tunes. [F-E2]

**Still genuinely deferred to v2 (recorded, NOT resolved):** merge-back v2 mechanism — the unattended deterministic serial-rebase, with its two sub-forks (trigger auto-vs-opt-in; dependency-order source `depends_on` vs declared order). Do NOT build serial-rebase automation in v1. · F-E1/F-E2 data-driven halves (telemetry-weighted budget X; the L2/L3 re-resolution loop) are v2.

## Artifacts created so far

- `.atomic-skills/projects/atomic-skills/mode2-anthropic-subagent-tier/initiative.md` — the deferred Sonnet/Haiku tier (status pending; new format; local/gitignored). NOTE: trips `validate-state`'s kind-inference (the new path is not under `plans/`|`initiatives/`) — a live confirmation that R-XAGENT-08 (Inc0) is a real prerequisite.

## RESUME HERE

**Forks RESOLVED (2026-06-01) — the design is decision-complete for v1** (`05-fork-resolutions.md`). The six immediate-build forks (F-B1…B5, F-D1) are settled, so **Inc0 + the Inc1 linchpin are fully unblocked and spec'd.** **Session 2 also added `06-session-boundary-and-telemetry.md`** (F-E1 Mode-1 session cut-over + F-E2 skill telemetry) — both R-ORCH-32 refinements, **v1-advisory / observe-only, OFF the Inc0/Inc1 critical path** (they instrument decisions that must ship first; sequenced with/after Inc5). So they do not change the next step — they're recorded for when the core is built.

Next concrete step is **Inc0 + the Inc1 linchpin** (un-stub verify-on-done with paranoid REDs — unblocks both the gate system and Mode 2). The resolved specs Inc0/Inc1 now consume: F-B5 (0.2 schema = minimal additive-optional + `schemaVersion` enum + one-shot migration), F-B3 (no 4th content schema; `kindFromPath` for `phases/` only), F-B2 (un-stub home = `project-transitions.md`; met-invariant → `validate-state.js`), F-B1 (`kind:query` DEFERRED-BY-DESIGN, validator-enforced), F-B4 (`task.evidence` optional), F-D1 (redirectable root is ~2 lines, folded into Inc2). Before coding: confirm with the user whether to start Inc0 now. The workflow that produced this appendix is journaled in the session (re-runnable via `resumeFromRunId`); the `/private/tmp/.../tasks/*.output` raw result is EPHEMERAL — appendix 05 is the durable copy.
