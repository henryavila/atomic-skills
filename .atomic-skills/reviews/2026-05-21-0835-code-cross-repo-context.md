---
date: 2026-05-21T08:36:12-03:00
topic: code-cross-repo-context
artifact: aideck 93f3939..HEAD + atomic-skills f04a3b1..HEAD
skill: review-code-with-codex
reviewer: gpt-5-codex
codex_version: codex-cli 0.130.0
final_verdict: needs_changes
counts_final: {blocker: 0, critical: 0, major: 1, minor: 1, nit: 0}
counts_blind: {blocker: 0, critical: 0, major: 3, minor: 1, nit: 0}
framing_delta: {dropped: 2, maintained: 2, emerged: 0}
schema_version: "1.0"
---

# Cross-Model Review — code-cross-repo-context

## Pass 1 (blind)

---
verdict: needs_changes
counts: {blocker: 0, critical: 0, major: 3, minor: 1, nit: 0}
reviewer: gpt-5-codex
pass: blind
schema_version: "1.0"
---

## Summary
The change makes `context` required for populated `parked[]` and `emerged[]`, but the surrounding contracts are only partially updated. Existing mutation/consumer paths can still create context-less entries, the dashboard assumes the field is always present and can crash on older or invalid data, and aideck's exported TypeScript interfaces still omit the new fields.

There is also a stale-context correctness gap: schema-valid items with only `ratifiedAt` and no `lastReviewedAt` are never marked stale, even when the context is old.

## Findings

### F-001 [major] backward compatibility — ../aideck/src/schemas/validators/project-status.ts:206-218

**Evidence:**
```ts
export const parkedItemSchema = z.object({
  title: z.string(),
  surfacedAt: isoTimestampSchema,
  fromFrame: z.number().int().nullable(),
  context: contextSchema
})

export const emergedItemSchema = z.object({
  title: z.string(),
  surfacedAt: isoTimestampSchema,
  promoted: z.boolean(),
  context: contextSchema
})
```

**Claim:** `aideck_park_item` / `aideck_emerge_item` consumers that still write `{title, surfacedAt, fromFrame}` or `{title, surfacedAt, promoted}` now create initiative files that fail the new parser schema.

**Impact:** A normal parked/emerged write can make the initiative unreadable on the next parse, breaking state reads and dashboard loading for that initiative.

**Recommendation:** Update every parked/emerged write path and intent contract to require or synthesize `context`, or keep the parser backward-compatible with a migration/defaulting path for existing context-less entries.

**Confidence:** high

---

### F-002 [major] API contract — ../aideck/src/schemas/project-status.ts:211-252

**Evidence:**
```ts
export interface Task {
  id: string
  title: string
  description?: string

  status: TaskStatus
  lastUpdated: IsoTimestamp
  closedAt?: IsoTimestamp

  blockedBy?: string[]
  outputs?: TaskOutput[]
  tags?: string[]
  resourceCounts?: Record<string, number>
  verifier?: ExitCriterionVerifier
}
```

**Claim:** aideck's public TypeScript model still omits `provenance` and `context` for `Task`, `PhaseDescriptor`, `ParkedItem`, and `EmergedItem` even though the validators now parse and require those fields in several places.

**Impact:** TypeScript consumers of `parseInitiativeFile()` / `parsePlanFile()` get a stale type contract and cannot safely access the new parsed fields without casts, making the cross-repo runtime contract diverge from the exported API.

**Recommendation:** Update aideck's canonical TypeScript interfaces to match the validator schemas and add a type-level or TS consumer test that reads `context` from parsed parked/emerged items.

**Confidence:** high

---

### F-003 [major] correctness — src/dashboard/lib/adapters.ts:332-348

**Evidence:**
```ts
parked: initiative.parked.map((p, i) => ({
  id: `P-${i + 1}`,
  title: p.title,
  parkedAt: p.surfacedAt.slice(0, 10),
  reason: p.context.solves,
  lastReviewedAt: p.context.lastReviewedAt,
  staleAge: computeStaleAge(p.context.lastReviewedAt),
})),
emerged: initiative.emerged.map((e, i) => ({
  id: `E-${i + 1}`,
  title: e.title,
  surfacedAt: e.surfacedAt.slice(0, 10),
  promoted: e.promoted,
  reason: e.context.solves,
  lastReviewedAt: e.context.lastReviewedAt,
  staleAge: computeStaleAge(e.context.lastReviewedAt),
})),
```

**Claim:** The dashboard crashes when it receives a populated parked/emerged item without `context`.

**Impact:** During partial rollout, rollback, stale aideck dist usage, or old fixture/API data, opening `InitiativePage` throws instead of rendering the initiative with a missing reason.

**Recommendation:** Treat `context` defensively at the dashboard boundary, e.g. optional access plus degraded rendering, or validate the fetched entity and show a controlled schema error.

**Confidence:** high

---

### F-004 [minor] correctness — src/dashboard/lib/adapters.ts:251-253

**Evidence:**
```ts
function computeStaleAge(lastReviewedAt?: string): number | undefined {
  if (!lastReviewedAt) return undefined
  return Math.floor((Date.now() - Date.parse(lastReviewedAt)) / 86400000)
}
```

**Claim:** A schema-valid context with an old `ratifiedAt` but no `lastReviewedAt` is never marked stale.

**Impact:** Old parked/emerged context can avoid the stale glyph indefinitely, hiding review debt from the dashboard.

**Recommendation:** Either require/default `lastReviewedAt` when context is created, or compute stale age from `lastReviewedAt ?? ratifiedAt`.

**Confidence:** medium

## Questions (non-findings)

- ../aideck/src/schemas/validators/project-status.ts:206 — Is rejecting all existing context-less populated parked/emerged entries intentional without a schema version bump or read-time migration?
- tests/aideck-contract.test.js:155 — Should this contract also cover the failure/degradation path for older populated parked/emerged entries without `context`?

## Out of scope

- Package version bumps.
- Changelog entries.
- JSON Schema edits.
- New CI/Codex integration.

## Pass 2 (informed)

---
verdict: needs_changes
counts: {blocker: 0, critical: 0, major: 1, minor: 1, nit: 0}
reviewer: gpt-5-codex
pass: informed
schema_version: "1.0"
---

## Summary
Most blind-pass runtime concerns do not survive the supplied constraints: the canonical atomic-skills writer adds full context, aideck MCP mutation tools are only intent producers for other consumers, malformed initiatives are rejected by the watcher before dashboard state, and version/migration work is explicitly out of scope.

Two issues remain. aideck's exported TypeScript interfaces still diverge from the zod-validated runtime shape, and the dashboard's stale-context calculation ignores `ratifiedAt` when `lastReviewedAt` is absent even though that shape is schema-valid.

## Findings

### F-001 [major] API contract — ../aideck/src/schemas/project-status.ts:87

**Evidence:** `PhaseDescriptor`, `Task`, `ParkedItem`, and `EmergedItem` interfaces omit `provenance` / `context`, while `../aideck/src/schemas/validators/project-status.ts:110`, `:182`, `:206`, and `:213` parse those fields and require `context` for parked/emerged.
**Claim:** The exported TypeScript contract for `parseInitiativeFile()` / `parsePlanFile()` is stale relative to the runtime parser.
**Impact:** TypeScript consumers cannot safely access parsed `context` or `provenance` without casts, and may implement incorrect handling based on the public model.
**Recommendation:** Update the canonical interfaces to match the zod schemas, including defaults applied post-parse, and add a TS consumer/type test that reads parked/emerged `context`.
**Confidence:** high

---

### F-002 [minor] correctness — src/dashboard/lib/adapters.ts:251

**Evidence:** `computeStaleAge()` only accepts `lastReviewedAt`; adapter calls pass only `p.context.lastReviewedAt` / `e.context.lastReviewedAt`, while `ratifiedAt` is required and `lastReviewedAt` is optional in the context schema.
**Claim:** A schema-valid item with old `ratifiedAt` and missing `lastReviewedAt` is never marked stale.
**Impact:** Review debt can be hidden for valid hand-authored or legacy-compatible data even though the item has an old ratification timestamp.
**Recommendation:** Compute stale age from `lastReviewedAt ?? ratifiedAt`, or make `lastReviewedAt` required/defaulted at parse time.
**Confidence:** medium

## Questions (non-findings)

- _(none)_

## Out of scope

- Version bump or migration tooling.
- Redesigning the aideck MCP `park_item` / `emerge_item` intent contract.
- Changing the canonical atomic-skills write path.

## Pass 2 reconciliation

### Dropped from blind pass

- F-001-blind [major] backward compatibility — DROPPED: canonical atomic-skills writes full context directly, aideck MCP only records title-only intents for other consumers, and the cross-tool intent gap is explicitly out of scope.
- F-003-blind [major] correctness — DROPPED: dashboard state only receives entities that pass the aideck parser; malformed context-less initiatives emit watcher errors and are not exposed through `/api/state`.

### Maintained

- F-002-blind → F-001-final [major] — same
- F-004-blind → F-002-final [minor] — same

### Emerged

- _(none)_

## Briefings used

<details>
<summary>Pass 1 briefing</summary>

See `/tmp/codex-briefing-pass1-20260521-083612.md` (full diff + modified files + caller).

</details>

<details>
<summary>Pass 2 briefing</summary>

See `/tmp/codex-briefing-pass2-20260521-083612.md` (8 external constraints + Pass 1 output).

</details>

## Fixes applied in this session

- F-001 (major) — APPLIED. `/Volumes/External/code/aideck/src/schemas/project-status.ts`: added `Provenance` + `Context` interfaces; extended `PhaseDescriptor`, `Task` with optional `provenance` + `context`; made `context: Context` required on `ParkedItem` and `EmergedItem`. Matches the existing change in atomic-skills `src/dashboard/lib/types.ts`.
- F-002 (minor) — APPLIED. `/Volumes/External/code/atomic-skills/src/dashboard/lib/adapters.ts`: `computeStaleAge` now accepts both `lastReviewedAt` and `ratifiedAt` and falls back to `ratifiedAt` when `lastReviewedAt` is absent. Callers updated.
