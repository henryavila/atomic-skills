/**
 * SVG draw from generic layouts. Titles come from the document.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeFlow } from '../scripts/lib/render-flow.js';
import { layoutSequence, layoutBpm, layoutMachines } from '../scripts/lib/flow-layout.js';
import {
  drawSequenceSvg,
  drawBpmSvg,
  drawMachinesSvg,
} from '../scripts/lib/flow-draw.js';
import {
  linearChain,
  xorThreeWay,
  andJoin,
  eventAndSubprocess,
  machineThreeLoops,
  twoMachines,
} from '../docs/plans/preview-fixtures.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DOGFOOD = JSON.parse(
  readFileSync(join(ROOT, 'docs/design/project-flow/dogfood/fluxo-sugestao.json'), 'utf8'),
);
const MINIMAL = JSON.parse(
  readFileSync(join(ROOT, 'docs/design/project-flow/dogfood/minimal-xor.json'), 'utf8'),
);

function n(raw) {
  return normalizeFlow(raw);
}

describe('drawSequenceSvg', () => {
  it('emits a sequence svg with actors, messages, xor rail, no alt/else box', () => {
    const svg = drawSequenceSvg(layoutSequence(n(MINIMAL)));
    assert.match(svg, /data-surface="sequence"/);
    assert.match(svg, /data-actor-id="U"/);
    assert.match(svg, /data-from="U"[^>]*data-to="R"|data-from="U" data-to="R"/);
    assert.match(svg, /data-xor-rail="D1"/);
    assert.doesNotMatch(svg, /\balt\b|\belse\b/);
    assert.match(svg, /Diagrama de sequência — Minimal accept-or-reject/);
    assert.doesNotMatch(svg, /Diagrama de sequência — PDTI/);
  });

  it('titles the svg from the document, even for a linear graph', () => {
    const svg = drawSequenceSvg(layoutSequence(n(linearChain())));
    assert.match(svg, /Diagrama de sequência — Linear four-step chain/);
  });

  it('keeps a sequence message that wraps past two lines', () => {
    const doc = structuredClone(MINIMAL);
    doc.graph.nodes.S1.messages[0].text =
      'Reads the drawing, the source and the business intent — not the phase list UNIQUE_TAIL';
    const svg = drawSequenceSvg(layoutSequence(n(doc)));
    assert.match(svg, /UNIQUE_TAIL/);
    assert.doesNotMatch(svg, /UNIQUE_TAIL.{1,80}UNIQUE_TAIL/);
  });
});

describe('drawBpmSvg', () => {
  it('draws xor as diamond and ends as circles', () => {
    const svg = drawBpmSvg(layoutBpm(n(MINIMAL)));
    assert.match(svg, /data-node-id="D1"[^>]*data-shape="diamond"/);
    assert.match(svg, /data-node-id="S1"[^>]*data-shape="rect"/);
    assert.match(svg, /data-surface="bpm"/);
    assert.match(svg, /Diagrama de processo — Minimal accept-or-reject/);
    assert.doesNotMatch(svg, /Diagrama de processo — PDTI/);
  });

  it('draws and as a bar and join as a bar', () => {
    const svg = drawBpmSvg(layoutBpm(n(andJoin())));
    assert.match(svg, /data-node-id="P1"[^>]*data-shape="bar"/);
    assert.match(svg, /data-node-id="J1"[^>]*data-shape="bar"/);
  });

  it('draws event as a circle and subprocess with an inner mark', () => {
    const svg = drawBpmSvg(layoutBpm(n(eventAndSubprocess())));
    assert.match(svg, /data-node-id="E1"[^>]*data-shape="circle"/);
    assert.match(svg, /data-node-id="P1"[^>]*data-shape="rect"/);
    assert.match(svg, /sub-mark/);
  });

  it('does not paint a lone end as the error ring just because the label is gloomy', () => {
    const svg = drawBpmSvg(layoutBpm(n(linearChain())));
    assert.match(svg, /data-node-id="end_ok"[^>]*data-shape="circle"/);
    assert.match(svg, /class="end-ok"/);
    assert.doesNotMatch(svg, /data-node-id="end_ok"[\s\S]*end-bad/);
  });

  it('still draws the dogfood join and loop without baking ids into the drawer', () => {
    const svg = drawBpmSvg(layoutBpm(n(DOGFOOD)));
    assert.match(svg, /data-node-id="S3edit"[^>]*data-next="D2"/);
    assert.match(svg, /data-node-id="D1"[^>]*data-shape="diamond"/);
    assert.match(svg, /class="edge back"/);
  });

  it('keeps three xor ends in the drawn svg', () => {
    const svg = drawBpmSvg(layoutBpm(n(xorThreeWay())));
    assert.match(svg, /data-node-id="end_low"/);
    assert.match(svg, /data-node-id="end_mid"/);
    assert.match(svg, /data-node-id="end_high"/);
  });
});

describe('drawMachinesSvg', () => {
  it('emits one group per machine and keeps the full transition label', () => {
    const svg = drawMachinesSvg(layoutMachines(n(twoMachines())));
    assert.match(svg, /data-surface="machines"/);
    assert.match(svg, /data-machine-id="alpha"/);
    assert.match(svg, /data-machine-id="beta"/);
    assert.match(svg, /data-state-id="a0"/);
  });

  it('does not strip a leading actor word from a transition title', () => {
    const doc = structuredClone(MINIMAL);
    doc.machines[0].transitions[0].label = 'Líder aceita';
    const svg = drawMachinesSvg(layoutMachines(n(doc)));
    assert.match(svg, /Líder aceita/);
  });

  it('draws three self-loops', () => {
    const svg = drawMachinesSvg(layoutMachines(n(machineThreeLoops())));
    const loops = svg.match(/data-from="parked" data-to="parked"/g) || [];
    assert.ok(loops.length >= 3);
  });
});
