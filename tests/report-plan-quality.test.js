import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const report = join(here, '..', 'scripts', 'report-plan-quality.js');

describe('report-plan-quality CLI', () => {
  it('exit 0 with zero events', () => {
    const root = mkdtempSync(join(tmpdir(), 'rpq-'));
    try {
      const path = join(root, 'empty.jsonl');
      writeFileSync(path, '');
      const r = spawnSync(process.execPath, [report, '--path', path, '--window-days', '14'], {
        encoding: 'utf8',
      });
      assert.equal(r.status, 0);
      assert.match(r.stdout, /events: 0/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('counts fixture events', () => {
    const root = mkdtempSync(join(tmpdir(), 'rpq2-'));
    try {
      const path = join(root, 'e.jsonl');
      const ts = new Date().toISOString();
      writeFileSync(
        path,
        JSON.stringify({ kind: 'fingerprint_refuse', planSlug: 'x', phaseId: 'F1', ts }) +
          '\n' +
          JSON.stringify({ kind: 'spine_quality_fail', planSlug: 'x', phaseId: 'F0', ts }) +
          '\n',
      );
      const r = spawnSync(process.execPath, [report, '--path', path], { encoding: 'utf8' });
      assert.equal(r.status, 0);
      assert.match(r.stdout, /fingerprint_refuse: 1/);
      assert.match(r.stdout, /spine_quality_fail: 1/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
