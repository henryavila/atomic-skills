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
  it('D8 refuses a missing pipeline attachment before executing the author', () => {
    const res = runDelegate(pipelineArgs(['--review-attach', join(root, 'missing')]), baseEnv);
    assert.equal(res.status, 2, res.stderr);
    assert.match(res.stderr, /attach.*missing/i);
    assert.throws(() => readFileSync(argvFile), { code: 'ENOENT' });
    assert.throws(() => readLogRecords(atomicHome), { code: 'ENOENT' });
  });
  it('D9 R01 lets a pipeline route continue past an oversized executor prompt', () => {
    writeFileSync(cardPath, 'c'.repeat(140000));
    const res = runDelegate(pipelineArgs(['--route', 'flash,codex', '--review-route', 'codex-review']),
      steps([{ FAKE_COMMIT_FILE: 'feature' }, {}]));
    assert.equal(res.status, 1, res.stderr);
    const records = readLogRecords(atomicHome);
    const runs = records.filter(r => r.kind === 'run');
    assert.equal(runs[0].failure, 'input_too_large');
    assert.equal(runs[1].executor, 'codex');
    assert.equal(runs[1].failure, 'none');
    assert.equal(records.at(-1).outcome, 'no_reviewer');
  });
  for (const extraAttach of [false, true]) {
    it(`D8 pipeline supplies range and author card automatically (extra=${extraAttach})`, () => {
      const extra = join(root, 'context.md'); writeFileSync(extra, 'additional context');
      const res = runDelegate(pipelineArgs(['--review-route', 'agy-review',
        ...(extraAttach ? ['--review-attach', extra] : [])]), steps([{ FAKE_COMMIT_FILE: 'feature' }, {}]));
      assert.equal(res.status, 0, res.stderr);
      const recs = readLogRecords(atomicHome);
      const review = recs.find(r => r.role === 'review');
      const pipe = recs.at(-1);
      const prompt = readFileSync(review.prompt, 'utf8');
      assert.ok(prompt.includes(`## Diff ${pipe.base}...${pipe.head}`));
      assert.ok(prompt.includes(readFileSync(cardPath, 'utf8')));
      assert.ok(prompt.includes('diff --git a/feature b/feature'));
      assert.deepEqual(review.attached, extraAttach ? ['card.md', 'context.md'] : ['card.md']);
      if (extraAttach) assert.ok(prompt.includes('additional context'));
    });
  }
  it('D9 pipeline --access strict applies to executor and reviewer and records it', () => {
    const res = runDelegate(pipelineArgs(['--route', 'flash', '--review-route', 'agy-review', '--access', 'strict']),
      steps([{ FAKE_COMMIT_FILE: 'feature' }, {}]));
    assert.equal(res.status, 0, res.stderr);
    const runs = readLogRecords(atomicHome).filter(r => r.kind === 'run');
    assert.equal(runs.length, 2);
    for (const rec of runs) {
      assert.equal(rec.access.mode, 'strict');
      assert.doesNotMatch(rec.access.limits.join(' '), /factory sandbox/i);
    }
    const implRec = runs.find(r => r.role === 'implement');
    const reviewRec = runs.find(r => r.role === 'review');
    assert.equal(implRec.access.network, true);
    assert.match(implRec.access.limits.join(' '), /no sandbox/);
    assert.equal(reviewRec.access.network, false);
    assert.equal(reviewRec.access.git_write, false);
    const implArgv = JSON.parse(readFileSync(join(seqDir, 'argv_0.json'), 'utf8'));
    const reviewArgv = JSON.parse(readFileSync(join(seqDir, 'argv_1.json'), 'utf8'));
    assert.ok(!implArgv.includes('--auto'));
    assert.ok(implArgv.includes('--standalone'));
    assert.ok(reviewArgv.includes('--sandbox'));
    const settings = JSON.parse(reviewArgv[reviewArgv.indexOf('--settings') + 1]);
    assert.ok(!settings.permissions.allow.includes('read_url(*)'));
    assert.ok(!settings.permissions.allow.includes(`read_file(${join(repoDir, '.git')})`));
  });

  it('pipeline route naming a removed profile is refused before launching', () => {
    const res = runDelegate(
      [
        'pipeline',
        '--id', 'T-PIPE-REMOVED',
        '--task', 'removed route',
        '--role', 'implement',
        '--cwd', repoDir,
        '--card', cardPath,
        '--route', 'flash,hy4-review',
        '--gate', 'true',
        '--review-card', reviewCardPath,
        '--review-route', 'codex-review',
        '--out', outDir,
        '--confirmed',
      ],
      { ...baseEnv, FAKE_SEQ_DIR: seqDir },
    );
    assert.notEqual(res.status, 0);
    assert.equal(res.stderr.trim().split('\n').length, 1, res.stderr);
    assert.match(res.stderr, /delegate: profile hy4-review was removed/);
    assert.match(res.stderr, /valid profiles: flash, flash-review, codex, codex-review, agy, agy-review/);
    assert.throws(() => readFileSync(join(seqDir, 'count')), { code: 'ENOENT' });
  });

  it('pipeline happy path: executor commits, gate passes, reviewer reports findings', () => {
    writeFileSync(
      join(seqDir, 'step_0.json'),
      JSON.stringify({ FAKE_COMMIT_FILE: 'feature.txt' }),
    );
    const reviewOutput =
      'R01 | major | feature.txt:1 | bug | test | fix it\n' +
      'R02 | medium | feature.txt:2 | nit | test | fix it\n' +
      'TOTAL major=1 medium=1 minor=0\n';
    writeFileSync(
      join(seqDir, 'step_1.json'),
      JSON.stringify({ FAKE_STDOUT: reviewOutput, FAKE_LAST_MESSAGE: reviewOutput }),
    );

    const res = runDelegate(
      [
        'pipeline',
        '--id', 'T-PIPE-HAPPY',
        '--task', 'happy path feature',
        '--role', 'implement',
        '--cwd', repoDir,
        '--card', cardPath,
        '--route', 'flash',
        '--gate', 'true',
        '--review-card', reviewCardPath,
        '--review-route', 'codex-review',
        '--out', outDir,
        '--confirmed',
      ],
      { ...baseEnv, FAKE_SEQ_DIR: seqDir },
    );

    assert.equal(res.status, 0, res.stderr);
    const summaryPath = join(outDir, 'T-PIPE-HAPPY.summary.md');
    const summaryText = readFileSync(summaryPath, 'utf8');
    const summaryLines = summaryText.trim().split('\n');
    assert.ok(summaryLines.length < 60, `summary lines: ${summaryLines.length} >= 60`);
    assert.match(summaryText, /R01\s*\|\s*major/);
    assert.match(summaryText, /R02\s*\|\s*medium/);
    assert.match(summaryText, /TOTAL major=1 medium=1 minor=0/);
    assert.equal(res.stdout.trim(), summaryText.trim());

    const recs = readLogRecords(atomicHome);
    assert.equal(recs.length, 3);
    const [execRec, revRec, pipeRec] = recs;
    assert.equal(execRec.kind, 'run');
    assert.equal(execRec.role, 'implement');
    assert.equal(revRec.kind, 'run');
    assert.equal(revRec.role, 'review');
    assert.equal(pipeRec.kind, 'pipeline');
    assert.equal(pipeRec.id, 'T-PIPE-HAPPY');
    assert.equal(pipeRec.outcome, 'reviewed');
    assert.equal(pipeRec.executor_profile, 'flash');
    assert.equal(pipeRec.reviewer_profile, 'codex-review');
    assert.equal(pipeRec.gate_exit, 0);
    assert.equal(pipeRec.auto_committed, false);
    assert.deepEqual(pipeRec.findings, { major: 1, medium: 1, minor: 0 });
    assert.ok(typeof pipeRec.duration_s === 'number');
  });

  it('pipeline route fallback: first profile hits provider limit, second succeeds', () => {
    writeFileSync(
      join(seqDir, 'step_0.json'),
      JSON.stringify({ FAKE_EXIT: '1', FAKE_STDERR: 'Error: 5 hour usage limit reached\n' }),
    );
    writeFileSync(
      join(seqDir, 'step_1.json'),
      JSON.stringify({ FAKE_COMMIT_FILE: 'feature.txt', FAKE_EXIT: '0' }),
    );
    const reviewOutput = 'All good.\nTOTAL major=0 medium=0 minor=0\n';
    writeFileSync(
      join(seqDir, 'step_2.json'),
      JSON.stringify({ FAKE_STDOUT: reviewOutput, FAKE_LAST_MESSAGE: reviewOutput }),
    );

    const res = runDelegate(
      [
        'pipeline',
        '--id', 'T-PIPE-FALLBACK',
        '--task', 'fallback feature',
        '--role', 'implement',
        '--cwd', repoDir,
        '--card', cardPath,
        '--route', 'flash,codex',
        '--gate', 'true',
        '--review-card', reviewCardPath,
        '--review-route', 'agy-review',
        '--out', outDir,
        '--confirmed',
      ],
      { ...baseEnv, FAKE_SEQ_DIR: seqDir },
    );

    assert.equal(res.status, 0, res.stderr);
    const recs = readLogRecords(atomicHome);
    assert.equal(recs.length, 4);
    assert.equal(recs[0].failure, 'provider_limit');
    assert.equal(recs[1].failure, 'none');
    assert.equal(recs[1].executor, 'codex');
    const pipeRec = recs[3];
    assert.equal(pipeRec.kind, 'pipeline');
    assert.equal(pipeRec.outcome, 'reviewed');
    assert.equal(pipeRec.executor_profile, 'codex');
  });

  it('pipeline goes on to gate and review when the executor exits with an error after committing', () => {
    const env = steps([
      { FAKE_COMMIT_FILE: 'feature.txt', FAKE_EXIT: '1', FAKE_STDERR: 'Error: Cancelled a request for input\n' },
      {},
    ]);
    const res = runDelegate(pipelineArgs(), env);
    assert.equal(res.status, 0, res.stderr);
    const recs = readLogRecords(atomicHome);
    const pipeRec = recs.at(-1);
    assert.equal(recs[0].failure, 'error');
    assert.equal(pipeRec.outcome, 'reviewed');
    assert.equal(pipeRec.executor_profile, 'flash');
    assert.equal(pipeRec.executor_error_after_commit, true);
    assert.equal(pipeRec.gate_exit, 0);
    assert.match(summary(), /executor exited with an error after committing/);
  });

  it('pipeline still ends executor_failed when the errored executor left no commit or a dirty tree', () => {
    for (const [id, cfg] of [['none', { FAKE_EXIT: '1' }],
      ['dirty', { FAKE_COMMIT_FILE: 'feature.txt', FAKE_EARLY_TOUCH: 'left.txt', FAKE_EXIT: '1' }]]) {
      rmSync(seqDir, { recursive: true, force: true });
      mkdirSync(seqDir, { recursive: true });
      const res = runDelegate(pipelineArgs(), steps([cfg]));
      assert.equal(res.status, 1, `${id}: ${res.stderr}`);
      const pipeRec = readLogRecords(atomicHome).at(-1);
      assert.equal(pipeRec.outcome, 'executor_failed', id);
      assert.equal(pipeRec.gate_exit, null, id);
    }
  });

  it('pipeline tries profiles under a provider limit last and records what it moved', () => {
    const logDir = join(atomicHome, 'delegate');
    mkdirSync(logDir, { recursive: true });
    const errFile = join(root, 'limit.err');
    writeFileSync(errFile, 'ERROR: usage limit. Resets in 5h0m0s.\n');
    const completed = new Date(Date.now() - 60000).toISOString().replace('Z', '+00:00');
    const limit = model => JSON.stringify({ kind: 'run', id: 'OLD', role: 'review', executor: 'codex', model,
      completed, started: completed, duration_s: 1, failure: 'provider_limit', stderr: errFile });
    writeFileSync(join(logDir, 'runs.jsonl'), limit('gpt-6.1-sol') + '\n');
    const env = steps([{ FAKE_COMMIT_FILE: 'feature.txt' }, {}]);
    const res = runDelegate(pipelineArgs(['--route', 'codex,flash']), { ...env, DELEGATE_CODEX_MODEL: undefined });
    assert.equal(res.status, 0, res.stderr);
    const pipeRec = readLogRecords(atomicHome).at(-1);
    assert.equal(pipeRec.outcome, 'reviewed');
    assert.equal(pipeRec.executor_profile, 'flash');
    assert.equal(pipeRec.reviewer_profile, 'agy-review');
    assert.deepEqual(pipeRec.reordered, ['codex', 'codex-review']);
    assert.deepEqual(pipeRec.attempts.map(rec => rec.profile), ['flash', 'agy-review']);
    assert.match(summary(), /tried last \(provider limit or missing CLI\): codex, codex-review/);
  });

  it('pipeline still tries a profile under a limit when it is the only one left', () => {
    const logDir = join(atomicHome, 'delegate');
    mkdirSync(logDir, { recursive: true });
    const completed = new Date(Date.now() - 60000).toISOString().replace('Z', '+00:00');
    writeFileSync(join(logDir, 'runs.jsonl'), JSON.stringify({ kind: 'run', id: 'OLD', role: 'review',
      executor: 'codex', model: 'gpt-6.1-sol', completed, started: completed, duration_s: 1,
      failure: 'provider_limit' }) + '\n');
    const env = steps([{ FAKE_COMMIT_FILE: 'feature.txt' }, {}]);
    const res = runDelegate(pipelineArgs(['--review-route', 'codex-review']), { ...env, DELEGATE_CODEX_MODEL: undefined });
    assert.equal(res.status, 0, res.stderr);
    const pipeRec = readLogRecords(atomicHome).at(-1);
    assert.equal(pipeRec.reviewer_profile, 'codex-review');
    assert.equal(pipeRec.reordered, undefined);
  });

  it('pipeline every profile out of quota ends with no_executor and no gate run', () => {
    writeFileSync(
      join(seqDir, 'step_0.json'),
      JSON.stringify({ FAKE_EXIT: '1', FAKE_STDERR: 'Rate limit hit\n' }),
    );
    writeFileSync(
      join(seqDir, 'step_1.json'),
      JSON.stringify({ FAKE_EXIT: '1', FAKE_STDERR: 'Quota exhausted\n' }),
    );

    const res = runDelegate(
      [
        'pipeline',
        '--id', 'T-PIPE-NO-EXEC',
        '--task', 'no executor',
        '--role', 'implement',
        '--cwd', repoDir,
        '--card', cardPath,
        '--route', 'flash,codex',
        '--gate', 'touch should_not_run.txt; false',
        '--review-card', reviewCardPath,
        '--review-route', 'codex-review',
        '--out', outDir,
        '--confirmed',
      ],
      { ...baseEnv, FAKE_SEQ_DIR: seqDir },
    );

    assert.notEqual(res.status, 0);
    assert.throws(() => readFileSync(join(repoDir, 'should_not_run.txt')), { code: 'ENOENT' });
    const recs = readLogRecords(atomicHome);
    const pipeRec = recs.find((r) => r.kind === 'pipeline');
    assert.ok(pipeRec);
    assert.equal(pipeRec.outcome, 'no_executor');
  });

  it('pipeline executor edits without committing triggers runner auto_committed and pre-run diff range', () => {
    const preRunHead = git(repoDir, 'rev-parse', 'HEAD');
    writeFileSync(
      join(seqDir, 'step_0.json'),
      JSON.stringify({ FAKE_TOUCH_FILE: 'uncommitted.txt', FAKE_EXIT: '0' }),
    );
    const reviewOutput = 'TOTAL major=0 medium=0 minor=0\n';
    writeFileSync(
      join(seqDir, 'step_1.json'),
      JSON.stringify({ FAKE_STDOUT: reviewOutput, FAKE_LAST_MESSAGE: reviewOutput }),
    );

    const res = runDelegate(
      [
        'pipeline',
        '--id', 'T-PIPE-AUTO',
        '--task', 'auto commit test',
        '--role', 'implement',
        '--cwd', repoDir,
        '--card', cardPath,
        '--route', 'codex',
        '--gate', 'true',
        '--review-card', reviewCardPath,
        '--review-route', 'agy-review',
        '--out', outDir,
        '--confirmed',
      ],
      { ...baseEnv, FAKE_SEQ_DIR: seqDir },
    );

    assert.equal(res.status, 0, res.stderr);
    const lastCommitMsg = git(repoDir, 'log', '-1', '--pretty=%B');
    assert.equal(lastCommitMsg, 'T-PIPE-AUTO: auto commit test (committed by the delegate runner)');

    const recs = readLogRecords(atomicHome);
    const pipeRec = recs.find((r) => r.kind === 'pipeline');
    assert.ok(pipeRec);
    assert.equal(pipeRec.auto_committed, true);
    assert.equal(pipeRec.outcome, 'reviewed');

    const revCard = readFileSync(recs.find(r => r.kind === 'run' && r.role === 'review').card, 'utf8');
    assert.ok(
      revCard.includes(`${preRunHead}...HEAD`),
      `expected ${preRunHead}...HEAD in reviewer card, got:\n${revCard}`,
    );
    const revArgv = JSON.parse(readFileSync(join(seqDir, 'argv_1.json'), 'utf8'));
    const reviewRun = recs.find(r => r.kind === 'run' && r.role === 'review');
    const reviewPrompt = readFileSync(reviewRun.prompt, 'utf8');
    assert.equal(readFileSync(join(seqDir, 'stdin_1.txt'), 'utf8'), reviewPrompt);
    assert.ok(!revArgv.includes(reviewPrompt));
  });

  it('pipeline executor changes nothing ends with no_changes', () => {
    writeFileSync(
      join(seqDir, 'step_0.json'),
      JSON.stringify({ FAKE_EXIT: '0' }),
    );

    const res = runDelegate(
      [
        'pipeline',
        '--id', 'T-PIPE-NO-CHG',
        '--task', 'clean tree',
        '--role', 'implement',
        '--cwd', repoDir,
        '--card', cardPath,
        '--route', 'flash',
        '--gate', 'true',
        '--review-card', reviewCardPath,
        '--review-route', 'codex-review',
        '--out', outDir,
        '--confirmed',
      ],
      { ...baseEnv, FAKE_SEQ_DIR: seqDir },
    );

    assert.notEqual(res.status, 0);
    const recs = readLogRecords(atomicHome);
    const pipeRec = recs.find((r) => r.kind === 'pipeline');
    assert.ok(pipeRec);
    assert.equal(pipeRec.outcome, 'no_changes');
  });

  it('pipeline gate false ends with gate_failed and includes gate log tail in summary', () => {
    writeFileSync(
      join(seqDir, 'step_0.json'),
      JSON.stringify({ FAKE_COMMIT_FILE: 'gate_test.txt', FAKE_EXIT: '0' }),
    );

    const res = runDelegate(
      [
        'pipeline',
        '--id', 'T-PIPE-GATE-FAIL',
        '--task', 'gate fail test',
        '--role', 'implement',
        '--cwd', repoDir,
        '--card', cardPath,
        '--route', 'flash',
        '--gate', 'echo "FATAL: gate check exploded"; false',
        '--review-card', reviewCardPath,
        '--review-route', 'codex-review',
        '--out', outDir,
        '--confirmed',
      ],
      { ...baseEnv, FAKE_SEQ_DIR: seqDir },
    );

    assert.notEqual(res.status, 0);
    const summaryPath = join(outDir, 'T-PIPE-GATE-FAIL.summary.md');
    const summaryText = readFileSync(summaryPath, 'utf8');
    assert.match(summaryText, /FATAL: gate check exploded/);

    const recs = readLogRecords(atomicHome);
    const pipeRec = recs.find((r) => r.kind === 'pipeline');
    assert.ok(pipeRec);
    assert.equal(pipeRec.outcome, 'gate_failed');
    assert.equal(pipeRec.reviewer_profile, null);
    assert.equal(recs.filter((r) => r.role === 'review').length, 0);
  });

  it('pipeline reviewer of the same family as executor is skipped', () => {
    writeFileSync(
      join(seqDir, 'step_0.json'),
      JSON.stringify({ FAKE_COMMIT_FILE: 'feat.txt', FAKE_EXIT: '0' }),
    );
    // Executor is codex (openai).
    // review-route: codex-review (openai - same family, skipped!), agy-review (gemini - runs!)
    const reviewOutput = 'Reviewed.\nTOTAL major=0 medium=0 minor=0\n';
    writeFileSync(
      join(seqDir, 'step_1.json'),
      JSON.stringify({ FAKE_STDOUT: reviewOutput, FAKE_LAST_MESSAGE: reviewOutput }),
    );

    const res = runDelegate(
      [
        'pipeline',
        '--id', 'T-PIPE-FAM-SKIP',
        '--task', 'same family skip',
        '--role', 'implement',
        '--cwd', repoDir,
        '--card', cardPath,
        '--route', 'codex',
        '--gate', 'true',
        '--review-card', reviewCardPath,
        '--review-route', 'codex-review,agy-review',
        '--out', outDir,
        '--confirmed',
      ],
      { ...baseEnv, FAKE_SEQ_DIR: seqDir },
    );

    assert.equal(res.status, 0, res.stderr);
    const recs = readLogRecords(atomicHome);
    const revRecs = recs.filter((r) => r.role === 'review');
    assert.equal(revRecs.length, 1);
    assert.equal(revRecs[0].executor, 'agy');
    const pipeRec = recs.find((r) => r.kind === 'pipeline');
    assert.equal(pipeRec.reviewer_profile, 'agy-review');
    assert.equal(pipeRec.outcome, 'reviewed');
  });

  // AS-D6: Flash reviews another family's work but never its own, including
  // when the executor is named through the deprecated alias.
  for (const [label, route, reviewRoute, expectedReviewer] of [
    ['a flash executor', 'flash', 'flash-review,codex-review', 'codex-review'],
    ['a flash executor through the alias', 'deepseek-light', 'flash-review,agy-review', 'agy-review'],
  ]) {
    it(`pipeline with ${label} never selects flash-review`, () => {
      writeFileSync(
        join(seqDir, 'step_0.json'),
        JSON.stringify({ FAKE_COMMIT_FILE: 'feat.txt', FAKE_EXIT: '0' }),
      );
      const reviewOutput = 'Reviewed.\nTOTAL major=0 medium=0 minor=0\n';
      writeFileSync(
        join(seqDir, 'step_1.json'),
        JSON.stringify({ FAKE_STDOUT: reviewOutput, FAKE_LAST_MESSAGE: reviewOutput }),
      );

      const res = runDelegate(
        [
          'pipeline',
          '--id', 'T-PIPE-FLASH-SELF',
          '--task', 'flash never reviews flash',
          '--role', 'implement',
          '--cwd', repoDir,
          '--card', cardPath,
          '--route', route,
          '--gate', 'true',
          '--review-card', reviewCardPath,
          '--review-route', reviewRoute,
          '--out', outDir,
          '--confirmed',
        ],
        { ...baseEnv, FAKE_SEQ_DIR: seqDir },
      );

      assert.equal(res.status, 0, res.stderr);
      const recs = readLogRecords(atomicHome);
      const revRecs = recs.filter((r) => r.role === 'review');
      assert.equal(revRecs.length, 1);
      assert.equal(revRecs[0].family, expectedReviewer === 'codex-review' ? 'openai' : 'gemini');
      const pipeRec = recs.find((r) => r.kind === 'pipeline');
      assert.equal(pipeRec.reviewer_profile, expectedReviewer);
      assert.equal(pipeRec.outcome, 'reviewed');
    });
  }

  // AS-D6 default reviewer routes when the executor is another family.
  for (const [label, route, reviewRoute, expectedReviewer, expectedExecutor] of [
    ['codex work prefers flash-review', 'codex', 'flash-review,agy-review', 'flash-review', 'opencode'],
    ['agy work prefers codex-review', 'agy', 'codex-review,flash-review', 'codex-review', 'codex'],
  ]) {
    it(`pipeline with ${label}`, () => {
      writeFileSync(
        join(seqDir, 'step_0.json'),
        JSON.stringify({ FAKE_COMMIT_FILE: 'feat.txt', FAKE_EXIT: '0' }),
      );
      const reviewOutput = 'Reviewed.\nTOTAL major=0 medium=0 minor=0\n';
      writeFileSync(
        join(seqDir, 'step_1.json'),
        JSON.stringify({ FAKE_STDOUT: reviewOutput, FAKE_LAST_MESSAGE: reviewOutput }),
      );

      const res = runDelegate(
        [
          'pipeline',
          '--id', 'T-PIPE-DEFAULT-REV',
          '--task', label,
          '--role', 'implement',
          '--cwd', repoDir,
          '--card', cardPath,
          '--route', route,
          '--gate', 'true',
          '--review-card', reviewCardPath,
          '--review-route', reviewRoute,
          '--out', outDir,
          '--confirmed',
        ],
        { ...baseEnv, FAKE_SEQ_DIR: seqDir },
      );

      assert.equal(res.status, 0, res.stderr);
      const recs = readLogRecords(atomicHome);
      const revRecs = recs.filter((r) => r.role === 'review');
      assert.equal(revRecs.length, 1);
      assert.equal(revRecs[0].executor, expectedExecutor);
      const pipeRec = recs.find((r) => r.kind === 'pipeline');
      assert.equal(pipeRec.reviewer_profile, expectedReviewer);
      assert.equal(pipeRec.outcome, 'reviewed');
    });
  }

  // AS-D6 reversed AS-D5-F1: a review route that names `flash` resolves to
  // `flash-review` and runs when the executor family differs.
  it('pipeline review route "flash" resolves to flash-review for a codex executor', () => {
    writeFileSync(
      join(seqDir, 'step_0.json'),
      JSON.stringify({ FAKE_COMMIT_FILE: 'feat.txt', FAKE_EXIT: '0' }),
    );
    const reviewOutput = 'Checked.\nTOTAL major=0 medium=0 minor=0\n';
    writeFileSync(
      join(seqDir, 'step_1.json'),
      JSON.stringify({ FAKE_STDOUT: reviewOutput, FAKE_LAST_MESSAGE: reviewOutput }),
    );

    const res = runDelegate(
      [
        'pipeline',
        '--id', 'T-PIPE-FLASH-REVIEW-ROUTE',
        '--task', 'flash resolves to flash-review',
        '--role', 'implement',
        '--cwd', repoDir,
        '--card', cardPath,
        '--route', 'codex',
        '--gate', 'true',
        '--review-card', reviewCardPath,
        '--review-route', 'flash',
        '--out', outDir,
        '--confirmed',
      ],
      { ...baseEnv, FAKE_SEQ_DIR: seqDir },
    );

    assert.equal(res.status, 0, res.stderr);
    const recs = readLogRecords(atomicHome);
    const revRecs = recs.filter((r) => r.role === 'review');
    assert.equal(revRecs.length, 1);
    assert.equal(revRecs[0].executor, 'opencode');
    assert.equal(revRecs[0].model, 'opencode-go/deepseek-v4.1-flash');
    assert.equal(revRecs[0].family, 'deepseek');
    const pipeRec = recs.find((r) => r.kind === 'pipeline');
    assert.equal(pipeRec.reviewer_profile, 'flash-review');
    assert.equal(pipeRec.outcome, 'reviewed');
  });

  it('pipeline skips reviewer with empty output and tries next', () => {
    writeFileSync(
      join(seqDir, 'step_0.json'),
      JSON.stringify({ FAKE_COMMIT_FILE: 'feat.txt', FAKE_EXIT: '0' }),
    );
    // First reviewer agy-review returns empty output
    writeFileSync(
      join(seqDir, 'step_1.json'),
      JSON.stringify({ FAKE_STDOUT: '', FAKE_LAST_MESSAGE: '' }),
    );
    // Second reviewer codex-review returns valid review
    const reviewOutput = 'Checked.\nTOTAL major=0 medium=1 minor=0\n';
    writeFileSync(
      join(seqDir, 'step_2.json'),
      JSON.stringify({ FAKE_STDOUT: reviewOutput, FAKE_LAST_MESSAGE: reviewOutput }),
    );

    const res = runDelegate(
      [
        'pipeline',
        '--id', 'T-PIPE-EMPTY-REV',
        '--task', 'empty reviewer skip',
        '--role', 'implement',
        '--cwd', repoDir,
        '--card', cardPath,
        '--route', 'flash',
        '--gate', 'true',
        '--review-card', reviewCardPath,
        '--review-route', 'agy-review,codex-review',
        '--out', outDir,
        '--confirmed',
      ],
      { ...baseEnv, FAKE_SEQ_DIR: seqDir },
    );

    assert.equal(res.status, 0, res.stderr);
    const recs = readLogRecords(atomicHome);
    const revRecs = recs.filter((r) => r.role === 'review');
    assert.equal(revRecs.length, 2);
    assert.equal(revRecs[0].failure, 'empty_output');
    assert.equal(revRecs[1].failure, 'none');
    const pipeRec = recs.find((r) => r.kind === 'pipeline');
    assert.equal(pipeRec.reviewer_profile, 'codex-review');
    assert.equal(pipeRec.outcome, 'reviewed');
  });

  it('pipeline ends with no_reviewer when no reviewer delivers', () => {
    writeFileSync(
      join(seqDir, 'step_0.json'),
      JSON.stringify({ FAKE_COMMIT_FILE: 'feat.txt', FAKE_EXIT: '0' }),
    );
    writeFileSync(
      join(seqDir, 'step_1.json'),
      JSON.stringify({ FAKE_STDOUT: '', FAKE_LAST_MESSAGE: '' }),
    );

    const res = runDelegate(
      [
        'pipeline',
        '--id', 'T-PIPE-NO-REV',
        '--task', 'reviewer skip test',
        '--role', 'implement',
        '--cwd', repoDir,
        '--card', cardPath,
        '--route', 'flash',
        '--gate', 'true',
        '--review-card', reviewCardPath,
        '--review-route', 'agy-review',
        '--out', outDir,
        '--confirmed',
      ],
      { ...baseEnv, FAKE_SEQ_DIR: seqDir },
    );

    assert.notEqual(res.status, 0);
    const recs = readLogRecords(atomicHome);
    const pipeRec = recs.find((r) => r.kind === 'pipeline');
    assert.ok(pipeRec);
    assert.equal(pipeRec.outcome, 'no_reviewer');
  });

  it('pipeline replaces {{DIFF_RANGE}} in the reviewer card', () => {
    writeFileSync(
      join(seqDir, 'step_0.json'),
      JSON.stringify({ FAKE_COMMIT_FILE: 'diff_test.txt', FAKE_EXIT: '0' }),
    );
    const reviewOutput = 'TOTAL major=0 medium=0 minor=0\n';
    writeFileSync(
      join(seqDir, 'step_1.json'),
      JSON.stringify({ FAKE_STDOUT: reviewOutput, FAKE_LAST_MESSAGE: reviewOutput }),
    );

    const res = runDelegate(
      [
        'pipeline',
        '--id', 'T-PIPE-DIFF-RANGE',
        '--task', 'diff range test',
        '--role', 'implement',
        '--cwd', repoDir,
        '--card', cardPath,
        '--route', 'flash',
        '--gate', 'true',
        '--review-card', reviewCardPath,
        '--review-route', 'codex-review',
        '--out', outDir,
        '--confirmed',
      ],
      { ...baseEnv, FAKE_SEQ_DIR: seqDir },
    );

    assert.equal(res.status, 0, res.stderr);
    const revStdin = readFileSync(join(seqDir, 'stdin_1.txt'), 'utf8');
    assert.doesNotMatch(revStdin, /\{\{DIFF_RANGE\}\}/);
    assert.match(revStdin, /[0-9a-f]{40}\.\.\.HEAD/);
  });

  it('pipeline between steps stops with outcome paused when pause file is created', () => {
    writeFileSync(
      join(seqDir, 'step_0.json'),
      JSON.stringify({ FAKE_COMMIT_FILE: 'feat.txt', FAKE_EXIT: '0' }),
    );

    const res = runDelegate(
      [
        'pipeline',
        '--id', 'T-PIPE-MID-PAUSE',
        '--task', 'mid pause test',
        '--role', 'implement',
        '--cwd', repoDir,
        '--card', cardPath,
        '--route', 'flash',
        '--gate', `'${PYTHON3}' '${DELEGATE_PY}' pause --reason "mid-gate stop"`,
        '--review-card', reviewCardPath,
        '--review-route', 'codex-review',
        '--out', outDir,
        '--confirmed',
      ],
      { ...baseEnv, FAKE_SEQ_DIR: seqDir },
    );

    assert.equal(res.status, 3);
    assert.match(res.stderr, /delegate: paused/);
    const recs = readLogRecords(atomicHome);
    const pipeRec = recs.find((r) => r.kind === 'pipeline');
    assert.ok(pipeRec);
    assert.equal(pipeRec.outcome, 'paused');
  });

  it('pause makes run and pipeline exit 3 and launch nothing; resume restores', () => {
    const pauseRes = runDelegate(['pause', '--reason', 'scheduled maintenance'], baseEnv);
    assert.equal(pauseRes.status, 0);
    const pauseFile = join(atomicHome, 'delegate', 'PAUSED');
    assert.equal(readFileSync(pauseFile, 'utf8').trim(), 'scheduled maintenance');

    const runRes = runDelegate(
      [
        'run',
        '--id', 'T-PAUSED-RUN',
        '--task', 'run during pause',
        '--role', 'implement',
        '--profile', 'flash',
        '--cwd', repoDir,
        '--card', cardPath,
        '--out', outDir,
        '--confirmed',
      ],
      baseEnv,
    );
    assert.equal(runRes.status, 3);
    assert.match(runRes.stderr, /delegate: paused/);

    const pipeRes = runDelegate(
      [
        'pipeline',
        '--id', 'T-PAUSED-PIPE',
        '--task', 'pipeline during pause',
        '--role', 'implement',
        '--cwd', repoDir,
        '--card', cardPath,
        '--route', 'flash',
        '--gate', 'true',
        '--review-card', reviewCardPath,
        '--review-route', 'codex-review',
        '--out', outDir,
        '--confirmed',
      ],
      baseEnv,
    );
    assert.equal(pipeRes.status, 3);
    assert.match(pipeRes.stderr, /delegate: paused/);

    const resumeRes = runDelegate(['resume'], baseEnv);
    assert.equal(resumeRes.status, 0);
    assert.throws(() => readFileSync(pauseFile), { code: 'ENOENT' });

    const okRes = runDelegate(
      [
        'run',
        '--id', 'T-RESUMED-RUN',
        '--task', 'run after resume',
        '--role', 'implement',
        '--profile', 'flash',
        '--cwd', repoDir,
        '--card', cardPath,
        '--out', outDir,
        '--confirmed',
      ],
      baseEnv,
    );
    assert.equal(okRes.status, 0);
  });

  it('report includes line per (executor_profile, reviewer_profile) pair of pipeline records', () => {
    const logDir = join(atomicHome, 'delegate');
    mkdirSync(logDir, { recursive: true });
    const pipeRec1 = {
      kind: 'pipeline',
      id: 'P-1',
      project: 'demo',
      outcome: 'reviewed',
      executor_profile: 'flash',
      reviewer_profile: 'codex-review',
      gate_exit: 0,
      auto_committed: false,
      findings: { major: 0, medium: 1, minor: 0 },
      duration_s: 30,
    };
    const pipeRec2 = {
      kind: 'pipeline',
      id: 'P-2',
      project: 'demo',
      outcome: 'gate_failed',
      executor_profile: 'flash',
      reviewer_profile: 'codex-review',
      gate_exit: 1,
      auto_committed: false,
      findings: { major: 0, medium: 0, minor: 0 },
      duration_s: 15,
    };
    writeFileSync(
      join(logDir, 'runs.jsonl'),
      [JSON.stringify(pipeRec1), JSON.stringify(pipeRec2)].join('\n') + '\n',
    );

    const res = runDelegate(['report'], baseEnv);
    assert.equal(res.status, 0, res.stderr);
    assert.match(res.stdout, /flash.*codex-review/);
    assert.match(res.stdout, /reviewed.*1/);
    assert.match(res.stdout, /gate_failed.*1/);
  });

  it('R3 summary omits missing output path still present in record', () => {
    const res = pythonHarness(`
original_run = d.execute_run
def run(*args, **kwargs):
 rec = original_run(*args, **kwargs)
 pathlib.Path(rec['stdout']).unlink()
 return rec
d.execute_run = run
sys.argv = ['delegate', *json.loads(os.environ['PIPE_ARGS'])]
try: d.main()
except SystemExit as exc: assert exc.code == 1
`, {...baseEnv, FAKE_EXIT:'1', FAKE_STDERR:'quota', PIPE_ARGS:JSON.stringify(pipelineArgs())});
    assert.equal(res.status, 0, res.stderr);
    const rec = readLogRecords(atomicHome).at(-1).attempts[0];
    assert.ok(rec.stdout);
    assert.ok(!summary().includes(rec.stdout), 'missing file printed');
    assert.ok(summary().includes(rec.stderr), 'existing file omitted');
  });

  it('R2 R04 gate timeout reports duration reason and log tail', () => {
    const res = runDelegate(pipelineArgs(['--gate', 'echo SENTINEL_GATE_OUTPUT; sleep 5', '--timeout', '1']),
      steps([{ FAKE_COMMIT_FILE: 'feature' }]));
    assert.equal(res.status, 1, res.stderr);
    assert.match(summary(), /gate timed out/);
    assert.match(summary(), /Gate log tail:\nSENTINEL_GATE_OUTPUT/);
    const rec = readLogRecords(atomicHome).at(-1);
    assert.equal(rec.gate_timed_out, true);
    assert.ok(summary().includes(`exit ${rec.gate_exit}`), 'gate exit code missing');
    assert.ok(rec.gate_duration_s >= 1);
  });
  it('R2 R05 long route keeps winning executor and reviewer outputs', () => {
    const res = runDelegate(pipelineArgs(['--route', [...Array(35).fill('flash'), 'codex'].join(','), '--review-route', 'agy-review']),
      steps([...Array.from({length:35}, () => ({FAKE_EXIT:1, FAKE_STDERR:'quota'})),
        {FAKE_COMMIT_FILE:'feature'}, {FAKE_STDOUT:'TOTAL major=0 medium=0 minor=0'}]));
    assert.equal(res.status, 0, res.stderr);
    const runs = readLogRecords(atomicHome).filter(r => r.kind === 'run');
    for (const r of runs.slice(-2)) assert.ok(summary().includes(r.stdout), r.profile);
    assert.ok(summary().trimEnd().split('\n').length < 60);
  });
  it('R2 R05 summary links only files written by this invocation', () => {
    mkdirSync(outDir, {recursive:true});
    const oldGate = join(outDir, 'R1.gate.log');
    writeFileSync(oldGate, 'OLD_RUN_GATE_FAILURE');
    const res = runDelegate(pipelineArgs(), { ...baseEnv, FAKE_EXIT:'1', FAKE_STDERR:'quota' });
    assert.equal(res.status, 1);
    assert.ok(!summary().includes(oldGate));
    assert.doesNotMatch(summary(), /commit\.log/);
  });
  for (const mode of ['slot', 'paused', 'interrupt']) {
    it(`R2 R06 ${mode} has actionable summary and record`, () => {
      let res;
      if (mode === 'interrupt') {
        res = pythonHarness(`
def interrupted(*args, **kwargs): raise KeyboardInterrupt()
d.execute_run = interrupted
sys.argv = ['delegate', *json.loads(os.environ['PIPE_ARGS'])]
try: d.main()
except SystemExit as exc: assert exc.code == 1
`, { PIPE_ARGS:JSON.stringify(pipelineArgs()) });
        assert.equal(res.status, 0, res.stderr);
      } else {
        if (mode === 'paused') runDelegate(['pause'], baseEnv);
        res = runDelegate(pipelineArgs(['--wait', '0']), {...baseEnv, DELEGATE_MAX_OPENCODE:'0'});
        assert.equal(res.status, mode === 'paused' ? 3 : 1);
      }
      const reason = mode === 'slot' ? /slot_timeout/ : mode === 'paused' ? /paused/ : /interrupted/;
      const rec = readLogRecords(atomicHome).at(-1);
      assert.match(rec.error, reason);
      if (mode !== 'paused') assert.match(rec.attempts[0].failure, reason);
      if (mode === 'paused') assert.equal((res.stderr.match(/delegate: paused/g) || []).length, 1);
      if (mode !== 'slot') assert.doesNotMatch(summary(), /stdout:|stderr:/);
      if (mode === 'interrupt') {
        assert.equal(rec.attempts[0].stdout, null);
        assert.equal(rec.attempts[0].stderr, null);
      }
    });
  }
  it('R2 R07 fix round asks only outside the approved route', () => {
    const skill = readFileSync(join(REPO_ROOT, 'skills/core/delegate.md'), 'utf8');
    const line = skill.split('\n').find(l => l.startsWith('5. **Fix round.**'));
    assert.match(line, /new yes only.*outside the approved route/);
  });

  it('D4 R02 R06 preserves every attempt output and links Codex final message and commit', () => {
    const res = runDelegate(pipelineArgs(['--route', 'flash,agy']), steps([
      { FAKE_EXIT: 1, FAKE_STDERR: 'quota; try again at 12:44 PM', FAKE_STDOUT: 'quota attempt' },
      { FAKE_COMMIT_FILE: 'feature', FAKE_STDOUT: 'executor output' },
      { FAKE_STDOUT: 'review transport', FAKE_LAST_MESSAGE: 'TOTAL major=0 medium=0 minor=0' },
    ]));
    assert.equal(res.status, 0, res.stderr);
    const runs = readLogRecords(atomicHome).filter(r => r.kind === 'run');
    assert.equal(new Set(runs.map(r => r.stdout)).size, 3);
    for (const r of runs) {
      assert.match(summary(), new RegExp(r.stdout.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
      assert.ok(summary().includes(r.stderr));
      if (r.last_message) assert.ok(summary().includes(r.last_message));
    }
    assert.equal(readFileSync(runs[0].stdout, 'utf8'), 'quota attempt');
    assert.match(readFileSync(runs[1].stdout, 'utf8'), /^executor output/);
    assert.match(summary(), /commit:/);
    assert.match(summary(), /provider_limit/);
  });
  it('D4 R04 canonicalizes the executor alias before the reviewer family check', () => {
    const res = runDelegate(pipelineArgs(['--route', 'deepseek-light', '--review-route', 'agy-review']),
      steps([{ FAKE_COMMIT_FILE: 'feature' }, {}]));
    assert.equal(res.status, 0, res.stderr);
    const recs = readLogRecords(atomicHome);
    assert.equal(recs.find(r => r.kind === 'run' && r.role === 'implement').family, 'deepseek');
    assert.equal(recs.at(-1).reviewer_profile, 'agy-review');
  });
  it('D4 R04 validates the complete routes before launching', () => {
    const res = runDelegate(pipelineArgs(['--review-route', 'bogus']), steps([{ FAKE_COMMIT_FILE: 'feature' }]));
    assert.notEqual(res.status, 0);
    assert.throws(() => readFileSync(join(seqDir, 'count')), { code: 'ENOENT' });
  });
  it('D4 R05 keeps large reviews under 60 lines with explicit overflow path', () => {
    const text = Array.from({ length: 70 }, (_, i) => `R${i + 1} | minor | finding`).join('\n') + '\nTOTAL major=0 medium=0 minor=70';
    const res = runDelegate(pipelineArgs(), steps([{ FAKE_COMMIT_FILE: 'feature' }, { FAKE_LAST_MESSAGE: text }]));
    assert.equal(res.status, 0, res.stderr);
    assert.ok(summary().trimEnd().split('\n').length < 60);
    assert.match(summary(), /omitted.*full review/i);
    assert.match(summary(), /TOTAL major=0 medium=0 minor=70/);
  });
  it('D4 R05 R06 long routes preserve gate command and full attempt manifest', () => {
    const res = runDelegate(pipelineArgs(['--route', Array(40).fill('flash').join(','), '--gate', 'printf gate-sentinel']),
      { ...baseEnv, FAKE_EXIT: '1', FAKE_STDERR: 'quota' });
    assert.notEqual(res.status, 0);
    assert.ok(summary().trimEnd().split('\n').length < 60);
    assert.match(summary(), /printf gate-sentinel/);
    assert.match(summary(), /additional steps omitted; full step outputs:/);
    const pipeRec = readLogRecords(atomicHome).at(-1);
    assert.equal(pipeRec.attempts.length, 40);
    for (const rec of pipeRec.attempts) assert.ok(readFileSync(rec.stderr, 'utf8').includes('quota'));
  });
  it('D4 R06 no_executor summary includes every quota attempt', () => {
    const res = runDelegate(pipelineArgs(['--route', 'flash,agy']), steps([
      { FAKE_EXIT: 1, FAKE_STDERR: 'quota' }, { FAKE_EXIT: 1, FAKE_STDERR: 'quota' },
    ]));
    assert.notEqual(res.status, 0);
    for (const r of readLogRecords(atomicHome).filter(r => r.kind === 'run')) assert.ok(summary().includes(r.stderr));
  });
  it('D4 R10 pause while waiting for reviewer writes summary and pipeline record', () => {
    const res = pythonHarness(`
d.RUNNING.mkdir(parents=True)
slot = d.RUNNING / ('codex-held-%s.json' % os.getpid())
slot.write_text(json.dumps({'pid': os.getpid(), 'pgid':os.getpgrp(), 'process_start':d.process_identity(os.getpid())}))
runner = subprocess.Popen([sys.executable, ${JSON.stringify(DELEGATE_PY)}, *json.loads(os.environ['PIPE_ARGS'])], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
try:
 deadline = time.time() + 20
 while not pathlib.Path(${JSON.stringify(join(outDir, 'R1.gate.log'))}).exists() and time.time() < deadline: time.sleep(.01)
 assert pathlib.Path(${JSON.stringify(join(outDir, 'R1.gate.log'))}).exists()
 d.PAUSED.touch()
 stdout, stderr = runner.communicate(timeout=30)
 assert runner.returncode == 3, stderr
 assert pathlib.Path(${JSON.stringify(join(outDir, 'R1.summary.md'))}).exists(), 'missing summary'
 assert json.loads(d.LOG.read_text().splitlines()[-1])['outcome'] == 'paused'
finally:
 if runner.poll() is None: runner.kill(); runner.wait()
`, { ...steps([{ FAKE_COMMIT_FILE: 'feature' }]), PIPE_ARGS: JSON.stringify(pipelineArgs(['--wait', '3'])) });
    assert.equal(res.status, 0, res.stderr);
  });
  it('D4 R11 pause at executor completion prevents auto commit', () => {
    // Fake touches PAUSED after editing, before its exit.
    const res = runDelegate(pipelineArgs(), steps([{ FAKE_TOUCH_FILE: 'feature', FAKE_PAUSE: '1' }]));
    assert.equal(res.status, 3, res.stderr);
    assert.equal(readLogRecords(atomicHome).at(-1).auto_committed, false);
    assert.equal(git(repoDir, 'rev-list', '--count', 'HEAD'), '1');
  });
  it('D4 R14 report accepts real pipeline pairs with null profiles', () => {
    const logDir = join(atomicHome, 'delegate'); mkdirSync(logDir, { recursive: true });
    writeFileSync(join(logDir, 'runs.jsonl'), [
      ['flash', 'codex-review', 'reviewed'], ['flash', null, 'gate_failed'], [null, null, 'no_executor'],
    ].map(([executor_profile, reviewer_profile, outcome]) => JSON.stringify({ kind: 'pipeline', executor_profile, reviewer_profile, outcome })).join('\n'));
    const res = runDelegate(['report'], baseEnv);
    assert.equal(res.status, 0, res.stderr); assert.match(res.stdout, /gate_failed 1/);
  });
});
