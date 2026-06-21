import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { parse as parseYaml } from 'yaml';
import {
  LINKS_FILE,
  linksPath,
  readLinks,
  writeLinks,
  setSpawnedFrom,
  getSpawnedFrom,
  addSpawnedPlan,
  getSpawnedPlans,
  migrateSidecarToInline,
  validateLinks,
  assertValidLinks,
} from '../src/links-sidecar.js';

function withTmp(fn) {
  const root = mkdtempSync(join(tmpdir(), 'links-sidecar-'));
  try {
    return fn(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function planDir(root, slug) {
  const dir = join(root, slug);
  mkdirSync(dir, { recursive: true });
  return dir;
}

/** A plan dir WITH a plan.md carrying the given phases — required now that the
 *  elo lives INLINE in plan.md frontmatter (F5/T-003), not in the sidecar. */
function planDirMd(root, slug, phaseIds = ['F1', 'F2', 'F3', 'F5']) {
  const dir = planDir(root, slug);
  const phases = phaseIds.map((id) => `  - id: ${id}\n    status: active`).join('\n');
  writeFileSync(join(dir, 'plan.md'), `---\nschemaVersion: "0.1"\nslug: ${slug}\nstatus: active\nphases:\n${phases}\n---\n\nbody\n`, 'utf8');
  return dir;
}

describe('links-sidecar reader/writer', () => {
  it('readLinks returns {} when no links.json exists', () => {
    withTmp((root) => {
      const dir = planDir(root, 'plan-a');
      assert.deepEqual(readLinks(dir), {});
      assert.equal(existsSync(linksPath(dir)), false);
    });
  });

  it('writeLinks creates links.json at the plan dir and reads back', () => {
    withTmp((root) => {
      const dir = planDir(root, 'plan-a');
      writeLinks(dir, { spawnedFrom: { plan: 'p', phaseId: 'F1', mode: 'pause' } });
      assert.equal(linksPath(dir), join(dir, LINKS_FILE));
      assert.ok(existsSync(linksPath(dir)));
      // JSON-with-trailing-newline convention (matches manifest.js)
      assert.ok(readFileSync(linksPath(dir), 'utf8').endsWith('}\n'));
      assert.deepEqual(readLinks(dir).spawnedFrom, { plan: 'p', phaseId: 'F1', mode: 'pause' });
    });
  });

  it('writeLinks creates the plan dir if missing (recursive)', () => {
    withTmp((root) => {
      const dir = join(root, 'projects', 'proj', 'plan-x');
      writeLinks(dir, { spawnedPlans: {} });
      assert.ok(existsSync(linksPath(dir)));
    });
  });

  it('setSpawnedFrom writes the child link INLINE and omits an undefined taskId', () => {
    withTmp((root) => {
      const dir = planDirMd(root, 'child');
      setSpawnedFrom(dir, { plan: 'parent', phaseId: 'F2', mode: 'pause' });
      assert.deepEqual(getSpawnedFrom(dir), { plan: 'parent', phaseId: 'F2', mode: 'pause' });
      assert.equal('taskId' in getSpawnedFrom(dir), false);
      // it lives in plan.md frontmatter, and NO sidecar is created for the elo.
      assert.ok(parseYaml(readFileSync(join(dir, 'plan.md'), 'utf8').split('---\n')[1]).spawnedFrom);
      assert.equal(existsSync(linksPath(dir)), false, 'no links.json — elo is inline');
    });
  });

  it('setSpawnedFrom keeps taskId when provided', () => {
    withTmp((root) => {
      const dir = planDirMd(root, 'child');
      setSpawnedFrom(dir, { plan: 'parent', phaseId: 'F2', taskId: 'T-003', mode: 'parallel' });
      assert.deepEqual(getSpawnedFrom(dir), {
        plan: 'parent',
        phaseId: 'F2',
        taskId: 'T-003',
        mode: 'parallel',
      });
    });
  });

  it('setSpawnedFrom throws when the child has no plan.md (a fork child is a real plan)', () => {
    withTmp((root) => {
      assert.throws(() => setSpawnedFrom(planDir(root, 'bare'), { plan: 'p', phaseId: 'F1', mode: 'pause' }), /no readable plan\.md/);
    });
  });

  it('getSpawnedFrom returns null when absent (plan.md without the field, or no plan.md)', () => {
    withTmp((root) => {
      assert.equal(getSpawnedFrom(planDirMd(root, 'plan-a')), null, 'plan.md without spawnedFrom');
      assert.equal(getSpawnedFrom(planDir(root, 'bare')), null, 'no plan.md at all');
    });
  });

  it('addSpawnedPlan accumulates child slugs per phase descriptor without duplicates', () => {
    withTmp((root) => {
      const dir = planDirMd(root, 'parent');
      addSpawnedPlan(dir, 'F2', 'child-a');
      addSpawnedPlan(dir, 'F2', 'child-b');
      addSpawnedPlan(dir, 'F2', 'child-a'); // dup → ignored
      addSpawnedPlan(dir, 'F5', 'child-c');
      assert.deepEqual(getSpawnedPlans(dir), { F2: ['child-a', 'child-b'], F5: ['child-c'] });
      // it lives on the phase descriptor in plan.md, not a sidecar.
      const phases = parseYaml(readFileSync(join(dir, 'plan.md'), 'utf8').split('---\n')[1]).phases;
      assert.deepEqual(phases.find((p) => p.id === 'F2').spawnedPlans, ['child-a', 'child-b']);
      assert.equal(existsSync(linksPath(dir)), false, 'no links.json — elo is inline');
    });
  });

  it('addSpawnedPlan throws on an anchor phase not present in the parent (never guess)', () => {
    withTmp((root) => {
      assert.throws(() => addSpawnedPlan(planDirMd(root, 'parent', ['F1']), 'F9', 'child'), /anchor phase 'F9' not found/);
    });
  });

  it('getSpawnedPlans returns {} when absent', () => {
    withTmp((root) => {
      assert.deepEqual(getSpawnedPlans(planDirMd(root, 'plan-a')), {});
    });
  });

  it('child and parent link writes do not clobber each other in the same plan.md', () => {
    withTmp((root) => {
      // a plan that is both a child (of grandparent) and a parent (of grandchild)
      const dir = planDirMd(root, 'middle');
      setSpawnedFrom(dir, { plan: 'grandparent', phaseId: 'F1', mode: 'pause' });
      addSpawnedPlan(dir, 'F3', 'grandchild');
      assert.deepEqual(getSpawnedFrom(dir), { plan: 'grandparent', phaseId: 'F1', mode: 'pause' });
      assert.deepEqual(getSpawnedPlans(dir), { F3: ['grandchild'] });
    });
  });
});

describe('links-sidecar read hardening (corrupt/empty/non-object sidecar)', () => {
  it('readLinks throws a path-bearing error on an empty file', () => {
    withTmp((root) => {
      const dir = planDir(root, 'plan-a');
      writeFileSync(linksPath(dir), '', 'utf8');
      assert.throws(
        () => readLinks(dir),
        (err) => /not valid JSON/.test(err.message) && err.message.includes(linksPath(dir)),
      );
    });
  });

  it('readLinks throws a path-bearing error on malformed JSON', () => {
    withTmp((root) => {
      const dir = planDir(root, 'plan-a');
      writeFileSync(linksPath(dir), '{ "spawnedFrom": ', 'utf8');
      assert.throws(
        () => readLinks(dir),
        (err) => /not valid JSON/.test(err.message) && err.message.includes(linksPath(dir)),
      );
    });
  });

  it('readLinks rejects a present-but-non-object sidecar (null / array / primitive)', () => {
    withTmp((root) => {
      for (const [content, label] of [
        ['null', 'null'],
        ['[]', 'array'],
        ['5', 'number'],
        ['"x"', 'string'],
      ]) {
        const dir = planDir(root, `plan-${label}`);
        writeFileSync(linksPath(dir), content, 'utf8');
        assert.throws(
          () => readLinks(dir),
          (err) => /must be a JSON object/.test(err.message) && err.message.includes(linksPath(dir)),
          `expected ${label} content to be rejected`,
        );
      }
    });
  });
});

describe('fork link is INLINE in plan.md frontmatter (F5/T-003 — supersedes the sidecar)', () => {
  it('forking writes the edge into the frontmatter on both sides, no elo sidecar', () => {
    withTmp((root) => {
      const childDir = planDirMd(root, 'child', ['F0']);
      const parentDir = planDirMd(root, 'parent', ['F2']);

      setSpawnedFrom(childDir, { plan: 'parent', phaseId: 'F2', mode: 'pause' });
      addSpawnedPlan(parentDir, 'F2', 'child');

      // child plan.md frontmatter now carries spawnedFrom (top-level)
      const childFm = parseYaml(readFileSync(join(childDir, 'plan.md'), 'utf8').split('---\n')[1]);
      assert.deepEqual(childFm.spawnedFrom, { plan: 'parent', phaseId: 'F2', mode: 'pause' });
      // parent plan.md carries spawnedPlans on the anchor phase descriptor
      const parentFm = parseYaml(readFileSync(join(parentDir, 'plan.md'), 'utf8').split('---\n')[1]);
      assert.deepEqual(parentFm.phases.find((p) => p.id === 'F2').spawnedPlans, ['child']);
      // no links.json is created for the elo on either side
      assert.equal(existsSync(linksPath(childDir)), false);
      assert.equal(existsSync(linksPath(parentDir)), false);
      // and it reads back through the same API
      assert.deepEqual(getSpawnedFrom(childDir), { plan: 'parent', phaseId: 'F2', mode: 'pause' });
      assert.deepEqual(getSpawnedPlans(parentDir), { F2: ['child'] });
    });
  });
});

describe('migrateSidecarToInline (retire a legacy links.json elo into plan.md)', () => {
  it('moves spawnedFrom + spawnedPlans inline and deletes an elo-only sidecar', () => {
    withTmp((root) => {
      const dir = planDirMd(root, 'mid', ['F3']);
      // a legacy sidecar carrying both edges (pre-inline format)
      writeLinks(dir, { spawnedFrom: { plan: 'gp', phaseId: 'F1', mode: 'pause' }, spawnedPlans: { F3: ['gc'] } });
      const res = migrateSidecarToInline(dir);
      assert.deepEqual(res, { migrated: true, spawnedFrom: true, spawnedPlans: true, sidecarRemoved: true });
      assert.equal(existsSync(linksPath(dir)), false, 'elo-only sidecar deleted after migration');
      assert.deepEqual(getSpawnedFrom(dir), { plan: 'gp', phaseId: 'F1', mode: 'pause' });
      assert.deepEqual(getSpawnedPlans(dir), { F3: ['gc'] });
    });
  });

  it('preserves a pendingWriteback marker when retiring the elo (keeps the sidecar)', () => {
    withTmp((root) => {
      const dir = planDirMd(root, 'child', ['F0']);
      writeLinks(dir, {
        spawnedFrom: { plan: 'p', phaseId: 'F0', mode: 'parallel' },
        pendingWriteback: { target: 'parent-plan', parent: 'p', op: 'resumeParent', args: { phaseId: 'F0' }, readToken: 'tok', detectedAt: '2026-06-21T00:00:00Z' },
      });
      const res = migrateSidecarToInline(dir);
      assert.equal(res.sidecarRemoved, false, 'sidecar kept because pendingWriteback remains');
      assert.deepEqual(getSpawnedFrom(dir), { plan: 'p', phaseId: 'F0', mode: 'parallel' });
      assert.equal('spawnedFrom' in readLinks(dir), false, 'elo stripped from the sidecar');
      assert.ok(readLinks(dir).pendingWriteback, 'transient recovery marker preserved');
    });
  });

  it('is a no-op when there is no sidecar or it carries no elo', () => {
    withTmp((root) => {
      const dir = planDirMd(root, 'plain', ['F0']);
      assert.equal(migrateSidecarToInline(dir).migrated, false, 'no sidecar → no-op');
      writeLinks(dir, { pendingWriteback: { target: 'parent-plan', parent: 'p', op: 'resumeParent', args: { phaseId: 'F0' }, readToken: 'tok', detectedAt: '2026-06-21T00:00:00Z' } });
      assert.equal(migrateSidecarToInline(dir).migrated, false, 'sidecar without elo → no-op');
      assert.ok(readLinks(dir).pendingWriteback, 'pendingWriteback-only sidecar untouched');
    });
  });

  it('throws (never silently drops) when a sidecar spawnedPlans phaseId has no matching phase', () => {
    withTmp((root) => {
      const dir = planDirMd(root, 'p', ['F1']);
      writeLinks(dir, { spawnedPlans: { F9: ['c'] } });
      assert.throws(() => migrateSidecarToInline(dir), /anchor phase 'F9' not found/);
    });
  });
});

describe('links-sidecar schema validation (T-002)', () => {
  it('accepts a fully-formed link (spawnedFrom + spawnedPlans)', () => {
    const result = validateLinks({
      spawnedFrom: { plan: 'parent', phaseId: 'F2', taskId: 'T-003', mode: 'parallel' },
      spawnedPlans: { F2: ['child-a', 'child-b'], F5: ['child-c'] },
    });
    assert.equal(result.valid, true);
    assert.deepEqual(result.errors, []);
  });

  it('accepts an empty object (both fields optional)', () => {
    assert.equal(validateLinks({}).valid, true);
  });

  it('accepts spawnedFrom without the optional taskId', () => {
    assert.equal(validateLinks({ spawnedFrom: { plan: 'p', phaseId: 'F1', mode: 'pause' } }).valid, true);
  });

  it('rejects a mode outside the enum', () => {
    const result = validateLinks({ spawnedFrom: { plan: 'p', phaseId: 'F1', mode: 'merge' } });
    assert.equal(result.valid, false);
    assert.ok(result.errors.length > 0);
  });

  it('rejects spawnedFrom missing a required field (plan)', () => {
    assert.equal(validateLinks({ spawnedFrom: { phaseId: 'F1', mode: 'pause' } }).valid, false);
  });

  it('rejects an unknown top-level property', () => {
    assert.equal(validateLinks({ supersedes: 'other-plan' }).valid, false);
  });

  it('rejects an unknown property inside spawnedFrom', () => {
    assert.equal(
      validateLinks({ spawnedFrom: { plan: 'p', phaseId: 'F1', mode: 'pause', bogus: 1 } }).valid,
      false,
    );
  });

  it('rejects spawnedPlans whose value is not an array of strings', () => {
    assert.equal(validateLinks({ spawnedPlans: { F2: 'child' } }).valid, false);
    assert.equal(validateLinks({ spawnedPlans: { F2: [1, 2] } }).valid, false);
  });

  it('assertValidLinks returns the data on valid and throws on invalid', () => {
    const ok = { spawnedFrom: { plan: 'p', phaseId: 'F1', mode: 'pause' } };
    assert.equal(assertValidLinks(ok), ok);
    assert.throws(() => assertValidLinks({ spawnedFrom: { plan: 'p', phaseId: 'F1', mode: 'x' } }), /invalid/i);
  });

  it('writeLinks/setSpawnedFrom reject an out-of-enum mode at the write boundary', () => {
    withTmp((root) => {
      const dir = planDir(root, 'child');
      assert.throws(() => setSpawnedFrom(dir, { plan: 'p', phaseId: 'F1', mode: 'merge' }), /invalid/i);
      // nothing was persisted
      assert.equal(existsSync(linksPath(dir)), false);
    });
  });
});

const FIXTURE_PARENT = 'tests/fixtures/plan-fork/plans/fixture-parent.md';
const FIXTURE_CHILD = 'tests/fixtures/plan-fork/plans/fixture-child.md';

function fixtureFrontmatter(raw) {
  return parseYaml(raw.split('---\n')[1]);
}

describe('links-sidecar parent/child fixtures + validate-state approval (T-004 → inline T-003)', () => {
  it('both fixtures carry the elo INLINE in their frontmatter', () => {
    const childFm = fixtureFrontmatter(readFileSync(FIXTURE_CHILD, 'utf8'));
    assert.deepEqual(childFm.spawnedFrom, { plan: 'fixture-parent', phaseId: 'F0', mode: 'pause' });
    const parentFm = fixtureFrontmatter(readFileSync(FIXTURE_PARENT, 'utf8'));
    assert.deepEqual(parentFm.phases.find((p) => p.id === 'F0').spawnedPlans, ['fixture-child']);
  });

  it('validate-state APPROVES the inline-elo pair (exit 0) — the schema accepts the fields', () => {
    // throws if validate-state exits non-zero; the inline spawnedFrom/spawnedPlans
    // must pass plan.schema.json (the T-003 schema additions).
    execFileSync('node', ['scripts/validate-state.js', FIXTURE_PARENT, FIXTURE_CHILD], {
      stdio: 'pipe',
    });
  });

  it('the fork link reads back from the inline frontmatter (no sidecar)', () => {
    withTmp((root) => {
      const parentDir = planDir(root, 'fixture-parent');
      const childDir = planDir(root, 'fixture-child');
      writeFileSync(join(parentDir, 'plan.md'), readFileSync(FIXTURE_PARENT, 'utf8'), 'utf8');
      writeFileSync(join(childDir, 'plan.md'), readFileSync(FIXTURE_CHILD, 'utf8'), 'utf8');

      // the edge is already inline in the fixtures — read it back through the API
      assert.deepEqual(getSpawnedPlans(parentDir), { F0: ['fixture-child'] });
      assert.deepEqual(getSpawnedFrom(childDir), { plan: 'fixture-parent', phaseId: 'F0', mode: 'pause' });
      // no links.json anywhere — the elo is purely inline
      assert.equal(existsSync(linksPath(parentDir)), false);
      assert.equal(existsSync(linksPath(childDir)), false);
    });
  });
});
