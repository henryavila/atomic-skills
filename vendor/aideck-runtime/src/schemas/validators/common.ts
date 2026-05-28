import { z } from 'zod'

export const schemaVersionSchema = z.literal('0.1')

export const isoTimestampSchema = z.string().datetime({ offset: true })

export const artifactRefSchema = z
  .object({
    kind: z.enum(['file', 'url', 'repo-path', 'section']),
    path: z.string(),
    label: z.string().optional(),
    section: z.string().optional(),
    inside_repo: z.boolean().optional(),
    gitignored: z.boolean().optional()
  })
  .strict()

export const annotationTargetSchema = z
  .object({
    consumer: z.string(),
    slug: z.string().optional(),
    path: z.string()
  })
  .strict()

export const annotationSchema = z
  .object({
    schemaVersion: schemaVersionSchema,
    id: z.string(),
    target: annotationTargetSchema,
    author: z.enum(['human', 'ai']),
    body: z.string(),
    createdAt: isoTimestampSchema,
    resolved: z.boolean().optional(),
    resolvedAt: isoTimestampSchema.optional()
  })
  .strict()

export const highlightSchema = z
  .object({
    schemaVersion: schemaVersionSchema,
    id: z.string(),
    target: annotationTargetSchema,
    reason: z.string(),
    source: z.enum(['human', 'ai']),
    severity: z.enum(['info', 'warn', 'critical']),
    createdAt: isoTimestampSchema,
    acknowledged: z.boolean().optional(),
    acknowledgedAt: isoTimestampSchema.optional()
  })
  .strict()

export const decisionSchema = z
  .object({
    schemaVersion: schemaVersionSchema,
    id: z.string(),
    target: annotationTargetSchema,
    decision: z.enum(['approve', 'reject', 'block', 'defer']),
    reason: z.string().optional(),
    by: z.enum(['human', 'ai']),
    createdAt: isoTimestampSchema
  })
  .strict()

const inboxItemBase = {
  schemaVersion: schemaVersionSchema,
  id: z.string(),
  consumer: z.string(),
  createdAt: isoTimestampSchema,
  consumed: isoTimestampSchema.optional()
}

export const inboxItemSchema = z.discriminatedUnion('kind', [
  z.object({ ...inboxItemBase, kind: z.literal('annotation'), payload: annotationSchema }).strict(),
  z.object({ ...inboxItemBase, kind: z.literal('highlight'), payload: highlightSchema }).strict(),
  z.object({ ...inboxItemBase, kind: z.literal('decision'), payload: decisionSchema }).strict()
])

export const errorResponseSchema = z
  .object({
    code: z.enum([
      'consumer_unknown',
      'slug_not_found',
      'path_not_found',
      'schema_version_mismatch',
      'invalid_input',
      'precondition_failed',
      'io_error',
      'internal_error'
    ]),
    message: z.string(),
    suggestion: z.string().optional(),
    details: z.record(z.unknown()).optional()
  })
  .strict()

// ─────────────────────────────────────────────────────────────────────────────
// APPEND-ONLY JSONL RECORDS
// ─────────────────────────────────────────────────────────────────────────────

export const resolutionSchema = z
  .object({
    schemaVersion: schemaVersionSchema,
    kind: z.literal('resolution'),
    refId: z.string(),
    by: z.enum(['human', 'ai']),
    resolvedAt: isoTimestampSchema,
    note: z.string().optional()
  })
  .strict()

export const acknowledgementSchema = z
  .object({
    schemaVersion: schemaVersionSchema,
    kind: z.literal('acknowledgement'),
    refId: z.string(),
    by: z.enum(['human', 'ai']),
    acknowledgedAt: isoTimestampSchema
  })
  .strict()

export const intentOperationSchema = z.enum([
  'mark_task_done',
  'update_initiative_status',
  'update_next_action',
  'push_frame',
  'pop_frame',
  'park_item',
  'emerge_item',
  'promote_parked',
  'add_task'
])

const intentBase = {
  schemaVersion: schemaVersionSchema,
  kind: z.literal('intent'),
  intentId: z.string(),
  by: z.enum(['human', 'ai']),
  requestedAt: isoTimestampSchema
}

const initiativeTarget = z.object({ initiativeSlug: z.string() }).strict()
const taskTarget = z.object({ initiativeSlug: z.string(), taskId: z.string() }).strict()

export const intentRecordSchema = z.discriminatedUnion('operation', [
  z
    .object({
      ...intentBase,
      operation: z.literal('mark_task_done'),
      target: taskTarget,
      args: z.object({ verifierResultId: z.string().optional() }).strict()
    })
    .strict(),
  z
    .object({
      ...intentBase,
      operation: z.literal('update_initiative_status'),
      target: initiativeTarget,
      args: z
        .object({
          status: z.enum(['pending', 'active', 'paused', 'done', 'archived']),
          reason: z.string().optional()
        })
        .strict()
    })
    .strict(),
  z
    .object({
      ...intentBase,
      operation: z.literal('update_next_action'),
      target: initiativeTarget,
      args: z.object({ nextAction: z.string().nullable() }).strict()
    })
    .strict(),
  z
    .object({
      ...intentBase,
      operation: z.literal('push_frame'),
      target: initiativeTarget,
      args: z
        .object({
          title: z.string(),
          type: z.enum(['task', 'research', 'validation', 'discussion'])
        })
        .strict()
    })
    .strict(),
  z
    .object({
      ...intentBase,
      operation: z.literal('pop_frame'),
      target: initiativeTarget,
      args: z.object({ destination: z.string().optional() }).strict()
    })
    .strict(),
  z
    .object({
      ...intentBase,
      operation: z.literal('park_item'),
      target: initiativeTarget,
      args: z.object({ title: z.string(), fromFrame: z.number().int().nullable().optional() }).strict()
    })
    .strict(),
  z
    .object({
      ...intentBase,
      operation: z.literal('emerge_item'),
      target: initiativeTarget,
      args: z.object({ title: z.string() }).strict()
    })
    .strict(),
  z
    .object({
      ...intentBase,
      operation: z.literal('promote_parked'),
      target: initiativeTarget,
      args: z
        .object({ parked: z.union([z.string(), z.number().int().nonnegative()]) })
        .strict()
    })
    .strict(),
  z
    .object({
      ...intentBase,
      operation: z.literal('add_task'),
      target: initiativeTarget,
      args: z
        .object({
          title: z.string(),
          description: z.string().optional(),
          verifier: z.unknown().optional()
        })
        .strict()
    })
    .strict()
])

export const intentApplicationSchema = z
  .object({
    schemaVersion: schemaVersionSchema,
    kind: z.literal('intent_application'),
    refId: z.string(),
    appliedAt: isoTimestampSchema,
    by: z.string(),
    result: z.enum(['applied', 'rejected', 'partial']),
    note: z.string().optional()
  })
  .strict()

export const criterionRefSchema = z.discriminatedUnion('target', [
  z
    .object({
      target: z.literal('phase'),
      planSlug: z.string(),
      phaseId: z.string(),
      criterionId: z.string()
    })
    .strict(),
  z
    .object({
      target: z.literal('initiative'),
      initiativeSlug: z.string(),
      criterionId: z.string()
    })
    .strict(),
  z
    .object({
      target: z.literal('task'),
      initiativeSlug: z.string(),
      taskId: z.string(),
      criterionId: z.string()
    })
    .strict()
])

export const verifierResultSchema = z
  .object({
    schemaVersion: schemaVersionSchema,
    kind: z.literal('verifier_result'),
    verifierResultId: z.string(),
    criterionRef: criterionRefSchema,
    result: z.enum(['met', 'pending', 'deferred']),
    evidence: z.string().optional(),
    deferredReason: z.string().optional(),
    verifierOutput: z.string().optional(),
    ranAt: isoTimestampSchema,
    by: z.enum(['human', 'ai'])
  })
  .strict()
