import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { stringify as stringifyYaml } from 'yaml';
import {
  findPlansMissingGroundTruth,
  assessGroundTruthPlanFile,
} from '../scripts/find-plans-missing-ground-truth.js';

function writePlan(path, fm, body = '') {
  writeFileSync(path, `---\n${stringifyYaml(fm).trimEnd()}\n---\n${body}`);
}

function gtSection() {
  return `
## Ground-truth review

**Status:** complete
**Codebase class:** thin
**Scanned:** src/ → 1 files
**Commit:** a1b2c3d
**At:** 2026-07-28T12:00:00Z

### A — Plan premises vs code

| # | Premise | Result | Evidence |
|---|---------|--------|----------|
| — | none | ok | n/a |

### B — Code present, plan silent (impact candidates)

| # | Finding | Location | Impact | Disposition |
|---|---------|----------|--------|-------------|
| — | none | — | none | n/a |

**Counts:** premises=0 (missing=0, false=0); impacts=0
`.trim();
}

function stampBody(fp) {
  return `${gtSection()}

## Reviews

- internal: zero findings @ a1b2c3d (2026-07-28T12:00:00Z)
- ground-truth: complete | mode=ground-truth | fp=${fp} | premises=0 | impacts=0 @ a1b2c3d (2026-07-28T12:00:00Z)
`;
}

function nestedPlanWithGt(root, projId, slug, title = slug) {
  const dir = join(root, '.atomic-skills', 'projects', projId, slug);
  mkdirSync(dir, { recursive: true });
  const fm = { schemaVersion: '0.1', slug, title, status: 'active' };
  // draft with dummy fp to compute
  writePlan(join(dir, 'plan.md'), fm, stampBody('deadbeefdead'));
  const raw = readFileSync(join(dir, 'plan.md'), 'utf8');
  const { fingerprint } = assessGroundTruthPlanFile(raw);
  writePlan(join(dir, 'plan.md'), fm, stampBody(fingerprint));
  return dir;
}

const INTERNAL_ONLY = `
## Reviews

- internal: zero findings @ a1b2c3d (2026-07-28T12:00:00Z)
`;

test('findPlansMissingGroundTruth: full fresh receipt not reported', () => {
  const root = mkdtempSync(join(tmpdir(), 'as-gt-ok-'));
  try {
    nestedPlanWithGt(root, 'proj', 'ready');
    assert.deepEqual(findPlansMissingGroundTruth(root), []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('findPlansMissingGroundTruth: empty-repo style receipt not reported', () => {
  const root = mkdtempSync(join(tmpdir(), 'as-gt-empty-'));
  try {
    const dir = join(root, '.atomic-skills', 'projects', 'proj', 'greenfield');
    mkdirSync(dir, { recursive: true });
    const fm = { schemaVersion: '0.1', slug: 'greenfield', title: 'greenfield', status: 'active' };
    const body = `
## Ground-truth review

**Status:** complete-empty-repo
**Codebase class:** empty
**Scanned:** src/, lib/ → 0 product files
**Commit:** uncommitted
**At:** 2026-07-28T12:00:00Z

### A — Plan premises vs code

| # | Premise | Result | Evidence |
|---|---------|--------|----------|
| — | none — greenfield | ok | empty |

### B — Code present, plan silent (impact candidates)

| # | Finding | Location | Impact | Disposition |
|---|---------|----------|--------|-------------|
| — | none — empty tree | — | none | n/a |

**Counts:** premises=0; impacts=0

## Reviews

- ground-truth: complete-empty-repo | mode=gt | fp=PLACEHOLDER @ uncommitted (2026-07-28T12:00:00Z)
`;
    writePlan(join(dir, 'plan.md'), fm, body.replace('fp=PLACEHOLDER', 'fp=deadbeefdead'));
    const raw = readFileSync(join(dir, 'plan.md'), 'utf8');
    const { fingerprint } = assessGroundTruthPlanFile(raw);
    writePlan(join(dir, 'plan.md'), fm, body.replace('fp=PLACEHOLDER', `fp=${fingerprint}`));
    assert.deepEqual(findPlansMissingGroundTruth(root), []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('findPlansMissingGroundTruth: internal-only is reported', () => {
  const root = mkdtempSync(join(tmpdir(), 'as-gt-internal-'));
  try {
    const dir = join(root, '.atomic-skills', 'projects', 'proj', 'no-gt');
    mkdirSync(dir, { recursive: true });
    writePlan(
      join(dir, 'plan.md'),
      { schemaVersion: '0.1', slug: 'no-gt', title: 'no-gt', status: 'active' },
      INTERNAL_ONLY,
    );
    const report = findPlansMissingGroundTruth(root);
    assert.equal(report.length, 1);
    assert.equal(report[0].reason, 'no-ground-truth-line');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('findPlansMissingGroundTruth: stale after plan title change', () => {
  const root = mkdtempSync(join(tmpdir(), 'as-gt-stale-'));
  try {
    const dir = nestedPlanWithGt(root, 'proj', 'stale-me', 'original-title');
    assert.deepEqual(findPlansMissingGroundTruth(join(dir, 'plan.md')), []);
    // mutate substance
    const path = join(dir, 'plan.md');
    const raw = readFileSync(path, 'utf8');
    writeFileSync(path, raw.replace('title: original-title', 'title: mutated-title'));
    const report = findPlansMissingGroundTruth(path);
    assert.equal(report.length, 1);
    assert.equal(report[0].reason, 'stale-ground-truth-receipt');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('findPlansMissingGroundTruth: archived skipped', () => {
  const root = mkdtempSync(join(tmpdir(), 'as-gt-arch-'));
  try {
    const dir = join(root, '.atomic-skills', 'projects', 'proj', 'old');
    mkdirSync(dir, { recursive: true });
    writePlan(
      join(dir, 'plan.md'),
      { schemaVersion: '0.1', slug: 'old', title: 'old', status: 'archived' },
      INTERNAL_ONLY,
    );
    assert.deepEqual(findPlansMissingGroundTruth(root), []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('findPlansMissingGroundTruth: scoped plan file', () => {
  const root = mkdtempSync(join(tmpdir(), 'as-gt-scoped-'));
  try {
    const planDir = join(root, '.atomic-skills', 'projects', 'mesh', 'p1');
    mkdirSync(planDir, { recursive: true });
    writePlan(
      join(planDir, 'plan.md'),
      { schemaVersion: '0.1', slug: 'p1', title: 'p1', status: 'active' },
      INTERNAL_ONLY,
    );
    nestedPlanWithGt(root, 'mesh', 'p2');
    const report = findPlansMissingGroundTruth(join(planDir, 'plan.md'));
    assert.equal(report.length, 1);
    assert.equal(report[0].planSlug, 'p1');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
