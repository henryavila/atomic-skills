'use strict';
import { test } from 'node:test';
import assert from 'node:assert';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

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

test('dispatch-log.json is wired to merge=union via .gitattributes', () => {
  const out = git(['check-attr', 'merge', '.atomic-skills/status/dispatch-log.json']);
  assert.match(out, /merge:\s*union/, `expected merge=union, got: ${out.trim()}`);
});

test('pointwise status JSON is NOT union-merged (default merge)', () => {
  const out = git(['check-attr', 'merge', '.atomic-skills/status/last-review.json']);
  assert.doesNotMatch(out, /merge:\s*union/, `pointwise file must not be union: ${out.trim()}`);
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
