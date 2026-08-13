/**
 * Tests for find-missing-process-map + creation stage process-map.
 */
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { parse, stringify } from 'yaml';
import {
  checkPlanProcessMap,
  processMapPathsForPlan,
} from '../scripts/find-missing-process-map.js';
import { buildProcessMapHtml } from '../scripts/lib/render-process-map.js';
import { CREATION_STAGES } from '../scripts/creation-gates.js';

const ROOT = join(import.meta.dirname, '..');
const DS = readFileSync(join(ROOT, 'site', 'assets', 'ds.css'), 'utf8');
const FIX = join(ROOT, 'docs', 'design', 'process-map-sketches', 'fixtures', 'quality-judge-program.yaml');

describe('CREATION_STAGES has no process-map; summaries immediately followed by reviews', () => {
  it('order', () => {
    const iSum = CREATION_STAGES.indexOf('summaries');
    const iPm = CREATION_STAGES.indexOf('process-map');
    const iRev = CREATION_STAGES.indexOf('reviews');
    assert.equal(iPm, -1);
    assert.ok(iSum >= 0 && iRev === iSum + 1);
  });
});

describe('stage-process-map.md is a redirect stub, not a live write path', () => {
  it('does not advance process-map or require show-before-ratify', () => {
    const stage = readFileSync(
      join(ROOT, 'skills', 'shared', 'project-assets', 'new-plan', 'stage-process-map.md'),
      'utf8',
    );
    assert.match(stage, /redirect|superseded/i);
    assert.doesNotMatch(stage, /--advance process-map --write/);
    assert.doesNotMatch(stage, /Never skip/);
  });
});

describe('checkPlanProcessMap', () => {
  let dir;
  let planMd;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'pm-missing-'));
    const planDir = join(dir, 'projects', 'demo', 'sample');
    mkdirSync(planDir, { recursive: true });
    planMd = join(planDir, 'plan.md');
    writeFileSync(planMd, '---\nslug: sample\n---\n# Sample\n');
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('fails when L1/L2 missing', () => {
    const r = checkPlanProcessMap(planMd);
    assert.equal(r.ok, false);
    assert.ok(r.issues.some((i) => /missing L1/.test(i)));
  });

  it('passes when L1 ratified + L2 matches', () => {
    const raw = parse(readFileSync(FIX, 'utf8'));
    raw.planSlug = 'sample';
    raw.ratifiedAt = '2026-08-10T12:00:00.000Z';
    const paths = processMapPathsForPlan(planMd);
    mkdirSync(join(paths.planDir, 'process'), { recursive: true });
    writeFileSync(paths.processYaml, stringify(raw));
    const { html } = buildProcessMapHtml(raw, DS);
    writeFileSync(paths.mapHtml, html);
    const r = checkPlanProcessMap(planMd, { strictHtml: true, dsCss: DS });
    assert.equal(r.ok, true, r.issues.join('; '));
  });

  it('fails without ratifiedAt', () => {
    const raw = parse(readFileSync(FIX, 'utf8'));
    delete raw.ratifiedAt;
    delete raw.ratifiedBy;
    const paths = processMapPathsForPlan(planMd);
    mkdirSync(join(paths.planDir, 'process'), { recursive: true });
    writeFileSync(paths.processYaml, stringify(raw));
    writeFileSync(paths.mapHtml, '<html></html>');
    const r = checkPlanProcessMap(planMd);
    assert.equal(r.ok, false);
    assert.ok(r.issues.some((i) => /ratifiedAt/.test(i)));
  });
});
