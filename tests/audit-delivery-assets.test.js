// Static reachability guard for audit-delivery lazy assets.
//
// Every file under skills/shared/audit-delivery-assets/** (except optional
// README*) must be reachable from skills/core/audit-delivery.md via a static
// reference graph: body → asset → nested asset. No skill runtime executor —
// pure filesystem + text scan. Prevents shipping dead / orphan assets (F3).

import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(__dirname, '..')
const BODY = join(REPO_ROOT, 'skills/core/audit-delivery.md')
const ASSETS_ROOT = join(REPO_ROOT, 'skills/shared/audit-delivery-assets')

/** Optional docs that may exist without being wired. */
const OPTIONAL_BASENAMES = new Set(['README.md', 'README.txt', '.gitkeep'])

function walkFiles(dir) {
  const out = []
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, ent.name)
    if (ent.isDirectory()) out.push(...walkFiles(full))
    else if (ent.isFile()) out.push(full)
  }
  return out
}

function posixRel(abs) {
  return relative(ASSETS_ROOT, abs).split(sep).join('/')
}

/**
 * Collect asset-relative paths referenced in text.
 * Matches {{ASSETS_PATH}}/foo.md, audit-delivery-assets/foo.md,
 * checklists/product.md, bare filenames present under the tree, etc.
 */
function extractRefs(text, knownRelPaths) {
  const found = new Set()
  const patterns = [
    /\{\{ASSETS_PATH\}\}\/([A-Za-z0-9_./-]+\.(?:md|txt|yaml|yml|json))/g,
    /audit-delivery-assets\/([A-Za-z0-9_./-]+\.(?:md|txt|yaml|yml|json))/g,
    /(?:^|[\s`"'(])((?:checklists\/)?[A-Za-z0-9_.-]+\.(?:md|txt|yaml|yml|json))/g,
  ]
  for (const re of patterns) {
    re.lastIndex = 0
    let m
    while ((m = re.exec(text)) !== null) {
      const cand = m[1]
      if (knownRelPaths.has(cand)) found.add(cand)
      // also accept basename match when unique
      for (const rel of knownRelPaths) {
        if (rel === cand || rel.endsWith('/' + cand) || rel.split('/').pop() === cand) {
          found.add(rel)
        }
      }
    }
  }
  return found
}

function reachableFromBody(knownRelPaths) {
  const bodyText = readFileSync(BODY, 'utf8')
  const queue = [...extractRefs(bodyText, knownRelPaths)]
  const seen = new Set()
  while (queue.length) {
    const rel = queue.pop()
    if (seen.has(rel)) continue
    if (!knownRelPaths.has(rel)) continue
    seen.add(rel)
    const abs = join(ASSETS_ROOT, rel)
    let text
    try {
      text = readFileSync(abs, 'utf8')
    } catch {
      continue
    }
    for (const next of extractRefs(text, knownRelPaths)) {
      if (!seen.has(next)) queue.push(next)
    }
  }
  return seen
}

describe('audit-delivery assets static graph', () => {
  it('body and assets root exist', () => {
    assert.ok(statSync(BODY).isFile(), 'skills/core/audit-delivery.md missing')
    assert.ok(statSync(ASSETS_ROOT).isDirectory(), 'audit-delivery-assets/ missing')
  })

  it('every asset file is reachable from the skill body (no orphans)', () => {
    const allAbs = walkFiles(ASSETS_ROOT)
    const required = allAbs.filter((abs) => {
      const base = abs.split(sep).pop()
      return !OPTIONAL_BASENAMES.has(base)
    })
    assert.ok(required.length > 0, 'expected at least one asset under audit-delivery-assets/')

    const knownRelPaths = new Set(required.map(posixRel))
    const reachable = reachableFromBody(knownRelPaths)

    const orphans = [...knownRelPaths].filter((rel) => !reachable.has(rel)).sort()
    assert.deepEqual(
      orphans,
      [],
      `orphan assets (not referenced from body or reachable assets):\n  ${orphans.join('\n  ')}`,
    )
  })

  it('fails closed when an unreferenced asset is introduced (graph unit)', () => {
    // Synthetic graph: body only references a.md; b.md is orphan.
    const known = new Set(['a.md', 'b.md', 'checklists/c.md'])
    const fakeBody = 'see {{ASSETS_PATH}}/a.md and checklists/c.md'
    const refs = extractRefs(fakeBody, known)
    assert.ok(refs.has('a.md'))
    assert.ok(refs.has('checklists/c.md'))
    assert.equal(refs.has('b.md'), false, 'unreferenced b.md must not be in body refs')
  })

  it('Assets (lazy) index mentions ASSETS_PATH', () => {
    const body = readFileSync(BODY, 'utf8')
    // Body heading is "Assets (lazy — …)" or "Assets (lazy)"; T-018 greps Assets \(lazy\)|ASSETS_PATH
    assert.match(body, /Assets \(lazy/)
    assert.match(body, /\{\{ASSETS_PATH\}\}/)
  })
})
