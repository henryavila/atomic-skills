import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stringify as stringifyYaml } from 'yaml';
import { findUnclosedDone } from '../scripts/find-unclosed-done.js';

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(TEST_DIR, '..', 'scripts', 'find-unclosed-done.js');
let cliRun = 0;

class CliExit extends Error {}

function writeFm(path, obj) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `---\n${stringifyYaml(obj).trimEnd()}\n---\n`);
}

async function runCli(root) {
  const token = `cli=${++cliRun}`;
  const previousArgv = process.argv;
  const previousExit = process.exit;
  const previousLog = console.log;
  let status;
  let stdout = '';

  process.argv = ['node', `${SCRIPT}?${token}`, root];
  process.exit = (code) => {
    status = code;
    throw new CliExit();
  };
  console.log = (...args) => {
    stdout += `${args.join(' ')}\n`;
  };

  try {
    await import(`../scripts/find-unclosed-done.js?${token}`);
    status ??= 0;
  } catch (err) {
    if (!(err instanceof CliExit)) throw err;
  } finally {
    process.argv = previousArgv;
    process.exit = previousExit;
    console.log = previousLog;
  }

  return { status, stdout };
}

test('findUnclosedDone lists live done tasks without closedAt and CLI exits non-zero', async () => {
  const root = mkdtempSync(join(tmpdir(), 'as-unclosed-done-'));
  try {
    writeFm(join(root, '.atomic-skills', 'projects', 'proj', 'alpha', 'phases', 'f1.md'), {
      schemaVersion: '0.1', slug: 'alpha-f1', status: 'active', parentPlan: 'alpha', phaseId: 'F1', lastUpdated: '2026-06-01T00:00:00Z',
      tasks: [
        { id: 'T-001', title: 'done without closedAt', status: 'done', lastUpdated: '2026-06-01T00:00:00Z' }, // OFFENDER
        { id: 'T-002', title: 'done with closedAt', status: 'done', lastUpdated: '2026-06-01T00:00:00Z', closedAt: '2026-06-02T00:00:00Z' },
        { id: 'T-003', title: 'open without closedAt', status: 'pending', lastUpdated: '2026-06-01T00:00:00Z' }, // ignored (not done)
      ],
    });

    const report = findUnclosedDone(root);
    assert.deepEqual(report, [{
      projectId: 'proj',
      planSlug: 'alpha',
      phaseFile: 'f1.md',
      offenders: [{ taskId: 'T-001', title: 'done without closedAt' }],
    }]);

    const cli = await runCli(root);
    assert.equal(cli.status, 1);
    assert.match(cli.stdout, /proj\/alpha\/f1\.md: T-001/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('findUnclosedDone returns empty and CLI exits zero when every done task has closedAt', async () => {
  const root = mkdtempSync(join(tmpdir(), 'as-unclosed-done-ok-'));
  try {
    writeFm(join(root, '.atomic-skills', 'projects', 'p', 'a', 'phases', 'f1.md'), {
      schemaVersion: '0.1', slug: 'a-f1', status: 'active', lastUpdated: '2026-06-01T00:00:00Z',
      tasks: [
        { id: 'T-001', title: 'done ok', status: 'done', lastUpdated: '2026-06-01T00:00:00Z', closedAt: '2026-06-02T00:00:00Z' },
        { id: 'T-002', title: 'done ok with whitespace around timestamp', status: 'done', lastUpdated: '2026-06-01T00:00:00Z', closedAt: '  2026-06-03T00:00:00Z  ' },
        { id: 'T-003', title: 'pending no closedAt', status: 'pending', lastUpdated: '2026-06-01T00:00:00Z' },
      ],
    });

    assert.deepEqual(findUnclosedDone(root), []);
    const cli = await runCli(root);
    assert.equal(cli.status, 0);
    assert.match(cli.stdout, /every done task has closedAt/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('findUnclosedDone ignores archived phase files under phases/archive', async () => {
  const root = mkdtempSync(join(tmpdir(), 'as-unclosed-done-archive-'));
  try {
    writeFm(join(root, '.atomic-skills', 'projects', 'proj', 'alpha', 'phases', 'archive', 'legacy.md'), {
      schemaVersion: '0.1', slug: 'alpha-legacy', status: 'done', parentPlan: 'alpha', phaseId: 'F0', lastUpdated: '2026-06-01T00:00:00Z',
      tasks: [
        { id: 'T-OLD', title: 'legacy done without closedAt', status: 'done', lastUpdated: '2026-06-01T00:00:00Z' },
      ],
    });

    assert.deepEqual(findUnclosedDone(root), []);
    const cli = await runCli(root);
    assert.equal(cli.status, 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('findUnclosedDone scans flat initiatives for done tasks without closedAt', async () => {
  const root = mkdtempSync(join(tmpdir(), 'as-unclosed-done-flat-'));
  try {
    writeFm(join(root, '.atomic-skills', 'initiatives', 'flat.md'), {
      schemaVersion: '0.1', slug: 'flat', status: 'active', lastUpdated: '2026-06-01T00:00:00Z',
      tasks: [
        { id: 'T-FLAT', title: 'flat done without closedAt', status: 'done', lastUpdated: '2026-06-01T00:00:00Z', closedAt: '   ' },
      ],
    });

    const report = findUnclosedDone(root);
    assert.deepEqual(report, [{
      projectId: '(flat)',
      planSlug: 'initiatives',
      phaseFile: 'flat.md',
      offenders: [{ taskId: 'T-FLAT', title: 'flat done without closedAt' }],
    }]);

    const cli = await runCli(root);
    assert.equal(cli.status, 1);
    assert.match(cli.stdout, /\(flat\)\/initiatives\/flat\.md: T-FLAT/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
