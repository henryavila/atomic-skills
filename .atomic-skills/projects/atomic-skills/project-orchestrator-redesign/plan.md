---
schemaVersion: "0.2"
slug: project-orchestrator-redesign
title: Redesign project skill into a lifecycle orchestrator (dogfood)
version: "1.0"
status: active
started: 2026-06-01T00:00:00Z
lastUpdated: 2026-06-03T00:00:00Z
branch: dogfood/self-host-migration
currentPhase: F5
parallelismAllowed: false
phases:
  - id: F0
    slug: inc0-verify-on-done-teeth
    title: Inc0 — verify-on-done teeth (the linchpin)
    goal: "Un-stub kind:test/kind:shell auto-exec + the GATE-R2 met-invariant in
      validate-state.js (the shared first brick for both gates and Mode 2).
      Detail: docs/design/project-orchestrator/07 §Inc0/Inc1."
    dependsOn: []
    subPhaseCount: 0
    status: done
    exitGate:
      summary: GATE-R2 checkMetInvariant + R-XAGENT-07 paranoid REDs land; verifier
        auto-exec un-stubbed.
      criteria:
        - id: F0-G1
          description: "GATE-R2 enforces met/done + deterministic verifier ⟹
            evidence.passed (+ testsCollected>0). Evidence: commits through
            Inc1; 07 §Inc1 KEY REFRAME."
          status: met
          verifier:
            kind: manual
            description: Tracked retroactively; machine evidence is the committed
              validate-state.js + its tests.
    summary: Liga a auto-execução real dos verifiers (test/shell) + a invariante
      GATE-R2 "met ⇒ evidência" — a base compartilhada de gates e Mode 2.
  - id: F1
    slug: inc1-inc5-lifecycle-skills
    title: Inc1–Inc5 — lifecycle cognition + execution skills
    goal: "0.2 schema + brainstorm/critic/debate-gate (Inc3) + No-Placeholders/SPEC
      lints (Inc4, decompose FROZEN per R-ORCH-10) +
      implement/verify-claim/debug/worktree/fix-circuit-breaker (Inc5). Detail:
      07 §Inc3/§Inc4/§Inc5 + pressure-tests 08/09."
    dependsOn:
      - F0
    subPhaseCount: 0
    status: done
    exitGate:
      summary: DESIGN→PLAN→DECOMPOSE+SPEC→IMPLEMENT skills shipped; Inc3 + Inc5
        pressure-tested + adversarial-reviewed.
      criteria:
        - id: F1-G1
          description: "Mode-1 lifecycle skills shipped, suite green at each rung
            (640/668/676). Evidence: commit 24d8e38 + 08-/09- pressure-test
            records."
          status: met
          verifier:
            kind: manual
            description: Retroactive; evidence is the committed skills + 08/09 pressure-test
              docs.
    summary: "Skills de ciclo de vida e execução: schema 0.2,
      brainstorm/critic/debate-gate, lints No-Placeholders/SPEC,
      implement/verify/debug/worktree/fix."
  - id: F2
    slug: inc6-d7-layout-cutover
    title: Inc6 + D7 — verify/migrate command + live layout cut-over
    goal: "planLayoutMigration (pure flat→nested) + migrate-layout.js
      (copy-verify-delete, fail-closed) + project verify/migrate + the LIVE D7
      cut-over of .atomic-skills/ to projects/<id>/<slug>/. Detail: 07 §Inc6."
    dependsOn:
      - F1
    subPhaseCount: 0
    status: done
    exitGate:
      summary: Live tree migrated to nested layout, validate-state GREEN, 14
        adversarial findings fixed.
      criteria:
        - id: F2-G1
          description: "D7 cut-over: 22 files migrated, flat removed, validate-state
            22-valid/6-plans GREEN, byte-identical to snapshot. Evidence:
            commits cf56d10 + a7942a1."
          status: met
          verifier:
            kind: manual
            description: Retroactive; evidence is the committed migrate.js/migrate-layout.js
              + the live nested tree this plan lives in.
    summary: Migração de layout flat→aninhado (copy-verify-delete, fail-closed) +
      comandos verify/migrate + o cut-over ao vivo p/ projects/<id>/<slug>/.
  - id: F3
    slug: wf-impl-2-mode2-codex-lane
    title: WF-IMPL-2 — Mode 2 Codex-only execution lane
    goal: "PREREQ A (R-XAGENT-10 routing.schema.json) + PREREQ B (R-XAGENT-03
      operator-prompted serial merge-back) + the Codex --sandbox workspace-write
      lane (R-EXEC-35 + 2-question gate + handoff contract + runtime gate +
      sidecar telemetry). Mode 2 = built, default-OFF, fenced. Detail: 07
      §WF-IMPL-2 PREREQ A/B + Codex lane BUILT."
    dependsOn:
      - F2
    subPhaseCount: 0
    status: done
    exitGate:
      summary: Both prereqs + the Codex lane built; two pressure-tests 3/3 converged;
        suite 705 green.
      criteria:
        - id: F3-G1
          description: "Codex lane shipped default-OFF + fenced from the live tree.
            Evidence: commits 75e0b78 (A), 6358542 (B), 64a203a (lane) + 10-
            pressure-test record (merge-back 3/3 + dispatch-path 3/3)."
          status: met
          verifier:
            kind: manual
            description: Retroactive; evidence is the committed assets/skills + the 10-
              pressure-test doc. Live empirical run is F4.
    summary: "Lane de execução Mode 2 só-Codex: routing config + merge-back serial
      guiado pelo operador + perfil de sandbox workspace-write."
  - id: F4
    slug: live-proof-on-throwaway-repo
    title: Live proof-on-throwaway-repo for the Codex write-mode lane
    goal: "Exercise the invocation-workspace-write.txt profile end-to-end on a
      THROWAWAY git repo before any real enablement: routing.json on, dispatch a
      3-task mechanical batch, confirm worktree isolation + serial merge-back +
      sidecar dispatch-log.json. Codex write-mode stays fenced from the live
      .atomic-skills/ tree."
    dependsOn:
      - F3
    subPhaseCount: 0
    status: done
    exitGate:
      summary: The prose lane is validated empirically once (off the live tree);
        failures route back to the lane spec.
      criteria:
        - id: F4-G1
          description: "A real Codex workspace-write run completes a 3-task batch in
            worktrees, merges serially with post-merge re-verify, and writes
            dispatch-log.json — all on a throwaway repo. PROVEN 2026-06-02:
            codex-cli 0.134.0 ran 3 disjoint tasks (add/slugify/reverse) in /tmp
            throwaway worktrees, serial merge-back with post-merge re-verify all
            GREEN, dispatch-log.json 3 records, live tree fenced (no status/
            leak). Detail:
            docs/design/project-orchestrator/11-f4-live-proof-codex-lane.md."
          status: met
          verifier:
            kind: manual
            description: "Manual demo on a throwaway repo; fenced from the live tree by
              design. Evidence: 11-f4-live-proof-codex-lane.md + the run
              transcript (routing.json ajv-VALID, 3 worktrees, serial merge
              GREEN, dispatch-log 3/3)."
            fallbackKind: cli
    summary: Prova ponta-a-ponta da lane Codex write-mode num repo descartável,
      antes de qualquer habilitação real.
  - id: F5
    slug: inc7-aideck-prose-long-tail
    title: Inc7 — aiDeck consumer-side + prose/schema long tail
    goal: "R-MIG-09..18/22/23: the aiDeck consumer side + prose/schema long tail,
      sequenced WITH the aiDeck rewrite. INCLUDES updating THIS project-status
      skill's consumer handlers (display + new/mutation) to the nested
      projects/<id>/<slug>/plan.md layout — currently the skill body still
      describes the flat initiatives/ + PROJECT-STATUS.md layout (the drift
      surfaced while dogfooding this very initiative)."
    dependsOn:
      - F2
    subPhaseCount: 0
    status: active
    exitGate:
      summary: aiDeck reads the nested layout; the project-status skill body matches
        the live nested layout.
      criteria:
        - id: F5-G1
          description: "The project-status skill's detection/display/new/mutation handlers
            read projects/<id>/<slug>/plan.md (not flat initiatives/); aiDeck
            consumer side updated. SKILL-BODY DONE (commit 11173a8, 12 files
            resolve nested-first w/ flat fallback; writers pass projectId;
            standalone=degenerate-1-phase-plan; per-project PROJECT-STATUS.md).
            HOOK DONE (commit c1410db): hooks/session-start.sh ported to nested
            (list_plan_files/plan_slug_of/phases_dir_of/list_phase_files),
            pre-existing commit-less hang fixed; +5 nested/regression tests,
            hook suite 31/29/66/5 green, verified on the live tree (resolves
            project-orchestrator-redesign @ F5). Suite 705 green, check-docs
            clean."
          status: pending
          verifier:
            kind: manual
            description: "Verify the skill renders + mutates the live nested tree without
              the manual yaml.js workaround used today. REMAINING (gate not yet
              met): aiDeck consumer side R-MIG-14 (in-memory
              ProjectRegistry/deriveProjectId → enumerate projects/* on disk) —
              sequenced WITH the aiDeck rewrite (the aiDeck-side is the only F5
              sub-item left). Follow-up data task (not gating): the live
              top-level PROJECT-STATUS.md is stale post-D7/pause — per-project
              indexes are created on the next mutation."
            fallbackKind: cli
    summary: Reconecta a skill ao aiDeck genérico reescrito via consumer Model-B
      (read-in-place); só falta o publish no npm (gated).
  - id: F6
    slug: subagent-executor-tier-deferred
    title: Anthropic subagent executor tier (DEFERRED)
    goal: "Sonnet/Haiku in-tree executor tier — only if the throughput case is ever
      wanted. Spec recommends extending parallel-dispatch with a tier hint
      instead (same shared Claude ceiling ⇒ doesn't serve the Opus-conservation
      lever). Also tracked as its own initiative:
      mode2-anthropic-subagent-tier."
    dependsOn:
      - F3
    subPhaseCount: 0
    status: paused
    exitGate:
      summary: Deferred-by-design; revisit only on a real throughput need, and
        pressure-test its own dispatch-path block when built.
      criteria:
        - id: F6-G1
          description: Decision to build (or formally drop) the subagent tier, with the
            lever-1 caveat re-confirmed.
          status: deferred
          deferredReason: Same shared weekly Claude ceiling ⇒ no Opus-conservation win;
            throughput is parallel-dispatch's job (spec §5).
    summary: Tier opcional de executor Sonnet/Haiku in-tree — adiado; recomendação é
      um hint de tier no parallel-dispatch.
planActive: true
planTitle: Redesign project skill into a lifecycle orchestrator (dogfood)
---

# Redesign project skill into a lifecycle orchestrator (dogfood)

**Anchored, retroactively, to the work that has lived on `dogfood/self-host-migration` since 2026-06-01.** This initiative makes the project-orchestrator redesign trackable *through the skill itself* — the dogfood loop that had, until now, only been tracked in `docs/design/project-orchestrator/`.

## Where the canonical detail lives

The full design + per-increment build log is in **`docs/design/project-orchestrator/`**:
- `00-CANON.md` — decisions, build order (Inc0–Inc7), resume point.
- `07-inc0-inc1-implementation-notes.md` — what was BUILT per increment + the `## SESSION HANDOFF` blocks (the durable resume contract).
- `08-` / `09-` / `10-` — the pressure-test records (Inc3, Inc5, and PREREQ B merge-back + Codex-lane dispatch-path).

The phases above are the *summary index*; the phase-level detail for the **done** work (F0–F4) is in those docs — those phases deliberately carry no `phases/f<N>-*.md` initiative files (the docs are the source of truth). **Exception (materialized 2026-06-03): F5** now has a real phase file — `phases/f5-inc7-aideck-prose-long-tail.md` — carrying the A/B/C/D task breakdown + the Model-B-pivot `emerged` entry, so the active aiDeck consumer work is trackable through the skill itself instead of only as a single prose criterion.

## Status (2026-06-02)

F0–F4 **done** (Inc0–Inc6 + D7 + WF-IMPL-2 complete + the Codex lane empirically proven on a throwaway repo; suite 705 green; Mode 2 built, default-OFF, fenced from the live tree). **F4 closed 2026-06-02:** a real `codex-cli 0.134.0 --sandbox workspace-write` run executed a 3-task disjoint batch in isolated worktrees, serial merge-back with mandatory post-merge re-verify all GREEN, `dispatch-log.json` 3/3, live tree fenced (`11-f4-live-proof-codex-lane.md`). `currentPhase: F5` (Inc7) is now **active and partially done**: the `project-status` **skill-body** flat→nested consumer drift is fixed (commit `11173a8`, 12 files, suite 705 green). F5-G1 now has **only one remaining sub-item** — the aiDeck consumer side (R-MIG-14), sequenced with the aiDeck rewrite. The `hooks/session-start.sh` port + the pre-existing `session-start.test.sh` hang are now DONE (commit `c1410db`; hook suite 31/29/66/5 green, verified on the live tree). F6 (deferred subagent tier) remains paused.

## Dogfood note

Creating this initiative surfaced a real gap it now tracks (F5): the `project-status` skill body still describes the **flat** `initiatives/` + `PROJECT-STATUS.md` layout, while the live tree is **nested** post-D7 — so this `plan.md` had to be authored by hand rather than via the skill's `new` handler. That drift is the R-MIG consumer long-tail.

## Session handoff

- **Narrative:** WF-IMPL-2 (Mode 2 Codex lane) shipped this session as 3 commits (PREREQ A `75e0b78`, PREREQ B `6358542`, lane `64a203a`); suite 705 green. This initiative was then created to retroactively anchor the whole redesign in the dogfood tracker.
- **Decision log:** retroactive-complete scope chosen (vs forward-only) so the tracker mirrors reality; phases are a summary index pointing at `docs/design/project-orchestrator/` for detail; manual exit criteria used (not GATE-R2-gated) since the machine evidence is the commits.
- **Single nextAction:** finish F5 (Inc7). Skill-body slice DONE (`11173a8`); `hooks/session-start.sh` ported + the pre-existing test hang fixed DONE (`c1410db`). **Only the aiDeck consumer side remains** (R-MIG-14: replace the in-memory ProjectRegistry/deriveProjectId with on-disk `projects/*` enumeration) — sequenced WITH the aiDeck rewrite, so F5 is blocked on that external work. When the aiDeck rewrite lands, wire its `/api/projects` to enumerate `projects/*` and update the deep-link routes, then F5-G1 is met. (F4 done — the Codex lane is empirically proven; `11-f4-live-proof-codex-lane.md` also logs two additive doc clarifications for `worktree-isolation.md` §Merge-back: orchestrator commits the scoped file before merge; sidecars belong outside the worktree.)
- **Verbatim state:** `npm test` → 705 pass / 0 fail; `node scripts/validate-state.js` → 23 valid / 7 plans GREEN; branch `dogfood/self-host-migration`. F4 proof artifacts were in `/tmp` (throwaway, fenced) — nothing leaked into the live tree.
- **Uncommitted changes:** `.atomic-skills/` is gitignored (this plan is local-only durable state).
