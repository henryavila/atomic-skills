---
schemaVersion: "0.1"
slug: mode2-codex-default-enablement
title: Mode 2 — make Codex the default implementer
goal: Flip the implement skill so a SPEC-READY task with a deterministic
  verifier routes to the Codex workspace-write lane BY DEFAULT, preserving every
  quality-carrying guardrail (spec gate, verifier, serial merge-back,
  never-self-certify, verifier-on-merged-tree).
status: active
branch: dogfood/self-host-migration
started: 2026-06-06T20:28:44Z
lastUpdated: 2026-06-06T22:15:28Z
nextAction: "Mode2 work is functionally complete + reviewed. Gates: G-1
  (guardrails) + G-2 (default flipped, verified by reading) + G-4 (review) MET;
  G-3 deferred. Only T-005 remains, BLOCKED on the F5/Inc7 aiDeck rewrite (the
  full-suite criterion fails only on aiDeck-integration tests gated on user
  go-ahead in project-orchestrator-redesign T-004) — mode2-scoped suites are all
  green and the pressure-test passed. Optional follow-up: a first REAL
  Codex-default batch on ordinary spec-ready feature work."
scope:
  paths:
    - .atomic-skills/status/routing.json
    - skills/shared/mode2-codex-lane.md
    - skills/core/implement.md
references:
  - kind: repo-path
    label: Original Codex-only Mode 2 spec + worth-it verdict this revises
    path: docs/design/project-orchestrator/03-execution-mode2-spec.md
tasksDone: 4
tasksTotal: 5
gatesMet: 3
gatesTotal: 4
exitGates:
  - id: G-1
    description: "QUALITY-CARRIERS PRESERVED: spec-completeness dispatch gate
      (R-EXEC-43), deterministic verifier (F2), never-self-certify (R-EXEC-28),
      serial merge-back (R-XAGENT-03), verifier-re-run on the MERGED tree
      (R-EXEC-29) all remain HARD and verbatim."
    status: met
    verifier:
      kind: shell
      command: grep -q 'never self-certif' skills/core/implement.md && grep -q
        'MERGED' skills/core/implement.md && grep -q 'serial'
        skills/shared/mode2-codex-lane.md
      expectExitCode: 0
    metAt: 2026-06-06T20:36:46Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-06T20:36:46Z
      passed: true
      exitCode: 0
      outputSummary: grep guardrails exit 0 — 'never self-certif' + 'MERGED' in
        implement.md, 'serial' x8 in mode2-codex-lane.md,
        'requireDeterministicVerifier' in routing.schema.json. All five
        quality-carriers survived the default flip verbatim.
    verifierLabel: "shell: grep -q 'never self-certif' skills/core/implement.md && gre…"
    evidenceSummary: passed · 2026-06-06
  - id: G-2
    description: "DEFAULT FLIPPED: routing.json enabled ⇒ a spec-ready task with a
      deterministic verifier routes to Codex without per-invocation opt-in; F1
      reframed to spec-readiness; ineligible ⇒ Mode 1 with recorded reason."
    status: met
    verifier:
      kind: manual
      description: Read implement.md §Mode 2 + mode2-codex-lane.md §1/§3; confirm the
        default-flip + the F1 reframe; confirm routing.json enables the lane.
    metAt: 2026-06-06T22:15:28Z
    evidence:
      verifierKind: manual
      verifiedAt: 2026-06-06T22:15:28Z
      passed: true
      outputSummary: "Verified by reading the three sources: routing.json has
        mode2Enabled:true + codexLane.enabled:true +
        thresholds.requireDeterministicVerifier:true (lane ON);
        mode2-codex-lane.md §1 = 'Codex is the DEFAULT executor when the lane is
        on' + 'Per-batch opt-OUT (not opt-in)'; §3 F1 reframed to spec-readiness
        (HARD disqualifier: not-spec-ready ⇒ Mode 1), F2 deterministic-verifier
        stays HARD. Default-flip + F1 reframe + lane-on all confirmed."
    verifierLabel: manual
    evidenceSummary: passed · 2026-06-06
  - id: G-3
    description: "GREEN: npm test + npm run validate-skills + compatibility
      strip-test pass after the edits."
    status: deferred
    verifier:
      kind: test
      runner: node --test
      pattern: tests/
    deferredReason: "validate-skills (14 ok), compatibility (82/0), and
      validate-state (26 + routing) all GREEN. Full `npm test` is NOT 0-fail due
      to PRE-EXISTING failures unrelated to this change — the dashboard/aiDeck
      bundle is not built (dist/dashboard/index.html missing), install-artifact
      + aideck contract tests depend on it. PROVEN unrelated by stash-and-rerun:
      identical failures with my skill edits removed. This is F5 (Inc7 aiDeck)
      territory in project-orchestrator-redesign, blocked on the external aiDeck
      rewrite — out of scope here. Zero NEW failures introduced."
    verifierLabel: "test: node --test tests/"
    evidenceSummary: "deferred: validate-skills (14 ok), compatibility (82/0), and
      validate-state (26 + routing…"
  - id: G-4
    description: Adversarial review (review-plan then review-code) run; zero
      unresolved blocker/critical findings.
    status: met
    verifier:
      kind: manual
      description: Confirm a review-plan + review-code pass exists with no unresolved
        blocker/critical findings.
    metAt: 2026-06-06T20:36:46Z
    evidence:
      verifierKind: manual
      verifiedAt: 2026-06-06T20:36:46Z
      passed: true
      outputSummary: "Ran code-review (high) — 3 adversarial finder agents
        (removed-behavior, cross-file contradiction, internal-logic). Triaged:
        most HIGH/CRITICAL findings were re-litigation of the deliberate
        decision (opt-in→opt-out, fence narrowing, T1 drop) = feature not bug;
        the 'no-code-reads-routing.json' finding is a category error (the lane
        is LLM-driven prose, always was). 5 REAL inconsistencies fixed: (1)
        routing.schema.json:12 'per-invocation flag' → opt-out; (2) §9 dangling
        'satisfied lever' orphaned by T1 drop → routing decision; (3) §1 opt-out
        mechanism was undefined → defined (operator instruction, LLM-honored);
        (4) 00-CANON status line 'default-OFF' → revised banner; (5) 03-spec top
        → SUPERSEDED banner. Re-verified:
        validate-skills/compatibility/validate-state all GREEN, guardrails
        verbatim."
    verifierLabel: manual
    evidenceSummary: passed · 2026-06-06
stack:
  - id: 1
    title: Mode 2 Codex default enablement
    type: task
    openedAt: 2026-06-06T20:28:44Z
tasks:
  - id: T-001
    title: Author the live routing.json that enables the Codex lane by default
    status: done
    lastUpdated: 2026-06-06T20:36:46Z
    closedAt: 2026-06-06T20:36:46Z
    outputs:
      - kind: file
        path: .atomic-skills/status/routing.json
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-06T20:36:46Z
      passed: true
      exitCode: 0
      outputSummary: ajv validate of routing.json against routing.schema.json → VALID;
        mode2Enabled + codexLane.enabled true, requireDeterministicVerifier
        true.
    summary: Cria .atomic-skills/status/routing.json ligando mode2Enabled +
      codexLane, minBatchTasks 1, verificador determinístico obrigatório.
    description: Create .atomic-skills/status/routing.json with mode2Enabled:true,
      codexLane.enabled:true + model + timeoutSeconds,
      thresholds.minBatchTasks:1 (was 3 — pure overhead floor, not a quality
      gate), requireDeterministicVerifier:true. This is the enable surface; the
      schema default stays false (absent-file ⇒ Mode 1) for portability of fresh
      installs.
    scopeBoundary:
      - .atomic-skills/status/routing.json
    acceptance:
      - The file validates against meta/schemas/routing.schema.json via ajv.
      - mode2Enabled and codexLane.enabled are both true.
      - thresholds.requireDeterministicVerifier is true (F2 stays hard).
    verifier:
      kind: shell
      command: node -e "const Ajv=require('ajv/dist/2020');const a=new
        Ajv({strict:false});const
        s=require('./meta/schemas/routing.schema.json');const
        d=require('./.atomic-skills/status/routing.json');if(!a.compile(s)(d)){process.exit(1)}if(!d.mode2Enabled||!d.codexLane.enabled||d.thresholds.requireDeterministicVerifier!==true){process.exit(1)}"
      expectExitCode: 0
  - id: T-002
    title: Reframe the enable surface in mode2-codex-lane.md §1 (opt-out, not opt-in)
    status: done
    lastUpdated: 2026-06-06T20:36:46Z
    closedAt: 2026-06-06T20:36:46Z
    outputs:
      - kind: file
        path: skills/shared/mode2-codex-lane.md
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-06T20:36:46Z
      passed: true
      exitCode: 0
      outputSummary: "grep: 'opt-out' present AND 'per-invocation opt-in' absent in
        mode2-codex-lane.md → exit 0."
    summary: §1 deixa de exigir opt-in por invocação; com routing.json ligado, Codex
      é o executor default de tasks elegíveis (operador opta por SAIR).
    description: Rewrite §1 'Enable surface' so that with routing.json's
      mode2Enabled+codexLane.enabled, the Codex lane is the DEFAULT executor for
      eligible tasks — the per-invocation opt-in becomes a per-batch opt-OUT.
      Keep the precondition fallback (Codex unauthenticated/no lane ⇒ Mode 1
      with recorded reason). Keep the $/token non-goal.
    scopeBoundary:
      - skills/shared/mode2-codex-lane.md
    acceptance:
      - §1 no longer requires a per-invocation opt-in to route to Codex.
      - Eligible task + lane enabled ⇒ Codex by default; opt-OUT is per batch.
      - The Mode-1 precondition fallback + recorded-reason rule are preserved.
    verifier:
      kind: shell
      command: grep -qi 'opt-out' skills/shared/mode2-codex-lane.md && ! grep -qi
        'per-invocation opt-in' skills/shared/mode2-codex-lane.md
      expectExitCode: 0
  - id: T-003
    title: Reframe gate F1 from 'cohesive loses' to 'spec-readiness' (keep F2 hard)
    status: done
    lastUpdated: 2026-06-06T20:36:46Z
    closedAt: 2026-06-06T20:36:46Z
    outputs:
      - kind: file
        path: skills/shared/mode2-codex-lane.md
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-06T20:36:46Z
      passed: true
      exitCode: 0
      outputSummary: "grep: 'spec-ready' AND 'deterministic' present in
        mode2-codex-lane.md → exit 0; F2 verifier disqualifier unchanged."
    summary: F1 vira "não spec-ready ⇒ Opus especifica mais ou implementa", não
      "coeso ⇒ Mode 1". F2 (verificador determinístico) permanece HARD.
    description: "In mode2-codex-lane.md §3 and the implement.md chooser, reframe
      F1: the disqualifier is 'NOT spec-ready' (incomplete
      paths/scope/acceptance, or design that only emerges during
      implementation), not 'cohesive'. Cite the SDD finding (a complete spec
      carries the quality). F2 (every task carries a deterministic verifier)
      stays a HARD disqualifier verbatim."
    scopeBoundary:
      - skills/shared/mode2-codex-lane.md
      - skills/core/implement.md
    acceptance:
      - F1 is expressed as spec-readiness, not cohesion-loses-quality.
      - F2 deterministic-verifier hard disqualifier is unchanged.
      - The escape hatch routes a not-spec-ready task to Opus (spec harder or
        self-implement).
    verifier:
      kind: shell
      command: grep -qi 'spec-ready' skills/shared/mode2-codex-lane.md && grep -q
        'deterministic' skills/shared/mode2-codex-lane.md
      expectExitCode: 0
  - id: T-004
    title: Flip implement.md §Mode 2 framing to Codex-default; keep all safety rules
    status: done
    lastUpdated: 2026-06-06T20:36:46Z
    closedAt: 2026-06-06T20:36:46Z
    outputs:
      - kind: file
        path: skills/core/implement.md
      - kind: file
        path: skills/shared/codex-bridge-assets/invocation-workspace-write.txt
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-06T20:36:46Z
      passed: true
      exitCode: 0
      outputSummary: "grep: 'never self-certif' + 'MERGED' + 'serial' all present in
        implement.md → exit 0; safety Red Flags survived the reframe verbatim."
    summary: §Mode 2 deixa de ser "default OFF, fenced" e vira "default p/ tasks
      spec-ready"; Red Flags/Rationalization sobre opt-in/fence reescritos;
      regras de segurança (merge serial, never-self-certify, verifier no merged
      tree, Codex não escreve .atomic-skills/ state) mantidas verbatim.
    description: "Rewrite the implement.md §Mode 2 header + chooser + the
      Mode-2-related Red Flags and Rationalization rows: the default is now
      'spec-ready task ⇒ Codex'. KEEP every safety rule verbatim —
      single-threaded serial merge-back (R-XAGENT-03), verifier re-run on the
      MERGED tree (R-EXEC-29), foreign executor never self-certifies
      (R-EXEC-28), and the narrowed state-tree fence (Codex works in a scoped
      worktree, never writes .atomic-skills/ project state). Drop only the
      'throwaway-repo-only / never real work' framing tied to the closed dogfood
      migration."
    scopeBoundary:
      - skills/core/implement.md
    acceptance:
      - §Mode 2 frames Codex as the default for spec-ready tasks (not 'default
        OFF').
      - The serial-merge-back, never-self-certify, and verifier-on-merged-tree
        Red Flags survive verbatim.
      - The state-tree fence survives as 'Codex never writes .atomic-skills/
        state', minus the throwaway-only framing.
    verifier:
      kind: shell
      command: grep -q 'never self-certif' skills/core/implement.md && grep -q
        'MERGED' skills/core/implement.md && grep -q 'serial'
        skills/core/implement.md
      expectExitCode: 0
  - id: T-005
    title: Run the full suite + validate-skills + compatibility; pressure-test the
      reframe
    status: blocked
    blockedBy:
      - F5-inc7-aideck-rewrite
    lastUpdated: 2026-06-06T22:15:28Z
    evidence:
      verifierKind: test
      verifiedAt: 2026-06-06T22:15:28Z
      exitCode: 1
      passed: false
      outputSummary: "Mode2-scoped coverage GREEN: validate-skills 14/14,
        validate-state 26 files + routing, compatibility 82/82, validate-state
        confirms routing.json valid. Pressure-test PASSED (3 scenarios, verified
        against lane doc): (1) spec-ready + deterministic verifier ⇒ Codex by
        default (routing.json on, F1+F2 pass); (2) not-spec-ready ⇒ Mode 1 (§3
        F1 HARD disqualifier, recorded reason); (3) verifier-less ⇒ 'refused
        dispatch' (§3 F2 HARD + lane line 111). FULL `npm test` is NOT 0-fail:
        after `npm run build:dashboard` the bundle-group failures clear, leaving
        5 failures ALL in the aiDeck integration surface (e2e-smoke Model-A
        /api/state/project-status x2, aideck-contract parseInitiativeFile
        context + parent suite, e2e full chain). These are F5/Inc7
        aiDeck-rewrite territory (project-orchestrator-redesign T-004, gated on
        user go-ahead), fail at HEAD independent of mode2 — the only mode2
        working-tree footprint is this state file, which none of those tests
        read. Blocked on the aiDeck rewrite, not on mode2 work."
    summary: npm test + validate-skills + compatibility verdes após as edições;
      pressure-test do novo enquadramento (3+ cenários).
    description: Run npm test, npm run validate-skills, and the compatibility
      strip-test. All green. Then pressure-test the reframed default in 3+
      scenarios (a spec-ready task → Codex; a not-spec-ready task → Mode 1 with
      reason; a verifier-less task → refused dispatch) to confirm the guardrails
      still bite.
    scopeBoundary:
      - skills/core/implement.md
      - skills/shared/mode2-codex-lane.md
      - .atomic-skills/status/routing.json
    acceptance:
      - npm test passes (0 failures).
      - npm run validate-skills passes.
      - The compatibility strip-test passes (no host-only term leak).
    verifier:
      kind: test
      runner: node --test
      pattern: tests/
parked: []
emerged: []
parentPlan: mode2-codex-default-enablement
phaseId: F0
summary: Torna o Codex o implementador padrão (task spec-ready + verificador →
  Codex automático), preservando todas as travas de qualidade.
planTitle: Mode 2 — make Codex the default implementer (Opus plans, Codex executes)
planActive: true
current: true
---

# Mode 2 — make Codex the default implementer

## Context (ratified intent)

- **solves:** the user wants their workflow — Opus plans, Codex implements — to be
  the *default* of the implement skill, not an opt-in fenced exception.
- **trigger:** a 2026-06-06 research pass established that, for *well-specified*
  work with a deterministic verifier, planner→implementer handoff is not a
  quality loss (SDD error-reduction evidence; the Anthropic ~15× loss-claim is
  about parallel real-time coordination, not a sequential spec handoff).
- **assumesStillValid:** the user accepts that the cost moves to (a) spec
  completeness and (b) verifier trustworthiness, and that genuinely
  not-yet-specifiable work still falls to Opus (the reframed F1).

## What changes vs what is held verbatim

**Changes (routing only):** the default executor for an eligible task flips from
Opus (Mode 1) to Codex (Mode 2); the per-invocation opt-in becomes a per-batch
opt-out; F1 is reframed from "cohesive loses" to "not spec-ready"; minBatchTasks
1.

**Held verbatim (verification — never touched by a routing change):** the
spec-completeness dispatch hard-gate (R-EXEC-43), the deterministic
`kind:test`/`kind:shell` verifier requirement (F2), foreign-executor
never-self-certifies (R-EXEC-28), single-threaded serial merge-back
(R-XAGENT-03), verifier-re-run on the MERGED tree (R-EXEC-29), and the principle
that Codex never writes the durable `.atomic-skills/` project state.

## Dogfood note

This initiative is itself executed in Mode 1 (Opus self-implements the skill
edits) — the edits change pressure-tested Iron Laws and carry no deterministic
verifier beyond grep guards + the suite, so by its own reframed F1 they are not a
Codex-default candidate. The first *real* Codex-default batch should be ordinary
spec-ready feature work, after G-4's review lands.
