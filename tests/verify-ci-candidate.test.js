/**
 * F6/T-003 — CI candidate receipt verifier contracts.
 */
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import {
  nodeSatisfies,
  parseNodeVersion,
  validateJobMatrix,
  validateCiCandidate,
  checkNoProductDiff,
  POST_FREEZE_ALLOWLIST,
} from '../scripts/verify-ci-candidate.js';

describe('verify-ci-candidate (F6/T-003)', () => {
  it('parses node versions', () => {
    assert.deepEqual(parseNodeVersion('v22.18.0'), {
      major: 22, minor: 18, patch: 0, raw: '22.18.0',
    });
    assert.equal(parseNodeVersion('nope'), null);
  });

  it('nodeSatisfies 22.18.x and >=24.11.0', () => {
    assert.equal(nodeSatisfies('v22.18.0', '22.18.x'), true);
    assert.equal(nodeSatisfies('v22.19.1', '22.18.x'), true);
    assert.equal(nodeSatisfies('v22.17.0', '22.18.x'), false);
    assert.equal(nodeSatisfies('v24.11.0', '>=24.11.0'), true);
    assert.equal(nodeSatisfies('v24.10.0', '>=24.11.0'), false);
    assert.equal(nodeSatisfies('v25.0.0', '>=24.11.0'), true);
  });

  it('rejects missing OS axis on full status', () => {
    const receipt = {
      schemaVersion: '1',
      status: 'full',
      candidateSha: 'abc1234567',
      jobs: [
        { os: 'linux', nodeVersion: 'v22.18.0', status: 'success', sha: 'abc1234567' },
        { os: 'linux', nodeVersion: 'v24.11.0', status: 'success', sha: 'abc1234567' },
      ],
    };
    const report = validateCiCandidate(receipt, {
      requireOs: ['linux', 'macos', 'windows'],
      requireNode: ['22.18.x', '>=24.11.0'],
      allowPartial: false,
    });
    assert.equal(report.ok, false);
    // Full status requires OS×Node product (Codex F-008); accept either shape.
    assert.ok(
      report.errors.some((e) => /missing OS(?:×Node)? coverage:.*macos/i.test(e)),
      report.errors.join('\n'),
    );
    assert.ok(
      report.errors.some((e) => /missing OS(?:×Node)? coverage:.*windows/i.test(e)),
      report.errors.join('\n'),
    );
  });

  it('accepts partial with --allow-partial when linux covered and node real', () => {
    const receipt = {
      schemaVersion: '1',
      status: 'partial',
      candidateSha: 'abc1234567',
      platformCoverage: { linux: true, macos: false, windows: false },
      local: { nodeVersion: process.version, os: process.platform },
      jobs: [
        {
          os: 'linux',
          nodeVersion: process.version,
          status: 'success',
          sha: 'abc1234567',
          name: 'local-linux',
        },
      ],
      environmentLimit: 'Multi-OS GitHub runners not available in this environment',
    };
    const report = validateCiCandidate(receipt, {
      requireOs: ['linux', 'macos', 'windows'],
      requireNode: nodeReqsForCurrent(),
      allowPartial: true,
      noProductDiff: false,
    });
    assert.equal(report.ok, true, report.errors.join('\n'));
  });

  it('rejects partial without --allow-partial', () => {
    const receipt = {
      schemaVersion: '1',
      status: 'partial',
      candidateSha: 'abc1234567',
      platformCoverage: { linux: true, macos: false, windows: false },
      jobs: [{ os: 'linux', nodeVersion: 'v24.15.0', status: 'success' }],
    };
    const report = validateCiCandidate(receipt, {
      requireOs: ['linux', 'macos', 'windows'],
      requireNode: ['>=24.11.0'],
      allowPartial: false,
    });
    assert.equal(report.ok, false);
    assert.ok(report.errors.some((e) => /partial/i.test(e)));
  });

  it('rejects job from other sha', () => {
    const matrix = validateJobMatrix(
      {
        status: 'full',
        candidateSha: 'aaa1111',
        jobs: [
          { os: 'linux', nodeVersion: 'v22.18.0', status: 'success', sha: 'bbb2222' },
          { os: 'macos', nodeVersion: 'v22.18.0', status: 'success', sha: 'aaa1111' },
          { os: 'windows', nodeVersion: 'v24.11.0', status: 'success', sha: 'aaa1111' },
        ],
      },
      { requireOs: ['linux', 'macos', 'windows'], requireNode: ['22.18.x', '>=24.11.0'] },
    );
    assert.equal(matrix.ok, false);
    assert.ok(matrix.errors.some((e) => /job.sha/i.test(e)));
  });

  it('rejects node version inferred only from job name (missing nodeVersion)', () => {
    const matrix = validateJobMatrix(
      {
        status: 'full',
        jobs: [
          { os: 'linux', status: 'success', name: 'node-22.18' },
        ],
      },
      { requireOs: ['linux'], requireNode: ['22.18.x'] },
    );
    assert.equal(matrix.ok, false);
    assert.ok(matrix.errors.some((e) => /nodeVersion/i.test(e)));
  });

  it('rejects Node 22 below 22.18.0 for 22.18.x requirement', () => {
    assert.equal(nodeSatisfies('v22.17.9', '22.18.x'), false);
  });

  it('post-freeze allowlist includes docs/audits and .atomic-skills', () => {
    assert.ok(POST_FREEZE_ALLOWLIST.some((p) => p.startsWith('docs/audits')));
    assert.ok(POST_FREEZE_ALLOWLIST.some((p) => p.startsWith('.atomic-skills')));
  });

  it('checkNoProductDiff runs against HEAD (same sha → empty committed diff)', () => {
    const sha = spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout.trim();
    // Unit test ignores working-tree dirt (checked by CLI path with default true).
    const report = checkNoProductDiff(sha, process.cwd(), { checkWorkingTree: false });
    assert.equal(report.ok, true, report.errors.join('\n'));
    assert.deepEqual(report.blocked, []);
  });
});

function nodeReqsForCurrent() {
  const major = Number(process.versions.node.split('.')[0]);
  if (major === 22) return ['22.18.x'];
  if (major >= 24) return ['>=24.11.0'];
  return ['22.18.x', '>=24.11.0'];
}
