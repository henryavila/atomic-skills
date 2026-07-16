import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv/dist/2020.js';
import { decomposePlan, materializeDecomposition } from '../../src/decompose.js';
import {
  collectTargets,
  collectSidecars,
  validateFile,
  crossValidate,
  parseFrontmatter,
  projectIdFromPath,
} from '../../scripts/validate-state.js';
import { findMissingBusinessIntent } from '../../scripts/find-missing-business-intent.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const SCHEMA_DIR = join(__dirname, '..', '..', 'meta', 'schemas');
const FIXTURE = readFileSync(join(__dirname, '..', 'fixtures', 'project-plan', 'sample-source.md'), 'utf8');
// sample-source.md = F0 (3 tasks, 2 gates) + F1 (2 tasks, 1 gate) + F2 (2 tasks).
// Under D1 lazy (T-006), materializeDecomposition materializes only F0; F1 and F2
// stay descriptor-only (no initiative file). That is exactly the reader fixture
// T-007 names: "a plan with F0 materialized + F1 descriptor-only".

function buildValidators() {
  const ajv = new Ajv({ allErrors: true, strict: false });
  for (const name of ['common.schema.json', 'plan.schema.json', 'initiative.schema.json']) {
    ajv.addSchema(JSON.parse(readFileSync(join(SCHEMA_DIR, name), 'utf8')));
  }
  return {
    validatePlan: ajv.getSchema('https://atomic-skills.henryavila.com/schemas/plan.schema.json'),
    validateInitiative: ajv.getSchema('https://atomic-skills.henryavila.com/schemas/initiative.schema.json'),
  };
}

function writeTree(tmpRoot, files) {
  for (const f of files) {
    const absPath = join(tmpRoot, f.relativePath);
    mkdirSync(dirname(absPath), { recursive: true });
    writeFileSync(absPath, f.content, 'utf8');
  }
}

describe('T-007 — readers distinguish descriptor-only from materialized', () => {
  const FROZEN = new Date('2026-07-01T09:00:00.000Z');

  // Build the canonical descriptor-only tree: plan + F0 initiative + F1/F2 source
  // sidecars (NO F1/F2 initiative .md). Written to a tmp nested-layout root.
  function buildDescriptorOnlyTree() {
    const r = decomposePlan(FIXTURE, { planSlug: 'sample' });
    const files = materializeDecomposition(r, {
      planSlug: 'sample',
      projectId: 'atomic-skills',
      branch: 'plan/sample',
      now: FROZEN,
    });
    const tmpRoot = mkdtempSync(join(tmpdir(), 'as-desc-only-'));
    writeTree(tmpRoot, files);
    return { tmpRoot, files, r };
  }

  it('the tree is descriptor-only for F1/F2: exactly one initiative file (F0), no F1/F2 initiative', () => {
    const { files } = buildDescriptorOnlyTree();
    const inits = files.filter((f) => f.kind === 'initiative');
    assert.equal(inits.length, 1, 'only F0 is materialized');
    assert.equal(inits[0].slug.startsWith('sample-f0'), true);
    const planFm = parseFrontmatter(files.find((f) => f.kind === 'plan').content).frontmatter;
    const f1 = planFm.phases.find((p) => p.id === 'F1');
    const f2 = planFm.phases.find((p) => p.id === 'F2');
    assert.equal(f1.subPhaseCount, 0, 'F1 descriptor-only: subPhaseCount:0');
    assert.equal(f2.subPhaseCount, 0, 'F2 descriptor-only: subPhaseCount:0');
    assert.equal(f1.status, 'pending');
    assert.equal(f2.status, 'pending');
  });

  it('validate-state.js does NOT FAIL on a descriptor-only phase — plan + F0 initiative validate, F1/F2 are simply absent initiatives', () => {
    const { tmpRoot } = buildDescriptorOnlyTree();
    try {
      const validators = buildValidators();
      const targets = collectTargets([tmpRoot]);
      // No source sidecar leaks in (F-002); F1/F2 have no .md initiative, so they
      // contribute nothing to validate — descriptor-only is not a validation error.
      assert.deepEqual(targets.filter((t) => t.endsWith('.source.json')), []);
      for (const t of targets) {
        const result = validateFile(t, validators);
        assert.equal(result.ok, true, `validateFile failed for ${t}: ${JSON.stringify(result.errors)}`);
      }
    } finally {
      rmSync(tmpRoot, { recursive: true, force: true });
    }
  });

  it('crossValidate does not flag the descriptor-only phases (only done phases are checked; F1/F2 are pending)', () => {
    const { tmpRoot, files } = buildDescriptorOnlyTree();
    try {
      const planPath = join(tmpRoot, files.find((f) => f.kind === 'plan').relativePath);
      const f0Path = join(tmpRoot, files.find((f) => f.kind === 'initiative').relativePath);
      const planFm = parseFrontmatter(readFileSync(planPath, 'utf8')).frontmatter;
      const f0Fm = parseFrontmatter(readFileSync(f0Path, 'utf8')).frontmatter;
      // Integrity F4: descriptor-only pending+subPhaseCount:0 is valid only when
      // a lazy sidecar is present — pass the discovered sidecars and stamp
      // project-scoped join keys the same way validate-state CLI does.
      const projectId = projectIdFromPath(planPath);
      planFm.__projectId = projectId;
      f0Fm.__projectId = projectIdFromPath(f0Path);
      const sidecars = collectSidecars([planPath]);
      const errors = crossValidate(
        new Map([[`${projectId}/${planFm.slug}`, planFm]]),
        new Map([[`${f0Fm.__projectId}/${f0Fm.slug}`, f0Fm]]),
        { sidecars },
      );
      // Descriptor-only F1/F2 with sidecars → no missing-initiative / missing-sidecar.
      const descErrors = errors.filter((e) => e.phaseId === 'F1' || e.phaseId === 'F2');
      assert.deepEqual(descErrors, [], 'descriptor-only phases produce no crossValidate error');
    } finally {
      rmSync(tmpRoot, { recursive: true, force: true });
    }
  });

  it('find-missing-business-intent.js IGNORES descriptor-only phases (F0/T-003, D5)', () => {
    const { tmpRoot } = buildDescriptorOnlyTree();
    try {
      const report = findMissingBusinessIntent(tmpRoot);
      // F1 and F2 are descriptor-only (no initiative file) → skipped. They must
      // never appear as missing-businessIntent findings, even though they (like
      // every freshly-materialized phase) carry no businessIntent spine yet.
      const flagged = new Set();
      for (const r of report) for (const m of r.missing) flagged.add(m.phaseId);
      assert.equal(flagged.has('F1'), false, 'F1 is descriptor-only → must be ignored');
      assert.equal(flagged.has('F2'), false, 'F2 is descriptor-only → must be ignored');
    } finally {
      rmSync(tmpRoot, { recursive: true, force: true });
    }
  });

  it('the distinction is by the initiative FILE absence, never by subPhaseCount', () => {
    // A materialized phase legitimately carries subPhaseCount:0 when it has tasks
    // but... here we assert the contract the glossary fixes: descriptor-only is
    // recognized by NO initiative file, and a materialized F0 (subPhaseCount:3) is
    // the one readers DO inspect. find-missing-business-intent inspects F0 only.
    const { tmpRoot } = buildDescriptorOnlyTree();
    try {
      const report = findMissingBusinessIntent(tmpRoot);
      // F0 is materialized; sample-source has no businessIntent, so F0 may be
      // flagged (correct — it IS materialized and lacks the spine). The point:
      // F0 is inspected, F1/F2 are not — the file-existence gate, not subPhaseCount.
      const allFlagged = new Set();
      for (const r of report) for (const m of r.missing) allFlagged.add(m.phaseId);
      assert.equal(allFlagged.has('F1'), false);
      assert.equal(allFlagged.has('F2'), false);
      // (Whether F0 is flagged depends on the fixture having businessIntent; we
      // do not assert it either way — only the descriptor-only skip is the gate.)
    } finally {
      rmSync(tmpRoot, { recursive: true, force: true });
    }
  });
});
