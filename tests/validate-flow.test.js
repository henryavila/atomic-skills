/**
 * F0 — flow schema 1.0 MODEL (activity/xor/and/join/subprocess/event/end + machines).
 * Domain PDTI must stay in fixtures, never in the validator.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  validateFlow,
  assertValidFlow,
  SUBGRAPH_MAX_DEPTH,
} from '../scripts/lib/validate-flow.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function messages(result) {
  return (result.errors ?? []).map((e) => e.message ?? String(e)).join('\n');
}

function validDoc() {
  return {
    schemaVersion: '1.0',
    planSlug: 'minimal-xor',
    title: 'Minimal accept-or-reject',
    scenario: 'A requester submits a request and a reviewer accepts or rejects it.',
    actor: 'Requester',
    audience: 'layperson',
    actors: [
      { id: 'U', label: 'Requester', kind: 'actor' },
      { id: 'R', label: 'Reviewer', kind: 'actor' },
    ],
    graph: {
      entry: 'S1',
      nodes: {
        S1: {
          type: 'activity',
          label: 'Submit request',
          who: 'Requester',
          messages: [{ from: 'U', to: 'R', text: 'Sends the request', async: false }],
          next: 'X1',
        },
        X1: {
          type: 'xor',
          label: 'Accept?',
          who: 'Reviewer',
          question: 'Accept the request?',
          branches: [
            { id: 'X1.yes', when: 'accepts', label: 'Accepts', next: 'end_ok' },
            { id: 'X1.no', when: 'rejects', label: 'Rejects', next: 'end_no' },
          ],
        },
        end_ok: { type: 'end', label: 'Accepted' },
        end_no: { type: 'end', label: 'Rejected' },
      },
    },
    machines: [
      {
        id: 'request',
        label: 'Request',
        entry: 'open',
        nodes: {
          open: { label: 'Open' },
          accepted: { label: 'Accepted', terminal: true },
          rejected: { label: 'Rejected', terminal: true },
        },
        transitions: [
          {
            id: 'T_yes',
            from: 'open',
            to: 'accepted',
            when: 'accepts',
            label: 'Accepts',
            via: 'X1.yes',
            effects: [],
          },
          {
            id: 'T_no',
            from: 'open',
            to: 'rejected',
            when: 'rejects',
            label: 'Rejects',
            via: 'X1.no',
            effects: [{ kind: 'notify', label: 'Tell requester', target: 'U' }],
          },
        ],
      },
    ],
  };
}

function cloneValid() {
  return structuredClone(validDoc());
}

describe('validateFlow — MODEL document', () => {
  it('accepts a schema 1.0 document with activity, xor, messages and machines', () => {
    const doc = cloneValid();
    const result = validateFlow(doc);
    assert.equal(result.valid, true, messages(result));
    assert.equal(doc.schemaVersion, '1.0');
    assert.ok(doc.graph?.entry);
    assert.ok(doc.graph?.nodes);
    assert.equal(Array.isArray(doc.machines), true);
    assert.ok(doc.machines.length >= 1);
  });

  it('accepts activity, xor, and, join, subprocess, event and end neighbors', () => {
    const doc = cloneValid();
    doc.graph = {
      entry: 'start',
      nodes: {
        start: { type: 'activity', label: 'Start', next: 'fork' },
        fork: {
          type: 'and',
          label: 'Do both',
          branches: [
            { id: 'fork.a', label: 'Left', next: 'left' },
            { id: 'fork.b', label: 'Right', next: 'right' },
          ],
        },
        left: { type: 'activity', label: 'Left work', next: 'join' },
        right: { type: 'activity', label: 'Right work', next: 'join' },
        join: { type: 'join', of: 'fork', next: 'sub' },
        sub: { type: 'subprocess', ref: 'child', next: 'wait' },
        wait: { type: 'event', kind: 'timer', next: 'done' },
        done: { type: 'end', label: 'Done' },
      },
      subgraphs: {
        child: {
          entry: 'c1',
          nodes: {
            c1: { type: 'activity', label: 'Child step', next: 'c_end' },
            c_end: { type: 'end', label: 'Child done' },
          },
        },
      },
    };
    doc.machines[0].transitions = doc.machines[0].transitions.map((t) => {
      const next = { ...t };
      delete next.via;
      return next;
    });
    const result = validateFlow(doc);
    assert.equal(result.valid, true, messages(result));
  });

  it('accepts a cycle when next points at an ancestor', () => {
    const doc = cloneValid();
    doc.graph.nodes.X1.branches[0].next = 'S1';
    delete doc.graph.nodes.end_ok;
    const result = validateFlow(doc);
    assert.equal(result.valid, true, messages(result));
  });

  it('keeps ratifiedGraphSha optional until a stamp exists', () => {
    const doc = cloneValid();
    assert.equal('ratifiedGraphSha' in doc, false);
    assert.equal(validateFlow(doc).valid, true, messages(validateFlow(doc)));
  });

  it('accepts empty effects arrays', () => {
    const doc = cloneValid();
    doc.machines[0].transitions[0].effects = [];
    const result = validateFlow(doc);
    assert.equal(result.valid, true, messages(result));
  });
});

describe('validateFlow — old shapes are invalid', () => {
  it('rejects schemaVersion 1.0 with type sequence', () => {
    const doc = cloneValid();
    doc.graph.nodes.S1.type = 'sequence';
    const result = validateFlow(doc);
    assert.equal(result.valid, false);
    assert.match(messages(result), /allowed values|sequence|type|enum/i);
  });

  it('rejects type decision as a node shape', () => {
    const doc = cloneValid();
    doc.graph.nodes.X1.type = 'decision';
    const result = validateFlow(doc);
    assert.equal(result.valid, false);
  });

  it('rejects a root single states object', () => {
    const doc = cloneValid();
    doc.states = {
      entry: 'open',
      nodes: { open: { label: 'Open' } },
      transitions: [],
    };
    const result = validateFlow(doc);
    assert.equal(result.valid, false);
  });
});

describe('validateFlow — core graph errors', () => {
  it('rejects a broken next (unknown node id)', () => {
    const doc = cloneValid();
    doc.graph.nodes.S1.next = 'does_not_exist';
    const result = validateFlow(doc);
    assert.equal(result.valid, false);
    assert.match(messages(result), /next/i);
  });

  it('rejects a xor with only one branch', () => {
    const doc = cloneValid();
    doc.graph.nodes.X1.branches = [doc.graph.nodes.X1.branches[0]];
    const result = validateFlow(doc);
    assert.equal(result.valid, false);
    assert.match(messages(result), /branch/i);
  });

  it('rejects an and with only one branch', () => {
    const doc = cloneValid();
    doc.graph = {
      entry: 'fork',
      nodes: {
        fork: {
          type: 'and',
          label: 'Only one',
          branches: [{ id: 'fork.a', label: 'Left', next: 'done' }],
        },
        done: { type: 'end', label: 'Done' },
      },
    };
    const result = validateFlow(doc);
    assert.equal(result.valid, false);
    assert.match(messages(result), /branch/i);
  });

  it('rejects a message that names an undeclared actor', () => {
    const doc = cloneValid();
    doc.graph.nodes.S1.messages[0].from = 'ghost';
    const result = validateFlow(doc);
    assert.equal(result.valid, false);
    assert.match(messages(result), /actor/i);
  });

  it('rejects duplicate when values on the same xor', () => {
    const doc = cloneValid();
    doc.graph.nodes.X1.branches[1].when = doc.graph.nodes.X1.branches[0].when;
    const result = validateFlow(doc);
    assert.equal(result.valid, false);
    assert.match(messages(result), /when/i);
  });

  it('allows the same when on two different xor nodes', () => {
    const doc = cloneValid();
    doc.graph.nodes.X1.branches[0].next = 'X2';
    doc.graph.nodes.X2 = {
      type: 'xor',
      label: 'Again?',
      branches: [
        { id: 'X2.yes', when: 'accepts', label: 'Yes again', next: 'end_ok' },
        { id: 'X2.no', when: 'rejects', label: 'No again', next: 'end_no' },
      ],
    };
    const result = validateFlow(doc);
    assert.equal(result.valid, true, messages(result));
  });

  it('rejects a join.of that does not name an and', () => {
    const doc = cloneValid();
    doc.graph = {
      entry: 'S1',
      nodes: {
        S1: { type: 'activity', label: 'Start', next: 'J1' },
        J1: { type: 'join', of: 'S1', next: 'done' },
        done: { type: 'end', label: 'Done' },
      },
    };
    const result = validateFlow(doc);
    assert.equal(result.valid, false);
    assert.match(messages(result), /join|of|and/i);
  });

  it('rejects a subprocess.ref that is not in subgraphs', () => {
    const doc = cloneValid();
    doc.graph = {
      entry: 'S1',
      nodes: {
        S1: { type: 'subprocess', ref: 'missing', next: 'done' },
        done: { type: 'end', label: 'Done' },
      },
    };
    const result = validateFlow(doc);
    assert.equal(result.valid, false);
    assert.match(messages(result), /subgraph|ref/i);
  });

  it('rejects an event.kind outside timer|error', () => {
    const doc = cloneValid();
    doc.graph = {
      entry: 'E1',
      nodes: {
        E1: { type: 'event', kind: 'signal', next: 'done' },
        done: { type: 'end', label: 'Done' },
      },
    };
    const result = validateFlow(doc);
    assert.equal(result.valid, false);
    assert.match(messages(result), /allowed values|kind|enum|timer|error/i);
  });

  it('rejects a missing graph layer', () => {
    const doc = cloneValid();
    delete doc.graph;
    const result = validateFlow(doc);
    assert.equal(result.valid, false);
    assert.match(messages(result), /graph/i);
  });

  it('rejects a non-object', () => {
    const result = validateFlow(null);
    assert.equal(result.valid, false);
  });
});

describe('validateFlow — machines', () => {
  it('rejects a machine with empty nodes', () => {
    const doc = cloneValid();
    doc.machines[0].nodes = {};
    const result = validateFlow(doc);
    assert.equal(result.valid, false);
    assert.match(messages(result), /node|properties|min/i);
  });

  it('rejects a transition that omits the effects key', () => {
    const doc = cloneValid();
    delete doc.machines[0].transitions[0].effects;
    const result = validateFlow(doc);
    assert.equal(result.valid, false);
    assert.match(messages(result), /effect/i);
  });

  it('rejects an invalid via that does not name an xor branch id', () => {
    const doc = cloneValid();
    doc.machines[0].transitions[0].via = 'not-a-branch';
    const result = validateFlow(doc);
    assert.equal(result.valid, false);
    assert.match(messages(result), /via/i);
  });
});

describe('validateFlow — subgraph depth', () => {
  it(`exposes SUBGRAPH_MAX_DEPTH as ${8}`, () => {
    assert.equal(SUBGRAPH_MAX_DEPTH, 8);
  });

  it('rejects subgraph nesting deeper than SUBGRAPH_MAX_DEPTH', () => {
    const doc = cloneValid();
    const subgraphs = {};
    for (let i = 1; i <= SUBGRAPH_MAX_DEPTH + 1; i += 1) {
      const id = `sub${i}`;
      const nextId = i < SUBGRAPH_MAX_DEPTH + 1 ? `sub${i + 1}` : null;
      subgraphs[id] = {
        entry: 'n',
        nodes: {
          n: nextId
            ? { type: 'subprocess', ref: nextId, next: 'done' }
            : { type: 'activity', label: 'Leaf', next: 'done' },
          done: { type: 'end', label: 'Done' },
        },
      };
    }
    doc.graph = {
      entry: 'S1',
      nodes: {
        S1: { type: 'subprocess', ref: 'sub1', next: 'end' },
        end: { type: 'end', label: 'Done' },
      },
      subgraphs,
    };
    const result = validateFlow(doc);
    assert.equal(result.valid, false);
    assert.match(messages(result), /depth/i);
  });
});

describe('validateFlow — domain isolation', () => {
  it('does not encode PDTI domain rules or import IMPLEMENTATION_TOKEN_RE', () => {
    const src = readFileSync(join(ROOT, 'scripts', 'lib', 'validate-flow.js'), 'utf8');
    const schema = readFileSync(join(ROOT, 'meta', 'schemas', 'flow.schema.json'), 'utf8');
    const banned = [
      'PDTI',
      'GETIN',
      'lider_aceita',
      'lider_recusa',
      'D_edit',
      'statusTo === 10',
      'status 10',
      'three decisions',
      'IMPLEMENTATION_TOKEN_RE',
      'statusTo === 1',
      'status === 10',
      'exactly 3',
      '3 decisões',
    ];
    const haystack = `${src}\n${schema}`;
    for (const token of banned) {
      assert.equal(haystack.includes(token), false, `domain token leaked: ${token}`);
    }
  });
});

describe('assertValidFlow', () => {
  it('returns the document when valid', () => {
    const doc = cloneValid();
    assert.equal(assertValidFlow(doc), doc);
  });

  it('throws when invalid', () => {
    assert.throws(() => assertValidFlow({}), /invalid/i);
  });
});
