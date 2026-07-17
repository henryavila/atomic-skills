---
kind: plan-review
mode: both
provider: codex
model: gpt-5.6-sol
model_source: user-pick
host_family: unknown
sameFamilyRemap: false
plan: docs/plans/installer-hardening-p0-p1.md
date: 2026-07-17T18:16:08Z
verdict: needs_changes
counts_blind: {blocker: 0, critical: 3, major: 4, minor: 0, nit: 0}
counts_final: {blocker: 0, critical: 3, major: 5, minor: 0, nit: 0}
framing_delta: +1 major (emerged F-004 repair mutator undefined)
---

# Plan review: installer-hardening-p0-p1

## Local phase (self-loop) — audit trail

**Iterations:** 2  
**Cross-ref:** internal only  
**Initiatives:** N/A (no phases frontmatter)

### Local findings applied to plan (before external)

| # | Finding | Severity | Action |
|---|---------|----------|--------|
| L1 | Pin bump listed as P2 non-goal while F-001/F-002 need engine | critical | applied — non-goals exception + U/U+C pin work |
| L2 | describeRecovery "if exposed" but already public inspect-only | significant | applied — evidence + inspect-only note |
| L3 | repair CLI "and/or" ambiguous; no force semantics | critical | applied — both flags + fixed semantics |
| L4 | No decision gate U vs C | significant | applied — decision gate table |
| L5 | Double-apply risk consumer workaround + engine | significant | applied — hard rule remove workaround on pin |
| L6 | P1-B legacy→versioned migration unspecified | significant | applied — always versioned schema migrate on write |
| L7 | SIGINT writtenFiles timing imprecise | minor | applied — onFileWritten after installSkills |
| L8 | P0-D scenarios vague | significant | applied — mandatory scenario list |
| L9 | P1-A keep-local vs GREENFIELD ambiguous | significant | applied — default keep-local policy |
| L10 | Soft language "may need upstream" | minor | applied — ordered steps |
| L11 | Engine path-safety path ambiguous | minor | applied — full paths |

## Self-review against code-quality gates (local)

- G1 read-before-claim: post-fix plan cites driver/recovery/install line ranges for F-001–F-009; residual bare problem statements remain narrative (N remaining uncited body sentences acceptable as problem restatement of verified_by blocks).
- G2 soft-language: ban-list grep post-fix; residual "and/or" only in order step (engine and/or consumer) and intentional dual-path language marked with gate.
- G6 reference-or-strike: Evidence blocks use verified_by; pin tag marked unverified until PR.
- Initiative-depth: 0/0 (no phases).

## External phase — Codex Pass 1 (blind)

```
---
verdict: needs_changes
counts: {blocker: 0, critical: 3, major: 4, minor: 0, nit: 0}
reviewer: gpt-5-codex
pass: blind
schema_version: "1.0"
---

## Summary
The plan has three critical correctness gaps: one proposed recovery strategy cannot handle crashes, dropped-effect reversal is not integrated into a crash-recoverable journal transition, and choice C contradicts the recovery success criterion while permitting residual unjournaled mutations.

Additional gaps make Grok shrink unsafe for multiple owners, leave keep-local adoption incompatible with the reconciler, require unavailable metadata during legacy registry migration, and permit path-safety work to exit without symlink verification.

## Findings

### F-001 [critical] viability — docs/plans/installer-hardening-p0-p1.md:98

**Evidence:**
```md
1. **Upstream (choice U or U+C):** after each successful `effect.apply`, append effect to on-disk journal (or staging manifest) so incomplete journal reflects applied ownership. **Alternatively:** real rollback of applied effects on failure before rethrow. Document which alternative the engine PR takes.
```

**Claim:** Apply-time rollback cannot recover an abrupt process termination because no rollback code executes after a crash, power loss, or SIGKILL.

**Impact:** Choice U can satisfy its stated exit gate using the rollback alternative while still leaving disk mutations paired with a stale incomplete journal, blocking subsequent install and uninstall.

**Recommendation:** Remove rollback-only as an accepted F-001 solution; require durable per-effect journaling or staging-and-commit, retain rollback only as supplementary protection, and test abrupt child-process termination after an effect mutates disk.

**Confidence:** high

---

### F-002 [critical] ordering — docs/plans/installer-hardening-p0-p1.md:123-128

**Evidence:**
```md
1. **Prefer upstream Driver (U / U+C):** before replacing journal, `diff(priorEffects, plannedEffects)` and `revert` dropped ids/types (order reverse).
2. **Consumer fallback (C or until pin):**
   - Detect prior auto-update effects (`stageRuntimeArtifacts` / `jsonMerge` for auto-update paths) not in new plan.
   - Explicitly revert those effects (or call the same cleanup helpers the effect `revert` would use).
```

**Claim:** Dropped-effect reversal has no durable journal-transition protocol, so a crash after a revert but before journal replacement leaves the manifest claiming ownership for an effect already removed from disk.

**Impact:** Recovery can replay stale reversals while ignoring newly applied effects, leaving hooks or settings orphaned and making the journal disagree with both the prior and next plans.

**Recommendation:** Specify a crash-resumable transition that records dropped-effect intent, removes each journal entry only after its successful reverse, and resumes safely after every boundary; add fault injection during dropped-effect reversal.

**Confidence:** high

---

### F-003 [critical] contradiction — docs/plans/installer-hardening-p0-p1.md:32-107

**Evidence:**
```md
| 1 | Incomplete install is **recoverable** via CLI without hand-editing JSON | E2E: fail mid-effect → repair/uninstall → clean tree |
```

```md
| **C** — consumer first | Ship repair CLI + auto-update shrink workaround + P0-C without waiting on engine | **Yes** — success criterion 1 is met by a **documented force path** that leaves tree installable/uninstallable; true mid-effect journal accuracy remains incomplete until U |
```

```md
- `uninstall --force-incomplete` — clear incomplete gate, attempt best-effort reverse of **journaled** effects, then delete incomplete marker; document residual risk when disk had unjournaled applies (pre-U).
```

```md
**Exit gate:** incomplete TX → documented CLI path → tree either fully installed or fully reversible under the chosen gate (C accepts residual pre-U journal lag).
```

**Claim:** Choice C declares success criterion 1 satisfied even though its force path cannot reverse unjournaled effects and explicitly accepts residual journal lag.

**Impact:** P0 can be marked green while hooks, files, or settings remain unowned, and deleting the incomplete marker removes the only durable evidence needed for later cleanup.

**Recommendation:** Do not let C satisfy criterion 1 until recovery discovers and reconciles all possible consumer mutations; preserve an incomplete recovery ledger after any failed reverse and require an asserted clean or fully owned baseline before deleting it.

**Confidence:** high

---

### F-004 [major] dependency — docs/plans/installer-hardening-p0-p1.md:146-152

**Evidence:**
```md
1. Before rewriting manifest metadata, compare `priorIdes` vs `nextIdes` (read prior from existing manifest).
2. If prior had `grok` and next does not: `unregisterGrokPluginHost` + `revertGrokAgentsIsolation` (refcount-safe — keep isolation if other installs still list grok).
3. Test: install with grok → reinstall without grok → host unregistered + isolation removed when last grok owner.
```

**Claim:** The refcount rule protects only isolation while `unregisterGrokPluginHost` remains unconditional even though the Grok host registration is global and may still be required by another install.

**Impact:** Shrinking one of several Grok-enabled installations can unregister the shared plugin and break every surviving Grok owner.

**Recommendation:** Gate host unregistration on the same surviving-owner scan as isolation; when another Grok owner remains, keep or restage its registration, and add a two-owner shrink test.

**Confidence:** high

---

### F-005 [major] viability — docs/plans/installer-hardening-p0-p1.md:182-188

**Evidence:**
```md
1. Adopt only if:
   - frontmatter matches atomic-skills safelist (`isAtomicSkillsArtifact` in `src/install.js` / known names), **or**
   - content hash matches last known package hash if available, **or**
   - `--force-adopt` / interactive confirm.
2. Else: **default policy = keep-local without rewrite + log** (do not throw GREENFIELD_CONFLICT for foreign/user content at desired paths during expand). `--force-adopt` opts into reclaim. Document in code comment + test name.
```

**Claim:** The plan does not define how a foreign file can remain at a desired path without adoption while the reconciler still rejects differing unowned desired content with `GREENFIELD_CONFLICT`.

**Impact:** Implementations will either continue throwing, silently omit a desired artifact without reporting installation state accurately, or reintroduce the clobber the phase is intended to prevent.

**Recommendation:** Define an explicit unmanaged-desired disposition that excludes preserved paths from reconciliation, ownership, derived manifest files, and success counts while reporting them as unresolved; test retry and uninstall behavior for that state.

**Confidence:** high

---

### F-006 [major] ambiguity — docs/plans/installer-hardening-p0-p1.md:203-208

**Evidence:**
```md
1. On register: **always** write versioned schema `{ schemaVersion, owners: [{ basePath, packageRoot, version, fingerprint }] }`, including when prior was legacy array (migrate on write).
2. On unregister of last writer of a packageRoot: elect surviving owner (same rules as `runtime-observe`) and restage runtime artifacts from that owner’s packageRoot.
3. Optional: prune ghost owners under lock with explicit status message.
4. Tests: two install bases, uninstall the one that wrote package-root, assert survivor’s package-root active.
```

**Claim:** A legacy registry contains only base paths, so the required per-owner package root, version, and fingerprint cannot be populated accurately without a specified discovery or unknown-owner migration rule.

**Impact:** Migrated owners can receive fabricated or null metadata, after which survivor election may restage from the departing package root or from a nonexistent cache path.

**Recommendation:** Add a migration contract that discovers and validates metadata per legacy owner, marks owners with undiscoverable metadata as non-electable, defines fingerprint computation, and tests mixed legacy/versioned owners.

**Confidence:** high

---

### F-007 [major] coverage — docs/plans/installer-hardening-p0-p1.md:220-227

**Evidence:**
```md
4. Test: atomic rename contract (tmp + rename) and/or no-follow refusal on symlink manifest path if harness allows.

**Exit gate:** no plain `writeFileSync` for install ledger (`.atomic-skills` manifest).
```

**Claim:** The optional “and/or” test permits P1-C to exit after testing atomic rename without verifying the required no-follow behavior.

**Impact:** A manifest writer that is atomic but follows a leaf or intermediate symlink can pass the phase while writing the ownership ledger outside the install base.

**Recommendation:** Require separate mandatory tests for atomic replacement and refusal of both leaf and intermediate symlinks before P1-C exits.

**Confidence:** high

## Questions (non-findings)

- None.

## Out of scope

- P2 findings F-010–F-014 and audit backlog items 11–16.
- Skill catalog or modules redesign.
- Product skill-set and README marketing changes.
- Unrelated dependency version bumps.
```

## External phase — Codex Pass 2 (informed)

```
---
verdict: needs_changes
counts: {blocker: 0, critical: 3, major: 5, minor: 0, nit: 0}
reviewer: gpt-5-codex
pass: informed
schema_version: "1.0"
---

## Summary

The plan still permits two recovery designs that do not survive abrupt termination and lets choice C satisfy a clean-recovery criterion while knowingly leaving unjournaled mutations. The dropped-effect design also lacks a crash-safe transition between prior and replacement journals.

Five major gaps remain: `install --repair` has no defined mutating recovery operation, Grok cleanup can break surviving owners, keep-local adoption conflicts with reconciler behavior, legacy registry migration lacks required metadata, and manifest no-follow verification is optional.

## Findings

### F-001 [critical] viability — docs/plans/installer-hardening-p0-p1.md:98

**Evidence:**
```md
1. **Upstream (choice U or U+C):** after each successful `effect.apply`, append effect to on-disk journal (or staging manifest) so incomplete journal reflects applied ownership. **Alternatively:** real rollback of applied effects on failure before rethrow. Document which alternative the engine PR takes.
```

**Claim:** Rollback-only cannot recover abrupt process termination because rollback code does not execute after SIGKILL, power loss, or a runtime crash.

**Impact:** Choice U can pass its stated gate while disk mutations remain paired with a stale incomplete journal, causing both normal install and uninstall to remain blocked.

**Recommendation:** Require durable per-effect journaling or staging-and-commit for F-001; retain rollback only as supplementary protection and test abrupt child-process termination after a disk mutation.

**Confidence:** high

---

### F-002 [critical] ordering — docs/plans/installer-hardening-p0-p1.md:123-128

**Evidence:**
```md
1. **Prefer upstream Driver (U / U+C):** before replacing journal, `diff(priorEffects, plannedEffects)` and `revert` dropped ids/types (order reverse).
2. **Consumer fallback (C or until pin):**
   - Detect prior auto-update effects (`stageRuntimeArtifacts` / `jsonMerge` for auto-update paths) not in new plan.
   - Explicitly revert those effects (or call the same cleanup helpers the effect `revert` would use).
```

**Claim:** Dropped-effect reversal is not incorporated into a durable journal transition, so interruption between a revert and journal replacement can leave the journal describing effects no longer present on disk.

**Impact:** Recovery or uninstall can repeat stale reversals, omit newly applied effects, or commit a journal that represents neither the prior nor next installation state.

**Recommendation:** Specify one crash-resumable transition that records dropped-effect intent, persists progress after each successful reverse, and safely resumes at every boundary; add fault injection during dropped-effect reversal.

**Confidence:** high

---

### F-003 [critical] contradiction — docs/plans/installer-hardening-p0-p1.md:32-107

**Evidence:**
```md
| 1 | Incomplete install is **recoverable** via CLI without hand-editing JSON | E2E: fail mid-effect → repair/uninstall → clean tree |
```

```md
| **C** — consumer first | Ship repair CLI + auto-update shrink workaround + P0-C without waiting on engine | **Yes** — success criterion 1 is met by a **documented force path** that leaves tree installable/uninstallable; true mid-effect journal accuracy remains incomplete until U |
```

```md
- `uninstall --force-incomplete` — clear incomplete gate, attempt best-effort reverse of **journaled** effects, then delete incomplete marker; document residual risk when disk had unjournaled applies (pre-U).
```

```md
**Exit gate:** incomplete TX → documented CLI path → tree either fully installed or fully reversible under the chosen gate (C accepts residual pre-U journal lag).
```

**Claim:** Choice C declares clean CLI recovery achieved even though its force path cannot identify or reverse unjournaled effects and then deletes the incomplete marker.

**Impact:** P0 can be marked green with orphaned hooks, files, or settings, while removal of the marker destroys the durable evidence that the tree still needs recovery and violates install/uninstall mutation parity.

**Recommendation:** Prevent C from satisfying criterion 1 until the consumer discovers and reconciles every possible mutation; retain an incomplete recovery ledger after any residual or failed reversal and require an asserted clean or fully owned state before deleting it.

**Confidence:** high

---

### F-004 [major] dependency — docs/plans/installer-hardening-p0-p1.md:101-102

**Evidence:**
```md
- `install --repair` — when incomplete: print `describeRecovery` summary (effectCount, state, reason); if journal is trusted post-U pin, resume/complete or re-run install; if pre-U (stale prior journal), refuse silent resume and instruct `uninstall --force-incomplete`.
```

```md
- `describeRecovery` is already exported and is inspect-only; repair mutation is consumer-owned until engine gains resume APIs.
```

**Claim:** The plan requires `install --repair` to resume or re-run an incomplete install but defines no consumer mutation that can transition the journal past `assertNoIncompleteTransaction`, while the available recovery API is read-only.

**Impact:** Implementers must invent incompatible marker-clearing or completion semantics, and a nominal repair command may remain unable to invoke the normal install path or may mark an unvalidated partial journal complete.

**Recommendation:** Add a task defining a locked, atomic consumer recovery transition, including journal validation, state changes before re-run, failure preservation, and tests for interruption during repair.

**Confidence:** high

---

### F-005 [major] dependency — docs/plans/installer-hardening-p0-p1.md:148-150

**Evidence:**
```md
1. Before rewriting manifest metadata, compare `priorIdes` vs `nextIdes` (read prior from existing manifest).
2. If prior had `grok` and next does not: `unregisterGrokPluginHost` + `revertGrokAgentsIsolation` (refcount-safe — keep isolation if other installs still list grok).
3. Test: install with grok → reinstall without grok → host unregistered + isolation removed when last grok owner.
```

**Claim:** The surviving-owner check protects only isolation while host-plugin unregistration remains unconditional even though that registration is shared by multiple installations.

**Impact:** Shrinking one Grok-enabled installation can unregister the global plugin and break every surviving Grok owner.

**Recommendation:** Gate host unregistration on the surviving-owner scan, restage registration from the elected survivor when required, and add a two-owner shrink test.

**Confidence:** high

---

### F-006 [major] viability — docs/plans/installer-hardening-p0-p1.md:182-188

**Evidence:**
```md
1. Adopt only if:
   - frontmatter matches atomic-skills safelist (`isAtomicSkillsArtifact` in `src/install.js` / known names), **or**
   - content hash matches last known package hash if available, **or**
   - `--force-adopt` / interactive confirm.
2. Else: **default policy = keep-local without rewrite + log** (do not throw GREENFIELD_CONFLICT for foreign/user content at desired paths during expand). `--force-adopt` opts into reclaim. Document in code comment + test name.
```

**Claim:** The plan does not define how foreign content can remain unowned at a desired path while the reconciler still treats differing unowned desired content as `GREENFIELD_CONFLICT`.

**Impact:** Implementations will either continue throwing, report a successful installation while silently omitting an artifact, or reintroduce the prohibited clobber.

**Recommendation:** Define an unmanaged-desired disposition that excludes preserved paths from reconciliation, ownership, manifest file sets, and success counts while reporting them as unresolved; test retry and uninstall behavior.

**Confidence:** high

---

### F-007 [major] ambiguity — docs/plans/installer-hardening-p0-p1.md:196-208

**Evidence:**
```md
**Problem:** `package-root` last-writer-wins; `registerInstall` writes bare paths / new owners as `{ basePath }` only; observe reads versioned fields that writers never set; uninstall reclaim does not restage surviving owner.
```

```md
1. On register: **always** write versioned schema `{ schemaVersion, owners: [{ basePath, packageRoot, version, fingerprint }] }`, including when prior was legacy array (migrate on write).
2. On unregister of last writer of a packageRoot: elect surviving owner (same rules as `runtime-observe`) and restage runtime artifacts from that owner’s packageRoot.
```

**Claim:** Legacy registry entries contain only base paths, but the migration requires package root, version, and fingerprint without defining how those values are discovered or represented when unavailable.

**Impact:** Migration can fabricate or omit election metadata, causing uninstall to select a ghost owner or restage runtime artifacts from a nonexistent or departing package root.

**Recommendation:** Define per-owner metadata discovery and validation, fingerprint computation, and a non-electable representation for owners whose metadata cannot be recovered; test mixed legacy and versioned registries.

**Confidence:** high

---

### F-008 [major] coverage — docs/plans/installer-hardening-p0-p1.md:214-227

**Evidence:**
```md
### P1-C — Single atomic/no-follow manifest writer (F-006)
```

```md
4. Test: atomic rename contract (tmp + rename) and/or no-follow refusal on symlink manifest path if harness allows.

**Exit gate:** no plain `writeFileSync` for install ledger (`.atomic-skills` manifest).
```

**Claim:** The optional “and/or” test and “if harness allows” qualifier permit P1-C to exit without verifying the required no-follow behavior.

**Impact:** An atomic writer that follows a leaf or intermediate symlink can pass the phase while writing the ownership ledger outside the installation base.

**Recommendation:** Make separate tests for atomic replacement and refusal of leaf and intermediate manifest-path symlinks mandatory before P1-C exits.

**Confidence:** high

## Questions (non-findings)

- None.

## Out of scope

- P2 findings F-010–F-014 and audit backlog items 11–16.
- Skill catalog or modules redesign.
- Product skill-set and README marketing changes.
- Unrelated dependency version bumps.
- Full upstream installer rewrite beyond the F-001/F-002 kernel changes.

## Pass 2 reconciliation

### Dropped from blind pass

- _(none)_

### Maintained

- F-001-blind → F-001-final [critical] — same
- F-002-blind → F-002-final [critical] — same
- F-003-blind → F-003-final [critical] — same
- F-004-blind → F-005-final [major] — same
- F-005-blind → F-006-final [major] — same
- F-006-blind → F-007-final [major] — same
- F-007-blind → F-008-final [major] — same

### Emerged

- F-004-final [major] dependency — emerged: the verified recovery-API constraint establishes that `describeRecovery` cannot mutate state and `assertNoIncompleteTransaction` blocks the unspecified re-run path.
```

## Framing Δ

- Blind: 0B / 3C / 4M / 0m / 0n
- Final: 0B / 3C / 5M / 0m / 0n
- Δ: +1 major emerged (repair mutator undefined given read-only describeRecovery)
- All 3 critical maintained


## Triage (human)

| ID | Severity | Decision | Notes |
|----|----------|----------|-------|
| F-001 | critical | applied | ban rollback-only; durable journal required |
| F-002 | critical | applied | crash-resumable drop transition + fault test |
| F-003 | critical | applied | C does not satisfy criterion 1 |
| F-004 | major | recorded | repair mutator undefined — implement session |
| F-005 | major | recorded | Grok host multi-owner unregister |
| F-006 | major | recorded | unmanaged-desired disposition |
| F-007 | major | recorded | legacy registry metadata migration |
| F-008 | major | recorded | P1-C mandatory no-follow tests |

**Post-triage status:** criticals resolved in plan; majors remain for next implement session.
**Final external verdict after apply:** needs_changes (majors open) → plan usable with caveats.
