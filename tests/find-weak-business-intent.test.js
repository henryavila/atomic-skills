/**
 * Golden tests for find-weak-business-intent (R1 spine quality).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  firstWeakField,
  findWeakBusinessIntent,
  MIN_FIELD_LENGTH,
  SOFT_LANGUAGE_RE,
} from '../scripts/find-weak-business-intent.js';

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

function biYaml(bi, indent) {
  const pad = ' '.repeat(indent);
  return SPINE_FIELDS_LOCAL.map((k) => `${pad}${k}: ${JSON.stringify(bi[k])}`).join('\n');
}

const SPINE_FIELDS_LOCAL = ['value', 'workflow', 'rules', 'outOfScope', 'doneWhen'];

function writeNestedFixture(root, { planBi, initBi, phaseId = 'F0' }) {
  const planDir = join(root, 'projects', 'demo', 'sample-plan');
  const phasesDir = join(planDir, 'phases');
  mkdirSync(phasesDir, { recursive: true });
  writeFileSync(
    join(planDir, 'plan.md'),
    `---
schemaVersion: "0.1"
slug: sample-plan
title: Sample
status: active
started: "2026-07-22T00:00:00.000Z"
lastUpdated: "2026-07-22T00:00:00.000Z"
currentPhase: ${phaseId}
phases:
  - id: ${phaseId}
    slug: sample-f0
    title: F0
    goal: g
    dependsOn: []
    subPhaseCount: 1
    status: active
    businessIntent:
${biYaml(planBi, 6)}
    exitGate:
      summary: s
      criteria: []
---
`,
  );
  writeFileSync(
    join(phasesDir, 'f0-sample.md'),
    `---
schemaVersion: "0.1"
slug: sample-plan-f0
title: F0
goal: g
status: active
branch: null
started: "2026-07-22T00:00:00.000Z"
lastUpdated: "2026-07-22T00:00:00.000Z"
nextAction: null
parentPlan: sample-plan
phaseId: ${phaseId}
businessIntent:
${biYaml(initBi, 2)}
exitGates: []
stack: []
tasks: []
parked: []
emerged: []
---
`,
  );
  return planDir;
}

describe('firstWeakField', () => {
  it('returns null for a strong spine', () => {
    assert.equal(firstWeakField(STRONG), null);
  });

  it('flags soft-language (G2 should)', () => {
    const bi = {
      ...STRONG,
      value: 'This feature should improve the quality of the phase business intent spine a lot.',
    };
    const w = firstWeakField(bi);
    assert.ok(w);
    assert.equal(w.field, 'value');
    assert.equal(w.reason, 'soft-language');
    assert.match('should improve', SOFT_LANGUAGE_RE);
  });

  it('flags too-short fields', () => {
    const bi = { ...STRONG, rules: 'x'.repeat(MIN_FIELD_LENGTH - 1) };
    const w = firstWeakField(bi);
    assert.ok(w);
    assert.equal(w.field, 'rules');
    assert.match(w.reason, /too-short/);
  });

  it('flags outOfScope echo of value', () => {
    const bi = {
      ...STRONG,
      value: STRONG.value,
      outOfScope: STRONG.value,
    };
    const w = firstWeakField(bi);
    assert.ok(w);
    assert.equal(w.field, 'outOfScope');
    assert.equal(w.reason, 'echo-of-value');
  });

  it('flags doneWhen without observable token', () => {
    const bi = {
      ...STRONG,
      doneWhen:
        'Quando a intencao de negocio estiver suficientemente clara para todos os envolvidos no time.',
    };
    const w = firstWeakField(bi);
    assert.ok(w);
    assert.equal(w.field, 'doneWhen');
    assert.equal(w.reason, 'no-observable-token');
  });

  it('flags filler-only', () => {
    const bi = { ...STRONG, value: 'melhorar UX' };
    const w = firstWeakField(bi);
    assert.ok(w);
    assert.equal(w.reason, 'filler-only');
  });
});

describe('findWeakBusinessIntent scan', () => {
  it('exit-shaped: strong fixture yields empty report', () => {
    const root = mkdtempSync(join(tmpdir(), 'weak-bi-strong-'));
    try {
      const state = join(root, '.atomic-skills');
      mkdirSync(state, { recursive: true });
      writeNestedFixture(state, { planBi: STRONG, initBi: STRONG });
      const report = findWeakBusinessIntent(state);
      assert.deepEqual(report, []);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('weak fixture reports phase and surface', () => {
    const root = mkdtempSync(join(tmpdir(), 'weak-bi-weak-'));
    try {
      const state = join(root, '.atomic-skills');
      mkdirSync(state, { recursive: true });
      const weak = {
        ...STRONG,
        value: 'should probably improve things for users in general somehow now',
      };
      writeNestedFixture(state, { planBi: weak, initBi: weak });
      const report = findWeakBusinessIntent(state);
      assert.ok(report.length >= 1);
      assert.ok(report[0].weak.some((w) => w.reason === 'soft-language'));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('descriptor-only phase is ignored', () => {
    const root = mkdtempSync(join(tmpdir(), 'weak-bi-desc-'));
    try {
      const state = join(root, '.atomic-skills');
      const planDir = join(state, 'projects', 'demo', 'only-desc');
      mkdirSync(join(planDir, 'phases'), { recursive: true });
      writeFileSync(
        join(planDir, 'plan.md'),
        `---
schemaVersion: "0.1"
slug: only-desc
title: t
status: active
started: 2026-07-22T00:00:00.000Z
lastUpdated: 2026-07-22T00:00:00.000Z
currentPhase: F0
phases:
  - id: F0
    slug: f0
    title: F0
    goal: g
    dependsOn: []
    subPhaseCount: 0
    status: pending
    businessIntent:
      value: should probably be ignored because no initiative file exists yet for this phase here
      workflow: should probably be ignored because no initiative file exists yet for this phase here
      rules: should probably be ignored because no initiative file exists yet for this phase here
      outOfScope: should probably be ignored because no initiative file exists yet for this phase here
      doneWhen: should probably be ignored because no initiative file exists yet for this phase here
    exitGate:
      summary: s
      criteria: []
---
`,
      );
      // no initiative .md
      const report = findWeakBusinessIntent(state);
      assert.deepEqual(report, []);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
