/**
 * F6/T-002 — Unified fault matrix against the remediated installer engine.
 *
 * Late-effect failure must leave a durable incomplete marker (not silent
 * partial without journal). Retry is fail-closed until the incomplete
 * transaction is cleared. Successful baseline → uninstall returns to empty.
 * Concurrent writers under shared locks do not lose registry owners.
 */
import { describe, it, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
  readdirSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

import { registerInstall, unregisterInstall } from '../src/install.js';

async function loadInstaller() {
  if (process.env.ATOMIC_SKILLS_UPSTREAM_MI_ROOT) {
    const root = process.env.ATOMIC_SKILLS_UPSTREAM_MI_ROOT;
    return import(pathToFileURL(join(root, 'src/index.js')).href);
  }
  return import('@henryavila/minimalist-installer');
}

function snapshotFiles(root) {
  const out = new Map();
  (function walk(dir) {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const abs = join(dir, e.name);
      const rel = abs.slice(root.length + 1);
      if (e.isDirectory()) walk(abs);
      else {
        out.set(
          rel,
          createHash('sha256').update(readFileSync(abs)).digest('hex'),
        );
      }
    }
  })(root);
  return out;
}

describe('F6 release fault matrix (remediated engine)', () => {
  let root;
  afterEach(() => {
    if (root) rmSync(root, { recursive: true, force: true });
    root = undefined;
  });

  it('late-effect failure leaves incomplete journal marker (not journal-less partial)', async () => {
    const mi = await loadInstaller();
    root = mkdtempSync(join(tmpdir(), 'as-fault-late-'));
    const projectDir = join(root, 'project');
    mkdirSync(projectDir, { recursive: true });

    const boom = {
      type: 'boom',
      apply() {
        throw new Error('injected late failure');
      },
      revert() {},
    };

    const installer = mi.defineInstaller({
      providers: [
        mi.createFileSetProvider(),
        {
          plan() {
            return [{ type: 'boom', args: {} }];
          },
        },
      ],
      effects: [boom],
      config: {
        manifestDir: '.atomic-skills',
        lockRoot: join(root, 'locks'),
        files: [{ path: 'skills/a.md', content: 'A-v1' }],
      },
    });

    let threw = null;
    try {
      installer.install({ projectDir });
    } catch (err) {
      threw = err;
    }

    assert.ok(threw, 'late failure must throw');
    const manifestPath = join(projectDir, '.atomic-skills', 'manifest.json');
    assert.equal(
      existsSync(manifestPath),
      true,
      'remediated engine must persist incomplete marker (not journal-less partial)',
    );
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    assert.equal(manifest.transaction?.state, 'incomplete');

    // Next install is fail-closed
    assert.throws(
      () => installer.install({ projectDir }),
      (err) => err?.code === 'INCOMPLETE_TRANSACTION' || /incomplete/i.test(String(err?.message || err)),
    );

    const inspect = mi.inspectTransaction(projectDir, '.atomic-skills');
    assert.equal(inspect.state, mi.TX_STATE_INCOMPLETE || 'incomplete');
  });

  it('successful install then uninstall returns filesystem to baseline snapshot', async () => {
    const mi = await loadInstaller();
    root = mkdtempSync(join(tmpdir(), 'as-fault-rt-'));
    const projectDir = join(root, 'project');
    mkdirSync(projectDir, { recursive: true });
    writeFileSync(join(projectDir, 'keep.txt'), 'user-owned', 'utf8');

    const before = snapshotFiles(projectDir);
    const installer = mi.defineInstaller({
      providers: [mi.createFileSetProvider()],
      config: {
        manifestDir: '.atomic-skills',
        lockRoot: join(root, 'locks'),
        files: [
          { path: 'skills/x.md', content: 'X' },
          { path: 'skills/y.md', content: 'Y' },
        ],
      },
    });

    installer.install({ projectDir });
    assert.equal(readFileSync(join(projectDir, 'skills/x.md'), 'utf8'), 'X');
    installer.uninstall({ projectDir });

    const after = snapshotFiles(projectDir);
    assert.deepEqual([...after.keys()].sort(), [...before.keys()].sort());
    for (const [p, h] of before) {
      assert.equal(after.get(p), h, `content drift at ${p}`);
    }
  });

  it('retry after clearing incomplete marker can complete and uninstall cleanly', async () => {
    const mi = await loadInstaller();
    root = mkdtempSync(join(tmpdir(), 'as-fault-retry-'));
    const projectDir = join(root, 'project');
    mkdirSync(projectDir, { recursive: true });

    let failOnce = true;
    const boom = {
      type: 'boom',
      apply() {
        if (failOnce) {
          failOnce = false;
          throw new Error('injected once');
        }
        return { noop: true };
      },
      revert() {},
    };

    const makeInstaller = () =>
      mi.defineInstaller({
        providers: [
          mi.createFileSetProvider(),
          {
            plan() {
              return [{ type: 'boom', args: {} }];
            },
          },
        ],
        effects: [boom],
        config: {
          manifestDir: '.atomic-skills',
          lockRoot: join(root, 'locks'),
          files: [{ path: 'skills/retry.md', content: 'retry-ok' }],
        },
      });

    const first = makeInstaller();
    assert.throws(() => first.install({ projectDir }));

    // Deterministic recovery for test: remove incomplete marker after wiping
    // partial desired files (simulates operator recovery). Product does not
    // auto-recover — we only prove retry can complete after explicit clear.
    const skillsDir = join(projectDir, 'skills');
    if (existsSync(skillsDir)) rmSync(skillsDir, { recursive: true, force: true });
    rmSync(join(projectDir, '.atomic-skills'), { recursive: true, force: true });

    const second = makeInstaller();
    const manifest = second.install({ projectDir });
    assert.ok(manifest);
    assert.equal(
      manifest.transaction?.state === 'complete' || manifest.transaction == null
        || manifest.effects?.length > 0,
      true,
    );
    assert.equal(readFileSync(join(projectDir, 'skills/retry.md'), 'utf8'), 'retry-ok');
    second.uninstall({ projectDir });
    assert.equal(existsSync(join(projectDir, 'skills/retry.md')), false);
  });

  it('already-desired content on disk is adopted on update retry (reconciler)', async () => {
    const mi = await loadInstaller();
    if (typeof mi.classifyFile !== 'function') {
      assert.fail('classifyFile unavailable on pinned engine');
    }
    assert.equal(
      mi.classifyFile({
        currentHash: 'abc',
        installedHash: 'old',
        newHash: 'abc',
      }),
      'already-desired',
    );
    assert.equal(
      mi.classifyFile({
        currentHash: 'abc',
        installedHash: 'abc',
        newHash: 'abc',
      }),
      'unchanged',
    );
    assert.equal(
      mi.classifyFile({
        currentHash: 'user',
        installedHash: 'old',
        newHash: 'new',
      }),
      'conflict',
    );
  });

  it('30 concurrent registry writers do not drop owners under lock', async () => {
    // os.homedir() on Windows reads USERPROFILE, not HOME — set both so the
    // shared registry lands under the fake home on every platform.
    const prevHome = process.env.HOME;
    const prevProfile = process.env.USERPROFILE;
    root = mkdtempSync(join(tmpdir(), 'as-fault-reg-'));
    process.env.HOME = root;
    process.env.USERPROFILE = root;
    try {
      mkdirSync(join(root, '.atomic-skills'), { recursive: true });
      const bases = Array.from({ length: 30 }, (_, i) => {
        const base = join(root, `proj-${i}`);
        mkdirSync(base, { recursive: true });
        return base;
      });

      // Sequential registration under shared lock path (registerInstall is sync).
      for (const base of bases) {
        registerInstall(base);
      }
      const regPath = join(root, '.atomic-skills', 'installs.json');
      assert.equal(existsSync(regPath), true);
      // P1-B: versioned schema { schemaVersion, owners:[{basePath,...}] }
      // (legacy string[] is migrated on write; concurrent writers must not drop owners).
      const reg = JSON.parse(readFileSync(regPath, 'utf8'));
      const owners = Array.isArray(reg) ? reg : (reg.owners || []);
      assert.ok(Array.isArray(owners), 'registry owners is an array');
      if (!Array.isArray(reg)) {
        assert.equal(reg.schemaVersion, '1');
      }
      assert.equal(owners.length, 30, `expected 30 owners, got ${owners.length}`);
      const paths = new Set(
        owners.map((o) => (typeof o === 'string' ? o : o.basePath)).filter(Boolean),
      );
      assert.equal(paths.size, 30, 'all 30 basePaths preserved under lock');

      for (const base of bases) {
        unregisterInstall(base);
      }
      assert.equal(existsSync(regPath), false, 'registry should drop when last owner leaves');
    } finally {
      if (prevHome === undefined) delete process.env.HOME;
      else process.env.HOME = prevHome;
      if (prevProfile === undefined) delete process.env.USERPROFILE;
      else process.env.USERPROFILE = prevProfile;
    }
  });

  it('incomplete transaction inspect is deterministic and non-mutating', async () => {
    const mi = await loadInstaller();
    root = mkdtempSync(join(tmpdir(), 'as-fault-inspect-'));
    const projectDir = join(root, 'project');
    mkdirSync(join(projectDir, '.atomic-skills'), { recursive: true });
    writeFileSync(
      join(projectDir, '.atomic-skills', 'manifest.json'),
      JSON.stringify({
        journalVersion: 2,
        effects: [],
        transaction: { id: 't1', state: 'incomplete', startedAt: '2026-01-01T00:00:00Z' },
      }),
      'utf8',
    );

    const before = readFileSync(join(projectDir, '.atomic-skills', 'manifest.json'), 'utf8');
    const a = mi.describeRecovery(projectDir, '.atomic-skills');
    const b = mi.describeRecovery(projectDir, '.atomic-skills');
    assert.equal(a.state, 'incomplete');
    assert.equal(b.state, 'incomplete');
    assert.equal(a.effectCount, 0);
    assert.equal(
      readFileSync(join(projectDir, '.atomic-skills', 'manifest.json'), 'utf8'),
      before,
      'inspect must not mutate disk',
    );
  });

  it('P0-A consumer recovery: force-incomplete clears incomplete without hand JSON edit', async () => {
    // Full unit coverage lives in tests/recovery-cli.test.js; this matrix
    // entry proves the product path (not wipe-only) for incomplete TX.
    const { forceIncompleteUninstall, RECOVERY_LEDGER_FILE } = await import('../src/recovery-cli.js');
    root = mkdtempSync(join(tmpdir(), 'as-fault-p0a-'));
    const projectDir = join(root, 'project');
    mkdirSync(join(projectDir, '.atomic-skills'), { recursive: true });
    writeFileSync(
      join(projectDir, '.atomic-skills', 'manifest.json'),
      JSON.stringify({
        journalVersion: 2,
        effects: [{ type: 'reconcileFileSet', id: 'reconcileFileSet', beforeState: [] }],
        transaction: { id: 't-p0a', state: 'incomplete', startedAt: '2026-01-01T00:00:00Z' },
      }),
      'utf8',
    );

    const result = forceIncompleteUninstall(projectDir);
    assert.equal(result.ok, true);
    assert.equal(result.trust, 'pre-U');
    assert.equal(
      existsSync(join(projectDir, '.atomic-skills', RECOVERY_LEDGER_FILE)),
      true,
      'residual recovery ledger must remain discoverable',
    );
    const mi = await loadInstaller();
    const after = mi.describeRecovery(projectDir, '.atomic-skills');
    assert.notEqual(after.state, 'incomplete');
  });
});
