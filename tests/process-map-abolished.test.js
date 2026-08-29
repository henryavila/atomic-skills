/**
 * Process-map is abolished as a product path.
 * L2 is flow.html (SVG diagrams). map.html / process.yaml never satisfy,
 * never get served, and npm scripts must not invite generating them.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildFlowHtml, FLOW_CSS } from '../scripts/lib/render-flow.js';
import { flowChromeScript } from '../scripts/lib/flow-chrome.js';
import { CREATION_STAGES } from '../scripts/creation-gates.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DS = readFileSync(join(ROOT, 'site', 'assets', 'ds.css'), 'utf8');
const DOGFOOD = join(ROOT, 'docs', 'design', 'project-flow', 'dogfood', 'fluxo-sugestao.json');
const RENDER_CLI = join(ROOT, 'scripts', 'render-flow.js');
const PKG = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));

describe('process-map abolished from the product path', () => {
  it('deletes renderer, detector, schema, sketches, and leftover L2', () => {
    const gone = [
      'scripts/render-process-map.js',
      'scripts/lib/render-process-map.js',
      'scripts/find-missing-process-map.js',
      'meta/schemas/process-map.schema.json',
      'docs/design/process-map-sketches',
      'docs/design/project-flow/dogfood/process-map.html',
      'docs/design/project-flow/dogfood/process.yaml',
      'skills/shared/project-assets/new-plan/stage-process-map.md',
      'skills/shared/project-assets/project-process-map.md',
      'tests/render-process-map.test.js',
      'tests/find-missing-process-map.test.js',
      '.atomic-skills/projects/atomic-skills/project-flow/process/map.html',
      '.atomic-skills/projects/atomic-skills/project-flow/process/process.yaml',
    ];
    for (const rel of gone) {
      assert.equal(existsSync(join(ROOT, rel)), false, rel);
    }
  });

  it('CREATION_STAGES has no process-map; summaries is followed by reviews', () => {
    assert.equal(CREATION_STAGES.includes('process-map'), false);
    const iSum = CREATION_STAGES.indexOf('summaries');
    const iRev = CREATION_STAGES.indexOf('reviews');
    assert.ok(iSum >= 0 && iRev === iSum + 1);
  });

  it('package.json does not expose process-map product scripts', () => {
    assert.equal(PKG.scripts['render-process-map'], undefined);
    assert.equal(PKG.scripts['check-process-maps'], undefined);
    assert.equal(PKG.scripts['find-missing-process-map'], undefined);
  });

  it('render-flow CLI refuses to write map.html', () => {
    const dir = mkdtempSync(join(tmpdir(), 'no-map-html-'));
    const out = join(dir, 'map.html');
    try {
      const r = spawnSync(process.execPath, [RENDER_CLI, DOGFOOD, '-o', out], {
        encoding: 'utf8',
        cwd: ROOT,
      });
      assert.notEqual(r.status, 0);
      assert.match(r.stderr || '', /flow\.html|abolished|map\.html/i);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('chrome script handles the PDF button and styles BPM edge labels', () => {
    const js = flowChromeScript();
    assert.match(js, /data-action=pdf/);
    assert.match(js, /buildFlowPdf/);
    assert.match(FLOW_CSS, /\.edge-t\{/);
  });

  it('generated L2 is SVG diagrams, not process-map cards', () => {
    const raw = JSON.parse(readFileSync(DOGFOOD, 'utf8'));
    const { html } = buildFlowHtml(raw, DS);
    assert.match(html, /<svg[^>]*data-surface="sequence"/);
    assert.match(html, /<svg[^>]*data-surface="bpm"/);
    assert.match(html, /<svg[^>]*data-surface="machines"/);
    assert.doesNotMatch(html, /render-process-map/);
    assert.doesNotMatch(html, /class="pm-/);
    assert.doesNotMatch(html, /<ol class="fl-messages">/);
    assert.doesNotMatch(html, /<ol class="fl-nodes">/);
    assert.doesNotMatch(html, /data-pm-slug/);
  });
});
