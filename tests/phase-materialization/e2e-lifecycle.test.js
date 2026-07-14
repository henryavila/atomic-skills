import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv/dist/2020.js';
import { stringify as stringifyYaml } from 'yaml';
import {
  decomposeOnePhase,
  decomposePlan,
  materializeDecomposition,
  writeInitiativeFile,
} from '../../src/decompose.js';
import {
  collectTargets,
  crossValidate,
  parseFrontmatter,
  validateFile,
} from '../../scripts/validate-state.js';
import { findMissingBusinessIntent } from '../../scripts/find-missing-business-intent.js';
import { findMissingSummaries } from '../../scripts/find-missing-summaries.js';
import { materializeState } from '../../scripts/materialize-state.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(__dirname, '..', '..');
const SCHEMA_DIR = join(ROOT, 'meta', 'schemas');
const SOURCE = readFileSync(
  join(__dirname, 'fixtures', 'e2e-lifecycle-source.md'),
  'utf8',
);

const PROJECT_ID = 'atomic-skills';
const PLAN_SLUG = 'e2e-lifecycle';
const STATE_ROOT = '.atomic-skills';
const PLAN_DIR = `${STATE_ROOT}/projects/${PROJECT_ID}/${PLAN_SLUG}`;
const BRANCH = 'plan/e2e-lifecycle';
const STARTED_AT = '2026-07-01T09:00:00.000Z';
const STARTED_COMMIT = '0123456789abcdef0123456789abcdef01234567';
const ACTIVATED_AT = '2026-07-01T10:00:00.000Z';
const BUSINESS_INTENT = {
  value: 'Reduces execution rework by expanding a phase only when the user confirms the business value and customer-facing outcome.',
  workflow: 'A phase starts descriptor-only, the operator fills the materialize gate, and the implementation loop consumes the resulting tasks.',
  rules: 'Exactly one downstream phase is activated; descriptor-only phases without initiative files remain valid and ignored by materialized-phase detectors.',
  outOfScope: 'Does not prove that the business gate prevents rubber-stamping; D9 remains a documented hypothesis.',
  doneWhen: 'F1 has a materialized initiative with parsed tasks, matching businessIntent on both state surfaces, and F2 still has no initiative file.',
};
const PHASE_SUMMARIES = {
  F0: 'Establishes the intake baseline for the lazy lifecycle.',
  F1: 'Activates the customer handoff only after its semantic gates pass.',
  F2: 'Keeps renewal work descriptor-only until it becomes eligible.',
};

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
  for (const file of files) {
    const absPath = join(tmpRoot, file.relativePath);
    mkdirSync(dirname(absPath), { recursive: true });
    writeFileSync(absPath, file.content, 'utf8');
  }
}

function readFrontmatterFile(absPath) {
  const parsed = parseFrontmatter(readFileSync(absPath, 'utf8'));
  assert.equal(parsed.error, undefined, `frontmatter parse failed for ${absPath}`);
  return parsed;
}

function writeFrontmatterFile(absPath, frontmatter, body) {
  const renderedBody = body.startsWith('\n') ? body : `\n${body}`;
  writeFileSync(absPath, `---\n${stringifyYaml(frontmatter)}---${renderedBody}`, 'utf8');
}

function phaseSource(markdown, phaseId) {
  const lines = markdown.split(/\r?\n/);
  const start = lines.findIndex((line) => line.startsWith(`## ${phaseId} `));
  assert.notEqual(start, -1, `missing ${phaseId} section`);
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i += 1) {
    if (/^##\s+F\d+\b/.test(lines[i])) {
      end = i;
      break;
    }
  }
  const match = lines[start].match(/^##\s+(F\d+)\s+[—-]\s+(.+)$/);
  assert.ok(match, `phase heading did not match: ${lines[start]}`);
  return {
    phaseId: match[1],
    title: match[2],
    bodyLines: lines.slice(start + 1, end),
  };
}

function shellEvidence(verifiedAt, outputSummary) {
  return {
    verifierKind: 'shell',
    verifiedAt,
    passed: true,
    exitCode: 0,
    outputSummary,
  };
}

function hashBytes(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function closeF0Initiative(absPath) {
  const { frontmatter, body } = readFrontmatterFile(absPath);
  frontmatter.businessIntent = { ...BUSINESS_INTENT };
  frontmatter.status = 'done';
  frontmatter.lastUpdated = ACTIVATED_AT;
  frontmatter.nextAction = null;
  for (const task of frontmatter.tasks) {
    task.status = 'done';
    task.closedAt = ACTIVATED_AT;
    task.evidence = shellEvidence(ACTIVATED_AT, `${task.id} fixture verifier passed`);
  }
  for (const gate of frontmatter.exitGates) {
    gate.status = 'met';
    gate.metAt = ACTIVATED_AT;
    gate.evidence = shellEvidence(ACTIVATED_AT, `${gate.id} fixture verifier passed`);
  }
  frontmatter.tasksDone = frontmatter.tasks.length;
  frontmatter.gatesMet = frontmatter.exitGates.length;
  writeFrontmatterFile(absPath, frontmatter, body);
  return frontmatter;
}

function buildPlanAdvanceToF1(absPath) {
  const { frontmatter, body } = readFrontmatterFile(absPath);
  frontmatter.lastUpdated = ACTIVATED_AT;
  frontmatter.currentPhase = 'F1';
  for (const phase of frontmatter.phases) {
    delete phase.lastUpdated;
    if (phase.id === 'F0') {
      phase.status = 'done';
      phase.businessIntent = { ...BUSINESS_INTENT };
      for (const criterion of phase.exitGate.criteria) {
        criterion.status = 'met';
        criterion.metAt = ACTIVATED_AT;
        criterion.evidence = shellEvidence(ACTIVATED_AT, `${criterion.id} fixture verifier passed`);
      }
    }
    if (phase.id === 'F1') {
      phase.status = 'active';
      phase.subPhaseCount = 2;
      phase.businessIntent = { ...BUSINESS_INTENT };
    }
  }
  const renderedBody = body.startsWith('\n') ? body : `\n${body}`;
  return {
    frontmatter,
    content: `---\n${stringifyYaml(frontmatter)}---${renderedBody}`,
  };
}

function parseInitiativeFrontmatters(paths) {
  return new Map(paths.map((absPath) => {
    const { frontmatter } = readFrontmatterFile(absPath);
    return [frontmatter.slug, frontmatter];
  }));
}

describe('T-012 — e2e lifecycle: new plan -> lazy -> materialize -> advance', () => {
  it('materializes only F0, gates F1 on businessIntent, activates F1, and leaves F2 descriptor-only', () => {
    const tmpRoot = mkdtempSync(join(tmpdir(), 'as-e2e-lifecycle-'));
    try {
      const decomposition = decomposePlan(SOURCE, { planSlug: PLAN_SLUG });
      for (const initiative of decomposition.initiatives) {
        initiative.summary = PHASE_SUMMARIES[initiative.phaseId];
      }
      const files = materializeDecomposition(decomposition, {
        planSlug: PLAN_SLUG,
        projectId: PROJECT_ID,
        branch: BRANCH,
        now: new Date(STARTED_AT),
        startedCommit: STARTED_COMMIT,
        stateRoot: STATE_ROOT,
        businessIntent: BUSINESS_INTENT,
      });
      writeTree(tmpRoot, files);

      const planFile = files.find((file) => file.kind === 'plan');
      const initialInitiatives = files.filter((file) => file.kind === 'initiative');
      const sourceSidecars = files.filter((file) => file.kind === 'source');
      assert.equal(initialInitiatives.length, 1, 'new plan materializes only F0');
      assert.equal(sourceSidecars.length, 2, 'F1/F2 are retained as source sidecars');
      assert.ok(sourceSidecars.some((file) => file.relativePath.includes('/f1-customer-handoff.source.json')));
      assert.ok(sourceSidecars.some((file) => file.relativePath.includes('/f2-renewal-loop.source.json')));

      const planPath = join(tmpRoot, planFile.relativePath);
      const f0Path = join(tmpRoot, initialInitiatives[0].relativePath);
      const initialPlan = readFrontmatterFile(planPath).frontmatter;
      const initialF0 = initialPlan.phases.find((phase) => phase.id === 'F0');
      const initialF1 = initialPlan.phases.find((phase) => phase.id === 'F1');
      const initialF2 = initialPlan.phases.find((phase) => phase.id === 'F2');
      const initialF0Fm = readFrontmatterFile(f0Path).frontmatter;
      assert.equal(initialPlan.currentPhase, 'F0');
      assert.equal(initialF0Fm.startedCommit, STARTED_COMMIT);
      assert.deepEqual(initialF0.businessIntent, BUSINESS_INTENT);
      assert.deepEqual(initialF0Fm.businessIntent, BUSINESS_INTENT);
      assert.equal(initialF1.status, 'pending');
      assert.equal(initialF1.subPhaseCount, 0);
      assert.equal(initialF2.status, 'pending');
      assert.equal(initialF2.subPhaseCount, 0);
      assert.equal('lastUpdated' in initialF1, false, 'phase descriptor starts without timestamp fields');

      closeF0Initiative(f0Path);
      const advancedPlan = buildPlanAdvanceToF1(planPath);
      const f1FromSource = decomposeOnePhase(phaseSource(SOURCE, 'F1'), {
        planSlug: PLAN_SLUG,
        warnings: [],
      });
      const f1Sidecar = JSON.parse(readFileSync(
        join(tmpRoot, sourceSidecars.find((file) => file.relativePath.includes('/f1-customer-handoff.source.json')).relativePath),
        'utf8',
      ));
      assert.deepEqual(
        {
          phaseId: f1FromSource.phaseId,
          slug: f1FromSource.slug,
          title: f1FromSource.title,
          goal: f1FromSource.goal,
          tasks: f1FromSource.tasks,
          exitGates: f1FromSource.exitGates,
        },
        {
          phaseId: f1Sidecar.phaseId,
          slug: f1Sidecar.slug,
          title: f1Sidecar.title,
          goal: f1Sidecar.goal,
          tasks: f1Sidecar.tasks,
          exitGates: f1Sidecar.exitGates,
        },
        'retained sidecar matches one-phase decomposition',
      );

      const ratifiedF1 = structuredClone(f1FromSource);
      ratifiedF1.summary = advancedPlan.frontmatter.phases.find((phase) => phase.id === 'F1').summary;
      for (const task of ratifiedF1.tasks) {
        if (typeof task.summary !== 'string' || task.summary.trim() === '') {
          task.summary = `Complete ${task.title}`;
        }
        if (!Number.isFinite(task.weight)) task.weight = 1;
      }
      ratifiedF1.nextAction = 'Run `done T-002` after creating the handoff checklist fixture.';
      const f1File = writeInitiativeFile(ratifiedF1, PLAN_SLUG, {
        iso: ACTIVATED_AT,
        branch: BRANCH,
        active: true,
        stateRoot: STATE_ROOT,
        planDir: PLAN_DIR,
        projectId: PROJECT_ID,
        businessIntent: BUSINESS_INTENT,
        seenSlugs: new Set(),
        seenPaths: new Set(files.filter((file) => file.relativePath.endsWith('.md')).map((file) => file.relativePath)),
      });
      const f1Path = join(tmpRoot, f1File.relativePath);
      const expectedPlanHash = hashBytes(readFileSync(planPath));
      assert.throws(
        () => materializeState({
          root: tmpRoot,
          planPath: planFile.relativePath,
          initiativePath: f1File.relativePath,
          planContent: advancedPlan.content,
          initiativeContent: f1File.content,
          expectedPlanHash,
          txId: 'e2e-f0-to-f1',
          faultAt: 'after-initiative-rename',
        }),
        /fault injection: after-initiative-rename/,
      );
      assert.equal(
        readFrontmatterFile(planPath).frontmatter.currentPhase,
        'F0',
        'fault after initiative publish cannot expose F1 active in the plan first',
      );
      materializeState({
        root: tmpRoot,
        planPath: planFile.relativePath,
        initiativePath: f1File.relativePath,
      });

      const f1Fm = readFrontmatterFile(f1Path).frontmatter;
      const planFm = readFrontmatterFile(planPath).frontmatter;
      const f1Descriptor = planFm.phases.find((phase) => phase.id === 'F1');
      const f2Descriptor = planFm.phases.find((phase) => phase.id === 'F2');
      assert.equal(planFm.currentPhase, 'F1');
      assert.equal(f1Descriptor.status, 'active');
      assert.equal(f1Descriptor.subPhaseCount, f1Fm.tasks.length);
      assert.deepEqual(f1Descriptor.businessIntent, BUSINESS_INTENT);
      assert.deepEqual(f1Fm.businessIntent, BUSINESS_INTENT);
      assert.equal(f1Descriptor.summary, PHASE_SUMMARIES.F1);
      assert.equal(f1Fm.summary, PHASE_SUMMARIES.F1);
      assert.equal('lastUpdated' in f1Descriptor, false, 'F1 descriptor must not receive schema-invalid timestamps');
      assert.equal(f2Descriptor.status, 'pending');
      assert.equal(f2Descriptor.subPhaseCount, 0);
      assert.equal(
        existsSync(join(tmpRoot, PLAN_DIR, 'phases', 'f2-renewal-loop.md')),
        false,
        'F2 remains descriptor-only during F1 activation',
      );

      const detectorAfterGate = findMissingBusinessIntent(tmpRoot);
      assert.deepEqual(detectorAfterGate, [], 'detector exits clean after every materialized phase has businessIntent');
      assert.deepEqual(
        findMissingSummaries(tmpRoot),
        [],
        'phase summary detector exits clean after lazy materialization',
      );

      const validators = buildValidators();
      const targets = collectTargets([tmpRoot]);
      assert.equal(
        targets.some((target) => target.endsWith('.source.json')),
        false,
        'validate-state ignores retained source sidecars',
      );
      for (const target of targets) {
        const result = validateFile(target, validators);
        assert.equal(result.ok, true, `validateFile failed for ${target}: ${JSON.stringify(result.errors)}`);
      }
      const planMap = new Map([[PLAN_SLUG, readFrontmatterFile(planPath).frontmatter]]);
      const initMap = parseInitiativeFrontmatters([f0Path, f1Path]);
      assert.deepEqual(crossValidate(planMap, initMap), [], 'phase-done advance state cross-validates');
    } finally {
      rmSync(tmpRoot, { recursive: true, force: true });
    }
  });
});
