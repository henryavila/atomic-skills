#!/usr/bin/env node
/**
 * Generate the multi-page product docs site into `site/dist/` from
 * `meta/catalog.yaml` + `src/config.js` host labels.
 *
 * Usage:
 *   node scripts/generate-site.js          # writes site/dist/**
 *   node scripts/generate-site.js --check  # exits 1 if dist is stale
 *
 * Exit codes:
 *   0 — dist in sync (or rewritten successfully)
 *   1 — drift detected (--check) OR render error
 *   2 — missing inputs / IO error
 */

import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
  rmSync,
  copyFileSync,
} from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join, relative, sep, resolve } from 'node:path';
import { parse } from 'yaml';
import { createHash } from 'node:crypto';
import { buildSiteFiles } from './lib/render-site.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');
const CATALOG_YAML = join(PROJECT_ROOT, 'meta', 'catalog.yaml');
const PACKAGE_JSON = join(PROJECT_ROOT, 'package.json');
const DS_CSS_SRC = join(PROJECT_ROOT, 'site', 'assets', 'ds.css');
const DIST_DIR = join(PROJECT_ROOT, 'site', 'dist');

export function sha256(text) {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

/**
 * Walk dist and return sorted relative posix paths (files only).
 * @param {string} root
 * @returns {string[]}
 */
export function listFilesRecursive(root) {
  if (!existsSync(root)) return [];
  const out = [];
  /** @param {string} dir */
  function walk(dir) {
    for (const name of readdirSync(dir).sort()) {
      const full = join(dir, name);
      const st = statSync(full);
      if (st.isDirectory()) {
        walk(full);
      } else if (st.isFile()) {
        const rel = relative(root, full).split(sep).join('/');
        out.push(rel);
      }
    }
  }
  walk(root);
  return out;
}

/**
 * Expected dist contents: HTML pages + assets/ds.css.
 * @param {{
 *   projectRoot?: string,
 *   catalogData?: object,
 *   dsCss?: string,
 *   pkgVersion?: string,
 * }} [opts]
 * @returns {Map<string, string>}
 */
export function buildExpectedDist(opts = {}) {
  const projectRoot = opts.projectRoot ?? PROJECT_ROOT;
  const catalogYaml = join(projectRoot, 'meta', 'catalog.yaml');
  const packageJson = join(projectRoot, 'package.json');
  const dsCssSrc = join(projectRoot, 'site', 'assets', 'ds.css');

  let catalogData = opts.catalogData;
  if (catalogData == null) {
    if (!existsSync(catalogYaml)) {
      throw Object.assign(new Error(`catalog not found: ${catalogYaml}`), {
        code: 'ENOENT',
      });
    }
    catalogData = parse(readFileSync(catalogYaml, 'utf8'));
  }

  let dsCss = opts.dsCss;
  if (dsCss == null) {
    if (!existsSync(dsCssSrc)) {
      throw Object.assign(new Error(`DS assets missing: ${dsCssSrc}`), {
        code: 'ENOENT',
      });
    }
    dsCss = readFileSync(dsCssSrc, 'utf8');
  }

  let pkgVersion = opts.pkgVersion;
  if (pkgVersion === undefined && existsSync(packageJson)) {
    try {
      pkgVersion = JSON.parse(readFileSync(packageJson, 'utf8')).version;
    } catch {
      pkgVersion = undefined;
    }
  }

  const files = buildSiteFiles({ catalogData, pkgVersion });
  files.set('assets/ds.css', dsCss);
  return files;
}

/**
 * Compare expected map to on-disk dist. Returns list of drift messages.
 * @param {Map<string, string>} expected
 * @param {string} [distDir]
 */
export function findDistDrift(expected, distDir = DIST_DIR) {
  const messages = [];
  const onDisk = new Set(listFilesRecursive(distDir));
  const expectedPaths = new Set(expected.keys());

  for (const path of expectedPaths) {
    const full = join(distDir, path);
    if (!existsSync(full)) {
      messages.push(`missing: ${path}`);
      continue;
    }
    const disk = readFileSync(full, 'utf8');
    if (disk !== expected.get(path)) {
      messages.push(
        `stale: ${path} (expected sha ${sha256(expected.get(path)).slice(0, 12)}, disk ${sha256(disk).slice(0, 12)})`
      );
    }
  }

  for (const path of onDisk) {
    if (!expectedPaths.has(path)) {
      messages.push(`extra: ${path}`);
    }
  }

  return messages;
}

/**
 * @param {Map<string, string>} expected
 * @param {{ distDir?: string, dsCssSrc?: string }} [opts]
 */
export function writeDist(expected, opts = {}) {
  const distDir = opts.distDir ?? DIST_DIR;
  const dsCssSrc = opts.dsCssSrc ?? DS_CSS_SRC;

  // Clean rebuild so removed skills/pages do not leave orphans.
  if (existsSync(distDir)) {
    rmSync(distDir, { recursive: true, force: true });
  }
  mkdirSync(distDir, { recursive: true });

  for (const [relPath, content] of expected) {
    const full = join(distDir, relPath);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, content, 'utf8');
  }

  // Prefer copy for ds.css identity with source tree when the source exists.
  if (existsSync(dsCssSrc)) {
    const dsDest = join(distDir, 'assets', 'ds.css');
    mkdirSync(dirname(dsDest), { recursive: true });
    copyFileSync(dsCssSrc, dsDest);
  }
}

function main() {
  const checkMode = new Set(process.argv.slice(2)).has('--check');

  let expected;
  try {
    expected = buildExpectedDist();
  } catch (err) {
    console.error(`ERROR: ${err.message}`);
    process.exit(err.code === 'ENOENT' ? 2 : 1);
  }

  if (checkMode) {
    const drift = findDistDrift(expected);
    if (drift.length === 0) {
      process.exit(0);
    }
    console.error('✖ site/dist is out of sync with meta/catalog.yaml + site/assets/ds.css');
    for (const line of drift) {
      console.error(`  ${line}`);
    }
    console.error('  Run `npm run generate-site` to update.');
    process.exit(1);
  }

  try {
    writeDist(expected);
  } catch (err) {
    console.error(`ERROR: failed to write dist: ${err.message}`);
    process.exit(2);
  }

  const pageCount = [...expected.keys()].filter((p) => p.endsWith('.html')).length;
  console.log(
    `✓ site/dist generated (${pageCount} HTML pages + assets/ds.css)`
  );
  process.exit(0);
}

// Only run CLI when executed directly (not when imported by tests).
const isDirect =
  Boolean(process.argv[1]) &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isDirect) {
  main();
}
