import { z } from 'zod'
import {
  artifactRefSchema,
  isoTimestampSchema,
  schemaVersionSchema
} from './common.js'

export const taskStatusSchema = z.enum(['pending', 'active', 'done', 'blocked'])
export const initiativeStatusSchema = z.enum(['pending', 'active', 'paused', 'done', 'archived'])
export const planStatusSchema = z.enum(['active', 'paused', 'done', 'archived'])
export const stackFrameTypeSchema = z.enum(['task', 'research', 'validation', 'discussion'])
export const gateStatusSchema = z.enum(['pending', 'met', 'deferred'])

export const exitCriterionVerifierSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('shell'),
    command: z.string(),
    expectExitCode: z.number().int().optional()
  }),
  z.object({
    kind: z.literal('query'),
    sql: z.string(),
    expectRowCount: z.number().int().optional()
  }),
  z.object({
    kind: z.literal('test'),
    runner: z.string(),
    pattern: z.string()
  }),
  z.object({
    kind: z.literal('manual'),
    description: z.string()
  })
])

export const evidenceBlockSchema = z
  .object({
    verifierKind: z.enum(['shell', 'query', 'test', 'manual']),
    verifiedAt: isoTimestampSchema,
    passed: z.boolean().optional(),
    exitCode: z.number().int().optional(),
    rowCount: z.number().int().nonnegative().optional(),
    outputSummary: z.string().optional()
  })
  .strict()

export const exitCriterionSchema = z
  .object({
    id: z.string(),
    description: z.string(),
    verifier: exitCriterionVerifierSchema.optional(),
    status: gateStatusSchema,
    metAt: isoTimestampSchema.optional(),
    deferredReason: z.string().optional(),
    evidence: evidenceBlockSchema.optional()
  })
  .strict()

export const phaseExitGateSchema = z.object({
  summary: z.string(),
  criteria: z.array(exitCriterionSchema)
})

export const principleSchema = z.object({
  id: z.string(),
  title: z.string(),
  body: z.string()
})

export const glossaryTermSchema = z.object({
  term: z.string(),
  definition: z.string()
})

export const trackSchema = z.object({
  id: z.string(),
  title: z.string(),
  domain: z.string().optional()
})

export const interPhaseGateSchema = z.object({
  from: z.string(),
  to: z.string(),
  criteria: z.array(z.string())
})

export const planSupersedeRefSchema = z.object({
  path: z.string(),
  supersedeScope: z.enum(['full', 'partial']),
  partialAreas: z.array(z.string()).optional(),
  remainsValid: z.array(z.string()).optional()
})

export const phaseDescriptorSchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  goal: z.string(),
  dependsOn: z.array(z.string()),
  parallelWith: z.array(z.string()).optional(),
  track: z.string().optional(),
  audience: z.string().optional(),
  subPhaseCount: z.number().int().nonnegative(),
  exitGate: phaseExitGateSchema,
  status: initiativeStatusSchema,
  externalImports: z.array(artifactRefSchema).optional(),
  exitGateType: z.enum(['standard', 'ui-gate', 'custom']).optional()
})

export const planSchema = z
  .object({
    schemaVersion: schemaVersionSchema,
    slug: z.string(),
    title: z.string(),
    version: z.string(),
    narrative: z.string(),
    status: planStatusSchema,
    started: isoTimestampSchema,
    lastUpdated: isoTimestampSchema,
    branch: z.string().optional(),
    currentPhase: z.string().nullable(),
    parallelismAllowed: z.boolean(),
    principles: z.array(principleSchema).optional(),
    glossary: z.array(glossaryTermSchema).optional(),
    phases: z.array(phaseDescriptorSchema),
    interPhaseGates: z.array(interPhaseGateSchema).optional(),
    tracks: z.array(trackSchema).optional(),
    supersedes: planSupersedeRefSchema.optional(),
    references: z.array(artifactRefSchema).optional(),
    whatStaysValid: z.array(z.string()).optional()
  })
  .strict()

// ─────────────────────────────────────────────────────────────────────────────
// INITIATIVE
// ─────────────────────────────────────────────────────────────────────────────

export const initiativeScopeSchema = z.object({
  paths: z.array(z.string())
})

export const stackFrameSchema = z.object({
  id: z.number().int(),
  title: z.string(),
  type: stackFrameTypeSchema,
  openedAt: isoTimestampSchema
})

export const taskOutputSchema = z.object({
  kind: z.enum(['command', 'file', 'migration', 'json', 'test']),
  path: z.string().optional(),
  command: z.string().optional(),
  description: z.string().optional()
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
  verifier: exitCriterionVerifierSchema.optional()
})

export const planningContextSchema = z
  .object({
    solves: z.string(),
    trigger: z.string(),
    assumesStillValid: z.array(z.string()),
    ratifiedAt: isoTimestampSchema.optional(),
    ratifiedBy: z.enum(['human', 'ai']).optional(),
    lastReviewedAt: isoTimestampSchema.optional()
  })
  .strict()

export const parkedItemSchema = z.object({
  title: z.string(),
  surfacedAt: isoTimestampSchema,
  fromFrame: z.number().int().nullable(),
  context: planningContextSchema.optional()
})

export const emergedItemSchema = z.object({
  title: z.string(),
  surfacedAt: isoTimestampSchema,
  promoted: z.boolean(),
  context: planningContextSchema.optional()
})

export const crossTaskRefSchema = z.object({
  fromTaskId: z.string(),
  toInitiativeSlug: z.string(),
  toTaskId: z.string(),
  relation: z.enum(['depends_on', 'extends', 'unblocks', 'references']),
  note: z.string().optional()
})

export const initiativeSchema = z
  .object({
    schemaVersion: schemaVersionSchema,
    slug: z.string(),
    title: z.string(),
    goal: z.string(),
    status: initiativeStatusSchema,
    branch: z.string().nullable(),
    started: isoTimestampSchema,
    lastUpdated: isoTimestampSchema,
    nextAction: z.string().nullable(),
    parentPlan: z.string().optional(),
    phaseId: z.string().optional(),
    audience: z.string().optional(),
    exitGates: z.array(exitCriterionSchema),
    scope: initiativeScopeSchema.optional(),
    stack: z.array(stackFrameSchema),
    tasks: z.array(taskSchema),
    parked: z.array(parkedItemSchema),
    emerged: z.array(emergedItemSchema),
    body: z.string().optional(),
    externalImports: z.array(artifactRefSchema).optional(),
    references: z.array(artifactRefSchema).optional(),
    crossTaskRefs: z.array(crossTaskRefSchema).optional()
  })
  .strict()

// ─────────────────────────────────────────────────────────────────────────────
// AGGREGATE STATE + PROJECTIONS
// ─────────────────────────────────────────────────────────────────────────────

export const adHocSessionSchema = z.object({
  timestamp: isoTimestampSchema,
  description: z.string()
})

export const projectStatusStateSchema = z
  .object({
    schemaVersion: schemaVersionSchema,
    consumer: z.literal('project-status'),
    generatedAt: isoTimestampSchema,
    plans: z.array(planSchema),
    initiatives: z.array(initiativeSchema),
    adHocSessions: z.array(adHocSessionSchema)
  })
  .strict()

export const nextActionProjectionSchema = z.object({
  consumer: z.literal('project-status'),
  planSlug: z.string().optional(),
  initiativeSlug: z.string().optional(),
  taskId: z.string().optional(),
  description: z.string(),
  rationale: z.string()
})

export const driftReportSchema = z.object({
  consumer: z.literal('project-status'),
  currentInitiative: z.string().optional(),
  expectedScope: z.array(z.string()),
  actualWrites: z.array(z.string()),
  driftingPaths: z.array(z.string()),
  suggestion: z.string().optional()
})

export const healthReportSchema = z.object({
  schemaVersion: schemaVersionSchema,
  generatedAt: isoTimestampSchema,
  staleInitiatives: z.array(
    z.object({ slug: z.string(), daysStale: z.number() })
  ),
  unmetGates: z.array(
    z.object({ target: z.string(), criterion: z.string() })
  ),
  openHighlights: z.array(
    z.object({ id: z.string(), target: z.string(), severity: z.string() })
  ),
  inboxUnconsumed: z.number().int().nonnegative()
})
