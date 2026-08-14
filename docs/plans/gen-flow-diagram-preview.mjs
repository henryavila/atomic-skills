#!/usr/bin/env node
/**
 * Rebuild the Look A style preview from the PDTI dogfood graph
 * (docs/design/project-flow/dogfood/fluxo-sugestao.json). Fixture-only;
 * not the product engine.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeFlow } from '../../scripts/lib/render-flow.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const SRC = join(ROOT, 'docs/design/project-flow/dogfood/fluxo-sugestao.json');
const OUT = join(ROOT, 'docs/plans/2026-08-14-flow-diagram-engine-style-preview.html');

const ACTOR_W = 196;
const ROW = 36;
const GUTTER = 52;

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
    r.y = y;
    y += r.type === 'msg' ? ROW : 30;
  }
  const bodyBottom = y + 16;
  const height = bodyBottom + 44;

  const actorHeads = actors
    .map((a) => {
      const x = cx(a.id);
      return `<g data-actor-id="${esc(a.id)}">
        <rect class="actor-box" x="${x - 84}" y="16" width="168" height="34" rx="8"/>
        <text class="actor-label" x="${x}" y="38" text-anchor="middle">${esc(a.label)}</text>
        <line class="lifeline" data-lifeline="${esc(a.id)}" x1="${x}" y1="50" x2="${x}" y2="${bodyBottom}"/>
        <rect class="actor-box" x="${x - 84}" y="${bodyBottom + 8}" width="168" height="26" rx="8"/>
        <text class="actor-label" x="${x}" y="${bodyBottom + 26}" text-anchor="middle" style="font-size:11px">${esc(a.label)}</text>
      </g>`;
    })
    .join('\n');

  const bands = rows
    .filter((r) => r.type === 'xor-q')
    .map((r) => {
      const y0 = r.y - 16;
      const y1 = rows[r.end].y + 18;
      const inset = 8 + r.depth * 14;
      const railX = 22 + r.depth * 14;
      return `<g data-xor-rail="${esc(r.xorId)}">
        <rect class="xor-wash" x="${inset}" y="${y0}" width="${width - inset * 2}" height="${y1 - y0}" rx="10"/>
        <line class="xor-rail" x1="${railX}" y1="${y0 + 8}" x2="${railX}" y2="${y1 - 8}"/>
        <text class="xor-q" x="${railX + 16}" y="${r.y + 4}">◇ ${esc(r.question)}</text>
      </g>`;
    })
    .join('\n');

  const body = rows
    .map((r) => {
      if (r.type === 'msg') {
        const x1 = cx(r.from);
        const x2 = cx(r.to);
        const self = r.from === r.to;
        if (self) {
          const lines = wrap(r.text, 28);
          return `<g data-from="${esc(r.from)}" data-to="${esc(r.to)}" data-n="${r.n}">
          <text class="num" x="16" y="${r.y + 4}">${r.n}</text>
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
        return `<g data-from="${esc(r.from)}" data-to="${esc(r.to)}" data-n="${r.n}">
          <text class="num" x="16" y="${r.y + 4}">${r.n}</text>
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
        const yTip = target ? target.y - 2 : yTop;
        const xMid = Math.min(xFrom, xTip + 120) - 36;
        return `<g data-loop-ref="${esc(r.xorId)}">
          <path class="loop-arc" d="M${xFrom} ${yMsg} C${xMid} ${yMsg + 36}, ${xTip + 8} ${yTip + 64}, ${xTip} ${yTip + 10}"/>
          <polygon class="loop-head" points="${xTip},${yTip} ${xTip - 5},${yTip + 10} ${xTip + 6},${yTip + 8}"/>
        </g>`;
      }
      return '';
    })
    .join('\n');

  return `<svg class="diagram" id="seq-svg" data-surface="sequence" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" role="img">
    <title>Diagrama de sequência — PDTI</title>
    <desc>${esc(normalized.scenario)}</desc>
    ${actorHeads}
    ${bands}
    ${body}
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

  return `<svg class="diagram" id="bpm-svg" data-surface="bpm" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" role="img">
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

  return `<svg class="diagram" id="mach-svg" data-surface="machines" viewBox="0 0 780 280" xmlns="http://www.w3.org/2000/svg" role="img">
    <title>Máquina de estados — ${esc(m.label)}</title>
    <text class="mach-title" x="16" y="22">${esc(m.label)}</text>
    <g data-machine-id="${esc(m.id)}">
      ${edgeSvg}
      ${states}
    </g>
  </svg>`;
}

const raw = JSON.parse(readFileSync(SRC, 'utf8'));
const normalized = normalizeFlow(raw);
const steps = walkSteps(normalized);
const seq = drawSequence(normalized, steps);
const bpm = drawBpm(normalized);
const mach = drawMachines(normalized);

let html = readFileSync(OUT, 'utf8');
html = html
  .replace(
    /<h1 class="fl-title">[\s\S]*?<\/h1>/,
    `<h1 class="fl-title">${esc(normalized.title)}</h1>`,
  )
  .replace(
    /<p class="fl-scenario">[\s\S]*?<\/p>/,
    `<p class="fl-scenario">${esc(normalized.scenario)}</p>`,
  )
  .replace(
    /<span><strong>Ator:<\/strong>[\s\S]*?<\/span>\s*<span><strong>Plano:<\/strong>[\s\S]*?<\/span>/,
    `<span><strong>Ator:</strong> ${esc(normalized.actor)}</span>\n      <span><strong>Plano:</strong> ${esc(normalized.planSlug)}</span>`,
  )
  .replace(
    /<svg class="diagram" id="seq-svg"[\s\S]*?<\/svg>/,
    seq,
  )
  .replace(
    /<svg class="diagram" id="bpm-svg"[\s\S]*?<\/svg>/,
    bpm,
  )
  .replace(
    /<svg class="diagram" id="mach-svg"[\s\S]*?<\/svg>/,
    mach,
  )
  .replace(
    /Prévia estática \(não é o engine\)\.[\s\S]*?<\/p>/,
    `Prévia do grafo PDTI <code>fluxo-sugestao.json</code> (já no MODEL 1.0: activity / xor / end + machine). 28 mensagens, 3 XOR, loop S1e→D1, 4 estados. Não é o engine.</p>`,
  );

writeFileSync(OUT, html);
const msgCount = (seq.match(/data-n="/g) || []).length;
const xorCount = (seq.match(/data-xor-rail="/g) || []).length;
console.log(`wrote ${OUT}\nsequence messages=${msgCount} xor-rails=${xorCount} bpm-nodes=${(bpm.match(/data-node-id=/g) || []).length}`);
