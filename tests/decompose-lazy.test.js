import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';
import Ajv from 'ajv/dist/2020.js';
import { decomposePlan, materializeDecomposition } from '../src/decompose.js';
import { validateFile, collectTargets } from '../scripts/validate-state.js';
import { findMissingSummaries } from '../scripts/find-missing-summaries.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const SCHEMA_DIR = join(__dirname, '..', 'meta', 'schemas');
const FIXTURE = readFileSync(join(__dirname, 'fixtures/project-plan/sample-source.md'), 'utf8');
// F0+F1+F2: F0 has 3 tasks + 2 exit gates; F1 has 2 tasks + 1 exit gate; F2 has
// 2 tasks + 0 exit gates. Exactly the >=2-phase source T-006's acceptance names.

function buildValidators() {
  const ajv = new Ajv({ allErrors: true, strict: false });
  for (const name of ['common.schema.json', 'plan.schema.json', 'initiative.schema.json']) {
    const schema = JSON.parse(readFileSync(join(SCHEMA_DIR, name), 'utf8'));
    ajv.addSchema(schema);
  }
  return {
    validatePlan: ajv.getSchema('https://atomic-skills.henryavila.com/schemas/plan.schema.json'),
    validateInitiative: ajv.getSchema('https://atomic-skills.henryavila.com/schemas/initiative.schema.json'),
  };
}

function fmOf(content) {
  return parseYaml(content.split('---\n')[1]);
}

function writeTree(tmpRoot, files) {
  for (const f of files) {
    const absPath = join(tmpRoot, f.relativePath);
    mkdirSync(dirname(absPath), { recursive: true });
    writeFileSync(absPath, f.content, 'utf8');
  }
}

describe('materializeDecomposition — lazy (T-006 / D1): materializes only F0', () => {
  const FROZEN = new Date('2026-07-01T09:00:00.000Z');

  it('emits exactly 1 plan + 1 initiative (F0) + one source sidecar per later phase (F1, F2)', () => {
    const r = decomposePlan(FIXTURE, { planSlug: 'sample' });
    const files = materializeDecomposition(r, { planSlug: 'sample', projectId: 'atomic-skills', now: FROZEN });
    const byKind = { plan: [], initiative: [], source: [] };
    for (const f of files) (byKind[f.kind] ||= []).push(f);
    assert.equal(byKind.plan.length, 1, 'one plan file');
    assert.equal(byKind.initiative.length, 1, 'exactly ONE initiative file (F0)');
    assert.equal(byKind.initiative[0].slug.startsWith('sample-f0'), true, 'the single initiative is F0');
    assert.equal(byKind.source.length, 2, 'one source sidecar per F1..N (F1, F2)');
    assert.deepEqual(
      byKind.source.map((f) => f.slug.startsWith('sample-f1') || f.slug.startsWith('sample-f2')).sort(),
      [true, true],
      'sidecars are for F1 and F2',
    );
    // No third+ initiative leaks: F1/F2 are NOT materialized as initiatives.
    assert.equal(files.filter((f) => f.kind === 'initiative').length, 1);
  });

  it('plan phases[] keeps all 3 descriptors: F0 subPhaseCount=tasks, F1/F2 subPhaseCount:0, exitGate retained', () => {
    const r = decomposePlan(FIXTURE, { planSlug: 'sample' });
    const files = materializeDecomposition(r, { planSlug: 'sample', projectId: 'atomic-skills', now: FROZEN });
    const planFm = fmOf(files.find((f) => f.kind === 'plan').content);
    assert.equal(planFm.phases.length, 3, 'all 3 phase descriptors retained from the source');
    const [f0, f1, f2] = planFm.phases;
    assert.equal(f0.id, 'F0');
    assert.equal(f1.id, 'F1');
    assert.equal(f2.id, 'F2');
    assert.equal(f0.status, 'active');
    assert.equal(f1.status, 'pending');
    assert.equal(f2.status, 'pending');
    // subPhaseCount: F0 = real task count (3); F1/F2 = 0 (honest placeholder,
    // distinct from "materialized empty").
    assert.equal(f0.subPhaseCount, 3);
    assert.equal(f1.subPhaseCount, 0);
    assert.equal(f2.subPhaseCount, 0);
    // exitGate retained up-front from the source for every phase.
    assert.equal(f0.exitGate.criteria.length, 2);
    assert.equal(f1.exitGate.criteria.length, 1);
    assert.equal(f2.exitGate.criteria.length, 0, 'F2 had no exit_gate in source; empty criteria retained honestly');
    // dependsOn stays sequential (unchanged by lazy).
    assert.deepEqual(f0.dependsOn, []);
    assert.deepEqual(f1.dependsOn, ['F0']);
    assert.deepEqual(f2.dependsOn, ['F1']);
    assert.equal(planFm.currentPhase, 'F0');
  });

  it('F0 initiative is the single materialized initiative and carries its tasks/exitGates', () => {
    const r = decomposePlan(FIXTURE, { planSlug: 'sample' });
    const files = materializeDecomposition(r, { planSlug: 'sample', projectId: 'atomic-skills', now: FROZEN });
    const init = files.find((f) => f.kind === 'initiative');
    const initFm = fmOf(init.content);
    assert.equal(initFm.phaseId, 'F0');
    assert.equal(initFm.status, 'active');
    assert.equal(initFm.tasks.length, 3);
    assert.equal(initFm.tasks[0].id, 'T0.1');
    assert.equal(initFm.exitGates.length, 2);
  });

  it('emits phases/<slug>.source.json (nested) with the parsed per-phase source for F1/F2', () => {
    const r = decomposePlan(FIXTURE, { planSlug: 'sample' });
    const files = materializeDecomposition(r, { planSlug: 'sample', projectId: 'atomic-skills', now: FROZEN });
    const sources = files.filter((f) => f.kind === 'source');
    // Nested path layout: <planDir>/phases/<file>.source.json, filename drops the
    // redundant planSlug prefix (same convention as initiative files).
    for (const f of sources) {
      assert.match(f.relativePath, /^\.atomic-skills\/projects\/atomic-skills\/sample\/phases\/f[12]-[^/]+\.source\.json$/);
    }
    const byPhase = Object.fromEntries(sources.map((f) => [JSON.parse(f.content).phaseId, JSON.parse(f.content)]));
    const f1 = byPhase.F1;
    const f2 = byPhase.F2;
    // F1 capture: goal + raw tasks + exitGates (what the F3 materialize verb consumes).
    assert.equal(f1.captureVersion, '0.1');
    assert.equal(f1.phaseId, 'F1');
    assert.match(f1.goal, /rebuild admin UI/);
    assert.equal(f1.tasks.length, 2);
    assert.equal(f1.tasks[0].id, 'T1.1');
    assert.equal(f1.tasks[1].id, 'T1.2');
    assert.equal(f1.exitGates.length, 1);
    assert.equal(f1.exitGates[0].id, 'F1-G1');
    // F2 capture: goal + raw tasks + empty exitGates (source had none).
    assert.equal(f2.phaseId, 'F2');
    assert.match(f2.goal, /extra features that build on F1/);
    assert.equal(f2.tasks.length, 2);
    assert.equal(f2.tasks[0].id, 'T2.1');
    assert.deepEqual(f2.exitGates, []);
  });

  it('flat layout (no projectId) emits initiatives/<slug>.source.json', () => {
    const r = decomposePlan(FIXTURE, { planSlug: 'sample' });
    const files = materializeDecomposition(r, { planSlug: 'sample', now: FROZEN });
    const sources = files.filter((f) => f.kind === 'source');
    assert.equal(sources.length, 2);
    for (const f of sources) {
      assert.match(f.relativePath, /^\.atomic-skills\/initiatives\/sample-f[12]-[^/]+\.source\.json$/);
    }
    assert.equal(files.filter((f) => f.kind === 'initiative').length, 1, 'flat lazy also materializes only F0');
  });

  it('single-phase plan still fully materializes F0 (no sidecar, no regression)', () => {
    const stub = '# Tiny\n\n## F0 — Only\n\nGoal: one phase.\n\n### T0.1 Do it\n';
    const r = decomposePlan(stub, { planSlug: 'tiny' });
    const files = materializeDecomposition(r, { planSlug: 'tiny', projectId: 'p', now: FROZEN });
    assert.equal(files.filter((f) => f.kind === 'initiative').length, 1);
    assert.equal(files.filter((f) => f.kind === 'source').length, 0, 'no sidecar when there is no F1..N');
    const planFm = fmOf(files.find((f) => f.kind === 'plan').content);
    assert.equal(planFm.phases[0].subPhaseCount, 1);
  });

  it('plan frontmatter validates against plan.schema.json (lazy descriptors are schema-valid)', () => {
    const r = decomposePlan(FIXTURE, { planSlug: 'sample' });
    const files = materializeDecomposition(r, { planSlug: 'sample', projectId: 'atomic-skills', now: FROZEN });
    const planFm = fmOf(files.find((f) => f.kind === 'plan').content);
    const validators = buildValidators();
    const ok = validators.validatePlan(planFm);
    assert.equal(ok, true, `lazy plan must validate: ${JSON.stringify(validators.validatePlan.errors)}`);
  });

  it('the F0 initiative validates against initiative.schema.json', () => {
    const r = decomposePlan(FIXTURE, { planSlug: 'sample' });
    const files = materializeDecomposition(r, { planSlug: 'sample', projectId: 'atomic-skills', now: FROZEN });
    const validators = buildValidators();
    const init = files.find((f) => f.kind === 'initiative');
    const ok = validators.validateInitiative(fmOf(init.content));
    assert.equal(ok, true, `F0 initiative must validate: ${JSON.stringify(validators.validateInitiative.errors)}`);
  });

  it('validate-state.js ignores the .source.json sidecar — it is not collected as a target (F-002)', () => {
    const r = decomposePlan(FIXTURE, { planSlug: 'sample' });
    const files = materializeDecomposition(r, { planSlug: 'sample', projectId: 'atomic-skills', branch: 'main', now: FROZEN });
    const tmpRoot = mkdtempSync(join(tmpdir(), 'as-lazy-'));
    try {
      writeTree(tmpRoot, files);
      // collectTargets is validate-state's *.md collector; the .source.json sidecar
      // must never appear in it (it is a capture artifact, not validated state).
      const targets = collectTargets([tmpRoot]);
      const jsonTargets = targets.filter((t) => t.endsWith('.source.json'));
      assert.deepEqual(jsonTargets, [], 'sidecar .json must NOT be collected for validation');
      // Every collected *.md still validates.
      const validators = buildValidators();
      for (const t of targets) {
        const result = validateFile(t, validators);
        assert.equal(result.ok, true, `validateFile failed for ${t}: ${JSON.stringify(result.errors)}`);
      }
      // The sidecar files exist on disk next to the .md initiatives...
      const phasesDir = join(tmpRoot, '.atomic-skills/projects/atomic-skills/sample/phases');
      const phaseEntries = readdirSync(phasesDir);
      assert.ok(phaseEntries.some((e) => e.endsWith('.source.json')), 'sidecar is physically present in phases/');
      assert.ok(phaseEntries.some((e) => e.endsWith('.md')), 'F0 initiative .md is present alongside');
    } finally {
      rmSync(tmpRoot, { recursive: true, force: true });
    }
  });

  // C-2 / C1#1: a businessIntent spine passed to materialize must be COMPLETE
  // (schema-required value/workflow/rules/outOfScope/doneWhen, each non-empty).
  // The writer used to copy any non-array object verbatim onto BOTH the descriptor
  // and the F0 initiative, producing schema-invalid state caught only downstream.
  // Now it fails closed at the write boundary.
  const COMPLETE_BI = {
    value: 'ship the thing', workflow: 'do the steps', rules: 'follow them',
    outOfScope: 'not that', doneWhen: 'it passes',
  };

  it('throws on an INCOMPLETE businessIntent instead of writing schema-invalid state', () => {
    const r = decomposePlan(FIXTURE, { planSlug: 'sample' });
    const partial = { ...COMPLETE_BI };
    delete partial.doneWhen; // one required field missing
    assert.throws(
      () => materializeDecomposition(r, { planSlug: 'sample', projectId: 'atomic-skills', now: FROZEN, businessIntent: partial }),
      /businessIntent/i,
      'an incomplete spine must fail closed at materialize, not reach disk',
    );
    // A non-string / blank field is equally rejected.
    assert.throws(
      () => materializeDecomposition(r, { planSlug: 'sample', projectId: 'atomic-skills', now: FROZEN, businessIntent: { ...COMPLETE_BI, value: '   ' } }),
      /businessIntent/i,
    );
  });

  it('a COMPLETE businessIntent writes a schema-valid descriptor AND F0 initiative', () => {
    const r = decomposePlan(FIXTURE, { planSlug: 'sample' });
    const files = materializeDecomposition(r, { planSlug: 'sample', projectId: 'atomic-skills', now: FROZEN, businessIntent: COMPLETE_BI });
    const validators = buildValidators();
    const planFm = fmOf(files.find((f) => f.kind === 'plan').content);
    assert.equal(planFm.phases[0].businessIntent.doneWhen, 'it passes');
    assert.equal(validators.validatePlan(planFm), true, `plan invalid: ${JSON.stringify(validators.validatePlan.errors)}`);
    const initFm = fmOf(files.find((f) => f.kind === 'initiative').content);
    assert.equal(initFm.businessIntent.value, 'ship the thing');
    assert.equal(validators.validateInitiative(initFm), true, `initiative invalid: ${JSON.stringify(validators.validateInitiative.errors)}`);
  });

  it('find-missing-summaries.js skips the .source.json sidecar (presence does not break or false-positive)', () => {
    const r = decomposePlan(FIXTURE, { planSlug: 'sample' });
    const files = materializeDecomposition(r, { planSlug: 'sample', projectId: 'atomic-skills', now: FROZEN });
    const tmpRoot = mkdtempSync(join(tmpdir(), 'as-lazy-fms-'));
    try {
      writeTree(tmpRoot, files);
      // Must not throw on a tree containing the sidecar; the .json is filtered by
      // endsWith('.md') in every phases/ scan, so it never masquerades as an initiative.
      const report = findMissingSummaries(tmpRoot);
      assert.ok(Array.isArray(report), 'findMissingSummaries returns a report array');
      // The sidecar is never parsed as an initiative: no finding attributes a phase
      // to a .source.json. (Descriptor-missing-summary for descriptor-only F1/F2 is
      // a reader concern owned by T-007, not this sidecar-ignoring guarantee.)
      const jsonOnDisk = readdirSync(join(tmpRoot, '.atomic-skills/projects/atomic-skills/sample/phases'))
        .filter((e) => e.endsWith('.source.json'));
      assert.ok(jsonOnDisk.length > 0, 'sidecar present');
    } finally {
      rmSync(tmpRoot, { recursive: true, force: true });
    }
  });
});
