/**
 * T-008 — buildFlowRatification is the only stamp writer.
 */
import { describe, it } from 'node:test';
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
import { buildFlowRatification, ratifyFlowFile } from '../scripts/lib/flow-ratification.js';
import { flowDocumentSha, flowPathsForPlan } from '../scripts/find-missing-flow.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const RATIFY_CLI = join(ROOT, 'scripts', 'lib', 'flow-ratification.js');
const DETECTOR = join(ROOT, 'scripts', 'find-missing-flow.js');
const MINIMAL = join(ROOT, 'docs', 'design', 'project-flow', 'dogfood', 'minimal-xor.json');
const DOGFOOD = join(ROOT, 'docs', 'design', 'project-flow', 'dogfood', 'fluxo-sugestao.json');
const SPAWN_OPTS = { encoding: 'utf8', timeout: 60_000, maxBuffer: 8 * 1024 * 1024 };

function loadJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function clone(path) {
  return structuredClone(loadJson(path));
}

describe('buildFlowRatification', () => {
  it('is the only writer of ratifiedAt and ratifiedGraphSha', () => {
    const doc = clone(MINIMAL);
    assert.equal('ratifiedAt' in doc, false);
    assert.equal('ratifiedGraphSha' in doc, false);
    const stamped = buildFlowRatification(doc, {
      ratifiedAt: '2026-08-13T12:00:00.000Z',
      ratifiedBy: 'operator',
    });
    assert.equal(stamped.ratifiedAt, '2026-08-13T12:00:00.000Z');
    assert.equal(stamped.ratifiedBy, 'operator');
    assert.equal(stamped.ratifiedGraphSha, flowDocumentSha(doc));
    assert.equal('ratifiedAt' in doc, false);
    assert.equal('ratifiedGraphSha' in doc, false);

    const nowStamped = buildFlowRatification(doc);
    assert.match(nowStamped.ratifiedAt, /^\d{4}-\d{2}-\d{2}T/);
    assert.equal(nowStamped.ratifiedGraphSha, flowDocumentSha(doc));
  });

  it('covers graph + messages + machines (document sha, not graph-only)', () => {
    const doc = clone(MINIMAL);
    const stamped = buildFlowRatification(doc, { ratifiedAt: '2026-08-13T12:00:00.000Z' });
    assert.equal(stamped.ratifiedGraphSha, flowDocumentSha(doc));
    const mutated = structuredClone(doc);
    mutated.machines[0].nodes.open.label = 'Changed machine';
    assert.notEqual(flowDocumentSha(mutated), stamped.ratifiedGraphSha);
  });

  it('throws on a non-object doc or missing graph', () => {
    assert.throws(() => buildFlowRatification(null), /flow object/);
    assert.throws(() => buildFlowRatification({ planSlug: 'x' }), /doc.graph required/);
  });

  it('lives only in flow-ratification.js as the product stamp writer', () => {
    const src = readFileSync(RATIFY_CLI, 'utf8');
    assert.match(src, /export function buildFlowRatification/);
    assert.match(src, /ratifiedAt/);
    assert.match(src, /ratifiedGraphSha/);
    const detector = readFileSync(DETECTOR, 'utf8');
    assert.doesNotMatch(detector, /export function buildFlowRatification/);
    const skill = readFileSync(
      join(ROOT, 'skills', 'shared', 'project-assets', 'project-flow.md'),
      'utf8',
    );
    assert.match(skill, /buildFlowRatification/);
    assert.match(skill, /project flow/);
    assert.match(skill, /--check/);
    assert.match(skill, /--open/);
    assert.match(skill, /AskUserQuestion|ASK_USER_QUESTION_TOOL/);
    assert.match(skill, /generate|draft/);
    assert.match(skill, /update/);
    assert.match(skill, /show/i);
  });
});

describe('ratifyFlowFile + CLI', () => {
  it('--ratify stamps via buildFlowRatification', () => {
    const dir = mkdtempSync(join(tmpdir(), 'flow-ratify-'));
    try {
      const l1 = join(dir, 'flow.json');
      const doc = clone(MINIMAL);
      writeFileSync(l1, `${JSON.stringify(doc, null, 2)}\n`);
      const r = spawnSync(process.execPath, [RATIFY_CLI, '--ratify', l1, '--ratified-by', 'operator'], SPAWN_OPTS);
      assert.equal(r.status, 0, r.stderr);
      const next = JSON.parse(readFileSync(l1, 'utf8'));
      assert.match(next.ratifiedAt, /^\d{4}-\d{2}-\d{2}T/);
      assert.equal(next.ratifiedBy, 'operator');
      assert.equal(next.ratifiedGraphSha, flowDocumentSha(doc));
      const again = ratifyFlowFile(l1, { ratifiedBy: 'operator', ratifiedAt: '2026-08-13T12:00:00.000Z' });
      assert.equal(again.ratifiedAt, '2026-08-13T12:00:00.000Z');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('project flow --check on migrated dogfood fixture', () => {
  it('--check / --strict on stamped dogfood L1+L2 exits 0; process.yaml alone does not', () => {
    const dir = mkdtempSync(join(tmpdir(), 'flow-check-dogfood-'));
    try {
      const planDir = join(dir, 'projects', 'demo', 'sugestao-necessidade-pdti');
      mkdirSync(planDir, { recursive: true });
      const planMd = join(planDir, 'plan.md');
      writeFileSync(planMd, '---\nslug: sugestao-necessidade-pdti\n---\n# Dogfood\n');
      const paths = flowPathsForPlan(planMd);
      mkdirSync(join(paths.planDir, 'flow'), { recursive: true });
      let doc = clone(DOGFOOD);
      doc = buildFlowRatification(doc, { ratifiedAt: '2026-08-13T12:00:00.000Z' });
      writeFileSync(paths.flowJson, `${JSON.stringify(doc, null, 2)}\n`);
      writeFileSync(
        paths.flowHtml,
        `<html data-fl-content-sha="${flowDocumentSha(doc)}"></html>\n`,
      );

      const check = spawnSync(
        process.execPath,
        [DETECTOR, '--check', planMd],
        SPAWN_OPTS,
      );
      assert.equal(check.status, 0, check.stderr || check.stdout);

      const strict = spawnSync(
        process.execPath,
        [DETECTOR, '--strict', planMd],
        SPAWN_OPTS,
      );
      assert.equal(strict.status, 0, strict.stderr || strict.stdout);

      rmSync(join(paths.planDir, 'flow'), { recursive: true, force: true });
      mkdirSync(join(paths.planDir, 'process'), { recursive: true });
      writeFileSync(
        join(paths.planDir, 'process', 'process.yaml'),
        'planSlug: sugestao-necessidade-pdti\nactor: x\nscenario: y\nstages: []\n',
      );
      const yamlOnly = spawnSync(
        process.execPath,
        [DETECTOR, '--check', '--json', planMd],
        SPAWN_OPTS,
      );
      assert.equal(yamlOnly.status, 1, yamlOnly.stderr || yamlOnly.stdout);
      const report = JSON.parse(yamlOnly.stdout);
      assert.equal(report.ok, false);
      const issues = report.results?.[0]?.issues ?? [];
      assert.ok(issues.some((i) => /process\.yaml/.test(i)), issues.join('; '));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
