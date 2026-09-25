/**
 * F1 — architecture block-card detector.
 */
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  architectureCardSha,
  architecturePathsForPlan,
  checkPlanArchitecture,
} from '../scripts/find-missing-architecture.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CLI = join(ROOT, 'scripts', 'find-missing-architecture.js');

function runCli(args, cwd) {
  return spawnSync(process.execPath, [CLI, ...args], {
    encoding: 'utf8',
    cwd,
    timeout: 15_000,
  });
}

function writePlan(dir, body = '---\nslug: fixture\nstatus: active\n---\n\n# fixture\n') {
  mkdirSync(dir, { recursive: true });
  const plan = join(dir, 'plan.md');
  writeFileSync(plan, body);
  return plan;
}

function drawing(overrides = {}) {
  return {
    block: {
      name: 'x_chord',
      start: '{start_of_x_chord}',
      end: '{end_of_x_chord}',
    },
    sketches: [
      {
        id: 'header-out',
        outside: ['title', 'artist', 'youtube', 'audio'],
        mix: 'parse concatenates the header back onto each chart',
      },
      {
        id: 'nada-fora',
        outside: [],
        mix: 'não mistura',
      },
    ],
    chosen: 'nada-fora',
    ...overrides,
  };
}

function stamp(card) {
  return {
    ...card,
    sha: architectureCardSha(card),
    ratifiedAt: '2026-09-25T12:00:00.000Z',
  };
}

describe('architecturePathsForPlan', () => {
  it('resolves architecture/decisions.json next to the plan', () => {
    const planMd = '/tmp/demo-plan/plan.md';
    const paths = architecturePathsForPlan(planMd);
    assert.equal(paths.planDir, dirname(planMd));
    assert.equal(paths.card, join(paths.planDir, 'architecture', 'decisions.json'));
  });
});

describe('find-missing-architecture card format', () => {
  let dir;
  let planMd;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'arch-card-'));
    planMd = writePlan(dir);
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('missing architecture/decisions.json exits 1', () => {
    const res = runCli(['--strict', planMd]);
    assert.equal(res.status, 1);
    assert.match(`${res.stdout}${res.stderr}`, /architecture\/decisions\.json/);
    assert.match(`${res.stdout}${res.stderr}`, /find-missing-architecture\.js/);
  });

  it('schema requires delimiter, outside list, mix line, second sketch, chosen sketch', () => {
    const paths = architecturePathsForPlan(planMd);
    mkdirSync(dirname(paths.card), { recursive: true });
    writeFileSync(
      paths.card,
      `${JSON.stringify({
        block: { name: 'x_chord' },
        sketches: [{ outside: ['title'], mix: 'parse colou o header' }],
      })}\n`,
    );
    const r = checkPlanArchitecture(planMd, { strict: true });
    assert.equal(r.ok, false);
    const text = r.issues.join('; ');
    assert.match(text, /delimiter|start|end/);
    assert.match(text, /two sketches|second sketch/);
    assert.match(text, /chosen/);
  });

  it('chat ok does not stamp ratifiedAt', () => {
    const src = readFileSync(CLI, 'utf8');
    assert.doesNotMatch(src, /writeFileSync/);
    const paths = architecturePathsForPlan(planMd);
    mkdirSync(dirname(paths.card), { recursive: true });
    const card = drawing({ ok: true, chat: 'ok' });
    writeFileSync(paths.card, `${JSON.stringify(card, null, 2)}\n`);
    const before = readFileSync(paths.card, 'utf8');
    const res = runCli(['--strict', planMd]);
    assert.equal(res.status, 1);
    assert.match(`${res.stdout}${res.stderr}`, /sha|ratifiedAt/);
    assert.equal(readFileSync(paths.card, 'utf8'), before);
    const onDisk = JSON.parse(before);
    assert.equal(onDisk.ratifiedAt, undefined);
    assert.equal(onDisk.sha, undefined);
  });

  it('third unvalidated chosen sketch exits 1', () => {
    const paths = architecturePathsForPlan(planMd);
    mkdirSync(dirname(paths.card), { recursive: true });
    const base = drawing();
    const card = stamp({
      ...base,
      sketches: [
        ...base.sketches,
        { id: 'garbage', outside: ['noise'], mix: 'parse concatenates garbage' },
      ],
      chosen: 'garbage',
    });
    writeFileSync(paths.card, `${JSON.stringify(card, null, 2)}\n`);
    const r = checkPlanArchitecture(planMd, { strict: true });
    assert.equal(r.ok, false, r.issues.join('; '));
    assert.ok(
      r.chosenIndex == null || r.chosenIndex > 1,
      `chosenIndex=${r.chosenIndex} must not resolve to an unvalidated third sketch`,
    );
    const res = runCli(['--strict', planMd]);
    assert.equal(res.status, 1, `${res.stdout}${res.stderr}`);
    assert.match(`${res.stdout}${res.stderr}`, /chosen|two sketches/);
  });

  it('1-based chosen 1 and 2 select distinct sketches', () => {
    const paths = architecturePathsForPlan(planMd);
    mkdirSync(dirname(paths.card), { recursive: true });
    writeFileSync(paths.card, `${JSON.stringify(stamp(drawing({ chosen: 1 })), null, 2)}\n`);
    const first = checkPlanArchitecture(planMd, { strict: true });
    assert.equal(first.ok, true, first.issues.join('; '));
    assert.equal(first.chosenIndex, 0, 'numeric 1 is the first sketch');

    writeFileSync(paths.card, `${JSON.stringify(stamp(drawing({ chosen: 2 })), null, 2)}\n`);
    const second = checkPlanArchitecture(planMd, { strict: true });
    assert.equal(second.ok, true, second.issues.join('; '));
    assert.equal(second.chosenIndex, 1, 'numeric 2 is the second sketch');
    assert.notEqual(first.chosenIndex, second.chosenIndex);
  });
});

describe('find-missing-architecture detector', () => {
  let dir;
  let planMd;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'arch-detect-'));
    planMd = writePlan(dir);
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('userApproved / find-missing-design-process.js do not satisfy', () => {
    mkdirSync(join(dir, '.atomic-skills/status/design-gates'), { recursive: true });
    writeFileSync(
      join(dir, '.atomic-skills/status/design-gates/demo-fixture.json'),
      `${JSON.stringify({
        schemaVersion: '0.1',
        userApproved: true,
        status: 'ready',
      })}\n`,
    );
    writeFileSync(
      join(dir, 'find-missing-design-process.js'),
      'throw new Error("not the architecture card");\n',
    );
    const res = runCli(['--strict', planMd]);
    assert.equal(res.status, 1);
    const out = `${res.stdout}${res.stderr}`;
    assert.match(out, /architecture\/decisions\.json/);
    assert.doesNotMatch(out, /plan\(s\) OK/);
    const r = checkPlanArchitecture(planMd, { strict: true });
    assert.equal(r.ok, false);
    assert.ok(
      r.issues.some((issue) => /userApproved|find-missing-design-process/.test(issue)),
      r.issues.join('; '),
    );
  });

  it('forbidden phrases without the drawing fail', () => {
    const paths = architecturePathsForPlan(planMd);
    mkdirSync(dirname(paths.card), { recursive: true });
    const incomplete = {
      block: { name: 'se eu mexer nisto', start: 'a outra', end: 'consistente' },
      sketches: [
        { id: 'isolado', mix: 'se eu mexer nisto fica consistente' },
      ],
      chosen: 'a outra',
      ratifiedAt: '2026-09-25T12:00:00.000Z',
    };
    writeFileSync(
      paths.card,
      `${JSON.stringify({ ...incomplete, sha: architectureCardSha(incomplete) }, null, 2)}\n`,
    );
    const res = runCli(['--strict', planMd]);
    assert.equal(res.status, 1);
    const out = `${res.stdout}${res.stderr}`;
    assert.match(out, /forbidden phrase without the drawing/);
    assert.doesNotMatch(out, /sha does not match/);
  });

  it('na outra is not the forbidden phrase a outra', () => {
    const paths = architecturePathsForPlan(planMd);
    mkdirSync(dirname(paths.card), { recursive: true });
    const incomplete = {
      block: { name: 'x_chord', start: '{start_of_x_chord}', end: '{end_of_x_chord}' },
      sketches: [
        { id: 'header-out', mix: 'parse concatenates the header na outra passagem' },
      ],
      chosen: 'header-out',
      ratifiedAt: '2026-09-25T12:00:00.000Z',
    };
    writeFileSync(
      paths.card,
      `${JSON.stringify({ ...incomplete, sha: architectureCardSha(incomplete) }, null, 2)}\n`,
    );
    const r = checkPlanArchitecture(planMd, { strict: true });
    assert.equal(r.ok, false);
    assert.ok(
      !r.issues.some((issue) => /forbidden phrase/.test(issue) && /a outra/.test(issue)),
      r.issues.join('; '),
    );
  });

  it('complete drawing does not fail on na outra or isolado inside a mix line', () => {
    const paths = architecturePathsForPlan(planMd);
    mkdirSync(dirname(paths.card), { recursive: true });
    const card = stamp(
      drawing({
        sketches: [
          {
            id: 'header-out',
            outside: ['title', 'artist', 'youtube', 'audio'],
            mix: 'parse concatenates the header na outra passagem isolado do corte',
          },
          {
            id: 'nada-fora',
            outside: [],
            mix: 'não mistura',
          },
        ],
        chosen: 'nada-fora',
      }),
    );
    writeFileSync(paths.card, `${JSON.stringify(card, null, 2)}\n`);
    const r = checkPlanArchitecture(planMd, { strict: true });
    assert.equal(r.ok, true, r.issues.join('; '));
    const res = runCli(['--strict', planMd]);
    assert.equal(res.status, 0, `${res.stdout}${res.stderr}`);
  });

  it('sha mismatch vs drawing exits 1', () => {
    const paths = architecturePathsForPlan(planMd);
    mkdirSync(dirname(paths.card), { recursive: true });
    const card = {
      ...stamp(drawing()),
      sha: 'ffffffffffffffffffffffffffffffff',
    };
    writeFileSync(paths.card, `${JSON.stringify(card, null, 2)}\n`);
    const res = runCli(['--strict', planMd]);
    assert.equal(res.status, 1);
    const out = `${res.stdout}${res.stderr}`;
    assert.match(out, /sha does not match drawing/);
    assert.doesNotMatch(out, /unrelated text/);
  });

  it('valid card with sha and ratifiedAt exits 0', () => {
    const paths = architecturePathsForPlan(planMd);
    mkdirSync(dirname(paths.card), { recursive: true });
    const card = stamp(drawing());
    writeFileSync(paths.card, `${JSON.stringify(card, null, 2)}\n`);
    const r = checkPlanArchitecture(planMd, { strict: true });
    assert.equal(r.ok, true, r.issues.join('; '));
    const res = runCli(['--strict', planMd]);
    assert.equal(res.status, 0, `${res.stdout}${res.stderr}`);
    assert.match(`${res.stdout}${res.stderr}`, /OK/);
  });

  it('exit 0 only with sha and ratifiedAt', () => {
    const paths = architecturePathsForPlan(planMd);
    mkdirSync(dirname(paths.card), { recursive: true });
    writeFileSync(paths.card, `${JSON.stringify(drawing(), null, 2)}\n`);
    assert.equal(runCli(['--strict', planMd]).status, 1);
    const withSha = { ...drawing(), sha: architectureCardSha(drawing()) };
    writeFileSync(paths.card, `${JSON.stringify(withSha, null, 2)}\n`);
    assert.equal(runCli(['--strict', planMd]).status, 1);
    const withStamp = stamp(drawing());
    writeFileSync(paths.card, `${JSON.stringify(withStamp, null, 2)}\n`);
    assert.equal(runCli(['--strict', planMd]).status, 0);
    const chatStamp = stamp({ ...drawing(), ratifiedAt: 'ok' });
    writeFileSync(
      paths.card,
      `${JSON.stringify({ ...chatStamp, ratifiedAt: 'ok' }, null, 2)}\n`,
    );
    const chat = runCli(['--strict', planMd]);
    assert.equal(chat.status, 1);
    assert.match(`${chat.stdout}${chat.stderr}`, /ratifiedAt/);
  });
});

describe('automate-run architecture gate', () => {
  it('fixture without a card exits 1 citing the detector reason', () => {
    const dir = mkdtempSync(join(tmpdir(), 'automate-arch-'));
    const plan = writePlan(dir);
    const res = spawnSync(
      process.execPath,
      [
        join(ROOT, 'scripts/automate-run.js'),
        '--host',
        'grok',
        '--plan',
        plan,
        '--root',
        dir,
      ],
      { encoding: 'utf8', timeout: 20_000 },
    );
    assert.equal(res.status, 1);
    assert.match(res.stderr, /find-missing-architecture\.js/);
    assert.match(res.stderr, /architecture\/decisions\.json/);
    rmSync(dir, { recursive: true, force: true });
  });
});
