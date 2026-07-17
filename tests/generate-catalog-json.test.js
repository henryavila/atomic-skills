import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildCatalogJson } from '../scripts/lib/build-catalog-json.js';

const minimalEntry = (name, overrides = {}) => ({
  name,
  title: `${name} — Demo`,
  description: 'A demo skill.',
  purpose: 'Find the true root cause.',
  when_to_use: ['You observed a bug'],
  when_not_to_use: ['You want a feature'],
  examples: [
    { command: `/atomic-skills:${name} "x"`, description: 'Run it' },
    { command: `/atomic-skills:${name}`, description: 'Interactive' },
  ],
  one_liner: 'Diagnose root cause then fix',
  emoji: '🔧',
  version_added: '1.0.0',
  schema_version: '0.2',
  tags: ['quality', 'tdd'],
  ...overrides,
});

describe('buildCatalogJson', () => {
  it('returns a bare array of records mapped to the CatalogWidget flat keys', () => {
    const out = buildCatalogJson({ core: { fix: minimalEntry('fix') } });
    assert.ok(Array.isArray(out), 'output must be a bare array');
    assert.equal(out.length, 1);
    const rec = out[0];
    assert.equal(rec.id, '/atomic-skills:fix', 'id bakes the /atomic-skills: prefix');
    assert.equal(rec.icon, '🔧', 'icon ← emoji');
    assert.equal(rec.oneLiner, 'Diagnose root cause then fix');
    assert.deepEqual(rec.facets, ['quality', 'tdd'], 'facets ← tags');
    assert.equal(rec.summary, 'Find the true root cause.', 'summary ← purpose');
    assert.deepEqual(rec.pros, ['You observed a bug'], 'pros ← when_to_use');
    assert.deepEqual(rec.cons, ['You want a feature'], 'cons ← when_not_to_use');
    assert.deepEqual(
      rec.examples,
      ['/atomic-skills:fix "x"', '/atomic-skills:fix'],
      'examples ← command strings'
    );
  });

  it('collapses folded-scalar whitespace in summary', () => {
    const out = buildCatalogJson({
      core: { fix: minimalEntry('fix', { purpose: 'line one\n  line two\n' }) },
    });
    assert.equal(out[0].summary, 'line one line two');
  });

  it('prefixes refs (related) so they match against the id field', () => {
    const out = buildCatalogJson({
      core: { fix: minimalEntry('fix', { related: ['hunt', 'review-code'] }) },
    });
    assert.deepEqual(out[0].refs, ['/atomic-skills:hunt', '/atomic-skills:review-code']);
  });

  it('maps subcommands → subItems {name,description,group}', () => {
    const out = buildCatalogJson({
      core: {
        project: minimalEntry('project', {
          subcommands: [
            {
              name: 'status',
              group: 'View',
              signature: '[--browser]',
              description: 'View current state',
              example: '/atomic-skills:project status',
            },
          ],
        }),
      },
    });
    assert.deepEqual(out[0].subItems, [
      { name: 'status', description: 'View current state', group: 'View' },
    ]);
  });

  it('maps args → fields {name,kind,required,description}', () => {
    const out = buildCatalogJson({
      core: {
        fix: minimalEntry('fix', {
          args: [
            { name: 'symptom', kind: 'positional', required: false, description: 'The bug' },
          ],
        }),
      },
    });
    assert.deepEqual(out[0].fields, [
      { name: 'symptom', kind: 'positional', required: false, description: 'The bug' },
    ]);
  });

  it('maps dependencies → deps and output_artifacts → outputs', () => {
    const out = buildCatalogJson({
      core: {
        fix: minimalEntry('fix', {
          dependencies: ['git'],
          output_artifacts: ['a failing test', 'the fix'],
        }),
      },
    });
    assert.deepEqual(out[0].deps, ['git']);
    assert.deepEqual(out[0].outputs, ['a failing test', 'the fix']);
  });

  it('omits optional keys when absent (no empty sections)', () => {
    const rec = buildCatalogJson({ core: { fix: minimalEntry('fix') } })[0];
    for (const k of ['subItems', 'fields', 'deps', 'outputs', 'refs']) {
      assert.ok(!(k in rec), `${k} must be omitted when empty`);
    }
  });

  it('includes only core skills (modules catalog removed)', () => {
    const out = buildCatalogJson({
      core: {
        fix: minimalEntry('fix'),
        laravel: minimalEntry('laravel'),
      },
    });
    assert.deepEqual(
      out.map((r) => r.id),
      ['/atomic-skills:fix', '/atomic-skills:laravel']
    );
  });
});
