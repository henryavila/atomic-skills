/**
 * CLI-presence independence for scripts/run-host-probes.js.
 *
 * The probes on a developer machine depend on whatever provider CLIs happen to
 * be installed. Every test here drives a branch with executable stubs in a
 * temporary directory put first on PATH (present) or with a PATH that holds no
 * stub at all (absent), so the same branches run on every host. No real
 * provider CLI and no network is used; assertions read the probe's receipt,
 * stdout/stderr or exit code.
 */
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

import { PUBLIC_IDE_IDS } from '../src/config.js';
import { runHostProbes } from '../scripts/run-host-probes.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = join(ROOT, 'scripts/run-host-probes.js');

/** Provider binary used by run-host-probes.js for each host. */
const CLI_BIN = {
  'claude-code': 'claude',
  cursor: 'cursor',
  antigravity: 'agy',
  codex: 'codex',
  opencode: 'opencode',
  grok: 'grok',
};

const OPERATIONAL_IDS = ['antigravity', 'claude-code', 'codex', 'opencode', 'grok'];

function withTemp(fn) {
  const dir = mkdtempSync(join(tmpdir(), 'as-run-host-probes-'));
  try {
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function withPath(value, fn) {
  const previous = process.env.PATH;
  process.env.PATH = value;
  try {
    return fn();
  } finally {
    if (previous === undefined) delete process.env.PATH;
    else process.env.PATH = previous;
  }
}

/** Write a small /bin/sh stub and make it executable. */
function stub(binDir, name, body) {
  const path = join(binDir, name);
  writeFileSync(path, `#!/bin/sh\n${body}\n`);
  chmodSync(path, 0o755);
  return path;
}

/** Stub that answers --version and --help like a real provider CLI. */
function healthyStubBody(bin) {
  return [
    'case "$1" in',
    `  --version) echo "${bin} 9.9.9"; exit 0 ;;`,
    `  *) echo "usage: ${bin} [options]"; exit 0 ;;`,
    'esac',
  ].join('\n');
}

function layoutOnlyHost(id, overrides = {}) {
  return {
    id,
    supportTier: 'layout-only',
    supportDeclared: false,
    justification: `fixture layout-only ${id} used by host probe tests`,
    ...overrides,
  };
}

function operationalHost(id, overrides = {}) {
  return {
    id,
    supportTier: 'operational',
    supportDeclared: true,
    adapter: {
      id: `${id}-fixture`,
      version: '1',
      discovery: 'fixture discovery',
      load: 'fixture load',
      invoke: 'fixture invoke',
    },
    ...overrides,
  };
}

/** Every public IDE id exactly once, layout-only unless overridden. */
function fullHosts(overridesById = {}) {
  return PUBLIC_IDE_IDS.map((id) => overridesById[id] || layoutOnlyHost(id));
}

function writeManifest(dir, hosts) {
  const path = join(dir, 'manifest.json');
  writeFileSync(path, `${JSON.stringify({ schemaVersion: '1', hosts }, null, 2)}\n`);
  return path;
}

function hostEntry(receipt, id) {
  const entry = receipt.hosts.find((host) => host.id === id);
  assert.ok(entry, `receipt is missing host ${id}`);
  return entry;
}

function runCli(args, pathValue) {
  return spawnSync(process.execPath, [SCRIPT, ...args], {
    encoding: 'utf8',
    cwd: ROOT,
    env: { ...process.env, PATH: pathValue },
  });
}

describe('run-host-probes CLI presence branches', () => {
  it('probes every operational host through stubs first on PATH', () => withTemp((dir) => {
    const bin = join(dir, 'bin');
    mkdirSync(bin);
    for (const id of OPERATIONAL_IDS) stub(bin, CLI_BIN[id], healthyStubBody(CLI_BIN[id]));
    const overrides = {};
    for (const id of OPERATIONAL_IDS) overrides[id] = operationalHost(id);
    const manifest = writeManifest(dir, fullHosts(overrides));

    const previousSkip = process.env.ATOMIC_SKILLS_SKIP_GROK_HOST;
    process.env.ATOMIC_SKILLS_SKIP_GROK_HOST = '1';
    let result;
    try {
      result = withPath(`${bin}:/usr/bin:/bin`, () => runHostProbes({ manifest }));
    } finally {
      if (previousSkip === undefined) delete process.env.ATOMIC_SKILLS_SKIP_GROK_HOST;
      else process.env.ATOMIC_SKILLS_SKIP_GROK_HOST = previousSkip;
    }

    assert.equal(result.ok, true, result.errors.join('\n'));
    assert.deepEqual(result.errors, []);
    assert.equal(result.receipt.summary.total, PUBLIC_IDE_IDS.length);
    assert.equal(result.receipt.summary.layoutOk, PUBLIC_IDE_IDS.length);
    assert.equal(result.receipt.summary.operationalClaimed, OPERATIONAL_IDS.length);
    assert.equal(result.receipt.summary.operationalOk, OPERATIONAL_IDS.length);
    assert.equal(result.receipt.summary.layoutOnly, 2);

    for (const id of OPERATIONAL_IDS) {
      const host = hostEntry(result.receipt, id);
      assert.equal(host.cli.present, true, `${id} must be found via the stub`);
      assert.equal(host.cli.version, `${CLI_BIN[id]} 9.9.9`, id);
      assert.equal(host.cli.detail, 'ok', id);
      assert.equal(host.operational.ok, true, id);
      assert.equal(host.operational.discovery, true, id);
      assert.equal(host.operational.load, true, id);
      assert.equal(host.operational.invoke, true, id);
      assert.equal(host.operational.error, undefined, id);
      assert.equal(host.operational.version, `${CLI_BIN[id]} 9.9.9`, id);
    }
    // antigravity keeps the head of its help surface as the probe detail.
    assert.match(hostEntry(result.receipt, 'antigravity').operational.detail, /usage: agy/);
    assert.equal(hostEntry(result.receipt, 'codex').operational.detail, '');
  }));

  it('records a missing operational CLI as a contract failure', () => withTemp((dir) => {
    const empty = join(dir, 'empty');
    mkdirSync(empty);
    const manifest = writeManifest(dir, [operationalHost('codex')]);

    const { ok, receipt, errors } = withPath(empty, () => runHostProbes({ manifest }));

    assert.equal(ok, false);
    assert.ok(
      errors.includes(
        'codex: operational host codex requires CLI present; '
        + 'reclassify to layout-only before candidate',
      ),
      errors.join('\n'),
    );
    const host = hostEntry(receipt, 'codex');
    assert.equal(host.cli.present, false);
    assert.equal(host.cli.version, null);
    assert.equal(host.cli.detail, 'codex not on PATH');
    assert.equal(host.operational.ok, false);
    assert.equal(host.operational.discovery, false);
    assert.equal(host.operational.load, false);
    assert.equal(host.operational.invoke, false);
  }));

  it('records non-zero --version detail and treats silence as absent', () => withTemp((dir) => {
    const bin = join(dir, 'bin');
    mkdirSync(bin);
    // codex: exits 3 but still prints a version line -> present, "exit 3".
    stub(bin, 'codex', [
      'case "$1" in',
      '  --version) echo "codex 0.9.0"; exit 3 ;;',
      '  *) echo "usage: codex"; exit 3 ;;',
      'esac',
    ].join('\n'));
    // cursor: exits 3 with no output at all -> absent, "exit 3".
    stub(bin, 'cursor', [
      'case "$1" in',
      '  --version) exit 3 ;;',
      '  *) exit 3 ;;',
      'esac',
    ].join('\n'));
    const manifest = writeManifest(dir, fullHosts());

    const { ok, receipt } = withPath(`${bin}:/usr/bin:/bin`, () => runHostProbes({ manifest }));

    assert.equal(ok, true);
    const codex = hostEntry(receipt, 'codex');
    assert.equal(codex.cli.present, true);
    assert.equal(codex.cli.version, 'codex 0.9.0');
    assert.equal(codex.cli.detail, 'exit 3');
    // Presence is recorded but never promotes a layout-only host.
    assert.equal(codex.supportTier, 'layout-only');
    assert.equal(codex.operational.skipped, true);
    assert.equal(codex.operational.cliPresent, true);
    assert.equal(codex.operational.cliVersion, 'codex 0.9.0');

    const cursor = hostEntry(receipt, 'cursor');
    assert.equal(cursor.cli.present, false);
    assert.equal(cursor.cli.version, null);
    assert.equal(cursor.cli.detail, 'exit 3');
  }));

  it('fails operational load when --help does not match the host surface', () => withTemp((dir) => {
    const bin = join(dir, 'bin');
    mkdirSync(bin);
    stub(bin, 'codex', [
      'case "$1" in',
      '  --version) echo "codex 1.0.0"; exit 0 ;;',
      '  *) echo "boom"; exit 2 ;;',
      'esac',
    ].join('\n'));
    const manifest = writeManifest(dir, [operationalHost('codex')]);

    const { ok, receipt, errors } = withPath(`${bin}:/usr/bin:/bin`, () => runHostProbes({ manifest }));

    assert.equal(ok, false);
    assert.ok(errors.includes('codex: discovery/load/invoke incomplete for codex'), errors.join('\n'));
    const host = hostEntry(receipt, 'codex');
    assert.equal(host.cli.present, true);
    assert.equal(host.operational.discovery, true);
    assert.equal(host.operational.load, false);
    assert.equal(host.operational.invoke, false);
    assert.equal(host.operational.ok, false);
    assert.equal(host.operational.error, 'discovery/load/invoke incomplete for codex');
  }));

  it('fails operational probe for a host without a help-surface rule', () => withTemp((dir) => {
    const bin = join(dir, 'bin');
    mkdirSync(bin);
    stub(bin, 'cursor', healthyStubBody('cursor'));
    const manifest = writeManifest(dir, [operationalHost('cursor')]);

    const { ok, receipt, errors } = withPath(`${bin}:/usr/bin:/bin`, () => runHostProbes({ manifest }));

    assert.equal(ok, false);
    assert.ok(
      errors.includes('cursor: operational probe not defined for cursor'),
      errors.join('\n'),
    );
    const host = hostEntry(receipt, 'cursor');
    assert.equal(host.cli.present, true);
    assert.equal(host.operational.ok, false);
    assert.equal(host.operational.error, 'operational probe not defined for cursor');
  }));

  it('rejects an operational host that sets supportDeclared:false', () => withTemp((dir) => {
    const bin = join(dir, 'bin');
    mkdirSync(bin);
    stub(bin, 'codex', healthyStubBody('codex'));
    const manifest = writeManifest(dir, [operationalHost('codex', { supportDeclared: false })]);

    const { ok, errors } = withPath(`${bin}:/usr/bin:/bin`, () => runHostProbes({ manifest }));

    assert.equal(ok, false);
    assert.ok(errors.includes('codex: operational must not set supportDeclared:false'), errors.join('\n'));
  }));

  it('rejects a layout-only host that claims supportDeclared', () => withTemp((dir) => {
    const empty = join(dir, 'empty');
    mkdirSync(empty);
    const manifest = writeManifest(dir, [layoutOnlyHost('codex', { supportDeclared: true })]);

    const { ok, errors } = withPath(empty, () => runHostProbes({ manifest }));

    assert.equal(ok, false);
    assert.ok(errors.includes('codex: layout-only requires supportDeclared:false'), errors.join('\n'));
  }));
});

describe('run-host-probes CLI process', () => {
  it('prints usage for --help', () => withTemp((dir) => {
    const result = runCli(['--help'], join(dir, 'empty'));

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Usage: node scripts\/run-host-probes\.js/);
  }));

  it('exits 2 on an unknown argument', () => withTemp((dir) => {
    const result = runCli(['--bogus'], join(dir, 'empty'));

    assert.equal(result.status, 2);
    assert.match(result.stderr, /unknown argument: --bogus/);
  }));

  it('writes a receipt for a layout-only matrix and exits 0', () => withTemp((dir) => {
    const empty = join(dir, 'empty');
    mkdirSync(empty);
    const manifest = writeManifest(dir, fullHosts());
    const receiptPath = join(dir, 'out', 'receipt.json');

    const result = runCli(
      ['--manifest', manifest, '--receipt', receiptPath, '--write'],
      empty,
    );

    assert.equal(result.status, 0, result.stderr);
    assert.ok(result.stdout.includes(`Wrote ${receiptPath}`), result.stdout);
    assert.match(
      result.stdout,
      /Host probes OK: 7 hosts \(layout 7\/7, operational claimed 0\)\./,
    );
    assert.equal(existsSync(receiptPath), true);
    const receipt = JSON.parse(readFileSync(receiptPath, 'utf8'));
    assert.equal(receipt.ok, true);
    assert.equal(receipt.hosts.length, PUBLIC_IDE_IDS.length);
    for (const host of receipt.hosts) {
      assert.equal(host.layout.ok, true, `${host.id}: ${host.layout.error}`);
      assert.equal(host.cli.present, false, `${host.id} must not be found on the empty PATH`);
      assert.equal(host.operational.skipped, true);
    }
  }));

  it('exits 1 when a receipt file disagrees with the manifest', () => withTemp((dir) => {
    const empty = join(dir, 'empty');
    mkdirSync(empty);
    const manifest = writeManifest(dir, [layoutOnlyHost('codex')]);
    const receiptPath = join(dir, 'receipt.json');
    writeFileSync(receiptPath, JSON.stringify({
      schemaVersion: '1',
      ok: true,
      hosts: [{
        id: 'codex',
        supportTier: 'operational',
        supportDeclared: true,
        layout: { ok: true },
        operational: { discovery: true, load: true, invoke: true },
      }],
    }));

    const result = runCli(['--manifest', manifest, '--receipt', receiptPath, '--check'], empty);

    assert.equal(result.status, 1);
    assert.match(result.stderr, /codex: receipt tier operational != manifest layout-only/);
  }));

  it('exits 1 when --check finds a receipt with ok:false', () => withTemp((dir) => {
    const empty = join(dir, 'empty');
    mkdirSync(empty);
    const manifest = writeManifest(dir, [layoutOnlyHost('codex')]);
    const receiptPath = join(dir, 'receipt.json');
    writeFileSync(receiptPath, JSON.stringify({
      schemaVersion: '1',
      ok: false,
      errors: ['synthetic receipt failure'],
      summary: { total: 1, layoutOnly: 1, operationalClaimed: 0 },
      hosts: [{
        id: 'codex',
        supportTier: 'layout-only',
        supportDeclared: false,
        layout: { ok: true },
        operational: { skipped: true },
      }],
    }));

    const result = runCli(['--manifest', manifest, '--receipt', receiptPath, '--check'], empty);

    assert.equal(result.status, 1);
    assert.match(result.stderr, /synthetic receipt failure/);
  }));

  it('accepts a consistent receipt for --check', () => withTemp((dir) => {
    const empty = join(dir, 'empty');
    mkdirSync(empty);
    const manifest = writeManifest(dir, [layoutOnlyHost('codex')]);
    const receiptPath = join(dir, 'receipt.json');
    writeFileSync(receiptPath, JSON.stringify({
      schemaVersion: '1',
      ok: true,
      summary: { total: 1, layoutOnly: 1, operationalClaimed: 0 },
      hosts: [{
        id: 'codex',
        supportTier: 'layout-only',
        supportDeclared: false,
        layout: { ok: true },
        operational: { skipped: true },
      }],
    }));

    const result = runCli(['--manifest', manifest, '--receipt', receiptPath, '--check'], empty);

    assert.equal(result.status, 0, result.stderr);
    assert.equal(
      result.stdout.trim(),
      'Host contract receipt OK: 1 hosts (1 layout-only, 0 operational).',
    );
  }));

  it('exits 1 after writing a receipt for a failing matrix', () => withTemp((dir) => {
    const empty = join(dir, 'empty');
    mkdirSync(empty);
    const manifest = writeManifest(dir, [layoutOnlyHost('codex', { supportDeclared: true })]);
    const receiptPath = join(dir, 'receipt.json');

    const result = runCli(['--manifest', manifest, '--receipt', receiptPath, '--write'], empty);

    assert.equal(result.status, 1);
    assert.match(result.stderr, /codex: layout-only requires supportDeclared:false/);
    assert.equal(existsSync(receiptPath), true);
    const receipt = JSON.parse(readFileSync(receiptPath, 'utf8'));
    assert.equal(receipt.ok, false);
  }));
});
