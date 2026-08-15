/**
 * Generic flow layout: any MODEL graph, no PDTI-shaped shortcuts.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeFlow } from '../scripts/lib/render-flow.js';
import { validateFlow } from '../scripts/lib/validate-flow.js';
import {
  GEOM,
  walkSteps,
  layoutSequence,
  layoutBpm,
  layoutMachines,
  endKind,
  boxRect,
  anyOverlap,
} from '../scripts/lib/flow-layout.js';
import {
  ALL_FIXTURES,
  linearChain,
  xorThreeWay,
  andJoin,
  nestedXor,
  eventAndSubprocess,
  entryIsXor,
  twoBackEdges,
  machineDiamond,
  machineThreeLoops,
  twoMachines,
  fiveActors,
  machinePeerTerminals,
} from '../docs/plans/preview-fixtures.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DOGFOOD = JSON.parse(
  readFileSync(join(ROOT, 'docs/design/project-flow/dogfood/fluxo-sugestao.json'), 'utf8'),
);
const MINIMAL = JSON.parse(
  readFileSync(join(ROOT, 'docs/design/project-flow/dogfood/minimal-xor.json'), 'utf8'),
);

function n(raw) {
  return normalizeFlow(raw);
}

function bpmRects(layout) {
  return Object.values(layout.nodes).map((box) => ({ id: box.id, ...boxRect(box) }));
}

function stateRects(machine) {
  return Object.values(machine.states).map((s) => ({
    id: s.id,
    x: s.x,
    y: s.y,
    w: s.w,
    h: s.h,
  }));
}

function collectKinds(steps, into = []) {
  for (const s of steps) {
    into.push(s.kind);
    if (s.branchPanels) {
      for (const p of s.branchPanels) collectKinds(p.chain, into);
    }
  }
  return into;
}

describe('fixtures are valid MODEL documents', () => {
  for (const raw of [...ALL_FIXTURES(), DOGFOOD, MINIMAL]) {
    it(`validates ${raw.planSlug}`, () => {
      const result = validateFlow(raw);
      assert.equal(result.valid, true, (result.errors || []).map((e) => e.message).join('\n'));
    });
  }
});

describe('source hygiene — no PDTI domain in the engine', () => {
  it('preview generator calls the engine instead of drawing itself', () => {
    const src = readFileSync(join(ROOT, 'docs/plans/gen-flow-diagram-preview.mjs'), 'utf8');
    assert.match(src, /from '\.\.\/\.\.\/scripts\/lib\/flow-draw\.js'/);
    assert.doesNotMatch(src, /function walkSteps/);
    assert.doesNotMatch(src, /function drawBpm\b/);
    assert.doesNotMatch(src, /function makeXorRaw/);
    assert.doesNotMatch(src, /recus\|reject\|fail\|sem /);
  });

  const files = [
    'scripts/lib/flow-layout.js',
    'scripts/lib/flow-draw.js',
  ];
  for (const rel of files) {
    it(`${rel} has no PDTI labels, ids, or outcome regex`, () => {
      const src = readFileSync(join(ROOT, rel), 'utf8');
      assert.doesNotMatch(src, /sugestao-necessidade|fluxo-sugestao|PDTI/i);
      assert.doesNotMatch(src, /S1e|S3edit|D_edit|end_refuse|end_accept/);
      assert.doesNotMatch(src, /recus\|reject\|fail\|sem \|inválid/);
      assert.doesNotMatch(src, /\^L[ií]der/);
      assert.doesNotMatch(src, /nodeId\s*===\s*['"]D2['"]/);
    });
  }
});

describe('walkSteps', () => {
  it('emits activity then xor with two branch chains then ends', () => {
    const steps = walkSteps(n(MINIMAL));
    assert.equal(steps[0].kind, 'activity');
    assert.equal(steps[0].nodeId, 'S1');
    assert.equal(steps[1].kind, 'xor');
    assert.equal(steps[1].nodeId, 'D1');
    assert.equal(steps[1].branchPanels.length, 2);
    assert.equal(steps[1].branchPanels[0].branch.label, 'Accepts');
    assert.equal(steps[1].branchPanels[0].chain[0].kind, 'end');
    assert.equal(steps[1].branchPanels[1].chain[0].nodeId, 'end_no');
  });

  it('marks a cycle as loop-ref instead of walking forever', () => {
    const doc = n(MINIMAL);
    doc.graph.nodes.S1.next = 'S1';
    const steps = walkSteps(doc);
    assert.ok(steps.some((s) => s.kind === 'loop-ref' && s.nodeId === 'S1'));
    assert.equal(steps.filter((s) => s.kind === 'activity' && s.nodeId === 'S1').length, 1);
    assert.ok(steps.length < 8);
  });

  it('starts at xor when graph.entry is a xor', () => {
    const steps = walkSteps(n(entryIsXor()));
    assert.equal(steps[0].kind, 'xor');
    assert.equal(steps[0].nodeId, 'X0');
  });

  it('walks and-join as a gate with two chains that meet a join', () => {
    const steps = walkSteps(n(andJoin()));
    const gate = steps.find((s) => s.kind === 'and' && s.nodeId === 'P1');
    assert.ok(gate);
    assert.equal(gate.branchPanels.length, 2);
    assert.ok(gate.branchPanels[0].chain.some((c) => c.nodeId === 'SL'));
    assert.ok(gate.branchPanels[1].chain.some((c) => c.nodeId === 'SF'));
  });

  it('treats a back-edge to an open xor as loop-ref', () => {
    const steps = walkSteps(n(twoBackEdges()));
    const kinds = collectKinds(steps);
    assert.ok(kinds.includes('loop-ref'));
    const x1 = steps.find((s) => s.nodeId === 'X1');
    const fail = x1.branchPanels.find((p) => p.branch.next === 'C1');
    assert.ok(fail.chain.some((c) => c.kind === 'loop-ref' && c.nodeId === 'X1'));
  });

  it('keeps a subprocess as one step and does not explode the subgraph', () => {
    const steps = walkSteps(n(eventAndSubprocess()));
    const kinds = collectKinds(steps);
    assert.ok(kinds.includes('event'));
    assert.ok(kinds.includes('subprocess'));
    assert.ok(!kinds.includes('activity') || !collectKinds(steps).includes('G1'));
    assert.ok(!JSON.stringify(steps).includes('Inner collect'));
  });
});

describe('layoutSequence', () => {
  it('places actors, one message row, and an xor rail', () => {
    const layout = layoutSequence(n(MINIMAL));
    assert.equal(layout.actors.length, 2);
    assert.equal(layout.actors[0].id, 'U');
    assert.equal(layout.actors[1].id, 'R');
    assert.ok(layout.actors[1].x > layout.actors[0].x);
    assert.equal(layout.messages.length, 1);
    assert.equal(layout.messages[0].from, 'U');
    assert.equal(layout.messages[0].to, 'R');
    assert.equal(layout.bands.length, 1);
    assert.equal(layout.bands[0].xorId, 'D1');
    assert.match(layout.bands[0].question, /Accept/);
    assert.equal(layout.bands[0].branches.length, 2);
    assert.ok(layout.bands[0].branches[1].y > layout.bands[0].branches[0].y);
    assert.equal(GEOM.actorWidth, 196);
    assert.equal(GEOM.messageRow, 36);
  });

  it('records a loop-ref instead of another message row', () => {
    const doc = n(MINIMAL);
    doc.graph.nodes.S1.next = 'S1';
    const layout = layoutSequence(doc);
    assert.ok(layout.loops.some((lp) => lp.nodeId === 'S1'));
  });

  it('emits messages that live on a xor node', () => {
    const layout = layoutSequence(n(xorThreeWay()));
    assert.ok(layout.messages.some((m) => m.text === 'Picks a queue'));
  });

  it('gives each of five actors its own column in JSON order', () => {
    const layout = layoutSequence(n(fiveActors()));
    assert.equal(layout.actors.length, 5);
    const xs = layout.actors.map((a) => a.x);
    assert.deepEqual(xs, [...xs].sort((a, b) => a - b));
    assert.equal(layout.messages.length, 5);
  });

  it('uses the document title, not a domain nickname', () => {
    const layout = layoutSequence(n(linearChain()));
    assert.equal(layout.title, 'Linear four-step chain');
    assert.doesNotMatch(layout.title, /PDTI/i);
  });
});

describe('layoutBpm — generic topologies', () => {
  it('places a linear chain as one column, every node present, no overlap', () => {
    const layout = layoutBpm(n(linearChain()));
    const ids = Object.keys(layout.nodes);
    assert.deepEqual(ids.sort(), ['S1', 'S2', 'S3', 'S4', 'end_ok'].sort());
    const xs = ['S1', 'S2', 'S3', 'S4', 'end_ok'].map((id) => layout.nodes[id].x);
    assert.ok(xs.every((x) => Math.abs(x - xs[0]) < 1));
    assert.ok(layout.nodes.S2.y > layout.nodes.S1.y);
    assert.ok(layout.nodes.end_ok.y > layout.nodes.S4.y);
    assert.equal(anyOverlap(bpmRects(layout)), false);
  });

  it('places a 3-way xor as three sibling columns with no overlap', () => {
    const layout = layoutBpm(n(xorThreeWay()));
    const ends = ['end_low', 'end_mid', 'end_high'].map((id) => layout.nodes[id]);
    assert.ok(ends.every(Boolean));
    const xs = new Set(ends.map((b) => Math.round(b.x)));
    assert.equal(xs.size, 3);
    assert.ok(ends.every((b) => b.y > layout.nodes.X1.y));
    assert.equal(anyOverlap(bpmRects(layout)), false);
  });

  it('places an and-split once and the join once, below both branches', () => {
    const layout = layoutBpm(n(andJoin()));
    assert.ok(layout.nodes.P1);
    assert.ok(layout.nodes.J1);
    assert.equal(layout.nodes.P1.type, 'and');
    assert.equal(layout.nodes.J1.type, 'join');
    assert.ok(layout.nodes.SL.x !== layout.nodes.SF.x);
    assert.ok(layout.nodes.J1.y > layout.nodes.SL.y);
    assert.ok(layout.nodes.J1.y > layout.nodes.SF.y);
    assert.ok(layout.edges.some((e) => e.from === 'SL' && e.to === 'J1'));
    assert.ok(layout.edges.some((e) => e.from === 'SF' && e.to === 'J1'));
    assert.equal(anyOverlap(bpmRects(layout)), false);
  });

  it('nests an inner xor under one branch without overlapping the outer', () => {
    const layout = layoutBpm(n(nestedXor()));
    assert.ok(layout.nodes.X2.y > layout.nodes.X1.y);
    assert.ok(layout.nodes.end_ok.y > layout.nodes.X2.y);
    assert.ok(layout.nodes.end_no);
    assert.ok(layout.nodes.end_bad);
    assert.equal(anyOverlap(bpmRects(layout)), false);
  });

  it('places event and subprocess and does not explode the subgraph', () => {
    const layout = layoutBpm(n(eventAndSubprocess()));
    assert.equal(layout.nodes.E1.type, 'event');
    assert.equal(layout.nodes.P1.type, 'subprocess');
    assert.equal(layout.nodes.G1, undefined);
    assert.ok(layout.nodes.P1.y > layout.nodes.E1.y);
    assert.equal(anyOverlap(bpmRects(layout)), false);
  });

  it('routes each back-edge on its own left lane', () => {
    const layout = layoutBpm(n(twoBackEdges()));
    const backs = layout.edges.filter((e) => e.kind === 'back');
    assert.ok(backs.length >= 2);
    const lanes = new Set(backs.map((e) => e.lane));
    assert.equal(lanes.size, backs.length);
    assert.ok(layout.edges.some((e) => e.from === 'C1' && e.to === 'X1' && e.kind === 'back'));
    assert.ok(layout.edges.some((e) => e.from === 'C2' && e.to === 'X2' && e.kind === 'back'));
    assert.equal(anyOverlap(bpmRects(layout)), false);
  });

  it('does not infer end outcome from the label', () => {
    const layout = layoutBpm(n(linearChain()));
    assert.equal(endKind('end_ok', n(linearChain())), 'ok');
    assert.equal(layout.nodes.end_ok.outcome, 'ok');
  });
});

describe('layoutMachines — generic topologies', () => {
  it('separates two peer terminals so they do not share a box', () => {
    const layout = layoutMachines(n(machinePeerTerminals()));
    const m = layout.machines[0];
    const a = m.states.yes;
    const b = m.states.no;
    assert.ok(a && b);
    assert.ok(a.x !== b.x || a.y !== b.y);
    assert.equal(anyOverlap(stateRects(m)), false);
  });

  it('places a diamond without stacking states on one cell', () => {
    const layout = layoutMachines(n(machineDiamond()));
    const m = layout.machines[0];
    assert.equal(Object.keys(m.states).length, 4);
    const legal = m.states.legal;
    const finance = m.states.finance;
    assert.ok(legal.x !== finance.x || legal.y !== finance.y);
    assert.ok(m.states.closed.x > m.states.new.x || m.states.closed.y !== m.states.new.y);
    assert.equal(anyOverlap(stateRects(m)), false);
  });

  it('assigns three self-loops to three distinct sides', () => {
    const layout = layoutMachines(n(machineThreeLoops()));
    const loops = layout.machines[0].edges.filter((e) => e.from === 'parked' && e.to === 'parked');
    assert.equal(loops.length, 3);
    const sides = new Set(loops.map((e) => e.side));
    assert.equal(sides.size, 3);
  });

  it('stacks two machines on y without overlap', () => {
    const layout = layoutMachines(n(twoMachines()));
    assert.equal(layout.machines.length, 2);
    const a = layout.machines[0];
    const b = layout.machines[1];
    const aMax = Math.max(...Object.values(a.states).map((s) => s.y + s.h));
    const bMin = Math.min(...Object.values(b.states).map((s) => s.y));
    assert.ok(bMin > aMax);
  });
});

describe('every fixture graph is fully placed without overlap', () => {
  for (const raw of ALL_FIXTURES()) {
    it(`${raw.planSlug} places every graph node and no boxes collide`, () => {
      const layout = layoutBpm(n(raw));
      for (const id of Object.keys(raw.graph.nodes)) {
        assert.ok(layout.nodes[id], `missing node ${id}`);
      }
      assert.equal(anyOverlap(bpmRects(layout)), false);
      const mach = layoutMachines(n(raw));
      for (const m of mach.machines) {
        assert.equal(anyOverlap(stateRects(m)), false);
      }
    });
  }
});

describe('dogfood is a fixture, not a special case', () => {
  it('still places the PDTI join once and the correction as a back-edge', () => {
    const layout = layoutBpm(n(DOGFOOD));
    assert.ok(layout.nodes.D2);
    assert.ok(layout.nodes.S3edit);
    assert.ok(layout.nodes.D2.y > layout.nodes.S3edit.y);
    assert.ok(layout.edges.some((e) => e.from === 'S1e' && e.to === 'D1' && e.kind === 'back'));
    assert.equal(anyOverlap(bpmRects(layout)), false);
  });

  it('still parks the PDTI sink-exit under the continuing state', () => {
    const layout = layoutMachines(n(DOGFOOD));
    const m = layout.machines[0];
    assert.ok(m.states.recusada.y > m.states.pendente.y);
    assert.ok(m.states.ativo.x > m.states.pendente.x);
    const loops = m.edges.filter((e) => e.from === 'pendente' && e.to === 'pendente');
    assert.equal(loops.length, 2);
    assert.equal(anyOverlap(stateRects(m)), false);
  });
});
