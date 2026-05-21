# Handoff — cross-repo `context` plumbing (atomic-skills ↔ aideck ↔ dashboard)

Documento de carry-over para o trabalho que falta antes de cortar **v1.9.0**. Esta sessão (2026-05-21) fechou as 4 camadas do lado atomic-skills (schema, hook, skill body, scope-drift). Falta propagar o campo `context` para os dois consumidores downstream que não enxergam ele ainda. Sem este trabalho, o release funciona — mas o dashboard nunca mostra `solves`/`trigger`/`ratifiedAt`, e o aideck dropa silenciosamente os campos no parse.

## TL;DR

3 arquivos para editar, ~1h de trabalho, sem mudanças de comportamento — só plumbing.

| Arquivo | O que muda |
|---|---|
| `/Volumes/External/code/aideck/src/schemas/validators/project-status.ts` | Adicionar `contextSchema` zod + estender `taskSchema` + tornar `parkedItemSchema`/`emergedItemSchema` exigirem o campo |
| `/Volumes/External/code/atomic-skills/src/dashboard/lib/types.ts` | Adicionar `interface Context` + estender `Task`/`ParkedItem`/`EmergedItem`/`PhaseDescriptor` |
| `/Volumes/External/code/atomic-skills/src/dashboard/lib/adapters.ts` | Mapear `context.solves` para os fields `reason?` que os Panels já renderizam, plus surface `lastReviewedAt` no UI* |

\* O field `UIParked.reason` já existe e já é renderizado em `Panels.tsx:482-495`. Hoje vem de algum lugar opcional do schema (provavelmente vazio). Mapear `context.solves` para ele entrega "solves visible no dashboard" sem mudança no componente.

## Estado atual (o que está pronto)

Commits desta sessão no atomic-skills:
- `45453d6` — pre-write.sh hook (HANDOFF #2 — provenance gate)
- `3fbadba` — ratify mandatory + context schema obrigatório em parked/emerged
- `46add74` — hook estende para parked/emerged + staleContextDays config
- `<HEAD>` — computeStaleContext em src/scope-drift.js

Schema é fonte da verdade: `meta/schemas/common.schema.json $defs.context` (linhas ~22 em diante). 6 campos:
- `solves` (string, ≥8 chars, required)
- `trigger` (string, ≥8 chars, required)
- `assumesStillValid` (array de strings ≥4 chars, default `[]`)
- `ratifiedAt` (ISO timestamp, required)
- `ratifiedBy` (`"human" | "ai-with-explicit-user-confirm"`, default `human`)
- `lastReviewedAt` (ISO timestamp, opcional na prática mas sempre setado pelos comandos)

`additionalProperties: false`, então campos extras são rejeitados.

Conditional: required iff `provenance` está presente, em `task` e `phaseDescriptor`. Required unconditionally em `parked[]` e `emerged[]`.

## Mudanças por arquivo

### 1. aideck — `src/schemas/validators/project-status.ts`

Linhas ~155-180. Substituir:

```ts
export const taskSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  status: taskStatusSchema,
  lastUpdated: isoTimestampSchema,
  closedAt: isoTimestampSchema.optional(),
  blockedBy: z.array(z.string()).optional(),
  outputs: z.array(taskOutputSchema).optional(),
  tags: z.array(z.string()).optional(),
  resourceCounts: z.record(z.number()).optional(),
  verifier: exitCriterionVerifierSchema.optional()
})

export const parkedItemSchema = z.object({
  title: z.string(),
  surfacedAt: isoTimestampSchema,
  fromFrame: z.number().int().nullable()
})

export const emergedItemSchema = z.object({
  title: z.string(),
  surfacedAt: isoTimestampSchema,
  promoted: z.boolean()
})
```

Por:

```ts
export const provenanceSchema = z.object({
  surfacedAt: isoTimestampSchema,
  surfacedDuring: z.string().optional(),
  surfacedBy: z.enum(['human', 'ai']).optional(),
  originalPhaseId: z.string().optional()
})

export const contextSchema = z.object({
  solves: z.string().min(8),
  trigger: z.string().min(8),
  assumesStillValid: z.array(z.string().min(4)).default([]),
  ratifiedAt: isoTimestampSchema,
  ratifiedBy: z.enum(['human', 'ai-with-explicit-user-confirm']).default('human'),
  lastReviewedAt: isoTimestampSchema.optional()
})

export const taskSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  status: taskStatusSchema,
  lastUpdated: isoTimestampSchema,
  closedAt: isoTimestampSchema.optional(),
  blockedBy: z.array(z.string()).optional(),
  outputs: z.array(taskOutputSchema).optional(),
  tags: z.array(z.string()).optional(),
  resourceCounts: z.record(z.number()).optional(),
  verifier: exitCriterionVerifierSchema.optional(),
  provenance: provenanceSchema.optional(),
  context: contextSchema.optional()
}).superRefine((task, ctx) => {
  // Schema parity with initiative.schema.json: if provenance is present,
  // context becomes mandatory. Without superRefine, zod's z.object() would
  // accept the partial state.
  if (task.provenance && !task.context) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['context'],
      message: 'context is required when provenance is present'
    })
  }
})

export const parkedItemSchema = z.object({
  title: z.string(),
  surfacedAt: isoTimestampSchema,
  fromFrame: z.number().int().nullable(),
  context: contextSchema  // unconditionally required
})

export const emergedItemSchema = z.object({
  title: z.string(),
  surfacedAt: isoTimestampSchema,
  promoted: z.boolean(),
  context: contextSchema  // unconditionally required
})
```

E em `phaseDescriptorSchema` (procure por `phaseDescriptor` no mesmo arquivo — não está nos trechos lidos hoje mas vai estar): adicione `context: contextSchema.optional()` + superRefine análogo ao taskSchema.

**Heads-up:** o aideck usa essas validators no parser que lê arquivos `.atomic-skills/*.md`. Hoje, com `.strip()` default do zod, ele silenciosamente descarta o `context` ao parsear, e o backend nunca expõe ele no REST. Adicionar o schema é o que faz o campo CHEGAR no JSON do endpoint `/api/initiatives/:slug`.

**Testes a atualizar no aideck:** procure por `parkedItemSchema.parse(`/`emergedItemSchema.parse(` nos arquivos `aideck/src/**/*.test.ts`. As fixtures de teste vão precisar ganhar o `context` block ou a validação vai começar a falhar.

### 2. atomic-skills — `src/dashboard/lib/types.ts`

Linhas 116-140. Substituir:

```ts
export interface Task {
  id: string
  title: string
  description?: string
  status: TaskStatus
  lastUpdated: string
  closedAt?: string
  blockedBy?: string[]
  outputs?: TaskOutput[]
  tags?: string[]
  resourceCounts?: Record<string, number>
  verifier?: ExitCriterionVerifier
}

export interface ParkedItem {
  title: string
  surfacedAt: string
  fromFrame: number | null
}

export interface EmergedItem {
  title: string
  surfacedAt: string
  promoted: boolean
}
```

Por:

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

export interface Task {
  id: string
  title: string
  description?: string
  status: TaskStatus
  lastUpdated: string
  closedAt?: string
  blockedBy?: string[]
  outputs?: TaskOutput[]
  tags?: string[]
  resourceCounts?: Record<string, number>
  verifier?: ExitCriterionVerifier
  provenance?: Provenance
  context?: Context
}

export interface ParkedItem {
  title: string
  surfacedAt: string
  fromFrame: number | null
  context: Context  // required — parked items are always emergent
}

export interface EmergedItem {
  title: string
  surfacedAt: string
  promoted: boolean
  context: Context  // required — same rule as parked
}
```

E na `PhaseDescriptor` interface (linha ~43), adicione `provenance?: Provenance` e `context?: Context`.

### 3. atomic-skills — `src/dashboard/lib/adapters.ts`

Linhas 232-244 e ~320-330 (a função `adaptInitiativeForUI` ou similar que constrói `UIParked`/`UIEmerged`).

Mudanças mínimas:

**a)** Em `UIParked` e `UIEmerged`, adicione `lastReviewedAt?: string` e `staleAge?: number`. O `reason?` já existe — vai virar canonical "solves".

```ts
export interface UIParked {
  id: string
  title: string
  parkedAt: string
  reason?: string           // mapped from context.solves
  lastReviewedAt?: string   // mapped from context.lastReviewedAt
  staleAge?: number         // days since lastReviewedAt — computed
}

export interface UIEmerged {
  id: string
  title: string
  surfacedAt: string
  promoted?: boolean
  reason?: string           // NEW — mapped from context.solves
  lastReviewedAt?: string
  staleAge?: number
}
```

**b)** Na função que mapeia (linha ~325 onde está `parkedAt: p.surfacedAt.slice(0, 10)`):

```ts
parked: initiative.parked.map((p, idx) => ({
  id: `parked-${idx}`,
  title: p.title,
  parkedAt: p.surfacedAt.slice(0, 10),
  reason: p.context.solves,                    // NEW
  lastReviewedAt: p.context.lastReviewedAt,    // NEW
  staleAge: p.context.lastReviewedAt
    ? Math.floor((Date.now() - Date.parse(p.context.lastReviewedAt)) / 86400000)
    : undefined,
})),
emerged: initiative.emerged.map((e, idx) => ({
  id: `emerged-${idx}`,
  title: e.title,
  surfacedAt: e.surfacedAt.slice(0, 10),
  promoted: e.promoted,
  reason: e.context.solves,                    // NEW
  lastReviewedAt: e.context.lastReviewedAt,    // NEW
  staleAge: /* same shape */,
})),
```

**c)** Em `Panels.tsx` linha 503 (EmergedPanel), espelhe o tratamento de `p.reason` do ParkedPanel — hoje EmergedPanel não renderiza reason. Adicione o mesmo bloco `{p.reason && (<div ...>{p.reason}</div>)}` para emerged também.

**d)** (Opcional, nice-to-have) Adicionar um glyph `⌛` ao lado do título quando `staleAge && staleAge >= 14` — alinha visualmente com o que o terminal view faz.

## Como testar (smoke)

```bash
# 1. Build atomic-skills + aideck:
cd /Volumes/External/code/aideck && npm run build && npm test
cd /Volumes/External/code/atomic-skills && npm run typecheck:dashboard && npm run build:dashboard

# 2. Cross-repo contract test deve continuar passando:
cd /Volumes/External/code/atomic-skills
node --test tests/aideck-contract.test.js

# 3. End-to-end com fixtures que JÁ TÊM context:
node bin/cli.js serve --demo --port 7777
# Abra http://127.0.0.1:7777/initiatives/v3-f0-foundation-repair
# Esperado: ParkedPanel mostra o `solves` ("Int tenant_id forces...") abaixo do título.
#           EmergedPanel mostra o `solves` ("Without a versioned canary...") abaixo do título.
```

## Critério de aceite (definition of done)

- [ ] `npm run typecheck:dashboard` clean
- [ ] `npm run build:dashboard` clean
- [ ] `npm test` em ambos os repos verde
- [ ] `tests/aideck-contract.test.js` verde
- [ ] `serve --demo` mostra `solves` em parked + emerged dos demo fixtures
- [ ] Schema parity: aideck zod rejeita parked sem context (replicar T20-T22 do `tests/hooks/pre-write.test.sh` no estilo zod)

## Não-mudanças deliberadas (não toque)

- **Não exponha o `context` raw inteiro no UI.** Só `solves` (via `reason`) + `lastReviewedAt` (via `staleAge`). Trigger e assumesStillValid são visíveis via `why <id>` no terminal — UI não precisa duplicar.
- **Não rebuild os components de Plan-level (`PhaseCard`, etc).** Phases inserted mid-execution carregam `context`, mas o UI dessas telas tem prioridade menor — fica para uma iteração futura. Apenas garanta que os TYPES aceitam o campo (passthrough).
- **Não bumpe versão.** O release ritual é separado (1.8.1 → 1.9.0 + CHANGELOG + tag). Esse handoff é só plumbing.

## Riscos / armadilhas

1. **Cross-repo build order.** atomic-skills consome aideck via spawn; mudar o schema do aideck sem rebuild dele faz a fixture do `tests/aideck-contract.test.js` falhar. Sempre rebuild aideck PRIMEIRO.

2. **Demo fixtures.** Já têm `context` completo (commit `3fbadba`). Se você editar manualmente os arquivos em `assets/demo-fixtures/.atomic-skills/`, mantenha o context — caso contrário `serve --demo` vai falhar validação.

3. **superRefine vs schema composition.** Zod tem várias formas de expressar o "context required iff provenance". `superRefine` é a mais limpa para essa lógica condicional. Evite `.refine` no schema raiz se possível — ele não compõe bem com `.parse()` em arrays.

4. **`additionalProperties: false` no JSON Schema** quer dizer que se você adicionar campos no `context` zod que NÃO estão no JSON Schema, o `validate-state.js` vai rejeitar arquivos escritos pelo aideck. Mantenha as duas definições em paridade.

## Próximos passos depois desse handoff

Quando este trabalho fechar:

1. Rodar `atomic-skills:review-code-with-codex` contra o range das últimas N sessões para sanity check antes do release (custo ~$1-2, ~10 min wall).
2. Escrever `CHANGELOG.md` cobrindo: pre-write hook, context schema obrigatório, ratify gate, why/re-ratify, scope-drift staleness, cross-repo plumbing.
3. `package.json` 1.8.1 → 1.9.0, `git tag v1.9.0`, `npm publish` se aplicável.

## Como invocar a próxima sessão

> "Leia HANDOFF-cross-repo-context.md no root e execute o que estiver lá. Quero zerar isso antes do tag v1.9.0."
