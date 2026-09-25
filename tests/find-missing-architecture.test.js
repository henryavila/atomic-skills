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
});
