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
    // `totals` is gone — the 4 Panorama totals are read-time source.agg now.
    for (const id of ['plans', 'phases', 'initiatives', 'tasks', 'gates', 'phaseGates', 'stack', 'parked', 'emerged', 'projects']) {
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

  it('drops the precomputed totals dataSource (read-time source.agg replaces it)', () => {
    assert.ok(!manifest.dataSources.some((d) => d.id === 'totals'), 'totals source must be gone');
  });
});

describe('aiDeck consumer manifest — adopts the v0.1 engine (agg/array-filter/statusMap/nav/help)', () => {
  it('declares a top-level statusMap and drops per-widget config.statuses repetition', () => {
    assert.ok(manifest.statusMap, 'expected a top-level statusMap');
    const tones = new Set(['success', 'warning', 'error', 'info', 'neutral']);
    for (const [word, v] of Object.entries(manifest.statusMap)) {
      const tone = typeof v === 'string' ? v : v.tone;
      assert.ok(tones.has(tone), `statusMap.${word} maps to an invalid tone: ${tone}`);
    }
    // The vocabulary is declared ONCE; no widget repeats a config.statuses block.
    const widgetsWithStatuses = allWidgets(manifest.pages).filter((w) => w.config?.statuses);
    assert.equal(widgetsWithStatuses.length, 0, 'no widget should carry its own config.statuses anymore');
  });

  it('renders status counts via source.agg (no precomputed totals, no count()/field() exprs)', () => {
    const aggStats = allWidgets(manifest.pages).filter((w) => w.widget === 'stat' && w.source?.agg);
    assert.ok(aggStats.length >= 4, 'expected the Panorama/Planos stats to use source.agg');
    for (const w of allWidgets(manifest.pages)) {
      const v = w.config?.value;
      if (typeof v === 'string') {
        assert.ok(!/^count\(|^field\(/.test(v), `stat value expr "${v}" is a retired workaround — use source.agg`);
      }
      assert.notEqual(w.source?.ref, 'totals', 'no widget may bind the retired totals source');
    }
  });

  it('uses array-membership filters on status (the v0.1 engine now supports them)', () => {
    const suspended = section('foco-agora', 'Suspenso & travado').widgets[0];
    assert.deepEqual(suspended.source.filter.status, ['paused', 'blocked']);
    // The retired bucket booleans must not appear in any filter.
    for (const w of allWidgets(manifest.pages)) {
      const f = w.source?.filter ?? {};
      for (const dead of ['suspended', 'concluded', 'liveFront', 'bucket']) {
        assert.ok(!(dead in f), `filter on ${w.widget} still references retired bucket field ${dead}`);
      }
    }
  });

  it('uses project-centric nav (style: projects, Panorama landing, PROJETOS label) and wires the chrome ?', () => {
    // Opts into the aiDeck project-centric shell: Panorama pinned as the landing,
    // the registered projects listed under a manifest-provided label.
    assert.equal(manifest.nav.style, 'projects');
    assert.equal(manifest.nav.showIcons, true);
    assert.equal(manifest.nav.landingPage, 'panorama', 'Panorama is the pinned cross-project landing');
    assert.ok(manifest.nav.projectsLabel, 'the projects group carries a manifest-provided label (not hardcoded in aiDeck)');
    assert.ok(manifest.pages.some((p) => p.slug === manifest.nav.landingPage), 'landingPage must name a real page slug');
    assert.equal(manifest.help, 'help');
    assert.ok(manifest.pages.some((p) => p.slug === manifest.help), 'help must name a real page slug');
  });

  it('indexes plan records in the ⌘K command palette (initiatives have no standalone page)', () => {
    const refs = (manifest.commandPalette?.records ?? []).map((r) => r.ref);
    assert.ok(refs.includes('plans'), 'palette should index plans');
    // The phase/initiative detail folds into the plan page, so there is no
    // /phase route to navigate an initiative record to — drop it from the palette.
    assert.ok(!refs.includes('initiatives'), 'initiatives are folded into the plan page; not a palette record');
  });
});

describe('aiDeck consumer manifest — Panorama is the cross-project landing', () => {
  it('panorama is the default page and sits at the top of the sidebar', () => {
    assert.equal(page('panorama').default, true, 'panorama must be the default (lands on /atomic-skills)');
    assert.notEqual(page('foco-agora')?.default, true, 'foco-agora is a project page, not the default');
    assert.equal(manifest.pages[0].slug, 'panorama', 'panorama must be first → top of the sidebar');
  });

  // §scope: a cross-project landing has NO selected project, so every Panorama
  // source must read `scope: all-projects` (aiDeck merges every registered project
  // and tags each record with the registered projectId). A project-scoped fetch
  // here would have no projectId and return nothing.
  it('reads every Panorama source with scope: all-projects', () => {
    const panoramaWidgets = allWidgets(page('panorama').sections);
    const withSource = panoramaWidgets.filter((w) => w.source?.ref);
    assert.ok(withSource.length >= 5, 'expected the 4 stats + the projects grid');
    for (const w of withSource) {
      assert.equal(w.source.scope, 'all-projects', `Panorama widget ${w.widget}(${w.source.ref}) must be scope: all-projects`);
    }
  });

  it('groups/filters cross-project data by the registered projectId, not the internal id', () => {
    const grid = allWidgets(page('panorama').sections).find((w) => w.widget === 'collection-grid');
    // The all-projects merge injects projectId = registered id on every record. The
    // per-project nested fronts (denormalized via nestedField) link through :projectId
    // — robust across internal-vs-registered project divergence — never the record's
    // internal :id.
    assert.ok(grid.config.nestedField, 'the project card nests its live fronts');
    assert.ok(
      grid.config.nestedLinkTo && grid.config.nestedLinkTo.includes(':projectId'),
      'nested fronts key on the registered projectId',
    );
  });
});

describe('aiDeck consumer manifest — Foco agora fans out per active plan (N≥1)', () => {
  it('is named foco-agora (design topology), no longer the old foco slug', () => {
    assert.ok(page('foco-agora'), 'expected the foco-agora page');
    assert.ok(!page('foco'), 'the old foco slug must be renamed to foco-agora');
  });

  // §design: foco-agora leads with the parallelism banner (headline-banner) —
  // the big number + one tone-coded lane per live front. Bound to the REAL widget
  // contract: laneStatusField + literal title/sub (config.title is literal text,
  // not a field ref — see HeadlineBannerWidget.vue).
  it('leads with a headline-banner over the project fronts', () => {
    const banner = allWidgets(page('foco-agora').sections).find((w) => w.widget === 'headline-banner');
    assert.ok(banner, 'foco-agora must lead with a headline-banner');
    assert.equal(banner.source.ref, 'plans', 'the banner lanes are the project fronts');
    assert.ok(banner.config?.laneStatusField, 'one lane per front, tone-coded by status');
  });

  // The per-active-plan front renders as a DS record-card (collection-grid over the
  // active plans), matching the design's `.cgrid` of `.rcard`. One card per active
  // plan, each titled by the plan (so two active plans aren't ambiguous duplicates),
  // its title linking to the plan detail.
  it('the Frentes em foco section renders one record-card per active plan (collection-grid)', () => {
    const frentes = section('foco-agora', 'Frentes em foco');
    const grid = frentes.widgets.find((w) => w.widget === 'collection-grid');
    assert.ok(grid, 'expected a collection-grid host in Frentes em foco');
    assert.equal(grid.source.ref, 'plans', 'one card per plan');
    assert.deepEqual(grid.source.filter, { status: 'active' }, 'one card per ACTIVE plan');
    assert.equal(grid.config.titleField, 'title', 'card title = the plan title');
    assert.ok(grid.config.linkTo, 'the card title links to the plan detail');
  });

  it('scopes the macro stepper to its parent plan via the $parent token (no plan→phase join)', () => {
    const grid = section('foco-agora', 'Frentes em foco').widgets.find((w) => w.widget === 'collection-grid');
    const stepper = grid.slots.body.find((w) => w.widget === 'stepper');
    assert.ok(stepper, 'the card body composes a phase stepper');
    // Composed inline (no nested widget frame) — matches the design's flush card body.
    assert.equal(stepper.config.frame, false, 'the body stepper renders inline (frameless)');
    assert.equal(stepper.source.filter.planSlug, '$parent.slug');
    assert.equal(stepper.source.filter.projectId, '$parent.projectId');
    // Each phase marker drills into the PLAN detail opened directly at that phase
    // (?phase=<id> seeds the detail's selectedPhase bus) — NOT a standalone /phase
    // route (which doesn't exist; the phase detail is folded into the plan page).
    assert.match(stepper.config.linkTo, /^plan\//, 'foco stepper steps link to the plan detail');
    assert.match(stepper.config.linkTo, /[?&]phase=:id\b/, 'the link carries the phase id (deep-link to the phase)');
    assert.ok(!/(^|\/)phase\//.test(stepper.config.linkTo), 'must not target a removed /phase route');
  });
});

describe('aiDeck consumer manifest — design topology (foco-agora · visão-geral · plano folds phase · arquivados)', () => {
  it('renames planos → visao-geral with a per-project metrics strip + Frentes vivas table', () => {
    assert.ok(page('visao-geral'), 'expected the visao-geral page');
    assert.ok(!page('planos'), 'the old planos slug must be renamed to visao-geral');
    const stats = allWidgets(page('visao-geral').sections).filter((w) => w.widget === 'stat');
    assert.ok(stats.length >= 5, 'visao-geral leads with a per-project stats strip');
    const table = allWidgets(page('visao-geral').sections).find((w) => w.widget === 'table');
    assert.ok(table, 'visao-geral lists the live fronts in a table');
  });

  it('separates lifecycle views: open work, recent done, and archived history', () => {
    const forbiddenInOpenFlow = new Set(['done', 'archived']);
    for (const pageSlug of ['panorama', 'foco-agora']) {
      for (const w of allWidgets(page(pageSlug).sections)) {
        for (const sourceKey of ['filter', 'where']) {
          const status = w.source?.[sourceKey]?.status;
          const values = Array.isArray(status) ? status : status ? [status] : [];
          for (const value of values) {
            assert.ok(
              !forbiddenInOpenFlow.has(value),
              `${pageSlug} ${w.widget} ${sourceKey}.status must not include ${value}`,
            );
          }
        }
      }
    }

    const liveFronts = section('visao-geral', 'Frentes vivas').widgets.find((w) => w.widget === 'table');
    assert.deepEqual(liveFronts.source.filter.status, ['active', 'paused', 'blocked']);

    const recentDone = section('visao-geral', 'Concluídas recentes').widgets.find((w) => w.widget === 'table');
    assert.equal(recentDone.source.ref, 'plans');
    assert.deepEqual(recentDone.source.filter, { status: 'done' });

    assert.ok(page('arquivados'), 'expected a dedicated Arquivados page');
    assert.ok(!page('concluidos'), 'Concluídos must be folded into Visão geral, not a standalone mixed page');
    const archived = page('arquivados');
    assert.equal(archived.title, 'Arquivados');
    assert.deepEqual(archived.source.filter, { status: 'archived' });
  });

  it('folds the phase/initiative detail INTO the plan page (no standalone phase page)', () => {
    assert.ok(!page('phase'), 'the standalone phase page is folded into the plan detail');
    // The fold surfaces the selected phase as a record-detail card off the
    // initiatives source, scoped to the selected phase via the page-state bus; the
    // PRÓXIMA AÇÃO callout lives in that card's composed body.
    const detail = allWidgets(page('plan').sections).find(
      (w) => w.widget === 'collection-grid' && w.source?.ref === 'initiatives',
    );
    assert.ok(detail, 'the plan page folds in the selected-phase detail card (initiatives)');
    const match = detail.source.param.match;
    assert.ok(match.some((e) => e.field === 'phaseId' && e.state === 'selectedPhase'), 'the folded detail reads the selected phase from the bus');
    const callout = allWidgets(page('plan').sections).find(
      (w) => w.widget === 'callout' && w.config?.eyebrow === 'PRÓXIMA AÇÃO',
    );
    assert.ok(callout, 'the detail card body folds in the PRÓXIMA AÇÃO callout');
  });

  it('opens help via the chrome ? and declares it out of the sidebar (showInNav: false)', () => {
    // Help is reachable via the chrome `?` (manifest.help) and declares showInNav:
    // false — the generic page nav-visibility flag specified for the F1 shell
    // (nav-style-projects-impl.md §6). The engine strips the key until that lands,
    // so the flag is forward-compatible; this test locks the design intent.
    assert.equal(manifest.help, 'help');
    assert.ok(page('help'), 'help must remain a real page (opened by the chrome ?)');
    assert.equal(page('help').showInNav, false, 'help is reachable by ? only, not listed in the sidebar');
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

  it('drives detail pages by route param (composite source.param, ≤2 route params)', () => {
    // The client router caps detail routes at /:projectId/:slug, so the detail card
    // filters by composite source.param — at most 2 ROUTE params (the selectedPhase
    // entry is a page-state bus value, not a route param).
    const detail = allWidgets(page('plan').sections).find(
      (w) => w.widget === 'collection-grid' && w.source?.ref === 'initiatives',
    );
    const routeParams = detail.source.param.match.filter((e) => typeof e === 'string' || (e && e.param));
    assert.ok(routeParams.length <= 2, 'detail filters by ≤2 route params (/:projectId/:slug)');
    assert.ok(routeParams.some((e) => e === 'projectId'), 'detail scopes by projectId');
    assert.ok(routeParams.some((e) => e.field === 'planSlug' && e.param === 'slug'), 'detail scopes by planSlug from the route');
  });

  it('plano roteiro selects a phase via the emits/state bus (reactive, not navigation)', () => {
    const stepper = allWidgets(page('plan').sections).find((w) => w.widget === 'stepper');
    assert.ok(stepper, 'the plan page has a roteiro stepper');
    assert.equal(stepper.config.selectable, true, 'roteiro stepper is selectable');
    assert.deepEqual(stepper.emits?.select, { set: 'selectedPhase' }, 'selecting writes pageState.selectedPhase');
    // linkTo would render the step as a RouterLink and navigate instead of selecting.
    assert.equal(stepper.config.linkTo, undefined, 'the reactive roteiro stepper must NOT carry linkTo');
    assert.equal(stepper.config.currentField, 'isCurrent', 'seeds the current phase into the bus on load');
  });

  it('the selected-phase detail re-scopes to the bus value AND the route (no phaseId collision)', () => {
    // The detail CARD scopes by route (projectId + planSlug) AND the bus
    // (phaseId == selectedPhase) — route scope prevents the shared "F1" phaseId from
    // matching other plans; the bus narrows to the selected phase. Its body
    // task/gate lists inherit that exact phase via $parent (no independent phaseId).
    const detail = allWidgets(page('plan').sections).find(
      (w) => w.widget === 'collection-grid' && w.source?.ref === 'initiatives',
    );
    const match = detail.source.param.match;
    assert.ok(match.some((e) => e === 'projectId'), 'detail scopes by projectId');
    assert.ok(match.some((e) => e.field === 'planSlug' && e.param === 'slug'), 'detail scopes by planSlug');
    assert.ok(match.some((e) => e.field === 'phaseId' && e.state === 'selectedPhase'), 'detail reads phaseId from the bus');
    const lists = detail.slots.body.filter((w) => w.widget === 'status-list');
    assert.ok(lists.length >= 2, 'tasks + exit-gate checklists are folded into the detail body');
    for (const w of lists) {
      assert.equal(w.source.filter.projectId, '$parent.projectId', `${w.config.title} inherits projectId via $parent`);
      assert.equal(w.source.filter.planSlug, '$parent.planSlug', `${w.config.title} inherits planSlug via $parent`);
      assert.equal(w.source.filter.phaseId, '$parent.phaseId', `${w.config.title} inherits phaseId via $parent`);
    }
  });

  it('switches page icons from mdi:* tokens to emoji/glyphs (aiDeck has no icon font)', () => {
    for (const p of manifest.pages) {
      if (p.icon === undefined) continue;
      assert.ok(!/^mdi:/.test(p.icon), `page ${p.slug} still uses an mdi:* icon (renders as ◆)`);
    }
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

describe('aiDeck consumer manifest — Ritmo (burn-up / SPI render, F5)', () => {
  it('registers the burnup + spi series dataSources (emitted, root: project)', () => {
    const byId = new Map(manifest.dataSources.map((d) => [d.id, d]));
    for (const id of ['burnup', 'spi']) {
      const ds = byId.get(id);
      assert.ok(ds, `missing dataSource ${id}`);
      assert.equal(ds.format, 'json', `${id} must be json`);
      assert.equal(ds.root, 'project', `${id} must be root: project (watched for SSE)`);
      assert.match(ds.path, /\.aideck\/state\/(burnup|spi)\.json$/, `${id} must read the emitted state series file`);
    }
  });

  it('renders a Ritmo section with a 3-track burn-up line-chart bound to burnup', () => {
    const ritmo = section('plan', 'Ritmo');
    assert.ok(ritmo, 'the plan page must carry a "Ritmo" section');
    const chart = ritmo.widgets.find((w) => w.widget === 'line-chart');
    assert.ok(chart, 'Ritmo must include a line-chart');
    assert.equal(chart.source.ref, 'burnup', 'the chart binds the burnup series');
    assert.equal(chart.config.xField, 'date', 'x axis is the burn-up date');
    assert.deepEqual(
      chart.config.series,
      ['plannedValue', 'earnedCount', 'earnedProxy'],
      'the chart plots the planned line + both earned bases (count & proxy)',
    );
    // burnup is per-plan: scoped to the route's projectId + planSlug.
    assert.ok(chart.source.param?.match, 'the chart must scope to the selected plan (param.match)');
  });

  it('renders the SPI from the spi series (spiProxy headline, spiCount informative)', () => {
    const ritmo = section('plan', 'Ritmo');
    const spiWidgets = ritmo.widgets.filter((w) => w.source?.ref === 'spi');
    assert.ok(spiWidgets.length >= 1, 'Ritmo must bind the spi series');
    const gauge = spiWidgets.find((w) => w.widget === 'gauge' && w.config?.valueField === 'spiProxy');
    assert.ok(gauge, 'spiProxy is rendered as a gauge (precomputed scalar; stat value:field() is retired in v2.1)');
    const spiCountShown = spiWidgets.some(
      (w) => (w.config?.valueField === 'spiCount') || (Array.isArray(w.config?.fields) && w.config.fields.includes('spiCount')),
    );
    assert.ok(spiCountShown, 'spiCount must be surfaced too (informative)');
  });

  it('uses only widgets in the published aiDeck registry (no invented widget)', () => {
    const registry = new Set(
      JSON.parse(readFileSync(join(__dirname, '..', 'meta', 'aideck-widget-registry.json'), 'utf8')).widgets,
    );
    const ritmo = section('plan', 'Ritmo');
    for (const w of allWidgets(ritmo.widgets)) {
      assert.ok(registry.has(w.widget), `Ritmo widget "${w.widget}" is not in the published aiDeck registry`);
    }
  });
});
