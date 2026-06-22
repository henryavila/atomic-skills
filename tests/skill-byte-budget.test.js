// Standing byte-budget guard for the token-economy optimization.
//
// The skills-restructuring plan (F1/F2/F3) drove several core skills below
// explicit byte ceilings by moving mode-gated / cross-cutting content into
// lazy assets under skills/shared/**, leaving a one-line pointer. Those
// ceilings used to live ONLY in the plan docs and each phase's one-shot
// verifier — so when a later phase (F4) or a consolidated plan re-grew a
// resident body, nothing failed in CI. review-plan.md silently broke its
// 24000B ceiling that way.
//
// This test makes each documented ceiling a permanent invariant: any future
// re-inline — from any plan or phase — fails here until the content is moved
// back to a lazy asset (or the ceiling is deliberately raised with a reason).
//
// Provenance of each ceiling:
//   project.md / implement.md  < 22000  — F1 (thin router + lean driver)
//   review-code.md             < 20000  — F3/T3.1
//   review-plan.md             < 24000  — F3/T3.2
//   hunt.md                    < 14000  — F3/T3.3
//   debate.md                  < 15000  — F3/T3.4
//   init-memory.md             <  7800  — F3/T3.5
//   parallel-dispatch.md       < 13000  — F2/T2.4

import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(__dirname, '..')

// [relative path under skills/, hard ceiling in bytes, provenance]
const BUDGETS = [
  ['core/project.md', 22000, 'F1 — thin router'],
  ['core/implement.md', 22000, 'F1 — lean driver'],
  ['core/review-code.md', 20000, 'F3/T3.1'],
  ['core/review-plan.md', 24000, 'F3/T3.2'],
  ['core/hunt.md', 14000, 'F3/T3.3'],
  ['core/debate.md', 15000, 'F3/T3.4'],
  ['core/parallel-dispatch.md', 13000, 'F2/T2.4'],
  ['modules/memory/init-memory.md', 7800, 'F3/T3.5'],
]

describe('skill byte budgets (token-economy invariant)', () => {
  for (const [rel, ceiling, provenance] of BUDGETS) {
    it(`skills/${rel} stays under ${ceiling}B (${provenance})`, () => {
      const abs = join(REPO_ROOT, 'skills', rel)
      const size = statSync(abs).size
      assert.ok(
        size < ceiling,
        `skills/${rel} is ${size}B, over its ${ceiling}B ceiling (${provenance}). ` +
          `Move the newest resident block to a lazy asset under skills/shared/** ` +
          `and leave a one-line pointer, or raise the ceiling deliberately with a reason.`
      )
    })
  }
})
