---
date: 2026-06-05T23:24:21Z
topic: completion-reconciler-design
artifact: docs/superpowers/specs/2026-06-05-completion-reconciler-design.md
skill: review-plan
reviewer: gpt-5.3-codex
codex_version: codex-cli 0.128.0
final_verdict: reject
counts_final: {blocker: 0, critical: 4, major: 2, minor: 0, nit: 0}
counts_blind: {blocker: 0, critical: 3, major: 2, minor: 0, nit: 0}
framing_delta: {dropped: 0, maintained: 5, emerged: 1}
schema_version: "1.0"
---

# Cross-Model Review — completion-reconciler-design

## Pass 1 (blind)

---
verdict: reject
counts: {blocker: 0, critical: 3, major: 2, minor: 0, nit: 0}
reviewer: gpt-5.3-codex
pass: blind
schema_version: "1.0"
---

## Summary
The design does not meet its stated guarantee. It both over-detects drift by treating verifier presence as completion evidence and under-detects drift by explicitly ignoring tasks without verifier/output/commit signals. It also makes `verify` an interactive mutation path while describing only a warning/reporting addition, which breaks the existing command contract and the testing story.

Several mechanisms are underspecified for the repository's current multi-project layout and task schema. These gaps will force implementation-time decisions about which project file to inspect or mutate and how to infer paths from unstructured acceptance text.

## Findings

### F-001 [critical] viability — docs/superpowers/specs/2026-06-05-completion-reconciler-design.md:64-70

**Evidence:**
```md
**Per non-`done` task and per `pending` exit-criterion, classify an evidence class (strongest first):**

| Class | Signal | Strength |
|---|---|---|
| `verifier-available` | the entry has a `shell`/`test` `verifier:` | strongest — running it yields GATE-R2 evidence |
```

**Claim:** `verifier-available` is not evidence that work is done; it is only metadata that may exist before any implementation work has started.

**Impact:** Every open task or gate with a deterministic verifier will be reported as completion drift on every full `status`/`verify`, causing repeated reconciliation prompts for legitimately open work. The `Still open` action cannot suppress this class because the signal does not depend on `lastUpdated`.

**Recommendation:** Remove `verifier-available` from drift-producing classes unless paired with an independent completion signal, such as changed declared outputs, a scoped commit reference, or existing passing evidence awaiting status propagation.

**Confidence:** high

---

### F-002 [critical] contradiction — docs/superpowers/specs/2026-06-05-completion-reconciler-design.md:40-44

**Evidence:**
```md
### Goal
Guarantee that `.atomic-skills/` task/phase completion stays in sync with the repository, so that:
1. The user never silently accumulates "done in code, open in state" drift.
2. `phase-done` (and thus, later, lessons consolidation) fires at the right moment via the existing auto-transition.
3. Nothing is closed without honest evidence.
```

**Claim:** The plan claims a guarantee but later leaves any task with no verifier, outputs, or commit signal invisible to detection.

**Impact:** A task can still be completed in code and remain `pending` forever when it lacks optional metadata, so `phase-done` still fails to become reliably reachable. This preserves the original drift failure for exactly the sparse-task cases the design says are common.

**Recommendation:** Either downgrade the goal from a guarantee to best-effort detection, or make deterministic completion signals mandatory for new/open tasks before relying on this reconciler.

**Confidence:** high

---

### F-003 [critical] contradiction — docs/superpowers/specs/2026-06-05-completion-reconciler-design.md:94-102

**Evidence:**
```md
- **Full `status` and `verify` run `detect-completion` FIRST.** If `drift` is true, they **HALT** before rendering a "green" view and walk the user through a reconciliation prompt — one structured `{{ASK_USER_QUESTION_TOOL}}` per candidate (batch oldest 4 first, mirroring the existing reconciliation gate), options:
  - **Run verifier** (only offered for `verifier-available`) → executes the existing Verifier execution pattern (`project-transitions.md`), writes GATE-R2 `evidence`, and on pass sets the entry `done`/`met`.
  - **Mark done** → closes via the normal `done <id>` flow (incl. auto-transition).
  - **Still open** → bumps `lastUpdated` (acknowledges, resets the signal clock).
  - **Skip** → no change.
```

**Claim:** The default `verify` path is specified as a mutating interactive reconciliation flow, not as the read-only coherence report that the plan says it is extending.

**Impact:** Running `verify` can write evidence, close tasks/gates, or bump `lastUpdated`, which makes it unsafe as a diagnostic command and conflicts with the proposed check #7 behavior of merely emitting a warning. Tests that only assert a warning line do not cover the actual mutation behavior.

**Recommendation:** Keep default `verify` read-only: report completion drift and exit with a warning, then route mutation through `status` reconciliation or an explicit `verify --reconcile`/`verify --fix` mode.

**Confidence:** high

---

### F-004 [major] dependency-break — docs/superpowers/specs/2026-06-05-completion-reconciler-design.md:62-83

**Evidence:**
```md
**Input:** the active initiative file (default), or `--slug <slug>` / `--plan <plan-slug>` to widen; `--json` for machine output.
```

**Claim:** The detector interface identifies initiatives and plans only by slug, but the current state layout can contain multiple projects where slugs are ambiguous.

**Impact:** In a multi-project `.atomic-skills/projects/<project-id>/...` tree, `--slug` or `--plan` can inspect or mutate the wrong initiative during reconciliation. The JSON output also omits the resolved project id/path, so downstream `status`, `verify`, and hooks lack a safe target for writes.

**Recommendation:** Add an explicit `--project <project-id>` selector and include resolved `projectId` plus source file path for every candidate in the JSON output.

**Confidence:** high

---

### F-005 [major] ambiguity — docs/superpowers/specs/2026-06-05-completion-reconciler-design.md:68-70

**Evidence:**
```md
| `output-exists` | `outputs[].path` (or `acceptance[]`-referenced paths) exist on disk **and** changed since the entry's `lastUpdated` | strong heuristic |
| `commit-ref` | a commit since the entry's `lastUpdated`/`started` references the entry (id, output path, or title token) | heuristic |
```

**Claim:** The plan does not define how to extract paths from `acceptance[]` text or what qualifies as a commit reference by “title token.”

**Impact:** Two implementations can produce different drift candidates from the same state: one may parse prose as paths and generate false positives, while another may miss real candidates. Title-token matching can also match common words in unrelated commit messages.

**Recommendation:** Define exact extraction rules: limit `output-exists` to structured `outputs[].path` unless a formal path syntax is added, and define commit matching as exact task/gate id plus exact declared output paths only.

**Confidence:** high

## Questions (non-findings)

- docs/superpowers/specs/2026-06-05-completion-reconciler-design.md:95 — Should `status --terminal`, `status --browser`, and bare `status` all run the same reconciliation pause-point, or only one of them?
- docs/superpowers/specs/2026-06-05-completion-reconciler-design.md:97 — For `Mark done` on an exit criterion, does this mean manual `met` evidence, `deferred`, or a new gate-specific flow?

## Out of scope

- Phase-end lessons consolidation details in Appendix B.
- The research basis and cited literature in Appendix C.
## Pass 2 (informed)

---
verdict: reject
counts: {blocker: 0, critical: 4, major: 2, minor: 0, nit: 0}
reviewer: gpt-5.3-codex
pass: informed
schema_version: "1.0"
---

## Summary
The design still fails its stated synchronization guarantee. It treats verifier presence as a drift signal even though verifiers are optional metadata that can exist before implementation, and it leaves sparse tasks undetectable when they lack verifier/output/commit signals.

The external constraints make the `verify` integration and reconciliation flow materially worse: default `verify` is read-only by contract, while the plan makes it an interactive mutation path, and GATE-R2 prevents closing detected output/commit candidates unless a real verifier has passed. The detector interface also remains unsafe for the current multi-project state layout and underspecified for free-text acceptance parsing.

## Findings

### F-001 [critical] viability — docs/superpowers/specs/2026-06-05-completion-reconciler-design.md:64-68

**Evidence:**
```md
**Per non-`done` task and per `pending` exit-criterion, classify an evidence class (strongest first):**

| Class | Signal | Strength |
|---|---|---|
| `verifier-available` | the entry has a `shell`/`test` `verifier:` | strongest — running it yields GATE-R2 evidence |
```

**Claim:** `verifier-available` is not evidence that work is done; it is only metadata that may exist before any implementation work has started.

**Impact:** Every open task or gate with a deterministic verifier will be reported as completion drift on every full `status`/`verify`, causing repeated reconciliation prompts for legitimately open work. The `Still open` action cannot suppress this class because the signal does not depend on `lastUpdated`.

**Recommendation:** Remove `verifier-available` from drift-producing classes unless paired with an independent completion signal, such as changed declared outputs, a scoped commit reference, or existing passing evidence awaiting status propagation.

**Confidence:** high

---

### F-002 [critical] contradiction — docs/superpowers/specs/2026-06-05-completion-reconciler-design.md:40-44

**Evidence:**
```md
### Goal
Guarantee that `.atomic-skills/` task/phase completion stays in sync with the repository, so that:
1. The user never silently accumulates "done in code, open in state" drift.
2. `phase-done` (and thus, later, lessons consolidation) fires at the right moment via the existing auto-transition.
3. Nothing is closed without honest evidence.
```

**Claim:** The plan claims a guarantee but later leaves any task with no verifier, outputs, or commit signal invisible to detection.

**Impact:** A task can still be completed in code and remain `pending` forever when it lacks optional metadata, so `phase-done` still fails to become reliably reachable. This preserves the original drift failure for sparse-task cases.

**Recommendation:** Either downgrade the goal from a guarantee to best-effort detection, or make deterministic completion signals mandatory for new/open tasks before relying on this reconciler.

**Confidence:** high

---

### F-003 [critical] contradiction — docs/superpowers/specs/2026-06-05-completion-reconciler-design.md:94-102

**Evidence:**
```md
- **Full `status` and `verify` run `detect-completion` FIRST.** If `drift` is true, they **HALT** before rendering a "green" view and walk the user through a reconciliation prompt — one structured `{{ASK_USER_QUESTION_TOOL}}` per candidate (batch oldest 4 first, mirroring the existing reconciliation gate), options:
  - **Run verifier** (only offered for `verifier-available`) → executes the existing Verifier execution pattern (`project-transitions.md`), writes GATE-R2 `evidence`, and on pass sets the entry `done`/`met`.
  - **Mark done** → closes via the normal `done <id>` flow (incl. auto-transition).
  - **Still open** → bumps `lastUpdated` (acknowledges, resets the signal clock).
  - **Skip** → no change.
- This is the Gawande pause-point applied to completion: it runs **every** status/verify, not by luck.
- **`verify` gains check #7 "completion drift"** so the coherence report names it explicitly:
  `WARN completion: N task(s)/gate(s) look done in the repo but are still open — reconcile before relying on status.`
```

**Claim:** The default `verify` path is specified as a mutating interactive reconciliation flow, not as the read-only coherence report required by the existing command contract.

**Impact:** Running `verify` can write evidence, close tasks/gates, or bump `lastUpdated`, which makes it unsafe as a diagnostic command and conflicts with the proposed check #7 behavior of merely emitting a warning. Tests that only assert a warning line do not cover the actual mutation behavior.

**Recommendation:** Keep default `verify` read-only: report completion drift and exit with a warning, then route mutation through `status` reconciliation or an explicit reconcile mode that is not default `verify`.

**Confidence:** high

---

### F-004 [critical] dependency-break — docs/superpowers/specs/2026-06-05-completion-reconciler-design.md:95-98

**Evidence:**
```md
- **Full `status` and `verify` run `detect-completion` FIRST.** If `drift` is true, they **HALT** before rendering a "green" view and walk the user through a reconciliation prompt — one structured `{{ASK_USER_QUESTION_TOOL}}` per candidate (batch oldest 4 first, mirroring the existing reconciliation gate), options:
  - **Run verifier** (only offered for `verifier-available`) → executes the existing Verifier execution pattern (`project-transitions.md`), writes GATE-R2 `evidence`, and on pass sets the entry `done`/`met`.
  - **Mark done** → closes via the normal `done <id>` flow (incl. auto-transition).
  - **Still open** → bumps `lastUpdated` (acknowledges, resets the signal clock).
```

**Claim:** The reconciliation options include `Mark done` for candidates that may not have a verifier, but GATE-R2 permits `done`/`met` only after real passing verifier evidence.

**Impact:** For `output-exists` or `commit-ref` candidates without a verifier, reconciliation either cannot close the candidate or must violate GATE-R2. The user can be trapped in repeated drift prompts where the only valid choices are `Still open` or `Skip`, neither of which reconciles completed work.

**Recommendation:** Restrict close actions to entries with an executable verifier and define a separate explicit remediation for no-verifier candidates, such as adding a verifier first or downgrading them to advisory-only findings.

**Confidence:** high

---

### F-005 [major] dependency-break — docs/superpowers/specs/2026-06-05-completion-reconciler-design.md:62-83

**Evidence:**
```md
**Input:** the active initiative file (default), or `--slug <slug>` / `--plan <plan-slug>` to widen; `--json` for machine output.
```

**Claim:** The detector interface identifies initiatives and plans only by slug, but the current state layout can contain multiple projects where slugs are ambiguous.

**Impact:** In a multi-project `.atomic-skills/projects/<project-id>/...` tree, `--slug` or `--plan` can inspect or mutate the wrong initiative during reconciliation. The JSON output also omits the resolved project id/path, so downstream `status`, `verify`, and hooks lack a safe target for writes.

**Recommendation:** Add an explicit `--project <project-id>` selector and include resolved `projectId` plus source file path for every candidate in the JSON output.

**Confidence:** high

---

### F-006 [major] ambiguity — docs/superpowers/specs/2026-06-05-completion-reconciler-design.md:68-70

**Evidence:**
```md
| `output-exists` | `outputs[].path` (or `acceptance[]`-referenced paths) exist on disk **and** changed since the entry's `lastUpdated` | strong heuristic |
| `commit-ref` | a commit since the entry's `lastUpdated`/`started` references the entry (id, output path, or title token) | heuristic |
```

**Claim:** The plan does not define how to extract paths from free-text `acceptance[]` strings or what qualifies as a commit reference by “title token.”

**Impact:** Two implementations can produce different drift candidates from the same state: one may parse prose as paths and generate false positives, while another may miss real candidates. Title-token matching can also match common words in unrelated commit messages.

**Recommendation:** Define exact extraction rules: limit `output-exists` to structured `outputs[].path` unless a formal path syntax is added, and define commit matching as exact task/gate id plus exact declared output paths only.

**Confidence:** high

## Questions (non-findings)

- docs/superpowers/specs/2026-06-05-completion-reconciler-design.md:95 — Should `status --terminal`, `status --browser`, and bare `status` all run the same reconciliation pause-point, or only one of them?
- docs/superpowers/specs/2026-06-05-completion-reconciler-design.md:97 — For exit criteria, what command is the “normal `done <id>` flow” supposed to invoke?

## Out of scope

- Phase-end lessons consolidation details in Appendix B.
- The research basis and cited literature in Appendix C.

## Pass 2 reconciliation

### Dropped from blind pass

- _(none)_

### Maintained

- F-001-blind → F-001-final [critical] — same
- F-002-blind → F-002-final [critical] — same
- F-003-blind → F-003-final [critical] — same
- F-004-blind → F-005-final [major] — same
- F-005-blind → F-006-final [major] — same

### Emerged

- F-004-final [critical] dependency-break — emerged: the GATE-R2 constraint says `done`/`met` requires real passing verifier evidence, which makes the plan’s generic `Mark done` option invalid for no-verifier `output-exists` and `commit-ref` candidates.
## Fixes applied in this session

<!-- Append-only. -->

**Applied 2026-06-05 (all 6 findings — verdict was `reject`):**

- **F-001 [critical]** verifier-presence dropped as a detection class — a `verifier:` field is metadata written before work starts, not completion evidence. Detection now keys only on changed deliverables (`output-exists`, `commit-ref`); the verifier becomes the *closing* mechanism in `reconcile`.
- **F-002 [critical]** Goal downgraded from "guarantee" to honest best-effort + a new **Component E** (signal-at-creation nudge + `find-signalless-tasks.js`) that shrinks the no-signal blind spot toward zero. Explicit honest-scope caveat added.
- **F-003 [critical]** `verify`/`status` kept strictly READ-ONLY (verify §Mutation policy preserved; check #7 is report-only). All mutation moved to a new explicit **`reconcile`** subcommand.
- **F-004 [critical]** `reconcile` disposition made verifier-aware: `hasVerifier:true` → `Run verifier` only (GATE-R2, no manual shortcut); `hasVerifier:false` → manual `Mark done` ack. No user-trap; GATE-R2 intact.
- **F-005 [major]** detector gains `--project <project-id>`; JSON emits `projectId` + resolved `initiativePath` per candidate (safe write target in a multi-project tree).
- **F-006 [major]** classes tightened to deterministic-only: `output-exists` = structured `outputs[].path` only (no `acceptance[]` prose); `commit-ref` = exact id or exact output path only (no title-token).

Codex Questions answered in-spec: (Q1) all `status` views are read-only and only surface the drift line; `reconcile` is the sole mutation verb. (Q2) exit-criteria close via the verifier-execution/manual-ack path → `met`, not the task `done <id>` flow.
