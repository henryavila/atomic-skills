/**
 * find-weak-flow-draft — brief sidecar + seven refuse rules.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { checkFlowDraft } from '../scripts/find-weak-flow-draft.js';
import { buildFlowRatification } from '../scripts/lib/flow-ratification.js';
import { flowDocumentSha } from '../scripts/find-missing-flow.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const STRICT = join(ROOT, 'scripts', 'find-missing-flow.js');

const goodBrief = {
  actor: 'Operador',
  scenario: 'Carimbar o fluxo antes de executar.',
  decisions: [
    { id: 'Decidir', question: 'Aprovar?', outcomes: ['aprova', 'ajusta'] },
  ],
  stateChanges: [
    { id: 'artefato', states: ['rascunho', 'carimbado'] },
  ],
};

const goodFlow = {
  schemaVersion: '1.0',
  planSlug: 'probe',
  actor: 'Operador',
  scenario: 'Carimbar o fluxo antes de executar.',
  audience: 'both',
  actors: [{ id: 'Op', label: 'Operador', kind: 'actor' }],
  graph: {
    entry: 'Draftar',
    nodes: {
      Draftar: {
        type: 'activity',
        label: 'Draftar o grafo',
        who: 'Operador',
        messages: [{ from: 'Op', to: 'Op', text: 'Escreve a ficha', async: false }],
        next: 'Decidir',
      },
      Decidir: {
        type: 'xor',
        label: 'Aprovar?',
        branches: [
          { id: 'Decidir.aprova', when: 'aprova', label: 'Aprova', next: 'Fim' },
          { id: 'Decidir.ajusta', when: 'ajusta', label: 'Ajusta', next: 'Fim' },
        ],
      },
      Fim: { type: 'end', label: 'Fim' },
    },
  },
  machines: [
    {
      id: 'artefato',
      label: 'Artefato',
      entry: 'rascunho',
      nodes: { rascunho: { label: 'Rascunho' }, carimbado: { label: 'Carimbado' } },
      transitions: [],
    },
  ],
};

function writePair(planBody, brief, flow) {
  const dir = mkdtempSync(join(tmpdir(), 'flow-brief-'));
  const planMd = join(dir, 'plan.md');
  writeFileSync(planMd, planBody);
  mkdirSync(join(dir, 'flow'));
  if (brief !== null) {
    writeFileSync(join(dir, 'flow', 'brief.json'), `${JSON.stringify(brief, null, 2)}\n`);
  }
  if (flow !== null) {
    writeFileSync(join(dir, 'flow', 'flow.json'), `${JSON.stringify(flow, null, 2)}\n`);
  }
  return { dir, planMd };
}

describe('checkFlowDraft rule 1', () => {
  it('rule 1: missing brief is weak', () => {
    const { dir, planMd } = writePair('# p\n', null, {});
    try {
      const r = checkFlowDraft(planMd);
      assert.equal(r.ok, false);
      assert.ok(r.issues.some((i) => /brief/i.test(i)));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('checkFlowDraft rules 2-7', () => {
  it('good pair is ok', () => {
    const { dir, planMd } = writePair('# p\n', goodBrief, goodFlow);
    try {
      const r = checkFlowDraft(planMd);
      assert.equal(r.ok, true, r.issues.join('; '));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('rule 2: orphan xor not in the brief', () => {
    const flow = structuredClone(goodFlow);
    flow.graph.nodes.Solto = {
      type: 'xor',
      label: 'Solto?',
      branches: [
        { id: 'Solto.a', when: 'a', label: 'A', next: 'Fim' },
        { id: 'Solto.b', when: 'b', label: 'B', next: 'Fim' },
      ],
    };
    const { dir, planMd } = writePair('# p\n', goodBrief, flow);
    try {
      const r = checkFlowDraft(planMd);
      assert.equal(r.ok, false);
      assert.ok(r.issues.some((i) => /rastreio|orphan|brief/i.test(i)), r.issues.join('; '));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('rule 3: decision without matching xor', () => {
    const flow = structuredClone(goodFlow);
    delete flow.graph.nodes.Decidir;
    flow.graph.nodes.Draftar.next = 'Fim';
    const { dir, planMd } = writePair('# p\n', goodBrief, flow);
    try {
      const r = checkFlowDraft(planMd);
      assert.equal(r.ok, false);
      assert.ok(r.issues.some((i) => /Decidir/.test(i)), r.issues.join('; '));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('rule 3: xor missing an outcome', () => {
    const flow = structuredClone(goodFlow);
    flow.graph.nodes.Decidir.branches = [
      { id: 'Decidir.aprova', when: 'aprova', label: 'Aprova', next: 'Fim' },
    ];
    const { dir, planMd } = writePair('# p\n', goodBrief, flow);
    try {
      const r = checkFlowDraft(planMd);
      assert.equal(r.ok, false);
      assert.ok(
        r.issues.some((i) => /outcomes|saídas|ajusta/i.test(i)),
        r.issues.join('; '),
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('rule 4: phase id as node id', () => {
    const flow = structuredClone(goodFlow);
    flow.graph.nodes.F0 = flow.graph.nodes.Draftar;
    delete flow.graph.nodes.Draftar;
    flow.graph.entry = 'F0';
    const { dir, planMd } = writePair('# p\n', goodBrief, flow);
    try {
      const r = checkFlowDraft(planMd);
      assert.equal(r.ok, false);
      assert.ok(r.issues.some((i) => /F0/.test(i)), r.issues.join('; '));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('rule 5: UI token on BPM label', () => {
    const flow = structuredClone(goodFlow);
    flow.graph.nodes.Draftar.label = 'Clica no modal';
    const { dir, planMd } = writePair('# p\n', goodBrief, flow);
    try {
      const r = checkFlowDraft(planMd);
      assert.equal(r.ok, false);
      assert.ok(r.issues.some((i) => /clique|modal|tela/i.test(i)), r.issues.join('; '));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('rule 6: xor with fewer than 2 branches', () => {
    const flow = structuredClone(goodFlow);
    flow.graph.nodes.Decidir.branches = [
      { id: 'Decidir.aprova', when: 'aprova', label: 'Aprova', next: 'Fim' },
    ];
    const { dir, planMd } = writePair('# p\n', goodBrief, flow);
    try {
      const r = checkFlowDraft(planMd);
      assert.equal(r.ok, false);
      assert.ok(r.issues.some((i) => /xor|branches/i.test(i)), r.issues.join('; '));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('rule 7: no messages', () => {
    const flow = structuredClone(goodFlow);
    delete flow.graph.nodes.Draftar.messages;
    const { dir, planMd } = writePair('# p\n', goodBrief, flow);
    try {
      const r = checkFlowDraft(planMd);
      assert.equal(r.ok, false);
      assert.ok(r.issues.some((i) => /messages/i.test(i)), r.issues.join('; '));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('--strict passes without brief.json', () => {
    const stamped = buildFlowRatification(structuredClone(goodFlow), {
      ratifiedAt: '2026-08-13T12:00:00.000Z',
    });
    const { dir, planMd } = writePair('# p\n', null, stamped);
    try {
      writeFileSync(
        join(dir, 'flow', 'flow.html'),
        `<html data-fl-content-sha="${flowDocumentSha(stamped)}"></html>\n`,
      );
      const run = spawnSync(process.execPath, [STRICT, '--strict', planMd], {
        encoding: 'utf8',
        timeout: 60_000,
      });
      assert.equal(run.status, 0, run.stderr || run.stdout);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('phases in plan.md are ok when the graph has none', () => {
    const { dir, planMd } = writePair(
      '---\nphases:\n  - id: F0\n---\n# p\n',
      goodBrief,
      goodFlow,
    );
    try {
      const r = checkFlowDraft(planMd);
      assert.equal(r.ok, true, r.issues.join('; '));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
