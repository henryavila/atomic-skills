/**
 * Deterministic layout for any MODEL flow graph.
 * Positions come from topology (types, next, branches, cycles, fan-in).
 * Document labels and node ids never change a placement rule.
 */

export const GEOM = {
  actorWidth: 196,
  actorBoxW: 168,
  actorBoxH: 26,
  stickPad: 8,
  actorHeader: 46,
  messageRow: 36,
  gutter: 52,
  blockLead: 18,
  rankGap: 56,
  branchGap: 36,
  bpmNodeW: 200,
  bpmNodeH: 48,
  colMin: 248,
  colGap: 24,
  pad: 40,
  machineW: 168,
  machineH: 32,
  machineGapX: 292,
  machineRowY: 188,
  machinePadX: 72,
  machinePadY: 168,
  machineTitle: 44,
  machineStack: 48,
};

const LOOP_SIDES = ['top-left', 'top', 'top-right', 'bottom-left', 'bottom', 'bottom-right'];
const SEQ_MSG_KINDS = new Set(['activity', 'event', 'subprocess', 'xor', 'and', 'join']);

export function wrap(text, max = 34, maxLines = 2) {
  const words = String(text ?? '').split(/\s+/);
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

export function nodeMetrics(node) {
  const type = node?.type;
  if (type === 'xor') {
    const q = `${String(node.label || node.question || '').replace(/\?$/, '')}?`;
    const lines = wrap(q, 16, 3);
    const extra = node.who ? 1 : 0;
    const h = Math.max(84, 28 + (lines.length + extra) * 16);
    const w = Math.max(200, ...lines.map((ln) => ln.length * 7 + 48));
    return { w, h };
  }
  if (type === 'and' || type === 'join') return { w: 36, h: 8 };
  if (type === 'end') return { w: 24, h: 44 };
  if (type === 'event') return { w: 28, h: 46 };
  const lines = wrap(node?.label, 22, 2).length;
  const extra = node?.who ? 1 : 0;
  return { w: 200, h: 18 + (lines + extra) * 14 + 10 };
}

export function boxRect(box) {
  const m = nodeMetrics(box);
  return { id: box.id, x: box.x - m.w / 2, y: box.y, w: m.w, h: m.h };
}

export function anyOverlap(rects, pad = 8) {
  for (let i = 0; i < rects.length; i += 1) {
    for (let j = i + 1; j < rects.length; j += 1) {
      const a = rects[i];
      const b = rects[j];
      const hit = !(
        a.x + a.w + pad <= b.x
        || b.x + b.w + pad <= a.x
        || a.y + a.h + pad <= b.y
        || b.y + b.h + pad <= a.y
      );
      if (hit) return true;
    }
  }
  return false;
}

export function walkSteps(normalized) {
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

function linearSink(start, nodes) {
  let cur = start;
  const seen = new Set();
  while (cur && nodes[cur] && !seen.has(cur)) {
    seen.add(cur);
    const node = nodes[cur];
    if (node.type === 'end') return cur;
    if (node.type === 'xor' || node.type === 'and') return null;
    cur = node.next;
  }
  return null;
}

/**
 * End disc vs ring: topology + machine via, never the label text.
 * An end is "other" only when a xor branch that sinks into it is linked
 * (via) to a terminal machine state AND a sibling transition continues
 * to a non-terminal state. Otherwise "ok".
 */
export function endKind(endId, normalized) {
  const nodes = normalized.graph.nodes;
  const viaIds = [];
  for (const node of Object.values(nodes)) {
    if (node.type !== 'xor') continue;
    for (const branch of node.branches || []) {
      if (linearSink(branch.next, nodes) === endId && branch.id) viaIds.push(branch.id);
    }
  }
  if (!viaIds.length) return 'ok';
  for (const machine of normalized.machines || []) {
    const trans = machine.transitions || [];
    const matched = trans.filter((t) => viaIds.includes(t.via));
    if (!matched.length) continue;
    const toTerminal = matched.some((t) => machine.nodes[t.to]?.terminal === true);
    const siblingContinues = matched.some((t) =>
      trans.some((o) =>
        o !== t
        && o.from === t.from
        && machine.nodes[o.to]
        && machine.nodes[o.to].terminal !== true,
      ),
    );
    if (toTerminal && siblingContinues) return 'other';
  }
  return 'ok';
}

export function analyzeBpm(nodes, entry) {
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
  if (entry) dfs(entry, new Set([entry]));
  const joinIds = new Set([
    ...Object.keys(forwardIn).filter((id) => forwardIn[id] > 1),
    ...Object.keys(nodes).filter((id) => nodes[id]?.type === 'join'),
  ]);
  return { joinIds, forwardIn };
}

export function layoutSequence(normalized) {
  const actors = normalized.actors.map((a, i) => ({
    id: a.id,
    label: a.label,
    x: GEOM.gutter + GEOM.actorWidth / 2 + i * GEOM.actorWidth,
  }));
  const cx = (id) => {
    const found = actors.find((a) => a.id === id);
    return found ? found.x : GEOM.gutter + GEOM.actorWidth / 2;
  };
  const width = GEOM.gutter + GEOM.actorWidth * Math.max(actors.length, 1) + 28;
  const steps = walkSteps(normalized);
  const rows = [];
  let n = 0;
  const seenXor = new Set();
  const visit = (list, depth) => {
    for (const s of list) {
      if (SEQ_MSG_KINDS.has(s.kind)) {
        for (const m of s.node?.messages || []) {
          rows.push({
            type: 'msg',
            n: ++n,
            from: m.from,
            to: m.to,
            text: m.text,
            async: m.async,
            depth,
            nodeId: s.nodeId,
          });
        }
      }
      if (s.kind === 'xor' || s.kind === 'and') {
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
          nodeId: s.nodeId,
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
      y += GEOM.blockLead;
    }
    r.y = y;
    y += r.type === 'msg' ? GEOM.messageRow : 30;
  }
  const bodyBottom = y + 16;
  const height = bodyBottom + 44;

  const messages = rows.filter((r) => r.type === 'msg');
  const bands = rows
    .filter((r) => r.type === 'xor-q')
    .map((r) => ({
      xorId: r.xorId,
      question: r.question,
      y: r.y,
      end: r.end,
      depth: r.depth,
      branches: rows.filter((b) => b.type === 'branch' && b.xorId === r.xorId),
    }));
  const loops = rows.filter((r) => r.type === 'loop');

  return {
    title: normalized.title,
    scenario: normalized.scenario,
    actors,
    rows,
    messages,
    bands,
    loops,
    width,
    height,
    bodyBottom,
    cx,
  };
}

export function layoutBpm(normalized) {
  const nodes = normalized.graph.nodes;
  const entry = normalized.graph.entry;
  const { joinIds } = analyzeBpm(nodes, entry);
  const placed = new Map();
  const edges = [];

  function isStubBranch(start, path) {
    let cur = start;
    const local = new Set();
    while (cur && nodes[cur] && !local.has(cur)) {
      local.add(cur);
      const node = nodes[cur];
      if (node.type === 'xor' || node.type === 'and' || node.type === 'end' || node.type === 'join') {
        return false;
      }
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
      if (node.type === 'join') return cur;
      if (node.type === 'xor' || node.type === 'and' || node.type === 'end') return null;
      if (node.next && joinIds.has(node.next)) return node.next;
      cur = node.next;
    }
    return null;
  }

  function classifyBranch(branch, path) {
    const target = branch.next;
    if (!target || !nodes[target]) return { branch, kind: 'empty' };
    if (path.has(target)) return { branch, kind: 'back', target };
    if (placed.has(target) || joinIds.has(target)) {
      return { branch, kind: 'to-join', target };
    }
    if (isStubBranch(target, path)) return { branch, kind: 'stub', start: target };
    return { branch, kind: 'content', start: target, join: joinAfter(target) };
  }

  function measureFrom(id, path) {
    if (!id || !nodes[id] || path.has(id)) return { w: 0, h: 0 };
    const node = nodes[id];
    const m = nodeMetrics(node);
    if (node.type === 'end') return { w: m.w, h: m.h };
    if (node.type === 'xor' || node.type === 'and') {
      return measureGate(id, new Set([...path, id]));
    }
    const rest = node.next ? measureFrom(node.next, new Set([...path, id])) : { w: 0, h: 0 };
    return {
      w: Math.max(m.w, rest.w),
      h: m.h + (rest.h ? GEOM.rankGap + rest.h : 0),
    };
  }

  function measureGate(gateId, path) {
    const node = nodes[gateId];
    const gh = nodeMetrics(node).h;
    const specs = (node.branches || []).map((b) => classifyBranch(b, path));
    const contents = specs.filter((s) => s.kind === 'content');
    const toJoins = specs.filter((s) => s.kind === 'to-join');
    const stubs = specs.filter((s) => s.kind === 'stub');
    if (contents.length <= 1 && toJoins.length === 0) {
      const cw = contents[0] ? measureFrom(contents[0].start, path).w : 0;
      const sw = stubs.reduce(
        (acc, s) => acc + Math.max(GEOM.colMin, measureFrom(s.start, path).w) + GEOM.colGap,
        0,
      );
      const ch = contents[0] ? measureFrom(contents[0].start, path).h : 0;
      const sh = Math.max(0, ...stubs.map((s) => measureFrom(s.start, path).h));
      return {
        w: Math.max(nodeMetrics(node).w, cw + sw),
        h: gh + GEOM.rankGap + Math.max(ch, sh),
      };
    }
    const colSpecs = specs.filter(
      (s) => s.kind === 'content' || s.kind === 'stub' || s.kind === 'to-join',
    );
    const widths = colSpecs.map((s) => {
      if (s.kind === 'to-join') return GEOM.colMin;
      return Math.max(GEOM.colMin, measureFrom(s.start, path).w);
    });
    const heights = colSpecs.map((s) => {
      if (s.kind === 'to-join') return 0;
      return measureFrom(s.start, path).h;
    });
    const totalW = widths.reduce((a, b) => a + b, 0) + Math.max(0, widths.length - 1) * GEOM.colGap;
    const joinHits = [
      ...contents.map((s) => s.join),
      ...toJoins.map((s) => s.target),
    ].filter(Boolean);
    const uniqueJoins = [...new Set(joinHits)];
    const joinId = uniqueJoins.length === 1 ? uniqueJoins[0] : null;
    let jh = 0;
    if (joinId && !path.has(joinId) && !placed.has(joinId)) {
      jh = GEOM.rankGap + measureFrom(joinId, path).h;
    }
    return {
      w: Math.max(nodeMetrics(node).w, totalW),
      h: gh + GEOM.rankGap + Math.max(0, ...heights) + jh,
    };
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
      eventKind: node.kind,
      ref: node.ref,
      x,
      y,
      outcome: node.type === 'end' ? endKind(id, normalized) : undefined,
    };
    placed.set(id, box);
    return box;
  }

  function placeFrom(id, x, y, path) {
    let cur = id;
    let cy = y;
    let prev = null;
    let guard = 0;
    while (cur && nodes[cur] && guard++ < 50) {
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
      cy += h + GEOM.rankGap;
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
      cy += h + GEOM.rankGap;
    }
    if (prev && placed.has(prev)) {
      return { bottom: placed.get(prev).y + nodeMetrics(placed.get(prev)).h, last: prev };
    }
    return { bottom: cy, last: prev };
  }

  function placeGate(gateId, x, y, path) {
    const node = nodes[gateId];
    const gh = nodeMetrics(node).h;
    const specs = (node.branches || []).map((b) => classifyBranch(b, path));
    const contents = specs.filter((s) => s.kind === 'content');
    const toJoins = specs.filter((s) => s.kind === 'to-join');
    const stubs = specs.filter((s) => s.kind === 'stub' || s.kind === 'back');
    const startY = y + gh + GEOM.rankGap;

    if (contents.length <= 1 && toJoins.length === 0) {
      let leftCursor = x;
      stubs.forEach((s) => {
        if (s.kind === 'back') {
          edges.push({ from: gateId, to: s.target, label: s.branch.label, kind: 'back' });
          return;
        }
        const mw = Math.max(GEOM.colMin, measureFrom(s.start, path).w);
        leftCursor -= mw + GEOM.colGap;
        placeFrom(s.start, leftCursor, startY, path);
        edges.push({ from: gateId, to: s.start, label: s.branch.label, kind: 'branch' });
      });
      if (contents[0]) {
        const r = placeFrom(contents[0].start, x, startY, path);
        edges.push({
          from: gateId,
          to: contents[0].start,
          label: contents[0].branch.label,
          kind: 'branch',
        });
        return r;
      }
      return { bottom: y + gh, last: gateId };
    }

    const colSpecs = specs.filter(
      (s) => s.kind === 'content' || s.kind === 'to-join' || s.kind === 'stub',
    );
    const widths = colSpecs.map((s) => {
      if (s.kind === 'to-join') return GEOM.colMin;
      return Math.max(GEOM.colMin, measureFrom(s.start, path).w);
    });
    const totalW = widths.reduce((a, b) => a + b, 0) + Math.max(0, widths.length - 1) * GEOM.colGap;
    let cursor = x - totalW / 2;
    const cols = [];
    colSpecs.forEach((s, i) => {
      const kx = cursor + widths[i] / 2;
      cursor += widths[i] + GEOM.colGap;
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
    const maxBottom = Math.max(y + gh + GEOM.rankGap, ...cols.map((c) => c.bottom));

    if (joinId && !placed.has(joinId)) {
      const r = placeFrom(joinId, x, maxBottom + GEOM.rankGap, path);
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

  if (entry) placeFrom(entry, 0, 28, new Set());

  const seenEdge = new Set();
  const uniq = [];
  for (const e of edges) {
    const key = `${e.from}>${e.to}|${e.label}|${e.kind}`;
    if (seenEdge.has(key)) continue;
    seenEdge.add(key);
    uniq.push({ ...e });
  }
  let lane = 0;
  for (const e of uniq) {
    if (e.kind === 'back') {
      e.lane = lane;
      lane += 1;
    }
  }

  separateBpmBoxes(placed);

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
  if (!Number.isFinite(minX)) {
    minX = 0;
    maxX = 200;
    minY = 0;
    maxY = 80;
  }
  const backPad = 72 + lane * 20;
  minX -= backPad;
  maxX += 36;
  minY -= 16;
  maxY += 20;
  const dx = 24 - minX;
  const dy = 24 - minY;
  for (const b of placed.values()) {
    b.x += dx;
    b.y += dy;
  }

  return {
    title: normalized.title,
    scenario: normalized.scenario,
    nodes: Object.fromEntries(placed),
    edges: uniq,
    width: Math.ceil(maxX + dx + 24),
    height: Math.ceil(maxY + dy + 24),
  };
}

function separateBpmBoxes(placed) {
  const boxes = [...placed.values()];
  let moved = true;
  let guard = 0;
  while (moved && guard++ < 24) {
    moved = false;
    for (let i = 0; i < boxes.length; i += 1) {
      for (let j = i + 1; j < boxes.length; j += 1) {
        const a = boxRect(boxes[i]);
        const b = boxRect(boxes[j]);
        if (
          a.x + a.w + 12 <= b.x
          || b.x + b.w + 12 <= a.x
          || a.y + a.h + 12 <= b.y
          || b.y + b.h + 12 <= a.y
        ) {
          continue;
        }
        if (boxes[j].x >= boxes[i].x) {
          boxes[j].x += a.x + a.w + 16 - b.x;
        } else {
          boxes[i].x += b.x + b.w + 16 - a.x;
        }
        moved = true;
      }
    }
  }
}

function edgePayload(tr) {
  return {
    id: tr.id,
    from: tr.from,
    to: tr.to,
    label: tr.label,
    effects: tr.effects || [],
    when: tr.when,
  };
}

export function layoutMachines(normalized) {
  const machines = [];
  let yOff = GEOM.machineTitle;
  for (const m of normalized.machines || []) {
    const one = layoutOneMachine(m, yOff);
    let maxY = yOff + GEOM.machinePadY + GEOM.machineH;
    for (const p of Object.values(one.states)) {
      maxY = Math.max(maxY, p.y + p.h + 80);
    }
    machines.push(one);
    yOff = maxY + GEOM.machineStack;
  }
  let minX = 0;
  let minY = 0;
  let maxX = 40;
  let maxY = 40;
  for (const one of machines) {
    for (const p of Object.values(one.states)) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x + p.w);
      maxY = Math.max(maxY, p.y + p.h + 80);
    }
  }
  return {
    title: normalized.title,
    scenario: normalized.scenario,
    machines,
    width: Math.ceil(maxX + 32),
    height: Math.ceil(maxY + 32),
  };
}

function layoutOneMachine(m, yOff) {
  const ids = Object.keys(m.nodes);
  const selfLoops = [];
  const downs = [];
  const forwards = [];
  const backs = [];
  const laterals = [];
  const nonSelf = (m.transitions || []).filter((tr) => tr.from !== tr.to);
  const byFrom = Object.create(null);
  for (const tr of nonSelf) {
    if (!byFrom[tr.from]) byFrom[tr.from] = [];
    byFrom[tr.from].push(tr);
  }

  const rank = Object.create(null);
  if (m.entry) rank[m.entry] = 0;
  const q = m.entry ? [m.entry] : [];
  const seen = new Set(q);
  while (q.length) {
    const id = q.shift();
    for (const tr of nonSelf) {
      if (tr.from !== id || seen.has(tr.to) || !m.nodes[tr.to]) continue;
      rank[tr.to] = (rank[id] ?? 0) + 1;
      seen.add(tr.to);
      q.push(tr.to);
    }
  }
  ids.forEach((id, i) => {
    if (rank[id] == null) rank[id] = i;
  });

  for (const tr of m.transitions || []) {
    if (tr.from === tr.to) {
      selfLoops.push(tr);
      continue;
    }
    const sibs = byFrom[tr.from] || [];
    const hasHappy = sibs.some((o) => o !== tr && m.nodes[o.to] && m.nodes[o.to].terminal !== true);
    if (m.nodes[tr.to]?.terminal === true && hasHappy) {
      downs.push(tr);
      continue;
    }
    const rf = rank[tr.from] ?? 0;
    const rt = rank[tr.to] ?? 0;
    if (rt < rf) backs.push(tr);
    else if (rt === rf) laterals.push(tr);
    else forwards.push(tr);
  }

  for (const tr of downs) {
    rank[tr.to] = rank[tr.from] ?? 0;
  }

  const slot = Object.create(null);
  const byRank = Object.create(null);
  for (const id of ids) {
    const r = rank[id] ?? 0;
    if (!byRank[r]) byRank[r] = [];
    byRank[r].push(id);
  }
  const sinkTargets = new Set(downs.map((t) => t.to));
  for (const r of Object.keys(byRank).map(Number).sort((a, b) => a - b)) {
    const group = byRank[r];
    const mains = group.filter((id) => !sinkTargets.has(id));
    const sinks = group.filter((id) => sinkTargets.has(id));
    mains.forEach((id, i) => {
      slot[id] = i;
    });
    sinks.forEach((id) => {
      const src = downs.find((t) => t.to === id)?.from;
      slot[id] = (slot[src] ?? 0) + 1;
    });
    const used = new Set();
    for (const id of group) {
      if (slot[id] == null) slot[id] = 0;
      while (used.has(slot[id])) slot[id] += 1;
      used.add(slot[id]);
    }
  }

  const states = {};
  for (const id of ids) {
    states[id] = {
      id,
      label: m.nodes[id].label,
      terminal: m.nodes[id].terminal === true,
      entry: m.entry === id,
      x: GEOM.machinePadX + (rank[id] ?? 0) * (GEOM.machineW + GEOM.machineGapX),
      y: yOff + GEOM.machinePadY + (slot[id] ?? 0) * GEOM.machineRowY,
      w: GEOM.machineW,
      h: GEOM.machineH,
    };
  }

  const loopSide = new Map();
  const loopsByFrom = Object.create(null);
  for (const tr of selfLoops) {
    if (!loopsByFrom[tr.from]) loopsByFrom[tr.from] = [];
    loopsByFrom[tr.from].push(tr);
  }
  for (const list of Object.values(loopsByFrom)) {
    const ordered = [...list].sort((a, b) => (b.effects?.length || 0) - (a.effects?.length || 0));
    if (ordered.length === 1) loopSide.set(ordered[0], 'top');
    else {
      ordered.forEach((tr, i) => {
        loopSide.set(tr, LOOP_SIDES[i % LOOP_SIDES.length]);
      });
    }
  }

  const edges = [
    ...forwards.map((tr) => ({ ...edgePayload(tr), kind: 'forward' })),
    ...downs.map((tr) => ({ ...edgePayload(tr), kind: 'down' })),
    ...backs.map((tr) => ({ ...edgePayload(tr), kind: 'back' })),
    ...laterals.map((tr) => ({ ...edgePayload(tr), kind: 'side' })),
    ...selfLoops.map((tr) => ({ ...edgePayload(tr), kind: 'loop', side: loopSide.get(tr) || 'top' })),
  ];

  return {
    id: m.id,
    label: m.label,
    entry: m.entry,
    states,
    edges,
  };
}
