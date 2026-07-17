/**
 * Pure-function validator for `meta/catalog.yaml`. Consumed by
 * `scripts/validate-skills.js` (CLI) and `tests/validate-skills.test.js`.
 *
 * Supports skill schema_version v0.2 (canonical; v0.1 hard-cut). Catalog root
 * `version` accepts 0.2 (legacy) and 0.3 (product + iron_law fields). See
 * docs/kb/skill-frontmatter-spec.md and product-docs-site design D2.
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { extractIronLawFromBody, normalizeIronLaw } from './extract-iron-law.js';

export const ACCEPTED_SCHEMA_VERSIONS = new Set(['0.2']);
export const ACCEPTED_CATALOG_VERSIONS = new Set(['0.2', '0.3']);
/** Catalog root versions that require iron_law + product positioning. */
export const CATALOG_VERSIONS_REQUIRING_PRODUCT = new Set(['0.3']);
export const KNOWN_IDES = new Set([
  'claude-code',
  'gemini',
  'cursor',
  'codex',
  'opencode',
  'github-copilot',
  'generic',
]);

const V01_REQUIRED = [
  'name',
  'title',
  'description',
  'purpose',
  'when_to_use',
  'when_not_to_use',
  'examples',
  'schema_version',
];

const V02_REQUIRED_EXTRA = ['one_liner', 'emoji', 'version_added'];

const OPTIONAL_BOOLEAN_FIELDS = ['requires_args', 'mutates_repo', 'network_required'];
const OPTIONAL_ARRAY_FIELDS = ['related', 'tags', 'ide_compatibility'];

const VERSION_REGEX = /^\d+\.\d+\.\d+$/;
const SUBCMD_NAME_REGEX = /^[a-z][a-z0-9-]*$/;
const ARG_KINDS = new Set(['positional', 'flag', 'option']);

function validateExamples(entry, issues) {
  if (entry.examples === undefined) return;
  if (!Array.isArray(entry.examples) || entry.examples.length === 0) {
    issues.push('examples must be a non-empty array');
    return;
  }
  entry.examples.forEach((ex, i) => {
    if (ex == null || typeof ex !== 'object') {
      issues.push(`examples[${i}] must be an object`);
      return;
    }
    if (!ex.command || typeof ex.command !== 'string') {
      issues.push(`examples[${i}].command is required and must be a string`);
    }
    if (!ex.description || typeof ex.description !== 'string') {
      issues.push(`examples[${i}].description is required and must be a string`);
    }
  });
}

function validateUsageArrays(entry, issues) {
  for (const field of ['when_to_use', 'when_not_to_use']) {
    if (entry[field] === undefined) continue;
    if (!Array.isArray(entry[field]) || entry[field].length === 0) {
      issues.push(`${field} must be a non-empty array`);
    } else if (!entry[field].every((x) => typeof x === 'string' && x.trim().length > 0)) {
      issues.push(`${field} entries must be non-empty strings`);
    }
  }
}

function validateOptionalCommon(entry, knownNames, issues) {
  for (const field of OPTIONAL_BOOLEAN_FIELDS) {
    if (field in entry && typeof entry[field] !== 'boolean') {
      issues.push(`${field} must be a boolean (got ${typeof entry[field]})`);
    }
  }

  for (const field of OPTIONAL_ARRAY_FIELDS) {
    if (field in entry && !Array.isArray(entry[field])) {
      issues.push(`${field} must be an array (got ${typeof entry[field]})`);
    }
  }

  if (Array.isArray(entry.ide_compatibility)) {
    for (const ide of entry.ide_compatibility) {
      if (!KNOWN_IDES.has(ide)) {
        issues.push(
          `ide_compatibility contains unknown IDE "${ide}" ` +
            `(allowed: ${[...KNOWN_IDES].join(', ')})`
        );
      }
    }
  }

  if (Array.isArray(entry.related)) {
    for (const rel of entry.related) {
      if (!knownNames.has(rel)) {
        issues.push(`related references unknown skill "${rel}"`);
      }
    }
  }
}

/**
 * Validate catalog `iron_law` field on a skill entry.
 * @param {object} entry
 * @param {string[]} issues
 * @param {{ required?: boolean }} [options] - when required, missing/empty fails
 */
export function validateIronLawField(entry, issues, options = {}) {
  const required = options.required === true;
  if (!('iron_law' in entry) || entry.iron_law === undefined) {
    if (required) {
      issues.push('missing required field: iron_law');
    }
    return;
  }
  if (typeof entry.iron_law !== 'string') {
    issues.push(`iron_law must be a string (got ${typeof entry.iron_law})`);
    return;
  }
  if (entry.iron_law.trim().length === 0) {
    issues.push('iron_law must be a non-empty string');
  }
}

/**
 * Validate top-level `product:` positioning block (catalog v0.3+).
 * Required fields: what_is (string), what_is_not (non-empty string[]),
 * docs_url (string), install.primary (string).
 */
export function validateProductBlock(data, options = {}) {
  const issues = [];
  const required = options.required === true;
  if (!data || data.product === undefined) {
    if (required) {
      issues.push('missing required root field: product');
    }
    return issues;
  }
  const product = data.product;
  if (product === null || typeof product !== 'object' || Array.isArray(product)) {
    issues.push('product must be an object');
    return issues;
  }

  if (typeof product.what_is !== 'string' || product.what_is.trim().length === 0) {
    issues.push('product.what_is is required and must be a non-empty string');
  }

  if (!Array.isArray(product.what_is_not)) {
    issues.push('product.what_is_not is required and must be a non-empty array of strings');
  } else if (product.what_is_not.length === 0) {
    issues.push('product.what_is_not must be a non-empty array of strings');
  } else if (!product.what_is_not.every((x) => typeof x === 'string' && x.trim().length > 0)) {
    issues.push('product.what_is_not entries must be non-empty strings');
  }

  if (typeof product.docs_url !== 'string' || product.docs_url.trim().length === 0) {
    issues.push('product.docs_url is required and must be a non-empty string');
  }

  if (
    product.install === null ||
    typeof product.install !== 'object' ||
    Array.isArray(product.install)
  ) {
    issues.push('product.install is required and must be an object with primary');
  } else if (
    typeof product.install.primary !== 'string' ||
    product.install.primary.trim().length === 0
  ) {
    issues.push('product.install.primary is required and must be a non-empty string');
  }

  return issues;
}

function validateV02Fields(entry, issues) {
  for (const field of V02_REQUIRED_EXTRA) {
    if (!(field in entry)) {
      issues.push(`missing required v0.2 field: ${field}`);
    }
  }

  if (typeof entry.one_liner === 'string') {
    const len = entry.one_liner.length;
    if (len < 10 || len > 80) {
      issues.push(`one_liner must be 10-80 chars (got ${len})`);
    }
  } else if ('one_liner' in entry) {
    issues.push('one_liner must be a string');
  }

  if (typeof entry.emoji === 'string') {
    if (entry.emoji.trim().length === 0) {
      issues.push('emoji must be a non-empty string');
    }
  } else if ('emoji' in entry) {
    issues.push('emoji must be a string');
  }

  if (typeof entry.version_added === 'string') {
    if (!VERSION_REGEX.test(entry.version_added)) {
      issues.push(`version_added must match \`X.Y.Z\` (got "${entry.version_added}")`);
    }
  } else if ('version_added' in entry) {
    issues.push('version_added must be a string');
  }

  // iron_law is optional at the skill-schema level; catalog root v0.3 makes it
  // required via validateCatalog. Always type-check when present.
  validateIronLawField(entry, issues, { required: false });

  validateArgumentHint(entry, issues);
  validateSubcommands(entry, issues);
  validateArgs(entry, issues);
  validateOutputArtifacts(entry, issues);
  validateDependencies(entry, issues);
}

function validateArgumentHint(entry, issues) {
  if (!('argument_hint' in entry)) return;
  if (typeof entry.argument_hint !== 'string') {
    issues.push(`argument_hint must be a string (got ${typeof entry.argument_hint})`);
    return;
  }
  if (entry.argument_hint.trim().length === 0) {
    issues.push('argument_hint must be a non-empty string');
  }
  // Composer placeholder: Claude Code renders the hint inline in the input box and
  // long hints clip/truncate (anthropics/claude-code#59644), so a full subcommand
  // dump is unusable. Curate (grammar-order prefix + ellipsis) instead of dumping.
  if (entry.argument_hint.length > 120) {
    issues.push(
      `argument_hint must be at most 120 chars (got ${entry.argument_hint.length}) — curate to the leading subcommands in grammar order + ellipsis`
    );
  }
}

function validateSubcommands(entry, issues) {
  if (!('subcommands' in entry)) return;
  if (!Array.isArray(entry.subcommands)) {
    issues.push('subcommands must be an array');
    return;
  }

  const seenNames = new Set();
  const skillName = entry.name;

  entry.subcommands.forEach((sub, i) => {
    if (sub == null || typeof sub !== 'object') {
      issues.push(`subcommands[${i}] must be an object`);
      return;
    }
    if (typeof sub.name !== 'string' || sub.name.trim().length === 0) {
      issues.push(`subcommands[${i}].name is required and must be a non-empty string`);
    } else if (!SUBCMD_NAME_REGEX.test(sub.name)) {
      issues.push(
        `subcommands[${i}].name "${sub.name}" must be kebab-case (^[a-z][a-z0-9-]*$)`
      );
    } else if (seenNames.has(sub.name)) {
      issues.push(`subcommands[${i}].name "${sub.name}" is duplicated within this skill`);
    } else {
      seenNames.add(sub.name);
    }

    if (typeof sub.signature !== 'string') {
      issues.push(`subcommands[${i}].signature is required and must be a string`);
    }
    if (typeof sub.description !== 'string' || sub.description.trim().length === 0) {
      issues.push(
        `subcommands[${i}].description is required and must be a non-empty string`
      );
    }
    if (typeof sub.example !== 'string' || sub.example.trim().length === 0) {
      issues.push(`subcommands[${i}].example is required and must be a non-empty string`);
    } else {
      const expectedPrefix = `/atomic-skills:${skillName}`;
      if (!sub.example.startsWith(expectedPrefix)) {
        issues.push(
          `subcommands[${i}].example must start with "${expectedPrefix}" ` +
            `(got "${sub.example}")`
        );
      }
    }
  });
}

function validateArgs(entry, issues) {
  if (!('args' in entry)) return;
  if (!Array.isArray(entry.args)) {
    issues.push('args must be an array');
    return;
  }

  entry.args.forEach((arg, i) => {
    if (arg == null || typeof arg !== 'object') {
      issues.push(`args[${i}] must be an object`);
      return;
    }
    if (typeof arg.name !== 'string' || arg.name.trim().length === 0) {
      issues.push(`args[${i}].name is required and must be a non-empty string`);
    }
    if (typeof arg.kind !== 'string' || !ARG_KINDS.has(arg.kind)) {
      issues.push(
        `args[${i}].kind must be one of ${[...ARG_KINDS].join(', ')} (got "${arg.kind}")`
      );
    }
    if (typeof arg.required !== 'boolean') {
      issues.push(`args[${i}].required is required and must be a boolean`);
    }
    if (typeof arg.description !== 'string' || arg.description.trim().length === 0) {
      issues.push(`args[${i}].description is required and must be a non-empty string`);
    }
    if ('default' in arg && typeof arg.default !== 'string') {
      issues.push(`args[${i}].default must be a string (prose description of the default)`);
    }
  });
}

function validateOutputArtifacts(entry, issues) {
  if (!('output_artifacts' in entry)) return;
  if (!Array.isArray(entry.output_artifacts)) {
    issues.push('output_artifacts must be an array');
    return;
  }
  entry.output_artifacts.forEach((item, i) => {
    if (typeof item !== 'string' || item.trim().length === 0) {
      issues.push(`output_artifacts[${i}] must be a non-empty string`);
    }
  });
}

function validateDependencies(entry, issues) {
  if (!('dependencies' in entry)) return;
  if (!Array.isArray(entry.dependencies)) {
    issues.push('dependencies must be an array');
    return;
  }
  entry.dependencies.forEach((item, i) => {
    if (typeof item !== 'string' || item.trim().length === 0) {
      issues.push(`dependencies[${i}] must be a non-empty string`);
    }
  });
}

/**
 * Validate a single skill entry against the requested schema version.
 * Returns an array of issue messages (empty = valid).
 */
export function validateSkill(key, entry, knownNames) {
  const issues = [];

  if (entry == null || typeof entry !== 'object') {
    issues.push(`entry is not an object (got ${typeof entry})`);
    return issues;
  }

  for (const field of V01_REQUIRED) {
    if (!(field in entry)) {
      issues.push(`missing required field: ${field}`);
    }
  }

  if (entry.name && entry.name !== key) {
    issues.push(`name "${entry.name}" must match the YAML key "${key}"`);
  }

  if (entry.schema_version && !ACCEPTED_SCHEMA_VERSIONS.has(entry.schema_version)) {
    issues.push(
      `unsupported schema_version "${entry.schema_version}" ` +
        `(accepted: ${[...ACCEPTED_SCHEMA_VERSIONS].join(', ')})`
    );
  }

  validateUsageArrays(entry, issues);
  validateExamples(entry, issues);
  validateOptionalCommon(entry, knownNames, issues);

  if (entry.schema_version === '0.2') {
    validateV02Fields(entry, issues);
  }

  return issues;
}

/**
 * Walk the catalog tree and produce a list of {key, entry, location} records.
 */
export function collectSkills(data) {
  const skills = [];
  if (data?.core && typeof data.core === 'object') {
    for (const [key, entry] of Object.entries(data.core)) {
      skills.push({ key, entry, location: `core.${key}`, modulePath: null });
    }
  }
  if (data?.modules && typeof data.modules === 'object') {
    for (const [modName, modEntries] of Object.entries(data.modules)) {
      if (modEntries == null || typeof modEntries !== 'object') continue;
      for (const [key, entry] of Object.entries(modEntries)) {
        skills.push({
          key,
          entry,
          location: `modules.${modName}.${key}`,
          modulePath: modName,
        });
      }
    }
  }
  return skills;
}

/**
 * Compute the expected `.md` body path for a skill.
 *   core.X      → <skillsDir>/core/X.md
 *   modules.M.X → <skillsDir>/modules/M/X.md
 */
export function bodyPathForSkill(skill, skillsDir) {
  if (skill.modulePath) {
    return join(skillsDir, 'modules', skill.modulePath, `${skill.key}.md`);
  }
  return join(skillsDir, 'core', `${skill.key}.md`);
}

/**
 * Walk `<skillsDir>/{core,modules/*}/` and return the set of body filenames
 * stripped to skill names. Used for the inverse cross-check (body without
 * catalog entry).
 */
export function discoverBodySkills(skillsDir) {
  const found = []; // [{name, location, file}]
  if (!existsSync(skillsDir)) return found;

  const coreDir = join(skillsDir, 'core');
  if (existsSync(coreDir)) {
    for (const f of readdirSync(coreDir)) {
      if (f.endsWith('.md')) {
        found.push({ name: f.slice(0, -3), location: `core.${f.slice(0, -3)}`, file: join(coreDir, f) });
      }
    }
  }

  const modulesDir = join(skillsDir, 'modules');
  if (existsSync(modulesDir)) {
    for (const mod of readdirSync(modulesDir)) {
      const modPath = join(modulesDir, mod);
      if (!statSync(modPath).isDirectory()) continue;
      for (const f of readdirSync(modPath)) {
        if (f.endsWith('.md')) {
          found.push({
            name: f.slice(0, -3),
            location: `modules.${mod}.${f.slice(0, -3)}`,
            file: join(modPath, f),
          });
        }
      }
    }
  }

  return found;
}

/**
 * Cross-checks that span the whole catalog + on-disk body tree.
 * Issues are appended to each skill's issue list when scoped, or pushed to a
 * synthetic `__catalog__` location when global.
 *
 * Options:
 *   - requireIronLaw: when true, fail on bodies missing `^## Iron Law`.
 *   - crossCheckIronLaw: when true, if body has `## Iron Law` and catalog
 *     declares `iron_law`, assert they match (whitespace-normalized). Catalog
 *     is the product SSOT; the body must not silently diverge (design D2).
 */
export function runCrossChecks(skills, skillsDir, options = {}) {
  const failures = []; // [{location, issues[]}]
  const requireIronLaw = options.requireIronLaw === true;
  const crossCheckIronLaw = options.crossCheckIronLaw === true;

  const bodySkills = discoverBodySkills(skillsDir);
  const seenCatalogLocations = new Set();

  for (const skill of skills) {
    const issues = [];
    const bodyPath = bodyPathForSkill(skill, skillsDir);
    seenCatalogLocations.add(skill.location);

    if (!existsSync(bodyPath)) {
      issues.push(`skill body missing on disk: ${bodyPath}`);
    } else {
      const body = readFileSync(bodyPath, 'utf8');
      if (requireIronLaw && !/^## Iron Law\b/m.test(body)) {
        issues.push(`skill body missing canonical \`## Iron Law\` section: ${bodyPath}`);
      }
      if (crossCheckIronLaw) {
        const catalogLaw =
          typeof skill.entry?.iron_law === 'string' ? skill.entry.iron_law : null;
        const bodyLaw = extractIronLawFromBody(body);
        if (catalogLaw != null && bodyLaw != null) {
          const a = normalizeIronLaw(catalogLaw);
          const b = normalizeIronLaw(bodyLaw);
          if (a !== b) {
            issues.push(
              `iron_law mismatch: catalog "${a}" !== body "${b}" (${bodyPath})`
            );
          }
        }
      }
    }

    if (issues.length > 0) {
      failures.push({ location: skill.location, issues });
    }
  }

  // Inverse check: bodies without catalog entries.
  for (const body of bodySkills) {
    if (!seenCatalogLocations.has(body.location)) {
      failures.push({
        location: body.location,
        issues: [`body exists on disk without a catalog entry: ${body.file}`],
      });
    }
  }

  return failures;
}

/**
 * Lint README.md for `atomic-skills:<name>` mentions that don't resolve to
 * any catalog entry. Catches drift in static prose (release notes, module
 * descriptions) that the marker-bounded generator can't see.
 *
 * Returns an array of issue strings (empty = no drift).
 */
export function validateReadmeMentions(readmeText, knownSkillNames) {
  if (typeof readmeText !== 'string' || readmeText.length === 0) return [];
  const mentions = new Map(); // name -> [lineNumbers]
  const lines = readmeText.split('\n');
  const re = /\batomic-skills:([a-z][a-z0-9-]*)\b/g;
  for (let i = 0; i < lines.length; i++) {
    let match;
    re.lastIndex = 0;
    while ((match = re.exec(lines[i])) !== null) {
      const name = match[1];
      if (!mentions.has(name)) mentions.set(name, []);
      mentions.get(name).push(i + 1);
    }
  }

  const issues = [];
  for (const [name, lineNos] of mentions) {
    if (!knownSkillNames.has(name)) {
      const locs = lineNos.slice(0, 3).join(', ');
      const more = lineNos.length > 3 ? ` (+${lineNos.length - 3} more)` : '';
      issues.push(
        `README mentions unknown skill "atomic-skills:${name}" at line(s) ${locs}${more}`
      );
    }
  }
  return issues;
}

/**
 * Cross-check `module_meta` documentation block against the canonical
 * `modules` block. Every `module_meta` key must correspond to a real module
 * (no orphan docs) and every module must have docs (no missing entry that
 * would silently disappear from the rendered README).
 */
export function validateModuleMeta(data) {
  const issues = [];
  const moduleKeys = data?.modules && typeof data.modules === 'object'
    ? new Set(Object.keys(data.modules))
    : new Set();

  if (data?.module_meta === undefined) {
    if (moduleKeys.size > 0) {
      issues.push(
        `module_meta block missing from catalog.yaml; cannot render README ` +
        `Modules section (${moduleKeys.size} module(s) without docs)`
      );
    }
    return issues;
  }
  if (data.module_meta == null || typeof data.module_meta !== 'object') {
    issues.push('module_meta must be a mapping of moduleKey → {title, intro, ...}');
    return issues;
  }

  const metaKeys = new Set(Object.keys(data.module_meta));

  for (const orphan of [...metaKeys].filter((k) => !moduleKeys.has(k))) {
    issues.push(`module_meta.${orphan} has no matching entry under modules`);
  }
  for (const undocumented of [...moduleKeys].filter((k) => !metaKeys.has(k))) {
    issues.push(`modules.${undocumented} has no module_meta entry (would disappear from README)`);
  }

  for (const [key, meta] of Object.entries(data.module_meta)) {
    if (meta == null || typeof meta !== 'object') {
      issues.push(`module_meta.${key} must be an object`);
      continue;
    }
    if (typeof meta.title !== 'string' || meta.title.trim().length === 0) {
      issues.push(`module_meta.${key}.title is required (non-empty string)`);
    }
    if (typeof meta.intro !== 'string' || meta.intro.trim().length === 0) {
      issues.push(`module_meta.${key}.intro is required (non-empty string)`);
    }
    if ('version_added' in meta && (typeof meta.version_added !== 'string' || !VERSION_REGEX.test(meta.version_added))) {
      issues.push(`module_meta.${key}.version_added must match \`X.Y.Z\``);
    }
    if ('features' in meta) {
      if (!Array.isArray(meta.features) || meta.features.some((f) => typeof f !== 'string')) {
        issues.push(`module_meta.${key}.features must be an array of strings`);
      }
    }
    if ('notes' in meta && typeof meta.notes !== 'string') {
      issues.push(`module_meta.${key}.notes must be a string`);
    }
  }

  return issues;
}

/**
 * F-003 (codex review 2026-05-24): validate the top-level `version` field
 * declared at the root of catalog.yaml. Required, must be a string, must
 * be in ACCEPTED_CATALOG_VERSIONS. Catches typos and unsupported root
 * formats before downstream generators consume the file.
 */
export function validateCatalogVersion(data) {
  const issues = [];
  if (data == null || typeof data !== 'object') return issues;
  if (!('version' in data)) {
    issues.push("missing required root field: version (expected e.g. '0.2')");
    return issues;
  }
  if (typeof data.version !== 'string') {
    issues.push(`root version must be a string (got ${typeof data.version})`);
    return issues;
  }
  if (!ACCEPTED_CATALOG_VERSIONS.has(data.version)) {
    issues.push(
      `unsupported root version "${data.version}" ` +
      `(accepted: ${[...[...ACCEPTED_CATALOG_VERSIONS].sort()].join(', ')})`
    );
  }
  return issues;
}

/**
 * S2 (review 2026-05-24): validate the optional `release_highlight` block.
 * When present, must be an object with a non-empty string `body`. Catches
 * garbage like `{body: 42}` before the renderer throws.
 */
export function validateReleaseHighlight(data) {
  const issues = [];
  if (!data || data.release_highlight === undefined) return issues;
  const rh = data.release_highlight;
  if (rh === null || typeof rh !== 'object' || Array.isArray(rh)) {
    issues.push('release_highlight must be an object with a `body` field');
    return issues;
  }
  if (!('body' in rh)) {
    issues.push('release_highlight.body is required');
    return issues;
  }
  if (typeof rh.body !== 'string') {
    issues.push(`release_highlight.body must be a string (got ${typeof rh.body})`);
    return issues;
  }
  if (rh.body.trim().length === 0) {
    issues.push('release_highlight.body must be a non-empty string');
  }
  return issues;
}

/**
 * Validate the entire catalog. Returns a structured report:
 *   { totalSkills, totalIssues, failedSkills, failures, versionsSeen, parseError }
 *
 * Options:
 *   - skillsDir: where to look for skill bodies (defaults to disabling cross-checks)
 *   - requireIronLaw: forwarded to runCrossChecks (body `## Iron Law` section)
 *   - requireIronLawField: require non-empty catalog `iron_law` on every skill
 *   - requireProduct: require + validate top-level `product` block
 *   - crossCheckIronLaw: catalog iron_law must match body first line (D2)
 *   - When root `version` is in CATALOG_VERSIONS_REQUIRING_PRODUCT (0.3),
 *     iron_law field + product block are required automatically.
 */
export function validateCatalog(data, options = {}) {
  const report = {
    totalSkills: 0,
    totalIssues: 0,
    failedSkills: 0,
    failures: [], // [{location, issues[]}]
    versionsSeen: new Set(),
    parseError: null,
  };

  if (data == null || typeof data !== 'object') {
    report.parseError = 'catalog.yaml root is not an object';
    return report;
  }

  const skills = collectSkills(data);
  if (skills.length === 0) {
    report.parseError = 'no skill entries found in catalog.yaml';
    return report;
  }

  const catalogNeedsProduct =
    typeof data.version === 'string' &&
    CATALOG_VERSIONS_REQUIRING_PRODUCT.has(data.version);
  const requireIronLawField =
    options.requireIronLawField === true || catalogNeedsProduct;
  const requireProduct = options.requireProduct === true || catalogNeedsProduct;
  // Default cross-check on when product SSOT catalog is in use (v0.3+).
  const crossCheckIronLaw =
    options.crossCheckIronLaw !== undefined
      ? options.crossCheckIronLaw === true
      : catalogNeedsProduct;

  report.totalSkills = skills.length;
  const knownNames = new Set(skills.map((s) => s.key));

  const perSkillFailures = new Map(); // location -> { location, issues[] }

  for (const skill of skills) {
    // validateSkill type-checks iron_law when present (required:false).
    // Catalog v0.3 / requireIronLawField only needs an extra check for missing.
    const issues = validateSkill(skill.key, skill.entry, knownNames);
    if (
      requireIronLawField &&
      (skill.entry == null ||
        !('iron_law' in skill.entry) ||
        skill.entry.iron_law === undefined)
    ) {
      issues.push('missing required field: iron_law');
    }
    if (skill.entry?.schema_version) {
      report.versionsSeen.add(skill.entry.schema_version);
    }
    if (issues.length > 0) {
      perSkillFailures.set(skill.location, { location: skill.location, issues });
    }
  }

  if (options.skillsDir) {
    const crossFailures = runCrossChecks(skills, options.skillsDir, {
      ...options,
      crossCheckIronLaw,
    });
    for (const cf of crossFailures) {
      if (perSkillFailures.has(cf.location)) {
        perSkillFailures.get(cf.location).issues.push(...cf.issues);
      } else {
        perSkillFailures.set(cf.location, cf);
      }
    }
  }

  if (options.requireModuleMeta) {
    const moduleMetaIssues = validateModuleMeta(data);
    if (moduleMetaIssues.length > 0) {
      perSkillFailures.set('__module_meta__', {
        location: '__module_meta__',
        issues: moduleMetaIssues,
      });
    }
  }

  // F-003 (codex review): opt-in (CLI sets requireCatalogVersion: true;
  // tests default off so synthetic fixtures don't need the root field).
  if (options.requireCatalogVersion) {
    const versionIssues = validateCatalogVersion(data);
    if (versionIssues.length > 0) {
      perSkillFailures.set('__catalog_version__', {
        location: '__catalog_version__',
        issues: versionIssues,
      });
    }
  }

  // S2 (review): release_highlight is always validated when present;
  // absent is fine (renders no version note).
  const releaseHighlightIssues = validateReleaseHighlight(data);
  if (releaseHighlightIssues.length > 0) {
    perSkillFailures.set('__release_highlight__', {
      location: '__release_highlight__',
      issues: releaseHighlightIssues,
    });
  }

  const productIssues = validateProductBlock(data, { required: requireProduct });
  if (productIssues.length > 0) {
    perSkillFailures.set('__product__', {
      location: '__product__',
      issues: productIssues,
    });
  }

  report.failures = [...perSkillFailures.values()];
  report.failedSkills = report.failures.length;
  report.totalIssues = report.failures.reduce((sum, f) => sum + f.issues.length, 0);
  return report;
}
