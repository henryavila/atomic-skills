/**
 * F1 — native three-surface flow renderer (sequence / BPM / machines).
 * Sequence is the conversation from messages[]; BPM uses business labels only.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildFlowHtml,
  contentFingerprint,
  normalizeFlow,
  renderFlowHtml,
  sha256,
} from '../scripts/lib/render-flow.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DS = readFileSync(join(ROOT, 'site', 'assets', 'ds.css'), 'utf8');
const DOGFOOD = join(ROOT, 'docs', 'design', 'project-flow', 'dogfood', 'fluxo-sugestao.json');
const UI_WORD_RE = /\b(click|modal|screen)\b|clica|\btela\b/i;

function loadDogfood() {
  return JSON.parse(readFileSync(DOGFOOD, 'utf8'));
}

function section(html, id) {
  const match = html.match(new RegExp(`<section[^>]*\\bid="${id}"[\\s\\S]*?</section>`));
  assert.ok(match, `expected <section id="${id}">`);
  return match[0];
}

describe('buildFlowHtml — MODEL dogfood', () => {
  it('returns HTML with three distinct surfaces (sequence, bpm, machines)', () => {
    const { html } = buildFlowHtml(loadDogfood(), DS);
    const sequence = section(html, 'fl-sequence');
    const bpm = section(html, 'fl-bpm');
    const machines = section(html, 'fl-machines');
    assert.ok(sequence.includes('Sequência') || sequence.includes('messages'));
    assert.ok(/bpm|fluxo|activity/i.test(bpm));
    assert.ok(/machine/i.test(machines));
    assert.notEqual(sequence, bpm);
    assert.notEqual(bpm, machines);
    assert.notEqual(sequence, machines);
  });

  it('puts conversation messages on the sequence surface', () => {
    const { html } = buildFlowHtml(loadDogfood(), DS);
    const sequence = section(html, 'fl-sequence');
    assert.ok(sequence.includes('Abre o formulário'));
    assert.ok(sequence.includes('Clica em Sugerir necessidade'));
    assert.ok(sequence.includes('GETIN'));
    assert.ok(sequence.includes('Sistema'));
    assert.match(sequence, /from="G"/);
    assert.match(sequence, /to="App"/);
  });

  it('omits click/modal/screen words from BPM labels', () => {
    const { html } = buildFlowHtml(loadDogfood(), DS);
    const bpm = section(html, 'fl-bpm');
    assert.ok(bpm.includes('Criar sugestão'));
    assert.ok(bpm.includes('Envio válido?'));
    assert.ok(bpm.includes('activity'));
    assert.ok(bpm.includes('xor'));
    assert.equal(UI_WORD_RE.test(bpm), false, `BPM leaked UI word:\n${bpm}`);
    const sequence = section(html, 'fl-sequence');
    assert.ok(UI_WORD_RE.test(sequence), 'expected UI narration on sequence');
  });

  it('shows machine transitions as kind + label + target', () => {
    const { html } = buildFlowHtml(loadDogfood(), DS);
    const machines = section(html, 'fl-machines');
    assert.ok(machines.includes('sugestao'));
    assert.ok(machines.includes('Sugestão PDTI'));
    assert.ok(machines.includes('Líder aceita'));
    assert.ok(machines.includes('email'));
    assert.ok(machines.includes('Avisa a GETIN'));
    assert.ok(machines.includes('GETIN'));
    assert.ok(machines.includes('write'));
    assert.ok(machines.includes('notify'));
    assert.match(machines, /data-effect-kind="email"/);
    assert.match(machines, /data-effect-target="GETIN"/);
  });

  it('changes output when a next id is mutated', () => {
    const original = loadDogfood();
    const mutated = structuredClone(original);
    assert.equal(mutated.graph.nodes.S3edit.next, 'D2');
    mutated.graph.nodes.S3edit.next = 'D_edit';
    const a = buildFlowHtml(original, DS).html;
    const b = buildFlowHtml(mutated, DS).html;
    assert.notEqual(a, b);
    const bpmA = section(a, 'fl-bpm');
    const bpmB = section(b, 'fl-bpm');
    assert.match(bpmA, /data-node-id="S3edit"[^>]*data-next="D2"/);
    assert.match(bpmB, /data-node-id="S3edit"[^>]*data-next="D_edit"/);
    assert.notEqual(bpmA, bpmB);
  });

  it('does not emit mermaid script, mermaid.initialize, or diagram DSL', () => {
    const { html } = buildFlowHtml(loadDogfood(), DS);
    assert.doesNotMatch(html, /mermaid/i);
    assert.doesNotMatch(html, /mermaid\.initialize/);
    assert.doesNotMatch(html, /sequenceDiagram/);
    assert.doesNotMatch(html, /stateDiagram/);
    assert.doesNotMatch(html, /<script[^>]+src=/i);
  });
});

describe('determinism and validation', () => {
  it('double-renders byte-identical HTML and stable content-sha', () => {
    const doc = loadDogfood();
    const a = buildFlowHtml(doc, DS);
    const b = buildFlowHtml(doc, DS);
    assert.equal(a.html, b.html);
    assert.equal(a.contentSha, b.contentSha);
    assert.equal(sha256(a.html), sha256(b.html));
    assert.match(a.html, /data-fl-content-sha="/);
    assert.ok(a.html.endsWith('\n'));
    assert.ok(!a.html.includes('\r'));
  });

  it('contentFingerprint is data-only; HTML changes if DS changes', () => {
    const normalized = normalizeFlow(loadDogfood());
    const fp = contentFingerprint(normalized);
    const html1 = renderFlowHtml(normalized, DS);
    const html2 = renderFlowHtml(normalized, `${DS}\n/* comment */\n`);
    assert.equal(contentFingerprint(normalized), fp);
    assert.notEqual(html1, html2);
  });

  it('rejects invalid flow documents', () => {
    assert.throws(() => buildFlowHtml({ schemaVersion: '1.0' }, DS), /invalid/i);
  });

  it('does not embed Date.now or absolute workspace paths', () => {
    const { html } = buildFlowHtml(loadDogfood(), DS);
    assert.ok(!/20\d{2}-\d{2}-\d{2}T/.test(html));
    assert.ok(!html.includes(ROOT));
  });
});
