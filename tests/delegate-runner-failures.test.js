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
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import {
  REPO_ROOT,
  DELEGATE_PY,
  hasPython3,
  PYTHON3,
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
  function reviewArgs(extra = [], profile = 'agy-review') {
    return ['run', '--id', 'D8', '--task', 'review input', '--role', 'review',
      '--profile', profile, '--cwd', repoDir, '--card', reviewCardPath,
      '--out', outDir, '--confirmed', ...extra];
  }
  // AS-D4 round 1 regressions. All executors below are disposable fake CLIs.
  function pipelineArgs(extra = []) {
    return ['pipeline', '--id', 'R1', '--task', 'regression', '--role', 'implement',
      '--cwd', repoDir, '--card', cardPath, '--route', 'flash', '--gate', 'true',
      '--review-card', reviewCardPath, '--review-route', 'codex-review,agy-review',
      '--out', outDir, '--confirmed', ...extra];
  }
  function steps(configs) {
    configs.forEach((cfg, i) => writeFileSync(join(seqDir, `step_${i}.json`), JSON.stringify(cfg)));
    return { ...baseEnv, FAKE_SEQ_DIR: seqDir };
  }
  function summary() { return readFileSync(join(outDir, 'R1.summary.md'), 'utf8'); }
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
  // Exercise the fallback even on interpreters that expose os.waitid.
  function withoutWaitid() {
    const siteDir = join(root, 'no-waitid');
    mkdirSync(siteDir, { recursive: true });
    writeFileSync(join(siteDir, 'sitecustomize.py'),
      'import os\nif hasattr(os, "waitid"): del os.waitid\n');
    return { PYTHONPATH: [siteDir, process.env.PYTHONPATH].filter(Boolean).join(':') };
  }

  for (const profile of ['agy-review', 'codex-review', 'flash-review']) {
    it(`D8 composes and saves exact input for ${profile}, preserving the card`, () => {
      const range = reviewRange('..');
      const original = readFileSync(reviewCardPath, 'utf8');
      const extra = join(root, 'extra.md');
      writeFileSync(extra, 'extra card ```````\n');
      const res = runDelegate(reviewArgs(['--diff-range', range, '--attach', cardPath, '--attach', extra], profile), baseEnv);
      assert.equal(res.status, 0, res.stderr);
      const [rec] = readLogRecords(atomicHome);
      const prompt = readFileSync(rec.prompt, 'utf8');
      const diff = execFileSync('git', ['-C', repoDir, 'diff', range], { encoding: 'utf8' });
      assert.equal(rec.diff_bytes, Buffer.byteLength(diff));
      assert.deepEqual(rec.attached, ['card.md', 'extra.md']);
      assert.equal(readFileSync(reviewCardPath, 'utf8'), original);
      assert.ok(prompt.startsWith(original.replaceAll('{{DIFF_RANGE}}', range)));
      assert.match(prompt, /## Attached: card\.md\n/);
      assert.ok(prompt.indexOf('## Attached: extra.md') > prompt.indexOf('## Attached: card.md'));
      assert.ok(prompt.indexOf(`## Diff ${range}`) > prompt.indexOf('## Attached: extra.md'));
      assert.ok(prompt.includes(diff));
      const diffBlock = prompt.slice(prompt.indexOf(`## Diff ${range}`)).split('\n');
      assert.ok(diffBlock.some(line => /^`{7,}(diff)?$/.test(line)), 'diff fence must exceed six backticks');
      assert.match(prompt, /`{8,}\nextra card/);
      const argv = JSON.parse(readFileSync(argvFile, 'utf8'));
      assert.equal(profile === 'flash-review' ? argv.at(-1) : readFileSync(stdinFile, 'utf8'), prompt);
    });
  }
  for (const profile of ['agy-review', 'agy']) {
    it(`D8 refuses ${profile} review without range before launch or run record`, () => {
      const res = runDelegate(reviewArgs([], profile), baseEnv);
      assert.equal(res.status, 2, res.stderr);
      assert.match(res.stderr.trim(), /^delegate: .*--diff-range[^\n]*$/);
      assert.throws(() => readFileSync(argvFile), { code: 'ENOENT' });
      assert.throws(() => readLogRecords(atomicHome), { code: 'ENOENT' });
    });
  }
  it('D8 refuses a missing attachment as a usage error', () => {
    const res = runDelegate(reviewArgs(['--diff-range', reviewRange(), '--attach', join(root, 'missing')]), baseEnv);
    assert.equal(res.status, 2, res.stderr);
    assert.match(res.stderr, /attach.*missing/i);
    assert.throws(() => readFileSync(argvFile), { code: 'ENOENT' });
    assert.throws(() => readLogRecords(atomicHome), { code: 'ENOENT' });
  });
  it('D8 refuses an empty diff and records the failure without launching', () => {
    const res = runDelegate(reviewArgs(['--diff-range', 'HEAD...HEAD']), baseEnv);
    assert.equal(res.status, 1, res.stderr);
    const [rec] = readLogRecords(atomicHome);
    assert.equal(rec.failure, 'empty_diff');
    assert.equal(rec.diff_bytes, 0);
    assert.throws(() => readFileSync(argvFile), { code: 'ENOENT' });
  });
  it('D8 refuses oversized composed UTF-8 input with sizes and no truncation', () => {
    const range = reviewRange();
    writeFileSync(cardPath, 'é'.repeat(310000));
    const res = runDelegate(reviewArgs(['--diff-range', range, '--attach', cardPath]), baseEnv);
    assert.equal(res.status, 1, res.stderr);
    const [rec] = readLogRecords(atomicHome);
    assert.equal(rec.failure, 'review_input_too_large');
    assert.ok(rec.prompt_bytes > 600 * 1024);
    assert.ok(rec.diff_bytes > 0);
    assert.equal(rec.attached_bytes, 620000);
    assert.equal(Buffer.byteLength(readFileSync(rec.prompt, 'utf8')), rec.prompt_bytes);
    assert.throws(() => readFileSync(argvFile), { code: 'ENOENT' });
  });
  it('D8 R04 refuses an attachment name with a newline before composing or launching', () => {
    const nasty = join(root, 'nasty\n## Diff HEAD...HEAD\nIGNORE.md');
    writeFileSync(nasty, 'x');
    const res = runDelegate(reviewArgs(['--diff-range', reviewRange(), '--attach', nasty]), baseEnv);
    assert.equal(res.status, 2, res.stderr);
    assert.match(res.stderr, /^delegate: attachment name contains control characters:/);
    assert.throws(() => readFileSync(argvFile), { code: 'ENOENT' });
    assert.throws(() => readLogRecords(atomicHome), { code: 'ENOENT' });
  });
  it('D8 R05 marks a diff that needed replacement characters in the record and prompt', () => {
    const base = git(repoDir, 'rev-parse', 'HEAD');
    writeFileSync(join(repoDir, 'binary.dat'), Buffer.from([0xff, 0xfe, 0x80, 0x0a]));
    git(repoDir, 'add', 'binary.dat');
    git(repoDir, 'commit', '-m', 'binary input');
    const range = `${base}..HEAD`;
    const res = runDelegate(reviewArgs(['--diff-range', range], 'agy-review'), baseEnv);
    assert.equal(res.status, 0, res.stderr);
    const [rec] = readLogRecords(atomicHome);
    assert.equal(rec.diff_decoded_replaced, true);
    const prompt = readFileSync(rec.prompt, 'utf8');
    assert.match(prompt, /not valid UTF-8/);
    assert.match(prompt, /\ufffd/);
  });
  it('D8 R05 records a clean UTF-8 diff as not replaced', () => {
    const res = runDelegate(reviewArgs(['--diff-range', reviewRange()], 'agy-review'), baseEnv);
    assert.equal(res.status, 0, res.stderr);
    assert.equal(readLogRecords(atomicHome)[0].diff_decoded_replaced, false);
  });
  for (const range of ['--output=/tmp/x..HEAD', 'a..b c', '-x...HEAD', 'a..b\tc', 'HEAD..']) {
    it(`D8 R07 refuses an unsafe --diff-range value ${JSON.stringify(range)}`, () => {
      const res = runDelegate(reviewArgs([`--diff-range=${range}`]), baseEnv);
      assert.equal(res.status, 2, res.stderr);
      assert.equal(res.stderr.trim().split('\n').length, 1, res.stderr);
      assert.match(res.stderr, /^delegate: --diff-range must be/);
      assert.throws(() => readFileSync(argvFile), { code: 'ENOENT' });
      assert.throws(() => readLogRecords(atomicHome), { code: 'ENOENT' });
    });
  }
  for (const [label, profile, env, failure] of [
    ['agy empty', 'agy-review', { FAKE_STDOUT: '' }, 'empty_output'],
    ['agy whitespace', 'agy-review', { FAKE_STDOUT: ' \n\t' }, 'empty_output'],
    ['agy text', 'agy-review', {}, 'none'],
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
        ...(profile.startsWith('agy') ? ['--diff-range', reviewRange()] : []),
        '--cwd', repoDir, '--card', cardPath, '--out', outDir, '--confirmed',
      ], { ...baseEnv, ...env });
      assert.equal(res.status, failure === 'none' ? 0 : 1, res.stderr);
      const [rec] = readLogRecords(atomicHome);
      assert.equal(rec.failure, failure);
      assert.ok(rec.duration_s < 60);
      assert.equal(rec.uncommitted, false);
    });
  }

  // AS-D6: Flash is a reviewer. `--role review --profile flash` (and its alias)
  // resolves to `flash-review`; a raw OpenCode Flash review also runs.
  for (const [label, args, expectedFamily] of [
    ['--role review --profile flash', ['--role', 'review', '--profile', 'flash'], 'deepseek'],
    ['--role review --profile deepseek-light', ['--role', 'review', '--profile', 'deepseek-light'], 'deepseek'],
    ['--role review with raw opencode Flash',
      ['--role', 'review', '--executor', 'opencode', '--model', 'opencode-go/deepseek-v4.1-flash'], null],
  ]) {
    it(`run ${label} launches an OpenCode review with the Flash model`, () => {
      const res = runDelegate([
        'run', '--id', 'T-FLASH-REVIEW', '--task', label,
        ...args,
        '--cwd', repoDir, '--card', cardPath, '--out', outDir, '--confirmed',
      ], baseEnv);
      assert.equal(res.status, 0, res.stderr);
      assert.deepEqual(JSON.parse(readFileSync(argvFile, 'utf8')), [
        fakePaths.opencode,
        'run',
        '--standalone',
        '--archived',
        '-m',
        'opencode-go/deepseek-v4.1-flash',
        readFileSync(cardPath, 'utf8'),
      ]);
      const [rec] = readLogRecords(atomicHome);
      assert.equal(rec.role, 'review');
      assert.equal(rec.executor, 'opencode');
      assert.equal(rec.model, 'opencode-go/deepseek-v4.1-flash');
      assert.equal(rec.family, expectedFamily);
      assert.equal(rec.failure, 'none');
    });
  }

  // AS-D6: the model rule survives; any non-Flash OpenCode model is refused for
  // every role, including review.
  for (const role of ['implement', 'review']) {
    it(`run --role ${role} with raw opencode hy4 is refused before launch`, () => {
      const res = runDelegate([
        'run', '--id', 'T-REFUSED', '--task', `refused ${role}`,
        '--role', role, '--executor', 'opencode', '--model', 'opencode-go/hy4',
        '--cwd', repoDir, '--card', cardPath, '--out', outDir, '--confirmed',
      ], baseEnv);
      assert.equal(res.status, 2, res.stderr);
      assert.equal(res.stderr.trim().split('\n').length, 1, res.stderr);
      assert.match(res.stderr, /OpenCode runs only opencode-go\/deepseek-v4\.1-flash and opencode-go\/muse-spark-1\.3-contributor; use codex or agy for another model/);
      assert.throws(() => readFileSync(argvFile), { code: 'ENOENT' });
      assert.throws(() => readFileSync(join(atomicHome, 'delegate', 'runs.jsonl')), { code: 'ENOENT' });
    });
  }

  // Muse Spark is the second OpenCode model: the executor during DeepSeek peak
  // hours and a reviewer of DeepSeek work.
  for (const [label, args, expectedRole] of [
    ['--role implement --profile muse', ['--role', 'implement', '--profile', 'muse'], 'implement'],
    ['--role review --profile muse', ['--role', 'review', '--profile', 'muse'], 'review'],
    ['--role review --profile muse-review', ['--role', 'review', '--profile', 'muse-review'], 'review'],
  ]) {
    it(`run ${label} launches OpenCode with the Muse Spark model`, () => {
      const res = runDelegate([
        'run', '--id', 'T-MUSE', '--task', label,
        ...args,
        '--cwd', repoDir, '--card', cardPath, '--out', outDir, '--confirmed',
      ], baseEnv);
      assert.equal(res.status, 0, res.stderr);
      const argv = JSON.parse(readFileSync(argvFile, 'utf8'));
      assert.equal(argv[argv.indexOf('-m') + 1], 'opencode-go/muse-spark-1.3-contributor');
      const [rec] = readLogRecords(atomicHome);
      assert.equal(rec.role, expectedRole);
      assert.equal(rec.executor, 'opencode');
      assert.equal(rec.model, 'opencode-go/muse-spark-1.3-contributor');
      assert.equal(rec.family, 'meta');
      assert.equal(rec.failure, 'none');
    });
  }

  for (const profile of ['flash', 'muse']) {
    it(`DELEGATE_OPENCODE_MODEL cannot point ${profile} at Muse Spark`, () => {
      const res = runDelegate([
        'run', '--id', 'T-ENV-MUSE', '--task', 'environment model override',
        '--role', 'implement', '--profile', profile,
        '--cwd', repoDir, '--card', cardPath, '--out', outDir, '--confirmed',
      ], { ...baseEnv, DELEGATE_OPENCODE_MODEL: 'opencode-go/muse-spark-1.3-contributor' });
      assert.equal(res.status, 2, res.stderr);
      assert.match(res.stderr, /OpenCode runs only/);
      assert.throws(() => readFileSync(argvFile), { code: 'ENOENT' });
      assert.throws(() => readFileSync(join(atomicHome, 'delegate', 'runs.jsonl')), { code: 'ENOENT' });
    });
  }

  it('run with raw opencode kimi-k3 is refused before launch', () => {
    const res = runDelegate([
      'run', '--id', 'T-REFUSED-KIMI', '--task', 'refused',
      '--role', 'implement', '--executor', 'opencode', '--model', 'opencode-go/kimi-k3',
      '--cwd', repoDir, '--card', cardPath, '--out', outDir, '--confirmed',
    ], baseEnv);
    assert.equal(res.status, 2, res.stderr);
    assert.throws(() => readFileSync(argvFile), { code: 'ENOENT' });
  });

  for (const role of ['implement', 'review']) {
    it(`DELEGATE_OPENCODE_MODEL cannot select another OpenCode model for ${role}`, () => {
      const res = runDelegate([
        'run', '--id', 'T-ENV-MODEL', '--task', 'environment model override',
        '--role', role, '--profile', 'flash',
        '--cwd', repoDir, '--card', cardPath, '--out', outDir, '--confirmed',
      ], { ...baseEnv, DELEGATE_OPENCODE_MODEL: 'opencode-go/hy4' });
      assert.equal(res.status, 2, res.stderr);
      assert.equal(res.stderr.trim().split('\n').length, 1, res.stderr);
      assert.match(res.stderr, /OpenCode runs only opencode-go\/deepseek-v4\.1-flash and opencode-go\/muse-spark-1\.3-contributor; use codex or agy/);
      assert.throws(() => readFileSync(argvFile), { code: 'ENOENT' });
      assert.throws(() => readFileSync(join(atomicHome, 'delegate', 'runs.jsonl')), { code: 'ENOENT' });
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

  it('D9 a review that writes the tree still fails review_wrote under the policy', () => {
    for (const profile of ['codex-review', 'agy-review', 'flash-review']) {
      const extra = ['--diff-range', reviewRange()];
      const res = runDelegate(reviewArgs([...extra], profile), {
        ...baseEnv, FAKE_TOUCH_FILE: `${profile}.txt`, FAKE_STDOUT: 'incomplete',
      });
      assert.equal(res.status, 1, `${profile}: ${res.stderr}`);
      const rec = readLogRecords(atomicHome).at(-1);
      assert.equal(rec.failure, 'review_wrote', profile);
      assert.equal(rec.access.git_write, profile === 'flash-review', profile);
      if (profile === 'flash-review') {
        assert.ok(rec.access.limits.some(limit => /reviewer can still write through the shell/.test(limit)));
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

  for (const profile of ['glm-flash', 'kimi', 'hy4-review']) {
    it(`removed profile ${profile} is refused before anything runs`, () => {
      const res = runDelegate(
        [
          'run',
          '--id', `T-REMOVED-${profile}`,
          '--task', `removed ${profile}`,
          '--role', 'implement',
          '--profile', profile,
          '--cwd', repoDir,
          '--card', cardPath,
          '--out', outDir,
          '--confirmed',
        ],
        baseEnv,
      );
      assert.notEqual(res.status, 0);
      assert.equal(res.stderr.trim().split('\n').length, 1, res.stderr);
      assert.match(res.stderr, new RegExp(`delegate: profile ${profile} was removed`));
      assert.match(res.stderr, /valid profiles: flash, flash-review, codex, codex-review, agy, agy-review/);
      assert.throws(() => readFileSync(argvFile), { code: 'ENOENT' });
      assert.throws(() => readFileSync(join(atomicHome, 'delegate', 'runs.jsonl')), { code: 'ENOENT' });
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
      '--standalone',
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
          ...(profile.startsWith('agy') ? ['--diff-range', reviewRange()] : []),
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
          '--profile', 'agy-review', '--diff-range', reviewRange(),
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

  for (const stage of ['add', 'commit']) {
    it(`D4 R01 ${stage} failure stops before gate and never claims a commit`, () => {
      if (stage === 'commit') {
        const hook = join(repoDir, '.git/hooks/pre-commit');
        writeFileSync(hook, '#!/bin/sh\nexit 1\n'); chmodSync(hook, 0o755);
      } else writeFileSync(join(repoDir, '.git/index.lock'), 'locked');
      const base = git(repoDir, 'rev-parse', 'HEAD');
      const res = runDelegate(pipelineArgs(), steps([{ FAKE_TOUCH_FILE: 'feature' }]));
      assert.notEqual(res.status, 0);
      const rec = readLogRecords(atomicHome).at(-1);
      assert.equal(rec.auto_committed, false);
      assert.equal(rec.gate_exit, null);
      assert.equal(git(repoDir, 'rev-parse', 'HEAD'), base);
      assert.match(summary(), /commit.*fail/i);
    });
  }
  for (const failure of ['review_wrote', 'error', 'timeout']) {
    it(`D4 R03 stops on nonrecoverable reviewer ${failure}`, () => {
      const cfg = failure === 'review_wrote' ? { FAKE_TOUCH_FILE: 'README.md' }
        : failure === 'error' ? { FAKE_EXIT: 2 } : { FAKE_SLEEP: 2 };
      const res = runDelegate(pipelineArgs(['--review-timeout', '1']), steps([
        { FAKE_COMMIT_FILE: 'feature' }, cfg, {},
      ]));
      assert.notEqual(res.status, 0);
      assert.equal(readFileSync(join(seqDir, 'count'), 'utf8'), '2');
      assert.match(summary(), new RegExp(failure));
    });
  }
  for (const mode of ['exception', 'signal', 'hup', 'timeout', 'kill']) {
    it(`D4 R08 R12 cleans real process group after ${mode} with TERM resistant descendant`, () => {
      const res = pythonHarness(`
child_file = pathlib.Path(${JSON.stringify(join(root, 'child.pid'))})
script = pathlib.Path(${JSON.stringify(fakePaths.opencode)})
child_script = child_file.with_suffix('.py')
child_script.write_text("""import signal, time, pathlib, sys
signal.signal(signal.SIGTERM, signal.SIG_IGN)
h = pathlib.Path(sys.argv[1])
while True:
 h.write_text(str(time.time()))
 time.sleep(.02)
""")
script.write_text(f"""#!${PYTHON3}
import subprocess, sys, pathlib, time, signal
signal.signal(signal.SIGTERM, signal.SIG_IGN)
p = subprocess.Popen([sys.executable, {str(child_script)!r}, {str(child_file) + '.heartbeat'!r}])
pathlib.Path({str(child_file)!r}).write_text(str(p.pid))
time.sleep(60)
""")
args = [${JSON.stringify(DELEGATE_PY)}, 'run', '--id', 'group', '--task', 'group', '--role', 'implement', '--profile', 'flash', '--cwd', ${JSON.stringify(repoDir)}, '--card', ${JSON.stringify(cardPath)}, '--out', ${JSON.stringify(outDir)}, '--confirmed', '--allow-short-timeout', '--timeout', '${mode === 'timeout' ? '1' : '60'}']
mode = '${mode}'
if mode == 'exception':
 original_wait = d.wait_for_exit
 def broken_wait(self, *args, **kwargs):
  if self.args[0] == str(script) and not getattr(self, '_injected', False):
   self._injected = True
   heartbeat = pathlib.Path(str(child_file) + '.heartbeat')
   deadline = time.time() + 20
   while not (child_file.exists() and heartbeat.exists()) and time.time() < deadline: time.sleep(.01)
   assert child_file.exists() and heartbeat.exists()
   raise RuntimeError('injected wait error')
  return original_wait(self, *args, **kwargs)
 d.wait_for_exit = broken_wait
 runner = None
else:
 runner = subprocess.Popen([sys.executable, *args], stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, text=True)
try:
 if mode == 'exception':
  try: d.execute_run('group', 'group', 'implement', profile='flash', cwd=${JSON.stringify(repoDir)}, card=${JSON.stringify(cardPath)}, out=${JSON.stringify(outDir)}, confirmed=True)
  except RuntimeError: pass
 else:
  deadline = time.time() + 20
  while not (child_file.exists() and pathlib.Path(str(child_file) + '.heartbeat').exists()) and time.time() < deadline: time.sleep(.01)
  assert child_file.exists() and pathlib.Path(str(child_file) + '.heartbeat').exists()
  deadline = time.time() + 20
  while not list(d.RUNNING.glob('*.json')) and time.time() < deadline: time.sleep(.01)
  assert list(d.RUNNING.glob('*.json')), 'slot not published'
  if mode == 'signal': runner.terminate()
  elif mode == 'hup': runner.send_signal(signal.SIGHUP)
  elif mode == 'kill':
   killed = subprocess.run([sys.executable, ${JSON.stringify(DELEGATE_PY)}, 'kill', 'group'], capture_output=True)
   assert killed.returncode == 0, killed.stderr
  _, runner_stderr = runner.communicate(timeout=25)
 child = int(child_file.read_text())
 heartbeat = pathlib.Path(str(child_file) + '.heartbeat')
 assert heartbeat.exists()
 deadline = time.time() + 20
 while time.time() < deadline:
  try: os.kill(child, 0)
  except ProcessLookupError: break
  time.sleep(.05)
 else: raise AssertionError('descendant still running')
 assert not list(d.RUNNING.glob('*.json')), 'slot survived cleanup: ' + (runner_stderr if runner else '')
 if mode in ('signal', 'hup'):
  runs = [json.loads(line) for line in d.LOG.read_text().splitlines()]
  assert any(r.get('kind') == 'run' and r.get('failure') in ('interrupted', 'orphaned')
             for r in runs), runs
finally:
 if child_file.exists():
  try: os.kill(int(child_file.read_text()), signal.SIGKILL)
  except ProcessLookupError: pass
 if runner is not None and runner.poll() is None: runner.terminate(); runner.wait(timeout=20)
`, withoutWaitid());
      assert.equal(res.status, 0, res.stderr || String(res.error));
    });
  }
  for (const [id, pattern] of [
    ['D4 R15', /Create a filled review card[\s\S]*--review-card <review.md>/],
    ['D4 R16', /outside the approved route/],
    ['D4 R18', /default way to run the executor, commit, gate and review/],
    ['D3 R02', /retry once only[\s\S]*neither `flash` nor `provider_limit`/],
  ]) {
    it(`${id} delegate instructions are consistent`, () => {
      const skill = readFileSync(join(REPO_ROOT, 'skills/core/delegate.md'), 'utf8');
      assert.match(skill, pattern);
      if (id === 'D4 R16') assert.match(skill, /fallback is outside the approved route/);
      assert.doesNotMatch(skill, /verdict` records by step 8/);
    });
  }
});
