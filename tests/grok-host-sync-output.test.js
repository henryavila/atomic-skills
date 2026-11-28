/**
 * Pins the console output of `syncGrokPluginHostAfterInstall` (register and
 * shrink/release paths, English) so the install/grok refactor cannot change
 * user-visible text. Hermetic HOME only; no real `grok` binary is invoked.
 */
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { syncGrokPluginHostAfterInstall } from '../src/install.js';
import { writeManifest } from '../src/manifest.js';
import { isolateHomedir, assertIsolatedHomedir } from './helpers/isolate-homedir.js';

const PLUGIN_REL = '.grok/plugins/atomic-skills';

function withHome(fakeHome, fn) {
  const restoreHome = isolateHomedir(fakeHome);
  try {
    assertIsolatedHomedir(fakeHome);
    return fn();
  } finally {
    restoreHome();
  }
}

function captureLogs(fn) {
  const lines = [];
  const original = console.log;
  console.log = (...args) => { lines.push(args.map(String).join(' ')); };
  try {
    fn();
  } finally {
    console.log = original;
  }
  return lines.map((line) => line.replace(/\u001B\[[0-9;]*m/g, ''));
}

function makeBase(home, name = 'proj') {
  const base = join(home, name);
  mkdirSync(base, { recursive: true });
  return base;
}

function materializePlugin(base) {
  const plugin = join(base, PLUGIN_REL);
  mkdirSync(plugin, { recursive: true });
  writeFileSync(join(plugin, 'plugin.json'), '{"name":"atomic-skills"}\n');
}

function hostOptions(home, overrides = {}) {
  return {
    home,
    env: { HOME: home },
    resolveBin: () => '/fake/grok',
    run: () => ({ status: 0, stdout: 'Installed 1 plugin(s)\n', stderr: '' }),
    ...overrides,
  };
}

describe('grok host sync output', () => {
  it('register path prints registered then already-present isolation', () => {
    const home = mkdtempSync(join(tmpdir(), 'as-grok-out-reg-'));
    try {
      withHome(home, () => {
        const base = makeBase(home);
        materializePlugin(base);
        const opts = hostOptions(home);

        assert.deepEqual(
          captureLogs(() => syncGrokPluginHostAfterInstall(base, ['grok'], 'en', opts)),
          [
            '  Grok plugin host: registered (native).',
            '  Grok: isolated from foreign atomic-skills trees (agents/cursor/claude).',
          ],
        );
        assert.deepEqual(
          captureLogs(() => syncGrokPluginHostAfterInstall(base, ['grok'], 'en', opts)),
          [
            '  Grok plugin host: registered (native).',
            '  Grok: foreign-skills isolation already present.',
          ],
        );
      });
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it('register path prints failed when the package tree is missing', () => {
    const home = mkdtempSync(join(tmpdir(), 'as-grok-out-fail-'));
    try {
      withHome(home, () => {
        const base = makeBase(home);
        const plugin = join(base, PLUGIN_REL);
        assert.deepEqual(
          captureLogs(() => syncGrokPluginHostAfterInstall(base, ['grok'], 'en', hostOptions(home))),
          [
            `  Grok plugin host: failed (plugin package missing at ${plugin}); .grok/plugins/ package remains.`,
            '  Grok: isolated from foreign atomic-skills trees (agents/cursor/claude).',
          ],
        );
      });
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it('shrink last owner prints unregistered and isolation removed', () => {
    const home = mkdtempSync(join(tmpdir(), 'as-grok-out-last-'));
    try {
      withHome(home, () => {
        const base = makeBase(home);
        mkdirSync(join(home, '.grok'), { recursive: true });
        writeFileSync(
          join(home, '.grok', 'config.toml'),
          '[skills]\nignore = ["~/.agents/skills/atomic-skills"]\n',
        );
        const opts = hostOptions(home, { listInstallBases: () => [] });
        assert.deepEqual(
          captureLogs(() => syncGrokPluginHostAfterInstall(base, ['cursor'], 'en', {
            ...opts,
            priorIdes: ['grok'],
          })),
          [
            '  Grok plugin host: unregistered (last owner).',
            '  Grok: foreign-skills isolation removed.',
          ],
        );
      });
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it('shrink with a surviving grok owner prints kept for host and isolation', () => {
    const home = mkdtempSync(join(tmpdir(), 'as-grok-out-keep-'));
    try {
      withHome(home, () => {
        const base = makeBase(home);
        const survivor = makeBase(home, 'survivor');
        materializePlugin(survivor);
        writeManifest(survivor, {
          journalVersion: 2, effects: [], version: '1.0.0', language: 'en', ides: ['grok'],
        });
        const opts = hostOptions(home, {
          listInstallBases: () => [survivor],
          resolveBin: () => null,
        });
        assert.deepEqual(
          captureLogs(() => syncGrokPluginHostAfterInstall(base, ['cursor'], 'en', {
            ...opts,
            priorIdes: ['grok'],
          })),
          [
            '  Grok plugin host: kept (another grok install remains).',
            '  Grok: foreign-skills isolation kept (another grok install remains).',
          ],
        );
      });
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it('shrink prints skipped when the registry scan is untrusted', () => {
    const home = mkdtempSync(join(tmpdir(), 'as-grok-out-skip-'));
    try {
      withHome(home, () => {
        const base = makeBase(home);
        const opts = hostOptions(home, {
          listInstallBases: () => {
            const err = new Error('installs registry untrusted');
            err.code = 'REGISTRY_UNTRUSTED';
            throw err;
          },
        });
        assert.deepEqual(
          captureLogs(() => syncGrokPluginHostAfterInstall(base, ['cursor'], 'en', {
            ...opts,
            priorIdes: ['grok'],
          })),
          ['  Grok plugin host: skipped (registry-untrusted).'],
        );
      });
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it('shrink prints already absent when the host has no plugin entry', () => {
    const home = mkdtempSync(join(tmpdir(), 'as-grok-out-absent-'));
    try {
      withHome(home, () => {
        const base = makeBase(home);
        const opts = hostOptions(home, {
          listInstallBases: () => [],
          run: () => ({ status: 1, stdout: '', stderr: 'plugin not installed\n' }),
        });
        assert.deepEqual(
          captureLogs(() => syncGrokPluginHostAfterInstall(base, ['cursor'], 'en', {
            ...opts,
            priorIdes: ['grok'],
          })),
          ['  Grok plugin host: already absent.'],
        );
      });
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it('shrink prints failed with the host detail when unregister fails', () => {
    const home = mkdtempSync(join(tmpdir(), 'as-grok-out-hostfail-'));
    try {
      withHome(home, () => {
        const base = makeBase(home);
        const opts = hostOptions(home, {
          listInstallBases: () => [],
          run: () => ({ status: 1, stdout: '', stderr: 'boom\n' }),
        });
        assert.deepEqual(
          captureLogs(() => syncGrokPluginHostAfterInstall(base, ['cursor'], 'en', {
            ...opts,
            priorIdes: ['grok'],
          })),
          ['  Grok plugin host: failed (boom).'],
        );
      });
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });
});
