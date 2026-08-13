/**
 * PR2 — deterministic flow.html renderer (Sequência / Fluxo / Estados).
 * Domain PDTI must stay in fixtures, never in the renderer.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildFlowHtml,
  normalizeFlow,
  contentFingerprint,
  sha256,
  stableStringify,
} from '../scripts/lib/render-flow.js';
import { assertValidFlow } from '../scripts/lib/validate-flow.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DS = readFileSync(join(ROOT, 'site', 'assets', 'ds.css'), 'utf8');
const DOGFOOD = join(ROOT, 'docs', 'design', 'project-flow', 'dogfood', 'fluxo-sugestao.json');
const MINIMAL = join(ROOT, 'docs', 'design', 'project-flow', 'dogfood', 'minimal-xor.json');

function loadJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function clone(path) {
  return structuredClone(loadJson(path));
}

describe('buildFlowHtml — fixtures', () => {
  it('accepts the enveloped dogfood fixture and builds all three mermaid sources', () => {
    const built = buildFlowHtml(loadJson(DOGFOOD), DS);
    assert.equal(typeof built.html, 'string');
    assert.ok(built.html.length > 0);
    assert.equal(typeof built.mermaid.sequence, 'string');
    assert.ok(built.mermaid.sequence.length > 0);
    assert.equal(typeof built.mermaid.flow, 'string');
    assert.ok(built.mermaid.flow.length > 0);
    assert.equal(typeof built.mermaid.states, 'string');
    assert.ok(built.mermaid.states.length > 0);
  });

  it('accepts minimal-xor: mermaid.states is null and Estados tab is hidden/absent', () => {
    const built = buildFlowHtml(loadJson(MINIMAL), DS);
    assert.equal(built.mermaid.states, null);
    assert.ok(built.mermaid.sequence.length > 0);
    assert.ok(built.mermaid.flow.length > 0);
    assert.equal(built.html.includes('data-tab-btn="estados"'), false);
    assert.match(built.html, /data-tab-btn="sequencia"/);
    assert.match(built.html, /data-tab-btn="fluxo"/);
  });
});

describe('determinism', () => {
  for (const [name, path] of [
    ['dogfood', DOGFOOD],
    ['minimal-xor', MINIMAL],
  ]) {
    it(`byte-identical double render: ${name}`, () => {
      const raw = loadJson(path);
      const a = buildFlowHtml(raw, DS);
      const b = buildFlowHtml(raw, DS);
      assert.equal(a.html, b.html);
      assert.equal(a.contentSha, b.contentSha);
      assert.equal(a.mermaid.sequence, b.mermaid.sequence);
      assert.equal(a.mermaid.flow, b.mermaid.flow);
      assert.equal(a.mermaid.states, b.mermaid.states);
      assert.equal(sha256(a.html), sha256(b.html));
    });
  }

  it('contentSha is stable across two builds and is hex', () => {
    const raw = loadJson(DOGFOOD);
    const a = buildFlowHtml(raw, DS);
    const b = buildFlowHtml(raw, DS);
    assert.equal(a.contentSha, b.contentSha);
    assert.match(a.contentSha, /^[a-f0-9]{64}$/);
    const n = normalizeFlow(raw);
    assert.equal(a.contentSha, contentFingerprint(n));
  });

  it('contentSha is independent of DS CSS', () => {
    const raw = loadJson(MINIMAL);
    const a = buildFlowHtml(raw, DS);
    const b = buildFlowHtml(raw, `${DS}\n/* comment */\n`);
    assert.equal(a.contentSha, b.contentSha);
    assert.notEqual(a.html, b.html);
  });

  it('HTML includes data-flow-content-sha matching contentSha', () => {
    const built = buildFlowHtml(loadJson(MINIMAL), DS);
    assert.ok(built.html.includes(`data-flow-content-sha="${built.contentSha}"`));
  });
});

describe('self-contained HTML', () => {
  it('embeds the model and does not fetch JSON or CDN mermaid', () => {
    const built = buildFlowHtml(loadJson(DOGFOOD), DS);
    assert.ok(
      built.html.includes('graph') && built.html.includes('"entry"'),
      'expected embedded graph.entry JSON',
    );
    assert.equal(built.html.includes("fetch('fluxo-sugestao.json')"), false);
    assert.equal(built.html.includes('fetch("fluxo-sugestao.json")'), false);
    assert.equal(built.html.includes('cdn.jsdelivr.net/npm/mermaid'), false);
  });

  it('contains tab labels Sequência and Fluxo', () => {
    const built = buildFlowHtml(loadJson(MINIMAL), DS);
    assert.ok(built.html.includes('Sequência'));
    assert.ok(built.html.includes('Fluxo'));
  });

  it('never contains map.html as an output contract', () => {
    const built = buildFlowHtml(loadJson(MINIMAL), DS);
    assert.equal(built.html.includes('map.html'), false);
    const cli = readFileSync(join(ROOT, 'scripts', 'render-flow.js'), 'utf8');
    assert.ok(cli.includes('flow.html'));
    assert.equal(cli.includes('map.html'), false);
    assert.equal(cli.includes('process-map.html'), false);
  });

  it('has no Date.now, ISO timestamps, absolute paths, or /Volumes/', () => {
    const { html } = buildFlowHtml(loadJson(MINIMAL), DS);
    const chrome = html.replace(/<script id="flow-mermaid-runtime">[\s\S]*?<\/script>/, '');
    assert.equal(chrome.includes('Date.now'), false);
    assert.ok(!/20\d{2}-\d{2}-\d{2}T/.test(chrome));
    assert.equal(chrome.includes(ROOT), false);
    assert.equal(chrome.includes('/Volumes/'), false);
  });
});

describe('validation', () => {
  it('assertValidFlow / buildFlowHtml reject a broken next', () => {
    const doc = clone(MINIMAL);
    doc.graph.nodes.S1.next = 'does-not-exist';
    assert.throws(() => assertValidFlow(doc), /invalid/i);
    assert.throws(() => buildFlowHtml(doc, DS), /invalid/i);
  });
});

describe('mermaid source snapshot', () => {
  it('sequence contains sequenceDiagram; flow contains flowchart; dogfood states contain stateDiagram', () => {
    const dog = buildFlowHtml(loadJson(DOGFOOD), DS);
    assert.match(dog.mermaid.sequence, /sequenceDiagram/);
    assert.match(dog.mermaid.flow, /flowchart/);
    assert.match(dog.mermaid.states, /stateDiagram/);
    const min = buildFlowHtml(loadJson(MINIMAL), DS);
    assert.match(min.mermaid.sequence, /sequenceDiagram/);
    assert.match(min.mermaid.flow, /flowchart/);
    assert.equal(min.mermaid.states, null);
  });
});

describe('domain isolation', () => {
  it('does not encode PDTI domain rules in the renderer', () => {
    const src = readFileSync(join(ROOT, 'scripts', 'lib', 'render-flow.js'), 'utf8');
    const cli = readFileSync(join(ROOT, 'scripts', 'render-flow.js'), 'utf8');
    const pinPath = join(ROOT, 'assets', 'flow', 'PIN');
    const pin = existsSync(pinPath) ? readFileSync(pinPath, 'utf8') : '';
    const flowAssets = join(ROOT, 'assets', 'flow');
    let comments = pin;
    if (existsSync(flowAssets)) {
      for (const name of readdirSync(flowAssets)) {
        if (name.startsWith('mermaid')) continue;
        comments += `\n${readFileSync(join(flowAssets, name), 'utf8')}`;
      }
    }
    const banned = [
      'PDTI',
      'GETIN',
      'lider_aceita',
      'D_edit',
      'revalida',
      'nova -->',
      'recusada -->',
    ];
    const haystack = `${src}\n${cli}\n${comments}`;
    for (const token of banned) {
      assert.equal(haystack.includes(token), false, `domain token leaked: ${token}`);
    }
  });
});

describe('helpers', () => {
  it('stableStringify sorts object keys', () => {
    assert.equal(stableStringify({ b: 1, a: 2 }), stableStringify({ a: 2, b: 1 }));
  });

  it('sha256 is hex', () => {
    assert.match(sha256('flow'), /^[a-f0-9]{64}$/);
  });
});
