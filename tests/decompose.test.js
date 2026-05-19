import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decomposePlan, previewDecomposition } from '../src/decompose.js';

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
