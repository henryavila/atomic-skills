import { describe, it, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { spawn, spawnSync, execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  statSync,
  utimesSync,
  writeFileSync,
} from 'node:fs';
import { createHash } from 'node:crypto';
import { join, relative } from 'node:path';
import { tmpdir } from 'node:os';

const REPO_ROOT = realpathSync(new URL('..', import.meta.url).pathname);
const PROGRESS_PY = join(REPO_ROOT, 'skills/shared/progress-assets/progress.py');

const PYTHON3 = process.env.PROGRESS_TEST_PYTHON || 'python3';
const hasPython3 = spawnSync(PYTHON3, ['-c', 'import sys'], { encoding: 'utf8' }).status === 0;

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

function mergeSubject(repo, subject, branch) {
  git(repo, 'checkout', '-q', '-b', branch);
  git(repo, 'commit', '-q', '--allow-empty', '-m', `work ${branch}`);
  git(repo, 'checkout', '-q', 'main');
  git(repo, 'merge', '-q', '--no-ff', '-m', subject, branch);
}

function snapshotTree(root) {
  const out = new Map();
  (function walk(dir) {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.name === '.git') continue;
      const abs = join(dir, e.name);
      const rel = relative(root, abs);
      if (e.isDirectory()) {
        out.set(rel, 'dir');
        walk(abs);
      } else {
        out.set(rel, createHash('sha256').update(readFileSync(abs)).digest('hex'));
      }
    }
  })(root);
  return out;
}

async function waitFor(check, timeout = 15000, step = 50) {
  const deadline = Date.now() + timeout;
  let last;
  while (Date.now() < deadline) {
    try {
      const value = check();
      if (value) return value;
    } catch (error) {
      last = error;
    }
    await new Promise((resolve) => setTimeout(resolve, step));
  }
  throw new Error(`condition not met within ${timeout}ms${last ? `: ${last.message}` : ''}`);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function writeRegistry(atomicHome, projects) {
  const dir = join(atomicHome, 'progress');
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, 'projects.json'),
    JSON.stringify({ schemaVersion: 1, projects }, null, 2) + '\n',
  );
}

function baseMap(overrides = {}) {
  return {
    schemaVersion: 1,
    id: 'app',
    title: 'App do Culto',
    unit: 'cartões',
    milestones: [
      {
        id: 'fundacao',
        title: 'Fundação',
        cards: [{ id: 'F-01', size: 'P' }],
      },
    ],
    ...overrides,
  };
}

function validCard(id, extra = {}) {
  return { id, size: 'P', ...extra };
}

function oneMilestonePerCard(cards, extra = {}) {
  return baseMap({
    milestones: cards.map((card) => ({
      id: `m-${card.id.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      title: card.id,
      cards: [card],
    })),
    ...extra,
  });
}

describe('progress collector', { skip: !hasPython3 ? 'python3 not on PATH' : false }, () => {
  let root;
  let home;
  let atomicHome;
  let outDir;
  let env;
  let project;
  let delegate;

  beforeEach(() => {
    root = realpathSync(mkdtempSync(join(tmpdir(), 'as-progress-')));
    home = join(root, 'home');
    atomicHome = join(root, 'atomic-home');
    outDir = join(root, 'out');
    mkdirSync(home, { recursive: true });
    mkdirSync(atomicHome, { recursive: true });
    project = join(root, 'project');
    mkdirSync(project, { recursive: true });
    initGitRepo(project);

    delegate = join(root, 'fake-delegate.py');
    writeFileSync(
      delegate,
      `import os, pathlib, sys
args = sys.argv[1:]
if os.environ.get("FAKE_DELEGATE_FAIL"):
    sys.stderr.write("fake delegate failed\\n")
    sys.exit(7)
if args != ["status", "--json"]:
    sys.stderr.write("fake delegate: unsupported args " + repr(args) + "\\n")
    sys.exit(2)
if not os.environ.get("FAKE_DELEGATE_JSON"):
    sys.stdout.write("active\\n")
    sys.exit(0)
print(pathlib.Path(os.environ["FAKE_DELEGATE_JSON"]).read_text())
`,
    );

    env = {
      ...gitEnv(),
      HOME: home,
      ATOMIC_SKILLS_HOME: atomicHome,
      XDG_CONFIG_HOME: join(home, '.config'),
      FAKE_DELEGATE_JSON: join(root, 'delegate-status.json'),
      DELEGATE_PY: delegate,
    };
    writeFileSync(env.FAKE_DELEGATE_JSON, JSON.stringify({ paused: false, active: [] }));
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

  function collect(args = []) {
    const res = run(['collect', '--out', outDir, '--delegate', delegate, ...args]);
    assert.equal(res.status, 0, `${res.stdout}\n${res.stderr}`);
    return ['projetos', 'marcos', 'execucoes', 'alertas'].map((name) =>
      JSON.parse(readFileSync(join(outDir, `${name}.json`), 'utf8')),
    );
  }

  function register(repo, ref = 'main') {
    const res = run(['add', repo, '--ref', ref]);
    assert.equal(res.status, 0, `${res.stdout}\n${res.stderr}`);
  }

  function activeStatus(runs) {
    writeFileSync(env.FAKE_DELEGATE_JSON, JSON.stringify({ paused: false, active: runs }));
  }

  // ---------------------------------------------------------------- validate

  it('validate accepts a valid map and exits 0', () => {
    writeMap(project, baseMap());
    const res = run(['validate', project, '--ref', 'main']);
    assert.equal(res.status, 0, res.stderr);
  });

  it('validate reports every problem with its JSON path', () => {
    writeMap(project, baseMap());
    const cases = [
      ['unknown top key', { extra: true }, '$.extra'],
      ['bad schemaVersion', { schemaVersion: 2 }, '$.schemaVersion'],
      ['missing schemaVersion', { schemaVersion: undefined }, '$.schemaVersion'],
      ['bad project id', { id: 'bad id' }, '$.id'],
      ['missing project id', { id: undefined }, '$.id'],
      ['missing title', { title: undefined }, '$.title'],
      ['missing unit', { unit: undefined }, '$.unit'],
      ['non-string note', { note: 4 }, '$.note'],
      ['idPattern is no longer a key', { idPattern: '[A-Z]+-[0-9]+' }, '$.idPattern'],
      ['missing milestones', { milestones: undefined }, '$.milestones'],
      ['non-array milestones', { milestones: {} }, '$.milestones'],
    ];
    for (const [label, patch, path] of cases) {
      writeMap(project, baseMap(patch));
      const res = run(['validate', project, '--ref', 'main']);
      assert.equal(res.status, 1, `${label}: expected failure`);
      assert.match(res.stdout + res.stderr, new RegExp(path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), label);
    }

    const mile = baseMap();
    mile.milestones[0].extra = true;
    writeMap(project, mile);
    let res = run(['validate', project, '--ref', 'main']);
    assert.equal(res.status, 1);
    assert.match(res.stdout + res.stderr, /\$\.milestones\[0\]\.extra/);

    const moreMilestones = [
      ['milestone not object', [null], /\$\.milestones\[0\]/],
      ['missing milestone id', [{ title: 'A', cards: [] }], /\$\.milestones\[0\]\.id/],
      ['missing milestone title', [{ id: 'a', cards: [] }], /\$\.milestones\[0\]\.title/],
      ['missing milestone cards', [{ id: 'a', title: 'A' }], /\$\.milestones\[0\]\.cards/],
      ['bad milestone id', [{ id: 'bad id', title: 'A', cards: [] }], /\$\.milestones\[0\]\.id/],
      ['non-array cards', [{ id: 'a', title: 'A', cards: {} }], /\$\.milestones\[0\]\.cards/],
      ['duplicate milestone id', [
        { id: 'a', title: 'A', cards: [] },
        { id: 'a', title: 'B', cards: [] },
      ], /\$\.milestones\[1\]\.id/],
    ];
    for (const [label, milestones, path] of moreMilestones) {
      writeMap(project, baseMap({ milestones }));
      res = run(['validate', project, '--ref', 'main']);
      assert.equal(res.status, 1, `${label}: expected failure`);
      assert.match(res.stdout + res.stderr, path, label);
    }

    const cardExtra = baseMap();
    cardExtra.milestones[0].cards[0].extra = true;
    writeMap(project, cardExtra);
    res = run(['validate', project, '--ref', 'main']);
    assert.equal(res.status, 1);
    assert.match(res.stdout + res.stderr, /\$\.milestones\[0\]\.cards\[0\]\.extra/);

    const moreCards = [
      ['card not object', [null], /\$\.milestones\[0\]\.cards\[0\]/],
      ['missing card id', [{ size: 'P' }], /\$\.milestones\[0\]\.cards\[0\]\.id/],
      ['bad card id', [{ id: 'bad id', size: 'P' }], /\$\.milestones\[0\]\.cards\[0\]\.id/],
      ['non-string size', [{ id: 'X-1', size: [] }], /\.size/],
      ['non-array deps', [{ id: 'X-1', size: 'P', deps: 'X-2' }], /\.deps/],
      ['non-string dep', [{ id: 'X-1', size: 'P', deps: [2] }], /\.deps/],
      ['non-string done', [{ id: 'X-1', size: 'P', done: 1 }], /\.done/],
      ['non-string validated', [{ id: 'X-1', size: 'P', validated: 1 }], /\.validated/],
      ['non-string match', [{ id: 'X-1', size: 'P', match: 1 }], /\.match/],
    ];
    for (const [label, cards, path] of moreCards) {
      writeMap(project, baseMap({
        milestones: [{ id: 'a', title: 'A', cards }],
      }));
      res = run(['validate', project, '--ref', 'main']);
      assert.equal(res.status, 1, `${label}: expected failure`);
      assert.match(res.stdout + res.stderr, path, label);
    }

    const dup = baseMap({
      milestones: [
        { id: 'a', title: 'A', cards: [validCard('X-1')] },
        { id: 'b', title: 'B', cards: [validCard('X-1')] },
      ],
    });
    writeMap(project, dup);
    res = run(['validate', project, '--ref', 'main']);
    assert.equal(res.status, 1);
    assert.match(res.stdout + res.stderr, /\$\.milestones\[1\]\.cards\[0\]\.id/);

    const badSizes = baseMap({
      milestones: [{ id: 'a', title: 'A', cards: [{ id: 'X-1', size: 'X' }] }],
    });
    writeMap(project, badSizes);
    res = run(['validate', project, '--ref', 'main']);
    assert.equal(res.status, 1);
    assert.match(res.stdout + res.stderr, /\.size/);

    const noSize = baseMap({
      milestones: [{ id: 'a', title: 'A', cards: [{ id: 'X-1' }] }],
    });
    writeMap(project, noSize);
    res = run(['validate', project, '--ref', 'main']);
    assert.equal(res.status, 1);
    assert.match(res.stdout + res.stderr, /\$\.milestones\[0\]\.cards\[0\]/);

    for (const weight of [0, -2, '3', true]) {
      const badWeight = baseMap({
        milestones: [{ id: 'a', title: 'A', cards: [{ id: 'X-1', weight }] }],
      });
      writeMap(project, badWeight);
      res = run(['validate', project, '--ref', 'main']);
      assert.equal(res.status, 1, `weight ${JSON.stringify(weight)} should fail`);
      assert.match(res.stdout + res.stderr, /\.weight/);
    }

    const badMatch = baseMap({
      milestones: [{ id: 'a', title: 'A', cards: [{ id: 'X-1', size: 'P', match: [] }] }],
    });
    writeMap(project, badMatch);
    res = run(['validate', project, '--ref', 'main']);
    assert.equal(res.status, 1);
    assert.match(res.stdout + res.stderr, /\.match/);

    const badDep = baseMap({
      milestones: [{ id: 'a', title: 'A', cards: [{ id: 'X-1', size: 'P', deps: ['NOPE-1'] }] }],
    });
    writeMap(project, badDep);
    res = run(['validate', project, '--ref', 'main']);
    assert.equal(res.status, 1);
    assert.match(res.stdout + res.stderr, /\.deps/);

    const cycle = baseMap({
      milestones: [{
        id: 'a',
        title: 'A',
        cards: [
          { id: 'X-1', size: 'P', deps: ['X-2'] },
          { id: 'X-2', size: 'P', deps: ['X-1'] },
        ],
      }],
    });
    writeMap(project, cycle);
    res = run(['validate', project, '--ref', 'main']);
    assert.equal(res.status, 1);
    assert.match(res.stdout + res.stderr, /cycle|deps/);
  });

  it('validate reports several problems at once and a missing map', () => {
    const broken = baseMap({
      extra: 1,
      milestones: [{ id: 'a', title: 'A', cards: [{ id: 'X-1', size: 'X' }] }],
    });
    writeMap(project, broken);
    const res = run(['validate', project, '--ref', 'main']);
    assert.equal(res.status, 1);
    const text = res.stdout + res.stderr;
    assert.match(text, /\$\.extra/);
    assert.match(text, /\.size/);

    const res2 = run(['validate', project, '--ref', 'does-not-exist']);
    assert.equal(res2.status, 1);
    assert.match(res2.stdout + res2.stderr, /marcos\.json/);
  });

  it('validate never reads the working-tree copy of the map', () => {
    writeMap(project, baseMap({ extra: 'invalid' }));
    git(project, 'add', '.atomic-skills/marcos.json');
    // A committed valid map plus a broken working-tree copy.
    writeMap(project, baseMap());
    writeFileSync(join(project, '.atomic-skills/marcos.json'), '{ broken');
    const res = run(['validate', project, '--ref', 'main']);
    assert.equal(res.status, 0, res.stderr);
  });

  // ------------------------------------------------------------ card states

  it('derives every card state with the required precedence', () => {
    writeMap(
      project,
      oneMilestonePerCard([
        validCard('V-1', { validated: 'gate pass', done: 'merged', deps: ['B-1'] }),
        validCard('I-1', { done: 'merged' }),
        validCard('I-2'),
        validCard('R-1'),
        validCard('B-1', { deps: ['RD-9'] }),
        validCard('RD-9'),
        validCard('RB-1', { deps: ['RD-9'] }),
        validCard('IB-1', { deps: ['RD-9'], done: 'merged' }),
      ]),
    );
    git(project, 'remote', 'add', 'origin', 'https://github.com/acme/app.git');
    mergeSubject(project, 'Merge I-2', 'feat-i2');
    activeStatus([
      { id: 'task I-1 fix', project: 'p', profile: 'flash', role: 'fix', machine: 'box', repo: 'acme/app', milestone: 'm-i-1', remote: false, started: '2026-01-01T00:00:00+00:00', age_s: 125, idle_s: 1, runner_gone: false },
      { id: 'work R-1 done', project: 'p', profile: 'flash', role: 'implement', machine: 'box', repo: 'acme/app', milestone: 'm-r-1', remote: false, started: '2026-01-01T00:00:00+00:00', age_s: 60, idle_s: 1, runner_gone: false },
      { id: 'work RB-1 done', project: 'p', profile: 'flash', role: 'implement', machine: 'box', repo: 'acme/app', milestone: 'm-rb-1', remote: false, started: '2026-01-01T00:00:00+00:00', age_s: 60, idle_s: 1, runner_gone: false },
    ]);
    register(project);

    const [projetos, marcos, execucoes, alertas] = collect();
    const byCard = new Map(marcos.map((m) => [m.marco, m]));
    const expect = {
      'm-v-1': { pct: 100, prontos: 1, bloqueados: 0, rodando: 0 },
      'm-i-1': { pct: 100, prontos: 1, bloqueados: 0, rodando: 0 },
      'm-i-2': { pct: 100, prontos: 1, bloqueados: 0, rodando: 0 },
      'm-r-1': { pct: 0, prontos: 0, bloqueados: 0, rodando: 1 },
      'm-b-1': { pct: 0, prontos: 0, bloqueados: 1, rodando: 0 },
      'm-rd-9': { pct: 0, prontos: 0, bloqueados: 0, rodando: 0 },
      'm-rb-1': { pct: 0, prontos: 0, bloqueados: 0, rodando: 1 },
      'm-ib-1': { pct: 100, prontos: 1, bloqueados: 0, rodando: 0 },
    };
    for (const [id, want] of Object.entries(expect)) {
      const row = byCard.get(id);
      assert.ok(row, `missing milestone ${id}`);
      assert.equal(row.pct, want.pct, `${id} pct`);
      assert.equal(row.prontos, want.prontos, `${id} prontos`);
      assert.equal(row.bloqueados, want.bloqueados, `${id} bloqueados`);
      assert.equal(row.rodando, want.rodando, `${id} rodando`);
    }
    assert.equal(projetos[0].pct, 50);
    assert.equal(projetos[0].validado, 1);
    assert.equal(projetos[0].validadoPct, 13);
    assert.equal(execucoes.length, 3);
    assert.deepEqual(
      execucoes.map((e) => e.tarefa),
      ['task I-1 fix', 'work R-1 done', 'work RB-1 done'],
    );
    assert.equal(alertas.filter((a) => a.tipo === 'marco_desconhecido').length, 0);
  });

  it('matches card ids as whole tokens only', () => {
    writeMap(
      project,
      oneMilestonePerCard([
        validCard('A-1'),
        validCard('A-10'),
        validCard('QA-1'),
        validCard('A-1-b'),
      ]),
    );
    mergeSubject(project, 'Merge A-10', 'feat-a10');
    mergeSubject(project, 'Merge QA-1', 'feat-qa1');
    mergeSubject(project, 'Merge A-1-b', 'feat-a1b');
    register(project);
    const [, marcos] = collect();
    const byCard = new Map(marcos.map((m) => [m.marco, m.pct]));
    assert.equal(byCard.get('m-a-1'), 0);
    assert.equal(byCard.get('m-a-10'), 100);
    assert.equal(byCard.get('m-qa-1'), 100);
    assert.equal(byCard.get('m-a-1-b'), 100);
  });

  it('unblocks a card whose dependency is integrated', () => {
    writeMap(
      project,
      oneMilestonePerCard([
        validCard('D-1'),
        validCard('D-2'),
        validCard('C-1', { deps: ['D-1'] }),
        validCard('C-2', { deps: ['C-1'] }),
        validCard('C-3', { deps: ['D-2'] }),
      ]),
    );
    mergeSubject(project, 'Merge D-1', 'feat-d1');
    register(project);
    const [, marcos] = collect();
    const byCard = new Map(marcos.map((m) => [m.marco, m]));
    assert.equal(byCard.get('m-d-1').pct, 100);
    assert.equal(byCard.get('m-c-1').bloqueados, 0, 'integrated dep must not block');
    assert.equal(byCard.get('m-c-1').pct, 0);
    assert.equal(byCard.get('m-c-2').bloqueados, 1, 'a ready dep still blocks its dependents');
    assert.equal(byCard.get('m-c-3').bloqueados, 1, 'a missing dep still blocks');
  });

  it('validates and matches literal match strings or arrays without token boundaries', () => {
    for (const match of ['feat/web-07a-', ['feat/web-07a-', 'another title'], 'case']) {
      writeMap(project, oneMilestonePerCard([validCard('M-1', { match })]));
      const res = run(['validate', project, '--ref', 'main']);
      assert.equal(res.status, 0, `${JSON.stringify(match)}: ${res.stderr}`);
    }
    for (const match of ['', [], ['ok', ''], [1], 1, {}]) {
      writeMap(project, oneMilestonePerCard([validCard('M-1', { match })]));
      const res = run(['validate', project, '--ref', 'main']);
      assert.equal(res.status, 1, `${JSON.stringify(match)} should fail`);
      assert.match(res.stdout + res.stderr, /\.match/);
    }

    writeMap(
      project,
      oneMilestonePerCard([
        validCard('M-1', { match: 'feat/web-07a-' }),
        validCard('M-2', { match: ['alpha', 'BETA'] }),
        validCard('M-3', { match: 'case' }),
      ]),
    );
    mergeSubject(project, 'Merge prefixfeat/web-07a-suffix', 'feat-web');
    mergeSubject(project, 'Merge ALPHA and beta', 'feat-alpha');
    mergeSubject(project, 'Merge lowercase', 'feat-lowercase');
    register(project);
    const [, marcos] = collect();
    const byCard = new Map(marcos.map((m) => [m.marco, m.pct]));
    assert.equal(byCard.get('m-m-1'), 100, 'a literal match is a plain substring');
    assert.equal(byCard.get('m-m-2'), 100, 'a list matches any entry case-insensitively');
    assert.equal(byCard.get('m-m-3'), 100, 'a match has no token boundary');
  });

  it('derives unknown-id prefixes from the map cards and guards whole tokens', () => {
    writeMap(
      project,
      baseMap({
        id: 'tokens',
        milestones: [{
          id: 'm',
          title: 'M',
          cards: [validCard('AB-1'), validCard('QA-1'), validCard('A-1-b')],
        }],
      }),
    );
    mergeSubject(project, 'Merge AB-1 AB-9 QA-2 A-10 ABCD-1 ZZZ-9 ab-9', 'feat-tokens');
    register(project);
    const [, , , alertas] = collect();
    const unknown = alertas.filter((a) => a.tipo === 'card_desconhecido');
    const tokens = unknown.map((a) => a.detalhe.split(' aparece')[0]).sort();
    assert.deepEqual(tokens, ['A-10', 'AB-9', 'QA-2'], JSON.stringify(unknown));
    assert.ok(!tokens.includes('AB-1'), 'a known card id is not an alert');
    assert.ok(!tokens.includes('BCD-1'), 'a suffix inside ABCD-1 is not a token');
    assert.ok(!tokens.includes('ZZZ-9'), 'a prefix no card derives is not scanned');
    assert.ok(!tokens.includes('ab-9'), 'the derived token is case-sensitive');

    writeMap(project, baseMap({
      id: 'no-prefix',
      milestones: [{ id: 'm', title: 'M', cards: [validCard('X')] }],
    }), 'no prefix');
    const [, , , noPrefix] = collect();
    assert.equal(noPrefix.filter((a) => a.tipo === 'card_desconhecido').length, 0);
  });

  it('scans a 100 KB merge subject in under two seconds', () => {
    const subject = `Merge ${'feat/web-07a- xxxxxxxxxx AB-9 '.repeat(4000)}`;
    assert.ok(subject.length >= 100 * 1024, `${subject.length} bytes`);
    writeMap(
      project,
      oneMilestonePerCard([
        validCard('AB-1'),
        validCard('CD-2', { match: 'never-matches' }),
      ]),
    );
    mergeSubject(project, subject, 'feat-big');
    register(project);
    const started = Date.now();
    const [, , , alertas] = collect();
    const elapsed = Date.now() - started;
    assert.ok(elapsed < 2000, `collect took ${elapsed}ms`);
    assert.ok(
      alertas.some((a) => a.tipo === 'card_desconhecido' && /AB-9/.test(a.detalhe)),
      JSON.stringify(alertas),
    );
  });

  it('uses a card match expression in place of its id, case-insensitively', () => {
    writeMap(
      project,
      oneMilestonePerCard([
        validCard('F-01', { match: 'feature one' }),
        validCard('F-02', { match: 'Feature Two' }),
      ]),
    );
    mergeSubject(project, 'merge FEATURE ONE', 'feat-one');
    register(project);
    const [, marcos] = collect();
    const byCard = new Map(marcos.map((m) => [m.marco, m.pct]));
    assert.equal(byCard.get('m-f-01'), 100);
    assert.equal(byCard.get('m-f-02'), 0);
  });

  it('treats empty or whitespace evidence as absent', () => {
    writeMap(
      project,
      oneMilestonePerCard([
        validCard('E-1', { done: '' }),
        validCard('E-2', { validated: '   ', done: '' }),
      ]),
    );
    register(project);
    const [projetos, marcos] = collect();
    assert.equal(projetos[0].feito, 0);
    assert.equal(projetos[0].validado, 0);
    assert.equal(marcos.every((m) => m.pct === 0 && m.prontos === 0), true);
  });

  it('collects from the committed map, not the working-tree copy', () => {
    writeMap(project, oneMilestonePerCard([validCard('W-1')]));
    register(project);
    // Leave an uncommitted copy that would mark the card done and rename the project.
    writeFileSync(join(project, '.atomic-skills/marcos.json'), JSON.stringify(
      oneMilestonePerCard([validCard('W-1', { done: 'merged' })], {
        id: 'working-tree',
        title: 'Working tree',
      }),
    ));
    const [projetos, , , alertas] = collect();
    assert.equal(projetos[0].id, 'app');
    assert.equal(projetos[0].nome, 'App do Culto');
    assert.equal(projetos[0].feito, 0);
    assert.equal(alertas.filter((a) => a.tipo === 'mapa_invalido').length, 0);
  });


  it('weighs cards, rounds percentages and only reaches 100% when all count', () => {
    writeMap(
      project,
      baseMap({
        id: 'weights',
        title: 'Weights',
        milestones: [{
          id: 'm',
          title: 'M',
          cards: [
            { id: 'P-1', size: 'P', done: 'x' },
            { id: 'M-1', size: 'M', done: 'x' },
            { id: 'G-1', size: 'G' },
            { id: 'W-1', weight: 7, done: 'x' },
            { id: 'T-1', weight: 191 },
          ],
        }],
      }),
    );
    register(project);
    let [projetos, marcos] = collect();
    // total = 1 + 2 + 4 + 7 + 191 = 205; done = 1 + 2 + 7 = 10
    assert.equal(projetos[0].total, 205);
    assert.equal(projetos[0].feito, 10);
    assert.equal(projetos[0].pct, 5);
    assert.equal(projetos[0].resumo, '10/205 cartões · 5%');
    assert.equal(marcos[0].resumo, '10/205 cartões · 5%');

    writeMap(
      project,
      baseMap({
        id: 'rounding',
        title: 'Rounding',
        milestones: [{
          id: 'm',
          title: 'M',
          cards: [
            { id: 'A-1', weight: 2, done: 'x' },
            { id: 'A-2', weight: 1 },
          ],
        }],
      }),
    );
    [projetos] = collect();
    assert.equal(projetos[0].pct, 67);
    assert.equal(projetos[0].resumo, '2/3 cartões · 67%');

    writeMap(
      project,
      baseMap({
        id: 'cap',
        title: 'Cap',
        milestones: [{
          id: 'm',
          title: 'M',
          cards: [
            { id: 'A-1', weight: 199, done: 'x', validated: 'ok' },
            { id: 'A-2', weight: 1 },
          ],
        }],
      }),
    );
    [projetos, marcos] = collect();
    assert.equal(projetos[0].pct, 99);
    assert.equal(projetos[0].validadoPct, 99);
    assert.equal(projetos[0].validado, 199);
    assert.equal(marcos[0].pct, 99);

    writeMap(
      project,
      baseMap({
        id: 'all',
        title: 'All',
        milestones: [{
          id: 'm',
          title: 'M',
          cards: [
            { id: 'A-1', size: 'M', done: 'x' },
            { id: 'A-2', size: 'G', validated: 'ok' },
          ],
        }],
      }),
    );
    [projetos] = collect();
    assert.equal(projetos[0].pct, 100);
    assert.equal(projetos[0].validadoPct, 67);
  });

  // ------------------------------------------------------- runs and alerts

  it('lists active local and remote runs with the panel fields', () => {
    writeMap(project, baseMap({ note: 'a legenda' }));
    git(project, 'remote', 'add', 'origin', 'git@github.com:acme/app.git');
    activeStatus([
      { id: 'T-1', project: 'p', profile: 'flash', role: 'implement', machine: 'box', repo: 'acme/app', milestone: 'fundacao', remote: false, started: '2026-01-01T00:00:00+00:00', age_s: 125, idle_s: 1, runner_gone: false },
      { id: 'T-2', project: 'p', profile: 'codex', role: 'review', machine: 'devbox', repo: 'acme/app', milestone: null, remote: true, started: '2026-01-01T00:00:00+00:00', age_s: 61, idle_s: null, runner_gone: false },
    ]);
    register(project);
    const [projetos, , execucoes] = collect();
    assert.deepEqual(projetos[0], {
      id: 'app',
      nome: 'App do Culto',
      feito: 0,
      total: 1,
      pct: 0,
      validado: 0,
      validadoPct: 0,
      resumo: '0/1 cartões · 0%',
      legenda: 'a legenda',
    });
    assert.deepEqual(execucoes, [
      {
        projeto: 'app',
        repo: 'acme/app',
        marco: 'fundacao',
        tarefa: 'T-1',
        papel: 'implement',
        executor: 'flash',
        equipamento: 'box',
        remoto: false,
        minutos: 2,
      },
      {
        projeto: 'app',
        repo: 'acme/app',
        marco: '',
        tarefa: 'T-2',
        papel: 'review',
        executor: 'codex',
        equipamento: 'devbox',
        remoto: true,
        minutos: 1,
      },
    ]);
  });

  it('keeps runs of unregistered repositories with their own project name', () => {
    writeMap(project, baseMap());
    register(project);
    activeStatus([
      { id: 'T-9', project: 'other', profile: 'flash', role: 'implement', machine: 'box', repo: 'elsewhere/thing', milestone: null, remote: false, started: '2026-01-01T00:00:00+00:00', age_s: 30, idle_s: 1, runner_gone: false },
    ]);
    const [, , execucoes] = collect();
    assert.equal(execucoes.length, 1);
    assert.equal(execucoes[0].projeto, 'other');
    assert.equal(execucoes[0].repo, 'elsewhere/thing');
  });

  it('alerts on an unknown card token in a merge subject', () => {
    writeMap(project, baseMap());
    mergeSubject(project, 'Merge branch feature F-9', 'feat-f9');
    register(project);
    const [, , , alertas] = collect();
    const alert = alertas.find((a) => a.tipo === 'card_desconhecido');
    assert.ok(alert, JSON.stringify(alertas));
    assert.equal(alert.projeto, 'app');
    assert.match(alert.detalhe, /F-9/);
  });

  it('alerts on active and logged runs of an unknown milestone but not on null', () => {
    writeMap(project, baseMap());
    git(project, 'remote', 'add', 'origin', 'https://github.com/acme/app.git');
    activeStatus([
      { id: 'T-1', project: 'p', profile: 'flash', role: 'implement', machine: 'box', repo: 'acme/app', milestone: 'ghost-active', remote: false, started: '2026-01-01T00:00:00+00:00', age_s: 60, idle_s: 1, runner_gone: false },
      { id: 'T-2', project: 'p', profile: 'flash', role: 'implement', machine: 'box', repo: 'acme/app', milestone: null, remote: false, started: '2026-01-01T00:00:00+00:00', age_s: 60, idle_s: 1, runner_gone: false },
    ]);
    const logDir = join(atomicHome, 'delegate');
    mkdirSync(logDir, { recursive: true });
    writeFileSync(
      join(logDir, 'runs.jsonl'),
      [
        { kind: 'run', id: 'T-3', repo: 'acme/app', milestone: 'ghost-logged' },
        { kind: 'run', id: 'T-4', repo: 'acme/app', milestone: null },
        { kind: 'run', id: 'T-5', repo: 'acme/app', milestone: 'fundacao' },
        { kind: 'pipeline', id: 'P-1', repo: 'acme/app', milestone: 'ghost-pipeline' },
        { kind: 'verdict', id: 'T-6', repo: 'acme/app', milestone: 'not-a-run' },
      ].map((r) => JSON.stringify(r)).join('\n') + '\n',
    );
    register(project);
    const [, , , alertas] = collect();
    const unknown = alertas.filter((a) => a.tipo === 'marco_desconhecido');
    assert.equal(unknown.length, 3, JSON.stringify(alertas));
    const text = unknown.map((a) => a.detalhe).join('\n');
    assert.match(text, /ghost-active/);
    assert.match(text, /ghost-logged/);
    assert.match(text, /ghost-pipeline/);
  });

  it('lists a broken map with its error without affecting another project', () => {
    const brokenRepo = join(root, 'broken');
    mkdirSync(brokenRepo, { recursive: true });
    initGitRepo(brokenRepo);
    writeMap(brokenRepo, baseMap({ id: 'broken', title: 'Broken' }));
    register(brokenRepo, 'main');
    writeMap(
      brokenRepo,
      baseMap({
        id: 'broken',
        title: 'Broken',
        milestones: [{ id: 'm', title: 'M', cards: [{ id: 'X-1', size: 'X' }] }],
      }),
      'break map',
    );

    writeMap(project, baseMap({ id: 'healthy', title: 'Healthy' }));
    register(project, 'main');

    const [projetos, marcos, , alertas] = collect();
    assert.equal(projetos.length, 2);
    const broken = projetos.find((p) => p.id === 'broken');
    assert.ok(broken, JSON.stringify(projetos));
    assert.equal(broken.pct, 0);
    assert.equal(broken.total, 0);
    const healthy = projetos.find((p) => p.id === 'healthy');
    assert.ok(healthy);
    assert.equal(healthy.total, 1);
    assert.equal(marcos.filter((m) => m.projeto === 'broken').length, 0);
    assert.ok(alertas.some((a) => a.projeto === 'broken' && a.tipo === 'mapa_invalido'));
  });

  it('empties executions and emits one alert when delegate.py is unavailable', () => {
    writeMap(project, baseMap());
    register(project);
    const res = run(['collect', '--out', outDir, '--delegate', join(root, 'nope.py')]);
    assert.equal(res.status, 0, res.stderr);
    const execucoes = JSON.parse(readFileSync(join(outDir, 'execucoes.json'), 'utf8'));
    const alertas = JSON.parse(readFileSync(join(outDir, 'alertas.json'), 'utf8'));
    assert.deepEqual(execucoes, []);
    assert.equal(alertas.length, 1);
    assert.equal(alertas[0].tipo, 'delegate_indisponivel');
  });

  it('treats a delegate.py without status --json as unavailable', () => {
    writeMap(project, baseMap());
    register(project);
    const res = run(['collect', '--out', outDir, '--delegate', delegate], {
      env: { FAKE_DELEGATE_FAIL: '1' },
    });
    assert.equal(res.status, 0, res.stderr);
    const execucoes = JSON.parse(readFileSync(join(outDir, 'execucoes.json'), 'utf8'));
    const alertas = JSON.parse(readFileSync(join(outDir, 'alertas.json'), 'utf8'));
    assert.deepEqual(execucoes, []);
    assert.equal(alertas.length, 1);
    assert.match(alertas[0].detalhe, /failed|status/i);
  });

  // ------------------------------------------------------------- collection

  it('writes no file again when the bytes did not change', () => {
    writeMap(project, baseMap());
    register(project);
    collect();
    const files = ['projetos', 'marcos', 'execucoes', 'alertas'].map((n) => join(outDir, `${n}.json`));
    const past = new Date('2000-01-01T00:00:00Z');
    for (const file of files) utimesSync(file, past, past);
    const before = new Map(files.map((f) => [f, statSync(f, { bigint: true }).mtimeNs]));
    collect();
    for (const file of files) {
      assert.equal(statSync(file, { bigint: true }).mtimeNs, before.get(file), file);
    }
  });

  it('leaves registered repositories byte-identical, including HEAD and worktree', () => {
    writeMap(project, baseMap());
    git(project, 'remote', 'add', 'origin', 'https://github.com/acme/app.git');
    activeStatus([
      { id: 'T-1', project: 'p', profile: 'flash', role: 'implement', machine: 'box', repo: 'acme/app', milestone: 'fundacao', remote: false, started: '2026-01-01T00:00:00+00:00', age_s: 60, idle_s: 1, runner_gone: false },
    ]);
    register(project);
    const treeBefore = snapshotTree(project);
    const headBefore = git(project, 'rev-parse', 'HEAD');
    const headFileBefore = readFileSync(join(project, '.git', 'HEAD'), 'utf8');
    const statusBefore = git(project, 'status', '--porcelain');
    collect();
    collect();
    assert.deepEqual(snapshotTree(project), treeBefore);
    assert.equal(git(project, 'rev-parse', 'HEAD'), headBefore);
    assert.equal(readFileSync(join(project, '.git', 'HEAD'), 'utf8'), headFileBefore);
    assert.equal(git(project, 'status', '--porcelain'), statusBefore);
  });

  it('fetches only with --fetch and alerts on a failed fetch', () => {
    const bare = join(root, 'origin.git');
    execFileSync('git', ['init', '-q', '--bare', bare], { env: gitEnv() });
    git(project, 'remote', 'add', 'origin', bare);
    git(project, 'push', '-q', 'origin', 'main');
    writeMap(project, baseMap());
    git(project, 'push', '-q', 'origin', 'main');
    register(project, 'origin/main');

    let [projetos, , , alertas] = collect();
    assert.equal(projetos.length, 1);
    assert.equal(alertas.filter((a) => a.tipo === 'fetch_falhou').length, 0);

    rmSync(bare, { recursive: true, force: true });
    [, , , alertas] = collect(['--fetch']);
    assert.ok(alertas.some((a) => a.tipo === 'fetch_falhou'), JSON.stringify(alertas));
  });

  it('fetches a real bare remote without touching HEAD, worktree, index, config or refs', () => {
    const bare = join(root, 'origin.git');
    execFileSync('git', ['init', '-q', '--bare', bare], { env: gitEnv() });
    git(project, 'remote', 'add', 'origin', bare);
    writeMap(project, baseMap());
    git(project, 'push', '-q', 'origin', 'main');
    git(project, 'fetch', '-q', 'origin');
    register(project, 'origin/main');

    const peer = join(root, 'peer');
    execFileSync('git', ['-C', bare, 'symbolic-ref', 'HEAD', 'refs/heads/main'], { env: gitEnv() });
    execFileSync('git', ['clone', '-q', bare, peer], { env: gitEnv() });
    git(peer, 'config', 'user.email', 'peer@example.com');
    git(peer, 'config', 'user.name', 'Peer');
    writeFileSync(join(peer, 'REMOTE.md'), 'remote change\n');
    git(peer, 'add', 'REMOTE.md');
    git(peer, 'commit', '-q', '-m', 'remote change');
    git(peer, 'push', '-q', 'origin', 'main');
    const remoteSha = git(peer, 'rev-parse', 'HEAD');

    const treeBefore = snapshotTree(project);
    const headBefore = readFileSync(join(project, '.git', 'HEAD'), 'utf8');
    const indexBefore = createHash('sha256')
      .update(readFileSync(join(project, '.git', 'index')))
      .digest('hex');
    const configBefore = readFileSync(join(project, '.git', 'config'));
    const refsBefore = git(project, 'for-each-ref', '--format=%(refname) %(objectname)')
      .split('\n')
      .filter((line) => !line.startsWith('refs/remotes/origin/main '))
      .join('\n');

    const [, , , alertas] = collect(['--fetch']);
    assert.equal(alertas.filter((a) => a.tipo === 'fetch_falhou').length, 0);

    assert.equal(git(project, 'rev-parse', 'refs/remotes/origin/main'), remoteSha);
    assert.equal(readFileSync(join(project, '.git', 'HEAD'), 'utf8'), headBefore);
    assert.deepEqual(snapshotTree(project), treeBefore);
    assert.equal(
      createHash('sha256').update(readFileSync(join(project, '.git', 'index'))).digest('hex'),
      indexBefore,
    );
    assert.deepEqual(readFileSync(join(project, '.git', 'config')), configBefore);
    const refsAfter = git(project, 'for-each-ref', '--format=%(refname) %(objectname)')
      .split('\n')
      .filter((line) => !line.startsWith('refs/remotes/origin/main '))
      .join('\n');
    assert.equal(refsAfter, refsBefore);
  });

  it('runs the fetch without a prompt and with a non-interactive ssh', () => {
    const bare = join(root, 'origin.git');
    execFileSync('git', ['init', '-q', '--bare', bare], { env: gitEnv() });
    git(project, 'remote', 'add', 'origin', bare);
    writeMap(project, baseMap());
    git(project, 'push', '-q', 'origin', 'main');
    git(project, 'fetch', '-q', 'origin');
    register(project, 'origin/main');

    const realGit = execFileSync('sh', ['-c', 'command -v git'], { encoding: 'utf8' }).trim();
    const falsePath = execFileSync('which', ['false'], { encoding: 'utf8' }).trim();
    const shim = join(root, 'git-fetch-env');
    mkdirSync(shim, { recursive: true });
    const envFile = join(root, 'fetch-env.txt');
    writeFileSync(
      join(shim, 'git'),
      `#!/bin/sh
for arg in "$@"; do
  if [ "$arg" = "fetch" ]; then
    printf '%s\\n' "$GIT_ASKPASS" "$SSH_ASKPASS" "$SSH_ASKPASS_REQUIRE" "$GIT_SSH_COMMAND" > ${JSON.stringify(envFile)}
    exit 0
  fi
done
exec ${JSON.stringify(realGit)} "$@"
`,
      { mode: 0o755 },
    );

    const res = run(['collect', '--out', outDir, '--delegate', delegate, '--fetch'], {
      env: { PATH: `${shim}:${env.PATH}` },
    });
    assert.equal(res.status, 0, res.stderr);
    const alertas = readJson(join(outDir, 'alertas.json'));
    assert.equal(alertas.filter((a) => a.tipo === 'fetch_falhou').length, 0);
    assert.deepEqual(readFileSync(envFile, 'utf8').trim().split('\n'), [
      falsePath,
      falsePath,
      'never',
      'ssh -o BatchMode=yes',
    ]);
  });

  it('refuses an option-like ref and never fetches an option-like branch', () => {
    writeMap(project, baseMap());
    let res = run(['add', project, '--ref=-main']);
    assert.equal(res.status, 1);
    res = run(['add', project, '--ref=bad ref']);
    assert.equal(res.status, 1);

    git(project, 'update-ref', 'refs/remotes/origin/-x', 'HEAD');
    res = run(['add', project, '--ref=origin/-x']);
    assert.equal(res.status, 0, res.stderr);
    const headBefore = git(project, 'rev-parse', 'HEAD');
    const [, , , alertas] = collect(['--fetch']);
    assert.ok(alertas.some((a) => a.tipo === 'fetch_falhou'), JSON.stringify(alertas));
    assert.equal(git(project, 'rev-parse', 'HEAD'), headBefore);
  });

  it('keeps a bad registry entry from stopping the other projects', () => {
    const badRepo = join(root, 'bad-ref');
    mkdirSync(badRepo, { recursive: true });
    initGitRepo(badRepo);
    writeMap(badRepo, baseMap({ id: 'bad-ref' }));
    writeMap(project, baseMap({ id: 'good' }));
    writeRegistry(atomicHome, [
      { path: badRepo, ref: '-x' },
      { path: project, ref: 'main' },
    ]);
    const [projetos, , , alertas] = collect();
    assert.deepEqual(projetos.map((p) => p.id), ['good']);
    const alert = alertas.find((a) => a.tipo === 'registro_invalido');
    assert.ok(alert, JSON.stringify(alertas));
    assert.match(alert.detalhe, /ref inválida/);
  });

  it('keeps the previous rows and alerts when git log fails', () => {
    writeMap(
      project,
      oneMilestonePerCard([
        validCard('G-1', { done: 'merged' }),
        validCard('G-2'),
      ]),
    );
    register(project);
    const [beforeProjetos, beforeMarcos] = collect();
    assert.equal(beforeProjetos[0].feito, 1);

    const realGit = execFileSync('sh', ['-c', 'command -v git'], { encoding: 'utf8' }).trim();
    const shim = join(root, 'git-shim');
    mkdirSync(shim, { recursive: true });
    const shimGit = join(shim, 'git');
    writeFileSync(
      shimGit,
      `#!/bin/sh
for arg in "$@"; do
  if [ "$arg" = "log" ]; then
    echo "shim: git log refused" >&2
    exit 128
  fi
done
exec ${JSON.stringify(realGit)} "$@"
`,
      { mode: 0o755 },
    );

    const res = run(['collect', '--out', outDir, '--delegate', delegate], {
      env: { PATH: `${shim}:${env.PATH}` },
    });
    assert.equal(res.status, 0, res.stderr);
    const projetos = readJson(join(outDir, 'projetos.json'));
    const marcos = readJson(join(outDir, 'marcos.json'));
    const alertas = readJson(join(outDir, 'alertas.json'));
    assert.deepEqual(projetos, beforeProjetos);
    assert.deepEqual(marcos, beforeMarcos);
    assert.ok(alertas.some((a) => a.tipo === 'git_log_falhou'), JSON.stringify(alertas));

    const freshOut = join(root, 'fresh-out');
    const fresh = run(['collect', '--out', freshOut, '--delegate', delegate], {
      env: { PATH: `${shim}:${env.PATH}` },
    });
    assert.equal(fresh.status, 0, fresh.stderr);
    const freshProjetos = readJson(join(freshOut, 'projetos.json'));
    assert.equal(freshProjetos[0].id, 'app');
    assert.equal(freshProjetos[0].feito, 0);
    assert.ok(readJson(join(freshOut, 'alertas.json'))
      .some((a) => a.tipo === 'git_log_falhou'));

    const registryPath = join(atomicHome, 'progress', 'projects.json');
    const registry = readJson(registryPath);
    assert.equal(registry.projects[0].id, 'app');
    registry.projects[0].ref = 'does-not-exist';
    writeFileSync(registryPath, JSON.stringify(registry, null, 2) + '\n');
    const unresolvable = collect();
    assert.equal(unresolvable[0].length, 1);
    assert.equal(unresolvable[0][0].id, 'app');
    assert.equal(unresolvable[0][0].feito, 1);
    const unresolvableAlert = unresolvable[3].find((a) => a.tipo === 'git_log_falhou');
    assert.ok(unresolvableAlert, JSON.stringify(unresolvable[3]));
    assert.equal(unresolvableAlert.projeto, 'app');

    writeRegistry(atomicHome, [{ path: project, ref: 'does-not-exist' }]);
    const legacy = collect();
    assert.equal(legacy[0].length, 1);
    assert.equal(legacy[0][0].id, project.split('/').pop());
    assert.equal(legacy[0][0].feito, 0);
    const legacyAlert = legacy[3].find((a) => a.tipo === 'git_log_falhou');
    assert.ok(legacyAlert, JSON.stringify(legacy[3]));
    assert.equal(legacyAlert.projeto, project.split('/').pop());
  });

  // --------------------------------------------------------------- registry

  it('turns an unexpected project error into erro_interno without stopping the others', () => {
    const other = join(root, 'other-internal');
    mkdirSync(other, { recursive: true });
    initGitRepo(other);
    writeMap(project, baseMap({ id: 'one' }));
    writeMap(other, baseMap({ id: 'two' }));
    register(project);
    register(other);
    const script = `
import importlib.util, sys
spec = importlib.util.spec_from_file_location("progress", sys.argv[1])
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
original = module.project_row
def explode(view, states):
    if view.id == "one":
        raise RuntimeError("boom")
    return original(view, states)
module.project_row = explode
projetos, marcos, execucoes, alertas, carried = module.build_panel(delegate_path=sys.argv[2])
assert [row["id"] for row in projetos] == ["one", "two"], projetos
assert projetos[0]["feito"] == 0, projetos
assert projetos[1]["total"] == 1, projetos
assert any(a["tipo"] == "erro_interno" and a["projeto"] == "one" for a in alertas), alertas
`;
    const res = spawnSync(PYTHON3, ['-c', script, PROGRESS_PY, delegate], {
      encoding: 'utf8',
      env,
      cwd: root,
      timeout: 30000,
    });
    assert.equal(res.status, 0, `${res.stdout}\n${res.stderr}`);
  });

  it('appends no partial project rows when milestone rows fail', () => {
    const other = join(root, 'other-partial');
    mkdirSync(other, { recursive: true });
    initGitRepo(other);
    writeMap(project, baseMap({ id: 'one' }));
    writeMap(other, baseMap({ id: 'two' }));
    register(project);
    register(other);
    const script = `
import importlib.util, sys
spec = importlib.util.spec_from_file_location("progress", sys.argv[1])
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
def explode(view, states):
    if view.id == "one":
        raise RuntimeError("milestone boom")
    return [{
        "projeto": view.id, "marco": "x", "feito": 0, "total": 0, "pct": 0,
        "resumo": "", "prontos": 0, "bloqueados": 0, "rodando": 0,
    }]
module.milestone_rows = explode
projetos, marcos, execucoes, alertas, carried = module.build_panel(delegate_path=sys.argv[2])
assert [row["id"] for row in projetos] == ["one", "two"], projetos
assert sum(1 for row in projetos if row["id"] == "one") == 1, projetos
assert projetos[0]["feito"] == 0, projetos
assert projetos[1]["total"] == 1, projetos
assert [row["projeto"] for row in marcos] == ["two"], marcos
assert any(a["tipo"] == "erro_interno" and a["projeto"] == "one" for a in alertas), alertas
`;
    const res = spawnSync(PYTHON3, ['-c', script, PROGRESS_PY, delegate], {
      encoding: 'utf8',
      env,
      cwd: root,
      timeout: 30000,
    });
    assert.equal(res.status, 0, `${res.stdout}\n${res.stderr}`);
  });

  it('adds, lists and removes projects and refuses a broken map', () => {
    writeMap(project, baseMap());
    register(project, 'main');
    const registryPath = join(atomicHome, 'progress', 'projects.json');
    const registry = JSON.parse(readFileSync(registryPath, 'utf8'));
    assert.equal(registry.projects.length, 1);
    assert.equal(registry.projects[0].path, project);
    assert.equal(registry.projects[0].ref, 'main');

    let res = run(['list']);
    assert.equal(res.status, 0);
    assert.match(res.stdout, new RegExp(project.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.match(res.stdout, /main/);

    const other = join(root, 'other');
    mkdirSync(other, { recursive: true });
    initGitRepo(other);
    writeMap(other, baseMap({ id: 'bad', milestones: [{ id: 'm', title: 'M', cards: [{ id: 'X', size: 'Z' }] }] }));
    res = run(['add', other, '--ref', 'main']);
    assert.equal(res.status, 1);
    assert.equal(JSON.parse(readFileSync(registryPath, 'utf8')).projects.length, 1);

    res = run(['remove', project]);
    assert.equal(res.status, 0);
    assert.deepEqual(JSON.parse(readFileSync(registryPath, 'utf8')).projects, []);
  });

  it('preserves invalid registry entries when adding and removing', () => {
    const invalid = { path: join(root, 'gone'), ref: '-bad' };
    writeMap(project, baseMap());
    writeRegistry(atomicHome, [{ path: project, ref: 'main' }, invalid]);
    const registryPath = join(atomicHome, 'progress', 'projects.json');

    const other = join(root, 'other-legacy');
    mkdirSync(other, { recursive: true });
    initGitRepo(other);
    writeMap(other, baseMap({ id: 'legacy-other' }));
    let res = run(['add', other, '--ref', 'main']);
    assert.equal(res.status, 0, res.stderr);
    let saved = readJson(registryPath);
    assert.equal(saved.projects.length, 3);
    assert.deepEqual(saved.projects.find((entry) => entry.ref === '-bad'), invalid);

    res = run(['remove', project]);
    assert.equal(res.status, 0, res.stderr);
    saved = readJson(registryPath);
    assert.equal(saved.projects.length, 2);
    assert.deepEqual(saved.projects.find((entry) => entry.ref === '-bad'), invalid);
  });

  it('drops a carried fetch failure when its project or ref leaves the registry', () => {
    writeMap(project, baseMap());
    register(project, 'main');
    git(project, 'update-ref', 'refs/remotes/origin/main', 'HEAD');
    const registryPath = join(atomicHome, 'progress', 'projects.json');
    const registry = readJson(registryPath);
    registry.projects[0].ref = 'origin/main';
    writeFileSync(registryPath, JSON.stringify(registry, null, 2) + '\n');

    const script = `
import importlib.util, sys
spec = importlib.util.spec_from_file_location("progress", sys.argv[1])
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
projetos, marcos, execucoes, alertas, carried = module.build_panel(
    carried_failures={sys.argv[3]: "boom"}, delegate_path=sys.argv[2])
print("\\n".join(alert["tipo"] for alert in alertas))
`;
    const build = (failedPath) => {
      const res = spawnSync(PYTHON3, ['-c', script, PROGRESS_PY, delegate, failedPath], {
        encoding: 'utf8',
        env,
        cwd: root,
        timeout: 30000,
      });
      assert.equal(res.status, 0, `${res.stdout}\n${res.stderr}`);
      return res.stdout;
    };

    assert.match(build(project), /fetch_falhou/, 'a registered origin ref keeps the failure');
    assert.doesNotMatch(build(join(root, 'gone')), /fetch_falhou/, 'an unregistered path drops it');

    const changed = readJson(registryPath);
    changed.projects[0].ref = 'main';
    writeFileSync(registryPath, JSON.stringify(changed, null, 2) + '\n');
    assert.doesNotMatch(build(project), /fetch_falhou/, 'a ref without origin/ drops it');

    writeRegistry(atomicHome, []);
    assert.doesNotMatch(build(project), /fetch_falhou/, 'an emptied registry drops it');
  });

  it('refuses a duplicate map id and alerts on one that reached the registry', () => {
    writeMap(project, baseMap({ id: 'same' }));
    register(project);
    const other = join(root, 'other-same');
    mkdirSync(other, { recursive: true });
    initGitRepo(other);
    writeMap(other, baseMap({ id: 'same' }));
    let res = run(['add', other, '--ref', 'main']);
    assert.equal(res.status, 1, res.stdout + res.stderr);
    assert.match(res.stderr, /same/);

    writeRegistry(atomicHome, [
      { path: project, ref: 'main' },
      { path: other, ref: 'main' },
    ]);
    const [projetos, marcos, , alertas] = collect();
    assert.equal(projetos.length, 1);
    assert.equal(projetos[0].id, 'same');
    assert.equal(marcos.filter((m) => m.projeto === 'same').length, 1);
    assert.ok(alertas.some((a) => a.tipo === 'id_duplicado'), JSON.stringify(alertas));
  });

  it('prints project status with milestones and alerts', () => {
    writeMap(project, baseMap());
    register(project);
    let res = run(['status']);
    assert.equal(res.status, 0, res.stderr);
    assert.match(res.stdout, /app/);
    assert.match(res.stdout, /0%/);
    assert.match(res.stdout, /fundacao/);

    res = run(['status', '--json']);
    assert.equal(res.status, 0, res.stderr);
    const data = JSON.parse(res.stdout);
    assert.equal(data.projects[0].id, 'app');
    assert.equal(data.projects[0].pct, 0);
    assert.equal(data.projects[0].milestones[0].marco, 'fundacao');
    assert.ok(Array.isArray(data.projects[0].alertas));
  });

  // ------------------------------------------------------------------ watch

  it('keeps a fetch failure in every cycle until a fetch succeeds', async () => {
    const bare = join(root, 'origin.git');
    execFileSync('git', ['init', '-q', '--bare', bare], { env: gitEnv() });
    git(project, 'remote', 'add', 'origin', bare);
    writeMap(project, baseMap());
    git(project, 'push', '-q', 'origin', 'main');
    git(project, 'fetch', '-q', 'origin');
    register(project, 'origin/main');
    rmSync(bare, { recursive: true, force: true });

    const child = spawn(
      PYTHON3,
      [PROGRESS_PY, 'watch', '--out', outDir, '--interval', '0.05', '--fetch-every', '3', '--delegate', delegate],
      { env, cwd: root, stdio: ['ignore', 'pipe', 'pipe'] },
    );
    let stderr = '';
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    try {
      const alertsPath = join(outDir, 'alertas.json');
      await waitFor(() => existsSync(alertsPath)
        && readJson(alertsPath).some((a) => a.tipo === 'fetch_falhou'));

      activeStatus([
        { id: 'T-WATCH', project: 'p', profile: 'flash', role: 'implement', machine: 'box', repo: 'acme/app', milestone: null, remote: false, started: '2026-01-01T00:00:00+00:00', age_s: 60, idle_s: 1, runner_gone: false },
      ]);
      const logDir = join(atomicHome, 'delegate');
      mkdirSync(logDir, { recursive: true });
      writeFileSync(join(logDir, 'runs.jsonl'), JSON.stringify({ kind: 'run', id: 'T-WATCH' }) + '\n');

      await waitFor(() => readJson(join(outDir, 'execucoes.json')).length === 1, 2500);
      assert.ok(
        readJson(alertsPath).some((a) => a.tipo === 'fetch_falhou'),
        'the failure must survive a cycle that did not fetch',
      );

      execFileSync('git', ['init', '-q', '--bare', bare], { env: gitEnv() });
      git(project, 'push', '-q', 'origin', 'main');
      try {
        await waitFor(() => !readJson(alertsPath).some((a) => a.tipo === 'fetch_falhou'), 10000);
      } catch (error) {
        throw new Error(`${error.message}\nwatch stderr:\n${stderr}\nalerts: ${readFileSync(alertsPath, 'utf8')}`);
      }

      assert.equal(child.exitCode, null, 'watch must still be running');
    } finally {
      if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    }
  });

  it('watch survives a bad registry and recollects when the ref changes', async () => {
    writeMap(project, oneMilestonePerCard([validCard('W-1')]));
    register(project);
    const registryPath = join(atomicHome, 'progress', 'projects.json');
    const child = spawn(
      PYTHON3,
      [PROGRESS_PY, 'watch', '--out', outDir, '--interval', '0.05', '--fetch-every', '99999', '--delegate', delegate],
      { env, cwd: root, stdio: ['ignore', 'pipe', 'pipe'] },
    );
    try {
      const projetosPath = join(outDir, 'projetos.json');
      const alertsPath = join(outDir, 'alertas.json');
      await waitFor(() => existsSync(projetosPath) && readJson(projetosPath).length === 1);

      writeFileSync(registryPath, '{ broken');
      await waitFor(() => readJson(alertsPath).some((a) => a.tipo === 'registro_invalido'));

      writeRegistry(atomicHome, [{ path: project, ref: 'main' }]);
      await waitFor(() => readJson(projetosPath).length === 1
        && readJson(projetosPath)[0].feito === 0);

      writeMap(
        project,
        oneMilestonePerCard([validCard('W-1', { done: 'merged' })]),
        'mark done',
      );
      await waitFor(() => readJson(projetosPath)[0].feito === 1, 10000);
      assert.equal(child.exitCode, null, 'watch must still be running');
    } finally {
      if (child.exitCode === null && child.signalCode === null) {
        child.kill('SIGTERM');
        await new Promise((resolve) => child.once('exit', resolve));
      }
    }
  });

  it('stops within two seconds of SIGINT during a fetch', async () => {
    const bare = join(root, 'origin.git');
    execFileSync('git', ['init', '-q', '--bare', bare], { env: gitEnv() });
    git(project, 'remote', 'add', 'origin', bare);
    writeMap(project, baseMap());
    git(project, 'push', '-q', 'origin', 'main');
    git(project, 'fetch', '-q', 'origin');
    register(project, 'origin/main');

    const realUploadPack = execFileSync('sh', ['-c', 'command -v git-upload-pack'], { encoding: 'utf8' }).trim();
    const marker = join(root, 'upload-pack.pid');
    const sleeperMarker = join(root, 'upload-pack-sleep.pid');
    const uploadPack = join(root, 'slow-upload-pack');
    writeFileSync(
      uploadPack,
      `#!/bin/sh
echo $$ > "${marker}"
sleep 5 &
echo $! > "${sleeperMarker}"
wait $!
exec ${JSON.stringify(realUploadPack)} "$@"
`,
      { mode: 0o755 },
    );
    git(project, 'config', 'remote.origin.uploadpack', uploadPack);

    const child = spawn(
      PYTHON3,
      [PROGRESS_PY, 'watch', '--out', outDir, '--interval', '0.05', '--fetch-every', '0.5', '--delegate', delegate],
      { env, cwd: root, stdio: ['ignore', 'pipe', 'pipe'] },
    );
    try {
      await waitFor(() => existsSync(marker), 15000);
      const started = Date.now();
      child.kill('SIGINT');
      const code = await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('watch did not exit after SIGINT')), 3000);
        child.once('exit', (exitCode, signal) => {
          clearTimeout(timer);
          resolve(exitCode ?? signal);
        });
      });
      const elapsed = Date.now() - started;
      assert.equal(code, 0);
      assert.ok(elapsed < 2000, `watch took ${elapsed}ms to stop during a fetch`);
    } finally {
      if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    }
    for (const file of [marker, sleeperMarker]) {
      const pid = Number(readFileSync(file, 'utf8').trim());
      await waitFor(() => {
        try {
          process.kill(pid, 0);
          return false;
        } catch (error) {
          return error.code === 'ESRCH';
        }
      }, 2000);
    }
  });

  it('watch collects, reacts to signals and exits cleanly', async () => {
    writeMap(project, baseMap());
    register(project);
    const child = spawn(
      PYTHON3,
      [PROGRESS_PY, 'watch', '--out', outDir, '--interval', '0.05', '--fetch-every', '99999', '--delegate', delegate],
      { env, cwd: root, stdio: ['ignore', 'pipe', 'pipe'] },
    );
    try {
      const deadline = Date.now() + 15000;
      while (Date.now() < deadline && !existsSync(join(outDir, 'projetos.json'))) {
        await new Promise((r) => setTimeout(r, 50));
      }
      assert.ok(existsSync(join(outDir, 'projetos.json')), 'watch did not collect');
      child.kill('SIGTERM');
      const code = await new Promise((resolve) => child.once('exit', (c, sig) => resolve(c ?? sig)));
      assert.equal(code, 0);
    } finally {
      if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    }
  });
});