/**
 * Integration: R1 weak spine, R2 tautological SPEC, R3 fingerprint refuse, happy path.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { firstWeakField, findWeakBusinessIntent } from '../scripts/find-weak-business-intent.js';
import { lintSpec } from '../scripts/lint-source.js';
import { materializePair } from '../scripts/materialize-state.js';

const STRONG = {
  value:
    'Fechar o buraco de rubber-stamp com lint HARD de qualidade da spine antes da fase ativar implementacao.',
  workflow:
    'Operador preenche a spine, detector de presenca roda, detector de qualidade roda, so entao a fase fica ativa.',
  rules:
    'Zero LLM no path critico de gate; presenca e qualidade sao detectores separados; fail closed sem approve-anyway.',
  outOfScope:
    'Fingerprint de tasks no materialize-state e smoke de verifier no SPEC admit ficam fora desta checagem de spine.',
  doneWhen:
    'O comando node scripts/find-weak-business-intent.js sai 0 em fixtures fortes e 1 em fracas; testes node --test passam.',
};

describe('plan-quality-guards integration', () => {
  it('R1: weak spine fails closed via firstWeakField', () => {
    const w = firstWeakField({
      ...STRONG,
      value: 'should probably improve things for users in general somehow now',
    });
    assert.ok(w);
    assert.equal(w.reason, 'soft-language');
  });

  it('R2: tautological verifier fails SPEC', () => {
    const md = `# t
## F0 — p
### T-001 t
- Files: src/a.js
- scopeBoundary: none
- acceptance: it - src/a.js is correct.
- verifier: { kind: shell, command: "exit 0", expectExitCode: 0 }
`;
    const v = lintSpec(md);
    assert.ok(v.some((x) => /tautological/i.test(x)));
  });

  it('R3: core mismatch refuses publish', () => {
    const root = mkdtempSync(join(tmpdir(), 'int-r3-'));
    try {
      const planPath = join(root, 'plan.md');
      const initPath = join(root, 'phases', 'f1.md');
      mkdirSync(join(root, 'phases'), { recursive: true });
      const tasks = [
        {
          id: 'T-001',
          title: 'X',
          acceptance: ['a'],
          scopeBoundary: ['b'],
          outputs: [{ path: 'src/x.js' }],
          verifier: { kind: 'shell', command: 'node --test tests/x.test.js' },
        },
      ];
      writeFileSync(
        join(root, 'phases', 'f1.source.json'),
        JSON.stringify({ captureVersion: '0.1', phaseId: 'F1', tasks }),
      );
      const bi = Object.fromEntries(
        Object.entries(STRONG).map(([k, v]) => [k, JSON.stringify(v)]),
      );
      const plan = `---
schemaVersion: "0.1"
slug: int
title: int
status: active
started: "2026-07-22T00:00:00.000Z"
lastUpdated: "2026-07-22T00:00:00.000Z"
currentPhase: F1
phases:
  - id: F1
    slug: f1
    title: F1
    goal: g
    dependsOn: []
    subPhaseCount: 1
    status: active
    businessIntent:
      value: ${bi.value}
      workflow: ${bi.workflow}
      rules: ${bi.rules}
      outOfScope: ${bi.outOfScope}
      doneWhen: ${bi.doneWhen}
    exitGate: { summary: s, criteria: [] }
---
`;
      const init = `---
schemaVersion: "0.1"
slug: f1
title: F1
goal: g
status: active
branch: null
started: "2026-07-22T00:00:00.000Z"
lastUpdated: "2026-07-22T00:00:00.000Z"
nextAction: null
parentPlan: int
phaseId: F1
businessIntent:
  value: ${bi.value}
  workflow: ${bi.workflow}
  rules: ${bi.rules}
  outOfScope: ${bi.outOfScope}
  doneWhen: ${bi.doneWhen}
exitGates: []
stack: []
tasks:
  - id: T-001
    title: REWRITTEN
    status: pending
    lastUpdated: "2026-07-22T00:00:00.000Z"
    acceptance: ["a"]
    scopeBoundary: ["b"]
    outputs: [{ kind: file, path: src/x.js }]
    verifier: { kind: shell, command: "node --test tests/x.test.js" }
parked: []
emerged: []
---
`;
      assert.throws(
        () =>
          materializePair({
            planPath,
            initiativePath: initPath,
            planContent: plan,
            initiativeContent: init,
            rootDir: root,
            successorBarrier: { skip: true },
          }),
        /tasks-fingerprint refuse/,
      );
      assert.equal(existsSync(initPath), false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('happy: strong spine object + SPEC with real verifier + overlap', () => {
    assert.equal(firstWeakField(STRONG), null);
    const md = `# t
## F0 — p
### T-001 t
- Files: scripts/find-weak-business-intent.js, tests/find-weak-business-intent.test.js
- scopeBoundary: Do not call LLM.
- acceptance: it - tests/find-weak-business-intent.test.js passes.
- verifier: { kind: shell, command: "node --test tests/find-weak-business-intent.test.js", expectExitCode: 0 }
`;
    assert.deepEqual(lintSpec(md), []);
  });
});
