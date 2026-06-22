import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyConflictPath,
  unionLines,
  pickNewerByTimestamp,
  classifyBranchIntegration,
} from '../scripts/consolidation-resolve.js';

test('classifyConflictPath: runtime-regenerable focus.json → take-delete (auto)', () => {
  const r = classifyConflictPath('.atomic-skills/focus.json');
  assert.equal(r.class, 'runtime-regenerable');
  assert.equal(r.policy, 'take-delete');
  assert.equal(r.auto, true);
});

test('classifyConflictPath: append ledgers → union (auto)', () => {
  for (const p of [
    '.atomic-skills/reviews/INDEX.md',
    '.atomic-skills/status/dispatch-log.json',
    '.atomic-skills/projects/atomic-skills/ideas.md',
  ]) {
    const r = classifyConflictPath(p);
    assert.equal(r.policy, 'union', `${p} should union`);
    assert.equal(r.auto, true);
  }
});

test('classifyConflictPath: pointwise machine state → last-writer-wins (auto)', () => {
  const r = classifyConflictPath('.atomic-skills/status/last-review.json');
  assert.equal(r.class, 'pointwise-state');
  assert.equal(r.policy, 'last-writer-wins');
});

test('classifyConflictPath: PROJECT-STATUS.md (narrative) → take-ours-verify, NOT silent last-writer', () => {
  for (const p of [
    '.atomic-skills/PROJECT-STATUS.md',
    '.atomic-skills/projects/atomic-skills/PROJECT-STATUS.md',
  ]) {
    const r = classifyConflictPath(p);
    assert.equal(r.class, 'narrative-index');
    assert.equal(r.policy, 'take-ours-verify');
  }
});

test('classifyConflictPath: generated artifacts (default + injected) → regenerate', () => {
  assert.equal(classifyConflictPath('assets/aideck-consumer/schema.json').policy, 'regenerate');
  assert.equal(classifyConflictPath('src/dashboard/data/skills.generated.ts').policy, 'regenerate');
  assert.equal(
    classifyConflictPath('build/gen.ts', { generatedPaths: ['build/gen.ts'] }).policy,
    'regenerate',
  );
});

test('classifyConflictPath: FAIL-CLOSED — semantic/unknown source → eject (never auto)', () => {
  for (const p of [
    'scripts/emit-focus.js',
    'skills/core/project.md',
    'skills/shared/project-assets/project-transitions.md',
    'package.json',
    'tests/focus-digest.test.js',
    'some/random/file.ts',
  ]) {
    const r = classifyConflictPath(p);
    assert.equal(r.policy, 'eject', `${p} must eject`);
    assert.equal(r.auto, false, `${p} must not be auto-resolved`);
  }
});

test('classifyConflictPath: never-throws on non-string input → ejects', () => {
  for (const bad of [null, undefined, 42, {}, []]) {
    const r = classifyConflictPath(bad);
    assert.equal(r.policy, 'eject');
  }
});

test('unionLines: ours order preserved + theirs-only lines appended, deduped', () => {
  const ours = 'a\nb\nc\n';
  const theirs = 'b\nd\ne\n';
  assert.equal(unionLines(ours, theirs), 'a\nb\nc\nd\ne\n');
});

test('unionLines: empty side is identity; no spurious trailing newline', () => {
  assert.equal(unionLines('x\ny', ''), 'x\ny');
  assert.equal(unionLines('', 'p\nq\n'), 'p\nq\n');
});

test('pickNewerByTimestamp: newer theirs wins; newer ours wins', () => {
  const older = JSON.stringify({ lastReviewedAt: '2026-06-17T23:00:00Z', v: 'a' });
  const newer = JSON.stringify({ lastReviewedAt: '2026-06-19T19:53:00Z', v: 'b' });
  assert.equal(pickNewerByTimestamp(older, newer).side, 'theirs');
  assert.equal(pickNewerByTimestamp(newer, older).side, 'ours');
});

test('pickNewerByTimestamp: FAIL-CLOSED null when unparseable or no comparable timestamp', () => {
  assert.equal(pickNewerByTimestamp('{not json', '{}'), null);
  assert.equal(pickNewerByTimestamp(JSON.stringify({ a: 1 }), JSON.stringify({ b: 2 })), null);
});

test('classifyBranchIntegration: ahead>0 → merge; ahead=0+revert → revert-of-revert; ahead=0 alone → skip-noop', () => {
  assert.equal(classifyBranchIntegration({ aheadCount: 5 }).action, 'merge');
  const rr = classifyBranchIntegration({ aheadCount: 0, revertOfMergeSha: 'abc123' });
  assert.equal(rr.action, 'revert-of-revert');
  assert.equal(rr.revertSha, 'abc123');
  assert.equal(classifyBranchIntegration({ aheadCount: 0 }).action, 'skip-noop');
});

test('classifyBranchIntegration: never-throws on garbage input', () => {
  assert.equal(classifyBranchIntegration(null).action, 'merge'); // ahead unknown → default merge attempt
  assert.equal(classifyBranchIntegration(undefined).action, 'merge');
});
