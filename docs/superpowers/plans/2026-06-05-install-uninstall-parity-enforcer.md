# Install/Uninstall Parity + Round-trip Enforcer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make install↔uninstall parity regression-proof via a round-trip test that installs everything, uninstalls, and asserts the filesystem returns to its pre-install state (modulo a declared allowlist); close the residue it exposes; document the rule.

**Architecture:** A new `tests/install-uninstall-roundtrip.test.js` snapshots the path set under a tmp `$HOME`/repo before install and after uninstall, and diffs them against a per-scope allowlist. Gaps it exposes are fixed at the source in `src/install.js`/`src/uninstall.js`. The invariant is then documented in `CLAUDE.md` and referenced from `AGENTS.md`.

**Tech Stack:** Node.js built-in test runner (`node:test`), `node:fs`, `node:assert/strict`. No new dependencies.

---

## File Structure

- **Create:** `tests/install-uninstall-roundtrip.test.js` — the enforcer. Owns `snapshotPaths`, the allowlist constant, and both round-trip scenarios.
- **Modify:** `src/install.js` — extend `removeAutoUpdateHook` (delete orphan empty `settings.json`); conditional hook-path fix in `installAutoUpdateHook`.
- **Modify:** `tests/uninstall.test.js` — two unit cases for the orphan-settings behaviour.
- **Modify:** `CLAUDE.md` — three new sections (parity HARD RULE, testing, install↔uninstall map).
- **Modify:** `AGENTS.md` — one Cross-Agent Standards item.

Pre-existing uninstaller work (uncommitted: `src/uninstall.js`, `src/install.js`, `bin/cli.js`, `README.md`, `tests/uninstall.test.js`) is committed first as a clean baseline (Task 0).

---

### Task 0: Commit the existing uninstaller baseline

The `uninstall --yes` feature + helpers (`removeRuntimeArtifacts`, `removeAutoUpdateHook`, `pruneEmptyParents`) are already implemented and green (11/11 in `tests/uninstall.test.js`). Commit them as a clean base before building the enforcer on top.

**Files:**
- Modify: `src/uninstall.js`, `src/install.js`, `bin/cli.js`, `README.md`
- Test: `tests/uninstall.test.js`

- [ ] **Step 1: Confirm the uninstaller suite is green**

Run: `node --test tests/uninstall.test.js 2>&1 | grep -E "^ℹ (pass|fail)"`
Expected: `ℹ pass 11` / `ℹ fail 0`

- [ ] **Step 2: Commit the baseline**

```bash
git add src/uninstall.js src/install.js bin/cli.js README.md tests/uninstall.test.js
git commit -m "feat(uninstall): --yes non-interactive mode + full undo (runtime, settings hook, multi-level prune)"
```

---

### Task 1: Round-trip enforcer — user-scope scenario

Write the snapshot helper and the user-scope round-trip. Expect it to FAIL initially: a from-scratch user install creates `~/.claude/settings.json` solely for the hook, which the current uninstall leaves behind as an empty `{}` orphan (and possibly `version-check.sh`, see Task 4).

**Files:**
- Create: `tests/install-uninstall-roundtrip.test.js`

- [ ] **Step 1: Write the test file (helper + allowlist + user scenario)**

```js
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { tmpdir } from 'node:os';
import { install } from '../src/install.js';
import { uninstall } from '../src/uninstall.js';

// Residue deliberately left after uninstall, per scope (see design §Decisions).
const ALLOWED_RESIDUE = { user: [], project: ['.gitignore'] };

/**
 * Recursively collect every path (files AND dirs) under `root`, as a Set of
 * root-relative paths. Skips `.git` (its internals churn and are not ours).
 * Empty when `root` is missing.
 */
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

function withHome(fakeHome, fn) {
  const original = process.env.HOME;
  process.env.HOME = fakeHome;
  return Promise.resolve(fn()).finally(() => {
    if (original === undefined) delete process.env.HOME;
    else process.env.HOME = original;
  });
}

// Paths present in `after` but not `before`, excluding the allowlist.
function residue(after, before, allowed) {
  const allow = new Set(allowed);
  return [...after].filter((p) => !before.has(p) && !allow.has(p)).sort();
}

describe('install→uninstall round-trip', () => {
  it('user scope returns $HOME to its pre-install state (no residue)', async () => {
    const fakeHome = mkdtempSync(join(tmpdir(), 'as-rt-home-'));
    const projectDir = mkdtempSync(join(tmpdir(), 'as-rt-proj-'));
    try {
      await withHome(fakeHome, async () => {
        const before = snapshotPaths(fakeHome);
        await install(projectDir, { yes: true, ide: ['claude-code'], lang: 'en' });
        await uninstall(projectDir, { scope: 'user', yes: true });
        const after = snapshotPaths(fakeHome);
        const left = residue(after, before, ALLOWED_RESIDUE.user);
        assert.deepEqual(left, [], `unexpected residue after user uninstall: ${left.join(', ')}`);
      });
    } finally {
      rmSync(fakeHome, { recursive: true, force: true });
      rmSync(projectDir, { recursive: true, force: true });
    }
  });
});
```

- [ ] **Step 2: Run it and capture the residue**

Run: `node --test tests/install-uninstall-roundtrip.test.js 2>&1 | tail -25`
Expected: FAIL. The assertion message lists the residue — expect at least `.claude/settings.json` (and `.claude/` if it emptied). If it also lists `.atomic-skills/hooks/version-check.sh` (and `.atomic-skills/hooks`), that confirms the Task 4 path bug — note it for later.

- [ ] **Step 3: Commit the (failing) enforcer**

```bash
git add tests/install-uninstall-roundtrip.test.js
git commit -m "test(roundtrip): user-scope install→uninstall must leave no residue (RED)"
```

---

### Task 2: Close the orphan `settings.json` residue

Extend `removeAutoUpdateHook` so that, when removing our hook empties the entire settings object, the file is deleted (and `.claude/` pruned if it too empties) instead of leaving a `{}` orphan.

**Files:**
- Modify: `src/install.js` (`removeAutoUpdateHook`, the final write block)
- Test: `tests/uninstall.test.js` (`removeAutoUpdateHook` describe block)

- [ ] **Step 1: Write the failing unit tests**

Add inside the existing `describe('removeAutoUpdateHook', ...)` block in `tests/uninstall.test.js`:

```js
  it('deletes settings.json when removing our hook leaves it empty', () => {
    const base = mkdtempSync(join(tmpdir(), 'as-uninst-hook-'));
    try {
      const versionCheck = join(base, '.atomic-skills', 'hooks', 'version-check.sh');
      const settingsPath = join(base, '.claude', 'settings.json');
      mkdirSync(join(settingsPath, '..'), { recursive: true });
      writeFileSync(settingsPath, JSON.stringify({
        hooks: { SessionStart: [{ matcher: '*', hooks: [{ type: 'command', command: versionCheck }] }] },
      }, null, 2));

      removeAutoUpdateHook({ basePath: base, scope: 'user' });

      assert.ok(!existsSync(settingsPath), 'orphan settings.json deleted');
    } finally {
      rmSync(base, { recursive: true, force: true });
    }
  });

  it('preserves settings.json that still holds other keys', () => {
    const base = mkdtempSync(join(tmpdir(), 'as-uninst-hook-'));
    try {
      const versionCheck = join(base, '.atomic-skills', 'hooks', 'version-check.sh');
      const settingsPath = join(base, '.claude', 'settings.json');
      mkdirSync(join(settingsPath, '..'), { recursive: true });
      writeFileSync(settingsPath, JSON.stringify({
        hooks: { SessionStart: [{ matcher: '*', hooks: [{ type: 'command', command: versionCheck }] }] },
        otherSetting: true,
      }, null, 2));

      removeAutoUpdateHook({ basePath: base, scope: 'user' });

      assert.ok(existsSync(settingsPath), 'settings.json with other keys preserved');
      assert.equal(JSON.parse(readFileSync(settingsPath, 'utf8')).otherSetting, true);
    } finally {
      rmSync(base, { recursive: true, force: true });
    }
  });
```

- [ ] **Step 2: Run them and verify the first fails**

Run: `node --test tests/uninstall.test.js 2>&1 | grep -E "settings.json|^ℹ (pass|fail)"`
Expected: `deletes settings.json when removing our hook leaves it empty` FAILS (file still exists); `preserves...` passes.

- [ ] **Step 3: Implement the fix**

In `src/install.js`, in `removeAutoUpdateHook`, replace the final write line:

```js
  writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n', 'utf8');
```

with:

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

(`unlinkSync`, `dirname`, `readdirSync`, `rmdirSync` are already imported at the top of `src/install.js`.)

- [ ] **Step 4: Run the unit tests — both pass**

Run: `node --test tests/uninstall.test.js 2>&1 | grep -E "^ℹ (pass|fail)"`
Expected: `ℹ fail 0` (13 pass: 11 prior + 2 new).

- [ ] **Step 5: Re-run the user-scope round-trip**

Run: `node --test tests/install-uninstall-roundtrip.test.js 2>&1 | tail -15`
Expected: either PASS, or FAIL listing ONLY `.atomic-skills/hooks/version-check.sh` (+ `.atomic-skills/hooks`) — which Task 4 addresses. No `.claude/settings.json` residue.

- [ ] **Step 6: Commit**

```bash
git add src/install.js tests/uninstall.test.js
git commit -m "fix(uninstall): delete orphan settings.json emptied by hook removal"
```

---

### Task 3: Round-trip enforcer — project-scope scenario

Add the project-scope scenario. The repo should return to its pre-install state except the `.gitignore` `.atomic-skills/` line (allowlisted). The global runtime under `$HOME` is left intact by design and is not asserted here (covered by `tests/uninstall.test.js`).

**Files:**
- Modify: `tests/install-uninstall-roundtrip.test.js`

- [ ] **Step 1: Add the project-scope test**

Add a second `it(...)` inside the existing `describe('install→uninstall round-trip', ...)`:

```js
  it('project scope returns the repo to pre-install state (only .gitignore residue)', async () => {
    const fakeHome = mkdtempSync(join(tmpdir(), 'as-rt-home-'));
    const repo = mkdtempSync(join(tmpdir(), 'as-rt-repo-'));
    try {
      execFileSync('git', ['init', '-q'], { cwd: repo });
      await withHome(fakeHome, async () => {
        const before = snapshotPaths(repo);
        await install(repo, { yes: true, project: true, ide: ['claude-code'], lang: 'en' });
        await uninstall(repo, { scope: 'project', yes: true });
        const after = snapshotPaths(repo);
        const left = residue(after, before, ALLOWED_RESIDUE.project);
        assert.deepEqual(left, [], `unexpected residue after project uninstall: ${left.join(', ')}`);
      });
    } finally {
      rmSync(fakeHome, { recursive: true, force: true });
      rmSync(repo, { recursive: true, force: true });
    }
  });
```

- [ ] **Step 2: Run it and capture any residue**

Run: `node --test tests/install-uninstall-roundtrip.test.js 2>&1 | tail -20`
Expected: PASS. If it FAILS, the assertion lists exactly what the project uninstall leaves behind beyond `.gitignore` — fix the corresponding reversal in `src/uninstall.js` before continuing (e.g. prune a project-scope dir). Re-run until green.

- [ ] **Step 3: Commit**

```bash
git add tests/install-uninstall-roundtrip.test.js
git commit -m "test(roundtrip): project-scope uninstall leaves only the .gitignore line"
```

---

### Task 4: (Conditional) Fix the user-scope hook manifest path

**Only do this task if the user-scope round-trip (Task 2 Step 5) still leaves `.atomic-skills/hooks/version-check.sh` behind.** If Task 2 Step 5 was already green, skip to Task 5.

Root cause: `installAutoUpdateHook` records the hook script in the manifest via `relative(projectDir, destScript)`, but a user-scope `destScript` lives under `homedir()`, not `projectDir`. The uninstall manifest loop resolves entries against `basePath = homedir()`, so a `projectDir`-relative path can't be found and the file survives.

**Files:**
- Modify: `src/install.js` (`installAutoUpdateHook`, the `createdFiles.push` for the hook)

- [ ] **Step 1: Confirm the failure is the hook file**

Run: `node --test tests/install-uninstall-roundtrip.test.js 2>&1 | grep version-check`
Expected: residue list includes `.atomic-skills/hooks/version-check.sh`.

- [ ] **Step 2: Record the manifest path relative to the correct base**

In `src/install.js`, in `installAutoUpdateHook`, replace:

```js
  // Track for manifest (so uninstall can remove later)
  createdFiles.push({
    path: relative(projectDir, destScript) || destScript,
    hash: hashContent(scriptContent),
    source: '_hooks/version-check.sh',
  });
```

with:

```js
  // Track for manifest (so uninstall can remove later). The manifest is read
  // back against basePath (homedir for user scope, projectDir for project), so
  // record the path relative to the SAME base the uninstaller will resolve.
  const manifestBase = scope === 'project' ? projectDir : homedir();
  createdFiles.push({
    path: relative(manifestBase, destScript) || destScript,
    hash: hashContent(scriptContent),
    source: '_hooks/version-check.sh',
  });
```

(`homedir` is already imported at the top of `src/install.js`.)

- [ ] **Step 3: Verify the round-trip and the install suite**

Run: `node --test tests/install-uninstall-roundtrip.test.js tests/install.test.js 2>&1 | grep -E "^ℹ (pass|fail)"`
Expected: `ℹ fail 0` (the dashboard-bundle failures are environmental and unrelated; if present, confirm they are the same two as on a clean tree — see design §Audit notes).

- [ ] **Step 4: Commit**

```bash
git add src/install.js
git commit -m "fix(install): record hook manifest path relative to the resolved base (user scope)"
```

---

### Task 5: Document the parity rule in CLAUDE.md

Add three sections to `CLAUDE.md`, preserving all existing content. Append them after the existing "Rastreamento de iniciativas" section.

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Append the three sections**

Add at the end of `CLAUDE.md`:

```markdown
## Install / Uninstall parity (HARD RULE)

Every persistent mutation the installer (`src/install.js`) makes MUST have a
matching reversal in the uninstaller (`src/uninstall.js`), OR be listed in the
allowlist below. This is enforced by a test, not by discipline alone.

**Enforcer:** `tests/install-uninstall-roundtrip.test.js` installs everything
into a tmp `$HOME`/repo, uninstalls, and asserts the filesystem returns to its
pre-install state. Any residue not in the allowlist fails the test. When you add
an install action, this test fails until you add its reversal — that is the gate.

**Allowlist (deliberate residue, never reversed):**
- `.gitignore` `.atomic-skills/` line (project scope) — safety against
  re-introducing `.atomic-skills/` into git on a reinstall.
- `~/.aideck/` — the user's own provisioned plans/initiatives (data, not an
  install artifact).

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
| `SessionStart` entry in `settings.json` (merge) | `removeAutoUpdateHook` (surgical; deletes the file if it became empty) |
| `manifest.json` | unlink + prune |
| `.gitignore` line, `~/.aideck/` | allowlist — not reversed |
```

- [ ] **Step 2: Verify it renders / no broken structure**

Run: `head -60 CLAUDE.md | tail -30`
Expected: the new sections appear cleanly after existing content.

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs(claude): install/uninstall parity HARD RULE + testing + reversal map"
```

---

### Task 6: Reference the rule from AGENTS.md

Add one Cross-Agent Standards item pointing at the CLAUDE.md rule.

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

### Task 7: Final verification

- [ ] **Step 1: Run the full suite**

Run: `npm test 2>&1 | grep -E "^ℹ (tests|pass|fail)"`
Expected: only the pre-existing environmental failures remain (dashboard bundle not built + aideck cross-repo `context` pending). The round-trip and uninstall tests are green. Confirm the failing test names match the known-environmental set from the design's audit; no new failures.

- [ ] **Step 2: Run hook tests + skill validation**

Run: `npm run test:hooks 2>&1 | tail -1 && npm run validate-skills 2>&1 | tail -1`
Expected: hooks pass; "All N skills valid".

- [ ] **Step 3: Confirm clean tree**

Run: `git status -s`
Expected: only untracked artifacts unrelated to this work (e.g. `.claude/skills/`). All parity work committed.

---

## Self-Review

**Spec coverage:** Component A → Tasks 1+3; Component B → Task 2; Component C → Task 4 (conditional); Component D → Task 5; Component E → Task 6. Allowlist (#7/#8) encoded in `ALLOWED_RESIDUE` (Task 1) and documented (Task 5). All spec sections mapped.

**Placeholder scan:** No TBD/TODO. Every code step shows full code; every run step shows the command and expected output. Task 4 is explicitly conditional with a stated gate, not a placeholder.

**Type consistency:** `snapshotPaths`, `residue`, `withHome`, `ALLOWED_RESIDUE` defined in Task 1 and reused verbatim in Task 3. `removeAutoUpdateHook({ basePath, scope })` signature matches existing source and Task 2 usage. `installAutoUpdateHook` `createdFiles.push` shape preserved in Task 4.
