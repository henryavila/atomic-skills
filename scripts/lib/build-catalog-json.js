/**
 * Pure mapper: parsed `meta/catalog.yaml` → the bare-array `meta/catalog.json`
 * the aiDeck `CatalogWidget` consumes. Consumed by
 * `scripts/generate-catalog-json.js` (CLI) and `tests/generate-catalog-json.test.js`.
 *
 * WHY a separate projection: the catalog YAML is the human-authored source of
 * truth (rich schema, validated by validate-skills-core). The CatalogWidget reads
 * a FLAT-KEY record shape with neutral default field names (Q11 of the aiDeck
 * runtime answers, docs/handoffs/atomic-skills-v2-answers.md) — no `fieldMap`, no
 * `detail.sections` DSL. So we precompute the flat shape here, mirroring the
 * emitter pattern (the runtime can't transform records at read time).
 *
 * Field map (catalog.yaml → CatalogWidget default field):
 *   id        ← `/atomic-skills:<name>`   (baked prefix; `refs` match against it)
 *   icon      ← emoji
 *   oneLiner  ← one_liner
 *   facets    ← tags
 *   summary   ← purpose (whitespace-collapsed)
 *   pros      ← when_to_use      cons ← when_not_to_use
 *   examples  ← examples[].command (command strings only)
 *   subItems  ← subcommands {name, description, group}
 *   fields    ← args {name, kind, required, description}
 *   deps      ← dependencies     outputs ← output_artifacts
 *   refs      ← related (each prefixed, so they resolve against `id`)
 *
 * Optional keys are OMITTED when empty so the widget renders no empty sections.
 *
 * Catalog root v0.3 additive fields (`iron_law`, top-level `product:`) are
 * intentionally NOT projected here — CatalogWidget still uses the flat help
 * card shape; product positioning is for site/README generators, not aiDeck.
 */
import { collectSkills } from './validate-skills-core.js';

export const SKILL_PREFIX = '/atomic-skills:';

/** Collapse folded-scalar / multi-line whitespace into a single-spaced line. */
function collapse(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Coerce to an array of trimmed non-empty strings (drops anything else). */
function strList(value) {
  if (!Array.isArray(value)) return [];
  return value.map((x) => String(x).trim()).filter((x) => x.length > 0);
}

function mapSubcommands(subcommands) {
  if (!Array.isArray(subcommands)) return [];
  return subcommands
    .filter((s) => s && typeof s === 'object')
    .map((s) => ({
      name: String(s.name || ''),
      description: String(s.description || ''),
      group: String(s.group || ''),
    }));
}

function mapArgs(args) {
  if (!Array.isArray(args)) return [];
  return args
    .filter((a) => a && typeof a === 'object')
    .map((a) => ({
      name: String(a.name || ''),
      kind: String(a.kind || ''),
      required: a.required === true,
      description: String(a.description || ''),
    }));
}

/** Map one catalog entry to its flat CatalogWidget record. */
export function mapEntry(key, entry) {
  const e = entry && typeof entry === 'object' ? entry : {};

  const rec = {
    id: `${SKILL_PREFIX}${key}`,
    icon: String(e.emoji || ''),
    oneLiner: String(e.one_liner || ''),
    facets: strList(e.tags),
    summary: collapse(e.purpose),
    pros: strList(e.when_to_use),
    cons: strList(e.when_not_to_use),
    examples: Array.isArray(e.examples)
      ? e.examples.map((x) => (x && typeof x === 'object' ? x.command : null)).filter(Boolean)
      : [],
  };

  const subItems = mapSubcommands(e.subcommands);
  if (subItems.length) rec.subItems = subItems;

  const fields = mapArgs(e.args);
  if (fields.length) rec.fields = fields;

  const deps = strList(e.dependencies);
  if (deps.length) rec.deps = deps;

  const outputs = strList(e.output_artifacts);
  if (outputs.length) rec.outputs = outputs;

  const refs = strList(e.related).map((r) => `${SKILL_PREFIX}${r}`);
  if (refs.length) rec.refs = refs;

  return rec;
}

/**
 * Build the bare-array catalog projection from a parsed catalog.yaml object.
 * Order follows collectSkills (core skills) — stable for the --check diff.
 */
export function buildCatalogJson(catalogData) {
  return collectSkills(catalogData).map(({ key, entry }) => mapEntry(key, entry));
}
