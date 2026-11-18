import { describe, it, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { spawnSync, execFileSync } from 'node:child_process';
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join, dirname, resolve, isAbsolute } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const DELEGATE_PY = join(REPO_ROOT, 'skills/shared/delegate-assets/delegate.py');

const pythonProbe = spawnSync('python3', ['-c', 'import sys; print(sys.executable)'], {
  encoding: 'utf8',
});
const hasPython3 = pythonProbe.status === 0;
const PYTHON3 = hasPython3 ? pythonProbe.stdout.trim() : 'python3';

const FAKE_SCRIPT = `#!/usr/bin/env python3
import json, os, pathlib, subprocess, sys, time

argv_file = os.environ.get("FAKE_ARGV_FILE")
if argv_file:
    pathlib.Path(argv_file).write_text(json.dumps(sys.argv))

stdin_file = os.environ.get("FAKE_STDIN_FILE")
if stdin_file:
    pathlib.Path(stdin_file).write_text(sys.stdin.read())

out_text = os.environ.get("FAKE_STDOUT", "")
if out_text:
    sys.stdout.write(out_text)
    sys.stdout.flush()

last_message = os.environ.get("FAKE_LAST_MESSAGE")
if "-o" in sys.argv and last_message is not None:
    pathlib.Path(sys.argv[sys.argv.index("-o") + 1]).write_text(last_message)

err_text = os.environ.get("FAKE_STDERR", "")
if err_text:
    sys.stderr.write(err_text)
    sys.stderr.flush()

sleep_s = float(os.environ.get("FAKE_SLEEP", "0"))
if sleep_s > 0:
    time.sleep(sleep_s)

touch_rel = os.environ.get("FAKE_TOUCH_FILE")
if touch_rel:
    p = pathlib.Path(touch_rel)
    p.write_text("created by fake\\n")

commit_rel = os.environ.get("FAKE_COMMIT_FILE")
if commit_rel:
    p = pathlib.Path(commit_rel)
    p.write_text("committed by fake\\n")
    subprocess.run(["git", "add", str(p)], check=True)
    subprocess.run(["git", "commit", "-m", "fake commit"], check=True)

sys.exit(int(os.environ.get("FAKE_EXIT", "0")))
`;

function git(cwd, ...args) {
  return execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8' }).trim();
}

function initGitRepo(dir) {
  execFileSync('git', ['init', '-b', 'main', dir], { stdio: 'ignore' });
  git(dir, 'config', 'user.email', 'test@example.com');
  git(dir, 'config', 'user.name', 'Test User');
  writeFileSync(join(dir, 'README.md'), 'init\n');
  git(dir, 'add', 'README.md');
  git(dir, 'commit', '-m', 'init');
}

function makeFakeBin(dir, names = ['codex', 'agy', 'opencode']) {
  const binDir = join(dir, 'bin');
  mkdirSync(binDir, { recursive: true });
  const paths = {};
  for (const name of names) {
    const p = join(binDir, name);
    writeFileSync(p, FAKE_SCRIPT);
    chmodSync(p, 0o755);
    paths[name] = p;
  }
  return { binDir, paths };
}

function runDelegate(args, env = {}, cwd = undefined) {
  return spawnSync(PYTHON3, [DELEGATE_PY, ...args], {
    encoding: 'utf8',
    cwd,
    env: {
      ...process.env,
      ...env,
    },
  });
}

function readLogRecords(atomicHome) {
  const logFile = join(atomicHome, 'delegate', 'runs.jsonl');
  return readFileSync(logFile, 'utf8')
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

describe('delegate.py runner', { skip: !hasPython3 ? 'python3 not on PATH' : false }, () => {
  let root;
  let atomicHome;
  let emptyHome;
  let repoDir;
  let fakeBin;
  let fakePaths;
  let cardPath;
  let argvFile;
  let stdinFile;
  let outDir;
  let baseEnv;

  beforeEach(() => {
    root = realpathSync(mkdtempSync(join(tmpdir(), 'as-delegate-')));
    atomicHome = join(root, 'atomic-home');
    emptyHome = join(root, 'empty-home');
    repoDir = join(root, 'repo');
    outDir = join(root, 'out');
    mkdirSync(atomicHome, { recursive: true });
    mkdirSync(emptyHome, { recursive: true });
    mkdirSync(repoDir, { recursive: true });
    initGitRepo(repoDir);

    const fakes = makeFakeBin(root);
    fakeBin = fakes.binDir;
    fakePaths = fakes.paths;

    cardPath = join(root, 'card.md');
    writeFileSync(cardPath, '# Task CARD-1\nImplement feature X.\n');

    argvFile = join(root, 'captured.argv.json');
    stdinFile = join(root, 'captured.stdin.txt');

    baseEnv = {
      PATH: `${fakeBin}:${process.env.PATH || '/usr/bin:/bin'}`,
      HOME: emptyHome,
      ATOMIC_SKILLS_HOME: atomicHome,
      DELEGATE_PEAK_WINDOWS: '',
      FAKE_ARGV_FILE: argvFile,
      FAKE_STDIN_FILE: stdinFile,
      FAKE_STDOUT: 'Reviewed the diff; no findings.\nTOTAL major=0 medium=0 minor=0\n',
      FAKE_LAST_MESSAGE: 'Reviewed the diff; no findings.\nTOTAL major=0 medium=0 minor=0\n',
    };
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  for (const [label, profile, env, failure] of [
    ['agy empty', 'agy-review', { FAKE_STDOUT: '' }, 'empty_output'],
    ['agy whitespace', 'agy-review', { FAKE_STDOUT: ' \n\t' }, 'empty_output'],
    ['agy text', 'agy-review', {}, 'none'],
    ['opencode empty', 'flash', { FAKE_STDOUT: '' }, 'empty_output'],
    ['codex missing last message', 'codex-review', { FAKE_LAST_MESSAGE: undefined }, 'empty_output'],
    ['codex stale last message', 'codex-review', { FAKE_LAST_MESSAGE: undefined }, 'empty_output'],
    ['codex whitespace last message', 'codex-review', { FAKE_LAST_MESSAGE: ' \n\t' }, 'empty_output'],
    ['codex text with empty stdout', 'codex-review', { FAKE_STDOUT: '' }, 'none'],
    ['error before empty', 'agy-review', { FAKE_EXIT: '1', FAKE_STDOUT: '' }, 'error'],
    ['write before empty', 'agy-review', { FAKE_TOUCH_FILE: 'README.md', FAKE_STDOUT: '' }, 'review_wrote'],
  ]) {
    it(`review ${label} records ${failure}`, () => {
      if (label === 'codex stale last message') {
        mkdirSync(outDir, { recursive: true });
        writeFileSync(join(outDir, 'T-REVIEW-OUTPUT.last.md'), 'Previous review');
      }
      const res = runDelegate([
        'run', '--id', 'T-REVIEW-OUTPUT', '--task', label,
        '--role', 'review', '--profile', profile,
        '--cwd', repoDir, '--card', cardPath, '--out', outDir, '--confirmed',
      ], { ...baseEnv, ...env });
      assert.equal(res.status, failure === 'none' ? 0 : 1, res.stderr);
      const [rec] = readLogRecords(atomicHome);
      assert.equal(rec.failure, failure);
      assert.equal(rec.uncommitted, false);
    });
  }

  for (const [role, profile] of [
    ['implement', 'codex'],
    ['implement', 'agy'],
    ['fix', 'flash'],
  ]) {
    it(`${role} on ${profile} accepts empty output`, () => {
      const res = runDelegate([
        'run', '--id', 'T-NON-REVIEW-EMPTY', '--task', 'empty output',
        '--role', role, '--profile', profile,
        '--cwd', repoDir, '--card', cardPath, '--out', outDir, '--confirmed',
      ], {
        ...baseEnv,
        FAKE_STDOUT: '',
        FAKE_LAST_MESSAGE: undefined,
        FAKE_EXIT: '0',
        DELEGATE_PEAK_WINDOWS: '09:00-17:00',
        DELEGATE_NOW: '2026-11-18T18:00:00Z',
      });
      assert.equal(res.status, 0, res.stderr);
      const [rec] = readLogRecords(atomicHome);
      assert.equal(rec.failure, 'none');
      assert.equal(readFileSync(rec.stdout, 'utf8'), '');
      if (profile === 'codex') {
        assert.throws(() => readFileSync(rec.last_message), { code: 'ENOENT' });
      }
    });
  }

  for (const [label, env, dirtyBefore, uncommitted, commits] of [
    ['edits without commit', { FAKE_TOUCH_FILE: 'README.md' }, false, true, 0],
    ['creates without commit', { FAKE_TOUCH_FILE: 'new.txt' }, false, true, 0],
    ['commits', { FAKE_COMMIT_FILE: 'README.md' }, false, false, 1],
    ['does nothing', {}, false, false, 0],
    ['leaves existing dirt unchanged', {}, true, false, 0],
    ['edits existing dirt', { FAKE_TOUCH_FILE: 'README.md' }, true, true, 0],
  ]) {
    it(`implement ${label} records uncommitted=${uncommitted}`, () => {
      if (dirtyBefore) writeFileSync(join(repoDir, 'README.md'), 'existing dirt\n');
      const res = runDelegate([
        'run', '--id', 'T-UNCOMMITTED', '--task', label,
        '--role', 'implement', '--profile', 'codex',
        '--cwd', repoDir, '--card', cardPath, '--out', outDir, '--confirmed',
      ], { ...baseEnv, ...env });
      assert.equal(res.status, 0, res.stderr);
      const [rec] = readLogRecords(atomicHome);
      assert.equal(rec.failure, 'none');
      assert.equal(rec.uncommitted, uncommitted);
      assert.equal(rec.commits, commits);
    });
  }

  it('--profile codex --role implement builds exact argv, sends card on stdin, and records openai family', () => {
    const res = runDelegate(
      [
        'run',
        '--id', 'T-CODEX-1',
        '--task', 'implement feature',
        '--role', 'implement',
        '--profile', 'codex',
        '--cwd', repoDir,
        '--card', cardPath,
        '--out', outDir,
        '--confirmed',
      ],
      baseEnv,
    );

    assert.equal(res.status, 0, res.stderr);
    const argv = JSON.parse(readFileSync(argvFile, 'utf8'));
    const expectedLastMsg = join(outDir, 'T-CODEX-1.last.md');
    assert.deepEqual(argv, [
      fakePaths.codex,
      '-a', 'never',
      'exec',
      '--model', 'gpt-6.1-sol',
      '-c', 'model_reasoning_effort=medium',
      '--sandbox', 'workspace-write',
      '--skip-git-repo-check',
      '--ephemeral',
      '-C', repoDir,
      '-o', expectedLastMsg,
      '-',
    ]);

    const cardText = readFileSync(cardPath, 'utf8');
    assert.equal(readFileSync(stdinFile, 'utf8'), cardText);
    assert.ok(!argv.includes(cardText));

    const [rec] = readLogRecords(atomicHome);
    assert.equal(rec.executor, 'codex');
    assert.equal(rec.model, 'gpt-6.1-sol');
    assert.equal(rec.family, 'openai');
    assert.equal(rec.failure, 'none');
    assert.equal(rec.last_message, expectedLastMsg);
    assert.equal(rec.dirty_before, false);
  });

  it('--profile codex-review --role review uses read-only sandbox, high effort, and omits --add-dir even in a linked worktree', () => {
    const wtDir = join(root, 'wt-review');
    git(repoDir, 'worktree', 'add', '-b', 'feat/review', wtDir);

    const res = runDelegate(
      [
        'run',
        '--id', 'T-CODEX-REV',
        '--task', 'review change',
        '--role', 'review',
        '--profile', 'codex-review',
        '--cwd', wtDir,
        '--card', cardPath,
        '--out', outDir,
        '--confirmed',
      ],
      baseEnv,
    );

    assert.equal(res.status, 0, res.stderr);
    const argv = JSON.parse(readFileSync(argvFile, 'utf8'));
    const expectedLastMsg = join(outDir, 'T-CODEX-REV.last.md');
    assert.deepEqual(argv, [
      fakePaths.codex,
      '-a', 'never',
      'exec',
      '--model', 'gpt-6.1-sol',
      '-c', 'model_reasoning_effort=high',
      '--sandbox', 'read-only',
      '--skip-git-repo-check',
      '--ephemeral',
      '-C', wtDir,
      '-o', expectedLastMsg,
      '-',
    ]);
    assert.ok(!argv.includes('--add-dir'));
  });

  it('adds --add-dir with main checkout .git in a linked worktree for implement, and omits it in a plain repo', () => {
    const wtDir = join(root, 'wt-impl');
    git(repoDir, 'worktree', 'add', '-b', 'feat/impl', wtDir);

    const wtRes = runDelegate(
      [
        'run',
        '--id', 'T-WT',
        '--task', 'worktree impl',
        '--role', 'implement',
        '--profile', 'codex',
        '--cwd', wtDir,
        '--card', cardPath,
        '--out', outDir,
        '--confirmed',
      ],
      baseEnv,
    );

    assert.equal(wtRes.status, 0, wtRes.stderr);
    const wtArgv = JSON.parse(readFileSync(argvFile, 'utf8'));
    const expectedLastMsg = join(outDir, 'T-WT.last.md');
    assert.deepEqual(wtArgv, [
      fakePaths.codex,
      '-a', 'never',
      'exec',
      '--model', 'gpt-6.1-sol',
      '-c', 'model_reasoning_effort=medium',
      '--sandbox', 'workspace-write',
      '--skip-git-repo-check',
      '--ephemeral',
      '-C', wtDir,
      '--add-dir', join(repoDir, '.git'),
      '-o', expectedLastMsg,
      '-',
    ]);

    const plainRes = runDelegate(
      [
        'run',
        '--id', 'T-PLAIN',
        '--task', 'plain impl',
        '--role', 'implement',
        '--profile', 'codex',
        '--cwd', repoDir,
        '--card', cardPath,
        '--out', outDir,
        '--confirmed',
      ],
      baseEnv,
    );

    assert.equal(plainRes.status, 0, plainRes.stderr);
    const plainArgv = JSON.parse(readFileSync(argvFile, 'utf8'));
    assert.ok(!plainArgv.includes('--add-dir'));
  });

  it('DELEGATE_CODEX_MODEL overrides the Codex model in argv and in the run record', () => {
    const res = runDelegate(
      [
        'run',
        '--id', 'T-MODEL',
        '--task', 'custom codex model',
        '--role', 'implement',
        '--profile', 'codex',
        '--cwd', repoDir,
        '--card', cardPath,
        '--out', outDir,
        '--confirmed',
      ],
      { ...baseEnv, DELEGATE_CODEX_MODEL: 'x' },
    );

    assert.equal(res.status, 0, res.stderr);
    const argv = JSON.parse(readFileSync(argvFile, 'utf8'));
    const modelIdx = argv.indexOf('--model');
    assert.notEqual(modelIdx, -1);
    assert.equal(argv[modelIdx + 1], 'x');

    const [rec] = readLogRecords(atomicHome);
    assert.equal(rec.model, 'x');
  });

  it('never passes forbidden bypass flags in any Codex argv', () => {
    const forbidden = new Set([
      '--dangerously-bypass-approvals-and-sandbox',
      '--yolo',
      '--full-auto',
    ]);

    for (const [role, profile] of [
      ['implement', 'codex'],
      ['fix', 'codex'],
      ['review', 'codex-review'],
    ]) {
      const res = runDelegate(
        [
          'run',
          '--id', `T-FORB-${role}`,
          '--task', `check ${role}`,
          '--role', role,
          '--profile', profile,
          '--cwd', repoDir,
          '--card', cardPath,
          '--out', outDir,
          '--confirmed',
        ],
        baseEnv,
      );
      assert.equal(res.status, 0, res.stderr);
      const argv = JSON.parse(readFileSync(argvFile, 'utf8'));
      for (const flag of argv) {
        assert.ok(!forbidden.has(flag), `forbidden flag ${flag} found for ${role}`);
      }
    }
  });

  it('records failure=provider_limit on quota/rate-limit stderr and failure=error on other non-zero exit', () => {
    const limitRes = runDelegate(
      [
        'run',
        '--id', 'T-LIMIT',
        '--task', 'hit limit',
        '--role', 'implement',
        '--profile', 'codex',
        '--cwd', repoDir,
        '--card', cardPath,
        '--out', outDir,
        '--confirmed',
      ],
      {
        ...baseEnv,
        FAKE_EXIT: '1',
        FAKE_STDERR: 'Error: 5 hour usage limit reached\n',
      },
    );
    assert.equal(limitRes.status, 1);

    const errRes = runDelegate(
      [
        'run',
        '--id', 'T-ERR',
        '--task', 'other failure',
        '--role', 'implement',
        '--profile', 'codex',
        '--cwd', repoDir,
        '--card', cardPath,
        '--out', outDir,
        '--confirmed',
      ],
      {
        ...baseEnv,
        FAKE_EXIT: '1',
        FAKE_STDERR: 'syntax error in build\n',
      },
    );
    assert.equal(errRes.status, 1);

    const [limitRec, errRec] = readLogRecords(atomicHome);
    assert.equal(limitRec.failure, 'provider_limit');
    assert.equal(errRec.failure, 'error');
  });

  it('records failure=review_wrote and exits 1 when a review writes a file, and none/0 when clean', () => {
    const cleanRes = runDelegate(
      [
        'run',
        '--id', 'T-REV-OK',
        '--task', 'clean review',
        '--role', 'review',
        '--profile', 'codex-review',
        '--cwd', repoDir,
        '--card', cardPath,
        '--out', outDir,
        '--confirmed',
      ],
      baseEnv,
    );
    assert.equal(cleanRes.status, 0, cleanRes.stderr);

    const dirtyRes = runDelegate(
      [
        'run',
        '--id', 'T-REV-DIRTY',
        '--task', 'dirty review',
        '--role', 'review',
        '--profile', 'codex-review',
        '--cwd', repoDir,
        '--card', cardPath,
        '--out', outDir,
        '--confirmed',
      ],
      {
        ...baseEnv,
        FAKE_EXIT: '0',
        FAKE_TOUCH_FILE: join(repoDir, 'unwanted.txt'),
      },
    );
    assert.equal(dirtyRes.status, 1);

    const [cleanRec, dirtyRec] = readLogRecords(atomicHome);
    assert.equal(cleanRec.dirty_before, false);
    assert.equal(cleanRec.dirty_after, false);
    assert.equal(cleanRec.failure, 'none');

    assert.equal(dirtyRec.dirty_before, false);
    assert.equal(dirtyRec.dirty_after, true);
    assert.equal(dirtyRec.failure, 'review_wrote');
  });

  it('records failure=review_wrote when a review moves HEAD via commit', () => {
    const res = runDelegate(
      [
        'run',
        '--id', 'T-REV-COMMIT',
        '--task', 'review commits',
        '--role', 'review',
        '--profile', 'codex-review',
        '--cwd', repoDir,
        '--card', cardPath,
        '--out', outDir,
        '--confirmed',
      ],
      {
        ...baseEnv,
        FAKE_EXIT: '0',
        FAKE_COMMIT_FILE: join(repoDir, 'committed.txt'),
      },
    );
    assert.equal(res.status, 1);
    const [rec] = readLogRecords(atomicHome);
    assert.equal(rec.failure, 'review_wrote');
    assert.equal(rec.commits, 1);
    assert.equal(rec.dirty_after, false);
  });

  it('review on an already dirty tree left unchanged exits 0 with failure=none', () => {
    writeFileSync(join(repoDir, 'README.md'), 'dirty before\n');
    const res = runDelegate(
      [
        'run',
        '--id', 'T-REV-DIRTY-OK',
        '--task', 'dirty tree clean review',
        '--role', 'review',
        '--profile', 'codex-review',
        '--cwd', repoDir,
        '--card', cardPath,
        '--out', outDir,
        '--confirmed',
      ],
      baseEnv,
    );
    assert.equal(res.status, 0, res.stderr);
    const [rec] = readLogRecords(atomicHome);
    assert.equal(rec.dirty_before, true);
    assert.equal(rec.dirty_after, true);
    assert.equal(rec.failure, 'none');
  });

  it('review on an already dirty tree where fake creates a second file exits 1 with failure=review_wrote', () => {
    writeFileSync(join(repoDir, 'README.md'), 'dirty before\n');
    const res = runDelegate(
      [
        'run',
        '--id', 'T-REV-DIRTY-SECOND',
        '--task', 'dirty tree second file',
        '--role', 'review',
        '--profile', 'codex-review',
        '--cwd', repoDir,
        '--card', cardPath,
        '--out', outDir,
        '--confirmed',
      ],
      {
        ...baseEnv,
        FAKE_EXIT: '0',
        FAKE_TOUCH_FILE: join(repoDir, 'second.txt'),
      },
    );
    assert.equal(res.status, 1);
    const [rec] = readLogRecords(atomicHome);
    assert.equal(rec.dirty_before, true);
    assert.equal(rec.dirty_after, true);
    assert.equal(rec.failure, 'review_wrote');
  });

  it('review on an already dirty tree where fake modifies further an already modified file exits 1 with failure=review_wrote', () => {
    writeFileSync(join(repoDir, 'README.md'), 'dirty before\n');
    const res = runDelegate(
      [
        'run',
        '--id', 'T-REV-DIRTY-FURTHER',
        '--task', 'dirty tree modify modified file',
        '--role', 'review',
        '--profile', 'codex-review',
        '--cwd', repoDir,
        '--card', cardPath,
        '--out', outDir,
        '--confirmed',
      ],
      {
        ...baseEnv,
        FAKE_EXIT: '0',
        FAKE_TOUCH_FILE: join(repoDir, 'README.md'),
      },
    );
    assert.equal(res.status, 1);
    const [rec] = readLogRecords(atomicHome);
    assert.equal(rec.dirty_before, true);
    assert.equal(rec.dirty_after, true);
    assert.equal(rec.failure, 'review_wrote');
  });

  it('relative --out from a working directory different from --cwd passes absolute -o in same dir as stdout', () => {
    const callerDir = join(root, 'caller');
    mkdirSync(callerDir, { recursive: true });
    const res = runDelegate(
      [
        'run',
        '--id', 'T-REL-OUT',
        '--task', 'relative out path',
        '--role', 'implement',
        '--profile', 'codex',
        '--cwd', repoDir,
        '--card', cardPath,
        '--out', 'rel-out',
        '--confirmed',
      ],
      baseEnv,
      callerDir,
    );
    assert.equal(res.status, 0, res.stderr);
    const argv = JSON.parse(readFileSync(argvFile, 'utf8'));
    const oIdx = argv.indexOf('-o');
    assert.notEqual(oIdx, -1);
    const lastMsgArg = argv[oIdx + 1];
    assert.ok(isAbsolute(lastMsgArg), `expected absolute -o path, got: ${lastMsgArg}`);

    const [rec] = readLogRecords(atomicHome);
    assert.ok(isAbsolute(rec.stdout), `expected absolute stdout path, got: ${rec.stdout}`);
    assert.equal(dirname(lastMsgArg), dirname(rec.stdout));
    assert.equal(dirname(lastMsgArg), join(callerDir, 'rel-out'));
  });

  it('records failure=timeout when the executor exceeds --timeout', () => {
    const res = runDelegate(
      [
        'run',
        '--id', 'T-TIMEOUT',
        '--task', 'slow run',
        '--role', 'implement',
        '--profile', 'codex',
        '--cwd', repoDir,
        '--card', cardPath,
        '--out', outDir,
        '--timeout', '1',
        '--confirmed',
      ],
      {
        ...baseEnv,
        FAKE_SLEEP: '5',
      },
    );
    assert.equal(res.status, 1);
    const [rec] = readLogRecords(atomicHome);
    assert.equal(rec.timed_out, true);
    assert.equal(rec.failure, 'timeout');
  });

  it('detects provider_limit from last 4000 chars of stdout (e.g. 429 / Quota)', () => {
    const res = runDelegate(
      [
        'run',
        '--id', 'T-LIMIT-STDOUT',
        '--task', 'stdout 429',
        '--role', 'implement',
        '--profile', 'codex',
        '--cwd', repoDir,
        '--card', cardPath,
        '--out', outDir,
        '--confirmed',
      ],
      {
        ...baseEnv,
        FAKE_EXIT: '1',
        FAKE_STDOUT: `${'x'.repeat(4500)}\nHTTP 429 Too Many Requests\n`,
      },
    );
    assert.equal(res.status, 1);
    const [rec] = readLogRecords(atomicHome);
    assert.equal(rec.failure, 'provider_limit');
  });

  it('ignores provider_limit message outside the last 4000 characters and records failure=error', () => {
    const res = runDelegate(
      [
        'run',
        '--id', 'T-LIMIT-OLD-TAIL',
        '--task', 'limit before tail',
        '--role', 'implement',
        '--profile', 'codex',
        '--cwd', repoDir,
        '--card', cardPath,
        '--out', outDir,
        '--confirmed',
      ],
      {
        ...baseEnv,
        FAKE_EXIT: '1',
        FAKE_STDERR: `usage limit reached\n${'x'.repeat(4005)}`,
      },
    );
    assert.equal(res.status, 1);
    const [rec] = readLogRecords(atomicHome);
    assert.equal(rec.failure, 'error');
  });

  for (const [label, phrase] of [
    ['usage limit', 'Usage Limit exceeded'],
    ['rate limit', 'Rate Limit hit'],
    ['quota', 'Quota exhausted'],
    ['too many requests', 'Too Many Requests'],
    ['429', 'status 429'],
  ]) {
    it(`detects provider_limit for "${label}" on its own with mixed case`, () => {
      const res = runDelegate(
        [
          'run',
          '--id', `T-LIMIT-${label.replace(/\s+/g, '-').toUpperCase()}`,
          '--task', `limit ${label}`,
          '--role', 'implement',
          '--profile', 'codex',
          '--cwd', repoDir,
          '--card', cardPath,
          '--out', outDir,
          '--confirmed',
        ],
        {
          ...baseEnv,
          FAKE_EXIT: '1',
          FAKE_STDERR: `${phrase}\n`,
        },
      );
      assert.equal(res.status, 1);
      const [rec] = readLogRecords(atomicHome);
      assert.equal(rec.failure, 'provider_limit');
    });
  }

  for (const codeLike of ['4290', '1429']) {
    it(`does not treat ${codeLike} as a 429 provider_limit`, () => {
      const res = runDelegate(
        [
          'run',
          '--id', `T-NO-LIMIT-${codeLike}`,
          '--task', `non-matching ${codeLike}`,
          '--role', 'implement',
          '--profile', 'codex',
          '--cwd', repoDir,
          '--card', cardPath,
          '--out', outDir,
          '--confirmed',
        ],
        {
          ...baseEnv,
          FAKE_EXIT: '1',
          FAKE_STDERR: `error code ${codeLike}\n`,
        },
      );
      assert.equal(res.status, 1);
      const [rec] = readLogRecords(atomicHome);
      assert.equal(rec.failure, 'error');
    });
  }

  it('records failure=none on exit 0 even when output contains a limit message', () => {
    const res = runDelegate(
      [
        'run',
        '--id', 'T-LIMIT-EXIT0',
        '--task', 'limit text on success',
        '--role', 'implement',
        '--profile', 'codex',
        '--cwd', repoDir,
        '--card', cardPath,
        '--out', outDir,
        '--confirmed',
      ],
      {
        ...baseEnv,
        FAKE_EXIT: '0',
        FAKE_STDOUT: 'note: discussed quota and 429 handling\n',
        FAKE_STDERR: 'usage limit mentioned in log\n',
      },
    );
    assert.equal(res.status, 0, res.stderr);
    const [rec] = readLogRecords(atomicHome);
    assert.equal(rec.failure, 'none');
  });

  it('records failure=timeout when a timed-out run also emits a limit message', () => {
    const res = runDelegate(
      [
        'run',
        '--id', 'T-TIMEOUT-LIMIT',
        '--task', 'timeout with limit text',
        '--role', 'implement',
        '--profile', 'codex',
        '--cwd', repoDir,
        '--card', cardPath,
        '--out', outDir,
        '--timeout', '1',
        '--confirmed',
      ],
      {
        ...baseEnv,
        FAKE_SLEEP: '5',
        FAKE_STDERR: 'rate limit retrying...\n',
      },
    );
    assert.equal(res.status, 1);
    const [rec] = readLogRecords(atomicHome);
    assert.equal(rec.timed_out, true);
    assert.equal(rec.failure, 'timeout');
    assert.match(readFileSync(rec.stderr, 'utf8'), /rate limit/);
  });

  it('builds exact opencode and agy argvs and omits last_message for non-codex executors', () => {
    const cardText = readFileSync(cardPath, 'utf8');

    const opRes = runDelegate(
      [
        'run',
        '--id', 'T-OP',
        '--task', 'opencode task',
        '--role', 'implement',
        '--profile', 'flash',
        '--cwd', repoDir,
        '--card', cardPath,
        '--out', outDir,
        '--confirmed',
      ],
      baseEnv,
    );
    assert.equal(opRes.status, 0, opRes.stderr);
    assert.deepEqual(JSON.parse(readFileSync(argvFile, 'utf8')), [
      fakePaths.opencode,
      'run',
      '--auto',
      '--archived',
      '-m',
      'opencode-go/deepseek-v4.1-flash',
      cardText,
    ]);
    assert.equal(readFileSync(stdinFile, 'utf8'), '');

    const agyImplRes = runDelegate(
      [
        'run',
        '--id', 'T-AGY-IMPL',
        '--task', 'agy impl task',
        '--role', 'implement',
        '--profile', 'agy',
        '--cwd', repoDir,
        '--card', cardPath,
        '--out', outDir,
        '--confirmed',
      ],
      baseEnv,
    );
    assert.equal(agyImplRes.status, 0, agyImplRes.stderr);
    assert.deepEqual(JSON.parse(readFileSync(argvFile, 'utf8')), [
      fakePaths.agy,
      '-p',
      cardText,
      '--model',
      'gemini-4-hydrogen-high',
      '--output-format',
      'text',
      '--dangerously-skip-permissions',
    ]);
    assert.equal(readFileSync(stdinFile, 'utf8'), '');

    const agyRevRes = runDelegate(
      [
        'run',
        '--id', 'T-AGY-REV',
        '--task', 'agy review task',
        '--role', 'review',
        '--profile', 'agy-review',
        '--cwd', repoDir,
        '--card', cardPath,
        '--out', outDir,
        '--confirmed',
      ],
      baseEnv,
    );
    assert.equal(agyRevRes.status, 0, agyRevRes.stderr);
    assert.deepEqual(JSON.parse(readFileSync(argvFile, 'utf8')), [
      fakePaths.agy,
      '-p',
      cardText,
      '--model',
      'gemini-4-hydrogen-xhigh',
      '--output-format',
      'text',
      '--dangerously-skip-permissions',
    ]);

    const recs = readLogRecords(atomicHome);
    assert.equal(recs.length, 3);
    assert.equal(recs[0].family, 'deepseek');
    assert.equal(recs[1].family, 'gemini');
    assert.equal(recs[2].family, 'gemini');
    for (const r of recs) {
      assert.ok(!('last_message' in r), 'last_message must be absent for non-codex');
    }
  });

  for (const [profile, role, expectedModel, expectedFamily] of [
    ['glm-flash', 'mechanical', 'opencode-go/glm-5.3-flash', 'zhipu'],
    ['kimi', 'implement', 'opencode-go/kimi-k3.1-pro', 'moonshot'],
    ['hy4-review', 'review', 'opencode-go/hy4', 'tencent'],
  ]) {
    it(`--profile ${profile} builds opencode argv with ${expectedModel} and records ${expectedFamily}`, () => {
      const cardText = readFileSync(cardPath, 'utf8');
      const res = runDelegate(
        [
          'run',
          '--id', `T-OP-${profile}`,
          '--task', `opencode ${profile}`,
          '--role', role,
          '--profile', profile,
          '--cwd', repoDir,
          '--card', cardPath,
          '--out', outDir,
          '--confirmed',
        ],
        baseEnv,
      );
      assert.equal(res.status, 0, res.stderr);
      assert.deepEqual(JSON.parse(readFileSync(argvFile, 'utf8')), [
        fakePaths.opencode,
        'run',
        '--auto',
        '--archived',
        '-m',
        expectedModel,
        cardText,
      ]);
      const [rec] = readLogRecords(atomicHome);
      assert.equal(rec.executor, 'opencode');
      assert.equal(rec.model, expectedModel);
      assert.equal(rec.family, expectedFamily);
    });
  }

  it('--profile deepseek-light acts as a deprecated alias for flash', () => {
    const cardText = readFileSync(cardPath, 'utf8');
    const res = runDelegate(
      [
        'run',
        '--id', 'T-ALIAS',
        '--task', 'deprecated alias',
        '--role', 'mechanical',
        '--profile', 'deepseek-light',
        '--cwd', repoDir,
        '--card', cardPath,
        '--out', outDir,
        '--confirmed',
      ],
      baseEnv,
    );
    assert.equal(res.status, 0, res.stderr);
    assert.match(res.stderr, /deprecated/i);
    assert.deepEqual(JSON.parse(readFileSync(argvFile, 'utf8')), [
      fakePaths.opencode,
      'run',
      '--auto',
      '--archived',
      '-m',
      'opencode-go/deepseek-v4.1-flash',
      cardText,
    ]);
    const [rec] = readLogRecords(atomicHome);
    assert.equal(rec.executor, 'opencode');
    assert.equal(rec.model, 'opencode-go/deepseek-v4.1-flash');
    assert.equal(rec.family, 'deepseek');
  });

  it('--profile deepseek-pro exits 2 with removal message and launches nothing', () => {
    const res = runDelegate(
      [
        'run',
        '--id', 'T-REMOVED',
        '--task', 'removed profile',
        '--role', 'implement',
        '--profile', 'deepseek-pro',
        '--cwd', repoDir,
        '--card', cardPath,
        '--out', outDir,
        '--confirmed',
      ],
      baseEnv,
    );
    assert.equal(res.status, 2);
    assert.match(
      res.stderr,
      /delegate: profile deepseek-pro was removed \(poor cost\/benefit\); use --profile flash/,
    );
    assert.throws(() => readFileSync(argvFile), { code: 'ENOENT' });
  });

  it('sets family to null when --executor and --model are given manually', () => {
    const res = runDelegate(
      [
        'run',
        '--id', 'T-MANUAL',
        '--task', 'manual executor',
        '--role', 'implement',
        '--executor', 'codex',
        '--model', 'custom-codex',
        '--cwd', repoDir,
        '--card', cardPath,
        '--out', outDir,
        '--confirmed',
      ],
      baseEnv,
    );
    assert.equal(res.status, 0, res.stderr);
    const [rec] = readLogRecords(atomicHome);
    assert.equal(rec.family, null);
    assert.equal(rec.model, 'custom-codex');
  });

  it('during peak (Wednesday 02:00 UTC) flash proceeds with peak=true and warning, while glm-flash records peak=false', () => {
    const peakEnv = {
      ...baseEnv,
      DELEGATE_NOW: '2026-11-18T02:00:00Z',
    };
    delete peakEnv.DELEGATE_PEAK_WINDOWS;

    const flashRes = runDelegate(
      [
        'run',
        '--id', 'T-PEAK-FLASH',
        '--task', 'flash during peak',
        '--role', 'implement',
        '--profile', 'flash',
        '--cwd', repoDir,
        '--card', cardPath,
        '--out', outDir,
        '--confirmed',
      ],
      peakEnv,
    );
    assert.equal(flashRes.status, 0, flashRes.stderr);
    assert.match(flashRes.stderr, /double/i);

    const flashAllowPeakRes = runDelegate(
      [
        'run',
        '--id', 'T-PEAK-FLASH-ALLOW',
        '--task', 'flash with --allow-peak',
        '--role', 'implement',
        '--profile', 'flash',
        '--cwd', repoDir,
        '--card', cardPath,
        '--out', outDir,
        '--confirmed',
        '--allow-peak',
      ],
      peakEnv,
    );
    assert.equal(flashAllowPeakRes.status, 0, flashAllowPeakRes.stderr);

    const glmRes = runDelegate(
      [
        'run',
        '--id', 'T-PEAK-GLM',
        '--task', 'glm-flash during deepseek peak',
        '--role', 'mechanical',
        '--profile', 'glm-flash',
        '--cwd', repoDir,
        '--card', cardPath,
        '--out', outDir,
        '--confirmed',
      ],
      peakEnv,
    );
    assert.equal(glmRes.status, 0, glmRes.stderr);
    assert.doesNotMatch(glmRes.stderr, /double/i);

    const [flashRec, flashAllowRec, glmRec] = readLogRecords(atomicHome);
    assert.equal(flashRec.peak, true);
    assert.equal(flashAllowRec.peak, true);
    assert.equal(glmRec.peak, false);
  });

  it('default DELEGATE_PEAK_WINDOWS evaluates weekday/weekend UTC instants correctly', () => {
    const cases = [
      ['2026-11-18T02:00:00Z', 'peak'],     // Wednesday 02:00 UTC
      ['2026-11-21T02:00:00Z', 'off-peak'], // Saturday 02:00 UTC
      ['2026-11-18T05:00:00Z', 'off-peak'], // Wednesday 05:00 UTC
      ['2026-11-18T09:59:00Z', 'peak'],     // Wednesday 09:59 UTC
    ];
    for (const [instant, expected] of cases) {
      const env = { ...baseEnv, DELEGATE_NOW: instant };
      delete env.DELEGATE_PEAK_WINDOWS;
      const res = runDelegate(['peak'], env);
      assert.equal(res.status, 0, res.stderr);
      assert.equal(res.stdout.trim(), expected, `instant ${instant}`);
    }
  });

  it('DELEGATE_PEAK_WINDOWS="" disables peak window completely', () => {
    const res = runDelegate(['peak'], {
      ...baseEnv,
      DELEGATE_PEAK_WINDOWS: '',
      DELEGATE_NOW: '2026-11-18T02:00:00Z',
    });
    assert.equal(res.status, 0, res.stderr);
    assert.equal(res.stdout.trim(), 'off-peak');
  });

  it('custom midnight-crossing DELEGATE_PEAK_WINDOWS 23:00-01:00 evaluates weekday and weekend instants', () => {
    const cases = [
      ['2026-11-18T23:30:00Z', 'peak'],     // Wednesday 23:30 UTC
      ['2026-11-18T00:30:00Z', 'peak'],     // Wednesday 00:30 UTC
      ['2026-11-18T12:00:00Z', 'off-peak'], // Wednesday 12:00 UTC
      ['2026-11-21T23:30:00Z', 'off-peak'], // Saturday 23:30 UTC
    ];
    for (const [instant, expected] of cases) {
      const res = runDelegate(['peak'], {
        ...baseEnv,
        DELEGATE_PEAK_WINDOWS: '23:00-01:00',
        DELEGATE_NOW: instant,
      });
      assert.equal(res.status, 0, res.stderr);
      assert.equal(res.stdout.trim(), expected, `instant ${instant}`);
    }
  });

  for (const [label, profile, text, expectedFailure] of [
    [
      'plan instead of verdict on agy-review',
      'agy-review',
      'Here is my plan to review the diff. Confirm if you would like me to proceed.',
      'incomplete_review',
    ],
    [
      'text lacking TOTAL line on codex-review',
      'codex-review',
      'R01 | major | foo.py:10 | bug | checked | fix it',
      'incomplete_review',
    ],
    [
      'lowercase total line',
      'agy-review',
      'Checked everything.\ntotal major=0 medium=1 minor=2\n',
      'incomplete_review',
    ],
    [
      'valid TOTAL line',
      'agy-review',
      'R01 | medium | a.js:3 | issue | saw | fix\nTOTAL major=0 medium=1 minor=2\n',
      'none',
    ],
    [
      'TOTAL line wrapped in backticks',
      'agy-review',
      'All clean.\n`TOTAL major=0 medium=1 minor=2`\n',
      'none',
    ],
    [
      'TOTAL line wrapped in asterisks and spaces',
      'codex-review',
      'All clean.\n  **TOTAL major=0 medium=1 minor=2**  \n',
      'none',
    ],
  ]) {
    it(`review ${label} records failure=${expectedFailure}`, () => {
      const res = runDelegate(
        [
          'run',
          '--id', 'T-INC-REV',
          '--task', label,
          '--role', 'review',
          '--profile', profile,
          '--cwd', repoDir,
          '--card', cardPath,
          '--out', outDir,
          '--confirmed',
        ],
        {
          ...baseEnv,
          FAKE_STDOUT: text,
          FAKE_LAST_MESSAGE: text,
        },
      );
      assert.equal(res.status, expectedFailure === 'none' ? 0 : 1, res.stderr);
      const [rec] = readLogRecords(atomicHome);
      assert.equal(rec.failure, expectedFailure);
    });
  }

  for (const role of ['implement', 'fix', 'mechanical', 'test']) {
    it(`non-review role ${role} without TOTAL line records failure=none`, () => {
      const res = runDelegate(
        [
          'run',
          '--id', `T-NONREV-${role}`,
          '--task', `${role} output`,
          '--role', role,
          '--profile', 'flash',
          '--cwd', repoDir,
          '--card', cardPath,
          '--out', outDir,
          '--confirmed',
        ],
        {
          ...baseEnv,
          FAKE_STDOUT: 'Done implementing.',
        },
      );
      assert.equal(res.status, 0, res.stderr);
      const [rec] = readLogRecords(atomicHome);
      assert.equal(rec.failure, 'none');
    });
  }

  for (const [label, extraEnv, extraArgs, expectedFailure] of [
    ['timeout beats incomplete_review', { FAKE_SLEEP: '5', FAKE_STDOUT: 'incomplete' }, ['--timeout', '1'], 'timeout'],
    ['provider_limit beats incomplete_review', { FAKE_EXIT: '1', FAKE_STDERR: '429', FAKE_STDOUT: 'incomplete' }, [], 'provider_limit'],
    ['review_wrote beats incomplete_review', { FAKE_TOUCH_FILE: 'README.md', FAKE_STDOUT: 'incomplete' }, [], 'review_wrote'],
    ['error beats incomplete_review', { FAKE_EXIT: '1', FAKE_STDOUT: 'incomplete' }, [], 'error'],
    ['empty_output beats incomplete_review', { FAKE_STDOUT: '' }, [], 'empty_output'],
  ]) {
    it(`failure precedence: ${label}`, () => {
      const res = runDelegate(
        [
          'run',
          '--id', 'T-PREC',
          '--task', label,
          '--role', 'review',
          '--profile', 'agy-review',
          '--cwd', repoDir,
          '--card', cardPath,
          '--out', outDir,
          ...extraArgs,
          '--confirmed',
        ],
        { ...baseEnv, ...extraEnv },
      );
      assert.equal(res.status, 1);
      const [rec] = readLogRecords(atomicHome);
      assert.equal(rec.failure, expectedFailure);
    });
  }

  it('profiles lists eight profiles in order and marks executors absent from PATH as missing when DELEGATE_NO_FALLBACK_PATHS=1', () => {
    const partialDir = join(root, 'partial');
    const { binDir: partialBin } = makeFakeBin(partialDir, ['opencode', 'agy']);
    const res = runDelegate(['profiles'], {
      PATH: `${partialBin}:/usr/bin:/bin`,
      HOME: emptyHome,
      ATOMIC_SKILLS_HOME: atomicHome,
      DELEGATE_NO_FALLBACK_PATHS: '1',
    });

    assert.equal(res.status, 0, res.stderr);
    const lines = res.stdout.trim().split('\n');
    assert.equal(lines.length, 8);
    assert.deepEqual(lines, [
      'flash | opencode | opencode-go/deepseek-v4.1-flash | deepseek | found',
      'glm-flash | opencode | opencode-go/glm-5.3-flash | zhipu | found',
      'kimi | opencode | opencode-go/kimi-k3.1-pro | moonshot | found',
      'hy4-review | opencode | opencode-go/hy4 | tencent | found',
      'codex | codex | gpt-6.1-sol | openai | missing',
      'codex-review | codex | gpt-6.1-sol | openai | missing',
      'agy | agy | gemini-4-hydrogen-high | gemini | found',
      'agy-review | agy | gemini-4-hydrogen-xhigh | gemini | found',
    ]);
  });

  it('profiles falls back to ~/.local/bin when codex is absent from PATH', () => {
    const emptyPathDir = join(root, 'empty-path');
    mkdirSync(emptyPathDir, { recursive: true });
    const fallbackHome = join(root, 'fallback-home');
    const localBin = join(fallbackHome, '.local', 'bin');
    mkdirSync(localBin, { recursive: true });
    const codexBin = join(localBin, 'codex');
    writeFileSync(codexBin, FAKE_SCRIPT);
    chmodSync(codexBin, 0o755);

    const res = runDelegate(['profiles'], {
      PATH: emptyPathDir,
      HOME: fallbackHome,
      ATOMIC_SKILLS_HOME: atomicHome,
    });

    assert.equal(res.status, 0, res.stderr);
    const lines = res.stdout.trim().split('\n');
    assert.equal(lines.length, 8);
    assert.ok(lines.includes('codex | codex | gpt-6.1-sol | openai | found'));
    assert.ok(lines.includes('codex-review | codex | gpt-6.1-sol | openai | found'));
  });

  it('report handles a log mixing old-shape and new-shape records without crashing', () => {
    const logDir = join(atomicHome, 'delegate');
    mkdirSync(logDir, { recursive: true });
    const oldRun = {
      kind: 'run',
      id: 'OLD-1',
      project: 'demo',
      task: 'legacy task',
      role: 'implement',
      executor: 'opencode',
      model: 'opencode-go/deepseek-v4-pro',
      user_confirmed: true,
      started: '2026-10-01T10:00:00+00:00',
      duration_s: 12,
      exit_code: 0,
      timed_out: false,
      peak: false,
      base: 'abcdef1234',
      head: 'abcdef1234',
      commits: 1,
      files_changed: 2,
      dirty_after: false,
      card: cardPath,
      stdout: join(outDir, 'OLD-1.out.md'),
      stderr: join(outDir, 'OLD-1.err'),
      attempt: 1,
    };
    const oldVerdict = {
      kind: 'verdict',
      id: 'OLD-1',
      at: '2026-10-01T10:05:00+00:00',
      gate_host: 'pass',
      gate_executor_claim: 'pass',
      delivered: 'yes',
      review_by: 'agy-review',
      review_rounds: 1,
      findings_major: 0,
      findings_medium: 1,
      findings_minor: 0,
      orchestrator_rework: 'none',
    };
    const newRun = {
      ...oldRun,
      id: 'NEW-1',
      executor: 'codex',
      model: 'gpt-6-astra',
      family: 'openai',
      failure: 'none',
      dirty_before: false,
      last_message: join(outDir, 'NEW-1.last.md'),
    };
    const legacyNamedRun = {
      ...oldRun,
      id: 'OLD-2',
      profile: 'deepseek-pro',
      model: 'deepseek-pro',
    };
    writeFileSync(
      join(logDir, 'runs.jsonl'),
      [
        JSON.stringify(oldRun),
        JSON.stringify(oldVerdict),
        JSON.stringify(newRun),
        JSON.stringify(legacyNamedRun),
      ].join('\n') + '\n',
    );

    const res = runDelegate(['report'], baseEnv);
    assert.equal(res.status, 0, res.stderr);
    assert.match(res.stdout, /3 tasks, 3 runs/);
    assert.match(res.stdout, /implement \| opencode \| opencode-go\/deepseek-v4-pro/);
    assert.match(res.stdout, /implement \| opencode \| deepseek-pro/);
    assert.match(res.stdout, /implement \| codex \| gpt-6-astra/);
  });
});
