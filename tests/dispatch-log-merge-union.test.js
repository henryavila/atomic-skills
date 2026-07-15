import { test } from 'node:test';
import assert from 'node:assert';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseDispatchLog } from '../scripts/dispatch-log.js';
import { canonicalCompletionRecords } from '../scripts/append-completion.js';
import { parseCompletionEventLog } from '../src/completion-event-validator.js';

// Proves Decisão 5's union-safety for the dispatch-log sidecar. Two guarantees:
//   (1) .gitattributes WIRES dispatch-log.json to merge=union;
//   (2) git's union driver, on NDJSON, keeps BOTH concurrent appends as
//       individually-valid JSON lines (lossless) — the property a pretty-printed
//       JSON array would violate (it would union into invalid JSON).

const git = (args) => {
  const result = spawnSync('git', args, { encoding: 'utf8' });
  if (result.status !== 0) {
    throw result.error ?? new Error(`git ${args.join(' ')} failed: ${result.stderr}`);
  }
  return result.stdout;
};

// `git check-attr merge <path>` prints `<path>: merge: <value>`. Extract the
// EXACT value — an unanchored substring match (/merge:\s*union/) would wrongly
// accept `merge=unionized`/`merge=union-custom`, which git resolves to a DIFFERENT
// (custom/absent) driver, so concurrent appends could conflict while CI stays green.
const mergeAttr = (relPath) => git(['check-attr', 'merge', relPath]).trim().split(/:\s+/).pop();

test('dispatch-log.json is wired to merge=union via .gitattributes', () => {
  assert.strictEqual(
    mergeAttr('.atomic-skills/status/dispatch-log.json'),
    'union',
    'dispatch-log.json must resolve to the built-in union merge driver',
  );
});

test('completions.jsonl is wired to merge=union via .gitattributes', () => {
  assert.strictEqual(
    mergeAttr('.atomic-skills/analytics/completions.jsonl'),
    'union',
    'completions.jsonl must resolve to the built-in union merge driver',
  );
});

test('pointwise status JSON is NOT union-merged (default merge)', () => {
  assert.notStrictEqual(
    mergeAttr('.atomic-skills/status/last-review.json'),
    'union',
    'pointwise (overwritten) status files must not be union-merged',
  );
});

test('tracked dispatch-log is pure NDJSON with all migrated records preserved', () => {
  const logPath = path.resolve('.atomic-skills/status/dispatch-log.json');
  const raw = fs.readFileSync(logPath, 'utf8');
  const records = parseDispatchLog(raw, { source: logPath });
  const lines = raw.split(/\r?\n/).filter((line) => line.trim().length > 0);

  assert.ok(records.length >= 53, 'migration must preserve the 53 historical records before future appends');
  assert.strictEqual(lines.length, records.length, 'canonical NDJSON has exactly one line per record');
  lines.forEach((line, index) => {
    const value = JSON.parse(line);
    assert.ok(value && typeof value === 'object' && !Array.isArray(value), `line ${index + 1} must be one JSON object`);
  });
});

test('git merge=union on NDJSON is lossless for two concurrent appends', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ndjson-union-'));
  try {
    const rec = (o) => JSON.stringify(o) + '\n';
    const baseContent = rec({ taskId: 'T-000' });
    const base = path.join(dir, 'base.ndjson');
    const ours = path.join(dir, 'ours.ndjson');
    const theirs = path.join(dir, 'theirs.ndjson');
    fs.writeFileSync(base, baseContent);
    fs.writeFileSync(ours, baseContent + rec({ taskId: 'A' }));
    fs.writeFileSync(theirs, baseContent + rec({ taskId: 'B' }));
    // git merge-file --union <current> <base> <other>: unions into <current>, no markers
    git(['merge-file', '--union', ours, base, theirs]);
    const merged = fs.readFileSync(ours, 'utf8');
    const lines = merged.split('\n').filter(Boolean);
    const ids = lines.map((l) => JSON.parse(l).taskId); // each line MUST parse as JSON
    assert.ok(ids.includes('A'), 'branch A append was lost in union merge');
    assert.ok(ids.includes('B'), 'branch B append was lost in union merge');
    assert.strictEqual(ids.length, 3, `expected 3 records, got ${ids.length}: ${merged}`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('an actual Git merge preserves both branch-local canonical completion events', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'completion-git-union-'));
  const run = (args) => {
    const result = spawnSync('git', args, { cwd: dir, encoding: 'utf8' });
    if (result.status !== 0) {
      throw result.error ?? new Error(`git ${args.join(' ')} failed: ${result.stderr}`);
    }
    return result.stdout.trim();
  };
  const event = (taskId, second) => ({
    ts: `2026-07-14T20:00:0${second}Z`, event: 'task-done', projectId: 'proj',
    planSlug: 'plan', phaseId: 'F0', taskId, weight: 1, weightBasis: 'count',
    idempotencyKey: `task-done:proj/plan/F0/${taskId}@2026-07-14T20%3A00%3A0${second}Z`,
  });
  const relative = '.atomic-skills/analytics/completions.jsonl';
  const ledger = path.join(dir, relative);
  try {
    run(['init', '-q']);
    run(['config', 'user.email', 'tests@example.com']);
    run(['config', 'user.name', 'Atomic Tests']);
    fs.mkdirSync(path.dirname(ledger), { recursive: true });
    fs.copyFileSync(path.resolve('.gitattributes'), path.join(dir, '.gitattributes'));
    fs.writeFileSync(ledger, `${JSON.stringify(event('T-000', 0))}\n`);
    run(['add', '.']);
    run(['commit', '-qm', 'base']);
    const baseBranch = run(['branch', '--show-current']);

    run(['checkout', '-qb', 'branch-a']);
    fs.appendFileSync(ledger, `${JSON.stringify(event('T-A', 1))}\n`);
    run(['commit', '-qam', 'append A']);

    run(['checkout', '-qb', 'branch-b', baseBranch]);
    fs.appendFileSync(ledger, `${JSON.stringify(event('T-B', 2))}\n`);
    run(['commit', '-qam', 'append B']);
    run(['checkout', '-q', 'branch-a']);
    run(['merge', '-q', '--no-edit', 'branch-b']);

    const records = parseCompletionEventLog(fs.readFileSync(ledger, 'utf8'), { source: ledger });
    assert.deepEqual(
      new Set(records.map((record) => record.taskId)),
      new Set(['T-000', 'T-A', 'T-B']),
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('an actual Git union merge collapses equivalent branch-local reconciliation tombstones', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'completion-reconcile-union-'));
  const run = (args) => {
    const result = spawnSync('git', args, { cwd: dir, encoding: 'utf8' });
    if (result.status !== 0) throw result.error ?? new Error(result.stderr);
    return result.stdout.trim();
  };
  const digest = (value) => {
    const canonical = (item) => (Array.isArray(item)
      ? item.map(canonical)
      : (item && typeof item === 'object'
        ? Object.fromEntries(Object.keys(item).sort().map((key) => [key, canonical(item[key])]))
        : item));
    return createHash('sha256')
      .update(JSON.stringify(canonical(value))).digest('hex');
  };
  const relative = '.atomic-skills/analytics/completions.jsonl';
  const ledger = path.join(dir, relative);
  try {
    run(['init', '-q']);
    run(['config', 'user.email', 'tests@example.com']);
    run(['config', 'user.name', 'Atomic Tests']);
    fs.mkdirSync(path.dirname(ledger), { recursive: true });
    fs.copyFileSync(path.resolve('.gitattributes'), path.join(dir, '.gitattributes'));
    const first = {
      ts: '2026-07-14T20:00:00Z', event: 'task-done', projectId: 'proj', planSlug: 'plan',
      phaseId: 'F0', taskId: 'T-1', generation: 1, weight: 1, weightBasis: 'count',
      idempotencyKey: 'task-done:proj/plan/F0/T-1#1',
    };
    const duplicate = { ...first, ts: '2026-07-14T20:00:01Z' };
    const ordered = [first, duplicate].sort((left, right) => digest(left).localeCompare(digest(right)));
    const reconciliation = {
      action: 'ignore-duplicate-completion', eventIdentity: 'task-done:T-1#1',
      canonicalDigest: digest(ordered[0]), duplicateDigests: [digest(ordered[1])],
    };
    const tombstone = (ts) => ({
      ts, event: 'reconcile', projectId: 'proj', planSlug: 'plan', phaseId: 'F0', taskId: null,
      weight: 0, weightBasis: 'count', idempotencyKey: 'reconcile:stable-duplicate-set',
      reconciliation,
    });
    fs.writeFileSync(ledger, `${JSON.stringify(first)}\n${JSON.stringify(duplicate)}\n`);
    run(['add', '.']);
    run(['commit', '-qm', 'base duplicates']);
    const baseBranch = run(['branch', '--show-current']);
    run(['checkout', '-qb', 'repair-a']);
    fs.appendFileSync(ledger, `${JSON.stringify(tombstone('2026-07-14T20:01:00Z'))}\n`);
    run(['commit', '-qam', 'repair A']);
    run(['checkout', '-qb', 'repair-b', baseBranch]);
    fs.appendFileSync(ledger, `${JSON.stringify(tombstone('2026-07-14T20:02:00Z'))}\n`);
    run(['commit', '-qam', 'repair B']);
    run(['checkout', '-q', 'repair-a']);
    run(['merge', '-q', '--no-edit', 'repair-b']);

    const physical = parseCompletionEventLog(fs.readFileSync(ledger, 'utf8'), { source: ledger });
    assert.equal(physical.filter((record) => record.event === 'reconcile').length, 2);
    const logical = canonicalCompletionRecords(physical);
    assert.equal(logical.filter((record) => record.event === 'task-done').length, 1);
    assert.equal(logical.filter((record) => record.event === 'reconcile').length, 1);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
