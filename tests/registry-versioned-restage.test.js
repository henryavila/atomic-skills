/**
 * P1-B / F-005 — versioned installs registry + package-root restage.
 */
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, existsSync,
} from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  registerInstall,
  unregisterAndMaybeReclaimRuntime,
  readInstallsRegistry,
  discoverPackageIdentity,
  ownerFingerprint,
  restagePackageRootFrom,
  getPackageVersion,
} from '../src/install.js';
import { selectRuntimeOwner, parseInstallsRegistry } from '../src/runtime-observe.js';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');

function withHome(fakeHome, fn) {
  const original = process.env.HOME;
  process.env.HOME = fakeHome;
  try { return fn(); } finally {
    if (original === undefined) delete process.env.HOME;
    else process.env.HOME = original;
  }
}

describe('versioned registry + restage (P1-B / F-005)', () => {
  it('register always writes versioned schema with live package identity', () => {
    const home = mkdtempSync(join(tmpdir(), 'as-reg-ver-'));
    try {
      withHome(home, () => {
        const baseA = join(home, 'proj-a');
        const baseB = join(home, 'proj-b');
        mkdirSync(baseA, { recursive: true });
        mkdirSync(baseB, { recursive: true });
        registerInstall(baseA);
        registerInstall(baseB);

        const regPath = join(home, '.atomic-skills', 'installs.json');
        const raw = JSON.parse(readFileSync(regPath, 'utf8'));
        assert.equal(raw.schemaVersion, '1');
        assert.ok(Array.isArray(raw.owners));
        assert.equal(raw.owners.length, 2);
        for (const o of raw.owners) {
          assert.equal(typeof o.basePath, 'string');
          assert.equal(typeof o.packageRoot, 'string');
          assert.equal(typeof o.version, 'string');
          assert.equal(typeof o.fingerprint, 'string');
          assert.equal(o.electable, true);
          assert.equal(o.fingerprint, ownerFingerprint(o.packageRoot, o.version));
        }
        assert.equal(raw.owners[0].version, getPackageVersion());
      });
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it('two versioned bases: uninstall package-root writer → survivor package-root active', () => {
    const home = mkdtempSync(join(tmpdir(), 'as-reg-restage-'));
    try {
      withHome(home, () => {
        const baseA = join(home, 'a');
        const baseB = join(home, 'b');
        mkdirSync(baseA, { recursive: true });
        mkdirSync(baseB, { recursive: true });

        // Simulate two versioned owners with distinct packageRoots.
        const rootA = join(home, 'pkg-a');
        const rootB = join(home, 'pkg-b');
        for (const r of [rootA, rootB]) {
          mkdirSync(join(r, 'scripts'), { recursive: true });
          writeFileSync(join(r, 'package.json'), JSON.stringify({
            name: '@henryavila/atomic-skills', version: r === rootA ? '1.0.0' : '2.0.0',
          }));
          writeFileSync(join(r, 'scripts', 'detect-completion.js'), '// ok\n');
        }

        const owners = [
          {
            basePath: baseA,
            packageRoot: rootA,
            version: '1.0.0',
            fingerprint: ownerFingerprint(rootA, '1.0.0'),
            electable: true,
          },
          {
            basePath: baseB,
            packageRoot: rootB,
            version: '2.0.0',
            fingerprint: ownerFingerprint(rootB, '2.0.0'),
            electable: true,
          },
        ];
        mkdirSync(join(home, '.atomic-skills'), { recursive: true });
        writeFileSync(
          join(home, '.atomic-skills', 'installs.json'),
          `${JSON.stringify({ schemaVersion: '1', owners }, null, 2)}\n`,
        );
        // Active package-root is A's (last-writer of A earlier).
        writeFileSync(join(home, '.atomic-skills', 'package-root'), `${rootA}\n`);

        const remaining = unregisterAndMaybeReclaimRuntime(baseA);
        assert.equal(remaining, 1);
        const pr = readFileSync(join(home, '.atomic-skills', 'package-root'), 'utf8').trim();
        assert.equal(pr, rootB, 'survivor B package-root restaged');
        const after = readInstallsRegistry();
        assert.equal(after.format, 'versioned');
        assert.equal(after.list.length, 1);
        assert.equal(after.list[0], baseB);
      });
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it('mixed legacy+versioned: legacy non-discoverable is non-electable; versioned wins restage', () => {
    const home = mkdtempSync(join(tmpdir(), 'as-reg-mixed-'));
    try {
      withHome(home, () => {
        const legacyBase = join(home, 'legacy-missing');
        const versionedBase = join(home, 'versioned');
        mkdirSync(versionedBase, { recursive: true });
        // legacyBase intentionally has no package identity on disk

        const rootV = join(home, 'pkg-v');
        mkdirSync(join(rootV, 'scripts'), { recursive: true });
        writeFileSync(join(rootV, 'package.json'), JSON.stringify({
          name: '@henryavila/atomic-skills', version: '3.0.0',
        }));
        writeFileSync(join(rootV, 'scripts', 'detect-completion.js'), '// ok\n');

        // Start as legacy array, then register a live owner → migrates.
        mkdirSync(join(home, '.atomic-skills'), { recursive: true });
        writeFileSync(
          join(home, '.atomic-skills', 'installs.json'),
          JSON.stringify([legacyBase]),
        );
        // Manually append versioned after migration path via register of versionedBase
        // First write a hybrid by register (migrates legacy to non-electable).
        registerInstall(versionedBase);

        const raw = JSON.parse(readFileSync(join(home, '.atomic-skills', 'installs.json'), 'utf8'));
        assert.equal(raw.schemaVersion, '1');
        const legacyOwner = raw.owners.find((o) => o.basePath === legacyBase);
        const verOwner = raw.owners.find((o) => o.basePath === versionedBase);
        assert.ok(legacyOwner);
        assert.equal(legacyOwner.electable, false, 'legacy non-discoverable → non-electable');
        assert.equal(legacyOwner.packageRoot, null, 'never invents packageRoot');
        assert.ok(verOwner);
        assert.equal(verOwner.electable, true);

        // Package-root points at a dead path; restage should pick electable survivor.
        writeFileSync(join(home, '.atomic-skills', 'package-root'), `${join(home, 'dead')}\n`);
        // Force restage path: unregister a third fake owner isn't needed —
        // selectRuntimeOwner should skip non-electable.
        const selected = selectRuntimeOwner(raw.owners, {
          packageRootOnDisk: join(home, 'dead'),
          ghosts: [],
        });
        assert.equal(selected.basePath, versionedBase);
        assert.equal(selected.electable, true);
      });
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it('discoverPackageIdentity never invents a packageRoot that does not exist', () => {
    const home = mkdtempSync(join(tmpdir(), 'as-reg-disc-'));
    try {
      const empty = join(home, 'empty-base');
      mkdirSync(empty, { recursive: true });
      const id = discoverPackageIdentity(empty);
      assert.equal(id.packageRoot, null);
      assert.equal(id.electable, false);
      assert.equal(id.version, null);
      assert.equal(id.fingerprint, null);

      // Fabricated pointer to missing path must not become electable.
      mkdirSync(join(empty, '.atomic-skills'), { recursive: true });
      writeFileSync(join(empty, '.atomic-skills', 'package-root'), `${join(home, 'nope')}\n`);
      const id2 = discoverPackageIdentity(empty);
      assert.equal(id2.electable, false);
      assert.equal(id2.packageRoot, null);

      // Real package checkout at basePath is electable.
      const id3 = discoverPackageIdentity(REPO);
      assert.equal(id3.electable, true);
      assert.equal(id3.packageRoot, REPO);
      assert.ok(id3.version);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it('parseInstallsRegistry marks legacy owners non-electable', () => {
    const parsed = parseInstallsRegistry(JSON.stringify(['/a', '/b']));
    assert.equal(parsed.format, 'legacy');
    assert.ok(parsed.owners.every((o) => o.electable === false));
  });

  it('restagePackageRootFrom refuses missing roots', () => {
    const home = mkdtempSync(join(tmpdir(), 'as-reg-rpr-'));
    try {
      withHome(home, () => {
        assert.equal(restagePackageRootFrom(join(home, 'missing')), false);
        assert.equal(existsSync(join(home, '.atomic-skills', 'package-root')), false);
      });
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });
});
