# implement — Foreign plan lane

Loaded by `skills/core/implement.md` when Step 0 classifies the arg as a **foreign-plan** (existing markdown path outside `.atomic-skills/projects/**/plan.md`) and the operator chooses **Implement as Foreign** at the entry AskUserQuestion.

**Promote is entry-time only.** There is no promote/adopt at FINALIZE or ARCHIVE. If the operator wanted Atomic Skills inventory lifecycle, they chose **Promote** at entry and left this asset.

> Communicate with the user in Portuguese (Brazilian) when the host injects that directive. Skill body stays EN-only.

## Iron laws (same as implement)

- One writer per worktree; coding single-threaded.
- Microcommits with explicit paths — never `git add .` / `-A`.
- Never self-certify: close only with verifier evidence (`passed: true`).
- Event-driven handoff (five verbatim fields) on the **sidecar**, not a scratch pad.
- Automate is the **default** (host-thin pure maestro); Mode 1 requires `--mode=1`.

## Helpers (pure)

| Module | Role |
|--------|------|
| `src/implement-target-kind.js` | `classifyImplementTarget`, `workOrderSidecarPath`, `foreignPlanBranch`, `normalizeForeignEntryChoice` |
| `src/foreign-plan-parse.js` | `classifyStructure`, `parseForeignPlanMarkdown` (S0–S3) |
| `src/foreign-work-order.js` | Work-order create/load, admit gaps, markTaskDone, stampFinalize/Archive, terminal phases |

## Sidecar (colocated)

Source `path/to/plan.md` → sidecar `path/to/plan.implement.yaml`.

The sidecar is the durable foreign state: phases, tasks, evidence, handoff, ground-truth receipt, finalize/archive stamps, `executionMode`, branch name. **Do not** write foreign task status into `.atomic-skills/projects/` unless the operator chose Promote at entry (different path).

## Entry (already done by implement Step 0)

1. `classifyImplementTarget` → `kind: foreign-plan`, `entryChoiceRequired: true`.
2. {{ASK_USER_QUESTION_TOOL}} — exactly two paths:
   - **Promote to Atomic Skills plan** → run `atomic-skills:project adopt <source>` (then Flow A on the new slug). **Stop reading this asset.**
   - **Implement as Foreign** → continue below (`entryChoice: foreign`).

Never invent a default. Never promote silently later.

---

## F0 — Bind worktree + branch

Same isolation spirit as AS plans:

1. `slug` = `slugFromSourcePath(sourcePath)`; `branch` = `foreignPlanBranch(slug)` → `plan/<slug>`.
2. Bind via `git worktree` + `.worktrees/<slug>` (reuse `skills/shared/worktree-isolation.md` Step 0 — never nest).
3. If caller governs another plan's branch → HARD-GATE (same as implement Step 0).
4. Persist `branch` + worktree path into the sidecar when first written.

## F1 — Ground-truth (mandatory)

Before any product coding or phase-writer spawn:

1. Run plan↔code ground-truth review against the **source markdown** and the repo (same spirit as AS: Directions A+B).
2. Prefer `atomic-skills:review-plan --mode=ground-truth` when the source can carry a `## Ground-truth review` section; otherwise persist a complete receipt object on the sidecar via `stampGroundTruth` (status, mode, fingerprint/summary).
3. Empty / greenfield repo still requires a **complete-empty-repo** (or equivalent) receipt — no chat waiver.
4. HARD-GATE: no receipt → no coding, no spawn.

## F2 — Parse + admit pass (SPEC)

1. Read the source markdown; `parseForeignPlanMarkdown` → structure class S0–S3 + candidate phases/tasks.
2. `createWorkOrder({ sourcePath, phases })` → always includes terminal phases **FINALIZE** and **ARCHIVE**.
3. `admitReadiness(workOrder)`:
   - Every **non-terminal** pending task needs `outputs[]`, `acceptance[]`, and deterministic `verifier` (R-ORCH-23 spirit).
   - `scopeBoundary[]` may be empty (explicit no exclusions) but prefer DO-NOT lines from the doc.
4. On gaps: **stop and fill with the operator** (AskUserQuestion / structured prompts). Do not invent paths or always-green verifiers (`true`, `echo ok`).
5. S3 narrative with zero tasks: decompose with the operator into tasks before coding — do not free-code the essay.
6. Write sidecar YAML (`serializeWorkOrder`); microcommit explicit sidecar path when state changes.

## F3 — Resume gate (foreign)

After home worktree:

1. `git status --porcelain` clean of task-owned dirt (or refuse).
2. Sidecar `handoff` must not contain unfilled `TODO` / `REPLACE_*` placeholders.
3. Writer-lease (optional but recommended under automate): `.atomic-skills/status/foreign/<slug>.lease` — same exclusivity spirit as `src/writer-lease.js` (one writer). If you reuse lease helpers, namespace by foreign slug; never clear with public identity alone.

## F4 — Automate default (pure maestro light)

When `isAutomateActive` (default bare implement / stamp / `--mode=automate`):

1. Host is **host-thin**: no product source edits; no product entrypoint diagnostics except **verbatim** task verifiers.
2. One **code-only phase writer** per **work** phase (P0..Pn from the doc — not FINALIZE/ARCHIVE).
3. Phase writer returns a **claim report** only; must not mark sidecar tasks done.
4. Host merges (if phase worktree used), re-runs each task verifier on the merged tree, then `markTaskDone` only with `evidence.passed === true`.
5. Microcommit implementation paths, then microcommit sidecar state.
6. Update handoff (five fields) on every close / pre-dispatch / phase boundary.
7. **No** `assert-automate-gate` against AS inventory plans; foreign uses sidecar readiness + admit + ground-truth + lease instead.
8. **No** silent Mode-1 fallback — re-dispatch fix agent (max 2) or stop for operator.
9. Mode 1 (`--mode=1`): session is the single writer; same close rules (host/session still must re-run verifier before `markTaskDone`).

Reuse briefing patterns from `implement-phase-writer.md` with a **constructed brief** from the work-order task list (paths, acceptance, scopeBoundary, verifier) — no host chat history.

### Per-task close (both modes)

```
orient → code → pre-close check → implementation microcommit
  → re-run verifier → markTaskDone(evidence) → sidecar microcommit → handoff
```

## F5 — Work phase boundary

When all tasks in a work phase are `done`:

1. Optional phase exit checks from the source (if any).
2. `review-code` on the phase diff (automate: prefer `--mode=both` when lane available; else local).
3. Advance `currentPhase`; snapshot handoff.
4. Do **not** auto-start the next phase without operator continue when the next phase is large or FINALIZE (intrusive-actions rule).

## F6 — FINALIZE (terminal phase — not promote)

After `workPhasesComplete`:

1. Build **intent vs delivered** surface from work-order intent + tasks + evidence.
2. Present to the operator in the same turn as the validation ask.
3. Optional: open or update a PR for the plan branch (operator-facing; confirm before `gh pr create` / push).
4. On explicit operator validation only: `stampFinalize({ userValidatedAt, intentVsDelivered, prUrl })`.
5. Agents never write finalize PASS for the operator.

## F7 — ARCHIVE (terminal phase — cleanup)

After finalize stamp:

1. Remove foreign worktree when safe (`git worktree remove`); record path.
2. Branch disposition: keep for PR, merge, or delete — **ask** if unclear; record in stamp.
3. `stampArchive({ worktreeRemoved, worktreePath, branchDisposition })` → `status: archived`.
4. Handoff `nextAction` = terminal (no reopen without explicit operator intent).
5. **Never** call `project adopt` / promote here.

## What foreign deliberately does not use

| AS machinery | Foreign substitute |
|--------------|-------------------|
| `.atomic-skills/projects/**` inventory | Sidecar next to source `.md` |
| `done` / `phase-done` project verbs | `markTaskDone` / phase status on sidecar |
| `assert-automate-gate` plan slug | admit + GT + lease + workPhasesComplete |
| `businessIntent` five-field spine | Intent light on work-order (`value`, `doneWhen`, `outOfScope`) |
| Plan-end AS finalize/archive project verbs | FINALIZE + ARCHIVE phases on sidecar |

## Red flags

- "I'll promote at the end so the dashboard has it." → STOP. Entry-time only.
- "Checklist item is checked — mark done without verifier." → STOP.
- "S3 prose — just start coding." → STOP. Admit/decompose first.
- "Skip ground-truth — it's a one-off doc." → STOP.
- "Host will fix the phase writer failure under automate." → STOP. Re-dispatch or halt.
- "Write status into `.atomic-skills/projects` for foreign." → STOP. Wrong lane.

## Closing

Clean foreign run: all work tasks closed with evidence on the colocated sidecar, FINALIZE validated by the operator (PR as needed), ARCHIVE cleaned worktree/branch bookkeeping, tree recoverable from git + sidecar. Automate stayed host-thin. No late promote.
