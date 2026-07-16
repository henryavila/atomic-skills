# Review — integrity-remediation F0
**Date:** 2026-07-16
**Mode:** local adversarial (external subagent)
**Scope:** F0 runtime closure + materialize bootstrap
**Branch:** `plan/integrity-remediation` vs `origin/develop` (tip includes `bf1de6b` T-005 + prior T-001..T-004)
**Verdict:** PASS_WITH_FINDINGS

## Summary

F0 delivers the intended architectural spine: package-root entrypoints (`runtime-paths.js` + script CLIs), install-time asset closure with collision hard-fail, structural setup sentinel text (ledger ≠ configured), packed-consumer E2E for entrypoints/normalize/closure, and a recoverable two-rename materialize primitive with durable marker digests.

Adversarial re-check finds **no critical fail-open that clobbers foreign bytes**, but three **major** gaps where the gate narrative over-claims green: (1) the load-bearing “staging lost after initiative rename” recovery branch is implemented and works in a manual probe yet is **absent from the fault matrix tests**, (2) F0-G1 claims transactional bootstrap “em consumidor sem checkout fonte” while `materialize-state` is only exercised against the source tree, and (3) staged-pair validation accepts initiatives that never bind to a plan phase when `phaseId` is omitted. Minors cover non-atomic restore writes, string-only setup enforcement, and empty `package-root` fail-open.

## Findings

### F-001 [major] testing — `tests/phase-materialization/materialize-bootstrap.test.js` / `scripts/materialize-state.js:196-218`

**Claim:** The fault matrix does not cover the recovery branch that runs when the initiative is already at `after`, the plan is still at `before`, and **plan staging has been deleted**. That branch is the one that must either complete from staging, restore the before-pair (including unlinking a newly published initiative when `before === null`), or fail closed.

**Evidence:**
- Suite injects faults for: invalid pair, happy path, after-initiative (staging present → retry completes), after-plan (cleanup), ambiguous external hash, staging lost **before any rename**, idempotent success, exists-guard.
- Code path for staging-lost **after** initiative rename:

```196:218:scripts/materialize-state.js
  if (initState === 'after' && planState === 'before') {
    if (stagePlan && existsSync(stagePlan)) {
      // ... complete plan rename — covered by “fault after initiative” retry
    }
    // Staging lost mid-flight after initiative rename: restore prior pair if backups exist.
    if (restoreBeforePair({ planAbs, initAbs, beforePlan, beforeInit, marker })) {
      cleanupTx(absMarker, marker);
      return { ok: true, status: 'restored-before', marker };
    }
    throw new Error(
      `materialize recovery fail closed: plan staging lost after initiative rename `
      + `and before-pair backup unavailable (marker ${absMarker})`,
    );
  }
```

- Manual probe (external reviewer): after `afterInitiativeRename` deletes `plan.md.materialize-stage`, `recoverMaterialize` correctly returns `restored-before`, drops initiative, keeps plan at before. **Behavior is good; the gate’s “fault injection after each rename” claim is incomplete.**

**Impact:** A regression that breaks restore-before after a mid-flight staging wipe (disk cleanup, antivirus, operator `rm`, partial FS) can ship while F0-G1 / T-005 verifiers stay green. This is exactly the incomplete-recovery window F0 was brought forward to close.

**Recommendation:** Add an explicit test: fault after initiative rename → delete plan staging (+ optionally initiative staging residue) → `recoverMaterialize` / `materializePair` retry asserts `restored-before` or complete-from-staging as appropriate, plus a fail-closed case when before-backup is also missing. Do not mark T-005 fault matrix complete until this branch is asserted.

---

### F-002 [major] false-green / gate — F0-G1 vs packed consumer coverage

**Claim:** F0-G1 states that SPEC admission, runtime closure, package-root resolution, **and transactional F0→F4 bootstrap** pass **in a consumer without source checkout**. The verifier bundle mixes packed E2E with source-tree materialize tests, so the transactional half is not proven under the same isolation constraints as T-004.

**Evidence:**
- Gate text (`f0-runtime-autocontido-e-setup-confiavel.md`):

  > Admissão SPEC, runtime closure, resolução por package root e bootstrap transacional F0→F4 passam em consumidor sem checkout fonte.

- Verifier runs:
  - `tests/consumer-install-e2e.test.js` — real `npm pack` + install; exercises decompose / bootstrap / plan-dependencies / normalize / validate-state / validate-runtime-closure. **Does not import or CLI-invoke `scripts/materialize-state.js`.** Absolute-path leak checklist omits `scripts/materialize-state.js`.
  - `tests/phase-materialization/materialize-bootstrap.test.js` and `e2e-lifecycle.test.js` — import `materializePair` from the **source tree** under the monorepo checkout.
  - `tests/consumer-runtime-resolution.test.js` — points `~/.atomic-skills/package-root` at `PACKAGE_ROOT` (the source checkout), so it proves cwd-independence, not tarball isolation.
- `npm pack` **does** include `scripts/materialize-state.js` (`files: ["scripts/", ...]`), so shipping is fine; **execution proof in the packed consumer is missing.**

**Impact:** A packaging/runtime regression unique to the installed layout (missing transitive import, `validate-state` path resolution, shebang/CLI `isMain` mismatch, workspace-relative assumptions) can leave materialize broken for real consumers while F0-G1 stays green.

**Recommendation:** Extend packed consumer E2E (or a sibling test) to: install tgz → write staged plan/initiative content under the consumer → invoke `$packageRoot/scripts/materialize-state.js` (and ideally one fault+recover cycle) with `cwd` = consumer and `HOME` = fake home whose `package-root` is the extracted package. Keep source-tree unit tests for the full fault matrix; use the packed path as the isolation proof.

---

### F-003 [major] validation — `scripts/materialize-state.js` `validateStagedPair`

**Claim:** The “single authority” pre-publish validator accepts an initiative that never names a plan phase, as long as a free-form `slug` is present. That allows publishing an unbound initiative file next to a plan activation as long as the agent supplies the wrong content.

**Evidence:**

```71:95:scripts/materialize-state.js
export function validateStagedPair(planContent, initiativeContent) {
  // ...
  const phaseId = initFm.phaseId ?? null;
  if (!phaseId && !initFm.slug) {
    throw new Error('invalid staged initiative: missing phaseId/slug');
  }
  if (phaseId) {
    const match = planFm.phases.find((p) => p && p.id === phaseId);
    if (!match) {
      throw new Error(`invalid staged pair: plan has no phase ${phaseId}`);
    }
  }
  return { planFm, initFm };
}
```

Manual probe: plan with phases `F0`/`F1` + initiative `{ slug: 'totally-wrong-phase' }` (no `phaseId`) → **accepted**. `phaseId: 'F9'` correctly rejected.

Skill contract (`project-materialize.md`) still relies on post-publish `find-missing-business-intent` + `validate-state` for semantic gates; the primitive itself does not require `phaseId`, `parentPlan`, or `businessIntent`.

**Impact:** An agent or CLI misuse can commit a durable marker and renames for a pair that is structurally coherent as markdown but **not** a plan↔phase pair. Recovery will faithfully converge to that wrong pair. Weakens “validate the staged pair before marker publish” relative to T-005 acceptance that validate-state never sees inconsistent F4 activation (post-hoc detectors are a second, optional hop).

**Recommendation:** Require `phaseId` (not slug alone) and assert membership in `plan.phases[]`. Prefer also requiring `parentPlan === plan.slug` when both are present. Leave full schema/`businessIntent` to `validate-state` if desired, but do not allow phase-unbound initiatives through the atomic publish path.

---

### F-004 [minor] durability — `restoreOneSide` non-atomic restore

**Claim:** Recovery restore of the before-pair uses `writeFileSync` of the full before-backup over the live path, not a same-dir `rename` of a staged restore blob. A crash mid-write can leave a truncated live file whose hash is neither before nor after → subsequent recovery fail-closed (safe) but **operator-unrecoverable without manual marker surgery**.

**Evidence:**

```262:282:scripts/materialize-state.js
function restoreOneSide(liveAbs, beforeBackup, beforeHash, afterHash) {
  // ...
  if (beforeBackup && existsSync(beforeBackup)
    && sha256(readFileSync(beforeBackup)) === beforeHash) {
    ensureDir(liveAbs);
    writeFileSync(liveAbs, readFileSync(beforeBackup));
    return liveHash(liveAbs) === beforeHash;
  }
  return false;
}
```

Publish path correctly uses `renameSync` for live mutation; restore path does not.

**Impact:** Rare crash during restore leaves ambiguous live bytes; fail-closed preserves safety but increases ops burden. In scope for F4 hardening if not fixed in F0 follow-up.

**Recommendation:** Write restore content to `*.materialize-restore-stage`, fsync, `renameSync` over live (same pattern as publish). Optionally fsync parent dir after renames where the platform allows.

---

### F-005 [minor] false-green — F0-G2 setup sentinel is prose-only

**Claim:** F0-G2 (“project-scope install does not mask missing setup”) is enforced by **markdown contracts + regex tests**, not by an executable classifier. The installer still creates ledger-only `.atomic-skills/` (`manifest.json`, hooks); whether setup runs depends on the agent obeying the router.

**Evidence:**
- `tests/project.test.js` / `install-uninstall-roundtrip.test.js` assert router/setup assets match patterns (`manifest.json` ledger, `PROJECT-STATUS.md` / nested `plan.md` sentinel, no `test -d .atomic-skills/`).
- Round-trip “ledger-only tree that the installed router sends to setup” only greps the installed `project.md` body; it never classifies a live tree via shared code.
- No `isProjectConfigured()` (or equivalent) used by CLIs/hooks.

**Impact:** Consistent with skill-router architecture; residual agent skip remains. A future edit that preserves keywords while weakening procedure can keep tests green. Acceptable residual for F0 **if** F2/F4 add machine-checked preflight for mutating verbs.

**Recommendation:** Extract a tiny pure function + CLI used by `project` mutating paths (or hooks) that returns `configured | legacy | setup-required` from the filesystem, and unit-test it against ledger-only fixtures. Keep skill text as UX; make the gate executable.

---

### F-006 [minor] fail-open — empty / stale `package-root` in skill invocation pattern

**Claim:** Materialize and other skills resolve the package via  
`$(cat "$HOME/.atomic-skills/package-root" 2>/dev/null || echo .)`. An **empty** `package-root` file (exists, zero/whitespace content) does not trigger `|| echo .`; resolution becomes `node "/scripts/..."` or a cwd-relative empty prefix — silent wrong root rather than hard fail. Stale path to an uninstalled package similarly fails late.

**Evidence:** Established pattern in `skill-script-resolution.test.js` (documented as dev convenience). Reused for the new atomic publish command in `project-materialize.md`. Manual probe: empty file + `trim()||'.'` pattern shows the hazard; raw bash `$(cat … || echo .)` is worse for empty files.

**Impact:** Consumer without a successful install marker falls back toward cwd semantics — the class of bug F0 T-001 set out to eliminate — under edge marker corruption.

**Recommendation:** Prefer a single helper (`scripts/resolve-package-root.js` or shell function) that: requires non-empty path, `test -d "$root/scripts"`, else exit non-zero with “run atomic-skills install”. Use it from materialize skill copy-paste and gradually migrate other skills (can be F2 observability work).

---

### F-007 [nit] testing — `implement-ready-contract` is decompose + skill prose only

**Claim:** T-001 “driver admits outputs[].path without Files” is proven by `decomposePlan` output shape + regex on `skills/core/implement.md`, not by a shared admission module. Appropriate for an LLM skill executor; weak if a future code driver reintroduces `Files`.

**Recommendation:** If/when implement admission is code-backed, share one fixture between skill docs and the driver. Until then, keep the prose contract test.

---

### F-008 [nit] completeness — always-install shared assets

**Claim:** `collectSharedAssetSources` installs **all** standalone helpers and all `*-assets/**` trees regardless of whether the owning core skill/module is selected (behavioral change from owner-gated install). Intentional for “closed lazy graph,” but increases install surface and collision surface across optional modules.

**Recommendation:** Document as intentional in installer docs; keep collision tests. Optional later: install only assets reachable from the rendered file-set (true dependency closure) if payload size becomes an issue.

## Residual risks

- **No file lock / single marker per plan path** — concurrent `materializePair` on the same plan shares `plan.md.materialize-tx.json` and staging suffixes; last writer wins. Acceptable for F0 single-threaded agent use; needs F4 concurrency story.
- **fsync best-effort** — `writeFileDurable` swallows fsync errors; marker may not be durable on exotic FS before first rename.
- **Mid-window initiative-without-active-plan** — initiative-first order correctly forbids “active without initiative”; inverse (initiative present, plan still pending) is visible to any concurrent `validate-state` for a short window. Documented order; not a bug.
- **Agent non-compliance** with setup sentinel and materialize skill steps remains the dominant operational risk until machine preflight exists.
- **Grok foreign-skills isolation** changes on this branch are adjacent (not F0 core); not re-audited here beyond noting they are out of F0 gate scope.

## What looks solid (adversarial credit)

- Package-owned `resolvePackagePath` / `isDirectExecution` entrypoints avoid consumer `src/` shadowing; normalize sentinel E2E is convincing.
- Asset collision hard-fail + source-tree reference stripping + `validate-runtime-closure` over all public IDE×scope combos is the right shape for T-002.
- Materialize publish order (initiative → plan), durable marker **before** first rename, ambiguous-hash fail-closed, and exists-guard **after** recovery are correctly ordered.
- F0-G2 skill text correctly demotes installer ledger/hooks from “configured.”
- e2e-lifecycle no longer writes F1 `active` live before the initiative exists; it routes through `materializePair` with an observational mid-hook.

## Gate check

- **F0-G1:** **Met with caveats.** Packed consumer proves entrypoints, normalize isolation, and runtime closure; materialize fault/happy paths are strong in-source but **not** packed-consumer proven (F-002). Recovery matrix incomplete for staging-lost-after-initiative (F-001). Staged-pair validator weaker than narrative (F-003). Do not treat G1 as full black-box isolation of the transactional bootstrap.
- **F0-G2:** **Met as specified (prose + install residue tests).** Ledger-only install leaves no `PROJECT-STATUS.md` / nested plans; router/setup text forbids treating ledger as configured. Residual: enforcement is agent-mediated (F-005).

## Verdict rationale

No critical clobber/fail-open found in the materialize ownership model or install asset projection. Three majors are **coverage and validation completeness**, not “delete user data” defects. Per review rules: **PASS_WITH_FINDINGS** (not FAIL). Recommend fixing F-001 and F-003 before relying on this primitive for production F4 materialization; F-002 before claiming F0-G1 isolation for the full bootstrap surface.
