/**
 * PR1 — flow schema 1.0 + core validator.
 * Domain PDTI must stay in fixtures, never in the validator.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateFlow, assertValidFlow } from '../scripts/lib/validate-flow.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DOGFOOD = join(ROOT, 'docs', 'design', 'project-flow', 'dogfood', 'fluxo-sugestao.json');
const MINIMAL = join(ROOT, 'docs', 'design', 'project-flow', 'dogfood', 'minimal-xor.json');

function loadJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function messages(result) {
  return (result.errors ?? []).map((e) => e.message ?? String(e)).join('\n');
}

function cloneMinimal() {
  return structuredClone(loadJson(MINIMAL));
}

describe('validateFlow — fixtures', () => {
  it('accepts the enveloped dogfood fixture (schema 1.0 + lifecycle + graph)', () => {
    const doc = loadJson(DOGFOOD);
    const result = validateFlow(doc);
    assert.equal(result.valid, true, messages(result));
    assert.equal(doc.schemaVersion, '1.0');
    assert.ok(doc.graph?.entry);
    assert.ok(doc.graph?.nodes);
    assert.equal(doc.entry, undefined);
    assert.equal(doc.nodes, undefined);
    assert.equal(doc.version, undefined);
  });

  it('accepts the minimal fixture (2 actors, 1 xor, no status 10/1/11)', () => {
    const doc = loadJson(MINIMAL);
    const result = validateFlow(doc);
    assert.equal(result.valid, true, messages(result));
    assert.equal(doc.actors.length, 2);
    const xorCount = Object.values(doc.graph.nodes).filter((n) => n.type === 'decision').length;
    assert.equal(xorCount, 1);
    const blob = JSON.stringify(doc);
    assert.equal(/\bstatusTo\b/.test(blob), false);
    assert.equal(/\b"status":\s*(10|1|11)\b/.test(blob), false);
  });

  it('keeps ratifiedGraphSha optional until a stamp exists', () => {
    const doc = cloneMinimal();
    assert.equal('ratifiedGraphSha' in doc, false);
    assert.equal(validateFlow(doc).valid, true, messages(validateFlow(doc)));
  });
});

describe('validateFlow — core graph errors', () => {
  it('rejects a broken next (unknown node id)', () => {
    const doc = cloneMinimal();
    doc.graph.nodes.S1.next = 'does-not-exist';
    const result = validateFlow(doc);
    assert.equal(result.valid, false);
    assert.match(messages(result), /next/i);
  });

  it('rejects a xor decision with only one branch', () => {
    const doc = cloneMinimal();
    doc.graph.nodes.D1.branches = [doc.graph.nodes.D1.branches[0]];
    const result = validateFlow(doc);
    assert.equal(result.valid, false);
    assert.match(messages(result), /branch/i);
  });

  it('rejects a message that names an undeclared actor', () => {
    const doc = cloneMinimal();
    doc.graph.nodes.S1.messages[0].from = 'ghost';
    const result = validateFlow(doc);
    assert.equal(result.valid, false);
    assert.match(messages(result), /actor/i);
  });

  it('rejects a decision actor that is not in actors[]', () => {
    const doc = cloneMinimal();
    doc.graph.nodes.D1.actor = 'ghost';
    const result = validateFlow(doc);
    assert.equal(result.valid, false);
    assert.match(messages(result), /actor/i);
  });

  it('rejects duplicate when values on the same xor', () => {
    const doc = cloneMinimal();
    doc.graph.nodes.D1.branches[1].when = doc.graph.nodes.D1.branches[0].when;
    const result = validateFlow(doc);
    assert.equal(result.valid, false);
    assert.match(messages(result), /when/i);
  });

  it('rejects an unreachable graph node', () => {
    const doc = cloneMinimal();
    doc.graph.nodes.orphan = {
      type: 'end',
      processLabel: 'Never reached',
    };
    const result = validateFlow(doc);
    assert.equal(result.valid, false);
    assert.match(messages(result), /reach/i);
  });

  it('rejects states.via that does not name a branch id', () => {
    const doc = cloneMinimal();
    doc.states = {
      entry: 'open',
      nodes: {
        open: { label: 'Open' },
        closed: { label: 'Closed' },
      },
      transitions: [
        {
          id: 'T1',
          from: 'open',
          to: 'closed',
          when: 'accepts',
          label: 'Goes to closed',
          via: 'not-a-branch',
        },
      ],
    };
    const result = validateFlow(doc);
    assert.equal(result.valid, false);
    assert.match(messages(result), /via/i);
  });

  it('rejects a missing graph layer', () => {
    const doc = cloneMinimal();
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

describe('validateFlow — domain isolation', () => {
  it('does not encode PDTI domain rules in the validator or schema', () => {
    const src = readFileSync(join(ROOT, 'scripts', 'lib', 'validate-flow.js'), 'utf8');
    const schema = readFileSync(join(ROOT, 'meta', 'schemas', 'flow.schema.json'), 'utf8');
    const banned = [
      'PDTI',
      'GETIN',
      'lider_aceita',
      'lider_recusa',
      'D_edit',
      'statusTo === 10',
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
    const doc = cloneMinimal();
    assert.equal(assertValidFlow(doc), doc);
  });

  it('throws when invalid', () => {
    assert.throws(() => assertValidFlow({}), /invalid/i);
  });
});
