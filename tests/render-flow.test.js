/**
 * F1 — native three-surface flow renderer (sequence / BPM / machines).
 * Sequence is the conversation from messages[]; BPM uses business labels only.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildFlowHtml,
  contentFingerprint,
  FLOW_CSS,
  normalizeFlow,
  renderFlowHtml,
  sha256,
} from '../scripts/lib/render-flow.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DS = readFileSync(join(ROOT, 'site', 'assets', 'ds.css'), 'utf8');
const DOGFOOD = join(ROOT, 'docs', 'design', 'project-flow', 'dogfood', 'fluxo-sugestao.json');
const CLI = join(ROOT, 'scripts', 'render-flow.js');
const UI_WORD_RE = /\b(click|modal|screen)\b|clica|\btela\b/i;

function runCli(args, opts = {}) {
  return spawnSync(process.execPath, [CLI, ...args], {
    encoding: 'utf8',
    cwd: ROOT,
    ...opts,
  });
}

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

describe('render-flow CLI', () => {
  it('writes HTML to -o and names the artifact flow.html', () => {
    const dir = mkdtempSync(join(tmpdir(), 'render-flow-'));
    const out = join(dir, 'flow.html');
    const result = runCli([DOGFOOD, '-o', out]);
    assert.equal(result.status, 0, result.stderr);
    assert.ok(existsSync(out));
    const html = readFileSync(out, 'utf8');
    assert.ok(html.includes('id="fl-sequence"'));
    assert.ok(html.includes('id="fl-bpm"'));
    assert.ok(html.includes('id="fl-machines"'));
    assert.ok(out.endsWith('flow.html'));
  });

  it('prints HTML on --stdout', () => {
    const result = runCli(['--stdout', DOGFOOD]);
    assert.equal(result.status, 0, result.stderr);
    assert.ok(result.stdout.startsWith('<!DOCTYPE html>'));
    assert.ok(result.stdout.includes('Sequência'));
    assert.ok(result.stdout.includes('id="fl-machines"'));
  });

  it('--check exits 0 when on-disk HTML matches content-sha', () => {
    const dir = mkdtempSync(join(tmpdir(), 'render-flow-check-'));
    const out = join(dir, 'flow.html');
    const write = runCli([DOGFOOD, '-o', out]);
    assert.equal(write.status, 0, write.stderr);
    const check = runCli(['--check', DOGFOOD, out]);
    assert.equal(check.status, 0, check.stderr + check.stdout);
    assert.match(check.stdout + check.stderr, /content-sha/i);
    writeFileSync(out, `${readFileSync(out, 'utf8')}\n<!-- drift -->\n`);
    const drift = runCli(['--check', DOGFOOD, out]);
    assert.notEqual(drift.status, 0);
  });

  it('defaults to flow.html next to the input when -o is omitted', () => {
    const dir = mkdtempSync(join(tmpdir(), 'render-flow-default-'));
    const input = join(dir, 'fluxo.json');
    writeFileSync(input, readFileSync(DOGFOOD));
    const result = runCli([input]);
    assert.equal(result.status, 0, result.stderr);
    assert.ok(existsSync(join(dir, 'flow.html')));
    assert.equal(existsSync(join(dir, 'map.html')), false);
  });

  it('CLI source never mentions the abolished map filename', () => {
    const src = readFileSync(CLI, 'utf8');
    assert.equal(src.includes('map.html'), false);
    assert.ok(src.includes('flow.html'));
  });
});

describe('T-006 DS polish', () => {
  it('requires inlined DS tokens --bg-canvas and --fg-default', () => {
    const normalized = normalizeFlow(loadDogfood());
    assert.throws(() => renderFlowHtml(normalized, ''), /dsCss|--bg-canvas|--fg-default/i);
    assert.throws(() => renderFlowHtml(normalized, 'body{color:red}'), /dsCss|--bg-canvas/i);
    const { html } = buildFlowHtml(loadDogfood(), DS);
    assert.ok(html.includes('--bg-canvas'));
    assert.ok(html.includes('--fg-default'));
    assert.ok(html.includes(DS.trim().slice(0, 40)));
  });

  it('keeps three surfaces as distinct landmarks', () => {
    const { html } = buildFlowHtml(loadDogfood(), DS);
    for (const id of ['fl-sequence', 'fl-bpm', 'fl-machines']) {
      const block = section(html, id);
      assert.match(block, /role="region"/);
      assert.match(block, /data-surface="/);
    }
    assert.match(html, /data-surface="sequence"/);
    assert.match(html, /data-surface="bpm"/);
    assert.match(html, /data-surface="machines"/);
    assert.ok(html.includes('role="navigation"') || html.includes('role="tablist"'));
  });

  it('uses DS type and space tokens and no ds- class prefix', () => {
    assert.ok(FLOW_CSS.includes('var(--fs-3xl)'));
    assert.ok(FLOW_CSS.includes('var(--space-12)'));
    assert.ok(FLOW_CSS.includes('var(--font-sans)') || FLOW_CSS.includes('var(--fs-md)'));
    assert.ok(FLOW_CSS.includes('var(--bg-canvas)') || FLOW_CSS.includes('var(--bg-surface)'));
    assert.doesNotMatch(FLOW_CSS, /\.ds-/);
    const { html } = buildFlowHtml(loadDogfood(), DS);
    assert.doesNotMatch(html, /class="[^"]*\bds-/);
  });

  it('has no tool watermark', () => {
    const { html } = buildFlowHtml(loadDogfood(), DS);
    assert.doesNotMatch(html, /generated by/i);
    assert.doesNotMatch(html, /watermark/i);
    assert.doesNotMatch(html, /mermaid/i);
    assert.doesNotMatch(html, /name="generator"/i);
  });
});
