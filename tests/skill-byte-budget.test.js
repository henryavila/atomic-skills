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
//   project.md                 < 23000  — F1 (thin router; raised 2026-06-26, see below)
//   implement.md               < 22000  — F1 (lean driver)
//   review-code.md             < 20000  — F3/T3.1
//   review-plan.md             < 24000  — F3/T3.2
//   hunt.md                    < 14000  — F3/T3.3
//   debate.md                  < 15000  — F3/T3.4
//   init-memory.md             <  7800  — F3/T3.5
//   parallel-dispatch.md       < 13000  — F2/T2.4
//
// Deliberate raise (2026-06-26): project.md 22000 → 23000. The `depend` verb
// (plan-dependencies work) added first-class RESIDENT router surface that
// cannot be externalized: a grammar line, a dispatch-table row, gate-list
// entries, AND the operator-model block (Caminho de execução / Surgiu de
// lanes) which validate-skills.test.js ("documents execution path separately
// from lineage in project operator docs") MANDATES stays resident in project.md
// (and in project-transitions.md). The depend PROCEDURE is lazy in
// project-dependencies.md, but the operator-model prose is test-required
// resident — so this is not re-inlined detail, it is a new verb's required
// resident surface, and F1's thin-router ceiling grows +1000 to admit it.
// Do NOT raise again to absorb genuinely-movable prose — externalize instead.

import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(__dirname, '..')

// [relative path under skills/, hard ceiling in bytes, provenance]
const BUDGETS = [
  // Raised 2026-07-16 integrity-remediation F0–F5: setup sentinel + structural
  // setup rules (F0) plus integrity operator surface (state join, sidecar lazy
  // descriptors, verify/cross-validation pointers) that must stay resident in
  // the thin router — not movable prose.
  ['core/project.md', 24000, 'F1 — thin router (raised 22000→23000 2026-06-26; 23000→23500→24000 2026-07-16: integrity F0–F5 setup sentinel + structural setup + integrity operator surface)'],
  // Raised 2026-07-16 integrity-remediation F3–F5: load/closure authority,
  // plan/worktree resume gate, verifier/concurrency/resolution policy, and
  // handoff checkpoint prose required on the implement driver surface.
  ['core/implement.md', 24500, 'F1 — lean driver (raised 22000→24500 2026-07-16: integrity F3–F5 closure/resume/verifier authority on driver surface)'],
  // Raised 2026-07-16 for grok-build-integration F3–F5: multi-provider modes
  // (codex|grok|external-both), host-default picker, and CROSS-MODEL REVIEW
  // provider field. ~20B / ~700B over prior ceilings; content is resident
  // dispatch surface, not movable prose.
  ['core/review-code.md', 21000, 'F3/T3.1 (raised 20000→21000 2026-07-16: multi-provider review modes + host-default)'],
  // Raised 2026-07-17: external model selection flags + Step 0.model pointer
  // (discover/recommend/pick lives in review-mode-ux.md lazy asset).
  ['core/review-plan.md', 25500, 'F3/T3.2 (raised 24000→25000 2026-07-16 multi-provider; 25000→25500 2026-07-17: --model/--ask-model + Step 0.model pointer)'],
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
