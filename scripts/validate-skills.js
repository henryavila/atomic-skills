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
import { validateCatalog } from './lib/validate-skills-core.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_PATH = join(__dirname, '..', 'meta', 'skills.yaml');
const DEFAULT_SKILLS_DIR = join(__dirname, '..', 'skills', 'en');

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

  const report = validateCatalog(data, {
    skillsDir: DEFAULT_SKILLS_DIR,
    requireIronLaw: true,
  });

  if (report.parseError) {
    console.error(`ERROR: ${report.parseError}`);
    process.exit(2);
  }

  if (report.totalIssues === 0) {
    const versionNote = report.versionsSeen.size === 1
      ? `schema_version ${[...report.versionsSeen][0]}`
      : `schema_versions ${[...report.versionsSeen].sort().join(', ')}`;
    console.log(`✓ All ${report.totalSkills} skills valid (${versionNote})`);
    process.exit(0);
  }

  for (const { location, issues } of report.failures) {
    console.error(`\n✖ ${location}`);
    for (const issue of issues) {
      console.error(`    - ${issue}`);
    }
  }

  console.error(
    `\n✖ ${report.totalIssues} issue(s) across ${report.failedSkills} skill(s) ` +
      `(of ${report.totalSkills} total)`
  );
  process.exit(1);
}

main();
