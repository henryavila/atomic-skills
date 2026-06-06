import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
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
