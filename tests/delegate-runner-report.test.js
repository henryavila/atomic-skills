import { describe, it, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { spawnSync, execFileSync, spawn } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join, dirname, resolve, isAbsolute } from 'node:path';
import { tmpdir, hostname } from 'node:os';
import { fileURLToPath } from 'node:url';
import {
  DELEGATE_PY,
  hasPython3,
  PYTHON3,
  FAKE_SCRIPT,
  git,
  initGitRepo,
  makeFakeBin,
  runDelegate,
  readLogRecords,
} from './helpers/delegate-runner-kit.js';

describe('delegate.py runner', { skip: !hasPython3 ? 'python3 not on PATH' : false }, () => {
  let root;
  let atomicHome;
  let emptyHome;
  let repoDir;
  let fakeBin;
  let fakePaths;
  let cardPath;
  let reviewCardPath;
  let seqDir;
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

    reviewCardPath = join(root, 'review-card.md');
    writeFileSync(
      reviewCardPath,
      '# Review CARD-1\nReview the diff `git diff {{DIFF_RANGE}}`\nTOTAL major=0 medium=0 minor=0\n',
    );

    seqDir = join(root, 'seq');
    mkdirSync(seqDir, { recursive: true });

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

  let reviewInputRound = 0;
  function reviewRange(separator = '...') {
    const base = git(repoDir, 'rev-parse', 'HEAD');
    const name = `review-input-${++reviewInputRound}.md`;
    writeFileSync(join(repoDir, name), 'changed `````` content\n');
    git(repoDir, 'add', name);
    git(repoDir, 'commit', '-m', 'review input');
    return `${base}${separator}HEAD`;
  }
  function pythonHarness(code, env = {}) {
    const prelude = `import importlib.util, pathlib, os, sys, json, subprocess, time, signal, threading
spec = importlib.util.spec_from_file_location('delegate', ${JSON.stringify(DELEGATE_PY)})
d = importlib.util.module_from_spec(spec)
spec.loader.exec_module(d)
`;
    return spawnSync(PYTHON3, ['-B', '-c', prelude + code], {
      env: { ...process.env, ...baseEnv, ...env }, encoding: 'utf8', timeout: 60000, detached: true,
    });
  }
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

  it('during peak (Wednesday 02:00 UTC) flash proceeds with peak=true and warning, while codex records peak=false', () => {
    const peakEnv = {
      ...baseEnv,
      DELEGATE_NOW: '2026-11-18T02:00:00Z',
    };
    peakEnv.DELEGATE_PEAK_WINDOWS = undefined;

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
    assert.match(flashRes.stderr, /OpenCode Go peak/);

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

    const codexRes = runDelegate(
      [
        'run',
        '--id', 'T-PEAK-CODEX',
        '--task', 'codex during OpenCode Go peak',
        '--role', 'mechanical',
        '--profile', 'codex',
        '--cwd', repoDir,
        '--card', cardPath,
        '--out', outDir,
        '--confirmed',
      ],
      peakEnv,
    );
    assert.equal(codexRes.status, 0, codexRes.stderr);
    assert.doesNotMatch(codexRes.stderr, /double/i);

    const [flashRec, flashAllowRec, codexRec] = readLogRecords(atomicHome);
    assert.equal(flashRec.peak, true);
    assert.equal(flashAllowRec.peak, true);
    assert.equal(codexRec.peak, false);
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
      env.DELEGATE_PEAK_WINDOWS = undefined;
      const res = runDelegate(['peak'], env);
      assert.equal(res.status, 0, res.stderr);
      assert.equal(res.stdout.trim(), expected, `instant ${instant}`);
    }
  });

  it('default peak windows include the start minute and exclude the end minute', () => {
    const cases = [
      ['2026-11-18T00:59:00Z', 'off-peak'], // Tuesday 21:59 GMT-3
      ['2026-11-18T01:00:00Z', 'peak'],     // Tuesday 22:00 GMT-3
      ['2026-11-18T03:59:59Z', 'peak'],     // Wednesday 00:59:59 GMT-3
      ['2026-11-18T04:00:00Z', 'off-peak'], // Wednesday 01:00 GMT-3
      ['2026-11-18T05:59:00Z', 'off-peak'], // Wednesday 02:59 GMT-3
      ['2026-11-18T06:00:00Z', 'peak'],     // Wednesday 03:00 GMT-3
      ['2026-11-18T09:59:59Z', 'peak'],     // Wednesday 06:59:59 GMT-3
      ['2026-11-18T10:00:00Z', 'off-peak'], // Wednesday 07:00 GMT-3
    ];
    for (const [instant, expected] of cases) {
      const env = { ...baseEnv, DELEGATE_NOW: instant };
      env.DELEGATE_PEAK_WINDOWS = undefined;
      const res = runDelegate(['peak'], env);
      assert.equal(res.status, 0, res.stderr);
      assert.equal(res.stdout.trim(), expected, `instant ${instant}`);
    }
  });

  it('the cheap weekend runs from Friday 22:00 to Sunday 22:00 GMT-3', () => {
    const cases = [
      ['2026-11-21T00:59:00Z', 'off-peak'], // Friday 21:59 GMT-3
      ['2026-11-21T01:00:00Z', 'off-peak'], // Friday 22:00 GMT-3
      ['2026-11-22T12:00:00Z', 'off-peak'], // Sunday 09:00 GMT-3
      ['2026-11-23T00:59:00Z', 'off-peak'], // Sunday 21:59 GMT-3
      ['2026-11-23T01:00:00Z', 'peak'],     // Sunday 22:00 GMT-3
    ];
    for (const [instant, expected] of cases) {
      const env = { ...baseEnv, DELEGATE_NOW: instant };
      env.DELEGATE_PEAK_WINDOWS = undefined;
      const res = runDelegate(['peak'], env);
      assert.equal(res.status, 0, res.stderr);
      assert.equal(res.stdout.trim(), expected, `instant ${instant}`);
    }
  });

  it('a midnight-crossing window also excludes its end minute', () => {
    const cases = [
      ['2026-11-18T00:59:00Z', 'peak'],
      ['2026-11-18T01:00:00Z', 'off-peak'],
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

  it('profiles lists exactly the seven supported profiles in order and marks executors absent from PATH as missing when DELEGATE_NO_FALLBACK_PATHS=1', () => {
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
    assert.equal(lines.length, 20);
    assert.deepEqual(lines.filter((line) => !line.startsWith('  ')), [
      'flash | opencode | opencode-go/deepseek-v4.1-flash | deepseek | found',
      'flash-review | opencode | opencode-go/deepseek-v4.1-flash | deepseek | found',
      'codex | codex | gpt-6.1-sol | openai | missing',
      'codex-review | codex | gpt-6.1-sol | openai | missing',
      'agy | agy | gemini-4-hydrogen-high | gemini | found',
      'agy-review | agy | gemini-4-hydrogen-xhigh | gemini | found',
      'claude-review | claude | claude-sonnet-5-5 | anthropic | missing',
    ]);
    assert.equal(lines.filter((line) => line.startsWith('  ')).length, 13);
    assert.match(res.stdout, /network=yes \| git_write=yes/);
    assert.match(res.stdout, /network=yes \| git_write=no/);
    assert.match(res.stdout, /limits=/);
  });

  it('profiles shows the Flash model and marks OpenCode entries refused when DELEGATE_OPENCODE_MODEL names another model', () => {
    const res = runDelegate(['profiles'], {
      ...baseEnv,
      DELEGATE_NO_FALLBACK_PATHS: '1',
      DELEGATE_OPENCODE_MODEL: 'opencode-go/hy4',
    });

    assert.equal(res.status, 0, res.stderr);
    const lines = res.stdout.trim().split('\n');
    assert.equal(lines.length, 20);
    assert.ok(
      lines.includes('flash | opencode | opencode-go/deepseek-v4.1-flash | deepseek | refused'),
      res.stdout,
    );
    assert.ok(
      lines.includes('flash-review | opencode | opencode-go/deepseek-v4.1-flash | deepseek | refused'),
      res.stdout,
    );
    assert.doesNotMatch(res.stdout, /hy4/);
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
    assert.equal(lines.length, 20);
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

  it('report shows each run under its own role, executor and model when a task ID is shared', () => {
    const logDir = join(atomicHome, 'delegate');
    mkdirSync(logDir, { recursive: true });
    const base = {
      kind: 'run',
      id: 'SHARED-1',
      project: 'demo',
      task: 'shared id',
      user_confirmed: true,
      started: '2026-11-18T10:00:00+00:00',
      exit_code: 0,
      timed_out: false,
      peak: false,
      base: 'abcdef1234',
      head: 'abcdef1234',
      commits: 1,
      files_changed: 1,
      dirty_after: false,
      card: cardPath,
      stdout: join(outDir, 'SHARED-1.out.md'),
      stderr: join(outDir, 'SHARED-1.err'),
      attempt: 1,
    };
    const flashRun = {
      ...base,
      role: 'implement',
      executor: 'opencode',
      model: 'opencode-go/deepseek-v4.1-flash',
      family: 'deepseek',
      duration_s: 30,
      failure: 'none',
    };
    const legacyHy4Run = {
      ...base,
      role: 'review',
      executor: 'opencode',
      model: 'opencode-go/hy4',
      family: 'tencent',
      duration_s: 10,
      failure: 'none',
    };
    const verdict = {
      kind: 'verdict',
      id: 'SHARED-1',
      at: '2026-11-18T10:05:00+00:00',
      gate_host: 'pass',
      delivered: 'yes',
      review_by: 'codex-review',
      review_rounds: 1,
      findings_major: 1,
      findings_medium: 0,
      findings_minor: 0,
      orchestrator_rework: 'none',
    };
    writeFileSync(
      join(logDir, 'runs.jsonl'),
      [flashRun, legacyHy4Run, verdict].map((r) => JSON.stringify(r)).join('\n') + '\n',
    );

    const res = runDelegate(['report'], baseEnv);
    assert.equal(res.status, 0, res.stderr);
    assert.match(res.stdout, /1 tasks, 2 runs/);
    assert.match(res.stdout, /implement \| opencode \| opencode-go\/deepseek-v4\.1-flash: n=1; host gate 1\/1/);
    assert.match(res.stdout, /review \| opencode \| opencode-go\/hy4: n=1; host gate 1\/1/);
    assert.match(res.stdout, /median 30s/);
    assert.match(res.stdout, /median 10s/);
  });

  it('report and status read old removed-profile records as they are without crashing', () => {
    const logDir = join(atomicHome, 'delegate');
    mkdirSync(logDir, { recursive: true });
    mkdirSync(outDir, { recursive: true });
    const errFile = join(outDir, 'OLD-HY4.err');
    writeFileSync(errFile, 'Error: rate limit reached. Please try again at 9:30 AM.\n');
    const base = {
      kind: 'run',
      project: 'demo',
      task: 'legacy task',
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
      stdout: join(outDir, 'legacy.out.md'),
      attempt: 1,
    };
    const oldRuns = [
      { ...base, id: 'OLD-GLM', role: 'mechanical', executor: 'opencode',
        model: 'opencode-go/glm-5.3-flash', profile: 'glm-flash', family: 'zhipu' },
      { ...base, id: 'OLD-KIMI', role: 'implement', executor: 'opencode',
        model: 'opencode-go/kimi-k3.1-pro', profile: 'kimi', family: 'moonshot' },
      { ...base, id: 'OLD-HY4', role: 'review', executor: 'opencode',
        model: 'opencode-go/hy4', profile: 'hy4-review', family: 'tencent',
        exit_code: 1, failure: 'provider_limit', stderr: errFile },
    ];
    const oldPipeline = {
      kind: 'pipeline', id: 'OLD-PIPE', project: 'demo', outcome: 'reviewed',
      executor_profile: 'glm-flash', reviewer_profile: 'hy4-review', gate_exit: 0,
      auto_committed: false, findings: { major: 0, medium: 0, minor: 0 }, duration_s: 20,
    };
    writeFileSync(
      join(logDir, 'runs.jsonl'),
      [...oldRuns, oldPipeline].map((r) => JSON.stringify(r)).join('\n') + '\n',
    );

    const report = runDelegate(['report'], baseEnv);
    assert.equal(report.status, 0, report.stderr);
    assert.match(report.stdout, /mechanical \| opencode \| opencode-go\/glm-5\.3-flash/);
    assert.match(report.stdout, /implement \| opencode \| opencode-go\/kimi-k3\.1-pro/);
    assert.match(report.stdout, /review \| opencode \| opencode-go\/hy4/);
    assert.match(report.stdout, /glm-flash -> hy4-review/);

    const status = runDelegate(['status'], { ...baseEnv, DELEGATE_NOW: '2026-10-01T11:00:00Z' });
    assert.equal(status.status, 0, status.stderr);
    assert.match(status.stdout, /opencode: provider_limit \(try again at 9:30 AM\)/);
  });

  it('status prints paused/active and lists running slot', () => {
    runDelegate(['pause'], baseEnv);
    const pausedRes = runDelegate(['status'], baseEnv);
    assert.equal(pausedRes.status, 0);
    assert.match(pausedRes.stdout, /^paused/);

    runDelegate(['resume'], baseEnv);

    const runningDir = join(atomicHome, 'delegate', 'running');
    mkdirSync(runningDir, { recursive: true });
    // Keep a running process to test listing
    const bg = spawn('sleep', ['5'], { detached: true });
    const identity = pythonHarness(`print(d.process_identity(${bg.pid}))`).stdout.trim();
    writeFileSync(
      join(runningDir, `opencode-T-RUNNING-${bg.pid}.json`),
      JSON.stringify({
        id: 'T-RUNNING',
        project: 'test-proj',
        profile: 'flash',
        role: 'implement',
        pid: bg.pid,
        pgid: bg.pid,
        process_start: identity,
        started: '2026-11-18T10:00:00+00:00',
      }),
    );

    const activeRes = runDelegate(['status'], baseEnv);
    bg.kill();
    assert.equal(activeRes.status, 0);
    assert.match(activeRes.stdout, /^active/);
    assert.match(activeRes.stdout, /T-RUNNING/);
    assert.match(activeRes.stdout, /test-proj/);
    assert.match(activeRes.stdout, /flash/);
  });

  it('status and status --json list local and remote runs with their machine', () => {
    const delegateDir = join(atomicHome, 'delegate');
    mkdirSync(join(delegateDir, 'running'), { recursive: true });
    mkdirSync(join(delegateDir, 'running-remote'), { recursive: true });
    const machine = hostname().split('.')[0];
    const bg = spawn('sleep', ['30'], { detached: true, stdio: 'ignore' });
    try {
      const identity = pythonHarness(`print(d.process_identity(${bg.pid}))`).stdout.trim();
      assert.match(identity, /^(darwin|linux):/);
      // A slot written by a runner that knew no machine field.
      writeFileSync(join(delegateDir, 'running', `opencode-T-OLD-${bg.pid}.json`), JSON.stringify({
        id: 'T-OLD', project: 'test-proj', profile: 'flash', role: 'implement',
        pid: bg.pid, pgid: bg.pid, process_start: identity, started: '2026-11-18T10:00:00+00:00',
      }));
      writeFileSync(join(delegateDir, 'running', `codex-T-NEW-${bg.pid}.json`), JSON.stringify({
        id: 'T-NEW', project: 'test-proj', profile: 'codex', role: 'implement', machine: 'this-mac',
        pid: bg.pid, pgid: bg.pid, process_start: identity, started: '2026-11-18T10:01:00+00:00',
        last_progress: '2026-11-18T10:04:00+00:00',
      }));
      writeFileSync(join(delegateDir, 'running-remote', `opencode-T-FAR-${bg.pid}.json`), JSON.stringify({
        id: 'T-FAR', project: 'far-proj', profile: 'flash', role: 'review', machine: 'ultron',
        started: '2026-11-18T10:02:00+00:00', runner_pid: bg.pid, runner_start: identity,
      }));
      const env = { ...baseEnv, DELEGATE_NOW: '2026-11-18T10:05:00Z', DELEGATE_MAX_OPENCODE: '1' };

      const plain = runDelegate(['status'], env);
      assert.equal(plain.status, 0, plain.stderr);
      assert.deepEqual(plain.stdout.trim().split('\n'), [
        'active',
        `T-OLD | test-proj | flash | implement | ${machine} | 5m | idle 5m`,
        'T-NEW | test-proj | codex | implement | this-mac | 4m | idle 1m',
        'T-FAR | far-proj | flash | review | ultron | 3m | remote',
      ]);

      const json = runDelegate(['status', '--json'], env);
      assert.equal(json.status, 0, json.stderr);
      assert.deepEqual(JSON.parse(json.stdout), {
        paused: false,
        active: [
          { id: 'T-OLD', project: 'test-proj', profile: 'flash', role: 'implement', machine,
            remote: false, started: '2026-11-18T10:00:00+00:00', age_s: 300, idle_s: 300, runner_gone: false },
          { id: 'T-NEW', project: 'test-proj', profile: 'codex', role: 'implement', machine: 'this-mac',
            remote: false, started: '2026-11-18T10:01:00+00:00', age_s: 240, idle_s: 60, runner_gone: false },
          { id: 'T-FAR', project: 'far-proj', profile: 'flash', role: 'review', machine: 'ultron',
            remote: true, started: '2026-11-18T10:02:00+00:00', age_s: 180, idle_s: null, runner_gone: false },
        ],
      });

      // The remote file is no slot: the one OpenCode slot is taken by T-OLD
      // alone, and reading the active runs twice changed nothing on disk.
      const slots = pythonHarness(
        'print(len(d.get_active_slots("opencode")), len(d.get_active_slots()))', env);
      assert.equal(slots.stdout.trim(), '1 2', slots.stderr);
      assert.deepEqual(readdirSync(join(delegateDir, 'running-remote')).filter(name => name.endsWith('.json')),
        [`opencode-T-FAR-${bg.pid}.json`]);
      assert.equal(existsSync(join(delegateDir, 'runs.jsonl')), false);
    } finally {
      try { process.kill(-bg.pid, 'SIGKILL'); } catch { /* already gone */ }
    }
  });

  it('status --json says paused and lists nothing on an idle machine', () => {
    runDelegate(['pause'], baseEnv);
    const json = runDelegate(['status', '--json'], baseEnv);
    assert.equal(json.status, 0, json.stderr);
    assert.deepEqual(JSON.parse(json.stdout), { paused: true, active: [] });
  });

  it('drops a remote active file that names no live runner without logging it twice', () => {
    const delegateDir = join(atomicHome, 'delegate');
    mkdirSync(join(delegateDir, 'running-remote'), { recursive: true });
    const gone = spawnSync('true');
    writeFileSync(join(delegateDir, 'running-remote', `opencode-T-DEAD-${gone.pid}.json`), JSON.stringify({
      id: 'T-DEAD', project: 'far-proj', profile: 'flash', role: 'implement', machine: 'ultron',
      started: '2026-11-18T10:02:00+00:00', runner_pid: gone.pid, runner_start: 'darwin:1:1',
    }));
    writeFileSync(join(delegateDir, 'running-remote', 'opencode-T-BROKEN-1.json'), '{not json');
    const json = runDelegate(['status', '--json'], baseEnv);
    assert.equal(json.status, 0, json.stderr);
    assert.deepEqual(JSON.parse(json.stdout).active, []);
    assert.deepEqual(readdirSync(join(delegateDir, 'running-remote')).filter(name => name !== '.lock'), []);
    runDelegate(['status'], baseEnv);
    const records = readLogRecords(atomicHome);
    assert.equal(records.length, 1, JSON.stringify(records));
    assert.equal(records[0].id, 'T-DEAD');
    assert.equal(records[0].failure, 'runner_lost');
    assert.equal(records[0].machine, 'ultron');
    assert.equal(records[0].model, 'opencode-go/deepseek-v4.1-flash');
  });

  it('status shows try again at 12:44 PM text after a recorded limit failure', () => {
    const logDir = join(atomicHome, 'delegate');
    mkdirSync(logDir, { recursive: true });
    const errFile = join(outDir, 'T-LIMIT-RESET.err');
    mkdirSync(outDir, { recursive: true });
    writeFileSync(errFile, 'Error: rate limit reached. Please try again at 12:44 PM.\n');

    const limitRun = {
      kind: 'run',
      id: 'T-LIMIT-RESET',
      project: 'demo',
      task: 'hit limit',
      role: 'implement',
      executor: 'opencode',
      model: 'opencode-go/deepseek-v4.1-flash',
      started: '2026-11-18T10:00:00+00:00',
      duration_s: 5,
      exit_code: 1,
      timed_out: false,
      failure: 'provider_limit',
      stderr: errFile,
    };
    writeFileSync(join(logDir, 'runs.jsonl'), JSON.stringify(limitRun) + '\n');

    const res = runDelegate(['status'], {
      ...baseEnv,
      DELEGATE_NOW: '2026-11-18T11:00:00Z',
    });
    assert.equal(res.status, 0, res.stderr);
    assert.match(res.stdout, /try again at 12:44 PM/);
  });

  it('status exits 0 on a machine with no log', () => {
    const res = runDelegate(['status'], baseEnv);
    assert.equal(res.status, 0, res.stderr);
    assert.match(res.stdout, /^active/);
  });

  it('D4 R13 status orders limits by completion and supports legacy duration', () => {
    const logDir = join(atomicHome, 'delegate'); mkdirSync(logDir, { recursive: true });
    const oldErr = join(root, 'old.err'), newErr = join(root, 'new.err');
    writeFileSync(oldErr, 'quota try again at OLD RESET'); writeFileSync(newErr, 'quota try again at NEW RESET');
    const records = [
      { kind: 'run', failure: 'provider_limit', executor: 'codex', started: '2026-11-18T00:00:00+00:00', completed: '2026-11-18T11:59:00+00:00', stderr: newErr },
      { kind: 'run', failure: 'provider_limit', executor: 'codex', started: '2026-11-18T11:00:00+00:00', completed: '2026-11-18T11:30:00+00:00', stderr: oldErr },
      { kind: 'run', failure: 'provider_limit', executor: 'agy', started: '2026-11-18T00:00:00+00:00', duration_s: 42000, stderr: newErr },
    ];
    writeFileSync(join(logDir, 'runs.jsonl'), records.map(JSON.stringify).join('\n'));
    const res = runDelegate(['status'], { ...baseEnv, DELEGATE_NOW: '2026-11-18T12:00:00Z' });
    assert.equal(res.status, 0, res.stderr);
    assert.match(res.stdout, /codex: provider_limit \(try again at NEW RESET\)/);
    assert.match(res.stdout, /agy: provider_limit \(try again at NEW RESET\)/);
    assert.doesNotMatch(res.stdout, /OLD RESET/);
  });
  it('D3 R01 report counts classified failures with zero exit', () => {
    runDelegate(['run', '--id', 'incomplete', '--task', 'incomplete', '--role', 'review', '--profile', 'agy-review', '--diff-range', reviewRange(), '--cwd', repoDir, '--card', cardPath, '--out', outDir, '--confirmed'], { ...baseEnv, FAKE_STDOUT: 'unfinished' });
    const res = runDelegate(['report'], baseEnv);
    assert.equal(res.status, 0, res.stderr); assert.match(res.stdout, /failed runs 1/);
  });
  it('D3 R03 default peak tests remove inherited configuration', () => {
    const saved = process.env.DELEGATE_PEAK_WINDOWS;
    process.env.DELEGATE_PEAK_WINDOWS = '';
    try {
      const res = runDelegate(['peak'], { ...baseEnv, DELEGATE_PEAK_WINDOWS: undefined, DELEGATE_NOW: '2026-11-18T02:00:00Z' });
      assert.equal(res.stdout.trim(), 'peak');
    } finally {
      if (saved === undefined) delete process.env.DELEGATE_PEAK_WINDOWS;
      else process.env.DELEGATE_PEAK_WINDOWS = saved;
    }
  });
  it('D3 R04 provider_limit takes precedence over review_wrote together', () => {
    const res = runDelegate(['run', '--id', 'both', '--task', 'both', '--role', 'review', '--profile', 'agy-review', '--diff-range', reviewRange(), '--cwd', repoDir, '--card', cardPath, '--out', outDir, '--confirmed'], { ...baseEnv, FAKE_TOUCH_FILE: 'README.md', FAKE_EXIT: '1', FAKE_STDERR: '429 quota' });
    assert.equal(res.status, 1);
    const [rec] = readLogRecords(atomicHome);
    assert.equal(rec.dirty_after, true); assert.equal(rec.failure, 'provider_limit');
  });
});
