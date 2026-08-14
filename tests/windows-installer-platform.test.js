/**
 * Native Windows installer contract: engine windows-noreparse, no fake
 * O_NOFOLLOW=0, real junction refusal, and CI runs a real install round-trip.
 */
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync,
  symlinkSync, lstatSync, constants,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

describe('Windows installer platform', () => {
  it('does not polyfill O_NOFOLLOW/O_DIRECTORY as zero in the product tree', () => {
    const srcDir = join(ROOT, 'src');
    const files = [
      'installer.js',
      'manifest.js',
      'install.js',
    ].map((n) => join(srcDir, n));
    for (const file of files) {
      const text = readFileSync(file, 'utf8');
      assert.doesNotMatch(text, /O_NOFOLLOW['"]?\s*[:=]\s*0/);
      assert.doesNotMatch(text, /O_DIRECTORY['"]?\s*[:=]\s*0/);
    }
  });

  it('selects windows-noreparse on win32 when the kernel has no O_NOFOLLOW', async () => {
    if (process.platform !== 'win32') return;
    if (typeof constants.O_NOFOLLOW === 'number' && constants.O_NOFOLLOW !== 0) return;
    const engine = await import('@henryavila/minimalist-installer');
    engine.resetPathSafetyBackendForTests();
    assert.equal(engine.getPathSafetyBackend().kind, 'windows-noreparse');
  });

  it('refuses a real intermediate junction and leaves the outside sentinel intact', async () => {
    if (process.platform !== 'win32') return;
    const engine = await import('@henryavila/minimalist-installer');
    engine.resetPathSafetyBackendForTests();
    const root = mkdtempSync(join(tmpdir(), 'as-win-junc-'));
    try {
      const base = join(root, 'base');
      const outside = join(root, 'out');
      mkdirSync(base);
      mkdirSync(outside);
      const sentinel = join(outside, 'secret.txt');
      writeFileSync(sentinel, 'SAFE');
      symlinkSync(outside, join(base, 'linked'), 'junction');
      assert.equal(lstatSync(join(base, 'linked')).isSymbolicLink(), true);
      assert.throws(
        () => engine.writeFileNoFollow(base, 'linked/pwned.txt', 'PWNED'),
        (err) => err?.code === 'UNSAFE_PATH_RACE',
      );
      assert.equal(readFileSync(sentinel, 'utf8'), 'SAFE');
      assert.equal(existsSync(join(outside, 'pwned.txt')), false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('keeps a real installer round-trip in the native Windows CI job', () => {
    const workflow = readFileSync(join(ROOT, '.github/workflows/test.yml'), 'utf8');
    const windowsJob = workflow.match(/windows-path-contracts:[\s\S]*?(?=\n  [a-zA-Z][\w-]*:|$)/)?.[0] || '';
    assert.match(windowsJob, /runs-on:\s*windows-latest/);
    assert.match(windowsJob, /tests\/windows-installer-platform\.test\.js/);
    assert.match(windowsJob, /tests\/install-uninstall-roundtrip\.test\.js/);
    assert.doesNotMatch(workflow, /Windows is intentionally out[\s\S]*UNSUPPORTED_PLATFORM/);
  });
});
