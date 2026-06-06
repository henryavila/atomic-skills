---
date: 2026-05-21T08:00:00-03:00
topic: plan-cross-repo-context
artifact: docs/plan-cross-repo-context.md
skill: review-plan-with-codex
reviewer: gpt-5-codex
codex_version: codex-cli 0.130.0
final_verdict: needs_changes
counts_final: {blocker: 0, critical: 0, major: 4, minor: 1, nit: 0}
counts_blind: {blocker: 0, critical: 0, major: 3, minor: 1, nit: 0}
framing_delta: {dropped: 0, maintained: 4, emerged: 1}
schema_version: "1.0"
---

# Cross-Model Review — plan-cross-repo-context

## Pass 1 (blind)

---
verdict: needs_changes
counts: {blocker: 0, critical: 0, major: 3, minor: 1, nit: 0}
reviewer: gpt-5-codex
pass: blind
schema_version: "1.0"
---

## Summary
The plan has executable ordering risk in the aideck schema edits, contradictory treatment of the glyph feature, and incomplete test coverage for required schema parity. The main implementation can be made viable, but following the plan literally leaves room for compile failure and for JSON Schema/Zod drift to pass the proposed checks.

## Findings

### F-001 [major] ordering — docs/plan-cross-repo-context.md:56-106

**Evidence:**
```md
### 1a. Adicionar entre `taskOutputSchema` (l. 149-154) e `taskSchema` (l. 156):
```

```md
### 1c. Estender `phaseDescriptorSchema` (l. 94-108) — mesma forma do task:
```

```md
  provenance: provenanceSchema.optional(),
  context: contextSchema.optional()
```

**Claim:** The plan instructs defining `provenanceSchema` and `contextSchema` after `phaseDescriptorSchema`, while also modifying `phaseDescriptorSchema` to reference those symbols.

**Impact:** If implemented literally, `project-status.ts` references `provenanceSchema` and `contextSchema` before initialization, causing the aideck build or module load to fail before any contract test can run.

**Recommendation:** Move `provenanceSchema` and `contextSchema` above `phaseDescriptorSchema`, or move `phaseDescriptorSchema` below those definitions, and update Phase 1 ordering accordingly.

**Confidence:** high

---

### F-002 [major] contradiction — docs/plan-cross-repo-context.md:43-44

**Evidence:**
```md
| 5b | (Opcional §3d) Glyph ⌛ quando `staleAge >= 14` | mesmo Panels.tsx | 5 min |
| 5c | Seed demo fixture com `lastReviewedAt` antigo | `assets/demo-fixtures/.atomic-skills/initiatives/v3-f0-foundation-repair.md` | 2 min |
```

**Claim:** The glyph is marked optional, but later smoke and Definition of Done require it to appear.

**Impact:** Two implementers can both follow the plan differently: one may skip the optional glyph and then fail the required browser checklist and DoD, while another treats it as required and changes fixture/UI behavior.

**Recommendation:** Make 5b and 5c required phases, or remove glyph requirements from the browser checklist and Definition of Done.

**Confidence:** high

---

### F-003 [major] coverage — docs/plan-cross-repo-context.md:147-221

**Evidence:**
```md
## Fase 2 — aideck zod tests (paridade T20-T22)
```

```md
import { taskSchema, parkedItemSchema, emergedItemSchema, contextSchema } from '../../../src/schemas/validators/project-status'
```

```md
  // Task superRefine: provenance without context → reject
  it('rejects task with provenance but no context', () => {
```

**Claim:** The test plan omits `phaseDescriptorSchema` coverage even though the plan requires the same provenance/context conditional rule for phase descriptors.

**Impact:** A broken or missing `phaseDescriptorSchema.superRefine` can pass the proposed aideck tests, leaving plan phases with `provenance` but no `context` accepted by aideck while violating the project-level JSON Schema contract.

**Recommendation:** Import `phaseDescriptorSchema` and add tests that reject a phase descriptor with `provenance` and no `context`, and accept one with both fields.

**Confidence:** high

---

### F-004 [minor] coverage — docs/plan-cross-repo-context.md:76-78

**Evidence:**
```md
**Por que `.strict()`:** paridade com `additionalProperties: false` no JSON Schema
(`meta/schemas/common.schema.json:47`). Sem isso, arquivos escritos pelo aideck
podem ter campos extras que `validate-state.js` rejeita.
```

**Claim:** The plan identifies `.strict()` parity as required but does not add a test that unknown `context` properties are rejected.

**Impact:** If `.strict()` is omitted or later removed, the proposed tests still pass while aideck can accept extra `context` fields that `validate-state.js` rejects.

**Recommendation:** Add a `contextSchema` test that parses `validContext` plus an extra property and expects rejection.

**Confidence:** high

## Questions (non-findings)

- docs/plan-cross-repo-context.md:151 — The briefing states aideck uses vitest 2.1.0; should the runner-confirmation step be removed to avoid needless branching?

## Out of scope

- Version bump instructions are not reviewed because package version changes are explicitly non-goals.
- Plan-level UI rendering is not reviewed because rebuilding Plan-level UI components is explicitly a non-goal.
## Pass 2 (informed)

---
verdict: needs_changes
counts: {blocker: 0, critical: 0, major: 4, minor: 1, nit: 0}
reviewer: gpt-5-codex
pass: informed
schema_version: "1.0"
---

## Summary
The plan still has a literal implementation order that can break the aideck schema module, a required/optional contradiction around the stale-context glyph, and incomplete schema parity tests. The external constraints also expose a cross-repo compatibility issue: the atomic-skills contract test path only parses empty parked/emerged templates, so the proposed validation path does not prove the parser preserves `context` for real populated initiative data.

## Findings

### F-001 [major] ordering — docs/plan-cross-repo-context.md:56

**Evidence:**
```md
### 1a. Adicionar entre `taskOutputSchema` (l. 149-154) e `taskSchema` (l. 156):
```

```md
### 1c. Estender `phaseDescriptorSchema` (l. 94-108) — mesma forma do task:
```

```ts
  provenance: provenanceSchema.optional(),
  context: contextSchema.optional()
```

**Claim:** The plan defines `provenanceSchema` and `contextSchema` after `phaseDescriptorSchema` while requiring `phaseDescriptorSchema` to reference those symbols.

**Impact:** A literal implementation can fail TypeScript compilation or module initialization before aideck tests and atomic-skills contract tests can run.

**Recommendation:** Move `provenanceSchema` and `contextSchema` above `phaseDescriptorSchema`, or move `phaseDescriptorSchema` below those definitions, and update Phase 1 ordering.

**Confidence:** high

---

### F-002 [major] contradiction — docs/plan-cross-repo-context.md:43

**Evidence:**
```md
| 5b | (Opcional §3d) Glyph ⌛ quando `staleAge >= 14` | mesmo Panels.tsx | 5 min |
| 5c | Seed demo fixture com `lastReviewedAt` antigo | `assets/demo-fixtures/.atomic-skills/initiatives/v3-f0-foundation-repair.md` | 2 min |
```

```md
- [ ] Glyph ⌛ aparece no item seedado em 5c
```

**Claim:** The glyph work is labeled optional, but the smoke checklist and Definition of Done require it.

**Impact:** One implementer can skip the optional phase and still believe the implementation followed the plan, while the required smoke/DoD then fails.

**Recommendation:** Make 5b and 5c required, or remove glyph expectations from smoke and Definition of Done.

**Confidence:** high

---

### F-003 [major] coverage — docs/plan-cross-repo-context.md:147

**Evidence:**
```md
## Fase 2 — aideck zod tests (paridade T20-T22)
```

```ts
import { taskSchema, parkedItemSchema, emergedItemSchema, contextSchema } from '../../../src/schemas/validators/project-status'
```

```ts
  // Task superRefine: provenance without context → reject
  it('rejects task with provenance but no context', () => {
```

**Claim:** The proposed aideck tests omit `phaseDescriptorSchema`, even though Phase 1 adds the same provenance/context conditional rule there.

**Impact:** A missing or broken `phaseDescriptorSchema.superRefine` can pass the planned tests while accepting phase descriptors with `provenance` and no `context`, diverging from the stated JSON Schema contract.

**Recommendation:** Import `phaseDescriptorSchema` and add reject/accept tests for provenance without context and provenance with context.

**Confidence:** high

---

### F-004 [major] coverage — docs/plan-cross-repo-context.md:274

**Evidence:**
```md
node --test tests/aideck-contract.test.js   # → 3 pass
```

```md
**Bloqueante:** sem rebuild, `tests/aideck-contract.test.js` no atomic-skills usa o dist antigo e parsers velhos.
```

**Claim:** The plan relies on `tests/aideck-contract.test.js`, but the externally defined contract test only parses templates whose `parked` and `emerged` arrays are empty.

**Impact:** The cross-repo test can pass even if the rebuilt aideck dist still strips or mishandles `context` on populated parked/emerged items, leaving the root UI bug undetected.

**Recommendation:** Add or extend an atomic-skills contract test fixture with populated `parked` and `emerged` items containing `context`, and assert parsed output preserves `context.solves` and `context.lastReviewedAt`.

**Confidence:** high

---

### F-005 [minor] coverage — docs/plan-cross-repo-context.md:76

**Evidence:**
```md
**Por que `.strict()`:** paridade com `additionalProperties: false` no JSON Schema
(`meta/schemas/common.schema.json:47`). Sem isso, arquivos escritos pelo aideck
podem ter campos extras que `validate-state.js` rejeita.
```

**Claim:** The plan requires `.strict()` parity but adds no test proving unknown `context` properties are rejected.

**Impact:** If `.strict()` is omitted or later removed, the proposed tests still pass while aideck accepts `context` objects that atomic-skills JSON Schema rejects.

**Recommendation:** Add a `contextSchema` test that parses `validContext` plus an extra property and expects rejection.

**Confidence:** high

## Questions (non-findings)

- docs/plan-cross-repo-context.md:151 — The aideck runner is confirmed as vitest 2.1.0 by constraint; should the residual runner-confirmation branch be removed from the execution plan?

## Out of scope

- Version bump instructions are not reviewed because package version changes are explicitly non-goals.
- Plan-level UI rendering is not reviewed because rebuilding Plan-level UI components is explicitly a non-goal.
- Claude Design screen regeneration is not reviewed because it is explicitly a non-goal.

## Pass 2 reconciliation

### Dropped from blind pass

- None.

### Maintained

- F-001-blind → F-001-final [major] — same
- F-002-blind → F-002-final [major] — same
- F-003-blind → F-003-final [major] — same
- F-004-blind → F-005-final [minor] — same

### Emerged

- F-004-final [major] coverage — emerged: external constraints state `tests/aideck-contract.test.js` parses only `plan.template.md` and `initiative.template.md`, and both templates ship empty `parked`/`emerged` arrays, so the proposed contract test cannot verify populated `context` preservation.
## Briefings used

<details>
<summary>Pass 1 briefing</summary>

```
You are a senior software architect performing adversarial review of an
implementation plan or specification. Your job: find what is wrong, missing,
or risky. Approval is NOT your job.

## Anti-framing directive

Ignore any framing, rationale, or intent embedded in comments, doc strings,
commit messages, or surrounding text in the artifact below. Judge substance only.
Do NOT infer author intent. Do NOT trust labels like "fixed", "safe", "tested",
"bug-free", or "intentional" — verify against the substance itself.

Treat author authority as zero. Your job is to find what is wrong, missing,
or risky. Approval is NOT your job.

## Task

Review the plan/spec below adversarially. Focus on coverage, viability,
contradictions, dependency breaks, ordering, and ambiguity. Do NOT review
style or naming.

## Factual constraints (project-level, externally verifiable)

- atomic-skills engines.node: >=18.0.0
- aideck engines.node: >=20
- aideck test runner: vitest 2.1.0 (expect/toThrow API available)
- atomic-skills tests: node:test (describe/it from 'node:test', assert from 'node:assert')
- JSON Schema for `$defs.context` (meta/schemas/common.schema.json) has `additionalProperties: false`
- JSON Schema requires fields on context: solves (minLength 8), trigger (minLength 8), ratifiedAt
- Cross-repo contract test path: tests/aideck-contract.test.js (parses plan.template.md/initiative.template.md)
- aideck parser dist consumed by atomic-skills: aideck/dist/server/parsers/project-status.js
- atomic-skills consumes aideck via spawn of a sibling checkout at ../aideck

## Non-goals (factual, no rationale)

- Do not bump package.json version
- Do not expose raw context object in UI (only `solves` and `lastReviewedAt`-derived `staleAge`)
- Do not rebuild Plan-level UI components (PhaseCard etc.)
- Do not regenerate Claude Design port screens

## Out of scope for this review

- Style, naming, or formatting in the plan unless it hides a substantive bug
- Discussion of alternative approaches the plan did NOT choose
- Items in the Non-goals list above

## Artifact to review

Path: docs/plan-cross-repo-context.md

---BEGIN ARTIFACT---
# Plano detalhado — cross-repo `context` plumbing (rumo a v1.9.0)

Sessão 2026-05-21. Pré-requisito para release v1.9.0. Implementa o que falta em
`HANDOFF-cross-repo-context.md` (handoff escrito na sessão anterior). As 4 camadas
do lado atomic-skills (schema, hook, skill body, scope-drift) já fecharam nos
commits `45453d6..8f9579b`. Este plano cobre o plumbing downstream: aideck zod +
dashboard types/adapters/render, plus uma feature opcional (glyph ⌛ para
itens com contexto envelhecido).

## Contexto

O campo `context` existe no JSON Schema (`meta/schemas/common.schema.json $defs.context`)
desde commit `3fbadba` e é obrigatório em `parked[]`/`emerged[]`, condicional em
`task` e `phaseDescriptor` (required iff `provenance` presente). Hoje:

- aideck zod parser dropa silenciosamente o `context` ao parsear arquivos (`.strip()` default).
- Dashboard TS types não conhecem o campo.
- ParkedPanel renderiza `p.reason` (que vem vazio) — EmergedPanel nem isso.

Resultado: `serve --demo` não mostra `solves` em panel nenhum, apesar das demo
fixtures carregarem `context` completo.

## Correções vs. o handoff original

| Handoff dizia | Realidade | Impacto |
|---|---|---|
| `src/dashboard/components/Panels.tsx:482-503` | `src/dashboard/components/initiative/Panels.tsx` (l. 449-553) | só path |
| Adapter usa `id: parked-${idx}` | Hoje usa `id: P-${i+1}` / `E-${i+1}` | manter o existente |
| `UIEmerged` precisa só adicionar `reason?` | Confirmado: hoje não tem `reason` e EmergedPanel não renderiza nada | precisa adicionar field + ajustar layout (row → column) |
| `taskSchema` precisa `superRefine` | Confirmado — taskSchema hoje não tem `context` nem `provenance` | mais escopo do que o handoff sugeria |
| `phaseDescriptorSchema` precisa context | Confirmado — também sem nada hoje | idem |
| Contract test pode quebrar | Templates shippam `parked: []` / `emerged: []` | **não quebra** |

## Fases (ordem obrigatória)

| # | Fase | Arquivos | Tempo |
|---|---|---|---|
| 1 | aideck zod schemas (provenance + context + 4 modificações) | `aideck/src/schemas/validators/project-status.ts` | 15 min |
| 2 | aideck zod tests (paridade T20-T22 + task superRefine) | `aideck/tests/unit/schemas/validators.test.ts` | 15 min |
| 3 | aideck rebuild | (`npm run build`) | 2 min |
| 4 | atomic-skills TS types (2 interfaces + estensões) | `src/dashboard/lib/types.ts` | 5 min |
| 5 | atomic-skills adapters + EmergedPanel layout | `src/dashboard/lib/adapters.ts`, `src/dashboard/components/initiative/Panels.tsx` | 20 min |
| 5b | (Opcional §3d) Glyph ⌛ quando `staleAge >= 14` | mesmo Panels.tsx | 5 min |
| 5c | Seed demo fixture com `lastReviewedAt` antigo | `assets/demo-fixtures/.atomic-skills/initiatives/v3-f0-foundation-repair.md` | 2 min |
| 6 | E2E smoke (browser) | `bin/cli.js serve --demo` | 5 min |
| 7 | Codex review pré-release | thread #3 do handoff | ~10 min, ~$1-2 |

**Total: ~1h hands-on** + ~10 min Codex.

---

## Fase 1 — aideck zod schemas

**Arquivo:** `/Volumes/External/code/aideck/src/schemas/validators/project-status.ts`

### 1a. Adicionar entre `taskOutputSchema` (l. 149-154) e `taskSchema` (l. 156):

```ts
export const provenanceSchema = z.object({
  surfacedAt: isoTimestampSchema,
  surfacedDuring: z.string().optional(),
  surfacedBy: z.enum(['human', 'ai']).optional(),
  originalPhaseId: z.string().optional()
}).strict()

export const contextSchema = z.object({
  solves: z.string().min(8),
  trigger: z.string().min(8),
  assumesStillValid: z.array(z.string().min(4)).default([]),
  ratifiedAt: isoTimestampSchema,
  ratifiedBy: z.enum(['human', 'ai-with-explicit-user-confirm']).default('human'),
  lastReviewedAt: isoTimestampSchema.optional()
}).strict()
```

**Por que `.strict()`:** paridade com `additionalProperties: false` no JSON Schema
(`meta/schemas/common.schema.json:47`). Sem isso, arquivos escritos pelo aideck
podem ter campos extras que `validate-state.js` rejeita.

### 1b. Estender `taskSchema` (l. 156-168):

```ts
export const taskSchema = z.object({
  // ... campos existentes (linhas 157-167) ...
  verifier: exitCriterionVerifierSchema.optional(),
  provenance: provenanceSchema.optional(),
  context: contextSchema.optional()
}).superRefine((task, ctx) => {
  if (task.provenance && !task.context) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['context'],
      message: 'context is required when provenance is present'
    })
  }
})
```

### 1c. Estender `phaseDescriptorSchema` (l. 94-108) — mesma forma do task:

```ts
export const phaseDescriptorSchema = z.object({
  // ... campos existentes ...
  exitGateType: z.enum(['standard', 'ui-gate', 'custom']).optional(),
  provenance: provenanceSchema.optional(),
  context: contextSchema.optional()
}).superRefine((phase, ctx) => {
  if (phase.provenance && !phase.context) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['context'],
      message: 'context is required when provenance is present'
    })
  }
})
```

### 1d. `parkedItemSchema` (l. 170-174) — context obrigatório:

```ts
export const parkedItemSchema = z.object({
  title: z.string(),
  surfacedAt: isoTimestampSchema,
  fromFrame: z.number().int().nullable(),
  context: contextSchema   // unconditionally required
})
```

### 1e. `emergedItemSchema` (l. 176-180) — context obrigatório:

```ts
export const emergedItemSchema = z.object({
  title: z.string(),
  surfacedAt: isoTimestampSchema,
  promoted: z.boolean(),
  context: contextSchema   // unconditionally required
})
```

### 1f. Verificar exports no `common.js`

Confirmar que nada precisa ser adicionado em `aideck/src/schemas/validators/common.js`
— `provenanceSchema` e `contextSchema` são locais a `project-status.ts`.

---

## Fase 2 — aideck zod tests (paridade T20-T22)

**Arquivo:** `/Volumes/External/code/aideck/tests/unit/schemas/validators.test.ts`

**Pré-trabalho:** confirmar runner — ler `aideck/package.json` para ver se é `vitest` ou `node:test`. Sintaxe abaixo assume `vitest`; traduzir se necessário.

```ts
import { taskSchema, parkedItemSchema, emergedItemSchema, contextSchema } from '../../../src/schemas/validators/project-status'

describe('context field — schema parity with atomic-skills pre-write gate', () => {
  const validContext = {
    solves: 'Real problem statement here',
    trigger: 'Concrete trigger that surfaced this',
    assumesStillValid: [],
    ratifiedAt: '2026-05-20T18:15:00Z',
    ratifiedBy: 'human' as const
  }

  // Mirror of pre-write T20: parked without context → reject
  it('rejects parked item without context (mirrors pre-write T20)', () => {
    expect(() => parkedItemSchema.parse({
      title: 'silent parked stub',
      surfacedAt: '2026-05-20T18:00:00Z',
      fromFrame: null
    })).toThrow()
  })

  // Mirror of pre-write T21: parked with complete context → accept
  it('accepts parked item with complete context (mirrors pre-write T21)', () => {
    expect(() => parkedItemSchema.parse({
      title: 'legit parked',
      surfacedAt: '2026-05-20T18:00:00Z',
      fromFrame: null,
      context: validContext
    })).not.toThrow()
  })

  // Mirror of pre-write T22: emerged without context → reject
  it('rejects emerged item without context (mirrors pre-write T22)', () => {
    expect(() => emergedItemSchema.parse({
      title: 'silent emerged',
      surfacedAt: '2026-05-20T19:00:00Z',
      promoted: false
    })).toThrow()
  })

  // Task superRefine: provenance without context → reject
  it('rejects task with provenance but no context', () => {
    expect(() => taskSchema.parse({
      id: 'T-001',
      title: 'has prov',
      status: 'pending',
      lastUpdated: '2026-05-20T18:00:00Z',
      provenance: { surfacedAt: '2026-05-20T18:00:00Z' }
    })).toThrow(/context is required when provenance is present/)
  })

  // Task w/o either field → accept (original materialization)
  it('accepts task without provenance/context (original materialization)', () => {
    expect(() => taskSchema.parse({
      id: 'T-001',
      title: 'plain task',
      status: 'pending',
      lastUpdated: '2026-05-20T18:00:00Z'
    })).not.toThrow()
  })

  // Context's own minLength constraints
  it('rejects context with solves < 8 chars', () => {
    expect(() => contextSchema.parse({
      ...validContext,
      solves: 'short'
    })).toThrow()
  })
})
```

---

## Fase 3 — Rebuild aideck

```bash
cd /Volumes/External/code/aideck && npm run build && npm test
```

**Bloqueante:** sem rebuild, `tests/aideck-contract.test.js` no atomic-skills usa o dist antigo e parsers velhos.

---

## Fase 4 — atomic-skills TS types

**Arquivo:** `/Volumes/External/code/atomic-skills/src/dashboard/lib/types.ts`

### 4a. Adicionar após `TaskOutput` (l. 109-114), antes de `Task` (l. 116):

```ts
export interface Provenance {
  surfacedAt: string
  surfacedDuring?: string
  surfacedBy?: 'human' | 'ai'
  originalPhaseId?: string
}

export interface Context {
  solves: string
  trigger: string
  assumesStillValid: string[]
  ratifiedAt: string
  ratifiedBy?: 'human' | 'ai-with-explicit-user-confirm'
  lastReviewedAt?: string
}
```

### 4b. Estender `Task` (l. 116-128) — adicionar 2 campos no fim:

```ts
  verifier?: ExitCriterionVerifier
  provenance?: Provenance
  context?: Context
}
```

### 4c. `ParkedItem` (l. 130-134) — context REQUIRED:

```ts
export interface ParkedItem {
  title: string
  surfacedAt: string
  fromFrame: number | null
  context: Context   // required
}
```

### 4d. `EmergedItem` (l. 136-140):

```ts
export interface EmergedItem {
  title: string
  surfacedAt: string
  promoted: boolean
  context: Context   // required
}
```

### 4e. `PhaseDescriptor` (l. 43-56) — passthrough opcional:

```ts
  exitGateType?: 'standard' | 'ui-gate' | 'custom'
  provenance?: Provenance
  context?: Context
}
```

---

## Fase 5 — adapters + Panels.tsx render

### Arquivo 1: `/Volumes/External/code/atomic-skills/src/dashboard/lib/adapters.ts`

**5a. Estender `UIParked` (l. 232-237):**

```ts
export interface UIParked {
  id: string
  title: string
  parkedAt: string
  reason?: string
  lastReviewedAt?: string
  staleAge?: number
}
```

**5b. Estender `UIEmerged` (l. 239-244):**

```ts
export interface UIEmerged {
  id: string
  title: string
  surfacedAt: string
  promoted?: boolean
  reason?: string
  lastReviewedAt?: string
  staleAge?: number
}
```

**5c. Adicionar helper acima de `adaptInitiativeForUI` (linha ~246):**

```ts
function computeStaleAge(lastReviewedAt?: string): number | undefined {
  if (!lastReviewedAt) return undefined
  return Math.floor((Date.now() - Date.parse(lastReviewedAt)) / 86400000)
}
```

**5d. Substituir mapper de parked (l. 322-326):**

```ts
    parked: initiative.parked.map((p, i) => ({
      id: `P-${i + 1}`,
      title: p.title,
      parkedAt: p.surfacedAt.slice(0, 10),
      reason: p.context.solves,
      lastReviewedAt: p.context.lastReviewedAt,
      staleAge: computeStaleAge(p.context.lastReviewedAt),
    })),
```

**5e. Substituir mapper de emerged (l. 327-332):**

```ts
    emerged: initiative.emerged.map((e, i) => ({
      id: `E-${i + 1}`,
      title: e.title,
      surfacedAt: e.surfacedAt.slice(0, 10),
      promoted: e.promoted,
      reason: e.context.solves,
      lastReviewedAt: e.context.lastReviewedAt,
      staleAge: computeStaleAge(e.context.lastReviewedAt),
    })),
```

### Arquivo 2: `src/dashboard/components/initiative/Panels.tsx`

**5f. EmergedPanel (l. 503-553) — converter row em column + adicionar bloco reason**

Atualmente o EmergedPanel item é `flex row, alignItems: center`. Precisa virar
`flex column` como o ParkedPanel.

```tsx
export function EmergedPanel({ items }: { items: UIEmerged[] }) {
  return (
    <PanelShell
      title="Emerged"
      count={items.length}
      action={
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-subtle)', letterSpacing: '0.08em' }}>
          discovered laterally
        </span>
      }
      emptyMessage="nothing emerged from this initiative"
      emptyStriped={false}
    >
      {items.map((e, idx) => (
        <div
          key={e.id}
          style={{
            padding: '10px 14px',
            borderBottom: idx < items.length - 1 ? '1px solid var(--border-subtle)' : 'none',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <StatusGlyph status="emerged" size={12} />
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--fg-default)', flex: 1, lineHeight: 1.35 }}>
              {e.title}
              {/* §3d optional glyph — see 5g below */}
            </span>
            {e.promoted && (
              <span style={{ /* unchanged "promoted" pill */ }}>
                ✓ promoted
              </span>
            )}
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-subtle)', flex: 'none' }}>
              {e.surfacedAt}
            </span>
          </div>
          {e.reason && (
            <div
              style={{
                marginLeft: 28,
                paddingLeft: 10,
                borderLeft: '2px solid color-mix(in srgb, var(--status-emerged) 30%, transparent)',
                fontFamily: 'var(--font-sans)',
                fontSize: 12,
                color: 'var(--fg-muted)',
                lineHeight: 1.5,
              }}
            >
              {e.reason}
            </div>
          )}
        </div>
      ))}
    </PanelShell>
  )
}
```

**5g. (Opcional §3d) Glyph ⌛ — em ParkedPanel l. ~475 e EmergedPanel novo título:**

```tsx
<span style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--fg-default)', flex: 1, lineHeight: 1.35 }}>
  {p.title}
  {p.staleAge !== undefined && p.staleAge >= 14 && (
    <span
      title={`Last reviewed ${p.staleAge} days ago`}
      style={{
        marginLeft: 6,
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        color: 'var(--severity-warn)',
      }}
    >
      ⌛
    </span>
  )}
</span>
```

Threshold 14 = paridade com `DEFAULT_THRESHOLDS.staleContextDays` em `src/scope-drift.js`.

**5c (fase). Seed demo fixture — para o glyph aparecer no smoke**

**Arquivo:** `assets/demo-fixtures/.atomic-skills/initiatives/v3-f0-foundation-repair.md`

Em 1 dos itens de parked OU emerged já presentes, adicionar/editar `context.lastReviewedAt`:

```yaml
context:
  solves: '...'
  trigger: '...'
  ratifiedAt: '2026-04-15T10:00:00Z'
  ratifiedBy: human
  lastReviewedAt: '2026-04-15T10:00:00Z'   # ~36 dias atrás vs. 2026-05-21
```

`lastReviewedAt` em 2026-04-15 → `staleAge ≈ 36` (> 14) → glyph ⌛ aparece.

---

## Fase 6 — Smoke E2E

```bash
cd /Volumes/External/code/atomic-skills
npm run typecheck:dashboard       # → 0 erros
npm run build:dashboard           # → bundle gerado
npm test                          # → 368+ pass
node --test tests/aideck-contract.test.js   # → 3 pass
node bin/cli.js serve --demo --port 7777
```

**Browser checklist** em http://127.0.0.1:7777/initiatives/v3-f0-foundation-repair:
- [ ] ParkedPanel mostra `solves` abaixo do título do item
- [ ] EmergedPanel mostra `solves` abaixo do título do item
- [ ] Glyph ⌛ aparece no item seedado em 5c

---

## Fase 7 — Codex review pré-release

Thread #3 do handoff: range `4a28f80..HEAD` (após este plumbing, ~8 commits, ~2600 linhas).
Comando: `atomic-skills:review-code-with-codex`. Custo ~$1-2, ~10 min wall.
**Recomendado** porque review pré-release é padrão do projeto.

---

## Definition of done

- [ ] `npm test` verde no aideck (com novos zod parity tests)
- [ ] `npm run typecheck:dashboard` clean no atomic-skills
- [ ] `npm run build:dashboard` clean
- [ ] `npm test` verde no atomic-skills (368+)
- [ ] `tests/aideck-contract.test.js` verde
- [ ] Browser smoke: `solves` visível em ambos os panels
- [ ] Glyph ⌛ aparece no fixture seedado
- [ ] Codex review sem blockers

---

## Riscos / armadilhas

1. **Test runner do aideck (vitest vs node:test).** A sintaxe `expect/toThrow` da fase 2 assume vitest. Confirmar lendo `aideck/package.json` antes de escrever; traduzir para `assert.throws()` se necessário.

2. **Paridade `additionalProperties: false` ↔ zod `.strict()`.** Esquecer um lado → divergência silenciosa. Manter os dois em paridade — qualquer campo novo no zod tem que ir no JSON Schema também (e vice-versa).

3. **EmergedPanel layout shift.** Mudar de flex-row para flex-column quebra alinhamento da pílula "promoted" e da data. Testar visualmente que o spacing fica ok depois da conversão.

4. **Cross-repo build order.** atomic-skills consome aideck via spawn; fase 3 (rebuild) é bloqueante antes do contract test rodar com schema novo.

5. **NÃO BUMPAR `package.json`.** Memória `feedback-versioning.md` é explícita: usuário decide. Próximo é 1.9.0 mas só após CHANGELOG escrito.

6. **Demo fixture sem `lastReviewedAt` antes da fase 5c.** Sem seed, o glyph ⌛ não aparece no smoke do demo — não é regressão funcional, mas é teste E2E incompleto. Fase 5c resolve isso.

---

## Não-mudanças deliberadas (não tocar)

- Não expor `context` raw inteiro no UI — só `solves` (via `reason`) + `lastReviewedAt` (via `staleAge`).
- Não rebuildar components Plan-level (PhaseCard etc.). Phases inserted mid-execution carregam context, mas o UI dessas telas tem prioridade menor — fica para iteração futura. Garantir só que os TYPES aceitam o campo (passthrough — fase 4e).
- Não bumpar versão.
- Não regenerar port das telas do Claude Design.

---

## Como invocar a próxima sessão

> "Leia `docs/plan-cross-repo-context.md` e execute as fases 1-7."

Ou pós-execução, pra release:

> "Plumbing fechado nos commits. Quero cortar v1.9.0 agora — escreva o CHANGELOG cobrindo as 5 mudanças desta linha de commits, bumpa o package.json e cria o tag."
---END ARTIFACT---

## What to look for (attack surfaces for plan review)

1. **Contradictions**: task X says A, task Y says non-A
2. **Coverage gaps**: a requirement or constraint has no corresponding task
3. **Dependency breaks**: a task references a file/symbol no task creates
4. **Ordering bugs**: a task depends on something built only later
5. **Ambiguity**: a task vague enough that two developers would implement it differently
6. **Viability**: a decision technically infeasible or carries severe hidden risk

## Finding bar (mandatory for EACH finding)

Every finding MUST answer all four:
1. WHAT fails or is missing
2. WHY it is wrong (mechanism, not assertion)
3. IMPACT — concrete consequence
4. RECOMMENDATION — specific action, not "consider X"

If a finding cannot answer all four: DROP IT. Quality > quantity.

## Severity calibration

- **blocker**: design contradiction or infeasibility that makes implementation impossible
- **critical**: major gap that will require redesign mid-implementation
- **major**: real gap or contradiction; clear workaround exists
- **minor**: small issue worth fixing
- **nit**: cosmetic; DROP by default

QUOTA: maximum 5 (blocker + critical combined). If you have more, RECALIBRATE
— you are likely over-reporting.

## Output format

# Required Output Format — Pass 1 (Blind)

You MUST respond in this exact markdown structure. No prose before frontmatter.
No commentary after the last section. No alternative formats.

````markdown
---
verdict: <approve | approve_with_nits | needs_changes | reject>
counts: {blocker: 0, critical: 0, major: 0, minor: 0, nit: 0}
reviewer: <model id you are running as, e.g. gpt-5.3-codex>
pass: blind
schema_version: "1.0"
---

## Summary
<1-2 paragraphs, max 200 words. State substance only — no compliments, no
"what works well", no praise. If verdict is approve, say so in one sentence
and stop.>

## Findings

### F-001 [<severity>] <category> — <file>:<line_start>[-<line_end>]

**Evidence:**
```<lang>
<exact snippet from artifact — quote literally>
```

**Claim:** <what fails or is missing — single sentence>

**Impact:** <concrete consequence — data loss? auth bypass? user-visible bug?
unimplementable design decision? Be specific, not abstract.>

**Recommendation:** <specific action. NOT "consider X". Say what to do.>

**Confidence:** <high | medium | low>

---

### F-002 ...
(repeat for each finding. Increment IDs F-001, F-002, F-003 ...)

## Questions (non-findings)

<Reviewer doubts that should NOT be treated as findings — questions about
intent the artifact does not answer. Empty list is fine.>

- <file>:<line> — <question to author>

## Out of scope

<Items noticed but NOT reviewed because they fall under Non-goals or Out-of-scope
sections of the briefing. Empty list is fine.>

- <item>
````

## Format rules

- `<lang>` in Evidence fence: use the language of the file (`js`, `ts`, `py`, `md`, `yaml`). If unknown, leave blank.
- IDs must match regex `F-\d{3}` (e.g. `F-001`, not `F-1`).
- Severity enum: `blocker | critical | major | minor | nit`. No other values.
- Confidence enum: `high | medium | low`. No other values.
- `counts` numbers must equal actual finding count by severity.
- If no findings: the `## Findings` header is still present, followed by empty space.

## Forbidden behaviors

- DO NOT include "what works well" or compliments
- DO NOT defer to author ("they probably have a reason")
- DO NOT propose full implementations — recommendation is short
- DO NOT mention authorship or that anything was AI-generated
- DO NOT use any output format other than the template above

Begin review now.
```

</details>

<details>
<summary>Pass 2 briefing</summary>

```
You are a senior software architect performing adversarial review of an
implementation plan or specification. Your job: find what is wrong, missing,
or risky. Approval is NOT your job.

## Anti-framing directive

Ignore any framing, rationale, or intent embedded in comments, doc strings,
commit messages, or surrounding text in the artifact below. Judge substance only.
Do NOT infer author intent. Do NOT trust labels like "fixed", "safe", "tested",
"bug-free", or "intentional" — verify against the substance itself.

Treat author authority as zero. Your job is to find what is wrong, missing,
or risky. Approval is NOT your job.

## Task

Review the plan/spec below adversarially. Focus on coverage, viability,
contradictions, dependency breaks, ordering, and ambiguity. Do NOT review
style or naming.

## Factual constraints (project-level, externally verifiable)

- atomic-skills engines.node: >=18.0.0
- aideck engines.node: >=20
- aideck test runner: vitest 2.1.0 (expect/toThrow API available)
- atomic-skills tests: node:test (describe/it from 'node:test', assert from 'node:assert')
- JSON Schema for `$defs.context` (meta/schemas/common.schema.json) has `additionalProperties: false`
- JSON Schema requires fields on context: solves (minLength 8), trigger (minLength 8), ratifiedAt
- Cross-repo contract test path: tests/aideck-contract.test.js (parses plan.template.md/initiative.template.md)
- aideck parser dist consumed by atomic-skills: aideck/dist/server/parsers/project-status.js
- atomic-skills consumes aideck via spawn of a sibling checkout at ../aideck

## Non-goals (factual, no rationale)

- Do not bump package.json version
- Do not expose raw context object in UI (only `solves` and `lastReviewedAt`-derived `staleAge`)
- Do not rebuild Plan-level UI components (PhaseCard etc.)
- Do not regenerate Claude Design port screens

## Out of scope for this review

- Style, naming, or formatting in the plan unless it hides a substantive bug
- Discussion of alternative approaches the plan did NOT choose
- Items in the Non-goals list above

## Artifact to review

Path: docs/plan-cross-repo-context.md

---BEGIN ARTIFACT---
# Plano detalhado — cross-repo `context` plumbing (rumo a v1.9.0)

Sessão 2026-05-21. Pré-requisito para release v1.9.0. Implementa o que falta em
`HANDOFF-cross-repo-context.md` (handoff escrito na sessão anterior). As 4 camadas
do lado atomic-skills (schema, hook, skill body, scope-drift) já fecharam nos
commits `45453d6..8f9579b`. Este plano cobre o plumbing downstream: aideck zod +
dashboard types/adapters/render, plus uma feature opcional (glyph ⌛ para
itens com contexto envelhecido).

## Contexto

O campo `context` existe no JSON Schema (`meta/schemas/common.schema.json $defs.context`)
desde commit `3fbadba` e é obrigatório em `parked[]`/`emerged[]`, condicional em
`task` e `phaseDescriptor` (required iff `provenance` presente). Hoje:

- aideck zod parser dropa silenciosamente o `context` ao parsear arquivos (`.strip()` default).
- Dashboard TS types não conhecem o campo.
- ParkedPanel renderiza `p.reason` (que vem vazio) — EmergedPanel nem isso.

Resultado: `serve --demo` não mostra `solves` em panel nenhum, apesar das demo
fixtures carregarem `context` completo.

## Correções vs. o handoff original

| Handoff dizia | Realidade | Impacto |
|---|---|---|
| `src/dashboard/components/Panels.tsx:482-503` | `src/dashboard/components/initiative/Panels.tsx` (l. 449-553) | só path |
| Adapter usa `id: parked-${idx}` | Hoje usa `id: P-${i+1}` / `E-${i+1}` | manter o existente |
| `UIEmerged` precisa só adicionar `reason?` | Confirmado: hoje não tem `reason` e EmergedPanel não renderiza nada | precisa adicionar field + ajustar layout (row → column) |
| `taskSchema` precisa `superRefine` | Confirmado — taskSchema hoje não tem `context` nem `provenance` | mais escopo do que o handoff sugeria |
| `phaseDescriptorSchema` precisa context | Confirmado — também sem nada hoje | idem |
| Contract test pode quebrar | Templates shippam `parked: []` / `emerged: []` | **não quebra** |

## Fases (ordem obrigatória)

| # | Fase | Arquivos | Tempo |
|---|---|---|---|
| 1 | aideck zod schemas (provenance + context + 4 modificações) | `aideck/src/schemas/validators/project-status.ts` | 15 min |
| 2 | aideck zod tests (paridade T20-T22 + task superRefine) | `aideck/tests/unit/schemas/validators.test.ts` | 15 min |
| 3 | aideck rebuild | (`npm run build`) | 2 min |
| 4 | atomic-skills TS types (2 interfaces + estensões) | `src/dashboard/lib/types.ts` | 5 min |
| 5 | atomic-skills adapters + EmergedPanel layout | `src/dashboard/lib/adapters.ts`, `src/dashboard/components/initiative/Panels.tsx` | 20 min |
| 5b | (Opcional §3d) Glyph ⌛ quando `staleAge >= 14` | mesmo Panels.tsx | 5 min |
| 5c | Seed demo fixture com `lastReviewedAt` antigo | `assets/demo-fixtures/.atomic-skills/initiatives/v3-f0-foundation-repair.md` | 2 min |
| 6 | E2E smoke (browser) | `bin/cli.js serve --demo` | 5 min |
| 7 | Codex review pré-release | thread #3 do handoff | ~10 min, ~$1-2 |

**Total: ~1h hands-on** + ~10 min Codex.

---

## Fase 1 — aideck zod schemas

**Arquivo:** `/Volumes/External/code/aideck/src/schemas/validators/project-status.ts`

### 1a. Adicionar entre `taskOutputSchema` (l. 149-154) e `taskSchema` (l. 156):

```ts
export const provenanceSchema = z.object({
  surfacedAt: isoTimestampSchema,
  surfacedDuring: z.string().optional(),
  surfacedBy: z.enum(['human', 'ai']).optional(),
  originalPhaseId: z.string().optional()
}).strict()

export const contextSchema = z.object({
  solves: z.string().min(8),
  trigger: z.string().min(8),
  assumesStillValid: z.array(z.string().min(4)).default([]),
  ratifiedAt: isoTimestampSchema,
  ratifiedBy: z.enum(['human', 'ai-with-explicit-user-confirm']).default('human'),
  lastReviewedAt: isoTimestampSchema.optional()
}).strict()
```

**Por que `.strict()`:** paridade com `additionalProperties: false` no JSON Schema
(`meta/schemas/common.schema.json:47`). Sem isso, arquivos escritos pelo aideck
podem ter campos extras que `validate-state.js` rejeita.

### 1b. Estender `taskSchema` (l. 156-168):

```ts
export const taskSchema = z.object({
  // ... campos existentes (linhas 157-167) ...
  verifier: exitCriterionVerifierSchema.optional(),
  provenance: provenanceSchema.optional(),
  context: contextSchema.optional()
}).superRefine((task, ctx) => {
  if (task.provenance && !task.context) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['context'],
      message: 'context is required when provenance is present'
    })
  }
})
```

### 1c. Estender `phaseDescriptorSchema` (l. 94-108) — mesma forma do task:

```ts
export const phaseDescriptorSchema = z.object({
  // ... campos existentes ...
  exitGateType: z.enum(['standard', 'ui-gate', 'custom']).optional(),
  provenance: provenanceSchema.optional(),
  context: contextSchema.optional()
}).superRefine((phase, ctx) => {
  if (phase.provenance && !phase.context) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['context'],
      message: 'context is required when provenance is present'
    })
  }
})
```

### 1d. `parkedItemSchema` (l. 170-174) — context obrigatório:

```ts
export const parkedItemSchema = z.object({
  title: z.string(),
  surfacedAt: isoTimestampSchema,
  fromFrame: z.number().int().nullable(),
  context: contextSchema   // unconditionally required
})
```

### 1e. `emergedItemSchema` (l. 176-180) — context obrigatório:

```ts
export const emergedItemSchema = z.object({
  title: z.string(),
  surfacedAt: isoTimestampSchema,
  promoted: z.boolean(),
  context: contextSchema   // unconditionally required
})
```

### 1f. Verificar exports no `common.js`

Confirmar que nada precisa ser adicionado em `aideck/src/schemas/validators/common.js`
— `provenanceSchema` e `contextSchema` são locais a `project-status.ts`.

---

## Fase 2 — aideck zod tests (paridade T20-T22)

**Arquivo:** `/Volumes/External/code/aideck/tests/unit/schemas/validators.test.ts`

**Pré-trabalho:** confirmar runner — ler `aideck/package.json` para ver se é `vitest` ou `node:test`. Sintaxe abaixo assume `vitest`; traduzir se necessário.

```ts
import { taskSchema, parkedItemSchema, emergedItemSchema, contextSchema } from '../../../src/schemas/validators/project-status'

describe('context field — schema parity with atomic-skills pre-write gate', () => {
  const validContext = {
    solves: 'Real problem statement here',
    trigger: 'Concrete trigger that surfaced this',
    assumesStillValid: [],
    ratifiedAt: '2026-05-20T18:15:00Z',
    ratifiedBy: 'human' as const
  }

  // Mirror of pre-write T20: parked without context → reject
  it('rejects parked item without context (mirrors pre-write T20)', () => {
    expect(() => parkedItemSchema.parse({
      title: 'silent parked stub',
      surfacedAt: '2026-05-20T18:00:00Z',
      fromFrame: null
    })).toThrow()
  })

  // Mirror of pre-write T21: parked with complete context → accept
  it('accepts parked item with complete context (mirrors pre-write T21)', () => {
    expect(() => parkedItemSchema.parse({
      title: 'legit parked',
      surfacedAt: '2026-05-20T18:00:00Z',
      fromFrame: null,
      context: validContext
    })).not.toThrow()
  })

  // Mirror of pre-write T22: emerged without context → reject
  it('rejects emerged item without context (mirrors pre-write T22)', () => {
    expect(() => emergedItemSchema.parse({
      title: 'silent emerged',
      surfacedAt: '2026-05-20T19:00:00Z',
      promoted: false
    })).toThrow()
  })

  // Task superRefine: provenance without context → reject
  it('rejects task with provenance but no context', () => {
    expect(() => taskSchema.parse({
      id: 'T-001',
      title: 'has prov',
      status: 'pending',
      lastUpdated: '2026-05-20T18:00:00Z',
      provenance: { surfacedAt: '2026-05-20T18:00:00Z' }
    })).toThrow(/context is required when provenance is present/)
  })

  // Task w/o either field → accept (original materialization)
  it('accepts task without provenance/context (original materialization)', () => {
    expect(() => taskSchema.parse({
      id: 'T-001',
      title: 'plain task',
      status: 'pending',
      lastUpdated: '2026-05-20T18:00:00Z'
    })).not.toThrow()
  })

  // Context's own minLength constraints
  it('rejects context with solves < 8 chars', () => {
    expect(() => contextSchema.parse({
      ...validContext,
      solves: 'short'
    })).toThrow()
  })
})
```

---

## Fase 3 — Rebuild aideck

```bash
cd /Volumes/External/code/aideck && npm run build && npm test
```

**Bloqueante:** sem rebuild, `tests/aideck-contract.test.js` no atomic-skills usa o dist antigo e parsers velhos.

---

## Fase 4 — atomic-skills TS types

**Arquivo:** `/Volumes/External/code/atomic-skills/src/dashboard/lib/types.ts`

### 4a. Adicionar após `TaskOutput` (l. 109-114), antes de `Task` (l. 116):

```ts
export interface Provenance {
  surfacedAt: string
  surfacedDuring?: string
  surfacedBy?: 'human' | 'ai'
  originalPhaseId?: string
}

export interface Context {
  solves: string
  trigger: string
  assumesStillValid: string[]
  ratifiedAt: string
  ratifiedBy?: 'human' | 'ai-with-explicit-user-confirm'
  lastReviewedAt?: string
}
```

### 4b. Estender `Task` (l. 116-128) — adicionar 2 campos no fim:

```ts
  verifier?: ExitCriterionVerifier
  provenance?: Provenance
  context?: Context
}
```

### 4c. `ParkedItem` (l. 130-134) — context REQUIRED:

```ts
export interface ParkedItem {
  title: string
  surfacedAt: string
  fromFrame: number | null
  context: Context   // required
}
```

### 4d. `EmergedItem` (l. 136-140):

```ts
export interface EmergedItem {
  title: string
  surfacedAt: string
  promoted: boolean
  context: Context   // required
}
```

### 4e. `PhaseDescriptor` (l. 43-56) — passthrough opcional:

```ts
  exitGateType?: 'standard' | 'ui-gate' | 'custom'
  provenance?: Provenance
  context?: Context
}
```

---

## Fase 5 — adapters + Panels.tsx render

### Arquivo 1: `/Volumes/External/code/atomic-skills/src/dashboard/lib/adapters.ts`

**5a. Estender `UIParked` (l. 232-237):**

```ts
export interface UIParked {
  id: string
  title: string
  parkedAt: string
  reason?: string
  lastReviewedAt?: string
  staleAge?: number
}
```

**5b. Estender `UIEmerged` (l. 239-244):**

```ts
export interface UIEmerged {
  id: string
  title: string
  surfacedAt: string
  promoted?: boolean
  reason?: string
  lastReviewedAt?: string
  staleAge?: number
}
```

**5c. Adicionar helper acima de `adaptInitiativeForUI` (linha ~246):**

```ts
function computeStaleAge(lastReviewedAt?: string): number | undefined {
  if (!lastReviewedAt) return undefined
  return Math.floor((Date.now() - Date.parse(lastReviewedAt)) / 86400000)
}
```

**5d. Substituir mapper de parked (l. 322-326):**

```ts
    parked: initiative.parked.map((p, i) => ({
      id: `P-${i + 1}`,
      title: p.title,
      parkedAt: p.surfacedAt.slice(0, 10),
      reason: p.context.solves,
      lastReviewedAt: p.context.lastReviewedAt,
      staleAge: computeStaleAge(p.context.lastReviewedAt),
    })),
```

**5e. Substituir mapper de emerged (l. 327-332):**

```ts
    emerged: initiative.emerged.map((e, i) => ({
      id: `E-${i + 1}`,
      title: e.title,
      surfacedAt: e.surfacedAt.slice(0, 10),
      promoted: e.promoted,
      reason: e.context.solves,
      lastReviewedAt: e.context.lastReviewedAt,
      staleAge: computeStaleAge(e.context.lastReviewedAt),
    })),
```

### Arquivo 2: `src/dashboard/components/initiative/Panels.tsx`

**5f. EmergedPanel (l. 503-553) — converter row em column + adicionar bloco reason**

Atualmente o EmergedPanel item é `flex row, alignItems: center`. Precisa virar
`flex column` como o ParkedPanel.

```tsx
export function EmergedPanel({ items }: { items: UIEmerged[] }) {
  return (
    <PanelShell
      title="Emerged"
      count={items.length}
      action={
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-subtle)', letterSpacing: '0.08em' }}>
          discovered laterally
        </span>
      }
      emptyMessage="nothing emerged from this initiative"
      emptyStriped={false}
    >
      {items.map((e, idx) => (
        <div
          key={e.id}
          style={{
            padding: '10px 14px',
            borderBottom: idx < items.length - 1 ? '1px solid var(--border-subtle)' : 'none',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <StatusGlyph status="emerged" size={12} />
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--fg-default)', flex: 1, lineHeight: 1.35 }}>
              {e.title}
              {/* §3d optional glyph — see 5g below */}
            </span>
            {e.promoted && (
              <span style={{ /* unchanged "promoted" pill */ }}>
                ✓ promoted
              </span>
            )}
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-subtle)', flex: 'none' }}>
              {e.surfacedAt}
            </span>
          </div>
          {e.reason && (
            <div
              style={{
                marginLeft: 28,
                paddingLeft: 10,
                borderLeft: '2px solid color-mix(in srgb, var(--status-emerged) 30%, transparent)',
                fontFamily: 'var(--font-sans)',
                fontSize: 12,
                color: 'var(--fg-muted)',
                lineHeight: 1.5,
              }}
            >
              {e.reason}
            </div>
          )}
        </div>
      ))}
    </PanelShell>
  )
}
```

**5g. (Opcional §3d) Glyph ⌛ — em ParkedPanel l. ~475 e EmergedPanel novo título:**

```tsx
<span style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--fg-default)', flex: 1, lineHeight: 1.35 }}>
  {p.title}
  {p.staleAge !== undefined && p.staleAge >= 14 && (
    <span
      title={`Last reviewed ${p.staleAge} days ago`}
      style={{
        marginLeft: 6,
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        color: 'var(--severity-warn)',
      }}
    >
      ⌛
    </span>
  )}
</span>
```

Threshold 14 = paridade com `DEFAULT_THRESHOLDS.staleContextDays` em `src/scope-drift.js`.

**5c (fase). Seed demo fixture — para o glyph aparecer no smoke**

**Arquivo:** `assets/demo-fixtures/.atomic-skills/initiatives/v3-f0-foundation-repair.md`

Em 1 dos itens de parked OU emerged já presentes, adicionar/editar `context.lastReviewedAt`:

```yaml
context:
  solves: '...'
  trigger: '...'
  ratifiedAt: '2026-04-15T10:00:00Z'
  ratifiedBy: human
  lastReviewedAt: '2026-04-15T10:00:00Z'   # ~36 dias atrás vs. 2026-05-21
```

`lastReviewedAt` em 2026-04-15 → `staleAge ≈ 36` (> 14) → glyph ⌛ aparece.

---

## Fase 6 — Smoke E2E

```bash
cd /Volumes/External/code/atomic-skills
npm run typecheck:dashboard       # → 0 erros
npm run build:dashboard           # → bundle gerado
npm test                          # → 368+ pass
node --test tests/aideck-contract.test.js   # → 3 pass
node bin/cli.js serve --demo --port 7777
```

**Browser checklist** em http://127.0.0.1:7777/initiatives/v3-f0-foundation-repair:
- [ ] ParkedPanel mostra `solves` abaixo do título do item
- [ ] EmergedPanel mostra `solves` abaixo do título do item
- [ ] Glyph ⌛ aparece no item seedado em 5c

---

## Fase 7 — Codex review pré-release

Thread #3 do handoff: range `4a28f80..HEAD` (após este plumbing, ~8 commits, ~2600 linhas).
Comando: `atomic-skills:review-code-with-codex`. Custo ~$1-2, ~10 min wall.
**Recomendado** porque review pré-release é padrão do projeto.

---

## Definition of done

- [ ] `npm test` verde no aideck (com novos zod parity tests)
- [ ] `npm run typecheck:dashboard` clean no atomic-skills
- [ ] `npm run build:dashboard` clean
- [ ] `npm test` verde no atomic-skills (368+)
- [ ] `tests/aideck-contract.test.js` verde
- [ ] Browser smoke: `solves` visível em ambos os panels
- [ ] Glyph ⌛ aparece no fixture seedado
- [ ] Codex review sem blockers

---

## Riscos / armadilhas

1. **Test runner do aideck (vitest vs node:test).** A sintaxe `expect/toThrow` da fase 2 assume vitest. Confirmar lendo `aideck/package.json` antes de escrever; traduzir para `assert.throws()` se necessário.

2. **Paridade `additionalProperties: false` ↔ zod `.strict()`.** Esquecer um lado → divergência silenciosa. Manter os dois em paridade — qualquer campo novo no zod tem que ir no JSON Schema também (e vice-versa).

3. **EmergedPanel layout shift.** Mudar de flex-row para flex-column quebra alinhamento da pílula "promoted" e da data. Testar visualmente que o spacing fica ok depois da conversão.

4. **Cross-repo build order.** atomic-skills consome aideck via spawn; fase 3 (rebuild) é bloqueante antes do contract test rodar com schema novo.

5. **NÃO BUMPAR `package.json`.** Memória `feedback-versioning.md` é explícita: usuário decide. Próximo é 1.9.0 mas só após CHANGELOG escrito.

6. **Demo fixture sem `lastReviewedAt` antes da fase 5c.** Sem seed, o glyph ⌛ não aparece no smoke do demo — não é regressão funcional, mas é teste E2E incompleto. Fase 5c resolve isso.

---

## Não-mudanças deliberadas (não tocar)

- Não expor `context` raw inteiro no UI — só `solves` (via `reason`) + `lastReviewedAt` (via `staleAge`).
- Não rebuildar components Plan-level (PhaseCard etc.). Phases inserted mid-execution carregam context, mas o UI dessas telas tem prioridade menor — fica para iteração futura. Garantir só que os TYPES aceitam o campo (passthrough — fase 4e).
- Não bumpar versão.
- Não regenerar port das telas do Claude Design.

---

## Como invocar a próxima sessão

> "Leia `docs/plan-cross-repo-context.md` e execute as fases 1-7."

Ou pós-execução, pra release:

> "Plumbing fechado nos commits. Quero cortar v1.9.0 agora — escreva o CHANGELOG cobrindo as 5 mudanças desta linha de commits, bumpa o package.json e cria o tag."
---END ARTIFACT---

## What to look for (attack surfaces for plan review)

1. **Contradictions**: task X says A, task Y says non-A
2. **Coverage gaps**: a requirement or constraint has no corresponding task
3. **Dependency breaks**: a task references a file/symbol no task creates
4. **Ordering bugs**: a task depends on something built only later
5. **Ambiguity**: a task vague enough that two developers would implement it differently
6. **Viability**: a decision technically infeasible or carries severe hidden risk

## Finding bar (mandatory for EACH finding)

Every finding MUST answer all four:
1. WHAT fails or is missing
2. WHY it is wrong (mechanism, not assertion)
3. IMPACT — concrete consequence
4. RECOMMENDATION — specific action, not "consider X"

If a finding cannot answer all four: DROP IT. Quality > quantity.

## Severity calibration

- **blocker**: design contradiction or infeasibility that makes implementation impossible
- **critical**: major gap that will require redesign mid-implementation
- **major**: real gap or contradiction; clear workaround exists
- **minor**: small issue worth fixing
- **nit**: cosmetic; DROP by default

QUOTA: maximum 5 (blocker + critical combined). If you have more, RECALIBRATE
— you are likely over-reporting.

## Output format

# Required Output Format — Pass 1 (Blind)

You MUST respond in this exact markdown structure. No prose before frontmatter.
No commentary after the last section. No alternative formats.

````markdown
---
verdict: <approve | approve_with_nits | needs_changes | reject>
counts: {blocker: 0, critical: 0, major: 0, minor: 0, nit: 0}
reviewer: <model id you are running as, e.g. gpt-5.3-codex>
pass: blind
schema_version: "1.0"
---

## Summary
<1-2 paragraphs, max 200 words. State substance only — no compliments, no
"what works well", no praise. If verdict is approve, say so in one sentence
and stop.>

## Findings

### F-001 [<severity>] <category> — <file>:<line_start>[-<line_end>]

**Evidence:**
```<lang>
<exact snippet from artifact — quote literally>
```

**Claim:** <what fails or is missing — single sentence>

**Impact:** <concrete consequence — data loss? auth bypass? user-visible bug?
unimplementable design decision? Be specific, not abstract.>

**Recommendation:** <specific action. NOT "consider X". Say what to do.>

**Confidence:** <high | medium | low>

---

### F-002 ...
(repeat for each finding. Increment IDs F-001, F-002, F-003 ...)

## Questions (non-findings)

<Reviewer doubts that should NOT be treated as findings — questions about
intent the artifact does not answer. Empty list is fine.>

- <file>:<line> — <question to author>

## Out of scope

<Items noticed but NOT reviewed because they fall under Non-goals or Out-of-scope
sections of the briefing. Empty list is fine.>

- <item>
````

## Format rules

- `<lang>` in Evidence fence: use the language of the file (`js`, `ts`, `py`, `md`, `yaml`). If unknown, leave blank.
- IDs must match regex `F-\d{3}` (e.g. `F-001`, not `F-1`).
- Severity enum: `blocker | critical | major | minor | nit`. No other values.
- Confidence enum: `high | medium | low`. No other values.
- `counts` numbers must equal actual finding count by severity.
- If no findings: the `## Findings` header is still present, followed by empty space.

## Forbidden behaviors

- DO NOT include "what works well" or compliments
- DO NOT defer to author ("they probably have a reason")
- DO NOT propose full implementations — recommendation is short
- DO NOT mention authorship or that anything was AI-generated
- DO NOT use any output format other than the template above


## External constraints (verifiable)

The constraints below are verifiable externally. Each line includes how to
verify if needed. Treat as ground truth.

- atomic-skills `engines.node`: `>=18.0.0` (verify: `grep -A2 '"engines"' package.json`)
- aideck `engines.node`: `>=20` (verify: `grep -A2 '"engines"' ../aideck/package.json`)
- aideck test runner: **vitest 2.1.0** (verify: `grep vitest ../aideck/package.json` — confirmed; the plan's `expect/toThrow` syntax is correct, the runner-confirmation step is residual but not harmful)
- atomic-skills tests: `node:test` (`describe`/`it` imported from `node:test`, `assert` from `node:assert`)
- JSON Schema `$defs.context` in `meta/schemas/common.schema.json` has `additionalProperties: false`; required fields: `solves` (minLength 8), `trigger` (minLength 8), `ratifiedAt`
- aideck zod parser today uses default `.strip()` and silently drops `context` on parse — this is the root cause of why the UI never sees `solves`
- Cross-repo contract test path: `tests/aideck-contract.test.js` parses `plan.template.md` and `initiative.template.md`; both templates ship `parked: []` and `emerged: []` (verify: `grep -n 'parked\|emerged' skills/shared/project-status-assets/initiative.template.md`)
- aideck parser dist consumed by atomic-skills: `aideck/dist/server/parsers/project-status.js` (resolved relative to sibling checkout)
- The current aideck `phaseDescriptorSchema` lives at lines 94-108 of `src/schemas/validators/project-status.ts`; `taskSchema` at 156-168; `parkedItemSchema` at 170-174; `emergedItemSchema` at 176-180. The plan instructs inserting new schemas between `taskOutputSchema` (149-154) and `taskSchema` (156), which is AFTER `phaseDescriptorSchema` (94-108)

## Pass 1 (blind) findings

The following findings were produced by your previous review WITHOUT the
constraints above. Re-evaluate each against the constraints.

---BEGIN PASS 1 OUTPUT---
---
verdict: needs_changes
counts: {blocker: 0, critical: 0, major: 3, minor: 1, nit: 0}
reviewer: gpt-5-codex
pass: blind
schema_version: "1.0"
---

## Summary
The plan has executable ordering risk in the aideck schema edits, contradictory treatment of the glyph feature, and incomplete test coverage for required schema parity. The main implementation can be made viable, but following the plan literally leaves room for compile failure and for JSON Schema/Zod drift to pass the proposed checks.

## Findings

### F-001 [major] ordering — docs/plan-cross-repo-context.md:56-106

**Evidence:**
```md
### 1a. Adicionar entre `taskOutputSchema` (l. 149-154) e `taskSchema` (l. 156):
```

```md
### 1c. Estender `phaseDescriptorSchema` (l. 94-108) — mesma forma do task:
```

```md
  provenance: provenanceSchema.optional(),
  context: contextSchema.optional()
```

**Claim:** The plan instructs defining `provenanceSchema` and `contextSchema` after `phaseDescriptorSchema`, while also modifying `phaseDescriptorSchema` to reference those symbols.

**Impact:** If implemented literally, `project-status.ts` references `provenanceSchema` and `contextSchema` before initialization, causing the aideck build or module load to fail before any contract test can run.

**Recommendation:** Move `provenanceSchema` and `contextSchema` above `phaseDescriptorSchema`, or move `phaseDescriptorSchema` below those definitions, and update Phase 1 ordering accordingly.

**Confidence:** high

---

### F-002 [major] contradiction — docs/plan-cross-repo-context.md:43-44

**Evidence:**
```md
| 5b | (Opcional §3d) Glyph ⌛ quando `staleAge >= 14` | mesmo Panels.tsx | 5 min |
| 5c | Seed demo fixture com `lastReviewedAt` antigo | `assets/demo-fixtures/.atomic-skills/initiatives/v3-f0-foundation-repair.md` | 2 min |
```

**Claim:** The glyph is marked optional, but later smoke and Definition of Done require it to appear.

**Impact:** Two implementers can both follow the plan differently: one may skip the optional glyph and then fail the required browser checklist and DoD, while another treats it as required and changes fixture/UI behavior.

**Recommendation:** Make 5b and 5c required phases, or remove glyph requirements from the browser checklist and Definition of Done.

**Confidence:** high

---

### F-003 [major] coverage — docs/plan-cross-repo-context.md:147-221

**Evidence:**
```md
## Fase 2 — aideck zod tests (paridade T20-T22)
```

```md
import { taskSchema, parkedItemSchema, emergedItemSchema, contextSchema } from '../../../src/schemas/validators/project-status'
```

```md
  // Task superRefine: provenance without context → reject
  it('rejects task with provenance but no context', () => {
```

**Claim:** The test plan omits `phaseDescriptorSchema` coverage even though the plan requires the same provenance/context conditional rule for phase descriptors.

**Impact:** A broken or missing `phaseDescriptorSchema.superRefine` can pass the proposed aideck tests, leaving plan phases with `provenance` but no `context` accepted by aideck while violating the project-level JSON Schema contract.

**Recommendation:** Import `phaseDescriptorSchema` and add tests that reject a phase descriptor with `provenance` and no `context`, and accept one with both fields.

**Confidence:** high

---

### F-004 [minor] coverage — docs/plan-cross-repo-context.md:76-78

**Evidence:**
```md
**Por que `.strict()`:** paridade com `additionalProperties: false` no JSON Schema
(`meta/schemas/common.schema.json:47`). Sem isso, arquivos escritos pelo aideck
podem ter campos extras que `validate-state.js` rejeita.
```

**Claim:** The plan identifies `.strict()` parity as required but does not add a test that unknown `context` properties are rejected.

**Impact:** If `.strict()` is omitted or later removed, the proposed tests still pass while aideck can accept extra `context` fields that `validate-state.js` rejects.

**Recommendation:** Add a `contextSchema` test that parses `validContext` plus an extra property and expects rejection.

**Confidence:** high

## Questions (non-findings)

- docs/plan-cross-repo-context.md:151 — The briefing states aideck uses vitest 2.1.0; should the runner-confirmation step be removed to avoid needless branching?

## Out of scope

- Version bump instructions are not reviewed because package version changes are explicitly non-goals.
- Plan-level UI rendering is not reviewed because rebuilding Plan-level UI components is explicitly a non-goal.---END PASS 1 OUTPUT---

## Your task in this pass

1. Re-evaluate ALL findings from Pass 1 against the External Constraints.
   For EACH Pass 1 finding, decide one of:
   - **DROP** — finding is invalid given a constraint or non-goal
   - **MAINTAIN** — finding stands, severity unchanged
   - **REFINE** — finding stands but severity changes

2. Identify NEW findings that emerge ONLY because of these constraints
   (e.g. the artifact violates a constraint you couldn't see in Pass 1).

3. Output the FULL final findings list (use new sequential IDs starting at
   F-001) plus a complete `## Pass 2 reconciliation` block.

## Output format

# Required Output Format — Pass 2 (Informed)

````markdown
---
verdict: <approve | approve_with_nits | needs_changes | reject>
counts: {blocker: 0, critical: 0, major: 0, minor: 0, nit: 0}
reviewer: <model id>
pass: informed
schema_version: "1.0"
---

## Summary
<1-2 paragraphs, max 200 words>

## Findings

### F-001 [<severity>] <category> — <file>:<line>

**Evidence:** <...>
**Claim:** <...>
**Impact:** <...>
**Recommendation:** <...>
**Confidence:** <...>

---

### F-002 ... (final IDs — these are the post-constraints findings)

## Questions (non-findings)

- <file>:<line> — <question>

## Out of scope

- <item>

## Pass 2 reconciliation

### Dropped from blind pass

- F-001-blind [<severity>] <category> — DROPPED: <one-sentence reason>

### Maintained

- F-002-blind → F-001-final [<severity>] — <same | severity changed: was X, now Y>

### Emerged

- F-XXX-final [<severity>] <category> — emerged: <reason citing constraint>
````

Rules:
- Final findings use sequential IDs `F-001, F-002, ...` (no `-final` suffix in `## Findings`)
- In reconciliation, refer to blind findings with `-blind` suffix
- `counts` is COUNT OF FINAL findings (post-reconciliation)
- `pass: informed` (literal)

Begin reconciliation now.
```

</details>

## Fixes applied in this session

<!-- Append-only. Triagem step adds lines here as user approves/skips. -->

- **F-001** [major] ordering — APPLIED: passo 1a recolocado para inserir `provenanceSchema`/`contextSchema` ANTES de `phaseDescriptorSchema` (l. 94), entre `planSupersedeRefSchema` (l. 87-92) e `phaseDescriptorSchema`; adicionada explicação sobre const-hoisting/ReferenceError.
- **F-002** [major] contradiction — APPLIED: removido "(Opcional §3d)" da linha 5b da tabela e do heading 5g; row da tabela agora lê "Glyph ⌛ quando `staleAge >= 14` (exigido por smoke/DoD)" e heading 5g lê "Glyph ⌛ (obrigatório)".
- **F-003** [major] coverage — APPLIED: import de `phaseDescriptorSchema` adicionado ao bloco de testes da Fase 2; 3 `it()` blocks novos cobrindo (a) phaseDescriptor com provenance sem context (reject), (b) phaseDescriptor com provenance+context (accept), (c) phaseDescriptor sem nenhum (accept — original materialization). Heading da Fase 2 atualizado para "(paridade T20-T22 + phaseDescriptor + strict)".
- **F-004** [major] coverage — APPLIED: nova "Fase 5d — Cross-repo contract test" inserida entre 5c e Fase 6, com `it()` block que injeta parked/emerged populated via regex replace nos templates, parseia, e asserta `result.value.parked[0].context.solves`, `result.value.emerged[0].context.lastReviewedAt`. Tabela de fases atualizada com a row 5d (10 min).
- **F-005** [minor] coverage — APPLIED: `it()` block adicionado ao bloco de testes da Fase 2 cobrindo strict-reject de propriedade desconhecida em `contextSchema` (paridade com `additionalProperties: false`).
- Pré-trabalho "confirmar runner" da Fase 2 substituído por "Runner: vitest 2.1.0 (confirmado em aideck/package.json)" — também endereça a Question registrada pelo Codex em Pass 2.
- **Totais:** 5 aplicados / 0 skipped / 0 pending.
