/**
 * F3 — lock, host spawn, merge, and stop.
 * Uses a temp git repo + fake host CLI. Never touches the real checkout's worktrees.
 */
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  inspectPenLock,
  isPidAlive,
  removePenLock,
  writePenLock,
} from '../scripts/automate-run.js';
import { penMatcher } from '../src/automate-host-pen.js';
import { architectureCardSha } from '../scripts/find-missing-architecture.js';
import { flowDocumentSha } from '../scripts/find-missing-flow.js';
import { assessGroundTruthPlanFile } from '../src/ground-truth-review.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const RUNNER = join(ROOT, 'scripts/automate-run.js');
const PEN_SCRIPT = join(ROOT, 'skills/shared/project-assets/hooks/automate-pen.sh');
const MINIMAL_FLOW = join(ROOT, 'docs/design/project-flow/dogfood/minimal-xor.json');

function git(cwd, args) {
  const res = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (res.status !== 0) {
    throw new Error(`git ${args.join(' ')}: ${res.stderr || res.stdout}`);
  }
  return (res.stdout || '').trim();
}

function drawing() {
  return {
    block: {
      name: 'x_chord',
      start: '{start_of_x_chord}',
      end: '{end_of_x_chord}',
    },
    sketches: [
      {
        id: 'header-out',
        outside: ['title', 'artist', 'youtube', 'audio'],
        mix: 'parse concatenates the header back onto each chart',
      },
      {
        id: 'nada-fora',
        outside: [],
        mix: 'não mistura',
      },
    ],
    chosen: 'nada-fora',
  };
}

function stampCard(card) {
  return {
    ...card,
    sha: architectureCardSha(card),
    ratifiedAt: '2026-09-25T12:00:00.000Z',
  };
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

function writePassingPlan(planDir) {
  mkdirSync(planDir, { recursive: true });
  const plan = join(planDir, 'plan.md');
  const body = `---
schemaVersion: "0.1"
slug: fixture
title: fixture
status: active
---

# fixture

Backend logic only. Pure scripts.

${gtSection()}

## Reviews

- internal: zero findings @ a1b2c3d (2026-07-28T12:00:00Z)
- ground-truth: complete | mode=ground-truth | fp=PLACEHOLDER_FP | premises=0 | impacts=0 @ a1b2c3d (2026-07-28T12:00:00Z)
- grok: command=grok review --plan plan.md | exit=0 | verdict=PASSED | stderr=
`;
  writeFileSync(plan, body);
  const { fingerprint } = assessGroundTruthPlanFile(readFileSync(plan, 'utf8'));
  writeFileSync(plan, body.replace('PLACEHOLDER_FP', fingerprint));

  const card = stampCard(drawing());
  mkdirSync(join(planDir, 'architecture'), { recursive: true });
  writeFileSync(
    join(planDir, 'architecture/decisions.json'),
    `${JSON.stringify(card, null, 2)}\n`,
  );

  mkdirSync(join(planDir, 'ui'), { recursive: true });
  writeFileSync(
    join(planDir, 'ui/ui.json'),
    `${JSON.stringify({
      none: true,
      reason: 'pure headless CLI and pure scripts; no visual surface',
      architectureSha: card.sha,
    }, null, 2)}\n`,
  );

  const flowDoc = structuredClone(JSON.parse(readFileSync(MINIMAL_FLOW, 'utf8')));
  flowDoc.planSlug = 'fixture';
  const sha = flowDocumentSha(flowDoc);
  const stamped = {
    ...flowDoc,
    ratifiedAt: '2026-08-13T12:00:00.000Z',
    ratifiedGraphSha: sha,
  };
  mkdirSync(join(planDir, 'flow'), { recursive: true });
  writeFileSync(join(planDir, 'flow/flow.json'), `${JSON.stringify(stamped, null, 2)}\n`);
  writeFileSync(
    join(planDir, 'flow/flow.html'),
    `<html data-fl-content-sha="${sha}"></html>\n`,
  );
  return plan;
}

function writeCodexPen(repo) {
  mkdirSync(join(repo, '.codex'), { recursive: true });
  writeFileSync(
    join(repo, '.codex/hooks.json'),
    JSON.stringify({
      hooks: {
        PreToolUse: [
          {
            matcher: penMatcher(),
            hooks: [{ command: `bash "${PEN_SCRIPT}"` }],
          },
        ],
      },
    }),
  );
}

function writeFakeCli(dir) {
  const path = join(dir, 'fake-host');
  writeFileSync(
    path,
    `#!/usr/bin/env bash
set -euo pipefail
if [[ -n "\${AUTOMATE_LOCK_SNAPSHOT:-}" && -n "\${AUTOMATE_PEN_LOCK:-}" && -f "\${AUTOMATE_PEN_LOCK}" ]]; then
  cp -- "\${AUTOMATE_PEN_LOCK}" "\${AUTOMATE_LOCK_SNAPSHOT}"
  printf '%s\\n' "$$" > "\${AUTOMATE_LOCK_SNAPSHOT}.pid"
fi
if [[ -n "\${AUTOMATE_HOST_ARGV_FILE:-}" ]]; then
  printf '%s\\n' "\$@" > "\${AUTOMATE_HOST_ARGV_FILE}"
fi
if [[ -n "\${AUTOMATE_WRITER_CWD_FILE:-}" ]]; then
  pwd > "\${AUTOMATE_WRITER_CWD_FILE}"
fi
if [[ "\${AUTOMATE_FAKE_CLI_FAIL:-}" == "1" ]]; then
  exit 1
fi
if [[ -n "\${AUTOMATE_FAKE_CLI_SLEEP:-}" ]]; then
  sleep "\${AUTOMATE_FAKE_CLI_SLEEP}"
fi
printf 'from-writer\\n' > writer-output.txt
`,
  );
  chmodSync(path, 0o755);
  return path;
}

function initRepo(repo) {
  git(repo, ['init', '--initial-branch=plan/fixture']);
  git(repo, ['config', 'user.email', 'writer-test@example.com']);
  git(repo, ['config', 'user.name', 'writer-test']);
  git(repo, ['config', 'commit.gpgsign', 'false']);
  git(repo, ['add', '-A']);
  git(repo, ['commit', '-m', 'fixture']);
}

function buildHarness() {
  const repo = mkdtempSync(join(tmpdir(), 'automate-writer-repo-'));
  const wtParent = mkdtempSync(join(tmpdir(), 'automate-writer-wt-'));
  const side = mkdtempSync(join(tmpdir(), 'automate-writer-side-'));
  writePassingPlan(repo);
  writeCodexPen(repo);
  initRepo(repo);
  const fakeCli = writeFakeCli(side);
  const snapshot = join(side, 'pen.lock.snapshot');
  const cwdFile = join(side, 'writer-cwd.txt');
  const lockDir = join(repo, '.atomic-skills/status/automate');
  return { repo, wtParent, side, fakeCli, snapshot, cwdFile, lockDir };
}

function cleanupHarness(h) {
  spawnSync('git', ['worktree', 'prune'], { cwd: h.repo, encoding: 'utf8' });
  rmSync(h.repo, { recursive: true, force: true });
  rmSync(h.wtParent, { recursive: true, force: true });
  rmSync(h.side, { recursive: true, force: true });
}

function runAutomate(h, extraEnv = {}, extraArgs = []) {
  return spawnSync(
    process.execPath,
    [
      RUNNER,
      '--host',
      'codex',
      '--plan',
      join(h.repo, 'plan.md'),
      '--root',
      h.repo,
      '--host-bin',
      h.fakeCli,
      '--worktree-parent',
      h.wtParent,
      '--lock-dir',
      h.lockDir,
      '--plan-branch',
      'plan/fixture',
      ...extraArgs,
    ],
    {
      encoding: 'utf8',
      timeout: 60_000,
      env: {
        ...process.env,
        AIDECK_HOST_BIN: h.fakeCli,
        AUTOMATE_WORKTREE_PARENT: h.wtParent,
        AUTOMATE_LOCK_DIR: h.lockDir,
        AUTOMATE_LOCK_SNAPSHOT: h.snapshot,
        AUTOMATE_WRITER_CWD_FILE: h.cwdFile,
        ...extraEnv,
      },
    },
  );
}

describe('inspectPenLock (T-001 / L-F2-1)', () => {
  it('treats a missing lock file as absent', () => {
    const dir = mkdtempSync(join(tmpdir(), 'pen-inspect-'));
    try {
      const r = inspectPenLock(join(dir, 'pen.lock'));
      assert.equal(r.kind, 'absent');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('does not treat a missing cited writerWorktree as unlocked when pid is live', () => {
    const dir = mkdtempSync(join(tmpdir(), 'pen-inspect-'));
    try {
      const lockPath = join(dir, 'pen.lock');
      writeFileSync(
        lockPath,
        `${JSON.stringify({
          owner: 'codex',
          pid: process.pid,
          writerWorktree: join(dir, 'missing-writer-tree'),
        })}\n`,
      );
      const r = inspectPenLock(lockPath);
      assert.equal(r.kind, 'held');
      assert.equal(existsSync(join(dir, 'missing-writer-tree')), false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('steals a lock whose pid is dead even if writerWorktree is missing', () => {
    const dir = mkdtempSync(join(tmpdir(), 'pen-inspect-'));
    try {
      const lockPath = join(dir, 'pen.lock');
      writeFileSync(
        lockPath,
        `${JSON.stringify({
          owner: 'codex',
          pid: 2147483647,
          writerWorktree: join(dir, 'gone-tree'),
        })}\n`,
      );
      assert.equal(isPidAlive(2147483647), false);
      const r = inspectPenLock(lockPath);
      assert.equal(r.kind, 'stale-dead-pid');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('fails closed on malformed lock JSON and missing pid', () => {
    const dir = mkdtempSync(join(tmpdir(), 'pen-inspect-'));
    try {
      const lockPath = join(dir, 'pen.lock');
      writeFileSync(lockPath, 'not-json\n');
      assert.equal(inspectPenLock(lockPath).kind, 'malformed');
      writeFileSync(lockPath, '{}\n');
      assert.equal(inspectPenLock(lockPath).kind, 'malformed');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('refuses to write a lock that cites a missing writerWorktree', () => {
    const dir = mkdtempSync(join(tmpdir(), 'pen-write-'));
    try {
      assert.throws(
        () =>
          writePenLock(join(dir, 'pen.lock'), {
            owner: 'codex',
            pid: process.pid,
            writerWorktree: join(dir, 'nope'),
          }),
        /writerWorktree/,
      );
      assert.equal(existsSync(join(dir, 'pen.lock')), false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('refuses empty writerWorktree without writing a lock (M1 / L-F2-1)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'pen-empty-wt-'));
    try {
      assert.throws(
        () =>
          writePenLock(join(dir, 'pen.lock'), {
            owner: 'codex',
            pid: process.pid,
            writerWorktree: '',
          }),
        /writerWorktree/,
      );
      assert.throws(
        () =>
          writePenLock(join(dir, 'pen.lock'), {
            owner: 'codex',
            pid: process.pid,
          }),
        /writerWorktree/,
      );
      assert.equal(existsSync(join(dir, 'pen.lock')), false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('creates pen.lock exclusively and does not overwrite (C1)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'pen-excl-'));
    const wt = mkdtempSync(join(tmpdir(), 'pen-excl-wt-'));
    try {
      const lockPath = join(dir, 'pen.lock');
      writeFileSync(lockPath, 'foreign\n');
      assert.throws(
        () =>
          writePenLock(lockPath, {
            owner: 'codex',
            pid: process.pid,
            writerWorktree: wt,
          }),
        /EEXIST|exist/i,
      );
      assert.equal(readFileSync(lockPath, 'utf8'), 'foreign\n');
    } finally {
      rmSync(dir, { recursive: true, force: true });
      rmSync(wt, { recursive: true, force: true });
    }
  });

  it('unlinks pen.lock only when this session owns the pid (C1)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'pen-own-'));
    try {
      const lockPath = join(dir, 'pen.lock');
      writeFileSync(
        lockPath,
        `${JSON.stringify({
          owner: 'codex',
          pid: 2147483646,
          writerWorktree: dir,
        })}\n`,
      );
      removePenLock(lockPath, process.pid);
      assert.equal(existsSync(lockPath), true);
      removePenLock(lockPath, 2147483646);
      assert.equal(existsSync(lockPath), false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('automate-run writer (T-001 lock)', () => {
  it('writes pen.lock during spawn with owner, pid, writerWorktree and deletes it after exit', () => {
    const h = buildHarness();
    try {
      const res = runAutomate(h);
      assert.equal(res.status, 0, `${res.stdout}\n${res.stderr}`);
      assert.equal(existsSync(join(h.lockDir, 'pen.lock')), false);
      assert.equal(existsSync(h.snapshot), true);
      const lock = JSON.parse(readFileSync(h.snapshot, 'utf8'));
      assert.equal(lock.owner, 'codex');
      assert.equal(typeof lock.pid, 'number');
      assert.ok(Number.isInteger(lock.pid) && lock.pid > 0);
      assert.equal(typeof lock.writerWorktree, 'string');
      assert.match(lock.writerWorktree, /fixture/);
      assert.ok(
        lock.writerWorktree.startsWith(h.wtParent),
        `writerWorktree ${lock.writerWorktree} not under ${h.wtParent}`,
      );
    } finally {
      cleanupHarness(h);
    }
  });

  it('deletes the lock after a writer failure', () => {
    const h = buildHarness();
    try {
      const res = runAutomate(h, { AUTOMATE_FAKE_CLI_FAIL: '1' });
      assert.notEqual(res.status, 0);
      assert.equal(existsSync(join(h.lockDir, 'pen.lock')), false);
      assert.equal(existsSync(h.snapshot), true);
    } finally {
      cleanupHarness(h);
    }
  });

  it('does not let a dead pid block a later run', () => {
    const h = buildHarness();
    try {
      mkdirSync(h.lockDir, { recursive: true });
      writeFileSync(
        join(h.lockDir, 'pen.lock'),
        `${JSON.stringify({
          owner: 'codex',
          pid: 2147483647,
          writerWorktree: join(h.wtParent, 'missing-old-tree'),
        })}\n`,
      );
      const res = runAutomate(h);
      assert.equal(res.status, 0, `${res.stdout}\n${res.stderr}`);
      assert.equal(existsSync(join(h.lockDir, 'pen.lock')), false);
    } finally {
      cleanupHarness(h);
    }
  });

  it('kills a still-living writer before releasing the lock', () => {
    const h = buildHarness();
    try {
      const res = runAutomate(h, {
        AUTOMATE_FAKE_CLI_SLEEP: '8',
        AUTOMATE_WRITER_TIMEOUT_MS: '400',
      });
      assert.notEqual(res.status, 0);
      assert.equal(existsSync(join(h.lockDir, 'pen.lock')), false);
      if (existsSync(h.snapshot)) {
        const lock = JSON.parse(readFileSync(h.snapshot, 'utf8'));
        assert.equal(isPidAlive(lock.pid), false);
      }
    } finally {
      cleanupHarness(h);
    }
  });

  it('keeps coordinator pid on pen.lock through spawn (C1)', () => {
    const h = buildHarness();
    try {
      const res = runAutomate(h);
      assert.equal(res.status, 0, `${res.stdout}\n${res.stderr}`);
      const lock = JSON.parse(readFileSync(h.snapshot, 'utf8'));
      const childPid = Number(readFileSync(`${h.snapshot}.pid`, 'utf8').trim());
      assert.ok(Number.isInteger(childPid) && childPid > 0);
      assert.notEqual(lock.pid, childPid);
      assert.notEqual(lock.pid, process.pid);
    } finally {
      cleanupHarness(h);
    }
  });

  it('second run on the same fixture succeeds (B1 leftover writer branch)', () => {
    const h = buildHarness();
    try {
      const first = runAutomate(h);
      assert.equal(first.status, 0, `${first.stdout}\n${first.stderr}`);
      const second = runAutomate(h);
      assert.equal(second.status, 0, `${second.stdout}\n${second.stderr}`);
    } finally {
      cleanupHarness(h);
    }
  });

  it('LEASE_EXISTS cites the lease path and does not write pen.lock (C2)', () => {
    const h = buildHarness();
    try {
      const leaseFile = join(dirname(h.lockDir), 'writer-leases', 'fixture.json');
      mkdirSync(dirname(leaseFile), { recursive: true });
      writeFileSync(leaseFile, '{}\n');
      const res = runAutomate(h);
      assert.notEqual(res.status, 0);
      assert.match(`${res.stdout}\n${res.stderr}`, /lease already exists|LEASE_EXISTS/);
      assert.match(`${res.stdout}\n${res.stderr}`, /writer-leases/);
      assert.equal(existsSync(join(h.lockDir, 'pen.lock')), false);
      assert.equal(existsSync(leaseFile), true);
    } finally {
      cleanupHarness(h);
    }
  });
});

describe('automate-run writer (T-002 spawn)', () => {
  it('spawns the injected host CLI inside a worktree created by automate-run.js', () => {
    const h = buildHarness();
    try {
      const res = runAutomate(h);
      assert.equal(res.status, 0, `${res.stdout}\n${res.stderr}`);
      assert.equal(existsSync(h.cwdFile), true);
      const cwd = readFileSync(h.cwdFile, 'utf8').trim();
      assert.ok(cwd.startsWith(h.wtParent), `cwd ${cwd} not under ${h.wtParent}`);
      const src = readFileSync(RUNNER, 'utf8');
      assert.match(src, /worktree['",\s]+add/);
      assert.doesNotMatch(src, /automate-phase-run/);
      assert.doesNotMatch(src, /phase-done/);
    } finally {
      cleanupHarness(h);
    }
  });

  it('lets the fake host CLI write a file inside the writer worktree', () => {
    const h = buildHarness();
    try {
      const res = runAutomate(h);
      assert.equal(res.status, 0, `${res.stdout}\n${res.stderr}`);
      const shown = spawnSync(
        'git',
        ['show', 'HEAD:writer-output.txt'],
        { cwd: h.repo, encoding: 'utf8' },
      );
      assert.equal(shown.status, 0, shown.stderr);
      assert.equal(shown.stdout, 'from-writer\n');
    } finally {
      cleanupHarness(h);
    }
  });

  it('passes AUTOMATE_HOST_ARGS to the host spawn argv (C3)', () => {
    const h = buildHarness();
    try {
      const argvFile = join(h.side, 'host-argv.txt');
      const res = runAutomate(h, {
        AUTOMATE_HOST_ARGS: JSON.stringify(['--prompt', 'writer-task']),
        AUTOMATE_HOST_ARGV_FILE: argvFile,
      });
      assert.equal(res.status, 0, `${res.stdout}\n${res.stderr}`);
      const recorded = readFileSync(argvFile, 'utf8');
      assert.match(recorded, /--prompt/);
      assert.match(recorded, /writer-task/);
    } finally {
      cleanupHarness(h);
    }
  });

  it('missing host bin exits nonzero and leaves no lock (C4)', () => {
    const h = buildHarness();
    try {
      const res = runAutomate(h, {}, ['--host-bin', join(h.side, 'no-such-host-bin')]);
      assert.notEqual(res.status, 0);
      assert.equal(existsSync(join(h.lockDir, 'pen.lock')), false);
      assert.match(
        `${res.stdout}\n${res.stderr}`,
        /ENOENT|did not start|no such file|implement --automate failed/i,
      );
    } finally {
      cleanupHarness(h);
    }
  });
});

describe('automate-run writer (T-003 merge and stop)', () => {
  it('merges the writer file onto the plan branch and exits 0 once', () => {
    const h = buildHarness();
    try {
      const res = runAutomate(h);
      assert.equal(res.status, 0, `${res.stdout}\n${res.stderr}`);
      assert.match(res.stderr, /merged; stopping/);
      const branch = git(h.repo, ['rev-parse', '--abbrev-ref', 'HEAD']);
      assert.equal(branch, 'plan/fixture');
      assert.equal(readFileSync(join(h.repo, 'writer-output.txt'), 'utf8'), 'from-writer\n');
      const log = git(h.repo, ['log', '-1', '--oneline']);
      assert.match(log, /automate writer|from-writer|writer/);
    } finally {
      cleanupHarness(h);
    }
  });

  it('does not materialize a second phase or call phase-done', () => {
    const h = buildHarness();
    try {
      const res = runAutomate(h);
      assert.equal(res.status, 0, `${res.stdout}\n${res.stderr}`);
      assert.equal(existsSync(join(h.repo, 'phases')), false);
      assert.doesNotMatch(`${res.stdout}\n${res.stderr}`, /phase-done|materialize/);
      const src = readFileSync(RUNNER, 'utf8');
      assert.doesNotMatch(src, /automate-phase-run\.js/);
      assert.doesNotMatch(src, /phase-done/);
      assert.doesNotMatch(src, /materialize/);
    } finally {
      cleanupHarness(h);
    }
  });

  it('still refuses before spawn when a gate is missing', () => {
    const dir = mkdtempSync(join(tmpdir(), 'automate-writer-refuse-'));
    try {
      const plan = join(dir, 'plan.md');
      writeFileSync(plan, '---\nslug: fixture\nstatus: active\n---\n\n# fixture\n');
      const res = spawnSync(
        process.execPath,
        [RUNNER, '--host', 'codex', '--plan', plan, '--root', dir],
        { encoding: 'utf8', timeout: 20_000 },
      );
      assert.equal(res.status, 1);
      assert.match(res.stderr, /find-missing-architecture\.js|automate-pen\.sh/);
      assert.equal(existsSync(join(dir, '.atomic-skills/status/automate/pen.lock')), false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
