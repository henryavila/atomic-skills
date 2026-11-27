import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import fs, {
  mkdtempSync, rmSync, existsSync, readFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { syncBuiltinESMExports } from 'node:module';
import {
  registerInstall,
  unregisterInstall,
  unregisterAndMaybeReclaimRuntime,
  installRuntimeArtifacts,
  removeRuntimeArtifacts,
} from '../src/install.js';
import { unlinkIfExists } from '../src/runtime-locks.js';
import { isolateHomedir, assertIsolatedHomedir } from './helpers/isolate-homedir.js';

function withHome(fakeHome, fn) {
  const restoreHome = isolateHomedir(fakeHome);
  try {
    assertIsolatedHomedir(fakeHome);
    return fn();
  } finally {
    restoreHome();
  }
}

/**
 * Make the next unlink of the installs registry fail with `code`, leaving every
 * other unlink untouched. syncBuiltinESMExports is what rebinds the named
 * `unlinkSync` imports inside runtime-locks.js / install.js.
 */
function withRegistryUnlinkFailure(home, code, fn) {
  const registryPath = resolve(join(home, '.atomic-skills', 'installs.json'));
  const original = fs.unlinkSync;
  fs.unlinkSync = function injectedUnlink(target, ...rest) {
    if (resolve(String(target)) === registryPath) {
      throw Object.assign(new Error(`injected ${code} unlinking registry`), { code });
    }
    return original.call(this, target, ...rest);
  };
  syncBuiltinESMExports();
  try {
    return fn(registryPath);
  } finally {
    fs.unlinkSync = original;
    syncBuiltinESMExports();
  }
}

describe('cross-install runtime refcount (F-003)', () => {
  it('register is idempotent and unregister reflects the remaining count', () => {
    const home = mkdtempSync(join(tmpdir(), 'as-refcount-'));
    try {
      withHome(home, () => {
        const registry = join(home, '.atomic-skills', 'installs.json');
        registerInstall('/repo/a');
        registerInstall('/repo/a'); // idempotent — no duplicate
        registerInstall(home);      // a user install alongside the project
        {
          const raw = JSON.parse(readFileSync(registry, 'utf8'));
          // P1-B: always versioned schema
          assert.equal(raw.schemaVersion, '1');
          assert.deepEqual(raw.owners.map((o) => o.basePath), ['/repo/a', home]);
          assert.ok(raw.owners.every((o) => o.electable === true && o.packageRoot));
        }

        // Removing the user install while a project install remains: count > 0,
        // so the caller MUST keep the shared runtime (this is the F-003 fix).
        assert.equal(unregisterInstall(home), 1);
        {
          const raw = JSON.parse(readFileSync(registry, 'utf8'));
          assert.deepEqual(raw.owners.map((o) => o.basePath), ['/repo/a']);
        }

        // Removing the last install: count 0 AND the registry file is deleted
        // (so $HOME returns to baseline).
        assert.equal(unregisterInstall('/repo/a'), 0);
        assert.equal(existsSync(registry), false, 'empty registry is removed');
      });
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it('unregister on a missing registry returns 0 (lone pre-registry install)', () => {
    const home = mkdtempSync(join(tmpdir(), 'as-refcount-'));
    try {
      withHome(home, () => {
        assert.equal(unregisterInstall(home), 0);
      });
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it('registry cleanup ignores a missing file but surfaces a real unlink failure', () => {
    const home = mkdtempSync(join(tmpdir(), 'as-refcount-'));
    try {
      assert.doesNotThrow(() => unlinkIfExists(join(home, 'missing.json')));
      assert.throws(
        () => unlinkIfExists(home),
        (err) => err.code !== 'ENOENT',
      );
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it('unregisterInstall propagates a non-ENOENT registry unlink failure', () => {
    const home = mkdtempSync(join(tmpdir(), 'as-refcount-'));
    try {
      withHome(home, () => {
        registerInstall('/repo/a');
        withRegistryUnlinkFailure(home, 'EIO', (registry) => {
          assert.throws(
            () => unregisterInstall('/repo/a'),
            (err) => err.code === 'EIO',
            'a real unlink failure must surface instead of pretending the registry is gone',
          );
          assert.ok(existsSync(registry), 'failed unlink leaves the registry on disk');
        });
      });
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it('unregisterInstall still ignores an ENOENT registry unlink', () => {
    const home = mkdtempSync(join(tmpdir(), 'as-refcount-'));
    try {
      withHome(home, () => {
        registerInstall('/repo/a');
        withRegistryUnlinkFailure(home, 'ENOENT', () => {
          assert.equal(unregisterInstall('/repo/a'), 0);
        });
      });
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it('unregisterAndMaybeReclaimRuntime propagates a non-ENOENT unlink before reclaiming', () => {
    const home = mkdtempSync(join(tmpdir(), 'as-refcount-'));
    try {
      withHome(home, () => {
        registerInstall('/repo/a');
        installRuntimeArtifacts();
        const packageRoot = join(home, '.atomic-skills', 'package-root');
        assert.ok(existsSync(packageRoot));
        withRegistryUnlinkFailure(home, 'EACCES', () => {
          assert.throws(
            () => unregisterAndMaybeReclaimRuntime('/repo/a'),
            (err) => err.code === 'EACCES',
            'a real unlink failure must surface instead of reclaiming the runtime',
          );
        });
        assert.ok(
          existsSync(packageRoot),
          'runtime reclamation must not continue after a failed registry unlink',
        );
      });
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it('unregisterAndMaybeReclaimRuntime still ignores ENOENT and reclaims the runtime', () => {
    const home = mkdtempSync(join(tmpdir(), 'as-refcount-'));
    try {
      withHome(home, () => {
        registerInstall('/repo/a');
        installRuntimeArtifacts();
        const packageRoot = join(home, '.atomic-skills', 'package-root');
        assert.ok(existsSync(packageRoot));
        withRegistryUnlinkFailure(home, 'ENOENT', () => {
          assert.equal(unregisterAndMaybeReclaimRuntime('/repo/a'), 0);
        });
        assert.equal(existsSync(packageRoot), false, 'ENOENT is ignored, so reclaim continues');
      });
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });
});

describe('package-root record for hook detector resolution (F-002)', () => {
  it('install writes ~/.atomic-skills/package-root pointing at a dir with scripts/, uninstall removes it', () => {
    const home = mkdtempSync(join(tmpdir(), 'as-pkgroot-'));
    try {
      withHome(home, () => {
        installRuntimeArtifacts();
        const rec = join(home, '.atomic-skills', 'package-root');
        assert.ok(existsSync(rec), 'package-root recorded on install');
        const pkgRoot = readFileSync(rec, 'utf8').trim();
        assert.ok(
          existsSync(join(pkgRoot, 'package.json')),
          'recorded package-root is this package (scripts resolve with its node_modules)',
        );

        removeRuntimeArtifacts();
        assert.equal(existsSync(rec), false, 'package-root removed on runtime reclaim');
      });
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });
});
