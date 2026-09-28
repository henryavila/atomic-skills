/**
 * F2 — UI prototype detector tests.
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
  uiPathsForPlan,
  checkPlanUi,
  UI_SURFACE_KEYWORDS,
} from '../scripts/find-missing-ui.js';
import {
  architectureCardSha,
  architecturePathsForPlan,
} from '../scripts/find-missing-architecture.js';
import { hashContent } from '../src/hash.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CLI = join(ROOT, 'scripts', 'find-missing-ui.js');

function runCli(args, cwd) {
  return spawnSync(process.execPath, [CLI, ...args], {
    encoding: 'utf8',
    cwd,
    timeout: 15_000,
  });
}

function writePlan(
  dir,
  body = '---\nslug: fixture\nstatus: active\n---\n\n# fixture\n\n## Tasks\n- Task 1: backend logic\n',
) {
  mkdirSync(dir, { recursive: true });
  const plan = join(dir, 'plan.md');
  writeFileSync(plan, body);
  return plan;
}

function writeCard(planMd, overrides = {}) {
  const paths = architecturePathsForPlan(planMd);
  mkdirSync(dirname(paths.card), { recursive: true });
  const cardData = {
    block: {
      name: 'x_chord',
      start: '{start_of_x_chord}',
      end: '{end_of_x_chord}',
    },
    sketches: [
      {
        id: 'header-out',
        outside: ['title', 'artist'],
        mix: 'parse concatenates the header',
      },
      {
        id: 'nada-fora',
        outside: [],
        mix: 'não mistura',
      },
    ],
    chosen: 'nada-fora',
    ratifiedAt: '2026-09-28T12:00:00.000Z',
    ...overrides,
  };
  const sha = architectureCardSha(cardData);
  const card = { ...cardData, sha };
  writeFileSync(paths.card, `${JSON.stringify(card, null, 2)}\n`);
  return { paths, card, sha };
}

describe('uiPathsForPlan', () => {
  it('resolves ui/ui.json next to the plan', () => {
    const planMd = '/tmp/demo-plan/plan.md';
    const paths = uiPathsForPlan(planMd);
    assert.equal(paths.planDir, dirname(planMd));
    assert.equal(paths.uiJson, join(paths.planDir, 'ui', 'ui.json'));
  });
});

describe('find-missing-ui format (T-001)', () => {
  let dir;
  let planMd;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'ui-format-'));
    planMd = writePlan(dir);
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('missing ui/ui.json exits 1', () => {
    const res = runCli(['--strict', planMd]);
    assert.equal(res.status, 1);
    const out = `${res.stdout}${res.stderr}`;
    assert.match(out, /ui\/ui\.json/);
    assert.match(out, /find-missing-ui\.js/);
  });

  it('empty fixture exits 1 citing missing screens or none: true', () => {
    const paths = uiPathsForPlan(planMd);
    mkdirSync(dirname(paths.uiJson), { recursive: true });
    writeFileSync(paths.uiJson, '{}\n');
    const res = runCli(['--strict', planMd]);
    assert.equal(res.status, 1);
    const out = `${res.stdout}${res.stderr}`;
    assert.match(out, /screens|none/i);
  });

  it('valid none: true with reason exits 0 when plan has no UI touch', () => {
    const paths = uiPathsForPlan(planMd);
    mkdirSync(dirname(paths.uiJson), { recursive: true });
    writeFileSync(
      paths.uiJson,
      `${JSON.stringify({
        none: true,
        reason: 'pure headless CLI and pure scripts; no visual surface',
      }, null, 2)}\n`,
    );
    const r = checkPlanUi(planMd, { strict: true });
    assert.equal(r.ok, true, r.issues.join('; '));
    const res = runCli(['--strict', planMd]);
    assert.equal(res.status, 0, `${res.stdout}${res.stderr}`);
    assert.match(`${res.stdout}${res.stderr}`, /OK/);
  });

  it('valid screens list with path and sha exits 0', () => {
    const paths = uiPathsForPlan(planMd);
    mkdirSync(dirname(paths.uiJson), { recursive: true });
    const protoFile = join(paths.planDir, 'ui', 'screen-1.html');
    writeFileSync(protoFile, '<html><body>Prototype Screen 1</body></html>\n');
    const protoSha = hashContent(readFileSync(protoFile, 'utf8'));

    writeFileSync(
      paths.uiJson,
      `${JSON.stringify({
        screens: [
          {
            path: 'ui/screen-1.html',
            sha: protoSha,
          },
        ],
      }, null, 2)}\n`,
    );

    const r = checkPlanUi(planMd, { strict: true });
    assert.equal(r.ok, true, r.issues.join('; '));
    const res = runCli(['--strict', planMd]);
    assert.equal(res.status, 0, `${res.stdout}${res.stderr}`);
    assert.match(`${res.stdout}${res.stderr}`, /OK/);
  });

  it('chat ok does not stamp ui.json (cli has no writeFileSync)', () => {
    const src = readFileSync(CLI, 'utf8');
    assert.doesNotMatch(src, /writeFileSync/);
  });
});

describe('find-missing-ui detector rules (T-002)', () => {
  let dir;
  let planMd;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'ui-detector-'));
    planMd = writePlan(dir);
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('none: true without reason is rejected', () => {
    const paths = uiPathsForPlan(planMd);
    mkdirSync(dirname(paths.uiJson), { recursive: true });
    writeFileSync(
      paths.uiJson,
      `${JSON.stringify({ none: true }, null, 2)}\n`,
    );
    const r = checkPlanUi(planMd, { strict: true });
    assert.equal(r.ok, false);
    assert.ok(
      r.issues.some((issue) => /reason/i.test(issue)),
      r.issues.join('; '),
    );
  });

  it('refuses none: true when plan touches Vue', () => {
    const paths = uiPathsForPlan(planMd);
    mkdirSync(dirname(paths.uiJson), { recursive: true });
    writeFileSync(
      paths.uiJson,
      `${JSON.stringify({ none: true, reason: 'developer says no ui' }, null, 2)}\n`,
    );
    writePlan(dir, '---\nslug: fixture\nstatus: active\n---\n\n# fixture\n\n## F1\n- T-001: implement Vue component\n');
    const r = checkPlanUi(planMd, { strict: true });
    assert.equal(r.ok, false);
    assert.ok(
      r.issues.some((issue) => /Vue/i.test(issue)),
      r.issues.join('; '),
    );
    const res = runCli(['--strict', planMd]);
    assert.equal(res.status, 1);
    assert.match(`${res.stdout}${res.stderr}`, /Vue/i);
  });

  it('refuses none: true when plan touches sheet', () => {
    const paths = uiPathsForPlan(planMd);
    mkdirSync(dirname(paths.uiJson), { recursive: true });
    writeFileSync(
      paths.uiJson,
      `${JSON.stringify({ none: true, reason: 'developer claims headless' }, null, 2)}\n`,
    );
    writePlan(dir, '---\nslug: fixture\nstatus: active\n---\n\n# fixture\n\n## Tasks\n- Task 1: render bottom sheet\n');
    const r = checkPlanUi(planMd, { strict: true });
    assert.equal(r.ok, false);
    assert.ok(
      r.issues.some((issue) => /sheet/i.test(issue)),
      r.issues.join('; '),
    );
  });

  it('refuses none: true when plan touches viewer', () => {
    const paths = uiPathsForPlan(planMd);
    mkdirSync(dirname(paths.uiJson), { recursive: true });
    writeFileSync(
      paths.uiJson,
      `${JSON.stringify({ none: true, reason: 'claims headless' }, null, 2)}\n`,
    );
    writePlan(dir, '---\nslug: fixture\nstatus: active\n---\n\n# fixture\n\n## Tasks\n- Task 1: embed pdf viewer\n');
    const r = checkPlanUi(planMd, { strict: true });
    assert.equal(r.ok, false);
    assert.ok(
      r.issues.some((issue) => /viewer/i.test(issue)),
      r.issues.join('; '),
    );
  });

  it('refuses none: true when plan touches editor', () => {
    const paths = uiPathsForPlan(planMd);
    mkdirSync(dirname(paths.uiJson), { recursive: true });
    writeFileSync(
      paths.uiJson,
      `${JSON.stringify({ none: true, reason: 'claims headless' }, null, 2)}\n`,
    );
    writePlan(dir, '---\nslug: fixture\nstatus: active\n---\n\n# fixture\n\n## Tasks\n- Task 1: rich text editor component\n');
    const r = checkPlanUi(planMd, { strict: true });
    assert.equal(r.ok, false);
    assert.ok(
      r.issues.some((issue) => /editor/i.test(issue)),
      r.issues.join('; '),
    );
  });

  it('exitGateType: ui-gate does not satisfy ui/ui.json', () => {
    writePlan(
      dir,
      '---\nslug: fixture\nstatus: active\nexitGateType: ui-gate\n---\n\n# fixture\n',
    );
    const res = runCli(['--strict', planMd]);
    assert.equal(res.status, 1);
    const out = `${res.stdout}${res.stderr}`;
    assert.match(out, /ui\/ui\.json/);
    const r = checkPlanUi(planMd, { strict: true });
    assert.equal(r.ok, false);
    assert.ok(
      r.issues.some((issue) => /exitGateType:\s*ui-gate.*does not satisfy/i.test(issue)),
      r.issues.join('; '),
    );
  });

  it('refuses divergent architecture card sha when architectureSha is specified', () => {
    const { sha } = writeCard(planMd);
    const paths = uiPathsForPlan(planMd);
    mkdirSync(dirname(paths.uiJson), { recursive: true });
    writeFileSync(
      paths.uiJson,
      `${JSON.stringify({
        none: true,
        reason: 'pure cli',
        architectureSha: '0000000000000000000000000000000000000000000000000000000000000000',
      }, null, 2)}\n`,
    );
    const r = checkPlanUi(planMd, { strict: true });
    assert.equal(r.ok, false);
    assert.ok(
      r.issues.some((issue) => /architecture sha mismatch/i.test(issue)),
      r.issues.join('; '),
    );
  });

  it('accepts matching architecture card sha', () => {
    const { sha } = writeCard(planMd);
    const paths = uiPathsForPlan(planMd);
    mkdirSync(dirname(paths.uiJson), { recursive: true });
    writeFileSync(
      paths.uiJson,
      `${JSON.stringify({
        none: true,
        reason: 'pure cli',
        architectureSha: sha,
      }, null, 2)}\n`,
    );
    const r = checkPlanUi(planMd, { strict: true });
    assert.equal(r.ok, true, r.issues.join('; '));
  });

  it('screen file sha mismatch exits 1', () => {
    const paths = uiPathsForPlan(planMd);
    mkdirSync(dirname(paths.uiJson), { recursive: true });
    const protoFile = join(paths.planDir, 'ui', 'screen-1.html');
    writeFileSync(protoFile, '<html><body>Real Content</body></html>\n');

    writeFileSync(
      paths.uiJson,
      `${JSON.stringify({
        screens: [
          {
            path: 'ui/screen-1.html',
            sha: 'ffffffffffffffffffffffffffffffff',
          },
        ],
      }, null, 2)}\n`,
    );

    const r = checkPlanUi(planMd, { strict: true });
    assert.equal(r.ok, false);
    assert.ok(
      r.issues.some((issue) => /sha.*mismatch/i.test(issue)),
      r.issues.join('; '),
    );
  });
});

describe('automate-run integration (T-003)', () => {
  it('automate-run calls find-missing-ui.js --strict', () => {
    const src = readFileSync(join(ROOT, 'scripts/automate-run.js'), 'utf8');
    assert.match(src, /find-missing-ui\.js',\s*'--strict'/);
    assert.doesNotMatch(src, /for \(const missing of \['find-missing-ui\.js'\]\)/);
  });

  it('fixture without ui/ui.json exits 1 citing find-missing-ui.js and ui/ui.json', () => {
    const dir = mkdtempSync(join(tmpdir(), 'automate-ui-'));
    const plan = writePlan(dir);
    // Write valid architecture decisions card so architecture passes
    writeCard(plan);
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
    assert.match(res.stderr, /find-missing-ui\.js/);
    assert.match(res.stderr, /ui\/ui\.json/);
    rmSync(dir, { recursive: true, force: true });
  });
});
