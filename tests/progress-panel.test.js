import { describe, it, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { spawnSync, execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  statSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { createHash } from 'node:crypto';
import { join, relative } from 'node:path';
import { tmpdir } from 'node:os';
import { parse as parseYaml } from 'yaml';

const REPO_ROOT = realpathSync(new URL('..', import.meta.url).pathname);
const PROGRESS_PY = join(REPO_ROOT, 'skills/shared/progress-assets/progress.py');
const PYTHON3 = process.env.PROGRESS_TEST_PYTHON
  || execFileSync('sh', ['-c', 'command -v python3'], { encoding: 'utf8' }).trim();
const PY_EXEC = execFileSync(PYTHON3, ['-c', 'import sys; print(sys.executable)'], {
  encoding: 'utf8',
}).trim();

function gitEnv(extra = {}) {
  return {
    ...process.env,
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_CONFIG_GLOBAL: '/dev/null',
    ...extra,
  };
}

function git(cwd, ...args) {
  return execFileSync('git', ['-C', cwd, ...args], {
    encoding: 'utf8',
    env: gitEnv(),
  }).trim();
}

function initGitRepo(dir) {
  execFileSync('git', ['init', '-q', '-b', 'main', dir], { env: gitEnv() });
  git(dir, 'config', 'user.email', 'test@example.com');
  git(dir, 'config', 'user.name', 'Test User');
  writeFileSync(join(dir, 'README.md'), 'init\n');
  git(dir, 'add', 'README.md');
  git(dir, 'commit', '-q', '-m', 'init');
}

function writeMap(repo, map, message = 'map') {
  const dir = join(repo, '.atomic-skills');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'marcos.json'), JSON.stringify(map, null, 2) + '\n');
  git(repo, 'add', '.atomic-skills/marcos.json');
  git(repo, 'commit', '-q', '-m', message);
}

function baseMap(overrides = {}) {
  return {
    schemaVersion: 1,
    id: 'app',
    title: 'App do Culto',
    unit: 'cartões',
    milestones: [{
      id: 'fundacao',
      title: 'Fundação',
      cards: [{ id: 'F-01', size: 'P' }],
    }],
    ...overrides,
  };
}

function sha256(data) {
  return createHash('sha256').update(data).digest('hex');
}

function snapshotTree(root) {
  const out = new Map();
  (function walk(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const abs = join(dir, entry.name);
      const rel = relative(root, abs);
      if (entry.isDirectory()) {
        out.set(rel, 'dir');
        walk(abs);
      } else {
        out.set(rel, sha256(readFileSync(abs)));
      }
    }
  })(root);
  return out;
}

describe('progress panel', { skip: false }, () => {
  let root;
  let home;
  let atomicHome;
  let project;
  let delegate;
  let delegateStatus;
  let aideck;
  let launchctl;
  let launchctlLog;
  let launchctlState;
  let env;

  beforeEach(() => {
    root = realpathSync(mkdtempSync(join(tmpdir(), 'as-panel-')));
    home = join(root, 'home');
    atomicHome = join(home, '.atomic-skills');
    mkdirSync(home, { recursive: true });
    mkdirSync(join(home, '.aideck'), { recursive: true });
    mkdirSync(atomicHome, { recursive: true });

    project = join(root, 'project');
    mkdirSync(project, { recursive: true });
    initGitRepo(project);

    delegate = join(root, 'fake-delegate.py');
    writeFileSync(
      delegate,
      `import os, pathlib, sys
if sys.argv[1:] != ["status", "--json"]:
    sys.stderr.write("unsupported args\\n")
    sys.exit(2)
path = os.environ.get("FAKE_DELEGATE_JSON")
if not path:
    print('{"active": []}')
else:
    print(pathlib.Path(path).read_text())
`,
    );
    delegateStatus = join(root, 'delegate-status.json');
    writeFileSync(delegateStatus, JSON.stringify({ paused: false, active: [] }));

    aideck = join(root, 'cli.js');
    writeFileSync(aideck, '#!/usr/bin/env node\n', { mode: 0o755 });

    launchctlLog = join(root, 'launchctl.log');
    launchctlState = join(root, 'launchctl-state');
    mkdirSync(launchctlState, { recursive: true });
    launchctl = join(root, 'fake-launchctl');
    writeFileSync(
      launchctl,
      `#!/bin/sh
printf '%s\\n' "$*" >> "$FAKE_LAUNCHCTL_LOG"
case "$1" in
  bootstrap)
    label=$(basename "$3" .plist)
    if [ -n "$FAKE_LAUNCHCTL_FAIL_BOOTSTRAP" ] && [ "$FAKE_LAUNCHCTL_FAIL_BOOTSTRAP" = "$label" ]; then
      echo "bootstrap refused $label" >&2
      exit 1
    fi
    if [ -n "$FAKE_LAUNCHCTL_FAIL_BOOTSTRAP_ONCE" ] && [ "$FAKE_LAUNCHCTL_FAIL_BOOTSTRAP_ONCE" = "$label" ] && [ ! -f "$FAKE_LAUNCHCTL_LOG.once" ]; then
      : > "$FAKE_LAUNCHCTL_LOG.once"
      echo "bootstrap refused once $label" >&2
      exit 1
    fi
    : > "$FAKE_LAUNCHCTL_STATE/$label"
    exit 0
    ;;
  bootout)
    label=\${2##*/}
    if [ -n "$FAKE_LAUNCHCTL_FAIL_BOOTOUT" ] && [ "$FAKE_LAUNCHCTL_FAIL_BOOTOUT" = "$label" ]; then
      echo "bootout refused $label" >&2
      exit 1
    fi
    if [ -f "$FAKE_LAUNCHCTL_STATE/$label" ]; then
      rm -f "$FAKE_LAUNCHCTL_STATE/$label"
      exit 0
    fi
    echo "Could not find service $label" >&2
    exit 113
    ;;
  print)
    label=\${2##*/}
    if [ -n "$FAKE_LAUNCHCTL_FAIL_PRINT" ] && [ "$FAKE_LAUNCHCTL_FAIL_PRINT" = "$label" ]; then
      echo "print failed $label" >&2
      exit 1
    fi
    if [ -f "$FAKE_LAUNCHCTL_STATE/$label" ]; then
      echo "loaded $label"
      exit 0
    fi
    echo "Could not find service $label" >&2
    exit 113
    ;;
  *)
    echo "unsupported: $*" >&2
    exit 2
    ;;
esac
`,
      { mode: 0o755 },
    );

    env = {
      ...gitEnv(),
      HOME: home,
      ATOMIC_SKILLS_HOME: atomicHome,
      PROGRESS_LAUNCHCTL: launchctl,
      FAKE_LAUNCHCTL_LOG: launchctlLog,
      FAKE_LAUNCHCTL_STATE: launchctlState,
      FAKE_DELEGATE_JSON: delegateStatus,
      DELEGATE_PY: delegate,
    };
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  function run(args, options = {}) {
    const res = spawnSync(PYTHON3, [PROGRESS_PY, ...args], {
      encoding: 'utf8',
      env: { ...env, ...(options.env || {}) },
      cwd: options.cwd || root,
      timeout: options.timeout || 30000,
    });
    return res;
  }

  function install(extra = [], options = {}) {
    return run(['panel', 'install', '--aideck', aideck, ...extra], options);
  }

  function register(repo, ref = 'main') {
    const res = run(['add', repo, '--ref', ref]);
    assert.equal(res.status, 0, `${res.stdout}\n${res.stderr}`);
  }

  function collect() {
    const out = join(root, 'out');
    const res = run(['collect', '--out', out, '--delegate', delegate]);
    assert.equal(res.status, 0, `${res.stdout}\n${res.stderr}`);
    return ['projetos', 'marcos', 'execucoes', 'alertas'].map((name) =>
      JSON.parse(readFileSync(join(out, `${name}.json`), 'utf8')));
  }

  function launchLines() {
    if (!existsSync(launchctlLog)) return [];
    return readFileSync(launchctlLog, 'utf8').split('\n').filter(Boolean);
  }

  function plist(path) {
    return JSON.parse(execFileSync(
      PYTHON3,
      ['-c', 'import json, plistlib, sys; print(json.dumps(plistlib.load(open(sys.argv[1], "rb"))))', path],
      { encoding: 'utf8', env },
    ));
  }

  const manifestPath = () => join(home, '.aideck/consumers/painel/manifest.yaml');
  const dataDir = () => join(home, '.aideck/consumers/painel/data');
  const statePath = () => join(atomicHome, 'progress/panel.json');
  const watchLabel = 'com.atomic-skills.progress.watch';
  const panelLabel = 'com.atomic-skills.progress.panel';
  const watchPlist = () => join(home, 'Library/LaunchAgents', `${watchLabel}.plist`);
  const panelPlist = () => join(home, 'Library/LaunchAgents', `${panelLabel}.plist`);

  function activeStatus(runs) {
    writeFileSync(delegateStatus, JSON.stringify({ paused: false, active: runs }));
  }

  // --------------------------------------------------------------- collector

  it('accepts weight 0 but rejects a map whose cards all weigh 0', () => {
    writeMap(project, baseMap({
      milestones: [{
        id: 'm',
        title: 'M',
        cards: [
          { id: 'Z-1', weight: 0 },
          { id: 'P-1', size: 'P' },
        ],
      }],
    }));
    let res = run(['validate', project, '--ref', 'main']);
    assert.equal(res.status, 0, res.stderr);

    writeMap(project, baseMap({
      milestones: [{
        id: 'm',
        title: 'M',
        cards: [
          { id: 'Z-1', weight: 0 },
          { id: 'Z-2', weight: 0 },
        ],
      }],
    }));
    res = run(['validate', project, '--ref', 'main']);
    assert.equal(res.status, 1);
    assert.match(res.stdout + res.stderr, /weigh 0/);

    for (const weight of [-1, '0', true]) {
      writeMap(project, baseMap({
        milestones: [{
          id: 'm',
          title: 'M',
          cards: [{ id: 'Z-1', weight }, { id: 'P-1', size: 'P' }],
        }],
      }));
      res = run(['validate', project, '--ref', 'main']);
      assert.equal(res.status, 1, `weight ${JSON.stringify(weight)} should fail`);
      assert.match(res.stdout + res.stderr, /\.weight/);
    }
  });

  it('counts zero-weight cards and writes titulo and legenda on milestone rows', () => {
    git(project, 'remote', 'add', 'origin', 'https://github.com/acme/app.git');
    writeMap(project, {
      schemaVersion: 1,
      id: 'zero',
      title: 'Zero',
      unit: 'cartões',
      milestones: [
        {
          id: 'zero',
          title: 'Sem peso',
          cards: [
            { id: 'Z-1', weight: 0, done: 'merged' },
            { id: 'Z-2', weight: 0, deps: ['P-0'] },
            { id: 'Z-3', weight: 0 },
            { id: 'Z-4', weight: 0 },
          ],
        },
        {
          id: 'positive',
          title: 'Com peso',
          cards: [{ id: 'P-0', size: 'P' }],
        },
      ],
    });
    activeStatus([{
      id: 'work Z-3 now',
      project: 'p',
      profile: 'flash',
      role: 'implement',
      machine: 'box',
      repo: 'acme/app',
      milestone: 'zero',
      remote: false,
      started: '2026-01-01T00:00:00+00:00',
      age_s: 60,
      idle_s: 1,
      runner_gone: false,
    }]);
    register(project);

    const [projetos, marcos, , alertas] = collect();
    assert.equal(alertas.filter((a) => a.tipo === 'mapa_invalido').length, 0);
    const zero = marcos.find((row) => row.marco === 'zero');
    assert.ok(zero, JSON.stringify(marcos));
    assert.equal(zero.titulo, 'Sem peso');
    assert.equal(zero.total, 0);
    assert.equal(zero.feito, 0);
    assert.equal(zero.pct, 0);
    assert.equal(zero.prontos, 1);
    assert.equal(zero.bloqueados, 1);
    assert.equal(zero.rodando, 1);
    assert.equal(zero.legenda, '1 de 4 prontos · 1 bloqueado · 1 rodando');
    assert.equal(zero.resumo, 'sem peso · 1 de 4 prontos');
    assert.equal(projetos[0].total, 1);
    assert.equal(projetos[0].feito, 0);
    assert.equal(projetos[0].pct, 0);
  });

  it('uses plural bloqueados in the legenda and keeps previous rows as they were', () => {
    writeMap(project, baseMap({
      milestones: [{
        id: 'm',
        title: 'M',
        cards: [
          { id: 'P-1', size: 'P', done: 'merged' },
          { id: 'P-2', size: 'P', deps: ['P-4'] },
          { id: 'P-3', size: 'P', deps: ['P-4'] },
          { id: 'P-4', size: 'P' },
        ],
      }],
    }));
    register(project);
    let [, marcos] = collect();
    assert.equal(marcos[0].legenda, '1 de 4 prontos · 2 bloqueados');

    const realGit = execFileSync('sh', ['-c', 'command -v git'], { encoding: 'utf8' }).trim();
    const shim = join(root, 'git-log-shim');
    mkdirSync(shim, { recursive: true });
    writeFileSync(
      join(shim, 'git'),
      `#!/bin/sh
for arg in "$@"; do
  if [ "$arg" = "log" ]; then
    echo "refused" >&2
    exit 128
  fi
done
exec ${JSON.stringify(realGit)} "$@"
`,
      { mode: 0o755 },
    );
    const out = join(root, 'out');
    const res = run(['collect', '--out', out, '--delegate', delegate], {
      env: { PATH: `${shim}:${env.PATH}` },
    });
    assert.equal(res.status, 0, res.stderr);
    const kept = JSON.parse(readFileSync(join(out, 'marcos.json'), 'utf8'));
    assert.deepEqual(kept, marcos);
  });

  it('builds PATH from the unresolved executable directory', () => {
    const script = `
import importlib.util, pathlib, sys
spec = importlib.util.spec_from_file_location("progress", sys.argv[1])
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
root = pathlib.Path(sys.argv[2])
real = root / "real"
real.mkdir()
link = root / "link"
link.symlink_to(real, target_is_directory=True)
node = link / "node"
node.write_text("")
module.sys.executable = str(link / "python")
module.shutil.which = lambda name: str(node) if name == "node" else None
parts = module.panel_path().split(":")
assert str(link) in parts, module.panel_path()
assert str(real) not in parts, module.panel_path()
`;
    const res = spawnSync(PYTHON3, ['-c', script, PROGRESS_PY, root], {
      encoding: 'utf8',
      env,
      cwd: root,
      timeout: 30000,
    });
    assert.equal(res.status, 0, `${res.stdout}\n${res.stderr}`);
  });

  it('makes the delegate path absolute and omits a missing one', () => {
    const relative = 'relative-delegate.py';
    writeFileSync(join(root, relative), 'print("delegate")\n');
    let res = install([], { env: { DELEGATE_PY: relative } });
    assert.equal(res.status, 0, `${res.stdout}\n${res.stderr}`);
    let args = plist(watchPlist()).ProgramArguments;
    assert.deepEqual(args.slice(-2), ['--delegate', join(root, relative)]);
    assert.ok(!args.includes(relative), args.join(' '));

    res = run(['panel', 'uninstall']);
    assert.equal(res.status, 0, res.stderr);
    res = install([], { env: { DELEGATE_PY: join(root, 'missing-delegate.py') } });
    assert.equal(res.status, 0, `${res.stdout}\n${res.stderr}`);
    args = plist(watchPlist()).ProgramArguments;
    assert.ok(!args.includes('--delegate'), args.join(' '));
  });

  // ---------------------------------------------------------------- install

  it('creates exactly the listed files and bootstraps both labels', () => {
    writeMap(project, baseMap({ id: 'app', title: 'App do Culto' }));
    register(project);

    const before = snapshotTree(home);
    const res = install();
    assert.equal(res.status, 0, `${res.stdout}\n${res.stderr}`);

    const after = snapshotTree(home);
    const addedFiles = [...after.keys()]
      .filter((key) => after.get(key) !== 'dir' && before.get(key) !== after.get(key))
      .sort();
    assert.deepEqual(addedFiles, [
      relative(home, manifestPath()),
      relative(home, panelPlist()),
      relative(home, statePath()),
      relative(home, watchPlist()),
    ].sort());
    assert.ok(existsSync(dataDir()) && statSync(dataDir()).isDirectory());
    assert.ok(existsSync(join(atomicHome, 'progress/logs')));

    const doc = parseYaml(readFileSync(manifestPath(), 'utf8'));
    assert.equal(doc.locale, 'pt-BR');
    assert.deepEqual(doc.dataSources.map((item) => item.id), [
      'projetos', 'marcos', 'execucoes', 'alertas',
    ]);
    const section = doc.pages[0].sections.find((item) => item.title === 'App do Culto');
    assert.ok(section, JSON.stringify(doc.pages[0].sections));
    assert.deepEqual(section.widgets[0].source, {
      ref: 'marcos',
      filter: { projeto: 'app' },
    });
    assert.equal(section.widgets[0].config.unit, 'cartões');

    const state = JSON.parse(readFileSync(statePath(), 'utf8'));
    assert.equal(state.schemaVersion, 1);
    assert.equal(state.port, 7777);
    assert.equal(state.aideck, realpathSync(aideck));
    assert.deepEqual(Object.keys(state.files).sort(), [
      manifestPath(), panelPlist(), watchPlist(),
    ].sort());
    for (const [path, digest] of Object.entries(state.files)) {
      assert.equal(sha256(readFileSync(path)), digest, path);
    }
    const allowedDirs = [
      join(home, '.aideck/consumers/painel'),
      dataDir(),
      join(atomicHome, 'progress'),
      join(atomicHome, 'progress/logs'),
    ];
    for (const dir of state.createdDirs) {
      assert.ok(allowedDirs.includes(dir), `unexpected createdDir ${dir}`);
    }

    const bootstraps = launchLines().filter((line) => line.startsWith('bootstrap '));
    assert.equal(bootstraps.length, 2, launchLines().join('\n'));
    assert.match(bootstraps[0], /com\.atomic-skills\.progress\.watch\.plist$/);
    assert.match(bootstraps[1], /com\.atomic-skills\.progress\.panel\.plist$/);
  });

  it('writes only PATH and ATOMIC_SKILLS_HOME and never --expose', () => {
    install();
    const watch = plist(watchPlist());
    const panel = plist(panelPlist());

    for (const value of [watch, panel]) {
      assert.equal(value.RunAtLoad, true);
      assert.equal(value.KeepAlive, true);
      assert.equal(value.ThrottleInterval, 30);
      assert.equal(value.WorkingDirectory, join(atomicHome, 'progress'));
      assert.equal(value.StandardOutPath, join(atomicHome, 'progress/logs', `${value.Label}.log`));
      assert.equal(value.StandardErrorPath, value.StandardOutPath);
      assert.deepEqual(Object.keys(value.EnvironmentVariables).sort(), [
        'ATOMIC_SKILLS_HOME', 'PATH',
      ]);
      assert.equal(value.EnvironmentVariables.ATOMIC_SKILLS_HOME, atomicHome);
      assert.match(value.EnvironmentVariables.PATH, /\/usr\/bin/);
    }

    const args = watch.ProgramArguments;
    assert.equal(args[0], PY_EXEC);
    assert.equal(args[1], PROGRESS_PY);
    assert.deepEqual(args.slice(2, 9), [
      'watch', '--out', dataDir(), '--interval', '2', '--fetch-every', '120',
    ]);
    assert.deepEqual(args.slice(9), ['--delegate', delegate]);

    assert.equal(panel.ProgramArguments[1], realpathSync(aideck));
    assert.deepEqual(panel.ProgramArguments.slice(2), ['serve', '--port=7777']);
    assert.ok(!panel.ProgramArguments.includes('--expose'));
    assert.ok(!watch.ProgramArguments.includes('--expose'));
  });

  it('returns the temp HOME to its exact prior state after install and uninstall', () => {
    mkdirSync(join(home, '.aideck/consumers'), { recursive: true });
    mkdirSync(join(home, 'Library/LaunchAgents'), { recursive: true });
    const before = snapshotTree(home);
    let res = install();
    assert.equal(res.status, 0, res.stderr);
    res = run(['panel', 'uninstall']);
    assert.equal(res.status, 0, `${res.stdout}\n${res.stderr}`);
    assert.deepEqual(snapshotTree(home), before);
    assert.ok(!existsSync(statePath()));
  });

  it('refuses every invalid install without changing anything', () => {
    const before = snapshotTree(home);

    let res = install(['--port', '80']);
    assert.equal(res.status, 1);
    assert.deepEqual(snapshotTree(home), before);

    res = install(['--port', '65536']);
    assert.equal(res.status, 1);
    assert.deepEqual(snapshotTree(home), before);

    res = install(['--port', 'nope']);
    assert.equal(res.status, 1);
    assert.deepEqual(snapshotTree(home), before);

    res = run(['panel', 'install', '--aideck', join(root, 'missing.js')]);
    assert.equal(res.status, 1);
    assert.deepEqual(snapshotTree(home), before);

    const emptyBin = join(root, 'empty-bin');
    mkdirSync(emptyBin, { recursive: true });
    res = install([], { env: { PATH: emptyBin } });
    assert.equal(res.status, 1);
    assert.match(res.stderr, /node/);
    assert.deepEqual(snapshotTree(home), before);

    mkdirSync(join(home, '.aideck/consumers/painel'), { recursive: true });
    writeFileSync(manifestPath(), 'user: manifest\n');
    let guarded = snapshotTree(home);
    res = install();
    assert.equal(res.status, 1);
    assert.deepEqual(snapshotTree(home), guarded);
    rmSync(manifestPath());

    mkdirSync(join(home, 'Library/LaunchAgents'), { recursive: true });
    writeFileSync(watchPlist(), 'user plist\n');
    guarded = snapshotTree(home);
    res = install();
    assert.equal(res.status, 1);
    assert.deepEqual(snapshotTree(home), guarded);
    rmSync(watchPlist());

    assert.deepEqual(launchLines(), [], 'a refusal must not call launchctl');
    assert.ok(!existsSync(statePath()));
  });

  it('does nothing and loads nothing on an identical reinstall', () => {
    install();
    const before = snapshotTree(home);
    const stateBefore = readFileSync(statePath(), 'utf8');
    const callsBefore = launchLines().length;

    const res = install();
    assert.equal(res.status, 0, res.stderr);
    assert.deepEqual(snapshotTree(home), before);
    assert.equal(readFileSync(statePath(), 'utf8'), stateBefore);
    const callsAfter = launchLines().slice(callsBefore);
    assert.ok(
      callsAfter.every((line) => line.startsWith('print ')),
      callsAfter.join('\n'),
    );
    assert.ok(existsSync(join(launchctlState, watchLabel)));
    assert.ok(existsSync(join(launchctlState, panelLabel)));
  });

  it('bootstraps only a label that is down on an identical reinstall', () => {
    install();
    unlinkSync(join(launchctlState, watchLabel));
    const before = snapshotTree(home);
    const callsBefore = launchLines().length;

    const res = install();
    assert.equal(res.status, 0, `${res.stdout}\n${res.stderr}`);
    assert.deepEqual(snapshotTree(home), before);
    const callsAfter = launchLines().slice(callsBefore);
    assert.equal(
      callsAfter.filter((line) => line.startsWith('bootstrap ')).length,
      1,
      callsAfter.join('\n'),
    );
    assert.match(
      callsAfter.find((line) => line.startsWith('bootstrap ')),
      /com\.atomic-skills\.progress\.watch\.plist$/,
    );
    assert.ok(existsSync(join(launchctlState, watchLabel)));
    assert.ok(existsSync(join(launchctlState, panelLabel)));
  });

  it('rolls back every created file and directory when the second bootstrap fails', () => {
    mkdirSync(join(home, '.aideck/consumers'), { recursive: true });
    mkdirSync(join(home, 'Library/LaunchAgents'), { recursive: true });
    const before = snapshotTree(home);
    const res = install([], {
      env: { FAKE_LAUNCHCTL_FAIL_BOOTSTRAP: panelLabel },
    });
    assert.equal(res.status, 1, res.stdout);
    assert.deepEqual(snapshotTree(home), before);
    assert.ok(!existsSync(statePath()));
    assert.ok(!existsSync(manifestPath()));
    assert.ok(!existsSync(watchPlist()));
    const lines = launchLines();
    assert.ok(lines.some((line) => line.startsWith('bootout ')), lines.join('\n'));
    assert.deepEqual(readdirSync(launchctlState), []);
  });

  it('reinstalls with different arguments, booting the old labels out', () => {
    install();
    const callsBefore = launchLines().length;
    const oldState = JSON.parse(readFileSync(statePath(), 'utf8'));

    const res = install(['--port', '8123']);
    assert.equal(res.status, 0, `${res.stdout}\n${res.stderr}`);

    const state = JSON.parse(readFileSync(statePath(), 'utf8'));
    assert.equal(state.port, 8123);
    assert.equal(state.files[manifestPath()], sha256(readFileSync(manifestPath())));
    assert.equal(state.files[watchPlist()], sha256(readFileSync(watchPlist())));
    assert.equal(state.files[panelPlist()], sha256(readFileSync(panelPlist())));
    assert.notEqual(state.files[panelPlist()], oldState.files[panelPlist()]);
    assert.deepEqual(plist(panelPlist()).ProgramArguments.slice(2), ['serve', '--port=8123']);

    const callsAfter = launchLines().slice(callsBefore);
    assert.equal(
      callsAfter.filter((line) => line.startsWith('bootout ')).length,
      2,
      callsAfter.join('\n'),
    );
    assert.equal(
      callsAfter.filter((line) => line.startsWith('bootstrap ')).length,
      2,
      callsAfter.join('\n'),
    );
    assert.ok(existsSync(join(launchctlState, watchLabel)));
    assert.ok(existsSync(join(launchctlState, panelLabel)));
  });

  it('restores the old service after a failed reinstall with different arguments', () => {
    install();
    const manifestBefore = readFileSync(manifestPath());
    const watchBefore = readFileSync(watchPlist());
    const panelBefore = readFileSync(panelPlist());
    const stateBefore = readFileSync(statePath(), 'utf8');
    const callsBefore = launchLines().length;

    const res = install(['--port', '8123'], {
      env: { FAKE_LAUNCHCTL_FAIL_BOOTSTRAP_ONCE: panelLabel },
    });
    assert.equal(res.status, 1, res.stdout);
    assert.match(res.stderr, /install failed/);
    assert.deepEqual(readFileSync(manifestPath()), manifestBefore);
    assert.deepEqual(readFileSync(watchPlist()), watchBefore);
    assert.deepEqual(readFileSync(panelPlist()), panelBefore);
    assert.equal(readFileSync(statePath(), 'utf8'), stateBefore);
    assert.equal(JSON.parse(stateBefore).port, 7777);
    assert.ok(existsSync(join(launchctlState, watchLabel)));
    assert.ok(existsSync(join(launchctlState, panelLabel)));

    const callsAfter = launchLines().slice(callsBefore);
    assert.ok(
      callsAfter.some((line) => line.startsWith('bootout ')
        && line.endsWith(`/${watchLabel}`)),
      callsAfter.join('\n'),
    );
    assert.equal(
      callsAfter.filter((line) => line.startsWith('bootstrap ')).length,
      4,
      callsAfter.join('\n'),
    );
  });

  it('names the labels still down when the restored service cannot be bootstrapped', () => {
    install();
    const res = install(['--port', '8123'], {
      env: { FAKE_LAUNCHCTL_FAIL_BOOTSTRAP: panelLabel },
    });
    assert.equal(res.status, 1, res.stdout);
    assert.match(res.stderr, /install failed/);
    assert.match(res.stderr, new RegExp(`${panelLabel} down`));
    assert.match(res.stderr, /launchctl bootstrap gui\/\d+ .*panel\.plist/);
    assert.ok(existsSync(join(launchctlState, watchLabel)));
    assert.ok(!existsSync(join(launchctlState, panelLabel)));
  });

  it('names the label left down when a reinstall bootout partly succeeds', () => {
    install();
    const stateBefore = readFileSync(statePath(), 'utf8');
    const manifestBefore = readFileSync(manifestPath());
    const res = install(['--port', '8123'], {
      env: { FAKE_LAUNCHCTL_FAIL_BOOTOUT: panelLabel },
    });
    assert.equal(res.status, 1, res.stdout);
    assert.match(res.stderr, new RegExp(`${watchLabel} is down`));
    assert.match(res.stderr, /launchctl bootstrap gui\/\d+ .*watch\.plist/);
    assert.equal(readFileSync(statePath(), 'utf8'), stateBefore);
    assert.deepEqual(readFileSync(manifestPath()), manifestBefore);
    assert.ok(!existsSync(join(launchctlState, watchLabel)));
    assert.ok(existsSync(join(launchctlState, panelLabel)));
  });

  it('refuses a reinstall when the manifest was edited and leaves launchctl alone', () => {
    install();
    writeFileSync(manifestPath(), 'user: edited\n');
    const before = snapshotTree(home);
    const callsBefore = launchLines().length;

    const res = install();
    assert.equal(res.status, 1);
    assert.match(res.stderr, /already exists|edited|same content|does not record/);
    assert.deepEqual(snapshotTree(home), before);
    assert.equal(launchLines().length, callsBefore);
  });

  // -------------------------------------------------------------- uninstall

  it('removes the two log files and reports a directory it cannot remove', () => {
    install();
    mkdirSync(join(atomicHome, 'progress/logs'), { recursive: true });
    writeFileSync(join(atomicHome, 'progress/logs', `${watchLabel}.log`), 'watch log\n');
    writeFileSync(join(atomicHome, 'progress/logs', `${panelLabel}.log`), 'panel log\n');

    const res = run(['panel', 'uninstall']);
    assert.equal(res.status, 0, `${res.stdout}\n${res.stderr}`);
    assert.ok(!existsSync(join(atomicHome, 'progress/logs', `${watchLabel}.log`)));
    assert.ok(!existsSync(join(atomicHome, 'progress/logs', `${panelLabel}.log`)));
    assert.ok(!existsSync(join(atomicHome, 'progress/logs')));

    install();
    writeFileSync(join(dataDir(), 'user-file.txt'), 'keep me\n');
    const second = run(['panel', 'uninstall']);
    assert.equal(second.status, 0, `${second.stdout}\n${second.stderr}`);
    assert.match(second.stderr, /left .*data/);
    assert.match(second.stderr, /not empty|directory/i);
    assert.ok(existsSync(join(dataDir(), 'user-file.txt')));
  });

  it('removes only the empty shared roots when it created none of them', () => {
    rmSync(join(home, '.aideck'), { recursive: true, force: true });
    rmSync(atomicHome, { recursive: true, force: true });
    rmSync(join(home, 'Library'), { recursive: true, force: true });
    assert.ok(!existsSync(join(home, '.aideck')));
    assert.ok(!existsSync(atomicHome));
    assert.ok(!existsSync(join(home, 'Library')));

    let res = install();
    assert.equal(res.status, 0, `${res.stdout}\n${res.stderr}`);
    res = run(['panel', 'uninstall']);
    assert.equal(res.status, 0, `${res.stdout}\n${res.stderr}`);

    assert.ok(existsSync(join(home, '.aideck')));
    assert.ok(existsSync(join(home, '.aideck/consumers')));
    assert.ok(existsSync(atomicHome));
    assert.ok(existsSync(join(home, 'Library/LaunchAgents')));
    for (const path of [
      join(home, '.aideck/consumers/painel'),
      join(atomicHome, 'progress'),
      join(home, 'Library/LaunchAgents', `${watchLabel}.plist`),
    ]) {
      assert.ok(!existsSync(path), path);
    }
    assert.deepEqual(readdirSync(join(home, '.aideck/consumers')), []);
    assert.deepEqual(readdirSync(atomicHome), []);
    assert.deepEqual(readdirSync(join(home, 'Library/LaunchAgents')), []);
  });

  it('keeps the four data files when data/ was not created by install', () => {
    mkdirSync(dataDir(), { recursive: true });
    writeFileSync(join(dataDir(), 'projetos.json'), 'user data\n');
    const res = install();
    assert.equal(res.status, 1);
    assert.match(res.stderr, /projetos\.json.*already exists/);
    assert.equal(readFileSync(join(dataDir(), 'projetos.json'), 'utf8'), 'user data\n');
    assert.ok(!existsSync(statePath()));

    rmSync(join(dataDir(), 'projetos.json'));
    const created = install();
    assert.equal(created.status, 0, `${created.stdout}\n${created.stderr}`);
    const state = JSON.parse(readFileSync(statePath(), 'utf8'));
    state.createdDirs = state.createdDirs.filter((item) => item !== dataDir());
    writeFileSync(statePath(), JSON.stringify(state, null, 2) + '\n');
    writeFileSync(join(dataDir(), 'projetos.json'), '[]\n');
    const removed = run(['panel', 'uninstall']);
    assert.equal(removed.status, 0, `${removed.stdout}\n${removed.stderr}`);
    assert.equal(readFileSync(join(dataDir(), 'projetos.json'), 'utf8'), '[]\n');
    assert.ok(existsSync(dataDir()));
  });

  it('refuses a tampered state before booting anything out', () => {
    const cases = [
      (state) => { state.files[join(root, 'evil')] = 'x'; },
      (state) => { state.createdDirs = state.createdDirs.join(','); },
      (state) => { state.createdDirs.push(7); },
      (state) => { state.createdDirs.push(join(root, 'evil')); },
    ];
    for (const tamper of cases) {
      install();
      const original = JSON.parse(readFileSync(statePath(), 'utf8'));
      const state = JSON.parse(JSON.stringify(original));
      tamper(state);
      writeFileSync(statePath(), JSON.stringify(state, null, 2) + '\n');
      const stateBefore = readFileSync(statePath(), 'utf8');
      const callsBefore = launchLines().length;
      const res = run(['panel', 'uninstall']);
      assert.equal(res.status, 1, `${res.stdout}\n${res.stderr}`);
      assert.match(res.stderr, /panel\.json/);
      assert.equal(readFileSync(statePath(), 'utf8'), stateBefore);
      assert.equal(launchLines().length, callsBefore, 'no bootout on a tampered state');
      assert.ok(existsSync(join(launchctlState, watchLabel)));
      assert.ok(existsSync(join(launchctlState, panelLabel)));
      writeFileSync(statePath(), JSON.stringify(original, null, 2) + '\n');
      const cleanup = run(['panel', 'uninstall']);
      assert.equal(cleanup.status, 0, `${cleanup.stdout}\n${cleanup.stderr}`);
    }
  });

  it('refuses a symlink at the manifest, a plist, the consumer, data or an output file', () => {
    install();
    const target = join(root, 'target');
    writeFileSync(target, 'outside\n');
    const cases = [
      manifestPath(),
      watchPlist(),
      panelPlist(),
      join(home, '.aideck/consumers/painel'),
      dataDir(),
      ...['projetos', 'marcos', 'execucoes', 'alertas']
        .map((name) => join(dataDir(), `${name}.json`)),
    ];
    for (const link of cases) {
      const res = run(['panel', 'uninstall']);
      assert.equal(res.status, 0, `${res.stdout}\n${res.stderr}`);
      rmSync(link, { recursive: true, force: true });
      mkdirSync(join(link, '..'), { recursive: true });
      symlinkSync(target, link);
      const before = readFileSync(target, 'utf8');
      const callsBefore = launchLines().length;
      const refused = install();
      assert.equal(refused.status, 1, `${refused.stdout}\n${refused.stderr}`);
      assert.match(refused.stderr, /symlink/);
      assert.equal(readFileSync(target, 'utf8'), before);
      assert.equal(launchLines().length, callsBefore);
      rmSync(link, { force: true });
      install();
    }
    rmSync(target);
    const res = run(['panel', 'uninstall']);
    assert.equal(res.status, 0, `${res.stdout}\n${res.stderr}`);
  });

  it('keeps the state and names the label that is down when the second bootout fails', () => {
    install();
    const res = run(['panel', 'uninstall'], {
      env: { FAKE_LAUNCHCTL_FAIL_BOOTOUT: panelLabel },
    });
    assert.equal(res.status, 1);
    assert.ok(existsSync(statePath()));
    assert.ok(!existsSync(join(launchctlState, watchLabel)));
    assert.ok(existsSync(join(launchctlState, panelLabel)));
    assert.match(res.stderr, new RegExp(`${watchLabel} is down`));
  });

  it('stops uninstall when launchctl print fails and keeps the state', () => {
    install();
    const callsBefore = launchLines().length;
    const res = run(['panel', 'uninstall'], {
      env: { FAKE_LAUNCHCTL_FAIL_PRINT: watchLabel },
    });
    assert.equal(res.status, 1);
    assert.match(res.stderr, /launchctl print failed/);
    assert.ok(existsSync(statePath()));
    assert.ok(existsSync(manifestPath()));
    assert.ok(existsSync(watchPlist()));
    assert.ok(existsSync(panelPlist()));
    assert.ok(existsSync(join(launchctlState, watchLabel)));
    assert.ok(existsSync(join(launchctlState, panelLabel)));
    assert.equal(
      launchLines().slice(callsBefore).filter((line) => line.startsWith('bootout ')).length,
      0,
    );
  });

  it('prints a launchctl print failure from status without a traceback', () => {
    install();
    const res = run(['panel', 'status'], {
      env: { FAKE_LAUNCHCTL_FAIL_PRINT: watchLabel },
    });
    assert.equal(res.status, 1);
    assert.match(res.stderr, /launchctl print failed/);
    assert.doesNotMatch(res.stderr, /Traceback/);
  });

  it('refuses a first install when a label is already loaded', () => {
    writeFileSync(join(launchctlState, watchLabel), '');
    const before = snapshotTree(home);
    const res = install();
    assert.equal(res.status, 1);
    assert.match(res.stderr, /already loaded/);
    assert.deepEqual(snapshotTree(home), before);
    assert.ok(!existsSync(statePath()));
  });

  it('keeps a user-edited manifest on uninstall and still removes the state', () => {
    install();
    writeFileSync(manifestPath(), 'user: edited\n');
    const res = run(['panel', 'uninstall']);
    assert.equal(res.status, 0, `${res.stdout}\n${res.stderr}`);
    assert.equal(readFileSync(manifestPath(), 'utf8'), 'user: edited\n');
    assert.ok(!existsSync(watchPlist()));
    assert.ok(!existsSync(panelPlist()));
    assert.ok(!existsSync(statePath()));
    assert.match(res.stderr, /kept|content changed/i);
  });

  it('keeps the state when a loaded label refuses to boot out', () => {
    install();
    const res = run(['panel', 'uninstall'], {
      env: { FAKE_LAUNCHCTL_FAIL_BOOTOUT: watchLabel },
    });
    assert.equal(res.status, 1);
    assert.ok(existsSync(statePath()));
    assert.ok(existsSync(manifestPath()));
    assert.ok(existsSync(watchPlist()));
    assert.ok(existsSync(join(launchctlState, watchLabel)));
  });

  it('prints status and reports the projetos.json modification time', () => {
    install(['--port', '8123']);
    let res = run(['panel', 'status', '--json']);
    assert.equal(res.status, 0, res.stderr);
    let status = JSON.parse(res.stdout);
    assert.equal(status.installed, true);
    assert.equal(status.port, 8123);
    assert.equal(status.url, 'http://127.0.0.1:8123');
    assert.deepEqual(status.labels[watchLabel], { loaded: true });
    assert.deepEqual(status.labels[panelLabel], { loaded: true });
    assert.equal(status.projetos.mtime, null);

    writeFileSync(join(dataDir(), 'projetos.json'), '[]\n');
    res = run(['panel', 'status', '--json']);
    status = JSON.parse(res.stdout);
    assert.ok(status.projetos.mtime, JSON.stringify(status));

    res = run(['panel', 'uninstall']);
    assert.equal(res.status, 0, res.stderr);
    assert.ok(!existsSync(join(dataDir(), 'projetos.json')));
    for (const name of ['projetos', 'marcos', 'execucoes', 'alertas']) {
      assert.ok(!existsSync(join(dataDir(), `${name}.json`)), name);
    }
    res = run(['panel', 'status', '--json']);
    status = JSON.parse(res.stdout);
    assert.equal(status.installed, false);
    assert.equal(status.port, null);
    assert.equal(status.url, null);
    assert.equal(status.projetos.mtime, null);
  });

  it('prints that nothing is installed on a second uninstall', () => {
    let res = run(['panel', 'uninstall']);
    assert.equal(res.status, 0);
    assert.match(res.stdout, /nothing is installed/);
  });

  // ------------------------------------------------------- manifest refresh

  it('quotes a map title with quotes, a colon, a hash, a newline and non-ASCII into valid YAML', () => {
    const title = 'Painel: "aspas" & \'mais\' # linha\nnão ascii — ação';
    writeMap(project, baseMap({ id: 'quoted', title, unit: 'cartões' }));
    register(project);
    const res = install();
    assert.equal(res.status, 0, res.stderr);

    const doc = parseYaml(readFileSync(manifestPath(), 'utf8'));
    const section = doc.pages[0].sections.find((item) => item.title === title);
    assert.ok(section, JSON.stringify(doc.pages[0].sections));
    assert.deepEqual(section.widgets[0].source, {
      ref: 'marcos',
      filter: { projeto: 'quoted' },
    });
  });

  it('escapes DEL, C1, U+2028/9 and lone surrogates but keeps other non-ASCII', () => {
    const title = 'linha\u007f\u0085\u2028\u2029 não \ud800';
    writeMap(project, baseMap({ id: 'escaped', title }));
    register(project);
    const res = install();
    assert.equal(res.status, 0, `${res.stdout}\n${res.stderr}`);

    const raw = readFileSync(manifestPath(), 'utf8');
    assert.match(raw, /\\u007f/);
    assert.match(raw, /\\u0085/);
    assert.match(raw, /\\u2028/);
    assert.match(raw, /\\u2029/);
    assert.match(raw, /\\ud800/);
    assert.match(raw, /não/);
    assert.doesNotMatch(raw, /[\x7f]/);
    assert.doesNotMatch(raw, /[\u0080-\u009f]/);
  });

  it('regenerates the manifest on add and remove and leaves an edited one alone', () => {
    writeMap(project, baseMap());
    install();
    const sections = () => parseYaml(readFileSync(manifestPath(), 'utf8')).pages[0].sections;
    assert.equal(sections().length, 3);

    register(project);
    assert.ok(sections().some((item) => item.title === 'App do Culto'));
    let state = JSON.parse(readFileSync(statePath(), 'utf8'));
    assert.equal(state.files[manifestPath()], sha256(readFileSync(manifestPath())));

    let res = run(['remove', project]);
    assert.equal(res.status, 0, res.stderr);
    assert.equal(sections().length, 3);
    state = JSON.parse(readFileSync(statePath(), 'utf8'));
    assert.equal(state.files[manifestPath()], sha256(readFileSync(manifestPath())));

    register(project);
    writeFileSync(manifestPath(), 'user: edited\n');
    res = run(['remove', project]);
    assert.equal(res.status, 0, `${res.stdout}\n${res.stderr}`);
    assert.equal(readFileSync(manifestPath(), 'utf8'), 'user: edited\n');
    assert.match(res.stderr, /edited|editado/i);
  });

  it('does not crash refresh_manifest when rendering raises ValueError', () => {
    install();
    const script = `
import importlib.util, sys
spec = importlib.util.spec_from_file_location("progress", sys.argv[1])
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
def explode():
    raise ValueError("cannot render")
module.render_manifest = explode
module.refresh_manifest()
print("ok")
`;
    const res = spawnSync(PYTHON3, ['-c', script, PROGRESS_PY], {
      encoding: 'utf8',
      env,
      cwd: root,
      timeout: 30000,
    });
    assert.equal(res.status, 0, `${res.stdout}\n${res.stderr}`);
    assert.match(res.stderr, /cannot regenerate the panel manifest/);
    assert.match(res.stdout, /ok/);
  });

  it('exits 2 when launchd is unavailable and PROGRESS_LAUNCHCTL is unset', {
    skip: process.platform === 'darwin' ? 'would reach the real launchd on macOS' : false,
  }, () => {
    const without = { ...env };
    delete without.PROGRESS_LAUNCHCTL;
    const res = spawnSync(PYTHON3, [PROGRESS_PY, 'panel', 'status'], {
      encoding: 'utf8',
      env: without,
      cwd: root,
      timeout: 30000,
    });
    assert.equal(res.status, 2);
    assert.match(res.stderr, /macOS/);
  });
});
