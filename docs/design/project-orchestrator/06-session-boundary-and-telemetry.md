# Post-resolution refinements — Mode-1 session boundaries + skill telemetry

> **Status:** DECIDED (2026-06-01, session 2) — two new design decisions raised AFTER the 16 forks of `05-fork-resolutions.md` were closed. Both validated by an adversarial research+critique workflow (external context-degradation evidence + design audit + adversarial synthesis). Verdict: **F-E1 sound-with-changes; F-E2 sound (observe-only, anti-Goodhart by construction).**
> These are **refinements of R-ORCH-32** (the Mode-1 event-driven snapshot cadence), not new lifecycle stages. Both are **v1-advisory / observe-only**; the data-driven half graduates in v2.

---

## F-E1 — Mode-1 session cut-over (relatedness-driven, advisory)

### The gap it closes
Decision #10 / R-ORCH-32 settle **when a snapshot is WRITTEN** (after each task / before each dispatch / phase boundary / on request) but never **when to END the session and tell the user to start a fresh one.** The cadence says "checkpoint often"; this adds one orthogonal event class — *"this is a good place to STOP, not just checkpoint."*

### Decision
At the existing `done <task-id>` transition, evaluate a **deterministic relatedness check** between the recent working set and the **next** pending task; when the next task is structurally **unrelated** (and a structural budget floor is met), **RECOMMEND** (never force) writing the handoff + starting a fresh session, surfaced at the Stop hook with a ready-to-paste resume command.

- **Relatedness signal** = the **F-A7 / parallel-dispatch pairwise-grep run in INVERSE.** LEFT = recent working set (reuse `stop.sh` out-of-scope file counting + `detect-scope` git-activity → paths). RIGHT = the next task's `scopeBoundary[]` (existing schema field, available before the task starts). Cross-references present ⇒ **RELATED** (stay in session); clean grep ⇒ **UNRELATED** (recommend cut). Emit the same **HIGH/MED/LOW** band parallel-dispatch already produces. **Exclude high-fan-in hub files** (index/barrel/types/schema) to damp the shared-barrel false-positive.
- **Trigger** = **phase boundary is PRIMARY** ("a phase = a session" coarse default, already a snapshot point); relatedness-drop is the **MODIFIER** (proposes a cut at a phase boundary that's also grep-disjoint, or refines within an unusually long phase). **Task count alone NEVER fires a cut.**
- **Budget X** = computed **purely from task-graph structure** — `count(acceptance[])` (capped at 5) + `scopeBoundary[]` breadth + the grep band. A heavy, scope-broad, grep-disjoint next task ⇒ cut sooner; a light, grep-overlapping one ⇒ keep. **Named distinctly from Mode 2's `minBatchTasks` K=4** (that is a parallelism *floor*; this is a sequential grouping *ceiling* — conflating them is a category error). Ships **interpolated-pending-data** until F-E2 telemetry carries real resume-cost numbers.
- **UX** = **RECOMMEND, never enforce** (matches the intrusive-actions rule + `done.md`'s "Run phase-done?" pattern). Before recommending, run the **resume-refusal predicate IN REVERSE as a precondition** (clean git + no unfilled TODO placeholders) — never strand the user behind a handoff `resume` will then refuse. If the precondition fails, surface the missing pieces instead of recommending a cut.
- **Resume stays cheap** (the user's worry): the handoff **IS** the re-orientation — durable `.atomic-skills/` state (R-EXEC-08) + the required `nextAction` field + the SessionStart hook injection are the existing cheap-resume rail; a fresh session does NOT cold-investigate. Any residual delta is delegated to a **read-only investigator subagent** (R-EXEC-14) returning a distilled 1-2k-token summary, so re-investigation cost lands in a throwaway context, never the fresh main coding context.

### Why (evidence-grounded — sound-with-changes)
The **load-bearing premise is well-evidenced**: a tightly-scoped fresh context beats a large stale one *before* the window fills. Multi-source controlled studies — **Chroma "Context Rot"** (18 models incl. Opus/Sonnet 4: degradation is a gradient starting at tens of thousands of tokens, not a cliff), **GSM-DC** (arXiv:2505.18761: irrelevant *distractors* actively degrade, power-law in distractor count, exponent growing with reasoning depth δ 0.11→0.49), **Amazon Science** ("length alone hurts despite perfect retrieval"), **Liu "Lost in the Middle"**, and Anthropic's own "finite attention budget / diminishing returns" — all agree irrelevant-but-present content *actively misleads*, not merely fills space. Production frameworks (Anthropic, Claude Code, the 2026 orchestrator-with-summary-returns consensus) already trigger compaction/handoff at **task/topic boundaries**, not only fullness.

**The one overstatement (corrected):** the sharp standalone claim *"topic-switch is an INDEPENDENT primary harm even at 20% context"* is the weak link — the only direct LLM task-switching test (*Cognitive Load Limits*, arXiv:2509.19517) found the "attentional residue" main effect **non-significant** (p=0.12) while context-saturation was robust (p<0.001); the human "attention residue" result is analogy, not LLM evidence. **But the conclusion survives via a stronger channel:** an unrelated next task is exactly the condition under which the prior session's now-irrelevant context becomes **distractor load** — and distractor harm IS robustly evidenced. So the rationale is reframed as *"degradation is driven by accumulated-irrelevant-context volume relative to the current task, amplified by distractors and reasoning depth"* — NOT a separate proven topic-switch axis.

### Consistency guards (the fatal failure mode + its fence)
- **FATAL if ignored — context-% smuggling.** "X scales with complexity" must NEVER read a self-reported context-% / token headroom to decide X — that reintroduces the exact self-measured gate Decision #10 / F-A4 killed (the number is fabricated; loss is silent). **X is computed purely from task-graph structure.** This is a hard falsifier in the spec (mirror F-A4): *any code path that feeds a self-reported context-%/token-count into X or into the cut decision = FAIL.*
- The **"20%" framing is illustrative-only** — a human-facing scenario observed via the advisory meter (R-EXEC-16), never a value the skill reads. The compatible rule form is **"cut iff the next task is structurally unrelated, REGARDLESS of fullness"**, never "continue iff context < threshold."
- Relatedness rests on the **external deterministic grep**, never on the agent asserting "my context feels polluted" (that self-graded introspection is what #6/#10 forbid).
- **Anti-vanity (#6):** the grep is **EVIDENCE**; per the F-A7 architecture the human makes the binary call and **disagreement fails closed to KEEP-GOING** (over-cutting is the costlier error — it fragments coherent work and multiplies handoff overhead).

### Chosen v1 defaults (tunable; were the residual user calls)
- **Default-ON, advisory** (non-blocking; ignoring it is safe because durable state is rewritten every cadence event regardless). *(User-confirmed direction.)*
- **Coarse default = "a phase = a session"** (phase boundary primary, relatedness the modifier).
- **Fail-safe on grep-vs-human disagreement = DO NOT CUT (keep-going).** *(User-confirmed.)*
- **Budget floor:** never recommend a cut after <2 tasks unless the next task is *both* a phase boundary AND grep-LOW.
- **Hub-file exclusion list:** index/barrel/types/schema (repo-configurable, like `drift_threshold`).
- **Deferred to v2:** any hard-stop/mandatory-cut mode; telemetry-derived budget X (replace the structural floor with a resume-cost-weighted threshold once F-E2 has data — the F-A5 K=4 graduation path).

### Falsifiers
- Over real sessions, the relatedness grep mis-fires materially: a **shared-barrel false-RELATED** (two unrelated tasks both touch `index.ts` → over-merged) or a **disjoint-contract false-UNRELATED** (a coordinated contract change split across non-overlapping files → cut in half, half-done work stranded) that the human override + hub-file exclusion fail to catch.
- A fresh session after a recommended cut **still cold-re-investigates** (the handoff didn't make resume cheap) — caught by F-E2's `session_cutover` event (reinvestigation proxy).
- Any shipped code path reads a self-reported context-%/token into X or the cut decision (Decision #10 violation).

### Design position & portability
**Refinement of R-ORCH-32**, not a new fork or stage. Clean against every locked law (no concurrent writers; instruct-only, never spawns a host session; strictly ADDS a stop-recommendation on top of the cadence). **v1 = advisory.** Portable: grep = `{{GREP_TOOL}}`, working-set = `{{BASH_TOOL}}`/git, handoff = durable markdown, resume rail = SessionStart hook (CC) with the durable `nextAction` field as the portable fallback; investigator delegation is read-only (fine on Gemini). No CC-only primitive is load-bearing. Must pass R-XAGENT-01 (no fixed tool names) + R-EXEC-31 pressure-test (3+ combined-pressure scenarios: shared-barrel false-RELATED, disjoint-contract false-UNRELATED, heavy-disjoint-next-task, user-overrides-the-grep).

### New to build (the only genuinely-new logic)
1. The **cut-over decision rule** at `done <task-id>` (grep recent-working-set vs next-task `scopeBoundary[]` → band → structural budget floor → RECOMMEND-CUT vs CONTINUE), wired into `project-transitions.md` (F-B2 home), surfaced via `stop.sh`.
2. The **structural budget X** (named distinctly from `minBatchTasks K`, labeled interpolated-pending-data).
3. The **"recommend fresh session" UX** + ready-to-paste resume command, gated behind the reverse resume-refusal precondition.
4. The **falsifier test** (no self-read %/token into X or the cut) + the pressure-test record.

---

## F-E2 — Skill telemetry & decision-validation loop (observe-only)

### Purpose
Turn every "interpolated-pending-data" / "ship-advisory-and-let-it-falsify" decision into an **empirically graduatable** one. Almost every resolution in `05` and `06` carries a **falsifier**; F-E2 is the substrate that records whether each falsifier **actually fired in real usage**, so the skill can improve *from evidence* rather than intuition — the user's explicit goal ("analisar se as decisões deram certo e, com o tempo, melhorar a própria skill"), and the antidote to "piorar tentando melhorar."

### Decision
Introduce a **general append-only telemetry sidecar** `.atomic-skills/status/telemetry.jsonl` (under the migration-exempt `status/` root, R-MIG-21), which **generalizes F-A6's `dispatch-log.json`** — the Mode-2 dispatch log becomes one *event type* of this sidecar. Each record captures the **observable inputs + outcome** that a specific decision's **falsifier** needs. Surfaced by a `project telemetry` digest view. **Observe-only in v1**: collect + surface; **change no skill behavior**. The skill **NEVER auto-tunes its own rules** — a decision is revisited only when its falsifier demonstrably fires across enough samples, via a human-reviewed re-resolution.

### The four layers (the "várias camadas para não piorar")
- **L0 — Observe-only.** Instrument the existing hook points (SessionStart / Stop / PostToolUse) + transition steps to append events. **Zero behavior change** ⇒ telemetry cannot make outcomes worse, by construction.
- **L1 — Digest.** A `project telemetry` view that surfaces, per decision: did the falsifier fire? how often? with what observable signal? (Human reads; nothing automated acts.)
- **L2 — Re-decide (human-in-loop).** A fired falsifier across enough samples triggers a **human-reviewed re-resolution** (re-run the resolution workflow *with data* — the F-A5 K=4 graduation path). The skill does not mutate itself.
- **L3 (v2) — Data-weighted defaults.** Only after L2 proves a pattern, replace an interpolated default (X budget floor, K=4, drift thresholds) with a telemetry-derived value.

### Hard principles (anti-Goodhart, by construction)
1. **Falsifier-tracking, NOT activity-counting.** Records the exact signal each falsifier needs — never volume/throughput/"tasks completed" as a success proxy.
2. **Anti-vanity (#6).** **Coverage% is BANNED as a field** (F-002 case). No skill-graded "success rate." It records raw observable outcomes; humans judge.
3. **Decision-#10 / F-A4 safe.** **NEVER records a self-read context-% / token headroom** (fabricated). Only externally-observable facts: exit codes, test counts, file counts, did-a-`met`-get-reopened, grep bands, timestamps, codex-ran-vs-degraded.
4. **Minimal & local.** Sidecar JSONL, append-only, gitignored, **size-bounded (rotate)**, written **zero-token** via `{{BASH_TOOL}}` append / existing hooks. **No content-schema bump** (consistent with F-A6 / F-B5 minimality).
5. **Private.** Purely local; never leaves the machine; no network.
6. **Portable.** JSONL + grep; readable cross-agent; hook emission works on both hosts.

### Event types (each mapped to the falsifier it serves)
| event | fields (observable only) | falsifies |
|---|---|---|
| `verify_done` | taskId, verifierKind, passed, testsCollected, laterReopened | verify-on-done false-green guards (F-B1, R-XAGENT-07) |
| `session_cutover` | recommended, band, accepted, reinvestigated (proxy: investigator-calls / file-reads before first edit next session) | F-E1 ("handoff makes resume cheap" + "band predicts resume cost") |
| `phase_review` | color, codexRan \| degradedSkip, findingsDismissed | F-C3 (advisory-too-weak / red-too-broad / degraded-skip-routine) |
| `mode2_dispatch` (= F-A6) | tier, executor, escalationCount, verifierPassed, wallclockVsEstimate | F-A4 / F-A5 (Codex-served fraction, escalation rate, K-floor) |
| `emergence` / `scope_drift` | parked→emerged latency, drift flags, ratify re-prompts | ratify-gate friction, scope-creep rate |

### What's new to build
The sidecar **append helper** + hook wiring; the `project telemetry` **digest view**; the per-event **sidecar schemas** (lightweight, in the sidecar only — NOT the content schema). **v1 = observe + digest; v2 = the data-driven re-resolution loop (L2/L3).**

### Falsifiers (telemetry of the telemetry)
- A field turns out to be a **vanity metric** (someone starts optimizing the skill to make a number go up rather than to flip a falsifier) → the field violates principle #1 and must be removed.
- The sidecar grows unbounded / costs tokens to write → violates principle #4 (must rotate, must be zero-token append).
- Any event records a self-read context-% → Decision #10 violation.
- After a full cycle, **no decision's falsifier is observable from the sidecar alone** → the telemetry measured the wrong things and L1 produces no actionable signal.

### Design position
A new cross-cutting capability that **rides on F-A6** (generalizes its sidecar) and existing hook points. **v1 observe-only.** Does not touch the content schema, single-threaded coding, or Decision #10. Sequenced **late** (with or after Inc5, alongside the Mode-2 dispatch-log it generalizes) — it instruments decisions that must first SHIP before they can be observed. Not on the Inc0/Inc1 critical path.

---

## Net effect

- **F-E1** gives Mode-1 the session-boundary discipline the cadence lacked, grounded in the well-evidenced distractor-load mechanism (not the under-evidenced topic-switch axis), reusing F-A7's grep + `scopeBoundary[]` + phase structure, advisory-only, with the context-% fence as a hard falsifier.
- **F-E2** closes the loop: the falsifiers scattered across `05`/`06` become observable, so the skill graduates its interpolated defaults *from data*, human-in-the-loop, never auto-tuning — the structural antidote to "improving by intuition."
- Both are **R-ORCH-32 refinements**, v1-advisory / observe-only, off the Inc0/Inc1 critical path; the data-driven halves are explicit v2.
