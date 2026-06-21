---
date: 2026-06-17T15:50:25-0300
topic: wlf-f3-project-finalize
artifact: 076af09..HEAD
skill: review-code
reviewer: gpt-5-codex
codex_version: codex-cli 0.139.0
final_verdict: needs_changes
counts_final: {blocker: 0, critical: 0, major: 4, minor: 0, nit: 0}
counts_blind: {blocker: 0, critical: 1, major: 3, minor: 1, nit: 0}
framing_delta: {dropped: 2, maintained: 3, emerged: 1}
schema_version: "1.0"
---

# Cross-Model Review — wlf-f3-project-finalize (F3 phase-done gate, mode=both)

Range `076af09..HEAD` (F3-era commits: `3dcdfbb` focus.json untrack + `d74a1f0` T-001).
Code subject: `skills/shared/project-assets/project-finalize.md` (new) + `skills/core/project.md` (router wiring).

## Local pass (same-model sealed envelope)

3 findings — 1 critical / 1 major / 1 minor. All real; all fixed in `project-finalize.md`.

- **L#1 [critical] producer/consumer overclaim** — finalize.md asserted the recorded PR identity is consumed by F2 teardown and the handoff is closed, but `project-transitions.md:290` calls `isTeardownSafe({branch, baseRef})` without `integrationRef`/`prIdentity` → `indeterminate-base`. FIX: reworded to state the identity is what `isTeardownSafe` *requires*, and flagged the archive-flow consumer wiring as an OPEN follow-up (out of T-001 scope; `project-transitions.md` is F2 territory). [confirmed disjointly by codex blind F-003, then DROPPED in pass2 under the out-of-scope constraint]
- **L#2 [major] references[] shape unspecified** — FIX: specified `{ kind: url, path: <pr-url>, label: "PR #<number>" }` per `artifactRef`. [= codex F-004-blind → final F-002]
- **L#3 [minor] persist-before-publish-proven on create-develop path** — FIX: gate routing.json persistence on the ref being confirmed on `origin`; on push failure do not persist + re-prompt. [= codex pass2 Question:64]

## Pass 1 (blind)

---
verdict: needs_changes
counts: {blocker: 0, critical: 1, major: 3, minor: 1, nit: 0}
reviewer: gpt-5-codex
pass: blind
schema_version: "1.0"
---

## Summary
The new `finalize` procedure wires into the router, but the documented lifecycle is not safe or consumable as written. The largest issues are around untrusted ref handling, missing schema validation before using `routing.json`, and a broken producer/consumer contract between the PR identity recorded by `finalize` and the archive teardown caller.

Several failures are not stylistic: a malicious or malformed ref can reach shell commands, invalid routing config can silently default to `develop`, and the documented archive path still calls `isTeardownSafe` without the values that function requires.

## Findings

### F-001 [critical] security — skills/shared/project-assets/project-finalize.md:46-59

**Evidence:**
```markdown
- **Use an existing ref** — the user names a branch that already exists
  (e.g. `main`, `develop`, a release branch). Confirm it resolves:
  `git show-ref --verify --quiet refs/heads/<ref>` (or `refs/remotes/origin/<ref>`).
...
```
```markdown
git check-ref-format --branch <ref>   # rejects whitespace, control chars, malformed ref names
```

**Claim:** The procedure interpolates a user-supplied ref into shell commands before safely validating or quoting it.

**Impact:** A ref containing shell metacharacters can execute arbitrary local commands when the operator follows the documented `git show-ref` or even the documented validation command.

**Recommendation:** Require validation through a non-shell API such as `execFile`/argument arrays, or shell-quote the ref before every command and validate before any `show-ref`/diff/push/PR use.

**Confidence:** high

---

### F-002 [major] correctness — skills/shared/project-assets/project-finalize.md:29-37

**Evidence:**
```markdown
- Read `routing.json` if it exists (parse JSON); pass `null` when the file is absent.
- `resolveIntegrationRef(routingConfig)` returns `{ ref, configured, source }`:
  - `source: 'declared'` — a configured `integrationRef`; use `ref`.
  - `source: 'default'` — file present but the field is absent; use the documented
    default `develop`.
```

**Claim:** The procedure calls `resolveIntegrationRef` without first validating `routing.json` against `meta/schemas/routing.schema.json`.

**Impact:** The real resolver treats invalid present values such as `integrationRef: ""`, `123`, or `{}` as the default `develop`, so a malformed config can silently publish a PR against the wrong base.

**Recommendation:** Add an explicit schema-validation step for `.atomic-skills/status/routing.json`; abort on schema errors and only call `resolveIntegrationRef` on schema-valid parsed config or `null` for an absent file.

**Confidence:** high

---

### F-003 [major] cross-file contract — skills/shared/project-assets/project-transitions.md:289-293

**Evidence:**
```markdown
- Use `scripts/worktree-teardown.js` as the invariant source: resolve the base via `resolveBaseRef()`, then call `isTeardownSafe({ branch: 'plan/<slug>', baseRef })`.
```

**Claim:** The archive caller is not updated to pass `integrationRef` or the recorded `prIdentity` that `isTeardownSafe` requires.

**Impact:** Even after `finalize` records a PR and the PR is merged, teardown blocks because `isTeardownSafe` returns `indeterminate-base` or `pr-identity-missing`; the documented "removal guard reads the now-MERGED PR" path cannot work.

**Recommendation:** Update `archive` to load routing config, resolve `{ integrationRef, baseRef }`, extract the PR identity from the plan state, and call `isTeardownSafe({ branch, baseRef, integrationRef, prIdentity, gh })`.

**Confidence:** high

---

### F-004 [major] data integrity — skills/shared/project-assets/project-finalize.md:95-97

**Evidence:**
```markdown
- Write the `pr-url` (and PR number) onto the plan state — add it to the plan's
  `references[]` (labelled e.g. `pr: <url>`). Do **not** add a new `integrationRef`
  frontmatter field.
```

**Claim:** The procedure does not specify the schema-valid `references[]` object shape for the PR record.

**Impact:** A literal `pr: <url>` or scalar entry violates `common.schema.json`’s `artifactRef` contract, while a loosely written object can drop the PR number or make later `prIdentity` extraction ambiguous.

**Recommendation:** Specify the exact artifact shape, e.g. `{ kind: "url", path: "<pr-url>", label: "PR #<number>" }`, and document how archive extracts the identity from that shape.

**Confidence:** high

---

### F-005 [minor] consistency — meta/catalog.yaml:292-377

**Evidence:**
```yaml
    subcommands:
      - name: status
...
      - name: archive
        group: 'Lifecycle'
        signature: '[<slug>]'
        description: 'Move a finished plan or initiative to archive/ (archiving a plan cascades to its child initiatives)'
```

**Claim:** The project subcommand catalog is stale: it has no `finalize` entry after the router adds `/atomic-skills:project finalize`.

**Impact:** Generated help/catalog surfaces omit the new lifecycle command, so users and tooling that rely on the catalog cannot discover the command even though the router accepts it.

**Recommendation:** Add a `finalize` subcommand entry to `meta/catalog.yaml` and update any generated docs derived from it.

**Confidence:** high

## Questions (non-findings)

- skills/shared/project-assets/project-finalize.md:64 — Should `routing.json` be persisted before the operator confirms the publish, or only after the PR is successfully created?

## Out of scope

- `.atomic-skills/focus.json` deletion.
- `.atomic-skills/projects/**/f3-*.md` bookkeeping state.
- `.gitignore` bookkeeping change.
## Pass 2 (informed)

---
verdict: needs_changes
counts: {blocker: 0, critical: 0, major: 4, minor: 0, nit: 0}
reviewer: gpt-5-codex
pass: informed
schema_version: "1.0"
---

## Summary
After applying the external constraints, the shell-injection and archive-caller findings from the blind pass no longer stand. The remaining defects are in the finalize procedure and a direct generated-help mirror: invalid `routing.json` can silently become `develop`, the PR reference write is underspecified against the strict schema, remote-only base refs can make the preview diff fail, and the catalog mirror omits the new subcommand.

These are procedure bugs, not prose issues: following the doc can publish against the wrong base, write invalid state, fail in a common remote-only branch setup, or leave generated help/tooling unaware of `finalize`.

## Pass 2 reconciliation

### Dropped from blind pass

- F-001-blind — DROP. The external constraints state the procedure is executed through a structured argument-vector tool, the ref is operator-named, and `git check-ref-format`/`show-ref` receive the ref as a discrete argument, so the shell-injection claim is invalid for this artifact.
- F-003-blind — DROP. The external constraints make `skills/shared/project-assets/project-transitions.md` out of scope for this change, despite being a referenced downstream asset.

### Maintained

- F-002-blind — MAINTAIN as final F-001. The external constraints explicitly confirm the procedure doc does not state schema validation before calling the resolver.
- F-004-blind — MAINTAIN as final F-002. The strict `artifactRef` schema requires an object shape; the finalize doc still only says `pr: <url>`/PR number.
- F-005-blind — REFINE as final F-004. The finding stands, with severity raised to major because the external constraints confirm `meta/catalog.yaml` is a machine-readable mirror used to generate help/docs.

### Emerged

- Final F-003 — The informed pass found a separate base-ref correctness bug: the doc accepts `refs/remotes/origin/<ref>` as a valid existing integration branch, then uses bare `<integrationRef>` for local `git diff`, which can fail when no local branch exists.

## Findings

### F-001 [major] correctness — skills/shared/project-assets/project-finalize.md:33-37

**Evidence:**
```markdown
- Read `routing.json` if it exists (parse JSON); pass `null` when the file is absent.
- `resolveIntegrationRef(routingConfig)` returns `{ ref, configured, source }`:
  - `source: 'declared'` — a configured `integrationRef`; use `ref`.
  - `source: 'default'` — file present but the field is absent; use the documented
    default `develop`.
```

```js
 * Resolve the effective integration ref from ALREADY-READ, SCHEMA-VALID
 * routing.json content.
...
 * A present-but-non-string value (schema-invalid, hence
 * unreachable post-validation) is tolerated defensively via the `default`
 * branch
```

**Claim:** The procedure parses present `routing.json` and calls `resolveIntegrationRef` without first validating it, even though the resolver’s contract assumes schema-valid input and maps invalid present values to the `develop` default.

**Impact:** A malformed config such as `{"integrationRef": ""}` or `{"integrationRef": 123}` can silently publish the plan PR against `develop` instead of blocking on the operator’s broken routing config.

**Recommendation:** Add an explicit `meta/schemas/routing.schema.json` validation step before `resolveIntegrationRef`; abort on parse/schema errors and call the resolver only with schema-valid parsed config or `null` for an absent file.

**Confidence:** high

---

### F-002 [major] data integrity — skills/shared/project-assets/project-finalize.md:95-97

**Evidence:**
```markdown
- Write the `pr-url` (and PR number) onto the plan state — add it to the plan's
  `references[]` (labelled e.g. `pr: <url>`). Do **not** add a new `integrationRef`
  frontmatter field.
```

```json
"artifactRef": {
  "type": "object",
  "additionalProperties": false,
  "required": ["kind", "path"],
  "properties": {
    "kind": { "type": "string", "enum": ["file", "url", "repo-path", "section"] },
    "path": { "type": "string", "minLength": 1 },
    "label": { "type": "string" }
  }
}
```

**Claim:** The procedure tells the operator to add a PR record to `references[]` but does not specify the required `artifactRef` object shape.

**Impact:** A literal scalar like `pr: <url>` or an ad hoc object violates the strict plan schema, causing `validate-state`/dashboard loading failures or making the PR identity ambiguous for later lifecycle steps.

**Recommendation:** Specify the exact schema-valid entry, e.g. `{ kind: "url", path: "<pr-url>", label: "PR #<number>" }`, and state that the PR identity is derived from `path`.

**Confidence:** high

---

### F-003 [major] correctness — skills/shared/project-assets/project-finalize.md:46-48

**Evidence:**
```markdown
- **Use an existing ref** — the user names a branch that already exists
  (e.g. `main`, `develop`, a release branch). Confirm it resolves:
  `git show-ref --verify --quiet refs/heads/<ref>` (or `refs/remotes/origin/<ref>`).
```

```markdown
1. The branch diff against the integration ref:
   `git --no-pager diff <integrationRef>...plan/<slug> --stat`
```

**Claim:** The procedure accepts a remote-tracking branch as resolved, then later uses the bare branch name for the local diff instead of the actual resolved local base ref.

**Impact:** In a normal clone with `origin/main` or `origin/develop` but no local `main`/`develop`, `git diff <integrationRef>...plan/<slug>` can fail during the preview, blocking finalize after the ref was accepted and possibly persisted.

**Recommendation:** Track two values: `integrationRef` for PR base/persistence and `baseRef` for local git commands; set `baseRef` to `refs/heads/<ref>` or `refs/remotes/origin/<ref>` based on the successful resolution check, and use `baseRef` for the diff.

**Confidence:** high

---

### F-004 [major] consistency — meta/catalog.yaml:292-377

**Evidence:**
```yaml
    subcommands:
      - name: status
...
      - name: archive
        group: 'Lifecycle'
        signature: '[<slug>]'
        description: 'Move a finished plan or initiative to archive/ (archiving a plan cascades to its child initiatives)'
        example: '/atomic-skills:project archive v3-redesign'
      - name: switch
        group: 'Lifecycle'
```

**Claim:** The router adds `/atomic-skills:project finalize`, but the machine-readable subcommand catalog has no `finalize` entry.

**Impact:** Generated help/docs and tooling backed by `meta/catalog.yaml` omit the new lifecycle command even though the router accepts it, so users relying on the catalog cannot discover the supported finalize flow.

**Recommendation:** Add a `finalize` subcommand entry to `meta/catalog.yaml` under Lifecycle and update the project `argument_hint` if it is meant to enumerate lifecycle verbs.

**Confidence:** high

## Questions (non-findings)

- skills/shared/project-assets/project-finalize.md:64 — Should `routing.json` be persisted before the operator confirms the publish, or only after the PR is successfully created?

## Out of scope

- `.atomic-skills/focus.json` deletion.
- `.atomic-skills/projects/**/f3-*.md` bookkeeping state.
- `.gitignore` bookkeeping change.
- `skills/shared/project-assets/project-transitions.md` changes, per the external constraint that archive follow-up is outside this review scope.
## Fixes applied in this session

All FINAL codex findings (4 major) + the 3 local findings resolved within T-001 scope
(`skills/shared/project-assets/project-finalize.md` + `meta/catalog.yaml`). `validate-skills`
exit 0, `validate-state` ✓, the T-001/G-1/G-2 verifier re-run exit 0 after fixes.

- **codex F-001 [major] routing.json not schema-validated before resolver** — APPLIED: Step 1 now validates `routing.json` against `meta/schemas/routing.schema.json` (the `npm run validate-state` ajv gate) and ABORTS on parse/schema error before calling `resolveIntegrationRef` (the resolver's contract assumes schema-valid input; a present-but-invalid value would silently default to `develop`).
- **codex F-002 [major] references[] artifactRef shape** — APPLIED (= local L#2): `{ kind: url, path: <pr-url>, label: "PR #<number>" }`; the URL in `path` is the identity.
- **codex F-003 [major] (emerged) baseRef vs integrationRef for local git** — APPLIED: Step 1 documents consuming `scripts/worktree-teardown.js` `resolveBaseRef` → `{ integrationRef, baseRef }` (prefers `origin/<ref>` then `<ref>`); `integrationRef` for `gh pr create --base` + persistence, `baseRef` for local git; Step 2 preview diff now uses `<baseRef>...plan/<slug>` (a clone with only `origin/develop` no longer fails).
- **codex F-004 [major] catalog mirror stale** — APPLIED: added a `finalize` subcommand entry to `meta/catalog.yaml` (Lifecycle group, before `archive`); `npm run generate-docs` regenerated `docs/skills/project.md` + `src/dashboard/data/skills.generated.ts`.
- **codex F-001-blind [critical] shell-injection** — NOT APPLIED (DROPPED in pass2): the doc is executed via a structured argument-vector tool with an operator-named ref passed as a discrete git argument — not externally-controlled untrusted input.
- **codex F-003-blind [major] archive-caller wiring** — NOT APPLIED here (DROPPED in pass2 as out-of-scope): `project-transitions.md` (the archive teardown caller) is owned by the already-closed F2; the real wiring gap is flagged as an OPEN FOLLOW-UP in finalize.md L#1. Recommend a dedicated follow-up task to extend the `archive` call to `isTeardownSafe({ branch, baseRef, integrationRef, prIdentity })`.

## Self-review against code-quality gates

- **G1 read-before-claim**: each fix pasted the real source lines before editing — `scripts/integration-ref.js` docstring (schema-valid-input contract, F-001), `meta/schemas/common.schema.json` `$defs/artifactRef` (F-002), `scripts/worktree-teardown.js:61-120` `resolveBaseRef`/`isTeardownSafe` (F-003/L#1), `meta/catalog.yaml:292-377` subcommands (F-004).
- **G2 soft-language**: fix descriptions and the finalize prose state what each step does/aborts on; scanned for `should`/`probably`/`may`/`typically` — 0 in the applied fixes.
- **G3 anti-tautology in tests**: N/A — no tests added (doc-only task; the deterministic verifier is a grep over genuinely-new strings, non-vacuous).
- **G4 fixture realism**: N/A — no fixtures.
- **G7 anti-premature-abstraction**: no new helper introduced; the `resolveBaseRef`/`resolveIntegrationRef` consumed by the doc already exist (F1/F2).
