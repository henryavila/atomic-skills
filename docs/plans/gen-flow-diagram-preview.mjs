#!/usr/bin/env node
/**
 * Preview = this script (basis of the engine). PDTI JSON is input data only.
 * Full-page chrome (grid auto/1fr + sizer/stage). Zoom resizes SVG
 * width/height (vectors stay sharp). No CSS transform scale.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeFlow } from '../../scripts/lib/render-flow.js';
import {
  FLOW_ZOOM_KEY_PREFIX,
  FLOW_ZOOM_MAX,
  FLOW_ZOOM_MIN,
} from '../../scripts/lib/flow-zoom.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const SRC = join(ROOT, 'docs/design/project-flow/dogfood/fluxo-sugestao.json');
const OUT = join(ROOT, 'docs/plans/2026-08-14-flow-diagram-engine-style-preview.html');
const PDF_LIB_SRC = readFileSync(join(ROOT, 'scripts/lib/flow-pdf.js'), 'utf8').replaceAll(
  'export ',
  '',
);

const ACTOR_W = 196;
const ACTOR_BOX_W = 168;
const ACTOR_BOX_H = 26;
const STICK_PAD = 8;
const ROW = 36;
const GUTTER = 52;
const BLOCK_LEAD = 18;

function actorChip(id, label, x, y) {
  return `<g data-actor-id="${esc(id)}">
        <rect class="actor-box" x="${x - ACTOR_BOX_W / 2}" y="${y}" width="${ACTOR_BOX_W}" height="${ACTOR_BOX_H}" rx="8"/>
        <text class="actor-label" x="${x}" y="${y + 18}" text-anchor="middle">${esc(label)}</text>
      </g>`;
}

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function wrap(text, max = 34) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (next.length > max && cur) {
      lines.push(cur);
      cur = w;
    } else cur = next;
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 2);
}

function walkSteps(normalized) {
  const nodes = normalized.graph.nodes;
  function collectChain(startId, ancestors, depth) {
    const chain = [];
    if (depth > 12) return chain;
    const local = new Set(ancestors);
    let cur = startId;
    let guard = 0;
    while (cur && guard++ < 40) {
      if (local.has(cur)) {
        chain.push({ kind: 'loop-ref', nodeId: cur, node: nodes[cur] });
        break;
      }
      const node = nodes[cur];
      if (!node) break;
      local.add(cur);
      if (node.type === 'end') {
        chain.push({ kind: 'end', nodeId: cur, node });
        break;
      }
      if (node.type === 'xor' || node.type === 'and') {
        chain.push({
          kind: node.type,
          nodeId: cur,
          node,
          branchPanels: (node.branches || []).map((branch) => ({
            branch,
            chain: collectChain(branch.next, new Set(local), depth + 1),
          })),
        });
        break;
      }
      chain.push({ kind: node.type, nodeId: cur, node });
      cur = node.next;
    }
    return chain;
  }
  return collectChain(normalized.graph.entry, new Set(), 0);
}

function drawSequence(normalized, steps) {
  const actors = normalized.actors;
  const cx = (id) => {
    const i = actors.findIndex((a) => a.id === id);
    return GUTTER + ACTOR_W / 2 + (i < 0 ? 0 : i) * ACTOR_W;
  };
  const width = GUTTER + ACTOR_W * actors.length + 28;
  const rows = [];
  let n = 0;
  const seenXor = new Set();
  const visit = (list, depth) => {
    for (const s of list) {
      if (s.kind === 'activity' || s.kind === 'event' || s.kind === 'subprocess') {
        for (const m of s.node.messages || []) {
          rows.push({ type: 'msg', n: ++n, from: m.from, to: m.to, text: m.text, async: m.async, depth });
        }
      } else if (s.kind === 'xor' || s.kind === 'and') {
        if (seenXor.has(s.nodeId)) {
          rows.push({
            type: 'join',
            text: `→ ${s.node.question || s.node.label}`,
            depth,
          });
          continue;
        }
        seenXor.add(s.nodeId);
        const start = rows.length;
        rows.push({
          type: 'xor-q',
          xorId: s.nodeId,
          question: s.node.question || s.node.label,
          depth,
        });
        for (const p of s.branchPanels) {
          rows.push({ type: 'branch', xorId: s.nodeId, label: p.branch.label, depth });
          visit(p.chain, depth + 1);
        }
        rows[start].end = rows.length - 1;
      } else if (s.kind === 'loop-ref') {
        rows.push({
          type: 'loop',
          xorId: s.nodeId,
          label: s.node?.question || s.node?.label || s.nodeId,
          depth,
        });
      }
    }
  };
  visit(steps, 0);

  let y = 78;
  for (const r of rows) {
    if (r.type === 'loop') {
      r.y = y;
      continue;
    }
    if (r.type === 'xor-q' || r.type === 'branch' || r.type === 'join') {
      y += BLOCK_LEAD;
    }
    r.y = y;
    y += r.type === 'msg' ? ROW : 30;
  }
  const bodyBottom = y + 16;
  const height = bodyBottom + 44;

  const xorQs = rows.filter((r) => r.type === 'xor-q');
  const washes = xorQs
    .filter((r) => r.depth === 0)
    .map((r) => {
      const y0 = r.y - BLOCK_LEAD;
      const y1 = rows[r.end].y + 18;
      const inset = 8;
      return `<rect class="xor-wash" x="${inset}" y="${y0}" width="${width - inset * 2}" height="${y1 - y0}" rx="10"/>`;
    })
    .join('\n');
  const rails = xorQs
    .map((r) => {
      const y0 = r.y - 16;
      const y1 = rows[r.end].y + 18;
      const railX = 22 + r.depth * 14;
      return `<g data-xor-rail="${esc(r.xorId)}">
        <line class="xor-rail" x1="${railX}" y1="${y0 + 8}" x2="${railX}" y2="${y1 - 8}"/>
        <text class="xor-q" x="${railX + 16}" y="${r.y + 4}">◇ ${esc(r.question)}</text>
      </g>`;
    })
    .join('\n');

  const lifelines = actors
    .map((a) => {
      const x = cx(a.id);
      return `<g data-actor-id="${esc(a.id)}">
        <line class="lifeline" data-lifeline="${esc(a.id)}" x1="${x}" y1="50" x2="${x}" y2="${bodyBottom}"/>
        <line class="life-hit" data-actor-label="${esc(a.label)}" x1="${x}" y1="50" x2="${x}" y2="${bodyBottom}"/>
      </g>`;
    })
    .join('\n');

  const actorFeet = actors.map((a) => actorChip(a.id, a.label, cx(a.id), bodyBottom + 8)).join('\n');

  const stickH = STICK_PAD + ACTOR_BOX_H + STICK_PAD;
  const actorStick = `<g data-actor-stick>
    <rect class="actor-stick-bg" x="0" y="0" width="${width}" height="${stickH}"/>
    <line class="actor-stick-rule" x1="0" y1="${stickH - 0.5}" x2="${width}" y2="${stickH - 0.5}"/>
    ${actors.map((a) => actorChip(a.id, a.label, cx(a.id), STICK_PAD)).join('\n')}
  </g>`;

  const body = rows
    .map((r) => {
      if (r.type === 'msg') {
        const x1 = cx(r.from);
        const x2 = cx(r.to);
        const self = r.from === r.to;
        if (self) {
          const lines = wrap(r.text, 28);
          return `<g data-from="${esc(r.from)}" data-to="${esc(r.to)}">
          <circle cx="${x1}" cy="${r.y}" r="3" class="arrow-head"/>
          ${lines.map((ln, i) => `<text class="msg" x="${x1 + 10}" y="${r.y + 4 + i * 12}">${esc(ln)}</text>`).join('')}
        </g>`;
        }
        const dir = x2 >= x1 ? 1 : -1;
        const xStart = x1 + 8 * dir;
        const xEnd = x2 - 8 * dir;
        const lines = wrap(r.text, 32);
        const labelY = r.y - 8 - (lines.length - 1) * 12;
        const labels = lines
          .map(
            (ln, i) =>
              `<text class="msg" x="${(xStart + xEnd) / 2}" y="${labelY + i * 12}" text-anchor="middle">${esc(ln)}</text>`,
          )
          .join('');
        return `<g data-from="${esc(r.from)}" data-to="${esc(r.to)}">
          <line class="arrow${r.async ? ' async' : ''}" x1="${xStart}" y1="${r.y}" x2="${xEnd - 8 * dir}" y2="${r.y}"/>
          <polygon class="arrow-head" points="${xEnd},${r.y} ${xEnd - 8 * dir},${r.y - 4} ${xEnd - 8 * dir},${r.y + 4}"/>
          ${labels}
        </g>`;
      }
      if (r.type === 'branch') {
        const railX = 22 + r.depth * 14;
        const pw = Math.max(72, r.label.length * 7 + 20);
        return `<g>
          <line class="hair" x1="${railX}" y1="${r.y}" x2="${railX + 18}" y2="${r.y}"/>
          <rect class="pill" x="${railX + 18}" y="${r.y - 12}" width="${pw}" height="24" rx="12"/>
          <text class="pill-t" data-branch-label="${esc(r.label)}" x="${railX + 18 + pw / 2}" y="${r.y + 4}" text-anchor="middle">${esc(r.label)}</text>
        </g>`;
      }
      if (r.type === 'join') {
        const railX = 22 + r.depth * 14;
        const pw = Math.max(88, r.text.length * 6.2 + 18);
        return `<g data-join-ref="1">
          <line class="hair" x1="${railX}" y1="${r.y}" x2="${railX + 18}" y2="${r.y}"/>
          <rect class="pill" x="${railX + 18}" y="${r.y - 12}" width="${pw}" height="24" rx="12"/>
          <text class="pill-t" x="${railX + 18 + pw / 2}" y="${r.y + 4}" text-anchor="middle">${esc(r.text)}</text>
        </g>`;
      }
      if (r.type === 'loop') {
        const railX = 22 + Math.max(0, r.depth - 1) * 14;
        const target = rows.find((q) => q.type === 'xor-q' && q.xorId === r.xorId);
        const yTop = target ? target.y + 10 : r.y - 48;
        const prev = [...rows].reverse().find((p) => p.y < r.y && p.type === 'msg');
        const xFrom = prev ? cx(prev.to || prev.from) : railX + 96;
        const yMsg = prev ? prev.y : r.y;
        const xTip = railX + 18;
        const yTip = target ? target.y + 4 : yTop + 4;
        const xMid = Math.min(xFrom, xTip + 120) - 36;
        return `<g data-loop-ref="${esc(r.xorId)}">
          <path class="loop-arc" d="M${xFrom} ${yMsg} C${xMid} ${yMsg + 36}, ${xTip + 10} ${yTip + 56}, ${xTip} ${yTip + 10}"/>
          <polygon class="loop-head" points="${xTip},${yTip} ${xTip - 5},${yTip + 10} ${xTip + 6},${yTip + 8}"/>
        </g>`;
      }
      return '';
    })
    .join('\n');

  return `<svg class="diagram" id="seq-svg" data-surface="sequence" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" role="img">
    <title>Diagrama de sequência — PDTI</title>
    <desc>${esc(normalized.scenario)}</desc>
    ${washes}
    ${lifelines}
    ${rails}
    ${body}
    ${actorFeet}
    ${actorStick}
  </svg>`;
}

function drawBpm(normalized) {
  const nodes = normalized.graph.nodes;
  const NW = 200;
  const NH = 48;
  const RANK = 78;
  const COL = 236;
  const placed = new Map();
  const edges = [];
  let minX = 0;
  let maxX = 0;
  let maxY = 0;

  function place(id, x, y) {
    if (!id || !nodes[id]) return null;
    if (placed.has(id)) return placed.get(id);
    const node = nodes[id];
    const box = { id, type: node.type, label: node.label, who: node.who, x, y };
    placed.set(id, box);
    minX = Math.min(minX, x - 120);
    maxX = Math.max(maxX, x + 120);
    maxY = Math.max(maxY, y + 80);

    if (node.type === 'end') return box;

    if (node.type === 'xor' || node.type === 'and') {
      const br = node.branches || [];
      const n = br.length;
      br.forEach((b, i) => {
        const kx = x + (i - (n - 1) / 2) * COL;
        const child = place(b.next, kx, y + RANK + 16);
        if (child) edges.push({ from: id, to: child.id, label: b.label });
      });
      return box;
    }

    if (node.next) {
      if (placed.has(node.next)) {
        edges.push({ from: id, to: node.next, label: '' });
      } else {
        const child = place(node.next, x, y + RANK);
        if (child) edges.push({ from: id, to: child.id, label: '' });
      }
    }
    return box;
  }

  place(normalized.graph.entry, 420, 40);
  const width = Math.max(840, maxX - minX + 80);
  const height = maxY + 40;
  const dx = 40 - minX;

  const nodeSvg = [...placed.values()]
    .map((b) => {
      const x = b.x + dx;
      const y = b.y;
      if (b.type === 'xor') {
        const pts = `${x},${y} ${x + 108},${y + 36} ${x},${y + 72} ${x - 108},${y + 36}`;
        const lines = wrap(b.label.replace(/\?$/, '') + '?', 18);
        const ty = y + 32 - (lines.length - 1) * 7;
        return `<g data-node-id="${esc(b.id)}" data-shape="diamond">
          <polygon class="diamond" points="${pts}"/>
          ${lines.map((ln, i) => `<text class="xor-t" x="${x}" y="${ty + i * 14}" text-anchor="middle">${esc(ln)}</text>`).join('')}
          ${b.who ? `<text class="who" x="${x}" y="${y - 6}" text-anchor="middle">${esc(b.who)}</text>` : ''}
        </g>`;
      }
      if (b.type === 'end') {
        const ok = /funil/.test(b.label) && !/sem/.test(b.label);
        const cls = ok ? 'end-ok' : 'end-bad';
        return `<g data-node-id="${esc(b.id)}" data-shape="circle">
          <circle class="${cls}" cx="${x}" cy="${y + 12}" r="10"/>
          ${ok ? '' : `<circle class="end-hole" cx="${x}" cy="${y + 12}" r="5"/>`}
          <text class="end-t" x="${x}" y="${y + 36}" text-anchor="middle">${esc(b.label)}</text>
        </g>`;
      }
      const lines = wrap(b.label, 26);
      return `<g data-node-id="${esc(b.id)}" data-shape="rect" data-next="${esc(nodes[b.id].next || '')}">
        <rect class="act" x="${x - NW / 2}" y="${y}" width="${NW}" height="${NH}" rx="8"/>
        ${lines.map((ln, i) => `<text class="act-t" x="${x}" y="${y + 20 + i * 14}" text-anchor="middle">${esc(ln)}</text>`).join('')}
      </g>`;
    })
    .join('\n');

  const edgeSvg = edges
    .map((e) => {
      const a = placed.get(e.from);
      const b = placed.get(e.to);
      if (!a || !b) return '';
      const x1 = a.x + dx;
      const y1 = a.type === 'xor' ? a.y + 72 : a.type === 'end' ? a.y + 12 : a.y + NH;
      const x2 = b.x + dx;
      const y2 = b.type === 'xor' ? b.y + 36 : b.y;
      if (b.y + 8 < a.y) {
        const side = Math.min(x1, x2) - 70;
        return `<g>
          <path class="edge" d="M${x1} ${y1} C${side} ${y1}, ${side} ${y2}, ${x2 - 108} ${y2}"/>
          <text class="loop" x="${side + 8}" y="${(y1 + y2) / 2}">↺</text>
        </g>`;
      }
      const mx = (x1 + x2) / 2;
      const my = (y1 + y2) / 2;
      return `<g>
        <path class="edge" d="M${x1} ${y1} L${x2} ${y2}"/>
        ${e.label ? `<text class="edge-t" x="${mx + 6}" y="${my - 4}">${esc(e.label)}</text>` : ''}
      </g>`;
    })
    .join('\n');

  return `<svg class="diagram" id="bpm-svg" data-surface="bpm" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" role="img">
    <title>Diagrama de processo — PDTI</title>
    ${edgeSvg}
    ${nodeSvg}
  </svg>`;
}

function drawMachines(normalized) {
  const m = normalized.machines[0];
  const ids = Object.keys(m.nodes);
  const W = 148;
  const H = 32;
  const gap = 88;
  const x0 = 40;
  const y0 = 88;
  const pos = {
    rascunho: { x: x0, y: y0 },
    pendente: { x: x0 + W + gap, y: y0 },
    ativo: { x: x0 + 2 * (W + gap), y: y0 },
    recusada: { x: x0 + W + gap, y: y0 + 130 },
  };
  for (const id of ids) {
    if (!pos[id]) pos[id] = { x: x0 + ids.indexOf(id) * (W + gap), y: y0 };
  }

  const states = ids
    .map((id) => {
      const n = m.nodes[id];
      const p = pos[id];
      const entry = m.entry === id;
      const term = n.terminal === true;
      const cls = `st${entry ? ' entry' : ''}${term ? ' term' : ''}`;
      const inner = term
        ? `<rect class="st term" x="${p.x + 3}" y="${p.y + 3}" width="${W - 6}" height="${H - 6}" rx="13" fill="none"/>`
        : '';
      return `<g data-state-id="${esc(id)}">
        <rect class="${cls}" x="${p.x}" y="${p.y}" width="${W}" height="${H}" rx="16"/>
        ${inner}
        <text class="st-t" x="${p.x + W / 2}" y="${p.y + 21}" text-anchor="middle">${esc(n.label)}</text>
      </g>`;
    })
    .join('\n');

  const edgeSvg = m.transitions
    .map((t) => {
      const a = pos[t.from];
      const b = pos[t.to];
      if (!a || !b) return '';
      const fx = t.effects || [];
      const fxLine = fx
        .map((e) => `${e.kind} · ${e.label} → ${e.target}`)
        .join(' · ');
      if (t.from === t.to) {
        const up = t.id === 'T_draft_loop' || t.id === 'T_skip_edit';
        const side = t.id === 'T_skip_edit' ? 1 : -1;
        const midY = up ? a.y - 36 : a.y + H + 40;
        const xL = a.x + (side < 0 ? 16 : W - 16);
        const d = `M${a.x + W / 2 - 16} ${up ? a.y : a.y + H} C${xL - 40 * side} ${midY}, ${xL + 40 * side} ${midY}, ${a.x + W / 2 + 16} ${up ? a.y : a.y + H}`;
        return `<g>
          <path class="edge" d="${d}" fill="none"/>
          <text class="edge-t" x="${a.x + W / 2}" y="${midY - 4}" text-anchor="middle">${esc(t.label)}</text>
          ${fxLine ? `<text class="fx" x="${a.x + W / 2}" y="${midY + 10}" text-anchor="middle">${esc(fxLine)}</text>` : ''}
        </g>`;
      }
      const selfDown = b.y > a.y;
      if (selfDown) {
        const x = a.x - 8;
        return `<g>
          <path class="edge" d="M${a.x} ${a.y + H / 2} C${x - 36} ${a.y + H / 2}, ${x - 36} ${b.y + H / 2}, ${b.x} ${b.y + H / 2}" fill="none"/>
          <text class="edge-t" x="${x - 40}" y="${(a.y + b.y) / 2 + 10}" text-anchor="end">${esc(t.label)}</text>
          ${fxLine ? `<text class="fx" x="${x - 40}" y="${(a.y + b.y) / 2 + 22}" text-anchor="end">${esc(fxLine)}</text>` : ''}
        </g>`;
      }
      const x1 = a.x + W;
      const y1 = a.y + H / 2;
      const x2 = b.x;
      const y2 = b.y + H / 2;
      const midX = (x1 + x2) / 2;
      return `<g>
        <path class="edge" d="M${x1} ${y1} L${x2} ${y2}" fill="none"/>
        <text class="edge-t" x="${midX}" y="${y1 - 14}" text-anchor="middle">${esc(t.label)}</text>
        ${fxLine ? `<text class="fx" x="${midX}" y="${y1 - 2}" text-anchor="middle">${esc(fxLine)}</text>` : ''}
      </g>`;
    })
    .join('\n');

  return `<svg class="diagram" id="mach-svg" data-surface="machines" width="780" height="280" viewBox="0 0 780 280" xmlns="http://www.w3.org/2000/svg" role="img">
    <title>Máquina de estados — ${esc(m.label)}</title>
    <text class="mach-title" x="16" y="22">${esc(m.label)}</text>
    <g data-machine-id="${esc(m.id)}">
      ${edgeSvg}
      ${states}
    </g>
  </svg>`;
}

function pageHtml({ title, scenario, actor, planSlug, seq, bpm, mach }) {
  return `<!DOCTYPE html>
<html lang="pt-BR" data-fl-slug="${esc(planSlug)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<script>(function(){var K="as-color-scheme";function read(){try{var v=localStorage.getItem(K);return v==="light"||v==="dark"?v:"system"}catch(e){return"system"}}function apply(mode){var r=document.documentElement;if(mode==="light"||mode==="dark")r.setAttribute("data-theme",mode);else r.removeAttribute("data-theme");document.querySelectorAll("[data-theme-set]").forEach(function(b){b.setAttribute("aria-checked",String(b.getAttribute("data-theme-set")===mode))})}apply(read());document.addEventListener("click",function(e){var b=e.target&&e.target.closest&&e.target.closest("[data-theme-set]");if(!b)return;var mode=b.getAttribute("data-theme-set");try{localStorage.setItem(K,mode)}catch(err){}apply(mode)});document.addEventListener("DOMContentLoaded",function(){apply(read())})})();</script>
<style>
:root {
  color-scheme: dark;
  --bg-sunken: #07090d;
  --bg-canvas: #0a0d12;
  --bg-surface: #12161d;
  --bg-elevated: #1a1f28;
  --bg-overlay: #232936;
  --border-subtle: #1a2029;
  --border-default: #262d38;
  --border-strong: #3d4656;
  --fg-default: #e9eef5;
  --fg-muted: #98a1ad;
  --fg-subtle: #6b7585;
  --fg-faint: #424a5a;
  --status-success: #4cc28e;
  --status-warning: #e0a44a;
  --status-error: #ff5c5c;
  --status-info: #5fb1ff;
  --status-success-bg: color-mix(in srgb, var(--status-success) 14%, var(--bg-surface));
  --status-warning-bg: color-mix(in srgb, var(--status-warning) 14%, var(--bg-surface));
  --status-error-bg: color-mix(in srgb, var(--status-error) 16%, var(--bg-surface));
  --status-info-bg: color-mix(in srgb, var(--status-info) 14%, var(--bg-surface));
  --status-success-line: color-mix(in srgb, var(--status-success) 42%, var(--border-default));
  --status-warning-line: color-mix(in srgb, var(--status-warning) 42%, var(--border-default));
  --status-error-line: color-mix(in srgb, var(--status-error) 48%, var(--border-default));
  --status-info-line: color-mix(in srgb, var(--status-info) 42%, var(--border-default));
  --font-sans: "Inter", ui-sans-serif, system-ui, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, monospace;
  --fs-2xs: 10px; --fs-xs: 11px; --fs-sm: 12px; --fs-md: 14px;
  --fw-medium: 500; --fw-semibold: 600;
  --space-3: 6px; --space-4: 8px; --space-6: 12px; --space-8: 16px;
  --radius-sm: 4px; --radius-md: 6px; --radius-lg: 8px; --radius-xl: 12px; --radius-pill: 999px;
  --tracking-tight: -0.015em; --tracking-wide: 0.04em;
  --shadow-sm: 0 2px 4px -2px rgba(0,0,0,.5), inset 0 1px 0 rgba(255,255,255,.045);
  --shadow-focus: 0 0 0 2px var(--bg-canvas), 0 0 0 4px #88c4ff;
  --actor-fill: var(--bg-elevated);
  --actor-stroke: var(--border-default);
  --actor-fg: var(--fg-default);
  --life: var(--fg-faint);
  --arrow: var(--fg-muted);
  --msg: var(--fg-default);
  --xor-wash: color-mix(in srgb, var(--bg-elevated) 18%, transparent);
  --xor-rail: var(--status-warning-line);
  --pill-fill: var(--bg-sunken);
  --pill-stroke: var(--status-warning-line);
  --pill-fg: var(--status-warning);
  --act-fill: var(--bg-elevated);
  --act-stroke: var(--border-default);
  --act-fg: var(--fg-default);
  --xor-fill: color-mix(in srgb, var(--status-warning) 10%, var(--bg-surface));
  --xor-edge: var(--status-warning-line);
  --end-fill: var(--status-success);
  --end-stroke: var(--status-success);
  --end-bad-fill: var(--status-error);
  --st-fill: var(--bg-sunken);
  --st-stroke: var(--border-default);
  --st-entry-stroke: var(--status-info);
  --st-term-stroke: var(--status-success);
  --edge: var(--fg-faint);
  --node-sw: 1.25;
}
@media (prefers-color-scheme: light) {
  html:not([data-theme="dark"]) {
    color-scheme: light;
    --bg-sunken: #e8edf4;
    --bg-canvas: #f4f6fa;
    --bg-surface: #ffffff;
    --bg-elevated: #eef2f7;
    --bg-overlay: #e2e8f0;
    --border-subtle: #e8edf3;
    --border-default: #d5dce6;
    --border-strong: #b8c2d0;
    --fg-default: #12161d;
    --fg-muted: #4a5565;
    --fg-subtle: #6b7585;
    --fg-faint: #98a1ad;
    --shadow-sm: 0 1px 2px rgba(15,23,42,.06), 0 1px 3px rgba(15,23,42,.04);
    --shadow-focus: 0 0 0 2px var(--bg-canvas), 0 0 0 4px #1565c0;
  }
}
html[data-theme="light"] {
  color-scheme: light;
  --bg-sunken: #e8edf4;
  --bg-canvas: #f4f6fa;
  --bg-surface: #ffffff;
  --bg-elevated: #eef2f7;
  --bg-overlay: #e2e8f0;
  --border-subtle: #e8edf3;
  --border-default: #d5dce6;
  --border-strong: #b8c2d0;
  --fg-default: #12161d;
  --fg-muted: #4a5565;
  --fg-subtle: #6b7585;
  --fg-faint: #98a1ad;
  --shadow-sm: 0 1px 2px rgba(15,23,42,.06), 0 1px 3px rgba(15,23,42,.04);
  --shadow-focus: 0 0 0 2px var(--bg-canvas), 0 0 0 4px #1565c0;
}
html[data-theme="dark"] { color-scheme: dark; }

*, *::before, *::after { box-sizing: border-box; }
html, body {
  margin: 0; height: 100%; overflow: hidden;
  background: var(--bg-canvas); color: var(--fg-default);
  font-family: var(--font-sans);
}
.app { display: grid; grid-template-rows: auto 1fr; height: 100%; min-height: 100%; }

.top {
  z-index: 20;
  background: color-mix(in srgb, var(--bg-canvas) 92%, transparent);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--border-default);
  padding: 10px 16px 8px;
  display: flex; flex-direction: column; gap: 8px;
}
.top-row {
  display: flex; flex-wrap: wrap; gap: 10px 16px;
  align-items: center; justify-content: space-between;
}
.brand { min-width: 0; flex: 1 1 220px; }
.brand .fl-title {
  margin: 0; font-size: 15px; font-weight: 600;
  letter-spacing: var(--tracking-tight); line-height: 1.25;
}
.brand .fl-scenario {
  margin: 2px 0 0; font-size: 12px; color: var(--fg-muted);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 72ch;
}
.fl-toc { display: flex; flex-wrap: wrap; gap: 6px; margin: 0; padding: 0; }
.fl-toc button {
  appearance: none; display: inline-flex; align-items: center; height: 30px; padding: 0 12px;
  border-radius: var(--radius-pill); border: 1px solid var(--border-default); background: var(--bg-elevated);
  color: var(--fg-muted); font: 500 12px var(--font-sans); cursor: pointer;
}
.fl-toc button[aria-selected="true"] { color: var(--bg-canvas); background: var(--fg-default); border-color: var(--fg-default); }
.fl-toc button:focus-visible, .toolbar button:focus-visible, .theme-switch button:focus-visible { outline: none; box-shadow: var(--shadow-focus); }
.toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.toolbar button {
  appearance: none; height: 28px; min-width: 28px; padding: 0 8px; border-radius: 6px;
  border: 1px solid var(--border-default); background: var(--bg-surface); color: var(--fg-muted);
  font: 600 12px var(--font-sans); cursor: pointer;
}
.toolbar button.primary { background: var(--fg-default); color: var(--bg-canvas); border-color: var(--fg-default); }
.toolbar .zoom { font: 700 12px var(--font-mono); color: var(--fg-subtle); padding: 0 6px; min-width: 3.2rem; text-align: center; }
.theme-switch {
  display: inline-flex; border: 1px solid var(--border-default); border-radius: var(--radius-pill);
  background: var(--bg-elevated); overflow: hidden; margin-left: 4px;
}
.theme-switch button {
  appearance: none; border: 0; background: transparent; color: var(--fg-muted);
  font: 500 11px var(--font-sans); height: 28px; padding: 0 10px; cursor: pointer;
}
.theme-switch button[aria-checked="true"] { background: var(--bg-surface); color: var(--fg-default); }
.hint-bar {
  font-size: 12px; color: var(--fg-subtle);
  display: flex; flex-wrap: wrap; gap: 6px 14px; align-items: center;
}
.hint-bar .val {
  font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: var(--radius-pill);
  border: 1px solid var(--border-default); color: var(--fg-muted); background: var(--bg-elevated);
}
.hint-bar kbd {
  font: 600 11px var(--font-mono); background: var(--bg-sunken);
  border: 1px solid var(--border-default); border-radius: 4px; padding: 0 5px;
}
.hint-bar .fl-meta { display: inline-flex; flex-wrap: wrap; gap: 10px; }
.hint-bar .fl-meta span { font-size: 12px; color: var(--fg-subtle); }
.hint-bar .fl-meta strong { color: var(--fg-muted); font-weight: 500; }

#fl-viewport {
  position: relative; overflow: auto; overscroll-behavior: contain;
  min-height: 0;
  background:
    radial-gradient(circle at 1px 1px, var(--border-default) 1px, transparent 0) 0 0 / 22px 22px,
    var(--bg-sunken);
  cursor: grab; scrollbar-gutter: stable both-edges;
}
#fl-viewport.is-panning { cursor: grabbing; user-select: none; }
#fl-sizer { position: relative; min-width: 100%; min-height: 100%; }
#fl-stage {
  position: absolute; top: 0; left: 0;
  padding: 40px;
}
.diagram-panel { display: inline-block; }
.diagram-panel[hidden] { display: none !important; }
.sheet {
  display: inline-block;
  background: var(--bg-surface);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-sm);
  padding: 18px 20px;
}
svg.diagram {
  display: block; max-width: none; font-family: var(--font-sans);
  shape-rendering: geometricPrecision; text-rendering: geometricPrecision;
}
svg.diagram text { fill: var(--fg-default); }
.actor-box { fill: var(--actor-fill); stroke: var(--actor-stroke); stroke-width: 1; }
.actor-label { fill: var(--actor-fg); font-size: 11px; font-weight: 600; }
.actor-stick-bg { fill: var(--bg-surface); }
.actor-stick-rule { stroke: var(--border-default); stroke-width: 1; }
.lifeline { stroke: var(--life); stroke-width: 1; stroke-dasharray: 3 5; pointer-events: none; }
.life-hit { stroke: transparent; stroke-width: 20; fill: none; }
#actor-tip {
  position: fixed; z-index: 40; pointer-events: none;
  background: var(--bg-elevated); color: var(--fg-default);
  border: 1px solid var(--border-default); border-radius: 6px;
  padding: 3px 8px; font: 600 12px var(--font-sans);
  box-shadow: var(--shadow-sm);
}
#actor-tip[hidden] { display: none; }
.arrow { stroke: var(--arrow); stroke-width: 1.25; fill: none; }
.arrow.async { stroke-dasharray: 5 4; }
.arrow-head { fill: var(--arrow); }
.msg { fill: var(--msg); font-size: 12px; }
.xor-wash { fill: var(--xor-wash); stroke: none; }
.xor-rail { stroke: var(--xor-rail); stroke-width: 2; fill: none; }
.xor-q { fill: var(--status-warning); font-size: 12px; font-weight: 600; }
.hair { stroke: var(--border-subtle); stroke-width: 1; }
.pill { fill: var(--pill-fill); stroke: var(--pill-stroke); stroke-width: 1; }
.pill-t { fill: var(--pill-fg); font-size: 11px; font-weight: 600; }
.loop { fill: var(--fg-muted); font-size: 11px; }
.loop-arc { fill: none; stroke: var(--status-warning); stroke-width: 1.25; stroke-dasharray: 4 3; }
.loop-head { fill: var(--status-warning); }
.act { fill: var(--act-fill); stroke: var(--act-stroke); stroke-width: var(--node-sw); }
.act-t { fill: var(--act-fg); font-size: 12px; font-weight: 500; }
.who { fill: var(--fg-subtle); font-size: 10px; font-family: var(--font-mono); }
.diamond { fill: var(--xor-fill); stroke: var(--xor-edge); stroke-width: var(--node-sw); }
.xor-t { fill: var(--fg-default); font-size: 12px; font-weight: 600; }
.edge { stroke: var(--edge); stroke-width: 1.15; fill: none; }
.edge-t { fill: var(--fg-subtle); font-size: 11px; }
.end-ok { fill: var(--end-fill); stroke: var(--end-stroke); stroke-width: 1.5; }
.end-bad { fill: var(--end-bad-fill); stroke: var(--status-error); stroke-width: 1.5; }
.end-t { fill: var(--fg-muted); font-size: 11px; }
.end-hole { fill: var(--bg-canvas); }
.st { fill: var(--st-fill); stroke: var(--st-stroke); stroke-width: 1.15; }
.st.entry { stroke: var(--st-entry-stroke); stroke-width: 1.75; }
.st.term { stroke: var(--st-term-stroke); stroke-width: 1.75; }
.st-t { fill: var(--fg-default); font-size: 12px; font-weight: 500; }
.fx { fill: var(--fg-subtle); font-size: 10px; font-family: var(--font-mono); }
.mach-title { fill: var(--fg-muted); font-size: 12px; font-weight: 600; }
</style>
</head>
<body data-look="line">
  <div class="app">
    <header class="top">
      <div class="top-row">
        <div class="brand">
          <h1 class="fl-title">${esc(title)}</h1>
          <p class="fl-scenario">${esc(scenario)}</p>
        </div>
        <nav class="fl-toc" role="tablist" aria-label="Camadas do fluxo">
          <button type="button" role="tab" data-tab="sequence" aria-selected="true" aria-controls="fl-sequence">Sequência</button>
          <button type="button" role="tab" data-tab="bpm" aria-selected="false" aria-controls="fl-bpm">Fluxo</button>
          <button type="button" role="tab" data-tab="machines" aria-selected="false" aria-controls="fl-machines">Máquinas</button>
        </nav>
        <div class="toolbar" aria-label="Zoom">
          <button type="button" id="z-out" title="Afastar">−</button>
          <span class="zoom" id="z-lab">100%</span>
          <button type="button" id="z-in" title="Aproximar">+</button>
          <button type="button" id="z-100">100%</button>
          <button type="button" id="z-fit" class="primary" data-fit="height" title="Ajustar à altura">À altura</button>
          <button type="button" id="btn-pdf" title="Baixar PDF do fluxo (anexo)">PDF</button>
          <div class="theme-switch" role="radiogroup" aria-label="Aparência">
            <button type="button" role="radio" data-theme-set="system" aria-checked="true">Sistema</button>
            <button type="button" role="radio" data-theme-set="light" aria-checked="false">Claro</button>
            <button type="button" role="radio" data-theme-set="dark" aria-checked="false">Escuro</button>
          </div>
        </div>
      </div>
      <div class="hint-bar">
        <span class="val">Look A · Linha</span>
        <span class="fl-meta">
          <span><strong>Ator:</strong> ${esc(actor)}</span>
          <span><strong>Plano:</strong> ${esc(planSlug)}</span>
        </span>
        <span id="tab-hint">Tronco + trilho XOR</span>
        <span>Arrastar = pan · <kbd>Ctrl</kbd>+scroll = zoom</span>
      </div>
    </header>

    <div id="fl-viewport" title="Arraste para navegar · Ctrl+scroll para zoom">
      <div id="fl-sizer">
        <div id="fl-stage">
          <section id="fl-sequence" class="diagram-panel fl-surface" role="tabpanel" data-surface="sequence" aria-hidden="false">
            <div class="sheet">${seq}</div>
          </section>
          <section id="fl-bpm" class="diagram-panel fl-surface" role="tabpanel" data-surface="bpm" hidden aria-hidden="true">
            <div class="sheet">${bpm}</div>
          </section>
          <section id="fl-machines" class="diagram-panel fl-surface" role="tabpanel" data-surface="machines" hidden aria-hidden="true">
            <div class="sheet">${mach}</div>
          </section>
        </div>
      </div>
    </div>
  </div>
  <div id="actor-tip" hidden></div>
<script>
__PDF_LIB__
(function () {
  const tabs = [...document.querySelectorAll('.fl-toc [data-tab]')];
  const panels = [...document.querySelectorAll('.fl-surface[data-surface]')];
  const stage = document.getElementById('fl-stage');
  const viewport = document.getElementById('fl-viewport');
  const sizer = document.getElementById('fl-sizer');
  const lab = document.getElementById('z-lab');
  const hint = document.getElementById('tab-hint');
  const tip = document.getElementById('actor-tip');
  const HINTS = {
    sequence: 'Tronco + trilho XOR',
    bpm: 'Caixa / losango / fim · sem id técnico',
    machines: 'Estados + efeitos nas arestas',
  };
  const MIN = ${FLOW_ZOOM_MIN}, MAX = ${FLOW_ZOOM_MAX}, STEP = 0.1, PAD = 40;
  const zoomKey = ${JSON.stringify(FLOW_ZOOM_KEY_PREFIX)} + (document.documentElement.getAttribute('data-fl-slug') || 'default');
  function readZoom() {
    try {
      const n = parseFloat(localStorage.getItem(zoomKey));
      if (Number.isFinite(n)) return Math.min(MAX, Math.max(MIN, n));
    } catch (e) {}
    return 1;
  }
  function saveZoom() {
    try { localStorage.setItem(zoomKey, String(scale)); } catch (e) {}
  }
  let scale = readZoom();

  function visibleSvg() {
    return document.querySelector('.diagram-panel:not([hidden]) svg');
  }
  function svgNative(svg) {
    if (!svg) return { w: 0, h: 0 };
    if (!svg.dataset.nw) {
      const vb = svg.viewBox && svg.viewBox.baseVal;
      svg.dataset.nw = String((vb && vb.width) || svg.width.baseVal.value || 0);
      svg.dataset.nh = String((vb && vb.height) || svg.height.baseVal.value || 0);
    }
    return { w: +svg.dataset.nw, h: +svg.dataset.nh };
  }
  function applySvgScale() {
    const svg = visibleSvg();
    if (!svg) return;
    const n = svgNative(svg);
    svg.setAttribute('width', String(n.w * scale));
    svg.setAttribute('height', String(n.h * scale));
  }
  function naturalSize() {
    applySvgScale();
    const sheet = document.querySelector('.diagram-panel:not([hidden]) .sheet');
    if (!sheet) return { w: 0, h: 0 };
    let w = sheet.offsetWidth;
    let h = sheet.offsetHeight;
    if (!w || !h) {
      const n = svgNative(visibleSvg());
      w = n.w * scale + 40;
      h = n.h * scale + 36;
    }
    return { w, h };
  }
  function applyStageGeometry() {
    const { w, h } = naturalSize();
    if (!w || !h) return null;
    const contentW = w + PAD * 2;
    const contentH = h + PAD * 2;
    const sizerW = Math.max(viewport.clientWidth, Math.ceil(contentW));
    const sizerH = Math.max(viewport.clientHeight, Math.ceil(contentH));
    sizer.style.width = sizerW + 'px';
    sizer.style.height = sizerH + 'px';
    const left = Math.max(0, (sizerW - contentW) / 2);
    const top = 0;
    stage.style.left = left + 'px';
    stage.style.top = top + 'px';
    stage.style.transform = '';
    lab.textContent = Math.round(scale * 100) + '%';
    updateStickyActors();
    return { left, top, scaledW: contentW, scaledH: contentH };
  }
  function updateStickyActors() {
    const svg = document.getElementById('seq-svg');
    const layer = svg && svg.querySelector('[data-actor-stick]');
    const seq = document.getElementById('fl-sequence');
    if (!svg || !layer || !seq || seq.hidden) return;
    const vb = svg.viewBox.baseVal;
    const svgRect = svg.getBoundingClientRect();
    if (!vb.width || svgRect.width < 1) return;
    const k = vb.width / svgRect.width;
    const visibleTop = (viewport.getBoundingClientRect().top - svgRect.top) * k;
    layer.setAttribute('transform', 'translate(0 ' + Math.max(0, visibleTop) + ')');
  }
  function centerHorizontally(scrollTop) {
    const geo = applyStageGeometry();
    if (!geo) return;
    viewport.scrollLeft = geo.scaledW > viewport.clientWidth ? (geo.scaledW - viewport.clientWidth) / 2 : 0;
    viewport.scrollTop = scrollTop == null ? 0 : scrollTop;
  }
  function setScale(next, anchor) {
    const prev = scale || 1;
    scale = Math.min(MAX, Math.max(MIN, next));
    const prevLeft = parseFloat(stage.style.left) || 0;
    const prevTop = parseFloat(stage.style.top) || 0;
    let contentX, contentY, cx, cy;
    if (anchor) {
      const rect = viewport.getBoundingClientRect();
      cx = anchor.clientX - rect.left;
      cy = anchor.clientY - rect.top;
      contentX = (viewport.scrollLeft + cx - prevLeft) / prev;
      contentY = (viewport.scrollTop + cy - prevTop) / prev;
    } else {
      contentX = (viewport.scrollLeft + viewport.clientWidth / 2 - prevLeft) / prev;
      contentY = (viewport.scrollTop + viewport.clientHeight / 2 - prevTop) / prev;
    }
    const geo = applyStageGeometry();
    if (!geo) return;
    if (anchor) {
      viewport.scrollLeft = contentX * scale + geo.left - cx;
      viewport.scrollTop = contentY * scale + geo.top - cy;
    } else {
      viewport.scrollLeft = contentX * scale + geo.left - viewport.clientWidth / 2;
      viewport.scrollTop = contentY * scale + geo.top - viewport.clientHeight / 2;
    }
    saveZoom();
  }
  function showTab(name) {
    tabs.forEach((t) => t.setAttribute('aria-selected', String(t.dataset.tab === name)));
    panels.forEach((p) => {
      const on = p.dataset.surface === name;
      p.hidden = !on;
      p.setAttribute('aria-hidden', String(!on));
    });
    if (hint) hint.textContent = HINTS[name] || '';
    if (tip) tip.hidden = true;
    requestAnimationFrame(function () { centerHorizontally(0); });
  }
  tabs.forEach((t) => t.addEventListener('click', () => showTab(t.dataset.tab)));

  document.getElementById('z-in').onclick = () => setScale(scale + STEP);
  document.getElementById('z-out').onclick = () => setScale(scale - STEP);
  document.getElementById('z-100').onclick = () => { scale = 1; centerHorizontally(0); saveZoom(); };
  document.getElementById('z-fit').onclick = () => {
    const btn = document.getElementById('z-fit');
    const n = svgNative(visibleSvg());
    if (!n.w || !n.h) return;
    const fitX = (viewport.clientWidth - 24) / (n.w + PAD * 2 + 40);
    const fitY = (viewport.clientHeight - 24) / (n.h + PAD * 2 + 36);
    const axis = btn.getAttribute('data-fit') === 'width' ? 'width' : 'height';
    const next = axis === 'width' ? fitX : fitY;
    scale = Math.max(MIN, Math.min(MAX, next));
    centerHorizontally(0);
    const other = axis === 'height' ? 'width' : 'height';
    btn.setAttribute('data-fit', other);
    btn.textContent = other === 'width' ? 'À largura' : 'À altura';
    btn.title = other === 'width' ? 'Ajustar à largura' : 'Ajustar à altura';
    saveZoom();
  };

  const EXPORT_SVG_CSS = [
    'svg.diagram{font-family:Inter,ui-sans-serif,system-ui,sans-serif}',
    'svg.diagram text{fill:#12161d}',
    '.actor-box{fill:#eef2f7;stroke:#d5dce6;stroke-width:1}',
    '.actor-label{fill:#12161d;font-size:11px;font-weight:600}',
    '.actor-stick-bg{fill:#ffffff}',
    '.actor-stick-rule{stroke:#d5dce6;stroke-width:1}',
    '.lifeline{stroke:#98a1ad;stroke-width:1;stroke-dasharray:3 5}',
    '.life-hit{stroke:none}',
    '.arrow{stroke:#4a5565;stroke-width:1.25;fill:none}',
    '.arrow.async{stroke-dasharray:5 4}',
    '.arrow-head{fill:#4a5565}',
    '.msg{fill:#12161d;font-size:12px}',
    '.xor-wash{fill:rgba(238,242,247,.18);stroke:none}',
    '.xor-rail{stroke:#c9a36a;stroke-width:2;fill:none}',
    '.xor-q{fill:#b8860b;font-size:12px;font-weight:600}',
    '.hair{stroke:#e8edf3;stroke-width:1}',
    '.pill{fill:#e8edf4;stroke:#c9a36a;stroke-width:1}',
    '.pill-t{fill:#b8860b;font-size:11px;font-weight:600}',
    '.loop{fill:#4a5565;font-size:11px}',
    '.loop-arc{fill:none;stroke:#b8860b;stroke-width:1.25;stroke-dasharray:4 3}',
    '.loop-head{fill:#b8860b}',
    '.act{fill:#eef2f7;stroke:#d5dce6;stroke-width:1.25}',
    '.act-t{fill:#12161d;font-size:12px;font-weight:500}',
    '.who{fill:#6b7585;font-size:10px;font-family:ui-monospace,monospace}',
    '.diamond{fill:#fff8eb;stroke:#c9a36a;stroke-width:1.25}',
    '.xor-t{fill:#12161d;font-size:12px;font-weight:600}',
    '.edge{stroke:#98a1ad;stroke-width:1.15;fill:none}',
    '.edge-t{fill:#6b7585;font-size:11px}',
    '.end-ok{fill:#4cc28e;stroke:#4cc28e;stroke-width:1.5}',
    '.end-bad{fill:#ff5c5c;stroke:#ff5c5c;stroke-width:1.5}',
    '.end-t{fill:#4a5565;font-size:11px}',
    '.end-hole{fill:#ffffff}',
    '.st{fill:#e8edf4;stroke:#d5dce6;stroke-width:1.15}',
    '.st.entry{stroke:#5fb1ff;stroke-width:1.75}',
    '.st.term{stroke:#4cc28e;stroke-width:1.75}',
    '.st-t{fill:#12161d;font-size:12px;font-weight:500}',
    '.fx{fill:#6b7585;font-size:10px;font-family:ui-monospace,monospace}',
    '.mach-title{fill:#4a5565;font-size:12px;font-weight:600}',
  ].join('');

  function nativeBox(svg) {
    const vb = svg.viewBox && svg.viewBox.baseVal;
    if (vb && vb.width && vb.height) return { w: vb.width, h: vb.height };
    return { w: svg.width.baseVal.value, h: svg.height.baseVal.value };
  }
  function svgToImage(svg) {
    return new Promise((resolve, reject) => {
      const clone = svg.cloneNode(true);
      const n = nativeBox(svg);
      clone.setAttribute('width', String(n.w));
      clone.setAttribute('height', String(n.h));
      const stick = clone.querySelector('[data-actor-stick]');
      if (stick) stick.removeAttribute('transform');
      const ns = 'http://www.w3.org/2000/svg';
      const style = document.createElementNS(ns, 'style');
      style.textContent = EXPORT_SVG_CSS;
      const bg = document.createElementNS(ns, 'rect');
      bg.setAttribute('width', '100%');
      bg.setAttribute('height', '100%');
      bg.setAttribute('fill', '#ffffff');
      clone.insertBefore(style, clone.firstChild);
      clone.insertBefore(bg, style.nextSibling);
      const xml = new XMLSerializer().serializeToString(clone);
      const url = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml;charset=utf-8' }));
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Falha ao rasterizar o diagrama')); };
      img.src = url;
    });
  }
  function jpegFromCanvas(canvas) {
    const url = canvas.toDataURL('image/jpeg', 0.92);
    const bin = atob(url.slice(url.indexOf(',') + 1));
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
    return out;
  }
  async function rasterSurface(svg, heading, title, scenario) {
    const n = nativeBox(svg);
    const img = await svgToImage(svg);
    const scale = 2;
    const head = 64 * scale;
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(n.w * scale));
    canvas.height = Math.max(1, Math.round(head + n.h * scale));
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#12161d';
    ctx.font = '600 ' + (16 * scale) + 'px Inter, ui-sans-serif, system-ui, sans-serif';
    ctx.fillText(title, 16 * scale, 22 * scale);
    ctx.fillStyle = '#4a5565';
    ctx.font = '500 ' + (11 * scale) + 'px Inter, ui-sans-serif, system-ui, sans-serif';
    ctx.fillText(heading, 16 * scale, 38 * scale);
    if (scenario) {
      ctx.fillStyle = '#6b7585';
      ctx.fillText(scenario, 16 * scale, 52 * scale);
    }
    ctx.drawImage(img, 0, head, n.w * scale, n.h * scale);
    const jpeg = jpegFromCanvas(canvas);
    const ptW = 539;
    const ptH = ptW * (canvas.height / canvas.width);
    return { jpeg, width: canvas.width, height: canvas.height, ptWidth: ptW, ptHeight: ptH };
  }
  document.getElementById('btn-pdf').onclick = async () => {
    const btn = document.getElementById('btn-pdf');
    if (btn.disabled) return;
    btn.disabled = true;
    btn.textContent = 'PDF…';
    try {
      const title = (document.querySelector('.fl-title') || {}).textContent || 'Fluxo';
      const scenario = (document.querySelector('.fl-scenario') || {}).textContent || '';
      const slug = document.documentElement.getAttribute('data-fl-slug') || '';
      const specs = [
        ['seq-svg', 'Sequência'],
        ['bpm-svg', 'Fluxo'],
        ['mach-svg', 'Máquinas'],
      ];
      const pages = [];
      for (const [id, label] of specs) {
        const svg = document.getElementById(id);
        if (!svg) continue;
        pages.push(await rasterSurface(svg, label, title, scenario));
      }
      if (!pages.length) throw new Error('Nenhum diagrama para exportar');
      const bytes = buildFlowPdf({ pages });
      const blob = new Blob([bytes], { type: 'application/pdf' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = pdfFilename(slug);
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    } catch (err) {
      console.error(err);
      if (hint) hint.textContent = (err && err.message) || 'Falha ao gerar PDF';
    } finally {
      btn.disabled = false;
      btn.textContent = 'PDF';
    }
  };

  viewport.addEventListener('wheel', (e) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    e.preventDefault();
    setScale(scale + (e.deltaY > 0 ? -STEP : STEP), e);
  }, { passive: false });

  let pan = false, sx = 0, sy = 0, sl = 0, st = 0;
  viewport.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 && e.button !== 1) return;
    pan = true;
    viewport.classList.add('is-panning');
    sx = e.clientX; sy = e.clientY; sl = viewport.scrollLeft; st = viewport.scrollTop;
    viewport.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  viewport.addEventListener('pointermove', (e) => {
    if (pan) {
      viewport.scrollLeft = sl - (e.clientX - sx);
      viewport.scrollTop = st - (e.clientY - sy);
      return;
    }
    if (!tip) return;
    const hit = e.target && e.target.closest && e.target.closest('[data-actor-label]');
    if (!hit) { tip.hidden = true; return; }
    tip.hidden = false;
    tip.textContent = hit.getAttribute('data-actor-label') || '';
    tip.style.left = (e.clientX + 12) + 'px';
    tip.style.top = (e.clientY + 12) + 'px';
  });
  viewport.addEventListener('pointerleave', () => { if (tip) tip.hidden = true; });
  viewport.addEventListener('scroll', () => updateStickyActors(), { passive: true });
  const endPan = (e) => {
    if (!pan) return;
    pan = false;
    viewport.classList.remove('is-panning');
    try { viewport.releasePointerCapture(e.pointerId); } catch (err) {}
  };
  viewport.addEventListener('pointerup', endPan);
  viewport.addEventListener('pointercancel', endPan);
  window.addEventListener('keydown', (e) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    if (e.key === '=' || e.key === '+') { e.preventDefault(); setScale(scale + STEP); }
    if (e.key === '-') { e.preventDefault(); setScale(scale - STEP); }
    if (e.key === '0') { e.preventDefault(); scale = 1; centerHorizontally(0); saveZoom(); }
  });
  window.addEventListener('resize', () => applyStageGeometry());
  requestAnimationFrame(function () { centerHorizontally(0); });
})();
</script>
</body>
</html>
`;
}

const raw = JSON.parse(readFileSync(SRC, 'utf8'));
const normalized = normalizeFlow(raw);
const steps = walkSteps(normalized);
const seq = drawSequence(normalized, steps);
const bpm = drawBpm(normalized);
const mach = drawMachines(normalized);

const html = pageHtml({
  title: normalized.title,
  scenario: normalized.scenario,
  actor: normalized.actor,
  planSlug: normalized.planSlug,
  seq,
  bpm,
  mach,
}).replace('__PDF_LIB__', PDF_LIB_SRC);

writeFileSync(OUT, html);
const msgCount = (seq.match(/data-from="/g) || []).length;
const xorCount = (seq.match(/data-xor-rail="/g) || []).length;
console.log(`wrote ${OUT}\nsequence messages=${msgCount} xor-rails=${xorCount} bpm-nodes=${(bpm.match(/data-node-id=/g) || []).length}`);
