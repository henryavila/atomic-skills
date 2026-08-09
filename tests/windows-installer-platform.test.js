import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { constants, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  prepareMinimalistInstallerPlatform,
  assertWindowsPathHasNoReparsePoints,
} from '../src/minimalist-installer-platform.js';

describe('Windows installer platform support', () => {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');

  it('supplies the zero-valued no-follow flags required by the engine on win32', () => {
    const fakeConstants = {};

    const result = prepareMinimalistInstallerPlatform({
      platform: 'win32',
      fsConstants: fakeConstants,
    });

    assert.equal(result.compatibilityMode, 'windows-reparse-guard');
    assert.equal(fakeConstants.O_NOFOLLOW, 0);
    assert.equal(fakeConstants.O_DIRECTORY, 0);
  });

  it('does not modify filesystem constants outside win32', () => {
    const fakeConstants = {};

    const result = prepareMinimalistInstallerPlatform({
      platform: 'linux',
      fsConstants: fakeConstants,
    });

    assert.equal(result.compatibilityMode, null);
    assert.equal('O_NOFOLLOW' in fakeConstants, false);
    assert.equal('O_DIRECTORY' in fakeConstants, false);
  });

  it('rejects an existing reparse point in a planned destination', () => {
    const visited = [];
    const fakeLstat = (path) => {
      visited.push(path);
      return {
        isSymbolicLink: () => path.endsWith('linked'),
      };
    };

    assert.throws(
      () => assertWindowsPathHasNoReparsePoints('C:\\repo', 'safe/linked/file.md', {
        platform: 'win32',
        lstat: fakeLstat,
      }),
      (err) => err?.code === 'UNSAFE_PATH_RACE' && /reparse point/i.test(err.message),
    );
    assert.deepEqual(visited, ['C:\\repo\\safe', 'C:\\repo\\safe\\linked']);
  });

  it('stops safely at the first missing component', () => {
    const visited = [];
    const fakeLstat = (path) => {
      visited.push(path);
      if (path.endsWith('missing')) {
        const err = new Error('missing');
        err.code = 'ENOENT';
        throw err;
      }
      return { isSymbolicLink: () => false };
    };

    assert.doesNotThrow(() => assertWindowsPathHasNoReparsePoints(
      'C:\\repo',
      'safe/missing/file.md',
      { platform: 'win32', lstat: fakeLstat },
    ));
    assert.deepEqual(visited, ['C:\\repo\\safe', 'C:\\repo\\safe\\missing']);
  });

  it('prepares the real Windows constants before the engine selects a backend', async () => {
    if (process.platform !== 'win32') return;

    prepareMinimalistInstallerPlatform();
    const engine = await import('@henryavila/minimalist-installer');
    engine.resetPathSafetyBackendForTests();

    assert.equal(typeof constants.O_NOFOLLOW, 'number');
    assert.doesNotThrow(() => engine.getPathSafetyBackend());
    assert.equal(engine.getPathSafetyBackend().kind, 'path-nofollow');
  });

  it('routes every production engine import through the Windows guard wrapper', () => {
    const productionFiles = [
      'src/installer.js',
      'src/manifest.js',
      'src/migrate-legacy-install.js',
      'src/recovery-cli.js',
      'src/runtime-layers/auto-update-drop-revert.js',
      'src/runtime-layers/effects/stage-runtime-artifacts.js',
    ];

    for (const relativePath of productionFiles) {
      const source = readFileSync(join(root, relativePath), 'utf8');
      assert.doesNotMatch(
        source,
        /from ['"]@henryavila\/minimalist-installer['"]|import\(['"]@henryavila\/minimalist-installer['"]\)/,
        `${relativePath} bypasses src/minimalist-installer.js`,
      );
    }
  });

  it('keeps a real installer round-trip in the native Windows CI job', () => {
    const workflow = readFileSync(join(root, '.github/workflows/test.yml'), 'utf8');
    const windowsJob = workflow.match(/windows-path-contracts:[\s\S]*?(?=\n  [a-zA-Z][\w-]*:|$)/)?.[0] || '';

    assert.match(windowsJob, /runs-on:\s*windows-latest/);
    assert.match(windowsJob, /tests\/windows-installer-platform\.test\.js/);
    assert.match(windowsJob, /tests\/install-uninstall-roundtrip\.test\.js/);
    assert.doesNotMatch(workflow, /Windows is intentionally out[\s\S]*UNSUPPORTED_PLATFORM/);
  });
});
