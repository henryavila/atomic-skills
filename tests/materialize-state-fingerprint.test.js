import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  existsSync,
  rmSync,
} from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  materializePair,
  assertTasksCoreMatchesSidecar,
} from '../scripts/materialize-state.js';

const STRONG_BI = {
  value:
    'Impedir materialize de publicar initiative cujo core SPEC divergiu do sidecar live com refuse deterministico.',
  workflow:
    'Sidecar captura tasks, materializePair hasheia sidecar vs initiative e recusa divergencia de core.',
  rules:
    'Hash live do sidecar e autoridade; allowlist summary weight businessIntent; fail closed no publish path.',
  outOfScope:
    'Spine quality lint F0 e smoke de verifier F2 ficam fora desta suite de fingerprint materialize-state.',
  doneWhen:
    'Testes node --test tests/materialize-state-fingerprint.test.js passam com refuse e happy-path publish.',
};

function planContent(phaseId = 'F1') {
  return `---
schemaVersion: "0.1"
slug: fp-demo
title: fp-demo
status: active
started: "2026-07-22T00:00:00.000Z"
lastUpdated: "2026-07-22T00:00:00.000Z"
currentPhase: ${phaseId}
phases:
  - id: ${phaseId}
    slug: fp-demo-f1
    title: F1
    goal: g
    dependsOn: []
    subPhaseCount: 1
    status: active
    businessIntent:
      value: ${JSON.stringify(STRONG_BI.value)}
      workflow: ${JSON.stringify(STRONG_BI.workflow)}
      rules: ${JSON.stringify(STRONG_BI.rules)}
      outOfScope: ${JSON.stringify(STRONG_BI.outOfScope)}
      doneWhen: ${JSON.stringify(STRONG_BI.doneWhen)}
    exitGate:
      summary: s
      criteria: []
---
`;
}

function initiativeContent({ tasksYaml, phaseId = 'F1' }) {
  return `---
schemaVersion: "0.1"
slug: fp-demo-f1
title: F1
goal: g
status: active
branch: null
started: "2026-07-22T00:00:00.000Z"
lastUpdated: "2026-07-22T00:00:00.000Z"
nextAction: null
parentPlan: fp-demo
phaseId: ${phaseId}
businessIntent:
  value: ${JSON.stringify(STRONG_BI.value)}
  workflow: ${JSON.stringify(STRONG_BI.workflow)}
  rules: ${JSON.stringify(STRONG_BI.rules)}
  outOfScope: ${JSON.stringify(STRONG_BI.outOfScope)}
  doneWhen: ${JSON.stringify(STRONG_BI.doneWhen)}
exitGates: []
stack: []
tasks:
${tasksYaml}
parked: []
emerged: []
---
`;
}

const matchingTaskYaml = `  - id: T-001
    title: Pure hash
    status: pending
    lastUpdated: "2026-07-22T00:00:00.000Z"
    summary: s
    weight: 2
    acceptance:
      - "it - same core"
    scopeBoundary:
      - "Do not write state"
    outputs:
      - kind: file
        path: src/tasks-fingerprint.js
    verifier:
      kind: shell
      command: "node --test tests/tasks-fingerprint.test.js"
`;

const rewrittenTaskYaml = `  - id: T-001
    title: Pure hash REWRITTEN
    status: pending
    lastUpdated: "2026-07-22T00:00:00.000Z"
    summary: s
    weight: 2
    acceptance:
      - "it - different acceptance breaks fingerprint"
    scopeBoundary:
      - "Do not write state"
    outputs:
      - kind: file
        path: src/tasks-fingerprint.js
    verifier:
      kind: shell
      command: "node --test tests/tasks-fingerprint.test.js"
`;

const allowlistOnlyYaml = `  - id: T-001
    title: Pure hash
    status: active
    lastUpdated: "2026-07-22T12:00:00.000Z"
    summary: different summary ok
    weight: 99
    acceptance:
      - "it - same core"
    scopeBoundary:
      - "Do not write state"
    outputs:
      - kind: file
        path: src/tasks-fingerprint.js
    verifier:
      kind: shell
      command: "node --test tests/tasks-fingerprint.test.js"
`;

const sidecarTasks = [
  {
    id: 'T-001',
    title: 'Pure hash',
    acceptance: ['it - same core'],
    scopeBoundary: ['Do not write state'],
    outputs: [{ kind: 'file', path: 'src/tasks-fingerprint.js' }],
    verifier: { kind: 'shell', command: 'node --test tests/tasks-fingerprint.test.js' },
  },
];

describe('materialize-state fingerprint refuse', () => {
  it('assertTasksCoreMatchesSidecar refuses rewritten core', () => {
    const root = mkdtempSync(join(tmpdir(), 'fp-assert-'));
    try {
      const initPath = join(root, 'f1-demo.md');
      const sidePath = join(root, 'f1-demo.source.json');
      writeFileSync(
        sidePath,
        JSON.stringify({ captureVersion: '0.1', phaseId: 'F1', tasks: sidecarTasks }),
      );
      const content = initiativeContent({ tasksYaml: rewrittenTaskYaml });
      assert.throws(
        () =>
          assertTasksCoreMatchesSidecar({
            initiativePath: initPath,
            initiativeContent: content,
            sidecarPath: sidePath,
          }),
        /tasks-fingerprint refuse/,
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('materializePair refuses rewritten tasks and does not create initiative', () => {
    const root = mkdtempSync(join(tmpdir(), 'fp-refuse-'));
    try {
      const planPath = join(root, 'plan.md');
      const initPath = join(root, 'phases', 'f1-demo.md');
      mkdirSync(join(root, 'phases'), { recursive: true });
      writeFileSync(
        join(root, 'phases', 'f1-demo.source.json'),
        JSON.stringify({ captureVersion: '0.1', phaseId: 'F1', tasks: sidecarTasks }),
      );
      assert.throws(
        () =>
          materializePair({
            planPath,
            initiativePath: initPath,
            planContent: planContent(),
            initiativeContent: initiativeContent({ tasksYaml: rewrittenTaskYaml }),
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

  it('materializePair publishes when only allowlist fields differ', () => {
    const root = mkdtempSync(join(tmpdir(), 'fp-ok-'));
    try {
      const planPath = join(root, 'plan.md');
      const initPath = join(root, 'phases', 'f1-demo.md');
      mkdirSync(join(root, 'phases'), { recursive: true });
      writeFileSync(
        join(root, 'phases', 'f1-demo.source.json'),
        JSON.stringify({ captureVersion: '0.1', phaseId: 'F1', tasks: sidecarTasks }),
      );
      const res = materializePair({
        planPath,
        initiativePath: initPath,
        planContent: planContent(),
        initiativeContent: initiativeContent({ tasksYaml: allowlistOnlyYaml }),
        rootDir: root,
        successorBarrier: { skip: true },
      });
      assert.equal(res.ok, true);
      assert.equal(existsSync(initPath), true);
      const body = readFileSync(initPath, 'utf8');
      assert.match(body, /different summary ok/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('matching core publishes (happy path)', () => {
    const root = mkdtempSync(join(tmpdir(), 'fp-match-'));
    try {
      const planPath = join(root, 'plan.md');
      const initPath = join(root, 'phases', 'f1-demo.md');
      mkdirSync(join(root, 'phases'), { recursive: true });
      writeFileSync(
        join(root, 'phases', 'f1-demo.source.json'),
        JSON.stringify({ captureVersion: '0.1', phaseId: 'F1', tasks: sidecarTasks }),
      );
      const res = materializePair({
        planPath,
        initiativePath: initPath,
        planContent: planContent(),
        initiativeContent: initiativeContent({ tasksYaml: matchingTaskYaml }),
        rootDir: root,
        successorBarrier: { skip: true },
      });
      assert.equal(res.ok, true);
      assert.equal(existsSync(initPath), true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
