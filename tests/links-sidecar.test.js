import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
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
