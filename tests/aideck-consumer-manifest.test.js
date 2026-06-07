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

// Multi-plan-awareness invariant (regression guard for the "2 of everything,
// can't tell which plan" bug). The Home "Agora" section repeats every widget per
// ACTIVE plan. With ≥2 active plans, an unlabeled repeated widget renders
// duplicated with no plan identity. aiDeck's repeatLabel defaults to `auto` —
// hidden for a single group, shown for ≥2 — so a plan-grouped widget is correct
// for N≥1 IFF it surfaces the plan name: either via `repeatLabelField`, or (the
// callout's case) by rendering the plan name in its own body. Hardcoding
// `repeatLabel: never` without a self-label is the bug this test forbids.
describe('aiDeck consumer manifest — Home "Agora" is multi-plan-aware (N≥1)', () => {
  const agora = section('home', 'Agora');

  it('has the Agora section with widgets', () => {
    assert.ok(agora, 'Home page must have an "Agora" section');
    assert.ok(Array.isArray(agora.widgets) && agora.widgets.length > 0);
  });

  it('every plan-repeated widget surfaces the plan name (no unlabeled never)', () => {
    const planRepeated = agora.widgets.filter(
      (w) => w.repeat === 'parentPlan' || w.repeat === 'planSlug',
    );
    assert.ok(planRepeated.length > 0, 'expected plan-grouped widgets in Agora');

    for (const w of planRepeated) {
      const labelled = typeof w.repeatLabelField === 'string' && w.repeatLabelField.length > 0;
      // The callout self-labels by rendering the plan name in its body.
      const selfLabels = w.config && w.config.bodyField === 'planTitle';

      assert.ok(
        labelled || selfLabels,
        `Agora widget "${w.widget}" repeats per plan but has no plan label ` +
          `(set repeatLabelField, or self-label via config.bodyField: planTitle). ` +
          `An unlabeled per-plan widget renders ambiguously when ≥2 plans are active.`,
      );

      // `repeatLabel: never` is only allowed for the self-labeling widget; on a
      // field-labeled widget it would suppress the very header that disambiguates.
      if (w.repeatLabel === 'never') {
        assert.ok(
          selfLabels,
          `Agora widget "${w.widget}" sets repeatLabel: never but does not ` +
            `self-label — its plan header would be hidden even with 2+ active plans. ` +
            `Use the default (auto) so the header appears when ≥2 plans are active.`,
        );
      }
    }
  });

  it('uses a consistent plan label field across the labeled Agora widgets', () => {
    const fields = new Set(
      agora.widgets
        .filter((w) => typeof w.repeatLabelField === 'string')
        .map((w) => w.repeatLabelField),
    );
    // One canonical label keeps every per-plan group header reading the same name.
    assert.deepEqual([...fields], ['planTitle'], 'plan group headers should all use planTitle');
  });
});
