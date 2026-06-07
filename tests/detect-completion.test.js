import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync, symlinkSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stringify as stringifyYaml } from 'yaml';
import { detectCompletion } from '../scripts/detect-completion.js';

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), '..', 'scripts', 'detect-completion.js');

// Deterministic commit identity + date, so git committer-date comparisons are
// reproducible on any host (no reliance on wall-clock or local git config).
function gitEnv(dateIso) {
  return {
    ...process.env,
    GIT_AUTHOR_NAME: 'T', GIT_AUTHOR_EMAIL: 't@t',
    GIT_COMMITTER_NAME: 'T', GIT_COMMITTER_EMAIL: 't@t',
    GIT_AUTHOR_DATE: dateIso, GIT_COMMITTER_DATE: dateIso,
  };
}

function gitInit(repo) {
  execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: repo });
}

/** Write `relPath` under the repo, stage it, commit with `subject` at `dateIso`. */
function commit(repo, relPath, content, subject, dateIso) {
  const abs = join(repo, relPath);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, content);
  execFileSync('git', ['add', relPath], { cwd: repo });
  execFileSync('git', ['commit', '-q', '-m', subject], { cwd: repo, env: gitEnv(dateIso) });
}

function writeFm(path, obj) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `---\n${stringifyYaml(obj).trimEnd()}\n---\n`);
}

const OLD = '2026-06-01T00:00:00Z'; // entry anchors
const NEW = '2026-06-04T12:00:00Z'; // commits — strictly after every anchor

test('detect-completion classifies output-exists / commit-ref and never flags verifier-only or prose', () => {
  const root = mkdtempSync(join(tmpdir(), 'as-detect-'));
  try {
    gitInit(root);
    // Output deliverables, committed AFTER the task anchor.
    commit(root, 'src/done.js', 'export const x = 1;\n', 'add done module', NEW);
    commit(root, 'src/prose.js', 'export const y = 2;\n', 'add prose helper', NEW); // referenced only in acceptance[]
    commit(root, 'README.md', '# touched\n', 'implement T-002 reconciler', NEW);    // names T-002 in the subject

    const phase = join(root, '.atomic-skills', 'projects', 'proj', 'alpha', 'phases', 'f1.md');
    writeFm(join(root, '.atomic-skills', 'projects', 'proj', 'alpha', 'plan.md'), {
      schemaVersion: '0.1', slug: 'alpha', status: 'active', currentPhase: 'F1', lastUpdated: OLD,
      phases: [{ id: 'F1', status: 'active' }],
    });
    writeFm(phase, {
      schemaVersion: '0.1', slug: 'alpha-f1', status: 'active', parentPlan: 'alpha', phaseId: 'F1',
      lastUpdated: OLD, started: OLD,
      tasks: [
        // (a) output-exists — declared output exists + committed after anchor. Also carries a
        //     verifier, to prove hasVerifier/verifier pass through WITHOUT being the signal.
        { id: 'T-001', title: 'build done module', status: 'pending', lastUpdated: OLD,
          outputs: [{ kind: 'file', path: 'src/done.js' }],
          verifier: { kind: 'test', runner: 'node --test', pattern: 'done' } },
        // (b) commit-ref — exact id in a recent commit subject; no outputs.
        { id: 'T-002', title: 'reconciler', status: 'active', lastUpdated: OLD },
        // (c) none — verifier present but no changed output and no commit (F-001 regression).
        { id: 'T-003', title: 'unstarted', status: 'pending', lastUpdated: OLD,
          verifier: { kind: 'shell', command: 'true' } },
        // (d) none — acceptance prose mentions a path that DOES exist+changed, but prose is
        //     never parsed (F-006 regression); no outputs[], no id-commit.
        { id: 'T-009', title: 'prose only', status: 'pending', lastUpdated: OLD,
          acceptance: ['creates src/prose.js with the helper'] },
      ],
    });

    const before = readFileSync(phase, 'utf8');
    const result = detectCompletion(root, {});
    assert.equal(readFileSync(phase, 'utf8'), before, 'detector is pure-read (no mutation)');

    assert.equal(result.drift, true);
    const byId = Object.fromEntries(result.candidates.map((c) => [c.id, c]));
    assert.deepEqual(Object.keys(byId).sort(), ['T-001', 'T-002'], 'only the two signalled tasks surface');

    assert.equal(byId['T-001'].evidence, 'output-exists');
    assert.deepEqual(byId['T-001'].paths, ['src/done.js']);
    assert.equal(byId['T-001'].hasVerifier, true, 'verifier passes through as metadata');
    assert.ok(byId['T-001'].verifier, 'the verifier object is carried for the reconcile flow');

    assert.equal(byId['T-002'].evidence, 'commit-ref');
    assert.equal(byId['T-002'].hasVerifier, false);

    assert.ok(!byId['T-003'], 'F-001: a verifier ALONE never produces a candidate');
    assert.ok(!byId['T-009'], 'F-006: acceptance[] prose is not parsed as an output path');

    // Every candidate carries the safe write target + projectId.
    for (const c of result.candidates) {
      assert.equal(c.projectId, 'proj');
      assert.equal(c.initiativePath, phase);
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('detect-completion exits non-zero on drift and emits valid --json', () => {
  const root = mkdtempSync(join(tmpdir(), 'as-detect-cli-'));
  try {
    gitInit(root);
    commit(root, 'src/x.js', 'x\n', 'add x', NEW);
    writeFm(join(root, '.atomic-skills', 'projects', 'p', 'a', 'plan.md'), {
      schemaVersion: '0.1', slug: 'a', status: 'active', currentPhase: 'F1', lastUpdated: OLD,
      phases: [{ id: 'F1', status: 'active' }],
    });
    writeFm(join(root, '.atomic-skills', 'projects', 'p', 'a', 'phases', 'f1.md'), {
      schemaVersion: '0.1', slug: 'a-f1', status: 'active', parentPlan: 'a', phaseId: 'F1', lastUpdated: OLD, started: OLD,
      tasks: [{ id: 'T-001', title: 't', status: 'pending', lastUpdated: OLD, outputs: [{ kind: 'file', path: 'src/x.js' }] }],
    });

    let status = 0, stdout = '';
    try {
      stdout = execFileSync('node', [SCRIPT, root, '--json'], { encoding: 'utf8' });
    } catch (err) {
      status = err.status;
      stdout = err.stdout;
    }
    assert.equal(status, 1, 'non-zero exit when drift is present');
    const parsed = JSON.parse(stdout);
    assert.equal(parsed.drift, true);
    assert.equal(parsed.candidates.length, 1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('detect-completion exits 0 with no drift when open entries carry no signal', () => {
  const root = mkdtempSync(join(tmpdir(), 'as-detect-clean-'));
  try {
    gitInit(root);
    commit(root, 'README.md', '# r\n', 'init', NEW);
    writeFm(join(root, '.atomic-skills', 'projects', 'p', 'a', 'plan.md'), {
      schemaVersion: '0.1', slug: 'a', status: 'active', currentPhase: 'F1', lastUpdated: OLD,
      phases: [{ id: 'F1', status: 'active' }],
    });
    writeFm(join(root, '.atomic-skills', 'projects', 'p', 'a', 'phases', 'f1.md'), {
      schemaVersion: '0.1', slug: 'a-f1', status: 'active', parentPlan: 'a', phaseId: 'F1', lastUpdated: OLD, started: OLD,
      tasks: [{ id: 'T-001', title: 't', status: 'pending', lastUpdated: OLD,
        verifier: { kind: 'shell', command: 'true' } }],
    });
    const result = detectCompletion(root, {});
    assert.equal(result.drift, false);
    assert.deepEqual(result.candidates, []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('detect-completion compares timestamps by epoch, not lexically: non-UTC offset + equal-instant do not false-fire', () => {
  const root = mkdtempSync(join(tmpdir(), 'as-detect-tz-'));
  try {
    gitInit(root);
    const ANCHOR = '2026-06-04T00:00:00Z';
    // src/before.js committed at +09:00 05:00 == 2026-06-03T20:00Z — BEFORE the anchor in real
    // time, but lexically '2026-06-04T05:00:00+09:00' > '2026-06-04T00:00:00Z'. Must NOT fire.
    commit(root, 'src/before.js', 'b\n', 'add before module', '2026-06-04T05:00:00+09:00');
    // src/after.js committed at +00:00 05:00 — genuinely after the anchor. Must fire.
    commit(root, 'src/after.js', 'a\n', 'add after module', '2026-06-04T05:00:00+00:00');
    // A commit naming T-EQ at the EXACT anchor instant — strict-after must exclude it (#3).
    commit(root, 'src/eq.js', 'e\n', 'close T-EQ now', '2026-06-04T00:00:00+00:00');

    writeFm(join(root, '.atomic-skills', 'projects', 'p', 'a', 'plan.md'), {
      schemaVersion: '0.1', slug: 'a', status: 'active', currentPhase: 'F1', lastUpdated: ANCHOR,
      phases: [{ id: 'F1', status: 'active' }],
    });
    writeFm(join(root, '.atomic-skills', 'projects', 'p', 'a', 'phases', 'f1.md'), {
      schemaVersion: '0.1', slug: 'a-f1', status: 'active', parentPlan: 'a', phaseId: 'F1', started: ANCHOR, lastUpdated: ANCHOR,
      tasks: [
        { id: 'T-BEFORE', title: 'before', status: 'pending', lastUpdated: ANCHOR, outputs: [{ kind: 'file', path: 'src/before.js' }] },
        { id: 'T-AFTER', title: 'after', status: 'pending', lastUpdated: ANCHOR, outputs: [{ kind: 'file', path: 'src/after.js' }] },
        { id: 'T-EQ', title: 'equal instant', status: 'pending', lastUpdated: ANCHOR },
      ],
    });

    const result = detectCompletion(root, {});
    const ids = result.candidates.map((c) => c.id).sort();
    assert.deepEqual(ids, ['T-AFTER'], 'only the genuinely-after task fires; offset-before and equal-instant excluded');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('detect-completion detects a pending exit-criterion via id-in-commit (gates have no outputs)', () => {
  const root = mkdtempSync(join(tmpdir(), 'as-detect-crit-'));
  try {
    gitInit(root);
    commit(root, 'src/g.js', 'g\n', 'satisfy C-1 criterion', NEW);
    writeFm(join(root, '.atomic-skills', 'projects', 'p', 'a', 'plan.md'), {
      schemaVersion: '0.1', slug: 'a', status: 'active', currentPhase: 'F1', lastUpdated: OLD,
      phases: [{ id: 'F1', status: 'active' }],
    });
    writeFm(join(root, '.atomic-skills', 'projects', 'p', 'a', 'phases', 'f1.md'), {
      schemaVersion: '0.1', slug: 'a-f1', status: 'active', parentPlan: 'a', phaseId: 'F1', started: OLD, lastUpdated: OLD,
      tasks: [],
      exitGates: [
        { id: 'C-1', description: 'the gate', status: 'pending' },          // → commit-ref via id
        { id: 'C-2', description: 'already met', status: 'met', metAt: NEW }, // resolved — never surfaced
      ],
    });
    const result = detectCompletion(root, {});
    assert.equal(result.candidates.length, 1);
    const c = result.candidates[0];
    assert.equal(c.kind, 'criterion');
    assert.equal(c.id, 'C-1');
    assert.equal(c.evidence, 'commit-ref');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('detect-completion is fail-open: a dangling symlink under projects/ does not throw', () => {
  const root = mkdtempSync(join(tmpdir(), 'as-detect-failopen-'));
  try {
    gitInit(root);
    const projectsDir = join(root, '.atomic-skills', 'projects');
    mkdirSync(projectsDir, { recursive: true });
    symlinkSync('does-not-exist', join(projectsDir, 'broken')); // statSync would throw ENOENT

    let result, threw = false;
    try { result = detectCompletion(root, {}); } catch { threw = true; }
    assert.equal(threw, false, 'unreadable entry must not crash the detector');
    assert.equal(result.drift, false);
    assert.deepEqual(result.candidates, []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('detect-completion catches an existing output edited-but-not-committed (dirty); ignores a clean stale output', () => {
  const root = mkdtempSync(join(tmpdir(), 'as-detect-dirty-'));
  try {
    gitInit(root);
    const EARLY = '2026-05-01T00:00:00Z'; // committed BEFORE the anchor
    const ANCHOR = '2026-06-01T00:00:00Z';
    commit(root, 'src/dirty.js', 'v1\n', 'add dirty target', EARLY);
    commit(root, 'src/clean.js', 'v1\n', 'add clean target', EARLY);
    // Edit the dirty output in the worktree (uncommitted) — the case the old
    // Stop-hook files-written scan caught and a commit-date-only check misses.
    writeFileSync(join(root, 'src', 'dirty.js'), 'v2-edited-this-turn\n');

    writeFm(join(root, '.atomic-skills', 'projects', 'p', 'a', 'plan.md'), {
      schemaVersion: '0.1', slug: 'a', status: 'active', currentPhase: 'F1', lastUpdated: ANCHOR,
      phases: [{ id: 'F1', status: 'active' }],
    });
    writeFm(join(root, '.atomic-skills', 'projects', 'p', 'a', 'phases', 'f1.md'), {
      schemaVersion: '0.1', slug: 'a-f1', status: 'active', parentPlan: 'a', phaseId: 'F1', started: ANCHOR, lastUpdated: ANCHOR,
      tasks: [
        { id: 'T-DIRTY', title: 'edited output', status: 'pending', lastUpdated: ANCHOR, outputs: [{ kind: 'file', path: 'src/dirty.js' }] },
        { id: 'T-CLEAN', title: 'stale clean output', status: 'pending', lastUpdated: ANCHOR, outputs: [{ kind: 'file', path: 'src/clean.js' }] },
      ],
    });

    const result = detectCompletion(root, {});
    const ids = result.candidates.map((c) => c.id).sort();
    assert.deepEqual(ids, ['T-DIRTY'], 'dirty output surfaces; clean output committed before the anchor does not');
    assert.equal(result.candidates[0].evidence, 'output-exists');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('detect-completion default resolution is branch-aware: prefers the branch-matched active plan over the newest', () => {
  const root = mkdtempSync(join(tmpdir(), 'as-detect-branch-'));
  try {
    gitInit(root); // repo is on branch `main`
    commit(root, 'src/x.js', 'x\n', 'add x', NEW);
    commit(root, 'src/y.js', 'y\n', 'add y', NEW);

    // alpha: branch `main` (matches the checked-out branch), OLDER lastUpdated.
    writeFm(join(root, '.atomic-skills', 'projects', 'alpha', 'pa', 'plan.md'), {
      schemaVersion: '0.1', slug: 'pa', status: 'active', branch: 'main', currentPhase: 'F1', lastUpdated: OLD,
      phases: [{ id: 'F1', status: 'active' }],
    });
    writeFm(join(root, '.atomic-skills', 'projects', 'alpha', 'pa', 'phases', 'f1.md'), {
      schemaVersion: '0.1', slug: 'pa-f1', status: 'active', parentPlan: 'pa', phaseId: 'F1', started: OLD, lastUpdated: OLD,
      tasks: [{ id: 'T-1', title: 't', status: 'pending', lastUpdated: OLD, outputs: [{ kind: 'file', path: 'src/x.js' }] }],
    });
    // beta: branch `other`, NEWER lastUpdated (would win a most-recent tiebreak).
    writeFm(join(root, '.atomic-skills', 'projects', 'beta', 'pb', 'plan.md'), {
      schemaVersion: '0.1', slug: 'pb', status: 'active', branch: 'other', currentPhase: 'F1', lastUpdated: NEW,
      phases: [{ id: 'F1', status: 'active' }],
    });
    writeFm(join(root, '.atomic-skills', 'projects', 'beta', 'pb', 'phases', 'f1.md'), {
      schemaVersion: '0.1', slug: 'pb-f1', status: 'active', parentPlan: 'pb', phaseId: 'F1', started: OLD, lastUpdated: OLD,
      tasks: [{ id: 'T-1', title: 't', status: 'pending', lastUpdated: OLD, outputs: [{ kind: 'file', path: 'src/y.js' }] }],
    });

    // Bare: the current branch `main` matches alpha, even though beta is newer.
    assert.equal(detectCompletion(root, {}).projectId, 'alpha', 'branch-match wins over most-recent');
    // Explicit branch override resolves the other project.
    assert.equal(detectCompletion(root, { branch: 'other' }).projectId, 'beta');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('detect-completion disambiguates same-slug projects via --project and resolves the active one bare (F-005)', () => {
  const root = mkdtempSync(join(tmpdir(), 'as-detect-multi-'));
  try {
    gitInit(root);
    commit(root, 'src/a.js', 'a\n', 'add a', NEW);
    commit(root, 'src/b.js', 'b\n', 'add b', NEW);

    // Two projects, SAME plan-slug 'shared'. projA active, projB paused.
    for (const [proj, planStatus, out] of [['projA', 'active', 'src/a.js'], ['projB', 'paused', 'src/b.js']]) {
      writeFm(join(root, '.atomic-skills', 'projects', proj, 'shared', 'plan.md'), {
        schemaVersion: '0.1', slug: 'shared', status: planStatus, currentPhase: 'F1', lastUpdated: OLD,
        phases: [{ id: 'F1', status: planStatus === 'active' ? 'active' : 'paused' }],
      });
      writeFm(join(root, '.atomic-skills', 'projects', proj, 'shared', 'phases', 'f1.md'), {
        schemaVersion: '0.1', slug: `${proj}-f1`, status: 'active', parentPlan: 'shared', phaseId: 'F1', lastUpdated: OLD, started: OLD,
        tasks: [{ id: 'T-001', title: 't', status: 'pending', lastUpdated: OLD, outputs: [{ kind: 'file', path: out }] }],
      });
    }

    const a = detectCompletion(root, { project: 'projA' });
    assert.equal(a.projectId, 'projA');
    assert.ok(a.candidates.length >= 1);
    for (const c of a.candidates) {
      assert.equal(c.projectId, 'projA');
      assert.ok(c.initiativePath.includes(join('projects', 'projA', 'shared')), 'write target is inside projA');
    }

    const b = detectCompletion(root, { project: 'projB' });
    assert.equal(b.projectId, 'projB');
    for (const c of b.candidates) assert.equal(c.projectId, 'projB');

    // Bare invocation resolves the ACTIVE project (projA), not projB.
    const bare = detectCompletion(root, {});
    assert.equal(bare.projectId, 'projA');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('detect-completion: --plan widening disables id-in-commit matching (F-001 cross-phase)', () => {
  // Task IDs are phase-local (every phase has a T-001). A commit naming `T-001`
  // is ambiguous once the scan widens past a single initiative, so id-in-commit
  // matching must be OFF for a widened (--plan) scan while still ON for the
  // default single-initiative scan. Path-based evidence stays global.
  const root = mkdtempSync(join(tmpdir(), 'as-detect-f001-'));
  try {
    gitInit(root);
    commit(root, 'README.md', 'x\n', 'finish T-001', NEW); // names T-001, no output path
    commit(root, 'src/g.js', 'g\n', 'land the gizmo', NEW); // a real declared output, no id in subject

    const base = join(root, '.atomic-skills', 'projects', 'proj', 'multi');
    writeFm(join(base, 'plan.md'), {
      schemaVersion: '0.1', slug: 'multi', status: 'active', currentPhase: 'F1', lastUpdated: OLD,
      phases: [{ id: 'F1', status: 'active' }, { id: 'F2', status: 'active' }],
    });
    // Both phases carry an open T-001 with NO outputs (id-only signal).
    writeFm(join(base, 'phases', 'f1.md'), {
      schemaVersion: '0.1', slug: 'multi-f1', status: 'active', parentPlan: 'multi', phaseId: 'F1',
      lastUpdated: OLD, started: OLD,
      tasks: [{ id: 'T-001', title: 'phase-1 work', status: 'pending', lastUpdated: OLD }],
    });
    writeFm(join(base, 'phases', 'f2.md'), {
      schemaVersion: '0.1', slug: 'multi-f2', status: 'active', parentPlan: 'multi', phaseId: 'F2',
      lastUpdated: OLD, started: OLD,
      tasks: [
        { id: 'T-001', title: 'phase-2 work', status: 'pending', lastUpdated: OLD },
        // path-based evidence MUST still survive the widened scan.
        { id: 'T-002', title: 'gizmo', status: 'pending', lastUpdated: OLD, outputs: [{ kind: 'file', path: 'src/g.js' }] },
      ],
    });

    // Default (single active initiative = current phase F1): id-in-commit ON →
    // F1's T-001 surfaces via commit-ref.
    const def = detectCompletion(root, {});
    assert.equal(def.candidates.length, 1, 'default scan flags exactly the current-phase T-001');
    assert.equal(def.candidates[0].id, 'T-001');
    assert.equal(def.candidates[0].evidence, 'commit-ref');

    // Widened (--plan): id-in-commit OFF → neither T-001 surfaces; only the
    // path-based T-002 (output-exists) does.
    const wide = detectCompletion(root, { plan: 'multi' });
    const ids = wide.candidates.map((c) => c.id).sort();
    assert.deepEqual(ids, ['T-002'], 'widened scan drops ambiguous id-only matches, keeps path-based');
    assert.equal(wide.candidates[0].evidence, 'output-exists');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
