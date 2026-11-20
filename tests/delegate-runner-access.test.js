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
  it('D9 R01 refuses an argv prompt above the Linux per-argument limit before launch', () => {
    writeFileSync(cardPath, 'a'.repeat(140000));
    const res = runDelegate([
      'run', '--id', 'T-ARGMAX', '--task', 'arg limit', '--role', 'implement',
      '--profile', 'flash', '--cwd', repoDir, '--card', cardPath,
      '--out', outDir, '--confirmed',
    ], baseEnv);
    assert.equal(res.status, 1, res.stderr);
    const [rec] = readLogRecords(atomicHome);
    assert.equal(rec.failure, 'input_too_large');
    assert.ok(rec.prompt_bytes > 131072);
    assert.throws(() => readFileSync(argvFile), { code: 'ENOENT' });
  });
  it('D9 R01/R08 keeps the review name for an OpenCode review above the argv limit', () => {
    const range = reviewRange();
    writeFileSync(reviewCardPath, 'b'.repeat(140000));
    const res = runDelegate(reviewArgs(['--diff-range', range], 'flash-review'), baseEnv);
    assert.equal(res.status, 1, res.stderr);
    assert.equal(readLogRecords(atomicHome)[0].failure, 'review_input_too_large');
    assert.throws(() => readFileSync(argvFile), { code: 'ENOENT' });
  });
  it('D9 R05 sends an Antigravity prompt above the argv limit on stdin', () => {
    const range = reviewRange();
    writeFileSync(reviewCardPath, 'd'.repeat(140000));
    const res = runDelegate(reviewArgs(['--diff-range', range], 'agy-review'), baseEnv);
    assert.equal(res.status, 0, res.stderr);
    const [rec] = readLogRecords(atomicHome);
    assert.equal(rec.failure, 'none');
    assert.ok(rec.prompt_bytes > 131072);
    const argv = JSON.parse(readFileSync(argvFile, 'utf8'));
    assert.equal(readFileSync(stdinFile, 'utf8'), readFileSync(rec.prompt, 'utf8'));
    assert.ok(!argv.includes(readFileSync(rec.prompt, 'utf8')));
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
      '--model', 'gpt-6.1-sol',
      '-c', 'model_reasoning_effort=medium',
      '--sandbox', 'workspace-write',
      '--skip-git-repo-check',
      '--ephemeral',
      '-C', repoDir,
      '-c', 'sandbox_workspace_write.network_access=true',
      '--add-dir', join(repoDir, '.git'),
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
    assert.equal(rec.access.network, true);
    assert.equal(rec.access.git_write, true);
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

  it('adds --add-dir with the resolved git common dir in a plain repo and a linked worktree', () => {
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
      '-c', 'sandbox_workspace_write.network_access=true',
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
    assert.equal(plainArgv[plainArgv.indexOf('--add-dir') + 1], join(repoDir, '.git'));
  });

  it('D9 access policy records network, git write, readable dirs, and limits per role', () => {
    const impl = runDelegate([
      'run', '--id', 'T-ACCESS-IMPL', '--task', 'access impl', '--role', 'implement',
      '--profile', 'flash', '--cwd', repoDir, '--card', cardPath, '--out', outDir, '--confirmed',
    ], baseEnv);
    assert.equal(impl.status, 0, impl.stderr);
    const implRec = readLogRecords(atomicHome).at(-1);
    assert.equal(implRec.access.mode, 'policy');
    assert.equal(implRec.access.network, true);
    assert.equal(implRec.access.git_write, true);
    assert.ok(implRec.access.extra_read.includes(join(repoDir, '.git')), JSON.stringify(implRec.access));
    assert.ok(implRec.access.extra_read.includes(join(atomicHome, 'delegate', 'cards')));
    assert.ok(implRec.access.extra_read.includes(outDir));
    assert.ok(implRec.access.limits.some(limit => /host user's filesystem/.test(limit)));

    const review = runDelegate(reviewArgs(['--diff-range', reviewRange()], 'codex-review'), baseEnv);
    assert.equal(review.status, 0, review.stderr);
    const reviewRec = readLogRecords(atomicHome).at(-1);
    assert.equal(reviewRec.access.network, false);
    assert.equal(reviewRec.access.git_write, false);
    assert.ok(reviewRec.access.limits.some(limit => /read-only sandbox cannot enable network/.test(limit)));
  });

  it('D9 R01/R04 scopes OpenCode edit rules and uses the verified permissions shape', () => {
    const res = pythonHarness(`
import json
impl = d.access_policy('opencode', 'implement', ${JSON.stringify(repoDir)}, ${JSON.stringify(outDir)})
rev = d.access_policy('opencode', 'review', ${JSON.stringify(repoDir)}, ${JSON.stringify(outDir)})
def dump(policy):
    return {'rules': json.loads(policy['env']['OPENCODE_CONFIG_CONTENT'])['permissions'],
            'access': policy['access']}
print(json.dumps({'impl': dump(impl), 'rev': dump(rev)}))
`);
    assert.equal(res.status, 0, res.stderr);
    const parsed = JSON.parse(res.stdout.trim().split('\n').at(-1));
    for (const rules of [parsed.impl.rules, parsed.rev.rules]) {
      assert.ok(rules.every(rule => typeof rule.action === 'string' &&
        typeof rule.resource === 'string' && ['allow', 'deny', 'ask'].includes(rule.effect)));
    }
    const common = join(repoDir, '.git');
    const implEdits = parsed.impl.rules
      .filter(rule => rule.action === 'edit' && rule.effect === 'allow').map(rule => rule.resource);
    assert.ok(implEdits.includes('*'), JSON.stringify(implEdits));
    assert.ok(implEdits.includes(`${common}/*`), JSON.stringify(implEdits));
    const implEditDenies = parsed.impl.rules
      .filter(rule => rule.action === 'edit' && rule.effect === 'deny').map(rule => rule.resource);
    assert.ok(implEditDenies.includes('*'), JSON.stringify(implEditDenies));
    assert.ok(implEditDenies.includes('../*'), JSON.stringify(implEditDenies));
    assert.ok(implEditDenies.includes(`${join(atomicHome, 'delegate', 'cards')}/*`),
      JSON.stringify(implEditDenies));
    assert.ok(implEditDenies.includes(`${outDir}/*`), JSON.stringify(implEditDenies));
    const externalAllows = parsed.impl.rules
      .filter(rule => rule.action === 'external_directory' && rule.effect === 'allow')
      .map(rule => rule.resource);
    assert.ok(!externalAllows.includes('*'), JSON.stringify(externalAllows));
    assert.ok(externalAllows.includes(`${common}/*`), JSON.stringify(externalAllows));

    assert.ok(parsed.rev.rules.some(rule => rule.action === 'edit' &&
      rule.resource === '*' && rule.effect === 'deny'));
    assert.equal(parsed.rev.rules.filter(rule => rule.action === 'edit' && rule.effect === 'allow').length, 0);
    assert.ok(parsed.rev.rules.some(rule => rule.action === 'shell' &&
      rule.resource === '*' && rule.effect === 'allow'));
    assert.equal(parsed.rev.access.git_write, true);
    assert.ok(parsed.rev.access.limits.some(limit =>
      /reviewer can still write through the shell; only the edit tool is denied/.test(limit)));
  });

  it('D9 R07 validates the resolved git common dir and follows a symlinked git directory', () => {
    const link = join(root, 'git-link');
    const res = pythonHarness(`
os.symlink(${JSON.stringify(join(repoDir, '.git'))}, ${JSON.stringify(link)})
os.environ['GIT_DIR'] = ${JSON.stringify(link)}
os.environ['GIT_WORK_TREE'] = ${JSON.stringify(repoDir)}
print(d.git_common_dir(${JSON.stringify(repoDir)}))
`);
    assert.equal(res.status, 0, res.stderr);
    assert.equal(res.stdout.trim().split('\n').at(-1), realpathSync(join(repoDir, '.git')));
  });

  it('D9 R07 refuses a git common dir without HEAD and objects before any run', () => {
    const bad = join(root, 'bad-git');
    mkdirSync(bad);
    const res = pythonHarness(`
bad = ${JSON.stringify(bad)}
real_git = d.git
def fake_git(cwd, *args):
    if args and args[0] == 'rev-parse' and '--git-common-dir' in args:
        return bad
    return real_git(cwd, *args)
d.git = fake_git
try:
    d.execute_run('bad', 'bad', 'implement', profile='flash',
                  cwd=${JSON.stringify(repoDir)}, card=${JSON.stringify(cardPath)},
                  out=${JSON.stringify(outDir)}, confirmed=True)
    raise AssertionError('run was not refused')
except SystemExit as exc:
    assert exc.code == 2, exc.code
`);
    assert.equal(res.status, 0, res.stderr);
    assert.match(res.stderr, /git common directory.*HEAD.*objects/);
    assert.throws(() => readLogRecords(atomicHome), { code: 'ENOENT' });
  });

  it('D9 agy review keeps read access to cards and git but denies writes in settings', () => {
    const res = runDelegate(reviewArgs(['--diff-range', reviewRange()], 'agy-review'), baseEnv);
    assert.equal(res.status, 0, res.stderr);
    const rec = readLogRecords(atomicHome).at(-1);
    assert.equal(rec.access.network, true);
    assert.equal(rec.access.git_write, false);
    const argv = JSON.parse(readFileSync(argvFile, 'utf8'));
    const settings = JSON.parse(argv[argv.indexOf('--settings') + 1]);
    for (const path of [repoDir, join(repoDir, '.git'), join(atomicHome, 'delegate', 'cards'), outDir]) {
      assert.ok(settings.permissions.deny.includes(`write_file(${path})`), path);
      assert.ok(settings.permissions.allow.includes(`read_file(${path})`), path);
    }
    for (const command of ['git diff', 'git log', 'git show', 'git status', 'git rev-parse']) {
      assert.ok(settings.permissions.allow.includes(`command(${command})`), command);
    }
    assert.ok(!settings.permissions.allow.includes('command(git)'));
    assert.ok(rec.access.limits.some(limit => /read-write/.test(limit)));
  });

  it('OpenCode default policy denies websearch and keeps webfetch, and says so in limits', () => {
    const res = pythonHarness(`
out = {}
for role in ('implement', 'review'):
  out[role] = d.access_policy('opencode', role, ${JSON.stringify(repoDir)}, ${JSON.stringify(outDir)})
print(json.dumps(out))
`);
    assert.equal(res.status, 0, res.stderr);
    const parsed = JSON.parse(res.stdout.trim().split('\n').at(-1));
    for (const role of ['implement', 'review']) {
      const rules = JSON.parse(parsed[role].env.OPENCODE_CONFIG_CONTENT).permissions;
      const effects = action => rules.filter(rule => rule.action === action).map(rule => rule.effect);
      assert.deepEqual(effects('websearch'), ['deny'], role);
      assert.deepEqual(effects('webfetch'), ['allow'], role);
      assert.equal(parsed[role].access.network, true, role);
      assert.ok(parsed[role].access.limits.some(limit => /websearch is denied/.test(limit)), role);
    }
  });

  it('D9 git_common_dir resolves a plain checkout and a linked worktree', () => {
    const wtDir = join(root, 'wt-common');
    git(repoDir, 'worktree', 'add', '-b', 'feat/common', wtDir);
    const res = pythonHarness(`
print(json.dumps({"plain": d.git_common_dir(${JSON.stringify(repoDir)}),
                  "linked": d.git_common_dir(${JSON.stringify(wtDir)})}))
`);
    assert.equal(res.status, 0, res.stderr);
    const dirs = JSON.parse(res.stdout.trim().split('\n').at(-1));
    assert.equal(dirs.plain, realpathSync(join(repoDir, '.git')));
    assert.equal(dirs.linked, realpathSync(join(repoDir, '.git')));
  });

  it('D9 --access strict is a subset of the default role policy for every executor and role', () => {
    const res = pythonHarness(`
import json
out = {}
for executor in ('codex', 'opencode', 'agy'):
 for role in ('implement', 'review'):
  pol = d.access_policy(executor, role, ${JSON.stringify(repoDir)}, ${JSON.stringify(outDir)}, strict=False)
  strict = d.access_policy(executor, role, ${JSON.stringify(repoDir)}, ${JSON.stringify(outDir)}, strict=True)
  argv = d.build_argv(executor, d.FLASH_MODEL if executor == 'opencode' else 'm', role,
                      ${JSON.stringify(repoDir)}, 'CARD', 'LAST', strict)
  out[executor + '/' + role] = {'policy': pol, 'strict': strict, 'argv': argv}
print(json.dumps(out))
`);
    assert.equal(res.status, 0, res.stderr);
    const parsed = JSON.parse(res.stdout.trim().split('\n').at(-1));
    const common = join(repoDir, '.git');
    const cards = join(atomicHome, 'delegate', 'cards');

    for (const role of ['implement', 'review']) {
      const codex = parsed[`codex/${role}`];
      assert.equal(codex.strict.access.mode, 'strict');
      assert.equal(codex.strict.access.network, false, role);
      assert.equal(codex.strict.access.git_write, false, role);
      assert.deepEqual(codex.strict.access.extra_read, [], role);
      assert.deepEqual(codex.strict.argv, [], role);
      assert.ok(!codex.argv.includes('sandbox_workspace_write.network_access=true'), role);
      assert.ok(!codex.argv.includes('--add-dir'), role);
      assert.equal(codex.argv[codex.argv.indexOf('--sandbox') + 1],
        role === 'review' ? 'read-only' : 'workspace-write', role);
      assert.doesNotMatch(codex.strict.access.limits.join(' '), /factory sandbox/i);

      const opencode = parsed[`opencode/${role}`];
      assert.equal(opencode.strict.access.mode, 'strict');
      assert.ok(!opencode.argv.includes('--auto'), role);
      assert.ok(opencode.argv.includes('--standalone'), role);
      assert.equal(opencode.strict.access.extra_read.length, 0, role);
      assert.ok(opencode.strict.access.limits.some(limit => /no sandbox/.test(limit)), role);
      assert.doesNotMatch(opencode.strict.access.limits.join(' '), /factory sandbox/i);
      const rules = JSON.parse(opencode.strict.env.OPENCODE_CONFIG_CONTENT).permissions;
      assert.ok(rules.some(rule => rule.action === 'webfetch' && rule.resource === '*' && rule.effect === 'deny'), role);
      assert.ok(rules.some(rule => rule.action === 'websearch' && rule.resource === '*' && rule.effect === 'deny'), role);
      assert.ok(rules.some(rule => rule.action === 'external_directory' && rule.resource === '*' && rule.effect === 'deny'), role);
      assert.equal(rules.filter(rule => rule.action === 'external_directory' && rule.effect === 'allow').length, 0, role);
      const editAllows = rules.filter(rule => rule.action === 'edit' && rule.effect === 'allow').map(rule => rule.resource);
      assert.ok(!editAllows.includes(`${common}/*`), role);
      assert.ok(!editAllows.includes(`${cards}/*`), role);
      if (role === 'review') {
        assert.deepEqual(editAllows, [], role);
      } else {
        assert.deepEqual(editAllows, ['*'], role);
        const editDenies = rules.filter(rule => rule.action === 'edit' && rule.effect === 'deny')
          .map(rule => rule.resource);
        assert.ok(editDenies.includes('..'), role);
        assert.ok(editDenies.includes('../*'), role);
        assert.ok(editDenies.includes(`${cards}/*`), role);
        assert.ok(editDenies.includes(`${outDir}/*`), role);
      }

      const agy = parsed[`agy/${role}`];
      assert.equal(agy.strict.access.mode, 'strict');
      assert.equal(agy.strict.access.network, false, role);
      assert.equal(agy.strict.access.git_write, false, role);
      assert.ok(agy.argv.includes('--sandbox'), role);
      assert.ok(!agy.argv.includes('--add-dir'), role);
      const settings = JSON.parse(agy.argv[agy.argv.indexOf('--settings') + 1]);
      assert.ok(!settings.permissions.allow.includes('read_url(*)'), role);
      assert.ok(!settings.permissions.allow.includes(`read_file(${common})`), role);
      assert.ok(!settings.permissions.allow.includes(`write_file(${common})`), role);
      assert.equal(settings.allowNonWorkspaceAccess, role === 'review', role);
      assert.doesNotMatch(agy.strict.access.limits.join(' '), /factory sandbox/i);
      if (role === 'review') {
        assert.ok(settings.permissions.allow.includes(`read_file(${cards})`), role);
        assert.ok(settings.permissions.allow.includes(`read_file(${outDir})`), role);
        assert.ok(settings.permissions.allow.includes('read_file(' + repoDir + ')'));
        assert.ok(!settings.permissions.allow.includes('command(git)'));
        for (const command of ['git diff', 'git log', 'git show', 'git status', 'git rev-parse']) {
          assert.ok(settings.permissions.allow.includes(`command(${command})`), command);
        }
      } else {
        assert.deepEqual(agy.strict.access.extra_read, [], role);
        assert.equal(settings.allowNonWorkspaceAccess, false, role);
        assert.ok(settings.permissions.allow.includes(`write_file(${repoDir})`), role);
        assert.ok(settings.permissions.allow.includes('command(git)'), role);
      }
    }
  });

  it('D9 --access strict never uses an approval-bypass flag for any profile, role or access value', () => {
    const banned = ['--auto', '--dangerously-skip-permissions', 'danger-full-access',
      '--dangerously-bypass-approvals-and-sandbox', '--yolo'];
    const profiles = ['flash', 'flash-review', 'codex', 'codex-review', 'agy', 'agy-review'];
    const roles = ['implement', 'fix', 'review', 'mechanical', 'test'];
    const range = reviewRange();
    for (const access of ['policy', 'strict']) {
      for (const profile of profiles) {
        for (const role of roles) {
          const res = runDelegate([
            'run', '--id', `T-NOBYPASS-${access}-${profile}-${role}`, '--task', 'no bypass',
            '--role', role, '--profile', profile, '--cwd', repoDir,
            '--card', role === 'review' ? reviewCardPath : cardPath,
            ...(role === 'review' ? ['--diff-range', range] : []),
            '--out', outDir, '--access', access, '--confirmed',
          ], baseEnv);
          assert.equal(res.status, 0, `${access}/${profile}/${role}: ${res.stderr}`);
          const argv = JSON.parse(readFileSync(argvFile, 'utf8'));
          for (const flag of banned) {
            for (const arg of argv) {
              assert.ok(!String(arg).includes(flag), `${access}/${profile}/${role}: ${flag} in ${arg}`);
            }
          }
        }
      }
    }
  });

  it('D9 --access strict records real access per executor and never mentions a factory sandbox', () => {
    const cardText = readFileSync(cardPath, 'utf8');
    const run = (id, profile, role, extra = [], cwd = repoDir) => {
      const res = runDelegate([
        'run', '--id', id, '--task', 'strict', '--role', role, '--profile', profile,
        ...(role === 'review' ? ['--diff-range', reviewRange()] : []),
        '--cwd', cwd, '--card', role === 'review' ? reviewCardPath : cardPath,
        '--out', outDir, '--access', 'strict', '--confirmed', ...extra,
      ], baseEnv);
      assert.equal(res.status, 0, res.stderr);
      return JSON.parse(readFileSync(argvFile, 'utf8'));
    };
    const recFor = id => readLogRecords(atomicHome).find(record => record.id === id);

    assert.deepEqual(run('T-STRICT-OC', 'flash', 'implement'), [
      fakePaths.opencode, 'run', '--standalone', '--archived', '-m', 'opencode-go/deepseek-v4.1-flash', cardText,
    ]);
    let rec = recFor('T-STRICT-OC');
    assert.equal(rec.access.mode, 'strict');
    assert.equal(rec.access.network, true);
    assert.equal(rec.access.git_write, true);
    assert.match(rec.access.limits.join(' '), /no sandbox/);
    assert.match(rec.access.limits.join(' '), /webfetch.*websearch.*denied/);
    assert.doesNotMatch(rec.access.limits.join(' '), /factory sandbox/i);

    assert.deepEqual(run('T-STRICT-CODEX', 'codex', 'implement'), [
      fakePaths.codex, '-a', 'never', 'exec', '--model', 'gpt-6.1-sol',
      '-c', 'model_reasoning_effort=medium', '--sandbox', 'workspace-write',
      '--skip-git-repo-check', '--ephemeral', '-C', repoDir,
      '-o', join(outDir, 'T-STRICT-CODEX.last.md'), '-',
    ]);
    rec = recFor('T-STRICT-CODEX');
    assert.equal(rec.access.network, false);
    assert.equal(rec.access.git_write, false);
    assert.deepEqual(rec.access.extra_read, []);
    assert.match(rec.access.limits.join(' '), /no network.*no --add-dir/i);
    assert.doesNotMatch(rec.access.limits.join(' '), /factory sandbox/i);

    assert.deepEqual(run('T-STRICT-CODEX-R', 'codex-review', 'review'), [
      fakePaths.codex, '-a', 'never', 'exec', '--model', 'gpt-6.1-sol',
      '-c', 'model_reasoning_effort=high', '--sandbox', 'read-only',
      '--skip-git-repo-check', '--ephemeral', '-C', repoDir,
      '-o', join(outDir, 'T-STRICT-CODEX-R.last.md'), '-',
    ]);
    rec = recFor('T-STRICT-CODEX-R');
    assert.equal(rec.access.network, false);
    assert.equal(rec.access.git_write, false);

    const wtDir = join(root, 'wt-strict');
    git(repoDir, 'worktree', 'add', '-b', 'feat/strict', wtDir);
    const linkedArgv = run('T-STRICT-CODEX-WT', 'codex', 'implement', [], wtDir);
    assert.ok(!linkedArgv.includes('--add-dir'), linkedArgv.join(' '));
    assert.ok(!linkedArgv.includes('sandbox_workspace_write.network_access=true'), linkedArgv.join(' '));
    rec = recFor('T-STRICT-CODEX-WT');
    assert.equal(rec.access.network, false);
    assert.equal(rec.access.git_write, false);

    const agyArgv = run('T-STRICT-AGY', 'agy', 'implement');
    assert.deepEqual(agyArgv.slice(0, 5), [
      fakePaths.agy, '--model', 'gemini-4-hydrogen-high', '--output-format', 'text',
    ]);
    // agy 1.5.13 takes the next argument as the value of -p; the prompt goes on stdin.
    assert.ok(!agyArgv.includes('-p') && !agyArgv.includes('--print'), agyArgv.join(' '));
    assert.ok(agyArgv.includes('--sandbox'));
    assert.ok(!agyArgv.includes('--add-dir'));
    assert.ok(!agyArgv.includes('--dangerously-skip-permissions'));
    const settings = JSON.parse(agyArgv[agyArgv.indexOf('--settings') + 1]);
    assert.ok(!settings.permissions.allow.includes('read_url(*)'));
    assert.equal(settings.allowNonWorkspaceAccess, false);
    assert.equal(readFileSync(stdinFile, 'utf8'), cardText);
    rec = recFor('T-STRICT-AGY');
    assert.equal(rec.access.network, false);
    assert.equal(rec.access.git_write, false);
    assert.deepEqual(rec.access.extra_read, []);
    assert.doesNotMatch(rec.access.limits.join(' '), /factory sandbox/i);
  });

  it('D9 default policy never uses a bypass-sandbox flag', () => {
    const banned = ['--dangerously-bypass-approvals-and-sandbox', '--dangerously-bypass-hook-trust',
      '--yolo', 'danger-full-access', '--dangerously-skip-permissions'];
    for (const [profile, role, extra] of [
      ['flash', 'implement', []], ['codex', 'implement', []], ['agy', 'implement', []],
      ['flash-review', 'review', ['--diff-range', reviewRange()]],
      ['codex-review', 'review', ['--diff-range', reviewRange()]],
      ['agy-review', 'review', ['--diff-range', reviewRange()]],
    ]) {
      const res = runDelegate([
        'run', '--id', `T-NOBYPASS-${profile}`, '--task', 'no bypass', '--role', role,
        '--profile', profile, '--cwd', repoDir,
        '--card', role === 'review' ? reviewCardPath : cardPath,
        '--out', outDir, '--confirmed', ...extra,
      ], baseEnv);
      assert.equal(res.status, 0, res.stderr);
      const argv = JSON.parse(readFileSync(argvFile, 'utf8'));
      for (const flag of banned) assert.ok(!argv.includes(flag), `${profile}: ${flag}`);
    }
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
    const opArgv = JSON.parse(readFileSync(argvFile, 'utf8'));
    assert.deepEqual(opArgv, [
      fakePaths.opencode,
      'run',
      '--standalone',
      '--archived',
      '-m',
      'opencode-go/deepseek-v4.1-flash',
      cardText,
    ]);
    assert.ok(!opArgv.includes('--auto'));
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
    const implArgv = JSON.parse(readFileSync(argvFile, 'utf8'));
    assert.ok(!implArgv.includes('-p'), implArgv.join(' '));
    assert.deepEqual(implArgv.slice(0, 5), [
      fakePaths.agy,
      '--model',
      'gemini-4-hydrogen-high',
      '--output-format',
      'text',
    ]);
    assert.deepEqual(implArgv.slice(5, 7), ['--sandbox', '--settings']);
    const implSettings = JSON.parse(implArgv[implArgv.indexOf('--settings') + 1]);
    assert.equal(implSettings.toolPermission, 'proceed-in-sandbox');
    assert.equal(implSettings.allowNonWorkspaceAccess, true);
    assert.ok(implSettings.permissions.allow.includes('read_url(*)'));
    assert.ok(implSettings.permissions.allow.includes(`write_file(${repoDir})`));
    assert.ok(implSettings.permissions.allow.includes('command(git)'));
    assert.ok(!implArgv.includes('--dangerously-skip-permissions'));
    assert.ok(!implArgv.includes(cardText));
    assert.equal(readFileSync(stdinFile, 'utf8'), cardText);

    const agyRevRes = runDelegate(
      [
        'run',
        '--id', 'T-AGY-REV',
        '--task', 'agy review task',
        '--role', 'review',
        '--profile', 'agy-review', '--diff-range', reviewRange(),
        '--cwd', repoDir,
        '--card', cardPath,
        '--out', outDir,
        '--confirmed',
      ],
      baseEnv,
    );
    assert.equal(agyRevRes.status, 0, agyRevRes.stderr);
    const revArgv = JSON.parse(readFileSync(argvFile, 'utf8'));
    assert.ok(!revArgv.includes('-p'), revArgv.join(' '));
    assert.deepEqual(revArgv.slice(0, 5), [
      fakePaths.agy,
      '--model',
      'gemini-4-hydrogen-xhigh',
      '--output-format',
      'text',
    ]);
    assert.deepEqual(revArgv.slice(5, 7), ['--sandbox', '--settings']);
    const revSettings = JSON.parse(revArgv[revArgv.indexOf('--settings') + 1]);
    assert.ok(!revSettings.permissions.allow.some(rule => rule.startsWith('write_file(')));
    assert.ok(revSettings.permissions.deny.includes(`write_file(${repoDir})`));
    assert.ok(revSettings.permissions.allow.includes('read_url(*)'));
    assert.equal(readFileSync(stdinFile, 'utf8'), readFileSync(readLogRecords(atomicHome).at(-1).prompt, 'utf8'));
    assert.ok(!revArgv.includes(readFileSync(stdinFile, 'utf8')));

    const recs = readLogRecords(atomicHome);
    assert.equal(recs.length, 3);
    assert.equal(recs[0].family, 'deepseek');
    assert.equal(recs[1].family, 'gemini');
    assert.equal(recs[2].family, 'gemini');
    for (const r of recs) {
      assert.ok(!('last_message' in r), 'last_message must be absent for non-codex');
    }
  });

  it('--profile flash-review --role review builds the OpenCode argv with the Flash model', () => {
    const cardText = readFileSync(cardPath, 'utf8');
    const res = runDelegate(
      [
        'run',
        '--id', 'T-FLASH-REV',
        '--task', 'flash review',
        '--role', 'review',
        '--profile', 'flash-review',
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
      '--standalone',
      '--archived',
      '-m',
      'opencode-go/deepseek-v4.1-flash',
      cardText,
    ]);
    const [rec] = readLogRecords(atomicHome);
    assert.equal(rec.role, 'review');
    assert.equal(rec.executor, 'opencode');
    assert.equal(rec.model, 'opencode-go/deepseek-v4.1-flash');
    assert.equal(rec.family, 'deepseek');
    assert.equal(rec.failure, 'none');
    assert.ok(!('last_message' in rec));
  });

  describe('Antigravity and a global git config that includes other files', () => {
    let seenFile;
    function writeGlobalWithInclude() {
      writeFileSync(join(emptyHome, '.gitconfig'),
        '[include]\n\tpath = ~/.gitconfig.local\n[core]\n\tautocrlf = input\n');
      writeFileSync(join(emptyHome, '.gitconfig.local'),
        '[user]\n\tname = Included Name\n[credential "https://example.com"]\n\thelper =\n\thelper = !fake helper\n');
    }
    function seen() {
      return JSON.parse(readFileSync(seenFile, 'utf8'));
    }
    beforeEach(() => { seenFile = join(root, 'seen-git-global.json'); });

    it('gives the reviewer a self-contained copy inside the git directory and removes it afterwards', () => {
      writeGlobalWithInclude();
      const res = runDelegate(reviewArgs(['--diff-range', reviewRange()]),
        { ...baseEnv, FAKE_GIT_GLOBAL_FILE: seenFile });
      assert.equal(res.status, 0, res.stderr);
      const got = seen();
      assert.ok(got.env, 'GIT_CONFIG_GLOBAL must be set for agy');
      assert.equal(dirname(got.env), realpathSync(join(repoDir, '.git')));
      assert.equal(got.exit, 0);
      assert.match(got.list, /^user\.name=Included Name$/m);
      assert.match(got.list, /^core\.autocrlf=input$/m);
      assert.match(got.list, /^credential\.https:\/\/example\.com\.helper=\n?credential\.https:\/\/example\.com\.helper=!fake helper$/m);
      assert.doesNotMatch(got.list, /^include/m);
      assert.equal(existsSync(got.env), false, 'the copy is removed when the run ends');
      assert.equal(git(repoDir, 'status', '--porcelain'), '');
      const rec = readLogRecords(atomicHome).at(-1);
      assert.equal(rec.failure, 'none');
      assert.ok(rec.access.limits.some((limit) => /GIT_CONFIG_GLOBAL/.test(limit)), JSON.stringify(rec.access));
    });

    it('uses the per-worktree git directory in a linked worktree and covers implement runs', () => {
      writeGlobalWithInclude();
      const wtDir = join(root, 'wt-global');
      git(repoDir, 'worktree', 'add', '-b', 'feat/global', wtDir);
      const res = runDelegate(['run', '--id', 'G1', '--task', 'impl', '--role', 'implement',
        '--profile', 'agy', '--cwd', wtDir, '--card', cardPath, '--out', outDir, '--confirmed'],
      { ...baseEnv, FAKE_GIT_GLOBAL_FILE: seenFile, FAKE_COMMIT_FILE: 'made.txt' });
      assert.equal(res.status, 0, res.stderr);
      const got = seen();
      assert.equal(dirname(got.env), realpathSync(git(wtDir, 'rev-parse', '--absolute-git-dir')));
      assert.match(got.list, /^user\.name=Included Name$/m);
      assert.equal(existsSync(got.env), false);
      assert.equal(readLogRecords(atomicHome).at(-1).commits, 1);
    });

    it('leaves git alone when the global config includes nothing, and for other executors', () => {
      writeFileSync(join(emptyHome, '.gitconfig'), '[core]\n\tautocrlf = input\n');
      let res = runDelegate(reviewArgs(['--diff-range', reviewRange()]),
        { ...baseEnv, FAKE_GIT_GLOBAL_FILE: seenFile });
      assert.equal(res.status, 0, res.stderr);
      assert.equal(seen().env, null);
      assert.ok(!readLogRecords(atomicHome).at(-1).access.limits.some((l) => /GIT_CONFIG_GLOBAL/.test(l)));

      writeGlobalWithInclude();
      res = runDelegate(reviewArgs(['--id', 'D8c', '--diff-range', reviewRange()], 'codex-review'),
        { ...baseEnv, FAKE_GIT_GLOBAL_FILE: seenFile });
      assert.equal(res.status, 0, res.stderr);
      assert.equal(seen().env, null);
    });
  });

  it('D9 R06 describes the read-only git commands an Antigravity reviewer can run', () => {
    const skill = readFileSync(join(REPO_ROOT, 'skills/core/delegate.md'), 'utf8');
    const template = readFileSync(
      join(REPO_ROOT, 'skills/shared/delegate-assets/review-card-template.md'), 'utf8');
    for (const text of [skill, template]) {
      assert.match(text, /read-only git/);
      assert.match(text, /git diff/);
      assert.match(text, /git rev-parse/);
    }
    assert.doesNotMatch(template, /cannot run git/);
    assert.doesNotMatch(skill, /cannot assume which read directories/);
  });

});
