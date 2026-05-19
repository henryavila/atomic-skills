#!/usr/bin/env node
/**
 * Validate `.atomic-skills/` state files (Plan + Initiative frontmatter)
 * against the JSON Schemas in meta/schemas/.
 *
 * Usage:
 *   node scripts/validate-state.js                       # validates ./.atomic-skills/
 *   node scripts/validate-state.js <dir>                 # validates <dir>/plans/*.md + <dir>/initiatives/*.md
 *   node scripts/validate-state.js <file.md> [<file>...] # validates specific file(s); kind inferred from path
 *
 * Exit codes:
 *   0 — all files valid
 *   1 — one or more validation errors
 *   2 — file/parse/setup error
 */
import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve, basename } from 'node:path';
import { parse as parseYaml } from 'yaml';
import Ajv from 'ajv/dist/2020.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCHEMA_DIR = join(__dirname, '..', 'meta', 'schemas');

const SCHEMA_FILES = {
  common: 'common.schema.json',
  plan: 'plan.schema.json',
  initiative: 'initiative.schema.json',
};

/**
 * Load the three schemas and register them with a fresh Ajv instance.
 * The $ref strings inside the schemas use relative URIs (e.g.
 * "common.schema.json#/$defs/slug") that Ajv resolves against each schema's $id.
 */
function buildAjv() {
  const ajv = new Ajv({ allErrors: true, strict: false });
  for (const name of Object.values(SCHEMA_FILES)) {
    const schemaPath = join(SCHEMA_DIR, name);
    if (!existsSync(schemaPath)) {
      throw new Error(`Schema not found: ${schemaPath}`);
    }
    const schema = JSON.parse(readFileSync(schemaPath, 'utf8'));
    ajv.addSchema(schema);
  }
  return {
    validatePlan: ajv.getSchema('https://atomic-skills.henryavila.com/schemas/plan.schema.json'),
    validateInitiative: ajv.getSchema('https://atomic-skills.henryavila.com/schemas/initiative.schema.json'),
  };
}

/**
 * Extract YAML frontmatter and markdown body from a `.md` file.
 * Returns { frontmatter, body, error? }.
 *
 * Expects the file to start with `---\n`, contain a second `---\n`, and
 * have a (possibly empty) body after.
 */
export function parseFrontmatter(raw) {
  if (typeof raw !== 'string') {
    return { error: 'content is not a string' };
  }
  if (!raw.startsWith('---\n') && !raw.startsWith('---\r\n')) {
    return { error: 'file does not start with `---` fence' };
  }
  // Find the closing fence on its own line. Be tolerant of trailing whitespace.
  const lines = raw.split(/\r?\n/);
  let closeIdx = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trimEnd() === '---') {
      closeIdx = i;
      break;
    }
  }
  if (closeIdx === -1) {
    return { error: 'no closing `---` fence found' };
  }
  const yamlBlock = lines.slice(1, closeIdx).join('\n');
  const body = lines.slice(closeIdx + 1).join('\n');
  let frontmatter;
  try {
    frontmatter = parseYaml(yamlBlock);
  } catch (err) {
    return { error: `YAML parse error: ${err.message}` };
  }
  if (frontmatter == null || typeof frontmatter !== 'object' || Array.isArray(frontmatter)) {
    return { error: 'frontmatter is not a YAML object' };
  }
  return { frontmatter, body };
}

/**
 * Infer schema kind ('plan' | 'initiative') from a file path.
 * Returns null if the path is not under a recognised directory.
 */
function kindFromPath(filePath) {
  const parts = resolve(filePath).split('/');
  // Walk from the end: the immediate parent dir tells us the kind.
  // tests/fixtures/state/plans/<slug>.md → 'plan'
  // .atomic-skills/initiatives/<slug>.md → 'initiative'
  for (let i = parts.length - 2; i >= 0; i--) {
    if (parts[i] === 'plans') return 'plan';
    if (parts[i] === 'initiatives') return 'initiative';
  }
  return null;
}

/**
 * Collect all *.md files to validate from a CLI argv list.
 * Each arg can be a file or a directory; directories are scanned for
 * plans/*.md + initiatives/*.md non-recursively.
 */
function collectTargets(args) {
  const targets = [];
  const seen = new Set();
  for (const arg of args) {
    const absPath = resolve(arg);
    if (!existsSync(absPath)) {
      throw new Error(`path not found: ${arg}`);
    }
    const stat = statSync(absPath);
    if (stat.isFile()) {
      if (!seen.has(absPath)) {
        targets.push(absPath);
        seen.add(absPath);
      }
      continue;
    }
    if (stat.isDirectory()) {
      for (const sub of ['plans', 'initiatives']) {
        const subDir = join(absPath, sub);
        if (!existsSync(subDir) || !statSync(subDir).isDirectory()) continue;
        for (const entry of readdirSync(subDir)) {
          if (!entry.endsWith('.md')) continue;
          const filePath = join(subDir, entry);
          if (seen.has(filePath)) continue;
          targets.push(filePath);
          seen.add(filePath);
        }
      }
    }
  }
  return targets;
}

/**
 * Validate a single file. Returns { ok, kind, errors[] }.
 */
export function validateFile(filePath, validators) {
  const kind = kindFromPath(filePath);
  if (!kind) {
    return {
      ok: false,
      kind: null,
      errors: [`cannot infer kind from path (must be under plans/ or initiatives/)`],
    };
  }
  let raw;
  try {
    raw = readFileSync(filePath, 'utf8');
  } catch (err) {
    return { ok: false, kind, errors: [`read failed: ${err.message}`] };
  }
  const parsed = parseFrontmatter(raw);
  if (parsed.error) {
    return { ok: false, kind, errors: [parsed.error] };
  }
  const validate = kind === 'plan' ? validators.validatePlan : validators.validateInitiative;
  const ok = validate(parsed.frontmatter);
  if (ok) {
    return { ok: true, kind, errors: [] };
  }
  const errors = (validate.errors || []).map((e) => {
    const where = e.instancePath || '(root)';
    return `${where}: ${e.message}${e.params ? ' ' + JSON.stringify(e.params) : ''}`;
  });
  return { ok: false, kind, errors };
}

function main() {
  let args = process.argv.slice(2);
  if (args.length === 0) {
    args = ['.atomic-skills'];
  }

  let validators;
  try {
    validators = buildAjv();
  } catch (err) {
    console.error(`ERROR: ${err.message}`);
    process.exit(2);
  }

  let targets;
  try {
    targets = collectTargets(args);
  } catch (err) {
    console.error(`ERROR: ${err.message}`);
    process.exit(2);
  }

  if (targets.length === 0) {
    console.error('ERROR: no plans/*.md or initiatives/*.md found in given path(s)');
    process.exit(2);
  }

  let failed = 0;
  for (const target of targets) {
    const rel = target.replace(`${process.cwd()}/`, '');
    const result = validateFile(target, validators);
    if (result.ok) {
      console.log(`✓ ${rel}  [${result.kind}]`);
    } else {
      failed += 1;
      console.error(`\n✖ ${rel}  [${result.kind ?? 'unknown'}]`);
      for (const err of result.errors) {
        console.error(`    - ${err}`);
      }
    }
  }

  if (failed === 0) {
    console.log(`\n✓ All ${targets.length} file(s) valid (schemaVersion 0.1)`);
    process.exit(0);
  }
  console.error(`\n✖ ${failed} of ${targets.length} file(s) failed validation`);
  process.exit(1);
}

const invokedDirectly = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (invokedDirectly) {
  main();
}
