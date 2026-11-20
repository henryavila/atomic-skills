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
const REPO_ROOT = resolve(__dirname, '..', '..');
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

git_global_file = os.environ.get("FAKE_GIT_GLOBAL_FILE")
if git_global_file:
    listed = subprocess.run(["git", "config", "--global", "--list"], capture_output=True, text=True)
    pathlib.Path(git_global_file).write_text(json.dumps({
        "env": os.environ.get("GIT_CONFIG_GLOBAL"),
        "exit": listed.returncode,
        "list": listed.stdout,
    }))

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

early_touch = os.environ.get("FAKE_EARLY_TOUCH")
if early_touch:
    pathlib.Path(early_touch).write_text("left unfinished by fake\\n")

ticks = os.environ.get("FAKE_TICKS")
if ticks:
    tick_count, tick_gap = ticks.split(":")
    for tick in range(int(tick_count)):
        sys.stderr.write(f"tick {tick}\\n")
        sys.stderr.flush()
        time.sleep(float(tick_gap))

for round_no in range(int(os.environ.get("FAKE_COMMIT_ROUNDS", "0"))):
    pathlib.Path("round.txt").write_text(f"round {round_no}\\n")
    subprocess.run(["git", "add", "round.txt"], check=True)
    subprocess.run(["git", "commit", "-q", "-m", f"round {round_no}"], check=True)

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

function bundleBlobText(bundlePath) {
  const dir = mkdtempSync(join(tmpdir(), 'as-bundle-'));
  try {
    execFileSync('git', ['init', '-q', dir]);
    execFileSync('git', ['-C', dir, 'bundle', 'unbundle', bundlePath], { stdio: 'ignore' });
    const listed = execFileSync('git', ['-C', dir, 'cat-file', '--batch-all-objects',
      '--batch-check=%(objectname) %(objecttype)'], { encoding: 'utf8' }).trim();
    let text = '';
    for (const line of listed.split('\n').filter(Boolean)) {
      const [oid, type] = line.split(' ');
      if (type === 'blob') text += execFileSync('git', ['-C', dir, 'cat-file', 'blob', oid], { encoding: 'utf8' });
    }
    return text;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
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
    if (process.env.FAKE_REMOTE_BAD_META === '1') {
      const meta = path.join(mapped.local, 'meta.txt');
      if (fs.existsSync(meta)) {
        fs.writeFileSync(meta, fs.readFileSync(meta, 'utf8').replace(/^exit=.*$/m, 'exit=oops'));
      }
    }
  }
  process.exit(0);
}
if (cmd === 'run') {
  // Like the real CLI, the last stderr line is always the protocol result.
  process.on('exit', code => {
    const result = code === 0 ? 'ok' : code === 74 ? 'busy' : code === 124 ? 'timeout' : 'command-failed';
    try { fs.writeSync(2, 'remote-runner: result=' + result + ' exit=' + code + ' host=' + host + '\\n'); } catch {}
  });
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
  if (process.env.FAKE_REMOTE_BUSY === '1') {
    process.stderr.write('remote-runner: Host busy: load 9.10 is above 8\\n');
    process.exit(74);
  }
  // A failure of the CLI itself, before the command starts on the host.
  if (process.env.FAKE_REMOTE_RUN_EXIT) {
    process.stderr.write('remote-runner: Project is locked by another run\\n');
    process.exit(Number(process.env.FAKE_REMOTE_RUN_EXIT));
  }
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
    } else {
      process.exit(130);
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
      // The real CLI records the session leader and runs the command below
      // timeout and a login shell, so the pid of the command is never the
      // recorded one.
      ? cp.spawn('bash', ['-c', 'bash -c "$0"; exit $?', command[0]],
        { cwd: entry.remote, env, detached: true, stdio: 'inherit' })
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

// The runner refuses a --timeout below 60 seconds unless it is told the short
// value is meant. Tests use short limits all the time, so the helpers add the
// flag; a test of the refusal itself passes DELEGATE_TEST_STRICT_TIME.
function allowShortTimeout(args, env) {
  if (env.DELEGATE_TEST_STRICT_TIME || !['run', 'pipeline'].includes(args[0])
    || args.includes('--allow-short-timeout')) return args;
  return [...args, '--allow-short-timeout'];
}

function runDelegate(args, env = {}, cwd = undefined) {
  const childEnv = { ...process.env, ...env };
  for (const [key, value] of Object.entries(childEnv)) {
    if (value === undefined) delete childEnv[key];
  }
  return spawnSync(PYTHON3, [DELEGATE_PY, ...allowShortTimeout(args, env)], {
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

function runDelegateAsync(args, env = {}) {
  const childEnv = { ...process.env, ...env };
  for (const [key, value] of Object.entries(childEnv)) {
    if (value === undefined) delete childEnv[key];
  }
  const child = spawn(PYTHON3, [DELEGATE_PY, ...allowShortTimeout(args, env)], {
    env: childEnv, stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk) => { stdout += chunk; });
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  const done = new Promise((resolve) => {
    child.on('close', (status, signal) => resolve({ status, signal, stdout, stderr }));
  });
  return { child, done };
}

export {
  __dirname,
  REPO_ROOT,
  DELEGATE_PY,
  pythonProbe,
  hasPython3,
  PYTHON3,
  FAKE_SCRIPT,
  git,
  bundleBlobText,
  initGitRepo,
  makeFakeBin,
  FAKE_REMOTE_RUNNER,
  makeFakeRemoteRunner,
  runDelegate,
  readLogRecords,
  runDelegateAsync,
};
