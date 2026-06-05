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
});
