---
date: 2026-05-20T09:28:53Z
topic: phase-c-extension
artifact: 73ea412..HEAD
skill: review-code-with-codex
reviewer: gpt-5-codex
codex_version: codex-cli 0.130.0
final_verdict: needs_changes
counts_final: {blocker: 0, critical: 0, major: 2, minor: 0, nit: 0}
counts_blind: {blocker: 0, critical: 0, major: 2, minor: 0, nit: 0}
framing_delta: {dropped: 0, maintained: 2, emerged: 0}
schema_version: "1.0"
---

# Cross-Model Review — phase-c-extension

## Pass 1 (blind)

---
verdict: needs_changes
counts: {blocker: 0, critical: 0, major: 2, minor: 0, nit: 0}
reviewer: gpt-5-codex
pass: blind
schema_version: "1.0"
---

## Summary
The diff adds useful parsing coverage, but it introduces two data-loss regressions in direct code paths: common H3 task titles beginning with “Task” are now treated as marker headings and omitted, and newly parsed bullet task descriptions are discarded during materialization. Both issues can produce valid-looking output that silently loses user plan content.

## Findings

### F-001 [major] correctness — src/decompose.js:109-355

**Evidence:**
```js
const TASK_MARKER_H3_RE = /^(?:sub[-\s]?fases?|sub[-\s]?phases?|tasks?|sub[-\s]?tasks?)\b/i;
```

```js
  // Mode 2: H3 = task (fallback). Skips marker H3s.
  const tasks = [];
  let counter = 0;
  for (const line of bodyLines) {
    const m = line.match(H3_RE);
    if (!m) continue;
    if (TASK_MARKER_H3_RE.test(normalizeHeading(m[1]))) continue;
```

**Claim:** A phase containing `### Task one` or `### Tasks cleanup` with no bullet tasks loses that H3 task because `tasks?\\b` matches the task title as a marker, then fallback explicitly skips it.

**Impact:** Previously valid H3-task plans can materialize with missing tasks, wrong `subPhaseCount`, and `nextAction: null`, while still looking structurally valid enough to proceed.

**Recommendation:** Narrow marker detection to exact marker labels or require marker syntax such as `Tasks`/`Sub-tasks` alone with optional parenthetical suffix, and add a regression test for `### Task one`.

**Confidence:** high

---

### F-002 [major] data integrity — src/decompose.js:757-762

**Evidence:**
```js
    const tasks = init.tasks.map((t) => ({
      id: t.id,
      title: t.title || `Task ${t.id}`,
      status: 'pending',
      lastUpdated: iso,
    }));
```

**Claim:** Bullet task descriptions parsed by `parseTaskBullet` are dropped when writing initiative frontmatter because materialization copies only `id`, `title`, `status`, and `lastUpdated`.

**Impact:** Inputs like `- **F0.T-001 — Restore local infra.** Composer install, .env, PostgreSQL.` preview with a description, but the generated Initiative loses the actionable details after adoption.

**Recommendation:** Preserve `t.description` in the materialized task object when present, and extend the materialize end-to-end test to assert descriptions survive into initiative frontmatter.

**Confidence:** high

## Questions (non-findings)


## Out of scope

- Markdown prose review of `skills/en/core/project-plan.md`
- Markdown prose review of `tests/fixtures/project-plan/sda-v2-shape.md`
- aiDeck TypeScript schema drift
- Phase D items not present in this diff
- Behavior of pre-existing `project-status` skill body
- Files outside this diff or its direct dependents
## Pass 2 (informed)

---
verdict: needs_changes
counts: {blocker: 0, critical: 0, major: 2, minor: 0, nit: 0}
reviewer: gpt-5-codex
pass: informed
schema_version: "1.0"
---

## Summary
The informed pass keeps both blind-pass findings. The new constraints strengthen the materialization issue: task descriptions are explicitly schema-supported, documented, parsed, and unit-tested at the decompose layer, but they are still dropped before writing Initiative frontmatter. The H3 marker regression also still stands because the new marker regex collides with the original H3-as-task behavior.

No new findings emerge solely from the added constraints. The lack of current production callers limits immediate blast radius, but these helpers are the code path intended for future `project-plan` adoption, so silent task loss remains a release-blocking correctness/data-integrity issue for this diff.

## Findings

### F-001 [major] correctness — src/decompose.js:109

**Evidence:**
```js
const TASK_MARKER_H3_RE = /^(?:sub[-\s]?fases?|sub[-\s]?phases?|tasks?|sub[-\s]?tasks?)\b/i;
```

```js
  // Mode 2: H3 = task (fallback). Skips marker H3s.
  const tasks = [];
  let counter = 0;
  for (const line of bodyLines) {
    const m = line.match(H3_RE);
    if (!m) continue;
    if (TASK_MARKER_H3_RE.test(normalizeHeading(m[1]))) continue;
```

**Claim:** A phase containing `### Task one` with no bullet tasks loses that H3 task because `tasks?\b` treats the task title as a marker, then fallback skips it.

**Impact:** Previously valid H3-task plans can materialize with missing tasks, wrong task counts, and `nextAction: null`; the Stage 5 preview only shows counts, not task titles, so this loss is hard to detect before adoption.

**Recommendation:** Narrow marker detection to exact labels such as `Tasks`/`Sub-tasks` with optional parenthetical suffix, and add a regression test for `### Task one`.

**Confidence:** high

---

### F-002 [major] data integrity — src/decompose.js:757

**Evidence:**
```js
    const tasks = init.tasks.map((t) => ({
      id: t.id,
      title: t.title || `Task ${t.id}`,
      status: 'pending',
      lastUpdated: iso,
    }));
```

**Claim:** Bullet task descriptions parsed by `parseTaskBullet()` are dropped during materialization because only `id`, `title`, `status`, and `lastUpdated` are copied into Initiative frontmatter.

**Impact:** Inputs like `- **F0.T-001 — Restore local infra.** Composer install, .env, PostgreSQL.` produce parsed task descriptions but generated Initiative files lose the actionable details after adoption.

**Recommendation:** Preserve `t.description` when present, and add a materialization test asserting the description survives into Initiative frontmatter.

**Confidence:** high

## Questions (non-findings)

- _(none)_

## Out of scope

- Markdown prose review of `skills/en/core/project-plan.md`
- Markdown prose review of `tests/fixtures/project-plan/sda-v2-shape.md`
- aiDeck TypeScript schema drift
- Phase D items not present in this diff
- Behavior of pre-existing `project-status` skill body
- Files outside this diff or its direct dependents

## Pass 2 reconciliation

### Dropped from blind pass

- _(none)_

### Maintained

- F-001-blind → F-001-final [major] — same
- F-002-blind → F-002-final [major] — same

### Emerged

- _(none)_
## Briefings used

<details>
<summary>Pass 1 briefing</summary>

Stored at `/tmp/codex-briefing-pass1-20260520-092853.md` (48 KB; includes full diff).

</details>

<details>
<summary>Pass 2 briefing</summary>

Stored at `/tmp/codex-briefing-pass2-20260520-092853.md` (56 KB; Pass 1 briefing + external constraints + Pass 1 output + reconciliation prompt).

</details>

## Fixes applied in this session

- **F-001 [major] correctness — APPLIED**
  - `src/decompose.js`: `TASK_MARKER_H3_RE` re-anchored. Was `^(?:sub[-\s]?fases?|sub[-\s]?phases?|tasks?|sub[-\s]?tasks?)\b/i` (any prefix match); now `^(?:sub[-\s]?fases?|sub[-\s]?phases?|tasks?|sub[-\s]?tasks?)(?:\s*\([^)]*\))?\s*$/i` — requires the marker to be the WHOLE H3 title, optionally followed by a parenthesized suffix like `(menu)`. Prevents `### Task one`, `### Tasks cleanup` from being misclassified as marker H3s (which Mode 2 fallback would then drop).
  - `tests/decompose.test.js`: 4 new regression tests
    1. `### Task one` + `### Task two` H3s survive as tasks (titles preserved).
    2. `### Tasks cleanup` H3 survives (no-suffix marker requires whole-line match).
    3. `### Sub-fases (menu)` still recognised as marker (parenthesized suffix allowed; bullet tasks extracted).
    4. Bare `### Tasks` still recognised as marker (no suffix required).

- **F-002 [major] data integrity — APPLIED**
  - `src/decompose.js`: `materializeDecomposition` task-mapping now spreads `description` when present. Was `{id, title, status, lastUpdated}`; now `{id, title, ...(t.description ? { description: t.description } : {}), status, lastUpdated}`. `description` is optional per `meta/schemas/initiative.schema.json#/$defs/task.properties.description`.
  - `tests/decompose.test.js`: 2 new regression tests
    1. Bullet task with `- **F0.T-001 — title.** body...` materializes with `description: "body..."` in the Initiative frontmatter; schema validation passes (description is optional).
    2. Regression guard: H3-as-task fallback (no description parsed) materializes WITHOUT a `description` field on the task object.

Real-world smoke (sda-v2 v3-redesign master): each of the 61 materialized tasks now carries its description verbatim (e.g., F0.T-001 description `Composer install, .env, PostgreSQL \`vsda\`, npm install, MySQL legacy verificado.`).

Post-fix verification:
- `npm test` exits 0 with **301 passing** (was 295 before fixes, +6 regression).
- `npm run validate-skills` exits 0 (13 skills).
- `npm run validate-state tests/fixtures/state` exits 0.
