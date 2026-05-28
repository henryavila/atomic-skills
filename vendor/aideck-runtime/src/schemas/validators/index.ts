import type { ZodIssue, ZodType } from 'zod'
import type { ErrorResponse } from '../common.js'
import { type Result, err, ok } from './result.js'
import {
  acknowledgementSchema,
  annotationSchema,
  artifactRefSchema,
  decisionSchema,
  errorResponseSchema,
  highlightSchema,
  inboxItemSchema,
  intentApplicationSchema,
  intentRecordSchema,
  resolutionSchema,
  verifierResultSchema
} from './common.js'
import {
  driftReportSchema,
  healthReportSchema,
  initiativeSchema,
  nextActionProjectionSchema,
  planSchema,
  projectStatusStateSchema
} from './project-status.js'

export { err, ok } from './result.js'
export type { Result } from './result.js'

export * from './common.js'
export * from './project-status.js'

const SCHEMA_VERSION_PATH_TAIL = 'schemaVersion'

function pointer(path: ReadonlyArray<string | number>): string {
  if (path.length === 0) return ''
  return path
    .map((segment) =>
      typeof segment === 'number'
        ? String(segment)
        : segment.replace(/~/g, '~0').replace(/\//g, '~1')
    )
    .join('.')
}

function suggestFromIssue(issue: ZodIssue): string | undefined {
  switch (issue.code) {
    case 'invalid_type':
      return `expected ${issue.expected}, received ${issue.received}`
    case 'invalid_enum_value':
      return `expected one of: ${issue.options.map((o) => JSON.stringify(o)).join(', ')}`
    case 'invalid_literal':
      return `expected literal ${JSON.stringify(issue.expected)}`
    case 'invalid_union_discriminator':
      return `expected discriminator value: ${issue.options.map((o) => JSON.stringify(o)).join(', ')}`
    case 'unrecognized_keys':
      return `unknown key(s): ${issue.keys.join(', ')}`
    default:
      return undefined
  }
}

function isSchemaVersionMismatch(issue: ZodIssue): boolean {
  if (issue.path.length === 0) return false
  const last = issue.path[issue.path.length - 1]
  if (last !== SCHEMA_VERSION_PATH_TAIL) return false
  if (issue.code === 'invalid_literal' && issue.expected === '0.1') return true
  if (issue.code === 'invalid_type' && issue.received === 'undefined') return true
  return false
}

export interface ParseContext {
  entity?: string
  slug?: string
}

export function parseOrError<T>(
  schema: ZodType<T>,
  raw: unknown,
  context?: ParseContext
): Result<T, ErrorResponse> {
  const parsed = schema.safeParse(raw)
  if (parsed.success) return ok(parsed.data)

  const issue = parsed.error.issues[0]
  const path = pointer(issue.path)

  if (isSchemaVersionMismatch(issue)) {
    let found: string
    if (issue.code === 'invalid_type') {
      found = 'missing'
    } else if ('received' in issue && typeof issue.received === 'string') {
      found = issue.received
    } else {
      found = 'unknown'
    }
    return err({
      code: 'schema_version_mismatch',
      message: `schemaVersion mismatch at "${path}": expected "0.1", received ${JSON.stringify(found)}`,
      suggestion: found === 'missing'
        ? 'Add `schemaVersion: \'0.1\'` to this record.'
        : `Run migration: aideck migrate --from=${found} --to=0.1`,
      details: contextDetails(context, { path, found })
    })
  }

  return err({
    code: 'invalid_input',
    message: path ? `${path}: ${issue.message}` : issue.message,
    suggestion: suggestFromIssue(issue),
    details: contextDetails(context, { path, code: issue.code })
  })
}

function contextDetails(
  context: ParseContext | undefined,
  extra: Record<string, unknown>
): Record<string, unknown> | undefined {
  const out: Record<string, unknown> = { ...extra }
  if (context?.entity) out.entity = context.entity
  if (context?.slug) out.slug = context.slug
  return Object.keys(out).length === 0 ? undefined : out
}

// ─────────────────────────────────────────────────────────────────────────────
// Entity-specific helpers — every canonical surface enters through one of these.
// ─────────────────────────────────────────────────────────────────────────────

export const parsePlan = (raw: unknown, ctx?: ParseContext) =>
  parseOrError(planSchema, raw, { entity: 'plan', ...ctx })

export const parseInitiative = (raw: unknown, ctx?: ParseContext) =>
  parseOrError(initiativeSchema, raw, { entity: 'initiative', ...ctx })

export const parseAnnotation = (raw: unknown, ctx?: ParseContext) =>
  parseOrError(annotationSchema, raw, { entity: 'annotation', ...ctx })

export const parseHighlight = (raw: unknown, ctx?: ParseContext) =>
  parseOrError(highlightSchema, raw, { entity: 'highlight', ...ctx })

export const parseDecision = (raw: unknown, ctx?: ParseContext) =>
  parseOrError(decisionSchema, raw, { entity: 'decision', ...ctx })

export const parseInboxItem = (raw: unknown, ctx?: ParseContext) =>
  parseOrError(inboxItemSchema, raw, { entity: 'inboxItem', ...ctx })

export const parseProjectStatusState = (raw: unknown, ctx?: ParseContext) =>
  parseOrError(projectStatusStateSchema, raw, { entity: 'projectStatusState', ...ctx })

export const parseResolution = (raw: unknown, ctx?: ParseContext) =>
  parseOrError(resolutionSchema, raw, { entity: 'resolution', ...ctx })

export const parseAcknowledgement = (raw: unknown, ctx?: ParseContext) =>
  parseOrError(acknowledgementSchema, raw, { entity: 'acknowledgement', ...ctx })

export const parseIntentRecord = (raw: unknown, ctx?: ParseContext) =>
  parseOrError(intentRecordSchema, raw, { entity: 'intentRecord', ...ctx })

export const parseIntentApplication = (raw: unknown, ctx?: ParseContext) =>
  parseOrError(intentApplicationSchema, raw, { entity: 'intentApplication', ...ctx })

export const parseVerifierResult = (raw: unknown, ctx?: ParseContext) =>
  parseOrError(verifierResultSchema, raw, { entity: 'verifierResult', ...ctx })

export const parseArtifactRef = (raw: unknown, ctx?: ParseContext) =>
  parseOrError(artifactRefSchema, raw, { entity: 'artifactRef', ...ctx })

export const parseErrorResponse = (raw: unknown, ctx?: ParseContext) =>
  parseOrError(errorResponseSchema, raw, { entity: 'errorResponse', ...ctx })

export const parseNextActionProjection = (raw: unknown, ctx?: ParseContext) =>
  parseOrError(nextActionProjectionSchema, raw, { entity: 'nextActionProjection', ...ctx })

export const parseDriftReport = (raw: unknown, ctx?: ParseContext) =>
  parseOrError(driftReportSchema, raw, { entity: 'driftReport', ...ctx })

export const parseHealthReport = (raw: unknown, ctx?: ParseContext) =>
  parseOrError(healthReportSchema, raw, { entity: 'healthReport', ...ctx })
