# Codex review — install/uninstall parity enforcer plan

- **Plan:** docs/superpowers/plans/2026-06-05-install-uninstall-parity-enforcer.md
- **Mode:** codex (blind + informed), cross-ref informational
- **Reviewer:** gpt-5.3-codex (codex-cli 0.128.0)
- **Date:** 2026-06-05-1844
- **Framing Δ:** 5 blind → 4 final (dropped 2: project $HOME residue, ~/.aideck test split)

---

---
verdict: needs_changes
counts: {blocker: 0, critical: 1, major: 2, minor: 1, nit: 0}
reviewer: gpt-5.3-codex
pass: informed
schema_version: "1.0"
---

## Summary
The plan’s round-trip enforcer is still materially incomplete: it compares only newly added path names, so it cannot enforce the stated “returns to pre-install state” invariant for deletions or content changes. That gap directly affects the `.gitignore` allowlist and the planned `settings.json` deletion behavior.

The revealed constraints invalidate the blind finding about project-scope `$HOME` runtime residue and the test omission for `~/.aideck/`. They also expose a narrower documentation issue: `~/.aideck/` is described as parity allowlist residue even though it is not an installer artifact and is not part of the enforcer’s modeled mutations.

## Findings

### F-001 [critical] coverage — docs/superpowers/plans/2026-06-05-install-uninstall-parity-enforcer.md:74-101

**Evidence:**
```js
function snapshotPaths(root) {
  const out = new Set();
  (function walk(dir) {
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (e.name === '.git') continue;
      const abs = join(dir, e.name);
      out.add(relative(root, abs));
      if (e.isDirectory()) walk(abs);
    }
  })(root);
  return out;
}

function residue(after, before, allowed) {
  const allow = new Set(allowed);
  return [...after].filter((p) => !before.has(p) && !allow.has(p)).sort();
}
```

**Claim:** The enforcer only detects paths present after uninstall but absent before install, so it misses deleted pre-existing paths and modified pre-existing file contents.

**Impact:** A round trip can delete a user’s pre-existing empty `~/.claude/settings.json`, rewrite an existing `.gitignore`, or corrupt any pre-existing installed-adjacent file and still pass because those cases are not “new residue.”

**Recommendation:** Change the snapshot to record file type plus content hash, compare additions, deletions, and modifications, and apply allowlist rules to exact path/content exceptions rather than only `after - before` paths.

**Confidence:** high

---

### F-002 [major] coverage — docs/superpowers/plans/2026-06-05-install-uninstall-parity-enforcer.md:242-263

**Evidence:**
```js
Add the project-scope scenario. The repo should return to its pre-install state except the `.gitignore` `.atomic-skills/` line (allowlisted). The global runtime under `$HOME` is left intact by design and is not asserted here (covered by `tests/uninstall.test.js`).

const before = snapshotPaths(repo);
await install(repo, { yes: true, project: true, ide: ['claude-code'], lang: 'en' });
await uninstall(repo, { scope: 'project', yes: true });
const after = snapshotPaths(repo);
const left = residue(after, before, ALLOWED_RESIDUE.project);
assert.deepEqual(left, [], `unexpected residue after project uninstall: ${left.join(', ')}`);
```

**Claim:** The project allowlist permits the whole `.gitignore` path, not the single `.atomic-skills/` line the plan says is allowed.

**Impact:** If install/uninstall creates `.gitignore` with extra content, rewrites an existing `.gitignore`, or removes pre-existing content while leaving the path present, this enforcer still passes.

**Recommendation:** Special-case `.gitignore` with a content assertion: after uninstall, it must equal the pre-install content plus only the allowed `.atomic-skills/` line, with no other content changes.

**Confidence:** high

---

### F-003 [major] coverage — docs/superpowers/plans/2026-06-05-install-uninstall-parity-enforcer.md:207-216

**Evidence:**
```js
  // If removing our hook emptied the entire settings object, the file was an
  // orphan we created solely for the hook — delete it, then prune .claude/ if
  // it too became empty. Otherwise rewrite with the surviving settings.
  if (Object.keys(settings).length === 0) {
    unlinkSync(settingsPath);
    const claudeDir = dirname(settingsPath);
    try { if (readdirSync(claudeDir).length === 0) rmdirSync(claudeDir); } catch {}
  } else {
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n', 'utf8');
  }
```

**Claim:** The planned `settings.json` deletion treats “empty after hook removal” as proof the installer created the file, but it does not know whether an empty settings file existed before install.

**Impact:** A user-owned pre-existing `~/.claude/settings.json` containing `{}` can be deleted during uninstall instead of restored to its pre-install state.

**Recommendation:** Add a round-trip/unit case with a pre-existing empty `settings.json`, and make install record whether the settings file existed before merging the hook so uninstall deletes only installer-created settings files.

**Confidence:** high

---

### F-004 [minor] contradiction — docs/superpowers/plans/2026-06-05-install-uninstall-parity-enforcer.md:366-388

**Evidence:**
```md
**Allowlist (deliberate residue, never reversed):**
- `.gitignore` `.atomic-skills/` line (project scope) — safety against
  re-introducing `.atomic-skills/` into git on a reinstall.
- `~/.aideck/` — the user's own provisioned plans/initiatives (data, not an
  install artifact).

## install.js ↔ uninstall.js map

| Install action | Reversal |
|---|---|
| Skill/command `.md`, namespace root, `_assets/`, `version-check.sh` (manifest) | manifest loop + `pruneEmptyParents` |
| Runtime `~/.atomic-skills/{bin,dashboard,aideck-consumer,src}` | `removeRuntimeArtifacts` (user scope only) |
| `SessionStart` entry in `settings.json` (merge) | `removeAutoUpdateHook` (surgical; deletes the file if it became empty) |
| `manifest.json` | unlink + prune |
| `.gitignore` line, `~/.aideck/` | allowlist — not reversed |
```

**Claim:** The documentation places `~/.aideck/` in the install/uninstall parity allowlist and reversal map even though the installer does not create that path.

**Impact:** The documented rule no longer matches the enforcer’s modeled installer mutations, so future work can treat non-installer runtime data as an install residue exception and weaken the parity contract.

**Recommendation:** Remove `~/.aideck/` from the install/uninstall parity allowlist and map, or move it to a separate note explicitly stating it is outside installer parity because `src/install.js` does not create it.

**Confidence:** high

## Questions (non-findings)

- docs/superpowers/plans/2026-06-05-install-uninstall-parity-enforcer.md:331 — What exact “same two” dashboard-bundle failures are expected, and where is the referenced design audit available to an implementer running this plan?

## Out of scope

- Full reversal of `.gitignore` and `~/.aideck/` was not reviewed; findings only address contradictions and enforcement scope around the stated allowlist.

## Pass 2 reconciliation

### Dropped from blind pass

- F-002-blind [major] contradiction — DROPPED: The external constraint states project-scope uninstall deliberately leaves global `$HOME` runtime artifacts intact, matching the plan’s line 242 scope boundary.
- F-005-blind [major] contradiction — DROPPED: The external constraint states `src/install.js` never creates `~/.aideck/`, so the user-scope enforcer’s lack of a `~/.aideck/` allowlist does not currently create a test/docs split for installer output.

### Maintained

- F-001-blind → F-001-final [critical] — same
- F-003-blind → F-002-final [major] — same
- F-004-blind → F-003-final [major] — same

### Emerged

- F-004-final [minor] contradiction — emerged: The external constraint that `src/install.js` never creates `~/.aideck/` makes its inclusion in the installer parity allowlist/map substantively misleading rather than merely unenforced.