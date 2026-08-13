/**
 * T-007 — find-missing-flow --strict M4 detector.
 */
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  existsSync,
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
  checkPlanFlow,
  countFlowMessages,
  extractHtmlContentSha,
  findPlanMarkdownFiles,
  flowDocumentSha,
  flowPathsForPlan,
  hasMachineWithState,
} from '../scripts/find-missing-flow.js';
import {
  buildFlowHtml,
  contentFingerprint,
  normalizeFlow,
} from '../scripts/lib/render-flow.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CLI = join(ROOT, 'scripts', 'find-missing-flow.js');
const DS = readFileSync(join(ROOT, 'site', 'assets', 'ds.css'), 'utf8');
const MINIMAL = join(ROOT, 'docs', 'design', 'project-flow', 'dogfood', 'minimal-xor.json');
const SPAWN_OPTS = { encoding: 'utf8', timeout: 60_000, maxBuffer: 8 * 1024 * 1024 };

function loadJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function cloneMinimal() {
  return structuredClone(loadJson(MINIMAL));
}

/**
 * Test-only stamp. Not the product command — T-008 owns buildFlowRatification.
 * @param {object} doc
 * @param {string} [ratifiedAt]
 */
function stampForTest(doc, ratifiedAt = '2026-08-13T12:00:00.000Z') {
  return {
    ...doc,
    ratifiedAt,
    ratifiedGraphSha: flowDocumentSha(doc),
  };
}

function runCli(args, cwd) {
  return spawnSync(process.execPath, [CLI, ...args], { ...SPAWN_OPTS, cwd });
}

describe('flowPathsForPlan', () => {
  it('resolves flow/flow.json and flow/flow.html next to the plan (never map.html)', () => {
    const planMd = '/tmp/demo-plan/plan.md';
    const paths = flowPathsForPlan(planMd);
    assert.equal(paths.planDir, dirname(planMd));
    assert.equal(paths.flowJson, join(paths.planDir, 'flow', 'flow.json'));
    assert.equal(paths.flowHtml, join(paths.planDir, 'flow', 'flow.html'));
    assert.equal(paths.flowHtml.includes('map.html'), false);
  });
});

describe('flowDocumentSha', () => {
  it('equals contentFingerprint(normalizeFlow(doc)) and ignores stamp fields', () => {
    const doc = cloneMinimal();
    const expected = contentFingerprint(normalizeFlow(doc));
    assert.equal(flowDocumentSha(doc), expected);
    assert.match(flowDocumentSha(doc), /^[a-f0-9]{64}$/);
    const stamped = stampForTest(doc);
    assert.equal(flowDocumentSha(stamped), expected);
  });
});

describe('checkPlanFlow', () => {
  let dir;
  let planMd;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'flow-missing-'));
    const planDir = join(dir, 'projects', 'demo', 'sample');
    mkdirSync(planDir, { recursive: true });
    planMd = join(planDir, 'plan.md');
    writeFileSync(planMd, '---\nslug: sample\n---\n# Sample\n');
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  function writeValidFlow({
    stamp = true,
    html = true,
    htmlSha = null,
    mutateGraph = false,
    dropMessages = false,
    mutateAfterStamp = false,
    useRealHtml = false,
  } = {}) {
    const paths = flowPathsForPlan(planMd);
    mkdirSync(join(paths.planDir, 'flow'), { recursive: true });
    let doc = cloneMinimal();
    doc.planSlug = 'sample';
    if (dropMessages) {
      delete doc.graph.nodes.S1.messages;
    }
    if (stamp) {
      doc = stampForTest(doc);
    }
    if (mutateGraph || mutateAfterStamp) {
      doc.graph.nodes.S1.label = 'Mutated after stamp';
    }
    writeFileSync(paths.flowJson, `${JSON.stringify(doc, null, 2)}\n`);
    if (html) {
      let out;
      if (useRealHtml) {
        out = buildFlowHtml(doc, DS).html;
      } else {
        const sha = htmlSha || contentFingerprint(normalizeFlow(doc));
        out = `<html data-fl-content-sha="${sha}"></html>\n`;
      }
      if (htmlSha && useRealHtml) {
        out = out.replace(
          /data-fl-content-sha="[a-f0-9]{64}"/,
          `data-fl-content-sha="${htmlSha}"`,
        );
      }
      writeFileSync(paths.flowHtml, out);
    }
    return { paths, doc };
  }

  it('fails when flow.json is missing', () => {
    const r = checkPlanFlow(planMd);
    assert.equal(r.ok, false);
    assert.ok(r.issues.some((i) => /missing L1|flow\.json/.test(i)), r.issues.join('; '));
  });

  it('passes --strict when json + html + stamp + content-sha match (M4)', () => {
    writeValidFlow();
    const r = checkPlanFlow(planMd, { strict: true });
    assert.equal(r.ok, true, r.issues.join('; '));
  });

  it('passes --strict against real F1 HTML (data-fl-content-sha)', () => {
    const { doc } = writeValidFlow({ useRealHtml: true });
    const r = checkPlanFlow(planMd, { strict: true });
    assert.equal(r.ok, true, r.issues.join('; '));
    const html = readFileSync(flowPathsForPlan(planMd).flowHtml, 'utf8');
    assert.equal(extractHtmlContentSha(html), flowDocumentSha(doc));
  });

  it('valid unstamped L1+L2 fails --strict and passes non-strict', () => {
    writeValidFlow({ stamp: false });
    const loose = checkPlanFlow(planMd);
    assert.equal(loose.ok, true, loose.issues.join('; '));
    const strict = checkPlanFlow(planMd, { strict: true });
    assert.equal(strict.ok, false);
    assert.ok(strict.issues.some((i) => /ratifiedAt/.test(i)), strict.issues.join('; '));
    assert.ok(strict.issues.some((i) => /ratifiedGraphSha/.test(i)), strict.issues.join('; '));
  });

  it('fails --strict when graph mutated after stamp (sha diverge)', () => {
    writeValidFlow({ mutateAfterStamp: true });
    const r = checkPlanFlow(planMd, { strict: true });
    assert.equal(r.ok, false);
    assert.ok(r.issues.some((i) => /ratifiedGraphSha|graph/.test(i)), r.issues.join('; '));
  });

  it('fails --strict when HTML content-sha does not match L1', () => {
    writeValidFlow({ htmlSha: 'a'.repeat(64) });
    const r = checkPlanFlow(planMd, { strict: true });
    assert.equal(r.ok, false);
    assert.ok(r.issues.some((i) => /content-sha/.test(i)), r.issues.join('; '));
  });

  it('fails --strict when flow.html is missing', () => {
    writeValidFlow({ html: false });
    const r = checkPlanFlow(planMd, { strict: true });
    assert.equal(r.ok, false);
    assert.ok(r.issues.some((i) => /missing L2|flow\.html/.test(i)), r.issues.join('; '));
  });

  it('fails --strict when messages are absent (M4)', () => {
    writeValidFlow({ dropMessages: true });
    assert.equal(countFlowMessages(JSON.parse(readFileSync(flowPathsForPlan(planMd).flowJson, 'utf8'))), 0);
    const r = checkPlanFlow(planMd, { strict: true });
    assert.equal(r.ok, false);
    assert.ok(r.issues.some((i) => /messages/.test(i)), r.issues.join('; '));
  });

  it('hasMachineWithState is true for dogfood and false for empty machines', () => {
    const doc = cloneMinimal();
    assert.equal(hasMachineWithState(doc), true);
    assert.equal(hasMachineWithState({ machines: [] }), false);
    assert.equal(hasMachineWithState({ machines: [{ id: 'x', nodes: {} }] }), false);
  });

  it('fails when only process.yaml exists (process-map never counts as success)', () => {
    const paths = flowPathsForPlan(planMd);
    mkdirSync(join(paths.planDir, 'process'), { recursive: true });
    writeFileSync(
      join(paths.planDir, 'process', 'process.yaml'),
      'planSlug: sample\nactor: x\nscenario: y\nstages: []\n',
    );
    const r = checkPlanFlow(planMd, { strict: true });
    assert.equal(r.ok, false);
    assert.ok(r.issues.some((i) => /flow\.json|missing L1/.test(i)), r.issues.join('; '));
    assert.ok(
      r.issues.some((i) => /process\.yaml \/ map\.html do not satisfy flow/.test(i)),
      r.issues.join('; '),
    );
  });

  it('never writes map.html', () => {
    const paths = flowPathsForPlan(planMd);
    const mapHtml = join(paths.planDir, 'process', 'map.html');
    checkPlanFlow(planMd);
    writeValidFlow();
    checkPlanFlow(planMd, { strict: true });
    assert.equal(existsSync(mapHtml), false);
    const src = readFileSync(CLI, 'utf8');
    assert.equal(/writeFileSync\([^)]*map\.html/.test(src), false);
    const detector = runCli([planMd]);
    assert.notEqual(detector.status, 2);
    assert.equal(existsSync(mapHtml), false);
  });

  it('does not write ratifiedAt (no product stamp in this script)', () => {
    const src = readFileSync(CLI, 'utf8');
    assert.doesNotMatch(src, /export function buildFlowRatification/);
    assert.doesNotMatch(src, /writeFileSync\([^)]*ratifiedAt/);
    assert.doesNotMatch(src, /args\.includes\(['"]--ratify['"]\)/);
    assert.match(src, /from 'node:fs'/);
    assert.doesNotMatch(src, /writeFileSync/);
  });

  it('without --strict still fails when json exists but is invalid', () => {
    const paths = flowPathsForPlan(planMd);
    mkdirSync(join(paths.planDir, 'flow'), { recursive: true });
    writeFileSync(paths.flowJson, '{ not json');
    writeFileSync(paths.flowHtml, '<html></html>');
    const r = checkPlanFlow(planMd);
    assert.equal(r.ok, false);
    assert.ok(r.issues.some((i) => /parse|invalid/i.test(i)), r.issues.join('; '));
  });
});

describe('find-missing-flow CLI', () => {
  it('exits 2 when the target path does not exist', () => {
    const r = runCli([join(tmpdir(), 'no-such-plan-dir-xyz', 'plan.md')]);
    assert.equal(r.status, 2);
  });

  it('exits 1 and supports --json / --strict for a missing flow', () => {
    const dir = mkdtempSync(join(tmpdir(), 'flow-cli-'));
    try {
      const planDir = join(dir, 'projects', 'demo', 'sample');
      mkdirSync(planDir, { recursive: true });
      const planMd = join(planDir, 'plan.md');
      writeFileSync(planMd, '---\nslug: sample\n---\n# Sample\n');
      const r = runCli(['--json', '--strict', planMd]);
      assert.equal(r.status, 1);
      const report = JSON.parse(r.stdout);
      assert.equal(report.ok, false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('--strict / --check exit 0 only when every M4 piece is present', () => {
    const dir = mkdtempSync(join(tmpdir(), 'flow-strict-ok-'));
    try {
      const planDir = join(dir, 'projects', 'demo', 'sample');
      mkdirSync(planDir, { recursive: true });
      const planMd = join(planDir, 'plan.md');
      writeFileSync(planMd, '---\nslug: sample\n---\n# Sample\n');
      const paths = flowPathsForPlan(planMd);
      mkdirSync(join(paths.planDir, 'flow'), { recursive: true });
      let doc = cloneMinimal();
      doc.planSlug = 'sample';
      doc = stampForTest(doc);
      writeFileSync(paths.flowJson, `${JSON.stringify(doc, null, 2)}\n`);
      const sha = flowDocumentSha(doc);
      writeFileSync(paths.flowHtml, `<html data-flow-content-sha="${sha}"></html>\n`);

      const okStrict = runCli(['--strict', planMd]);
      assert.equal(okStrict.status, 0, okStrict.stderr || okStrict.stdout);
      const okCheck = runCli(['--check', planMd]);
      assert.equal(okCheck.status, 0, okCheck.stderr || okCheck.stdout);

      writeFileSync(paths.flowHtml, '<html></html>\n');
      const missingSha = runCli(['--strict', planMd]);
      assert.equal(missingSha.status, 1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('treats any existing *.md file as the plan (foreign cutover.md)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'flow-cutover-'));
    try {
      const docs = join(dir, 'docs');
      mkdirSync(docs, { recursive: true });
      const source = join(docs, 'cutover.md');
      writeFileSync(source, '# Cutover\n\nForeign source, not named plan.md.\n');

      assert.deepEqual(findPlanMarkdownFiles(source), [source]);

      const missing = runCli(['--strict', '--json', source]);
      assert.equal(missing.status, 1, missing.stderr || missing.stdout);
      const missingReport = JSON.parse(missing.stdout);
      assert.equal(missingReport.ok, false);
      assert.notEqual(missingReport.note, 'no-plans');
      assert.ok(
        (missingReport.results?.[0]?.issues ?? []).some((i) => /missing L1|flow\.json/.test(i)),
        JSON.stringify(missingReport),
      );

      mkdirSync(join(docs, 'process'), { recursive: true });
      writeFileSync(
        join(docs, 'process', 'process.yaml'),
        'planSlug: cutover\nactor: x\nscenario: y\nstages: []\n',
      );
      const yamlOnly = runCli(['--strict', '--json', source]);
      assert.equal(yamlOnly.status, 1, yamlOnly.stderr || yamlOnly.stdout);
      const yamlReport = JSON.parse(yamlOnly.stdout);
      assert.equal(yamlReport.ok, false);
      const yamlIssues = yamlReport.results?.[0]?.issues ?? [];
      assert.ok(yamlIssues.some((i) => /missing L1|flow\.json/.test(i)), yamlIssues.join('; '));
      assert.ok(
        yamlIssues.some((i) => /process\.yaml \/ map\.html do not satisfy flow/.test(i)),
        yamlIssues.join('; '),
      );

      let doc = cloneMinimal();
      doc.planSlug = 'cutover';
      doc = stampForTest(doc);
      const paths = flowPathsForPlan(source);
      mkdirSync(join(paths.planDir, 'flow'), { recursive: true });
      writeFileSync(paths.flowJson, `${JSON.stringify(doc, null, 2)}\n`);
      const sha = flowDocumentSha(doc);
      writeFileSync(paths.flowHtml, `<html data-fl-content-sha="${sha}"></html>\n`);
      const ok = runCli(['--strict', source]);
      assert.equal(ok.status, 0, ok.stderr || ok.stdout);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('does not treat note: no-plans as success when the user passed a file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'flow-not-md-'));
    try {
      const notMd = join(dir, 'notes.txt');
      writeFileSync(notMd, 'not markdown\n');
      const r = runCli(['--json', '--strict', notMd]);
      assert.notEqual(r.status, 0);
      if (r.stdout.trim()) {
        assert.doesNotMatch(r.stdout, /"note":\s*"no-plans"/);
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
