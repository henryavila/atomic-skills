import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';
import Ajv from 'ajv/dist/2020.js';
import { decomposePlan, previewDecomposition, materializeDecomposition } from '../src/decompose.js';
import { validateFile } from '../scripts/validate-state.js';

const SCHEMA_DIR = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'meta', 'schemas');

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

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const FIXTURE = readFileSync(
  join(__dirname, 'fixtures/project-plan/sample-source.md'),
  'utf8'
);

describe('decomposePlan (C.T-002)', () => {
  it('extracts plan title from the first H1', () => {
    const r = decomposePlan(FIXTURE, { planSlug: 'sample' });
    assert.equal(r.plan.title, 'Sample Plan — Foundation + UI v1');
  });

  it('extracts narrative (text between H1 and first H2)', () => {
    const r = decomposePlan(FIXTURE, { planSlug: 'sample' });
    assert.match(r.plan.narrative, /validate the project-plan decompose heuristics/);
    assert.match(r.plan.narrative, /deterministically into Plan/);
    // Narrative must NOT include the Principles section header
    assert.ok(!r.plan.narrative.includes('Inviolable principles'));
  });

  it('extracts principles with auto-assigned ids', () => {
    const r = decomposePlan(FIXTURE, { planSlug: 'sample' });
    assert.equal(r.plan.principles.length, 3);
    assert.equal(r.plan.principles[0].id, 'P1');
    assert.equal(r.plan.principles[0].title, 'Truth source');
    assert.match(r.plan.principles[0].body, /authoritative source/);
    assert.equal(r.plan.principles[2].id, 'P3');
  });

  it('extracts glossary with term/definition split', () => {
    const r = decomposePlan(FIXTURE, { planSlug: 'sample' });
    assert.equal(r.plan.glossary.length, 3);
    assert.equal(r.plan.glossary[0].term, 'Tenant song');
    assert.match(r.plan.glossary[0].definition, /tenant_id NOT NULL/);
    assert.equal(r.plan.glossary[2].term, 'Exit gate');
  });

  it('extracts phases from H2 matching /^F\\d+/ pattern', () => {
    const r = decomposePlan(FIXTURE, { planSlug: 'sample' });
    assert.equal(r.initiatives.length, 3);
    assert.equal(r.initiatives[0].phaseId, 'F0');
    assert.equal(r.initiatives[0].title, 'Foundation Repair');
    assert.equal(r.initiatives[1].phaseId, 'F1');
    assert.equal(r.initiatives[2].phaseId, 'F2');
    assert.deepEqual(r.plan.phaseIds, ['F0', 'F1', 'F2']);
  });

  it('extracts goal from `Goal:` prefix line per phase', () => {
    const r = decomposePlan(FIXTURE, { planSlug: 'sample' });
    assert.match(r.initiatives[0].goal, /clean the data before any UI work/);
    assert.match(r.initiatives[1].goal, /rebuild admin UI/);
    assert.match(r.initiatives[2].goal, /extra features/);
  });

  it('extracts tasks from H3 within each phase, preserving explicit ids', () => {
    const r = decomposePlan(FIXTURE, { planSlug: 'sample' });
    assert.equal(r.initiatives[0].tasks.length, 3);
    assert.equal(r.initiatives[0].tasks[0].id, 'T0.1');
    assert.equal(r.initiatives[0].tasks[0].title, 'Migrate dump');
    assert.equal(r.initiatives[0].tasks[2].id, 'T0.3');
    assert.equal(r.initiatives[1].tasks.length, 2);
    assert.equal(r.initiatives[1].tasks[1].id, 'T1.2');
    assert.equal(r.initiatives[2].tasks.length, 2);
  });

  it('extracts exit-gate criteria from fenced yaml blocks', () => {
    const r = decomposePlan(FIXTURE, { planSlug: 'sample' });
    assert.equal(r.initiatives[0].exitGates.length, 2);
    assert.equal(r.initiatives[0].exitGates[0].id, 'F0-G1');
    assert.match(r.initiatives[0].exitGates[0].description, /core-v2 created/);
    assert.equal(r.initiatives[0].exitGates[0].verifier.kind, 'shell');
    assert.equal(r.initiatives[0].exitGates[0].status, 'pending');
    assert.equal(r.initiatives[0].exitGates[1].verifier.kind, 'query');
    assert.equal(r.initiatives[1].exitGates.length, 1);
    assert.equal(r.initiatives[1].exitGates[0].verifier.kind, 'manual');
    // F2 has no exit_gate block
    assert.equal(r.initiatives[2].exitGates.length, 0);
  });

  it('derives initiative slugs from planSlug + phaseId + phase title', () => {
    const r = decomposePlan(FIXTURE, { planSlug: 'sample' });
    assert.equal(r.initiatives[0].slug, 'sample-f0-foundation-repair');
    assert.equal(r.initiatives[1].slug, 'sample-f1-ui-redesign');
    assert.equal(r.initiatives[2].slug, 'sample-f2-growth');
    // Slug matches the canonical schema regex
    const slugRe = /^[a-z][a-z0-9-]{1,63}$/;
    for (const init of r.initiatives) assert.match(init.slug, slugRe);
  });

  it('surfaces unrecognized H2 sections as warnings (not errors)', () => {
    const r = decomposePlan(FIXTURE, { planSlug: 'sample' });
    assert.ok(r.warnings.some((w) => /Open questions/.test(w)));
    // But the decompose still succeeds
    assert.equal(r.initiatives.length, 3);
  });

  it('leaves initiative slugs empty when planSlug is not provided', () => {
    const r = decomposePlan(FIXTURE);
    for (const init of r.initiatives) assert.equal(init.slug, '');
  });

  it('throws when source has no phase H2 at all', () => {
    const minimal = '# Title\n\nBody.\n\n## Notes\n\nNo phases here.\n';
    assert.throws(() => decomposePlan(minimal, { planSlug: 'x' }), /no phase H2/);
  });

  it('warns but does not throw when source is missing H1', () => {
    const noH1 = '## F0 — Setup\n\nGoal: bootstrap.\n\n### T1 First task\n';
    const r = decomposePlan(noH1, { planSlug: 'x' });
    assert.equal(r.plan.title, '');
    assert.ok(r.warnings.some((w) => /No H1/.test(w)));
    assert.equal(r.initiatives.length, 1);
  });

  it('tolerates missing principles + glossary (both become empty arrays)', () => {
    const minimal = '# Title\n\n## F0 — Setup\n\nGoal: x.\n\n### Task one\n';
    const r = decomposePlan(minimal, { planSlug: 'x' });
    assert.deepEqual(r.plan.principles, []);
    assert.deepEqual(r.plan.glossary, []);
  });

  it('rejects non-string input', () => {
    assert.throws(() => decomposePlan(null), /must be a string/);
    assert.throws(() => decomposePlan({}), /must be a string/);
  });

  it('auto-assigns task ids when H3 has no leading T<N> token', () => {
    const md = [
      '# T',
      '',
      '## F0 — S',
      '',
      'Goal: x.',
      '',
      '### Migrate dump',
      '### Deduplicate songs',
      '### Verify',
      '',
    ].join('\n');
    const r = decomposePlan(md, { planSlug: 'x' });
    assert.equal(r.initiatives[0].tasks[0].id, 'T-001');
    assert.equal(r.initiatives[0].tasks[1].id, 'T-002');
    assert.equal(r.initiatives[0].tasks[2].id, 'T-003');
  });
});

describe('previewDecomposition (C.T-002)', () => {
  it('renders counts and first 3 phase titles', () => {
    const r = decomposePlan(FIXTURE, { planSlug: 'sample' });
    const preview = previewDecomposition(r);
    assert.match(preview, /Plan title: Sample Plan/);
    assert.match(preview, /Phases:\s+3/);
    assert.match(preview, /Tasks:\s+7/); // 3 + 2 + 2
    assert.match(preview, /Exit gates:\s+3/); // 2 + 1 + 0
    assert.match(preview, /F0 — Foundation Repair/);
    assert.match(preview, /F1 — UI Redesign/);
    assert.match(preview, /F2 — Growth/);
  });

  it('surfaces warnings in the preview', () => {
    const r = decomposePlan(FIXTURE, { planSlug: 'sample' });
    const preview = previewDecomposition(r);
    assert.match(preview, /Warnings:/);
    assert.match(preview, /Open questions/);
  });
});

describe('materializeDecomposition (C.T-004 — adopt path)', () => {
  const FROZEN_DATE = new Date('2026-05-19T12:00:00.000Z');

  it('emits one plan file + one initiative file per phase', () => {
    const r = decomposePlan(FIXTURE, { planSlug: 'sample' });
    const files = materializeDecomposition(r, { planSlug: 'sample', now: FROZEN_DATE });
    assert.equal(files.length, 1 + r.initiatives.length);
    assert.equal(files[0].kind, 'plan');
    assert.equal(files[0].slug, 'sample');
    assert.equal(files[0].relativePath, '.atomic-skills/plans/sample.md');
    for (let i = 0; i < r.initiatives.length; i++) {
      const f = files[i + 1];
      assert.equal(f.kind, 'initiative');
      assert.match(f.relativePath, /^\.atomic-skills\/initiatives\/sample-f\d+/);
    }
  });

  it('Plan frontmatter validates against plan.schema.json', () => {
    const r = decomposePlan(FIXTURE, { planSlug: 'sample' });
    const files = materializeDecomposition(r, { planSlug: 'sample', now: FROZEN_DATE });
    const planFile = files.find((f) => f.kind === 'plan');
    const fm = parseYaml(planFile.content.split('---\n')[1]);
    const validators = buildValidators();
    const ok = validators.validatePlan(fm);
    assert.equal(ok, true, `expected valid plan; errors: ${JSON.stringify(validators.validatePlan.errors)}`);
  });

  it('every initiative frontmatter validates against initiative.schema.json', () => {
    const r = decomposePlan(FIXTURE, { planSlug: 'sample' });
    const files = materializeDecomposition(r, { planSlug: 'sample', now: FROZEN_DATE });
    const validators = buildValidators();
    for (const f of files.filter((f) => f.kind === 'initiative')) {
      const fm = parseYaml(f.content.split('---\n')[1]);
      const ok = validators.validateInitiative(fm);
      assert.equal(ok, true, `expected valid initiative ${f.slug}; errors: ${JSON.stringify(validators.validateInitiative.errors)}`);
    }
  });

  it('materialized files validate end-to-end via scripts/validate-state.js (write to tmp + validateFile)', () => {
    const r = decomposePlan(FIXTURE, { planSlug: 'sample' });
    const files = materializeDecomposition(r, { planSlug: 'sample', branch: 'main', now: FROZEN_DATE });
    const tmpRoot = mkdtempSync(join(tmpdir(), 'as-mat-'));
    try {
      const validators = buildValidators();
      for (const f of files) {
        const absPath = join(tmpRoot, f.relativePath);
        mkdirSync(dirname(absPath), { recursive: true });
        writeFileSync(absPath, f.content, 'utf8');
        const result = validateFile(absPath, validators);
        assert.equal(result.ok, true, `validateFile failed for ${f.relativePath}: ${JSON.stringify(result.errors)}`);
        assert.equal(result.kind, f.kind);
      }
    } finally {
      rmSync(tmpRoot, { recursive: true, force: true });
    }
  });

  it('first phase + first initiative are active; rest are pending', () => {
    const r = decomposePlan(FIXTURE, { planSlug: 'sample' });
    const files = materializeDecomposition(r, { planSlug: 'sample', now: FROZEN_DATE });
    const planFm = parseYaml(files[0].content.split('---\n')[1]);
    assert.equal(planFm.phases[0].status, 'active');
    assert.equal(planFm.phases[1].status, 'pending');
    assert.equal(planFm.phases[2].status, 'pending');
    assert.equal(planFm.currentPhase, 'F0');
    // Initiatives mirror the phase status
    const inits = files.filter((f) => f.kind === 'initiative');
    const fm0 = parseYaml(inits[0].content.split('---\n')[1]);
    const fm1 = parseYaml(inits[1].content.split('---\n')[1]);
    assert.equal(fm0.status, 'active');
    assert.equal(fm1.status, 'pending');
  });

  it('each initiative carries parentPlan + phaseId + exit gates + tasks', () => {
    const r = decomposePlan(FIXTURE, { planSlug: 'sample' });
    const files = materializeDecomposition(r, { planSlug: 'sample', now: FROZEN_DATE });
    const inits = files.filter((f) => f.kind === 'initiative');
    const fm0 = parseYaml(inits[0].content.split('---\n')[1]);
    assert.equal(fm0.parentPlan, 'sample');
    assert.equal(fm0.phaseId, 'F0');
    assert.equal(fm0.tasks.length, 3);
    assert.equal(fm0.tasks[0].id, 'T0.1');
    assert.equal(fm0.tasks[0].status, 'pending');
    assert.equal(fm0.exitGates.length, 2);
    assert.equal(fm0.exitGates[0].id, 'F0-G1');
    assert.equal(fm0.exitGates[0].status, 'pending');
    assert.equal(fm0.stack.length, 1);
    assert.equal(fm0.stack[0].type, 'task');
    assert.equal(fm0.stack[0].openedAt, FROZEN_DATE.toISOString());
  });

  it('phase dependsOn is sequential by default (each phase depends on the previous)', () => {
    const r = decomposePlan(FIXTURE, { planSlug: 'sample' });
    const files = materializeDecomposition(r, { planSlug: 'sample', now: FROZEN_DATE });
    const planFm = parseYaml(files[0].content.split('---\n')[1]);
    assert.deepEqual(planFm.phases[0].dependsOn, []);
    assert.deepEqual(planFm.phases[1].dependsOn, ['F0']);
    assert.deepEqual(planFm.phases[2].dependsOn, ['F1']);
  });

  it('falls back to TODO sentinels for required-but-empty fields (schema still passes)', () => {
    const stub = '# T\n\n## F0 — S\n\n### A first task\n';
    const r = decomposePlan(stub, { planSlug: 'tiny' });
    const files = materializeDecomposition(r, { planSlug: 'tiny', now: FROZEN_DATE });
    const planFm = parseYaml(files[0].content.split('---\n')[1]);
    const validators = buildValidators();
    assert.equal(validators.validatePlan(planFm), true);
    assert.match(planFm.phases[0].goal, /TODO/);
    assert.match(planFm.phases[0].exitGate.summary, /TODO|criteria/);
    const initFm = parseYaml(files[1].content.split('---\n')[1]);
    assert.equal(validators.validateInitiative(initFm), true);
    assert.match(initFm.goal, /TODO/);
  });

  it('rejects missing opts.planSlug', () => {
    const r = decomposePlan(FIXTURE);
    assert.throws(() => materializeDecomposition(r, {}), /planSlug is required/);
  });

  it('passes through verifier kinds (shell, query, manual) unchanged', () => {
    const r = decomposePlan(FIXTURE, { planSlug: 'sample' });
    const files = materializeDecomposition(r, { planSlug: 'sample', now: FROZEN_DATE });
    const planFm = parseYaml(files[0].content.split('---\n')[1]);
    assert.equal(planFm.phases[0].exitGate.criteria[0].verifier.kind, 'shell');
    assert.equal(planFm.phases[0].exitGate.criteria[1].verifier.kind, 'query');
    assert.equal(planFm.phases[1].exitGate.criteria[0].verifier.kind, 'manual');
  });

  it('plan body has navigable §1/§2/§3 sections per Iron Law', () => {
    const r = decomposePlan(FIXTURE, { planSlug: 'sample' });
    const files = materializeDecomposition(r, { planSlug: 'sample', now: FROZEN_DATE });
    const planFile = files[0];
    const body = planFile.content.split(/^---\s*$/m)[2] || '';
    assert.match(body, /## 1\. Context/);
    assert.match(body, /## 2\. Inviolable principles/);
    assert.match(body, /## 3\. Phase tree/);
  });

  it('warnings from decompose are surfaced in the plan body', () => {
    const r = decomposePlan(FIXTURE, { planSlug: 'sample' });
    const files = materializeDecomposition(r, { planSlug: 'sample', now: FROZEN_DATE });
    const body = files[0].content;
    assert.match(body, /## Decompose warnings/);
    assert.match(body, /Open questions/);
  });
});

describe('Phase C codex review regression — F-001 (slug collision on long planSlug)', () => {
  const FROZEN_DATE = new Date('2026-05-19T12:00:00.000Z');

  it('derives distinct initiative slugs even when planSlug consumes near-full 63-char budget', () => {
    const md = [
      '# X',
      '',
      '## F0 — Foundation Repair',
      '### A',
      '',
      '## F1 — UI Redesign',
      '### B',
      '',
      '## F2 — Growth',
      '### C',
      '',
    ].join('\n');
    const longSlug = 'a'.repeat(60); // 60 chars — near the 64-char schema limit
    const r = decomposePlan(md, { planSlug: longSlug });
    const slugs = r.initiatives.map((i) => i.slug);
    // All three must be distinct AND each must include the phase id
    assert.equal(new Set(slugs).size, 3, `expected 3 distinct slugs, got ${JSON.stringify(slugs)}`);
    assert.ok(slugs[0].includes('-f0'), `phase suffix missing in ${slugs[0]}`);
    assert.ok(slugs[1].includes('-f1'), `phase suffix missing in ${slugs[1]}`);
    assert.ok(slugs[2].includes('-f2'), `phase suffix missing in ${slugs[2]}`);
    // Schema slug regex must still pass
    const slugRe = /^[a-z][a-z0-9-]{1,63}$/;
    for (const s of slugs) assert.match(s, slugRe);
  });

  it('materializeDecomposition throws on derived-path collision rather than overwriting', () => {
    // Construct a decompose result with two phases whose derived slugs collide.
    const r = {
      plan: { title: 'X', narrative: '', principles: [], glossary: [], phaseIds: ['F0', 'F1'] },
      initiatives: [
        { phaseId: 'F0', slug: 'plan-shared-slug', title: 'A', goal: 'g', tasks: [{ id: 'T-001', title: 't' }], exitGates: [] },
        { phaseId: 'F1', slug: 'plan-shared-slug', title: 'B', goal: 'g', tasks: [{ id: 'T-001', title: 't' }], exitGates: [] },
      ],
      warnings: [],
    };
    assert.throws(
      () => materializeDecomposition(r, { planSlug: 'plan', now: FROZEN_DATE }),
      /slug collision/
    );
  });
});

describe('Phase C codex review regression — F-002 (duplicate phaseId detection)', () => {
  it('throws when source markdown declares the same phase id twice', () => {
    const md = [
      '# X',
      '',
      '## F0 — First',
      '### task one',
      '',
      '## F0 — Second',
      '### task two',
      '',
    ].join('\n');
    assert.throws(
      () => decomposePlan(md, { planSlug: 'dup' }),
      /duplicate phase id "F0"/
    );
  });

  it('does not throw when phase ids are unique (regression guard for false positives)', () => {
    const md = [
      '# X',
      '',
      '## F0 — First',
      '### task one',
      '',
      '## F1 — Second',
      '### task two',
      '',
    ].join('\n');
    const r = decomposePlan(md, { planSlug: 'ok' });
    assert.equal(r.initiatives.length, 2);
  });
});

describe('Phase C codex review regression — F-003 (malformed exit_gate YAML surfaces warning)', () => {
  it('emits a warning naming the phase when an exit_gate fenced YAML fails to parse', () => {
    const md = [
      '# X',
      '',
      '## F0 — Setup',
      '',
      '```yaml',
      'exit_gate:',
      '  - id: F0-G1',
      '    description: "unclosed string here',
      '```',
      '',
      '### A task',
      '',
    ].join('\n');
    const r = decomposePlan(md, { planSlug: 'x' });
    // Decompose succeeds but warns about the broken block
    assert.equal(r.initiatives.length, 1);
    assert.equal(r.initiatives[0].exitGates.length, 0);
    const warn = r.warnings.find((w) => /Malformed `exit_gate:` YAML block/.test(w));
    assert.ok(warn, `expected malformed exit_gate warning; got: ${JSON.stringify(r.warnings)}`);
    assert.match(warn, /in phase F0/);
  });

  it('does not warn when exit_gate YAML is well-formed (regression guard)', () => {
    const r = decomposePlan(readFileSync(join(__dirname, 'fixtures/project-plan/sample-source.md'), 'utf8'), { planSlug: 'sample' });
    assert.ok(!r.warnings.some((w) => /Malformed/.test(w)));
  });
});

describe('C.T-005 — sda-v2 shape (i18n, numbered prefix, H3 principles, table glossary, bullet tasks, bold goal, prose exit-gate)', () => {
  const SDA = readFileSync(join(__dirname, 'fixtures/project-plan/sda-v2-shape.md'), 'utf8');

  it('detects PT principles section despite numbered prefix `## 2. Princípios invioláveis`', () => {
    const r = decomposePlan(SDA, { planSlug: 'sda' });
    assert.equal(r.plan.principles.length, 3);
  });

  it('extracts principles from H3 children, deriving ids from numbered prefix (2.1 → P1, 2.2 → P2, …)', () => {
    const r = decomposePlan(SDA, { planSlug: 'sda' });
    assert.equal(r.plan.principles[0].id, 'P1');
    assert.equal(r.plan.principles[0].title, 'Fonte da verdade são os 2 dumps');
    assert.match(r.plan.principles[0].body, /única fonte autoritativa/);
    assert.equal(r.plan.principles[1].id, 'P2');
    assert.match(r.plan.principles[1].title, /Determinismo total/);
    assert.equal(r.plan.principles[2].id, 'P3');
  });

  it('detects PT glossary section despite numbered prefix `## 5. Glossário`', () => {
    const r = decomposePlan(SDA, { planSlug: 'sda' });
    assert.equal(r.plan.glossary.length, 3);
  });

  it('extracts glossary from markdown table (header row skipped, cells stripped of bold)', () => {
    const r = decomposePlan(SDA, { planSlug: 'sda' });
    assert.equal(r.plan.glossary[0].term, 'Tenant song');
    assert.match(r.plan.glossary[0].definition, /tenant_id NOT NULL/);
    assert.equal(r.plan.glossary[1].term, 'Collection song');
    assert.equal(r.plan.glossary[2].term, 'Exit gate');
  });

  it('extracts goal from bold-prefix lines (`**Goal:** prose`)', () => {
    const r = decomposePlan(SDA, { planSlug: 'sda' });
    assert.match(r.initiatives[0].goal, /Resolver os dados/);
    assert.match(r.initiatives[1].goal, /Redesenhar 100% do Filament/);
    assert.match(r.initiatives[2].goal, /Validar end-to-end/);
  });

  it('extracts tasks from bullets under `### Sub-fases (menu)` H3 marker', () => {
    const r = decomposePlan(SDA, { planSlug: 'sda' });
    assert.equal(r.initiatives[0].tasks.length, 3); // F0
    assert.equal(r.initiatives[1].tasks.length, 2); // F1
    assert.equal(r.initiatives[2].tasks.length, 1); // F8
  });

  it('strips phase prefix from task ids (`F0.T-001` → `T-001`)', () => {
    const r = decomposePlan(SDA, { planSlug: 'sda' });
    assert.equal(r.initiatives[0].tasks[0].id, 'T-001');
    assert.equal(r.initiatives[0].tasks[0].title, 'Restore local infra');
    assert.equal(r.initiatives[0].tasks[1].id, 'T-002');
    assert.equal(r.initiatives[1].tasks[0].id, 'T-001'); // F1 task numbering restarts per phase
  });

  it('captures task description (text after the `**id — title.**` bold prefix)', () => {
    const r = decomposePlan(SDA, { planSlug: 'sda' });
    assert.match(r.initiatives[0].tasks[0].description, /Composer install/);
    assert.match(r.initiatives[1].tasks[0].description, /Adaptar v4/);
  });

  it('extracts prose exit-gate (`**Exit gate da fase:** prose`) when no fenced YAML present', () => {
    const r = decomposePlan(SDA, { planSlug: 'sda' });
    assert.equal(r.initiatives[0].exitGates.length, 1);
    assert.equal(r.initiatives[0].exitGates[0].id, 'G-1');
    assert.equal(r.initiatives[0].exitGates[0].verifier.kind, 'manual');
    assert.match(r.initiatives[0].exitGates[0].description, /core-v2/);
  });

  it('surfaces unrecognized structural sections as warnings (not errors)', () => {
    const r = decomposePlan(SDA, { planSlug: 'sda' });
    const skipped = r.warnings.filter((w) => /Skipped H2 section/.test(w));
    assert.ok(skipped.some((w) => /Sumário/.test(w)));
    assert.ok(skipped.some((w) => /Contexto/.test(w)));
    assert.ok(skipped.some((w) => /Fontes e referências/.test(w)));
  });

  it('materialize end-to-end produces schema-valid Plan + 3 Initiatives', () => {
    const r = decomposePlan(SDA, { planSlug: 'sda' });
    const files = materializeDecomposition(r, { planSlug: 'sda', branch: 'main', now: new Date('2026-05-20T12:00:00Z') });
    assert.equal(files.length, 4); // 1 plan + 3 initiatives
    const validators = buildValidators();
    const planFm = parseYaml(files[0].content.split('---\n')[1]);
    assert.equal(validators.validatePlan(planFm), true, `plan invalid: ${JSON.stringify(validators.validatePlan.errors)}`);
    for (const f of files.filter((x) => x.kind === 'initiative')) {
      const fm = parseYaml(f.content.split('---\n')[1]);
      assert.equal(validators.validateInitiative(fm), true, `${f.slug} invalid: ${JSON.stringify(validators.validateInitiative.errors)}`);
    }
  });

  it('YAML exit-gate takes priority over prose when both present', () => {
    const md = [
      '# T',
      '',
      '## F0 — S',
      '',
      '**Goal:** g',
      '',
      '**Exit gate da fase:** prose version',
      '',
      '```yaml',
      'exit_gate:',
      '  - id: F0-G1',
      '    description: yaml version',
      '    verifier: { kind: shell, command: "echo ok", expectExitCode: 0 }',
      '```',
      '',
      '### Sub-fases (menu)',
      '- **F0.T-001 — Task.** body',
      '',
    ].join('\n');
    const r = decomposePlan(md, { planSlug: 'x' });
    assert.equal(r.initiatives[0].exitGates.length, 1);
    assert.equal(r.initiatives[0].exitGates[0].verifier.kind, 'shell');
    assert.equal(r.initiatives[0].exitGates[0].description, 'yaml version');
  });

  it('H3-as-task fallback still works when no Sub-fases marker H3 present (regression guard)', () => {
    const md = [
      '# T',
      '',
      '## F0 — S',
      '',
      '**Goal:** g',
      '',
      '### Direct task one',
      '### Direct task two',
      '',
    ].join('\n');
    const r = decomposePlan(md, { planSlug: 'x' });
    assert.equal(r.initiatives[0].tasks.length, 2);
    assert.equal(r.initiatives[0].tasks[0].title, 'Direct task one');
  });

  it('falls back from H3-principles to bullet-principles when section has 0–1 H3s', () => {
    const md = [
      '# T',
      '',
      '## Principles',
      '',
      '- **P1 Truth source** — Single dump is authoritative.',
      '- **P2 Determinism** — No LLM at runtime.',
      '',
      '## F0 — S',
      '### A',
      '',
    ].join('\n');
    const r = decomposePlan(md, { planSlug: 'x' });
    assert.equal(r.plan.principles.length, 2);
    assert.equal(r.plan.principles[0].id, 'P1');
    assert.equal(r.plan.principles[0].title, 'Truth source');
  });

  it('falls back from table-glossary to bullet-glossary when no table present', () => {
    const md = [
      '# T',
      '',
      '## Glossary',
      '',
      '- **Tenant song** — Owned by a tenant.',
      '- **Collection song** — Shared catalog.',
      '',
      '## F0 — S',
      '### A',
      '',
    ].join('\n');
    const r = decomposePlan(md, { planSlug: 'x' });
    assert.equal(r.plan.glossary.length, 2);
    assert.equal(r.plan.glossary[0].term, 'Tenant song');
  });
});

describe('Phase C extension codex review regression — F-001 (TASK_MARKER_H3_RE over-matches H3 task titles)', () => {
  it('preserves `### Task one` H3 as a task in fallback mode (not misclassified as marker)', () => {
    const md = [
      '# T',
      '',
      '## F0 — S',
      '',
      '**Goal:** g',
      '',
      '### Task one',
      '### Task two',
      '',
    ].join('\n');
    const r = decomposePlan(md, { planSlug: 'x' });
    assert.equal(r.initiatives[0].tasks.length, 2);
    assert.equal(r.initiatives[0].tasks[0].title, 'Task one');
    assert.equal(r.initiatives[0].tasks[1].title, 'Task two');
  });

  it('preserves `### Tasks cleanup` H3 as a task (marker requires whole-line match)', () => {
    const md = [
      '# T',
      '',
      '## F0 — S',
      '',
      '**Goal:** g',
      '',
      '### Tasks cleanup',
      '### Other work',
      '',
    ].join('\n');
    const r = decomposePlan(md, { planSlug: 'x' });
    assert.equal(r.initiatives[0].tasks.length, 2);
    assert.equal(r.initiatives[0].tasks[0].title, 'Tasks cleanup');
  });

  it('still recognises `### Sub-fases (menu)` as marker (parenthesized suffix allowed)', () => {
    const md = [
      '# T',
      '',
      '## F0 — S',
      '',
      '**Goal:** g',
      '',
      '### Sub-fases (menu)',
      '- **F0.T-001 — A task.** body',
      '- **F0.T-002 — Another.** body',
      '',
    ].join('\n');
    const r = decomposePlan(md, { planSlug: 'x' });
    assert.equal(r.initiatives[0].tasks.length, 2);
    assert.equal(r.initiatives[0].tasks[0].id, 'T-001');
    assert.equal(r.initiatives[0].tasks[0].title, 'A task');
  });

  it('still recognises bare `### Tasks` as marker (no suffix required)', () => {
    const md = [
      '# T',
      '',
      '## F0 — S',
      '',
      '**Goal:** g',
      '',
      '### Tasks',
      '- **T-001 — Task A.** body',
      '',
    ].join('\n');
    const r = decomposePlan(md, { planSlug: 'x' });
    assert.equal(r.initiatives[0].tasks.length, 1);
    assert.equal(r.initiatives[0].tasks[0].title, 'Task A');
  });
});

describe('Phase C extension codex review regression — F-002 (materialize drops task.description)', () => {
  const FROZEN_DATE = new Date('2026-05-20T12:00:00.000Z');

  it('preserves bullet task description through materializeDecomposition', () => {
    const md = [
      '# T',
      '',
      '## F0 — S',
      '',
      '**Goal:** g',
      '',
      '### Sub-fases (menu)',
      '- **F0.T-001 — Restore local infra.** Composer install, .env, PostgreSQL.',
      '- **F0.T-002 — Pipeline.** Script reproduzível.',
      '',
    ].join('\n');
    const r = decomposePlan(md, { planSlug: 'plan' });
    // Decompose layer already captures description (regression guard)
    assert.match(r.initiatives[0].tasks[0].description, /Composer install/);
    // Materialize layer must preserve it (the F-002 fix)
    const files = materializeDecomposition(r, { planSlug: 'plan', now: FROZEN_DATE });
    const initFile = files.find((f) => f.kind === 'initiative');
    const fm = parseYaml(initFile.content.split('---\n')[1]);
    assert.equal(fm.tasks.length, 2);
    assert.match(fm.tasks[0].description, /Composer install/);
    assert.match(fm.tasks[1].description, /Script reproduzível/);
    // Schema validation must still pass (description is optional per schema)
    const validators = buildValidators();
    assert.equal(validators.validateInitiative(fm), true);
  });

  it('omits the description field entirely when no description was parsed (regression guard for H3 fallback)', () => {
    const md = [
      '# T',
      '',
      '## F0 — S',
      '',
      '**Goal:** g',
      '',
      '### A first task',
      '### A second task',
      '',
    ].join('\n');
    const r = decomposePlan(md, { planSlug: 'plan' });
    const files = materializeDecomposition(r, { planSlug: 'plan', now: FROZEN_DATE });
    const fm = parseYaml(files[1].content.split('---\n')[1]);
    for (const t of fm.tasks) {
      assert.equal(Object.prototype.hasOwnProperty.call(t, 'description'), false, `unexpected description on ${t.id}`);
    }
  });
});

describe('Phase C codex review regression — F-004 (colon-separator bullets without leading whitespace)', () => {
  it('splits `- Term: definition` into term + definition (glossary)', () => {
    const md = [
      '# X',
      '',
      '## Glossary',
      '',
      '- Tenant song: Song owned by a tenant.',
      '- Collection song: Shared catalog song.',
      '',
      '## F0 — S',
      '### A',
      '',
    ].join('\n');
    const r = decomposePlan(md, { planSlug: 'x' });
    assert.equal(r.plan.glossary.length, 2);
    assert.equal(r.plan.glossary[0].term, 'Tenant song');
    assert.equal(r.plan.glossary[0].definition, 'Song owned by a tenant.');
    assert.equal(r.plan.glossary[1].term, 'Collection song');
    assert.equal(r.plan.glossary[1].definition, 'Shared catalog song.');
  });

  it('splits `- Principle title: body` into title + body (principles)', () => {
    const md = [
      '# X',
      '',
      '## Inviolable principles',
      '',
      '- Truth source: Single dump is authoritative.',
      '- Determinism: No LLM at runtime.',
      '',
      '## F0 — S',
      '### A',
      '',
    ].join('\n');
    const r = decomposePlan(md, { planSlug: 'x' });
    assert.equal(r.plan.principles.length, 2);
    assert.equal(r.plan.principles[0].title, 'Truth source');
    assert.equal(r.plan.principles[0].body, 'Single dump is authoritative.');
    assert.equal(r.plan.principles[1].title, 'Determinism');
    assert.equal(r.plan.principles[1].body, 'No LLM at runtime.');
  });

  it('does not split hyphenated words with no surrounding whitespace (regression guard for dash regex)', () => {
    const md = [
      '# X',
      '',
      '## Glossary',
      '',
      '- well-known term: definition.',
      '',
      '## F0 — S',
      '### A',
      '',
    ].join('\n');
    const r = decomposePlan(md, { planSlug: 'x' });
    assert.equal(r.plan.glossary[0].term, 'well-known term');
    assert.equal(r.plan.glossary[0].definition, 'definition.');
  });
});
