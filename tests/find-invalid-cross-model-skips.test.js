import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  parseCrossModelSkipLine,
  invalidSkipReason,
  findInvalidSkipsInBody,
  findInvalidCrossModelSkips,
} from '../scripts/find-invalid-cross-model-skips.js';

describe('parseCrossModelSkipLine', () => {
  it('parses operator-tagged skip', () => {
    const p = parseCrossModelSkipLine(
      '- cross-model: SKIPPED — operator: cost too high this week for external',
    );
    assert.equal(p.operatorTagged, true);
    assert.match(p.reason, /cost too high/);
  });

  it('flags missing operator tag', () => {
    const p = parseCrossModelSkipLine('- cross-model: SKIPPED — not provided');
    assert.equal(p.operatorTagged, false);
  });
});

describe('invalidSkipReason', () => {
  it('bans short and filler reasons', () => {
    assert.equal(invalidSkipReason('ok'), 'reason-too-short');
    assert.equal(invalidSkipReason('not provided by operator now'), 'banned-reason');
    assert.equal(invalidSkipReason('Recommended agora for this run'), 'banned-reason');
    assert.equal(
      invalidSkipReason('operator accepts residual risk for this dogfood only'),
      null,
    );
  });
});

describe('findInvalidSkipsInBody', () => {
  it('reports invalid SKIPPED under ## Reviews', () => {
    const body = `## Reviews
- internal: clean
- cross-model: SKIPPED — not provided
`;
    const bad = findInvalidSkipsInBody(body);
    assert.ok(bad.some((b) => b.code === 'missing-operator-tag'));
  });

  it('accepts valid operator skip', () => {
    const body = `## Reviews
- internal: clean
- cross-model: SKIPPED — operator: external providers unavailable on this host today
`;
    assert.deepEqual(findInvalidSkipsInBody(body), []);
  });
});

describe('findInvalidCrossModelSkips scan', () => {
  it('flags active plan with invalid skip', () => {
    const root = mkdtempSync(join(tmpdir(), 'skip-scan-'));
    try {
      const planDir = join(root, 'projects', 'p', 's');
      mkdirSync(planDir, { recursive: true });
      writeFileSync(
        join(planDir, 'plan.md'),
        `---
schemaVersion: "0.1"
slug: s
title: s
status: active
started: "2026-07-22T00:00:00.000Z"
lastUpdated: "2026-07-22T00:00:00.000Z"
currentPhase: F0
phases: []
---
## Reviews
- internal: x
- cross-model: SKIPPED — not provided
`,
      );
      const report = findInvalidCrossModelSkips(join(root));
      assert.ok(report.length >= 1);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
