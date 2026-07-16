/**
 * F1/T-005 — consumer-facing data safety against the remediated upstream engine.
 *
 * Loads @henryavila/minimalist-installer from ATOMIC_SKILLS_UPSTREAM_MI_ROOT when
 * set (via scripts/test-with-upstream-pack.js), otherwise from the normal
 * resolution path (published 0.1.0 will fail the no-follow assertions).
 */
import { describe, it, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  mkdtempSync, mkdirSync, writeFileSync, readFileSync, symlinkSync, rmSync, existsSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

async function loadInstaller() {
  if (process.env.ATOMIC_SKILLS_UPSTREAM_MI_ROOT) {
    const root = process.env.ATOMIC_SKILLS_UPSTREAM_MI_ROOT;
    return import(pathToFileURL(join(root, 'src/index.js')).href);
  }
  return import('@henryavila/minimalist-installer');
}

describe('installer data safety (consumer)', () => {
  let root;
  afterEach(() => {
    if (root) rmSync(root, { recursive: true, force: true });
    root = undefined;
  });

  it('defineInstaller install refuses leaf symlink escape (sentinel intact)', async () => {
    const mi = await loadInstaller();
    if (typeof mi.PathSafetyError !== 'function' && typeof mi.writeFileNoFollow !== 'function') {
      assert.fail('upstream engine without path-safety exports — run via test-with-upstream-pack.js');
    }

    root = mkdtempSync(join(tmpdir(), 'as-data-safety-'));
    const projectDir = join(root, 'project');
    const outside = join(root, 'outside');
    mkdirSync(join(projectDir, 'dir'), { recursive: true });
    mkdirSync(outside, { recursive: true });
    const sentinel = join(outside, 'secret.txt');
    writeFileSync(sentinel, 'SAFE', 'utf8');
    symlinkSync(sentinel, join(projectDir, 'dir', 'file.txt'));

    const installer = mi.defineInstaller({
      providers: [mi.createFileSetProvider()],
      config: {
        manifestDir: '.atomic-skills',
        lockRoot: join(root, 'locks'),
        files: [{ path: 'dir/file.txt', content: 'PWNED' }],
      },
    });

    assert.throws(
      () => installer.install({ projectDir }),
      (err) => err?.code === 'UNSAFE_PATH_RACE' || /symlink|UNSAFE_PATH/i.test(String(err?.message || err)),
    );
    assert.equal(readFileSync(sentinel, 'utf8'), 'SAFE');
  });

  it('refuses greenfield clobber of unowned pre-existing file', async () => {
    const mi = await loadInstaller();
    root = mkdtempSync(join(tmpdir(), 'as-data-safety-gf-'));
    const projectDir = join(root, 'project');
    mkdirSync(projectDir, { recursive: true });
    writeFileSync(join(projectDir, 'keep.json'), '{"user":true}', 'utf8');

    const installer = mi.defineInstaller({
      providers: [mi.createFileSetProvider()],
      config: {
        manifestDir: '.atomic-skills',
        lockRoot: join(root, 'locks'),
        files: [{ path: 'keep.json', content: '{"installed":true}' }],
      },
    });

    assert.throws(
      () => installer.install({ projectDir }),
      (err) => err?.code === 'GREENFIELD_CONFLICT' || /unowned|clobber/i.test(String(err?.message || err)),
    );
    assert.equal(readFileSync(join(projectDir, 'keep.json'), 'utf8'), '{"user":true}');
  });

  it('round-trip install/uninstall via remediated engine', async () => {
    const mi = await loadInstaller();
    root = mkdtempSync(join(tmpdir(), 'as-data-safety-rt-'));
    const projectDir = join(root, 'project');
    mkdirSync(projectDir, { recursive: true });

    const installer = mi.defineInstaller({
      providers: [mi.createFileSetProvider()],
      config: {
        manifestDir: '.atomic-skills',
        lockRoot: join(root, 'locks'),
        files: [{ path: 'skills/x.md', content: 'X' }],
      },
    });

    const manifest = installer.install({ projectDir });
    assert.equal(readFileSync(join(projectDir, 'skills/x.md'), 'utf8'), 'X');
    assert.ok(manifest.journalVersion >= 2 || manifest.effects?.[0]?.id);
    installer.uninstall({ projectDir });
    assert.equal(existsSync(join(projectDir, 'skills/x.md')), false);
  });
});
