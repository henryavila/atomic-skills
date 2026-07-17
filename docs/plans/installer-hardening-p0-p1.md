# Plan: Installer hardening — P0 + P1

**Status:** ready for next session (local review-plan fixes applied 2026-07-17)  
**Created:** 2026-07-17  
**Audit source (canonical findings):** [docs/audits/installer-audit-2026-07-17.md](../audits/installer-audit-2026-07-17.md)  
**Prior audit:** [docs/audits/installer-audit-2026-07-10.md](../audits/installer-audit-2026-07-10.md)  
**Related commits (context):**
- `758b42c` — remove installer modules concept
- `131a345` — adopt unowned desired files (GREENFIELD_CONFLICT)

## Goal

Make install/update/uninstall **reliable under partial failure, IDE shrink/expand, and multi-owner runtime** — the failure classes that keep biting operators after the happy path was fixed.

## Non-goals

- P2 backlog from the audit (F-010–F-014) — track only; do not implement in this plan
- Redesign of skill catalog / modules (done)
- Changing product skill set or README marketing copy
- Full rewrite of minimalist-installer (upstream only where F-001/F-002 require kernel)
- **Exception (in-scope when upstream lands):** bumping the consumer pin of
  `@henryavila/minimalist-installer` (today: git commit in `package.json`) **is
  required** to consume F-001/F-002 kernel fixes. That pin bump is **not** P2 —
  it is part of P0-A / P0-B exit when the chosen path is upstream. P2 “npm
  version bump” elsewhere in the audit means unrelated package churn, not this
  pin.

## Success criteria

| # | Criterion | How verified |
|---|-----------|--------------|
| 1 | Incomplete install is **recoverable** via CLI without hand-editing JSON | E2E: fail mid-effect → repair/uninstall → clean tree |
| 2 | IDE shrink removes auto-update hooks/settings for deselected hosts | claude→codex and claude+grok→cursor tests green |
| 3 | Removing Grok from ides cleans host plugin + isolation (refcount-safe) | install grok → reinstall without grok asserts |
| 4 | Adopt does not silent-clobber user/foreign content without policy | safelist or prompt/force tests |
| 5 | Registry writes versioned owners; last-writer leave restages survivor | multi-owner unit + e2e |
| 6 | Manifest + stageRuntimeArtifacts honor path-safety contract | unit + symlink tests |
| 7 | Interactive SIGINT is honest (no fake cleanup / no reentrancy) | unit or hook test |
| 8 | Interactive and `--yes` use the same runtime publish+register path | code + test parity |

---

## Decision gate (do this before coding P0-A / P0-B)

Record the choice in the plan session notes (one of):

| Choice | Meaning | Accepts partial success? |
|--------|---------|--------------------------|
| **U** — upstream first | Open/land minimalist-installer PR for **durable per-effect journaling or staging-and-commit** (F-001; rollback-only is **not** sufficient) **and** crash-resumable drop-effect revert (F-002); then **pin-bump** consumer | No — ship only when pin includes both engine fixes |
| **C** — consumer first | Ship repair CLI + auto-update shrink workaround + P0-C without waiting on engine | **Partial only** — does **not** satisfy success criterion 1. C may ship operator messaging + force path, but criterion 1 / P0 green require U (or residual ledger that asserts clean/owned baseline — see P0-A) |
| **U+C** — dual | Consumer CLI + workaround land first; engine PR in parallel; pin-bump when green | Criterion 1 satisfied only after pin (U half). C half is interim operator UX, not green bar for #1 |

**Hard rule:** do not ship both consumer auto-update shrink workaround **and** engine drop-effect revert without a single ownership story (engine wins; remove consumer workaround in the same pin-bump PR).

---

## Phase map

```
P0-A  Incomplete TX recovery          [F-001]  both (engine + consumer)
P0-B  Revert dropped plan effects     [F-002]  both (prefer engine)
P0-C  Grok shrink cleanup             [F-003]  atomic-skills
P0-D  E2E fault matrix on full path   [tests]  atomic-skills
P1-A  Harden adopt                    [F-004]  atomic-skills
P1-B  Versioned registry + restage    [F-005]  atomic-skills
P1-C  Single atomic manifest writer   [F-006]  atomic-skills
P1-D  Path-safety stageRuntime        [F-007]  both
P1-E  SIGINT honesty                  [F-008]  atomic-skills
P1-F  publishRuntimeAndRegister always[F-009]  atomic-skills
```

**Order:**
1. Decision gate (U / C / U+C).
2. P0-C is independent of U/C — can start immediately.
3. P0-A and P0-B follow the gate (engine and/or consumer).
4. P0-D lands regression tests as each P0 fix lands, then a final full-path suite.
5. P1 only after P0 green (P1-E messages that mention repair **require** P0-A CLI strings).
6. Within P1: default order P1-A → P1-F, **except** pull P1-C forward when a task would otherwise add another plain `writeFileSync` ledger write.

---

## P0 — Correctness / recovery / shrink

### P0-A — Incomplete transaction recovery (F-001)

**Problem:** Driver writes `transaction: incomplete` with **prior** effects, applies new effects in memory without per-effect flush, completes only at end. Crash after effect N → disk ≠ journal; install and uninstall both refuse (`assertNoIncompleteTransaction`). Only “recovery” in tests is `rm -rf .atomic-skills`.

**Evidence (verified_by source lines):**
- audit F-001
- `node_modules/@henryavila/minimalist-installer/src/driver.js:62-103` — incomplete marker with prior effects, in-memory rebuild, single complete write at end
- `.../recovery.js:53-63` — `assertNoIncompleteTransaction` on incomplete
- `.../recovery.js:68-78` — `describeRecovery` is **read-only inspect** (effectCount + inspect); **not** a mutator
- `.../index.js` exports `describeRecovery` and `assertNoIncompleteTransaction` (already public)
- `tests/release-fault-matrix.test.js` — recovery of incomplete via wipe marker / tree

**Work:**

1. **Upstream (choice U or U+C) — required mechanism:** after each successful `effect.apply`, **append that effect to the on-disk journal** (or write a staging manifest and commit), so an incomplete journal always reflects applied ownership. Optional **supplementary** rollback of applied effects on caught failure is allowed **in addition to** durable journaling, never as the sole design. **Rejected:** rollback-only (cannot run after SIGKILL / power loss / abrupt kill).
2. **Consumer CLI (required for C and U+C; still useful under U):**
   - Ship **both** flags with fixed semantics (not “and/or”):
     - `install --repair` — when incomplete: print `describeRecovery` summary (effectCount, state, reason); if journal is trusted post-U pin, resume/complete or re-run install; if pre-U (stale prior journal), refuse silent resume and instruct `uninstall --force-incomplete`.
     - `uninstall --force-incomplete` — attempt best-effort reverse of **journaled** effects; **do not** delete the incomplete marker until an asserted clean or fully owned baseline (or write a residual recovery ledger of unrecovered paths). Pre-U residual risk for unjournaled applies must remain discoverable after the command.
   - Operator message on incomplete: what failed, which command fixes it (never “edit JSON by hand”).
3. **Pin bump (U / U+C only):** update `package.json` / lock for `@henryavila/minimalist-installer` to the commit/tag that contains the engine fix. `unverified:` exact tag until PR merges.
4. **Tests:** inject fail on 2nd effect during full `installSkills` / `install()`; also fault-inject **abrupt child-process kill after a disk-mutating effect** (not only thrown errors). Assert repair/force path leaves installable or clean+ledgered baseline without hand-editing JSON.

**Exit gate (U / U+C after pin):** incomplete TX → documented CLI path → tree fully installed or fully reversible (journal matches disk).  
**Exit gate (C only):** operator CLI exists + messages; **does not** mark success criterion 1 or P0 green.

---

### P0-B — Revert dropped effects on plan shrink (F-002)

**Problem:** Final journal = only effects from current plan. Removing capable hosts drops auto-update `stageRuntimeArtifacts` + `jsonMerge` from plan **without** calling `revert` on the prior effects → orphan hooks/settings.

**Evidence (verified_by):**
- audit F-002
- `driver.js:73-103` — journal final = planned effects only
- `src/runtime-layers/auto-update.js:96-98` — zero capable hosts → `return []`
- `tests/auto-update-host-matrix.test.js` — fresh codex-only matrix; no claude→codex update shrink case

**Work:**

1. **Prefer upstream Driver (U / U+C) — crash-resumable transition:**
   - Record drop intent (which prior effect ids will be reverted) on disk before the first reverse.
   - `diff(priorEffects, plannedEffects)` then `revert` dropped ids/types in reverse order.
   - Remove each journal entry **only after** its successful reverse (or mark it `reverted` in a durable staging journal).
   - Replace the live journal with the next plan only after all drops complete; resume mid-drop after incomplete.
2. **Consumer fallback (C or until pin):**
   - Detect prior auto-update effects (`stageRuntimeArtifacts` / `jsonMerge` for auto-update paths) not in new plan.
   - Explicitly revert those effects (or call the same cleanup helpers the effect `revert` would use), with the same crash-resumable boundary rules at consumer level when feasible.
   - Scope: auto-update surfaces only — not a general “any dropped effect” engine.
3. On pin that includes engine drop-revert: **delete** the consumer workaround (hard rule above).
4. **Tests (mandatory):**
   - install `ides: [claude-code]` → update `ides: [codex]` → no `version-check.sh` under Claude tree / no Atomic SessionStart residue in settings (surgical: only our entries).
   - install `ides: [claude-code, grok]` → update to `[cursor]` → both auto-update surfaces gone.
   - Fault inject during dropped-effect reversal (kill after first reverse, before journal replace) → resume leaves no orphan hooks and journal consistent.

**Exit gate:** shrink never leaves auto-update residue; uninstall after shrink is clean for those surfaces; mid-drop crash is resumable without journal/disk split.

---

### P0-C — Grok host cleanup on IDE shrink (F-003)

**Problem:** Outside-journal Grok register + isolation only run when `wantsGrokPluginHost(ides)`. Shrink away from grok is a no-op for cleanup; uninstall also keys off **current** `manifest.ides` after update already dropped grok.

**Evidence (verified_by):**
- audit F-003
- `src/install.js:563-603` — `syncGrokPluginHostAfterInstall` returns early when `!wantsGrokPluginHost(ides)`
- `src/uninstall.js:126-136` — unregister + isolation gated on current `manifest.ides`

**Work:**

1. Before rewriting manifest metadata, compare `priorIdes` vs `nextIdes` (read prior from existing manifest).
2. If prior had `grok` and next does not: `unregisterGrokPluginHost` + `revertGrokAgentsIsolation` (refcount-safe — keep isolation if other installs still list grok).
3. Test: install with grok → reinstall without grok → host unregistered + isolation removed when last grok owner.

**Exit gate:** no phantom Grok plugin / isolation after shrink when no remaining grok installs.

---

### P0-D — Full-path fault E2E (closes P0)

**Work:**

1. Suite under `tests/` (extend `tests/release-fault-matrix.test.js` and/or new `tests/install-fault-matrix-e2e.test.js`) that drives **atomic-skills** `installSkills` / `install`, not bare engine only.
2. **Mandatory scenarios (explicit):**
   - Incomplete: fail on 2nd effect mid-install → CLI repair or force-incomplete → tree installable or clean.
   - Shrink auto-update: claude-code → codex (no Claude hook/settings residue).
   - Shrink multi: claude-code+grok → cursor (auto-update surfaces gone).
   - Grok host: install with grok → reinstall without grok (plugin + isolation cleaned when last owner).
3. Wire into CI via existing `npm test` (no new CI product unless `npm test` does not pick up the file — then add to package test script only).

**Exit gate:** P0 findings have automated regressions; fault recovery is not “rm -rf only”.

---

## P1 — Safety / multi-owner / path / UX honesty

### P1-A — Harden adopt (F-004)

**Problem:** `adoptPreexistingDesiredFiles` records `installedHash = current` then reconciler rewrites → silent clobber of any content at desired paths.

**Evidence (verified_by):** audit F-004; `src/adopt-preexisting-desired.js`; reconciler rewrite when `current === installed`.

**Work:**

1. Adopt only if:
   - frontmatter matches atomic-skills safelist (`isAtomicSkillsArtifact` in `src/install.js` / known names), **or**
   - content hash matches last known package hash if available, **or**
   - `--force-adopt` / interactive confirm.
2. Else: **default policy = keep-local without rewrite + log** (do not throw GREENFIELD_CONFLICT for foreign/user content at desired paths during expand). `--force-adopt` opts into reclaim. Document in code comment + test name.
3. Surface `adopted` count in install UI/logs.
4. Tests: user-edited skill body at desired path preserved unless force; stale package leftover still reclaimed.

**Exit gate:** expand-IDE reclaim no longer unconditional clobber.

---

### P1-B — Versioned registry + package-root restage (F-005)

**Problem:** `package-root` last-writer-wins; `registerInstall` writes bare paths / new owners as `{ basePath }` only; observe reads versioned fields that writers never set; uninstall reclaim does not restage surviving owner.

**Evidence (verified_by):**
- audit F-005
- `src/install.js` `registerInstall` / `writeInstallsRegistryAtomic` — new owners `{ basePath }` only; legacy prior stays bare array
- `src/runtime-observe.js` — reads `packageRoot` / `version` / `fingerprint`

**Work:**

1. On register: **always** write versioned schema `{ schemaVersion, owners: [{ basePath, packageRoot, version, fingerprint }] }`, including when prior was legacy array (migrate on write).
2. On unregister of last writer of a packageRoot: elect surviving owner (same rules as `runtime-observe`) and restage runtime artifacts from that owner’s packageRoot.
3. Optional: prune ghost owners under lock with explicit status message.
4. Tests: two install bases, uninstall the one that wrote package-root, assert survivor’s package-root active.

**Exit gate:** multi-owner home does not leave dead package-root after uninstall.

---

### P1-C — Single atomic/no-follow manifest writer (F-006)

**Problem:** `src/manifest.js` uses plain `writeFileSync`; engine has `atomicWriteJsonNoFollow`. adopt + post-install patch use local writer.

**Evidence (verified_by):** audit F-006; `src/manifest.js`; engine `src/manifest.js` + `path-safety.js`.

**Work:**

1. Re-export or wrap engine manifest write with `MANIFEST_DIR = '.atomic-skills'`.
2. Route **all** install-ledger writes (adopt, installSkills patch, migrate) through one API.
3. Delete or thin `src/manifest.js` to avoid dual semantics.
4. Test: atomic rename contract (tmp + rename) and/or no-follow refusal on symlink manifest path if harness allows.

**Exit gate:** no plain `writeFileSync` for install ledger (`.atomic-skills` manifest).

---

### P1-D — Path-safety for stageRuntimeArtifacts (F-007)

**Problem:** custom effect uses plain `existsSync`/`copyFileSync`/`rmSync` with only lexical base check.

**Evidence (verified_by):** audit F-007; `src/runtime-layers/effects/stage-runtime-artifacts.js`.

**Work:**

1. Use engine no-follow helpers for read/write/unlink under basePath (`path-safety.js` exports), **or**
2. Replace with reconcileFileSet + mode bits if engine supports executable artifacts.
3. Test: leaf symlink at hook destination refuses (same class as reconciler data-safety tests).

**Exit gate:** staging hook cannot follow symlink escape.

---

### P1-E — SIGINT honesty (F-008)

**Problem:** interactive cleanup unlinks `writtenFiles`, but `onFileWritten` runs only **after** `installSkills` fully completes (post-Driver + post-manifest patch) — so mid-install `writtenFiles` is always empty; cleanup re-sends SIGINT to self → reentrancy; message “no files kept” is false.

**Evidence (verified_by):**
- audit F-008
- `src/install.js:835-862` — SIGINT cleanup + `process.kill(SIGINT)`
- `src/install.js` — `onFileWritten` invoked only after installSkills body finishes

**Work:**

1. Prefer **remove** fake SIGINT cleanup entirely.
2. If keep: `removeListener` before exit; on incomplete, point to P0-A repair CLI strings; never `process.kill(SIGINT)` self — use `process.exit(1)`.
3. Test or static guard that cleanup does not re-signal.

**Depends on:** P0-A for honest incomplete messaging (otherwise message points to a flag that does not exist yet).

**Exit gate:** Ctrl+C does not lie and does not recurse.

---

### P1-F — Always `publishRuntimeAndRegister` (F-009)

**Problem:** `--yes` uses locked publish+register; interactive stages then registers in two steps.

**Evidence (verified_by):**
- audit F-009
- `src/install.js:735` — `--yes` → `publishRuntimeAndRegister`
- `src/install.js:868-869` — interactive → `installRuntimeArtifacts()` + `registerInstall(basePath)`

**Work:**

1. Interactive path calls `publishRuntimeAndRegister(basePath)` only.
2. Delete dual call sites on the interactive install success path.
3. Tiny test or source guard that interactive install does not call bare `installRuntimeArtifacts` + `registerInstall` separately on that path.

**Exit gate:** one code path for runtime publish on install success.

---

## Dependency / ownership matrix

| Finding | Primary owner | Can ship consumer-only? |
|---------|---------------|-------------------------|
| F-001 incomplete TX | minimalist-installer + consumer CLI | Partial (repair CLI yes; true journal fix needs pin) |
| F-002 dropped effects | minimalist-installer prefer | Yes workaround for auto-update only (remove on pin) |
| F-003 Grok shrink | atomic-skills | Yes |
| F-004 adopt | atomic-skills | Yes |
| F-005 registry | atomic-skills | Yes |
| F-006 manifest | atomic-skills | Yes |
| F-007 stage path-safety | both | Yes if rewrite effect locally |
| F-008 SIGINT | atomic-skills | Yes |
| F-009 publish path | atomic-skills | Yes |

## Suggested session sequence (next session)

1. Read this plan + [installer-audit-2026-07-17.md](../audits/installer-audit-2026-07-17.md).
2. **Decision gate:** U / C / U+C (table above). Record choice.
3. Implement P0-C (independent) in parallel with engine work if U.
4. P0-A / P0-B per gate + tests; pin-bump if U/U+C.
5. P0-D full suite (mandatory scenarios).
6. P1-A → P1-F with P1-C pulled forward when ledger writes appear; P1-E only after P0-A CLI exists.
7. `npm test` + install-uninstall roundtrip + manual: user install multi-IDE shrink.

## P2 backlog (do not implement in this plan)

See audit F-010–F-014 and items 11–16 in the audit improvements backlog. Unrelated package version bumps stay here; **not** the minimalist-installer pin required for U/U+C.

## References

- Audit: `docs/audits/installer-audit-2026-07-17.md`
- Prior audit: `docs/audits/installer-audit-2026-07-10.md`
- Install map: `CLAUDE.md` (install/uninstall parity table)
- Engine: `node_modules/@henryavila/minimalist-installer/src/driver.js`, `.../src/kernel/reconciler.js`, `.../src/path-safety.js`, `.../src/recovery.js`
- Consumer hotspots: `src/install.js`, `src/uninstall.js`, `src/installer.js`, `src/adopt-preexisting-desired.js`, `src/runtime-layers/**`, `src/manifest.js`, `src/runtime-observe.js`
- Current engine pin: `package.json` → `@henryavila/minimalist-installer` git commit (read at implement time)

## Alignment notes (review-plan local + codex)

- `describeRecovery` is already exported and is inspect-only; repair mutation is consumer-owned until engine gains resume APIs.
- Consumer auto-update shrink workaround and engine drop-effect revert must not double-apply after pin-bump.
- Pin bump for F-001/F-002 is in-scope for choices U/U+C (not P2).
- **Codex criticals applied (2026-07-17):** F-001 ban rollback-only; F-002 crash-resumable drop transition; F-003 choice C does not satisfy success criterion 1.
- **Codex majors recorded (not auto-applied):** repair mutator task detail; Grok host multi-owner unregister gate; unmanaged-desired reconciler disposition; legacy registry metadata discovery; P1-C mandatory no-follow tests — see `.atomic-skills/reviews/2026-07-17-1816-installer-hardening-p0-p1-codex.md`.
