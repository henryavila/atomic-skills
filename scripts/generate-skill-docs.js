#!/usr/bin/env node
/**
 * Generate per-skill reference docs under docs/skills/ from meta/catalog.yaml.
 *
 * Usage:
 *   node scripts/generate-skill-docs.js          # writes docs/skills/*.md
 *   node scripts/generate-skill-docs.js --check   # exits 1 if stale
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parse } from 'yaml';
import { buildSkillDocs } from './lib/render-readme.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');
const CATALOG_PATH = join(PROJECT_ROOT, 'meta', 'catalog.yaml');
const SKILLS_DIR = join(PROJECT_ROOT, 'skills');
const DOCS_DIR = join(PROJECT_ROOT, 'docs', 'skills');

function main() {
  const args = new Set(process.argv.slice(2));
  const checkMode = args.has('--check');

  const catalogData = parse(readFileSync(CATALOG_PATH, 'utf8'));
  const docs = buildSkillDocs({ catalogData, skillsDir: SKILLS_DIR });

  mkdirSync(DOCS_DIR, { recursive: true });

  let stale = false;

  for (const { key, content } of docs) {
    const filePath = join(DOCS_DIR, `${key}.md`);
    const expected = content + '\n';

    if (checkMode) {
      const current = existsSync(filePath) ? readFileSync(filePath, 'utf8') : '';
      if (current !== expected) {
        console.error(`✖ docs/skills/${key}.md is stale`);
        stale = true;
      }
      continue;
    }

    writeFileSync(filePath, expected, 'utf8');
  }

  // Check for orphan docs (skills removed from catalog)
  if (existsSync(DOCS_DIR)) {
    const expectedKeys = new Set(docs.map((d) => d.key));
    for (const file of readdirSync(DOCS_DIR)) {
      if (!file.endsWith('.md')) continue;
      const key = file.slice(0, -3);
      if (!expectedKeys.has(key)) {
        if (checkMode) {
          console.error(`✖ docs/skills/${file} is orphaned (skill removed from catalog)`);
          stale = true;
        } else {
          console.log(`⚠ Orphan doc: docs/skills/${file} (skill not in catalog)`);
        }
      }
    }
  }

  if (checkMode) {
    if (stale) {
      console.error('Run `npm run generate-docs` to update.');
      process.exit(1);
    }
    process.exit(0);
  }

  console.log(`✓ ${docs.length} skill docs generated in docs/skills/`);
}

main();
