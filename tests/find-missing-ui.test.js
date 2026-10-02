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

describe('review fixes', () => {
  let dir;
  let planMd;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'ui-review-'));
    planMd = writePlan(dir);
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  function writeNone(extra = {}) {
    const paths = uiPathsForPlan(planMd);
    mkdirSync(dirname(paths.uiJson), { recursive: true });
    writeFileSync(
      paths.uiJson,
      `${JSON.stringify({ none: true, reason: 'pure cli', ...extra }, null, 2)}\n`,
    );
    return paths;
  }

  function writeScreens(screens) {
    const paths = uiPathsForPlan(planMd);
    mkdirSync(dirname(paths.uiJson), { recursive: true });
    writeFileSync(paths.uiJson, `${JSON.stringify({ screens }, null, 2)}\n`);
    return paths;
  }

  it('missing screens[].path prototype fails and exits 1', () => {
    writeScreens([{ path: 'ui/missing.html', sha: 'abc' }]);
    const r = checkPlanUi(planMd, { strict: true });
    assert.equal(r.ok, false);
    assert.ok(
      r.issues.some((issue) => /missing prototype|not found|does not exist/i.test(issue)),
      r.issues.join('; '),
    );
    const res = runCli(['--strict', planMd]);
    assert.equal(res.status, 1);
  });

  it('directory screens[].path fails', () => {
    writeScreens([{ path: 'ui', sha: 'abc' }]);
    const r = checkPlanUi(planMd, { strict: true });
    assert.equal(r.ok, false);
    assert.ok(
      r.issues.some((issue) => /not a file|directory/i.test(issue)),
      r.issues.join('; '),
    );
  });

  it('empty screen file fails', () => {
    const paths = uiPathsForPlan(planMd);
    mkdirSync(dirname(paths.uiJson), { recursive: true });
    writeFileSync(join(paths.planDir, 'ui', 'empty.html'), '  \n');
    writeFileSync(
      paths.uiJson,
      `${JSON.stringify({ screens: [{ path: 'ui/empty.html', sha: hashContent('  \n') }] }, null, 2)}\n`,
    );
    const r = checkPlanUi(planMd, { strict: true });
    assert.equal(r.ok, false);
    assert.ok(r.issues.some((issue) => /empty/i.test(issue)), r.issues.join('; '));
  });

  it('absolute and parent-traversal screen paths fail', () => {
    writeScreens([{ path: '/tmp/screen.html', sha: 'abc' }]);
    const abs = checkPlanUi(planMd, { strict: true });
    assert.equal(abs.ok, false);
    assert.ok(
      abs.issues.some((issue) => /relative|absolute|escape|plan directory/i.test(issue)),
      abs.issues.join('; '),
    );
    writeScreens([{ path: '../outside.html', sha: 'abc' }]);
    const trav = checkPlanUi(planMd, { strict: true });
    assert.equal(trav.ok, false);
    assert.ok(
      trav.issues.some((issue) => /relative|traversal|\.\.|escape|plan directory/i.test(issue)),
      trav.issues.join('; '),
    );
  });

  it('empty or non-string architectureSha/cardSha fail', () => {
    writeNone({ architectureSha: '' });
    const empty = checkPlanUi(planMd, { strict: true });
    assert.equal(empty.ok, false);
    assert.ok(empty.issues.some((issue) => /architectureSha/i.test(issue)), empty.issues.join('; '));
    writeNone({ cardSha: 123 });
    const bad = checkPlanUi(planMd, { strict: true });
    assert.equal(bad.ok, false);
    assert.ok(bad.issues.some((issue) => /cardSha/i.test(issue)), bad.issues.join('; '));
  });

  it('conflicting architectureSha and cardSha fail', () => {
    const { sha } = writeCard(planMd);
    writeNone({ architectureSha: sha, cardSha: '0'.repeat(64) });
    const r = checkPlanUi(planMd, { strict: true });
    assert.equal(r.ok, false);
    assert.ok(r.issues.some((issue) => /conflict/i.test(issue)), r.issues.join('; '));
  });

  it('cited sha with missing or malformed architecture card fails', () => {
    writeNone({ architectureSha: 'abc123def' });
    const missing = checkPlanUi(planMd, { strict: true });
    assert.equal(missing.ok, false);
    assert.ok(
      missing.issues.some((issue) => /missing|not found|card/i.test(issue)),
      missing.issues.join('; '),
    );
    const { paths } = writeCard(planMd);
    writeFileSync(paths.card, '{not json');
    writeNone({ architectureSha: 'abc123def' });
    const malformed = checkPlanUi(planMd, { strict: true });
    assert.equal(malformed.ok, false);
    assert.ok(malformed.issues.some((issue) => /malformed/i.test(issue)), malformed.issues.join('; '));
  });

  it('existing architecture card without cited sha fails; no card and no sha still passes', () => {
    writeCard(planMd);
    writeNone();
    const cited = checkPlanUi(planMd, { strict: true });
    assert.equal(cited.ok, false);
    assert.ok(
      cited.issues.some((issue) => /architectureSha|cardSha|cite/i.test(issue)),
      cited.issues.join('; '),
    );
    rmSync(join(dir, 'architecture'), { recursive: true, force: true });
    const none = checkPlanUi(planMd, { strict: true });
    assert.equal(none.ok, true, none.issues.join('; '));
  });

  it('none: true refuses UI keywords in phases/*.md and skips phases/archive/', () => {
    writeNone();
    mkdirSync(join(dir, 'phases', 'archive'), { recursive: true });
    writeFileSync(join(dir, 'phases', 'archive', 'old.md'), '# old\n\nVue sheet viewer editor\n');
    const archived = checkPlanUi(planMd, { strict: true });
    assert.equal(archived.ok, true, archived.issues.join('; '));
    writeFileSync(join(dir, 'phases', 'f1.md'), '# F1\n\n- implement Vue component\n');
    const live = checkPlanUi(planMd, { strict: true });
    assert.equal(live.ok, false);
    assert.ok(live.issues.some((issue) => /Vue/i.test(issue)), live.issues.join('; '));
  });

  it('detects plurals, camelCase, and spreadsheet; ignores reviewer/creditor/CodeReviewer', () => {
    writeNone();
    writePlan(dir, '# p\n\nUse pdfViewer, sheets, and a RichTextEditor.\n');
    const hit = checkPlanUi(planMd, { strict: true });
    assert.equal(hit.ok, false);
    const blob = hit.issues.join('; ');
    assert.match(blob, /viewer/i);
    assert.match(blob, /sheet/i);
    assert.match(blob, /editor/i);
    writePlan(dir, '# p\n\nAsk the reviewer and creditor; CodeReviewer bot.\n');
    const miss = checkPlanUi(planMd, { strict: true });
    assert.equal(miss.ok, true, miss.issues.join('; '));
    writePlan(dir, '# p\n\nRender a spreadsheet of results.\n');
    const sheet = checkPlanUi(planMd, { strict: true });
    assert.equal(sheet.ok, false);
    assert.ok(sheet.issues.some((issue) => /sheet/i.test(issue)), sheet.issues.join('; '));
  });

  it('skips outOfScope frontmatter, Out of scope headings, and fenced code', () => {
    writeNone();
    writePlan(
      dir,
      `---
slug: fixture
outOfScope: Vue viewer editor sheet
---

# fixture

## Out of scope
- Vue dashboard

## Fora de escopo
- pdf viewer

## Tasks
- backend only

\`\`\`js
const viewer = new PdfViewer();
\`\`\`
`,
    );
    const r = checkPlanUi(planMd, { strict: true });
    assert.equal(r.ok, true, r.issues.join('; '));
  });
});
