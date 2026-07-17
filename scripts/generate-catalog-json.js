#!/usr/bin/env node
/**
 * Generate `meta/catalog.json` — the bare-array projection of `meta/catalog.yaml`
 * the aiDeck `CatalogWidget` consumes (flat-key shape, see build-catalog-json.js).
 *
 * This is the regen step that replaced the deleted `skills.generated.ts` (the old
 * React-dashboard catalog). It is wired into `generate-docs` / `check-docs` and
 * the husky pre-commit pipeline alongside the README + per-skill docs.
 *
 * Usage:
 *   node scripts/generate-catalog-json.js          # writes meta/catalog.json
 *   node scripts/generate-catalog-json.js --check   # exits 1 if stale
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parse } from 'yaml';
import { buildCatalogJson } from './lib/build-catalog-json.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');
const CATALOG_YAML = join(PROJECT_ROOT, 'meta', 'catalog.yaml');
const CATALOG_JSON = join(PROJECT_ROOT, 'meta', 'catalog.json');

/** Normalize EOLs so --check is portable under Windows checkout (CRLF vs LF). */
function normalizeEol(text) {
  return String(text).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function main() {
  const checkMode = new Set(process.argv.slice(2)).has('--check');

  const catalogData = parse(readFileSync(CATALOG_YAML, 'utf8'));
  const records = buildCatalogJson(catalogData);
  const expected = JSON.stringify(records, null, 2) + '\n';

  if (checkMode) {
    const current = existsSync(CATALOG_JSON) ? readFileSync(CATALOG_JSON, 'utf8') : '';
    if (normalizeEol(current) !== normalizeEol(expected)) {
      console.error('✖ meta/catalog.json is stale — run `npm run generate-docs` to update.');
      process.exit(1);
    }
    process.exit(0);
  }

  writeFileSync(CATALOG_JSON, expected, 'utf8');
  console.log(`✓ meta/catalog.json generated (${records.length} skills)`);
}

main();
