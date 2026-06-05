# Install/Uninstall Parity + Round-trip Enforcer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make install↔uninstall parity regression-proof via a content-aware round-trip test that installs everything, uninstalls, and asserts the filesystem returns to its pre-install state (modulo a declared, content-checked allowlist); close the residue it exposes; document the rule.

**Architecture:** A new `tests/install-uninstall-roundtrip.test.js` snapshots a content-hashed tree under a tmp `$HOME`/repo before install and after uninstall, then diffs in three directions (added / removed / modified). Gaps it exposes are fixed at the source in `src/install.js`/`src/uninstall.js`. The invariant is documented in `CLAUDE.md` and referenced from `AGENTS.md`.

**Tech Stack:** Node.js built-in test runner (`node:test`), `node:fs`, `node:crypto` (sha256), `node:assert/strict`. No new dependencies.

**Codex review applied:** This plan incorporates codex findings F-001 (bidirectional content-aware diff), F-002 (`.gitignore` checked by content not path), F-003 (`settings.json` deletion gated on install-provenance via manifest), F-004 (`~/.aideck/` documented as out-of-parity, not allowlisted). Review file: `.atomic-skills/reviews/2026-06-05-1844-install-uninstall-parity-enforcer.md`.

---

## Empirically established facts (observed, not inferred)

A real `install` (user scope, `{ ide:['claude-code'], lang:'en' }`) followed by `uninstall { scope:'user', yes:true }` was run against a tmp `$HOME`:

- The installer DOES create `~/.claude/settings.json` (256 B, `{}` after merge) and `~/.atomic-skills/hooks/version-check.sh` (the hook runs on every install — the linerole `meta.modules['auto-update']` reads `catalog.yaml`, which always declares the module).
- The manifest records the hook as `.atomic-skills/hooks/version-check.sh` (a clean basePath-relative path). After uninstall, `version-check.sh` is **removed cleanly**. → The Component-C path suspicion from the design is **refuted**; no path fix is needed (the former Task 4 is dropped).
- The ONLY residue after a user-scope round-trip is `~/.claude/settings.json` (`{}`) plus the now-empty `~/.claude/` dir. → Component B is the single real gap.

---

## File Structure

- **Create:** `tests/install-uninstall-roundtrip.test.js` — owns `snapshotTree`, `diffTree`, the allowlist, and the round-trip scenarios.
- **Modify:** `src/install.js` — `installAutoUpdateHook` records install-provenance of `settings.json`; `installSkills` threads it into the manifest; `removeAutoUpdateHook` gates deletion on that provenance.
- **Modify:** `tests/uninstall.test.js` — unit cases for the provenance-gated deletion.
- **Modify:** `CLAUDE.md` — three sections (parity HARD RULE, testing, install↔uninstall map).
- **Modify:** `AGENTS.md` — one Cross-Agent Standards item.

Task 0 (commit the uninstaller baseline) is already satisfied by commit `51f5b4e feat(uninstall): full undo + --yes non-interactive mode`; skip it.

---

### Task 1: Round-trip enforcer — content-aware helper + user-scope scenario

Write a content-hashing snapshot and a three-way diff, then the user-scope round-trip. Expect it to FAIL: empirically the round-trip leaves `.claude/settings.json` (and `.claude/`) behind.

**Files:**
- Create: `tests/install-uninstall-roundtrip.test.js`

- [ ] **Step 1: Write the test file (helpers + allowlist + user scenario)**

```js
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { execFileSync } from 'node:child_process';
import {
  mkdtempSync, rmSync, mkdirSync, readdirSync, readFileSync, writeFileSync, existsSync,
} from 'node:fs';
import { join, relative } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { install } from '../src/install.js';
import { uninstall } from '../src/uninstall.js';

function withHome(fakeHome, fn) {
  const original = process.env.HOME;
  process.env.HOME = fakeHome;
  return Promise.resolve(fn()).finally(() => {
    if (original === undefined) delete process.env.HOME;
    else process.env.HOME = original;
  });
}

/**
 * Content-aware snapshot: Map of root-relative path → 'dir' for directories,
 * or a sha256 of file contents for files. Skips `.git`. Empty when root missing.
 */
function snapshotTree(root) {
  const out = new Map();
  (function walk(dir) {
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (e.name === '.git') continue;
      const abs = join(dir, e.name);
      const rel = relative(root, abs);
      if (e.isDirectory()) { out.set(rel, 'dir'); walk(abs); }
      else { out.set(rel, createHash('sha256').update(readFileSync(abs)).digest('hex')); }
    }
  })(root);
  return out;
}

/** Three-way diff: paths added, removed, or whose hash changed. */
function diffTree(before, after) {
  const added = [], removed = [], modified = [];
  for (const [p, h] of after) {
    if (!before.has(p)) added.push(p);
    else if (before.get(p) !== h) modified.push(p);
  }
  for (const p of before.keys()) if (!after.has(p)) removed.push(p);
  return { added: added.sort(), removed: removed.sort(), modified: modified.sort() };
}

describe('install→uninstall round-trip', () => {
  it('user scope returns $HOME to its pre-install state (no residue)', async () => {
    const fakeHome = mkdtempSync(join(tmpdir(), 'as-rt-home-'));
    const projectDir = mkdtempSync(join(tmpdir(), 'as-rt-proj-'));
    try {
      await withHome(fakeHome, async () => {
        const before = snapshotTree(fakeHome);
        await install(projectDir, { yes: true, ide: ['claude-code'], lang: 'en' });
        await uninstall(projectDir, { scope: 'user', yes: true });
        const { added, removed, modified } = diffTree(before, snapshotTree(fakeHome));
        assert.deepEqual(added, [], `residue after user uninstall: ${added.join(', ')}`);
        assert.deepEqual(removed, [], `user uninstall deleted pre-existing paths: ${removed.join(', ')}`);
        assert.deepEqual(modified, [], `user uninstall modified pre-existing files: ${modified.join(', ')}`);
      });
    } finally {
      rmSync(fakeHome, { recursive: true, force: true });
      rmSync(projectDir, { recursive: true, force: true });
    }
  });
});
```

- [ ] **Step 2: Run it — verify it fails with the known residue**

Run: `node --test tests/install-uninstall-roundtrip.test.js 2>&1 | tail -20`
Expected: FAIL. `added` lists `.claude` and `.claude/settings.json`. (Confirms Component B is the gap.)

- [ ] **Step 3: Commit the failing enforcer**

```bash
git add tests/install-uninstall-roundtrip.test.js
git commit -m "test(roundtrip): content-aware user-scope round-trip must leave no residue (RED)"
```

---

### Task 2: Close the orphan `settings.json` — provenance-gated deletion (F-003)

The installer creates `settings.json` from scratch for the hook; the uninstaller removes only the hook entry, leaving `{}`. Deleting "any empty settings.json" is wrong (it could be a user's pre-existing `{}`). Gate deletion on whether the installer created the file, recorded in the manifest.

**Files:**
- Modify: `src/install.js` (`installSkills`, `installAutoUpdateHook`, `removeAutoUpdateHook`)
- Modify: `src/uninstall.js` (pass the manifest flag through)
- Test: `tests/uninstall.test.js`

- [ ] **Step 1: Write failing unit tests**

Add inside the existing `describe('removeAutoUpdateHook', ...)` block in `tests/uninstall.test.js`:

```js
  it('deletes an emptied settings.json the installer created (settingsCreated:true)', () => {
    const base = mkdtempSync(join(tmpdir(), 'as-uninst-hook-'));
    try {
      const versionCheck = join(base, '.atomic-skills', 'hooks', 'version-check.sh');
      const settingsPath = join(base, '.claude', 'settings.json');
      mkdirSync(join(settingsPath, '..'), { recursive: true });
      writeFileSync(settingsPath, JSON.stringify({
        hooks: { SessionStart: [{ matcher: '*', hooks: [{ type: 'command', command: versionCheck }] }] },
      }, null, 2));

      removeAutoUpdateHook({ basePath: base, scope: 'user', settingsCreated: true });

      assert.ok(!existsSync(settingsPath), 'installer-created orphan settings.json deleted');
    } finally {
      rmSync(base, { recursive: true, force: true });
    }
  });

  it('preserves an emptied settings.json the user already had (settingsCreated:false)', () => {
    const base = mkdtempSync(join(tmpdir(), 'as-uninst-hook-'));
    try {
      const versionCheck = join(base, '.atomic-skills', 'hooks', 'version-check.sh');
      const settingsPath = join(base, '.claude', 'settings.json');
      mkdirSync(join(settingsPath, '..'), { recursive: true });
      writeFileSync(settingsPath, JSON.stringify({
        hooks: { SessionStart: [{ matcher: '*', hooks: [{ type: 'command', command: versionCheck }] }] },
      }, null, 2));

      removeAutoUpdateHook({ basePath: base, scope: 'user', settingsCreated: false });

      assert.ok(existsSync(settingsPath), 'pre-existing settings.json preserved');
      assert.deepEqual(JSON.parse(readFileSync(settingsPath, 'utf8')), {});
    } finally {
      rmSync(base, { recursive: true, force: true });
    }
  });

  it('preserves a settings.json that still holds other keys', () => {
    const base = mkdtempSync(join(tmpdir(), 'as-uninst-hook-'));
    try {
      const versionCheck = join(base, '.atomic-skills', 'hooks', 'version-check.sh');
      const settingsPath = join(base, '.claude', 'settings.json');
      mkdirSync(join(settingsPath, '..'), { recursive: true });
      writeFileSync(settingsPath, JSON.stringify({
        hooks: { SessionStart: [{ matcher: '*', hooks: [{ type: 'command', command: versionCheck }] }] },
        otherSetting: true,
      }, null, 2));

      removeAutoUpdateHook({ basePath: base, scope: 'user', settingsCreated: true });

      assert.ok(existsSync(settingsPath), 'settings.json with other keys preserved');
      assert.equal(JSON.parse(readFileSync(settingsPath, 'utf8')).otherSetting, true);
    } finally {
      rmSync(base, { recursive: true, force: true });
    }
  });
```

- [ ] **Step 2: Run them and confirm failures**

Run: `node --test tests/uninstall.test.js 2>&1 | grep -E "settingsCreated|other keys|^ℹ (pass|fail)"`
Expected: the two `settingsCreated` cases FAIL (current `removeAutoUpdateHook` ignores the flag and writes `{}` rather than deleting; signature doesn't accept `settingsCreated`).

- [ ] **Step 3: Record install-provenance of settings.json in `installAutoUpdateHook`**

In `src/install.js`, change the signature on the line that begins `export function installAutoUpdateHook({ projectDir, scope, skillsDir, onFileWritten, createdFiles }) {` to add `manifestMeta`:

```js
export function installAutoUpdateHook({ projectDir, scope, skillsDir, onFileWritten, createdFiles, manifestMeta }) {
```

Then, immediately after the `settingsPath` is resolved (the block `const settingsPath = scope === 'project' ? join(projectDir, '.claude', 'settings.json') : join(homedir(), '.claude', 'settings.json');`), and BEFORE `mkdirSync(dirname(settingsPath), { recursive: true });`, insert:

```js
  // Record whether the installer is creating settings.json from scratch, so a
  // later uninstall deletes only installer-created files (never a user's own).
  const settingsPreexisted = existsSync(settingsPath);
  if (manifestMeta) manifestMeta.settingsCreated = !settingsPreexisted;
```

- [ ] **Step 4: Thread `manifestMeta` through `installSkills` into the manifest**

In `src/install.js`, in `installSkills`, just after `const createdFiles = [];` add:

```js
  const manifestMeta = {};
```

Update the hook call (currently `installAutoUpdateHook({ projectDir, scope, skillsDir, onFileWritten, createdFiles });`) to:

```js
    installAutoUpdateHook({ projectDir, scope, skillsDir, onFileWritten, createdFiles, manifestMeta });
```

Update the `writeManifest(projectDir, { ... })` call to include the flag:

```js
  writeManifest(projectDir, {
    version: getPackageVersion(),
    language,
    ides,
    modules,
    files: filesMap,
    settingsCreated: manifestMeta.settingsCreated ?? false,
  });
```

- [ ] **Step 5: Gate deletion in `removeAutoUpdateHook`**

In `src/install.js`, change the signature `export function removeAutoUpdateHook({ basePath }) {` to:

```js
export function removeAutoUpdateHook({ basePath, settingsCreated = false }) {
```

Replace the final write block (the `if (Object.keys(settings).length === 0) { ... } else { ... }` introduced for the orphan-settings fix, OR the bare `writeFileSync(...)` if that fix isn't present yet) with:

```js
  // Delete the file only if the installer created it AND removing our hook
  // emptied it. Otherwise preserve the user's file (which may legitimately be {}).
  if (Object.keys(settings).length === 0 && settingsCreated) {
    unlinkSync(settingsPath);
    const claudeDir = dirname(settingsPath);
    try { if (readdirSync(claudeDir).length === 0) rmdirSync(claudeDir); } catch {}
  } else {
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n', 'utf8');
  }
```

(`unlinkSync`, `dirname`, `readdirSync`, `rmdirSync` are already imported at the top of `src/install.js`.)

- [ ] **Step 6: Pass the manifest flag from `uninstall`**

In `src/uninstall.js`, the manifest is already read as `const manifest = readManifest(basePath);`. Change the existing call `removeAutoUpdateHook({ basePath, scope });` to:

```js
  removeAutoUpdateHook({ basePath, scope, settingsCreated: manifest.settingsCreated === true });
```

- [ ] **Step 7: Run the unit tests — all pass**

Run: `node --test tests/uninstall.test.js 2>&1 | grep -E "^ℹ (pass|fail)"`
Expected: `ℹ fail 0` (14 pass: 11 prior + 3 new).

- [ ] **Step 8: Run the user-scope round-trip — now green**

Run: `node --test tests/install-uninstall-roundtrip.test.js 2>&1 | grep -E "^ℹ (pass|fail)"`
Expected: `ℹ fail 0`. (Install records `settingsCreated:true`; uninstall deletes the orphan and prunes `.claude/`.)

- [ ] **Step 9: Commit**

```bash
git add src/install.js src/uninstall.js tests/uninstall.test.js
git commit -m "fix(uninstall): delete orphan settings.json only when installer created it"
```

---

### Task 2b: Round-trip preserves a pre-existing settings.json (F-003 end-to-end)

Prove the provenance gate end-to-end: a user who already had `~/.claude/settings.json` keeps it after a full round-trip.

**Files:**
- Modify: `tests/install-uninstall-roundtrip.test.js`

- [ ] **Step 1: Add the scenario**

Add a second `it(...)` inside the `describe('install→uninstall round-trip', ...)`:

```js
  it('user scope preserves a pre-existing settings.json', async () => {
    const fakeHome = mkdtempSync(join(tmpdir(), 'as-rt-home-'));
    const projectDir = mkdtempSync(join(tmpdir(), 'as-rt-proj-'));
    try {
      await withHome(fakeHome, async () => {
        const settingsPath = join(fakeHome, '.claude', 'settings.json');
        mkdirSync(join(settingsPath, '..'), { recursive: true });
        writeFileSync(settingsPath, JSON.stringify({}, null, 2) + '\n'); // canonical {}
        const before = snapshotTree(fakeHome);
        await install(projectDir, { yes: true, ide: ['claude-code'], lang: 'en' });
        await uninstall(projectDir, { scope: 'user', yes: true });
        const { added, removed, modified } = diffTree(before, snapshotTree(fakeHome));
        assert.deepEqual(removed, [], `must not delete the user's pre-existing files: ${removed.join(', ')}`);
        assert.deepEqual(added, [], `residue after uninstall: ${added.join(', ')}`);
        assert.deepEqual(modified, [], `must restore settings.json byte-for-byte: ${modified.join(', ')}`);
        assert.ok(existsSync(settingsPath), 'pre-existing settings.json survives');
      });
    } finally {
      rmSync(fakeHome, { recursive: true, force: true });
      rmSync(projectDir, { recursive: true, force: true });
    }
  });
```

- [ ] **Step 2: Run it**

Run: `node --test tests/install-uninstall-roundtrip.test.js 2>&1 | grep -E "^ℹ (pass|fail)"`
Expected: `ℹ fail 0`. If `modified` lists `.claude/settings.json`, the uninstall rewrote `{}` with different formatting than the seeded canonical `{}` — adjust the seed to match `JSON.stringify({}, null, 2) + '\n'` (already canonical) or align the rewrite; the gate (`removed` empty) is the primary assertion.

- [ ] **Step 3: Commit**

```bash
git add tests/install-uninstall-roundtrip.test.js
git commit -m "test(roundtrip): user-scope round-trip preserves a pre-existing settings.json"
```

---

### Task 3: Round-trip — project scope, `.gitignore` checked by content (F-002)

Add the project-scope scenario with a pre-existing `.gitignore`. After uninstall the repo must match baseline except `.gitignore`, which may differ ONLY by the appended `.atomic-skills/` line — an exact content assertion, not a path allowlist.

**Files:**
- Modify: `tests/install-uninstall-roundtrip.test.js`

- [ ] **Step 1: Add the project-scope test**

```js
  it('project scope returns the repo to baseline except the appended .gitignore line', async () => {
    const fakeHome = mkdtempSync(join(tmpdir(), 'as-rt-home-'));
    const repo = mkdtempSync(join(tmpdir(), 'as-rt-repo-'));
    try {
      execFileSync('git', ['init', '-q'], { cwd: repo });
      const gitignorePath = join(repo, '.gitignore');
      const gitignoreBefore = 'node_modules/\ndist/\n';
      writeFileSync(gitignorePath, gitignoreBefore);
      await withHome(fakeHome, async () => {
        const before = snapshotTree(repo);
        await install(repo, { yes: true, project: true, ide: ['claude-code'], lang: 'en' });
        await uninstall(repo, { scope: 'project', yes: true });
        const { added, removed, modified } = diffTree(before, snapshotTree(repo));
        assert.deepEqual(added, [], `unexpected new files in repo: ${added.join(', ')}`);
        assert.deepEqual(removed, [], `uninstall deleted pre-existing repo files: ${removed.join(', ')}`);
        assert.deepEqual(modified, ['.gitignore'], `only .gitignore may change: ${modified.join(', ')}`);
        assert.equal(
          readFileSync(gitignorePath, 'utf8'),
          gitignoreBefore + '.atomic-skills/\n',
          '.gitignore must equal pre-install content plus only the .atomic-skills/ line',
        );
      });
    } finally {
      rmSync(fakeHome, { recursive: true, force: true });
      rmSync(repo, { recursive: true, force: true });
    }
  });
```

- [ ] **Step 2: Run it and resolve any residue**

Run: `node --test tests/install-uninstall-roundtrip.test.js 2>&1 | tail -20`
Expected: PASS. If `added`/`removed` is non-empty, the project uninstall left or deleted something beyond `.gitignore` — fix the corresponding reversal in `src/uninstall.js` (e.g. prune a project-scope dir) and re-run. If `modified` contains more than `.gitignore`, a pre-existing repo file was rewritten — investigate before continuing.

- [ ] **Step 3: Commit**

```bash
git add tests/install-uninstall-roundtrip.test.js
git commit -m "test(roundtrip): project-scope round-trip checks .gitignore by content"
```

---

### Task 4: Document the parity rule in CLAUDE.md (F-004 applied)

Append three sections to `CLAUDE.md`, preserving existing content. The allowlist lists ONLY `.gitignore`; `~/.aideck/` goes in a separate out-of-parity note because the installer never creates it.

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Append the sections**

Add at the end of `CLAUDE.md`:

```markdown
## Install / Uninstall parity (HARD RULE)

Every persistent mutation the installer (`src/install.js`) makes MUST have a
matching reversal in the uninstaller (`src/uninstall.js`), OR be listed in the
allowlist below. This is enforced by a test, not by discipline alone.

**Enforcer:** `tests/install-uninstall-roundtrip.test.js` installs everything
into a tmp `$HOME`/repo, uninstalls, and asserts the filesystem returns to its
pre-install state. The snapshot is content-aware (sha256 per file) and the diff
is bidirectional — it catches added residue, deleted pre-existing files, AND
modified contents. When you add an install action, this test fails until you add
its reversal — that is the gate.

**Allowlist (deliberate residue, allowed by content):**
- `.gitignore` (project scope) — the installer appends one `.atomic-skills/`
  line; the round-trip permits `.gitignore` to differ from baseline by exactly
  that line and nothing else (safety against re-introducing `.atomic-skills/`
  into git on a reinstall).

**Out of install-parity scope (NOT an allowlist entry):**
- `~/.aideck/` — the user's provisioned plans/initiatives. The installer never
  creates it (it is provisioned lazily at runtime by the project skill), so it
  is outside the parity contract entirely. The round-trip never sees it.

## Testing & verification

- `npm test` — full unit suite (Node test runner).
- `npm run test:hooks` — shell hook tests.
- `npm run validate-skills` — skill schema validation.
- TDD: write the failing test, watch it fail, implement minimally, watch it
  pass, commit. Never claim green without running the command.

## install.js ↔ uninstall.js map

| Install action | Reversal |
|---|---|
| Skill/command `.md`, namespace root, `_assets/`, `version-check.sh` (manifest) | manifest loop + `pruneEmptyParents` |
| Runtime `~/.atomic-skills/{bin,dashboard,aideck-consumer,src}` | `removeRuntimeArtifacts` (user scope only) |
| `SessionStart` entry in `settings.json` (merge) | `removeAutoUpdateHook` (surgical; deletes the file only if the installer created it and it emptied) |
| `manifest.json` | unlink + prune |
| `.gitignore` line | allowlist — not reversed (checked by content) |
```

- [ ] **Step 2: Verify structure**

Run: `tail -45 CLAUDE.md`
Expected: the three sections appear cleanly after existing content.

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs(claude): install/uninstall parity HARD RULE + testing + reversal map"
```

---

### Task 5: Reference the rule from AGENTS.md

**Files:**
- Modify: `AGENTS.md`

- [ ] **Step 1: Add the standards item**

In `AGENTS.md`, after the existing "### 4. Documentation" block under "## Cross-Agent Standards", add:

```markdown
### 5. Install/Uninstall Parity
Every persistent install mutation MUST have a matching uninstall reversal or sit
in the documented allowlist. Enforced by
`tests/install-uninstall-roundtrip.test.js`. See `CLAUDE.md` →
"Install / Uninstall parity (HARD RULE)".
```

- [ ] **Step 2: Verify**

Run: `grep -A2 "Install/Uninstall Parity" AGENTS.md`
Expected: the new item is present.

- [ ] **Step 3: Commit**

```bash
git add AGENTS.md
git commit -m "docs(agents): reference install/uninstall parity HARD RULE"
```

---

### Task 6: Final verification

- [ ] **Step 1: Full suite**

Run: `npm test 2>&1 | grep -E "^ℹ (tests|pass|fail)"`
Expected: only the pre-existing environmental failures remain (dashboard bundle not built + aideck cross-repo `context` pending). Round-trip and uninstall tests green. Confirm the failing names match the known-environmental set; no new failures.

- [ ] **Step 2: Hooks + skill validation**

Run: `npm run test:hooks 2>&1 | tail -1 && npm run validate-skills 2>&1 | tail -1`
Expected: hooks pass; "All N skills valid".

- [ ] **Step 3: Clean tree**

Run: `git status -s`
Expected: only unrelated untracked artifacts (e.g. `.claude/skills/`). All parity work committed.

---

## Self-Review

**Spec coverage:** Component A (content-aware round-trip) → Tasks 1, 2b, 3; Component B (provenance-gated settings deletion) → Task 2; F-002 (`.gitignore` by content) → Task 3; F-003 (provenance) → Tasks 2, 2b; F-004 (docs) → Task 4; Component C → dropped (empirically refuted, documented in "Empirically established facts"). Component D → Task 4; Component E → Task 5.

**Placeholder scan:** No TBD/TODO. Every code step shows full code; every run step shows command + expected output. The former conditional Task 4 (hook path) is removed, not deferred.

**Type consistency:** `snapshotTree`/`diffTree`/`withHome` defined in Task 1 and reused in Tasks 2b and 3. `removeAutoUpdateHook({ basePath, scope, settingsCreated })` — the `settingsCreated` param added in Task 2 Step 5 matches the unit-test calls (Task 2 Step 1) and the uninstall call (Task 2 Step 6). `manifestMeta` declared in Task 2 Step 4, written in `installAutoUpdateHook` (Step 3), consumed by `writeManifest` (Step 4), read back as `manifest.settingsCreated` (Step 6).
