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
  DELEGATE_PY,
  hasPython3,
  PYTHON3,
  git,
  bundleBlobText,
  initGitRepo,
  makeFakeBin,
  makeFakeRemoteRunner,
  runDelegate,
  readLogRecords,
} from './helpers/delegate-runner-kit.js';

describe('delegate.py remote host', { skip: !hasPython3 ? 'python3 not on PATH' : false }, () => {
  let root;
  let atomicHome;
  let emptyHome;
  let repoDir;
  let cardPath;
  let reviewCardPath;
  let outDir;
  let remote;
  let baseEnv;

  beforeEach(() => {
    root = realpathSync(mkdtempSync(join(tmpdir(), 'as-delegate-remote-')));
    atomicHome = join(root, 'atomic-home');
    emptyHome = join(root, 'empty-home');
    repoDir = join(root, 'repo');
    outDir = join(root, 'out');
    mkdirSync(atomicHome, { recursive: true });
    mkdirSync(emptyHome, { recursive: true });
    mkdirSync(repoDir, { recursive: true });
    initGitRepo(repoDir);

    const fakes = makeFakeBin(root);
    remote = makeFakeRemoteRunner(root);

    cardPath = join(root, 'card.md');
    writeFileSync(cardPath, '# Task REMOTE-1\nImplement feature X with a unique CARD-SENTINEL.\n');
    reviewCardPath = join(root, 'review-card.md');
    writeFileSync(
      reviewCardPath,
      '# Review REMOTE-1\nReview the diff `git diff {{DIFF_RANGE}}`\nTOTAL major=0 medium=0 minor=0\n',
    );

    baseEnv = {
      PATH: `${fakes.binDir}:${process.env.PATH || '/usr/bin:/bin'}`,
      HOME: emptyHome,
      ATOMIC_SKILLS_HOME: atomicHome,
      DELEGATE_PEAK_WINDOWS: '',
      DELEGATE_REMOTE_RUNNER: remote.path,
      FAKE_REMOTE_ROOT: remote.root,
      FAKE_REMOTE_ARGV_LOG: remote.argvLog,
      FAKE_REMOTE_KILL_LOG: remote.killLog,
      FAKE_ARGV_FILE: join(root, 'captured.argv.json'),
      FAKE_STDIN_FILE: join(root, 'captured.stdin.txt'),
      FAKE_STDOUT: 'Reviewed the diff; no findings.\nTOTAL major=0 medium=0 minor=0\n',
      FAKE_LAST_MESSAGE: 'Reviewed the diff; no findings.\nTOTAL major=0 medium=0 minor=0\n',
    };
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  function runArgs(extra = []) {
    return ['run', '--id', 'RMT', '--task', 'remote task', '--role', 'implement',
      '--profile', 'flash', '--cwd', repoDir, '--card', cardPath,
      '--out', outDir, '--confirmed', '--host', 'devbox', ...extra];
  }

  function remoteEnv(extra = {}) {
    return { ...baseEnv, ...extra };
  }

  function remoteArgvText() {
    return existsSync(remote.argvLog) ? readFileSync(remote.argvLog, 'utf8') : '';
  }

  function findFiles(dir, predicate) {
    const found = [];
    const walk = current => {
      let names;
      try { names = readdirSync(current, { withFileTypes: true }); } catch { return; }
      for (const entry of names) {
        const full = join(current, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (predicate(full)) found.push(full);
      }
    };
    walk(dir);
    return found;
  }

  async function waitFor(predicate, timeoutMs, label) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (predicate()) return;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    throw new Error(`${label} timed out after ${timeoutMs}ms`);
  }

  function spawnDelegate(args, env = {}) {
    return spawn(PYTHON3, [DELEGATE_PY, ...args], {
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  }

  it('a local run keeps the old argv and record shape without remote fields', () => {
    const res = runDelegate(['run', '--id', 'LOCAL', '--task', 'local', '--role', 'implement',
      '--profile', 'flash', '--cwd', repoDir, '--card', cardPath,
      '--out', outDir, '--confirmed'], {
      ...baseEnv, DELEGATE_REMOTE_RUNNER: undefined, FAKE_REMOTE_ROOT: undefined,
      FAKE_REMOTE_ARGV_LOG: undefined, FAKE_REMOTE_KILL_LOG: undefined,
    });
    assert.equal(res.status, 0, res.stderr);
    const [rec] = readLogRecords(atomicHome);
    assert.equal(rec.host, undefined);
    assert.equal(rec.remote_dir, undefined);
    assert.equal(rec.sync, undefined);
    assert.equal(rec.send_s, undefined);
    assert.equal(rec.run_s, undefined);
    assert.equal(rec.fetch_s, undefined);
    assert.ok(!remoteArgvText());
  });

  it('round trip: ships the bundle, runs remotely, fetches commits and keeps the checkout', () => {
    const base = git(repoDir, 'rev-parse', 'HEAD');
    const res = runDelegate(runArgs(), remoteEnv({ FAKE_COMMIT_FILE: 'remote-change.txt' }));
    assert.equal(res.status, 0, res.stderr);
    const [rec] = readLogRecords(atomicHome);
    assert.equal(rec.host, 'devbox');
    assert.ok(isAbsolute(rec.remote_dir), rec.remote_dir);
    assert.equal(rec.sync.sent, base);
    assert.equal(rec.sync.received, git(repoDir, 'rev-parse', 'HEAD'));
    assert.notEqual(rec.sync.sent, rec.sync.received);
    assert.equal(rec.failure, 'none');
    assert.equal(existsSync(join(repoDir, 'remote-change.txt')), true);
    assert.ok(rec.send_s >= 0 && rec.run_s >= 0 && rec.fetch_s >= 0, JSON.stringify(rec));
    assert.ok(existsSync(join(rec.remote_dir, 'tree')), 'remote checkout is kept');
    assert.equal(existsSync(join(rec.remote_dir, 'run')), false, 'per-run directory is removed');
    assert.ok(rec.access.limits.some(line => /leftover-process cleanup/.test(line)));
    assert.equal(rec.orphans.found, 0, JSON.stringify(rec.orphans));
    assert.ok(rec.access.extra_read.every(path => path.startsWith(rec.remote_dir)),
      JSON.stringify(rec.access.extra_read));
    assert.equal(JSON.stringify(rec.access).includes('__DELEGATE_REMOTE_BASE__'), false);
    assert.equal(existsSync(join(atomicHome, 'delegate', 'running')), false);
    assert.equal(existsSync(join(outDir, 'RMT.out.md')), true);
    const remoteArgv = remoteArgvText();
    assert.match(remoteArgv, /"--wait"/);
    assert.match(remoteArgv, /"-n"/);
    assert.match(remoteArgv, /"--host","devbox"/);
  });

  it('refuses a dirty worktree before any remote call', () => {
    writeFileSync(join(repoDir, 'dirty.txt'), 'not committed\n');
    const res = runDelegate(runArgs(), remoteEnv());
    assert.equal(res.status, 1, res.stderr);
    const [rec] = readLogRecords(atomicHome);
    assert.equal(rec.failure, 'dirty_worktree');
    assert.equal(rec.host, 'devbox');
    assert.equal(remoteArgvText(), '');
  });

  it('fetches a diverged remote branch into refs/delegate/<id> and leaves the local branch untouched', async () => {
    const ready = join(root, 'ready');
    const release = join(root, 'release');
    const child = spawnDelegate(runArgs(), remoteEnv({
      FAKE_READY_FILE: ready,
      FAKE_WAIT_FILE: release,
      FAKE_COMMIT_FILE: 'remote-diverged.txt',
    }));
    let stderr = '';
    child.stderr.on('data', chunk => { stderr += chunk; });
    await waitFor(() => existsSync(ready), 30000, 'remote executor ready');
    writeFileSync(join(repoDir, 'local-diverged.txt'), 'local commit\n');
    git(repoDir, 'add', 'local-diverged.txt');
    git(repoDir, 'commit', '-m', 'local movement');
    const localHead = git(repoDir, 'rev-parse', 'HEAD');
    writeFileSync(release, 'go\n');
    const status = await new Promise(resolve => child.on('exit', resolve));
    assert.equal(status, 1, stderr);
    const [rec] = readLogRecords(atomicHome);
    assert.equal(rec.failure, 'diverged');
    assert.equal(git(repoDir, 'rev-parse', 'HEAD'), localHead);
    assert.equal(git(repoDir, 'rev-parse', 'refs/delegate/RMT'), rec.sync.received);
    assert.equal(existsSync(join(repoDir, 'remote-diverged.txt')), false);
    assert.equal(rec.remote_work_kept.ref, 'refs/delegate/RMT');
    assert.equal(rec.remote_ref, 'refs/delegate/RMT');
  });

  it('R05 does not fast-forward a different branch checked out meanwhile', async () => {
    const ready = join(root, 'switch-ready');
    const release = join(root, 'switch-release');
    const child = spawnDelegate(runArgs(), remoteEnv({
      FAKE_READY_FILE: ready,
      FAKE_WAIT_FILE: release,
      FAKE_COMMIT_FILE: 'remote-switched.txt',
    }));
    let stderr = '';
    child.stderr.on('data', chunk => { stderr += chunk; });
    await waitFor(() => existsSync(ready), 30000, 'remote executor ready');
    git(repoDir, 'checkout', '-b', 'switched');
    writeFileSync(release, 'go\n');
    const status = await new Promise(resolve => child.on('exit', resolve));
    assert.equal(status, 1, stderr);
    const [rec] = readLogRecords(atomicHome);
    assert.equal(rec.failure, 'diverged');
    assert.match(rec.remote_error, /moved to switched, not main/);
    assert.equal(git(repoDir, 'rev-parse', '--abbrev-ref', 'HEAD'), 'switched');
    assert.equal(git(repoDir, 'rev-parse', 'refs/delegate/RMT'), rec.sync.received);
    assert.equal(existsSync(join(repoDir, 'remote-switched.txt')), false);
  });

  it('R05 gives a merge refused for overlapping local edits its own reason', async () => {
    const ready = join(root, 'overlap-ready');
    const release = join(root, 'overlap-release');
    const child = spawnDelegate(runArgs(), remoteEnv({
      FAKE_READY_FILE: ready,
      FAKE_WAIT_FILE: release,
      FAKE_COMMIT_FILE: 'README.md',
    }));
    let stderr = '';
    child.stderr.on('data', chunk => { stderr += chunk; });
    await waitFor(() => existsSync(ready), 30000, 'remote executor ready');
    writeFileSync(join(repoDir, 'README.md'), 'local edit that overlaps\n');
    writeFileSync(release, 'go\n');
    const status = await new Promise(resolve => child.on('exit', resolve));
    assert.equal(status, 1, stderr);
    const [rec] = readLogRecords(atomicHome);
    assert.equal(rec.failure, 'diverged');
    assert.match(rec.remote_error, /overlaps the remote result and the fast-forward was refused/);
    assert.match(rec.remote_error, /merge refs\/delegate\/RMT/);
    assert.equal(git(repoDir, 'rev-parse', 'refs/delegate/RMT'), rec.sync.received);
    assert.equal(readFileSync(join(repoDir, 'README.md'), 'utf8'), 'local edit that overlaps\n');
  });

  it('R08 syncs only the bundle staging directory, never the worktree', () => {
    writeFileSync(join(repoDir, '.gitignore'), '.env\n');
    git(repoDir, 'add', '.gitignore');
    git(repoDir, 'commit', '-m', 'ignore env');
    writeFileSync(join(repoDir, '.env'), 'REMOTE-WORKTREE-CANARY\n');
    const res = runDelegate(runArgs(['--profile', 'codex']), remoteEnv());
    assert.equal(res.status, 0, res.stderr);
    const leaked = findFiles(remote.root, file => {
      try { return readFileSync(file, 'utf8').includes('REMOTE-WORKTREE-CANARY'); }
      catch { return false; }
    });
    assert.deepEqual(leaked, [], 'no synced file or bundle may contain the worktree .env');
    assert.deepEqual(findFiles(remote.root, file => file.endsWith('/.env')), []);
    assert.equal(readFileSync(join(repoDir, '.env'), 'utf8'), 'REMOTE-WORKTREE-CANARY\n');
  });

  it('R09 gives ids that sanitize alike separate checkouts and cleans only one', () => {
    const idArgs = id => ['run', '--id', id, '--task', 'collision', '--role', 'implement',
      '--profile', 'flash', '--cwd', repoDir, '--card', cardPath,
      '--out', outDir, '--confirmed', '--host', 'devbox'];
    const first = runDelegate(idArgs('A B'), remoteEnv());
    assert.equal(first.status, 0, first.stderr);
    const second = runDelegate(idArgs('A@B'), remoteEnv());
    assert.equal(second.status, 0, second.stderr);
    const [recOne, recTwo] = readLogRecords(atomicHome);
    assert.notEqual(recOne.remote_dir, recTwo.remote_dir);
    assert.match(recOne.remote_dir, /A_B-[0-9a-f]{8}$/);
    assert.match(recTwo.remote_dir, /A_B-[0-9a-f]{8}$/);
    const clean = runDelegate(['remote-clean', '--host', 'devbox', '--cwd', repoDir,
      '--id', 'A B'], remoteEnv());
    assert.equal(clean.status, 0, clean.stderr);
    assert.equal(existsSync(recOne.remote_dir), false);
    assert.equal(existsSync(recTwo.remote_dir), true);
  });

  it('R09 does not read an undocumented DELEGATE_REMOTE_BASE on the host', async () => {
    const ready = join(root, 'base-ready');
    const release = join(root, 'base-release');
    const child = spawnDelegate(runArgs(), remoteEnv({
      FAKE_READY_FILE: ready,
      FAKE_WAIT_FILE: release,
      DELEGATE_REMOTE_BASE: join(remote.root, 'ignored-base'),
    }));
    let stderr = '';
    child.stderr.on('data', chunk => { stderr += chunk; });
    await waitFor(() => existsSync(ready), 30000, 'remote executor ready');
    const scripts = findFiles(remote.root, file => file.endsWith('/remote-run.sh'));
    assert.ok(scripts.length >= 1, 'the driver script is on the host');
    const driver = readFileSync(scripts[0], 'utf8');
    assert.doesNotMatch(driver, /DELEGATE_REMOTE_BASE/);
    assert.match(driver, /R="\$HOME\/\.atomic-skills\/delegate\/remote\//);
    writeFileSync(release, 'go\n');
    const status = await new Promise(resolve => child.on('exit', resolve));
    assert.equal(status, 0, stderr);
  });

  it('R04 reuses a clean checkout that is exactly the commit being sent', () => {
    const first = runDelegate(runArgs(), remoteEnv());
    assert.equal(first.status, 0, first.stderr);
    const second = runDelegate(runArgs(), remoteEnv({ FAKE_STDOUT: 'second round\n' }));
    assert.equal(second.status, 0, second.stderr);
    const [rec] = readLogRecords(atomicHome);
    const taskDirs = readdirSync(dirname(rec.remote_dir)).filter(name => name.startsWith('RMT-'));
    const kept = taskDirs.flatMap(name =>
      readdirSync(join(dirname(rec.remote_dir), name)).filter(entry => entry.startsWith('kept-')));
    assert.deepEqual(kept, [], 'the exact commit is reused, nothing is moved aside');
  });

  it('moves a clean fetched checkout forward in place when the local branch advanced', () => {
    const first = runDelegate(runArgs(), remoteEnv({ FAKE_COMMIT_FILE: 'from-remote.txt' }));
    assert.equal(first.status, 0, first.stderr);
    writeFileSync(join(repoDir, 'local-next.txt'), 'local work after the fetch\n');
    git(repoDir, 'add', 'local-next.txt');
    git(repoDir, 'commit', '-m', 'local work after the fetch');
    const second = runDelegate(runArgs(), remoteEnv());
    assert.equal(second.status, 0, second.stderr);
    const rec = readLogRecords(atomicHome).at(-1);
    assert.equal(rec.failure, 'none', JSON.stringify(rec));
    assert.deepEqual(readdirSync(rec.remote_dir).filter(entry => entry.startsWith('kept-')), [],
      'nothing unfetched was there, so nothing is kept');
    assert.equal(git(join(rec.remote_dir, 'tree'), 'rev-parse', 'HEAD'), git(repoDir, 'rev-parse', 'HEAD'));
  });

  it('R04 moves a diverged checkout aside, records it, and cleans run and stage on timeout', () => {
    const first = runDelegate(runArgs(), remoteEnv());
    assert.equal(first.status, 0, first.stderr);
    const [firstRec] = readLogRecords(atomicHome);
    const oldHead = firstRec.sync.received;
    writeFileSync(join(firstRec.remote_dir, 'tree', 'leftover-work.txt'), 'never fetched\n');
    const res = runDelegate(runArgs(['--timeout', '1']), remoteEnv({ FAKE_SLEEP: '30' }));
    assert.equal(res.status, 1, res.stderr);
    const rec = readLogRecords(atomicHome).at(-1);
    assert.equal(rec.failure, 'timeout');
    assert.ok(rec.remote_work_kept, JSON.stringify(rec));
    // This run's own unfetched work is the new checkout; the one it moved
    // aside is reported next to it, never in its place.
    assert.match(rec.remote_work_kept.dir, /\/RMT-[0-9a-f]{8}\/tree$/);
    assert.equal(rec.remote_work_kept.head, git(repoDir, 'rev-parse', 'HEAD'));
    assert.equal(rec.remote_work_kept.branch, 'main');
    assert.equal(rec.remote_work_kept.previous.head, oldHead);
    assert.match(rec.remote_work_kept.previous.dir, /\/kept-\d{8}T\d{6}Z$/);
    assert.equal(readFileSync(join(rec.remote_work_kept.previous.dir, 'leftover-work.txt'), 'utf8'),
      'never fetched\n', 'the moved-aside checkout is kept');
    assert.equal(findFiles(remote.root, file => file.endsWith('/run/meta.txt')).length, 0);
    const remoteRunDirs = [];
    const walk = dir => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        if (entry.name === 'run') remoteRunDirs.push(join(dir, entry.name));
        else walk(join(dir, entry.name));
      }
    };
    walk(remote.root);
    assert.deepEqual(remoteRunDirs, [], 'the per-run directory is removed after a kill');
    const common = resolve(repoDir, git(repoDir, 'rev-parse', '--git-common-dir'));
    const stages = existsSync(join(common, 'delegate')) ? readdirSync(join(common, 'delegate')) : [];
    assert.deepEqual(stages, [], 'the local stage is removed');
  });

  it('R04 remote-clean removes the kept copies too', () => {
    const first = runDelegate(runArgs(), remoteEnv());
    assert.equal(first.status, 0, first.stderr);
    const [rec] = readLogRecords(atomicHome);
    writeFileSync(join(rec.remote_dir, 'tree', 'leftover-work.txt'), 'never fetched\n');
    const second = runDelegate(runArgs(['--timeout', '1']), remoteEnv({ FAKE_SLEEP: '30' }));
    assert.equal(second.status, 1, second.stderr);
    const kept = readLogRecords(atomicHome).at(-1).remote_work_kept.dir;
    assert.ok(existsSync(kept));
    const clean = runDelegate(['remote-clean', '--host', 'devbox', '--cwd', repoDir, '--id', 'RMT'],
      remoteEnv());
    assert.equal(clean.status, 0, clean.stderr);
    assert.equal(existsSync(kept), false);
  });

  it('R10 after a stop signal skips the pull and still appends a record', async () => {
    const ready = join(root, 'stop-ready');
    const child = spawnDelegate(runArgs(), remoteEnv({
      FAKE_READY_FILE: ready,
      FAKE_WAIT_FILE: join(root, 'never-released'),
      FAKE_SLEEP: '30',
    }));
    let stderr = '';
    child.stderr.on('data', chunk => { stderr += chunk; });
    await waitFor(() => existsSync(ready), 30000, 'remote executor ready');
    child.kill('SIGTERM');
    const status = await new Promise(resolve => child.on('exit', resolve));
    assert.notEqual(status, 0, stderr);
    const records = readLogRecords(atomicHome);
    assert.equal(records.length, 1);
    assert.equal(records[0].failure, 'interrupted');
    const argv = remoteArgvText().trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
    assert.equal(argv.some(entry => entry[0] === 'pull'), false,
      'no pull after a stop signal');
  });

  it('R10 records an unexpected remote error instead of losing it', () => {
    const res = runDelegate(runArgs(), remoteEnv({ FAKE_REMOTE_BAD_META: '1' }));
    assert.equal(res.status, 1, res.stderr);
    const [rec] = readLogRecords(atomicHome);
    assert.equal(rec.failure, 'remote_error');
    assert.match(rec.remote_error, /remote run failed: .*oops/);
    assert.ok(rec.remote_work_kept, 'the failed run still says where its work is kept');
  });

  it('R11 reports a sync timeout as remote_error, not remote_not_ready', () => {
    const slow = join(root, 'slow-remote-runner');
    writeFileSync(slow, '#!/bin/sh\nsleep 5\n');
    chmodSync(slow, 0o755);
    const probe = spawnSync(PYTHON3, ['-c', `
import importlib.util, sys
spec = importlib.util.spec_from_file_location("delegate", ${JSON.stringify(DELEGATE_PY)})
delegate = importlib.util.module_from_spec(spec)
spec.loader.exec_module(delegate)
try:
    delegate.remote_cli(["sync"], timeout=0.2, timeout_failure="remote_error")
except delegate.RemoteError as exc:
    print(exc.failure)
`], { encoding: 'utf8', env: { ...process.env, DELEGATE_REMOTE_RUNNER: slow } });
    assert.equal(probe.status, 0, probe.stderr);
    assert.equal(probe.stdout.trim(), 'remote_error');
  });

  it('reusing an id on --host keeps each round output and points each record at its own', () => {
    const first = runDelegate(runArgs(), remoteEnv({ FAKE_STDOUT: 'first remote round\n' }));
    assert.equal(first.status, 0, first.stderr);
    const second = runDelegate(runArgs(), remoteEnv({ FAKE_STDOUT: 'second remote round\n' }));
    assert.equal(second.status, 0, second.stderr);
    const [firstRec, secondRec] = readLogRecords(atomicHome);
    assert.notEqual(secondRec.stdout, firstRec.stdout);
    assert.notEqual(secondRec.prompt, firstRec.prompt);
    assert.match(secondRec.stdout, /RMT\.attempt2\.out\.md$/);
    assert.equal(readFileSync(firstRec.stdout, 'utf8'), 'first remote round\n');
    assert.equal(readFileSync(secondRec.stdout, 'utf8'), 'second remote round\n');
  });

  it('never puts the prompt, diff or attachments in remote-runner argv', () => {
    const attachment = join(root, 'attachment.md');
    writeFileSync(attachment, 'ATTACHMENT-SENTINEL-CONTENT\n');
    const base = git(repoDir, 'rev-parse', 'HEAD');
    writeFileSync(join(repoDir, 'diff-input.txt'), 'DIFF-SENTINEL-CONTENT\n');
    git(repoDir, 'add', 'diff-input.txt');
    git(repoDir, 'commit', '-m', 'diff input');
    const range = `${base}..HEAD`;
    const res = runDelegate(runArgs(['--diff-range', range, '--attach', attachment]), remoteEnv());
    assert.equal(res.status, 0, res.stderr);
    const argvText = remoteArgvText();
    for (const sentinel of ['CARD-SENTINEL', 'ATTACHMENT-SENTINEL', 'DIFF-SENTINEL-CONTENT']) {
      assert.equal(argvText.includes(sentinel), false, sentinel);
    }
    assert.match(remoteArgvText(), /--host/);
    assert.match(remoteArgvText(), /devbox/);
  });

  it('does not read local credential files', () => {
    const credential = join(emptyHome, '.codex', 'auth.json');
    mkdirSync(dirname(credential), { recursive: true });
    writeFileSync(credential, 'LOCAL-CREDENTIAL-CANARY\n');
    const res = runDelegate(runArgs(['--profile', 'codex']), remoteEnv());
    assert.equal(res.status, 0, res.stderr);
    assert.equal(readFileSync(credential, 'utf8'), 'LOCAL-CREDENTIAL-CANARY\n');
    assert.doesNotMatch(remoteArgvText(), /auth\.json|CREDENTIAL-CANARY/);
  });

  it('R12/R13 never syncs the worktree .env into the remote files or the bundle', async () => {
    writeFileSync(join(repoDir, '.gitignore'), '.env*\n');
    git(repoDir, 'add', '.gitignore');
    git(repoDir, 'commit', '-m', 'ignore env files');
    writeFileSync(join(repoDir, '.env'), 'SYNCED-DIR-CANARY\n');
    writeFileSync(join(repoDir, '.env.local'), 'SYNCED-DIR-CANARY-LOCAL\n');
    const credential = join(emptyHome, '.codex', 'auth.json');
    mkdirSync(dirname(credential), { recursive: true });
    writeFileSync(credential, 'LOCAL-CREDENTIAL-CANARY\n');
    const ready = join(root, 'canary-ready');
    const release = join(root, 'canary-release');
    const child = spawnDelegate(runArgs(['--profile', 'codex']), remoteEnv({
      FAKE_READY_FILE: ready,
      FAKE_WAIT_FILE: release,
    }));
    let stderr = '';
    child.stderr.on('data', chunk => { stderr += chunk; });
    await waitFor(() => existsSync(ready), 30000, 'remote executor ready');
    const synced = findFiles(remote.root, file => !file.endsWith('/code.bundle'));
    for (const file of synced) {
      assert.equal(readFileSync(file, 'utf8').includes('SYNCED-DIR-CANARY'), false, file);
      assert.equal(readFileSync(file, 'utf8').includes('LOCAL-CREDENTIAL-CANARY'), false, file);
    }
    assert.deepEqual(findFiles(remote.root, file => /\/\.env(\.|$)/.test(file)), []);
    const bundles = findFiles(remote.root, file => file.endsWith('/code.bundle'));
    assert.equal(bundles.length, 1, bundles.join(','));
    const bundled = bundleBlobText(bundles[0]);
    assert.equal(bundled.includes('SYNCED-DIR-CANARY'), false);
    assert.equal(bundled.includes('LOCAL-CREDENTIAL-CANARY'), false);
    writeFileSync(release, 'go\n');
    const status = await new Promise(resolve => child.on('exit', resolve));
    assert.equal(status, 0, stderr);
    assert.equal(readFileSync(credential, 'utf8'), 'LOCAL-CREDENTIAL-CANARY\n');
  });

  for (const profile of ['flash', 'codex', 'agy']) {
    for (const access of ['policy', 'strict']) {
      it(`R13 writes the expected remote exec.sh for ${profile} (${access})`, async () => {
        const ready = join(root, `exec-${profile}-${access}-ready`);
        const release = join(root, `exec-${profile}-${access}-release`);
        const args = runArgs(['--profile', profile, ...(access === 'strict' ? ['--access', 'strict'] : [])]);
        const child = spawnDelegate(args, remoteEnv({
          FAKE_READY_FILE: ready,
          FAKE_WAIT_FILE: release,
        }));
        let stderr = '';
        child.stderr.on('data', chunk => { stderr += chunk; });
        await waitFor(() => existsSync(ready), 30000, 'remote executor ready');
        const scripts = findFiles(remote.root, file => file.endsWith('/run/exec.sh'));
        assert.equal(scripts.length, 1, scripts.join(','));
        const script = readFileSync(scripts[0], 'utf8');
        assert.match(script, /^set -e$/m);
        for (const forbidden of ['--auto', '--dangerously-skip-permissions',
          '--danger-full-access', '--dangerously-bypass-approvals-and-sandbox']) {
          assert.equal(script.includes(forbidden), false, forbidden);
        }
        assert.equal(script.includes('CARD-SENTINEL'), false,
          'the prompt reaches the executor from its file, not from exec.sh');
        if (profile === 'flash') {
          assert.match(script, /exec opencode run --standalone --archived -m opencode-go\/deepseek-v4\.1-flash "\$PROMPT"/);
          assert.match(script, /PROMPT=\$\(cat "\$R\/run\/prompt\.md"; printf x\)/);
          assert.match(script, /export OPENCODE_CONFIG_CONTENT=/);
          if (access === 'strict') {
            assert.match(script, /"websearch"[^}]*"effect": "deny"/);
            assert.match(script, /"webfetch"[^}]*"effect": "deny"/);
            assert.match(script, /"external_directory", "resource": "\*", "effect": "deny"/);
          } else {
            assert.match(script, /"webfetch"[^}]*"effect": "allow"/);
          }
        } else if (profile === 'codex') {
          assert.match(script, /exec codex -a never exec --model gpt-6\.1-sol/);
          assert.match(script, /--sandbox workspace-write/);
          assert.match(script, /-C "\$R\/tree"/);
          assert.match(script, /-o "\$R\/run\/last\.md" - < "\$R\/run\/prompt\.md"/);
          if (access === 'strict') {
            assert.equal(script.includes('sandbox_workspace_write.network_access'), false);
            assert.equal(script.includes('--add-dir'), false);
          } else {
            assert.match(script, /-c sandbox_workspace_write\.network_access=true/);
            assert.match(script, /--add-dir "\$R\/tree\/\.git"/);
          }
        } else {
          assert.match(script, /exec agy --model gemini-4-hydrogen-high --output-format text/);
          assert.match(script, /--sandbox --settings/);
          assert.match(script, /< "\$R\/run\/prompt\.md"/);
          if (access === 'strict') {
            assert.equal(script.includes('read_url(*)'), false);
            assert.match(script, /"allowNonWorkspaceAccess":false/);
            assert.equal(script.includes('write_file(__DELEGATE_REMOTE_BASE__/tree/.git)'), false);
          } else {
            assert.match(script, /read_url\(\*\)/);
            assert.match(script, /"allowNonWorkspaceAccess":true/);
            assert.match(script, /write_file\(__DELEGATE_REMOTE_BASE__\/tree\/\.git\)/);
          }
          assert.equal(script.includes('--add-dir'), false,
            'the remote git directory is inside the checkout, so no extra dir is needed');
        }
        writeFileSync(release, 'go\n');
        const status = await new Promise(resolve => child.on('exit', resolve));
        assert.equal(status, 0, stderr);
      });
    }
  }

  it('profiles --host shows which executors are ready there', () => {
    const res = runDelegate(['profiles', '--host', 'devbox'], baseEnv);
    assert.equal(res.status, 0, res.stderr);
    assert.match(res.stdout, /^flash \| opencode \| .* \| host=devbox ready$/m);
    assert.match(res.stdout, /^agy \| agy \| .* \| host=devbox ready$/m);
    assert.equal(res.stdout.trim().split('\n').length, 30);
  });

  it('profiles --host reports a not-ready executor with the remote fix', () => {
    const doctor = {
      host: 'devbox', result: 'doctor-failed',
      checks: [
        { id: 'connection', status: 'ok', detail: 'ssh=devbox' },
        { id: 'integration-opencode', status: 'ok', detail: '/usr/local/bin/opencode' },
        { id: 'integration-opencode-auth', status: 'warn', detail: 'not signed in; run `remote-runner auth opencode`' },
      ],
    };
    const res = runDelegate(['profiles', '--host', 'devbox'],
      remoteEnv({ FAKE_REMOTE_DOCTOR_JSON: JSON.stringify(doctor) }));
    assert.equal(res.status, 0, res.stderr);
    assert.match(res.stdout, /host=devbox not-ready \(not signed in; run `remote-runner auth opencode`\)/);
  });

  it('remote-clean removes only the requested remote checkout', () => {
    const res = runDelegate(runArgs(), remoteEnv({ FAKE_COMMIT_FILE: 'cleaned.txt' }));
    assert.equal(res.status, 0, res.stderr);
    const [rec] = readLogRecords(atomicHome);
    assert.ok(existsSync(join(rec.remote_dir, 'tree')));
    const clean = runDelegate(['remote-clean', '--host', 'devbox', '--cwd', repoDir, '--id', 'RMT'],
      remoteEnv());
    assert.equal(clean.status, 0, clean.stderr);
    assert.equal(existsSync(rec.remote_dir), false);
  });
});
