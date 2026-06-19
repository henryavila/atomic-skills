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

  it('setSpawnedFrom writes the child link and omits an undefined taskId', () => {
    withTmp((root) => {
      const dir = planDir(root, 'child');
      setSpawnedFrom(dir, { plan: 'parent', phaseId: 'F2', mode: 'pause' });
      assert.deepEqual(getSpawnedFrom(dir), { plan: 'parent', phaseId: 'F2', mode: 'pause' });
      assert.equal('taskId' in getSpawnedFrom(dir), false);
    });
  });

  it('setSpawnedFrom keeps taskId when provided', () => {
    withTmp((root) => {
      const dir = planDir(root, 'child');
      setSpawnedFrom(dir, { plan: 'parent', phaseId: 'F2', taskId: 'T-003', mode: 'parallel' });
      assert.deepEqual(getSpawnedFrom(dir), {
        plan: 'parent',
        phaseId: 'F2',
        taskId: 'T-003',
        mode: 'parallel',
      });
    });
  });

  it('getSpawnedFrom returns null when absent', () => {
    withTmp((root) => {
      assert.equal(getSpawnedFrom(planDir(root, 'plan-a')), null);
    });
  });

  it('addSpawnedPlan accumulates child slugs per phase without duplicates', () => {
    withTmp((root) => {
      const dir = planDir(root, 'parent');
      addSpawnedPlan(dir, 'F2', 'child-a');
      addSpawnedPlan(dir, 'F2', 'child-b');
      addSpawnedPlan(dir, 'F2', 'child-a'); // dup → ignored
      addSpawnedPlan(dir, 'F5', 'child-c');
      assert.deepEqual(getSpawnedPlans(dir), { F2: ['child-a', 'child-b'], F5: ['child-c'] });
    });
  });

  it('getSpawnedPlans returns {} when absent', () => {
    withTmp((root) => {
      assert.deepEqual(getSpawnedPlans(planDir(root, 'plan-a')), {});
    });
  });

  it('child and parent link writes do not clobber each other in the same dir', () => {
    withTmp((root) => {
      // a plan that is both a child (of grandparent) and a parent (of grandchild)
      const dir = planDir(root, 'middle');
      setSpawnedFrom(dir, { plan: 'grandparent', phaseId: 'F1', mode: 'pause' });
      addSpawnedPlan(dir, 'F3', 'grandchild');
      const links = readLinks(dir);
      assert.deepEqual(links.spawnedFrom, { plan: 'grandparent', phaseId: 'F1', mode: 'pause' });
      assert.deepEqual(links.spawnedPlans, { F3: ['grandchild'] });
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

describe('links-sidecar keeps aiDeck-facing frontmatter clean (T-001 acceptance)', () => {
  it('forking writes only the sidecar — plan.md and phase frontmatter are byte-identical', () => {
    withTmp((root) => {
      const childPlanMd =
        '---\nschemaVersion: "0.1"\nslug: child\nstatus: active\ncurrentPhase: F0\n---\n\n# child plan\n';
      const childPhaseMd =
        '---\nschemaVersion: "0.1"\nphaseId: F0\nstatus: active\n---\n\n# notes\n';
      const parentPlanMd =
        '---\nschemaVersion: "0.1"\nslug: parent\nstatus: active\ncurrentPhase: F2\n---\n\n# parent plan\n';

      const childDir = planDir(root, 'child');
      mkdirSync(join(childDir, 'phases'), { recursive: true });
      writeFileSync(join(childDir, 'plan.md'), childPlanMd, 'utf8');
      writeFileSync(join(childDir, 'phases', 'f0.md'), childPhaseMd, 'utf8');
      const parentDir = planDir(root, 'parent');
      writeFileSync(join(parentDir, 'plan.md'), parentPlanMd, 'utf8');

      // the fork: link recorded on both sides, sidecar only
      setSpawnedFrom(childDir, { plan: 'parent', phaseId: 'F2', mode: 'pause' });
      addSpawnedPlan(parentDir, 'F2', 'child');

      // aiDeck-facing frontmatter files are untouched, byte-for-byte
      assert.equal(readFileSync(join(childDir, 'plan.md'), 'utf8'), childPlanMd);
      assert.equal(readFileSync(join(childDir, 'phases', 'f0.md'), 'utf8'), childPhaseMd);
      assert.equal(readFileSync(join(parentDir, 'plan.md'), 'utf8'), parentPlanMd);

      // and the parsed frontmatter never grew the link fields
      const childFm = parseYaml(childPlanMd.split('---\n')[1]);
      assert.equal(childFm.spawnedFrom, undefined);
      assert.equal(childFm.spawnedPlans, undefined);
      const parentFm = parseYaml(parentPlanMd.split('---\n')[1]);
      assert.equal(parentFm.spawnedPlans, undefined);

      // the link is readable from the sidecar
      assert.deepEqual(getSpawnedFrom(childDir), { plan: 'parent', phaseId: 'F2', mode: 'pause' });
      assert.deepEqual(getSpawnedPlans(parentDir), { F2: ['child'] });
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

describe('links-sidecar parent/child fixtures + validate-state approval (T-004)', () => {
  it('both fixtures carry NO inline spawned* fields (clean aiDeck-facing frontmatter)', () => {
    for (const f of [FIXTURE_PARENT, FIXTURE_CHILD]) {
      const fm = fixtureFrontmatter(readFileSync(f, 'utf8'));
      assert.equal(fm.spawnedFrom, undefined);
      assert.equal(fm.spawnedPlans, undefined);
    }
  });

  it('validate-state approves the parent/child pair (exit 0)', () => {
    // throws if validate-state exits non-zero; the fork link is in the sidecar,
    // so the .strict-validated frontmatter stays clean and the pair passes.
    execFileSync('node', ['scripts/validate-state.js', FIXTURE_PARENT, FIXTURE_CHILD], {
      stdio: 'pipe',
    });
  });

  it('the fork link round-trips through the sidecar without touching the fixture frontmatter', () => {
    withTmp((root) => {
      const parentDir = planDir(root, 'fixture-parent');
      const childDir = planDir(root, 'fixture-child');
      const parentMd = readFileSync(FIXTURE_PARENT, 'utf8');
      const childMd = readFileSync(FIXTURE_CHILD, 'utf8');
      writeFileSync(join(parentDir, 'plan.md'), parentMd, 'utf8');
      writeFileSync(join(childDir, 'plan.md'), childMd, 'utf8');

      // the fork: parent gains spawnedPlans[F0], child gains spawnedFrom — sidecar only
      addSpawnedPlan(parentDir, 'F0', 'fixture-child');
      setSpawnedFrom(childDir, { plan: 'fixture-parent', phaseId: 'F0', mode: 'pause' });

      assert.deepEqual(getSpawnedPlans(parentDir), { F0: ['fixture-child'] });
      assert.deepEqual(getSpawnedFrom(childDir), {
        plan: 'fixture-parent',
        phaseId: 'F0',
        mode: 'pause',
      });
      // plan.md frontmatter untouched, byte-for-byte
      assert.equal(readFileSync(join(parentDir, 'plan.md'), 'utf8'), parentMd);
      assert.equal(readFileSync(join(childDir, 'plan.md'), 'utf8'), childMd);
    });
  });
});
