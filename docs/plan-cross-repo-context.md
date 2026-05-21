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
