#!/usr/bin/env node
/**
 * Render a process-map YAML to deterministic self-contained HTML
 * (Atomic Skills DS from site/assets/ds.css inlined).
 *
 * Usage:
 *   node scripts/render-process-map.js <map.yaml> [-o out.html] [--audience layperson|developer|both]
 *   node scripts/render-process-map.js --check <map.yaml> <out.html> [--audience ...]
 *   node scripts/render-process-map.js --stdout <map.yaml>
 *
 * Exit:
 *   0 — ok / in sync
 *   1 — validation error, drift (--check), or render error
 *   2 — usage / IO
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import {
  buildProcessMapHtml,
  sha256,
  AUDIENCES,
} from './lib/render-process-map.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');
const DS_CSS_PATH = join(PROJECT_ROOT, 'site', 'assets', 'ds.css');

function usage(code = 2) {
  console.error(`Usage:
  node scripts/render-process-map.js <map.yaml> [-o out.html] [--audience layperson|developer|both]
  node scripts/render-process-map.js --check <map.yaml> <out.html> [--audience ...]
  node scripts/render-process-map.js --stdout <map.yaml> [--audience ...]`);
  process.exit(code);
}

function loadDsCss() {
  if (!existsSync(DS_CSS_PATH)) {
    console.error(`Missing design system CSS: ${DS_CSS_PATH}`);
    process.exit(2);
  }
  return readFileSync(DS_CSS_PATH, 'utf8');
}

function loadMap(path) {
  const abs = resolve(path);
  if (!existsSync(abs)) {
    console.error(`File not found: ${abs}`);
    process.exit(2);
  }
  const raw = parse(readFileSync(abs, 'utf8'));
  return raw;
}

function parseArgs(argv) {
  const args = argv.slice(2);
  /** @type {{ mode: 'write'|'check'|'stdout', input?: string, output?: string, expected?: string, audience?: string }} */
  const out = { mode: 'write' };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--help' || a === '-h') usage(0);
    if (a === '--check') {
      out.mode = 'check';
      out.input = args[++i];
      out.expected = args[++i];
      continue;
    }
    if (a === '--stdout') {
      out.mode = 'stdout';
      out.input = args[++i];
      continue;
    }
    if (a === '-o' || a === '--output') {
      out.output = args[++i];
      continue;
    }
    if (a === '--audience') {
      out.audience = args[++i];
      continue;
    }
    if (a.startsWith('-')) {
      console.error(`Unknown flag: ${a}`);
      usage(2);
    }
    if (!out.input) out.input = a;
    else if (!out.output) out.output = a;
  }
  return out;
}

function main() {
  const opts = parseArgs(process.argv);
  if (!opts.input) usage(2);
  if (opts.audience && !AUDIENCES.includes(opts.audience)) {
    console.error(`Invalid --audience (want ${AUDIENCES.join('|')})`);
    process.exit(2);
  }

  const dsCss = loadDsCss();
  const raw = loadMap(opts.input);

  let built;
  try {
    built = buildProcessMapHtml(raw, dsCss, {
      audience: opts.audience,
    });
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }

  if (opts.mode === 'stdout') {
    process.stdout.write(built.html);
    return;
  }

  if (opts.mode === 'check') {
    if (!opts.expected) usage(2);
    const expectedPath = resolve(opts.expected);
    if (!existsSync(expectedPath)) {
      console.error(`Expected HTML missing: ${expectedPath}`);
      process.exit(1);
    }
    const onDisk = readFileSync(expectedPath, 'utf8');
    if (onDisk === built.html) {
      console.log(`OK in sync · content-sha ${built.contentSha.slice(0, 16)} · ${expectedPath}`);
      process.exit(0);
    }
    console.error(`DRIFT: ${expectedPath}`);
    console.error(`  expected sha256 ${sha256(onDisk).slice(0, 16)}…`);
    console.error(`  rendered sha256 ${sha256(built.html).slice(0, 16)}…`);
    console.error(`  content-sha     ${built.contentSha.slice(0, 16)}…`);
    console.error('Re-run without --check to regenerate.');
    process.exit(1);
  }

  // write mode
  const outPath = opts.output
    ? resolve(opts.output)
    : resolve(
        dirname(resolve(opts.input)),
        `${built.normalized.planSlug}.process-map.html`
      );
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, built.html, 'utf8');
  console.log(`Wrote ${outPath}`);
  console.log(`content-sha ${built.contentSha}`);
  console.log(`audience    ${built.normalized.audience}`);
}

main();
