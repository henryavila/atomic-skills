// Standing guard: skill bodies must resolve bundled scripts from the install
// root, never assume cwd is the atomic-skills repo.
//
// Skill markdown is RENDERED INTO and EXECUTED FROM a consuming repo (the
// user's project), not from this repo. A bare `node scripts/lint-design.js`
// or `npm run validate-state` only resolves when cwd === the atomic-skills
// checkout — in any consuming repo the path / package.json script is absent,
// so the deterministic gate fails to run (observed in the field: `project new`
// in ~/tital-chordpro-lib reported "scripts/lint-design.js does not exist").
//
// The install records the package root (the dir holding scripts/ + its
// node_modules, with deps intact) at ~/.atomic-skills/package-root. Every
// script invocation in a skill body must resolve through it:
//
//   node "$(cat "$HOME/.atomic-skills/package-root" 2>/dev/null || echo .)/scripts/<name>.js" ...
//
// (the `|| echo .` tail keeps it working in this repo's own dev/test runs,
// where no package-root file exists and cwd IS the checkout). The hooks
// (session-start.sh / stop.sh) already resolve this way; this test makes the
// same invariant hold for the skill bodies, so a future edit can't silently
// re-introduce the cwd-bound form.

import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(__dirname, '..')
const SKILLS_DIR = join(REPO_ROOT, 'skills')

// npm scripts that map 1:1 to a bundled scripts/<name>.js and so are only
// resolvable from this repo (they live in THIS package.json, never the
// consumer's). Keep in sync with package.json `scripts`.
const LOCAL_NPM_SCRIPTS = ['validate-state', 'validate-skills', 'detect-scope']

// `node scripts/<name>.js` with no resolver prefix in front of `scripts/`.
const BARE_NODE_SCRIPTS = /\bnode\s+scripts\//
// Trailing `(?![\w-])` so a longer consumer script (`detect-scope-custom`) is
// NOT flagged — only our exact names followed by a space / EOL / backtick.
const BARE_NPM_RUN = new RegExp(`\\bnpm\\s+run\\s+(?:${LOCAL_NPM_SCRIPTS.join('|')})(?![\\w-])`)

function mdFiles(dir) {
  const out = []
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, ent.name)
    if (ent.isDirectory()) out.push(...mdFiles(full))
    else if (ent.isFile() && ent.name.endsWith('.md')) out.push(full)
  }
  return out
}

describe('skill bodies resolve bundled scripts from the install root', () => {
  const files = mdFiles(SKILLS_DIR)

  it('finds skill markdown to scan (guard is not vacuous)', () => {
    assert.ok(files.length > 0, 'no skill .md files found under skills/')
  })

  for (const abs of files) {
    const rel = relative(REPO_ROOT, abs)
    it(`${rel} has no cwd-bound script invocation`, () => {
      const lines = readFileSync(abs, 'utf8').split('\n')
      const offenders = []
      lines.forEach((line, i) => {
        if (BARE_NODE_SCRIPTS.test(line)) offenders.push(`${i + 1}: ${line.trim()}`)
        if (BARE_NPM_RUN.test(line)) offenders.push(`${i + 1}: ${line.trim()}`)
      })
      assert.equal(
        offenders.length,
        0,
        `${rel} invokes a bundled script as if cwd were the atomic-skills repo — ` +
          `it fails in any consuming repo. Resolve through the install root instead:\n` +
          `  node "$(cat "$HOME/.atomic-skills/package-root" 2>/dev/null || echo .)/scripts/<name>.js" ...\n` +
          `Offending lines:\n  ${offenders.join('\n  ')}`
      )
    })
  }
})
