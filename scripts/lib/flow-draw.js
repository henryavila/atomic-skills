/**
 * Layout boxes → SVG strings. Look A · Linha. Tokens only from ds.css names.
 */
import {
  GEOM,
  layoutSequence,
  layoutBpm,
  layoutMachines,
  nodeMetrics,
  wrap,
} from './flow-layout.js';

const KIND_PT = {
  write: 'Grava',
  email: 'E-mail',
  notify: 'Avisa',
};

export function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function actorChip(id, label, x, y) {
  return `<g data-actor-id="${esc(id)}">
        <rect class="actor-box" x="${x - GEOM.actorBoxW / 2}" y="${y}" width="${GEOM.actorBoxW}" height="${GEOM.actorBoxH}" rx="8"/>
        <text class="actor-label" x="${x}" y="${y + 18}" text-anchor="middle">${esc(label)}</text>
      </g>`;
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
  const pts = pathPoints(d);
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
      bottom: { x, y: 8 + y },
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

function routeOrthogonal(from, to, kind, lane = 0) {
  const a = bpmPorts(from);
  const b = bpmPorts(to);
  if (kind === 'back') {
    const p1 = a.left;
    const p2 = b.left;
    const side = Math.min(p1.x, p2.x) - 52 - lane * 20;
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
    if (
      Math.abs(p1.x - a.left.x) < 1
      || Math.abs(p1.x - a.right.x) < 1
      || (from.type === 'xor' && Math.abs(dx) > 30)
    ) {
      return `M${p1.x} ${p1.y} L${p2.x} ${p1.y} L${p2.x} ${p2.y}`;
    }
    const midY = (p1.y + p2.y) / 2;
    return `M${p1.x} ${p1.y} L${p1.x} ${midY} L${p2.x} ${midY} L${p2.x} ${p2.y}`;
  }
  const midY = Math.max(p1.y, p2.y) + 24;
  return `M${p1.x} ${p1.y} L${p1.x} ${midY} L${p2.x} ${midY} L${p2.x} ${p2.y}`;
}

export function drawSequenceSvg(layout) {
  const { actors, rows, width, height, bodyBottom, title, scenario } = layout;
  const cx = (id) => {
    const found = actors.find((a) => a.id === id);
    return found ? found.x : GEOM.gutter + GEOM.actorWidth / 2;
  };
  const xorQs = rows.filter((r) => r.type === 'xor-q');
  const washes = xorQs
    .filter((r) => r.depth === 0)
    .map((r) => {
      const y0 = r.y - GEOM.blockLead;
      const y1 = rows[r.end]?.y + 18 || r.y + 18;
      const inset = 8;
      return `<rect class="xor-wash" x="${inset}" y="${y0}" width="${width - inset * 2}" height="${y1 - y0}" rx="10"/>`;
    })
    .join('\n');
  const rails = xorQs
    .map((r) => {
      const y0 = r.y - 16;
      const y1 = rows[r.end]?.y + 18 || r.y + 18;
      const railX = 22 + r.depth * 14;
      return `<g data-xor-rail="${esc(r.xorId)}">
        <line class="xor-rail" x1="${railX}" y1="${y0 + 8}" x2="${railX}" y2="${y1 - 8}"/>
        <text class="xor-q" x="${railX + 16}" y="${r.y + 4}">◇ ${esc(r.question)}</text>
      </g>`;
    })
    .join('\n');

  const lifelines = actors
    .map((a) => {
      const x = a.x;
      return `<g data-actor-id="${esc(a.id)}">
        <line class="lifeline" data-lifeline="${esc(a.id)}" x1="${x}" y1="50" x2="${x}" y2="${bodyBottom}"/>
        <line class="life-hit" data-actor-label="${esc(a.label)}" x1="${x}" y1="50" x2="${x}" y2="${bodyBottom}"/>
      </g>`;
    })
    .join('\n');

  const actorFeet = actors.map((a) => actorChip(a.id, a.label, a.x, bodyBottom + 8)).join('\n');
  const stickH = GEOM.stickPad + GEOM.actorBoxH + GEOM.stickPad;
  const actorStick = `<g data-actor-stick>
    <rect class="actor-stick-bg" x="0" y="0" width="${width}" height="${stickH}"/>
    <line class="actor-stick-rule" x1="0" y1="${stickH - 0.5}" x2="${width}" y2="${stickH - 0.5}"/>
    ${actors.map((a) => actorChip(a.id, a.label, a.x, GEOM.stickPad)).join('\n')}
  </g>`;

  const body = rows
    .map((r) => {
      if (r.type === 'msg') {
        const x1 = cx(r.from);
        const x2 = cx(r.to);
        const self = r.from === r.to;
        if (self) {
          const lines = wrap(r.text, r.wrapCols || 28, 20);
          return `<g data-from="${esc(r.from)}" data-to="${esc(r.to)}">
          <circle cx="${x1}" cy="${r.y}" r="3" class="arrow-head"/>
          ${lines.map((ln, i) => `<text class="msg" x="${x1 + 10}" y="${r.y + 4 + i * 12}">${esc(ln)}</text>`).join('')}
        </g>`;
        }
        const dir = x2 >= x1 ? 1 : -1;
        const xStart = x1 + 8 * dir;
        const xEnd = x2 - 8 * dir;
        const lines = wrap(r.text, r.wrapCols || 32, 20);
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
    <title>Diagrama de sequência — ${esc(title)}</title>
    <desc>${esc(scenario)}</desc>
    ${washes}
    ${lifelines}
    ${rails}
    ${body}
    ${actorFeet}
    ${actorStick}
  </svg>`;
}

export function drawBpmSvg(layout) {
  const { nodes, edges, width, height, title } = layout;
  const nodeSvg = Object.values(nodes)
    .map((b) => {
      const { x, y } = b;
      if (b.type === 'xor') {
        const m = nodeMetrics(b);
        const hw = m.w / 2;
        const hh = m.h / 2;
        const pts = `${x},${y} ${x + hw},${y + hh} ${x},${y + hh * 2} ${x - hw},${y + hh}`;
        const q = `${String(b.label || b.question || '').replace(/\?$/, '')}?`;
        const lines = wrap(q, 16, 3);
        const items = [
          ...lines.map((ln) => ({ text: ln, cls: 'xor-t', h: 14 })),
          ...(b.who ? [{ text: b.who, cls: 'who', h: 12 }] : []),
        ];
        return `<g data-node-id="${esc(b.id)}" data-node-type="${esc(b.type)}" data-shape="diamond">
          <polygon class="diamond" points="${pts}"/>
          ${stackInBox(x, y, m.h, items)}
        </g>`;
      }
      if (b.type === 'and' || b.type === 'join') {
        return `<g data-node-id="${esc(b.id)}" data-node-type="${esc(b.type)}" data-shape="bar">
          <rect class="bar" x="${x - 18}" y="${y}" width="36" height="8" rx="2"/>
        </g>`;
      }
      if (b.type === 'event') {
        return `<g data-node-id="${esc(b.id)}" data-node-type="${esc(b.type)}" data-shape="circle">
          <circle class="evt" cx="${x}" cy="${y + 14}" r="12"/>
          <text class="end-t" x="${x}" y="${y + 40}" text-anchor="middle">${esc(b.label)}</text>
        </g>`;
      }
      if (b.type === 'end') {
        const ok = b.outcome !== 'other';
        const cls = ok ? 'end-ok' : 'end-bad';
        return `<g data-node-id="${esc(b.id)}" data-node-type="${esc(b.type)}" data-shape="circle">
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
      return `<g data-node-id="${esc(b.id)}" data-node-type="${esc(b.type)}" data-shape="rect"${nextAttr}>
        <rect class="act" x="${x - 100}" y="${y}" width="200" height="${h}" rx="8"/>
        ${mark}
        ${stackInBox(x, y, h, items)}
      </g>`;
    })
    .join('\n');

  const routed = edges
    .map((e) => {
      const a = nodes[e.from];
      const b = nodes[e.to];
      if (!a || !b) return null;
      const d = routeOrthogonal(a, b, e.kind, e.lane || 0);
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
        return lines.map((ln, i) => haloText('edge-t', mid.x, y0 + i * 12, ln, 'middle')).join('');
      }
      return lines.map((ln, i) => haloText('edge-t', mid.x + 8, mid.y + i * 12, ln, 'start')).join('');
    })
    .join('\n');

  return `<svg class="diagram" id="bpm-svg" data-surface="bpm" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" role="img">
    <title>Diagrama de processo — ${esc(title)}</title>
    ${edgeSvg}
    ${nodeSvg}
    ${headSvg}
    ${labelSvg}
  </svg>`;
}

function estW(s, px = 11) {
  return Math.ceil(String(s || '').length * px * 0.58);
}

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
  const s = String(label || '');
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
  return { titleLines, fxRows, w: inner + padX * 2, h, padX, padY, fxGap };
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

function selfPath(p, side) {
  const W = p.w;
  const H = p.h;
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
  if (side === 'bottom' || side === 'bottom-left' || side === 'bottom-right') {
    const cx = p.x + (side === 'bottom-left' ? W * 0.28 : side === 'bottom-right' ? W * 0.72 : W / 2);
    const drop = p.y + H + 36;
    return {
      d: `M${cx - 10} ${p.y + H} C${cx - 20} ${drop}, ${cx + 20} ${drop}, ${cx + 10} ${p.y + H}`,
      lx: cx,
      ly: drop + 6,
      place: 'below',
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

export function drawMachinesSvg(layout) {
  const machines = layout.machines || [];
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

  for (const [idx, one] of machines.entries()) {
    const { states, edges } = one;
    const edgeParts = [];
    const headParts = [];
    const caps = [];

    for (const p of Object.values(states)) union(p.x, p.y, p.w, p.h);

    for (const tr of edges) {
      const a = states[tr.from];
      const b = states[tr.to];
      if (!a) continue;
      if (tr.kind === 'loop') {
        const routed = selfPath(a, tr.side || 'top');
        edgeParts.push(`<path class="edge" d="${routed.d}"/>`);
        headParts.push(arrowPoly(routed.d));
        const box = captionBox(tr, routed.lx, routed.ly, routed.place);
        caps.push(box);
        union(box.x, box.y, box.w, box.h);
        continue;
      }
      if (!b) continue;
      if (tr.kind === 'down') {
        const d = `M${a.x + a.w / 2} ${a.y + a.h} L${b.x + b.w / 2} ${b.y}`;
        edgeParts.push(`<path class="edge" d="${d}"/>`);
        headParts.push(arrowPoly(d));
        const box = captionBox(tr, a.x + a.w / 2 + 12, (a.y + a.h + b.y) / 2, 'right');
        caps.push(box);
        union(box.x, box.y, box.w, box.h);
        continue;
      }
      if (tr.kind === 'back') {
        const side = Math.min(a.x, b.x) - 36;
        const d = `M${a.x} ${a.y + a.h / 2} L${side} ${a.y + a.h / 2} L${side} ${b.y + b.h / 2} L${b.x} ${b.y + b.h / 2}`;
        edgeParts.push(`<path class="edge back" d="${d}"/>`);
        headParts.push(arrowPoly(d, 'edge-head back'));
        const box = captionBox(tr, side - 8, (a.y + b.y) / 2, 'left');
        caps.push(box);
        union(box.x, box.y, box.w, box.h);
        continue;
      }
      const d = `M${a.x + a.w} ${a.y + a.h / 2} L${b.x} ${b.y + b.h / 2}`;
      edgeParts.push(`<path class="edge" d="${d}"/>`);
      headParts.push(arrowPoly(d));
      const box = captionBox(tr, (a.x + a.w + b.x) / 2, a.y - 10, 'above');
      caps.push(box);
      union(box.x, box.y, box.w, box.h);
    }

    const stateSvg = Object.values(states)
      .map((p) => {
        const cls = `st${p.entry ? ' entry' : ''}${p.terminal ? ' term' : ''}`;
        const inner = p.terminal
          ? `<rect class="st term" x="${p.x + 3}" y="${p.y + 3}" width="${p.w - 6}" height="${p.h - 6}" rx="13" fill="none"/>`
          : '';
        return `<g data-state-id="${esc(p.id)}">
        <rect class="${cls}" x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" rx="16"/>
        ${inner}
        <text class="st-t" x="${p.x + p.w / 2}" y="${p.y + p.h / 2}" text-anchor="middle" dominant-baseline="central">${esc(p.label)}</text>
      </g>`;
      })
      .join('\n');

    const titleY = idx === 0 ? 16 : Math.min(...Object.values(states).map((p) => p.y)) - 88;
    union(16, titleY - 12, 360, 36);
    groups.push(`<g data-machine-id="${esc(one.id)}">
      <text class="mach-title" x="16" y="${titleY}">${esc(one.label)}</text>
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
  const heading = machines[0]?.label || layout.title || 'Estados';
  return `<svg class="diagram" id="mach-svg" data-surface="machines" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" role="img">
    <title>Diagrama de estados — ${esc(heading)}</title>
    <g${shift}>
    ${groups.join('\n')}
    </g>
  </svg>`;
}

export function drawSequence(normalized) {
  return drawSequenceSvg(layoutSequence(normalized));
}

export function drawBpm(normalized) {
  return drawBpmSvg(layoutBpm(normalized));
}

export function drawMachines(normalized) {
  return drawMachinesSvg(layoutMachines(normalized));
}
