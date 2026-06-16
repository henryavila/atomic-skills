import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const TEMPLATE = join(__dirname, '..', 'assets', 'aideck-consumer', 'manifest.yaml');

const manifest = YAML.parse(readFileSync(TEMPLATE, 'utf8'));

function page(slug) {
  return manifest.pages.find((p) => p.slug === slug);
}
function section(pageSlug, sectionTitle) {
  return page(pageSlug).sections.find((s) => s.title === sectionTitle);
}
// Recursively collect every widget binding (including those nested in slots).
function allWidgets(node, acc = []) {
  if (Array.isArray(node)) {
    for (const n of node) allWidgets(n, acc);
  } else if (node && typeof node === 'object') {
    if (typeof node.widget === 'string') acc.push(node);
    for (const v of Object.values(node)) allWidgets(v, acc);
  }
  return acc;
}

describe('aiDeck consumer manifest — v2 cutover (schemaVersion 0.1, emitted state)', () => {
  it('stays on the v0.1 runtime contract', () => {
    assert.equal(manifest.schemaVersion, '0.1');
    assert.equal(manifest.id, 'atomic-skills');
    assert.equal(manifest.mcpNamespace, 'atomic_skills');
  });

  it('binds every entity dataSource to the emitted state/*.json (root: project)', () => {
    const byId = new Map(manifest.dataSources.map((d) => [d.id, d]));
    for (const id of ['plans', 'phases', 'initiatives', 'tasks', 'gates', 'phaseGates', 'stack', 'parked', 'emerged', 'projects', 'totals']) {
      const ds = byId.get(id);
      assert.ok(ds, `missing dataSource ${id}`);
      assert.equal(ds.format, 'json', `${id} must be json`);
      assert.equal(ds.root, 'project', `${id} must be root: project (watched for SSE)`);
      assert.match(ds.path, /\.aideck\/state\//, `${id} must read the emitted state dir`);
    }
  });

  it('drops the old in-place frontmatter / array-explode sources', () => {
    const formats = new Set(manifest.dataSources.map((d) => d.format));
    assert.ok(!formats.has('frontmatter'), 'no frontmatter sources remain');
    for (const d of manifest.dataSources) {
      assert.ok(!('derivesFrom' in d), `${d.id} must not be an explode source`);
      assert.ok(!('explode' in d), `${d.id} must not be an explode source`);
    }
  });

  it('keeps the writable jsonl inbox the mutation handlers append to', () => {
    const inbox = manifest.dataSources.find((d) => d.id === 'inbox');
    assert.ok(inbox && inbox.format === 'jsonl' && inbox.root === 'project');
  });
});

describe('aiDeck consumer manifest — Foco is the default, multi-plan-aware (N≥1)', () => {
  it('foco is the default page', () => {
    assert.equal(page('foco').default, true);
  });

  // Regression guard for the "2 of everything, can't tell which plan" bug: the
  // per-active-plan card repeats by plan and MUST surface the plan name, else two
  // active plans render as ambiguous duplicates. repeatLabel defaults to `auto`
  // (hidden for one group, shown for ≥2), so a `repeatLabelField` is required.
  it('the Frentes em foco card repeats per plan and labels the group with the plan name', () => {
    const frentes = section('foco', 'Frentes em foco');
    const card = frentes.widgets.find((w) => w.widget === 'card');
    assert.ok(card, 'expected a card host in Frentes em foco');
    assert.equal(card.repeat, 'slug', 'card repeats per plan');
    assert.equal(card.repeatLabelField, 'title', 'group header = the plan title');
    assert.notEqual(card.repeatLabel, 'never', 'a never-labeled per-plan card is the bug this forbids');
  });

  it('scopes the macro stepper to its parent plan via the $parent token (no plan→phase join)', () => {
    const card = section('foco', 'Frentes em foco').widgets.find((w) => w.widget === 'card');
    const stepper = card.slots.body.find((w) => w.widget === 'stepper');
    assert.ok(stepper, 'card body composes a phase stepper');
    assert.equal(stepper.source.filter.planSlug, '$parent.slug');
    assert.equal(stepper.source.filter.projectId, '$parent.projectId');
  });

  it('uses precomputed bucket booleans instead of array-OR filters', () => {
    const suspended = section('foco', 'Suspenso & travado').widgets[0];
    assert.equal(suspended.source.filter.suspended, true);
    for (const w of allWidgets(manifest.pages)) {
      const f = w.source?.filter;
      if (!f) continue;
      for (const v of Object.values(f)) {
        assert.ok(!Array.isArray(v), `array-OR filter on ${w.widget} silently zeros rows in v0.1`);
      }
    }
  });
});

describe('aiDeck consumer manifest — adopts the DS v2.1 widgets', () => {
  it('uses the new widget set and no removed/unknown keys', () => {
    const used = new Set(allWidgets(manifest.pages).map((w) => w.widget));
    for (const w of ['collection-grid', 'stepper', 'record-switcher', 'status-list', 'catalog']) {
      assert.ok(used.has(w), `expected the ${w} widget in the v2 manifest`);
    }
    // card-grid was renamed to collection-grid in DS v2.1 — a stale key would
    // render a visible "Unknown widget" placeholder.
    assert.ok(!used.has('card-grid'), 'card-grid must be migrated to collection-grid');
  });

  it('drives detail pages by route param (selection = navigation, ≤2 route params)', () => {
    // The client router caps detail routes at /:projectId/:slug, so detail widgets
    // filter by composite source.param, and steppers link out to the phase page.
    const planKv = section('plan', 'Plano').widgets.find((w) => w.widget === 'key-value');
    assert.deepEqual(planKv.source.param.match, ['projectId', 'slug']);
    const stepper = section('plan', 'Roteiro').widgets.find((w) => w.widget === 'stepper');
    assert.equal(stepper.config.linkTo, 'phase/:projectId/:slug');
  });

  it('renders the help catalog as a single-layout page bound to meta/catalog.json', () => {
    const help = page('help');
    assert.equal(help.layout, 'single');
    assert.equal(help.widget, 'catalog');
    assert.equal(help.source.ref, 'catalog');
    const catalogSrc = manifest.dataSources.find((d) => d.id === 'catalog');
    assert.equal(catalogSrc.path, 'meta/catalog.json');
  });
});

describe('aiDeck consumer manifest — every status widget shares one tone vocabulary', () => {
  it('resolves the &statusvocab anchor to a single tone set across widgets', () => {
    const statusConfigs = allWidgets(manifest.pages)
      .map((w) => w.config?.statuses)
      .filter(Boolean);
    assert.ok(statusConfigs.length >= 5, 'expected several status-bearing widgets');
    const tones = new Set();
    for (const sc of statusConfigs) {
      for (const v of Object.values(sc)) tones.add(v.tone);
    }
    for (const t of tones) {
      assert.ok(['success', 'warning', 'error', 'info', 'neutral'].includes(t), `invalid tone ${t}`);
    }
    // The anchor/alias means every widget references the SAME resolved object.
    assert.equal(new Set(statusConfigs).size, 1, 'all widgets must alias the one &statusvocab');
  });
});
