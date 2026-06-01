# Self-Host Migration — Seed Artifact (DESIGN doc for `projects/atomic-skills/migration-self-host/`)

> Status: **DESIGN (hand-authored, B4)** — this is the one stage that cannot dogfood itself (brainstorm/critic do not exist yet). It encodes the already-decided design canon (4 turns) plus the critique-honored conditions. PLAN onward is dogfooded.
> projectId = `atomic-skills` · plan-slug = `migration-self-host` · lives at `.atomic-skills/projects/atomic-skills/migration-self-host/design.md`

---

## 1. Executive summary + the single most important decision

We are turning `project` from a pure state-tracker into a thin **orchestrator above SDD** with a 3-stage lifecycle (DESIGN → PLAN → DECOMPOSE+SPEC), an actor-critic gate, a verify-on-done loop with real teeth, two execution modes, and a new on-disk model (`Project → Plan → Initiative → Task` under `.atomic-skills/projects/<id>/<slug>/`). The layout migration is **dogfooded as the first plan through the new lifecycle** — but only the *mechanical* spine (path-emit, lint, verifier-execution, handoff/resume) runs on the migration's critical path; the *cognitive* machinery (brainstorm, critic, debate-gate, Mode 2, codex write-mode) is built+pressure-tested conventionally on a throwaway and only **replayed** over the migration as a regression check.

**THE SINGLE MOST IMPORTANT DECISION (and the #1 blocker):** *Build the cross-agent enforcement gate before trusting it.* The whole "orchestration lives in portable skill bodies, Workflow tool is only a `{{#if ide.claude-code}}` accelerator" decision rests on a CI guarantee (R-ORCH-30/31) that **does not exist today** — verified: `tests/compatibility.test.js` `FORBIDDEN_TERMS` is `['Bash','Read tool','Write tool','Edit tool','Agent tool','$ARGUMENTS']` with **no** `Workflow`/`TaskCreate`/`EnterWorktree`/`Monitor` token and no "byte-runnable-when-stripped" assertion. Until that gate is extended (R-XAGENT-01, sequenced **first**, before any orchestration lands), the portability rule is unenforceable and Gemini can silently break while CI stays green. Everything else is conditional on this.

---

## 2. REQUIREMENTS REGISTRY (consolidated, de-duplicated)

Stable ids preserved from the source registries; cross-area duplicates merged into one canonical row with `(merges …)` noting the absorbed ids. Four **NEW** rows (`R-NEW-*`) close gaps the critiques surfaced. Priority: **B**locker / **C**ore / **N**ice.

### 2.1 Orchestrator / Lifecycle (front-door, 3-stage model, actor-critic gate, gate ladder, composition)

| id | requirement | type | owner | depends_on | acceptance | pri |
|---|---|---|---|---|---|---|
| R-ORCH-01 | `/project new` presents a magnitude-scaled 4-lane TRIAGE front-door (park/log · emerge · ad-hoc-anchored 1-task · full lifecycle), not the fixed {plan,initiative} menu | skill-ext | project.md:111-124 + project-triage.md (new) | — | one-line desc routes to exactly one lane + prints why; 1-task never → multi-phase plan | B |
| R-ORCH-02 | Triage reuses the existing emergence ladder (project.md:94-109) for magnitude — no parallel classifier | skill-ext | project.md ladder | 01 | grep shows no 2nd magnitude table; each lane maps to a named rung | C |
| R-ORCH-03 | ad-hoc-anchored single-task lane runs ZERO gates (no DESIGN/PLAN/debate/critic) — only No-Placeholders lint | skill-ext | project-triage.md | 01 | 1-task degenerate 1-phase plan, no design.md, no review-plan, no debate | B |
| R-ORCH-04 (= R-MIG-03) | ad-hoc session = log line in PROJECT-STATUS.md `Ad-Hoc Sessions Log`, NOT an entity/folder | skill-ext | PROJECT-STATUS.md.template + project-triage.md | 25 | dated line appended; zero dirs created | C |
| R-ORCH-05 | SURFACE-AND-ASK dedup before work: lexical title/goal match over local state, false-negative biased, HALTs for user choice, never auto-anchors | new-skill | project-triage.md + project.md | 01 | ≥1 token overlap → surface+HALT; no overlap → proceed; never silently anchors | B |
| R-ORCH-06 | Dedup scans only local state (`projects/<id>/*/plan.md`+phases), not repo-wide; does not invoke `discover` | skill-ext | project-triage.md | 05 | reads only project folder; no git/docs/memory scan; no discover call | N |
| R-ORCH-07 (= R-SP-26) | Lifecycle collapses to 3 stages DESIGN→PLAN→DECOMPOSE+SPEC; brainstorm = divergent front-half of DESIGN; exactly 3 artifact types, no 4th document | skill-ext | project-create-plan.md | — | produces design.md + plan.md/phases + per-task interior; 3 stages described | B |
| R-ORCH-08 (= R-SP-27) | Rewire project-create-plan Stages 2-3 / §201-277 to call internal `atomic-skills:brainstorm`, not `superpowers:*` | skill-ext | project-create-plan.md + brainstorm.md | 07, R-SP-01 | DESIGN stage calls atomic-skills:brainstorm; completes with superpowers absent | B |
| R-ORCH-09 | DESIGN output = committed `design.md` (decisions + WHAT + chosen approach); PLAN refuses to start without it | schema | project-create-plan.md + layout | 07, 25 | design.md exists with decisions/chosen-approach; PLAN blocks if absent | C |
| R-ORCH-10 | PLAN consumes decompose-shaped source (## F0/F1 + ### Tn + exit_gate YAML) via decompose.js, FORMAT UNCHANGED | skill-ext | project-create-plan.md + decompose.js | 07 | decomposePlan heuristics unchanged; source.md → materialized phases | C |
| R-ORCH-11 | DECOMPOSE+SPEC = per-task interior (description+acceptance[]+scopeBoundary[]+verifier) in EXISTING schema — no new keys | skill-ext | project-create-plan.md + initiative.schema.json:163-176 | 07 | task carries acceptance[≤5]+scopeBoundary[]+verifier; validate-state passes, 0 new keys | C |
| R-ORCH-12 (= R-SP-24) | No-Placeholders lint ENFORCED (deterministic, zero-token): rejects TODO/REPLACE_*/fuzzy paths before materialize | tooling | decompose.js + minimal-source.template | 11 | a REPLACE_* / TODO / `<path>` aborts materialize w/ named error, 0 files written | B |
| R-ORCH-13 (= R-SP-14) | Actor-critic: debate=ACTOR (divergence+synthesis, does NOT decide); a SEPARATE fresh evidence-checked CRITIC subagent emits binary Approved/Issues-Found | new-skill | debate.md + critic asset | — | gate-pass read from critic; debate output alone never passes a gate | B |
| R-ORCH-14 | Gate-pass NEVER from panel/debate consensus (false-pass trap) — only critic R3 binary verdict | gate | debate.md + critic | 13 | unanimous panel + critic Issues-Found → does NOT advance | B |
| R-ORCH-15 (= R-SP-13) | debate.md gains thin GATE-MODE: bounded agenda + mandatory per-round contrarian + machine-readable verdict block; Iron Law preserved | skill-ext | debate.md | 13 | gate-mode emits verdict block; every round has contrarian; Iron Law intact | C |
| R-ORCH-16 (= R-SP-15) | DESIGN debate panel fires ONLY if ≥2 viable approaches AND expensive-to-reverse; else skip | gate | project-create-plan.md | 13 | single/cheap approach → no panel; ≥2+expensive → panel | C |
| R-ORCH-17 | When DESIGN panel runs → critic R3 + explicit user approval before pass | gate | project-create-plan.md | 13, 16 | advance only on critic Approved AND user approval | C |
| R-ORCH-18 (= R-SP-16) | PLAN gate = single review-plan pass (no panel); debate only if a real fork survived DESIGN | gate | project-create-plan.md + review-plan.md | 07 | review-plan invoked once; no panel unless surviving fork recorded | C |
| R-ORCH-19 | SPEC/per-task gate = No-Placeholders lint + review-plan ambiguity checks, NO panel | gate | project-create-plan.md + decompose.js + review-plan.md | 12 | lint + ambiguity only; no debate spawn at SPEC | C |
| R-ORCH-20 (= R-EXEC-01/02, R-SP-20) | VERIFY-ON-DONE: un-stub `kind:test` (+ decide `kind:query`) verifiers to EXECUTE on done/phase-done | skill-ext | project-transitions.md:178-203 | — | phase-done runs runner+pattern, stamps evidence from real result; "stubbed" language removed | B |
| R-ORCH-21 (= R-EXEC-03) | Criterion with a verifier → `met` ONLY with an evidence block from a real run (passed:true); manual override may only set `deferred` | gate | project-transitions.md | 20 | met without evidence refused; failed run keeps evidence, stays pending/deferred | B |
| R-ORCH-22 | Executed acceptance test = near-free escalation judge for Mode 2; cheap model NEVER self-certifies | capability | implement.md + project-transitions.md | 20 | task done only when verifier green; cheap model can't self-mark done | C |
| R-ORCH-23 | Per-task hard plan-quality gate: no task admitted to SPEC without exact paths + scopeBoundary[] + deterministic verifier | gate | project-create-plan.md + decompose.js | 11, 12 | task lacking verifier/scopeBoundary fails SPEC gate w/ named error | C |
| R-ORCH-24 (= R-EXEC-26, R-SP-21) | Mode 2 default OFF behind cost-justification gate; per-TASK routing; Opus plans+reviews, Sonnet/Haiku/Codex execute | capability | implement.md + project.md | 22 | no opt-in → Mode 1; Mode 2 needs gate + per-task decision | N |
| R-ORCH-25 (= R-MIG-01) | Project is a real top level: `projects/<id>/<slug>/{plan.md,design.md,source.md(gitignored),reviews/,phases/f0-*.md}`; projectId = folder name | migration | decompose.js:750/803 + asset prose + layout | — | materialized plan writes to projects/<id>/<slug>/; walking projects/*/ w/ plan.md = unit | B |
| R-ORCH-26 (= R-MIG-13) | projectId derived from folder name, replacing serve.js deriveProjectId basename + aiDeck in-memory registry | migration | serve.js:191 + aiDeck | 25 | serve resolves projectId via folder enumeration; dashboard routes resolve to folder name | B |
| R-ORCH-27 (= R-MIG-02) | Standalone initiative = degenerate 1-phase plan (one folder shape, N≥1 phases) | migration | decompose.js + project-create-initiative.md + schemas | 25 | `new initiative` → projects/<id>/<slug>/{plan.md, phases/f0-*.md}; no flat initiatives/<slug>.md | B |
| R-ORCH-28 (= R-MIG-06/07) | normalize.js walks projects/<id>/<slug>/ (plan.md+phases/*.md incl. archives), not flat [plans,initiatives] loop | migration | normalize.js:206,230-237 | 25 | normalizeStateDir enumerates projects/*/*/; old flat loop gone | B |
| R-ORCH-29 (= R-MIG-08) | pre-write.sh provenance hook intercepts projects/<id>/<slug>/{plan.md,phases/*.md}, archives out of scope | migration | hooks/pre-write.sh + project-setup.md | 25 | PreToolUse on phases/*.md gated; non-entity/archive not gated | C |
| R-ORCH-30 | Lifecycle orchestration in skill bodies + durable state, NOT the Claude-Code-only Workflow tool — runs identically on Gemini | capability | project.md + project-assets/* | 07, **R-XAGENT-01** | flow driven by template vars; no skill body references a Workflow API; compat test passes | B |
| R-ORCH-31 | All new/extended bodies use tool-abstraction template vars + `{{#if ide.*}}` — never hard-coded tool names | gate | new skills + tests/compatibility.test.js | **R-XAGENT-01** | compat test flags any literal Bash/Read tool/Workflow token in new bodies | C |
| R-ORCH-32 (= R-EXEC-07/09) | Mode 1 self-exec uses EVENT-DRIVEN snapshot cadence (after task / before dispatch / phase boundary / on request) writing `## Session handoff` block — not a self-measured 60% gate | capability | implement.md + project-transitions.md | — | handoff block w/ 5 elements after task/before dispatch; no self-read context-% gate | C |
| R-ORCH-33 (= R-EXEC-11/12) | resume REFUSES on stale/dirty git OR unfilled TODO placeholders in handoff | gate | implement.md + project-transitions.md | 32 | dirty tree / placeholder handoff → named refusal, no execution | C |
| R-ORCH-34 | Triage + lifecycle mutations compose with always-resident Iron Law; every lane except declared ad-hoc terminates in an anchored initiative | gate | project.md:73-77 + project-triage.md | 01 | each non-ad-hoc lane ends with anchored initiative; implement w/o anchor refused | B |
| R-ORCH-35 | Always-resident pre-mutation gates (migration check + reconciliation) run BEFORE every new lifecycle mutation | gate | project.md:79-84 + create-plan + transitions | 07 | legacy file → migration-cancelled abort; stale task >24h → reconciliation prompt | C |
| R-ORCH-36 | park/emerge lanes still pass the ratify gate (solves/trigger/assumesStillValid); generic "ok" is not ratify | gate | project.md:90-92 + project-emergence + triage | 01 | park/emerge prints Proposed-mutation block + HALT; "ok" re-prompts | C |
| R-ORCH-37 | Gate-status invariant preserved across verify-on-done + new layout (status pending/met/deferred only) so aiDeck `.strict()` never rejects | gate | project.md:87-88 + project-transitions.md | 20 | no criterion carries status `done`; validate-state + aiDeck accept migrated state | C |
| R-ORCH-38 (= R-MIG-19 partial) | `project verify` reconciles the NEW projects/<id>/<slug>/ layout (schema/branch/scope/orphans/aiDeck coherence) | skill-ext | project-verify.md | 25 | verify resolves projects/*/*/; orphan check resolves parentPlan within project folder | C |

### 2.2 Execution Modes (Mode 1 self-exec · Mode 2 tiered · verify-on-done)

> Verify-on-done rows R-EXEC-01/02/03 are the canonical detail of R-ORCH-20/21; kept here for the EXEC-area acceptance specifics.

| id | requirement | type | owner | depends_on | acceptance | pri |
|---|---|---|---|---|---|---|
| R-EXEC-01 | Un-stub `kind:test` verifier to execute runner+pattern via {{BASH_TOOL}} on done/phase-done | skill-ext | project-transitions.md:192-203 | — | "stubbed execution" string gone from test section; runs `<runner> <pattern>`, writes evidence | B |
| R-EXEC-02 | Un-stub OR explicitly `DEFERRED-BY-DESIGN` the `kind:query` verifier — not silently stubbed | skill-ext | project-transitions.md:178-190 | — | query executes (rowCount evidence) OR carries documented deferred reason | C |
| R-EXEC-03 | Verifier writes canonical evidence block; `met` only when passed===true AND evidence present | capability | project-transitions.md + common.schema.json | 01,02 | passing → met+evidence (validates); failing → not met; validate-state passes | B |
| R-EXEC-04 | On phase-done, every pending non-manual verifier auto-runs before advance; loop fires automatically | skill-ext | project-transitions.md:135 | 03 | failing shell verifier blocks phase advance | B |
| R-EXEC-05 | Auto-exec of shell/test verifier gated by explicit y/N (intrusive-actions rule) | gate | project-transitions.md | 01 | y/N prompt present in test section as in shell; declining leaves pending, no evidence | C |
| R-EXEC-06 | Per-task `verifier` on `done <task-id>` routes through the same shared loop | skill-ext | project-transitions.md:209-211 | 03 | task close executes verifier, records pass/fail before closedAt; references shared patterns | C |
| R-EXEC-08 | Durable `.atomic-skills/` files ARE the snapshot; cadence persists there, no scratch file | capability | implement.md + project-transitions.md | R-ORCH-32 | snapshots write to initiative/plan + PROJECT-STATUS.md; no new untracked snapshot type | C |
| R-EXEC-10 | Handoff narrative preserves commands/paths/errors VERBATIM (no paraphrase) | gate | implement.md | R-ORCH-32 | Red-Flag forbidding paraphrase of literals present | C |
| R-EXEC-13 (= R-SP-06) | Coding/file-mutation stays SINGLE-THREADED; no parallel concurrent writers | gate | implement.md | — | "CODING STAYS SINGLE-THREADED" Iron Law + Red-Flag; no >1 simultaneous writer | B |
| R-EXEC-14 | Token-heavy READS delegated to read-only {{INVESTIGATOR_TOOL}} subagents; return distilled summary | capability | implement.md | 13 | uses {{INVESTIGATOR_TOOL}} for heavy reads, no literal Task/Bash | C |
| R-EXEC-15 | Snapshot written immediately BEFORE each subagent dispatch | capability | implement.md | R-ORCH-32, 14 | dispatch order = (1) snapshot (2) dispatch | C |
| R-EXEC-16 | Host context meter is ADVISORY only, never the authoritative snapshot trigger | capability | implement.md | R-ORCH-32 | meter described as advisory/"where available"; event cadence is source of truth | N |
| R-EXEC-17 | Mode 1 is the DEFAULT (no cost gate, no provider config) | capability | implement.md | — | fresh no-flag run selects Mode 1 | C |
| R-EXEC-18 | Mode 2 routes per-TASK, never per-feature | capability | implement.md | — | routing keys off task attributes; Red-Flag vs per-feature | B |
| R-EXEC-19 | Mode 2 tier map: Opus=plan+review only; 1-2 files→cheap, multi-file→standard, arch/review→most-capable; Codex via workspace-write | capability | implement.md | 18 | complete tier table; Opus never executes | B |
| R-EXEC-20 (= R-SP-19) | NEW workspace-write Codex profile mirrors canonical bridge but `--sandbox workspace-write` | skill-ext | codex-bridge-assets/ (new asset) | 19 | write profile uses workspace-write; invocation-canonical.txt stays read-only | B |
| R-EXEC-21 | Write profile reuses portable `run_with_timeout` (timeout/gtimeout/perl-alarm; handles 124 & 142) | skill-ext | codex-bridge-assets write profile | 20 | references run_with_timeout + 124/142; no bare `timeout` | B |
| R-EXEC-22 | Codex workspace-write runs in an isolated git worktree (never primary tree), path via bridge cwd | new-skill | worktree-isolation.md + write profile | 20 | write profile points Codex at dedicated worktree; primary tree never the sandbox | B |
| R-EXEC-23 | Write profile must NOT use `--yolo`/`--dangerously-bypass…`/`--full-auto`; keeps `-a never exec --skip-git-repo-check` | gate | codex-bridge-assets write profile | 20 | grep finds workspace-write + never/exec; finds none of the dangerous flags | B |
| R-EXEC-24 | Write-mode preflight drops the review-only clean-tree gate (codex #8404) since worktree is intentionally mutated | skill-ext | preflight-checks.txt write variant | 22 | retains binary/callable/inside-git; does NOT abort on dirty worktree | C |
| R-EXEC-25 | Mode 2 dispatch eligibility = plan-quality HARD-GATE: no placeholders + exact paths + non-empty scopeBoundary[] + deterministic verifier | gate | implement.md + initiative.schema.json | 18 | task missing scopeBoundary[] rejected pre-dispatch w/ named failure | B |
| R-EXEC-27 | After cheap/Codex returns, the task acceptance test runs as escalation judge before accept | capability | implement.md | 03, 25 | failing verifier → escalate (retry stronger / surface), NOT done | B |
| R-EXEC-28 | Cheap/Codex executor NEVER self-certifies; only paths to done = verifier passes OR strong model approves | gate | implement.md | 27 | "cheap model never self-certifies" Iron Law present | B |
| R-EXEC-29 | Mode 2 dispatch integrates with state machine: active on dispatch, done only via verify-on-done acceptance path | skill-ext | implement.md + project-transitions.md | 27 | dispatch sets active+tier; accept-pass sets done+evidence; validates schema | C |
| R-EXEC-30 (= R-SP-05 link) | Degraded inline fallback: no alternate tier/provider → Mode 2 collapses to Mode 1, not fail | capability | implement.md | 17, 19 | Mode 2 requested + Codex absent + no subagent tier → Mode 1 w/ notice | C |
| R-EXEC-31 (= R-SP-08) | Every NEW Iron Law/Red-Flag/Rationalization block (Mode 1 + Mode 2) baseline-pressure-tested (3+ combined-pressure scenarios) before implement ships | gate | skill-authoring.md + implement.md | R-ORCH-32, 13, 28 | pressure-test record (≥3 scenarios per block) dated before implement done | C |

### 2.3 Superpowers-Extraction (new skills/assets, extensions, RENT probe, DROP-clean)

| id | requirement | type | owner | depends_on | acceptance | pri |
|---|---|---|---|---|---|---|
| R-SP-01 | Create `skills/core/brainstorm.md` = divergent front-half of DESIGN → committed design doc; not a peer stage | new-skill | brainstorm.md | — | file exists; scopes to DESIGN front-half; template vars only | C |
| R-SP-02 | brainstorm.md carries ≥1 Iron Law + Red-Flags + Rationalization table (premature convergence, single-approach tunnel, WHAT-before-HOW) | new-skill | brainstorm.md | 01 | grep finds Iron Law + Red Flags + Rationalization table | C |
| R-SP-03 | brainstorm discipline blocks pressure-tested (3+ combined-pressure scenarios, T13 RED-GREEN) before ship | gate | brainstorm.md + skill-authoring.md | 02, R-SP-12 | pressure-test record cited; no block ships unverified | C |
| R-SP-04 | Create `skills/core/implement.md` = execution driver consuming decomposed plan; built LAST (composes worktree+spec-verifier+prompts+state wiring+degraded fallback) | new-skill | implement.md | 09,10,11,19,26 | file exists, references all sub-pieces; built after R-SP-01..26 | C |
| R-SP-05 | implement.md folds dropped superpowers executing-plans as a single degraded-mode paragraph (no external ref) | new-skill | implement.md | 04 | degraded paragraph present; zero `superpowers:executing-plans` refs | C |
| R-SP-07 | implement.md wires project transitions: on task/phase done invokes verify-on-done + updates `.atomic-skills/` | new-skill | implement.md | 04, 20 | references done/phase-done path + verify-on-done as completion gate | C |
| R-SP-09 | Create `skills/core/verify-claim.md`: deterministic acceptance test → binary pass/fail + cited evidence; cheap model never self-certifies | new-skill | verify-claim.md | — | file exists; runs acceptance test, binary verdict+evidence; forbids self-cert | C |
| R-SP-10 | Create `skills/shared/debug-techniques.md`: OWNED debugging discipline (root-cause, bisection, boundary instrumentation), referenced by fix+implement | new-skill | debug-techniques.md | — | file exists; referenced by fix.md/implement.md; has boundary instrumentation | C |
| R-SP-11 | Create `skills/shared/worktree-isolation.md`: native EnterWorktree/ExitWorktree first, raw `git worktree` fallback | new-skill | worktree-isolation.md | — | file exists; native-first then fallback; referenced by implement + write profile | C |
| R-SP-12 | Create `docs/kb/skill-authoring.md`: RED-GREEN-REFACTOR pressure-test method + 3+-combined-factor rule + rented-phrasing exemption | doc | skill-authoring.md | — | file exists; describes method + rule; cited by SP-03/08/22/23/32 | C |
| R-SP-17 | Extend fix.md: 3-failed-fixes architectural circuit-breaker (distinct from 5-hypothesis cap + Phase-3b 2x escalation) | skill-ext | fix.md | — | circuit-breaker at 3 failed fixes/same root cause → escalate to architecture | C |
| R-SP-18 | Extend fix.md: boundary instrumentation referencing debug-techniques.md before next hypothesis on fail/cross-module | skill-ext | fix.md | 10 | fix.md references boundary instrumentation + links debug-techniques.md | C |
| R-SP-22 | Add Receiving-findings block to review-code.md (verify-before-apply + YAGNI); pressure-tested | skill-ext | review-code.md | 12 | discipline block present; strengthens existing Triage Step-3 verify, not dup | C |
| R-SP-23 | Add Receiving-findings block to review-plan.md; preserves never-edit-initiative HARD-GATE | skill-ext | review-plan.md | 12 | block present; never-edit HARD-GATE intact; pressure-tested | C |
| R-SP-28 | RENT probe: optional detect-and-degrade for superpowers discipline phrasing; owned workflows work fully without it; no per-model-bump re-pressure-test | skill-ext | project-create-plan.md Stage 2 | R-SP-27 | probe optional; degrades cleanly; no internal skill hard-depends on superpowers | C |
| R-SP-29 | DROP-clean: remove ALL delegation/defers to superpowers skills we match/exceed (using-superpowers, dispatching-parallel-agents, requesting/receiving-code-review, finishing-a-development-branch, executing-plans, using-git-worktrees) | migration | skills/ (repo-wide) | 05, 30 | grep for those 7 `superpowers:*` ids returns zero hits | C |
| R-SP-30 | parallel-dispatch.md: replace superpowers defers (lines 18/21/33) with atomic-skills:brainstorm / atomic-skills:prompt | skill-ext | parallel-dispatch.md | 01 | `grep -n superpowers skills/core/parallel-dispatch.md` = 0 hits | C |
| R-SP-25 | minimal-source.template.md: per-task Files block + RED-GREEN checklist + acceptance[]/scopeBoundary[] prompts | schema | minimal-source.template.md | R-SP-24/R-ORCH-12 | template prompts for all four; decompose parses into task interior; lint validates filled | C |
| R-SP-31 | debate.md Orchestrator-Synthesis handoff: gate-mode hands to critic for verdict; non-gate synthesis behavior unchanged | skill-ext | debate.md | 13, R-SP-14 | gate-mode names critic as verdict authority; non-gate behavior preserved | N |
| R-SP-32 | RENT-probe exempt from per-block pressure-test budget (rents phrasing, owns no discipline block) | gate | skill-authoring.md | R-SP-28, 12 | skill-authoring states rented phrasing exempt; owned blocks in-scope | N |
| R-SP-33 | Register 6 new skills/assets in meta/catalog.yaml; regenerate README/dashboard | doc | meta/catalog.yaml | 01,04,09,10,11,12 | catalog has all 6 entries; README/dashboard regen clean | N |

### 2.4 Layout / Migration

| id | requirement | type | owner | depends_on | acceptance | pri |
|---|---|---|---|---|---|---|
| R-MIG-04 | decompose.js materialize plan file → `projects/<id>/<slug>/plan.md` (was flat `plans/${slug}.md` @750) | migration | decompose.js:750 | R-ORCH-25 | :750 produces projects/<id>/<slug>/plan.md; unit test asserts no flat string | B |
| R-MIG-05 | decompose.js phase file → `projects/<id>/<slug>/phases/f<N>-<title>.md` (was flat `initiatives/${slug}.md` @803); update collision guard 804-812 to per-plan namespace | migration | decompose.js:803-812 | R-MIG-04 | :803 → phases path; guard still throws on dup phase id within a plan; test asserts both directions | B |
| R-MIG-06 | normalize.js kind-inference by tree position (plan.md vs phases/*.md), not flat `plans`/`initiatives` segments | migration | normalize.js:206 | R-MIG-04/05 | plan.md→plan, phases/f0-x.md→initiative | C |
| R-MIG-07 | normalize.js normalizeStateDir walks `projects/*/*/` (plan.md+phases incl. archive), not flat loop @230-237 | migration | normalize.js:230-237 | R-MIG-06 | normalizes every plan.md+phases/*.md under projects/*; flat loop gone | C |
| R-MIG-09 | aiDeck writers/paths.ts classifyFile + ENTITY_DIRS resolve plan/phases under projects/<id>/<slug>/ — **sequence WITH aiDeck rewrite** | migration | vendor/aideck-runtime/.../paths.ts | R-MIG-04/05 | classifyFile returns {plan|initiative,slug} for new tree; aiDeck tests pass | B |
| R-MIG-10 | aiDeck state.ts buildAllForConsumer reads new per-plan tree (was flat @34-57) — **WITH rewrite** | migration | .../projections/state.ts:34-57 | R-MIG-09 | returns same Plan[]+Initiative[] as equivalent flat fixture | B |
| R-MIG-11 | aiDeck consumers.ts hasContent recognizes projects/<id>/<slug>/ units (was @34) — **WITH rewrite** | migration | .../projections/consumers.ts:34 | R-MIG-09 | project w/ ≥1 plan.md = active; empty = empty | C |
| R-MIG-12 | aiDeck watcher.ts emits correct events for new-tree adds/changes — **WITH rewrite** | migration | .../watcher.ts | R-MIG-09 | new phases/*.md → state-change w/ kind=initiative + slug | C |
| R-MIG-14 | aiDeck in-memory Map ProjectRegistry + own deriveProjectId @119-153 → enumerate projects/* on disk — **WITH rewrite** | migration | .../routes/api.ts:119-153 | R-MIG-13 | GET /api/projects = one per folder w/o prior register; Map not source of truth | B |
| R-MIG-15 | dashboard routes drive off project-scoped paths primary; legacy non-scoped routes fallback/removed — **WITH rewrite** | migration | src/dashboard/App.tsx:18-26 | R-MIG-14 | /projects/:id and /:id/plans/:slug render new-layout; build succeeds | C |
| R-MIG-16 | Rewrite ~10 project-assets prose files from flat to new-tree paths | doc | project-assets/* | R-ORCH-25 | grep flat paths in project-assets/ = 0 (except migrate.md legacy context) | C |
| R-MIG-17 | Update plan/initiative/common schema description strings to new tree | schema | meta/schemas/*.json:5,79 | R-ORCH-25 | descriptions reference projects/<id>/<slug>/...; validate-state passes | N |
| R-MIG-18 | Update catalog.yaml output-path refs (424-425) + prose to new tree | doc | meta/catalog.yaml:424-425 | R-ORCH-25 | 424-425 list projects/<id>/<slug>/plan.md + phase path; catalog lint passes | N |
| R-MIG-19 | `project verify` DETECTS old flat tree → legacy-layout migration-required finding (extends check 2) | skill-ext | project-verify.md:37-40 | R-ORCH-25 | flat tree → WARN/FAIL legacy-layout recommending migrate; pure new tree → none | B |
| R-MIG-20 | `project migrate` MIGRATES flat→new (plans/<slug>.md→plan.md; initiatives/<slug>-<phaseId>.md→phases/; orphans→1-phase plans; reuse src/migrate.js helpers) | skill-ext | project-migrate.md + src/migrate.js:114,148 | R-MIG-01/02/19 | after migrate: all under projects/<id>/<slug>/; orphans=1-phase plans; no flat files; validate-state+verify pass | B |
| R-MIG-21 | Global `.atomic-skills/status/` (hooks/logs/SKIP/config.json) stays at root, OUTSIDE projects/ | schema | .atomic-skills/status/ | R-ORCH-25 | SKIP flags + config.json resolve at status/ regardless of active project | C |
| R-MIG-22 | Per-project PROJECT-STATUS.md = index (Active Plans/Initiatives/Recently Archived/Ad-Hoc Log) at projects/<id>/ | schema | PROJECT-STATUS.md.template | R-ORCH-25, R-ORCH-04 | one PROJECT-STATUS.md per project; Active Plans rows resolve to <slug>/plan.md | C |
| R-MIG-23 | source.md gitignored; reviews/ subdir holds per-plan timestamped artifacts (replaces flat reviews/+INDEX.md) | schema | layout + .gitignore + catalog | R-ORCH-25 | `git check-ignore projects/<id>/<slug>/source.md` succeeds; reviews land in plan reviews/ | N |
| R-MIG-24 | Migration runs AS the first plan through DESIGN→PLAN→DECOMPOSE→implement in new layout (dogfood) | gate | atomic-skills:project + this plan | R-MIG-04/05/19/20 | migration on disk at projects/atomic-skills/migration-self-host/{design,plan,phases}; verify PASS | C |

### 2.5 NEW rows — gaps the critiques surfaced (must-fix)

| id | requirement | type | owner | depends_on | acceptance | pri |
|---|---|---|---|---|---|---|
| **R-XAGENT-01** | Extend `tests/compatibility.test.js`: ban `Workflow`/`TaskCreate`/`TaskUpdate`/`TaskStop`/`Monitor`/`EnterWorktree`/`ExitWorktree`/`CronCreate` OUTSIDE a `{{#if ide.claude-code}}` block, AND a render-strip test (render each skill for `ideId='gemini'`, assert it parses as a complete procedure with every `{{#if ide.claude-code}}` block removed = byte-runnable-when-stripped). **Lands BEFORE any orchestration.** | gate | tests/compatibility.test.js | — | a skill body with `TaskCreate(` outside a CC block fails CI; a CC-only Workflow step inside the block passes; gemini-rendered skill parses with CC blocks stripped | **B** |
| **R-XAGENT-02** | Capability-probe `{{INVESTIGATOR_TOOL}}`: confirm whether Gemini `codebase_investigator` can WRITE files / use tools in a worktree. If read-only, redefine portable Mode 2 executor as **codex-bridge-only** and gate the subagent-executor tier under `{{#if ide.claude-code}}`; relabel "portable Mode 2" honestly. Same for fresh-critic isolation (fall back to a **codex critic** where a fresh same-provider subagent can't be guaranteed). | capability | implement.md + brainstorm.md (critic) | R-XAGENT-01 | doc records investigator write-capability per host; Mode 2 cheap-tier + critic carry an honest host caveat / codex fallback | **B** |
| **R-XAGENT-03** | Define Mode 2 worktree **MERGE-BACK** as a deterministic SERIAL step: acceptance test passes IN the worktree → serial fast-forward/rebase onto primary → re-run verifier on primary → only then status=done; preserves single-threaded-coding invariant (R-EXEC-13). If procedure not ready, ship Mode 2 WITHOUT worktree isolation (codex workspace-write on a branch) OR leave merge-back as an operator-prompted step. **Authored before implement.md.** | new-skill | implement.md + worktree-isolation.md | R-EXEC-22, R-EXEC-29 | merge-back procedure documented + tested; verifier re-runs on primary post-merge; no two-worktree concurrent merge path | **B** |
| **R-XAGENT-04** | Critic asset has a defined home + contract: lives at a named path (e.g. `skills/core/critic-validator.md` or `debate-assets/critic.md`), spawned as a FRESH clean-context subagent distinct from any debate panel member, evidence-checked, emits the binary verdict at R3 (final round). | new-skill | critic asset | R-ORCH-13 | asset file exists at the named path; gate wiring spawns it fresh + separate; emits binary verdict | **B** |
| **R-XAGENT-05** | PLAN/DECOMPOSE materialize idempotently appends the `projects/*/*/source.md` gitignore glob (the way `_drafts/` was handled), so source.md is actually ignored — not merely assumed | tooling | decompose.js / project-create-plan.md | R-MIG-23 | after first materialize, `.gitignore` contains the source.md glob once; re-run does not duplicate it | C |
| **R-XAGENT-06** | Deterministic `design.md` section lint (mirrors No-Placeholders, zero-token, cross-agent): require `decisions` + `chosen-approach` (+ blast-radius for migrations); gives the "PLAN refuses without design.md" gate (R-ORCH-09) something testable | tooling | decompose.js / a sibling lint | R-ORCH-09 | a design.md missing a required section fails the lint; PLAN gate reads the lint result | C |
| **R-XAGENT-07** | Verify-on-done false-green guards: evidence must capture a parsed **test-count** (or explicit "N tests ran"), not just an exit code; a verifier whose pattern matches **no tests** leaves status `pending`, not `met`; runner-not-found ≠ met | gate | project-transitions.md + transition.test.js | R-EXEC-03 | RED tests: (a) non-zero exit ≠ met, (b) 0 tests collected ≠ met, (c) runner-not-found ≠ met — all pass before any downstream step self-certifies | **B** |
| **R-XAGENT-08** | Extend `validate-state.js` kindFromPath to also infer kind from `phases/` position WITHOUT touching the flat dir-walk (lines 91-101/130 stay intact so the live flat tree keeps validating during the dogfood window) | migration | scripts/validate-state.js:96-104 | R-MIG-04 | a `projects/<id>/<slug>/phases/f0-x.md` infers kind=initiative; flat-tree validation unchanged | **B** |
| **R-XAGENT-09** | Run the entire dogfood against a **COPIED / redirectable state root** (e.g. `ATOMIC_SKILLS_DIR=.atomic-skills-dogfood/`), not the live gitignored tree. First verify decompose/normalize/serve/validate-state honor a configurable root (serve.js already takes `rootDir`); if any hardcode `.atomic-skills/`, that is itself a migration prerequisite | migration | decompose.js, normalize.js, serve.js, validate-state.js | R-ORCH-25 | the four tools accept a configurable state root; dogfood writes only to the copy; live tree byte-frozen until D7 | **B** |
| **R-XAGENT-10** | Move Mode 2 provider/quota/cost routing OUT of the skill body into an operator-supplied config the skill reads (e.g. `.atomic-skills/status/routing.json`). Skill declares the per-task tier REQUIREMENT + dispatch CONTRACT only — not the cost narrative or provider list | capability | implement.md + status/routing.json | R-ORCH-24 | skill body has no embedded provider economics; reads routing.json; default-OFF preserved | N |
| **R-XAGENT-11** | CI line-budget assertion on the always-resident section of project.md (`# ALWAYS-RESIDENT` → EOF) so orchestration growth is visible; new sequencing lives in a single lazy `project-lifecycle.md` dispatched from one table row, not new resident invariants | gate | tests + project.md + project-lifecycle.md (new) | R-ORCH-30 | resident section stays under a fixed line budget; CI fails if exceeded; only new resident line is the triage pointer | C |

---

## 3. WORKFLOW MAP (by stage)

Each workflow's spine is the **PORTABLE** path (template-var subagent dispatch + `{{BASH_TOOL}}` + durable `.atomic-skills/` state). The Claude-Code Workflow/Task/Worktree tooling is admitted **only** inside `{{#if ide.claude-code}}` as a faster fan-out path, and only after **R-XAGENT-01** mechanically proves the body is byte-runnable with those blocks stripped.

### WF-TRIAGE — `/project new` (stage: triage)
- **Steps:** read project-triage.md (lazy) → **dedup** ({{GREP_TOOL}}/optional {{INVESTIGATOR_TOOL}} over `projects/<id>/*/plan.md`+phases, false-negative biased, HALT+surface, never auto-anchor, never call discover) → classify magnitude vs resident ladder → pre-mutation gates → route: park/emerge (ratify gate, Proposed-mutation block) · ad-hoc (one log line, zero folders) · single-task (1-task degenerate 1-phase plan, ZERO gates, lint only) · multi-phase (→ WF-DESIGN). Every non-ad-hoc lane ends anchored (Iron Law).
- **Owner:** project.md + **project-triage.md (new)**
- **Reqs:** R-ORCH-01,02,03,04,05,06,34,35,36 · R-MIG-03
- **Mechanism:** pure router + lazy detail; no subagents required. No Workflow tool. Gemini-identical.

### WF-DESIGN — brainstorm front-half + actor-critic gate (stage: design)
- **Steps:** invoke `atomic-skills:brainstorm` (replaces superpowers delegation) → DESIGN gate decision (panel **only** if ≥2 viable AND expensive-to-reverse) → if panel: debate.md gate-mode ACTOR (bounded agenda + per-round contrarian + machine-readable verdict; **panel does not decide**) → spawn **fresh CRITIC** (R-XAGENT-04 asset, separate from panel) → binary Approved/Issues-Found → write `design.md` (passes section lint R-XAGENT-06) → advance only on critic Approved AND explicit user approval.
- **Owner:** brainstorm.md + debate.md + critic asset; orchestrated from project-create-plan.md
- **Reqs:** R-ORCH-07,08,09,13,14,15,16,17 · R-SP-01,02,03,13,14,15,27,28,31 · R-XAGENT-04,06
- **Mechanism:** brainstorm + panel + critic dispatched as `{{INVESTIGATOR_TOOL}}` subagents; verdicts passed via durable text (design.md / reviews/). **Caveat (R-XAGENT-02):** critic freshness/isolation is host-dependent — fall back to a **codex critic** where a fresh same-provider subagent can't be guaranteed. `{{#if ide.claude-code}}` optional: native parallel fan-out for panel+critic.

### WF-PLAN — decompose-shaped source → plan.md + phases (stage: plan)
- **Steps:** refuse if no design.md → author `source.md` (gitignored draft; glob appended by R-XAGENT-05) → pre-mutation gates → No-Placeholders lint → `decompose.js` materialize to `projects/<id>/<slug>/plan.md` + `phases/f<N>-*.md` → normalize + validate-state → PLAN gate = single review-plan pass (no panel unless a surviving DESIGN fork is recorded — default = no record = no panel) → apply findings via project (never edit initiative files directly).
- **Owner:** project-create-plan.md + decompose.js + review-plan.md
- **Reqs:** R-ORCH-10,18 · R-SP-16,23,26 · R-MIG-04,05 · R-XAGENT-05
- **Mechanism:** decompose = deterministic `{{BASH_TOOL}}` node transform; review-plan = single `{{INVESTIGATOR_TOOL}}` pass (or codex envelope). No Workflow tool.

### WF-SPEC — per-task interior + No-Placeholders lint (stage: decompose-spec)
- **Steps:** author per-task description + acceptance[≤5] + scopeBoundary[] + verifier (existing schema fields) → surface Files block + RED-GREEN checklist from minimal-source.template → run No-Placeholders lint (zero-token; abort+0 files on violation) → SPEC gate = lint + review-plan ambiguity checks ONLY (no panel) → admit to implement only tasks with exact paths + scopeBoundary[] + deterministic verifier.
- **Owner:** decompose.js (lint) + minimal-source.template.md + review-plan.md; from project-create-plan.md
- **Reqs:** R-ORCH-11,12,19,23 · R-SP-24,25
- **Mechanism:** core gate is a **non-LLM lint** via `{{BASH_TOOL}}` (zero subagents, zero tokens, identical everywhere). No Workflow tool.

### WF-VERIFY — verify-on-done loop (stage: verify, mode-independent)
- **Steps:** on done/phase-done enumerate pending non-manual verifiers → present command + y/N → EXECUTE via `{{BASH_TOOL}}` (test: runner+pattern, capture exit + parsed test-count; query: connection cmd or DEFERRED-BY-DESIGN) → write canonical evidence block → set `met` ONLY when passed===true AND evidence present AND tests-actually-ran (R-XAGENT-07) → phase-done refuses advance on any non-deferred unmet → gate-status invariant preserved.
- **Owner:** project-transitions.md + verify-claim.md + common.schema.json
- **Reqs:** R-ORCH-20,21,22,37 · R-EXEC-01,02,03,04,05,06 · R-SP-09,20 · R-XAGENT-07
- **Mechanism:** pure `{{BASH_TOOL}}` gated by `{{ASK_USER_QUESTION_TOOL}}` y/N; evidence persisted to durable state; zero subagents. **This is the shared judge every other gate calls into.** No Workflow tool.

### WF-IMPL-1 — Mode 1 self-exec (stage: implement, DEFAULT)
- **Steps:** Mode 1 default (no cost gate) → event-driven snapshot cadence (after task / before dispatch / phase boundary / on request — NOT a 60% self-gate; meter advisory) → write `## Session handoff` (narrative + decision log + single nextAction + VERBATIM paths/commands/errors + uncommitted-change list) into durable state → coding single-threaded → heavy reads to read-only `{{INVESTIGATOR_TOOL}}` subagents, snapshot BEFORE each dispatch → on done/phase-done → WF-VERIFY → resume refuses on stale-git/placeholder → degraded inline fallback folds executing-plans → pressure-test new Iron Laws first.
- **Owner:** implement.md + project-transitions.md + skill-authoring.md
- **Reqs:** R-ORCH-32,33 · R-EXEC-08,10,13,14,15,16,17,31 · R-SP-04,05,06,07,08
- **Mechanism:** dispatch via `{{INVESTIGATOR_TOOL}}`; snapshot/handoff = markdown writes. `{{#if ide.claude-code}}` EnterWorktree where available, raw `git worktree` fallback. No Workflow tool drives the spine.

### WF-IMPL-2 — Mode 2 tiered cross-provider (stage: implement, default-OFF)
- **Steps:** cost-justification gate (quota conservation + throughput, NOT $/token; routing config from `status/routing.json` per R-XAGENT-10) → per-TASK routing tier map (Opus never executes) → plan-quality HARD-GATE precondition → Codex via NEW workspace-write profile (`--sandbox workspace-write`, keep run_with_timeout 124/142, `-a never exec --skip-git-repo-check`, NO yolo/full-auto) inside a dedicated worktree → write-mode preflight drops dirty-tree gate → execute → acceptance test as escalation judge → **MERGE-BACK serial** (R-XAGENT-03: pass-in-worktree → serial rebase onto primary → re-run verifier on primary → done) → cheap/Codex never self-certifies → degraded fallback to Mode 1.
- **Owner:** implement.md + codex-bridge-assets/invocation-workspace-write.txt + worktree-isolation.md
- **Reqs:** R-ORCH-24 · R-EXEC-18,19,20,21,22,23,24,25,27,28,29,30 · R-SP-19,21 · R-XAGENT-02,03,10
- **Mechanism:** per-task routing + codex bridge via `{{BASH_TOOL}}`; subagent tiers via `{{INVESTIGATOR_TOOL}}` (**host-caveated** per R-XAGENT-02 — likely codex-only on Gemini). Codex bridge is cross-provider, not CC-bound. No host Workflow tool.

### WF-FIX — circuit-breaker + boundary instrumentation (stage: implement, helper)
- **Steps:** 3-failed-fixes/same-root-cause → STOP + escalate to architecture; on fail/cross-module → instrument boundary per debug-techniques.md before next hypothesis.
- **Owner:** fix.md + debug-techniques.md · **Reqs:** R-SP-10,17,18
- **Mechanism:** pure skill-body discipline; no subagents; **keep as a referenced helper, NOT in the implement critical path** (near-ceremony — don't add gates to every run).

### WF-MIG-JS / WF-MIG-AIDECK / WF-MIG-CMD / WF-MIG-PROSE (stage: migration)
- **WF-MIG-JS:** decompose path-emit (750/803+guard), normalize walk (206/230-237), serve projectId enumeration, validate-state kindFromPath (R-XAGENT-08). Lands FIRST (JS-side), enabling dogfood. Reqs: R-MIG-04,05,06,07,13,21 · R-ORCH-25,26,27,28 · R-XAGENT-08.
- **WF-MIG-AIDECK:** paths.ts/state.ts/consumers.ts/watcher.ts/api.ts registry + dashboard routes — **sequenced WITH the in-flight aiDeck rewrite**, coupling isolated to one lazy layer. Reqs: R-MIG-09,10,11,12,14,15.
- **WF-MIG-CMD:** verify legacy-detection + migrate move logic (reuse src/migrate.js helpers) + pre-write.sh glob. Reqs: R-MIG-08,19,20,24 · R-ORCH-29,38.
- **WF-MIG-PROSE:** ~10 asset files + 3 schemas + catalog + gitignore/reviews. Reqs: R-MIG-16,17,18,22,23.
- **Mechanism:** pure node transforms + edits via `{{BASH_TOOL}}`; prose sweep is disjoint files (parallel-dispatchable). No Workflow tool. aiDeck coherence is **advisory** during the dogfood window.

---

## 4. INCORPORATION DECISION — should workflows live in `project`?

**YES — orchestration lives INSIDE the project skill + the new core skills (brainstorm, implement, verify-claim) + their lazy detail files, driven by skill-markdown procedures over durable `.atomic-skills/` state. It is NOT incorporated via the Claude Code Workflow tool as the spine.**

### The portability rule (hard, and currently UNENFORCED — fix first)
The Claude Code Workflow/Task/Worktree/Monitor tooling is **Claude-Code-only**; skills must also run on Gemini CLI. So the canonical spine is: (1) subagent fan-out via `{{INVESTIGATOR_TOOL}}`; (2) deterministic transforms + verifier execution via `{{BASH_TOOL}}`; (3) durable `.atomic-skills/projects/<id>/` state as the snapshot/handoff substrate; (4) the codex bridge for cross-provider execution. The Workflow tool, native subagent model-tiering, and EnterWorktree/ExitWorktree are admitted **only** behind `{{#if ide.claude-code}}` as accelerators — never as the only path. **This rule is currently fictional in CI** (verified: `FORBIDDEN_TERMS` lacks every host-orchestration token and there is no strip-test). **R-XAGENT-01 must land before any orchestration**, or "green test" proves nothing and Gemini breaks silently.

### Where each flow lives
- **project = thin RESIDENT router/orchestrator.** Owns cross-stage sequencing + always-resident gates (Iron Law, pre-mutation gates, gate-status invariant, ratify gate, emergence ladder). Per the lazy-router discipline (project.md:44 "lazy-load is NOT optional"), the router holds **only the dispatch table + invariants** — every heavy procedure is a lazy detail file (project-triage.md, project-create-plan.md restructured to 3 stages, project-transitions.md verify-on-done, project-migrate.md, project-verify.md, **and a single new `project-lifecycle.md`** for the sequencing spine, dispatched from one table row — R-XAGENT-11). A CI line-budget assertion keeps resident growth visible.
- **New heavy capabilities live in their OWN core skills** (brainstorm.md, implement.md, verify-claim.md) + shared helpers (debug-techniques.md, worktree-isolation.md, codex-bridge-assets workspace-write profile). project DELEGATES into them, exactly as it already delegates spec/plan authoring.

### The three-way boundary
- **PORTABLE skill procedure (in skills):** sequencing, state/handoff, No-Placeholders lint, verifier execution, debate-actor + critic dispatch, codex-bridge invocation. Serial driver with durable checkpoints — **call it an "execution driver", not an "orchestrator"**, so no one expects concurrency that single-threaded coding will never use.
- **OPTIONAL `{{#if ide.claude-code}}` accelerator:** native parallel sub-agent fan-out for panel/critic; native EnterWorktree/ExitWorktree; Workflow/Task host tooling. Admitted only once R-XAGENT-01 proves byte-runnable-when-stripped.
- **OUT of skills entirely (operator/human-owned):** Mode 2 cost-justification + provider/quota routing (→ `status/routing.json`, R-XAGENT-10); the **worktree merge-back if no deterministic serial procedure exists** (R-XAGENT-03 — until then, operator-prompted); the choice to enable Mode 2 at all.

### Why not a mega-skill or a host Workflow
A host Workflow is Claude-Code-only — it would silently make the whole lifecycle non-functional on Gemini. A mega-skill bloats the resident router and defeats the lazy-load discipline that exists to stop the agent acting from memory. The split keeps project thin, isolates token-heavy logic, and makes the flow provably cross-agent.

---

## 5. DOGFOODING SEQUENCE

**The line (per critique C1):** dogfood **only** the mechanical/deterministic plumbing on the migration; build the cognitive machinery conventionally on a throwaway and **replay** over the migration as a regression check. Calling the whole thing "dogfooding the lifecycle" overstates it — the migration's critical path must NOT be where unproven cognitive skills and an un-rollback-able data move get their first exercise simultaneously.

### Bootstrap order (minimal hand-built set)
- **B0 — Safety net + state isolation (NOT a build).** `tar czf /tmp/atomic-skills-state-<ts>.tgz .atomic-skills/`; `git worktree prune` (a prunable `test-wt` exists) then create branch `dogfood/self-host-migration` + dedicated worktree for source edits. **Critically (R-XAGENT-09):** run the entire dogfood against a **copied/redirectable state root** (`ATOMIC_SKILLS_DIR=.atomic-skills-dogfood/`) — first confirm decompose/normalize/serve/validate-state honor a configurable root; if any hardcode `.atomic-skills/`, that is a migration prerequisite. The worktree isolates SOURCE; only a redirected state root isolates STATE (gitignored, shared across worktrees, NOT git-restorable).
- **B1 — verify-on-done EXECUTION core FIRST + paranoid REDs.** Un-stub `kind:test` in project-transitions.md (run runner+pattern via `{{BASH_TOOL}}` behind y/N, write evidence, gate `met` on passed===true). Add three RED tests to transition.test.js **before D3 trusts it** (R-XAGENT-07): non-zero exit ≠ met, **0 tests collected ≠ met**, runner-not-found ≠ met. This is the deterministic judge every later step self-certifies against — its bugs propagate as false-greens, so it gets the most scrutiny despite being hand-built.
- **B2 — projects/ path-emit + No-Placeholders lint + validate-state kindFromPath, in SEPARATE commits with SEPARATE REDs.** decompose.js `projectId` opt + switch :750/:803 + collision guard 804-812; deterministic lint; extend validate-state kindFromPath for `phases/` WITHOUT touching the flat dir-walk (R-XAGENT-08, so the live flat tree keeps validating). **Land kind-inference BEFORE path-emit writes any real file** (else the judge errors on the artifact it must read — the circular dependency). Pin the collision guard both directions: two colliding kebab titles in ONE plan must throw; same slug across TWO plans must NOT throw.
- **B3 — DEGRADED-ONLY Mode-1 implement spine.** event-driven snapshot cadence + `## Session handoff` spec + resume-refusal, calling B1 on done. NO tiering, NO Mode 2, NO critic, NO codex. Pressure-test ONLY the handoff/single-threaded/resume Iron Laws (the ones the dogfood exercises).
- **B4 — shadow project folder + HAND-AUTHORED design.md.** Create `.atomic-skills/projects/atomic-skills/` (PROJECT-STATUS.md) and hand-write `migration-self-host/design.md` (this document). DESIGN is the one stage that cannot dogfood itself — accept it as lowest-coverage; review manually; pass it through the R-XAGENT-06 section lint.

### Dogfood steps (what runs through which stage / builds / surfaces)
| step | runs through | builds | bug surfaced |
|---|---|---|---|
| D1 | PLAN (hand-driven; design fixed) | `source.md` task graph (F0 JS path-emit, F1 normalize/serve, F2 verify+migrate, F3 prose/schema/catalog, F4 aiDeck WITH-rewrite, F5 cut-over) | decompose grammar drift — does the unchanged parser handle a real multi-phase source in the new mental model? (validate by `decomposePlan` preview before any write) |
| D2 | DECOMPOSE+SPEC (B2 path-emit + lint) | `plan.md` + `phases/f0..fN` — migration plan is first inhabitant of new tree | path-template interpolation, phases/ dir creation, collision-guard over/under-fire, lint false-pass/false-block, validate-state kind-inference on phases/*.md |
| D3 | IMPLEMENT (B3) + VERIFY | F0 source edits committed in worktree; evidence on F0 exit gate | verify-on-done EXECUTION reality (first live judgement); handoff completeness; single-threaded invariant under real edits |
| D4 | IMPLEMENT (Mode 1, now self-judging) | verify-claim.md, worktree-isolation.md, debug-techniques.md | judge-on-judge: verify-claim binary verdict + cited evidence; cheap-model-never-self-certifies; any circularity |
| D5 | DESIGN (now self-hosted, **non-destructive replay only**) | brainstorm.md, critic asset (R-XAGENT-04), debate gate-mode | actor-critic separation + gate-pass-not-from-consensus; replay over KNOWN-GOOD design surfaces false-Issues-Found / rubber-stamp without risking work. **Cognitive skills were built+pressure-tested on a throwaway FIRST; this is regression only.** |
| D6 | IMPLEMENT + VERIFY + new verify cmd on itself | project-verify.md (legacy detection) + project-migrate.md move logic | verify resolves projects/*/*/ + reports PASS on shadow while flagging live flat as legacy; orphan parentPlan resolution; both-trees coexistence |
| D7 | IMPLEMENT + migrate cmd + full verify gate | fully migrated live tree; flat removed; tooling switched to projects/ primary | migration of real legacy data + the moment tooling STOPS reading flat dirs — data-loss, dir-walk-not-switched, standalone→1-phase unification on real orphans. **Highest blast radius.** |

### Reversibility (two independent axes)
- **SOURCE (git-tracked):** all edits on `dogfood/self-host-migration` in a dedicated worktree; rollback = abandon branch/worktree; per-phase commits = granular reverts. Main untouched until deliberate merge.
- **LIVE STATE (`.atomic-skills/`, GITIGNORED — `git checkout` CANNOT restore it):** rollback substrate = the B0 tar snapshot, refreshed immediately before D7. Better: by running against a **copied state root** (R-XAGENT-09) the live tree is byte-frozen through D6 and a corruption can be **diffed** against the original to attribute the bug, and `rm -rf` the copy is a zero-cost rollback.
- **Half-migrated containment:** the dogfood writes ONLY into `projects/atomic-skills/` through D6; old flat readers (normalize @230, validate-state @130, pre-write.sh, dashboard) never read projects/, so both trees coexist. The only dangerous window is **D7**, which is therefore **copy-verify-delete, never destructive-move**: write projects/ copies → run validate-state+verify GREEN → only then `rm` flat originals; keep the flat dir-walk path alive until verify is green; a SKIP flag quiesces hooks during the cut-over.

### The line: dogfood vs conventional-scripted-migration
- **DOGFOOD (real multi-phase input is genuinely adversarial):** projects/ path-template emit, validate-state kind-inference on phases/, verify-on-done verifier execution, Session-handoff/resume plumbing → B1, B2, B3, D1-D3, D6 against a copied state root.
- **SCRIPT + GOLDEN-FILE TEST (one-shot transform on un-rollback-able state):** the actual flat→projects/ MOVE of existing live units (D7) — a deterministic, idempotent, copy-verify-delete src/migrate.js extension, NOT "agent improvises file moves through the implement spine".
- **BUILD-CONVENTIONALLY-THEN-REPLAY (Iron Laws need pressure-testing before ship; gain nothing from the migration's critical path):** brainstorm, debate gate-mode, critic, Mode 2 tiering → built + 3-scenario pressure-tested on a THROWAWAY plan, then replayed over the migration (D5).
- **FENCED OUT entirely:** codex `--sandbox workspace-write` against the live state. Prove it on a throwaway repo with its own git; merge-back (R-XAGENT-03) must be specified+tested before any write-mode executor touches a real tree.

---

## 6. BUILD + MIGRATION ORDER (critique-honored, reconciling Inc0-Inc4 + layout + dogfood)

The dependency graph makes the order a **hard build-blocker chain**, not a preference. The earlier `fix-superpowers-wiring` item is **MOOT** (we replace, not fix).

- **Inc0 — Enforcement & isolation prerequisites (NEW, must precede everything).**
  R-XAGENT-01 (extend compatibility test + strip-test) · R-XAGENT-08 (validate-state kindFromPath, flat-walk intact) · R-XAGENT-09 (redirectable state root) · R-XAGENT-02 (probe {{INVESTIGATOR_TOOL}} write-capability + critic isolation). *Rationale: the portability gate, state isolation, and the validate-state circularity are load-bearing for every later step; the canon cited them as done — they are not.*
- **Inc1 — Verify-on-done teeth + owned helpers.**
  R-ORCH-20/21, R-EXEC-01..06, R-SP-20, **R-XAGENT-07 (paranoid REDs)** → un-stub verifiers with false-green guards FIRST (mode-independent, cheapest, the judge everything self-certifies against). Then verify-claim (R-SP-09), debug-techniques (R-SP-10), worktree-isolation (R-SP-11), skill-authoring (R-SP-12), fix extensions (R-SP-17/18), receiving-findings (R-SP-22/23).
- **Inc2 — Layout migration JS-side + first artifact home.**
  R-ORCH-25/26/27/28, R-MIG-04/05/06/07/13/21, R-XAGENT-05 (gitignore glob). *This lands the projects/ tree so the FIRST plan (the migration itself) can be materialized there — the dogfood's substrate. JS-side moves FIRST behind the isolated aiDeck coupling.*
- **Inc3 — DESIGN cognition (built on a throwaway, then replayed).**
  brainstorm (R-SP-01/02/03), debate gate-mode (R-SP-13/15/31), critic (R-ORCH-13/14, R-XAGENT-04), DESIGN gate ladder (R-ORCH-16/17), design.md section lint (R-XAGENT-06), rewire create-plan (R-ORCH-07/08, R-SP-27/28). Pressure-test before ship.
- **Inc4 — No-Placeholders lint + SPEC gate.**
  R-ORCH-11/12/19/23, R-SP-24/25/26 (decompose format UNCHANGED).
- **Inc5 — implement LAST (composes all the above).**
  Mode 1 (R-ORCH-32/33, R-EXEC-07..17, R-SP-04..08) → Mode 2 only after **R-XAGENT-03 (merge-back) + R-XAGENT-10 (routing config)** are specified+tested (R-ORCH-24, R-EXEC-18..30, R-SP-19/21). Pressure-test every new Iron Law (R-EXEC-31, R-SP-08). Codex write-mode fenced out of the migration dogfood.
- **Inc6 — verify+migrate command + DOGFOOD cut-over.**
  R-MIG-19/20/24, R-ORCH-29/38, R-SP-29/30 (DROP-clean superpowers), R-SP-33 (catalog). D7 cut-over of real units last, behind a fresh snapshot.
- **Inc7 — aiDeck-side + prose/schema long tail (WITH the aiDeck rewrite; advisory during dogfood).**
  R-MIG-09/10/11/12/14/15/16/17/18/22/23. **The migration plan must NOT gate on aiDeck coherence during its own dogfood window** (the new tree materializes before the rewrite can read it).

**Hard ordering hazards (do not reorder):**
1. implement (Inc5) cannot precede verify-on-done (Inc1) — Mode 2's escalation judge hard-depends on the un-stubbed verifier.
2. PLAN's "panel only if a DESIGN fork survived" must treat **no surviving-fork record as the default (no panel)** so it doesn't block before the DESIGN gate (Inc3) is wired.
3. validate-state kind-inference (R-XAGENT-08) must land **before** decompose path-emit writes any real phases/*.md (Inc2), else the judge hard-fails on its own artifact.

---

## 7. OPEN QUESTIONS (genuine forks that change the build)

1. **Mode 2 worktree merge-back (R-XAGENT-03) — which of three?** (a) deterministic serial rebase-then-reverify-on-primary procedure (most work, safest); (b) ship Mode 2 WITHOUT worktree isolation (codex `workspace-write` directly on a branch — simpler, weaker isolation); (c) leave merge-back as an operator-prompted manual step the skill does not perform. This is the highest working-tree-integrity risk and gates whether Mode 2 ships at all. **Recommendation: (c) for v1, (a) later.**
2. **{{INVESTIGATOR_TOOL}} write-capability on Gemini (R-XAGENT-02).** If Gemini's `codebase_investigator` is read-only (likely), the "portable Mode 2 cheap-tier executor" collapses to **codex-only** on Gemini and the subagent-executor tier must be `{{#if ide.claude-code}}`-gated. Do you accept Mode 2 being honestly "Claude-Code + codex" rather than fully portable, or should Mode 2 be CC-only and Gemini stays Mode 1 + codex?
3. **State isolation mechanism for the dogfood (R-XAGENT-09).** Confirm: redirectable `ATOMIC_SKILLS_DIR` (requires the four JS tools to honor a configurable root — a possible new prerequisite) vs a copied tree at the default path vs tar-snapshot-only. **Recommendation: redirectable root**, because it also gives diff-based bug attribution and zero-cost rollback — but it may add a small refactor to Inc0.
4. **Critic asset home + provider (R-XAGENT-04 / R-XAGENT-02).** Where does the critic live (`skills/core/critic-validator.md` vs a `debate-assets/critic.md`), and when a fresh same-provider subagent can't be guaranteed (Gemini isolation unverified), do we mandate a **codex critic** as the cross-model validator? This affects whether the gate's validity is host-independent.
5. **`kind:query` verifier (R-EXEC-02): execute or defer-by-design?** No live DB connection is assumed in this repo. Execute via a caller-supplied connection command, or mark `DEFERRED-BY-DESIGN` repo-wide for now? **Recommendation: defer-by-design** until a real consumer needs it.
```

I've returned the complete seed artifact as markdown above. Key points of what it delivers and the load-bearing decisions baked in:

**What was verified on disk (all critique claims confirmed):**
- `tests/compatibility.test.js` `FORBIDDEN_TERMS` = `['Bash','Read tool','Write tool','Edit tool','Agent tool','$ARGUMENTS']` — **no** Workflow/Task/Worktree token, no strip-test. The R-ORCH-30/31 enforcement guarantee is fictional today.
- `.atomic-skills/` is gitignored (`.gitignore:5`) — no git rollback for live state.
- `skills/core/{brainstorm,implement,verify-claim}.md` + the shared helpers + `docs/kb/skill-authoring.md` do not exist.
- `scripts/validate-state.js:96-104,162-167` hard-fails kind inference on any path not under `plans/`/`initiatives/`; `decompose.js:750/803` + collision guard `804-812` are flat; `serve.js:191 deriveProjectId(rootDir)` already takes a configurable rootDir.

**Sections written:** (1) exec summary naming the single most important decision = *build the cross-agent CI gate before trusting it*; (2) consolidated de-duplicated requirements registry grouped by the 4 areas with merged cross-area duplicates (e.g. R-ORCH-20 = R-EXEC-01/02 = R-SP-20) **plus 11 new `R-XAGENT-*` rows** closing the critique gaps; (3) workflow map by stage with portable-mechanism vs `{{#if ide.claude-code}}` accelerator; (4) incorporation decision with the three-way portable/optional/out-of-skill boundary; (5) dogfooding sequence with the explicit dogfood-vs-script line per critique C1; (6) critique-honored Inc0-Inc7 build order with the 3 hard ordering hazards; (7) 5 genuine open-question forks.

**Critique-honored hard conditions surfaced as blocker requirements:** R-XAGENT-01 (extend compat test + strip-test, lands first), R-XAGENT-02 (probe investigator write-capability — Mode 2 likely codex-only on Gemini), R-XAGENT-03 (Mode 2 worktree merge-back, currently unowned), R-XAGENT-07 (verify-on-done false-green REDs incl. "0 tests collected ≠ met"), R-XAGENT-08 (validate-state kind-inference before path-emit, resolving the circular dependency), R-XAGENT-09 (redirectable state root, not just source worktree). Codex write-mode is fenced out of the migration dogfood entirely.