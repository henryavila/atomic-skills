---
date: 2026-06-19T18:03:03Z
topic: wlf-f8-finalize-plan-aware
artifact: 9f26c6d..HEAD (scripts/finalize-plan-scope.js, tests/finalize-plan-scope.test.js, skills/shared/project-assets/project-finalize.md)
skill: review-code
reviewer: gpt-5-codex
codex_version: codex-cli 0.141.0
final_verdict: needs_changes (all findings fixed in-session; re-verified green)
counts_final: {blocker: 0, critical: 0, major: 4, minor: 0, nit: 0}
counts_blind: {blocker: 0, critical: 0, major: 3, minor: 1, nit: 0}
framing_delta: {dropped: 0, maintained: 4, emerged: 0}
mode: both
schema_version: "1.0"
---

# Cross-Model Review — wlf-f8-finalize-plan-aware (phase-done gate)

Phase-done review gate for **F8 — finalize plan-aware (Decisão 9)**. Mode `both`:
local sealed-envelope agent first, then Codex two-pass (blind → informed) on the
same code surface. NOTE: local fixes were COMMITTED (f015e7c) before the Codex pass,
so the Codex pass reviewed the post-local-fix tree (a stricter bar — it validates the
local fixes AND reviews the mergeable code) rather than the byte-identical original.
This trades the cross-model framing-Δ purity for reviewing what actually merges.

## Local pass (sealed-envelope agent) — findings + fixes

verdict: findings_exist · counts: 0 blocker / 0 critical / 2 major / 2 minor

- **L#1 (major)** `detectPlanStatusRegression` mis-ranked `done`/`paused`: `ORDER
  ['active','archived']` omitted them (enum `active|paused|done|archived`) → `done`
  ranked -1 → false-positive (done-vs-active) + false-negative (active-vs-done).
- **L#2 (major)** `isTerminalPlan` rejected a `status: done` plan as "not terminal".
- **L#3 (minor)** state-file divergence: plan.md gates `met` vs phase-file gates
  `pending`/`gatesMet:0` (transient phase-done sequencing; resolved at transition).
- **L#4 (minor)** `result.target` echoed `targetSlug` on malformed/not-found block paths.

Fixes L#1/L#2/L#4 applied + tested → commit `f015e7c` (16→22 tests). L#3 resolved by
syncing the initiative gate mirror at the phase-done transition.

## Pass 1 (blind)

---
verdict: needs_changes
counts: {blocker: 0, critical: 0, major: 3, minor: 1, nit: 0}
reviewer: gpt-5-codex
pass: blind
schema_version: "1.0"
---

## Summary
The new guard has fail-open cases around malformed active plans and ambiguous plan identity. It also misses documented sibling warnings for paused plans, and the finalize instructions still allow a local-only base ref after detecting that the remote base is absent.

## Findings

### F-001 [major] correctness — scripts/finalize-plan-scope.js:68-84

**Evidence:**
```js
function undonePhases(plan) {
  const phases = ownArray(plan, 'phases') ?? [];
  const undone = [];
  phases.forEach((phase, index) => {
    if (ownString(phase, 'status') !== 'done') undone.push(phaseLabel(phase, index));
  });
  return undone;
}

function isTerminalPlan(plan) {
  const status = ownString(plan, 'status');
  // `archived` and a top-level `done` plan are both terminal/ready-to-publish
  // (plan.schema.json permits status: done). An `active` plan is terminal only once
  // every phase is `done` (the plan status flips to archived AFTER merge, per P2).
  if (status === 'archived' || status === 'done') return true;
  if (status !== 'active') return false;
  return undonePhases(plan).length === 0;
}
```

**Claim:** An active target with missing or non-array `phases` proceeds because `undonePhases` substitutes `[]`, so malformed input is treated as “all phases done”.

**Impact:** `resolveFinalizePlanScope({ plans: [{ slug: 'p', status: 'active' }], focusSlug: 'p', targetSlug: 'p' })` returns `proceed`, allowing finalize to publish an indeterminate or schema-invalid active plan.

**Recommendation:** For `status: 'active'`, require `phases` to be an array with at least one entry and block malformed phase arrays before checking whether all statuses are `done`; add regression tests for missing, empty, and non-array `phases`.

**Confidence:** high

---

### F-002 [major] correctness — scripts/finalize-plan-scope.js:153-158

**Evidence:**
```js
  const targetPlan = plans.find((plan) => ownString(plan, 'slug') === targetSlug);
  if (targetPlan === undefined) {
    result.target = null;
    result.blockReason = `target plan ${targetSlug} was not found among branch plans`;
    return result;
  }
```

**Claim:** Duplicate plan slugs are not detected; the first matching plan is selected and any other same-slug plan is ignored for target validation.

**Impact:** If two projects on the branch both contain `slug: 'shared'`, one terminal and one active with unfinished phases, `targetSlug: 'shared'` can proceed against the first entry while the branch merge still drags the unfinished same-slug plan along.

**Recommendation:** Include project identity or plan path in the target key, or fail closed when more than one branch plan has the requested slug.

**Confidence:** high

---

### F-003 [minor] logic-vs-doc — skills/shared/project-assets/project-finalize.md:219-221

**Evidence:**
```md
- **`warnings`** — one per non-archived **sibling** (`other-active`) plan a branch
  merge would drag along; surfaced as WARN, **never** auto-resolved.
```

**Claim:** The documented warning contract says non-archived siblings, but the module only warns for `status === 'active'`, so paused sibling plans are silently classified as archived-unmerged.

**Impact:** A branch carrying a paused in-progress plan plus the finalize target emits no sibling warning for the paused plan, even though the merge would include that non-archived plan state.

**Recommendation:** Either warn for paused siblings as non-archived in the module and tests, or narrow the markdown contract to active-only siblings.

**Confidence:** high

---

### F-004 [major] correctness — skills/shared/project-assets/project-finalize.md:87-91

**Evidence:**
```md
- **Use an existing ref** — the user names a branch that already exists
  (e.g. `main`, `develop`, a release branch). Confirm it resolves:
  `git show-ref --verify --quiet refs/heads/<ref>` (or `refs/remotes/origin/<ref>`).
- **Create `develop` from `main`** — `git branch develop main` (or from the repo's
  default branch), then publish it with `git push -u origin develop`.
```

**Claim:** After falling into prompt-when-absent because a resolved base is absent on `origin`, this instruction still accepts a local-only `refs/heads/<ref>` as an “existing ref”.

**Impact:** The consumer can choose a local branch that is not on `origin`, then proceed toward `gh pr create --base <ref>` against a remote base GitHub does not have, recreating the half-publish failure the new origin-existence guard is supposed to prevent.

**Recommendation:** For PR base refs, require `git ls-remote --exit-code --heads origin <ref>` before accepting “Use an existing ref”; only local refs that are pushed successfully should be persisted.

**Confidence:** high

## Questions (non-findings)


## Out of scope

- Files under `.atomic-skills/**` were not reviewed per the brief.
## Pass 2 (informed)

---
verdict: needs_changes
counts: {blocker: 0, critical: 0, major: 4, minor: 0, nit: 0}
reviewer: gpt-5-codex
pass: informed
schema_version: "1.0"
---

## Summary
The final finding set remains change-blocking. The guard can proceed on malformed active plan input, can resolve an ambiguous duplicate slug, and misses warnings for valid paused sibling plans even though the documented contract is non-archived siblings. The finalize instructions also still contain an origin-existence contradiction for PR base refs.

## Findings

### F-001 [major] correctness — scripts/finalize-plan-scope.js:68-84

**Evidence:**
```js
function undonePhases(plan) {
  const phases = ownArray(plan, 'phases') ?? [];
  const undone = [];
  phases.forEach((phase, index) => {
    if (ownString(phase, 'status') !== 'done') undone.push(phaseLabel(phase, index));
  });
  return undone;
}

function isTerminalPlan(plan) {
  const status = ownString(plan, 'status');
  // `archived` and a top-level `done` plan are both terminal/ready-to-publish
  // (plan.schema.json permits status: done). An `active` plan is terminal only once
  // every phase is `done` (the plan status flips to archived AFTER merge, per P2).
  if (status === 'archived' || status === 'done') return true;
  if (status !== 'active') return false;
  return undonePhases(plan).length === 0;
}
```

**Claim:** An active target with missing, empty, or non-array `phases` proceeds because `undonePhases` substitutes `[]`, so malformed input is treated as “all phases done”.

**Impact:** `resolveFinalizePlanScope({ plans: [{ slug: 'p', status: 'active' }], focusSlug: 'p', targetSlug: 'p' })` returns `proceed`, allowing finalize to publish an indeterminate or schema-invalid active plan despite the fail-closed contract.

**Recommendation:** For `status: 'active'`, require `phases` to be a non-empty array before checking phase statuses, and block malformed phase arrays; add tests for missing, empty, and non-array `phases`.

**Confidence:** high

---

### F-002 [major] correctness — scripts/finalize-plan-scope.js:153-158

**Evidence:**
```js
  const targetPlan = plans.find((plan) => ownString(plan, 'slug') === targetSlug);
  if (targetPlan === undefined) {
    result.target = null;
    result.blockReason = `target plan ${targetSlug} was not found among branch plans`;
    return result;
  }
```

**Claim:** Duplicate plan slugs are not detected; the first matching plan is selected and any other same-slug plan is ignored for target validation.

**Impact:** If two branch plan entries both have `slug: 'shared'`, one terminal and one active with unfinished phases, `targetSlug: 'shared'` can proceed against the first entry while the branch merge still includes the unfinished same-slug plan.

**Recommendation:** Use a unique target identity that includes project/path, or fail closed when more than one branch plan has the requested slug.

**Confidence:** high

---

### F-003 [major] correctness — scripts/finalize-plan-scope.js:55-60

**Evidence:**
```js
function classifyPlan(plan, targetSlug) {
  const slug = ownString(plan, 'slug');
  const status = ownString(plan, 'status');
  if (slug === targetSlug) return 'target';
  if (status === 'active') return 'other-active';
  return 'archived-unmerged';
}
```

**Claim:** Paused sibling plans are valid non-archived plans, but the module classifies them as `archived-unmerged` and emits no sibling warning.

**Impact:** A branch carrying a paused in-progress plan plus the finalize target emits no warning for the paused plan, so the operator can merge non-archived plan state without the documented warning.

**Recommendation:** Treat every non-archived non-target status, including `paused` and `done` if it is not terminal for this warning contract, as a warned sibling or narrow the documented contract to active-only siblings.

**Confidence:** high

---

### F-004 [major] logic-vs-doc — skills/shared/project-assets/project-finalize.md:87-91

**Evidence:**
```md
- **Use an existing ref** — the user names a branch that already exists
  (e.g. `main`, `develop`, a release branch). Confirm it resolves:
  `git show-ref --verify --quiet refs/heads/<ref>` (or `refs/remotes/origin/<ref>`).
- **Create `develop` from `main`** — `git branch develop main` (or from the repo's
  default branch), then publish it with `git push -u origin develop`.
```

**Claim:** After falling into prompt-when-absent because a resolved base is absent on `origin`, this instruction still accepts a local-only `refs/heads/<ref>` as an “existing ref”.

**Impact:** The consumer can choose a local branch that is not on `origin`, then proceed toward `gh pr create --base <ref>` against a remote base GitHub does not have, recreating the half-publish failure the new origin-existence guard is supposed to prevent.

**Recommendation:** For PR base refs, require `git ls-remote --exit-code --heads origin <ref>` before accepting “Use an existing ref”; local-only refs must be pushed successfully before they are used or persisted.

**Confidence:** high

## Questions (non-findings)

- _(none)_

## Out of scope

- Files under `.atomic-skills/**` were not reviewed per the brief.

## Pass 2 reconciliation

### Dropped from blind pass

- _(none)_

### Maintained

- F-001-blind → F-001-final [major] — same
- F-002-blind → F-002-final [major] — same
- F-003-blind → F-003-final [major] — severity changed: was minor, now major
- F-004-blind → F-004-final [major] — same

### Emerged

- _(none)_
## Briefings used

Captured material (not inlined — reconstructable from git):
- Pass 1 briefing: `/tmp/codex-briefing-pass1-wlf-f8.md` (anti-framing + factual non-goals + diff + output template). Diff = `git diff 9f26c6d..HEAD -- scripts/finalize-plan-scope.js tests/finalize-plan-scope.test.js skills/shared/project-assets/project-finalize.md` (27,304 bytes).
- Pass 2 briefing: `/tmp/codex-briefing-pass2-wlf-f8.md` (Pass 1 briefing + verifiable constraints: status enum, purity, fail-closed contract, non-archived-sibling WARN contract, origin-existence + Pass 1 output + reconciliation template).
- Invocation: `codex -a never exec -c model_reasoning_effort=high --sandbox read-only --skip-git-repo-check --ephemeral` (canonical read-only profile), both passes exit 0.

## Fixes applied in this session

Codex final findings (4 major, all MAINTAINED across both passes) — all applied + re-verified:

- **F-001 (major) — active plan with missing/empty/non-array `phases` proceeded (fail-OPEN).**
  Fix: `isTerminalPlan` now requires an `active` plan to have a NON-EMPTY phases array,
  all `done`; missing/empty/non-array → not terminal (fail-closed). `resolveFinalizePlanScope`
  emits a distinct blockReason ("no determinable phases"). `scripts/finalize-plan-scope.js`.
- **F-002 (major) — duplicate plan slugs across projects → first-match, fail-OPEN.**
  Fix: `plans.find` → `plans.filter`; `matches.length > 1` BLOCKS as ambiguous
  ("disambiguate by project"), target null. `scripts/finalize-plan-scope.js`.
- **F-003 (major) — paused/non-archived siblings not warned despite the documented
  "non-archived siblings" contract.** Fix: `classifyPlan` now buckets only `archived`
  as `archived-unmerged`; every other non-target status (active, paused, done, unknown)
  is `other-active` → warned. Warning kind→`nonarchived-sibling-plan`, reason→"non-archived
  sibling plan ...". `scripts/finalize-plan-scope.js`.
- **F-004 (major) — prompt-when-absent "Use an existing ref" accepted a local-only
  `refs/heads/<ref>` → could `gh pr create --base` against a ref `origin` lacks.**
  Fix: the bullet now requires `git ls-remote --exit-code --heads origin <ref>` (exit 0);
  a local-only ref must be pushed before use/persist. `skills/shared/project-assets/project-finalize.md`.

Re-verification (merged primary tree): `node --test tests/finalize-plan-scope.test.js`
→ exit 0, tests 24, pass 24, fail 0 (22→24: +empty-phases fail-closed, +ambiguous-slug).
`npm run validate-skills` → All 15 skills valid, exit 0.

### Self-review against code-quality gates

- G1 read-before-claim: for each fix, read the cited file:line in the primary tree before editing (classifyPlan 50-56, isTerminalPlan 72-79, find→filter 141+, project-finalize.md 87-91).
- G2 soft-language: fix descriptions scanned for should/probably/may/typically/usually — 0 occurrences; state what each fix does.
- G3 anti-tautology: each new assertion names the mutation that breaks it — empty-phases test fails if `isTerminalPlan` drops the phases guard (reverts to `[]` substitution); ambiguous-slug test fails if `find` is restored over `filter`; paused-sibling test fails if `classifyPlan` re-adds the `status==='active'`-only branch.
- G4 fixture realism: fixtures are parsed-plan slices mirroring `plan.schema.json` (status enum active|paused|done|archived) — the real shape the consumer injects; N/A for external payloads.
- G7 anti-premature-abstraction: no new helper introduced; reused the existing `ownArray`/`ownString` family.
