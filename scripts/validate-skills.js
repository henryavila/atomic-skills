#!/usr/bin/env node
/**
 * Validate meta/skills.yaml against the schema described in
 * docs/kb/skill-frontmatter-spec.md.
 *
 * Exit codes:
 *   0 — all skills valid
 *   1 — one or more validation errors
 *   2 — file/parse error
 *
 * Usage: node scripts/validate-skills.js [path/to/skills.yaml]
 */

import { readFileSync, existsSync } from 'node:fs';
import { parse } from 'yaml';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_PATH = join(__dirname, '..', 'meta', 'skills.yaml');

const SCHEMA_VERSION = '0.1';
const KNOWN_IDES = new Set(['claude-code', 'gemini', 'cursor', 'codex', 'opencode', 'github-copilot', 'generic']);

const REQUIRED_FIELDS = [
  'name',
  'title',
  'description',
  'purpose',
  'when_to_use',
  'when_not_to_use',
  'examples',
  'schema_version',
];

const OPTIONAL_BOOLEAN_FIELDS = ['requires_args', 'mutates_repo', 'network_required'];
const OPTIONAL_ARRAY_FIELDS = ['related', 'tags', 'ide_compatibility'];

/**
 * Collect validation issues for a single skill.
 * @param {string} key - skill key in skills.yaml
 * @param {object} entry - parsed YAML entry
 * @param {Set<string>} knownNames - all skill names (for related cross-check)
 * @returns {string[]} list of issue messages
 */
function validateSkill(key, entry, knownNames) {
  const issues = [];

  if (entry == null || typeof entry !== 'object') {
    issues.push(`entry is not an object (got ${typeof entry})`);
    return issues;
  }

  for (const field of REQUIRED_FIELDS) {
    if (!(field in entry)) {
      issues.push(`missing required field: ${field}`);
    }
  }

  if (entry.name && entry.name !== key) {
    issues.push(`name "${entry.name}" must match the YAML key "${key}"`);
  }

  if (entry.schema_version && entry.schema_version !== SCHEMA_VERSION) {
    issues.push(`unsupported schema_version "${entry.schema_version}" (expected "${SCHEMA_VERSION}")`);
  }

  if (entry.when_to_use !== undefined) {
    if (!Array.isArray(entry.when_to_use) || entry.when_to_use.length === 0) {
      issues.push('when_to_use must be a non-empty array');
    } else if (!entry.when_to_use.every((x) => typeof x === 'string' && x.trim().length > 0)) {
      issues.push('when_to_use entries must be non-empty strings');
    }
  }

  if (entry.when_not_to_use !== undefined) {
    if (!Array.isArray(entry.when_not_to_use) || entry.when_not_to_use.length === 0) {
      issues.push('when_not_to_use must be a non-empty array');
    } else if (!entry.when_not_to_use.every((x) => typeof x === 'string' && x.trim().length > 0)) {
      issues.push('when_not_to_use entries must be non-empty strings');
    }
  }

  if (entry.examples !== undefined) {
    if (!Array.isArray(entry.examples) || entry.examples.length === 0) {
      issues.push('examples must be a non-empty array');
    } else {
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
  }

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
        issues.push(`ide_compatibility contains unknown IDE "${ide}" (allowed: ${[...KNOWN_IDES].join(', ')})`);
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

  return issues;
}

function main() {
  const filePath = process.argv[2] || DEFAULT_PATH;

  if (!existsSync(filePath)) {
    console.error(`ERROR: file not found: ${filePath}`);
    process.exit(2);
  }

  let raw;
  let data;
  try {
    raw = readFileSync(filePath, 'utf8');
    data = parse(raw);
  } catch (err) {
    console.error(`ERROR: failed to parse YAML: ${err.message}`);
    process.exit(2);
  }

  if (data == null || typeof data !== 'object') {
    console.error('ERROR: skills.yaml root is not an object');
    process.exit(2);
  }

  // Collect all skill entries (core + modules.*).
  // Build the set of known names BEFORE validating, so `related` cross-refs work.
  const skills = []; // [{key, entry, location}]
  if (data.core && typeof data.core === 'object') {
    for (const [key, entry] of Object.entries(data.core)) {
      skills.push({ key, entry, location: `core.${key}` });
    }
  }
  if (data.modules && typeof data.modules === 'object') {
    for (const [modName, modEntries] of Object.entries(data.modules)) {
      if (modEntries == null || typeof modEntries !== 'object') continue;
      // Empty module placeholders (e.g., codex-bridge: {}) iterate as zero
      // entries — naturally skipped without special-casing.
      // For non-empty modules, EVERY child must validate: surface non-objects
      // and missing fields via validateSkill rather than silently skipping.
      for (const [key, entry] of Object.entries(modEntries)) {
        skills.push({ key, entry, location: `modules.${modName}.${key}` });
      }
    }
  }

  if (skills.length === 0) {
    console.error('ERROR: no skill entries found in skills.yaml');
    process.exit(2);
  }

  const knownNames = new Set(skills.map((s) => s.key));

  let totalIssues = 0;
  let failedSkills = 0;

  for (const { key, entry, location } of skills) {
    const issues = validateSkill(key, entry, knownNames);
    if (issues.length > 0) {
      failedSkills += 1;
      totalIssues += issues.length;
      console.error(`\n✖ ${location}`);
      for (const issue of issues) {
        console.error(`    - ${issue}`);
      }
    }
  }

  if (totalIssues === 0) {
    console.log(`✓ All ${skills.length} skills valid (schema_version ${SCHEMA_VERSION})`);
    process.exit(0);
  } else {
    console.error(`\n✖ ${totalIssues} issue(s) across ${failedSkills} skill(s) (of ${skills.length} total)`);
    process.exit(1);
  }
}

main();
