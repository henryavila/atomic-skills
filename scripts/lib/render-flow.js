/**
 * Pure renderer: flow MODEL object → self-contained HTML.
 *
 * Three surfaces: sequence (messages[]), BPM (graph nodes), machines (FSMs).
 * Determinism: same normalized input + same dsCss → byte-identical HTML.
 * No timestamps, random IDs, or absolute paths in the output.
 */

import { createHash } from 'node:crypto';
import { assertValidFlow, SCHEMA_VERSION } from './validate-flow.js';
import { escapeHtml } from './render-site.js';

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

function actorLabel(actors, id) {
  const found = actors.find((a) => a.id === id);
  return found?.label || id;
}

function collectSequence(normalized) {
  const items = [];
  const { nodes, entry, subgraphs } = normalized.graph;
  const walk = (nodeMap, start, scope) => {
    for (const nodeId of walkNodeIds(start, nodeMap)) {
      const node = nodeMap[nodeId];
      if (!node) continue;
      for (const message of node.messages) {
        items.push({
          ...message,
          nodeId,
          scope,
        });
      }
    }
  };
  walk(nodes, entry, 'graph');
  for (const [subId, sub] of Object.entries(subgraphs)) {
    walk(sub.nodes, sub.entry, subId);
  }
  return items;
}

/** Layout CSS — tokens from inlined ds.css only. Classes are fl-* (not a ds- prefix). */
export const FLOW_CSS = `/* flow layout — tokens from inlined ds.css only */
.fl-shell{max-width:1080px;margin:0 auto;padding:var(--space-12) var(--space-10) var(--space-24)}
.fl-header{display:flex;flex-direction:column;gap:var(--space-6);margin-bottom:var(--space-12);padding-bottom:var(--space-10);border-bottom:1px solid var(--border-default)}
.fl-eyebrow{font-family:var(--font-mono);font-size:var(--fs-xs);color:var(--fg-subtle);letter-spacing:var(--tracking-wide);text-transform:uppercase}
.fl-title{margin:0;font-size:var(--fs-3xl);font-weight:var(--fw-semibold);letter-spacing:var(--tracking-tight);line-height:var(--lh-tight)}
.fl-scenario{margin:0;color:var(--fg-muted);font-size:var(--fs-md);line-height:var(--lh-relaxed);max-width:68ch}
.fl-meta{display:flex;flex-wrap:wrap;gap:var(--space-4);align-items:center}
.fl-meta span{font-size:var(--fs-sm);color:var(--fg-subtle)}
.fl-meta strong{color:var(--fg-muted);font-weight:var(--fw-medium)}
.fl-toc{display:flex;flex-wrap:wrap;gap:var(--space-4);margin:var(--space-4) 0 0;padding:0;list-style:none}
.fl-toc a{display:inline-flex;align-items:center;height:30px;padding:0 var(--space-6);border-radius:var(--radius-pill);border:1px solid var(--border-default);background:var(--bg-elevated);color:var(--fg-muted);font-size:var(--fs-sm);font-weight:var(--fw-medium);text-decoration:none}
.fl-toc a:hover{color:var(--status-info);border-color:var(--status-info-line);text-decoration:none}
.fl-surface{margin:var(--space-12) 0;padding:var(--space-10);background:var(--bg-surface);border:1px solid var(--border-default);border-radius:var(--radius-xl);box-shadow:var(--shadow-sm)}
.fl-surface h2{margin:0 0 var(--space-8);font-size:var(--fs-xl);font-weight:var(--fw-semibold);letter-spacing:var(--tracking-tight)}
.fl-lede{margin:0 0 var(--space-8);color:var(--fg-muted);font-size:var(--fs-sm);line-height:var(--lh-relaxed)}
.fl-sequence{border-color:var(--status-info-line)}
.fl-bpm{border-color:var(--status-warning-line)}
.fl-machines{border-color:var(--status-success-line)}
.fl-messages,.fl-nodes,.fl-states,.fl-transitions,.fl-effects,.fl-branches{margin:0;padding:0;list-style:none}
.fl-msg{display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);gap:var(--space-3) var(--space-4);align-items:start;padding:var(--space-6) 0;border-top:1px solid var(--border-subtle)}
.fl-msg:first-child{border-top:0;padding-top:0}
.fl-msg-from,.fl-msg-to{font-family:var(--font-mono);font-size:var(--fs-xs);color:var(--status-info)}
.fl-msg-to{text-align:right}
.fl-msg-arrow{color:var(--fg-faint);font-size:var(--fs-sm)}
.fl-msg-text{grid-column:1/-1;margin:0;color:var(--fg-default);font-size:var(--fs-sm);line-height:var(--lh-snug)}
.fl-msg[data-async="true"] .fl-msg-text{color:var(--fg-muted)}
.fl-nodes{display:flex;flex-direction:column;gap:var(--space-6)}
.fl-node{position:relative;padding:var(--space-8);background:var(--bg-elevated);border:1px solid var(--border-default);border-radius:var(--radius-lg)}
.fl-node[data-node-type="xor"]{border-color:var(--status-warning-line)}
.fl-node[data-node-type="and"]{border-color:var(--status-info-line)}
.fl-node[data-node-type="end"]{border-color:var(--status-success-line)}
.fl-node[data-node-type="event"]{border-color:var(--status-error-line)}
.fl-node-head{display:flex;flex-wrap:wrap;align-items:center;gap:var(--space-4);margin-bottom:var(--space-3)}
.fl-node-type{display:inline-flex;align-items:center;height:22px;padding:0 var(--space-5);border-radius:var(--radius-pill);border:1px solid var(--border-default);background:var(--bg-sunken);color:var(--fg-muted);font-family:var(--font-mono);font-size:var(--fs-2xs);font-weight:var(--fw-medium);letter-spacing:var(--tracking-wide);text-transform:uppercase}
.fl-node-label{margin:0;font-size:var(--fs-md);font-weight:var(--fw-semibold)}
.fl-node-who,.fl-node-next,.fl-node-meta{margin:var(--space-2) 0 0;font-size:var(--fs-xs);color:var(--fg-subtle);font-family:var(--font-mono)}
.fl-branches{display:flex;flex-direction:column;gap:var(--space-3);margin-top:var(--space-4)}
.fl-branch{padding:var(--space-4) var(--space-5);border-radius:var(--radius-md);background:var(--bg-sunken);border:1px solid var(--border-subtle);font-size:var(--fs-sm)}
.fl-machine{margin:0 0 var(--space-10);padding:var(--space-8);background:var(--bg-elevated);border:1px solid var(--border-default);border-radius:var(--radius-lg)}
.fl-machine:last-child{margin-bottom:0}
.fl-machine h3{margin:0 0 var(--space-6);font-size:var(--fs-lg)}
.fl-states{display:flex;flex-wrap:wrap;gap:var(--space-3);margin-bottom:var(--space-6)}
.fl-state{display:inline-flex;align-items:center;height:26px;padding:0 var(--space-5);border-radius:var(--radius-pill);border:1px solid var(--border-default);background:var(--bg-sunken);font-size:var(--fs-xs)}
.fl-state[data-terminal="true"]{border-color:var(--status-success-line);color:var(--status-success)}
.fl-tr{padding:var(--space-6) 0;border-top:1px solid var(--border-subtle)}
.fl-tr-edge{font-family:var(--font-mono);font-size:var(--fs-xs);color:var(--fg-subtle)}
.fl-tr-label{display:block;margin:var(--space-2) 0;font-size:var(--fs-sm);font-weight:var(--fw-medium)}
.fl-effect{display:flex;flex-wrap:wrap;gap:var(--space-3);align-items:baseline;margin-top:var(--space-3);font-size:var(--fs-sm)}
.fl-kind{font-family:var(--font-mono);font-size:var(--fs-2xs);letter-spacing:var(--tracking-wide);text-transform:uppercase;color:var(--status-info)}
.fl-target{font-family:var(--font-mono);font-size:var(--fs-xs);color:var(--fg-muted)}
.fl-empty{margin:0;color:var(--fg-subtle);font-size:var(--fs-sm)}
.fl-footer{margin-top:var(--space-16);padding-top:var(--space-10);border-top:1px solid var(--border-default);font-size:var(--fs-xs);color:var(--fg-faint);font-family:var(--font-mono)}
@media (max-width:560px){.fl-shell{padding:var(--space-8) var(--space-6) var(--space-16)}.fl-title{font-size:var(--fs-2xl)}.fl-msg{grid-template-columns:1fr}}
`;

function finalizeHtml(html) {
  return html
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/g, ''))
    .join('\n')
    .replace(/\n+$/g, '\n');
}

function renderSequence(normalized) {
  const items = collectSequence(normalized);
  if (!items.length) {
    return `<p class="fl-empty">Nenhuma mensagem neste fluxo.</p>`;
  }
  return `<ol class="fl-messages">
${items
  .map((msg) => {
    const fromLabel = actorLabel(normalized.actors, msg.from);
    const toLabel = actorLabel(normalized.actors, msg.to);
    return `<li class="fl-msg" data-from="${escapeHtml(msg.from)}" data-to="${escapeHtml(msg.to)}" data-async="${msg.async ? 'true' : 'false'}" data-node="${escapeHtml(msg.nodeId)}">
  <span class="fl-msg-from">${escapeHtml(fromLabel)}</span>
  <span class="fl-msg-arrow" aria-hidden="true">→</span>
  <span class="fl-msg-to">${escapeHtml(toLabel)}</span>
  <p class="fl-msg-text">${escapeHtml(msg.text)}</p>
</li>`;
  })
  .join('\n')}
</ol>`;
}

function renderBpmNode(id, node) {
  const type = node.type;
  const label = node.label || node.question || id;
  const who = node.who
    ? `<p class="fl-node-who">${escapeHtml(node.who)}</p>`
    : '';
  let extra = '';
  if (NEXT_TYPES.has(type) && node.next) {
    extra += `<p class="fl-node-next" data-next="${escapeHtml(node.next)}">→ ${escapeHtml(node.next)}</p>`;
  }
  if (type === 'join' && node.of) {
    extra += `<p class="fl-node-meta">join of ${escapeHtml(node.of)}</p>`;
  }
  if (type === 'subprocess' && node.ref) {
    extra += `<p class="fl-node-meta">subprocess ${escapeHtml(node.ref)}</p>`;
  }
  if (type === 'event' && node.kind) {
    extra += `<p class="fl-node-meta">${escapeHtml(node.kind)}</p>`;
  }
  if (BRANCH_TYPES.has(type) && node.branches.length) {
    extra += `<ul class="fl-branches">
${node.branches
  .map(
    (branch) =>
      `<li class="fl-branch" data-branch-id="${escapeHtml(branch.id)}" data-next="${escapeHtml(branch.next)}"><strong>${escapeHtml(branch.label || branch.when || branch.id)}</strong> → ${escapeHtml(branch.next)}</li>`
  )
  .join('\n')}
</ul>`;
  }
  const nextAttr = node.next ? ` data-next="${escapeHtml(node.next)}"` : '';
  return `<li class="fl-node" data-node-id="${escapeHtml(id)}" data-node-type="${escapeHtml(type)}"${nextAttr}>
  <div class="fl-node-head">
    <span class="fl-node-type">${escapeHtml(type)}</span>
    <h3 class="fl-node-label">${escapeHtml(label)}</h3>
  </div>
  ${who}
  ${extra}
</li>`;
}

function renderBpm(normalized) {
  const { nodes, entry, subgraphs } = normalized.graph;
  const ids = walkNodeIds(entry, nodes);
  const main = ids
    .map((id) => renderBpmNode(id, nodes[id]))
    .join('\n');
  let subs = '';
  for (const [subId, sub] of Object.entries(subgraphs)) {
    const subIds = walkNodeIds(sub.entry, sub.nodes);
    subs += `<li class="fl-node" data-node-type="subprocess" data-subgraph="${escapeHtml(subId)}">
  <div class="fl-node-head"><span class="fl-node-type">subprocess</span><h3 class="fl-node-label">${escapeHtml(subId)}</h3></div>
  <ol class="fl-nodes">
${subIds.map((id) => renderBpmNode(id, sub.nodes[id])).join('\n')}
  </ol>
</li>`;
  }
  return `<ol class="fl-nodes">
${main}
${subs}
</ol>`;
}

function renderMachines(normalized) {
  if (!normalized.machines.length) {
    return `<p class="fl-empty">Nenhuma machine neste fluxo.</p>`;
  }
  return normalized.machines
    .map((machine) => {
      const stateIds = Object.keys(machine.nodes);
      const states = stateIds
        .map((id) => {
          const st = machine.nodes[id];
          return `<li class="fl-state" data-state-id="${escapeHtml(id)}" data-terminal="${st.terminal ? 'true' : 'false'}">${escapeHtml(st.label || id)}</li>`;
        })
        .join('');
      const transitions = machine.transitions
        .map((tr) => {
          const effects = tr.effects.length
            ? `<ul class="fl-effects">
${tr.effects
  .map(
    (ef) =>
      `<li class="fl-effect" data-effect-kind="${escapeHtml(ef.kind)}" data-effect-target="${escapeHtml(ef.target)}"><span class="fl-kind">${escapeHtml(ef.kind)}</span> <span class="fl-effect-label">${escapeHtml(ef.label)}</span> <span class="fl-target">${escapeHtml(ef.target)}</span></li>`
  )
  .join('\n')}
</ul>`
            : '';
          return `<li class="fl-tr" data-transition-id="${escapeHtml(tr.id)}" data-from="${escapeHtml(tr.from)}" data-to="${escapeHtml(tr.to)}">
  <span class="fl-tr-edge">${escapeHtml(tr.from)} → ${escapeHtml(tr.to)}</span>
  <span class="fl-tr-label">${escapeHtml(tr.label)}</span>
  ${effects}
</li>`;
        })
        .join('\n');
      return `<article class="fl-machine" data-machine-id="${escapeHtml(machine.id)}">
  <h3>${escapeHtml(machine.label || machine.id)}</h3>
  <ol class="fl-states">${states}</ol>
  <ol class="fl-transitions">
${transitions}
  </ol>
</article>`;
    })
    .join('\n');
}

/**
 * @param {object} normalized
 * @param {string} dsCss
 * @returns {string}
 */
export function renderFlowHtml(normalized, dsCss) {
  const css = typeof dsCss === 'string' ? dsCss : '';
  const fp = contentFingerprint(normalized);
  const styleBlock = css.trim()
    ? `${css.trim()}\n\n${FLOW_CSS.trim()}`
    : FLOW_CSS.trim();
  const title = `Fluxo — ${normalized.title}`;

  const html = `<!DOCTYPE html>
<html lang="pt-BR" data-fl-slug="${escapeHtml(normalized.planSlug)}" data-fl-content-sha="${escapeHtml(fp)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
${styleBlock}
</style>
</head>
<body>
<div class="fl-shell">
  <header class="fl-header">
    <p class="fl-eyebrow">Fluxo operacional · 3 camadas</p>
    <h1 class="fl-title">${escapeHtml(normalized.title)}</h1>
    <p class="fl-scenario">${escapeHtml(normalized.scenario)}</p>
    <div class="fl-meta">
      <span><strong>Ator:</strong> ${escapeHtml(normalized.actor)}</span>
      <span><strong>Plano:</strong> ${escapeHtml(normalized.planSlug)}</span>
    </div>
    <nav class="fl-toc" aria-label="Camadas do fluxo">
      <a href="#fl-sequence">Sequência</a>
      <a href="#fl-bpm">Fluxo BPM</a>
      <a href="#fl-machines">Máquinas</a>
    </nav>
  </header>
  <section id="fl-sequence" class="fl-surface fl-sequence" aria-labelledby="fl-sequence-title">
    <h2 id="fl-sequence-title">Sequência</h2>
    <p class="fl-lede">Conversa (messages) entre atores. Pode narrar interface.</p>
    ${renderSequence(normalized)}
  </section>
  <section id="fl-bpm" class="fl-surface fl-bpm" aria-labelledby="fl-bpm-title">
    <h2 id="fl-bpm-title">Fluxo BPM</h2>
    <p class="fl-lede">Atividades de negócio: activity, xor, and, join, subprocess, event, end.</p>
    ${renderBpm(normalized)}
  </section>
  <section id="fl-machines" class="fl-surface fl-machines" aria-labelledby="fl-machines-title">
    <h2 id="fl-machines-title">Máquinas</h2>
    <p class="fl-lede">Estados e transições. Cada efeito mostra kind, label e target.</p>
    ${renderMachines(normalized)}
  </section>
  <footer class="fl-footer">
    content-sha ${escapeHtml(fp.slice(0, 16))} · schema ${escapeHtml(SCHEMA_VERSION)}
  </footer>
</div>
</body>
</html>
`;

  return finalizeHtml(html);
}

/**
 * Validate → normalize → render. Throws on invalid data.
 * @param {unknown} raw
 * @param {string} dsCss
 */
export function buildFlowHtml(raw, dsCss) {
  const normalized = normalizeFlow(raw);
  return {
    html: renderFlowHtml(normalized, dsCss),
    normalized,
    contentSha: contentFingerprint(normalized),
  };
}

export { SCHEMA_VERSION };
