#!/usr/bin/env node
/**
 * Scaffold a new `core` skill: write the body under skills/core/<name>.md and
 * insert a validation-passing entry into meta/catalog.yaml, then re-validate.
 *
 * The catalog is the forced source of truth — the husky pre-commit + CI gates
 * reject any skill body that lacks a catalog entry. This tool removes the only
 * manual step left: it produces both halves in sync, ready to commit.
 *
 * Usage:
 *   node scripts/new-skill.js <name> [options]
 *
 * Options:
 *   --title <t>         Title (default: "<Name> — TODO short title")
 *   --one-liner <s>     One-liner, 10-80 chars
 *   --description <s>   Catalog description
 *   --purpose <s>       Purpose sentence
 *   --emoji <e>         Emoji (default: 🧩)
 *   --version <X.Y.Z>   version_added (default: package.json version)
 *   --dry-run           Print what would change, write nothing
 *
 * After it runs, replace the TODO placeholders in both files, then commit.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parse } from 'yaml';
import { planScaffold } from './lib/scaffold-skill.js';
import { validateCatalog } from './lib/validate-skills-core.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');
const CATALOG_PATH = join(PROJECT_ROOT, 'meta', 'catalog.yaml');
const SKILLS_DIR = join(PROJECT_ROOT, 'skills');
const PKG_PATH = join(PROJECT_ROOT, 'package.json');

const FLAG_TO_FIELD = {
  '--title': 'title',
  '--one-liner': 'one_liner',
  '--description': 'description',
  '--purpose': 'purpose',
  '--emoji': 'emoji',
  '--version': 'version_added',
};

function parseArgs(argv) {
  const overrides = {};
  let name;
  let dryRun = false;

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--dry-run') {
      dryRun = true;
    } else if (token in FLAG_TO_FIELD) {
      const value = argv[i + 1];
      if (value === undefined) throw new Error(`${token} requires a value`);
      overrides[FLAG_TO_FIELD[token]] = value;
      i += 1;
    } else if (token.startsWith('--')) {
      throw new Error(`unknown option: ${token}`);
    } else if (name === undefined) {
      name = token;
    } else {
      throw new Error(`unexpected argument: ${token}`);
    }
  }

  if (!name) throw new Error('skill name is required (usage: new-skill <name> [options])');
  return { name, overrides, dryRun };
}

function main() {
  let parsed;
  try {
    parsed = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(`✖ ${err.message}`);
    process.exit(2);
  }

  const { name, overrides, dryRun } = parsed;
  const catalogText = readFileSync(CATALOG_PATH, 'utf8');
  const pkgVersion = JSON.parse(readFileSync(PKG_PATH, 'utf8')).version;
  const bodyPath = join(SKILLS_DIR, 'core', `${name}.md`);

  if (existsSync(bodyPath)) {
    console.error(`✖ body already exists: ${bodyPath}`);
    process.exit(1);
  }

  let plan;
  try {
    plan = planScaffold({ catalogText, name, pkgVersion, overrides });
  } catch (err) {
    console.error(`✖ ${err.message}`);
    process.exit(1);
  }

  if (dryRun) {
    console.log(`[dry-run] would write skills/${plan.bodyRelPath}`);
    console.log(`[dry-run] would add core.${name} to meta/catalog.yaml\n`);
    console.log(plan.bodyText);
    process.exit(0);
  }

  writeFileSync(bodyPath, plan.bodyText, 'utf8');
  writeFileSync(CATALOG_PATH, plan.catalogText, 'utf8');

  // Re-validate the written state, same options as `npm run validate-skills`.
  const data = parse(readFileSync(CATALOG_PATH, 'utf8'));
  const report = validateCatalog(data, {
    skillsDir: SKILLS_DIR,
    requireIronLaw: true,
    requireModuleMeta: true,
    requireCatalogVersion: true,
  });

  if (report.totalIssues > 0) {
    console.error('✖ scaffold written but validation failed:');
    for (const { location, issues } of report.failures) {
      console.error(`  ${location}`);
      for (const issue of issues) console.error(`    - ${issue}`);
    }
    process.exit(1);
  }

  console.log(`✓ scaffolded core skill "${name}"`);
  console.log(`  - skills/${plan.bodyRelPath}`);
  console.log(`  - meta/catalog.yaml (core.${name})`);
  console.log('\nNext: replace the TODO placeholders, run `npm run generate-docs`, then commit.');
}

main();
