#!/usr/bin/env node
/**
 * Regenerate `src/dashboard/data/skills.generated.ts` from
 * `meta/catalog.yaml`.
 *
 * Usage:
 *   node scripts/generate-helpview-data.js          # rewrites the file
 *   node scripts/generate-helpview-data.js --check  # exits 1 if stale
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parse } from 'yaml';
import { renderHelpViewData } from './lib/render-helpview-data.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');
const CATALOG_PATH = join(PROJECT_ROOT, 'meta', 'catalog.yaml');
const OUT_PATH = join(PROJECT_ROOT, 'src', 'dashboard', 'data', 'skills.generated.ts');

function main() {
  const args = new Set(process.argv.slice(2));
  const checkMode = args.has('--check');

  if (!existsSync(CATALOG_PATH)) {
    console.error(`ERROR: catalog not found at ${CATALOG_PATH}`);
    process.exit(2);
  }

  const data = parse(readFileSync(CATALOG_PATH, 'utf8'));
  const next = renderHelpViewData(data);

  const current = existsSync(OUT_PATH) ? readFileSync(OUT_PATH, 'utf8') : '';

  if (checkMode) {
    if (current === next) {
      process.exit(0);
    }
    console.error(`✖ ${OUT_PATH} is out of sync with meta/catalog.yaml`);
    process.exit(1);
  }

  if (current === next) {
    console.log(`✓ ${OUT_PATH} already up to date`);
    process.exit(0);
  }

  mkdirSync(dirname(OUT_PATH), { recursive: true });
  writeFileSync(OUT_PATH, next, 'utf8');
  console.log(`✓ ${OUT_PATH} regenerated`);
  process.exit(0);
}

main();
