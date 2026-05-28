/**
 * Common schema primitives shared across all consumers.
 *
 * Versioning: schemas are versioned via `schemaVersion` on every payload.
 * Consumers must check version compatibility before parsing.
 */

export const SCHEMA_VERSION = '0.1' as const
export type SchemaVersion = typeof SCHEMA_VERSION

export type IsoTimestamp = string

export type ConsumerId = string

export interface SchemaVersioned {
  schemaVersion: SchemaVersion
}

/**
 * Reference to an external artifact (file path, URL, repo path).
 */
export interface ArtifactRef {
  kind: 'file' | 'url' | 'repo-path' | 'section'
  path: string
  label?: string
  section?: string
  inside_repo?: boolean
  gitignored?: boolean
}

export interface Annotation extends SchemaVersioned {
  id: string
  target: AnnotationTarget
  author: 'human' | 'ai'
  body: string
  createdAt: IsoTimestamp
  resolved?: boolean
  resolvedAt?: IsoTimestamp
}

export interface AnnotationTarget {
  consumer: ConsumerId
  slug?: string
  path: string
}

export interface Highlight extends SchemaVersioned {
  id: string
  target: AnnotationTarget
  reason: string
  source: 'human' | 'ai'
  severity: 'info' | 'warn' | 'critical'
  createdAt: IsoTimestamp
  acknowledged?: boolean
  acknowledgedAt?: IsoTimestamp
}

export interface Decision extends SchemaVersioned {
  id: string
  target: AnnotationTarget
  decision: 'approve' | 'reject' | 'block' | 'defer'
  reason?: string
  by: 'human' | 'ai'
  createdAt: IsoTimestamp
}

interface InboxItemBase extends SchemaVersioned {
  id: string
  consumer: ConsumerId
  createdAt: IsoTimestamp
  consumed?: IsoTimestamp
}

export type InboxItem =
  | (InboxItemBase & { kind: 'annotation'; payload: Annotation })
  | (InboxItemBase & { kind: 'highlight'; payload: Highlight })
  | (InboxItemBase & { kind: 'decision'; payload: Decision })

export interface ErrorResponse {
  code:
    | 'consumer_unknown'
    | 'slug_not_found'
    | 'path_not_found'
    | 'schema_version_mismatch'
    | 'invalid_input'
    | 'precondition_failed'
    | 'io_error'
    | 'internal_error'
  message: string
  suggestion?: string
  details?: Record<string, unknown>
}

// ─────────────────────────────────────────────────────────────────────────────
// APPEND-ONLY JSONL RECORDS
// ─────────────────────────────────────────────────────────────────────────────

export interface Resolution extends SchemaVersioned {
  kind: 'resolution'
  refId: string
  by: 'human' | 'ai'
  resolvedAt: IsoTimestamp
  note?: string
}

export interface Acknowledgement extends SchemaVersioned {
  kind: 'acknowledgement'
  refId: string
  by: 'human' | 'ai'
  acknowledgedAt: IsoTimestamp
}

interface IntentBase extends SchemaVersioned {
  kind: 'intent'
  intentId: string
  by: 'human' | 'ai'
  requestedAt: IsoTimestamp
}

export type IntentRecord =
  | (IntentBase & {
      operation: 'mark_task_done'
      target: { initiativeSlug: string; taskId: string }
      args: { verifierResultId?: string }
    })
  | (IntentBase & {
      operation: 'update_initiative_status'
      target: { initiativeSlug: string }
      args: { status: 'pending' | 'active' | 'paused' | 'done' | 'archived'; reason?: string }
    })
  | (IntentBase & {
      operation: 'update_next_action'
      target: { initiativeSlug: string }
      args: { nextAction: string | null }
    })
  | (IntentBase & {
      operation: 'push_frame'
      target: { initiativeSlug: string }
      args: { title: string; type: 'task' | 'research' | 'validation' | 'discussion' }
    })
  | (IntentBase & {
      operation: 'pop_frame'
      target: { initiativeSlug: string }
      args: { destination?: string }
    })
  | (IntentBase & {
      operation: 'park_item'
      target: { initiativeSlug: string }
      args: { title: string; fromFrame?: number | null }
    })
  | (IntentBase & {
      operation: 'emerge_item'
      target: { initiativeSlug: string }
      args: { title: string }
    })
  | (IntentBase & {
      operation: 'promote_parked'
      target: { initiativeSlug: string }
      args: { parked: string | number }
    })
  | (IntentBase & {
      operation: 'add_task'
      target: { initiativeSlug: string }
      args: { title: string; description?: string; verifier?: unknown }
    })

export interface IntentApplication extends SchemaVersioned {
  kind: 'intent_application'
  refId: string
  appliedAt: IsoTimestamp
  by: string
  result: 'applied' | 'rejected' | 'partial'
  note?: string
}

export type CriterionRef =
  | { target: 'phase'; planSlug: string; phaseId: string; criterionId: string }
  | { target: 'initiative'; initiativeSlug: string; criterionId: string }
  | { target: 'task'; initiativeSlug: string; taskId: string; criterionId: string }

export interface VerifierResult extends SchemaVersioned {
  kind: 'verifier_result'
  verifierResultId: string
  criterionRef: CriterionRef
  result: 'met' | 'pending' | 'deferred'
  evidence?: string
  deferredReason?: string
  verifierOutput?: string
  ranAt: IsoTimestamp
  by: 'human' | 'ai'
}
