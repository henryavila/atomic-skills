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
import { join, dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const DELEGATE_PY = join(REPO_ROOT, 'skills/shared/delegate-assets/delegate.py');

const hasPython3 = spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;

const FAKE_SCRIPT = `#!/usr/bin/env python3
import json, os, pathlib, subprocess, sys, time

argv_file = os.environ.get("FAKE_ARGV_FILE")
if argv_file:
    pathlib.Path(argv_file).write_text(json.dumps(sys.argv))

stdin_file = os.environ.get("FAKE_STDIN_FILE")
if stdin_file:
    pathlib.Path(stdin_file).write_text(sys.stdin.read())

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

out_text = os.environ.get("FAKE_STDOUT", "")
if out_text:
    sys.stdout.write(out_text)

err_text = os.environ.get("FAKE_STDERR", "")
if err_text:
    sys.stderr.write(err_text)

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

function runDelegate(args, env = {}) {
  return spawnSync('python3', [DELEGATE_PY, ...args], {
    encoding: 'utf8',
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

function formatUtcHhMm(totalMinutes) {
  const norm = ((totalMinutes % 1440) + 1440) % 1440;
  const h = String(Math.floor(norm / 60)).padStart(2, '0');
  const m = String(norm % 60).padStart(2, '0');
  return `${h}:${m}`;
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
      DELEGATE_PEAK_START: '25:00',
      DELEGATE_PEAK_END: '25:00',
      FAKE_ARGV_FILE: argvFile,
      FAKE_STDIN_FILE: stdinFile,
    };
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

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
      '--model', 'gpt-6-astra',
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
    assert.equal(rec.model, 'gpt-6-astra');
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
      '--model', 'gpt-6-astra',
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
      '--model', 'gpt-6-astra',
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

  it('keeps agy and opencode argvs unchanged and omits last_message for non-codex executors', () => {
    const cardText = readFileSync(cardPath, 'utf8');

    const opRes = runDelegate(
      [
        'run',
        '--id', 'T-OP',
        '--task', 'opencode task',
        '--role', 'implement',
        '--profile', 'deepseek-pro',
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
      'opencode-go/deepseek-v4-pro',
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
      '--mode',
      'plan',
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

  it('peak window 00:00-23:59 refuses deepseek-pro while codex still runs; midnight-crossing peak prints peak/off-peak accurately', () => {
    const alwaysPeakEnv = {
      ...baseEnv,
      DELEGATE_PEAK_START: '00:00',
      DELEGATE_PEAK_END: '23:59',
    };

    const refused = runDelegate(
      [
        'run',
        '--id', 'T-PEAK-DS',
        '--task', 'deepseek during peak',
        '--role', 'implement',
        '--profile', 'deepseek-pro',
        '--cwd', repoDir,
        '--card', cardPath,
        '--out', outDir,
        '--confirmed',
      ],
      alwaysPeakEnv,
    );
    assert.notEqual(refused.status, 0);

    const allowed = runDelegate(
      [
        'run',
        '--id', 'T-PEAK-CDX',
        '--task', 'codex during peak',
        '--role', 'implement',
        '--profile', 'codex',
        '--cwd', repoDir,
        '--card', cardPath,
        '--out', outDir,
        '--confirmed',
      ],
      alwaysPeakEnv,
    );
    assert.equal(allowed.status, 0, allowed.stderr);

    const now = new Date();
    const utcMin = now.getUTCHours() * 60 + now.getUTCMinutes();
    let insideStart;
    let insideEnd;
    let outsideStart;
    let outsideEnd;

    if (utcMin < 720) {
      insideStart = '23:50';
      insideEnd = formatUtcHhMm(utcMin + 5);
      outsideStart = '23:59';
      outsideEnd = formatUtcHhMm(Math.max(0, utcMin - 2));
    } else {
      insideStart = formatUtcHhMm(utcMin - 5);
      insideEnd = '00:10';
      outsideStart = formatUtcHhMm(Math.min(1439, utcMin + 2));
      outsideEnd = '00:00';
    }

    assert.ok(insideStart > insideEnd, `expected midnight crossing: ${insideStart} > ${insideEnd}`);
    assert.ok(outsideStart > outsideEnd, `expected midnight crossing: ${outsideStart} > ${outsideEnd}`);

    const peakRes = runDelegate(['peak'], {
      ...baseEnv,
      DELEGATE_PEAK_TZ_OFFSET: '0',
      DELEGATE_PEAK_START: insideStart,
      DELEGATE_PEAK_END: insideEnd,
    });
    assert.equal(peakRes.status, 0);
    assert.equal(peakRes.stdout.trim(), 'peak');

    const offPeakRes = runDelegate(['peak'], {
      ...baseEnv,
      DELEGATE_PEAK_TZ_OFFSET: '0',
      DELEGATE_PEAK_START: outsideStart,
      DELEGATE_PEAK_END: outsideEnd,
    });
    assert.equal(offPeakRes.status, 0);
    assert.equal(offPeakRes.stdout.trim(), 'off-peak');
  });

  it('profiles lists six profiles and marks executors absent from PATH as missing', () => {
    const partialDir = join(root, 'partial');
    const { binDir: partialBin } = makeFakeBin(partialDir, ['opencode', 'agy']);
    const res = runDelegate(['profiles'], {
      PATH: `${partialBin}:/usr/bin:/bin`,
      HOME: emptyHome,
      ATOMIC_SKILLS_HOME: atomicHome,
    });

    assert.equal(res.status, 0, res.stderr);
    const lines = res.stdout.trim().split('\n');
    assert.equal(lines.length, 6);
    assert.deepEqual(lines, [
      'deepseek-pro | opencode | opencode-go/deepseek-v4-pro | deepseek | found',
      'deepseek-light | opencode | opencode-go/deepseek-v4.1-flash | deepseek | found',
      'agy | agy | gemini-4-hydrogen-high | gemini | found',
      'agy-review | agy | gemini-4-hydrogen-xhigh | gemini | found',
      'codex | codex | gpt-6-astra | openai | missing',
      'codex-review | codex | gpt-6-astra | openai | missing',
    ]);
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
    writeFileSync(
      join(logDir, 'runs.jsonl'),
      [JSON.stringify(oldRun), JSON.stringify(oldVerdict), JSON.stringify(newRun)].join('\n') + '\n',
    );

    const res = runDelegate(['report'], baseEnv);
    assert.equal(res.status, 0, res.stderr);
    assert.match(res.stdout, /2 tasks, 2 runs/);
    assert.match(res.stdout, /implement \| opencode \| opencode-go\/deepseek-v4-pro/);
    assert.match(res.stdout, /implement \| codex \| gpt-6-astra/);
  });
});
