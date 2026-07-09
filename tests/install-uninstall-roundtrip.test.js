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

function sessionStartCommands(settingsPath) {
  const settings = JSON.parse(readFileSync(settingsPath, 'utf8'));
  return (settings.hooks?.SessionStart ?? [])
    .flatMap((entry) => (entry.hooks ?? []).map((hook) => hook.command))
    .filter((command) => typeof command === 'string');
}

function countVersionCheckHooks(commands) {
  return commands.filter((command) => command.endsWith('version-check.sh')).length;
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

  it('user scope reverts EVERY item across ALL public IDEs (no residue)', async () => {
    // Each IDE writes to a different path tree (.claude, .cursor, .gemini,
    // .codex/.agents, .opencode, .github). Installing all of them at once is
    // the strongest parity proof: ~300+ files, and every one must be reverted.
    const ALL_IDES = ['claude-code', 'cursor', 'gemini', 'codex', 'opencode', 'github-copilot'];
    const fakeHome = mkdtempSync(join(tmpdir(), 'as-rt-home-'));
    const projectDir = mkdtempSync(join(tmpdir(), 'as-rt-proj-'));
    try {
      await withHome(fakeHome, async () => {
        const before = snapshotTree(fakeHome);
        await install(projectDir, { yes: true, ide: ALL_IDES, lang: 'en' });
        await uninstall(projectDir, { scope: 'user', yes: true });
        const { added, removed, modified } = diffTree(before, snapshotTree(fakeHome));
        assert.deepEqual(added, [], `items left without a reversal: ${added.join(', ')}`);
        assert.deepEqual(removed, [], `uninstall deleted pre-existing paths: ${removed.join(', ')}`);
        assert.deepEqual(modified, [], `uninstall modified pre-existing files: ${modified.join(', ')}`);
      });
    } finally {
      rmSync(fakeHome, { recursive: true, force: true });
      rmSync(projectDir, { recursive: true, force: true });
    }
  });

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

  it('project scope returns the repo to baseline with .gitignore left untouched', async () => {
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
        // The installer no longer appends a .atomic-skills/ ignore line, so the
        // repo must return to baseline with NOTHING modified — not even .gitignore.
        assert.deepEqual(modified, [], `nothing may change, incl. .gitignore: ${modified.join(', ')}`);
        assert.equal(
          readFileSync(gitignorePath, 'utf8'),
          gitignoreBefore,
          '.gitignore must be byte-identical to its pre-install content',
        );
      });
    } finally {
      rmSync(fakeHome, { recursive: true, force: true });
      rmSync(repo, { recursive: true, force: true });
    }
  });

  // ─── Adversarial data-safety matrix (F1 T-004) ───
  // These three fixtures lock in the data-safety contract the installer MUST
  // satisfy — proving the round-trip is not just "clean install/uninstall" but
  // survives the cases that destroy user data when reversal is naive. They
  // exercise the CURRENT installer (the kernel effects are wired in at F3); each
  // is the parity contract F3's rewire onto json-merge / refcount / legacy-prune
  // must keep green.

  it('preserves a pre-existing THIRD-PARTY SessionStart hook across install→UPDATE→uninstall', async () => {
    // json-merge data-safety: revert subtracts ONLY the entry the installer
    // merged, never a snapshot — a hook the user already had must survive.
    const fakeHome = mkdtempSync(join(tmpdir(), 'as-rt-home-'));
    const projectDir = mkdtempSync(join(tmpdir(), 'as-rt-proj-'));
    try {
      await withHome(fakeHome, async () => {
        const settingsPath = join(fakeHome, '.claude', 'settings.json');
        mkdirSync(join(settingsPath, '..'), { recursive: true });
        const thirdPartyCmd = '/opt/other-tool/on-start.sh';
        const preExisting = {
          hooks: {
            SessionStart: [
              { matcher: '*', hooks: [{ type: 'command', command: thirdPartyCmd }] },
            ],
          },
        };
        writeFileSync(settingsPath, JSON.stringify(preExisting, null, 2) + '\n');
        const before = snapshotTree(fakeHome);

        await install(projectDir, { yes: true, ide: ['claude-code'], lang: 'en' });

        const mergedCmds = sessionStartCommands(settingsPath);
        assert.ok(mergedCmds.includes(thirdPartyCmd), 'third-party hook present after install');
        assert.equal(
          countVersionCheckHooks(mergedCmds), 1,
          'installer merged exactly one of its own hooks alongside the third party',
        );

        await install(projectDir, { yes: true, ide: ['claude-code'], lang: 'en' }); // UPDATE

        const updatedCmds = sessionStartCommands(settingsPath);
        assert.ok(updatedCmds.includes(thirdPartyCmd), 'third-party hook present after update');
        assert.equal(
          countVersionCheckHooks(updatedCmds), 1,
          'update keeps a single Atomic Skills hook entry',
        );

        await uninstall(projectDir, { scope: 'user', yes: true });

        const { added, removed, modified } = diffTree(before, snapshotTree(fakeHome));
        assert.deepEqual(removed, [], `uninstall deleted user files: ${removed.join(', ')}`);
        assert.deepEqual(added, [], `residue after uninstall: ${added.join(', ')}`);
        assert.deepEqual(modified, [], `settings.json must return byte-for-byte: ${modified.join(', ')}`);
        const afterCmds = sessionStartCommands(settingsPath);
        assert.ok(afterCmds.includes(thirdPartyCmd), 'third-party hook survives uninstall');
        assert.equal(
          countVersionCheckHooks(afterCmds), 0,
          'installer hook removed on uninstall (only the delta subtracted)',
        );
      });
    } finally {
      rmSync(fakeHome, { recursive: true, force: true });
      rmSync(projectDir, { recursive: true, force: true });
    }
  });

  it('refcounts a shared install registry across two owners and heals a crash-retry duplicate', async () => {
    // refcount data-safety: the shared runtime registry (~/.atomic-skills/
    // installs.json) is reclaimed ONLY when the LAST owner leaves; one
    // uninstall of two must NOT orphan the other. The crash window the design
    // calls out (a crashed uninstall-retry that double-appended an owner) is
    // healed because unregisterInstall filters ALL matching entries.
    const fakeHome = mkdtempSync(join(tmpdir(), 'as-rt-home-'));
    const repo = mkdtempSync(join(tmpdir(), 'as-rt-repo-'));
    const userProj = mkdtempSync(join(tmpdir(), 'as-rt-proj-'));
    try {
      execFileSync('git', ['init', '-q'], { cwd: repo });
      await withHome(fakeHome, async () => {
        const before = snapshotTree(fakeHome);
        const installsJson = join(fakeHome, '.atomic-skills', 'installs.json');

        // Owner A (user scope, basePath = $HOME) and owner B (project scope,
        // basePath = repo) both register in the shared $HOME registry.
        await install(userProj, { yes: true, ide: ['claude-code'], lang: 'en' });
        await install(repo, { yes: true, project: true, ide: ['claude-code'], lang: 'en' });
        assert.ok(existsSync(installsJson), 'shared install registry created');
        assert.equal(
          JSON.parse(readFileSync(installsJson, 'utf8')).length, 2,
          'both owners registered',
        );

        // Uninstall owner B: the shared registry must persist (owner A remains).
        await uninstall(repo, { scope: 'project', yes: true });
        assert.ok(existsSync(installsJson), 'registry persists while one owner remains');
        const remaining = JSON.parse(readFileSync(installsJson, 'utf8'));
        assert.equal(remaining.length, 1, 'one owner remains after first uninstall');

        // CRASH SIMULATION: a crashed uninstall-retry left a DUPLICATE owner-A
        // entry in the registry. The filter-based unregister must still reach 0.
        writeFileSync(installsJson, JSON.stringify([...remaining, ...remaining], null, 2) + '\n');

        // Uninstall owner A: count -> 0 -> registry + shared runtime reclaimed.
        await uninstall(userProj, { scope: 'user', yes: true });

        const { added, removed, modified } = diffTree(before, snapshotTree(fakeHome));
        assert.deepEqual(added, [], `residue after last owner left: ${added.join(', ')}`);
        assert.deepEqual(removed, [], `deleted pre-existing paths: ${removed.join(', ')}`);
        assert.deepEqual(modified, [], `modified pre-existing files: ${modified.join(', ')}`);
        assert.ok(
          !existsSync(installsJson),
          'registry removed when last owner leaves, crash-retry duplicate healed',
        );
      });
    } finally {
      rmSync(fakeHome, { recursive: true, force: true });
      rmSync(repo, { recursive: true, force: true });
      rmSync(userProj, { recursive: true, force: true });
    }
  });

  it('preserves an UNSIGNED user file at a legacy namespace path (P3: no proof, no delete)', async () => {
    // legacy-prune data-safety: a file at a legacy path WITHOUT the consumer's
    // frontmatter signature is presumed user-owned and is never deleted — the
    // safelist is the only accepted ownership proof for legacy paths.
    const fakeHome = mkdtempSync(join(tmpdir(), 'as-rt-home-'));
    const projectDir = mkdtempSync(join(tmpdir(), 'as-rt-proj-'));
    try {
      await withHome(fakeHome, async () => {
        // .claude/skills/<ns> is a LEGACY_NAMESPACE_PATH the installer scans for
        // orphan cleanup. This file's `name:` is NOT in the catalog or the
        // historical safelist, so it must be classified user-owned and preserved.
        const legacyFile = join(fakeHome, '.claude', 'skills', 'atomic-skills', 'my-notes.md');
        const legacyContent = '---\nname: my-personal-notes\n---\n\nMy own stuff.\n';
        mkdirSync(join(legacyFile, '..'), { recursive: true });
        writeFileSync(legacyFile, legacyContent);
        const before = snapshotTree(fakeHome);

        await install(projectDir, { yes: true, ide: ['claude-code'], lang: 'en' });
        await uninstall(projectDir, { scope: 'user', yes: true });

        const { added, removed, modified } = diffTree(before, snapshotTree(fakeHome));
        assert.deepEqual(removed, [], `must not delete the unsigned user file: ${removed.join(', ')}`);
        assert.deepEqual(added, [], `residue after uninstall: ${added.join(', ')}`);
        assert.deepEqual(modified, [], `must not modify user files: ${modified.join(', ')}`);
        assert.ok(existsSync(legacyFile), 'unsigned legacy user file survives the round-trip');
        assert.equal(
          readFileSync(legacyFile, 'utf8'), legacyContent,
          'unsigned legacy file is byte-identical',
        );
      });
    } finally {
      rmSync(fakeHome, { recursive: true, force: true });
      rmSync(projectDir, { recursive: true, force: true });
    }
  });

  // ─── Update-path parity (F3 review CRITICAL A) ───
  // The single-install round-trip is necessary but NOT sufficient: the NORMAL
  // upgrade path (a second install before uninstall) is where the runtime-layer
  // effects lose ownership. stageRuntimeArtifacts.apply only records `created`
  // for paths that did not exist before THIS apply, and jsonMerge only records
  // the entries it inserts THIS apply — so on the second install both record an
  // empty before-state, and uninstall (replaying only the latest journal) leaves
  // the hook script + the SessionStart settings entry behind. The fix threads the
  // prior before-state (`previous`) so an update re-records what it owns.
  it('user scope returns to baseline after install→UPDATE→uninstall (no residue)', async () => {
    const fakeHome = mkdtempSync(join(tmpdir(), 'as-rt-home-'));
    const projectDir = mkdtempSync(join(tmpdir(), 'as-rt-proj-'));
    try {
      await withHome(fakeHome, async () => {
        const before = snapshotTree(fakeHome);
        await install(projectDir, { yes: true, ide: ['claude-code'], lang: 'en' });
        await install(projectDir, { yes: true, ide: ['claude-code'], lang: 'en' }); // UPDATE
        await uninstall(projectDir, { scope: 'user', yes: true });
        const { added, removed, modified } = diffTree(before, snapshotTree(fakeHome));
        assert.deepEqual(added, [], `residue after update→uninstall: ${added.join(', ')}`);
        assert.deepEqual(removed, [], `update→uninstall deleted pre-existing: ${removed.join(', ')}`);
        assert.deepEqual(modified, [], `update→uninstall modified pre-existing: ${modified.join(', ')}`);
      });
    } finally {
      rmSync(fakeHome, { recursive: true, force: true });
      rmSync(projectDir, { recursive: true, force: true });
    }
  });

  it('user scope update adopts a byte-identical hook left by an older empty runtime journal', async () => {
    const fakeHome = mkdtempSync(join(tmpdir(), 'as-rt-home-'));
    const projectDir = mkdtempSync(join(tmpdir(), 'as-rt-proj-'));
    const sha = (s) => createHash('sha256').update(s).digest('hex');
    const writeAbs = (rel, content) => {
      const abs = join(fakeHome, rel);
      mkdirSync(join(abs, '..'), { recursive: true });
      writeFileSync(abs, content);
    };
    try {
      await withHome(fakeHome, async () => {
        const hookRel = join('.atomic-skills', 'hooks', 'version-check.sh');
        const hookContent = readFileSync(join(process.cwd(), 'skills', 'shared', 'auto-update-hook', 'version-check.sh'));
        writeAbs(hookRel, hookContent);
        writeAbs(join('.atomic-skills', 'manifest.json'), JSON.stringify({
          version: '2.0.0',
          language: 'en',
          ides: ['claude-code'],
          modules: {},
          effects: [
            { type: 'reconcileFileSet', beforeState: [] },
            { type: 'stageRuntimeArtifacts', beforeState: { created: [] } },
            {
              type: 'jsonMerge',
              beforeState: {
                path: '.claude/settings.json',
                fileCreated: false,
                inserts: [],
                createdContainers: [],
              },
            },
          ],
          files: {},
        }, null, 2) + '\n');

        await install(projectDir, { yes: true, ide: ['claude-code'], lang: 'en' });

        const manifest = JSON.parse(readFileSync(join(fakeHome, '.atomic-skills', 'manifest.json'), 'utf8'));
        const staged = manifest.effects.find((e) => e.type === 'stageRuntimeArtifacts');
        assert.deepEqual(staged.beforeState.created, [hookRel]);
        assert.equal(
          manifest.files[hookRel].installed_hash,
          sha(hookContent),
          'adopted hook is restored to the legacy files map for status readers',
        );
      });
    } finally {
      rmSync(fakeHome, { recursive: true, force: true });
      rmSync(projectDir, { recursive: true, force: true });
    }
  });

  // ─── Legacy-manifest uninstall parity (F3 review CRITICAL B) ───
  // A pre-kernel install (manifest with a `files` map but NO `effects`) uninstalled
  // DIRECTLY through the consumer `uninstall()` — without a prior `install` to
  // migrate it — must still revert. The journal Driver's replayReverse only reads
  // `effects`, so uninstall MUST run migrateLegacyInstall first; otherwise it
  // deletes the manifest (the only ownership ledger) while leaving every installed
  // file orphaned. The proved files revert; a file the user edited after install
  // survives (P3 — the migrated hash is the only accepted ownership proof).
  it('user scope uninstall of a LEGACY manifest reverts proved files and preserves user-edited (P3)', async () => {
    const fakeHome = mkdtempSync(join(tmpdir(), 'as-rt-home-'));
    const projectDir = mkdtempSync(join(tmpdir(), 'as-rt-proj-'));
    const sha = (s) => createHash('sha256').update(s, 'utf8').digest('hex');
    const writeAbs = (rel, content) => {
      const abs = join(fakeHome, rel);
      mkdirSync(join(abs, '..'), { recursive: true });
      writeFileSync(abs, content);
    };
    try {
      await withHome(fakeHome, async () => {
        const provedRel = join('.claude', 'skills', 'atomic-skills', 'proved.md');
        const editedRel = join('.claude', 'skills', 'atomic-skills', 'edited.md');
        const provedContent = '---\nname: proved-skill\n---\n\nproved body\n';
        const editedOriginal = '---\nname: edited-skill\n---\n\noriginal body\n';
        writeAbs(provedRel, provedContent);
        writeAbs(editedRel, editedOriginal);
        // a LEGACY manifest: a `files` map keyed by installed_hash, NO `effects`
        const legacyManifest = {
          version: '0.9.0',
          language: 'en',
          ides: ['claude-code'],
          files: {
            [provedRel]: { installed_hash: sha(provedContent), source: 'skills' },
            [editedRel]: { installed_hash: sha(editedOriginal), source: 'skills' },
          },
          settingsCreated: false,
        };
        writeAbs(join('.atomic-skills', 'manifest.json'),
          JSON.stringify(legacyManifest, null, 2) + '\n');
        // user edits the second file AFTER the original install — must survive (P3)
        writeAbs(editedRel, '---\nname: edited-skill\n---\n\nEDITED by the user\n');

        await uninstall(projectDir, { scope: 'user', yes: true });

        // proved file (disk hash == installed_hash) → reverted
        assert.equal(existsSync(join(fakeHome, provedRel)), false,
          'proved legacy file is reverted (migrated → reconcileFileSet revert)');
        // user-edited proved file (disk hash != installed_hash) → preserved
        assert.equal(existsSync(join(fakeHome, editedRel)), true,
          'user-edited legacy file survives uninstall (P3: no proof-less deletion)');
        assert.equal(
          readFileSync(join(fakeHome, editedRel), 'utf8'),
          '---\nname: edited-skill\n---\n\nEDITED by the user\n',
          'user-edited legacy file is byte-identical',
        );
        // the manifest ledger is reclaimed
        assert.equal(existsSync(join(fakeHome, '.atomic-skills', 'manifest.json')), false,
          'legacy manifest removed after a real reversal');
      });
    } finally {
      rmSync(fakeHome, { recursive: true, force: true });
      rmSync(projectDir, { recursive: true, force: true });
    }
  });
});
