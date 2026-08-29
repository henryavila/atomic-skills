/**
 * Pure renderer: flow MODEL object → self-contained HTML.
 *
 * Three SVG surfaces: sequence, BPM, machines. Lists/cards are not the view.
 * Determinism: same normalized input + same dsCss → byte-identical HTML.
 * No timestamps, random IDs, or absolute paths in the output.
 */

import { createHash } from 'node:crypto';
import { assertValidFlow, SCHEMA_VERSION } from './validate-flow.js';
import { escapeHtml } from './render-site.js';
import { colorSchemeBootScript, renderColorSchemeSwitch } from './color-scheme.js';
import { layoutSequence, layoutBpm, layoutMachines } from './flow-layout.js';
import { drawSequenceSvg, drawBpmSvg, drawMachinesSvg } from './flow-draw.js';
import { pdfFilename } from './flow-pdf.js';
import { FLOW_CSS as CHROME_CSS, flowChromeScript } from './flow-chrome.js';

const NEXT_TYPES = new Set(['activity', 'join', 'subprocess', 'event']);
const BRANCH_TYPES = new Set(['xor', 'and']);

/**
 * @param {string} text
 */
export function sha256(text) {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

/**
 * Canonical JSON stringify: sorted object keys, arrays as given.
 * @param {unknown} value
 */
export function stableStringify(value) {
  return JSON.stringify(value, (_, v) => {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const sorted = {};
      for (const k of Object.keys(v).sort()) sorted[k] = v[k];
      return sorted;
    }
    return v;
  });
}

/**
 * @param {object} normalized
 */
export function contentFingerprint(normalized) {
  return sha256(stableStringify(normalized));
}

function isNodeMap(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function neighborIds(node) {
  if (!node || typeof node !== 'object') return [];
  if (NEXT_TYPES.has(node.type) && typeof node.next === 'string') return [node.next];
  if (BRANCH_TYPES.has(node.type) && Array.isArray(node.branches)) {
    return node.branches
      .map((branch) => branch?.next)
      .filter((next) => typeof next === 'string');
  }
  return [];
}

/**
 * Visit order: BFS from entry, then leftover ids sorted.
 * @param {string} entry
 * @param {Record<string, object>} nodes
 * @returns {string[]}
 */
export function walkNodeIds(entry, nodes) {
  if (!isNodeMap(nodes)) return [];
  const order = [];
  const seen = new Set();
  const queue = typeof entry === 'string' ? [entry] : [];
  while (queue.length) {
    const id = queue.shift();
    if (!id || seen.has(id) || !nodes[id]) continue;
    seen.add(id);
    order.push(id);
    queue.push(...neighborIds(nodes[id]));
  }
  for (const id of Object.keys(nodes).sort()) {
    if (!seen.has(id)) order.push(id);
  }
  return order;
}

function trimString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeMessages(messages) {
  if (!Array.isArray(messages)) return [];
  return messages
    .filter((m) => m && typeof m === 'object')
    .map((m) => ({
      from: trimString(m.from),
      to: trimString(m.to),
      text: trimString(m.text),
      async: m.async === true,
    }));
}

function normalizeBranches(branches) {
  if (!Array.isArray(branches)) return [];
  return branches
    .filter((b) => b && typeof b === 'object')
    .map((b) => ({
      id: trimString(b.id),
      when: trimString(b.when),
      label: trimString(b.label),
      next: trimString(b.next),
    }));
}

function normalizeGraphNode(node) {
  const type = trimString(node.type);
  const out = {
    type,
    label: trimString(node.label),
    who: trimString(node.who),
    title: trimString(node.title),
    messages: normalizeMessages(node.messages),
  };
  if (NEXT_TYPES.has(type)) out.next = trimString(node.next);
  if (BRANCH_TYPES.has(type)) out.branches = normalizeBranches(node.branches);
  if (type === 'xor') out.question = trimString(node.question);
  if (type === 'join') out.of = trimString(node.of);
  if (type === 'subprocess') out.ref = trimString(node.ref);
  if (type === 'event') out.kind = trimString(node.kind);
  return out;
}

function normalizeNodeMap(nodes) {
  if (!isNodeMap(nodes)) return {};
  const out = {};
  for (const [id, node] of Object.entries(nodes)) {
    if (!node || typeof node !== 'object') continue;
    out[id] = normalizeGraphNode(node);
  }
  return out;
}

function normalizeActors(actors) {
  if (!Array.isArray(actors)) return [];
  return actors
    .filter((a) => a && typeof a === 'object')
    .map((a) => ({
      id: trimString(a.id),
      label: trimString(a.label),
      kind: trimString(a.kind),
    }));
}

function normalizeMachines(machines) {
  if (!Array.isArray(machines)) return [];
  return machines
    .filter((m) => m && typeof m === 'object')
    .map((m) => {
      const nodes = {};
      if (isNodeMap(m.nodes)) {
        for (const [id, node] of Object.entries(m.nodes)) {
          if (!node || typeof node !== 'object') continue;
          nodes[id] = {
            label: trimString(node.label),
            description: trimString(node.description),
            terminal: node.terminal === true,
          };
        }
      }
      const transitions = Array.isArray(m.transitions)
        ? m.transitions
            .filter((t) => t && typeof t === 'object')
            .map((t) => ({
              id: trimString(t.id),
              from: trimString(t.from),
              to: trimString(t.to),
              when: trimString(t.when),
              label: trimString(t.label),
              via: trimString(t.via),
              effects: Array.isArray(t.effects)
                ? t.effects
                    .filter((e) => e && typeof e === 'object')
                    .map((e) => ({
                      kind: trimString(e.kind),
                      label: trimString(e.label),
                      target: trimString(e.target),
                    }))
                : [],
            }))
        : [];
      return {
        id: trimString(m.id),
        label: trimString(m.label),
        entry: trimString(m.entry),
        nodes,
        transitions,
      };
    });
}

/**
 * Normalize a validated flow document for rendering + fingerprint.
 * @param {object} raw
 */
export function normalizeFlow(raw) {
  const doc = assertValidFlow(raw);
  const subgraphs = {};
  if (isNodeMap(doc.graph?.subgraphs)) {
    for (const [id, sub] of Object.entries(doc.graph.subgraphs)) {
      if (!sub || typeof sub !== 'object') continue;
      subgraphs[id] = {
        entry: trimString(sub.entry),
        nodes: normalizeNodeMap(sub.nodes),
      };
    }
  }
  return {
    schemaVersion: SCHEMA_VERSION,
    planSlug: trimString(doc.planSlug),
    title: trimString(doc.title) || trimString(doc.planSlug),
    description: trimString(doc.description),
    scenario: trimString(doc.scenario),
    actor: trimString(doc.actor),
    audience: trimString(doc.audience) || 'developer',
    youAreHere: trimString(doc.youAreHere) || null,
    actors: normalizeActors(doc.actors),
    graph: {
      entry: trimString(doc.graph.entry),
      nodes: normalizeNodeMap(doc.graph.nodes),
      subgraphs,
    },
    machines: normalizeMachines(doc.machines),
  };
}

/** Layout CSS — tokens from inlined ds.css only. Classes are fl-* (not a ds- prefix). */
export const FLOW_CSS = CHROME_CSS;

function finalizeHtml(html) {
  return html
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/g, ''))
    .join('\n')
    .replace(/\n+$/g, '\n');
}

function tabButton(tab, id, label, selected, hidden) {
  const hide = hidden ? ' hidden' : '';
  return `<button type="button" role="tab" data-tab="${tab}" aria-selected="${selected ? 'true' : 'false'}" aria-controls="${id}"${hide}>${escapeHtml(label)}</button>`;
}

function panel(id, surface, title, svg, hidden) {
  const hide = hidden ? ' hidden' : '';
  return `<section id="${id}" class="fl-surface" role="tabpanel" data-surface="${surface}" aria-labelledby="${id}-title"${hide}>
      <h2 id="${id}-title" class="fl-sr-only">${escapeHtml(title)}</h2>
      <div class="sheet">${svg}</div>
    </section>`;
}

/**
 * @param {object} normalized
 * @param {string} dsCss
 * @returns {string}
 */
export function renderFlowHtml(normalized, dsCss) {
  if (
    typeof dsCss !== 'string' ||
    !dsCss.includes('--bg-canvas') ||
    !dsCss.includes('--fg-default')
  ) {
    throw new Error('dsCss must include --bg-canvas and --fg-default from site/assets/ds.css');
  }
  const fp = contentFingerprint(normalized);
  const seqLayout = layoutSequence(normalized);
  const hideSeq = seqLayout.messages.length === 0;
  const hideMach = !Array.isArray(normalized.machines) || normalized.machines.length === 0;
  const defaultTab = hideSeq ? 'bpm' : 'sequence';
  const seqSvg = drawSequenceSvg(seqLayout);
  const bpmSvg = drawBpmSvg(layoutBpm(normalized));
  const machSvg = hideMach ? '' : drawMachinesSvg(layoutMachines(normalized));
  const title = `Fluxo — ${normalized.title}`;
  const styleBlock = `${dsCss.trim()}\n\n${FLOW_CSS.trim()}`;

  const html = `<!DOCTYPE html>
<html lang="pt-BR" data-fl-slug="${escapeHtml(normalized.planSlug)}" data-fl-content-sha="${escapeHtml(fp)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<script>${colorSchemeBootScript()}</script>
<style>
${styleBlock}
</style>
</head>
<body>
<div class="app">
  <header class="fl-header top">
    <div class="top-row">
      <div class="brand">
        <h1 class="fl-title">${escapeHtml(normalized.title)}</h1>
        <p class="fl-scenario">${escapeHtml(normalized.scenario)}</p>
      </div>
      <nav class="fl-toc" role="tablist" aria-label="Camadas do fluxo">
        ${tabButton('sequence', 'fl-sequence', 'Sequência', defaultTab === 'sequence', hideSeq)}
        ${tabButton('bpm', 'fl-bpm', 'Fluxo', defaultTab === 'bpm', false)}
        ${tabButton('machines', 'fl-machines', 'Máquinas', false, hideMach)}
      </nav>
      <div class="fl-toolbar">
        <button type="button" data-zoom="out" aria-label="Diminuir">−</button>
        <span class="zoom" id="z-lab">100%</span>
        <button type="button" data-zoom="in" aria-label="Aumentar">+</button>
        <button type="button" data-zoom="height">À altura</button>
        <button type="button" data-zoom="width">À largura</button>
        <button type="button" data-action="pdf" data-pdf-name="${escapeHtml(pdfFilename(normalized.planSlug))}">PDF</button>
        ${renderColorSchemeSwitch({ locale: 'pt' })}
      </div>
    </div>
    <p class="fl-hint" id="fl-hint">
      <span class="fl-meta"><span><strong>Ator:</strong> ${escapeHtml(normalized.actor)}</span><span><strong>Plano:</strong> ${escapeHtml(normalized.planSlug)}</span></span>
      <span class="fl-footer">content-sha ${escapeHtml(fp.slice(0, 16))} · schema ${escapeHtml(SCHEMA_VERSION)}</span>
    </p>
  </header>
  <div class="fl-viewport" id="fl-viewport">
    <div id="fl-sizer">
      <div id="fl-stage">
        ${panel('fl-sequence', 'sequence', 'Sequência', seqSvg, hideSeq)}
        ${panel('fl-bpm', 'bpm', 'Fluxo BPM', bpmSvg, defaultTab !== 'bpm')}
        ${panel('fl-machines', 'machines', 'Máquinas', machSvg, true)}
      </div>
    </div>
  </div>
</div>
<script>
${flowChromeScript()}
</script>
</body>
</html>
`;

  return finalizeHtml(html);
}

export function buildFlowHtml(raw, dsCss) {
  const normalized = normalizeFlow(raw);
  return {
    html: renderFlowHtml(normalized, dsCss),
    normalized,
    contentSha: contentFingerprint(normalized),
  };
}

export { SCHEMA_VERSION };
