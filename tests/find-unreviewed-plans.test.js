import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { stringify as stringifyYaml } from 'yaml';
import { findUnreviewedPlans } from '../scripts/find-unreviewed-plans.js';

/** Write a plan.md with frontmatter + a markdown body. */
function writePlan(path, fm, body = '') {
  writeFileSync(path, `---\n${stringifyYaml(fm).trimEnd()}\n---\n${body}`);
}

const REVIEWS_OK = `
## Self-review against code-quality gates

- G2: 0 occurrences.

## Reviews

- internal: zero findings @ a1b2c3d (2026-06-23T23:11:02Z)
- codex: SKIPPED — combinado com o usuário
`;

const REVIEWS_CODEX_ONLY = `
## Reviews

- codex: PASSED — .atomic-skills/reviews/2026-06-23-1900-x.md
`;

const NO_REVIEWS = `
## Self-review against code-quality gates

- Codex review: SKIPPED — roda depois via project review
`;

function nestedPlan(root, projId, slug, body) {
  const dir = join(root, '.atomic-skills', 'projects', projId, slug);
  mkdirSync(dir, { recursive: true });
  writePlan(join(dir, 'plan.md'), { schemaVersion: '0.1', slug, title: slug, status: 'active' }, body);
  return dir;
}

test('findUnreviewedPlans: a plan with a ## Reviews + internal line is NOT reported', () => {
  const root = mkdtempSync(join(tmpdir(), 'as-unrev-ok-'));
  try {
    nestedPlan(root, 'proj', 'reviewed', REVIEWS_OK);
    assert.deepEqual(findUnreviewedPlans(root), []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('findUnreviewedPlans: a plan with NO ## Reviews section is reported (no-reviews-section)', () => {
  const root = mkdtempSync(join(tmpdir(), 'as-unrev-none-'));
  try {
    nestedPlan(root, 'curta', 'refatoracao', NO_REVIEWS);
    const report = findUnreviewedPlans(root);
    assert.equal(report.length, 1);
    assert.equal(report[0].projectId, 'curta');
    assert.equal(report[0].planSlug, 'refatoracao');
    assert.equal(report[0].planFile, 'plan.md');
    assert.equal(report[0].reason, 'no-reviews-section');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('findUnreviewedPlans: a ## Reviews section with codex but no internal line is reported (no-internal-line)', () => {
  const root = mkdtempSync(join(tmpdir(), 'as-unrev-codexonly-'));
  try {
    nestedPlan(root, 'proj', 'codexonly', REVIEWS_CODEX_ONLY);
    const report = findUnreviewedPlans(root);
    assert.equal(report.length, 1);
    assert.equal(report[0].reason, 'no-internal-line');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('findUnreviewedPlans: archived plans are skipped (terminal, no receipt required)', () => {
  const root = mkdtempSync(join(tmpdir(), 'as-unrev-arch-'));
  try {
    const dir = join(root, '.atomic-skills', 'projects', 'proj', 'oldplan');
    mkdirSync(dir, { recursive: true });
    writePlan(join(dir, 'plan.md'), { schemaVersion: '0.1', slug: 'oldplan', title: 'old', status: 'archived' }, NO_REVIEWS);
    assert.deepEqual(findUnreviewedPlans(root), []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('findUnreviewedPlans: flat legacy plans/*.md is scanned too (no false green); archive/ skipped', () => {
  const root = mkdtempSync(join(tmpdir(), 'as-unrev-flat-'));
  try {
    const flat = join(root, '.atomic-skills', 'plans');
    mkdirSync(join(flat, 'archive'), { recursive: true });
    writePlan(join(flat, 'legacy-plan.md'), { schemaVersion: '0.1', slug: 'legacy-plan', title: 'legacy', status: 'active' }, NO_REVIEWS);
    writePlan(join(flat, 'archive', 'done.md'), { schemaVersion: '0.1', slug: 'done', title: 'done', status: 'active' }, NO_REVIEWS);
    const report = findUnreviewedPlans(root);
    assert.equal(report.length, 1, 'flat tree scanned, archive/ skipped');
    assert.equal(report[0].projectId, '(flat)');
    assert.equal(report[0].planSlug, 'plans');
    assert.equal(report[0].planFile, 'legacy-plan.md');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('findUnreviewedPlans: reports each unreviewed plan across multiple projects (the curta batch case)', () => {
  const root = mkdtempSync(join(tmpdir(), 'as-unrev-batch-'));
  try {
    nestedPlan(root, 'curta', 'refatoracao', NO_REVIEWS);
    nestedPlan(root, 'curta', 'web-app', NO_REVIEWS);
    nestedPlan(root, 'curta', 'reviewed', REVIEWS_OK); // this one is fine
    const report = findUnreviewedPlans(root);
    assert.equal(report.length, 2);
    assert.deepEqual(report.map((r) => r.planSlug).sort(), ['refatoracao', 'web-app']);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
