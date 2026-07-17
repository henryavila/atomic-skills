/**
 * F5/T-004 — path classification is portable across path.win32 and path.posix.
 */
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import path from 'node:path';
import {
  kindFromPath,
  projectIdFromPath,
  normalizeKindFromPath,
  pathSegments,
  nestedIdsFromPath,
} from '../src/state-paths.js';

const { posix, win32 } = path;

describe('pathSegments', () => {
  it('splits POSIX absolute paths', () => {
    assert.deepEqual(
      pathSegments('/home/u/.atomic-skills/projects/demo/plan-a/plan.md', posix),
      ['home', 'u', '.atomic-skills', 'projects', 'demo', 'plan-a', 'plan.md'],
    );
  });

  it('splits Windows absolute paths with drive letter', () => {
    const segs = pathSegments('C:\\Users\\u\\.atomic-skills\\projects\\demo\\plan-a\\plan.md', win32);
    assert.ok(segs[0].toLowerCase().startsWith('c'), segs);
    assert.ok(segs.includes('projects'));
    assert.ok(segs.includes('demo'));
    assert.equal(segs[segs.length - 1], 'plan.md');
  });
});

describe('kindFromPath portability', () => {
  const cases = [
    {
      label: 'flat plan',
      posix: '/repo/.atomic-skills/plans/foo.md',
      win32: 'C:\\repo\\.atomic-skills\\plans\\foo.md',
      kind: 'plan',
    },
    {
      label: 'flat initiative',
      posix: '/repo/.atomic-skills/initiatives/bar.md',
      win32: 'C:\\repo\\.atomic-skills\\initiatives\\bar.md',
      kind: 'initiative',
    },
    {
      label: 'nested plan.md',
      posix: '/repo/.atomic-skills/projects/demo/my-plan/plan.md',
      win32: 'C:\\repo\\.atomic-skills\\projects\\demo\\my-plan\\plan.md',
      kind: 'plan',
    },
    {
      label: 'nested phase initiative',
      posix: '/repo/.atomic-skills/projects/demo/my-plan/phases/f0-boot.md',
      win32: 'C:\\repo\\.atomic-skills\\projects\\demo\\my-plan\\phases\\f0-boot.md',
      kind: 'initiative',
    },
    {
      label: 'nested lesson',
      posix: '/repo/.atomic-skills/projects/demo/my-plan/lessons/f0-boot.md',
      win32: 'C:\\repo\\.atomic-skills\\projects\\demo\\my-plan\\lessons\\f0-boot.md',
      kind: 'lesson',
    },
    {
      label: 'unknown',
      posix: '/repo/README.md',
      win32: 'C:\\repo\\README.md',
      kind: null,
    },
  ];

  for (const c of cases) {
    it(`${c.label}: posix and win32 agree (${c.kind})`, () => {
      assert.equal(kindFromPath(c.posix, posix), c.kind);
      assert.equal(kindFromPath(c.win32, win32), c.kind);
    });
  }

  it('plan.md under projects/ wins over a phases slug segment', () => {
    assert.equal(
      kindFromPath('/r/.atomic-skills/projects/id/phases/plan.md', posix),
      'plan',
    );
    assert.equal(
      kindFromPath('C:\\r\\.atomic-skills\\projects\\id\\phases\\plan.md', win32),
      'plan',
    );
  });
});

describe('projectIdFromPath portability', () => {
  it('returns nested project id on both path APIs', () => {
    assert.equal(
      projectIdFromPath('/r/.atomic-skills/projects/atomic-skills/plan-x/plan.md', posix),
      'atomic-skills',
    );
    assert.equal(
      projectIdFromPath('C:\\r\\.atomic-skills\\projects\\atomic-skills\\plan-x\\plan.md', win32),
      'atomic-skills',
    );
  });

  it('returns __legacy for flat trees', () => {
    assert.equal(projectIdFromPath('/r/.atomic-skills/plans/x.md', posix), '__legacy');
    assert.equal(projectIdFromPath('C:\\r\\.atomic-skills\\plans\\x.md', win32), '__legacy');
  });
});

describe('normalizeKindFromPath + nestedIdsFromPath', () => {
  it('normalizeKindFromPath matches historical normalize semantics', () => {
    assert.equal(normalizeKindFromPath('/a/plans/x.md', posix), 'plan');
    assert.equal(normalizeKindFromPath('C:\\a\\initiatives\\x.md', win32), 'initiative');
    assert.equal(normalizeKindFromPath('/a/projects/p/s/phases/f0.md', posix), 'initiative');
    assert.equal(normalizeKindFromPath('/a/projects/p/s/plan.md', posix), 'plan');
    assert.equal(normalizeKindFromPath('/a/README.md', posix), undefined);
  });

  it('nestedIdsFromPath extracts projectId + planSlug on win32', () => {
    assert.deepEqual(
      nestedIdsFromPath('C:\\r\\.atomic-skills\\projects\\demo\\plan-a\\phases\\f0.md', win32),
      { projectId: 'demo', planSlug: 'plan-a' },
    );
  });
});
