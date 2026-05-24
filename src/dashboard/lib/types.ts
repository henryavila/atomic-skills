// Mirrors aideck/src/schemas/project-status.ts. Kept in sync manually for v0.1.
// E.T-003 adds a contract test that fails this file when aideck's schema
// changes shape. Update both repos in lockstep.

export type PlanStatus = 'active' | 'paused' | 'done' | 'archived'
export type InitiativeStatus = 'pending' | 'active' | 'paused' | 'done' | 'archived'
export type TaskStatus = 'pending' | 'active' | 'done' | 'blocked'
export type GateStatus = 'pending' | 'met' | 'deferred'
export type StackFrameType = 'task' | 'research' | 'validation' | 'discussion'
export type VerifierKind = 'shell' | 'query' | 'test' | 'manual'
export type SeverityLevel = 'info' | 'warn' | 'critical'

export interface EvidenceBlock {
  verifierKind: VerifierKind
  verifiedAt: string
  passed?: boolean
  exitCode?: number
  rowCount?: number
  outputSummary?: string
}

export type ExitCriterionVerifier =
  | { kind: 'shell'; command: string; expectExitCode?: number }
  | { kind: 'query'; sql: string; expectRowCount?: number }
  | { kind: 'test'; runner: string; pattern: string }
  | { kind: 'manual'; description: string }

export interface ExitCriterion {
  id: string
  description: string
  verifier?: ExitCriterionVerifier
  status: GateStatus
  metAt?: string
  deferredReason?: string
  evidence?: EvidenceBlock
}

export interface PhaseExitGate {
  summary: string
  criteria: ExitCriterion[]
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
  exitGateType?: 'standard' | 'ui-gate' | 'custom'
  provenance?: Provenance
  context?: Context
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

export interface ArtifactRef {
  kind: string
  path?: string
  url?: string
  title?: string
}

export interface Plan {
  schemaVersion: string
  slug: string
  title: string
  version: string
  narrative: string
  status: PlanStatus
  started: string
  lastUpdated: string
  branch?: string
  currentPhase: string | null
  parallelismAllowed: boolean
  principles?: Principle[]
  glossary?: GlossaryTerm[]
  phases: PhaseDescriptor[]
  tracks?: Track[]
  references?: ArtifactRef[]
  whatStaysValid?: string[]
}

export interface StackFrame {
  id: number
  title: string
  type: StackFrameType
  openedAt: string
}

export interface TaskOutput {
  kind: 'command' | 'file' | 'migration' | 'json' | 'test'
  path?: string
  command?: string
  description?: string
}

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
  context: Context
}

export interface EmergedItem {
  title: string
  surfacedAt: string
  promoted: boolean
  context: Context
}

export interface InitiativeScope {
  paths: string[]
}

export interface Initiative {
  schemaVersion: string
  slug: string
  title: string
  goal: string
  status: InitiativeStatus
  branch: string | null
  started: string
  lastUpdated: string
  nextAction: string | null
  parentPlan?: string
  phaseId?: string
  audience?: string
  exitGates: ExitCriterion[]
  scope?: InitiativeScope
  stack: StackFrame[]
  tasks: Task[]
  parked: ParkedItem[]
  emerged: EmergedItem[]
  body?: string
  references?: ArtifactRef[]
}

export interface AdHocSession {
  startedAt: string
  summary: string
  branch?: string
}

export interface ProjectStatusState {
  schemaVersion: string
  consumer: 'project-status'
  generatedAt: string
  plans: Plan[]
  initiatives: Initiative[]
  adHocSessions: AdHocSession[]
}

// ── Discover-run types ─────────────────────────────────────────────────────

export interface DiscoverEvidence {
  sourceType: string
  sourceId: string
  topicHint: string
  evidenceQuote: string
  candidateCompletion: string
  lastActivity: string
}

export interface ActivityPoint {
  date: string
  count: number
  types: string[]
}

export interface DiscoverCandidate {
  slug: string
  slugAlternatives: string[]
  title: string
  goal: string
  kind: 'plan' | 'initiative'
  bucket: 'strong' | 'worth-reviewing' | 'historical'
  confidence: number
  confidenceBreakdown: Record<string, number>
  started: string
  lastUpdated: string
  activityTimeline: ActivityPoint[]
  branch: string | null
  nextAction: string | null
  rationale: string
  scopePaths: string[]
  signalIds: string[]
  evidence: DiscoverEvidence[]
  contextMarkdown: string
  evidenceExcerpts: string
  previewYaml: string
  draftPath: string
  approved: boolean
  historicalReason?: string
  completionSummary?: string
}

export interface OrphanSignal {
  id: string
  sourceType: string
  sourceId: string
  topicHint: string
  evidenceQuote: string
  lastActivity: string
}

export interface DiscoverRelationship {
  fromSlug: string
  toSlug: string
  kind: 'plan-phase' | 'shared-paths' | 'shared-branch' | 'subtopic'
  sharedIdentifiers: string[]
  strength: number
}

export interface SourceSummary {
  layer: string
  label: string
  signalCount: number
}

export interface DiscoverRun {
  runId: string
  generatedAt: string
  scanConfig: { scope: string[]; repoPath: string }
  sourcesSummary: SourceSummary[]
  counts: { strong: number; worthReviewing: number; historical: number; alreadyTracked: number }
  candidates: DiscoverCandidate[]
  alreadyTracked: string[]
  orphanSignals: OrphanSignal[]
  relationships: DiscoverRelationship[]
}

export interface DiscoverDecision {
  id: string
  target: { consumer: string; slug?: string; path: string }
  decision: 'approve' | 'reject' | 'block' | 'defer'
  reason?: string
  by: 'human' | 'ai'
  createdAt: string
}

export interface Annotation {
  schemaVersion: string
  kind: 'annotation'
  annotationId: string
  target: Record<string, unknown>
  body: string
  by: 'human' | 'ai'
  createdAt: string
}

export interface Highlight {
  schemaVersion: string
  kind: 'highlight'
  highlightId: string
  target: Record<string, unknown>
  severity: SeverityLevel
  message: string
  by: 'human' | 'ai'
  createdAt: string
}
