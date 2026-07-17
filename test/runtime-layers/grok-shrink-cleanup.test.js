/**
 * P0-C / F-003: Grok host + isolation cleanup on IDE shrink and uninstall,
 * multi-owner refcount-safe for BOTH host unregister and isolation.
 *
 * Includes P0-C cross-model remediations: fail-closed registry, residual gate,
 * restage honesty, path normalize, non-grok zero host calls.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync,
} from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { join, resolve } from 'node:path';

import {
  hasOtherGrokOwner,
  listKnownInstallBases,
  scanKnownInstallBases,
  releaseGrokOutsideJournal,
  baseHasGrokResidual,
  normalizeInstallBase,
  sameInstallBase,
} from '../../src/runtime-layers/grok-refcount.js';
import {
  applyGrokAgentsIsolation,
  skillsIgnoreContainsAll,
  resolveGrokUserConfigPath,
} from '../../src/runtime-layers/grok-agents-isolation.js';
import { GROK_PLUGIN_NAME, GROK_PLUGIN_PACKAGE_REL } from '../../src/runtime-layers/grok-plugin-host.js';
import {
  syncGrokPluginHostAfterInstall,
  releaseGrokAndUnregisterRuntime,
} from '../../src/install.js';
import { writeManifest, readManifest } from '../../src/manifest.js';
import { uninstall } from '../../src/uninstall.js';

function withTmp(fn) {
  const dir = mkdtempSync(join(tmpdir(), 'grok-shrink-'));
  let result;
  try {
    result = fn(dir);
  } catch (err) {
    rmSync(dir, { recursive: true, force: true });
    throw err;
  }
  if (result && typeof result.then === 'function') {
    return result.finally(() => {
      rmSync(dir, { recursive: true, force: true });
    });
  }
  rmSync(dir, { recursive: true, force: true });
  return result;
}

/** Hermetic HOME for registry writers (install.js uses os.homedir()). */
function withHome(home, fn) {
  const originalHome = process.env.HOME;
  process.env.HOME = home;
  let result;
  try {
    result = fn();
  } catch (err) {
    if (originalHome === undefined) delete process.env.HOME;
    else process.env.HOME = originalHome;
    throw err;
  }
  if (result && typeof result.then === 'function') {
    return result.finally(() => {
      if (originalHome === undefined) delete process.env.HOME;
      else process.env.HOME = originalHome;
    });
  }
  if (originalHome === undefined) delete process.env.HOME;
  else process.env.HOME = originalHome;
  return result;
}

function stagePluginPackage(basePath) {
  const root = join(basePath, GROK_PLUGIN_PACKAGE_REL);
  mkdirSync(join(root, 'skills', 'fix'), { recursive: true });
  writeFileSync(
    join(root, 'plugin.json'),
    JSON.stringify({ name: GROK_PLUGIN_NAME, version: '2.0.0', skills: './skills/' }, null, 2),
  );
  return root;
}

function mockHostRunner(overrides = {}) {
  const calls = [];
  const run = (bin, args) => {
    calls.push({ bin, args: [...args] });
    if (typeof overrides.run === 'function') {
      return overrides.run(bin, args, calls);
    }
    const sub = args[1];
    if (sub === 'install') {
      return { status: 0, stdout: 'Installed 1 plugin(s)\n', stderr: '' };
    }
    if (sub === 'uninstall') {
      return { status: 0, stdout: `Uninstalled 1 plugin(s): ${GROK_PLUGIN_NAME}\n`, stderr: '' };
    }
    return { status: 1, stdout: '', stderr: `unexpected: ${args.join(' ')}` };
  };
  return { calls, run };
}

describe('hasOtherGrokOwner / listKnownInstallBases', () => {
  test('listKnownInstallBases includes home and registry entries', () => {
    withTmp((home) => {
      withHome(home, () => {
        const proj = join(home, 'proj-a');
        mkdirSync(join(home, '.atomic-skills'), { recursive: true });
        writeFileSync(
          join(home, '.atomic-skills', 'installs.json'),
          JSON.stringify([home, proj]),
        );
        const bases = listKnownInstallBases(home);
        assert.ok(bases.some((b) => sameInstallBase(b, home)));
        assert.ok(bases.some((b) => sameInstallBase(b, proj)));
      });
    });
  });

  test('scanKnownInstallBases is untrusted on corrupt registry (fail-closed)', () => {
    withTmp((home) => {
      withHome(home, () => {
        mkdirSync(join(home, '.atomic-skills'), { recursive: true });
        writeFileSync(join(home, '.atomic-skills', 'installs.json'), '{not-json');
        const scan = scanKnownInstallBases(home);
        assert.equal(scan.status, 'untrusted');
        assert.equal(scan.bases.length, 0);
      });
    });
  });

  test('listKnownInstallBases throws on corrupt registry', () => {
    withTmp((home) => {
      withHome(home, () => {
        mkdirSync(join(home, '.atomic-skills'), { recursive: true });
        writeFileSync(join(home, '.atomic-skills', 'installs.json'), '{"no":"owners"}');
        assert.throws(() => listKnownInstallBases(home), /registry/i);
      });
    });
  });

  test('normalizeInstallBase / sameInstallBase treat equivalent paths as equal', () => {
    withTmp((home) => {
      const a = join(home, 'proj');
      mkdirSync(a, { recursive: true });
      assert.equal(sameInstallBase(a, resolve(a, '.')), true);
      assert.equal(normalizeInstallBase(a), normalizeInstallBase(`${a}/`));
    });
  });

  test('hasOtherGrokOwner is false when alone or others lack grok', () => {
    withTmp((home) => {
      writeManifest(home, { effects: [], version: '2.0.0', language: 'en', ides: ['grok'], files: {} });
      const other = join(home, 'other');
      mkdirSync(join(other, '.atomic-skills'), { recursive: true });
      writeManifest(other, { effects: [], version: '2.0.0', language: 'en', ides: ['codex'], files: {} });

      assert.equal(
        hasOtherGrokOwner({
          basePath: home,
          listInstallBases: () => [home, other],
        }),
        false,
      );
    });
  });

  test('hasOtherGrokOwner is true when another base still lists grok', () => {
    withTmp((home) => {
      writeManifest(home, { effects: [], version: '2.0.0', language: 'en', ides: ['grok'], files: {} });
      const other = join(home, 'other');
      mkdirSync(join(other, '.atomic-skills'), { recursive: true });
      writeManifest(other, { effects: [], version: '2.0.0', language: 'en', ides: ['grok'], files: {} });

      assert.equal(
        hasOtherGrokOwner({
          basePath: home,
          listInstallBases: () => [home, other],
        }),
        true,
      );
    });
  });

  test('hasOtherGrokOwner ignores the departing basePath even if its manifest still says grok', () => {
    withTmp((home) => {
      writeManifest(home, { effects: [], version: '2.0.0', language: 'en', ides: ['grok'], files: {} });
      assert.equal(
        hasOtherGrokOwner({
          basePath: home,
          listInstallBases: () => [home],
        }),
        false,
      );
    });
  });

  test('hasOtherGrokOwner matches bases that differ only by trailing slash / resolve form', () => {
    withTmp((home) => {
      const other = join(home, 'other');
      mkdirSync(join(other, '.atomic-skills'), { recursive: true });
      writeManifest(other, { effects: [], version: '2.0.0', language: 'en', ides: ['grok'], files: {} });
      // self listed as `${home}/` should still be excluded
      assert.equal(
        hasOtherGrokOwner({
          basePath: home,
          listInstallBases: () => [`${home}/`, other],
        }),
        true,
      );
    });
  });
});

describe('baseHasGrokResidual', () => {
  test('true when ides includes grok', () => {
    assert.equal(baseHasGrokResidual('/tmp/x', { ides: ['cursor', 'grok'] }), true);
  });

  test('true when package tree residual exists without grok in ides', () => {
    withTmp((home) => {
      stagePluginPackage(home);
      assert.equal(baseHasGrokResidual(home, { ides: ['cursor'] }), true);
    });
  });

  test('false when never had grok and no package tree', () => {
    withTmp((home) => {
      assert.equal(baseHasGrokResidual(home, { ides: ['cursor', 'codex'] }), false);
      assert.equal(baseHasGrokResidual(home, null), false);
    });
  });
});

describe('releaseGrokOutsideJournal — last-owner gate', () => {
  test('last owner: unregisters host and removes isolation', () => {
    withTmp((home) => {
      applyGrokAgentsIsolation({ ides: ['grok'], home });
      const { calls, run } = mockHostRunner();

      const result = releaseGrokOutsideJournal({
        basePath: home,
        home,
        listInstallBases: () => [home],
        run,
        resolveBin: () => '/mock/grok',
        env: { HOME: home },
      });

      assert.equal(result.lastOwner, true);
      assert.equal(result.host.status, 'unregistered');
      assert.equal(result.isolation.status, 'removed');
      assert.ok(calls.some((c) => c.args[1] === 'uninstall'), 'host uninstall invoked');
      const cfg = resolveGrokUserConfigPath({ home });
      if (existsSync(cfg)) {
        assert.ok(!skillsIgnoreContainsAll(readFileSync(cfg, 'utf8')));
      }
    });
  });

  test('multi-owner: keeps host registration and isolation; restages survivor non-destructively', () => {
    withTmp((home) => {
      const a = home;
      const b = join(home, 'proj-b');
      mkdirSync(join(b, '.atomic-skills'), { recursive: true });
      writeManifest(a, { effects: [], version: '2.0.0', language: 'en', ides: ['codex'], files: {} });
      writeManifest(b, { effects: [], version: '2.0.0', language: 'en', ides: ['grok'], files: {} });
      stagePluginPackage(b);
      applyGrokAgentsIsolation({ ides: ['grok'], home });

      const { calls, run } = mockHostRunner({
        run: (_bin, args) => {
          const sub = args[1];
          if (sub === 'install') {
            // Survivor already on host — non-destructive path must not uninstall.
            return { status: 1, stdout: '', stderr: 'already installed' };
          }
          if (sub === 'uninstall') {
            return { status: 0, stdout: 'uninstalled\n', stderr: '' };
          }
          return { status: 1, stdout: '', stderr: 'unexpected' };
        },
      });
      const result = releaseGrokOutsideJournal({
        basePath: a,
        home,
        listInstallBases: () => [a, b],
        run,
        resolveBin: () => '/mock/grok',
        env: { HOME: home },
      });

      assert.equal(result.lastOwner, false);
      assert.equal(result.host.status, 'kept');
      assert.equal(result.host.restage, 'already');
      assert.equal(result.isolation.status, 'kept');
      assert.ok(
        !calls.some((c) => c.args[1] === 'uninstall'),
        'must not unregister host while survivor needs it (non-destructive restage)',
      );
      assert.ok(
        calls.some((c) => c.args[1] === 'install' && String(c.args[c.args.length - 1]).includes(b)),
        'restage install from survivor package',
      );
      assert.ok(skillsIgnoreContainsAll(readFileSync(resolveGrokUserConfigPath({ home }), 'utf8')));
    });
  });

  test('multi-owner keep + restage failure reported as failed (not kept)', () => {
    withTmp((home) => {
      const a = home;
      const b = join(home, 'proj-b');
      mkdirSync(join(b, '.atomic-skills'), { recursive: true });
      writeManifest(b, { effects: [], version: '2.0.0', language: 'en', ides: ['grok'], files: {} });
      // No plugin package on survivor → register fails with package missing
      const { calls, run } = mockHostRunner();
      const result = releaseGrokOutsideJournal({
        basePath: a,
        home,
        listInstallBases: () => [a, b],
        run,
        resolveBin: () => '/mock/grok',
        env: { HOME: home },
      });

      assert.equal(result.lastOwner, false);
      assert.equal(result.host.status, 'failed');
      assert.equal(result.host.restage, 'failed');
      assert.equal(result.isolation.status, 'kept');
      assert.ok(!calls.some((c) => c.args[1] === 'uninstall'));
    });
  });

  test('corrupt registry: release does not unregister host', () => {
    withTmp((home) => {
      withHome(home, () => {
        mkdirSync(join(home, '.atomic-skills'), { recursive: true });
        writeFileSync(join(home, '.atomic-skills', 'installs.json'), 'NOT_JSON{{{');
        applyGrokAgentsIsolation({ ides: ['grok'], home });
        const { calls, run } = mockHostRunner();

        // No listInstallBases inject — forces default fail-closed scan
        const result = releaseGrokOutsideJournal({
          basePath: home,
          home,
          run,
          resolveBin: () => '/mock/grok',
          env: { HOME: home },
        });

        assert.equal(result.lastOwner, false);
        assert.equal(result.host.status, 'skipped');
        assert.match(result.host.detail || '', /registry-untrusted|corrupt|untrusted/i);
        assert.equal(result.isolation.status, 'skipped');
        assert.equal(calls.length, 0, 'no host CLI on untrusted registry');
        assert.ok(skillsIgnoreContainsAll(readFileSync(resolveGrokUserConfigPath({ home }), 'utf8')));
      });
    });
  });

  test('residual after shrink (this base no longer lists grok): last owner still cleans', () => {
    withTmp((home) => {
      // Manifest already shrunk away from grok — residual host/isolation remain.
      writeManifest(home, { effects: [], version: '2.0.0', language: 'en', ides: ['cursor'], files: {} });
      stagePluginPackage(home);
      applyGrokAgentsIsolation({ ides: ['grok'], home });
      const { calls, run } = mockHostRunner();

      assert.equal(baseHasGrokResidual(home, readManifest(home)), true);

      const result = releaseGrokOutsideJournal({
        basePath: home,
        home,
        listInstallBases: () => [home],
        run,
        resolveBin: () => '/mock/grok',
        env: { HOME: home },
      });

      assert.equal(result.lastOwner, true);
      assert.equal(result.host.status, 'unregistered');
      assert.ok(calls.some((c) => c.args[1] === 'uninstall'));
      assert.equal(result.isolation.status, 'removed');
    });
  });
});

describe('syncGrokPluginHostAfterInstall — IDE shrink (P0-C)', () => {
  test('single owner: prior grok → next without grok unregisters host + drops isolation', () => {
    withTmp((home) => {
      withHome(home, () => {
        applyGrokAgentsIsolation({ ides: ['grok'], home });
        stagePluginPackage(home);
        const { calls, run } = mockHostRunner();

        syncGrokPluginHostAfterInstall(home, ['cursor'], 'en', {
          priorIdes: ['grok', 'cursor'],
          home,
          listInstallBases: () => [home],
          run,
          resolveBin: () => '/mock/grok',
          env: { HOME: home },
        });

        assert.ok(
          calls.some((c) => c.args[1] === 'uninstall'),
          'last-owner shrink must unregister host',
        );
        const cfg = resolveGrokUserConfigPath({ home });
        if (existsSync(cfg)) {
          assert.ok(!skillsIgnoreContainsAll(readFileSync(cfg, 'utf8')));
        }
      });
    });
  });

  test('two owners: shrink A without grok keeps host + isolation; last owner B removes both', () => {
    withTmp((home) => {
      withHome(home, () => {
        const a = home;
        const b = join(home, 'proj-b');
        mkdirSync(join(b, '.atomic-skills'), { recursive: true });
        writeManifest(a, { effects: [], version: '2.0.0', language: 'en', ides: ['cursor'], files: {} });
        writeManifest(b, { effects: [], version: '2.0.0', language: 'en', ides: ['grok'], files: {} });
        stagePluginPackage(b);
        applyGrokAgentsIsolation({ ides: ['grok'], home });

        const hostA = mockHostRunner();
        syncGrokPluginHostAfterInstall(a, ['cursor'], 'en', {
          priorIdes: ['grok', 'cursor'],
          home,
          listInstallBases: () => [a, b],
          run: hostA.run,
          resolveBin: () => '/mock/grok',
          env: { HOME: home },
        });

        assert.ok(
          !hostA.calls.some((c) => c.args[1] === 'uninstall'),
          'shrink A must not kill survivor host',
        );
        assert.ok(skillsIgnoreContainsAll(readFileSync(resolveGrokUserConfigPath({ home }), 'utf8')));

        // Last owner leaves (uninstall-equivalent release)
        writeManifest(b, { effects: [], version: '2.0.0', language: 'en', ides: [], files: {} });
        const hostB = mockHostRunner();
        const last = releaseGrokOutsideJournal({
          basePath: b,
          home,
          listInstallBases: () => [a, b],
          run: hostB.run,
          resolveBin: () => '/mock/grok',
          env: { HOME: home },
        });
        assert.equal(last.lastOwner, true);
        assert.equal(last.host.status, 'unregistered');
        assert.equal(last.isolation.status, 'removed');
        assert.ok(hostB.calls.some((c) => c.args[1] === 'uninstall'));
      });
    });
  });

  test('no prior grok → next without grok is a no-op for host cleanup', () => {
    withTmp((home) => {
      const { calls, run } = mockHostRunner();
      syncGrokPluginHostAfterInstall(home, ['cursor'], 'en', {
        priorIdes: ['cursor'],
        home,
        listInstallBases: () => [home],
        run,
        resolveBin: () => '/mock/grok',
        env: { HOME: home },
      });
      assert.equal(calls.length, 0);
    });
  });

  test('next still wants grok → registers (does not release)', () => {
    withTmp((home) => {
      withHome(home, () => {
        stagePluginPackage(home);
        const { calls, run } = mockHostRunner();
        syncGrokPluginHostAfterInstall(home, ['grok'], 'en', {
          priorIdes: ['grok'],
          home,
          run,
          resolveBin: () => '/mock/grok',
          env: { HOME: home },
        });
        assert.ok(calls.some((c) => c.args[1] === 'install'));
        assert.ok(!calls.some((c) => c.args[1] === 'uninstall'));
      });
    });
  });
});

describe('uninstall wiring — residual gate + multi-owner', () => {
  test('uninstall non-grok: zero host CLI calls', async () => {
    await withTmp(async (home) => {
      await withHome(home, async () => {
        // Minimal non-grok project install (manifest only — journal empty is fine for gate)
        const project = join(home, 'proj-codex');
        mkdirSync(join(project, '.atomic-skills'), { recursive: true });
        writeManifest(project, {
          effects: [],
          version: '2.0.0',
          language: 'en',
          ides: ['codex', 'cursor'],
          files: {},
        });
        // Another install still wants grok — must not be disturbed
        const grokOwner = join(home, 'proj-grok');
        mkdirSync(join(grokOwner, '.atomic-skills'), { recursive: true });
        writeManifest(grokOwner, {
          effects: [],
          version: '2.0.0',
          language: 'en',
          ides: ['grok'],
          files: {},
        });
        stagePluginPackage(grokOwner);
        mkdirSync(join(home, '.atomic-skills'), { recursive: true });
        writeFileSync(
          join(home, '.atomic-skills', 'installs.json'),
          JSON.stringify([project, grokOwner]),
        );
        applyGrokAgentsIsolation({ ides: ['grok'], home });

        // Primary assert: residual gate is false → uninstall must not take Grok release path.
        assert.equal(baseHasGrokResidual(project, readManifest(project)), false);

        process.env.ATOMIC_SKILLS_SKIP_GROK_HOST = '1';
        try {
          await uninstall(project, { scope: 'project', yes: true });
        } finally {
          delete process.env.ATOMIC_SKILLS_SKIP_GROK_HOST;
        }

        // Grok owner package + isolation must remain
        assert.ok(existsSync(join(grokOwner, GROK_PLUGIN_PACKAGE_REL, 'plugin.json')));
        assert.ok(skillsIgnoreContainsAll(readFileSync(resolveGrokUserConfigPath({ home }), 'utf8')));
        // Project manifest gone
        assert.equal(readManifest(project), null);
        // Registry no longer lists project (unregister path ran without grok release)
        const reg = JSON.parse(readFileSync(join(home, '.atomic-skills', 'installs.json'), 'utf8'));
        const list = Array.isArray(reg) ? reg : (reg.owners || []).map((o) => o.basePath || o);
        assert.ok(!list.some((p) => sameInstallBase(p, project)));
        assert.ok(list.some((p) => sameInstallBase(p, grokOwner)));
      });
    });
  });

  test('uninstall residual after shrink (ides without grok, package present) still cleans when last owner', async () => {
    await withTmp(async (home) => {
      await withHome(home, async () => {
        const project = join(home, 'proj-residual');
        mkdirSync(join(project, '.atomic-skills'), { recursive: true });
        writeManifest(project, {
          effects: [],
          version: '2.0.0',
          language: 'en',
          ides: ['cursor'], // shrunk away from grok
          files: {},
        });
        stagePluginPackage(project);
        mkdirSync(join(home, '.atomic-skills'), { recursive: true });
        writeFileSync(
          join(home, '.atomic-skills', 'installs.json'),
          JSON.stringify([project]),
        );
        applyGrokAgentsIsolation({ ides: ['grok'], home });
        assert.equal(baseHasGrokResidual(project, readManifest(project)), true);

        const { calls, run } = mockHostRunner();
        // listInstallBases inject is intentionally ignored by the combined path
        // (C3: post-removal snapshot from trusted scan only).
        const released = releaseGrokAndUnregisterRuntime(project, {
          home,
          listInstallBases: () => [project],
          run,
          resolveBin: () => '/mock/grok',
          env: { HOME: home },
          restageSurvivor: false,
        });
        assert.equal(released.lastOwner, true);
        assert.equal(released.host.status, 'unregistered');
        assert.ok(calls.some((c) => c.args[1] === 'uninstall'));
        assert.equal(released.remaining, 0);
        assert.equal(
          existsSync(join(home, '.atomic-skills', 'installs.json')),
          false,
          'last owner registry reclaimed',
        );
      });
    });
  });

  test('P0-C C2: corrupt registry — no registry mutation + no host unregister', () => {
    withTmp((home) => {
      withHome(home, () => {
        const project = join(home, 'proj-corrupt');
        mkdirSync(join(project, '.atomic-skills'), { recursive: true });
        writeManifest(project, {
          effects: [],
          version: '2.0.0',
          language: 'en',
          ides: ['grok'],
          files: {},
        });
        stagePluginPackage(project);
        mkdirSync(join(home, '.atomic-skills'), { recursive: true });
        const corruptBody = 'NOT_JSON{{{';
        const regPath = join(home, '.atomic-skills', 'installs.json');
        writeFileSync(regPath, corruptBody);
        applyGrokAgentsIsolation({ ides: ['grok'], home });

        const { calls, run } = mockHostRunner();
        const released = releaseGrokAndUnregisterRuntime(project, {
          home,
          run,
          resolveBin: () => '/mock/grok',
          env: { HOME: home },
          // Malicious override that would claim "no other owners" and force last-owner
          // unregister if the combined path honored it — must be ignored after untrusted scan.
          listInstallBases: () => [],
        });

        assert.equal(released.host.status, 'skipped');
        assert.match(released.host.detail || '', /registry-untrusted/i);
        assert.equal(released.isolation.status, 'skipped');
        assert.equal(released.lastOwner, false);
        assert.equal(calls.length, 0, 'no host CLI on untrusted registry');
        assert.equal(
          readFileSync(regPath, 'utf8'),
          corruptBody,
          'corrupt registry must not be rewritten',
        );
        assert.ok(skillsIgnoreContainsAll(readFileSync(resolveGrokUserConfigPath({ home }), 'utf8')));
      });
    });
  });

  test('P0-C C1: last-owner host failure keeps basePath in registry', () => {
    withTmp((home) => {
      withHome(home, () => {
        const project = join(home, 'proj-fail-host');
        mkdirSync(join(project, '.atomic-skills'), { recursive: true });
        writeManifest(project, {
          effects: [],
          version: '2.0.0',
          language: 'en',
          ides: ['grok'],
          files: {},
        });
        stagePluginPackage(project);
        mkdirSync(join(home, '.atomic-skills'), { recursive: true });
        writeFileSync(
          join(home, '.atomic-skills', 'installs.json'),
          JSON.stringify([project]),
        );
        applyGrokAgentsIsolation({ ides: ['grok'], home });

        const { calls, run } = mockHostRunner({
          run: (_bin, args) => {
            if (args[1] === 'uninstall') {
              return { status: 1, stdout: '', stderr: 'host busy / half-applied' };
            }
            return { status: 1, stdout: '', stderr: 'unexpected' };
          },
        });

        const released = releaseGrokAndUnregisterRuntime(project, {
          home,
          run,
          resolveBin: () => '/mock/grok',
          env: { HOME: home },
        });

        assert.equal(released.lastOwner, true);
        assert.equal(released.host.status, 'failed');
        assert.ok(calls.some((c) => c.args[1] === 'uninstall'));
        // Registry must still list project so a later retry can re-attempt release.
        const reg = JSON.parse(readFileSync(join(home, '.atomic-skills', 'installs.json'), 'utf8'));
        const list = Array.isArray(reg) ? reg : (reg.owners || []).map((o) => o.basePath || o);
        assert.ok(
          list.some((p) => sameInstallBase(p, project)),
          'last-owner host failure must not drop registry ownership',
        );
        assert.equal(released.remaining, 1);
      });
    });
  });

  test('P0-C C1 fail-open: last-owner binary missing still unregisters registry', () => {
    withTmp((home) => {
      withHome(home, () => {
        const project = join(home, 'proj-no-bin');
        mkdirSync(join(project, '.atomic-skills'), { recursive: true });
        writeManifest(project, {
          effects: [],
          version: '2.0.0',
          language: 'en',
          ides: ['grok'],
          files: {},
        });
        stagePluginPackage(project);
        mkdirSync(join(home, '.atomic-skills'), { recursive: true });
        writeFileSync(
          join(home, '.atomic-skills', 'installs.json'),
          JSON.stringify([project]),
        );

        const { calls, run } = mockHostRunner();
        const released = releaseGrokAndUnregisterRuntime(project, {
          home,
          run,
          resolveBin: () => null, // fail-open: binary gone
          env: { HOME: home },
        });

        assert.equal(released.lastOwner, true);
        assert.equal(released.host.status, 'skipped');
        assert.equal(calls.length, 0);
        assert.equal(released.remaining, 0);
        assert.equal(existsSync(join(home, '.atomic-skills', 'installs.json')), false);
      });
    });
  });

  test('P0-C C3: multi-owner uses post-removal remainingBases (survivor kept); caller listInstallBases ignored', () => {
    withTmp((home) => {
      withHome(home, () => {
        const a = join(home, 'proj-a');
        const b = join(home, 'proj-b');
        for (const p of [a, b]) {
          mkdirSync(join(p, '.atomic-skills'), { recursive: true });
          writeManifest(p, {
            effects: [],
            version: '2.0.0',
            language: 'en',
            ides: ['grok'],
            files: {},
          });
          stagePluginPackage(p);
        }
        mkdirSync(join(home, '.atomic-skills'), { recursive: true });
        writeFileSync(
          join(home, '.atomic-skills', 'installs.json'),
          JSON.stringify([a, b]),
        );
        applyGrokAgentsIsolation({ ides: ['grok'], home });

        const { calls, run } = mockHostRunner({
          run: (_bin, args) => {
            if (args[1] === 'install') {
              return { status: 1, stdout: '', stderr: 'Plugin already installed' };
            }
            if (args[1] === 'uninstall') {
              return { status: 0, stdout: 'uninstalled\n', stderr: '' };
            }
            return { status: 1, stdout: '', stderr: 'unexpected' };
          },
        });

        // Caller claims "no survivors" (empty list) — if honored, would last-owner
        // unregister host and drop isolation. Combined path must force remainingBases
        // from the trusted post-removal snapshot (still includes B).
        const released = releaseGrokAndUnregisterRuntime(a, {
          home,
          listInstallBases: () => [],
          run,
          resolveBin: () => '/mock/grok',
          env: { HOME: home },
          restageSurvivor: true,
        });

        assert.equal(released.lastOwner, false, 'survivor B must be visible via remainingBases');
        assert.equal(released.host.status, 'kept');
        assert.ok(!calls.some((c) => c.args[1] === 'uninstall'), 'must not host-uninstall while B remains');
        assert.equal(released.remaining, 1);
        const reg = JSON.parse(readFileSync(join(home, '.atomic-skills', 'installs.json'), 'utf8'));
        // P1-B: registry is versioned { owners:[{basePath,...}] } (legacy array also accepted)
        const list = Array.isArray(reg)
          ? reg
          : (reg.owners || []).map((o) => (typeof o === 'string' ? o : o.basePath));
        assert.ok(!list.some((p) => sameInstallBase(p, a)), 'A finalized out of registry');
        assert.ok(list.some((p) => sameInstallBase(p, b)), 'B remains registered');
        assert.ok(skillsIgnoreContainsAll(readFileSync(resolveGrokUserConfigPath({ home }), 'utf8')));
      });
    });
  });

  test('uninstall multi-owner with real installs.json keeps survivor host', () => {
    withTmp((home) => {
      withHome(home, () => {
        const a = join(home, 'proj-a');
        const b = join(home, 'proj-b');
        for (const p of [a, b]) {
          mkdirSync(join(p, '.atomic-skills'), { recursive: true });
          writeManifest(p, {
            effects: [],
            version: '2.0.0',
            language: 'en',
            ides: ['grok'],
            files: {},
          });
          stagePluginPackage(p);
        }
        mkdirSync(join(home, '.atomic-skills'), { recursive: true });
        writeFileSync(
          join(home, '.atomic-skills', 'installs.json'),
          JSON.stringify([a, b]),
        );
        applyGrokAgentsIsolation({ ides: ['grok'], home });

        const { calls, run } = mockHostRunner({
          run: (_bin, args) => {
            if (args[1] === 'install') {
              return { status: 1, stdout: '', stderr: 'Plugin already installed' };
            }
            if (args[1] === 'uninstall') {
              return { status: 0, stdout: 'uninstalled\n', stderr: '' };
            }
            return { status: 1, stdout: '', stderr: 'unexpected' };
          },
        });

        // Default scan reads real installs.json under hermetic HOME
        const released = releaseGrokAndUnregisterRuntime(a, {
          home,
          run,
          resolveBin: () => '/mock/grok',
          env: { HOME: home },
          restageSurvivor: true,
        });

        assert.equal(released.lastOwner, false);
        assert.equal(released.host.status, 'kept');
        assert.ok(!calls.some((c) => c.args[1] === 'uninstall'));
        assert.equal(released.remaining, 1);
        const reg = JSON.parse(readFileSync(join(home, '.atomic-skills', 'installs.json'), 'utf8'));
        const list = Array.isArray(reg)
          ? reg
          : (reg.owners || []).map((o) => (typeof o === 'string' ? o : o.basePath));
        assert.ok(!list.some((p) => sameInstallBase(p, a)));
        assert.ok(list.some((p) => sameInstallBase(p, b)));
        assert.ok(skillsIgnoreContainsAll(readFileSync(resolveGrokUserConfigPath({ home }), 'utf8')));
      });
    });
  });
});
