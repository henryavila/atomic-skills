/**
 * project-status canonical data shape.
 *
 * Three levels:
 *   Plan         — macro container (multi-phase project, with narrative body)
 *   Initiative   — a phase or standalone unit of work
 *   Task         — atomic action within an initiative
 *
 * Initiatives without `parentPlan` are standalone (legacy / ad-hoc).
 * Plans are optional; a project can run with only initiatives.
 *
 * Modeled after real plans like sda-v2 v3-redesign (9 phases / 61 sub-phases,
 * with tracks, principles, glossary, cross-doc references).
 */

import type { ArtifactRef, IsoTimestamp, SchemaVersioned } from './common.js'

export const PROJECT_STATUS_CONSUMER_ID = 'project-status' as const

export type TaskStatus = 'pending' | 'active' | 'done' | 'blocked'
export type InitiativeStatus = 'pending' | 'active' | 'paused' | 'done' | 'archived'
export type PlanStatus = 'active' | 'paused' | 'done' | 'archived'
export type StackFrameType = 'task' | 'research' | 'validation' | 'discussion'
export type GateStatus = 'pending' | 'met' | 'deferred'

// ─────────────────────────────────────────────────────────────────────────────
// PLAN
// ─────────────────────────────────────────────────────────────────────────────

export interface Plan extends SchemaVersioned {
  slug: string
  title: string
  version: string

  /** Narrative is the full markdown body — context, motivation, what stays, etc.
   *  Stored alongside frontmatter in the .md file. Can be hundreds of lines. */
  narrative: string

  status: PlanStatus
  started: IsoTimestamp
  lastUpdated: IsoTimestamp

  branch?: string
  currentPhase: string | null

  /** Whether multiple phases may be active simultaneously (default: false).
   *  Some phases may be marked as parallelizable via `parallelWith`. */
  parallelismAllowed: boolean

  principles?: Principle[]
  glossary?: GlossaryTerm[]

  phases: PhaseDescriptor[]
  interPhaseGates?: InterPhaseGate[]

  /** Tracks group phases by domain (e.g., DATA, UI, OVERSIGHT).
   *  Each phase references its track via `PhaseDescriptor.track`. */
  tracks?: Track[]

  /** Previous plan that this one supersedes, partially or fully. */
  supersedes?: PlanSupersedeRef

  /** Cross-document refs (PRD, RUNBOOK, ADRs, external repos, etc.) */
  references?: ArtifactRef[]

  /** Items explicitly NOT in scope — what stays valid from before. */
  whatStaysValid?: string[]
}

export interface Principle {
  id: string
  title: string
  body: string
}

export interface GlossaryTerm {
  term: string
  definition: string
}

export interface Track {
  id: string
  title: string
  domain?: string
}

export interface PhaseDescriptor {
  id: string
  slug: string
  title: string
  goal: string
  dependsOn: string[]
  parallelWith?: string[]
  track?: string
  audience?: string
  subPhaseCount: number
  exitGate: PhaseExitGate
  status: InitiativeStatus

  /** External imports the phase depends on (e.g., framework imported from another repo). */
  externalImports?: ArtifactRef[]

  /** Subtype for phases with structured exit gates (e.g., UI Gate composite). */
  exitGateType?: 'standard' | 'ui-gate' | 'custom'
}

export interface PhaseExitGate {
  summary: string
  criteria: ExitCriterion[]
}

export interface ExitCriterion {
  id: string
  description: string
  verifier?: ExitCriterionVerifier
  status: GateStatus
  metAt?: IsoTimestamp
  deferredReason?: string
}

export type ExitCriterionVerifier =
  | { kind: 'shell'; command: string; expectExitCode?: number }
  | { kind: 'query'; sql: string; expectRowCount?: number }
  | { kind: 'test'; runner: string; pattern: string }
  | { kind: 'manual'; description: string }

export interface InterPhaseGate {
  from: string
  to: string
  criteria: string[]
}

export interface PlanSupersedeRef {
  path: string
  supersedeScope: 'full' | 'partial'
  partialAreas?: string[]
  remainsValid?: string[]
}

// ─────────────────────────────────────────────────────────────────────────────
// INITIATIVE (one per phase, or standalone)
// ─────────────────────────────────────────────────────────────────────────────

export interface Initiative extends SchemaVersioned {
  slug: string
  title: string
  goal: string

  status: InitiativeStatus
  branch: string | null
  started: IsoTimestamp
  lastUpdated: IsoTimestamp
  nextAction: string | null

  parentPlan?: string
  phaseId?: string
  audience?: string

  /** Phase-specific exit gate criteria with verifiers. */
  exitGates: ExitCriterion[]

  /** Path globs this initiative is allowed to touch. Used for drift detection. */
  scope?: InitiativeScope

  stack: StackFrame[]
  tasks: Task[]
  parked: ParkedItem[]
  emerged: EmergedItem[]

  /** Markdown body — additional rationale, decisions, gotchas. */
  body?: string

  /** External imports specific to this initiative. */
  externalImports?: ArtifactRef[]

  /** Cross-references to PRD, specs, design docs, ADRs. */
  references?: ArtifactRef[]

  /** Cross-task refs to other initiatives (e.g., F4.T-006 references F3.T-003). */
  crossTaskRefs?: CrossTaskRef[]
}

export interface InitiativeScope {
  paths: string[]
}

export interface StackFrame {
  id: number
  title: string
  type: StackFrameType
  openedAt: IsoTimestamp
}

// ─────────────────────────────────────────────────────────────────────────────
// TASK
// ─────────────────────────────────────────────────────────────────────────────

export interface Task {
  id: string
  title: string
  description?: string

  status: TaskStatus
  lastUpdated: IsoTimestamp
  closedAt?: IsoTimestamp

  blockedBy?: string[]

  /** Output artifacts produced (commands, JSON files, migrations, etc.). */
  outputs?: TaskOutput[]

  /** Markers from legacy/migration context (e.g., "(gap legacy)"). */
  tags?: string[]

  /** Resource counts mentioned in the task ("8 Resources", "12 routes"). */
  resourceCounts?: Record<string, number>

  /** Task-specific exit verifier (overrides the phase gate for this task). */
  verifier?: ExitCriterionVerifier
}

export interface TaskOutput {
  kind: 'command' | 'file' | 'migration' | 'json' | 'test'
  path?: string
  command?: string
  description?: string
}

export interface ParkedItem {
  title: string
  surfacedAt: IsoTimestamp
  fromFrame: number | null
}

export interface EmergedItem {
  title: string
  surfacedAt: IsoTimestamp
  promoted: boolean
}

export interface CrossTaskRef {
  fromTaskId: string
  toInitiativeSlug: string
  toTaskId: string
  relation: 'depends_on' | 'extends' | 'unblocks' | 'references'
  note?: string
}

// ─────────────────────────────────────────────────────────────────────────────
// AGGREGATE STATE
// ─────────────────────────────────────────────────────────────────────────────

export interface ProjectStatusState extends SchemaVersioned {
  consumer: typeof PROJECT_STATUS_CONSUMER_ID
  generatedAt: IsoTimestamp
  plans: Plan[]
  initiatives: Initiative[]
  adHocSessions: AdHocSession[]
}

export interface AdHocSession {
  timestamp: IsoTimestamp
  description: string
}

// ─────────────────────────────────────────────────────────────────────────────
// PROJECTIONS (computed views, not stored)
// ─────────────────────────────────────────────────────────────────────────────

export interface NextActionProjection {
  consumer: typeof PROJECT_STATUS_CONSUMER_ID
  planSlug?: string
  initiativeSlug?: string
  taskId?: string
  description: string
  rationale: string
}

export interface DriftReport {
  consumer: typeof PROJECT_STATUS_CONSUMER_ID
  currentInitiative?: string
  expectedScope: string[]
  actualWrites: string[]
  driftingPaths: string[]
  suggestion?: string
}

export interface HealthReport extends SchemaVersioned {
  generatedAt: IsoTimestamp
  staleInitiatives: { slug: string; daysStale: number }[]
  unmetGates: { target: string; criterion: string }[]
  openHighlights: { id: string; target: string; severity: string }[]
  inboxUnconsumed: number
}
