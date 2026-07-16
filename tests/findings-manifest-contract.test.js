/**
 * F6/T-004 — Findings manifest contract: exact source-qualified ID set,
 * no duplicates, required reproducer/verifier/evidence/candidateSha.
 */
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  extractAuditFindingIds,
  extractCodexFindingIds,
  extractExpectedFindingIds,
  validateFindingsManifest,
} from '../scripts/verify-findings-manifest.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST = join(ROOT, 'docs/audits/integrity-remediation-findings.json');
const INSTALLER = join(ROOT, 'docs/audits/installer-audit-2026-07-10.md');
const PROJECT = join(ROOT, 'docs/audits/project-implement-audit-2026-07-10.md');
const CODEX = join(ROOT, '.atomic-skills/reviews/2026-07-11-1415-integrity-remediation.md');

describe('findings manifest contract (F6/T-004)', () => {
  it('extracts exact audit local IDs from both audits', () => {
    const installer = extractAuditFindingIds(readFileSync(INSTALLER, 'utf8'));
    assert.deepEqual(installer, [
      'C1', 'C2', 'C3',
      'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
      'M1', 'M2', 'M3', 'M4',
    ]);
    const project = extractAuditFindingIds(readFileSync(PROJECT, 'utf8'));
    assert.deepEqual(project, [
      'C1', 'C2', 'C3',
      'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'H7', 'H8', 'H9', 'H10',
      'M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7', 'M8', 'M9',
    ]);
  });

  it('extracts codex F-001..F-006 without template placeholders', () => {
    const ids = extractCodexFindingIds(readFileSync(CODEX, 'utf8'));
    assert.deepEqual(ids, ['F-001', 'F-002', 'F-003', 'F-004', 'F-005', 'F-006']);
  });

  it('expected set is source-qualified and size 41', () => {
    const { expectedIds } = extractExpectedFindingIds();
    assert.equal(expectedIds.length, 41);
    assert.ok(expectedIds.includes('installer/C1'));
    assert.ok(expectedIds.includes('project-implement/H10'));
    assert.ok(expectedIds.includes('codex-review/F-006'));
  });

  it('rejects incomplete entry (missing reproducer/verifier/evidence)', () => {
    const { expectedIds } = extractExpectedFindingIds();
    const bad = {
      schemaVersion: '1',
      findings: expectedIds.map((id) => {
        const [source, localId] = id.split('/');
        return {
          id,
          source,
          localId,
          ownerTask: 'F6/T-004',
          // missing reproducer, verifier, evidence, candidateSha, status
        };
      }),
    };
    const report = validateFindingsManifest(bad, { expectedIds, candidateSha: 'abc1234' });
    assert.equal(report.ok, false);
    assert.ok(report.errors.some((e) => /reproducer/i.test(e)));
    assert.ok(report.errors.some((e) => /verifier/i.test(e)));
    assert.ok(report.errors.some((e) => /evidence/i.test(e)));
  });

  it('rejects wrong ID set (missing and unexpected)', () => {
    const { expectedIds } = extractExpectedFindingIds();
    const truncated = expectedIds.slice(1);
    const findings = truncated.map((id) => entry(id, 'deadbeef'));
    findings.push(entry('installer/EXTRA', 'deadbeef'));
    const report = validateFindingsManifest(
      { schemaVersion: '1', findings },
      { expectedIds, candidateSha: 'deadbeef' },
    );
    assert.equal(report.ok, false);
    assert.ok(report.errors.some((e) => /missing expected/i.test(e)));
    assert.ok(report.errors.some((e) => /unexpected/i.test(e)));
  });

  it('rejects duplicate ids', () => {
    const { expectedIds } = extractExpectedFindingIds();
    const findings = expectedIds.map((id) => entry(id, 'abc1234'));
    findings.push(entry(expectedIds[0], 'abc1234'));
    const report = validateFindingsManifest(
      { schemaVersion: '1', findings },
      { expectedIds, candidateSha: 'abc1234' },
    );
    assert.equal(report.ok, false);
    assert.ok(report.errors.some((e) => /duplicate/i.test(e)));
  });

  it('rejects verifier.passed !== true', () => {
    const { expectedIds } = extractExpectedFindingIds();
    const findings = expectedIds.map((id) => {
      const e = entry(id, 'abc1234');
      e.verifier = { ...e.verifier, passed: false, exitCode: 1 };
      return e;
    });
    const report = validateFindingsManifest(
      { schemaVersion: '1', findings },
      { expectedIds, candidateSha: 'abc1234' },
    );
    assert.equal(report.ok, false);
    assert.ok(report.errors.some((e) => /verifier.passed/i.test(e)));
  });

  it('rejects candidateSha mismatch vs receipt', () => {
    const { expectedIds } = extractExpectedFindingIds();
    const findings = expectedIds.map((id) => entry(id, 'aaaaaaaa'));
    const report = validateFindingsManifest(
      { schemaVersion: '1', findings },
      { expectedIds, candidateSha: 'bbbbbbbb' },
    );
    assert.equal(report.ok, false);
    assert.ok(report.errors.some((e) => /candidateSha/i.test(e)));
  });

  it('canonical committed manifest validates when present', () => {
    if (!existsSync(MANIFEST)) return;
    const doc = JSON.parse(readFileSync(MANIFEST, 'utf8'));
    const receiptPath = join(ROOT, 'docs/audits/release-candidate-ci.json');
    const candidateSha = existsSync(receiptPath)
      ? JSON.parse(readFileSync(receiptPath, 'utf8')).candidateSha
      : doc.findings?.[0]?.candidateSha;
    const { expectedIds } = extractExpectedFindingIds();
    const report = validateFindingsManifest(doc, { expectedIds, candidateSha });
    assert.equal(report.ok, true, report.errors.join('\n'));
  });
});

function entry(id, sha) {
  const [source, localId] = id.split('/');
  return {
    id,
    source,
    localId,
    ownerTask: 'F6/T-004',
    status: 'resolved',
    reproducer: `synthetic reproducer for ${id}`,
    verifier: {
      command: 'node --test tests/findings-manifest-contract.test.js',
      passed: true,
      exitCode: 0,
    },
    candidateSha: sha,
    evidence: {
      digest: 'a'.repeat(64),
      job: 'local',
    },
  };
}
