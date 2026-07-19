/**
 * Pure scaffolding helpers for `scripts/new-skill.js`.
 *
 * The whole point of this module is to produce a NEW `core` catalog entry plus
 * a matching skill body that pass `validate-catalog` on the first try, so the
 * husky pre-commit / CI gates accept the commit without hand-editing. It only
 * builds text — all disk IO lives in the thin CLI wrapper.
 *
 * Catalog mutation is done as a minimal-diff TEXT INSERTION (not a YAML
 * re-serialize): re-stringifying `meta/catalog.yaml` would collapse its folded
 * scalars, comments, and the hand-authored `release_highlight` block. We insert
 * the new entry immediately after the last `core:` child, before `modules:`.
 */

import { parse } from 'yaml';
import { collectSkills } from './validate-skills-core.js';

// Skill key = body filename stem, so it must be a safe, kebab-case slug.
const NAME_REGEX = /^[a-z][a-z0-9-]*$/;
const VERSION_REGEX = /^\d+\.\d+\.\d+$/;
const ONE_LINER_MIN = 10;
const ONE_LINER_MAX = 80;

/** YAML single-quoted scalar: wrap in '...' and double any internal quote. */
function sq(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

/** "review-code" → "Review Code" for placeholder titles. */
function titleCase(name) {
  return name
    .split('-')
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ');
}

export function validateName(name) {
  if (typeof name !== 'string' || !NAME_REGEX.test(name)) {
    throw new Error(
      `invalid skill name "${name}": must be lowercase kebab-case matching ${NAME_REGEX}`
    );
  }
  return name;
}

/**
 * Validation-passing placeholder fields for a brand-new skill. Every value is
 * deliberately a `TODO` the author replaces, but each one already satisfies the
 * v0.2 schema (non-empty arrays, one_liner length, version_added format) so the
 * generated entry is committable as-is.
 */
export function defaultFields(name, pkgVersion) {
  const oneLiner = `TODO one-liner for the ${name} skill`.slice(0, ONE_LINER_MAX);
  return {
    title: `${titleCase(name)} — TODO short title`,
    description: `TODO: describe the ${name} skill and when an agent should reach for it.`,
    purpose: `TODO: state the purpose of the ${name} skill in one or two sentences.`,
    when_to_use: [`TODO: a situation where ${name} is the right tool`],
    when_not_to_use: [`TODO: a situation where ${name} is the wrong tool`],
    examples: [
      { command: `/atomic-skills:${name}`, description: 'TODO: describe this example' },
    ],
    one_liner: oneLiner,
    emoji: '🧩',
    version_added: pkgVersion || '0.0.0',
    // Catalog v0.3 requires iron_law; keep in sync with buildSkillBody first law line.
    iron_law: 'TODO: STATE THE ONE NON-NEGOTIABLE RULE FOR THIS SKILL AS A SINGLE CAPS SENTENCE.',
  };
}

/** Throw on any field that would fail v0.2 validation downstream. */
export function validateFields(fields) {
  const len = String(fields.one_liner).length;
  if (len < ONE_LINER_MIN || len > ONE_LINER_MAX) {
    throw new Error(`one_liner must be ${ONE_LINER_MIN}-${ONE_LINER_MAX} chars (got ${len})`);
  }
  if (!VERSION_REGEX.test(String(fields.version_added))) {
    throw new Error(`version_added must match X.Y.Z (got "${fields.version_added}")`);
  }
  if (String(fields.emoji).trim().length === 0) {
    throw new Error('emoji must be a non-empty string');
  }
  return fields;
}

/**
 * Render the YAML text for one `core` entry, indented 2 spaces (so it nests
 * directly under `core:`). Field order mirrors existing catalog entries.
 */
export function buildSkillEntry(name, fields) {
  const lines = [
    `  ${name}:`,
    `    name: ${name}`,
    `    title: ${sq(fields.title)}`,
    `    description: ${sq(fields.description)}`,
    `    purpose: ${sq(fields.purpose)}`,
    `    when_to_use:`,
    ...fields.when_to_use.map((x) => `      - ${sq(x)}`),
    `    when_not_to_use:`,
    ...fields.when_not_to_use.map((x) => `      - ${sq(x)}`),
    `    examples:`,
    ...fields.examples.flatMap((ex) => [
      `      - command: ${sq(ex.command)}`,
      `        description: ${sq(ex.description)}`,
    ]),
    `    related: []`,
    `    tags: [core]`,
    `    ide_compatibility: [claude-code, gemini, cursor]`,
    `    requires_args: false`,
    `    mutates_repo: false`,
    `    network_required: false`,
    `    one_liner: ${sq(fields.one_liner)}`,
    `    emoji: ${sq(fields.emoji)}`,
    `    version_added: ${sq(fields.version_added)}`,
    `    schema_version: '0.2'`,
    `    iron_law: ${sq(fields.iron_law)}`,
  ];
  return lines.join('\n');
}

/**
 * Insert `entryText` as the last child of `core:` — append at end of file
 * (catalog is core-only after modules removal). Trailing whitespace is
 * normalized to a single blank line so the diff is purely the added entry.
 */
export function insertEntry(catalogText, entryText) {
  return `${catalogText.replace(/\s*$/, '')}\n${entryText}\n`;
}

/** Skill body skeleton. MUST contain a `## Iron Law` section (gate requires it). */
export function buildSkillBody(name, fields) {
  return [
    `${fields.purpose.replace(/^TODO:\s*/, 'TODO — ')}`,
    '',
    'If {{ARG_VAR}} is provided, parse and act on it. (TODO: describe argument',
    'handling, or delete this paragraph if the skill takes no arguments.)',
    '',
    '## Iron Law',
    '',
    fields.iron_law ||
      'TODO: STATE THE ONE NON-NEGOTIABLE RULE FOR THIS SKILL AS A SINGLE CAPS SENTENCE.',
    '',
    'TODO: Explain why this law matters and exactly how to apply it. The README and',
    'the per-skill doc extract this section, so keep it tight and self-contained.',
    '',
    '## When to use',
    '',
    `TODO: bullet the situations the \`${name}\` skill is for.`,
    '',
    '## Steps',
    '',
    '1. TODO: first step.',
    '2. TODO: second step.',
    '',
  ].join('\n');
}

/**
 * Plan a new core skill from the current catalog text. Pure: returns the new
 * catalog text + body path/text without touching disk. Throws if the name is
 * invalid or already present in the catalog.
 */
export function planScaffold({ catalogText, name, pkgVersion, overrides = {} }) {
  validateName(name);

  const data = parse(catalogText);
  const existing = new Set(collectSkills(data).map((s) => s.key));
  if (existing.has(name)) {
    throw new Error(`skill "${name}" already exists in the catalog`);
  }

  const fields = validateFields({ ...defaultFields(name, pkgVersion), ...overrides });
  const entryText = buildSkillEntry(name, fields);

  return {
    catalogText: insertEntry(catalogText, entryText),
    bodyRelPath: `core/${name}.md`,
    bodyText: buildSkillBody(name, fields),
    fields,
  };
}
