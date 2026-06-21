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
import { install, removeRuntimeArtifacts, installRuntimeArtifacts } from '../src/install.js';
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

/** A throwaway @henryavila/aideck-shaped package dir, so the runtime stage
 *  (shim + client) can be exercised without the published dependency on disk. */
function fakeAideckPkg() {
  const dir = mkdtempSync(join(tmpdir(), 'as-fake-aideck-'));
  mkdirSync(join(dir, 'dist', 'client'), { recursive: true });
  writeFileSync(join(dir, 'dist', 'cli.js'), 'export {}\n');
  writeFileSync(join(dir, 'dist', 'client', 'index.html'), '<!doctype html>\n');
  return dir;
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

// NOTE (T-F3-4 flip): the legacy `removeAutoUpdateHook` was removed. The
// auto-update SessionStart entry is now reverted by the journal's jsonMerge effect
// (Driver.uninstall), and its surgical data-safety contract — a pre-existing
// third-party hook survives, an installer-created settings.json is removed, a
// user's pre-existing one is preserved — is covered by the round-trip test
// ("preserves a pre-existing THIRD-PARTY SessionStart hook"), the runtime-layers
// test (test/runtime-layers/atomic-skills.test.js, auto-update surgical revert),
// and the package's json-merge round-trip test.

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
    const aideckDir = fakeAideckPkg();
    try {
      await withHome(fakeHome, async () => {
        await install(projectDir, { yes: true, ide: ['claude-code'], lang: 'en' });
        // Stage the aideck runtime from a fake package (the published dep is
        // not on disk in CI) so the removal path is exercised.
        installRuntimeArtifacts({ aideckDir });
        assert.ok(existsSync(join(fakeHome, '.atomic-skills', 'bin', 'aideck.mjs')), 'precondition: runtime present');

        await uninstall(projectDir, { scope: 'user', yes: true });

        assert.ok(!existsSync(join(fakeHome, '.atomic-skills', 'bin', 'aideck.mjs')), 'runtime removed on user uninstall');
        assert.ok(!existsSync(join(fakeHome, '.atomic-skills', 'dashboard')), 'dashboard removed');
      });
    } finally {
      rmSync(fakeHome, { recursive: true, force: true });
      rmSync(projectDir, { recursive: true, force: true });
      rmSync(aideckDir, { recursive: true, force: true });
    }
  });

  it('shared runtime survives while ANY install remains, reclaimed only when the LAST goes (F-003 refcount)', async () => {
    const fakeHome = mkdtempSync(join(tmpdir(), 'as-uninst-home-'));
    const repo = mkdtempSync(join(tmpdir(), 'as-uninst-repo-'));
    const aideckDir = fakeAideckPkg();
    const bin = join(fakeHome, '.atomic-skills', 'bin', 'aideck.mjs');
    try {
      execFileSync('git', ['init', '-q'], { cwd: repo });
      await withHome(fakeHome, async () => {
        // Two coexisting installs: a user install AND a project install. Each
        // registers itself in ~/.atomic-skills/installs.json (the refcount).
        await install(repo, { yes: true, ide: ['claude-code'], lang: 'en' });               // user scope
        await install(repo, { yes: true, project: true, ide: ['claude-code'], lang: 'en' }); // project scope
        installRuntimeArtifacts({ aideckDir }); // guarantee the shared bin is staged
        assert.ok(existsSync(bin), 'precondition: shared runtime present');
        assert.ok(existsSync(join(repo, '.atomic-skills', 'manifest.json')), 'precondition: project manifest');
        assert.ok(existsSync(join(fakeHome, '.atomic-skills', 'manifest.json')), 'precondition: user manifest');

        // Removing the project install: the user install still depends on the
        // shared runtime, so it MUST survive (the exact bug F-003 fixes — a
        // single uninstall used to strand the other install).
        await uninstall(repo, { scope: 'project', yes: true });
        assert.ok(!existsSync(join(repo, '.atomic-skills', 'manifest.json')), 'project manifest removed');
        assert.ok(existsSync(bin), 'shared runtime survives while the user install remains');

        // Removing the LAST install reclaims the shared runtime (no residue).
        await uninstall(repo, { scope: 'user', yes: true });
        assert.ok(!existsSync(bin), 'shared runtime reclaimed once the last install is gone');
      });
    } finally {
      rmSync(fakeHome, { recursive: true, force: true });
      rmSync(repo, { recursive: true, force: true });
      rmSync(aideckDir, { recursive: true, force: true });
    }
  });
});
