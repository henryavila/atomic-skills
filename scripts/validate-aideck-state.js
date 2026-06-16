#!/usr/bin/env node
/**
 * validate-aideck-state.js — the `aideck validate` CI gate for the emitted state.
 *
 * The aiDeck v0.1 runtime does NOT validate records at read/render time; the only
 * JSON-Schema check is Ajv (draft-07, strict:false) via the `aideck validate` CLI
 * (docs/handoffs/atomic-skills-v2-answers.md Q3). The CLI walks up from a data
 * file to the consumer's manifest + schema.json and validates each record against
 * `#/definitions/<dataSourceId>`. That walk-up assumes the data sits under the
 * consumer dir; OUR sources are `root: project` (under the repo, resolved per
 * project at runtime), so the CLI's path match doesn't fit a standalone repo run.
 *
 * So this gate runs the SAME validation aiDeck would — the bundled
 * `assets/aideck-consumer/schema.json` (built from meta/schemas/, incl.
 * aideck-state.schema.json) under Ajv draft-07 strict:false — against the emitted
 * projection (built in-memory from the repo's .atomic-skills tree) + the generated
 * meta/catalog.json. A drift between the emitter and the schema fails CI here.
 *
 * CLI:  node scripts/validate-aideck-state.js [<dir>]   (dir defaults to ./)
 */
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import Ajv from 'ajv';
import { readTree, buildState } from './emit-consumer-state.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');
const SCHEMA_PATH = join(PROJECT_ROOT, 'assets', 'aideck-consumer', 'schema.json');
const CATALOG_JSON = join(PROJECT_ROOT, 'meta', 'catalog.json');

// Deterministic clock so buildState's relative-time fields are stable in CI.
const FIXED_NOW = Date.parse('2026-06-16T00:00:00Z');

/**
 * Validate the emitted projection of `<dir>/.atomic-skills` + meta/catalog.json
 * against the bundled schema. Returns { ok, errors:[{entity,index,message}] }.
 */
export function validateAideckState(dir, { nowMs = FIXED_NOW } = {}) {
  const schema = JSON.parse(readFileSync(SCHEMA_PATH, 'utf8'));
  const ajv = new Ajv({ strict: false, allErrors: false });
  ajv.addSchema(schema);
  const validatorFor = (id) => ajv.getSchema(`${schema.$id}#/definitions/${id}`);

  const root = existsSync(join(dir, '.atomic-skills')) ? join(dir, '.atomic-skills') : dir;
  const state = buildState(readTree(root), nowMs);

  // catalog is generated separately (scripts/generate-catalog-json.js); validate
  // it here too so the gate covers every dataSource the manifest binds.
  if (existsSync(CATALOG_JSON)) {
    state.catalog = JSON.parse(readFileSync(CATALOG_JSON, 'utf8'));
  }

  const errors = [];
  for (const [entity, records] of Object.entries(state)) {
    const validate = validatorFor(entity);
    if (!validate) {
      errors.push({ entity, index: -1, message: `no schema definition #/definitions/${entity}` });
      continue;
    }
    records.forEach((rec, index) => {
      if (!validate(rec)) {
        const e = validate.errors[0];
        errors.push({ entity, index, message: `${e.instancePath || '(root)'} ${e.message}` });
      }
    });
  }

  return { ok: errors.length === 0, errors, counts: Object.fromEntries(Object.entries(state).map(([k, v]) => [k, v.length])) };
}

// CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  const dir = process.argv[2] ? resolve(process.argv[2]) : process.cwd();
  const { ok, errors, counts } = validateAideckState(dir);
  if (ok) {
    const summary = Object.entries(counts).map(([k, n]) => `${k}:${n}`).join(' ');
    console.log(`✓ aideck state valid — ${summary}`);
    process.exit(0);
  }
  console.error(`✖ aideck state INVALID (${errors.length} error${errors.length === 1 ? '' : 's'}):`);
  for (const e of errors.slice(0, 20)) {
    console.error(`  ${e.entity}[${e.index}]: ${e.message}`);
  }
  process.exit(1);
}
