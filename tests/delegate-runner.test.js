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

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const DELEGATE_PY = join(REPO_ROOT, 'skills/shared/delegate-assets/delegate.py');

const pythonProbe = spawnSync(process.env.DELEGATE_TEST_PYTHON || 'python3', ['-c', 'import sys; print(sys.executable)'], {
  encoding: 'utf8',
});
if (process.env.DELEGATE_TEST_PYTHON) assert.equal(pythonProbe.status, 0, pythonProbe.stderr || String(pythonProbe.error));
const hasPython3 = pythonProbe.status === 0;
const PYTHON3 = hasPython3 ? pythonProbe.stdout.trim() : 'python3';

const FAKE_SCRIPT = `#!${PYTHON3}
import json, os, pathlib, subprocess, sys, time

seq_dir = os.environ.get("FAKE_SEQ_DIR")
if seq_dir:
    cnt_p = pathlib.Path(seq_dir) / "count"
    try:
        cnt = int(cnt_p.read_text()) if cnt_p.exists() else 0
    except Exception:
        cnt = 0
    cnt_p.write_text(str(cnt + 1))
    step_file = pathlib.Path(seq_dir) / f"step_{cnt}.json"
    if step_file.exists():
        step_cfg = json.loads(step_file.read_text())
        for k, v in step_cfg.items():
            os.environ[k] = str(v)
    pathlib.Path(seq_dir, f"argv_{cnt}.json").write_text(json.dumps(sys.argv))

argv_file = os.environ.get("FAKE_ARGV_FILE")
if argv_file:
    pathlib.Path(argv_file).write_text(json.dumps(sys.argv))

stdin_content = ""
if not sys.stdin.isatty():
    try:
        stdin_content = sys.stdin.read()
    except Exception:
        pass

if seq_dir:
    pathlib.Path(seq_dir, f"stdin_{cnt}.txt").write_text(stdin_content)

stdin_file = os.environ.get("FAKE_STDIN_FILE")
if stdin_file:
    pathlib.Path(stdin_file).write_text(stdin_content)

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

ready_file = os.environ.get("FAKE_READY_FILE")
if ready_file:
    pathlib.Path(ready_file).write_text("ready\\n")

sleep_s = float(os.environ.get("FAKE_SLEEP", "0"))
if sleep_s > 0:
    time.sleep(sleep_s)

wait_file = os.environ.get("FAKE_WAIT_FILE")
if wait_file:
    wait_deadline = time.time() + float(os.environ.get("FAKE_WAIT_TIMEOUT", "60"))
    while not pathlib.Path(wait_file).exists() and time.time() < wait_deadline:
        time.sleep(0.02)

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

if os.environ.get("FAKE_PAUSE"):
    pathlib.Path(os.environ["ATOMIC_SKILLS_HOME"], "delegate", "PAUSED").touch()

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

const FAKE_REMOTE_RUNNER = `#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const crypto = require('crypto');

const root = process.env.FAKE_REMOTE_ROOT;
const remoteHome = path.join(root, 'home');
const state = path.join(remoteHome, '.local/state/remote-runner');
fs.mkdirSync(state, { recursive: true });
const argvLog = process.env.FAKE_REMOTE_ARGV_LOG;
if (argvLog) fs.appendFileSync(argvLog, JSON.stringify(process.argv.slice(2)) + '\\n');

const args = process.argv.slice(2);
let host = 'devbox';
let cmd = null;
let dir = null;
let noSync = false;
let command = [];
let operands = [];
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '--host') { host = args[++i]; continue; }
  if (!cmd) { cmd = arg; continue; }
  if (arg === '--') { command = args.slice(i + 1); break; }
  if (cmd === 'run') {
    if (arg === '-n' || arg === '--no-sync') noSync = true;
    else if (arg === '-C') dir = args[++i];
    else if (arg === '--wait') i++;
    else if (arg === '--timeout' || arg === '--lock-wait') i++;
    else if (arg === '-e' || arg === '--priority' || arg === '--tunnel') i++;
    else if (arg === '--tunnels' || arg === '--no-queue') {}
  } else if (!arg.startsWith('-')) {
    operands.push(arg);
  }
}

const real = value => {
  try { return fs.realpathSync(value); } catch { return path.resolve(value); }
};
const registryFile = path.join(state, 'projects.json');
function readRegistry() {
  try { return JSON.parse(fs.readFileSync(registryFile, 'utf8')); } catch { return {}; }
}
function writeRegistry(value) {
  fs.writeFileSync(registryFile, JSON.stringify(value));
}
function git(cwd, list) {
  try {
    return cp.execFileSync('git', ['-C', cwd, ...list], {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore']
    }).trim();
  } catch { return ''; }
}
function projectFor(local) {
  return git(local, ['rev-parse', '--show-toplevel']) || real(local);
}
function copyTree(src, dest, skip) {
  const stat = fs.lstatSync(src);
  if (stat.isSymbolicLink()) {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    try { fs.symlinkSync(fs.readlinkSync(src), dest); } catch {}
    return;
  }
  if (stat.isFile()) {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
    try { fs.chmodSync(dest, stat.mode & 0o777); } catch {}
    return;
  }
  fs.mkdirSync(dest, { recursive: true });
  for (const name of fs.readdirSync(src)) {
    if (skip && skip.includes(name)) continue;
    copyTree(path.join(src, name), path.join(dest, name), skip);
  }
}
function syncProject(local) {
  const project = projectFor(local);
  const common = git(project, ['rev-parse', '--path-format=absolute', '--git-common-dir'])
    || path.join(project, '.git');
  const key = crypto.createHash('sha256').update(real(project)).digest('hex').slice(0, 16);
  const remote = path.join(root, 'projects', key);
  fs.mkdirSync(remote, { recursive: true });
  for (const name of fs.readdirSync(remote)) {
    if (name !== '.git') fs.rmSync(path.join(remote, name), { recursive: true, force: true });
  }
  copyTree(project, remote, ['.git']);
  fs.rmSync(path.join(remote, '.git'), { recursive: true, force: true });
  copyTree(common, path.join(remote, '.git'), []);
  const registry = readRegistry();
  registry[real(project)] = { remote, key };
  writeRegistry(registry);
  return { project, remote };
}
function remoteFor(localTarget) {
  const target = path.resolve(localTarget);
  const registry = readRegistry();
  const roots = Object.keys(registry).sort((a, b) => b.length - a.length);
  for (const local of roots) {
    if (target === local || target.startsWith(local + path.sep)) {
      return {
        local: target,
        remote: path.join(registry[local].remote, path.relative(local, target))
      };
    }
  }
  return null;
}
function runRecordFile(id) {
  return path.join(state, 'runs', id);
}
function finish(id) {
  fs.rmSync(runRecordFile(id), { force: true });
}
function alive(pid) {
  try { process.kill(pid, 0); return true; } catch { return false; }
}
function readRunRecord(id) {
  try {
    const lines = fs.readFileSync(runRecordFile(id), 'utf8').split('\\n');
    return { pid: Number(lines[0]), started: lines[1] || 'unknown' };
  } catch { return null; }
}

if (cmd === 'sync') {
  syncProject(operands[0] || process.cwd());
  process.exit(0);
}
if (cmd === 'doctor') {
  let report;
  if (process.env.FAKE_REMOTE_DOCTOR_JSON) report = JSON.parse(process.env.FAKE_REMOTE_DOCTOR_JSON);
  else if (process.env.FAKE_REMOTE_DOCTOR_FILE) {
    report = JSON.parse(fs.readFileSync(process.env.FAKE_REMOTE_DOCTOR_FILE, 'utf8'));
  } else {
    const checks = [
      { id: 'connection', status: 'ok', detail: 'ssh=' + host },
      { id: 'remote-state', status: 'ok', detail: path.join(root, 'home', '.local/state/remote-runner') }
    ];
    for (const [id, binary] of [['opencode', 'opencode'], ['codex', 'codex'], ['antigravity', 'agy']]) {
      checks.push({ id: 'integration-' + id, status: 'ok', detail: '/usr/local/bin/' + binary });
      checks.push({ id: 'integration-' + id + '-auth', status: 'ok', detail: 'signed in' });
    }
    report = { host, checks, result: 'ok' };
  }
  report.host = report.host || host;
  process.stdout.write(JSON.stringify(report) + '\\n');
  process.exit(report.result === 'ok' ? 0 : 65);
}
if (cmd === 'runs') {
  const dirname = path.join(state, 'runs');
  fs.mkdirSync(dirname, { recursive: true });
  for (const name of fs.readdirSync(dirname)) {
    if (name.startsWith('.') || name.endsWith('.env') || name.endsWith('.cancel') ||
        name.endsWith('.gate') || name.endsWith('.owner')) continue;
    const record = readRunRecord(name);
    if (!record) { fs.rmSync(path.join(dirname, name), { force: true }); continue; }
    if (alive(record.pid)) process.stdout.write(name + ' alive pgid=' + record.pid + '\\n');
    else fs.rmSync(path.join(dirname, name), { force: true });
  }
  const queue = path.join(state, 'queue');
  fs.mkdirSync(queue, { recursive: true });
  for (const name of fs.readdirSync(queue)) {
    if (name.endsWith('.cancel')) continue;
    const lines = (() => {
      try { return fs.readFileSync(path.join(queue, name), 'utf8').split('\\n'); }
      catch { return []; }
    })();
    const seen = Number(lines[1] || 0) || Math.floor(Date.now() / 1000);
    const age = Math.max(0, Math.floor(Date.now() / 1000) - seen);
    process.stdout.write(name + ' queued age=' + age + 's priority=' + (lines[0] || 'normal') + '\\n');
  }
  process.exit(0);
}
if (cmd === 'kill') {
  const id = operands[0];
  const killLog = process.env.FAKE_REMOTE_KILL_LOG;
  if (killLog) fs.appendFileSync(killLog, String(id) + '\\n');
  if (process.env.FAKE_REMOTE_KILL_FAIL === '1') process.exit(1);
  if (id) {
    const queued = path.join(state, 'queue', id);
    if (fs.existsSync(queued)) {
      fs.writeFileSync(queued + '.cancel', '');
      fs.rmSync(queued, { force: true });
      process.exit(0);
    }
  }
  const record = id && readRunRecord(id);
  if (!record || !alive(record.pid)) process.exit(1);
  try { process.kill(-record.pid, 'SIGTERM'); } catch {}
  setTimeout(() => { try { process.kill(-record.pid, 'SIGKILL'); } catch {} }, 200);
  fs.rmSync(runRecordFile(id), { force: true });
  process.exit(0);
}
if (cmd === 'pull') {
  for (const operand of operands) {
    const mapped = remoteFor(operand);
    if (!mapped || !fs.existsSync(mapped.remote)) {
      process.stderr.write('remote-runner: pull path missing\\n');
      process.exit(70);
    }
    copyTree(mapped.remote, mapped.local, []);
  }
  process.exit(0);
}
if (cmd === 'run') {
  const local = path.resolve(dir || process.cwd());
  let entry;
  if (noSync) {
    const mapped = remoteFor(local);
    if (!mapped) {
      process.stderr.write('remote-runner: dir never synced\\n');
      process.exit(72);
    }
    entry = { remote: mapped.remote, project: local };
  } else {
    entry = syncProject(local);
  }
  if (process.env.FAKE_REMOTE_BUSY === '1') process.exit(74);
  const once = process.env.FAKE_REMOTE_BUSY_ONCE_FILE;
  if (once && !fs.existsSync(once)) {
    fs.writeFileSync(once, 'busy\\n');
    process.exit(74);
  }
  const id = crypto.randomUUID();
  let stopping = false;
  let child = null;
  const stop = () => {
    stopping = true;
    if (child) {
      try { process.kill(-child.pid, 'SIGTERM'); } catch {}
      setTimeout(() => { try { process.kill(-child.pid, 'SIGKILL'); } catch {} }, 200);
    }
  };
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
  process.on('SIGHUP', stop);
  const queueMs = Number(process.env.FAKE_REMOTE_QUEUE_MS || 0);
  if (queueMs > 0) {
    const queue = path.join(state, 'queue');
    fs.mkdirSync(queue, { recursive: true });
    fs.writeFileSync(path.join(queue, id), 'normal\\n' + Math.floor(Date.now() / 1000) + '\\n');
    const deadline = Date.now() + queueMs;
    const tick = () => {
      if (fs.existsSync(path.join(queue, id + '.cancel')) || stopping) {
        fs.rmSync(path.join(queue, id), { force: true });
        fs.rmSync(path.join(queue, id + '.cancel'), { force: true });
        process.exit(130);
      }
      if (Date.now() >= deadline) { launch(); return; }
      setTimeout(tick, 25);
    };
    tick();
    return;
  }
  launch();
  return;

  function launch() {
    const env = {
      ...process.env,
      HOME: remoteHome,
      ATOMIC_SKILLS_HOME: path.join(remoteHome, '.atomic-skills'),
      GIT_AUTHOR_NAME: 'Remote Executor',
      GIT_AUTHOR_EMAIL: 'executor@example.com',
      GIT_COMMITTER_NAME: 'Remote Executor',
      GIT_COMMITTER_EMAIL: 'executor@example.com'
    };
    const queue = path.join(state, 'queue', id);
    fs.rmSync(queue, { force: true });
    fs.rmSync(queue + '.cancel', { force: true });
    child = command.length === 1
      ? cp.spawn('bash', ['-c', command[0]], { cwd: entry.remote, env, detached: true, stdio: 'inherit' })
      : cp.spawn(command[0], command.slice(1), { cwd: entry.remote, env, detached: true, stdio: 'inherit' });
    fs.mkdirSync(path.join(state, 'runs'), { recursive: true });
    fs.writeFileSync(runRecordFile(id), child.pid + '\\nunknown\\n');
    child.on('exit', code => { finish(id); process.exit(code === null ? 1 : code); });
    child.on('error', () => { finish(id); process.exit(70); });
  }
}
process.stderr.write('remote-runner: unknown command\\n');
process.exit(64);
`;

function makeFakeRemoteRunner(dir) {
  const binDir = join(dir, 'remote-bin');
  mkdirSync(binDir, { recursive: true });
  const remoteRoot = join(dir, 'remote-root');
  mkdirSync(remoteRoot, { recursive: true });
  const p = join(binDir, 'remote-runner');
  writeFileSync(p, FAKE_REMOTE_RUNNER);
  chmodSync(p, 0o755);
  return {
    binDir,
    path: p,
    root: remoteRoot,
    home: join(remoteRoot, 'home'),
    argvLog: join(dir, 'remote.argv.log'),
    killLog: join(dir, 'remote.kill.log'),
  };
}

function runDelegate(args, env = {}, cwd = undefined) {
  const childEnv = { ...process.env, ...env };
  for (const [key, value] of Object.entries(childEnv)) {
    if (value === undefined) delete childEnv[key];
  }
  return spawnSync(PYTHON3, [DELEGATE_PY, ...args], {
    encoding: 'utf8',
    cwd,
    env: childEnv,
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
      assert.ok(prompt.startsWith(original));
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
  it('D8 refuses a missing pipeline attachment before executing the author', () => {
    const res = runDelegate(pipelineArgs(['--review-attach', join(root, 'missing')]), baseEnv);
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
  for (const stage of ['executor', 'review']) {
    for (const fallback of [false, true]) {
      it(`D8 ${stage} slot timeout ${fallback ? 'falls back' : 'exhausts route'}`, () => {
        const extra = stage === 'executor'
          ? ['--route', fallback ? 'flash,codex' : 'flash', '--review-route', 'agy-review']
          : ['--review-route', fallback ? 'codex-review,agy-review' : 'codex-review'];
        const started = Date.now();
        const res = runDelegate(pipelineArgs([...extra, '--wait', '0']), {
          ...steps([{ FAKE_COMMIT_FILE: 'feature' }, {}]),
          [stage === 'executor' ? 'DELEGATE_MAX_OPENCODE' : 'DELEGATE_MAX_CODEX']: '0',
        });
        // `--wait 0` must not sleep; the generous bound only tolerates a loaded host.
        assert.ok(Date.now() - started < 15000);
        assert.equal(res.status, fallback ? 0 : 1, res.stderr);
        const pipe = readLogRecords(atomicHome).at(-1);
        const timed = pipe.attempts.find(r => r.failure === 'slot_timeout');
        assert.ok(timed, JSON.stringify(pipe));
        assert.equal(pipe.outcome, fallback ? 'reviewed' : stage === 'executor' ? 'no_executor' : 'no_reviewer');
        assert.equal(pipe.attempts.filter(r => r.failure === 'none').length, fallback ? 2 : stage === 'executor' ? 0 : 1);
      });
    }
  }
  it('D8 standalone slot timeout retains exit 4 and records slot_timeout', () => {
    const res = runDelegate(reviewArgs(['--diff-range', reviewRange(), '--wait', '0'], 'codex-review'),
      { ...baseEnv, DELEGATE_MAX_CODEX: '0' });
    assert.equal(res.status, 4, res.stderr);
    assert.match(res.stderr, /slot wait timed out/);
    assert.equal(readLogRecords(atomicHome)[0].failure, 'slot_timeout');
    assert.throws(() => readFileSync(argvFile), { code: 'ENOENT' });
  });

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
      assert.match(res.stderr, /OpenCode runs only opencode-go\/deepseek-v4\.1-flash; use codex or agy for another model/);
      assert.throws(() => readFileSync(argvFile), { code: 'ENOENT' });
      assert.throws(() => readFileSync(join(atomicHome, 'delegate', 'runs.jsonl')), { code: 'ENOENT' });
    });
  }

  for (const role of ['implement', 'review']) {
    it(`DELEGATE_OPENCODE_MODEL cannot select another OpenCode model for ${role}`, () => {
      const res = runDelegate([
        'run', '--id', 'T-ENV-MODEL', '--task', 'environment model override',
        '--role', role, '--profile', 'flash',
        '--cwd', repoDir, '--card', cardPath, '--out', outDir, '--confirmed',
      ], { ...baseEnv, DELEGATE_OPENCODE_MODEL: 'opencode-go/hy4' });
      assert.equal(res.status, 2, res.stderr);
      assert.equal(res.stderr.trim().split('\n').length, 1, res.stderr);
      assert.match(res.stderr, /OpenCode runs only opencode-go\/deepseek-v4\.1-flash; use codex or agy/);
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
    assert.deepEqual(agyArgv.slice(0, 6), [
      fakePaths.agy, '-p', '--model', 'gemini-4-hydrogen-high', '--output-format', 'text',
    ]);
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
    assert.deepEqual(implArgv.slice(0, 6), [
      fakePaths.agy,
      '-p',
      '--model',
      'gemini-4-hydrogen-high',
      '--output-format',
      'text',
    ]);
    assert.deepEqual(implArgv.slice(6, 8), ['--sandbox', '--settings']);
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
    assert.deepEqual(revArgv.slice(0, 6), [
      fakePaths.agy,
      '-p',
      '--model',
      'gemini-4-hydrogen-xhigh',
      '--output-format',
      'text',
    ]);
    assert.deepEqual(revArgv.slice(6, 8), ['--sandbox', '--settings']);
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
        '--task', 'codex during deepseek peak',
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

  it('profiles lists exactly the six supported profiles in order and marks executors absent from PATH as missing when DELEGATE_NO_FALLBACK_PATHS=1', () => {
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
    assert.equal(lines.length, 18);
    assert.deepEqual(lines.filter((line) => !line.startsWith('  ')), [
      'flash | opencode | opencode-go/deepseek-v4.1-flash | deepseek | found',
      'flash-review | opencode | opencode-go/deepseek-v4.1-flash | deepseek | found',
      'codex | codex | gpt-6.1-sol | openai | missing',
      'codex-review | codex | gpt-6.1-sol | openai | missing',
      'agy | agy | gemini-4-hydrogen-high | gemini | found',
      'agy-review | agy | gemini-4-hydrogen-xhigh | gemini | found',
    ]);
    assert.equal(lines.filter((line) => line.startsWith('  ')).length, 12);
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
    assert.equal(lines.length, 18);
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
    assert.equal(lines.length, 18);
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

  it('D4 R17 normal completion removes owned slot before second run', async () => {
    const releaseFile = join(root, 'release-first-run');
    const bgProc = spawn(
      PYTHON3,
      [
        DELEGATE_PY,
        'run',
        '--id', 'T-CONC-1',
        '--task', 'long run',
        '--role', 'implement',
        '--profile', 'flash',
        '--cwd', repoDir,
        '--card', cardPath,
        '--out', outDir,
        '--confirmed',
      ],
      {
        env: {
          ...baseEnv,
          FAKE_WAIT_FILE: releaseFile,
          FAKE_WAIT_TIMEOUT: '60',
          DELEGATE_MAX_OPENCODE: '1',
        },
      },
    );
    const exited = new Promise(resolve => bgProc.once('close', resolve));

    // Wait until the first runner publishes its slot; the fake CLI then holds it
    // until we create the release file, so no fixed sleep is involved.
    const runningDir = join(atomicHome, 'delegate', 'running');
    await waitFor(() => {
      try {
        return readdirSync(runningDir).some(f => f.startsWith('opencode-T-CONC-1-'));
      } catch {
        return false;
      }
    }, 20000, 'first runner slot');

    const secondRes = runDelegate(
      [
        'run',
        '--id', 'T-CONC-2',
        '--task', 'second run',
        '--role', 'implement',
        '--profile', 'flash',
        '--cwd', repoDir,
        '--card', cardPath,
        '--out', outDir,
        '--wait', '0',
        '--confirmed',
      ],
      { ...baseEnv, DELEGATE_MAX_OPENCODE: '1' },
    );

    assert.equal(secondRes.status, 4);
    assert.match(secondRes.stderr, /delegate: no free opencode slot/);

    const slotName = readdirSync(runningDir).find(f => f.startsWith('opencode-T-CONC-1-'));
    const slotPid = JSON.parse(readFileSync(join(runningDir, slotName), 'utf8')).pid;
    writeFileSync(releaseFile, 'go');
    // Await the owner; no second caller may clean the slot for it.
    assert.equal(await exited, 0);
    await waitFor(() => {
      try {
        process.kill(slotPid, 0);
        return false;
      } catch {
        return true;
      }
    }, 20000, 'first executor process end');
    await waitFor(() => {
      try {
        return !readdirSync(runningDir).some(f => f.startsWith('opencode-T-CONC-1-'));
      } catch {
        return true;
      }
    }, 20000, 'first runner slot removal');

    assert.equal(readdirSync(runningDir).filter(f => f.endsWith('.json')).length, 0);
    const afterRes = runDelegate(
      [
        'run',
        '--id', 'T-CONC-AFTER',
        '--task', 'run after first ends',
        '--role', 'implement',
        '--profile', 'flash',
        '--cwd', repoDir,
        '--card', cardPath,
        '--out', outDir,
        '--wait', '0',
        '--confirmed',
      ],
      { ...baseEnv, DELEGATE_MAX_OPENCODE: '1' },
    );
    assert.equal(afterRes.status, 0, afterRes.stderr);
  });

  it('D9 ten OpenCode runs hold ten slots and the eleventh waits', async () => {
    const runningDir = join(atomicHome, 'delegate', 'running');
    const releaseFile = join(root, 'release-ten-slots');
    const children = [];
    const exits = [];
    for (let i = 0; i < 10; i++) {
      const child = spawn(PYTHON3, [
        DELEGATE_PY, 'run', '--id', `T-SLOT-${i}`, '--task', `slot ${i}`,
        '--role', 'implement', '--profile', 'flash', '--cwd', repoDir,
        '--card', cardPath, '--out', outDir, '--confirmed',
      ], {
        env: { ...baseEnv, FAKE_WAIT_FILE: releaseFile, FAKE_WAIT_TIMEOUT: '60' },
      });
      children.push(child);
      exits.push(new Promise((resolve) => child.once('close', resolve)));
    }
    try {
      await waitFor(() => {
        try {
          return readdirSync(runningDir).filter((f) => f.endsWith('.json')).length >= 10;
        } catch {
          return false;
        }
      }, 30000, 'ten held OpenCode slots');
      assert.equal(readdirSync(runningDir).filter((f) => f.endsWith('.json')).length, 10);
      const eleventh = runDelegate([
        'run', '--id', 'T-SLOT-11', '--task', 'eleventh', '--role', 'implement',
        '--profile', 'flash', '--cwd', repoDir, '--card', cardPath,
        '--out', outDir, '--wait', '0', '--confirmed',
      ], baseEnv);
      assert.equal(eleventh.status, 4);
      assert.match(eleventh.stderr, /delegate: no free opencode slot/);
    } finally {
      writeFileSync(releaseFile, 'go');
    }
    assert.deepEqual(await Promise.all(exits), Array(10).fill(0));
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

  it('concurrency: slot file with a dead pid is ignored and cleaned up', () => {
    const runningDir = join(atomicHome, 'delegate', 'running');
    mkdirSync(runningDir, { recursive: true });
    const staleSlot = join(runningDir, 'opencode-T-STALE-999999.json');
    writeFileSync(
      staleSlot,
      JSON.stringify({
        id: 'T-STALE',
        project: 'repo',
        profile: 'flash',
        role: 'implement',
        pid: 999999,
        pgid: 999999,
        started: '2026-11-18T10:00:00+00:00',
      }),
    );

    const res = runDelegate(
      [
        'run',
        '--id', 'T-AFTER-STALE',
        '--task', 'clean stale run',
        '--role', 'implement',
        '--profile', 'flash',
        '--cwd', repoDir,
        '--card', cardPath,
        '--out', outDir,
        '--wait', '0',
        '--confirmed',
      ],
      { ...baseEnv, DELEGATE_MAX_OPENCODE: '1' },
    );

    assert.equal(res.status, 0, res.stderr);
    assert.throws(() => readFileSync(staleSlot), { code: 'ENOENT' });
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

  it('kill <ID> ends a running fake run and slot disappears, unknown id exits 1', async () => {
    const bgProc = spawn(
      PYTHON3,
      [
        DELEGATE_PY,
        'run',
        '--id', 'T-KILL-TARGET',
        '--task', 'kill target',
        '--role', 'implement',
        '--profile', 'flash',
        '--cwd', repoDir,
        '--card', cardPath,
        '--out', outDir,
        '--confirmed',
      ],
      {
        env: {
          ...baseEnv,
          FAKE_SLEEP: '60',
        },
      },
    );

    const runningDir = join(atomicHome, 'delegate', 'running');
    let slotPath = null;
    await waitFor(() => {
      try {
        const found = readdirSync(runningDir).find((f) => f.startsWith('opencode-T-KILL-TARGET-'));
        if (found) slotPath = join(runningDir, found);
        return Boolean(found);
      } catch {
        return false;
      }
    }, 20000, 'running slot publication');

    const exited = new Promise(resolve => bgProc.once('exit', (code, signal) => resolve({code, signal})));
    const killUnknown = runDelegate(['kill', 'T-UNKNOWN-ID'], baseEnv);
    assert.equal(killUnknown.status, 1);

    const killRes = runDelegate(['kill', 'T-KILL-TARGET'], baseEnv);
    assert.equal(killRes.status, 0, killRes.stderr);

    let timer;
    try {
      const result = await Promise.race([exited, new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('background runner still alive')), 20000);
      })]);
      assert.ok(result.code !== null || result.signal !== null);
      await waitFor(() => {
        try {
          readFileSync(slotPath);
          return false;
        } catch (error) {
          return error.code === 'ENOENT';
        }
      }, 10000, 'killed runner slot removal');
    } finally {
      clearTimeout(timer);
      if (bgProc.exitCode === null && bgProc.signalCode === null) bgProc.kill('SIGTERM');
    }
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

  for (const timing of ['normal', 'timeout']) for (const fault of ['PermissionError', 'ProcessLookupError']) {
    it(`R2 R01 ${timing} ${fault} still reaps leader and removes slot`, () => {
      const res = pythonHarness(`
original_killpg = os.killpg
original_wait = subprocess.Popen.wait
children = []
original_popen = subprocess.Popen
def spawn(*args, **kwargs):
 p = original_popen(*args, **kwargs)
 if kwargs.get('start_new_session'): children.append(p)
 return p
d.subprocess.Popen = spawn
def killpg(pid, sig):
 if sig and any(p.pid == pid for p in children): raise ${fault}('injected zombie error')
 return original_killpg(pid, sig)
os.killpg = killpg
original_observe = d.wait_for_exit
def observe(p, timeout, **kwargs):
 original_observe(p, timeout, **kwargs)
 if '${timing}' == 'timeout' and not getattr(p, '_timeout_injected', False):
  p._timeout_injected = True
  raise subprocess.TimeoutExpired(p.args, timeout)
d.wait_for_exit = observe
try:
 d.execute_run('zombie', 'zombie', 'implement', profile='flash', cwd=${JSON.stringify(repoDir)}, card=${JSON.stringify(cardPath)}, out=${JSON.stringify(outDir)}, confirmed=True)
 assert children and children[0].returncode is not None, 'leader not reaped'
 assert not list(d.RUNNING.glob('*.json')), 'slot leaked'
finally:
 os.killpg = original_killpg
 for p in children:
  if p.poll() is None: p.kill(); original_wait(p)
`);
      assert.equal(res.status, 0, res.stderr);
    });
  }
  it('R3 legacy slot stays counted and kill refuses with pid', () => {
    const res = pythonHarness(`
p = subprocess.Popen([sys.executable, '-c', 'import time; time.sleep(60)'], start_new_session=True)
try:
 d.RUNNING.mkdir(parents=True)
 slot = d.RUNNING / ('opencode-legacy-%s.json' % p.pid)
 slot.write_text(json.dumps({'id':'legacy', 'pid':p.pid, 'pgid':p.pid, 'profile':'flash'}))
 assert len(d.get_active_slots('opencode')) == 1, 'live legacy slot deleted'
 try:
  d.execute_run('blocked', 'blocked', 'implement', profile='flash', cwd=${JSON.stringify(repoDir)}, card=${JSON.stringify(cardPath)}, out=${JSON.stringify(outDir)}, wait_s=0, confirmed=True)
 except d.SlotTimeoutError: pass
 else: raise AssertionError('legacy slot did not enforce cap')
 class Args: id = 'legacy'
 try: d.cmd_kill(Args())
 except SystemExit as exc: assert exc.code == 1
 else: raise AssertionError('legacy kill accepted')
 assert p.poll() is None, 'legacy child signalled'
 assert slot.exists()
 p.kill(); p.wait()
 assert d.get_active_slots() == [], 'dead legacy slot retained'
finally:
 if p.poll() is None: p.kill()
 p.wait()
`, {...baseEnv, DELEGATE_MAX_OPENCODE:'1'});
    assert.equal(res.status, 0, res.stderr);
    assert.match(res.stderr, /slot predates identity checks.*pid \d+/);
    assert.equal(res.stderr.trim().split('\n').length, 1);
  });

  for (const group of ['nonleader', 'missing']) {
    it(`R4 R01 legacy slot with ${group} group is stale and cleaned`, () => {
      const res = pythonHarness(`
p = subprocess.Popen([sys.executable, '-c', 'import time; time.sleep(60)'], start_new_session='${group}' == 'missing')
try:
 assert (os.getpgid(p.pid) != p.pid) == ('${group}' == 'nonleader')
 d.RUNNING.mkdir(parents=True)
 slot = d.RUNNING / ('opencode-legacy-%s.json' % p.pid)
 data = {'id':'legacy', 'pid':p.pid}
 if '${group}' == 'nonleader': data['pgid'] = p.pid
 slot.write_text(json.dumps(data))
 assert not d.slot_owned(data), 'unproven legacy process retained'
 assert d.get_active_slots() == [], 'stale legacy slot counted'
 assert not slot.exists(), 'stale legacy slot not cleaned'
 assert p.poll() is None, 'unrelated child signalled'
finally:
 if p.poll() is None: p.kill()
 p.wait()
`);
      assert.equal(res.status, 0, res.stderr);
    });
  }

  for (const phase of ['proof', 'signal']) {
    it(`R4 R02 bounded reap at ${phase} preserves exception and survivor slot`, () => {
      const res = pythonHarness(`
class Survivor:
 pid = 987654321
 args = ['fake']
 returncode = None
 def wait(self, timeout):
  assert timeout == 10
  raise subprocess.TimeoutExpired(self.args, timeout)
p = Survivor()
original_popen = subprocess.Popen
def spawn(*args, **kwargs):
 if kwargs.get('start_new_session'): return p
 return original_popen(*args, **kwargs)
d.subprocess.Popen = spawn
d.process_identity = lambda pid: 'fake-start'
d.wait_for_exit = lambda *args: None
original = SystemExit(143) if '${phase}' == 'proof' else KeyboardInterrupt()
injected = False
sent = []
def child_exited(*args):
 global injected
 if '${phase}' == 'proof' and not injected:
  injected = True
  raise original
def killpg(pid, sig):
 global injected
 if '${phase}' == 'signal' and not injected:
  injected = True
  raise original
 sent.append((pid, sig))
d.child_exited = child_exited
os.killpg = killpg
os.getpgid = lambda pid: pid
try:
 d.execute_run('survivor', 'survivor', 'implement', profile='flash', cwd=${JSON.stringify(repoDir)}, card=${JSON.stringify(cardPath)}, out=${JSON.stringify(outDir)}, confirmed=True)
except BaseException as exc:
 assert exc is original, repr(exc)
else: raise AssertionError('original exception swallowed')
assert (p.pid, signal.SIGKILL) in sent
assert p.returncode is None
slots = d.get_active_slots()
assert len(slots) == 1 and slots[0][1]['pid'] == p.pid, 'survivor slot lost'
class Args: id = 'survivor'
d.time.sleep = lambda seconds: None
clock = iter([0, 11])
d.time.monotonic = lambda: next(clock)
d.cmd_kill(Args())
assert (p.pid, signal.SIGTERM) in sent, 'survivor invisible to kill'
`);
      assert.equal(res.status, 0, res.stderr);
    });
  }

  it('R4 R03 kill skips legacy slot and kills current slot with same id', () => {
    const res = pythonHarness(`
children = [subprocess.Popen([sys.executable, '-c', 'import time; time.sleep(60)'], start_new_session=True) for _ in range(2)]
legacy, current = children
try:
 d.RUNNING.mkdir(parents=True)
 for index, p in enumerate(children):
  data = {'id':'shared', 'pid':p.pid, 'pgid':p.pid}
  if index: data['process_start'] = d.process_identity(p.pid)
  (d.RUNNING / ('opencode-%s-%s.json' % (index, p.pid))).write_text(json.dumps(data))
 original_killpg = os.killpg
 sent = []
 def killpg(pid, sig):
  sent.append((pid, sig))
  original_killpg(pid, sig)
  if pid == current.pid: current.wait(timeout=3)
 os.killpg = killpg
 class Args: id = 'shared'
 d.cmd_kill(Args())
 assert (current.pid, signal.SIGTERM) in sent, 'current slot not killed'
 assert current.returncode is not None
 assert legacy.poll() is None, 'legacy child signalled'
 assert not any(pid == legacy.pid for pid, sig in sent)
finally:
 for p in children:
  if p.poll() is None: p.kill()
  p.wait()
`);
    assert.equal(res.status, 0, res.stderr);
    assert.match(res.stderr, /slot predates identity checks.*pid \d+/);
    assert.equal(res.stderr.trim().split('\n').length, 1);
  });

  it('R3 placeholder retains live child and reclaims leftovers and old tmp', () => {
    const res = pythonHarness(`
p = subprocess.Popen([sys.executable, '-c', 'import time; time.sleep(60)'], start_new_session=True)
try:
 d.RUNNING.mkdir(parents=True)
 slot = d.RUNNING / ('opencode-placeholder-%s.json' % p.pid)
 slot.write_text(json.dumps({'id':'placeholder', 'pid':p.pid, 'pgid':p.pid, 'process_start':f'unreaped:{os.getpid()}:{p.pid}', 'runner_pid':os.getpid(), 'runner_start':d.process_identity(os.getpid())}))
 assert d.process_identity(p.pid), 'child identity not visible'
 assert len(d.get_active_slots()) == 1, 'visible placeholder child deleted'
 p.kill(); p.wait()
 assert d.get_active_slots() == [], 'leftover retained by live runner'
 old = d.RUNNING / 'opencode-old.tmp'
 fresh = d.RUNNING / 'opencode-fresh.tmp'
 old.write_text('partial'); fresh.write_text('partial')
 os.utime(old, (time.time()-61, time.time()-61))
 d.clean_stale_slots()
 assert not old.exists(), 'old temporary retained'
 assert fresh.exists(), 'recent temporary removed'
finally:
 if p.poll() is None: p.kill()
 p.wait()
`);
    assert.equal(res.status, 0, res.stderr);
  });

  for (const mode of ['executor quota', 'reviewer quota', 'same family']) {
    it(`R3 exhausted routes explain ${mode} in record and summary`, () => {
      const extra = mode === 'executor quota' ? ['--route','flash,codex'] :
        mode === 'same family' ? ['--review-route','flash-review'] : ['--review-route','codex-review,agy-review'];
      const configs = mode === 'executor quota' ? [{FAKE_EXIT:1,FAKE_STDERR:'quota'}, {FAKE_EXIT:1,FAKE_STDERR:'quota'}] :
        [{FAKE_COMMIT_FILE:'feature'}, {FAKE_EXIT:1,FAKE_STDERR:'quota'}, {FAKE_EXIT:1,FAKE_STDERR:'quota'}];
      const res = runDelegate(pipelineArgs(extra), steps(configs));
      assert.equal(res.status, 1, res.stderr);
      const rec = readLogRecords(atomicHome).at(-1);
      const reason = mode === 'same family' ? /no reviewer outside the executor family.*flash-review/ :
        mode === 'executor quota' ? /every executor route hit provider_limit.*flash.*codex/ :
        /every reviewer route hit provider_limit.*codex-review.*agy-review/;
      assert.match(rec.error, reason);
      assert.ok(summary().includes(`- stopped at ${mode === 'executor quota' ? 'executor' : 'review'}: ${rec.error}`));
    });
  }

  for (const phase of ['proof', 'signal']) {
    it(`R3 interruption at ${phase} signals reaps and removes slot before propagating`, () => {
      const res = pythonHarness(`
children = []
original_popen = subprocess.Popen
original_child_exited = d.child_exited
original_killpg = os.killpg
def spawn(*args, **kwargs):
 p = original_popen(*args, **kwargs)
 if kwargs.get('start_new_session'): children.append(p)
 return p
d.subprocess.Popen = spawn
d.wait_for_exit = lambda *args: None
injected = False
sent = []
def child_exited(*args):
 global injected
 if '${phase}' == 'proof' and not injected:
  injected = True
  raise SystemExit(143)
 return original_child_exited(*args)
def killpg(pid, sig):
 global injected
 if '${phase}' == 'signal' and not injected:
  injected = True
  raise KeyboardInterrupt()
 sent.append(sig)
 return original_killpg(pid, sig)
d.child_exited = child_exited
os.killpg = killpg
started = time.monotonic()
try:
 try:
  d.execute_run('interrupt', 'interrupt', 'implement', profile='flash', cwd=${JSON.stringify(repoDir)}, card=${JSON.stringify(cardPath)}, out=${JSON.stringify(outDir)}, confirmed=True)
 except (SystemExit, KeyboardInterrupt): pass
 else: raise AssertionError('exception swallowed')
 assert signal.SIGKILL in sent, 'executor not signalled'
 assert children[0].returncode is not None, 'executor not reaped'
 assert not list(d.RUNNING.glob('*.json')), 'slot retained'
 assert time.monotonic()-started < 15, 'cleanup blocked on live executor'
finally:
 d.child_exited = original_child_exited
 os.killpg = original_killpg
 for p in children:
  if p.poll() is None: p.kill()
  p.wait()
`, {...baseEnv, FAKE_SLEEP:'4'});
      assert.equal(res.status, 0, res.stderr);
    });
  }

  it('R3 reap and slot removal both hold the slot lock', () => {
    const res = pythonHarness(`
original_wait = subprocess.Popen.wait
original_unlink = pathlib.Path.unlink
observed = set()
def probe():
 result = subprocess.run([sys.executable, '-c', "import fcntl,sys; f=open(sys.argv[1],'w'); fcntl.flock(f,fcntl.LOCK_EX|fcntl.LOCK_NB)", str(d.RUNNING / '.lock')], capture_output=True)
 assert result.returncode != 0, 'cleanup outside slot lock'
def wait(self, *args, **kwargs):
 if self.pid == child_pid[0]:
  try:
   probe(); observed.add('reap')
  finally:
   result = original_wait(self, *args, **kwargs)
  return result
 return original_wait(self, *args, **kwargs)
def unlink(self, *args, **kwargs):
 if self.parent == d.RUNNING and self.suffix == '.json':
  probe(); observed.add('remove')
 return original_unlink(self, *args, **kwargs)
original_popen = subprocess.Popen
child_pid = [None]
def spawn(*args, **kwargs):
 p = original_popen(*args, **kwargs)
 if kwargs.get('start_new_session'): child_pid[0] = p.pid
 return p
subprocess.Popen.wait = wait
subprocess.Popen = spawn
pathlib.Path.unlink = unlink
d.execute_run('locked', 'locked', 'implement', profile='flash', cwd=${JSON.stringify(repoDir)}, card=${JSON.stringify(cardPath)}, out=${JSON.stringify(outDir)}, confirmed=True)
assert observed == {'reap', 'remove'}, observed
`);
    assert.equal(res.status, 0, res.stderr);
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

  it('R2 R02 stale identity never lists or kills an unrelated group', () => {
    const res = pythonHarness(`
p = subprocess.Popen([sys.executable, '-c', 'import time; time.sleep(60)'], start_new_session=True)
try:
 d.RUNNING.mkdir(parents=True)
 slot = d.RUNNING / ('opencode-stale-%s.json' % p.pid)
 slot.write_text(json.dumps({'id':'stale', 'pid':p.pid, 'pgid':p.pid, 'process_start':'obsolete identity'}))
 assert d.get_active_slots() == [], 'stale PID identity still active'
 class Args: id = 'stale'
 try: d.cmd_kill(Args())
 except SystemExit as exc: assert exc.code == 1
 assert p.poll() is None, 'unrelated group killed'
 assert not slot.exists()
finally:
 p.kill(); p.wait()
`);
    assert.equal(res.status, 0, res.stderr);
  });
  for (const phase of ['TERM', 'KILL']) {
    it(`R2 R02 rechecks slot identity under lock before ${phase}`, () => {
      const res = pythonHarness(`
ready = pathlib.Path(${JSON.stringify(join(root, 'term-handler-ready'))})
p = subprocess.Popen([sys.executable, '-c', "import signal,time,pathlib,sys; signal.signal(signal.SIGTERM,signal.SIG_IGN); pathlib.Path(sys.argv[1]).write_text('ready'); time.sleep(60)", str(ready)], start_new_session=True)
deadline = time.time() + 20
while not ready.exists() and time.time() < deadline: time.sleep(.01)
assert ready.exists(), 'SIGTERM handler not installed'
while d.process_identity(p.pid) is None and time.time() < deadline: time.sleep(.01)
assert d.process_identity(p.pid)
d.RUNNING.mkdir(parents=True)
slot = d.RUNNING / ('opencode-race-%s.json' % p.pid)
data = {'id':'race', 'pid':p.pid, 'pgid':p.pid, 'process_start':d.process_identity(p.pid)}
slot.write_text(json.dumps(data))
original_active = d.get_active_slots
original_sleep = time.sleep
original_mono = time.monotonic
original_killpg = os.killpg
offset = 0
sent = []
def replace_slot():
 slot.write_text(json.dumps(dict(data, process_start='reused')))
def active(*args):
 result = original_active(*args)
 if '${phase}' == 'TERM': replace_slot()
 return result
def sleep(seconds):
 global offset
 replace_slot()
 offset = 20
def killpg(pid, sig):
 if sig:
  probe = subprocess.run([sys.executable, '-c', "import fcntl,sys; f=open(sys.argv[1],'w'); fcntl.flock(f,fcntl.LOCK_EX|fcntl.LOCK_NB)", str(d.RUNNING / '.lock')], capture_output=True)
  assert probe.returncode != 0, 'signal sent outside slot lock'
  sent.append(sig)
 return original_killpg(pid, sig)
d.get_active_slots = active
time.sleep = sleep
time.monotonic = lambda: original_mono() + offset
os.killpg = killpg
try:
 class Args: id = 'race'
 try: d.cmd_kill(Args())
 except SystemExit as exc:
  assert '${phase}' == 'TERM' and exc.code == 1, exc
 else: assert '${phase}' == 'KILL', 'kill succeeded without signalling'
 assert sent == ([] if '${phase}' == 'TERM' else [signal.SIGTERM]), sent
 assert p.poll() is None, 'replacement identity killed'
finally:
 os.killpg = original_killpg
 time.sleep = original_sleep
 time.monotonic = original_mono
 p.kill(); p.wait()
`);
      assert.equal(res.status, 0, res.stderr);
    });
  }
  it('R2 R03 normal executor and gate never signal a reaped leader', () => {
    const res = pythonHarness(`
reaped = set()
original_wait = subprocess.Popen.wait
original_killpg = os.killpg
def wait(self, *args, **kwargs):
 result = original_wait(self, *args, **kwargs)
 reaped.add(self.pid)
 return result
def killpg(pid, sig):
 assert pid not in reaped, 'killpg after reap'
 return original_killpg(pid, sig)
subprocess.Popen.wait = wait
os.killpg = killpg
sys.argv = ['delegate', *json.loads(os.environ['PIPE_ARGS'])]
try: d.main()
except SystemExit as exc: assert exc.code == 0, exc
`, { ...steps([{ FAKE_COMMIT_FILE: 'feature' }, { FAKE_LAST_MESSAGE: 'TOTAL major=0 medium=0 minor=0' }]), PIPE_ARGS: JSON.stringify(pipelineArgs()) });
    assert.equal(res.status, 0, res.stderr);
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
  it('D4 R07 status waits for real execute_run atomic slot publication', () => {
    const res = pythonHarness(`
original_write = pathlib.Path.write_text
cleaners = []
probe = "import fcntl,sys; f=open(sys.argv[1], 'w'); fcntl.flock(f, fcntl.LOCK_EX | fcntl.LOCK_NB)"
def slow_publish(path, content, *args, **kwargs):
 if path.parent == d.RUNNING and path.suffix in ('.tmp', '.json'):
  assert path.suffix == '.tmp', 'execute_run published directly to JSON'
  lock = subprocess.run([sys.executable, '-c', probe, str(d.RUNNING / '.lock')], capture_output=True)
  assert lock.returncode != 0, 'execute_run did not hold slot lock'
  original_write(path, '')
  cleaner = subprocess.Popen([sys.executable, '-c', "import importlib.util; s=importlib.util.spec_from_file_location('d', " + repr(d.__file__) + "); d=importlib.util.module_from_spec(s); s.loader.exec_module(d); print([s['id'] for _,s in d.get_active_slots()])"], stdout=subprocess.PIPE, text=True)
  cleaners.append(cleaner)
  time.sleep(.2)
  assert cleaner.poll() is None, 'cleaner entered during publication'
 return original_write(path, content, *args, **kwargs)
pathlib.Path.write_text = slow_publish
try:
 d.execute_run('live', 'live', 'implement', profile='flash', cwd=${JSON.stringify(repoDir)}, card=${JSON.stringify(cardPath)}, out=${JSON.stringify(outDir)}, confirmed=True)
 assert cleaners, 'real slot writer not exercised'
 for cleaner in cleaners:
  output, _ = cleaner.communicate(timeout=20)
  assert 'live' in output, output
finally:
 for cleaner in cleaners:
  if cleaner.poll() is None: cleaner.kill(); cleaner.wait()
`, { FAKE_SLEEP:'0.5' });
    assert.equal(res.status, 0, res.stderr);
  });
  it('D4 R12 kill escalates for a surviving group after its leader exits', () => {
    const res = pythonHarness(`
marker = pathlib.Path(${JSON.stringify(join(root, 'orphan.pid'))})
heartbeat = marker.with_suffix('.heartbeat')
child_code = "import signal,time,pathlib; signal.signal(signal.SIGTERM, signal.SIG_IGN); h=pathlib.Path(" + repr(str(heartbeat)) + "); exec('while True: h.write_text(str(time.time())); time.sleep(.02)')"
leader_code = "import subprocess,sys,pathlib,time; p=subprocess.Popen([sys.executable,'-c'," + repr(child_code) + "]); pathlib.Path(" + repr(str(marker)) + ").write_text(str(p.pid)); time.sleep(60)"
leader = subprocess.Popen([sys.executable, '-c', leader_code], start_new_session=True)
try:
 deadline = time.time() + 20
 while not heartbeat.exists() and time.time() < deadline: time.sleep(.01)
 assert heartbeat.exists()
 d.RUNNING.mkdir(parents=True)
 (d.RUNNING / ('opencode-orphan-%s.json' % leader.pid)).write_text(json.dumps({'id': 'orphan', 'pid': leader.pid, 'pgid': leader.pid, 'process_start':d.process_identity(leader.pid), 'runner_pid':os.getpid(), 'runner_start':d.process_identity(os.getpid())}))
 class Args: id = 'orphan'
 d.cmd_kill(Args())
 leader.wait(timeout=20)
 child_pid = int(marker.read_text())
 deadline = time.time() + 20
 while time.time() < deadline:
  try: os.kill(child_pid, 0)
  except ProcessLookupError: break
  time.sleep(.05)
 else: raise AssertionError('kill left a descendant running')
finally:
 if marker.exists():
  try: os.kill(int(marker.read_text()), signal.SIGKILL)
  except ProcessLookupError: pass
 if leader.poll() is None: leader.kill(); leader.wait()
`);
    assert.equal(res.status, 0, res.stderr);
  });
  // Exercise the fallback even on interpreters that expose os.waitid.
  function withoutWaitid() {
    const siteDir = join(root, 'no-waitid');
    mkdirSync(siteDir, { recursive: true });
    writeFileSync(join(siteDir, 'sitecustomize.py'),
      'import os\nif hasattr(os, "waitid"): del os.waitid\n');
    return { PYTHONPATH: [siteDir, process.env.PYTHONPATH].filter(Boolean).join(':') };
  }

  it('F1 no waitid: normal exit keeps child reserved and refuses a reaped PID', () => {
    const res = pythonHarness(`
assert not hasattr(os, 'waitid')
p = subprocess.Popen([sys.executable, '-c', 'pass'], start_new_session=True)
try:
 d.wait_for_exit(p, 3)
 assert p.returncode is None, 'observer reaped Popen child'
 assert os.waitpid(p.pid, os.WNOHANG) == (p.pid, 0), 'exit status lost'
 sent = []
 os.killpg = lambda *args: sent.append(args)
 d.stop_process(p)
 assert not sent, 'signalled a PID after child was externally reaped'
finally:
 p.wait()
`, withoutWaitid());
    assert.equal(res.status, 0, res.stderr);
    const pipeline = runDelegate(pipelineArgs(), {
      ...baseEnv, ...withoutWaitid(),
      ...steps([{ FAKE_COMMIT_FILE: 'feature' }, {}]),
    });
    assert.equal(pipeline.status, 0, pipeline.stderr);
    assert.equal(readLogRecords(atomicHome).at(-1).outcome, 'reviewed');
  });

  it('F1 gate preserves caller PATH and environment without sourcing shell startup files', () => {
    const marker = join(root, 'gate-env.json');
    const probe = join(root, 'probe.py');
    writeFileSync(probe, 'import json, os, sys; json.dump(dict(os.environ), open(sys.argv[1], "w"))');
    const startup = join(root, 'startup.sh');
    writeFileSync(startup, 'export PATH=/usr/bin:/bin\nexport F1_STARTUP_LOADED=yes\n');
    writeFileSync(join(emptyHome, '.bash_profile'), readFileSync(startup));
    const env = { ...baseEnv, ...steps([{ FAKE_COMMIT_FILE: 'feature' }, {}]),
      BASH_ENV: startup, F1_SENTINEL: 'caller value', F1_STARTUP_LOADED: undefined };
    const res = runDelegate(pipelineArgs(['--gate', `'${PYTHON3}' '${probe}' '${marker}'`]), env);
    assert.equal(res.status, 0, res.stderr);
    const observed = JSON.parse(readFileSync(marker, 'utf8'));
    assert.equal(observed.PATH, env.PATH);
    assert.equal(observed.F1_SENTINEL, env.F1_SENTINEL);
    assert.equal(observed.BASH_ENV, startup);
    assert.equal(observed.F1_STARTUP_LOADED, undefined);
    assert.equal(observed.ATOMIC_SKILLS_HOME, atomicHome);
  });

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
args = [${JSON.stringify(DELEGATE_PY)}, 'run', '--id', 'group', '--task', 'group', '--role', 'implement', '--profile', 'flash', '--cwd', ${JSON.stringify(repoDir)}, '--card', ${JSON.stringify(cardPath)}, '--out', ${JSON.stringify(outDir)}, '--confirmed', '--timeout', '${mode === 'timeout' ? '1' : '60'}']
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
  it('D9 an executor is terminated and recorded when the runner parent disappears', async () => {
    const heartbeat = join(root, 'orphan.executor.heartbeat');
    const childHeartbeat = join(root, 'orphan.child.heartbeat');
    const childPidFile = join(root, 'orphan.child.pid');
    const executorPidFile = join(root, 'orphan.executor.pid');
    const runnerPidFile = join(root, 'orphan.runner.pid');
    writeFileSync(fakePaths.opencode, `#!${PYTHON3}
import os, pathlib, signal, subprocess, sys, time
signal.signal(signal.SIGTERM, signal.SIG_IGN)
child_code = """import pathlib, signal, sys, time
signal.signal(signal.SIGTERM, signal.SIG_IGN)
h = pathlib.Path(sys.argv[1])
while True:
    h.write_text(str(time.time()))
    time.sleep(.02)
"""
child = subprocess.Popen([sys.executable, "-c", child_code, ${JSON.stringify(childHeartbeat)}])
pathlib.Path(${JSON.stringify(childPidFile)}).write_text(str(child.pid))
pathlib.Path(${JSON.stringify(executorPidFile)}).write_text(str(os.getpid()))
h = pathlib.Path(${JSON.stringify(heartbeat)})
while True:
    h.write_text(str(time.time()))
    time.sleep(.02)
`);
    chmodSync(fakePaths.opencode, 0o755);
    const parentScript = `
import pathlib, subprocess, sys, time
runner = subprocess.Popen([
    sys.executable, ${JSON.stringify(DELEGATE_PY)}, 'run', '--id', 'ORPHAN',
    '--task', 'orphan', '--role', 'implement', '--profile', 'flash',
    '--cwd', ${JSON.stringify(repoDir)}, '--card', ${JSON.stringify(cardPath)},
    '--out', ${JSON.stringify(outDir)}, '--confirmed',
], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
pathlib.Path(${JSON.stringify(runnerPidFile)}).write_text(str(runner.pid))
time.sleep(60)
`;
    const parent = spawn(PYTHON3, ['-c', parentScript], {
      env: { ...process.env, ...baseEnv }, detached: true, stdio: 'ignore',
    });
    try {
      await waitFor(() => existsSync(childPidFile) && existsSync(executorPidFile) && existsSync(runnerPidFile),
        20000, 'executor child start');
      const childPid = Number(readFileSync(childPidFile, 'utf8'));
      const executorPid = Number(readFileSync(executorPidFile, 'utf8'));
      const runnerPid = Number(readFileSync(runnerPidFile, 'utf8'));
      process.kill(parent.pid, 'SIGKILL');
      await waitFor(() => {
        try {
          return readLogRecords(atomicHome).some(record =>
            record.kind === 'run' && record.id === 'ORPHAN' && record.failure === 'orphaned');
        } catch {
          return false;
        }
      }, 20000, 'orphaned run record');
      const pidGone = pid => {
        try {
          process.kill(pid, 0);
          return false;
        } catch {
          return true;
        }
      };
      await waitFor(() => pidGone(childPid) && pidGone(executorPid) && pidGone(runnerPid),
        20000, 'orphaned executor process end');
      assert.ok(existsSync(heartbeat) && existsSync(childHeartbeat));
      const runningDir = join(atomicHome, 'delegate', 'running');
      const slots = existsSync(runningDir) ? readdirSync(runningDir).filter(name => name.endsWith('.json')) : [];
      assert.deepEqual(slots, []);
      for (const pid of [childPid, runnerPid]) {
        try { process.kill(pid, 'SIGKILL'); } catch { /* already gone */ }
      }
    } finally {
      try { process.kill(parent.pid, 'SIGKILL'); } catch { /* already gone */ }
    }
  });
  it('D4 R09 records slot wait separately from launch snapshot and execution duration', () => {
    const res = pythonHarness(`
d.RUNNING.mkdir(parents=True)
slot = d.RUNNING / ('opencode-held-%s.json' % os.getpid())
slot.write_text(json.dumps({'pid': os.getpid(), 'pgid':os.getpgrp(), 'process_start':d.process_identity(os.getpid())}))
def release():
 stdout = pathlib.Path(${JSON.stringify(join(outDir, 'queue.out.md'))})
 deadline = time.time() + 10
 while not stdout.exists() and time.time() < deadline: time.sleep(.01)
 assert stdout.exists(), 'runner never opened its wait output'
 queued = time.monotonic()
 while time.monotonic() < queued + 1.1: time.sleep(.01)
 subprocess.run(['git', '-C', ${JSON.stringify(repoDir)}, 'commit', '--allow-empty', '-m', 'queued commit'], check=True, stdout=subprocess.DEVNULL)
 slot.unlink()
thread = threading.Thread(target=release); thread.start()
rec = d.execute_run('queue', 'queue', 'implement', profile='flash', cwd=${JSON.stringify(repoDir)}, card=${JSON.stringify(cardPath)}, out=${JSON.stringify(outDir)}, wait_s=2, confirmed=True)
thread.join()
assert rec['duration_s'] < 1, rec
assert rec['wait_s'] >= 1, rec
assert rec['base'] == d.git(${JSON.stringify(repoDir)}, 'rev-parse', 'HEAD')[:10], rec
assert (d.now() - d.dt.datetime.fromisoformat(rec['started'])).total_seconds() < 1.5, rec
`, { DELEGATE_MAX_OPENCODE: '1' });
    assert.equal(res.status, 0, res.stderr);
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
  it('D4 R14 report accepts real pipeline pairs with null profiles', () => {
    const logDir = join(atomicHome, 'delegate'); mkdirSync(logDir, { recursive: true });
    writeFileSync(join(logDir, 'runs.jsonl'), [
      ['flash', 'codex-review', 'reviewed'], ['flash', null, 'gate_failed'], [null, null, 'no_executor'],
    ].map(([executor_profile, reviewer_profile, outcome]) => JSON.stringify({ kind: 'pipeline', executor_profile, reviewer_profile, outcome })).join('\n'));
    const res = runDelegate(['report'], baseEnv);
    assert.equal(res.status, 0, res.stderr); assert.match(res.stdout, /gate_failed 1/);
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

  // AS-D10a: the runner leaves no process behind.
  function pidAlive(pid) {
    try {
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  }

  function detachedExecutorFake(pidFile) {
    writeFileSync(fakePaths.opencode, `#!${PYTHON3}
import pathlib, subprocess, sys, time
child = subprocess.Popen([sys.executable, "-c",
                          "import signal, time; signal.signal(signal.SIGTERM, signal.SIG_IGN); time.sleep(600)"],
                         start_new_session=True,
                         stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
pathlib.Path(${JSON.stringify(pidFile)}).write_text(str(child.pid))
time.sleep(2.0)
sys.exit(0)
`);
    chmodSync(fakePaths.opencode, 0o755);
  }

  function implementArgs(id = 'T-ORPHAN') {
    return ['run', '--id', id, '--task', 'orphan sweep', '--role', 'implement',
      '--profile', 'flash', '--cwd', repoDir, '--card', cardPath,
      '--out', outDir, '--confirmed'];
  }

  it('AS-D10a kills a detached descendant, counts it, and status warns about it', async () => {
    const pidFile = join(root, 'detached.pid');
    detachedExecutorFake(pidFile);
    const res = runDelegate(implementArgs(), baseEnv);
    assert.equal(res.status, 0, res.stderr);
    const [rec] = readLogRecords(atomicHome);
    assert.equal(rec.failure, 'none');
    assert.ok(rec.orphans, JSON.stringify(rec));
    assert.equal(rec.orphans.found, 1, JSON.stringify(rec.orphans));
    assert.equal(rec.orphans.killed, 1, JSON.stringify(rec.orphans));
    assert.equal(rec.orphans.sample.length, 1, JSON.stringify(rec.orphans));
    assert.equal(typeof rec.orphans.sample[0], 'string');
    assert.ok(rec.orphans.sample[0].length <= 80, rec.orphans.sample[0]);
    const detachedPid = Number(readFileSync(pidFile, 'utf8'));
    await waitFor(() => !pidAlive(detachedPid), 20000, 'detached descendant end');
    const status = runDelegate(['status'], baseEnv);
    assert.equal(status.status, 0, status.stderr);
    assert.match(status.stdout, /warning: recent runs left 1 orphan process/);
  });

  it('AS-D10a never signals a process the executor did not start', async () => {
    const decoy = spawn(PYTHON3, ['-c', 'import time; time.sleep(600)'],
      { detached: true, stdio: 'ignore' });
    decoy.unref();
    const pidFile = join(root, 'detached.pid');
    try {
      detachedExecutorFake(pidFile);
      const res = runDelegate(implementArgs('T-NOT-MINE'), baseEnv);
      assert.equal(res.status, 0, res.stderr);
      const [rec] = readLogRecords(atomicHome);
      assert.equal(rec.orphans.found, 1, JSON.stringify(rec.orphans));
      assert.ok(!rec.orphans.sample.some(line => line.includes(String(decoy.pid))),
        JSON.stringify(rec.orphans.sample));
      assert.ok(pidAlive(decoy.pid), 'a process outside the executor tree must survive');
    } finally {
      try { process.kill(decoy.pid, 'SIGKILL'); } catch { /* already gone */ }
    }
  });

  it('AS-D10a A1 slot timeout exits non-zero and records slot_timeout, launching nothing', () => {
    const res = runDelegate([
      'run', '--id', 'T-SLOT-A1', '--task', 'slot gate', '--role', 'implement',
      '--profile', 'codex', '--cwd', repoDir, '--card', cardPath,
      '--out', outDir, '--wait', '0', '--confirmed',
    ], { ...baseEnv, DELEGATE_MAX_CODEX: '0' });
    assert.notEqual(res.status, 0);
    assert.match(res.stderr, /no free codex slot \(slot wait timed out\)/);
    const [rec] = readLogRecords(atomicHome);
    assert.equal(rec.failure, 'slot_timeout');
    assert.equal(rec.exit_code, null);
    assert.throws(() => readFileSync(argvFile), { code: 'ENOENT' });
  });

  it('AS-D10a A2 a plain review run with empty output is empty_output and exits non-zero', () => {
    const res = runDelegate(reviewArgs(['--diff-range', reviewRange()], 'agy-review'),
      { ...baseEnv, FAKE_STDOUT: '' });
    assert.equal(res.status, 1, res.stderr);
    const [rec] = readLogRecords(atomicHome);
    assert.equal(rec.failure, 'empty_output');
    assert.equal(rec.exit_code, 0);
    assert.equal(readFileSync(rec.stdout, 'utf8'), '');
  });

  it('AS-D10a A2 refuses a review card with {{DIFF_RANGE}} when no --diff-range is given', () => {
    const args = (extra = []) => ['run', '--id', 'T-PLACEHOLDER', '--task', 'placeholder',
      '--role', 'review', '--profile', 'codex-review', '--cwd', repoDir,
      '--card', reviewCardPath, '--out', outDir, '--confirmed', ...extra];
    const refused = runDelegate(args(), baseEnv);
    assert.equal(refused.status, 2, refused.stderr);
    assert.equal(refused.stderr.trim().split('\n').length, 1, refused.stderr);
    assert.match(refused.stderr, /^delegate: .*\{\{DIFF_RANGE\}\}.*--diff-range/);
    assert.throws(() => readFileSync(argvFile), { code: 'ENOENT' });
    assert.throws(() => readLogRecords(atomicHome), { code: 'ENOENT' });

    const accepted = runDelegate(args(['--diff-range', reviewRange()]), baseEnv);
    assert.equal(accepted.status, 0, accepted.stderr);
    assert.equal(readLogRecords(atomicHome)[0].failure, 'none');
  });

  it('AS-D10a A4 reusing an id keeps the earlier round output and points each record at its own', () => {
    const first = runDelegate(implementArgs('T-REUSE'), { ...baseEnv, FAKE_STDOUT: 'first round\n' });
    assert.equal(first.status, 0, first.stderr);
    const second = runDelegate(implementArgs('T-REUSE'), { ...baseEnv, FAKE_STDOUT: 'second round\n' });
    assert.equal(second.status, 0, second.stderr);
    const [firstRec, secondRec] = readLogRecords(atomicHome);
    assert.notEqual(secondRec.stdout, firstRec.stdout);
    assert.notEqual(secondRec.prompt, firstRec.prompt);
    assert.match(secondRec.stdout, /T-REUSE\.attempt2\.out\.md$/);
    assert.equal(readFileSync(firstRec.stdout, 'utf8'), 'first round\n');
    assert.equal(readFileSync(secondRec.stdout, 'utf8'), 'second round\n');
    assert.match(readFileSync(secondRec.prompt, 'utf8'), /^# Task CARD-1/);
  });

  it('AS-D10a text: detached processes are ended and host-only gates stay on the host', () => {
    const skill = readFileSync(join(REPO_ROOT, 'skills/core/delegate.md'), 'utf8');
    const card = readFileSync(join(REPO_ROOT, 'skills/shared/delegate-assets/card-template.md'), 'utf8');
    for (const text of [skill, card]) {
      assert.match(text, /afterEach/);
      assert.match(text, /`ps`/);
      assert.match(text, /Xcode|simulator|GUI/);
    }
    assert.match(skill, /orphans/);
    assert.match(skill, /codex.*SSH|SSH.*codex/);
  });

});

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

  function pipelineArgs(extra = []) {
    return ['pipeline', '--id', 'PIPE-RMT', '--task', 'remote pipeline', '--role', 'implement',
      '--cwd', repoDir, '--card', cardPath, '--route', 'flash,codex',
      '--gate', `touch '${join(root, 'gate-local.txt')}'`, '--review-card', reviewCardPath,
      '--review-route', 'codex-review,agy-review', '--out', outDir, '--confirmed',
      '--host', 'devbox', ...extra];
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

  it('R01 runs agy against the antigravity integration id', () => {
    const res = runDelegate(runArgs(['--profile', 'agy']), remoteEnv());
    assert.equal(res.status, 0, res.stderr);
    const [rec] = readLogRecords(atomicHome);
    assert.equal(rec.executor, 'agy');
    assert.equal(rec.failure, 'none');
  });

  it('R01 names the real integration id when agy is unavailable', () => {
    const doctor = {
      host: 'devbox', result: 'doctor-failed',
      checks: [
        { id: 'connection', status: 'ok', detail: 'ssh=devbox' },
        { id: 'integration-opencode', status: 'ok', detail: '/usr/local/bin/opencode' },
        { id: 'integration-antigravity', status: 'fail', detail: 'agy missing; run remote-runner provision --apply' },
      ],
    };
    const res = runDelegate(runArgs(['--profile', 'agy']), remoteEnv({ FAKE_REMOTE_DOCTOR_JSON: JSON.stringify(doctor) }));
    assert.equal(res.status, 1, res.stderr);
    const [rec] = readLogRecords(atomicHome);
    assert.equal(rec.failure, 'remote_not_ready');
    assert.match(rec.remote_error, /agy missing/);
    assert.doesNotMatch(remoteArgvText(), /"run"/);
  });

  it('R01 suggests setup-client with the antigravity id when the check is absent', () => {
    const doctor = {
      host: 'devbox', result: 'doctor-failed',
      checks: [{ id: 'connection', status: 'ok', detail: 'ssh=devbox' }],
    };
    const res = runDelegate(runArgs(['--profile', 'agy']), remoteEnv({ FAKE_REMOTE_DOCTOR_JSON: JSON.stringify(doctor) }));
    assert.equal(res.status, 1, res.stderr);
    const [rec] = readLogRecords(atomicHome);
    assert.match(rec.remote_error, /--integration antigravity/);
    assert.doesNotMatch(rec.remote_error, /--integration agy/);
  });

  it('refuses a host where the executor is missing or signed out', () => {
    const doctor = {
      host: 'devbox', result: 'doctor-failed',
      checks: [
        { id: 'connection', status: 'ok', detail: 'ssh=devbox' },
        { id: 'integration-opencode', status: 'fail', detail: 'missing; run remote-runner provision --apply' },
        { id: 'integration-opencode-auth', status: 'skip', detail: 'cannot be checked' },
      ],
    };
    const res = runDelegate(runArgs(), remoteEnv({ FAKE_REMOTE_DOCTOR_JSON: JSON.stringify(doctor) }));
    assert.equal(res.status, 1, res.stderr);
    const [rec] = readLogRecords(atomicHome);
    assert.equal(rec.failure, 'remote_not_ready');
    assert.match(rec.remote_error, /remote-runner provision --apply/);
    assert.doesNotMatch(remoteArgvText(), /"run"/);
  });

  it('turns remote-runner exit 74 into slot_timeout with the host', () => {
    const before = git(repoDir, 'rev-parse', 'HEAD');
    const res = runDelegate(runArgs(), remoteEnv({ FAKE_REMOTE_BUSY: '1' }));
    assert.equal(res.status, 1, res.stderr);
    const [rec] = readLogRecords(atomicHome);
    assert.equal(rec.failure, 'slot_timeout');
    assert.equal(rec.host, 'devbox');
    assert.equal(git(repoDir, 'rev-parse', 'HEAD'), before);
  });

  it('pipeline falls back to the next profile after a remote busy host', () => {
    const once = join(root, 'busy-once');
    const seq = join(root, 'remote-seq');
    mkdirSync(seq, { recursive: true });
    writeFileSync(join(seq, 'step_0.json'), JSON.stringify({ FAKE_COMMIT_FILE: 'pipeline-remote.txt' }));
    const res = runDelegate(pipelineArgs(), remoteEnv({
      FAKE_REMOTE_BUSY_ONCE_FILE: once,
      FAKE_SEQ_DIR: seq,
    }));
    assert.equal(res.status, 0, res.stderr);
    const rec = readLogRecords(atomicHome).at(-1);
    assert.equal(rec.kind, 'pipeline');
    assert.equal(rec.host, 'devbox');
    assert.equal(rec.outcome, 'reviewed');
    assert.equal(rec.attempts[0].failure, 'slot_timeout');
    assert.equal(rec.attempts[1].failure, 'none');
    assert.equal(existsSync(join(repoDir, 'pipeline-remote.txt')), true);
    assert.equal(existsSync(join(root, 'gate-local.txt')), true,
      'the host gate still runs locally after the fetch');
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
    assert.equal(rec.remote_work_kept.head, oldHead);
    assert.equal(rec.remote_work_kept.branch, 'main');
    assert.match(rec.remote_work_kept.dir, /\/kept-\d{8}T\d{6}Z$/);
    assert.equal(readFileSync(join(rec.remote_work_kept.dir, 'leftover-work.txt'), 'utf8'),
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

  it('commits uncommitted remote changes with the local runner message and fetches them', () => {
    const res = runDelegate(runArgs(), remoteEnv({ FAKE_TOUCH_FILE: 'remote-uncommitted.txt' }));
    assert.equal(res.status, 0, res.stderr);
    const [rec] = readLogRecords(atomicHome);
    assert.equal(rec.failure, 'none');
    assert.equal(rec.uncommitted, true);
    assert.equal(existsSync(join(repoDir, 'remote-uncommitted.txt')), true);
    assert.equal(git(repoDir, 'log', '-1', '--pretty=%s'),
      'RMT: remote task (committed by the delegate runner)');
    assert.notEqual(rec.sync.sent, rec.sync.received);
  });

  it('R03 turns a failed remote auto-commit into remote_error with the reason', () => {
    const hooks = join(root, 'hooks');
    mkdirSync(hooks, { recursive: true });
    const hook = join(hooks, 'pre-commit');
    writeFileSync(hook, '#!/bin/sh\necho "refused by test hook" >&2\nexit 1\n');
    chmodSync(hook, 0o755);
    const before = git(repoDir, 'rev-parse', 'HEAD');
    const res = runDelegate(runArgs(), remoteEnv({
      FAKE_TOUCH_FILE: 'remote-uncommitted.txt',
      GIT_CONFIG_COUNT: '1',
      GIT_CONFIG_KEY_0: 'core.hooksPath',
      GIT_CONFIG_VALUE_0: hooks,
    }));
    assert.equal(res.status, 1, res.stderr);
    const [rec] = readLogRecords(atomicHome);
    assert.equal(rec.failure, 'remote_error');
    assert.match(rec.remote_error, /remote auto-commit failed \(git exit [1-9]/);
    assert.match(rec.remote_error, /refused by test hook/);
    assert.equal(rec.uncommitted, true);
    assert.equal(git(repoDir, 'rev-parse', 'HEAD'), before,
      'a failed commit must not move the local branch');
    assert.equal(findFiles(remote.root, file => file.endsWith('/remote-uncommitted.txt')).length, 1,
      'the uncommitted remote work is still in the checkout');
  });

  it('fails a remote review that writes in the remote checkout without touching the local branch', () => {
    const base = git(repoDir, 'rev-parse', 'HEAD');
    writeFileSync(join(repoDir, 'review-input.txt'), 'review me\n');
    git(repoDir, 'add', 'review-input.txt');
    git(repoDir, 'commit', '-m', 'review input');
    const head = git(repoDir, 'rev-parse', 'HEAD');
    const res = runDelegate([
      'run', '--id', 'REV-RMT', '--task', 'remote review', '--role', 'review',
      '--profile', 'codex-review', '--cwd', repoDir, '--card', reviewCardPath,
      '--diff-range', `${base}..${head}`, '--out', outDir, '--confirmed',
      '--host', 'devbox',
    ], remoteEnv({ FAKE_TOUCH_FILE: 'remote-review-wrote.txt' }));
    assert.equal(res.status, 1, res.stderr);
    const [rec] = readLogRecords(atomicHome);
    assert.equal(rec.failure, 'review_wrote');
    assert.equal(git(repoDir, 'rev-parse', 'HEAD'), head);
    assert.equal(existsSync(join(repoDir, 'remote-review-wrote.txt')), false);
  });

  it('on timeout kills the remote run through remote-runner kill', () => {
    const res = runDelegate(runArgs(['--timeout', '1']), remoteEnv({ FAKE_SLEEP: '30' }));
    assert.equal(res.status, 1, res.stderr);
    const [rec] = readLogRecords(atomicHome);
    assert.equal(rec.failure, 'timeout');
    assert.equal(rec.timed_out, true);
    const killed = readFileSync(remote.killLog, 'utf8').trim();
    assert.match(killed, /^[0-9a-f-]{36}$/);
  });

  it('R02 kills only the run identified by this run marker, never the first new id', async () => {
    const foreignId = '00000000-0000-4000-8000-000000000001';
    const runsDir = join(remote.home, '.local/state/remote-runner/runs');
    mkdirSync(runsDir, { recursive: true });
    const foreign = spawn('sleep', ['30'], { detached: true, stdio: 'ignore' });
    foreign.unref();
    writeFileSync(join(runsDir, foreignId), `${foreign.pid}\nunknown\n`);
    try {
      const res = runDelegate(runArgs(['--timeout', '1']), remoteEnv({ FAKE_SLEEP: '30' }));
      assert.equal(res.status, 1, res.stderr);
      const [rec] = readLogRecords(atomicHome);
      assert.equal(rec.failure, 'timeout');
      const killed = readFileSync(remote.killLog, 'utf8').trim().split('\n').filter(Boolean);
      assert.equal(killed.length, 1, killed.join(','));
      assert.notEqual(killed[0], foreignId, 'must not kill another task run');
      assert.match(killed[0], /^[0-9a-f-]{36}$/);
      process.kill(foreign.pid, 0);
      const markers = findFiles(remote.root, file => file.includes('/.delegate-run-'));
      assert.equal(markers.length, 1, markers.join(','));
      assert.match(readFileSync(markers[0], 'utf8'), new RegExp('^' + killed[0] + ' alive pgid='));
    } finally {
      try { process.kill(-foreign.pid, 'SIGKILL'); } catch {}
    }
  });

  it('a remote review run with empty output is empty_output and exits non-zero', () => {
    const base = git(repoDir, 'rev-parse', 'HEAD');
    writeFileSync(join(repoDir, 'review-input.txt'), 'review me\n');
    git(repoDir, 'add', 'review-input.txt');
    git(repoDir, 'commit', '-m', 'review input');
    const head = git(repoDir, 'rev-parse', 'HEAD');
    const res = runDelegate([
      'run', '--id', 'REV-EMPTY-RMT', '--task', 'remote empty review', '--role', 'review',
      '--profile', 'agy-review', '--cwd', repoDir, '--card', reviewCardPath,
      '--diff-range', `${base}..${head}`, '--out', outDir, '--confirmed', '--host', 'devbox',
    ], remoteEnv({ FAKE_STDOUT: '' }));
    assert.equal(res.status, 1, res.stderr);
    const [rec] = readLogRecords(atomicHome);
    assert.equal(rec.failure, 'empty_output');
    assert.equal(rec.exit_code, 0);
    assert.equal(readFileSync(rec.stdout, 'utf8'), '');
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

  it('refuses a review card with {{DIFF_RANGE}} on --host before any remote call', () => {
    const res = runDelegate([
      'run', '--id', 'RMT-PLACEHOLDER', '--task', 'placeholder', '--role', 'review',
      '--profile', 'codex-review', '--cwd', repoDir, '--card', reviewCardPath,
      '--out', outDir, '--confirmed', '--host', 'devbox',
    ], remoteEnv());
    assert.equal(res.status, 2, res.stderr);
    assert.match(res.stderr, /\{\{DIFF_RANGE\}\}.*--diff-range/);
    assert.equal(remoteArgvText(), '');
    assert.throws(() => readLogRecords(atomicHome), { code: 'ENOENT' });
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

  it('profiles --host shows which executors are ready there', () => {
    const res = runDelegate(['profiles', '--host', 'devbox'], baseEnv);
    assert.equal(res.status, 0, res.stderr);
    assert.match(res.stdout, /^flash \| opencode \| .* \| host=devbox ready$/m);
    assert.match(res.stdout, /^agy \| agy \| .* \| host=devbox ready$/m);
    assert.equal(res.stdout.trim().split('\n').length, 18);
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
