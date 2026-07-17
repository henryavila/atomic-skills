/**
 * F2/T-004 — status observes versioned runtime owners, ghosts, corruption,
 * zero owners, and runtime mismatch without writing.
 */
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  parseInstallsRegistry,
  selectRuntimeOwner,
  findGhostOwners,
  observeRuntimeRegistry,
} from '../src/runtime-observe.js';

describe('parseInstallsRegistry (F2/T-004)', () => {
  it('parses legacy string array', () => {
    const r = parseInstallsRegistry(JSON.stringify(['/a', '/b']));
    assert.equal(r.format, 'legacy');
    assert.equal(r.corruption, null);
    assert.deepEqual(r.owners.map((o) => o.basePath), ['/a', '/b']);
  });

  it('parses versioned owners with fingerprint', () => {
    const r = parseInstallsRegistry(JSON.stringify({
      schemaVersion: '1',
      owners: [
        {
          basePath: '/home/u',
          packageRoot: '/pkg/v2',
          version: '2.0.0',
          fingerprint: 'fp-aaa',
        },
        {
          basePath: '/repo',
          packageRoot: '/pkg/v1',
          version: '1.9.0',
          fingerprint: 'fp-bbb',
        },
      ],
    }));
    assert.equal(r.format, 'versioned');
    assert.equal(r.schemaVersion, '1');
    assert.equal(r.owners.length, 2);
    assert.equal(r.owners[0].fingerprint, 'fp-aaa');
  });

  it('reports corruption instead of empty list on invalid JSON', () => {
    const r = parseInstallsRegistry('{not-json');
    assert.equal(r.format, 'corrupt');
    assert.ok(r.corruption);
    assert.deepEqual(r.owners, []);
  });

  it('reports corruption for versioned object without owners', () => {
    const r = parseInstallsRegistry(JSON.stringify({ schemaVersion: '1' }));
    assert.equal(r.format, 'corrupt');
    assert.match(r.corruption, /owners/i);
  });

  it('absent/empty is not corruption', () => {
    assert.equal(parseInstallsRegistry(null).format, 'absent');
    assert.equal(parseInstallsRegistry('').format, 'absent');
  });
});

describe('selectRuntimeOwner + ghosts (F2/T-004)', () => {
  it('selects owner matching package-root on disk', () => {
    const owners = [
      { basePath: '/a', packageRoot: '/pkg/old', fingerprint: 'old' },
      { basePath: '/b', packageRoot: '/pkg/new', fingerprint: 'new' },
    ];
    const selected = selectRuntimeOwner(owners, { packageRootOnDisk: '/pkg/new' });
    assert.equal(selected.basePath, '/b');
  });

  it('skips ghosts when electing survivor', () => {
    const owners = [
      { basePath: '/ghost', packageRoot: '/pkg/g', fingerprint: 'g' },
      { basePath: '/live', packageRoot: '/pkg/l', fingerprint: 'l' },
    ];
    const selected = selectRuntimeOwner(owners, {
      ghosts: ['/ghost'],
      packageRootOnDisk: '/pkg/g',
    });
    // package-root matches ghost only — fall through to last live
    assert.equal(selected.basePath, '/live');
  });

  it('returns null when all owners are ghosts or empty', () => {
    assert.equal(selectRuntimeOwner([], {}), null);
    assert.equal(
      selectRuntimeOwner([{ basePath: '/x' }], { ghosts: ['/x'] }),
      null,
    );
  });

  it('findGhostOwners marks missing paths and paths without manifest', () => {
    const owners = [
      { basePath: '/exists-with-manifest' },
      { basePath: '/missing' },
      { basePath: '/exists-no-manifest' },
    ];
    const ghosts = findGhostOwners(owners, {
      existsFn: (p) => p !== '/missing',
      readManifestFn: (p) => (p === '/exists-with-manifest' ? { version: '1' } : null),
    });
    assert.deepEqual(ghosts.sort(), ['/exists-no-manifest', '/missing']);
  });
});

describe('observeRuntimeRegistry read-only (F2/T-004)', () => {
  it('never reports writes and surfaces selected owner from F1 election shape', () => {
    const obs = observeRuntimeRegistry({
      homeDir: '/tmp/unused-home',
      registryRaw: JSON.stringify({
        schemaVersion: '1',
        owners: [
          {
            basePath: '/user',
            packageRoot: '/pkg/v2',
            version: '2.0.0',
            fingerprint: 'fp2',
          },
        ],
      }),
      packageRootFile: '/pkg/v2',
      existsFn: () => true,
      readManifestFn: () => ({ version: '2.0.0' }),
    });
    assert.equal(obs.writes, 0);
    assert.equal(obs.corruption, null);
    assert.equal(obs.selectedOwner.basePath, '/user');
    assert.equal(obs.selectedOwner.fingerprint, 'fp2');
    assert.deepEqual(obs.ghosts, []);
  });

  it('reports ghosts in quarantine list without mutating', () => {
    const obs = observeRuntimeRegistry({
      registryRaw: JSON.stringify({
        schemaVersion: '1',
        owners: [
          { basePath: '/live', packageRoot: '/pkg', fingerprint: 'a' },
          { basePath: '/ghost-path', packageRoot: '/pkg', fingerprint: 'b' },
        ],
      }),
      packageRootFile: '/pkg',
      existsFn: (p) => p === '/live' || p === '/pkg',
      readManifestFn: (p) => (p === '/live' ? { version: '1' } : null),
    });
    assert.deepEqual(obs.ghosts, ['/ghost-path']);
    assert.equal(obs.selectedOwner.basePath, '/live');
    assert.equal(obs.writes, 0);
  });

  it('corruption is not reduced to empty silent owners', () => {
    const obs = observeRuntimeRegistry({
      registryRaw: 'NOT_JSON{{{',
      packageRootFile: null,
    });
    assert.equal(obs.format, 'corrupt');
    assert.ok(obs.corruption);
    assert.deepEqual(obs.owners, []);
    assert.equal(obs.selectedOwner, null);
  });

  it('zero owners is explicit', () => {
    const obs = observeRuntimeRegistry({
      registryRaw: JSON.stringify({ schemaVersion: '1', owners: [] }),
      packageRootFile: null,
    });
    assert.equal(obs.owners.length, 0);
    assert.equal(obs.selectedOwner, null);
    assert.equal(obs.corruption, null);
  });

  it('runtime mismatch when package-root disagrees with selected owner', () => {
    const obs = observeRuntimeRegistry({
      registryRaw: JSON.stringify({
        schemaVersion: '1',
        owners: [
          { basePath: '/a', packageRoot: '/pkg/correct', fingerprint: 'c' },
        ],
      }),
      packageRootFile: '/pkg/wrong',
      existsFn: () => true,
      readManifestFn: () => ({ version: '1' }),
    });
    assert.ok(obs.runtimeMismatch);
    assert.match(obs.runtimeMismatch, /package-root/);
  });
});
