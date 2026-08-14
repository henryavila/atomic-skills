/**
 * find-weak-flow-draft — brief sidecar + seven refuse rules.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkFlowDraft } from '../scripts/find-weak-flow-draft.js';

describe('checkFlowDraft rule 1', () => {
  it('rule 1: missing brief is weak', () => {
    const dir = mkdtempSync(join(tmpdir(), 'flow-brief-'));
    try {
      const planMd = join(dir, 'plan.md');
      writeFileSync(planMd, '# p\n');
      mkdirSync(join(dir, 'flow'));
      writeFileSync(join(dir, 'flow', 'flow.json'), '{}');
      const r = checkFlowDraft(planMd);
      assert.equal(r.ok, false);
      assert.ok(r.issues.some((i) => /brief/i.test(i)));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
