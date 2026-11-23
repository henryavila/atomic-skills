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
    echo "not loaded $label" >&2
    exit 1
    ;;
  print)
    label=\${2##*/}
    if [ -f "$FAKE_LAUNCHCTL_STATE/$label" ]; then
      echo "loaded $label"
      exit 0
    fi
    echo "not loaded $label" >&2
    exit 1
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
    assert.equal(launchLines().length, callsBefore);
  });

  it('rolls back every created file and directory when the second bootstrap fails', () => {
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
  });

  // -------------------------------------------------------------- uninstall

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
    res = run(['panel', 'status', '--json']);
    status = JSON.parse(res.stdout);
    assert.equal(status.installed, false);
    assert.equal(status.port, null);
    assert.equal(status.url, null);
  });

  it('prints that nothing is installed on a second uninstall', () => {
    let res = run(['panel', 'uninstall']);
    assert.equal(res.status, 0);
    assert.match(res.stdout, /nothing is installed/);
  });

  // ------------------------------------------------------- manifest refresh

  it('quotes a map title with quotes and a colon into valid YAML', () => {
    const title = 'Painel: "aspas" & \'mais\'';
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
