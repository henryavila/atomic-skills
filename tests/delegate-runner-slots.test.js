import { describe, it, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { spawnSync, execFileSync, spawn } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout as pause } from 'node:timers/promises';
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
  PYTHON3,
  git,
  initGitRepo,
  makeFakeBin,
  runDelegate,
  runDelegateAsync,
  readLogRecords,
} from './helpers/delegate-runner-kit.js';

describe('delegate.py runner', () => {
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
  async function waitFor(predicate, timeoutMs, label) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (predicate()) return;
      await pause(50);
    }
    throw new Error(`${label} timed out after ${timeoutMs}ms`);
  }

  // Exercise the fallback even on interpreters that expose os.waitid.
  function withoutWaitid() {
    const siteDir = join(root, 'no-waitid');
    mkdirSync(siteDir, { recursive: true });
    writeFileSync(join(siteDir, 'sitecustomize.py'),
      'import os\nif hasattr(os, "waitid"): del os.waitid\n');
    return { PYTHONPATH: [siteDir, process.env.PYTHONPATH].filter(Boolean).join(':') };
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
        assert.equal(pipe.outcome, fallback ? 'reviewed' : stage === 'executor' ? 'no_executor' : 'review_pending');
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

    const exited = once(bgProc, 'exit', { signal: AbortSignal.timeout(20000) })
      .catch((error) => {
        if (error.name === 'AbortError') throw new Error('background runner still alive');
        throw error;
      });
    const killUnknown = runDelegate(['kill', 'T-UNKNOWN-ID'], baseEnv);
    assert.equal(killUnknown.status, 1);

    const killRes = runDelegate(['kill', 'T-KILL-TARGET'], baseEnv);
    assert.equal(killRes.status, 0, killRes.stderr);

    try {
      const [code, signal] = await exited;
      assert.ok(code !== null || signal !== null);
      await waitFor(() => {
        try {
          readFileSync(slotPath);
          return false;
        } catch (error) {
          return error.code === 'ENOENT';
        }
      }, 10000, 'killed runner slot removal');
    } finally {
      if (bgProc.exitCode === null && bgProc.signalCode === null) bgProc.kill('SIGTERM');
    }
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
  it('a runner killed outright is flagged by status and leaves a runner_lost record once its executor ends', async () => {
    const run = runDelegateAsync(['run', '--id', 'LOST', '--task', 'lost runner', '--role', 'implement',
      '--profile', 'flash', '--cwd', repoDir, '--card', cardPath, '--out', outDir, '--confirmed'],
    { ...baseEnv, FAKE_SLEEP: '60' });
    const runningDir = join(atomicHome, 'delegate', 'running');
    const slotNames = () => (existsSync(runningDir)
      ? readdirSync(runningDir).filter(name => name.endsWith('.json')) : []);
    let executorPid;
    try {
      await waitFor(() => slotNames().length === 1, 20000, 'slot file');
      executorPid = JSON.parse(readFileSync(join(runningDir, slotNames()[0]), 'utf8')).pid;
      run.child.kill('SIGKILL');
      await run.done;

      const status = runDelegate(['status'], baseEnv);
      assert.equal(status.status, 0, status.stderr);
      assert.match(status.stdout, /^LOST \|.*\| runner gone$/m);
      assert.match(status.stdout, /kill LOST/);
      assert.equal(existsSync(join(atomicHome, 'delegate', 'runs.jsonl')), false,
        'no record while the executor is still working');

      const killed = runDelegate(['kill', 'LOST'], baseEnv);
      assert.equal(killed.status, 0, killed.stderr);
      assert.deepEqual(slotNames(), []);
      const lost = readLogRecords(atomicHome).filter(r => r.id === 'LOST');
      assert.equal(lost.length, 1, JSON.stringify(lost));
      assert.equal(lost[0].kind, 'run');
      assert.equal(lost[0].failure, 'runner_lost');
      assert.equal(lost[0].executor, 'opencode');
      assert.equal(lost[0].role, 'implement');
      assert.ok(lost[0].started && lost[0].completed);

      runDelegate(['status'], baseEnv);
      assert.equal(readLogRecords(atomicHome).filter(r => r.id === 'LOST').length, 1);
      const report = runDelegate(['report'], baseEnv);
      assert.equal(report.status, 0, report.stderr);
    } finally {
      try { run.child.kill('SIGKILL'); } catch { /* already gone */ }
      if (executorPid) {
        try { process.kill(-executorPid, 'SIGKILL'); } catch { /* already gone */ }
      }
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
 while time.monotonic() < queued + 4.0: time.sleep(.01)
 subprocess.run(['git', '-C', ${JSON.stringify(repoDir)}, 'commit', '--allow-empty', '-m', 'queued commit'], check=True, stdout=subprocess.DEVNULL)
 slot.unlink()
thread = threading.Thread(target=release); thread.start()
rec = d.execute_run('queue', 'queue', 'implement', profile='flash', cwd=${JSON.stringify(repoDir)}, card=${JSON.stringify(cardPath)}, out=${JSON.stringify(outDir)}, wait_s=8, confirmed=True)
thread.join()
started = d.dt.datetime.fromisoformat(rec['started'])
completed = d.dt.datetime.fromisoformat(rec['completed'])
elapsed = (completed - started).total_seconds()
# duration_s is whole seconds; it must match the wall clock from the launch
# snapshot to completion (within rounding), whatever the machine speed.
assert abs(rec['duration_s'] - elapsed) <= 0.6, rec
# The slot was held for at least 4 s. A duration that counted that wait, or a
# started taken when the run queued, would be at least that long; the 2 s
# margin comes from the held slot, not from assuming a fast machine.
assert rec['wait_s'] >= 3.5, rec
assert elapsed < rec['wait_s'] - 2, rec
assert rec['base'] == d.git(${JSON.stringify(repoDir)}, 'rev-parse', 'HEAD')[:10], rec
`, { DELEGATE_MAX_OPENCODE: '1' });
    assert.equal(res.status, 0, res.stderr);
  });
});
