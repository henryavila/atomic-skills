/**
 * Pins the Grok host bridge's result objects. Every host command is a fake:
 * these tests never invoke a real `grok` binary.
 */
import { describe, it, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  registerGrokPluginHost,
  unregisterGrokPluginHost,
  resolveGrokBinary,
  resolveGrokPluginPackagePath,
} from '../src/runtime-layers/grok-plugin-host.js';

function hostResult(status, stdout = '', stderr = '') {
  return { status, stdout, stderr };
}

describe('Grok host bridge result contract', () => {
  let root;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'as-grok-host-'));
    const pluginRoot = resolveGrokPluginPackagePath(root);
    mkdirSync(pluginRoot, { recursive: true });
    writeFileSync(join(pluginRoot, 'plugin.json'), '{}\n');
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('reports a clean registration', () => {
    const calls = [];
    const result = registerGrokPluginHost({
      basePath: root,
      env: {},
      resolveBin: () => '/fake/grok',
      run: (bin, args) => {
        calls.push([bin, args]);
        return hostResult(0, 'installed atomic-skills');
      },
    });

    assert.deepEqual(result, { status: 'registered', detail: 'installed atomic-skills' });
    assert.deepEqual(calls, [['/fake/grok', [
      'plugin', 'install', '--trust', resolveGrokPluginPackagePath(root),
    ]]]);
  });

  it('keeps the host registration for a non-destructive restage', () => {
    const result = registerGrokPluginHost({
      basePath: root,
      env: {},
      nonDestructive: true,
      resolveBin: () => '/fake/grok',
      run: () => hostResult(1, '', 'plugin already installed'),
    });

    assert.deepEqual(result, {
      status: 'already',
      detail: 'plugin already installed',
    });
  });

  it('uninstalls then reinstalls a stale host snapshot', () => {
    const calls = [];
    const result = registerGrokPluginHost({
      basePath: root,
      env: {},
      resolveBin: () => '/fake/grok',
      run: (bin, args) => {
        calls.push([bin, args]);
        const command = args.join(' ');
        if (command.startsWith('plugin uninstall')) return hostResult(0, 'uninstalled');
        if (command.startsWith('plugin install')) {
          return calls.length === 1
            ? hostResult(1, '', 'plugin already installed')
            : hostResult(0, 'reinstalled');
        }
        return hostResult(1);
      },
    });

    assert.deepEqual(result, { status: 'updated', detail: 'reinstalled' });
    assert.deepEqual(calls.map(([, args]) => args.slice(0, 2)), [
      ['plugin', 'install'],
      ['plugin', 'uninstall'],
      ['plugin', 'install'],
    ]);
  });

  it('falls back to "already" when the forced reinstall fails', () => {
    let call = 0;
    const result = registerGrokPluginHost({
      basePath: root,
      env: {},
      resolveBin: () => '/fake/grok',
      run: () => {
        call += 1;
        if (call === 1) return hostResult(1, '', 'already installed');
        if (call === 2) return hostResult(0, 'uninstalled');
        return hostResult(1, '', 'reinstall failed');
      },
    });

    assert.deepEqual(result, { status: 'already', detail: 'reinstall failed' });
  });

  it('reports an absent plugin on uninstall, not a failure', () => {
    const result = unregisterGrokPluginHost({
      env: {},
      resolveBin: () => '/fake/grok',
      run: () => hostResult(1, '', 'plugin not found'),
    });

    assert.deepEqual(result, {
      status: 'absent',
      detail: 'plugin not found',
    });
  });

  it('skips when the bridge is disabled', () => {
    const result = registerGrokPluginHost({
      basePath: root,
      env: { ATOMIC_SKILLS_SKIP_GROK_HOST: '1' },
      resolveBin: () => '/fake/grok',
      run: () => assert.fail('host command must not run'),
    });

    assert.deepEqual(result, {
      status: 'skipped',
      detail: 'ATOMIC_SKILLS_SKIP_GROK_HOST set',
    });
  });

  it('resolves GROK_BIN before the bundled binary', () => {
    const explicit = join(root, 'grok-bin');
    writeFileSync(explicit, '');

    assert.equal(
      resolveGrokBinary({ env: { GROK_BIN: explicit }, home: root }),
      explicit,
    );
    assert.equal(existsSync(explicit), true);
  });
});
