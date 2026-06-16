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

  it('project scope installs + registers the project-status hooks, and uninstall reverts them', async () => {
    const fakeHome = mkdtempSync(join(tmpdir(), 'as-rt-home-'));
    const repo = mkdtempSync(join(tmpdir(), 'as-rt-repo-'));
    try {
      execFileSync('git', ['init', '-q'], { cwd: repo });
      await withHome(fakeHome, async () => {
        await install(repo, { yes: true, project: true, ide: ['claude-code'], lang: 'en' });

        // (a) the three project-status scripts + config.json are staged into the
        // project runtime dir `.atomic-skills/status/hooks/`.
        const hooksDir = join(repo, '.atomic-skills', 'status', 'hooks');
        for (const f of ['session-start.sh', 'stop.sh', 'pre-write.sh', 'config.json']) {
          assert.ok(existsSync(join(hooksDir, f)), `project-status hook staged: ${f}`);
        }

        // (b) settings.local.json registers SessionStart + Stop pointing at the staged hooks.
        const localPath = join(repo, '.claude', 'settings.local.json');
        assert.ok(existsSync(localPath), 'settings.local.json created');
        const local = JSON.parse(readFileSync(localPath, 'utf8'));
        const cmds = (event) => (local.hooks?.[event] || [])
          .flatMap((e) => (e.hooks || []).map((h) => h.command));
        assert.ok(
          cmds('SessionStart').some((c) => c.includes('.atomic-skills/status/hooks/session-start.sh')),
          'SessionStart registers session-start.sh',
        );
        assert.ok(
          cmds('Stop').some((c) => c.includes('.atomic-skills/status/hooks/stop.sh')),
          'Stop registers stop.sh',
        );

        // (c) uninstall reverts the staged files AND the settings.local.json entries.
        await uninstall(repo, { scope: 'project', yes: true });
        assert.ok(!existsSync(hooksDir), 'staged hooks removed on uninstall');
        assert.ok(!existsSync(localPath), 'installer-created settings.local.json removed on uninstall');
      });
    } finally {
      rmSync(fakeHome, { recursive: true, force: true });
      rmSync(repo, { recursive: true, force: true });
    }
  });
});
