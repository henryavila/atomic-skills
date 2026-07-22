import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { evaluateSidecarAge, DEFAULT_MAX_AGE_DAYS, DEFAULT_MAX_TASKS } from '../src/sidecar-age.js';

describe('sidecar-age', () => {
  it('prompts when capturedAt older than N days', () => {
    const root = mkdtempSync(join(tmpdir(), 'age-'));
    try {
      const p = join(root, 'f1.source.json');
      const old = new Date(Date.now() - (DEFAULT_MAX_AGE_DAYS + 2) * 86400 * 1000).toISOString();
      writeFileSync(p, JSON.stringify({ capturedAt: old, tasks: [{ id: 'T-001' }] }));
      const r = evaluateSidecarAge({ sidecarPath: p });
      assert.equal(r.shouldPrompt, true);
      assert.ok(r.reasons.some((x) => /age/.test(x)));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('prompts when task count > K', () => {
    const root = mkdtempSync(join(tmpdir(), 'age-k-'));
    try {
      const p = join(root, 'f1.source.json');
      const tasks = Array.from({ length: DEFAULT_MAX_TASKS + 1 }, (_, i) => ({ id: `T-${i}` }));
      writeFileSync(
        p,
        JSON.stringify({ capturedAt: new Date().toISOString(), tasks }),
      );
      const r = evaluateSidecarAge({ sidecarPath: p });
      assert.equal(r.shouldPrompt, true);
      assert.ok(r.reasons.some((x) => /taskCount/.test(x)));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('falls back to plan.started when no sidecar mtime/capturedAt usable', () => {
    const r = evaluateSidecarAge({
      sidecarPath: '/nonexistent/path.source.json',
      planStarted: new Date(Date.now() - 30 * 86400 * 1000).toISOString(),
    });
    assert.equal(r.shouldPrompt, true);
  });

  it('no prompt for fresh small sidecar', () => {
    const root = mkdtempSync(join(tmpdir(), 'age-ok-'));
    try {
      const p = join(root, 'f1.source.json');
      writeFileSync(
        p,
        JSON.stringify({ capturedAt: new Date().toISOString(), tasks: [{ id: 'T-001' }] }),
      );
      const r = evaluateSidecarAge({ sidecarPath: p });
      assert.equal(r.shouldPrompt, false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
