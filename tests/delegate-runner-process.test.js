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
  runDelegateAsync,
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
  async function waitFor(predicate, timeoutMs, label) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (predicate()) return;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    throw new Error(`${label} timed out after ${timeoutMs}ms`);
  }

  // AS-D10a: the runner leaves no process behind.
  function pidAlive(pid) {
    try {
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  }

  // The writer creates the pid file before it writes the digits, so existence
  // is not enough: wait for a complete number, and read it as tolerantly when
  // cleaning up a test that failed early.
  function readPidFile(pidFile) {
    try {
      const text = readFileSync(pidFile, 'utf8').trim();
      return /^\d+$/.test(text) ? Number(text) : null;
    } catch {
      return null;
    }
  }

  async function waitForPidFile(pidFile, what) {
    let pid = null;
    await waitFor(() => {
      pid = readPidFile(pidFile);
      return pid !== null;
    }, 20000, what);
    return pid;
  }

  function detachedExecutorFake(pidFile, releaseFile, heartbeatFile) {
    writeFileSync(fakePaths.opencode, `#!${PYTHON3}
import pathlib, subprocess, sys, time
child_code = """import pathlib, signal, sys, time
signal.signal(signal.SIGTERM, signal.SIG_IGN)
h = pathlib.Path(sys.argv[1])
i = 0
while True:
    i += 1
    h.write_text(str(i))
    time.sleep(0.05)
"""
child = subprocess.Popen([sys.executable, "-c", child_code, ${JSON.stringify(heartbeatFile)}],
                         start_new_session=True,
                         stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
pathlib.Path(${JSON.stringify(pidFile)}).write_text(str(child.pid))
release = pathlib.Path(${JSON.stringify(releaseFile)})
deadline = time.time() + 60
while not release.exists() and time.time() < deadline:
    time.sleep(0.02)
sys.exit(0 if release.exists() else 1)
`);
    chmodSync(fakePaths.opencode, 0o755);
  }

  async function waitForDetachedPoll(heartbeat) {
    // The child heartbeat is the observable; 25 beats (at least 1.25 s) mean
    // the 0.5 s fast poll has run while the child was still attached, so its
    // new group is remembered before the executor exits.
    await waitFor(() => {
      try {
        return Number(readFileSync(heartbeat, 'utf8')) >= 25;
      } catch {
        return false;
      }
    }, 20000, 'detached child poll window');
  }

  function implementArgs(id = 'T-ORPHAN') {
    return ['run', '--id', id, '--task', 'orphan sweep', '--role', 'implement',
      '--profile', 'flash', '--cwd', repoDir, '--card', cardPath,
      '--out', outDir, '--confirmed'];
  }

  it('AS-D10a kills a detached descendant, counts it, and status warns about it', async () => {
    const pidFile = join(root, 'detached.pid');
    const release = join(root, 'detached.release');
    const heartbeat = join(root, 'detached.heartbeat');
    detachedExecutorFake(pidFile, release, heartbeat);
    const run = runDelegateAsync(implementArgs(), baseEnv);
    let detachedPid = null;
    try {
      detachedPid = await waitForPidFile(pidFile, 'detached child start');
      await waitForDetachedPoll(heartbeat);
      writeFileSync(release, 'go');
      const res = await run.done;
      assert.equal(res.status, 0, res.stderr);
      const [rec] = readLogRecords(atomicHome);
      assert.equal(rec.failure, 'none');
      assert.ok(rec.orphans, JSON.stringify(rec));
      assert.equal(rec.orphans.found, 1, JSON.stringify(rec.orphans));
      assert.equal(rec.orphans.killed, 1, JSON.stringify(rec.orphans));
      assert.equal(rec.orphans.tracked, true, JSON.stringify(rec.orphans));
      assert.ok(rec.orphans.polls >= 1, JSON.stringify(rec.orphans));
      assert.match(rec.orphans.method, /^(subreaper\+poll|poll)$/);
      assert.equal(rec.orphans.sample.length, 1, JSON.stringify(rec.orphans));
      assert.equal(typeof rec.orphans.sample[0], 'string');
      assert.ok(rec.orphans.sample[0].length <= 80, rec.orphans.sample[0]);
      await waitFor(() => !pidAlive(detachedPid), 20000, 'detached descendant end');
      const status = runDelegate(['status'], baseEnv);
      assert.equal(status.status, 0, status.stderr);
      assert.match(status.stdout, /warning: recent runs left 1 orphan process/);
    } finally {
      writeFileSync(release, 'go');
      if (detachedPid === null) {
        detachedPid = readPidFile(pidFile);
      }
      if (detachedPid) {
        try { process.kill(detachedPid, 'SIGKILL'); } catch { /* already gone */ }
      }
      if (run.child.exitCode === null) {
        try { run.child.kill('SIGKILL'); } catch { /* already gone */ }
      }
    }
  });

  it('AS-D10a never signals a process the executor did not start', async () => {
    const decoy = spawn(PYTHON3, ['-c', 'import time; time.sleep(600)'],
      { detached: true, stdio: 'ignore' });
    decoy.unref();
    const pidFile = join(root, 'detached.pid');
    const release = join(root, 'detached.release');
    const heartbeat = join(root, 'detached.heartbeat');
    detachedExecutorFake(pidFile, release, heartbeat);
    const run = runDelegateAsync(implementArgs('T-NOT-MINE'), baseEnv);
    let detachedPid = null;
    try {
      detachedPid = await waitForPidFile(pidFile, 'detached child start');
      await waitForDetachedPoll(heartbeat);
      writeFileSync(release, 'go');
      const res = await run.done;
      assert.equal(res.status, 0, res.stderr);
      const [rec] = readLogRecords(atomicHome);
      assert.equal(rec.orphans.found, 1, JSON.stringify(rec.orphans));
      assert.ok(!rec.orphans.sample.some(line => line.includes(String(decoy.pid))),
        JSON.stringify(rec.orphans.sample));
      assert.ok(pidAlive(decoy.pid), 'a process outside the executor tree must survive');
    } finally {
      writeFileSync(release, 'go');
      if (detachedPid === null) {
        detachedPid = readPidFile(pidFile);
      }
      if (detachedPid) {
        try { process.kill(detachedPid, 'SIGKILL'); } catch { /* already gone */ }
      }
      try { process.kill(decoy.pid, 'SIGKILL'); } catch { /* already gone */ }
      if (run.child.exitCode === null) {
        try { run.child.kill('SIGKILL'); } catch { /* already gone */ }
      }
    }
  });

  it('AS-D10a ends a child detached immediately before the executor exits', () => {
    const res = pythonHarness(`
pid_file = pathlib.Path(${JSON.stringify(join(root, 'immediate.pid'))})
release = pathlib.Path(${JSON.stringify(join(root, 'immediate.release'))})
child_code = """import signal, time
signal.signal(signal.SIGTERM, signal.SIG_IGN)
time.sleep(600)
"""
leader_code = """import pathlib, subprocess, sys, time
child = subprocess.Popen([sys.executable, "-c", %r], start_new_session=True)
pathlib.Path(%r).write_text(str(child.pid))
release = pathlib.Path(%r)
deadline = time.time() + 20
while not release.exists() and time.time() < deadline:
    time.sleep(.01)
""" % (child_code, str(pid_file), str(release))
leader = subprocess.Popen([sys.executable, "-c", leader_code], start_new_session=True)
tracker = d.ProcessTracker()
try:
 deadline = time.time() + 20
 while not pid_file.exists() and time.time() < deadline: time.sleep(.01)
 assert pid_file.exists()
 deadline = time.time() + 20
 while True:
  text = pid_file.read_text().strip() if pid_file.exists() else ""
  if text.isdigit():
   break
  assert time.time() < deadline, "the pid file stayed unreadable"
  time.sleep(.01)
 tracker.watch(leader.pid)
 child_pid = int(text)
 deadline = time.time() + 20
 while child_pid not in tracker.seen and time.time() < deadline: time.sleep(.01)
 assert child_pid in tracker.seen, tracker.seen
 release.write_text("go")
 leader.wait(timeout=20)
 tracker.poll(force=True)
 result = tracker.sweep()
 assert result["found"] >= 1, result
 assert result["killed"] >= 1, result
 assert result["tracked"] is True, result
 assert result["polls"] >= 1, result
 deadline = time.time() + 20
 while time.time() < deadline:
  try: os.kill(child_pid, 0)
  except ProcessLookupError: break
  time.sleep(.05)
 else: raise AssertionError("detached child survived the sweep")
finally:
 release.write_text("go")
 if pid_file.exists():
  text = pid_file.read_text().strip()
  if text.isdigit():
   try: os.kill(int(text), signal.SIGKILL)
   except ProcessLookupError: pass
 if leader.poll() is None: leader.kill(); leader.wait()
`);
    assert.equal(res.status, 0, res.stderr);
  });

  it('AS-D10a polls immediately for a run shorter than the interval', () => {
    const res = pythonHarness(`
pid_file = pathlib.Path(${JSON.stringify(join(root, 'short.pid'))})
release = pathlib.Path(${JSON.stringify(join(root, 'short.release'))})
child_code = """import signal, time
signal.signal(signal.SIGTERM, signal.SIG_IGN)
time.sleep(600)
"""
leader_code = """import pathlib, subprocess, sys, time
child = subprocess.Popen([sys.executable, "-c", %r], start_new_session=True)
pathlib.Path(%r).write_text(str(child.pid))
release = pathlib.Path(%r)
deadline = time.time() + 20
while not release.exists() and time.time() < deadline:
    time.sleep(.01)
""" % (child_code, str(pid_file), str(release))
leader = subprocess.Popen([sys.executable, "-c", leader_code], start_new_session=True)
tracker = d.ProcessTracker(interval=60)
try:
 deadline = time.time() + 20
 while not pid_file.exists() and time.time() < deadline: time.sleep(.01)
 assert pid_file.exists()
 deadline = time.time() + 20
 while True:
  text = pid_file.read_text().strip() if pid_file.exists() else ""
  if text.isdigit():
   break
  assert time.time() < deadline, "the pid file stayed unreadable"
  time.sleep(.01)
 child_pid = int(text)
 tracker.watch(leader.pid)
 assert tracker.polls == 1, tracker.polls
 assert child_pid in tracker.seen, tracker.seen
 started = time.monotonic()
 release.write_text("go")
 leader.wait(timeout=20)
 assert time.monotonic() - started < 60
 result = tracker.sweep()
 assert result["found"] >= 1, result
 assert result["killed"] >= 1, result
finally:
 release.write_text("go")
 if pid_file.exists():
  text = pid_file.read_text().strip()
  if text.isdigit():
   try: os.kill(int(text), signal.SIGKILL)
   except ProcessLookupError: pass
 if leader.poll() is None: leader.kill(); leader.wait()
`);
    assert.equal(res.status, 0, res.stderr);
  });

  it('AS-D10a never signals a remembered pid whose identity changed', () => {
    const res = pythonHarness(`
pid_file = pathlib.Path(${JSON.stringify(join(root, 'identity.pid'))})
child_code = """import signal, time
signal.signal(signal.SIGTERM, signal.SIG_IGN)
time.sleep(600)
"""
leader_code = """import pathlib, subprocess, sys, time
child = subprocess.Popen([sys.executable, "-c", %r], start_new_session=True)
pathlib.Path(%r).write_text(str(child.pid))
time.sleep(60)
""" % (child_code, str(pid_file))
leader = subprocess.Popen([sys.executable, "-c", leader_code], start_new_session=True)
tracker = d.ProcessTracker()
try:
 deadline = time.time() + 20
 while not pid_file.exists() and time.time() < deadline: time.sleep(.01)
 assert pid_file.exists()
 deadline = time.time() + 20
 while True:
  text = pid_file.read_text().strip() if pid_file.exists() else ""
  if text.isdigit():
   break
  assert time.time() < deadline, "the pid file stayed unreadable"
  time.sleep(.01)
 child_pid = int(text)
 tracker.watch(leader.pid)
 deadline = time.time() + 20
 while child_pid not in tracker.seen and time.time() < deadline: time.sleep(.01)
 assert child_pid in tracker.seen, tracker.seen
 original = tracker.seen[child_pid]
 table = tracker._table()
 tracker.seen[child_pid] = "forged"
 tracker._remember(child_pid, table)
 assert tracker.seen[child_pid] == original, tracker.seen[child_pid]
 tracker.seen[child_pid] = "forged"
 tracker.poll = lambda *args, **kwargs: None
 calls = []
 original_kill = os.kill
 def guarded(pid, sig):
  if pid == child_pid:
   calls.append((pid, sig))
   return None
  return original_kill(pid, sig)
 os.kill = guarded
 try:
  result = tracker.sweep()
 finally:
  os.kill = original_kill
 assert not calls, calls
 assert result["found"] == 0, result
 os.kill(child_pid, 0)
finally:
 if pid_file.exists():
  text = pid_file.read_text().strip()
  if text.isdigit():
   try: os.kill(int(text), signal.SIGKILL)
   except ProcessLookupError: pass
 if leader.poll() is None: leader.kill(); leader.wait()
`);
    assert.equal(res.status, 0, res.stderr);
  });

  it('AS-D10a the timeout path still sweeps a detached child', () => {
    const pidFile = join(root, 'timeout.pid');
    writeFileSync(fakePaths.opencode, `#!${PYTHON3}
import pathlib, subprocess, sys, time
child = subprocess.Popen([sys.executable, "-c",
                          "import signal, time; signal.signal(signal.SIGTERM, signal.SIG_IGN); time.sleep(600)"],
                         start_new_session=True,
                         stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
pathlib.Path(${JSON.stringify(pidFile)}).write_text(str(child.pid))
time.sleep(60)
`);
    chmodSync(fakePaths.opencode, 0o755);
    let detachedPid = null;
    try {
      const res = runDelegate([...implementArgs('T-TIMEOUT'), '--timeout', '1'], baseEnv);
      assert.notEqual(res.status, 0);
      const [rec] = readLogRecords(atomicHome);
      assert.equal(rec.timed_out, true, JSON.stringify(rec));
      assert.equal(rec.failure, 'timeout', JSON.stringify(rec));
      assert.equal(rec.orphans.found, 1, JSON.stringify(rec.orphans));
      assert.equal(rec.orphans.killed, 1, JSON.stringify(rec.orphans));
      assert.equal(rec.orphans.tracked, true, JSON.stringify(rec.orphans));
      detachedPid = Number(readFileSync(pidFile, 'utf8'));
      assert.equal(pidAlive(detachedPid), false, 'detached child survived the timeout sweep');
    } finally {
      if (detachedPid === null) {
        detachedPid = readPidFile(pidFile);
      }
      if (detachedPid) {
        try { process.kill(detachedPid, 'SIGKILL'); } catch { /* already gone */ }
      }
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
    assert.equal(rec.orphans.tracked, false, JSON.stringify(rec.orphans));
    assert.equal(rec.orphans.polls, 0, JSON.stringify(rec.orphans));
    assert.match(rec.orphans.method, /^(subreaper\+poll|poll)$/);
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

  it('AS-D10a standalone --diff-range replaces {{DIFF_RANGE}} in the card', () => {
    const range = reviewRange();
    const res = runDelegate(reviewArgs(['--diff-range', range], 'codex-review'), baseEnv);
    assert.equal(res.status, 0, res.stderr);
    const stdin = readFileSync(stdinFile, 'utf8');
    assert.doesNotMatch(stdin, /\{\{DIFF_RANGE\}\}/);
    assert.ok(stdin.includes(range), stdin);
  });

  it('AS-D10a reserves a distinct output stem per concurrent run of one id', () => {
    const res = pythonHarness(`
out = pathlib.Path(${JSON.stringify(join(root, 'stems'))})
out.mkdir(parents=True, exist_ok=True)
stems, errors = [], []
def choose():
 try:
  stems.append(d.run_output_paths(out, "same-id", 1)[0].name)
 except Exception as exc:
  errors.append(repr(exc))
threads = [threading.Thread(target=choose) for _ in range(8)]
for thread in threads: thread.start()
for thread in threads: thread.join()
assert not errors, errors
assert len(stems) == 8, stems
assert len(set(stems)) == 8, stems
for name in stems:
 prompt = out / name.replace(".out.md", ".prompt.md")
 assert prompt.exists(), prompt
`);
    assert.equal(res.status, 0, res.stderr);
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
    assert.match(skill, /every 0\.5 s for the first 10 s and then every 3 s/);
    assert.match(skill, /double-forks between two polls/);
    assert.match(skill, /last 10 runs/);
    assert.match(skill, /`tracked`, `polls`, and `method`/);
    assert.match(skill, /codex.*SSH|SSH.*codex/);
  });

});
