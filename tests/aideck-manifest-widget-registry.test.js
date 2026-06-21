import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { parseWidgetMapKeys, resolveRendererPath } from '../scripts/build-aideck-widget-registry.mjs';

// ── The guardrail that closes the `widget: z.string()` false green ───────────
// The aiDeck manifest schema accepts ANY string for `widget:`, so a typo or a
// not-yet-shipped widget parses clean and only fails at render as an "Unknown
// widget" placeholder. This test gates the shipped consumer manifest against the
// vendored registry snapshot (meta/aideck-widget-registry.json), and keeps that
// snapshot honest by drift-checking it against the aiDeck source when reachable.

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const REPO = join(__dirname, '..');

const REGISTRY = JSON.parse(
  readFileSync(join(REPO, 'meta', 'aideck-widget-registry.json'), 'utf8'),
).widgets;

const manifest = YAML.parse(
  readFileSync(join(REPO, 'assets', 'aideck-consumer', 'manifest.yaml'), 'utf8'),
);

// Every place a widget type can appear: a section/slot binding (`widget: <type>`
// on a node) AND a single-layout page (`widget: <type>` at the page level). Walk
// the whole tree and collect each string-valued `widget` key.
function collectWidgetTypes(node, acc = new Set()) {
  if (Array.isArray(node)) {
    for (const n of node) collectWidgetTypes(n, acc);
  } else if (node && typeof node === 'object') {
    if (typeof node.widget === 'string') acc.add(node.widget);
    for (const v of Object.values(node)) collectWidgetTypes(v, acc);
  }
  return acc;
}

// The gate, as a pure function so we can prove it bites on a bad input.
function unknownWidgets(manifestObj, registry) {
  const known = new Set(registry);
  return [...collectWidgetTypes(manifestObj)].filter((w) => !known.has(w)).sort();
}

describe('aiDeck consumer manifest — every widget exists in the aiDeck registry', () => {
  it('the vendored registry is a non-trivial list of widget type strings', () => {
    assert.ok(Array.isArray(REGISTRY) && REGISTRY.length >= 20, 'registry should list the aiDeck widgets');
    assert.ok(REGISTRY.every((w) => typeof w === 'string' && /^[a-z0-9-]+$/.test(w)));
  });

  it('references ZERO widgets the installed aiDeck does not implement', () => {
    const used = [...collectWidgetTypes(manifest.pages)];
    assert.ok(used.length > 0, 'sanity: the manifest binds at least one widget');
    const unknown = unknownWidgets(manifest.pages, REGISTRY);
    assert.deepEqual(
      unknown,
      [],
      `manifest binds widget(s) absent from the aiDeck registry: ${unknown.join(', ')} ` +
        '(typo, or a widget not yet shipped — would render as "Unknown widget")',
    );
  });

  // RED-bite proof: the SAME gate must reject a manifest that names a widget the
  // registry doesn't know. Without this, a green run could mean "gate never fires".
  it('FAILS a manifest that references a non-existent widget (the false green it closes)', () => {
    const poisoned = {
      pages: [
        { slug: 'x', sections: [{ widgets: [{ widget: 'stat' }, { widget: 'totally-not-a-widget' }] }] },
      ],
    };
    const unknown = unknownWidgets(poisoned, REGISTRY);
    assert.deepEqual(unknown, ['totally-not-a-widget'], 'the gate must flag an unknown widget');
  });
});

describe('aiDeck widget registry — snapshot has not drifted from the aiDeck source', () => {
  const rendererPath = resolveRendererPath();

  it('matches the live WidgetRenderer.vue widgetMap (when an aiDeck checkout is reachable)', (t) => {
    if (!rendererPath) {
      t.skip('no aiDeck checkout reachable (set AIDECK_SRC or place a sibling ../aideck) — snapshot used as-is');
      return;
    }
    const live = parseWidgetMapKeys(readFileSync(rendererPath, 'utf8'));
    assert.deepEqual(
      [...REGISTRY].sort(),
      live,
      'meta/aideck-widget-registry.json is stale — run `npm run build:aideck-widget-registry`',
    );
  });
});
