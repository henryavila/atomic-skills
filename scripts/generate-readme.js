#!/usr/bin/env node
/**
 * Regenerate README.md marker regions from `meta/catalog.yaml` + skill bodies
 * + `src/config.js` (host tiers).
 *
 * Slim product envelope (design D5 / F2):
 *   - PRODUCT — what_is / what_is_not / install / docs_url from catalog.product
 *   - IDES_TABLE — Tested vs Theoretical from config
 *   - SKILLS_TABLE — compact name + one_liner + iron_law
 *   - SKILL_DETAILS / MODULES / VERSION_NOTE — empty (site owns long copy)
 *
 * Catalog root v0.3: prefers each skill's catalog `iron_law` (product SSOT);
 * falls back to extracting `## Iron Law` from the skill body when absent.
 *
 * Usage:
 *   node scripts/generate-readme.js          # rewrites README.md in place
 *   node scripts/generate-readme.js --check  # exits 1 if README is stale
 *
 * Exit codes:
 *   0 — README is in sync (or was rewritten successfully)
 *   1 — drift detected (--check mode) OR rendering error
 *   2 — file/parse error
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { renderReadmeFromPaths } from './lib/render-readme.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');
const README_PATH = join(PROJECT_ROOT, 'README.md');

function diffLines(a, b) {
  const aLines = a.split('\n');
  const bLines = b.split('\n');
  const out = [];
  const max = Math.max(aLines.length, bLines.length);
  for (let i = 0; i < max; i++) {
    if (aLines[i] !== bLines[i]) {
      if (aLines[i] !== undefined) out.push(`- ${aLines[i]}`);
      if (bLines[i] !== undefined) out.push(`+ ${bLines[i]}`);
    }
  }
  return out.join('\n');
}

function main() {
  const args = new Set(process.argv.slice(2));
  const checkMode = args.has('--check');

  if (!existsSync(README_PATH)) {
    console.error(`ERROR: README.md not found at ${README_PATH}`);
    process.exit(2);
  }

  let next;
  try {
    next = renderReadmeFromPaths({ projectRoot: PROJECT_ROOT });
  } catch (err) {
    console.error(`ERROR: ${err.message}`);
    process.exit(err.message.includes('parse') ? 2 : 1);
  }

  const current = readFileSync(README_PATH, 'utf8');

  if (checkMode) {
    if (current === next) {
      process.exit(0);
    }
    console.error('✖ README.md is out of sync with meta/catalog.yaml');
    console.error(diffLines(current, next));
    process.exit(1);
  }

  if (current === next) {
    console.log('✓ README.md already up to date');
    process.exit(0);
  }

  writeFileSync(README_PATH, next, 'utf8');
  console.log('✓ README.md regenerated');
  process.exit(0);
}

main();
