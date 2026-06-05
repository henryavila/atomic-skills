import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { execFileSync } from 'node:child_process';
import {
  mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync,
  mkdirSync,
} from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { install, removeRuntimeArtifacts, removeAutoUpdateHook } from '../src/install.js';
import { uninstall, pruneEmptyParents } from '../src/uninstall.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

function withHome(fakeHome, fn) {
  const original = process.env.HOME;
  process.env.HOME = fakeHome;
  return Promise.resolve(fn()).finally(() => {
    if (original === undefined) delete process.env.HOME;
    else process.env.HOME = original;
  });
}

const RUNTIME_ARTIFACTS = [
  join('.atomic-skills', 'bin', 'aideck.mjs'),
  join('.atomic-skills', 'dashboard', 'index.html'),
  join('.atomic-skills', 'aideck-consumer', 'manifest.yaml'),
  join('.atomic-skills', 'src', 'provision-consumer.js'),
];

describe('pruneEmptyParents', () => {
  it('walks up multiple empty levels, stopping at basePath', () => {
    const base = mkdtempSync(join(tmpdir(), 'as-prune-'));
    try {
      // base/a/b/c/leaf.txt — after removing leaf, a/b/c should all go.
      const leaf = join(base, 'a', 'b', 'c', 'leaf.txt');
      mkdirSync(join(leaf, '..'), { recursive: true });
      writeFileSync(leaf, 'x');
      rmSync(leaf); // simulate the file removal the loop does before pruning

      pruneEmptyParents(leaf, base);

      assert.ok(!existsSync(join(base, 'a')), 'all empty levels pruned up to basePath');
      assert.ok(existsSync(base), 'basePath itself is never removed');
    } finally {
      rmSync(base, { recursive: true, force: true });
    }
  });

  it('stops at the first non-empty parent', () => {
    const base = mkdtempSync(join(tmpdir(), 'as-prune-'));
    try {
      const leaf = join(base, 'a', 'b', 'leaf.txt');
      mkdirSync(join(leaf, '..'), { recursive: true });
      writeFileSync(leaf, 'x');
      // A sibling keeps a/ non-empty even after b/ empties out.
      writeFileSync(join(base, 'a', 'keep.txt'), 'y');
      rmSync(leaf);

      pruneEmptyParents(leaf, base);

      assert.ok(!existsSync(join(base, 'a', 'b')), 'empty b/ pruned');
      assert.ok(existsSync(join(base, 'a')), 'non-empty a/ preserved');
    } finally {
      rmSync(base, { recursive: true, force: true });
    }
  });

  it('never crosses basePath into a sibling sharing a common prefix', () => {
    const root = mkdtempSync(join(tmpdir(), 'as-prune-'));
    try {
      // basePath = root/proj ; sibling root/proj-backup shares the "proj" prefix.
      const base = join(root, 'proj');
      const sibling = join(root, 'proj-backup');
      mkdirSync(base, { recursive: true });
      mkdirSync(sibling, { recursive: true });
      const leaf = join(base, 'x', 'leaf.txt');
      mkdirSync(join(leaf, '..'), { recursive: true });
      writeFileSync(leaf, 'z');
      rmSync(leaf);

      pruneEmptyParents(leaf, base);

      assert.ok(!existsSync(join(base, 'x')), 'empty dir inside basePath pruned');
      assert.ok(existsSync(base), 'basePath preserved');
      assert.ok(existsSync(sibling), 'prefix-colliding sibling untouched');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe('removeRuntimeArtifacts', () => {
  it('removes the four global runtime artifacts but preserves ~/.aideck user data', async () => {
    const fakeHome = mkdtempSync(join(tmpdir(), 'as-uninst-home-'));
    try {
      await withHome(fakeHome, () => {
        // Seed the runtime artifacts the installer would have created.
        for (const rel of RUNTIME_ARTIFACTS) {
          const abs = join(fakeHome, rel);
          mkdirSync(join(abs, '..'), { recursive: true });
          writeFileSync(abs, 'x');
        }
        // Seed user data that must survive.
        const aideckData = join(fakeHome, '.aideck', 'consumers', 'foo', 'manifest.yaml');
        mkdirSync(join(aideckData, '..'), { recursive: true });
        writeFileSync(aideckData, 'id: foo');

        removeRuntimeArtifacts();

        for (const rel of RUNTIME_ARTIFACTS) {
          assert.ok(!existsSync(join(fakeHome, rel)), `${rel} should be removed`);
        }
        assert.ok(!existsSync(join(fakeHome, '.atomic-skills', 'dashboard')), 'dashboard dir removed');
        assert.ok(!existsSync(join(fakeHome, '.atomic-skills', 'aideck-consumer')), 'consumer dir removed');
        assert.ok(existsSync(aideckData), '~/.aideck user data must be preserved');
      });
    } finally {
      rmSync(fakeHome, { recursive: true, force: true });
    }
  });

  it('is a no-op when artifacts are absent', async () => {
    const fakeHome = mkdtempSync(join(tmpdir(), 'as-uninst-home-'));
    try {
      await withHome(fakeHome, () => {
        assert.doesNotThrow(() => removeRuntimeArtifacts());
      });
    } finally {
      rmSync(fakeHome, { recursive: true, force: true });
    }
  });
});

describe('removeAutoUpdateHook', () => {
  it('removes only the version-check.sh entry and preserves unrelated SessionStart hooks', () => {
    const base = mkdtempSync(join(tmpdir(), 'as-uninst-hook-'));
    try {
      const versionCheck = join(base, '.atomic-skills', 'hooks', 'version-check.sh');
      const settingsPath = join(base, '.claude', 'settings.json');
      mkdirSync(join(settingsPath, '..'), { recursive: true });
      writeFileSync(settingsPath, JSON.stringify({
        hooks: {
          SessionStart: [
            { matcher: '*', hooks: [
              { type: 'command', command: versionCheck },
              { type: 'command', command: '/other/hook.sh' },
            ] },
          ],
        },
        otherSetting: true,
      }, null, 2));

      removeAutoUpdateHook({ basePath: base, scope: 'project' });

      const after = JSON.parse(readFileSync(settingsPath, 'utf8'));
      const commands = (after.hooks?.SessionStart || [])
        .flatMap((e) => e.hooks || []).map((h) => h.command);
      assert.ok(!commands.includes(versionCheck), 'version-check entry removed');
      assert.ok(commands.includes('/other/hook.sh'), 'unrelated hook preserved');
      assert.equal(after.otherSetting, true, 'unrelated settings preserved');
    } finally {
      rmSync(base, { recursive: true, force: true });
    }
  });

  it('prunes the SessionStart matcher entirely when it only held our hook', () => {
    const base = mkdtempSync(join(tmpdir(), 'as-uninst-hook-'));
    try {
      const versionCheck = join(base, '.atomic-skills', 'hooks', 'version-check.sh');
      const settingsPath = join(base, '.claude', 'settings.json');
      mkdirSync(join(settingsPath, '..'), { recursive: true });
      writeFileSync(settingsPath, JSON.stringify({
        hooks: { SessionStart: [{ matcher: '*', hooks: [{ type: 'command', command: versionCheck }] }] },
      }, null, 2));

      removeAutoUpdateHook({ basePath: base, scope: 'project' });

      const after = JSON.parse(readFileSync(settingsPath, 'utf8'));
      assert.ok(!after.hooks?.SessionStart || after.hooks.SessionStart.length === 0,
        'empty SessionStart pruned');
    } finally {
      rmSync(base, { recursive: true, force: true });
    }
  });

  it('is a no-op when settings.json is absent', () => {
    const base = mkdtempSync(join(tmpdir(), 'as-uninst-hook-'));
    try {
      assert.doesNotThrow(() => removeAutoUpdateHook({ basePath: base, scope: 'project' }));
    } finally {
      rmSync(base, { recursive: true, force: true });
    }
  });

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
});

describe('uninstall (integration)', () => {
  it('--yes removes manifest files and manifest without prompting (user scope)', async () => {
    const fakeHome = mkdtempSync(join(tmpdir(), 'as-uninst-home-'));
    const projectDir = mkdtempSync(join(tmpdir(), 'as-uninst-proj-'));
    try {
      await withHome(fakeHome, async () => {
        await install(projectDir, { yes: true, ide: ['claude-code'], lang: 'en' });
        assert.ok(existsSync(join(fakeHome, '.atomic-skills', 'manifest.json')), 'precondition: installed');

        await uninstall(projectDir, { scope: 'user', yes: true });

        assert.ok(!existsSync(join(fakeHome, '.atomic-skills', 'manifest.json')), 'manifest removed');
        assert.ok(!existsSync(join(fakeHome, '.claude/commands/atomic-skills/fix.md')), 'skill file removed');
      });
    } finally {
      rmSync(fakeHome, { recursive: true, force: true });
      rmSync(projectDir, { recursive: true, force: true });
    }
  });

  it('user-scope uninstall removes global runtime artifacts', async () => {
    const fakeHome = mkdtempSync(join(tmpdir(), 'as-uninst-home-'));
    const projectDir = mkdtempSync(join(tmpdir(), 'as-uninst-proj-'));
    try {
      await withHome(fakeHome, async () => {
        await install(projectDir, { yes: true, ide: ['claude-code'], lang: 'en' });
        assert.ok(existsSync(join(fakeHome, '.atomic-skills', 'bin', 'aideck.mjs')), 'precondition: runtime present');

        await uninstall(projectDir, { scope: 'user', yes: true });

        assert.ok(!existsSync(join(fakeHome, '.atomic-skills', 'bin', 'aideck.mjs')), 'runtime removed on user uninstall');
        assert.ok(!existsSync(join(fakeHome, '.atomic-skills', 'dashboard')), 'dashboard removed');
      });
    } finally {
      rmSync(fakeHome, { recursive: true, force: true });
      rmSync(projectDir, { recursive: true, force: true });
    }
  });

  it('project-scope uninstall leaves global runtime artifacts intact', async () => {
    const fakeHome = mkdtempSync(join(tmpdir(), 'as-uninst-home-'));
    const repo = mkdtempSync(join(tmpdir(), 'as-uninst-repo-'));
    try {
      execFileSync('git', ['init', '-q'], { cwd: repo });
      await withHome(fakeHome, async () => {
        await install(repo, { yes: true, project: true, ide: ['claude-code'], lang: 'en' });
        assert.ok(existsSync(join(fakeHome, '.atomic-skills', 'bin', 'aideck.mjs')), 'precondition: runtime present');
        assert.ok(existsSync(join(repo, '.atomic-skills', 'manifest.json')), 'precondition: project manifest');

        await uninstall(repo, { scope: 'project', yes: true });

        assert.ok(!existsSync(join(repo, '.atomic-skills', 'manifest.json')), 'project manifest removed');
        assert.ok(existsSync(join(fakeHome, '.atomic-skills', 'bin', 'aideck.mjs')),
          'global runtime must survive a project-scope uninstall');
      });
    } finally {
      rmSync(fakeHome, { recursive: true, force: true });
      rmSync(repo, { recursive: true, force: true });
    }
  });
});
