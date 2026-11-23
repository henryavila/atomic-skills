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

function baseMap(overrides = {}) {
  return {
    schemaVersion: 1,
    id: 'app',
    title: 'App do Culto',
    unit: 'cartões',
    idPattern: '[A-Z]{1,3}-\\d+[a-z]?',
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
      ['non-string idPattern', { idPattern: 4 }, '$.idPattern'],
      ['bad idPattern', { idPattern: '[' }, '$.idPattern'],
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
      milestones: [{ id: 'a', title: 'A', cards: [{ id: 'X-1', size: 'P', match: '(' }] }],
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
      ], { idPattern: undefined }),
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

  it('uses a card match expression in place of its id, case-insensitively', () => {
    writeMap(
      project,
      oneMilestonePerCard([
        validCard('F-01', { match: 'feature one' }),
        validCard('F-02', { match: 'Feature Two' }),
      ], { idPattern: undefined }),
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
      ], { idPattern: undefined }),
    );
    register(project);
    const [projetos, marcos] = collect();
    assert.equal(projetos[0].feito, 0);
    assert.equal(projetos[0].validado, 0);
    assert.equal(marcos.every((m) => m.pct === 0 && m.prontos === 0), true);
  });

  it('collects from the committed map, not the working-tree copy', () => {
    writeMap(project, oneMilestonePerCard([validCard('W-1')], { idPattern: undefined }));
    register(project);
    // Leave an uncommitted copy that would mark the card done and rename the project.
    writeFileSync(join(project, '.atomic-skills/marcos.json'), JSON.stringify(
      oneMilestonePerCard([validCard('W-1', { done: 'merged' })], {
        id: 'working-tree',
        title: 'Working tree',
        idPattern: undefined,
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
    mergeSubject(project, 'Merge branch feature ZZZ-9', 'feat-zzz');
    register(project);
    const [, , , alertas] = collect();
    const alert = alertas.find((a) => a.tipo === 'card_desconhecido');
    assert.ok(alert, JSON.stringify(alertas));
    assert.equal(alert.projeto, 'app');
    assert.match(alert.detalhe, /ZZZ-9/);
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

  // --------------------------------------------------------------- registry

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
