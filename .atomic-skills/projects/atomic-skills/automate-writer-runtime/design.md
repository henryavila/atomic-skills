# Design: Automate writer runtime (1 + A + B)

## Context

`implement --mode=automate` is documented as pure-maestro: the host session orchestrates; a code-only phase writer implements product source. Dogfood and investigation show the host often codes itself instead of spawning a writer.

Root causes (verified against repo state):

1. **No spawn runtime.** `docs/kb/automate-orchestrator-realism.md` states there is no Node process that spawns writers; Layer 4 spawn adapters are an explicit non-goal. Layers 1–2.5 only refuse illegal *state* when the agent calls them.
2. **Grok skill gap.** The only `ide.grok` block in `skills/core/implement.md` documents `spawn_subagent` (explore) for heavy reads and says coding stays single-threaded — it does not prescribe a phase-writer spawn (`general-purpose` + worktree/cwd + constructed brief).
3. **No product-source fence on the plan tree.** Under automate, nothing machine-blocks host commits of product paths on the plan branch outside a writer→merge channel before `done`.

Operator demand: prose alone (#1) is insufficient; ship **clarity + Layer 3 runner + plan-tree product fence**.

## Decisions

1. **Ship three complementary layers in one plan: #1 + A + B.**
   - **#1 Skill recipe:** concrete host spawn instructions (especially Grok) so the correct tool call is unambiguous.
   - **A Layer 3 host-local runner:** a CLI that builds work-order, acquires lease, cuts sibling worktree, writes a sealed brief, waits/validates claim-report, prints merge commands.
   - **B Plan-tree product fence:** under durable automate, refuse orchestrator `done` / assert done when product paths on the plan branch changed outside validated claim SHAs / writer merge.

2. **Honesty of guarantee.** This plan does **not** claim Layer 4 (daemon multi-host spawn). Outcome after ship: host cannot *close* tasks via Mode-1 product commits on the plan tree, and the runner makes the writer channel the only supported path. Spawn itself remains host-invoked (`spawn_subagent` / equivalent) guided by skill + runner output.

3. **No second top-level skill.** Extend `implement` + shared assets + pure helpers/scripts/tests. Do not add `skills/core/automate.md`.

4. **Reuse existing primitives.** Runner and fence compose `writer-lease.js`, `claim-report.js`, `automate-orchestrator-gates.js`, `maestro-cursor.js`, `assert-automate-gate.js` — extend, do not fork parallel gate systems.

5. **Sequential phase writers stay v1 law.** Concurrent phase writers remain forbidden; runner spawns/serves one phase at a time.

6. **Install surface.** New scripts under `scripts/` (already in package `files`) and any new `src/*` modules; skill bodies use `{{BASH_TOOL}}` / package-root resolution so consumers resolve the published package.

## Chosen approach

Weighed three packages:

| Approach | Summary | Verdict |
|----------|---------|---------|
| **P — Prose only (#1)** | Grok spawn recipe in skill markdown | Rejected alone: soft discipline; dogfood skips steps |
| **R — Runner only (A)** | CLI work-order/lease/brief/wait-claim | Incomplete without skill pointing at it and without fence against host plan-tree commits |
| **F — Fence only (B)** | Block done on host product commits | Incomplete: no guided writer path; still easy to stall without runner |
| **P+R+F (#1+A+B)** | Recipe + runner + fence | **Chosen** — clarity + guided path + fail-closed close |

**How it works after ship:**

```text
implement --mode=automate (host-thin)
  → assert-automate-gate --gate spawn
  → node scripts/automate-phase-run.js prepare|run …
       work-order + lease + sibling WT + sealed brief
  → host spawns phase writer (skill recipe: Grok spawn_subagent general-purpose)
  → writer returns claim-report at canonical path
  → runner validate claims
  → host merges writer branch → plan branch (git-ops only)
  → assert-automate-gate --gate done  (+ product-source fence)
  → orchestrator done only if claims + fence ok
```

## Non-goals

- Layer 4 full maestro daemon, multi-host recovery, crash-supervised spawn loop.
- Parallel phase writers or parallel product coding in one worktree.
- Proving the writer process was a Grok subagent vs a human in the sibling worktree (fence proves plan-tree channel, not process identity).
- Mode 2 Codex lane redesign (orthogonal executor path; out of scope).
- Silent Mode-1 fallback under automate (still forbidden; fence enforces close path).

## Rejected alternatives

- **Prose-only fix:** user rejected; cannot guarantee subagent behavior. `verified_by: conversation + docs/kb/automate-orchestrator-realism.md Layer table`
- **Full Layer 4 now:** multi-month product; realism doc marks non-goal until dogfood of 1–2.5 + runner. `verified_by: docs/kb/automate-orchestrator-realism.md Layer 4 section`
- **Lease-secret claim signing (option C) in this plan:** valuable follow-up; deferred to keep 1+A+B shippable. Fence + runner path is enough for Mode-1 plan-tree close denial.
- **Second skill `automate.md`:** reimplements implement; realism "What not to do".

## Open questions

1. **Fence path classification:** exact definition of "product path" vs state paths (`.atomic-skills/**`, docs-only, tests). Resolve in F2 with a pure classifier + tests; default: anything not under `.atomic-skills/` and not pure plan-branch git-ops metadata is product unless an allowlist says otherwise.
2. **Runner wait mode:** blocking `--wait-claim` with timeout vs prepare-only + validate subcommand. Prefer both: `prepare` (brief) and `validate` (claim); optional `run --wait-claim`.
3. **Sibling worktree path:** reuse worktree-isolation sibling rule (never nest under plan worktree). Confirm command template in F1 against `skills/shared/worktree-isolation.md`.

## Fence comparison algorithm (F2 contract — critic F-1)

Default v1 (implement T-006/T-007; inject lists at CLI, pure predicate in module):

1. **Range:** plan-branch commits from `baseRef` recorded at runner `prepare` (lease acquire / worktree seed) through current plan-branch `HEAD` after merge settle. Prefer `git diff --name-only <baseRef>..HEAD` on the plan worktree; inject the path list into the fence.
2. **Coverage:** a product path in that diff is **covered** if it appears in any open claim's `paths[]` from the validated claim report for this phase (path-set intersection). Claim SHAs must also pass existing reachability on plan HEAD.
3. **Merge commits:** after D.5 merge, the plan-branch diff is the authority; partial merge that leaves product paths on plan branch without claim paths fails the fence.
4. **State allowlist:** paths under `.atomic-skills/` never trip the product fence (state writes remain orchestrator-owned).
5. **Choke point:** wire into `canDoneFromAutomateClaims` / `assert-automate-gate --gate done` only for v1 (one choke). Bypassing assert without fenced done remains out of process guarantee (same as other Layer-1 helpers).

## Maestro cursor ownership (critic F-2)

- **Host skill (pure maestro)** advances `src/maestro-cursor.js` on every A–I boundary (existing contract).
- **Runner does not** own cursor step transitions. `prepare` may *require* cursor already at **C** (or document that host must `advanceCursor` to C before prepare); `validate` does not jump to E — host advances D → D.5 → E after merge.
- Skill Step C order: advance cursor to C → assert spawn → runner prepare → spawn writer → validate claims → merge → advance E → assert done (+ fence).

## Blast radius

- **Reversible:** skill markdown and docs (low risk).
- **Semi-reversible:** new CLI + pure helpers; consumers get new commands only after reinstall/publish.
- **Behavioral one-way for automate stamp:** once fence ships, automate plans that previously closed with host product commits on plan branch will **fail assert done** until they use writer→merge. That is intentional fail-closed; document migration note in realism + implement antipatterns.
- **Sibling worktree lifecycle (critic F-3):** runner `prepare` cuts a sibling worktree; on abandon/fail, host must remove the sibling WT and clear lease only with acquire secret (existing lease rules). Residual WTs after crash are operator cleanup — document in runner help and realism Layer 3; never nest under plan worktree.
- **Layer 3 + worktree cut:** this plan's runner is realism L3 **plus** sibling worktree cut (extension of the print-brief sketch in realism).
- **No schemaVersion bump required** if fence state is ephemeral assert input (claim report + git) rather than new plan frontmatter fields. Prefer no plan schema change in v1 of this plan.
- **Critic:** 2026-07-29 `approve_with_nits` (Approved, zero blocker/critical); nits F-1..F-3 folded into this section.

## Self-review against code-quality gates

- G1 read-before-claim: applied — claims about automate layers cite `docs/kb/automate-orchestrator-realism.md` and prior investigation of `implement.md` Grok block / writer-lease.
- G2 soft-language: applied — no should/probably in decisions; guarantee boundaries stated as hard non-claims.
- G6 reference-or-strike: applied — decisions reference realism doc and existing modules by path.
