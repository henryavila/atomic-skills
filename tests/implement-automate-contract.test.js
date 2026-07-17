/**
 * F4 / T-012 — Contract tests for the implement --mode=automate skill surface.
 *
 * Grep/import-based (not network, not live spawn). Fails when prose markers or
 * helper exports regress. No skills/core/automate.md top-level skill.
 */
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  parseImplementMode,
  isAutomateActive,
  stampExecutionMode,
  clearExecutionModeStamp,
  hasAutomateStamp,
} from '../src/implement-mode.js';
import { isComplexTask } from '../src/complex-task.js';
import {
  planEndReviewOk,
  userValidationOk,
  automatePlanEndGatesOk,
} from '../src/plan-end-review.js';
import { phaseReviewMode } from '../src/phase-review-mode.js';
import {
  validateClaimReport,
  parseClaimReport,
  validatedRangeForDone,
  validateClaimReachability,
} from '../src/claim-report.js';
import {
  leasePath,
  isLeaseActive,
  buildActiveLease,
  leaseOwnerToken,
  isLeaseBlocking,
  readLeaseResult,
  acquireLeaseFile,
  clearLeaseFile,
  assertLeaseAbsent,
  hashLeaseSecret,
} from '../src/writer-lease.js';
import { mkdtempSync, rmSync, readFileSync as fsRead } from 'node:fs';
import { tmpdir } from 'node:os';
import { join as pathJoin } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function read(rel) {
  return readFileSync(join(ROOT, rel), 'utf8');
}

function assertIncludes(haystack, needle, label) {
  assert.ok(
    haystack.includes(needle),
    `${label ?? 'body'} must include ${JSON.stringify(needle)}`,
  );
}

function assertMatch(haystack, re, label) {
  assert.match(haystack, re, `${label ?? 'body'} must match ${re}`);
}

describe('implement automate skill surface (prose)', () => {
  const implement = read('skills/core/implement.md');
  const phaseWriter = read('skills/shared/implement-phase-writer.md');
  const phaseEvaluator = read('skills/shared/implement-phase-evaluator.md');
  const transitions = read('skills/shared/project-assets/project-transitions.md');
  const finalize = read('skills/shared/project-assets/project-finalize.md');

  it('implement.md contains mode=automate and pure maestro / phase writer concepts', () => {
    assertIncludes(implement, 'mode=automate', 'implement.md');
    assertIncludes(implement, 'pure maestro', 'implement.md');
    assertMatch(implement, /phase writer/i, 'implement.md');
    assertIncludes(implement, 'isAutomateActive', 'implement.md');
    assertIncludes(implement, 'parseImplementMode', 'implement.md');
  });

  it('implement.md points at code-only writer, complex both, and plan-end external-both', () => {
    assertMatch(implement, /code-only/i, 'implement.md');
    assertMatch(implement, /complex/i, 'implement.md');
    assertMatch(implement, /review-code.*--mode=both|--mode=both.*complex|complex.*--mode=both/is, 'implement.md complex both');
    assertMatch(implement, /external-both|planEndReviewOk/i, 'implement.md plan-end');
    assertIncludes(implement, 'implement-phase-writer.md', 'implement.md');
    assertIncludes(implement, 'implement-phase-evaluator.md', 'implement.md');
  });

  it('implement-phase-writer.md exists with code-only / never done language', () => {
    assert.ok(
      existsSync(join(ROOT, 'skills/shared/implement-phase-writer.md')),
      'skills/shared/implement-phase-writer.md must exist',
    );
    assertMatch(phaseWriter, /code-only/i, 'phase-writer');
    assertMatch(phaseWriter, /never.*done|must not.*done|no `done`/is, 'phase-writer never done');
    assertIncludes(phaseWriter, 'claim report', 'phase-writer');
    assertIncludes(phaseWriter, 'isAutomateActive', 'phase-writer');
  });

  it('implement-phase-evaluator.md exists with evaluation agent / user validates', () => {
    assert.ok(
      existsSync(join(ROOT, 'skills/shared/implement-phase-evaluator.md')),
      'skills/shared/implement-phase-evaluator.md must exist',
    );
    assertMatch(phaseEvaluator, /evaluation agent/i, 'evaluator');
    assertMatch(phaseEvaluator, /user validates/i, 'evaluator');
    assertIncludes(phaseEvaluator, 'planEndReviewOk', 'evaluator');
    assertIncludes(phaseEvaluator, 'userValidationOk', 'evaluator');
  });

  it('does not introduce a top-level skills/core/automate.md skill', () => {
    assert.equal(
      existsSync(join(ROOT, 'skills/core/automate.md')),
      false,
      'skills/core/automate.md must not exist (extend implement, not a new skill)',
    );
  });

  it('project-transitions documents automate phase review via phaseReviewMode', () => {
    assertIncludes(transitions, 'phaseReviewMode', 'project-transitions.md');
    assertIncludes(transitions, 'isAutomateActive', 'project-transitions.md');
    assertMatch(transitions, /automateActive/, 'project-transitions.md');
    // Automate default is both (not the DESTRUCTIVE-only ladder alone).
    assertMatch(transitions, /both/, 'project-transitions.md');
  });

  it('project-finalize documents planEndReviewOk hard-block under automate', () => {
    assertIncludes(finalize, 'planEndReviewOk', 'project-finalize.md');
    assertIncludes(finalize, 'isAutomateActive', 'project-finalize.md');
    assertMatch(finalize, /HARD-BLOCK|HARD-BLOCKS/i, 'project-finalize.md');
    assertMatch(finalize, /skip-plan-end-review/, 'project-finalize.md');
    assertIncludes(finalize, 'userValidationOk', 'project-finalize.md');
  });
});

describe('implement automate helper wiring (imports + fail-closed)', () => {
  it('exports mode parse and isAutomateActive', () => {
    assert.equal(typeof parseImplementMode, 'function');
    assert.equal(typeof isAutomateActive, 'function');
    assert.equal(typeof stampExecutionMode, 'function');
    assert.equal(typeof clearExecutionModeStamp, 'function');
    assert.equal(typeof hasAutomateStamp, 'function');

    const parsed = parseImplementMode('--mode=automate');
    assert.equal(parsed.mode, 'automate');
    assert.equal(parsed.modeExplicit, true);
    assert.equal(isAutomateActive({ cliMode: 'automate' }), true);
    assert.equal(isAutomateActive({}), false);
    assert.equal(
      isAutomateActive({ planExecutionMode: 'automate' }),
      true,
      'stamp alone re-enters automate',
    );
    assert.equal(
      isAutomateActive({
        planExecutionMode: 'automate',
        clearExecutionMode: true,
      }),
      false,
    );
  });

  it('exports isComplexTask', () => {
    assert.equal(typeof isComplexTask, 'function');
    assert.equal(isComplexTask({ weight: 3 }), true);
    assert.equal(isComplexTask({ weight: 1, tags: [] }), false);
    assert.equal(isComplexTask({ tags: ['destructive'] }), true);
  });

  it('phaseReviewMode under automate defaults to both', () => {
    assert.equal(typeof phaseReviewMode, 'function');
    assert.equal(phaseReviewMode({ automateActive: true }), 'both');
    assert.equal(
      phaseReviewMode({ automateActive: true, destructive: false }),
      'both',
      'automate forces both regardless of destructive',
    );
    assert.equal(
      phaseReviewMode({ automateActive: false, destructive: false }),
      'local',
    );
    // F3: local override without reason under automate → both
    assert.equal(
      phaseReviewMode({ automateActive: true, explicitOverride: 'local' }),
      'both',
    );
  });

  it('planEndReviewOk fail-closed when familyDifferent is missing', () => {
    assert.equal(typeof planEndReviewOk, 'function');
    assert.equal(typeof userValidationOk, 'function');
    assert.equal(typeof automatePlanEndGatesOk, 'function');

    const shape = {
      mode: 'external-both',
      reviewFile: '.atomic-skills/reviews/contract.md',
      verifiedAt: '2026-07-17T12:00:00.000Z',
    };

    // Succeeded leg without familyDifferent === true must NOT pass.
    assert.equal(
      planEndReviewOk({
        ...shape,
        legs: [{ provider: 'codex', status: 'succeeded' }],
      }),
      false,
      'missing familyDifferent is not true (fail-closed)',
    );
    assert.equal(
      planEndReviewOk({
        ...shape,
        legs: [{ provider: 'codex', status: 'succeeded', familyDifferent: false }],
      }),
      false,
    );
    assert.equal(
      planEndReviewOk({
        ...shape,
        legs: [{ provider: 'codex', status: 'succeeded', familyDifferent: true }],
      }),
      true,
    );
    // Bare succeeded leg without receipt shape is not ok (Fix A).
    assert.equal(
      planEndReviewOk({
        legs: [{ provider: 'codex', status: 'succeeded', familyDifferent: true }],
      }),
      false,
      'non-skip path requires reviewFile/mode/verifiedAt',
    );
    assert.equal(planEndReviewOk(null), false);
    assert.equal(planEndReviewOk({}), false);

    assert.equal(
      userValidationOk({ automateActive: true }),
      false,
      'under automate, missing userValidatedAt fails',
    );
    assert.equal(
      userValidationOk({
        automateActive: true,
        userValidatedAt: '2026-07-17T12:00:00.000Z',
      }),
      true,
    );

    // Stamp alone fail-closes gates without automateActive flag (Fix B).
    const stampGates = automatePlanEndGatesOk({
      planExecutionMode: 'automate',
      receipt: {
        ...shape,
        legs: [{ provider: 'codex', status: 'succeeded' }], // no familyDifferent
      },
      userValidatedAt: '2026-07-17T12:00:00.000Z',
    });
    assert.equal(stampGates.ok, false);
    assert.equal(stampGates.planEndReviewOk, false);

    const gates = automatePlanEndGatesOk({
      automateActive: true,
      receipt: {
        ...shape,
        legs: [{ provider: 'codex', status: 'succeeded' }], // no familyDifferent
      },
      userValidatedAt: '2026-07-17T12:00:00.000Z',
    });
    assert.equal(gates.ok, false);
    assert.equal(gates.planEndReviewOk, false);
  });

  it('exports claim-report validate helpers', () => {
    assert.equal(typeof validateClaimReport, 'function');
    assert.equal(typeof parseClaimReport, 'function');
    assert.equal(typeof validatedRangeForDone, 'function');
    assert.equal(typeof validateClaimReachability, 'function');

    const bad = validateClaimReport({ tasks: [] });
    assert.equal(bad.ok, false);

    const good = validateClaimReport({
      tasks: [
        {
          taskId: 'T-001',
          status: 'claimed-pass',
          commitShas: ['abc1234'],
          paths: ['src/x.js'],
          verifierCommand: 'node --test tests/x.test.js',
          exitCode: 0,
          transcript: '',
        },
      ],
    });
    assert.equal(good.ok, true, good.errors?.join('; '));
  });

  it('exports writer-lease helpers', () => {
    assert.equal(typeof leasePath, 'function');
    assert.equal(typeof isLeaseActive, 'function');
    assert.equal(typeof buildActiveLease, 'function');
    assert.equal(typeof leaseOwnerToken, 'function');
    assert.equal(typeof isLeaseBlocking, 'function');
    assert.equal(typeof readLeaseResult, 'function');
    assert.equal(typeof acquireLeaseFile, 'function');
    assert.equal(typeof clearLeaseFile, 'function');
    assert.equal(typeof assertLeaseAbsent, 'function');

    const lease = buildActiveLease({
      planSlug: 'implementation-automate-mode',
      phaseId: 'F4',
      hostId: 'contract-test',
      worktreePath: '/tmp/wt',
      startedAt: '2026-07-17T00:00:00.000Z',
    });
    assert.equal(isLeaseActive(lease), true);
    const token = leaseOwnerToken(lease);
    assert.equal(token.planSlug, 'implementation-automate-mode');
    assert.ok(leasePath('/tmp/status', 'implementation-automate-mode').includes('writer-leases'));
  });
});

describe('F11 — adversarial contract cases', () => {
  it('stamp re-entry without mode flag: parse mode undefined + stamp → automate active', () => {
    const parsed = parseImplementMode(['my-plan']);
    assert.equal(parsed.mode, undefined);
    assert.equal(parsed.modeExplicit, false);
    assert.equal(
      isAutomateActive({
        cliMode: parsed.mode,
        planExecutionMode: 'automate',
      }),
      true,
    );
  });

  it('lease clear wrong secret fails; correct secret clears', () => {
    const statusRoot = mkdtempSync(pathJoin(tmpdir(), 'contract-lease-'));
    try {
      const lease = buildActiveLease({
        planSlug: 'contract-plan',
        phaseId: 'F1',
        hostId: 'h',
        worktreePath: '/wt',
        startedAt: '2026-07-17T00:00:00.000Z',
      });
      const { path, secret } = acquireLeaseFile(statusRoot, lease);
      const disk = JSON.parse(fsRead(path, 'utf8'));
      assert.equal(disk.tokenHash, hashLeaseSecret(secret));
      assert.equal(disk.secret, undefined);
      assert.throws(() => clearLeaseFile(statusRoot, 'contract-plan', 'wrong'), /secret|mismatch/i);
      assert.equal(isLeaseBlocking(statusRoot, 'contract-plan'), true);
      assert.equal(clearLeaseFile(statusRoot, 'contract-plan', secret), true);
      assert.equal(isLeaseBlocking(statusRoot, 'contract-plan'), false);
      assert.doesNotThrow(() => assertLeaseAbsent(statusRoot, 'contract-plan'));
    } finally {
      rmSync(statusRoot, { recursive: true, force: true });
    }
  });

  it('phaseReviewMode stamp alone → both (not local)', () => {
    assert.equal(phaseReviewMode({ planExecutionMode: 'automate' }), 'both');
    assert.notEqual(phaseReviewMode({ planExecutionMode: 'automate' }), 'local');
  });

  it('planEndReviewOk rejects mode both; accepts external-both', () => {
    const shape = {
      reviewFile: '.atomic-skills/reviews/x.md',
      verifiedAt: '2026-07-17T12:00:00.000Z',
      legs: [{ provider: 'codex', status: 'succeeded', familyDifferent: true }],
    };
    assert.equal(planEndReviewOk({ ...shape, mode: 'both' }), false);
    assert.equal(planEndReviewOk({ ...shape, mode: 'external-both' }), true);
  });

  it('claimed-pass empty paths fails', () => {
    const r = validateClaimReport({
      tasks: [
        {
          taskId: 'T-001',
          status: 'claimed-pass',
          commitShas: ['abc'],
          paths: [],
          verifierCommand: 'node --test',
          exitCode: 0,
          transcript: '',
        },
      ],
    });
    assert.equal(r.ok, false);
    assert.ok(r.errors.some((e) => /paths/i.test(e)));
  });

  it('claimed-pass exitCode null fails', () => {
    const r = validateClaimReport({
      tasks: [
        {
          taskId: 'T-001',
          status: 'claimed-pass',
          commitShas: ['abc'],
          paths: ['src/x.js'],
          verifierCommand: 'node --test',
          exitCode: null,
          transcript: '',
        },
      ],
    });
    assert.equal(r.ok, false);
    assert.ok(r.errors.some((e) => /exitCode/i.test(e)));
  });
});
