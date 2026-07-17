import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  GROK_PLUGIN_NAME,
  GROK_PLUGIN_PACKAGE_REL,
  wantsGrokPluginHost,
  resolveGrokPluginPackagePath,
  registerGrokPluginHost,
  unregisterGrokPluginHost,
} from '../../src/runtime-layers/grok-plugin-host.js';

function withTmp(fn) {
  const dir = mkdtempSync(join(tmpdir(), 'grok-plugin-host-'));
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
    JSON.stringify({ name: GROK_PLUGIN_NAME, version: '2.0.0', skills: './skills/', hooks: './hooks/hooks.json' }, null, 2),
  );
  writeFileSync(join(root, 'skills', 'fix', 'SKILL.md'), '---\nname: fix\n---\n');
  return root;
}

test('wantsGrokPluginHost detects grok in ides', () => {
  assert.equal(wantsGrokPluginHost(['claude-code', 'grok']), true);
  assert.equal(wantsGrokPluginHost(['codex']), false);
  assert.equal(wantsGrokPluginHost(undefined), false);
});

test('resolveGrokPluginPackagePath stays outside Codex .agents tree', () => {
  const p = resolveGrokPluginPackagePath('/home/user');
  assert.equal(p, `/home/user/${GROK_PLUGIN_PACKAGE_REL}`);
  assert.ok(!p.includes('.agents'), 'Grok package must not live under .agents');
  assert.ok(p.includes('.grok/plugins/'), 'Grok package must live under .grok/plugins');
});

test('registerGrokPluginHost skips when grok not selected', () => {
  const calls = [];
  const result = registerGrokPluginHost({
    basePath: '/tmp/x',
    ides: ['codex'],
    run: (bin, args) => {
      calls.push([bin, args]);
      return { status: 0, stdout: '', stderr: '' };
    },
    resolveBin: () => '/usr/bin/grok',
  });
  assert.equal(result.status, 'skipped');
  assert.equal(calls.length, 0);
});

test('registerGrokPluginHost skips when grok binary missing (fail-open)', () => {
  withTmp((base) => {
    stagePluginPackage(base);
    const result = registerGrokPluginHost({
      basePath: base,
      ides: ['grok'],
      resolveBin: () => null,
      run: () => {
        throw new Error('run must not be called');
      },
    });
    assert.equal(result.status, 'skipped');
    assert.match(result.detail || '', /binary not found/i);
  });
});

test('registerGrokPluginHost installs with --trust on package path', () => {
  withTmp((base) => {
    const pluginRoot = stagePluginPackage(base);
    const calls = [];
    const result = registerGrokPluginHost({
      basePath: base,
      ides: ['grok'],
      resolveBin: () => '/mock/grok',
      run: (bin, args) => {
        calls.push([bin, ...args]);
        return { status: 0, stdout: 'Installed 1 plugin(s)\n', stderr: '' };
      },
    });
    assert.equal(result.status, 'registered');
    assert.deepEqual(calls[0], ['/mock/grok', 'plugin', 'install', '--trust', pluginRoot]);
  });
});

test('registerGrokPluginHost reinstalls when already-installed (stale host snapshot)', () => {
  withTmp((base) => {
    const pluginRoot = stagePluginPackage(base);
    const calls = [];
    let installCount = 0;
    const result = registerGrokPluginHost({
      basePath: base,
      ides: ['grok'],
      resolveBin: () => '/mock/grok',
      run: (bin, args) => {
        calls.push(args.join(' '));
        if (args[1] === 'install') {
          installCount += 1;
          // First install hits the host's "already installed"; after uninstall, reinstall succeeds.
          if (installCount === 1) {
            return {
              status: 1,
              stdout: '',
              stderr: "Error: repo 'atomic-skills-5bb91fde' already installed\n",
            };
          }
          return { status: 0, stdout: 'Installed 1 plugin(s)\n', stderr: '' };
        }
        if (args[1] === 'uninstall') {
          return { status: 0, stdout: 'Uninstalled 1 plugin(s): atomic-skills\n', stderr: '' };
        }
        return { status: 1, stdout: '', stderr: `unexpected: ${args.join(' ')}` };
      },
    });
    assert.equal(result.status, 'updated');
    // Must NOT rely on `plugin update` — it no-ops for local snapshots.
    assert.ok(!calls.some((c) => c.includes('plugin update')), 'must not call plugin update');
    assert.equal(calls[0], `plugin install --trust ${pluginRoot}`);
    assert.equal(calls[1], `plugin uninstall ${GROK_PLUGIN_NAME} --confirm`);
    assert.equal(calls[2], `plugin install --trust ${pluginRoot}`);
  });
});

test('registerGrokPluginHost fail-opens when reinstall after already-installed fails', () => {
  withTmp((base) => {
    stagePluginPackage(base);
    const result = registerGrokPluginHost({
      basePath: base,
      ides: ['grok'],
      resolveBin: () => '/mock/grok',
      run: (_bin, args) => {
        if (args[1] === 'install') {
          return {
            status: 1,
            stdout: '',
            stderr: "Error: repo 'atomic-skills-5bb91fde' already installed\n",
          };
        }
        if (args[1] === 'uninstall') {
          return { status: 0, stdout: 'ok\n', stderr: '' };
        }
        return { status: 1, stdout: '', stderr: 'unexpected' };
      },
    });
    // Second install also returns "already installed" → reinstall failed path.
    assert.equal(result.status, 'already');
    assert.match(result.detail || '', /already installed/i);
  });
});

test('unregisterGrokPluginHost uninstalls by plugin name with --confirm', () => {
  const calls = [];
  const result = unregisterGrokPluginHost({
    ides: ['grok'],
    resolveBin: () => '/mock/grok',
    run: (bin, args) => {
      calls.push([bin, ...args]);
      return { status: 0, stdout: 'Uninstalled 1 plugin(s): atomic-skills\n', stderr: '' };
    },
  });
  assert.equal(result.status, 'unregistered');
  assert.deepEqual(calls[0], [
    '/mock/grok',
    'plugin',
    'uninstall',
    GROK_PLUGIN_NAME,
    '--confirm',
  ]);
});

test('unregisterGrokPluginHost treats not-found as absent (idempotent)', () => {
  const result = unregisterGrokPluginHost({
    ides: ['grok'],
    resolveBin: () => '/mock/grok',
    run: () => ({ status: 1, stdout: '', stderr: 'Error: Plugin "atomic-skills" not found.\n' }),
  });
  assert.equal(result.status, 'absent');
});

test('unregisterGrokPluginHost skips when grok not in ides', () => {
  const result = unregisterGrokPluginHost({
    ides: ['codex'],
    resolveBin: () => '/mock/grok',
    run: () => {
      throw new Error('must not run');
    },
  });
  assert.equal(result.status, 'skipped');
});

test('ATOMIC_SKILLS_SKIP_GROK_HOST disables host bridge', () => {
  withTmp((base) => {
    stagePluginPackage(base);
    const result = registerGrokPluginHost({
      basePath: base,
      ides: ['grok'],
      env: { ...process.env, ATOMIC_SKILLS_SKIP_GROK_HOST: '1' },
      resolveBin: () => '/mock/grok',
      run: () => {
        throw new Error('must not run when skip set');
      },
    });
    assert.equal(result.status, 'skipped');
    assert.match(result.detail || '', /SKIP_GROK_HOST/i);
  });
});
