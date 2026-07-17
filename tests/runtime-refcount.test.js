import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  mkdtempSync, rmSync, existsSync, readFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  registerInstall, unregisterInstall, installRuntimeArtifacts, removeRuntimeArtifacts,
} from '../src/install.js';

function withHome(fakeHome, fn) {
  const original = process.env.HOME;
  process.env.HOME = fakeHome;
  try { return fn(); } finally {
    if (original === undefined) delete process.env.HOME;
    else process.env.HOME = original;
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
          existsSync(join(pkgRoot, 'scripts', 'detect-completion.js')),
          'recorded package-root resolves the detector (with its node_modules)',
        );

        removeRuntimeArtifacts();
        assert.equal(existsSync(rec), false, 'package-root removed on runtime reclaim');
      });
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });
});
