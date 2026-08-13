/**
 * PR3 — find-missing-flow detector + buildFlowRatification.
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
  buildFlowRatification,
  checkPlanFlow,
  flowPathsForPlan,
  graphSha,
} from '../scripts/find-missing-flow.js';
import { buildFlowHtml, sha256, stableStringify } from '../scripts/lib/render-flow.js';

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

function runCli(args, cwd) {
  return spawnSync(process.execPath, [CLI, ...args], { ...SPAWN_OPTS, cwd });
}

describe('flowPathsForPlan', () => {
  it('resolves flow/flow.json and flow/flow.html next to plan.md (never map.html)', () => {
    const planMd = '/tmp/demo-plan/plan.md';
    const paths = flowPathsForPlan(planMd);
    assert.equal(paths.planDir, dirname(planMd));
    assert.equal(paths.flowJson, join(paths.planDir, 'flow', 'flow.json'));
    assert.equal(paths.flowHtml, join(paths.planDir, 'flow', 'flow.html'));
    assert.equal(paths.flowHtml.includes('map.html'), false);
  });
});

describe('graphSha + buildFlowRatification', () => {
  it('graphSha is sha256(stableStringify(graph)) and is key-order stable', () => {
    const graph = cloneMinimal().graph;
    const expected = sha256(stableStringify(graph));
    assert.equal(graphSha(graph), expected);
    assert.match(graphSha(graph), /^[a-f0-9]{64}$/);
    const reordered = { nodes: graph.nodes, entry: graph.entry };
    assert.equal(graphSha(reordered), expected);
  });

  it('buildFlowRatification is the only stamp writer (ratifiedAt + ratifiedGraphSha)', () => {
    const doc = cloneMinimal();
    assert.equal('ratifiedAt' in doc, false);
    assert.equal('ratifiedGraphSha' in doc, false);
    const stamped = buildFlowRatification(doc, {
      ratifiedAt: '2026-08-13T12:00:00.000Z',
      ratifiedBy: 'operator',
    });
    assert.equal(stamped.ratifiedAt, '2026-08-13T12:00:00.000Z');
    assert.equal(stamped.ratifiedBy, 'operator');
    assert.equal(stamped.ratifiedGraphSha, graphSha(doc.graph));
    assert.equal('ratifiedAt' in doc, false);
    assert.equal('ratifiedGraphSha' in doc, false);

    const nowStamped = buildFlowRatification(doc);
    assert.match(nowStamped.ratifiedAt, /^\d{4}-\d{2}-\d{2}T/);
    assert.equal(nowStamped.ratifiedGraphSha, graphSha(doc.graph));

    const src = readFileSync(CLI, 'utf8');
    assert.match(src, /export function buildFlowRatification/);
    const [beforeHelper, afterHelper = ''] = src.split('export function buildFlowRatification');
    assert.match(afterHelper, /ratifiedAt/);
    assert.match(afterHelper, /ratifiedGraphSha:\s*graphSha/);
    const stampAssign = /ratified(At|GraphSha)\s*[:=]/;
    assert.equal(
      beforeHelper.split('\n').filter((line) => stampAssign.test(line) && !line.trim().startsWith('//')).length,
      0,
      'only buildFlowRatification may write the ratification stamp',
    );
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

  function writeValidFlow({ mutateGraph = false, stamp = true, html = true, htmlSha = null } = {}) {
    const paths = flowPathsForPlan(planMd);
    mkdirSync(join(paths.planDir, 'flow'), { recursive: true });
    let doc = cloneMinimal();
    doc.planSlug = 'sample';
    if (stamp) {
      doc = buildFlowRatification(doc, { ratifiedAt: '2026-08-13T12:00:00.000Z' });
    }
    if (mutateGraph) {
      doc.graph.nodes.S1.processLabel = 'Mutated after stamp';
    }
    writeFileSync(paths.flowJson, `${JSON.stringify(doc, null, 2)}\n`);
    if (html) {
      const built = buildFlowHtml(
        mutateGraph ? buildFlowRatification({ ...cloneMinimal(), planSlug: 'sample' }, { ratifiedAt: '2026-08-13T12:00:00.000Z' }) : doc,
        DS,
      );
      let out = built.html;
      if (htmlSha) {
        out = out.replace(/data-flow-content-sha="[a-f0-9]{64}"/, `data-flow-content-sha="${htmlSha}"`);
      }
      writeFileSync(paths.flowHtml, out);
    }
    return paths;
  }

  it('fails when flow.json is missing', () => {
    const r = checkPlanFlow(planMd);
    assert.equal(r.ok, false);
    assert.ok(r.issues.some((i) => /missing L1|flow\.json/.test(i)), r.issues.join('; '));
  });

  it('passes --strict when json + html + ratifiedGraphSha + html sha match', () => {
    writeValidFlow();
    const r = checkPlanFlow(planMd, { strict: true });
    assert.equal(r.ok, true, r.issues.join('; '));
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
    writeValidFlow({ mutateGraph: true });
    const r = checkPlanFlow(planMd, { strict: true });
    assert.equal(r.ok, false);
    assert.ok(r.issues.some((i) => /ratifiedGraphSha|graph/.test(i)), r.issues.join('; '));
  });

  it('fails --strict when HTML data-flow-content-sha does not match L1 contentSha', () => {
    writeValidFlow({ htmlSha: 'a'.repeat(64) });
    const r = checkPlanFlow(planMd, { strict: true });
    assert.equal(r.ok, false);
    assert.ok(r.issues.some((i) => /content-sha|data-flow-content-sha/.test(i)), r.issues.join('; '));
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
      r.issues.some((i) => /process\.yaml|map\.html/.test(i)) || !existsSync(paths.flowJson),
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

  it('without --strict still fails when json exists but is invalid', () => {
    const paths = flowPathsForPlan(planMd);
    mkdirSync(join(paths.planDir, 'flow'), { recursive: true });
    writeFileSync(paths.flowJson, '{ not json');
    writeFileSync(paths.flowHtml, '<html></html>');
    const r = checkPlanFlow(planMd);
    assert.equal(r.ok, false);
    assert.ok(r.issues.some((i) => /parse|invalid/i.test(i)), r.issues.join('; '));
  });

  it('does not add stage-flow.md', () => {
    assert.equal(
      existsSync(join(ROOT, 'skills', 'shared', 'project-assets', 'new-plan', 'stage-flow.md')),
      false,
    );
  });
});

describe('find-missing-flow CLI', () => {
  it('exits 2 when the target path does not exist', () => {
    const r = runCli([join(tmpdir(), 'no-such-plan-dir-xyz', 'plan.md')]);
    assert.equal(r.status, 2);
  });

  it(' --ratify stamps via buildFlowRatification (skill invocation)', () => {
    const skill = readFileSync(
      join(ROOT, 'skills', 'shared', 'project-assets', 'project-flow.md'),
      'utf8',
    );
    assert.match(skill, /find-missing-flow\.js" --ratify "\$L1" --ratified-by operator/);
    assert.doesNotMatch(skill, /from process\.argv\[1\]/);
    assert.doesNotMatch(skill, /--input-type=module/);

    const dir = mkdtempSync(join(tmpdir(), 'flow-ratify-'));
    try {
      const l1 = join(dir, 'flow.json');
      const doc = cloneMinimal();
      writeFileSync(l1, `${JSON.stringify(doc, null, 2)}\n`);
      const r = runCli(['--ratify', l1, '--ratified-by', 'operator']);
      assert.equal(r.status, 0, r.stderr);
      assert.equal(r.stderr.includes('SyntaxError'), false);
      const next = JSON.parse(readFileSync(l1, 'utf8'));
      assert.match(next.ratifiedAt, /^\d{4}-\d{2}-\d{2}T/);
      assert.equal(next.ratifiedBy, 'operator');
      assert.equal(next.ratifiedGraphSha, graphSha(doc.graph));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
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
});
