import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
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
  collectSidecars,
  crossValidate,
  parseFrontmatter,
  projectIdFromPath,
  validateFile,
} from '../../scripts/validate-state.js';
import { findMissingBusinessIntent } from '../../scripts/find-missing-business-intent.js';
import { materializePair } from '../../scripts/materialize-state.js';

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
const ACTIVATED_AT = '2026-07-01T10:00:00.000Z';
const BUSINESS_INTENT = {
  value: 'Reduces execution rework by expanding a phase only when the user confirms the business value and customer-facing outcome.',
  workflow: 'A phase starts descriptor-only, the operator fills the materialize gate, and the implementation loop consumes the resulting tasks.',
  rules: 'Exactly one downstream phase is activated; descriptor-only phases without initiative files remain valid and ignored by materialized-phase detectors.',
  outOfScope: 'Does not prove that the business gate prevents rubber-stamping; D9 remains a documented hypothesis.',
  doneWhen: 'F1 has a materialized initiative with parsed tasks, matching businessIntent on both state surfaces, and F2 still has no initiative file.',
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

/** Build the post-F0-close plan content with F1 still pending (descriptor prep). */
function planAfterF0Done(absPath) {
  const { frontmatter, body } = readFrontmatterFile(absPath);
  frontmatter.lastUpdated = ACTIVATED_AT;
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
  }
  writeFrontmatterFile(absPath, frontmatter, body);
  return frontmatter;
}

/**
 * In-memory plan descriptor update for F1 activation — must be published only
 * together with the initiative via materializePair (never written live first).
 */
function buildPlanContentActivatingF1(absPath, subPhaseCount) {
  const { frontmatter, body } = readFrontmatterFile(absPath);
  frontmatter.lastUpdated = ACTIVATED_AT;
  frontmatter.currentPhase = 'F1';
  for (const phase of frontmatter.phases) {
    delete phase.lastUpdated;
    if (phase.id === 'F1') {
      phase.status = 'active';
      phase.subPhaseCount = subPhaseCount;
      phase.businessIntent = { ...BUSINESS_INTENT };
    }
  }
  const renderedBody = body.startsWith('\n') ? body : `\n${body}`;
  return `---\n${stringifyYaml(frontmatter)}---${renderedBody}`;
}

describe('T-012 — e2e lifecycle: new plan -> lazy -> materialize -> advance', () => {
  it('materializes only F0, gates F1 on businessIntent, activates F1, and leaves F2 descriptor-only', () => {
    const tmpRoot = mkdtempSync(join(tmpdir(), 'as-e2e-lifecycle-'));
    try {
      const decomposition = decomposePlan(SOURCE, { planSlug: PLAN_SLUG });
      const files = materializeDecomposition(decomposition, {
        planSlug: PLAN_SLUG,
        projectId: PROJECT_ID,
        branch: BRANCH,
        now: new Date(STARTED_AT),
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
      assert.deepEqual(initialF0.businessIntent, BUSINESS_INTENT);
      assert.deepEqual(initialF0Fm.businessIntent, BUSINESS_INTENT);
      assert.equal(initialF1.status, 'pending');
      assert.equal(initialF1.subPhaseCount, 0);
      assert.equal(initialF2.status, 'pending');
      assert.equal(initialF2.subPhaseCount, 0);
      assert.equal('lastUpdated' in initialF1, false, 'phase descriptor starts without timestamp fields');

      closeF0Initiative(f0Path);
      // Close F0 on the plan without activating F1 yet — activating F1 live
      // before the initiative exists is the forbidden window this test forbids.
      planAfterF0Done(planPath);
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

      const f1File = writeInitiativeFile(f1FromSource, PLAN_SLUG, {
        iso: ACTIVATED_AT,
        branch: BRANCH,
        active: true,
        stateRoot: STATE_ROOT,
        planDir: PLAN_DIR,
        projectId: PROJECT_ID,
        seenSlugs: new Set(),
        seenPaths: new Set(files.filter((file) => file.relativePath.endsWith('.md')).map((file) => file.relativePath)),
      });
      const f1Path = join(tmpRoot, f1File.relativePath);

      // Prove detector blocks a materialized initiative missing businessIntent
      // without ever writing an active plan descriptor alone.
      mkdirSync(dirname(f1Path), { recursive: true });
      writeFileSync(f1Path, f1File.content, 'utf8');
      const beforeGate = findMissingBusinessIntent(tmpRoot);
      assert.ok(
        beforeGate.some((entry) => entry.missing.some((missing) => missing.phaseId === 'F1')),
        'materialized F1 without businessIntent is hard-blocked by the detector',
      );
      // Remove the incomplete initiative so the recoverable materialize path
      // owns the real F1 publish (initiative first, plan active last).
      rmSync(f1Path, { force: true });

      const initiativeWithIntent = (() => {
        const parsed = parseFrontmatter(f1File.content);
        assert.equal(parsed.error, undefined);
        parsed.frontmatter.businessIntent = { ...BUSINESS_INTENT };
        const renderedBody = parsed.body.startsWith('\n') ? parsed.body : `\n${parsed.body}`;
        return `---\n${stringifyYaml(parsed.frontmatter)}---${renderedBody}`;
      })();
      const planWithF1Active = buildPlanContentActivatingF1(planPath, f1FromSource.tasks.length);

      // Observational: plan must not already declare F1 active before publish.
      assert.equal(
        readFrontmatterFile(planPath).frontmatter.phases.find((p) => p.id === 'F1').status,
        'pending',
      );
      assert.equal(existsSync(f1Path), false);

      const published = materializePair({
        planPath,
        initiativePath: f1Path,
        planContent: planWithF1Active,
        initiativeContent: initiativeWithIntent,
        faultHooks: {
          afterInitiativeRename: () => {
            assert.equal(existsSync(f1Path), true);
            assert.equal(
              readFrontmatterFile(planPath).frontmatter.phases.find((p) => p.id === 'F1').status,
              'pending',
              'plan must not declare F1 active before plan rename',
            );
          },
        },
      });
      assert.equal(published.ok, true);

      const f1Fm = readFrontmatterFile(f1Path).frontmatter;
      let planFm = readFrontmatterFile(planPath).frontmatter;
      const f1Descriptor = planFm.phases.find((phase) => phase.id === 'F1');
      const f2Descriptor = planFm.phases.find((phase) => phase.id === 'F2');
      assert.equal(planFm.currentPhase, 'F1');
      assert.equal(f1Descriptor.status, 'active');
      assert.equal(f1Descriptor.subPhaseCount, f1Fm.tasks.length);
      assert.deepEqual(f1Descriptor.businessIntent, BUSINESS_INTENT);
      assert.deepEqual(f1Fm.businessIntent, BUSINESS_INTENT);
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
      // Integrity F4: join is projectId+plan+phase; descriptor-only F2 needs its
      // lazy sidecar in the sidecars set (same discovery path as validate-state CLI).
      planFm = readFrontmatterFile(planPath).frontmatter;
      const projectId = projectIdFromPath(planPath);
      planFm.__projectId = projectId;
      const planMap = new Map([[`${projectId}/${PLAN_SLUG}`, planFm]]);
      const scopedInits = new Map();
      for (const p of [f0Path, f1Path]) {
        const fm = readFrontmatterFile(p).frontmatter;
        fm.__projectId = projectIdFromPath(p);
        scopedInits.set(`${fm.__projectId}/${fm.slug}`, fm);
      }
      const sidecars = collectSidecars([planPath]);
      assert.deepEqual(
        crossValidate(planMap, scopedInits, { sidecars }),
        [],
        'phase-done advance state cross-validates',
      );
    } finally {
      rmSync(tmpRoot, { recursive: true, force: true });
    }
  });
});
