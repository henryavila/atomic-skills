#!/usr/bin/env node
/**
 * Validate meta/catalog.yaml against the schema described in
 * docs/kb/skill-frontmatter-spec.md.
 *
 * Exit codes:
 *   0 — all skills valid
 *   1 — one or more validation errors
 *   2 — file/parse error
 *
 * Usage: node scripts/validate-skills.js [path/to/catalog.yaml]
 */

import { readFileSync, existsSync } from 'node:fs';
import { parse } from 'yaml';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { validateCatalog, validateReadmeMentions, collectSkills } from './lib/validate-skills-core.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_PATH = join(__dirname, '..', 'meta', 'catalog.yaml');
const DEFAULT_SKILLS_DIR = join(__dirname, '..', 'skills');
const DEFAULT_README_PATH = join(__dirname, '..', 'README.md');

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
    console.error('ERROR: catalog.yaml root is not an object');
    process.exit(2);
  }

  const report = validateCatalog(data, {
    skillsDir: DEFAULT_SKILLS_DIR,
    requireIronLaw: true,

    requireCatalogVersion: true,
  });

  if (report.parseError) {
    console.error(`ERROR: ${report.parseError}`);
    process.exit(2);
  }

  // Cross-cutting README lint: catches `atomic-skills:<name>` mentions in
  // static prose that don't resolve to any catalog entry. Only runs when
  // the default catalog path is used (so external invocations stay scoped).
  if (filePath === DEFAULT_PATH && existsSync(DEFAULT_README_PATH)) {
    const knownNames = new Set(collectSkills(data).map((s) => s.key));
    const readmeText = readFileSync(DEFAULT_README_PATH, 'utf8');
    const readmeIssues = validateReadmeMentions(readmeText, knownNames);
    if (readmeIssues.length > 0) {
      report.failures.push({ location: '__readme__', issues: readmeIssues });
      report.failedSkills += 1;
      report.totalIssues += readmeIssues.length;
    }
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
