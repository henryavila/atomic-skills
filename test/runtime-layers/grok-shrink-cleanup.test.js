/**
 * P0-C / F-003: Grok host + isolation cleanup on IDE shrink and uninstall,
 * multi-owner refcount-safe for BOTH host unregister and isolation.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  hasOtherGrokOwner,
  listKnownInstallBases,
  releaseGrokOutsideJournal,
} from '../../src/runtime-layers/grok-refcount.js';
import {
  applyGrokAgentsIsolation,
  skillsIgnoreContainsAll,
  resolveGrokUserConfigPath,
} from '../../src/runtime-layers/grok-agents-isolation.js';
import { GROK_PLUGIN_NAME, GROK_PLUGIN_PACKAGE_REL } from '../../src/runtime-layers/grok-plugin-host.js';
import { syncGrokPluginHostAfterInstall } from '../../src/install.js';
import { writeManifest } from '../../src/manifest.js';

function withTmp(fn) {
  const dir = mkdtempSync(join(tmpdir(), 'grok-shrink-'));
  try {
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
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

function mockHostRunner() {
  const calls = [];
  const run = (bin, args) => {
    calls.push({ bin, args: [...args] });
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
      const proj = join(home, 'proj-a');
      mkdirSync(join(home, '.atomic-skills'), { recursive: true });
      writeFileSync(
        join(home, '.atomic-skills', 'installs.json'),
        JSON.stringify([home, proj]),
      );
      const bases = listKnownInstallBases(home);
      assert.ok(bases.includes(home));
      assert.ok(bases.includes(proj));
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

  test('multi-owner: keeps host registration and isolation; restages survivor', () => {
    withTmp((home) => {
      const a = home;
      const b = join(home, 'proj-b');
      mkdirSync(join(b, '.atomic-skills'), { recursive: true });
      writeManifest(a, { effects: [], version: '2.0.0', language: 'en', ides: ['codex'], files: {} });
      writeManifest(b, { effects: [], version: '2.0.0', language: 'en', ides: ['grok'], files: {} });
      stagePluginPackage(b);
      applyGrokAgentsIsolation({ ides: ['grok'], home });

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
      assert.equal(result.host.status, 'kept');
      assert.equal(result.isolation.status, 'kept');
      assert.ok(
        !calls.some((c) => c.args[1] === 'uninstall'),
        'must not unregister host while survivor needs it',
      );
      // Restage from survivor so host snapshot is not left pointing at departing base
      assert.ok(
        calls.some((c) => c.args[1] === 'install' && String(c.args[c.args.length - 1]).includes(b)),
        'restage install from survivor package',
      );
      assert.ok(skillsIgnoreContainsAll(readFileSync(resolveGrokUserConfigPath({ home }), 'utf8')));
    });
  });

  test('residual after shrink (this base no longer lists grok): last owner still cleans', () => {
    withTmp((home) => {
      // Manifest already shrunk away from grok — residual host/isolation remain.
      writeManifest(home, { effects: [], version: '2.0.0', language: 'en', ides: ['cursor'], files: {} });
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
      assert.ok(calls.some((c) => c.args[1] === 'uninstall'));
      assert.equal(result.isolation.status, 'removed');
    });
  });
});

describe('syncGrokPluginHostAfterInstall — IDE shrink (P0-C)', () => {
  test('single owner: prior grok → next without grok unregisters host + drops isolation', () => {
    withTmp((home) => {
      const originalHome = process.env.HOME;
      process.env.HOME = home;
      try {
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
      } finally {
        if (originalHome === undefined) delete process.env.HOME;
        else process.env.HOME = originalHome;
      }
    });
  });

  test('two owners: shrink A without grok keeps host + isolation; last owner B removes both', () => {
    withTmp((home) => {
      const originalHome = process.env.HOME;
      process.env.HOME = home;
      try {
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
      } finally {
        if (originalHome === undefined) delete process.env.HOME;
        else process.env.HOME = originalHome;
      }
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
      const originalHome = process.env.HOME;
      process.env.HOME = home;
      try {
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
      } finally {
        if (originalHome === undefined) delete process.env.HOME;
        else process.env.HOME = originalHome;
      }
    });
  });
});
