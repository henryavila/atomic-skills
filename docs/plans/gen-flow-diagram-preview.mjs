#!/usr/bin/env node
/**
 * Preview = this script (basis of the engine). PDTI JSON is input data only.
 * Full-page chrome (grid auto/1fr + sizer/stage). Zoom resizes SVG
 * width/height (vectors stay sharp). No CSS transform scale.
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeFlow } from '../../scripts/lib/render-flow.js';
import {
  FLOW_ZOOM_KEY_PREFIX,
  FLOW_ZOOM_MAX,
  FLOW_ZOOM_MIN,
} from '../../scripts/lib/flow-zoom.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const DOGFOOD = join(ROOT, 'docs/design/project-flow/dogfood');
const EXTRA_DIR = join(ROOT, 'docs/plans/preview-processes');
const OUT = join(ROOT, 'docs/plans/2026-08-14-flow-diagram-engine-style-preview.html');
const PLAN_ID = 'project-flow-preview';
const PLAN_TITLE = 'Project Flow';
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

function wrap(text, max = 34, maxLines = 2) {
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
  return lines.slice(0, maxLines);
}

function haloText(cls, x, y, text, anchor = 'middle', attrs = '') {
  return `<text class="${cls}" x="${x}" y="${y}" text-anchor="${anchor}"${attrs ? ` ${attrs}` : ''}>${esc(text)}</text>`;
}

function stackInBox(x, top, height, items) {
  const block = items.reduce((sum, it) => sum + it.h, 0);
  let y = top + (height - block) / 2;
  return items
    .map((it) => {
      const mid = y + it.h / 2;
      y += it.h;
      return `<text class="${it.cls}" x="${x}" y="${mid}" text-anchor="middle" dominant-baseline="central">${esc(it.text)}</text>`;
    })
    .join('');
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

function nodeMetrics(node) {
  const type = node.type;
  if (type === 'xor') return { w: 200, h: 84 };
  if (type === 'and' || type === 'join') return { w: 36, h: 8 };
  if (type === 'end') return { w: 24, h: 44 };
  if (type === 'event') return { w: 28, h: 46 };
  const lines = wrap(node.label, 22, 2).length;
  const extra = node.who ? 1 : 0;
  return { w: 200, h: 18 + (lines + extra) * 14 + 10 };
}

function bpmPorts(box) {
  const { x, y, type } = box;
  const m = nodeMetrics(box);
  if (type === 'xor') {
    return {
      top: { x, y },
      bottom: { x, y: y + m.h },
      left: { x: x - m.w / 2, y: y + m.h / 2 },
      right: { x: x + m.w / 2, y: y + m.h / 2 },
    };
  }
  if (type === 'end' || type === 'event') {
    const cy = y + (type === 'end' ? 12 : 14);
    const r = type === 'end' ? 10 : 12;
    return {
      top: { x, y: cy - r },
      bottom: { x, y: cy + r },
      left: { x: x - r, y: cy },
      right: { x: x + r, y: cy },
    };
  }
  if (type === 'and' || type === 'join') {
    return {
      top: { x, y },
      bottom: { x, y: y + 8 },
      left: { x: x - 18, y: y + 4 },
      right: { x: x + 18, y: y + 4 },
    };
  }
  return {
    top: { x, y },
    bottom: { x, y: y + m.h },
    left: { x: x - m.w / 2, y: y + m.h / 2 },
    right: { x: x + m.w / 2, y: y + m.h / 2 },
  };
}

function routeOrthogonal(from, to, kind) {
  const a = bpmPorts(from);
  const b = bpmPorts(to);
  if (kind === 'back') {
    const p1 = a.left;
    const p2 = b.left;
    const side = Math.min(p1.x, p2.x) - 52;
    const midY = p2.y + 26;
    return `M${p1.x} ${p1.y} L${side} ${p1.y} L${side} ${midY} L${p2.x} ${midY} L${p2.x} ${p2.y}`;
  }
  const dx = to.x - from.x;
  let p1 = a.bottom;
  if (from.type === 'xor') {
    if (dx < -30) p1 = { x: (a.left.x + a.bottom.x) / 2, y: (a.left.y + a.bottom.y) / 2 };
    else if (dx > 30) p1 = { x: (a.right.x + a.bottom.x) / 2, y: (a.right.y + a.bottom.y) / 2 };
  } else if (from.type === 'and') {
    if (dx < -30) p1 = a.left;
    else if (dx > 30) p1 = a.right;
  }
  let p2 = b.top;
  if (kind === 'join' && Math.abs(dx) > 30) {
    p2 = from.x < to.x ? b.left : b.right;
  }
  if (Math.abs(p1.x - p2.x) < 1.5 && Math.abs(p1.y - p2.y) > 1) {
    return `M${p1.x} ${p1.y} L${p2.x} ${p2.y}`;
  }
  if (p2 === b.left || p2 === b.right) {
    return `M${p1.x} ${p1.y} L${p1.x} ${p2.y} L${p2.x} ${p2.y}`;
  }
  if (p2.y > p1.y + 8) {
    if (Math.abs(p1.x - a.left.x) < 1 || Math.abs(p1.x - a.right.x) < 1 || (from.type === 'xor' && Math.abs(dx) > 30)) {
      return `M${p1.x} ${p1.y} L${p2.x} ${p1.y} L${p2.x} ${p2.y}`;
    }
    const midY = (p1.y + p2.y) / 2;
    return `M${p1.x} ${p1.y} L${p1.x} ${midY} L${p2.x} ${midY} L${p2.x} ${p2.y}`;
  }
  const midY = Math.max(p1.y, p2.y) + 24;
  return `M${p1.x} ${p1.y} L${p1.x} ${midY} L${p2.x} ${midY} L${p2.x} ${p2.y}`;
}

function pathPoints(d) {
  return [...d.matchAll(/[ML]\s*([-\d.]+)\s+([-\d.]+)/g)].map((m) => ({ x: +m[1], y: +m[2] }));
}

function endTangent(d) {
  const c = /C\s*([-\d.]+)\s+([-\d.]+),\s*([-\d.]+)\s+([-\d.]+),\s*([-\d.]+)\s+([-\d.]+)\s*$/.exec(d);
  if (c) return { from: { x: +c[3], y: +c[4] }, to: { x: +c[5], y: +c[6] } };
  const pts = pathPoints(d);
  if (pts.length < 2) return null;
  return { from: pts[pts.length - 2], to: pts[pts.length - 1] };
}

function arrowPoly(d, cls = 'edge-head') {
  const t = endTangent(d);
  if (!t) return '';
  const ang = Math.atan2(t.to.y - t.from.y, t.to.x - t.from.x);
  const len = 8;
  const w = 3.6;
  const { x, y } = t.to;
  const x1 = x - len * Math.cos(ang) + w * Math.sin(ang);
  const y1 = y - len * Math.sin(ang) - w * Math.cos(ang);
  const x2 = x - len * Math.cos(ang) - w * Math.sin(ang);
  const y2 = y - len * Math.sin(ang) + w * Math.cos(ang);
  return `<polygon class="${cls}" points="${x},${y} ${x1},${y1} ${x2},${y2}"/>`;
}

function longestSeg(d) {
  const pts = [...d.matchAll(/[ML]\s*([-\d.]+)\s+([-\d.]+)/g)].map((m) => ({
    x: +m[1],
    y: +m[2],
  }));
  if (pts.length < 2) return { x: 0, y: 0, horiz: true };
  let best = { a: pts[0], b: pts[1], len: 0 };
  for (let i = 1; i < pts.length; i += 1) {
    const len = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    if (len > best.len) best = { a: pts[i - 1], b: pts[i], len };
  }
  return {
    x: (best.a.x + best.b.x) / 2,
    y: (best.a.y + best.b.y) / 2,
    horiz: Math.abs(best.b.x - best.a.x) >= Math.abs(best.b.y - best.a.y),
  };
}

function analyzeBpm(nodes, entry) {
  const forwardIn = Object.create(null);
  const seen = new Set();
  function outs(node) {
    if (!node || node.type === 'end') return [];
    if (node.type === 'xor' || node.type === 'and') {
      return (node.branches || []).map((b) => ({ to: b.next, label: b.label || '' }));
    }
    return node.next ? [{ to: node.next, label: '' }] : [];
  }
  function dfs(id, path) {
    const node = nodes[id];
    if (!node) return;
    seen.add(id);
    for (const e of outs(node)) {
      if (!e.to || !nodes[e.to]) continue;
      if (path.has(e.to)) continue;
      forwardIn[e.to] = (forwardIn[e.to] || 0) + 1;
      if (!seen.has(e.to)) {
        const next = new Set(path);
        next.add(e.to);
        dfs(e.to, next);
      }
    }
  }
  dfs(entry, new Set([entry]));
  const joinIds = new Set(Object.keys(forwardIn).filter((id) => forwardIn[id] > 1));
  return { joinIds };
}

function drawBpm(normalized) {
  const nodes = normalized.graph.nodes;
  const entry = normalized.graph.entry;
  const COL = 248;
  const GAP = 56;
  const { joinIds } = analyzeBpm(nodes, entry);
  const placed = new Map();
  const edges = [];

  function isStubBranch(start, path) {
    let cur = start;
    const local = new Set();
    while (cur && nodes[cur] && !local.has(cur)) {
      local.add(cur);
      const node = nodes[cur];
      if (node.type === 'xor' || node.type === 'and' || node.type === 'end') return false;
      if (joinIds.has(cur) && cur !== start) return false;
      if (!node.next) return false;
      if (path.has(node.next)) return true;
      if (joinIds.has(node.next) || placed.has(node.next)) return false;
      cur = node.next;
    }
    return false;
  }

  function joinAfter(start) {
    let cur = start;
    const local = new Set();
    while (cur && nodes[cur] && !local.has(cur)) {
      local.add(cur);
      const node = nodes[cur];
      if (node.type === 'xor' || node.type === 'and' || node.type === 'end') return null;
      if (node.next && joinIds.has(node.next)) return node.next;
      cur = node.next;
    }
    return null;
  }

  function placeNode(id, x, y) {
    if (placed.has(id)) return placed.get(id);
    const node = nodes[id];
    const box = {
      id,
      type: node.type,
      label: node.label,
      who: node.who,
      question: node.question,
      next: node.next,
      x,
      y,
    };
    placed.set(id, box);
    return box;
  }

  function placeFrom(id, x, y, path) {
    let cur = id;
    let cy = y;
    let prev = null;
    let guard = 0;
    while (cur && nodes[cur] && guard++ < 48) {
      if (path.has(cur) && placed.has(cur)) {
        if (prev) edges.push({ from: prev, to: cur, label: '', kind: 'back' });
        return { bottom: cy, last: prev };
      }
      if (placed.has(cur)) {
        if (prev) edges.push({ from: prev, to: cur, label: '', kind: 'join' });
        const hit = placed.get(cur);
        return { bottom: hit.y + nodeMetrics(hit).h, last: cur };
      }
      const node = nodes[cur];
      placeNode(cur, x, cy);
      if (prev) edges.push({ from: prev, to: cur, label: '', kind: 'seq' });
      const h = nodeMetrics(node).h;
      if (node.type === 'end') return { bottom: cy + h, last: cur };
      if (node.type === 'xor' || node.type === 'and') {
        return placeGate(cur, x, cy, new Set([...path, cur]));
      }
      prev = cur;
      cur = node.next;
      cy += h + GAP;
    }
    return { bottom: cy, last: prev };
  }

  function placeUntilJoin(start, x, y, path, joinId) {
    let cur = start;
    let cy = y;
    let prev = null;
    while (cur && nodes[cur] && cur !== joinId && !placed.has(cur) && !path.has(cur)) {
      const node = nodes[cur];
      if (node.type === 'xor' || node.type === 'and') {
        placeNode(cur, x, cy);
        if (prev) edges.push({ from: prev, to: cur, label: '', kind: 'seq' });
        return placeGate(cur, x, cy, new Set([...path, cur]));
      }
      placeNode(cur, x, cy);
      if (prev) edges.push({ from: prev, to: cur, label: '', kind: 'seq' });
      const h = nodeMetrics(node).h;
      if (node.type === 'end') return { bottom: cy + h, last: cur };
      prev = cur;
      cur = node.next;
      cy += h + GAP;
    }
    if (prev) return { bottom: placed.get(prev).y + nodeMetrics(placed.get(prev)).h, last: prev };
    return { bottom: cy, last: prev };
  }

  function placeGate(gateId, x, y, path) {
    const node = nodes[gateId];
    const branches = node.branches || [];
    const gh = nodeMetrics(node).h;
    const specs = branches.map((branch) => {
      const target = branch.next;
      if (!target || !nodes[target]) return { branch, kind: 'empty' };
      if (path.has(target)) return { branch, kind: 'back', target };
      if (placed.has(target) || joinIds.has(target)) {
        return { branch, kind: 'to-join', target };
      }
      if (isStubBranch(target, path)) return { branch, kind: 'stub', start: target };
      return { branch, kind: 'content', start: target, join: joinAfter(target) };
    });
    const contents = specs.filter((s) => s.kind === 'content');
    const toJoins = specs.filter((s) => s.kind === 'to-join');
    const stubs = specs.filter((s) => s.kind === 'stub' || s.kind === 'back');

    if (contents.length <= 1 && toJoins.length === 0) {
      stubs.forEach((s, i) => {
        if (s.kind === 'back') {
          edges.push({ from: gateId, to: s.target, label: s.branch.label, kind: 'back' });
          return;
        }
        const sx = x - COL * (i + 1);
        const startY = y + gh + GAP;
        placeFrom(s.start, sx, startY, path);
        edges.push({ from: gateId, to: s.start, label: s.branch.label, kind: 'branch' });
      });
      if (contents[0]) {
        const startY = y + gh + GAP;
        const r = placeFrom(contents[0].start, x, startY, path);
        edges.push({ from: gateId, to: contents[0].start, label: contents[0].branch.label, kind: 'branch' });
        return r;
      }
      return { bottom: y + gh, last: gateId };
    }

    const colSpecs = specs.filter((s) => s.kind === 'content' || s.kind === 'to-join' || s.kind === 'stub');
    const n = Math.max(colSpecs.length, 1);
    const cols = [];
    colSpecs.forEach((s, i) => {
      const kx = x + (i - (n - 1) / 2) * COL;
      const startY = y + gh + GAP;
      if (s.kind === 'to-join') {
        cols.push({ spec: s, last: null, bottom: startY });
        edges.push({ from: gateId, to: s.target, label: s.branch.label, kind: 'branch' });
      } else if (s.kind === 'stub') {
        const r = placeFrom(s.start, kx, startY, path);
        edges.push({ from: gateId, to: s.start, label: s.branch.label, kind: 'branch' });
        cols.push({ spec: s, last: r.last, bottom: r.bottom });
      } else {
        const r = placeUntilJoin(s.start, kx, startY, path, s.join);
        edges.push({ from: gateId, to: s.start, label: s.branch.label, kind: 'branch' });
        cols.push({ spec: s, last: r.last, bottom: r.bottom });
      }
    });

    const joinHits = [
      ...contents.map((s) => s.join),
      ...toJoins.map((s) => s.target),
    ].filter(Boolean);
    const uniqueJoins = [...new Set(joinHits)];
    const joinId = uniqueJoins.length === 1 ? uniqueJoins[0] : null;
    const maxBottom = Math.max(y + gh + GAP, ...cols.map((c) => c.bottom));

    if (joinId && !placed.has(joinId)) {
      const jy = maxBottom + GAP;
      const r = placeFrom(joinId, x, jy, path);
      for (const c of cols) {
        if (c.last && c.last !== joinId) {
          edges.push({ from: c.last, to: joinId, label: '', kind: 'join' });
        }
      }
      return r;
    }
    if (joinId && placed.has(joinId)) {
      for (const c of cols) {
        if (c.last && c.last !== joinId) {
          edges.push({ from: c.last, to: joinId, label: '', kind: 'join' });
        }
      }
      const hit = placed.get(joinId);
      return { bottom: hit.y + nodeMetrics(hit).h, last: joinId };
    }
    return { bottom: maxBottom, last: gateId };
  }

  placeFrom(entry, 0, 28, new Set());

  const seenEdge = new Set();
  const uniq = [];
  for (const e of edges) {
    const key = `${e.from}>${e.to}|${e.label}|${e.kind}`;
    if (seenEdge.has(key)) continue;
    seenEdge.add(key);
    uniq.push(e);
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const b of placed.values()) {
    const m = nodeMetrics(b);
    minX = Math.min(minX, b.x - m.w / 2);
    maxX = Math.max(maxX, b.x + m.w / 2);
    minY = Math.min(minY, b.y);
    maxY = Math.max(maxY, b.y + m.h + (b.type === 'end' || b.type === 'event' ? 4 : 0));
  }
  minX -= 72;
  maxX += 36;
  minY -= 16;
  maxY += 20;
  const dx = 24 - minX;
  const dy = 24 - minY;
  for (const b of placed.values()) {
    b.x += dx;
    b.y += dy;
  }
  const width = Math.ceil(maxX + dx + 24);
  const height = Math.ceil(maxY + dy + 24);

  const nodeSvg = [...placed.values()]
    .map((b) => {
      const { x, y } = b;
      if (b.type === 'xor') {
        const hw = 100;
        const hh = 42;
        const pts = `${x},${y} ${x + hw},${y + hh} ${x},${y + hh * 2} ${x - hw},${y + hh}`;
        const q = (b.label || b.question || '').replace(/\?$/, '') + '?';
        const lines = wrap(q, 16, 2);
        const items = [
          ...lines.map((ln) => ({ text: ln, cls: 'xor-t', h: 14 })),
          ...(b.who ? [{ text: b.who, cls: 'who', h: 12 }] : []),
        ];
        return `<g data-node-id="${esc(b.id)}" data-shape="diamond">
          <polygon class="diamond" points="${pts}"/>
          ${stackInBox(x, y, hh * 2, items)}
        </g>`;
      }
      if (b.type === 'and' || b.type === 'join') {
        return `<g data-node-id="${esc(b.id)}" data-shape="bar">
          <rect class="bar" x="${x - 18}" y="${y}" width="36" height="8" rx="2"/>
        </g>`;
      }
      if (b.type === 'event') {
        return `<g data-node-id="${esc(b.id)}" data-shape="circle">
          <circle class="evt" cx="${x}" cy="${y + 14}" r="12"/>
          <text class="end-t" x="${x}" y="${y + 40}" text-anchor="middle">${esc(b.label)}</text>
        </g>`;
      }
      if (b.type === 'end') {
        const ok = !/recus|reject|fail|sem |error|inválid/i.test(b.label);
        const cls = ok ? 'end-ok' : 'end-bad';
        return `<g data-node-id="${esc(b.id)}" data-shape="circle">
          <circle class="${cls}" cx="${x}" cy="${y + 12}" r="10"/>
          ${ok ? '' : `<circle class="end-hole" cx="${x}" cy="${y + 12}" r="5"/>`}
          <text class="end-t" x="${x}" y="${y + 36}" text-anchor="middle">${esc(b.label)}</text>
        </g>`;
      }
      const lines = wrap(b.label, 22, 2);
      const h = nodeMetrics(b).h;
      const nextAttr = b.next ? ` data-next="${esc(b.next)}"` : '';
      const mark =
        b.type === 'subprocess'
          ? `<rect class="sub-mark" x="${x - 95}" y="${y + 5}" width="190" height="${h - 10}" rx="4"/>`
          : '';
      const items = [
        ...lines.map((ln) => ({ text: ln, cls: 'act-t', h: 14 })),
        ...(b.who ? [{ text: b.who, cls: 'who', h: 12 }] : []),
      ];
      return `<g data-node-id="${esc(b.id)}" data-shape="rect"${nextAttr}>
        <rect class="act" x="${x - 100}" y="${y}" width="200" height="${h}" rx="8"/>
        ${mark}
        ${stackInBox(x, y, h, items)}
      </g>`;
    })
    .join('\n');

  const routed = uniq
    .map((e) => {
      const a = placed.get(e.from);
      const b = placed.get(e.to);
      if (!a || !b) return null;
      const d = routeOrthogonal(a, b, e.kind);
      return { ...e, d };
    })
    .filter(Boolean);

  const edgeSvg = routed
    .map((e) => {
      const cls = e.kind === 'back' ? 'edge back' : 'edge';
      return `<path class="${cls}" d="${e.d}"/>`;
    })
    .join('\n');
  const headSvg = routed
    .map((e) => arrowPoly(e.d, e.kind === 'back' ? 'edge-head back' : 'edge-head'))
    .join('\n');

  const labelSvg = routed
    .map((e) => {
      if (!e.label) return '';
      const mid = longestSeg(e.d);
      const lines = wrap(e.label, 18, 2);
      if (mid.horiz) {
        const y0 = mid.y - 8 - (lines.length - 1) * 12;
        return lines
          .map((ln, i) => haloText('edge-t', mid.x, y0 + i * 12, ln, 'middle'))
          .join('');
      }
      return lines
        .map((ln, i) => haloText('edge-t', mid.x + 8, mid.y + i * 12, ln, 'start'))
        .join('');
    })
    .join('\n');

  return `<svg class="diagram" id="bpm-svg" data-surface="bpm" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" role="img">
    <title>Diagrama de processo — PDTI</title>
    ${edgeSvg}
    ${nodeSvg}
    ${headSvg}
    ${labelSvg}
  </svg>`;
}

const KIND_PT = {
  write: 'Grava',
  email: 'E-mail',
  notify: 'Avisa',
};

function estW(s, px = 11) {
  return Math.ceil(String(s || '').length * px * 0.58);
}

function drawMachines(normalized) {
  const machines = normalized.machines || [];
  const W = 168;
  const H = 32;
  const GAP_X = 292;
  const ROW_Y = 188;
  const PAD_X = 72;
  const PAD_Y = 168;
  const TITLE = 44;
  const STACK = 48;

  function cap1(s) {
    const t = String(s || '');
    return t ? t.charAt(0).toUpperCase() + t.slice(1) : t;
  }

  function fold(s) {
    return String(s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  function covers(hay, needle) {
    const h = fold(hay);
    const n = fold(needle);
    if (!n) return true;
    if (!h) return false;
    if (h.includes(n)) return true;
    const skip = new Set(['como', 'para', 'uma', 'com', 'por']);
    const needles = n.split(' ').filter((w) => w.length > 2 && !skip.has(w));
    if (!needles.length) return false;
    const hayWords = new Set(h.split(' ').filter(Boolean));
    return needles.every((w) => hayWords.has(w));
  }

  function splitTitle(label) {
    let s = String(label || '').replace(/^Líder\s+/i, '');
    const i = s.indexOf(' · ');
    if (i > 0) return { title: cap1(s.slice(0, i)), note: s.slice(i + 3) };
    return { title: cap1(s), note: '' };
  }

  function captionSize(t) {
    const { title, note } = splitTitle(t.label);
    const fx = t.effects || [];
    const noteUseful =
      Boolean(note) && !fx.some((e) => covers(e.label, note) || covers(KIND_PT[e.kind] || e.kind, note));
    const heading = noteUseful ? `${title} · ${note}` : title;
    const titleLines = wrap(heading, 36, 2);
    const fxRows = fx.map((e) => {
      const kind = KIND_PT[e.kind] || e.kind;
      const dup = covers(heading, e.label);
      return {
        e,
        kind,
        kindW: Math.max(40, estW(kind, 9) + 12),
        text: dup ? '' : String(e.label || ''),
      };
    });
    let inner = Math.max(80, ...titleLines.map((ln) => estW(ln, 11)));
    fxRows.forEach((row) => {
      inner = Math.max(inner, row.kindW + (row.text ? 6 + estW(row.text, 10) : 0));
    });
    const padX = 8;
    const padY = 6;
    const fxGap = fxRows.length && titleLines.length ? 4 : 0;
    const h = padY + titleLines.length * 14 + fxGap + fxRows.length * 16 + padY;
    return {
      titleLines,
      fxRows,
      w: inner + padX * 2,
      h,
      padX,
      padY,
      fxGap,
    };
  }

  function captionBox(t, attachX, attachY, place) {
    const c = captionSize(t);
    let x;
    let y;
    if (place === 'above') {
      x = attachX - c.w / 2;
      y = attachY - c.h;
    } else if (place === 'above-left') {
      x = attachX - c.w + 18;
      y = attachY - c.h;
    } else if (place === 'above-right') {
      x = attachX - 18;
      y = attachY - c.h;
    } else if (place === 'below') {
      x = attachX - c.w / 2;
      y = attachY;
    } else if (place === 'left') {
      x = attachX - c.w;
      y = attachY - c.h / 2;
    } else {
      x = attachX;
      y = attachY - c.h / 2;
    }
    return { t, ...c, x, y };
  }

  function paintCaption(box) {
    const { t, x, y, w, h, padX, padY, titleLines, fxRows, fxGap } = box;
    let cy = y + padY + 7;
    const parts = [
      `<g data-transition-id="${esc(t.id || '')}" data-from="${esc(t.from)}" data-to="${esc(t.to)}">`,
      `<rect class="edge-cap" x="${x}" y="${y}" width="${w}" height="${h}" rx="6"/>`,
    ];
    titleLines.forEach((ln) => {
      parts.push(
        `<text class="edge-title" x="${x + padX}" y="${cy}" dominant-baseline="central">${esc(ln)}</text>`,
      );
      cy += 14;
    });
    cy += fxGap || 0;
    fxRows.forEach((row) => {
      const attrs = `data-effect-kind="${esc(row.e.kind)}" data-effect-target="${esc(row.e.target)}"`;
      parts.push(`<rect class="fx-pill" x="${x + padX}" y="${cy - 7}" width="${row.kindW}" height="14" rx="7"/>`);
      parts.push(
        `<text class="fx-pill-t" x="${x + padX + row.kindW / 2}" y="${cy}" text-anchor="middle" dominant-baseline="central">${esc(row.kind)}</text>`,
      );
      if (row.text) {
        parts.push(
          `<text class="fx" x="${x + padX + row.kindW + 6}" y="${cy}" dominant-baseline="central" ${attrs}>${esc(row.text)}</text>`,
        );
      }
      cy += 16;
    });
    parts.push('</g>');
    return parts.join('');
  }

  function layoutOne(m, yOff) {
    const ids = Object.keys(m.nodes);
    const selfLoops = [];
    const downs = [];
    const forwards = [];
    const nonSelf = m.transitions.filter((tr) => tr.from !== tr.to);
    const byFrom = Object.create(null);
    for (const tr of nonSelf) {
      if (!byFrom[tr.from]) byFrom[tr.from] = [];
      byFrom[tr.from].push(tr);
    }
    for (const tr of m.transitions) {
      if (tr.from === tr.to) {
        selfLoops.push(tr);
        continue;
      }
      const sibs = byFrom[tr.from] || [];
      const hasHappy = sibs.some((o) => o !== tr && m.nodes[o.to] && !m.nodes[o.to].terminal);
      if (m.nodes[tr.to]?.terminal && hasHappy) downs.push(tr);
      else forwards.push(tr);
    }

    const rank = Object.create(null);
    if (m.entry) rank[m.entry] = 0;
    const q = m.entry ? [m.entry] : [];
    while (q.length) {
      const id = q.shift();
      for (const tr of forwards) {
        if (tr.from !== id || rank[tr.to] != null) continue;
        rank[tr.to] = (rank[id] ?? 0) + 1;
        q.push(tr.to);
      }
    }
    const row = Object.create(null);
    for (const id of ids) row[id] = 0;
    for (const tr of downs) {
      if (rank[tr.to] == null) rank[tr.to] = rank[tr.from] ?? 0;
      row[tr.to] = (row[tr.from] ?? 0) + 1;
    }
    ids.forEach((id, i) => {
      if (rank[id] == null) rank[id] = i;
    });

    const pos = {};
    for (const id of ids) {
      pos[id] = {
        x: PAD_X + (rank[id] ?? 0) * (W + GAP_X),
        y: yOff + PAD_Y + (row[id] ?? 0) * ROW_Y,
      };
    }

    const loopsByFrom = Object.create(null);
    for (const tr of selfLoops) {
      if (!loopsByFrom[tr.from]) loopsByFrom[tr.from] = [];
      loopsByFrom[tr.from].push(tr);
    }
    const loopSide = new Map();
    for (const list of Object.values(loopsByFrom)) {
      const ordered = [...list].sort((a, b) => (b.effects?.length || 0) - (a.effects?.length || 0));
      if (ordered.length === 1) loopSide.set(ordered[0], 'top');
      else {
        ordered.forEach((tr, i) => loopSide.set(tr, i === 0 ? 'top-left' : 'top-right'));
      }
    }

    return { m, pos, selfLoops, downs, forwards, loopSide };
  }

  function selfPath(p, side) {
    const cy = p.y + H / 2;
    if (side === 'top-left' || side === 'top-right') {
      const cx = p.x + (side === 'top-left' ? W * 0.28 : W * 0.72);
      const lift = 36;
      const apex = p.y - lift;
      return {
        d: `M${cx - 10} ${p.y} C${cx - 20} ${apex}, ${cx + 20} ${apex}, ${cx + 10} ${p.y}`,
        lx: cx,
        ly: apex - 6,
        place: side === 'top-left' ? 'above-left' : 'above-right',
      };
    }
    const cx = p.x + W / 2;
    const apex = p.y - 40;
    return {
      d: `M${cx - 12} ${p.y} C${cx - 28} ${apex}, ${cx + 28} ${apex}, ${cx + 12} ${p.y}`,
      lx: cx,
      ly: apex - 6,
      place: 'above',
    };
  }

  let yOff = TITLE;
  const laid = [];
  for (const m of machines) {
    const one = layoutOne(m, yOff);
    let maxY = yOff + PAD_Y + H;
    for (const p of Object.values(one.pos)) maxY = Math.max(maxY, p.y + H + 80);
    laid.push(one);
    yOff = maxY + STACK;
  }

  const groups = [];
  let minX = 0;
  let minY = 0;
  let maxX = 40;
  let maxY = 40;

  function union(x, y, w, h) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + w);
    maxY = Math.max(maxY, y + h);
  }

  for (const [idx, one] of laid.entries()) {
    const { m, pos, selfLoops, downs, forwards, loopSide } = one;
    const edgeParts = [];
    const headParts = [];
    const caps = [];

    for (const p of Object.values(pos)) union(p.x, p.y, W, H);

    for (const tr of forwards) {
      const a = pos[tr.from];
      const b = pos[tr.to];
      if (!a || !b) continue;
      const d = `M${a.x + W} ${a.y + H / 2} L${b.x} ${b.y + H / 2}`;
      edgeParts.push(`<path class="edge" d="${d}"/>`);
      headParts.push(arrowPoly(d));
      const box = captionBox(tr, (a.x + W + b.x) / 2, a.y - 10, 'above');
      caps.push(box);
      union(box.x, box.y, box.w, box.h);
    }
    for (const tr of downs) {
      const a = pos[tr.from];
      const b = pos[tr.to];
      if (!a || !b) continue;
      const d = `M${a.x + W / 2} ${a.y + H} L${b.x + W / 2} ${b.y}`;
      edgeParts.push(`<path class="edge" d="${d}"/>`);
      headParts.push(arrowPoly(d));
      const box = captionBox(tr, a.x + W / 2 + 12, (a.y + H + b.y) / 2, 'right');
      caps.push(box);
      union(box.x, box.y, box.w, box.h);
    }
    for (const tr of selfLoops) {
      const a = pos[tr.from];
      if (!a) continue;
      const routed = selfPath(a, loopSide.get(tr) || 'top');
      edgeParts.push(`<path class="edge" d="${routed.d}"/>`);
      headParts.push(arrowPoly(routed.d));
      const box = captionBox(tr, routed.lx, routed.ly, routed.place);
      caps.push(box);
      union(box.x, box.y, box.w, box.h);
    }

    const stateSvg = Object.keys(m.nodes)
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
        <text class="st-t" x="${p.x + W / 2}" y="${p.y + H / 2}" text-anchor="middle" dominant-baseline="central">${esc(n.label)}</text>
      </g>`;
      })
      .join('\n');

    const titleY = idx === 0 ? 16 : Math.min(...Object.values(pos).map((p) => p.y)) - 88;
    union(16, titleY - 12, 360, 36);
    groups.push(`<g data-machine-id="${esc(m.id)}">
      <text class="mach-title" x="16" y="${titleY}">${esc(m.label)}</text>
      <text class="mach-legend" x="16" y="${titleY + 14}">Laço = permanece no estado · pastilha = o que o sistema faz</text>
      ${edgeParts.join('\n')}
      ${stateSvg}
      ${headParts.join('\n')}
      ${caps.map(paintCaption).join('\n')}
    </g>`);
  }

  const dx = 16 - minX;
  const dy = 16 - minY;
  const width = Math.ceil(maxX + dx + 16);
  const height = Math.ceil(maxY + dy + 16);
  const shift = dx || dy ? ` transform="translate(${dx} ${dy})"` : '';
  const first = machines[0];
  const heading = first ? first.label : 'Estados';
  return `<svg class="diagram" id="mach-svg" data-surface="machines" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" role="img">
    <title>Diagrama de estados — ${esc(heading)}</title>
    <g${shift}>
    ${groups.join('\n')}
    </g>
  </svg>`;
}

function packTemplate(id, seq, bpm, mach) {
  return `<template id="pack-${esc(id)}">
    <section id="fl-sequence" class="diagram-panel fl-surface" role="tabpanel" data-surface="sequence" aria-hidden="false">
      <div class="sheet">${seq}</div>
    </section>
    <section id="fl-bpm" class="diagram-panel fl-surface" role="tabpanel" data-surface="bpm" hidden aria-hidden="true">
      <div class="sheet">${bpm}</div>
    </section>
    <section id="fl-machines" class="diagram-panel fl-surface" role="tabpanel" data-surface="machines" hidden aria-hidden="true">
      <div class="sheet">${mach}</div>
    </section>
  </template>`;
}

function pageHtml({ planId, planTitle, catalog, packs, initial }) {
  const catalogJson = JSON.stringify(catalog).replace(/</g, '\\u003c');
  const packHtml = Object.entries(packs)
    .map(([id, p]) => packTemplate(id, p.seq, p.bpm, p.mach))
    .join('\n');
  return `<!DOCTYPE html>
<html lang="pt-BR" data-fl-plan="${esc(planId)}" data-fl-slug="${esc(initial.slug)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#0a0d12" media="(prefers-color-scheme: dark)">
<meta name="theme-color" content="#f4f6fa" media="(prefers-color-scheme: light)">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="format-detection" content="telephone=no">
<title>${esc(initial.title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<script>(function(){var K="as-color-scheme";var NEXT={system:"light",light:"dark",dark:"system"};var LABEL={system:"Aparência: automático. Toque para claro",light:"Aparência: claro. Toque para escuro",dark:"Aparência: escuro. Toque para automático"};function read(){try{var v=localStorage.getItem(K);return v==="light"||v==="dark"?v:"system"}catch(e){return"system"}}function paintMeta(mode){var dark=mode==="dark"||(mode==="system"&&window.matchMedia&&matchMedia("(prefers-color-scheme: dark)").matches);document.querySelectorAll('meta[name="theme-color"]').forEach(function(m){m.setAttribute("content",dark?"#0a0d12":"#f4f6fa")})}function apply(mode){var r=document.documentElement;if(mode==="light"||mode==="dark")r.setAttribute("data-theme",mode);else r.removeAttribute("data-theme");var c=document.getElementById("theme-cycle");if(c){c.setAttribute("data-mode",mode);c.setAttribute("aria-label",LABEL[mode]||LABEL.system);c.title=LABEL[mode]||LABEL.system}paintMeta(mode)}apply(read());document.addEventListener("click",function(e){var cycle=e.target&&e.target.closest&&e.target.closest("[data-theme-cycle]");if(!cycle)return;var mode=NEXT[read()];try{localStorage.setItem(K,mode)}catch(err){}apply(mode)});document.addEventListener("DOMContentLoaded",function(){apply(read())})})();</script>
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
html { -webkit-text-size-adjust: 100%; text-size-adjust: 100%; touch-action: manipulation; }
html, body {
  margin: 0;
  height: 100%;
  height: 100dvh;
  max-height: 100dvh;
  overflow: hidden;
  overscroll-behavior: none;
  background: var(--bg-canvas); color: var(--fg-default);
  font-family: var(--font-sans);
}
.app {
  display: grid;
  grid-template-columns: 1fr auto;
  grid-template-rows: auto 1fr;
  grid-template-areas:
    "top dock"
    "view view";
  height: 100%; height: 100dvh;
  min-height: 0;
  padding: env(safe-area-inset-top) env(safe-area-inset-right) 0 env(safe-area-inset-left);
}
.top { grid-area: top; }
.dock {
  grid-area: dock;
  display: flex; align-items: center;
  z-index: 20;
  background: color-mix(in srgb, var(--bg-canvas) 92%, transparent);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--border-default);
  padding: 10px 16px 8px 0;
}
#fl-viewport { grid-area: view; }

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
.fl-toc button kbd {
  font: 600 10px var(--font-mono);
  line-height: 16px; min-width: 16px; height: 16px;
  margin-left: 6px; padding: 0 4px;
  border-radius: 4px; border: 1px solid var(--border-default);
  background: var(--bg-sunken); color: var(--fg-subtle);
  display: inline-flex; align-items: center; justify-content: center;
}
.fl-toc button[aria-selected="true"] kbd {
  border-color: color-mix(in srgb, var(--bg-canvas) 35%, transparent);
  background: color-mix(in srgb, var(--bg-canvas) 14%, transparent);
  color: inherit; opacity: 0.7;
}
.fl-toc button:focus-visible, .toolbar button:focus-visible, .theme-cycle:focus-visible { outline: none; box-shadow: var(--shadow-focus); }
.toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.toolbar button {
  appearance: none; height: 28px; min-width: 28px; padding: 0 8px; border-radius: 6px;
  border: 1px solid var(--border-default); background: var(--bg-surface); color: var(--fg-muted);
  font: 600 12px var(--font-sans); cursor: pointer;
}
.toolbar button.primary { background: var(--fg-default); color: var(--bg-canvas); border-color: var(--fg-default); }
.toolbar .zoom { font: 700 12px var(--font-mono); color: var(--fg-subtle); padding: 0 6px; min-width: 3.2rem; text-align: center; }
.theme-cycle {
  appearance: none; flex: 0 0 auto;
  width: 28px; height: 28px; padding: 0;
  display: inline-flex; align-items: center; justify-content: center;
  border-radius: var(--radius-pill);
  border: 1px solid var(--border-default);
  background: var(--bg-elevated); color: var(--fg-muted);
  cursor: pointer; -webkit-tap-highlight-color: transparent;
}
.theme-cycle svg { display: none; width: 16px; height: 16px; }
.theme-cycle:not([data-mode]) .i-system,
.theme-cycle[data-mode="system"] .i-system,
.theme-cycle[data-mode="light"] .i-light,
.theme-cycle[data-mode="dark"] .i-dark { display: block; }
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

.proc-open {
  appearance: none; display: flex; align-items: center; gap: 8px;
  width: 100%; height: 30px; padding: 0 10px;
  border: 1px solid var(--border-default); border-radius: var(--radius-lg);
  background: var(--bg-elevated); color: var(--fg-default);
  font: 500 12px var(--font-sans); cursor: pointer; text-align: left;
  -webkit-tap-highlight-color: transparent;
}
.proc-open-kicker { flex: 0 0 auto; color: var(--fg-subtle); font-size: 11px; }
.proc-open-label {
  flex: 1; min-width: 0;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  font-weight: 600;
}
.proc-open-meta {
  flex: 0 0 auto; color: var(--fg-subtle);
  font-size: 11px; font-variant-numeric: tabular-nums;
}
.proc-open[aria-expanded="true"] { border-color: var(--border-strong); }
.proc-overlay {
  position: fixed; inset: 0; z-index: 50;
  background: color-mix(in srgb, var(--bg-canvas) 52%, transparent);
}
.proc-overlay[hidden] { display: none !important; }
.proc-sheet {
  position: absolute; left: 50%; top: 10%;
  transform: translateX(-50%);
  width: min(460px, calc(100% - 24px));
  max-height: min(72vh, 640px);
  display: flex; flex-direction: column;
  background: var(--bg-surface);
  border: 1px solid var(--border-default);
  border-radius: 12px;
  box-shadow: var(--shadow-sm);
  overflow: hidden;
}
.proc-sheet-head {
  display: flex; align-items: center; gap: 8px;
  padding: 10px;
  border-bottom: 1px solid var(--border-default);
}
#proc-q {
  flex: 1; min-width: 0; height: 34px; padding: 0 10px;
  border: 1px solid var(--border-default); border-radius: 8px;
  background: var(--bg-elevated); color: var(--fg-default);
  font: 400 14px var(--font-sans);
}
#proc-q:focus { outline: none; box-shadow: var(--shadow-focus); }
#proc-count { font-size: 11px; color: var(--fg-subtle); white-space: nowrap; }
#proc-close {
  appearance: none; flex: 0 0 auto; width: 32px; height: 32px; padding: 0;
  border: 1px solid var(--border-default); border-radius: 8px;
  background: var(--bg-elevated); color: var(--fg-muted);
  font: 600 16px var(--font-sans); cursor: pointer;
}
#proc-list { overflow: auto; flex: 1; -webkit-overflow-scrolling: touch; padding: 6px; }
.proc-item {
  appearance: none; display: flex; flex-direction: column; gap: 2px;
  width: 100%; padding: 8px 10px; border: 0; border-radius: 8px;
  background: transparent; color: inherit; font: inherit;
  text-align: left; cursor: pointer;
}
.proc-item[aria-selected="true"] { background: var(--bg-elevated); }
.proc-item:hover, .proc-item:focus-visible { background: var(--bg-elevated); outline: none; }
.proc-item-title { font: 600 13px var(--font-sans); color: var(--fg-default); }
.proc-item-sub {
  font-size: 11px; color: var(--fg-subtle);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.proc-empty { padding: 24px 12px; text-align: center; color: var(--fg-subtle); font-size: 13px; }

#fl-viewport {
  position: relative; overflow: auto; overscroll-behavior: contain;
  min-width: 0; min-height: 0;
  touch-action: pan-x pan-y;
  -webkit-overflow-scrolling: touch;
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
.bar { fill: var(--fg-muted); }
.evt { fill: var(--bg-canvas); stroke: var(--status-error-line); stroke-width: 1.5; }
.sub-mark { fill: none; stroke: var(--act-stroke); stroke-width: 1; }
.edge { stroke: var(--edge); stroke-width: 1.15; fill: none; }
.edge.back { stroke: var(--status-warning); stroke-dasharray: 4 3; }
.edge-head { fill: var(--fg-muted); }
.edge-head.back { fill: var(--status-warning); }
.edge-t, .fx {
  fill: var(--fg-subtle);
  font-size: 11px;
  paint-order: stroke;
  stroke: var(--bg-surface);
  stroke-width: 4px;
  stroke-linejoin: round;
}
.fx { font-size: 10px; font-family: var(--font-sans); stroke: none; }
.end-ok { fill: var(--end-fill); stroke: var(--end-stroke); stroke-width: 1.5; }
.end-bad { fill: var(--end-bad-fill); stroke: var(--status-error); stroke-width: 1.5; }
.end-t { fill: var(--fg-muted); font-size: 11px; }
.end-hole { fill: var(--bg-canvas); }
.st { fill: var(--st-fill); stroke: var(--st-stroke); stroke-width: 1.15; }
.st.entry { stroke: var(--st-entry-stroke); stroke-width: 1.75; }
.st.term { stroke: var(--st-term-stroke); stroke-width: 1.75; }
.st-t { fill: var(--fg-default); font-size: 12px; font-weight: 500; }
.mach-title { fill: var(--fg-muted); font-size: 12px; font-weight: 600; }
.mach-legend { fill: var(--fg-subtle); font-size: 10px; }
.edge-cap { fill: var(--bg-surface); stroke: var(--border-default); stroke-width: 1; }
.edge-title { fill: var(--fg-default); font-size: 11px; font-weight: 600; }
.edge-note { fill: var(--fg-subtle); font-size: 10px; }
.fx-pill { fill: var(--bg-sunken); stroke: var(--border-default); stroke-width: 1; }
.fx-pill-t { fill: var(--fg-muted); font-size: 9px; font-weight: 600; }

.gesture-hint {
  display: none;
  position: absolute; z-index: 15; left: 50%; bottom: 16px;
  transform: translateX(-50%);
  max-width: calc(100% - 24px);
  padding: 8px 12px; border-radius: var(--radius-pill);
  border: 1px solid var(--border-default);
  background: color-mix(in srgb, var(--bg-elevated) 92%, transparent);
  color: var(--fg-muted); font: 600 12px var(--font-sans);
  pointer-events: none; text-align: center;
  box-shadow: var(--shadow-sm);
}
.gesture-hint[hidden] { display: none !important; }

@media (max-width: 860px), ((pointer: coarse) and (hover: none)) {
  .app {
    grid-template-columns: 1fr;
    grid-template-rows: auto 1fr auto;
    grid-template-areas:
      "top"
      "view"
      "dock";
  }
  .top {
    padding: 6px 12px 6px;
    gap: 6px;
  }
  .top-row { gap: 6px; width: 100%; min-width: 0; }
  .brand { flex: 1 1 100%; min-width: 0; width: 100%; }
  .brand .fl-title {
    font-size: 14px;
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .brand .fl-scenario {
    white-space: nowrap; max-width: 100%;
    font-size: 11px;
  }
  .fl-toc {
    flex: 1 1 100%;
    display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 5px;
    width: 100%; min-width: 0;
  }
  .fl-toc button {
    height: 34px; padding: 0 6px; justify-content: center;
    font-size: 12px; min-width: 0; width: 100%;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .fl-toc button kbd { display: none; }
  .dock {
    border-bottom: 0;
    border-top: 1px solid var(--border-default);
    padding: 6px 12px calc(6px + env(safe-area-inset-bottom));
    min-width: 0;
  }
  .toolbar {
    width: 100%; min-width: 0;
    justify-content: flex-start;
    gap: 5px;
  }
  .toolbar button {
    height: 32px; min-width: 32px; padding: 0 8px;
    font-size: 12px; -webkit-tap-highlight-color: transparent;
  }
  .toolbar .zoom { min-width: 3rem; font-size: 12px; }
  .theme-cycle { width: 32px; height: 32px; margin-left: auto; }
  .theme-cycle svg { width: 16px; height: 16px; }
  .proc-open { height: 34px; }
  .proc-sheet {
    top: auto; bottom: 0; left: 0; right: 0; transform: none;
    width: 100%; max-height: min(82dvh, 720px);
    border-radius: 16px 16px 0 0;
    padding-bottom: env(safe-area-inset-bottom);
  }
  .hint-bar { display: none; }
  .gesture-hint { display: block; }
  #fl-viewport {
    scrollbar-gutter: auto;
    touch-action: pan-x pan-y;
    -webkit-overflow-scrolling: touch;
  }
  #fl-stage { padding: 16px; }
  .sheet { padding: 10px 12px; border-radius: 10px; }
}

@media (max-width: 860px) and (max-height: 500px) {
  .brand .fl-scenario { display: none; }
  .fl-toc button { height: 30px; }
  .toolbar button { height: 28px; }
  .theme-cycle { width: 28px; height: 28px; }
  .top { padding: 4px 10px; gap: 4px; }
  .gesture-hint { display: none; }
}

@media (pointer: coarse) {
  .fl-toc button, .toolbar button, .theme-cycle {
    -webkit-tap-highlight-color: transparent;
  }
  .fl-toc button:active, .toolbar button:active, .theme-cycle:active {
    filter: brightness(1.08);
  }
}
</style>
</head>
<body data-look="line">
  <div class="app">
    <header class="top">
      <div class="top-row">
        <div class="brand">
          <h1 class="fl-title">${esc(initial.title)}</h1>
          <p class="fl-scenario">${esc(initial.scenario)}</p>
        </div>
        <nav class="fl-toc" role="tablist" aria-label="Camadas do fluxo">
          <button type="button" role="tab" data-tab="sequence" aria-selected="true" aria-controls="fl-sequence" title="Sequência (1)">Sequência <kbd>1</kbd></button>
          <button type="button" role="tab" data-tab="bpm" aria-selected="false" aria-controls="fl-bpm" title="Fluxo (2)">Fluxo <kbd>2</kbd></button>
          <button type="button" role="tab" data-tab="machines" aria-selected="false" aria-controls="fl-machines" title="Estados (3)">Estados <kbd>3</kbd></button>
        </nav>
      </div>
      <div class="hint-bar">
        <span class="val">Look A · Linha</span>
        <span class="fl-meta">
          <span><strong>Ator:</strong> <span id="fl-actor">${esc(initial.actor)}</span></span>
          <span><strong>Plano:</strong> ${esc(planTitle)}</span>
          <span><strong>Processos:</strong> ${catalog.length}</span>
        </span>
        <span id="tab-hint">Tronco + trilho XOR</span>
        <span>Arrastar = pan · <kbd>Ctrl</kbd>+scroll = zoom · <kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd> mapas</span>
      </div>
      ${
        catalog.length > 1
          ? `<button type="button" class="proc-open" id="proc-open" aria-haspopup="listbox" aria-expanded="false" aria-controls="proc-overlay">
        <span class="proc-open-kicker">Processo</span>
        <span class="proc-open-label" id="proc-current">${esc(initial.title)}</span>
        <span class="proc-open-meta"><span id="proc-n">${catalog.length}</span> ▾</span>
      </button>`
          : ''
      }
    </header>
    <div class="proc-overlay" id="proc-overlay" hidden>
      <div class="proc-sheet" role="dialog" aria-label="Processos do plano">
        <div class="proc-sheet-head">
          <input id="proc-q" type="search" placeholder="Buscar processo" autocomplete="off" enterkeyhint="search">
          <span id="proc-count">${catalog.length} processos</span>
          <button type="button" id="proc-close" aria-label="Fechar lista">×</button>
        </div>
        <div id="proc-list" role="listbox" aria-label="Lista de processos"></div>
      </div>
    </div>

    <div id="fl-viewport" title="Arraste para navegar · pinça ou Ctrl+scroll para zoom">
      <div id="fl-sizer">
        <div id="fl-stage"></div>
      </div>
      <div class="gesture-hint" id="gesture-hint">Arraste · pinça = zoom</div>
    </div>
    <footer class="dock">
      <div class="toolbar" aria-label="Zoom">
        <button type="button" id="z-out" title="Afastar">−</button>
        <span class="zoom" id="z-lab">100%</span>
        <button type="button" id="z-in" title="Aproximar">+</button>
        <button type="button" id="z-100">100%</button>
        <button type="button" id="z-fit" class="primary" data-fit="height" title="Ajustar à altura">À altura</button>
        <button type="button" id="btn-pdf" title="Baixar PDF do fluxo (anexo)">PDF</button>
        <button type="button" class="theme-cycle" id="theme-cycle" data-theme-cycle data-mode="system" aria-label="Aparência: automático. Toque para claro" title="Aparência: automático. Toque para claro">
          <svg class="i-system" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.75"/><path d="M12 3a9 9 0 0 0 0 18V3z" fill="currentColor"/></svg>
          <svg class="i-light" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="1.75"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/></svg>
          <svg class="i-dark" viewBox="0 0 24 24" aria-hidden="true"><path d="M15.2 3.2a8.5 8.5 0 1 0 5.6 14.3A8.5 8.5 0 0 1 15.2 3.2z" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linejoin="round"/></svg>
        </button>
      </div>
    </footer>
  </div>
  <div id="actor-tip" hidden></div>
  ${packHtml}
<script type="application/json" id="fl-catalog">${catalogJson}</script>
<script>
__PDF_LIB__
(function () {
  const catalog = JSON.parse(document.getElementById('fl-catalog').textContent);
  const tabs = [...document.querySelectorAll('.fl-toc [data-tab]')];
  let panels = [];
  const stage = document.getElementById('fl-stage');
  const viewport = document.getElementById('fl-viewport');
  const sizer = document.getElementById('fl-sizer');
  const lab = document.getElementById('z-lab');
  const hint = document.getElementById('tab-hint');
  const tip = document.getElementById('actor-tip');
  const HINTS = {
    sequence: 'Tronco + trilho XOR',
    bpm: 'Caixa / losango / fim · sem id técnico',
    machines: 'Laço = permanece · pastilha = efeito',
  };
  const MIN = ${FLOW_ZOOM_MIN}, MAX = ${FLOW_ZOOM_MAX}, STEP = 0.1;
  const phoneUi = window.matchMedia('(max-width: 860px), (pointer: coarse) and (hover: none)').matches;
  const PAD = phoneUi ? 16 : 40;
  const planId = document.documentElement.getAttribute('data-fl-plan') || 'preview';
  const PROC_KEY = 'as-flow-process:' + planId;
  function zoomKeyFor(slug) {
    return ${JSON.stringify(FLOW_ZOOM_KEY_PREFIX)} + (slug || 'default') + (phoneUi ? ':m' : '');
  }
  let zoomKey = zoomKeyFor(document.documentElement.getAttribute('data-fl-slug') || 'default');
  function readZoom() {
    try {
      const n = parseFloat(localStorage.getItem(zoomKey));
      if (Number.isFinite(n)) return Math.min(MAX, Math.max(MIN, n));
    } catch (e) {}
    return null;
  }
  function saveZoom() {
    try { localStorage.setItem(zoomKey, String(scale)); } catch (e) {}
  }
  let scale = 1;

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
  function fitScale(axis) {
    const n = svgNative(visibleSvg());
    if (!n.w || !n.h) return 1;
    const fitX = (viewport.clientWidth - 24) / (n.w + PAD * 2 + 40);
    const fitY = (viewport.clientHeight - 24) / (n.h + PAD * 2 + 36);
    const next = axis === 'height' ? fitY : fitX;
    return Math.max(MIN, Math.min(MAX, next));
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
  function showTab(name, opts) {
    tabs.forEach((t) => t.setAttribute('aria-selected', String(t.dataset.tab === name)));
    panels.forEach((p) => {
      const on = p.dataset.surface === name;
      p.hidden = !on;
      p.setAttribute('aria-hidden', String(!on));
    });
    if (hint) hint.textContent = HINTS[name] || '';
    if (tip) tip.hidden = true;
    requestAnimationFrame(function () {
      if (phoneUi && !(opts && opts.keepZoom)) scale = fitScale('width');
      centerHorizontally(0);
    });
  }
  tabs.forEach((t) => t.addEventListener('click', () => showTab(t.dataset.tab)));

  function itemBySlug(slug) {
    return catalog.find((c) => c.slug === slug) || catalog[0];
  }
  function currentSlug() {
    return document.documentElement.getAttribute('data-fl-slug') || (catalog[0] && catalog[0].slug) || '';
  }
  function foldTxt(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }
  const overlay = document.getElementById('proc-overlay');
  const procOpen = document.getElementById('proc-open');
  const procQ = document.getElementById('proc-q');
  const procList = document.getElementById('proc-list');
  const procCount = document.getElementById('proc-count');
  function closeProc() {
    if (!overlay) return;
    overlay.hidden = true;
    if (procOpen) procOpen.setAttribute('aria-expanded', 'false');
  }
  function renderProcList(q) {
    if (!procList) return;
    const needle = foldTxt(q);
    const slug = currentSlug();
    const hits = catalog.filter((c) => {
      if (!needle) return true;
      return foldTxt([c.title, c.scenario, c.actor, c.slug].join(' ')).includes(needle);
    });
    if (procCount) {
      procCount.textContent = hits.length === catalog.length
        ? catalog.length + ' processos'
        : hits.length + ' de ' + catalog.length;
    }
    procList.replaceChildren();
    if (!hits.length) {
      const empty = document.createElement('div');
      empty.className = 'proc-empty';
      empty.textContent = 'Nenhum processo com esse nome';
      procList.appendChild(empty);
      return;
    }
    hits.forEach((c) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'proc-item';
      b.setAttribute('role', 'option');
      b.dataset.slug = c.slug;
      b.setAttribute('aria-selected', String(c.slug === slug));
      const t = document.createElement('span');
      t.className = 'proc-item-title';
      t.textContent = c.title;
      const s = document.createElement('span');
      s.className = 'proc-item-sub';
      s.textContent = (c.actor || '') + (c.scenario ? ' · ' + c.scenario : '');
      b.append(t, s);
      b.addEventListener('click', () => mountProcess(c.slug));
      procList.appendChild(b);
    });
  }
  function openProc() {
    if (!overlay) return;
    overlay.hidden = false;
    if (procOpen) procOpen.setAttribute('aria-expanded', 'true');
    renderProcList(procQ ? procQ.value : '');
    if (procQ) {
      procQ.value = procQ.value;
      setTimeout(() => procQ.focus(), 20);
    }
    const sel = procList && procList.querySelector('[aria-selected="true"]');
    if (sel) sel.scrollIntoView({ block: 'nearest' });
  }
  function mountProcess(slug) {
    const item = itemBySlug(slug);
    if (!item) return;
    const tpl = document.getElementById('pack-' + item.pack);
    if (!tpl) return;
    const keepTab = (document.querySelector('.fl-toc [aria-selected="true"]') || {}).dataset
      ? document.querySelector('.fl-toc [aria-selected="true"]').dataset.tab
      : 'sequence';
    stage.innerHTML = '';
    stage.appendChild(tpl.content.cloneNode(true));
    panels = [...stage.querySelectorAll('.fl-surface[data-surface]')];
    document.documentElement.setAttribute('data-fl-slug', item.slug);
    zoomKey = zoomKeyFor(item.slug);
    const saved = readZoom();
    scale = saved == null ? 1 : saved;
    const titleEl = document.querySelector('.fl-title');
    const scEl = document.querySelector('.fl-scenario');
    const cur = document.getElementById('proc-current');
    const actorEl = document.getElementById('fl-actor');
    if (titleEl) titleEl.textContent = item.title;
    if (scEl) scEl.textContent = item.scenario || '';
    if (cur) cur.textContent = item.title;
    if (actorEl) actorEl.textContent = item.actor || '';
    document.title = item.title;
    try { localStorage.setItem(PROC_KEY, item.slug); } catch (e) {}
    const nextHash = '#p=' + encodeURIComponent(item.slug);
    if (location.hash !== nextHash) history.replaceState(null, '', nextHash);
    closeProc();
    showTab(keepTab || 'sequence', { keepZoom: true });
    if (saved == null && phoneUi) {
      requestAnimationFrame(function () {
        scale = fitScale('width');
        centerHorizontally(0);
      });
    }
  }
  if (procOpen) procOpen.addEventListener('click', () => {
    if (overlay && !overlay.hidden) closeProc();
    else openProc();
  });
  const procClose = document.getElementById('proc-close');
  if (procClose) procClose.addEventListener('click', closeProc);
  if (overlay) overlay.addEventListener('click', (e) => { if (e.target === overlay) closeProc(); });
  if (procQ) procQ.addEventListener('input', () => renderProcList(procQ.value));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && overlay && !overlay.hidden) {
      e.preventDefault();
      closeProc();
    }
  });

  document.getElementById('z-in').onclick = () => setScale(scale + STEP);
  document.getElementById('z-out').onclick = () => setScale(scale - STEP);
  document.getElementById('z-100').onclick = () => { scale = 1; centerHorizontally(0); saveZoom(); };
  document.getElementById('z-fit').onclick = () => {
    const btn = document.getElementById('z-fit');
    const axis = btn.getAttribute('data-fit') === 'width' ? 'width' : 'height';
    scale = fitScale(axis);
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
    '.bar{fill:#4a5565}',
    '.evt{fill:#ffffff;stroke:#e08a8a;stroke-width:1.5}',
    '.sub-mark{fill:none;stroke:#d5dce6;stroke-width:1}',
    '.edge{stroke:#98a1ad;stroke-width:1.15;fill:none}',
    '.edge.back{stroke:#b8860b;stroke-dasharray:4 3}',
    '.edge-head{fill:#4a5565}',
    '.edge-head.back{fill:#b8860b}',
    '.edge-t,.fx{fill:#6b7585;font-size:11px;paint-order:stroke;stroke:#ffffff;stroke-width:4px;stroke-linejoin:round}',
    '.fx{font-size:10px;font-family:ui-monospace,monospace}',
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
    '.mach-legend{fill:#6b7585;font-size:10px}',
    '.edge-cap{fill:#ffffff;stroke:#d5dce6;stroke-width:1}',
    '.edge-title{fill:#12161d;font-size:11px;font-weight:600}',
    '.edge-note{fill:#6b7585;font-size:10px}',
    '.fx-pill{fill:#e8edf4;stroke:#d5dce6;stroke-width:1}',
    '.fx-pill-t{fill:#4a5565;font-size:9px;font-weight:600}',
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
        ['mach-svg', 'Estados'],
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
      const url = URL.createObjectURL(blob);
      const name = pdfFilename(slug);
      const isiOS = /iP(ad|hone|od)/.test(navigator.userAgent) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      if (isiOS) {
        const opened = window.open(url, '_blank');
        if (!opened) location.href = url;
      } else {
        const a = document.createElement('a');
        a.href = url;
        a.download = name;
        a.click();
      }
      setTimeout(() => URL.revokeObjectURL(url), 60000);
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

  const gHint = document.getElementById('gesture-hint');
  function hideGestureHint() {
    if (gHint) gHint.hidden = true;
  }
  if (gHint && phoneUi) setTimeout(hideGestureHint, 4200);

  function showActorTip(hit, x, y) {
    if (!tip || !hit) return;
    tip.hidden = false;
    tip.textContent = hit.getAttribute('data-actor-label') || '';
    const tw = 12;
    tip.style.left = Math.min(window.innerWidth - 8, Math.max(8, x + tw)) + 'px';
    tip.style.top = Math.min(window.innerHeight - 8, Math.max(8, y + tw)) + 'px';
  }

  let pan = false, sx = 0, sy = 0, sl = 0, st = 0;
  viewport.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'touch') return;
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
    if (e.pointerType === 'touch') return;
    const hit = e.target && e.target.closest && e.target.closest('[data-actor-label]');
    if (!hit) { if (tip) tip.hidden = true; return; }
    showActorTip(hit, e.clientX, e.clientY);
  });
  viewport.addEventListener('click', (e) => {
    const hit = e.target && e.target.closest && e.target.closest('[data-actor-label]');
    if (!hit) { if (tip) tip.hidden = true; return; }
    if (!phoneUi) return;
    showActorTip(hit, e.clientX, e.clientY);
    setTimeout(() => { if (tip) tip.hidden = true; }, 2200);
  });
  viewport.addEventListener('pointerleave', () => { if (tip) tip.hidden = true; });
  viewport.addEventListener('scroll', () => { updateStickyActors(); hideGestureHint(); }, { passive: true });
  const endPan = (e) => {
    if (!pan) return;
    pan = false;
    viewport.classList.remove('is-panning');
    try { viewport.releasePointerCapture(e.pointerId); } catch (err) {}
  };
  viewport.addEventListener('pointerup', endPan);
  viewport.addEventListener('pointercancel', endPan);

  function touchDist(a, b) {
    const dx = a.clientX - b.clientX;
    const dy = a.clientY - b.clientY;
    return Math.hypot(dx, dy);
  }
  let pinch = null;
  let gestureBase = null;
  let usingGesture = false;
  viewport.addEventListener('touchstart', (e) => {
    hideGestureHint();
    if (e.touches.length === 2) {
      pinch = {
        d: touchDist(e.touches[0], e.touches[1]),
        scale,
      };
    }
  }, { passive: true });
  viewport.addEventListener('touchmove', (e) => {
    if (usingGesture || e.touches.length !== 2 || !pinch || pinch.d < 1) return;
    e.preventDefault();
    const d = touchDist(e.touches[0], e.touches[1]);
    const mid = {
      clientX: (e.touches[0].clientX + e.touches[1].clientX) / 2,
      clientY: (e.touches[0].clientY + e.touches[1].clientY) / 2,
    };
    setScale(pinch.scale * (d / pinch.d), mid);
  }, { passive: false });
  viewport.addEventListener('touchend', (e) => {
    if (e.touches.length < 2) pinch = null;
  });
  viewport.addEventListener('gesturestart', (e) => {
    e.preventDefault();
    usingGesture = true;
    gestureBase = scale;
  }, { passive: false });
  viewport.addEventListener('gesturechange', (e) => {
    e.preventDefault();
    if (gestureBase == null) return;
    setScale(gestureBase * e.scale, e);
  }, { passive: false });
  viewport.addEventListener('gestureend', () => {
    usingGesture = false;
    gestureBase = null;
  });
  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey) {
      if (e.key === '=' || e.key === '+') { e.preventDefault(); setScale(scale + STEP); }
      if (e.key === '-') { e.preventDefault(); setScale(scale - STEP); }
      if (e.key === '0') { e.preventDefault(); scale = 1; centerHorizontally(0); saveZoom(); }
      return;
    }
    if (e.altKey || e.repeat) return;
    const typing = e.target && e.target.closest && e.target.closest('input, textarea, select, [contenteditable="true"]');
    if (typing) return;
    const name = { 1: 'sequence', 2: 'bpm', 3: 'machines' }[e.key];
    if (!name) return;
    if (!document.querySelector('.fl-toc [data-tab="' + name + '"]')) return;
    e.preventDefault();
    showTab(name);
  });
  window.addEventListener('resize', () => applyStageGeometry());
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', () => applyStageGeometry());
  }
  function bootSlug() {
    let hash = '';
    try {
      hash = decodeURIComponent((location.hash.match(/^#p=(.+)$/) || [])[1] || '');
    } catch (e) {}
    let saved = '';
    try { saved = localStorage.getItem(PROC_KEY) || ''; } catch (e) {}
    const want = hash || saved || (catalog[0] && catalog[0].slug) || '';
    return catalog.some((c) => c.slug === want) ? want : (catalog[0] && catalog[0].slug) || '';
  }
  if (catalog.length) mountProcess(bootSlug());
})();
</script>
</body>
</html>
`;
}

function packFromRaw(raw) {
  const normalized = normalizeFlow(raw);
  return {
    slug: normalized.planSlug,
    title: normalized.title,
    scenario: normalized.scenario,
    actor: normalized.actor,
    pack: normalized.planSlug,
    seq: drawSequence(normalized, walkSteps(normalized)),
    bpm: drawBpm(normalized),
    mach: drawMachines(normalized),
  };
}

function loadJsonFlows(dir) {
  let names = [];
  try {
    names = readdirSync(dir).filter((n) => n.endsWith('.json'));
  } catch {
    return [];
  }
  const out = [];
  for (const name of names) {
    try {
      const raw = JSON.parse(readFileSync(join(dir, name), 'utf8'));
      if (!raw || raw.schemaVersion !== '1.0' || !raw.graph || !raw.planSlug) continue;
      out.push(packFromRaw(raw));
    } catch (err) {
      console.warn(`skip ${join(dir, name)}: ${err.message}`);
    }
  }
  return out;
}

function makeXorRaw({ slug, title, scenario, actor }) {
  return {
    schemaVersion: '1.0',
    planSlug: slug,
    title,
    scenario,
    actor,
    audience: 'both',
    actors: [
      { id: 'A', label: actor, kind: 'actor' },
      { id: 'S', label: 'Sistema', kind: 'participant' },
    ],
    graph: {
      entry: 'S1',
      nodes: {
        S1: {
          type: 'activity',
          label: title,
          who: actor,
          messages: [{ from: 'A', to: 'S', text: `Inicia ${title.toLowerCase()}`, async: false }],
          next: 'D1',
        },
        D1: {
          type: 'xor',
          label: 'Conclui?',
          who: actor,
          question: 'Conclui este processo?',
          branches: [
            { id: 'D1.yes', when: 'sim', label: 'Sim', next: 'end_ok' },
            { id: 'D1.no', when: 'nao', label: 'Não', next: 'end_no' },
          ],
        },
        end_ok: { type: 'end', label: 'Concluído' },
        end_no: { type: 'end', label: 'Interrompido' },
      },
    },
    machines: [
      {
        id: 'm',
        label: title,
        entry: 'aberto',
        nodes: {
          aberto: { label: 'Aberto' },
          ok: { label: 'Concluído', terminal: true },
          no: { label: 'Interrompido', terminal: true },
        },
        transitions: [
          {
            id: 'T_ok',
            from: 'aberto',
            to: 'ok',
            when: 'sim',
            label: 'Conclui',
            via: 'D1.yes',
            effects: [],
          },
          {
            id: 'T_no',
            from: 'aberto',
            to: 'no',
            when: 'nao',
            label: 'Interrompe',
            via: 'D1.no',
            effects: [],
          },
        ],
      },
    ],
  };
}

const EXTRA_SPECS = [
  ['cadastro-solicitante', 'Cadastro do solicitante', 'A pessoa se cadastra para abrir pedidos.', 'Solicitante'],
  ['validacao-email', 'Validação de e-mail', 'Confirma o endereço de e-mail do cadastro.', 'Solicitante'],
  ['encaminhar-area', 'Encaminhar à área', 'O pedido segue para a área responsável.', 'GETIN'],
  ['reuniao-comissao', 'Pauta da comissão', 'Inclui o item na pauta da reunião.', 'Secretaria'],
  ['publicar-ata', 'Publicar ata', 'A ata da reunião é publicada para os interessados.', 'Secretaria'],
  ['exportar-relatorio', 'Exportar relatório', 'Gera o relatório consolidado do período.', 'GETIN'],
  ['anexar-evidencia', 'Anexar evidência', 'O responsável anexa prova ao processo.', 'Líder'],
  ['deferir-recurso', 'Deferir recurso', 'O recurso apresentado é aceito.', 'Comissão'],
  ['indeferir-recurso', 'Indeferir recurso', 'O recurso apresentado é recusado.', 'Comissão'],
  ['solicitar-esclarecimento', 'Solicitar esclarecimento', 'Pede informação extra ao solicitante.', 'GETIN'],
  ['arquivar-processo', 'Arquivar processo', 'Encerra e arquiva o processo sem trâmite.', 'GETIN'],
  ['reabrir-processo', 'Reabrir processo', 'Tira o processo do arquivo e retoma o trâmite.', 'GETIN'],
  ['assinar-documento', 'Assinar documento', 'O responsável assina o documento gerado.', 'Líder'],
  ['notificar-interessados', 'Notificar interessados', 'Avisa quem acompanha o andamento.', 'Sistema'],
  ['atualizar-status', 'Atualizar status', 'Registra a mudança de situação do pedido.', 'Sistema'],
  ['homologar-resultado', 'Homologar resultado', 'A comissão homologa o resultado final.', 'Comissão'],
  ['devolver-exigencia', 'Devolver por exigência', 'Devolve o pedido para correção.', 'GETIN'],
  ['redistribuir-responsavel', 'Redistribuir responsável', 'Passa o pedido para outro responsável.', 'GETIN'],
  ['cancelar-tramite', 'Cancelar trâmite', 'Cancela o andamento a pedido do interessado.', 'Solicitante'],
  ['consultar-historico', 'Consultar histórico', 'Lê o histórico completo do processo.', 'Líder'],
];

const fromDogfood = loadJsonFlows(DOGFOOD);
const fromExtraDir = loadJsonFlows(EXTRA_DIR);
const fromSpecs = EXTRA_SPECS.map(([slug, title, scenario, actor]) => packFromRaw(makeXorRaw({ slug, title, scenario, actor })));

const bySlug = new Map();
for (const p of [...fromDogfood, ...fromExtraDir, ...fromSpecs]) {
  if (!bySlug.has(p.slug)) bySlug.set(p.slug, p);
}
const preferred = ['sugestao-necessidade-pdti', 'minimal-xor'];
const rest = [...bySlug.keys()].filter((s) => !preferred.includes(s)).sort();
const ordered = [...preferred.filter((s) => bySlug.has(s)), ...rest].map((s) => bySlug.get(s));

const catalog = ordered.map((p) => ({
  slug: p.slug,
  title: p.title,
  scenario: p.scenario,
  actor: p.actor,
  pack: p.pack,
}));
const packs = {};
for (const p of ordered) {
  packs[p.pack] = { seq: p.seq, bpm: p.bpm, mach: p.mach };
}

const initial = catalog[0] || { slug: 'vazio', title: 'Sem processo', scenario: '', actor: '' };
const html = pageHtml({
  planId: PLAN_ID,
  planTitle: PLAN_TITLE,
  catalog,
  packs,
  initial,
}).replace('__PDF_LIB__', PDF_LIB_SRC);

writeFileSync(OUT, html);
const first = packs[initial.pack] || { seq: '', bpm: '' };
const msgCount = (first.seq.match(/data-from="/g) || []).length;
const xorCount = (first.seq.match(/data-xor-rail="/g) || []).length;
console.log(
  `wrote ${OUT}\nprocesses=${catalog.length} packs=${Object.keys(packs).length} sequence messages=${msgCount} xor-rails=${xorCount} first=${initial.slug}`,
);
