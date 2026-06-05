#!/usr/bin/env node
// Bundle meta/schemas/{common,plan,initiative}.schema.json into a single
// self-contained schema.json for the aiDeck consumer (~/.aideck/consumers/
// atomic-skills/schema.json), consumed by `aideck validate` (AJV, strict:false).
//
// - merge all $defs (common + plan + initiative) at the root (no name collisions)
// - rewrite cross-file refs `common.schema.json#/$defs/X` → `#/$defs/X`
// - expose `definitions.plan` / `.initiative` / `.task` (aiDeck looks up
//   #/definitions/<dataSourceId>, singular fallback)
// - drop the top-level `additionalProperties:false` on plan/initiative: the
//   data-source reader injects `_body`/`_file`/`projectId`/… so strict-extra
//   would false-reject. (The $defs keep their own additionalProperties.)
import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const metaDir = join(root, 'meta', 'schemas')
const read = (f) => JSON.parse(readFileSync(join(metaDir, f), 'utf8'))

const common = read('common.schema.json')
const plan = read('plan.schema.json')
const initiative = read('initiative.schema.json')

// AJV (aiDeck's schema-validator) runs draft-07: use `definitions` (not `$defs`)
// and `#/definitions/X` refs. Rewrite both the cross-file (`common.schema.json#/$defs/`)
// and internal (`#/$defs/`) refs to the bundled `#/definitions/` namespace.
function rewriteRefs(node) {
  if (Array.isArray(node)) return node.map(rewriteRefs)
  if (node && typeof node === 'object') {
    const out = {}
    for (const [k, v] of Object.entries(node)) {
      out[k] =
        k === '$ref' && typeof v === 'string'
          ? v.replace('common.schema.json#/$defs/', '#/definitions/').replace('#/$defs/', '#/definitions/')
          : rewriteRefs(v)
    }
    return out
  }
  return node
}

// All primitive defs (common + plan + initiative — no name collisions; `task`
// and `taskOutput` come from initiative, `phaseDescriptor` from plan).
const primitiveDefs = rewriteRefs({
  ...(common.$defs ?? {}),
  ...(plan.$defs ?? {}),
  ...(initiative.$defs ?? {}),
})

// Top-level entity schema minus envelope keys and the strict additionalProperties
// (the data-source reader injects _body/_file/projectId/… onto records).
function entity(schema) {
  const { $schema, $id, $defs: _d, additionalProperties, ...rest } = schema
  return rewriteRefs(rest)
}

const bundle = {
  $id: 'atomic-skills-schema',
  definitions: {
    ...primitiveDefs,
    plan: entity(plan),
    initiative: entity(initiative),
  },
}

const out = join(root, 'assets', 'aideck-consumer', 'schema.json')
const next = JSON.stringify(bundle, null, 2) + '\n'

// `--check`: fail (exit 1) instead of writing when the committed asset has drifted
// from meta/schemas/. Lets a test / CI catch a forgotten regen — the generated
// schema.json must never lag the source, or `aideck validate-file` rejects live
// state that carries newly-added fields (e.g. task.summary).
if (process.argv.includes('--check')) {
  let current = ''
  try { current = readFileSync(out, 'utf8') } catch { /* missing == drift */ }
  if (current !== next) {
    console.error('build-aideck-consumer-schema: assets/aideck-consumer/schema.json is STALE — run `npm run build:aideck-schema` and commit the result.')
    process.exit(1)
  }
  console.log('build-aideck-consumer-schema: schema.json up to date ✓')
  process.exit(0)
}

writeFileSync(out, next)
console.log(`wrote ${out} (definitions: ${Object.keys(bundle.definitions).length})`)
