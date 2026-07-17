/**
 * Regression tests for Codex CROSS-MODEL findings on integrity-remediation.
 */
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { composePlanWorktreeAdd } from '../src/project-target-resolver.js';
import { pruneEmptyLockRoot, lockFileName, resourceIdentity } from '../src/runtime-locks.js';
import { confinedPath, validateStagedPair } from '../scripts/materialize-state.js';
import { decideDoneTerminal } from '../scripts/done-transaction.js';
import { readInstallsRegistry } from '../src/install.js';
import { openSync, closeSync, writeSync, constants } from 'node:fs';

describe('Codex F-001 argv worktree compose', () => {
  it('returns argv without shell interpolation surface', () => {
    const inv = composePlanWorktreeAdd({ slug: 'x', branch: 'plan/x', branchExists: true });
    assert.equal(inv.executable, 'git');
    assert.ok(Array.isArray(inv.argv));
    assert.equal(inv.argv.includes(';'), false);
  });
});

describe('Codex F-002 confined materialize paths', () => {
  it('rejects absolute and escaping marker paths', () => {
    const base = mkdtempSync(join(tmpdir(), 'mat-conf-'));
    assert.throws(() => confinedPath(base, '/etc/passwd', 'x'), /absolute/);
    assert.throws(() => confinedPath(base, '../outside', 'x'), /escapes/);
    const ok = confinedPath(base, 'plan.md.materialize-stage', 'x');
    assert.ok(ok.startsWith(base));
    rmSync(base, { recursive: true, force: true });
  });

  it('requires identity join fields on staged pair', () => {
    const plan = `---
schemaVersion: "0.1"
slug: p
phases:
  - id: F1
    slug: p-f1
    status: pending
---
# p
`;
    const badInit = `---
schemaVersion: "0.1"
slug: wrong
phaseId: F1
parentPlan: other
---
# i
`;
    assert.throws(() => validateStagedPair(plan, badInit), /parentPlan/);
  });
});

describe('Codex F-003 pruneEmptyLockRoot does not sweep live locks', () => {
  it('leaves a lock file with a live pid', () => {
    const root = mkdtempSync(join(tmpdir(), 'locks-'));
    const id = resourceIdentity('registry', '/tmp/x');
    const file = join(root, lockFileName(id));
    writeFileSync(file, JSON.stringify({ pid: process.pid, identity: id }) + '\n');
    pruneEmptyLockRoot(root);
    assert.equal(existsSync(file), true, 'live lock must survive prune');
    rmSync(root, { recursive: true, force: true });
  });
});

describe('Codex F-006 done-transaction stale evidence', () => {
  it('rejects stored evidence.passed when verifierPassed is false', () => {
    const d = decideDoneTerminal({
      taskId: 'T-001',
      projectId: 'p',
      planSlug: 'plan',
      phaseId: 'F0',
      task: { id: 'T-001', status: 'pending', evidence: { passed: true, verifiedCommit: 'aaa' }, verifier: { kind: 'shell' } },
      fingerprint: 'bbb',
      verifierPassed: false,
    });
    assert.equal(d.allowed, false);
  });

  it('rejects fresh close with evidence.passed but mismatched verifiedCommit', () => {
    const d = decideDoneTerminal({
      taskId: 'T-001',
      projectId: 'p',
      planSlug: 'plan',
      phaseId: 'F0',
      task: { id: 'T-001', status: 'pending', evidence: { passed: true, verifiedCommit: 'oldsha' }, verifier: { kind: 'shell' } },
      fingerprint: 'newsha',
    });
    assert.equal(d.allowed, false);
  });
});

describe('Codex F-005 registry fail-closed', () => {
  it('throws on corrupt JSON', () => {
    const dir = mkdtempSync(join(tmpdir(), 'reg-'));
    const p = join(dir, 'installs.json');
    writeFileSync(p, '{not-json');
    assert.throws(() => readInstallsRegistry(p), /corrupt/i);
    rmSync(dir, { recursive: true, force: true });
  });
});
