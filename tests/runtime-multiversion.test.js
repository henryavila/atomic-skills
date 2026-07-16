/**
 * F2/T-004 — multi-version / multi-owner runtime observation.
 * Read-only: fixtures never require mutation APIs from this phase.
 */
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  observeRuntimeRegistry,
  selectRuntimeOwner,
  parseInstallsRegistry,
} from '../src/runtime-observe.js';

describe('runtime multi-version observation (F2/T-004)', () => {
  const twoOwners = {
    schemaVersion: '1',
    owners: [
      {
        basePath: '/home/user',
        packageRoot: '/cache/atomic-skills@2.0.0',
        version: '2.0.0',
        fingerprint: 'sha-200',
      },
      {
        basePath: '/work/project',
        packageRoot: '/cache/atomic-skills@1.9.0',
        version: '1.9.0',
        fingerprint: 'sha-190',
      },
    ],
  };

  it('exposes both versioned owners and elects by package-root fingerprint', () => {
    const obs = observeRuntimeRegistry({
      registryRaw: JSON.stringify(twoOwners),
      packageRootFile: '/cache/atomic-skills@2.0.0',
      existsFn: (p) => !p.includes('missing'),
      readManifestFn: () => ({ version: 'x' }),
    });
    assert.equal(obs.format, 'versioned');
    assert.equal(obs.owners.length, 2);
    assert.equal(obs.selectedOwner.version, '2.0.0');
    assert.equal(obs.selectedOwner.fingerprint, 'sha-200');
    assert.equal(obs.runtimeMismatch, null);
  });

  it('when last writer is uninstalled (ghost), elects surviving owner', () => {
    const obs = observeRuntimeRegistry({
      registryRaw: JSON.stringify(twoOwners),
      // package-root still points at the ghost's package (H2 last-writer bug surface)
      packageRootFile: '/cache/atomic-skills@1.9.0',
      existsFn: (p) => p === '/home/user' || p.startsWith('/cache/'),
      readManifestFn: (p) => (p === '/home/user' ? { version: '2.0.0' } : null),
    });
    assert.deepEqual(obs.ghosts, ['/work/project']);
    // package-root matches ghost's packageRoot — selected among live may be survivor
    assert.equal(obs.selectedOwner.basePath, '/home/user');
    // package-root still points at the ghost version → mismatch vs live owner root
    assert.ok(
      obs.runtimeMismatch
      || obs.packageRootOnDisk === '/cache/atomic-skills@1.9.0',
      'observer must surface the drift between package-root and surviving owner',
    );
    if (obs.selectedOwner.packageRoot !== obs.packageRootOnDisk) {
      assert.ok(obs.runtimeMismatch);
    }
  });

  it('legacy registry remains observable alongside versioned', () => {
    const legacy = parseInstallsRegistry(JSON.stringify(['/a', '/b']));
    assert.equal(legacy.format, 'legacy');
    const selected = selectRuntimeOwner(legacy.owners, { ghosts: ['/a'] });
    assert.equal(selected.basePath, '/b');
  });

  it('observe always returns writes:0 (read-only contract)', () => {
    const obs = observeRuntimeRegistry({
      registryRaw: JSON.stringify(twoOwners),
      packageRootFile: '/cache/atomic-skills@2.0.0',
      existsFn: () => true,
      readManifestFn: () => ({}),
    });
    assert.equal(obs.writes, 0);
  });
});
