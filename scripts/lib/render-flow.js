/**
 * Pure renderer: flow.json → self-contained flow.html.
 *
 * Design tokens: always inlines `site/assets/ds.css`.
 * Determinism: same normalized L1 + same dsCss → byte-identical HTML.
 * No timestamps, random IDs, or absolute paths in the output.
 *
 * Mermaid pin: 11.12.0 — vendored at assets/flow/mermaid-11.12.0.min.js (offline; no CDN).
 * Viewer filename is always flow.html.
 */

import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { escapeHtml } from './render-site.js';
import { assertValidFlow, SCHEMA_VERSION } from './validate-flow.js';

export { SCHEMA_VERSION };

export const MERMAID_PIN = '11.12.0';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MERMAID_PATH = join(__dirname, '..', '..', 'assets', 'flow', `mermaid-${MERMAID_PIN}.min.js`);

const TONES = Object.freeze({
  blue: { bg: '#eff6ff', border: '#2563eb', text: '#1e3a8a', soft: '#dbeafe' },
  sky: { bg: '#f0f9ff', border: '#0284c7', text: '#0c4a6e', soft: '#e0f2fe' },
  violet: { bg: '#f5f3ff', border: '#7c3aed', text: '#4c1d95', soft: '#ede9fe' },
  green: { bg: '#ecfdf5', border: '#059669', text: '#065f46', soft: '#d1fae5' },
  rose: { bg: '#fff1f2', border: '#e11d48', text: '#9f1239', soft: '#ffe4e6' },
  amber: { bg: '#fffbeb', border: '#d97706', text: '#92400e', soft: '#fef3c7' },
  slate: { bg: '#f8fafc', border: '#64748b', text: '#0f172a', soft: '#e2e8f0' },
});

const TONE_RGB = Object.freeze({
  blue: '239, 246, 255',
  sky: '240, 249, 255',
  violet: '245, 243, 255',
  green: '236, 253, 245',
  rose: '254, 242, 242',
  amber: '255, 251, 235',
  slate: '248, 250, 252',
});

const TONE_KEYS = Object.freeze(Object.keys(TONES));

let mermaidRuntimeCache;

function mermaidRuntime() {
  if (mermaidRuntimeCache == null) {
    if (!existsSync(MERMAID_PATH)) {
      throw new Error(`Missing pinned mermaid ${MERMAID_PIN}`);
    }
    const src = readFileSync(MERMAID_PATH, 'utf8');
    const hasPin = src.includes(MERMAID_PIN);
    const hasGlobal = src.includes('globalThis["mermaid"]') || src.includes("globalThis['mermaid']");
    if (!src.trim() || (!hasPin && !hasGlobal)) {
      throw new Error(`Pinned mermaid ${MERMAID_PIN} is empty or invalid`);
    }
    mermaidRuntimeCache = src;
  }
  return mermaidRuntimeCache;
}

/**
 * @param {string} text
 */
export function sha256(text) {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

/**
 * Canonical JSON stringify: sorted object keys, stable arrays as given.
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
 * Fingerprint of normalized L1 (lifecycle + graph + states). Independent of DS CSS.
 * @param {object} normalized
 */
export function contentFingerprint(normalized) {
  return sha256(stableStringify(normalized));
}

function trimString(value) {
  return String(value).trim();
}

function normalizeMessage(msg) {
  return {
    from: String(msg.from),
    to: String(msg.to),
    text: String(msg.text),
    async: Boolean(msg.async),
  };
}

function normalizeEffect(effect) {
  const out = { label: String(effect.label) };
  if (effect.statusTo != null) out.statusTo = Number(effect.statusTo);
  return out;
}

function normalizeBranch(branch) {
  const out = {
    id: String(branch.id),
    when: String(branch.when),
    label: String(branch.label),
    next: String(branch.next),
  };
  if (branch.tone != null) out.tone = String(branch.tone);
  if (branch.hint != null) out.hint = String(branch.hint);
  if (branch.statusTo != null) out.statusTo = Number(branch.statusTo);
  return out;
}

function normalizeNode(node) {
  if (node.type === 'sequence') {
    const out = {
      type: 'sequence',
      processLabel: trimString(node.processLabel),
      messages: (node.messages || []).map(normalizeMessage),
      next: String(node.next),
    };
    if (node.processWho != null) out.processWho = String(node.processWho);
    if (node.title != null) out.title = String(node.title);
    if (node.tone != null) out.tone = String(node.tone);
    if (Array.isArray(node.effects)) out.effects = node.effects.map(normalizeEffect);
    if (node.loop === true) out.loop = true;
    if (node.stage != null) out.stage = String(node.stage);
    return out;
  }
  if (node.type === 'decision') {
    const out = {
      type: 'decision',
      kind: 'xor',
      processLabel: trimString(node.processLabel),
      actor: String(node.actor),
      branches: (node.branches || []).map(normalizeBranch),
    };
    if (node.processWho != null) out.processWho = String(node.processWho);
    if (node.title != null) out.title = String(node.title);
    if (node.tone != null) out.tone = String(node.tone);
    if (node.question != null) out.question = String(node.question);
    return out;
  }
  const out = {
    type: 'end',
    processLabel: trimString(node.processLabel),
  };
  if (node.title != null) out.title = String(node.title);
  if (node.tone != null) out.tone = String(node.tone);
  return out;
}

function normalizeStates(states) {
  if (!states || typeof states !== 'object' || Array.isArray(states)) return null;
  if (!states.nodes || typeof states.nodes !== 'object') return null;
  const nodes = {};
  for (const [id, node] of Object.entries(states.nodes)) {
    const out = { label: String(node.label) };
    if (node.status != null) out.status = Number(node.status);
    if (node.description != null) out.description = String(node.description);
    if (node.terminal === true) out.terminal = true;
    nodes[id] = out;
  }
  return {
    entry: String(states.entry),
    nodes,
    transitions: Array.isArray(states.transitions)
      ? states.transitions.map((t) => {
          const out = {
            id: String(t.id),
            from: String(t.from),
            to: String(t.to),
            when: String(t.when),
            label: String(t.label),
          };
          if (t.via != null) out.via = String(t.via);
          if (t.statusTo != null) out.statusTo = Number(t.statusTo);
          return out;
        })
      : [],
  };
}

/**
 * Normalize for rendering after validation. Actors keep authorial order (lifelines).
 * @param {object} raw — already validated, or validated here
 */
export function normalizeFlow(raw) {
  assertValidFlow(raw);
  const nodes = {};
  for (const [id, node] of Object.entries(raw.graph.nodes)) {
    nodes[id] = normalizeNode(node);
  }
  return {
    schemaVersion: SCHEMA_VERSION,
    planSlug: trimString(raw.planSlug),
    title:
      typeof raw.title === 'string' && raw.title.trim()
        ? raw.title.trim()
        : trimString(raw.planSlug),
    description: typeof raw.description === 'string' ? raw.description.trim() : '',
    actor: trimString(raw.actor),
    scenario: trimString(raw.scenario),
    audience: String(raw.audience),
    youAreHere: raw.youAreHere == null || raw.youAreHere === '' ? null : String(raw.youAreHere),
    ratifiedAt:
      typeof raw.ratifiedAt === 'string' && raw.ratifiedAt.trim() ? raw.ratifiedAt.trim() : null,
    ratifiedGraphSha: typeof raw.ratifiedGraphSha === 'string' ? raw.ratifiedGraphSha : null,
    actors: raw.actors.map((a) => ({
      id: String(a.id),
      label: String(a.label),
      kind: a.kind === 'participant' ? 'participant' : 'actor',
    })),
    graph: {
      entry: String(raw.graph.entry),
      nodes,
    },
    states: normalizeStates(raw.states),
  };
}

function graphView(normalized) {
  return {
    ...normalized,
    entry: normalized.graph.entry,
    nodes: normalized.graph.nodes,
  };
}

function walkLayout(m) {
  const steps = [];
  const visited = new Set();
  let cur = m.entry;
  let guard = 0;
  while (cur && guard++ < 50) {
    if (visited.has(cur)) {
      steps.push({ kind: 'loop-ref', nodeId: cur, node: m.nodes[cur] });
      break;
    }
    const node = m.nodes[cur];
    if (!node) break;

    if (node.type === 'sequence') {
      visited.add(cur);
      steps.push({ kind: 'sequence', nodeId: cur, node });
      cur = node.next;
    } else if (node.type === 'decision') {
      visited.add(cur);
      const branchPanels = (node.branches || []).map((b) => ({
        branch: b,
        chain: collectBranchChain(m, b.next, visited, 0),
      }));
      steps.push({ kind: 'decision', nodeId: cur, node, branchPanels });
      cur = null;
    } else if (node.type === 'end') {
      visited.add(cur);
      steps.push({ kind: 'end', nodeId: cur, node });
      cur = null;
    } else {
      break;
    }
  }
  if (guard >= 50) {
    steps.push({
      kind: 'loop-ref',
      nodeId: cur || m.entry,
      node: m.nodes[cur] || m.nodes[m.entry],
      truncated: true,
    });
  }
  return steps;
}

function collectBranchChain(m, startId, trunkVisited, depth = 0) {
  const chain = [];
  if (depth > 12) {
    chain.push({ kind: 'loop-ref', nodeId: startId, node: m.nodes[startId], truncated: true });
    return chain;
  }
  let cur = startId;
  let guard = 0;
  const local = new Set();
  while (cur && guard++ < 40) {
    if (local.has(cur) || trunkVisited.has(cur)) {
      chain.push({ kind: 'loop-ref', nodeId: cur, node: m.nodes[cur] });
      break;
    }
    const node = m.nodes[cur];
    if (!node) break;
    local.add(cur);

    if (node.type === 'sequence') {
      chain.push({ kind: 'sequence', nodeId: cur, node });
      if (!node.next) break;
      if (trunkVisited.has(node.next) || local.has(node.next)) {
        chain.push({ kind: 'loop-ref', nodeId: node.next, node: m.nodes[node.next] });
        break;
      }
      if (m.nodes[node.next]?.type === 'decision') {
        const nested = m.nodes[node.next];
        const visitedNext = new Set([...trunkVisited, ...local, node.next]);
        const branchPanels = (nested.branches || []).map((b) => ({
          branch: b,
          chain: collectBranchChain(m, b.next, visitedNext, depth + 1),
        }));
        chain.push({ kind: 'decision', nodeId: node.next, node: nested, branchPanels });
        break;
      }
      cur = node.next;
    } else if (node.type === 'end') {
      chain.push({ kind: 'end', nodeId: cur, node });
      break;
    } else if (node.type === 'decision') {
      if (trunkVisited.has(cur)) {
        chain.push({ kind: 'loop-ref', nodeId: cur, node });
        break;
      }
      const visitedHere = new Set([...trunkVisited, ...local]);
      const branchPanels = (node.branches || []).map((b) => ({
        branch: b,
        chain: collectBranchChain(m, b.next, visitedHere, depth + 1),
      }));
      chain.push({ kind: 'decision', nodeId: cur, node, branchPanels });
      break;
    } else break;
  }
  return chain;
}

function mmdLabel(s) {
  return String(s ?? '')
    .replace(/[<>&\[\]{}]/g, '')
    .replace(/\|/g, '/')
    .replace(/"/g, "'")
    .replace(/·/g, '-')
    .replace(/#/g, 'n.')
    .replace(/\n/g, ' ')
    .replace(/:/g, ' -')
    .replace(/\s+/g, ' ')
    .trim();
}

function firstActorId(actors, fallback = 'A') {
  const id = actors?.[0]?.id;
  return typeof id === 'string' && id ? id : fallback;
}

/** Note over max 2 participants (Mermaid rule). First message actor ids, else first actors. */
function noteSpan(messages, actors, fallback) {
  const ids = [];
  const seen = new Set();
  for (const msg of messages || []) {
    for (const id of [msg.from, msg.to]) {
      if (typeof id === 'string' && id && !seen.has(id)) {
        seen.add(id);
        ids.push(id);
      }
    }
  }
  if (ids.length >= 2) return `${ids[0]},${ids[1]}`;
  if (ids.length === 1) return ids[0];
  const actorIds = (actors || []).map((a) => a.id).filter(Boolean);
  if (actorIds.length >= 2) return `${actorIds[0]},${actorIds[1]}`;
  if (actorIds.length === 1) return actorIds[0];
  return fallback || 'A';
}

function endNoteSpan(actors) {
  const ids = (actors || []).map((a) => a.id).filter(Boolean);
  if (ids.length >= 2) return `${ids[0]},${ids[1]}`;
  return ids[0] || 'A';
}

/**
 * Sequence as one Mermaid diagram. Decisions = UML alt/else.
 * @param {{ actors: object[], entry: string, nodes: object }} m
 */
export function buildSequenceMermaid(m) {
  const lines = ['sequenceDiagram', '  autonumber'];
  const fallback = firstActorId(m.actors);
  for (const a of m.actors || []) {
    const kind = a.kind === 'participant' ? 'participant' : 'actor';
    lines.push(`  ${kind} ${a.id} as ${mmdLabel(a.label || a.id)}`);
  }
  lines.push('');

  function pushMsg(msg) {
    const text = mmdLabel(msg.text);
    const arrow = msg.async ? '-->>' : '->>';
    lines.push(`  ${msg.from}${arrow}${msg.to}: ${text}`);
  }

  function branchLabel(b) {
    let lab = mmdLabel(b.label || b.when || '');
    if (b.statusTo != null) lab += ` → ${b.statusTo}`;
    return lab;
  }

  function phaseNoteLabel(node) {
    const base = mmdLabel(node.processLabel || node.title || '');
    const who = node.processWho ? ` (${mmdLabel(node.processWho)})` : '';
    return base + who;
  }

  function emitSequence(step) {
    const node = step.node;
    const rgb = TONE_RGB[node.tone] || TONE_RGB.slate;
    const span = noteSpan(node.messages, m.actors, fallback);
    lines.push(`  rect rgb(${rgb})`);
    lines.push(`  Note over ${span}: ${phaseNoteLabel(node)}`);
    for (const msg of node.messages || []) pushMsg(msg);
    for (const e of node.effects || []) {
      if (e.statusTo != null) {
        lines.push(`  Note over ${span}: status ${e.statusTo} - ${mmdLabel(e.label)}`);
      } else if (e.label) {
        lines.push(`  Note over ${span}: ${mmdLabel(e.label)}`);
      }
    }
    lines.push('  end');
    lines.push('');
  }

  function emitEnd(step) {
    const label = mmdLabel(step.node.processLabel || step.node.title);
    const span = endNoteSpan(m.actors);
    if (step.node.tone === 'green' || step.node.tone === 'rose') {
      const rgb = TONE_RGB[step.node.tone] || TONE_RGB.slate;
      lines.push(`  rect rgb(${rgb})`);
      lines.push(`  Note over ${span}: ${label}`);
      lines.push('  end');
    } else {
      lines.push(`  Note over ${span}: ${label}`);
    }
    lines.push('');
  }

  function emitLoop(step) {
    const title = mmdLabel(step.node?.title || step.node?.processLabel || 'previous step');
    const span = fallback;
    if (step.truncated) {
      lines.push(`  Note over ${span}: … truncated (${title})`);
    } else {
      lines.push(`  Note over ${span}: ↺ loop (${title})`);
    }
    lines.push('');
  }

  function emitDecision(step) {
    const panels = step.branchPanels || [];
    if (!panels.length) return;

    const q = mmdLabel(step.node.processLabel || step.node.question || step.node.title || '');
    const actor = (m.actors || []).find((a) => a.id === step.node.actor);
    const who = mmdLabel(actor?.label || step.node.processWho || '');
    const span = step.node.actor
      ? noteSpan([{ from: step.node.actor, to: step.node.actor }], m.actors, fallback)
      : fallback;
    if (q) {
      lines.push(`  Note over ${span}: ◆ ${q}${who ? ` (${who})` : ''}`);
    }

    panels.forEach((panel, i) => {
      const cond = branchLabel(panel.branch);
      if (i === 0) lines.push(`  alt ${cond}`);
      else lines.push(`  else ${cond}`);
      emitChain(panel.chain);
    });
    lines.push('  end');
    lines.push('');
  }

  function emitChain(chain) {
    for (const step of chain) {
      if (step.kind === 'sequence') emitSequence(step);
      else if (step.kind === 'decision') emitDecision(step);
      else if (step.kind === 'end') emitEnd(step);
      else if (step.kind === 'loop-ref') emitLoop(step);
    }
  }

  emitChain(walkLayout(m));
  return lines.join('\n');
}

function processLabel(node) {
  if (!node) return '';
  if (node.type === 'decision') {
    return mmdLabel(node.processLabel || node.question || node.title || '');
  }
  return mmdLabel(node.processLabel || node.title || '');
}

function branchEdgeLabel(b) {
  return mmdLabel((b.label || b.when || '').replace(/·/g, '-'));
}

/**
 * @param {{ nodes: object }} m
 */
export function buildFlowMermaid(m) {
  const lines = ['flowchart LR'];
  const ids = Object.keys(m.nodes);
  for (const id of ids) {
    const node = m.nodes[id];
    const who = node.processWho ? `\\n(${mmdLabel(node.processWho)})` : '';
    if (node.type === 'sequence') {
      lines.push(`  ${id}["${processLabel(node)}${who}"]`);
    } else if (node.type === 'decision') {
      lines.push(`  ${id}{"${processLabel(node)}${who}"}`);
    } else if (node.type === 'end') {
      lines.push(`  ${id}((${processLabel(node)}))`);
    }
  }
  for (const id of ids) {
    const node = m.nodes[id];
    if (node.type === 'sequence' && node.next) {
      if (node.loop) lines.push(`  ${id} -->|loop| ${node.next}`);
      else lines.push(`  ${id} --> ${node.next}`);
    }
    if (node.type === 'decision') {
      for (const b of node.branches || []) {
        lines.push(`  ${id} -->|${branchEdgeLabel(b)}| ${b.next}`);
      }
    }
  }
  lines.push('  classDef blue fill:#eff6ff,stroke:#2563eb,color:#0f172a');
  lines.push('  classDef rose fill:#fff1f2,stroke:#e11d48,color:#9f1239');
  lines.push('  classDef green fill:#ecfdf5,stroke:#059669,color:#065f46');
  lines.push('  classDef violet fill:#f5f3ff,stroke:#7c3aed,color:#0f172a');
  lines.push('  classDef sky fill:#f0f9ff,stroke:#0284c7,color:#0f172a');
  lines.push('  classDef slate fill:#f8fafc,stroke:#64748b,color:#0f172a');
  lines.push('  classDef endOk fill:#059669,stroke:#047857,color:#ffffff');
  lines.push('  classDef endBad fill:#e11d48,stroke:#be123c,color:#ffffff');
  lines.push('  classDef endn fill:#0f172a,stroke:#0f172a,color:#fff');
  lines.push('  classDef dec fill:#fffbeb,stroke:#d97706,color:#0f172a');
  for (const id of ids) {
    const node = m.nodes[id];
    if (node.type === 'decision') {
      lines.push(`  class ${id} dec`);
    } else if (node.type === 'end') {
      if (node.tone === 'green') lines.push(`  class ${id} endOk`);
      else if (node.tone === 'rose') lines.push(`  class ${id} endBad`);
      else lines.push(`  class ${id} endn`);
    } else if (node.tone && TONE_KEYS.includes(node.tone)) {
      lines.push(`  class ${id} ${node.tone}`);
    }
  }
  return lines.join('\n');
}

/**
 * @param {{ states: object|null }} m
 * @returns {string|null}
 */
export function buildStatesMermaid(m) {
  const st = m.states;
  if (!st || !st.nodes || !Object.keys(st.nodes).length) return null;
  const lines = ['stateDiagram-v2', '  direction LR'];
  lines.push(`  [*] --> ${st.entry}`);
  const ids = Object.keys(st.nodes);
  for (const id of ids) {
    const node = st.nodes[id];
    const status = node.status != null ? `\\nstatus ${node.status}` : '';
    lines.push(`  state "${mmdLabel(node.label)}${status}" as ${id}`);
  }
  for (const t of st.transitions || []) {
    const lab = mmdLabel(t.label || t.when || '');
    lines.push(`  ${t.from} --> ${t.to}: ${lab}`);
  }
  const outgoing = new Set((st.transitions || []).map((t) => t.from));
  for (const id of ids) {
    const node = st.nodes[id];
    if (node.terminal === true || !outgoing.has(id)) {
      lines.push(`  ${id} --> [*]`);
    }
  }
  return lines.join('\n');
}

function embedJson(value) {
  return stableStringify(value).replace(/</g, '\\u003c');
}

export const FLOW_CSS = `/* flow viewer — tokens from inlined ds.css plus local chrome */
:root {
  --flow-bg: var(--bg-canvas, #eef2f7);
  --flow-surface: var(--bg-surface, #fff);
  --flow-ink: var(--fg-default, #0f172a);
  --flow-muted: var(--fg-muted, #64748b);
  --flow-soft: var(--fg-subtle, #334155);
  --flow-line: var(--border-default, #e2e8f0);
  --flow-font: var(--font-sans, Inter, ui-sans-serif, system-ui, sans-serif);
}
* { box-sizing: border-box; }
html, body {
  margin: 0; height: 100%; overflow: hidden;
  font-family: var(--flow-font); color: var(--flow-ink); background: var(--flow-bg);
}
.flow-app { display: grid; grid-template-rows: auto 1fr; height: 100%; min-height: 100vh; }
.top {
  z-index: 20;
  background: color-mix(in srgb, var(--flow-surface) 96%, transparent);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid var(--flow-line);
  padding: .55rem 1rem .5rem;
  display: flex; flex-direction: column; gap: .45rem;
}
.top-row {
  display: flex; flex-wrap: wrap; gap: .55rem 1rem;
  align-items: center; justify-content: space-between;
}
.brand strong { display: block; font-size: .95rem; letter-spacing: -.02em; }
.brand span { font-size: .72rem; color: var(--flow-muted); }
.tabs { display: flex; flex-wrap: wrap; gap: .35rem; align-items: center; }
.tabs button {
  appearance: none; border: 1px solid var(--flow-line); background: var(--bg-elevated, #f8fafc);
  color: var(--flow-soft); font: inherit; font-size: .78rem; font-weight: 650;
  padding: .42rem .85rem; border-radius: 999px; cursor: pointer;
}
.tabs button:hover { border-color: #94a3b8; }
.tabs button.is-active { background: var(--flow-ink); color: #fff; border-color: var(--flow-ink); }
.tabs .tab-meta {
  font-size: .68rem; font-weight: 600; color: var(--flow-muted); margin-left: .15rem;
}
.tabs button.is-active .tab-meta { color: #cbd5e1; }
.toolbar { display: flex; flex-wrap: wrap; gap: .35rem; align-items: center; }
.toolbar button {
  appearance: none; border: 1px solid var(--flow-line); background: var(--flow-surface);
  color: var(--flow-soft); font: inherit; font-size: .76rem; font-weight: 650;
  padding: .38rem .65rem; border-radius: 999px; cursor: pointer;
}
.toolbar button:hover { border-color: #94a3b8; }
.toolbar button.primary { background: var(--flow-ink); color: #fff; border-color: var(--flow-ink); }
.toolbar .zoom {
  min-width: 3.2rem; text-align: center; font-variant-numeric: tabular-nums;
  color: var(--flow-muted); font-size: .76rem; font-weight: 700; padding: 0 .3rem;
}
.hint-bar {
  font-size: .72rem; color: var(--flow-muted);
  display: flex; flex-wrap: wrap; gap: .3rem 1rem; align-items: center;
}
.hint-bar strong { color: var(--flow-soft); font-weight: 650; }
.hint-bar kbd {
  font-family: var(--font-mono, ui-monospace, Menlo, monospace); font-size: .66rem;
  background: #f1f5f9; border: 1px solid var(--flow-line); border-radius: 4px; padding: .05rem .28rem;
}
.val {
  font-size: .7rem; font-weight: 700; padding: .2rem .55rem; border-radius: 999px;
  border: 1px solid var(--flow-line);
}
.val.ok { background: #ecfdf5; color: #065f46; border-color: #a7f3d0; }
#viewport {
  position: relative; overflow: auto; overscroll-behavior: contain;
  background:
    radial-gradient(circle at 1px 1px, #cbd5e1 1px, transparent 0) 0 0 / 22px 22px,
    #f8fafc;
  cursor: grab; scrollbar-gutter: stable both-edges;
}
#viewport.is-panning { cursor: grabbing; user-select: none; }
#sizer { position: relative; min-width: 100%; min-height: 100%; }
#stage {
  position: absolute; top: 0; left: 0;
  transform-origin: 0 0; will-change: transform; padding: 40px;
}
.diagram-panel { display: inline-block; }
.diagram-panel[hidden] { display: none !important; }
.diagram {
  display: inline-block; background: #fff; border: 1px solid var(--flow-line);
  border-radius: 16px;
  box-shadow: 0 1px 2px rgba(15,23,42,.04), 0 16px 40px rgba(15,23,42,.08);
  padding: 1.1rem 1.25rem;
}
.diagram svg { display: block; max-width: none !important; }
.err {
  margin: 0; padding: 1rem; color: #9f1239; white-space: pre-wrap;
  font-size: .85rem; max-width: 70ch;
}
.diagram svg .loopLine {
  stroke: #64748b !important;
  stroke-width: 1.75px !important;
  stroke-dasharray: 0 !important;
  fill: none !important;
}
.diagram svg line.actor-line,
.diagram svg line[data-et="life-line"] {
  stroke: #94a3b8 !important;
  stroke-opacity: 0.55 !important;
  pointer-events: none;
}
`;

export const FLOW_JS = `(function(){
  var SOURCES = JSON.parse(document.getElementById("flow-mermaid-sources").textContent);
  var MODEL = JSON.parse(document.getElementById("flow-model").textContent);
  var activeTab = "sequencia";
  var scale = 1;
  var MIN = 0.3;
  var MAX = 2.8;
  var STEP = 0.1;
  var PAD = 40;
  var rendered = new Set();
  var renderGen = 0;
  var mermaidIdSeq = 0;
  var $ = function(id){ return document.getElementById(id); };
  var TAB_META = {
    sequencia: { hint: "Continuous sequence · XOR as alt/else · exclusive branches" },
    fluxo: { hint: "Process flowchart · business labels (processLabel / processWho)" },
    estados: { hint: "State machine from the same model" }
  };

  mermaid.initialize({
    startOnLoad: false,
    theme: "base",
    themeVariables: {
      primaryColor: "#e8f1ff",
      primaryTextColor: "#0f172a",
      primaryBorderColor: "#2563eb",
      secondaryColor: "#ecfdf5",
      secondaryBorderColor: "#059669",
      tertiaryColor: "#fff7ed",
      lineColor: "#64748b",
      textColor: "#0f172a",
      mainBkg: "#eff6ff",
      nodeBorder: "#2563eb",
      clusterBkg: "#f8fafc",
      clusterBorder: "#cbd5e1",
      titleColor: "#0f172a",
      edgeLabelBackground: "#ffffff",
      noteBkgColor: "#f8fafc",
      noteTextColor: "#0f172a",
      noteBorderColor: "#cbd5e1",
      fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
      fontSize: "14px"
    },
    flowchart: {
      htmlLabels: true,
      curve: "basis",
      padding: 20,
      nodeSpacing: 36,
      rankSpacing: 56,
      useMaxWidth: false
    },
    sequence: {
      mirrorActors: true,
      actorMargin: 72,
      messageMargin: 36,
      boxMargin: 10,
      bottomMarginAdj: 1,
      width: 196,
      height: 46,
      useMaxWidth: false
    },
    securityLevel: "loose"
  });

  function esc(s){
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function clearFontOverrides(el){
    if (!el) return;
    el.removeAttribute("font-weight");
    el.removeAttribute("font-size");
    if (el.style) {
      el.style.removeProperty("font-weight");
      el.style.removeProperty("font-size");
    }
  }

  function polishSequenceSvg(host){
    var svg = host.querySelector("svg");
    if (!svg) return;
    if (svg.dataset.sequencePolished === "1") return;
    svg.dataset.sequencePolished = "1";
    svg.querySelectorAll("[data-alt-fill], [data-else-overlay], [data-decision-bar]").forEach(function(n){ n.remove(); });
    svg.querySelectorAll("text").forEach(function(t){
      var v = (t.textContent || "").trim();
      if (v === "alt" || v === "◇ decisão" || v.indexOf("◇ decis") === 0) {
        t.textContent = "◇";
        t.setAttribute("fill", "#64748b");
        clearFontOverrides(t);
      }
    });
    svg.querySelectorAll(".loopLine, path.loopLine, line.loopLine, rect.loopLine").forEach(function(el){
      el.setAttribute("stroke", "#64748b");
      el.setAttribute("stroke-width", "1.75");
      el.setAttribute("stroke-dasharray", "0");
      el.setAttribute("fill", "none");
    });
    svg.querySelectorAll("text").forEach(function(textEl){
      var raw = (textEl.textContent || "").trim().replace(/\\u00a0/g, " ");
      if (!/^[◆◇]/.test(raw) || raw === "◇" || raw === "◆") return;
      var body = raw.replace(/^[◆◇]\\s*/, "");
      textEl.textContent = "◇ " + body;
      clearFontOverrides(textEl);
    });
    extendActorLifelines(svg);
  }

  function extendActorLifelines(svg){
    var lifelines = [].concat(
      Array.from(svg.querySelectorAll("line.actor-line")),
      Array.from(svg.querySelectorAll("line[data-et=\\"life-line\\"]"))
    ).filter(function(line, i, arr){ return arr.indexOf(line) === i; })
      .filter(function(line){ return !(line.classList && line.classList.contains("loopLine")); })
      .filter(function(line){ return (line.getAttribute("class") || "").indexOf("loopLine") === -1; });
    if (!lifelines.length) return;
    var maxY = 0;
    svg.querySelectorAll("*").forEach(function(el){
      try {
        if (typeof el.getBBox !== "function") return;
        if (el.tagName === "line" && (
          (el.classList && el.classList.contains("actor-line")) ||
          el.getAttribute("data-et") === "life-line"
        )) return;
        var b = el.getBBox();
        if (!b || !isFinite(b.y)) return;
        maxY = Math.max(maxY, b.y + b.height);
      } catch (_e) { /* ignore */ }
    });
    if (!maxY) return;
    var bottom = maxY + 12;
    for (var i = 0; i < lifelines.length; i++) {
      var line = lifelines[i];
      var y1 = parseFloat(line.getAttribute("y1") || "0");
      var y2 = parseFloat(line.getAttribute("y2") || "0");
      var top = Math.min(y1, y2);
      line.setAttribute("y1", String(top));
      if (bottom > Math.max(y1, y2)) line.setAttribute("y2", String(bottom));
      line.setAttribute("stroke", "#94a3b8");
      line.setAttribute("stroke-width", "1.25");
      line.setAttribute("stroke-dasharray", "5 5");
      line.setAttribute("stroke-opacity", "0.55");
      line.style.pointerEvents = "none";
    }
    var defs = svg.querySelector("defs");
    var ref = defs ? defs.nextSibling : svg.firstChild;
    for (var j = lifelines.length - 1; j >= 0; j--) {
      svg.insertBefore(lifelines[j], ref);
      ref = lifelines[j];
    }
    var vb = svg.viewBox && svg.viewBox.baseVal;
    if (vb && bottom > vb.height - 4) {
      var newH = Math.ceil(bottom + 28);
      svg.setAttribute("viewBox", vb.x + " " + vb.y + " " + vb.width + " " + newH);
      var h = parseFloat(svg.getAttribute("height") || String(newH));
      if (h < newH) svg.setAttribute("height", String(Math.round(newH * 1.05)));
    }
  }

  async function renderMermaidInto(host, code, key, gen){
    try {
      var id = "mmd-" + key + "-" + (++mermaidIdSeq);
      var out = await mermaid.render(id, code);
      if (gen != null && gen !== renderGen) return false;
      host.innerHTML = out.svg;
      var s = host.querySelector("svg");
      if (s) {
        s.removeAttribute("style");
        s.style.maxWidth = "none";
        s.style.width = "auto";
        s.style.height = "auto";
        s.style.display = "block";
        var box = s.viewBox && s.viewBox.baseVal;
        if (box && box.width && box.height) {
          var factor = key === "sequencia" ? 1.05 : 1.1;
          s.setAttribute("width", String(Math.round(box.width * factor)));
          s.setAttribute("height", String(Math.round(box.height * factor)));
        }
      }
      if (key === "sequencia") polishSequenceSvg(host);
      return true;
    } catch (e) {
      if (gen != null && gen !== renderGen) return false;
      host.innerHTML = "<pre class=\\"err\\">" + esc(String(e)) + "</pre>";
      return false;
    }
  }

  function naturalSize(){
    var el = activeDiagramEl();
    if (!el) return { w: 0, h: 0 };
    return { w: el.offsetWidth, h: el.offsetHeight };
  }
  function activeDiagramEl(){
    return document.querySelector('.diagram-panel[data-tab="' + activeTab + '"] .diagram');
  }
  function applyStageGeometry(){
    var vp = $("viewport");
    var sizer = $("sizer");
    var stage = $("stage");
    var size = naturalSize();
    if (!size.w || !size.h) return null;
    var contentW = size.w + PAD * 2;
    var contentH = size.h + PAD * 2;
    var scaledW = contentW * scale;
    var scaledH = contentH * scale;
    var sizerW = Math.max(vp.clientWidth, Math.ceil(scaledW));
    var sizerH = Math.max(vp.clientHeight, Math.ceil(scaledH));
    sizer.style.width = sizerW + "px";
    sizer.style.height = sizerH + "px";
    var left = Math.max(0, (sizerW - scaledW) / 2);
    stage.style.left = left + "px";
    stage.style.top = "0px";
    stage.style.transform = "scale(" + scale + ")";
    $("zoom-label").textContent = Math.round(scale * 100) + "%";
    return { left: left, top: 0, scaledW: scaledW, scaledH: scaledH };
  }
  function centerHorizontally(scrollTop){
    var vp = $("viewport");
    var geo = applyStageGeometry();
    if (!geo) return;
    vp.scrollLeft = geo.scaledW > vp.clientWidth ? (geo.scaledW - vp.clientWidth) / 2 : 0;
    vp.scrollTop = scrollTop || 0;
  }
  function setScale(next, anchor){
    var prev = scale || 1;
    scale = Math.min(MAX, Math.max(MIN, next));
    var vp = $("viewport");
    var stage = $("stage");
    var prevLeft = parseFloat(stage.style.left) || 0;
    var prevTop = parseFloat(stage.style.top) || 0;
    var contentX, contentY, cx, cy;
    if (anchor) {
      var rect = vp.getBoundingClientRect();
      cx = anchor.clientX - rect.left;
      cy = anchor.clientY - rect.top;
      contentX = (vp.scrollLeft + cx - prevLeft) / prev;
      contentY = (vp.scrollTop + cy - prevTop) / prev;
    } else {
      contentX = (vp.scrollLeft + vp.clientWidth / 2 - prevLeft) / prev;
      contentY = (vp.scrollTop + vp.clientHeight / 2 - prevTop) / prev;
    }
    var geo = applyStageGeometry();
    if (!geo) return;
    if (anchor) {
      vp.scrollLeft = contentX * scale + geo.left - cx;
      vp.scrollTop = contentY * scale + geo.top - cy;
    } else {
      vp.scrollLeft = contentX * scale + geo.left - vp.clientWidth / 2;
      vp.scrollTop = contentY * scale + geo.top - vp.clientHeight / 2;
    }
  }
  function fitToView(){
    var vp = $("viewport");
    var size = naturalSize();
    if (!size.w || !size.h) return;
    var fitX = (vp.clientWidth - 24) / (size.w + PAD * 2);
    var fitY = (vp.clientHeight - 24) / (size.h + PAD * 2);
    scale = Math.max(MIN, Math.min(MAX, Math.min(fitX, fitY, 1)));
    centerHorizontally(0);
  }
  function resetZoom(){
    scale = 1;
    centerHorizontally(0);
  }
  function enablePanZoom(){
    var vp = $("viewport");
    var panning = false, ox = 0, oy = 0, sx = 0, sy = 0;
    vp.addEventListener("pointerdown", function(e){
      if (e.button !== 0 && e.button !== 1) return;
      panning = true;
      ox = e.clientX; oy = e.clientY;
      sx = vp.scrollLeft; sy = vp.scrollTop;
      vp.setPointerCapture(e.pointerId);
      vp.classList.add("is-panning");
      e.preventDefault();
    });
    vp.addEventListener("pointermove", function(e){
      if (!panning) return;
      vp.scrollLeft = sx - (e.clientX - ox);
      vp.scrollTop = sy - (e.clientY - oy);
    });
    var end = function(e){
      if (!panning) return;
      panning = false;
      vp.classList.remove("is-panning");
      try { vp.releasePointerCapture(e.pointerId); } catch (_e) {}
    };
    vp.addEventListener("pointerup", end);
    vp.addEventListener("pointercancel", end);
    vp.addEventListener("wheel", function(e){
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        setScale(scale + (e.deltaY > 0 ? -STEP : STEP), e);
      }
    }, { passive: false });
    window.addEventListener("keydown", function(e){
      if (!(e.ctrlKey || e.metaKey)) return;
      if (e.key === "=" || e.key === "+") { e.preventDefault(); setScale(scale + STEP); }
      if (e.key === "-") { e.preventDefault(); setScale(scale - STEP); }
      if (e.key === "0") { e.preventDefault(); resetZoom(); }
    });
  }

  function sourceFor(tabId){
    if (tabId === "sequencia") return SOURCES.sequence;
    if (tabId === "fluxo") return SOURCES.flow;
    if (tabId === "estados") return SOURCES.states;
    return null;
  }

  async function renderTab(tabId){
    var panel = document.querySelector('.diagram-panel[data-tab="' + tabId + '"]');
    var host = panel && panel.querySelector(".diagram");
    if (!host) return;
    if (rendered.has(tabId) && host.childElementCount && !host.querySelector(".err")) return;
    if (host.querySelector(".err")) rendered.delete(tabId);
    var gen = renderGen;
    var code = sourceFor(tabId);
    if (!code) return;
    var ok = await renderMermaidInto(host, code, tabId, gen);
    if (ok && gen === renderGen) rendered.add(tabId);
    else if (!ok) rendered.delete(tabId);
  }

  async function switchTab(tabId){
    if (!TAB_META[tabId]) return;
    if (tabId === "estados" && !SOURCES.states) return;
    activeTab = tabId;
    renderGen += 1;
    document.querySelectorAll("[data-tab-btn]").forEach(function(b){
      var on = b.getAttribute("data-tab-btn") === tabId;
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-selected", on ? "true" : "false");
      b.setAttribute("tabindex", on ? "0" : "-1");
    });
    document.querySelectorAll(".diagram-panel").forEach(function(p){
      var on = p.getAttribute("data-tab") === tabId;
      p.hidden = !on;
      p.setAttribute("aria-hidden", on ? "false" : "true");
    });
    var hint = $("tab-hint");
    if (hint) hint.textContent = TAB_META[tabId].hint;
    await renderTab(tabId);
    requestAnimationFrame(function(){
      requestAnimationFrame(function(){ resetZoom(); });
    });
    try { history.replaceState(null, "", "#" + tabId); } catch (_e) {}
  }

  document.addEventListener("DOMContentLoaded", async function(){
    $("btn-in").addEventListener("click", function(){ setScale(scale + STEP); });
    $("btn-out").addEventListener("click", function(){ setScale(scale - STEP); });
    $("btn-reset").addEventListener("click", resetZoom);
    $("btn-fit").addEventListener("click", fitToView);
    document.querySelectorAll("[data-tab-btn]").forEach(function(b){
      b.addEventListener("click", function(){ switchTab(b.getAttribute("data-tab-btn")); });
    });
    enablePanZoom();
    window.__FLOW_MODEL__ = MODEL;
    var hash = (location.hash || "#sequencia").slice(1);
    var initial = TAB_META[hash] ? hash : "sequencia";
    if (initial === "estados" && !SOURCES.states) initial = "sequencia";
    await switchTab(initial);
  });
})();`;

function finalizeHtml(html) {
  return html
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/g, ''))
    .join('\n')
    .replace(/\n+$/g, '\n');
}

/**
 * @param {object} normalized
 * @param {{ sequence: string, flow: string, states: string|null }} mermaidSources
 * @param {string} dsCss
 * @param {string} contentSha
 */
export function renderFlowHtml(normalized, mermaidSources, dsCss, contentSha) {
  if (typeof dsCss !== 'string' || !dsCss.includes('--bg-canvas')) {
    throw new Error('dsCss must be the Atomic Skills design-system CSS (site/assets/ds.css)');
  }

  const hasStates = typeof mermaidSources.states === 'string' && mermaidSources.states.length > 0;
  const title = normalized.title || normalized.planSlug;
  const styleBlock = `${dsCss.trim()}\n\n${FLOW_CSS.trim()}`;
  const estadosTab = hasStates
    ? `          <button type="button" role="tab" id="tab-btn-estados" data-tab-btn="estados"
            aria-selected="false" aria-controls="panel-estados" tabindex="-1">
            Estados
          </button>`
    : '';
  const estadosPanel = hasStates
    ? `          <div class="diagram-panel" role="tabpanel" id="panel-estados" data-tab="estados" hidden
            aria-labelledby="tab-btn-estados" aria-hidden="true">
            <div class="diagram" aria-label="State diagram"></div>
          </div>`
    : '';

  const html = `<!DOCTYPE html>
<html lang="pt-BR" data-flow-slug="${escapeHtml(normalized.planSlug)}" data-flow-content-sha="${escapeHtml(contentSha)}" data-flow-schema="${escapeHtml(SCHEMA_VERSION)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="generator" content="atomic-skills render-flow">
<meta name="flow-schema" content="${escapeHtml(SCHEMA_VERSION)}">
<title>${escapeHtml(title)}</title>
<style>
${styleBlock}
</style>
</head>
<body>
<div class="flow-app">
  <header class="top">
    <div class="top-row">
      <div class="brand">
        <strong>${escapeHtml(title)}</strong>
        <span>${escapeHtml(normalized.scenario)}</span>
      </div>

      <nav class="tabs" role="tablist" aria-label="Diagram type">
        <button type="button" role="tab" id="tab-btn-sequencia" data-tab-btn="sequencia"
          class="is-active" aria-selected="true" aria-controls="panel-sequencia" tabindex="0">
          Sequência
        </button>
        <button type="button" role="tab" id="tab-btn-fluxo" data-tab-btn="fluxo"
          aria-selected="false" aria-controls="panel-fluxo" tabindex="-1">
          Fluxo
        </button>
${estadosTab}
      </nav>

      <div class="toolbar">
        <button type="button" id="btn-out" title="Zoom out">−</button>
        <span class="zoom" id="zoom-label">100%</span>
        <button type="button" id="btn-in" title="Zoom in">+</button>
        <button type="button" id="btn-fit" class="primary" title="Fit">Ajustar</button>
        <button type="button" id="btn-reset" title="100%">100%</button>
      </div>
    </div>

    <div class="hint-bar">
      <span class="val ok" id="val-status">flow</span>
      <span><strong id="tab-hint">Continuous sequence · XOR as alt/else · exclusive branches</strong></span>
      <span><strong>Ator:</strong> ${escapeHtml(normalized.actor)}</span>
      <span>Arrastar = pan · <kbd>Ctrl</kbd>+scroll = zoom</span>
    </div>
  </header>

  <div id="viewport" title="Drag to pan · Ctrl+scroll to zoom">
    <div id="sizer">
      <div id="stage">
        <div class="diagram-panel" role="tabpanel" id="panel-sequencia" data-tab="sequencia"
          aria-labelledby="tab-btn-sequencia" aria-hidden="false">
          <div class="diagram" aria-label="Sequence diagram"></div>
        </div>
        <div class="diagram-panel" role="tabpanel" id="panel-fluxo" data-tab="fluxo" hidden
          aria-labelledby="tab-btn-fluxo" aria-hidden="true">
          <div class="diagram" aria-label="Process flowchart"></div>
        </div>
${estadosPanel}
      </div>
    </div>
  </div>
</div>
<script type="application/json" id="flow-model">
${embedJson(normalized)}
</script>
<script type="application/json" id="flow-mermaid-sources">
${embedJson(mermaidSources)}
</script>
<script id="flow-mermaid-runtime">
${mermaidRuntime()}
</script>
<script>
${FLOW_JS}
</script>
</body>
</html>
`;

  return finalizeHtml(html);
}

/**
 * Validate → normalize → render. Throws on invalid data.
 * @param {unknown} raw
 * @param {string} dsCss
 * @param {object} [opts]
 */
export function buildFlowHtml(raw, dsCss, opts = {}) {
  void opts;
  assertValidFlow(raw);
  const normalized = normalizeFlow(raw);
  const view = graphView(normalized);
  const mermaid = {
    sequence: buildSequenceMermaid(view),
    flow: buildFlowMermaid(view),
    states: buildStatesMermaid(view),
  };
  const contentSha = contentFingerprint(normalized);
  return {
    html: renderFlowHtml(normalized, mermaid, dsCss, contentSha),
    normalized,
    contentSha,
    mermaid,
  };
}
