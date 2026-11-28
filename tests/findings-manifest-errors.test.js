/**
 * Pins the exact error text, order and result shape of
 * validateFindingsManifest so refactors cannot change them.
 */
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';

import { validateFindingsManifest } from '../scripts/verify-findings-manifest.js';

const IDS = ['installer/C1', 'installer/H1'];

function entry(id, overrides = {}) {
  const [source, localId] = id.split('/');
  return {
    id,
    source,
    localId,
    ownerTask: 'F6/T-004',
    status: 'resolved',
    reproducer: `repro ${id}`,
    verifier: { command: 'node --test x', passed: true, exitCode: 0 },
    candidateSha: 'abc1234',
    evidence: { digest: 'a'.repeat(64), job: 'local' },
    ...overrides,
  };
}

const valid = () => ({ schemaVersion: '1', findings: IDS.map((id) => entry(id)) });

const CASES = [
  {
    name: 'non-object root',
    manifest: null,
    opts: {},
    errors: ['manifest root must be an object'],
  },
  {
    name: 'wrong schemaVersion',
    manifest: { ...valid(), schemaVersion: '2' },
    opts: { expectedIds: IDS },
    errors: ['schemaVersion must be "1" (got "2")'],
    expectedIds: IDS,
    actualIds: IDS,
  },
  {
    name: 'findings not an array',
    manifest: { schemaVersion: '1', findings: {} },
    opts: { expectedIds: IDS },
    errors: ['findings must be an array'],
  },
  {
    name: 'entry with no identity',
    manifest: { schemaVersion: '1', findings: [{}] },
    opts: { expectedIds: ['installer/C1'] },
    errors: [
      'findings[0]: source is required',
      'findings[0]: localId is required',
      'findings[0]: id or source/localId required',
      'missing expected finding installer/C1',
    ],
    expectedIds: ['installer/C1'],
    actualIds: [],
  },
  {
    name: 'id not equal to source/localId',
    manifest: { schemaVersion: '1', findings: [entry('installer/C1', { id: 'x' })] },
    opts: { expectedIds: ['installer/C1'] },
    errors: [
      'findings[0]: id x must equal source/localId (installer/C1)',
      'missing expected finding installer/C1',
      'unexpected finding x',
    ],
    expectedIds: ['installer/C1'],
    actualIds: ['x'],
  },
  {
    name: 'duplicate id',
    manifest: { schemaVersion: '1', findings: [entry('installer/C1'), entry('installer/C1')] },
    opts: { expectedIds: ['installer/C1'] },
    errors: ['findings[1]: duplicate id installer/C1'],
    expectedIds: ['installer/C1'],
    actualIds: ['installer/C1', 'installer/C1'],
  },
  {
    name: 'missing ownership, verifier, evidence and status',
    manifest: {
      schemaVersion: '1',
      findings: [entry('installer/C1', {
        ownerTask: ' ',
        reproducer: '',
        verifier: undefined,
        evidence: undefined,
        status: undefined,
      })],
    },
    opts: { expectedIds: ['installer/C1'] },
    errors: [
      'findings[0] (installer/C1): ownerTask required',
      'findings[0] (installer/C1): reproducer required',
      'findings[0] (installer/C1): verifier object required',
      'findings[0] (installer/C1): evidence required',
      'findings[0] (installer/C1): status required',
    ],
    expectedIds: ['installer/C1'],
    actualIds: ['installer/C1'],
  },
  {
    name: 'malformed verifier',
    manifest: {
      schemaVersion: '1',
      findings: [entry('installer/C1', {
        verifier: { command: '', passed: false, exitCode: 1 },
      })],
    },
    opts: { expectedIds: ['installer/C1'] },
    errors: [
      'findings[0] (installer/C1): verifier.command required',
      'findings[0] (installer/C1): verifier.passed must be true',
      'findings[0] (installer/C1): verifier.exitCode must be 0 when set',
    ],
    expectedIds: ['installer/C1'],
    actualIds: ['installer/C1'],
  },
  {
    name: 'candidateSha invalid and different from receipt',
    manifest: {
      schemaVersion: '1',
      findings: [entry('installer/C1', { candidateSha: 'zzz' })],
    },
    opts: { expectedIds: ['installer/C1'], candidateSha: 'bbbbbbb' },
    errors: [
      'findings[0] (installer/C1): candidateSha must be a git sha',
      'findings[0] (installer/C1): candidateSha zzz != receipt bbbbbbb',
    ],
    expectedIds: ['installer/C1'],
    actualIds: ['installer/C1'],
  },
  {
    name: 'evidence without digest or job',
    manifest: {
      schemaVersion: '1',
      findings: [entry('installer/C1', { evidence: {} })],
    },
    opts: { expectedIds: ['installer/C1'] },
    errors: ['findings[0] (installer/C1): evidence.digest or evidence.job required'],
    expectedIds: ['installer/C1'],
    actualIds: ['installer/C1'],
  },
  {
    name: 'multiple candidateSha values',
    manifest: {
      schemaVersion: '1',
      findings: [
        entry('installer/C1', { candidateSha: 'aaaaaaa' }),
        entry('installer/H1', { candidateSha: 'bbbbbbb' }),
      ],
    },
    opts: { expectedIds: IDS, candidateSha: 'aaaaaaa' },
    errors: [
      'findings[1] (installer/H1): candidateSha bbbbbbb != receipt aaaaaaa',
      'multiple candidateSha values in manifest: aaaaaaa, bbbbbbb',
    ],
    expectedIds: IDS,
    actualIds: IDS,
  },
  {
    name: 'valid manifest',
    manifest: valid(),
    opts: { expectedIds: IDS, candidateSha: 'abc1234' },
    errors: [],
    expectedIds: IDS,
    actualIds: IDS,
  },
];

describe('validateFindingsManifest error table', () => {
  for (const testCase of CASES) {
    it(testCase.name, () => {
      const report = validateFindingsManifest(testCase.manifest, testCase.opts);
      assert.equal(report.ok, testCase.errors.length === 0);
      assert.deepEqual(report.errors, testCase.errors);
      if ('expectedIds' in testCase) assert.deepEqual(report.expectedIds, testCase.expectedIds);
      if ('actualIds' in testCase) assert.deepEqual(report.actualIds, testCase.actualIds);
    });
  }
});
