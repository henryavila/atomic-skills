# Review: Remove installer modules concept

- **Provider:** codex
- **Model:** gpt-5-codex
- **Mode:** codex (sealed envelope, allow-dirty)
- **Artifact:** plan.md (session plan)
- **Verdict:** needs_changes
- **Counts (final):** blocker 0, critical 0, major 5, minor 0, nit 0
- **Pass1:** /tmp/cross-model-output-pass1-codex-20260717133904.md
- **Pass2:** /tmp/cross-model-output-pass2-codex-20260717133904.md

---
verdict: needs_changes
counts: {blocker: 0, critical: 0, major: 5, minor: 0, nit: 0}
reviewer: gpt-5-codex
pass: informed
schema_version: "1.0"
---

## Summary
The plan still has ordering and migration risks that can break installs, validation, or uninstall parity during implementation. The revealed constraints make the Phase 1 ordering problem concrete: the working tree is already in the broken intermediate state the plan permits, with `skills/modules` gone while installer code still references `module.yaml`.

The plan also underspecifies validation enforcement, omits live memory-note verification despite requiring it, and does not explicitly preserve install/uninstall parity after promoting `init-memory` and `memory-assets` to always-installed surfaces.

## Findings

### F-001 [major] ordering — plan.md:170-184

**Evidence:**
```md
### Phase 1 — Move skill + assets (no behavior flip yet optional; prefer atomic)

1. Move `skills/modules/memory/init-memory.md` → `skills/core/init-memory.md`.
2. Move `skills/modules/memory/_assets/connect.md` → `skills/shared/memory-assets/connect.md`.
3. Update body pointers to `{{ASSETS_PATH}}/connect.md` (or `skills/shared/memory-assets/…` so render normalizes).
4. Catalog: cut `modules.memory.init-memory` → `core.init-memory`; delete rest of `modules:` + entire `module_meta:`.
5. Delete `skills/modules/**` (all three dirs + yaml).

### Phase 2 — Installer / render / UI

1. **`skills-file-set.js`**: drop `modules`; always `vars.memory_path = '.ai/memory/'`; remove module skill loop; drop `moduleFlags`.
2. **`render.js`**: remove `modules` arg; only `ide` conditionals.
3. **Skill bodies**: unwrap 4 `{{#if modules.memory}}` sites.
4. **`install.js`**: remove modules load/default/`moduleYaml`/`customize-modules`/`modules` on manifest; known-names from `core` only.
```

**Claim:** Phase 1 deletes `skills/modules/**` before Phase 2 removes installer reads of `moduleYaml`, so the phase boundary leaves the installer referencing files that no longer exist.

**Impact:** The current partially applied worktree can fail install or test paths because `skills/modules` is deleted while `src/install.js` still references `module.yaml`; the suggested commit split can therefore land a non-runnable intermediate state.

**Recommendation:** Make the Phase 1/Phase 2 installer removal atomic, or defer deleting `skills/modules/memory/module.yaml` until every installer path that reads module YAML has been removed.

**Confidence:** high

---

### F-002 [major] migration — plan.md:138-140

**Evidence:**
```md
- No `modules` in installer config or CLI.
- Manifest **stops writing** `modules` (old field on existing installs ignored if present).
- `memory_path` **hardcoded** constant: `.ai/memory/` (no custom-path UI).
```

**Claim:** The plan removes the only persisted source of a custom `memory_path` without any migration, warning, or pointer creation for existing installs.

**Impact:** Users with memory stored outside `.ai/memory/` will reinstall into skills that now reference `.ai/memory/`, causing existing memory notes to become undiscoverable from the installed skill flow.

**Recommendation:** Add a migration task before dropping `manifest.modules`: read old `modules.memory.config.memory_path`, and if it differs from `.ai/memory/`, create a pointer/migration note or emit a blocking warning with the old path.

**Confidence:** high

---

### F-003 [major] ambiguity — plan.md:160-164

**Evidence:**
```md
### Validation

- Drop `validateModuleMeta` / `requireModuleMeta`.
- `collectSkills` / `discoverBodySkills` / `bodyPathForSkill` → core-only.
- Reject leftover `modules:` / `module_meta:` keys? Optional hard fail if present (prevents regression). Prefer: ignore unknown top-level keys OR fail if `modules` present — **fail if present** is cleaner for "concept removed."
```

**Claim:** Validation behavior for removed `modules:` and `module_meta:` keys is contradictory because it labels rejection optional while also preferring a hard fail.

**Impact:** One implementation can silently ignore stale module catalog keys while another rejects them, leaving CI behavior and regression prevention undefined.

**Recommendation:** Make this non-optional: `validate-skills` must fail if `modules` or `module_meta` exists, and tests must cover both keys.

**Confidence:** high

---

### F-004 [major] coverage — plan.md:13-14

**Evidence:**
```md
Historical plans/specs under `docs/superpowers/`, `docs/plan-*.md`, audits stay as-is (frozen history). Live contracts, code, tests, README, KB, memory notes get updated.
```

**Claim:** The plan requires memory notes to be updated, but the implementation tasks and grep gate do not cover `.ai/memory/` broadly.

**Impact:** Live agent guidance can continue to mention `modules`, `module_meta`, or `skills/modules`, causing future scaffolding or maintenance work to reintroduce the removed concept.

**Recommendation:** Add `.ai/memory/**` to the Phase 5 grep gate, then explicitly update or allowlist every live memory note that still references the removed module concept.

**Confidence:** medium

---

### F-005 [major] coverage — plan.md:270-272

**Evidence:**
```md
2. **Roundtrip / blackbox** already auto-enable memory on first install; after change they stay similar but without reading `module.yaml`.
3. **Dual API footprint** today (`installSkills({ modules: {} })` vs full CLI) collapses to one.
4. **connect.md** must move under `shared/*-assets/` or it remains uninstalled source-only.
```

**Claim:** The plan does not specify install/uninstall parity updates for the newly always-installed `init-memory` skill and `memory-assets` files.

**Impact:** The install/uninstall roundtrip suite can fail, or worse, uninstall can leave promoted memory artifacts behind because the persistent install file set changed without an explicit reversal update or allowlist entry.

**Recommendation:** Add a Phase 4 task that verifies the exact installed paths for `core/init-memory.md` and `shared/memory-assets/connect.md` are removed on uninstall, and update the roundtrip expectations or allowlist only if a persistent artifact is intentionally retained.

**Confidence:** high

## Questions (non-findings)

- plan.md:146 — Should `memory_path` default injection live inside `renderTemplate` itself or only in file-set providers?

## Out of scope

- Historical docs under `docs/superpowers/`, `docs/plan-*.md`, and audits
- Version bump / npm publish
- Renaming `skills/shared/codex-bridge-assets/`

## Pass 2 reconciliation

### Dropped from blind pass

- _(none)_

### Maintained

- F-001-blind → F-001-final [major] — same
- F-002-blind → F-002-final [major] — same
- F-003-blind → F-003-final [major] — same
- F-004-blind → F-004-final [major] — same

### Emerged

- F-005-final [major] coverage — emerged: the install/uninstall parity HARD RULE requires every persistent install mutation to reverse on uninstall or be allowlisted, and the plan changes the installed file set without an explicit parity task.