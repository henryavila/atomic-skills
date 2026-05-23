/**
 * Pure-function validator for `meta/skills.yaml`. Consumed by
 * `scripts/validate-skills.js` (CLI) and `tests/validate-skills.test.js`.
 *
 * Supports schema v0.1 (legacy) and v0.2 (canonical). The v0.2 hard cut
 * happens after Phase C of the catalog migration (see
 * docs/plan-skills-catalog-v0.2.md).
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

export const ACCEPTED_SCHEMA_VERSIONS = new Set(['0.2']);
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

  validateSubcommands(entry, issues);
  validateArgs(entry, issues);
  validateOutputArtifacts(entry, issues);
  validateDependencies(entry, issues);
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
 *     Deferred to Phase C; off by default during the v0.2 migration.
 */
export function runCrossChecks(skills, skillsDir, options = {}) {
  const failures = []; // [{location, issues[]}]
  const requireIronLaw = options.requireIronLaw === true;

  const bodySkills = discoverBodySkills(skillsDir);
  const bodyByLocation = new Map(bodySkills.map((b) => [b.location, b]));
  const seenCatalogLocations = new Set();

  for (const skill of skills) {
    const issues = [];
    const bodyPath = bodyPathForSkill(skill, skillsDir);
    seenCatalogLocations.add(skill.location);

    if (!existsSync(bodyPath)) {
      issues.push(`skill body missing on disk: ${bodyPath}`);
    } else if (requireIronLaw) {
      const body = readFileSync(bodyPath, 'utf8');
      if (!/^## Iron Law\b/m.test(body)) {
        issues.push(`skill body missing canonical \`## Iron Law\` section: ${bodyPath}`);
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
 * Validate the entire catalog. Returns a structured report:
 *   { totalSkills, totalIssues, failedSkills, failures, versionsSeen, parseError }
 *
 * Options:
 *   - skillsDir: where to look for skill bodies (defaults to disabling cross-checks)
 *   - requireIronLaw: forwarded to runCrossChecks (Phase C gate)
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
    report.parseError = 'skills.yaml root is not an object';
    return report;
  }

  const skills = collectSkills(data);
  if (skills.length === 0) {
    report.parseError = 'no skill entries found in skills.yaml';
    return report;
  }

  report.totalSkills = skills.length;
  const knownNames = new Set(skills.map((s) => s.key));

  const perSkillFailures = new Map(); // location -> { location, issues[] }

  for (const skill of skills) {
    const issues = validateSkill(skill.key, skill.entry, knownNames);
    if (skill.entry?.schema_version) {
      report.versionsSeen.add(skill.entry.schema_version);
    }
    if (issues.length > 0) {
      perSkillFailures.set(skill.location, { location: skill.location, issues });
    }
  }

  if (options.skillsDir) {
    const crossFailures = runCrossChecks(skills, options.skillsDir, options);
    for (const cf of crossFailures) {
      if (perSkillFailures.has(cf.location)) {
        perSkillFailures.get(cf.location).issues.push(...cf.issues);
      } else {
        perSkillFailures.set(cf.location, cf);
      }
    }
  }

  report.failures = [...perSkillFailures.values()];
  report.failedSkills = report.failures.length;
  report.totalIssues = report.failures.reduce((sum, f) => sum + f.issues.length, 0);
  return report;
}
