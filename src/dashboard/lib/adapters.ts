// Adapters that map aiDeck's REST entity shapes to the prototype data
// shapes that the Claude Design components expect. The prototypes were
// designed against denormalized fixtures (e.g. `phase.tasks.done/total`
// pre-computed); aiDeck returns normalized state (plan + array of
// initiatives that reference the plan). These adapters do the join.

import type {
  Initiative,
  Plan,
  PhaseDescriptor,
  ProjectStatusState,
  Task,
} from './types'

export interface UIPlan {
  slug: string
  title: string
  version: string
  status: Plan['status']
  started: string
  branch?: string
  currentPhase: string | null
  parallelismAllowed: boolean
  narrative: string
  principles: NonNullable<Plan['principles']>
  glossary: NonNullable<Plan['glossary']>
  tracks: NonNullable<Plan['tracks']>
  phases: UIPhase[]
  legacyPhases: UIPhase[]
  refs: UIRef[]
  deps: Array<{ from: string; to: string }>
}

export interface UIPhase {
  id: string
  title: string
  goal: string
  status: PhaseDescriptor['status']
  track?: string
  parallelWith?: string[]
  audience?: string
  scope?: string[]
  gateType?: 'standard' | 'ui-gate' | 'custom'
  tasks: { done: number; total: number }
  gates: { met: number; total: number }
  next?: string
  exit?: string
  completedAt?: string
  durationDays?: number
  highlights?: Array<{ severity: 'info' | 'warn' | 'critical'; count: number }>
  hasCriticalDrift?: boolean
}

export interface UIRef {
  path: string
  kind: string
  state: 'in-project' | 'external' | 'gitignored'
  section?: string
}

export function adaptPlanForUI(plan: Plan, initiatives: Initiative[]): UIPlan {
  // Build a phase-id → initiative map. The watcher emits one initiative per
  // active or done phase; pending phases may have no initiative yet.
  const initByPhase = new Map<string, Initiative>()
  for (const i of initiatives) {
    if (i.parentPlan === plan.slug && i.phaseId) initByPhase.set(i.phaseId, i)
  }

  const phases: UIPhase[] = plan.phases.map((p) => adaptPhase(p, initByPhase.get(p.id)))

  // Separate "legacy" phases — done phases that completed before the
  // current sprint. Heuristic: any done phase with id starting with `Fneg`
  // (negative-indexed historical phases) OR any done phase that is not
  // adjacent to currentPhase. v0.1: keep it simple — `Fneg*` only.
  const legacyPhases = phases.filter((p) => p.id.startsWith('Fneg'))
  const activePhases = phases.filter((p) => !p.id.startsWith('Fneg'))

  return {
    slug: plan.slug,
    title: plan.title,
    version: plan.version,
    status: plan.status,
    started: plan.started.slice(0, 10),
    branch: plan.branch,
    currentPhase: plan.currentPhase,
    parallelismAllowed: plan.parallelismAllowed,
    narrative: plan.narrative ?? '',
    principles: plan.principles ?? [],
    glossary: plan.glossary ?? [],
    tracks: plan.tracks ?? [{ id: 'main', title: 'Main' }],
    phases: activePhases,
    legacyPhases,
    refs: (plan.references ?? []).map(adaptRef),
    deps: phases.flatMap((p) =>
      (plan.phases.find((x) => x.id === p.id)?.dependsOn ?? []).map((from) => ({
        from,
        to: p.id,
      }))
    ),
  }
}

function adaptPhase(p: PhaseDescriptor, initiative?: Initiative): UIPhase {
  const tasks = initiative
    ? {
        done: initiative.tasks.filter((t) => t.status === 'done').length,
        total: initiative.tasks.length,
      }
    : { done: 0, total: 0 }
  const gates = {
    met: p.exitGate.criteria.filter((c) => c.status === 'met').length,
    total: p.exitGate.criteria.length,
  }

  let effectiveStatus = p.status
  if (p.status === 'done' && initiative) {
    const allTasksDone = initiative.tasks.length === 0 || initiative.tasks.every((t) => t.status === 'done')
    const isInitTerminal = initiative.status === 'done' || initiative.status === 'archived'
    if (!allTasksDone || !isInitTerminal) {
      effectiveStatus = isInitTerminal ? 'active' : initiative.status
    }
  }

  const isTerminal =
    initiative?.status === 'done' || initiative?.status === 'archived'
  const isEffectivelyDone =
    effectiveStatus === 'done' || (p.status === 'done' && !initiative)

  return {
    id: p.id,
    title: p.title,
    goal: p.goal,
    status: effectiveStatus,
    track: p.track,
    parallelWith: p.parallelWith,
    audience: p.audience,
    gateType: p.exitGateType,
    scope: initiative?.scope?.paths,
    tasks,
    gates,
    next: initiative?.nextAction ?? undefined,
    exit: p.exitGate.summary,
    completedAt:
      isEffectivelyDone && isTerminal
        ? initiative!.lastUpdated.slice(0, 10)
        : undefined,
    durationDays:
      isEffectivelyDone && isTerminal
        ? Math.max(
            1,
            Math.round(
              (new Date(initiative!.lastUpdated).getTime() -
                new Date(initiative!.started).getTime()) /
                86400000
            )
          )
        : undefined,
  }
}

function adaptRef(r: Plan['references'] extends Array<infer R> | undefined ? R : never): UIRef {
  const ref = r as { path?: string; url?: string; kind: string; title?: string }
  const path = ref.path ?? ref.url ?? ref.title ?? '(no path)'
  const state: UIRef['state'] = ref.path?.startsWith('http')
    ? 'external'
    : ref.path?.includes('node_modules') || ref.path?.startsWith('/')
      ? 'external'
      : 'in-project'
  return { path, kind: ref.kind, state }
}

// ── Initiative side ────────────────────────────────────────────────────────

export interface UIInitiative {
  slug: string
  title: string
  goal: string
  status: Initiative['status']
  branch: string | null
  started: string
  updated: string
  nextAction?: { taskId: string; title: string }
  parentPlan?: { slug: string; title: string }
  phaseId?: string
  phaseIndex?: number
  phaseTotal?: number
  trackId?: string
  trackTitle?: string
  audience?: string
  tag?: string
  completedAt?: string
  durationDays?: number
  annotations: number
  exitGates: UIGate[]
  scope?: string[]
  stack: UIStackFrame[]
  tasks: UITask[]
  parked: UIParked[]
  emerged: UIEmerged[]
  references: UIRef[]
  body?: string
  outputs?: Array<{ kind: string; value: string }>
}

export interface UIGate {
  id: string
  description: string
  status: 'pending' | 'met' | 'deferred'
  verifier: { kind: 'shell' | 'query' | 'test' | 'manual'; command: string }
  lastRun?: { status: 'pass' | 'fail'; exit: number; when: string; output?: string }
  evidence?: string
  deferredReason?: string
  annotations: number
}

export interface UIStackFrame {
  id: number
  title: string
  kind: 'task' | 'validation' | 'investigation' | 'discussion'
  depth: number
  openedAt: string
  here?: boolean
}

export interface UITask {
  id: string
  title: string
  description?: string
  status: 'pending' | 'active' | 'done' | 'blocked'
  updated?: string
  here?: boolean
  tags?: string[]
  annotations: number
  blockedBy?: Array<{
    taskId: string
    status: 'done' | 'pending' | 'active' | 'blocked'
    title: string
    initiative?: string
    crossInitiative?: boolean
  }>
  crossTaskRefs?: Array<{
    relation: string
    toInitiative: string
    toTaskId: string
    toTaskTitle?: string
  }>
  outputs?: Array<{ kind: string; value: string }>
  verifier?: { kind: 'shell' | 'query' | 'test' | 'manual'; command: string }
}

export interface UIParked {
  id: string
  title: string
  parkedAt: string
  reason?: string
  lastReviewedAt?: string
  staleAge?: number
}

export interface UIEmerged {
  id: string
  title: string
  surfacedAt: string
  promoted?: boolean
  reason?: string
  lastReviewedAt?: string
  staleAge?: number
}

function computeStaleAge(lastReviewedAt: string | undefined, ratifiedAt: string): number {
  const ref = lastReviewedAt ?? ratifiedAt
  return Math.floor((Date.now() - Date.parse(ref)) / 86400000)
}

export function adaptInitiativeForUI(initiative: Initiative, plan?: Plan): UIInitiative {
  const phaseIndex = plan && initiative.phaseId
    ? plan.phases.findIndex((p) => p.id === initiative.phaseId)
    : -1
  return {
    slug: initiative.slug,
    title: initiative.title,
    goal: initiative.goal,
    status: initiative.status,
    branch: initiative.branch,
    started: initiative.started.slice(0, 10),
    updated: initiative.lastUpdated.slice(0, 10),
    nextAction: initiative.nextAction
      ? { taskId: nextTaskId(initiative) ?? '', title: initiative.nextAction }
      : undefined,
    parentPlan: initiative.parentPlan && plan
      ? { slug: plan.slug, title: plan.title }
      : undefined,
    phaseId: initiative.phaseId,
    phaseIndex: phaseIndex >= 0 ? phaseIndex : undefined,
    phaseTotal: plan?.phases.length,
    trackId: initiative.phaseId && plan
      ? plan.phases.find((p) => p.id === initiative.phaseId)?.track
      : undefined,
    audience: initiative.audience,
    completedAt: initiative.status === 'done' ? initiative.lastUpdated.slice(0, 10) : undefined,
    durationDays:
      initiative.status === 'done'
        ? Math.max(
            1,
            Math.round(
              (new Date(initiative.lastUpdated).getTime() - new Date(initiative.started).getTime()) /
                86400000
            )
          )
        : undefined,
    annotations: 0, // v0.1 — annotations not yet rendered live
    exitGates: initiative.exitGates.map((c) => ({
      id: c.id,
      description: c.description,
      status: c.status,
      verifier: c.verifier
        ? {
            kind: c.verifier.kind,
            command:
              c.verifier.kind === 'shell'
                ? c.verifier.command
                : c.verifier.kind === 'query'
                  ? c.verifier.sql
                  : c.verifier.kind === 'test'
                    ? `${c.verifier.runner} ${c.verifier.pattern}`
                    : c.verifier.description,
          }
        : { kind: 'manual', command: '(no verifier defined)' },
      evidence: c.evidence?.outputSummary,
      deferredReason: c.deferredReason,
      annotations: 0,
      lastRun: c.evidence
        ? {
            status: c.evidence.passed ? 'pass' : 'fail',
            exit: c.evidence.exitCode ?? 0,
            when: c.evidence.verifiedAt.slice(0, 10),
            output: c.evidence.outputSummary,
          }
        : undefined,
    })),
    scope: initiative.scope?.paths,
    stack: initiative.stack.map((f, i) => ({
      id: f.id,
      title: f.title,
      kind: f.type === 'research' ? 'investigation' : f.type,
      depth: i,
      openedAt: f.openedAt.slice(0, 10),
      here: i === initiative.stack.length - 1,
    })),
    tasks: initiative.tasks.map((t) => adaptTask(t, initiative)),
    parked: initiative.parked.map((p, i) => ({
      id: `P-${i + 1}`,
      title: p.title,
      parkedAt: p.surfacedAt.slice(0, 10),
      reason: p.context.solves,
      lastReviewedAt: p.context.lastReviewedAt,
      staleAge: computeStaleAge(p.context.lastReviewedAt, p.context.ratifiedAt),
    })),
    emerged: initiative.emerged.map((e, i) => ({
      id: `E-${i + 1}`,
      title: e.title,
      surfacedAt: e.surfacedAt.slice(0, 10),
      promoted: e.promoted,
      reason: e.context.solves,
      lastReviewedAt: e.context.lastReviewedAt,
      staleAge: computeStaleAge(e.context.lastReviewedAt, e.context.ratifiedAt),
    })),
    references: (initiative.references ?? []).map(adaptRef),
    body: initiative.body,
  }
}

function nextTaskId(initiative: Initiative): string | undefined {
  return (
    initiative.tasks.find((t) => t.status === 'active')?.id ??
    initiative.tasks.find((t) => t.status === 'pending')?.id
  )
}

function adaptTask(t: Task, initiative: Initiative): UITask {
  const hereId = nextTaskId(initiative)
  return {
    id: t.id,
    title: t.title,
    description: t.description,
    status: t.status,
    updated: t.lastUpdated.slice(0, 10),
    here: t.id === hereId,
    tags: t.tags,
    annotations: 0,
    blockedBy: t.blockedBy?.map((b) => ({
      taskId: b,
      status: 'pending',
      title: '',
    })),
    outputs: t.outputs?.map((o) => ({
      kind: o.kind,
      value: o.path ?? o.command ?? o.description ?? '',
    })),
    verifier: t.verifier
      ? {
          kind: t.verifier.kind,
          command:
            t.verifier.kind === 'shell'
              ? t.verifier.command
              : t.verifier.kind === 'query'
                ? t.verifier.sql
                : t.verifier.kind === 'test'
                  ? `${t.verifier.runner} ${t.verifier.pattern}`
                  : t.verifier.description,
        }
      : undefined,
  }
}

// ── Home view: build "consumer band" shape from aggregate state ────────────

export interface UIConsumer {
  id: string
  name: string
  path: string
  health: 'active' | 'empty' | 'errored' | 'idle'
  lastWrite: string
  plans: UIPlanRow[]
  initiatives: UIInitRow[]
  errors: never[]
}

export interface UIPlanRow {
  slug: string
  title: string
  version: string
  status: 'active' | 'done' | 'blocked'
  branch: string
  currentPhase: string | null
  tasks: { done: number; total: number }
  phases: { done: number; active: number; pending: number }
  next?: string
  unreadAnnotations: number
  openHighlights: number
  criticalHighlights: number
}

export interface UIInitRow {
  slug: string
  title: string
  status: 'pending' | 'active' | 'paused' | 'done' | 'archived'
  tasks: { done: number; total: number }
  next?: string
  unreadAnnotations: number
  openHighlights: number
}

// `consumerId` labels the card. Post-hard-cut the consumer id IS the projectId,
// but aiDeck's state projection still hardcodes `state.consumer = 'project-status'`
// on the wire, so callers that know the real projectId pass it explicitly; the
// `state.consumer` default only applies to callers that don't.
export function adaptStateForHome(state: ProjectStatusState, consumerId: string = state.consumer): UIConsumer[] {
  if (state.plans.length === 0 && state.initiatives.length === 0) return []
  return [
    {
      id: consumerId,
      name: consumerId,
      path: `.atomic-skills/${consumerId}/`,
      health: 'active',
      lastWrite: state.generatedAt.slice(0, 10),
      plans: state.plans.map((p) => adaptPlanRow(p, state.initiatives)),
      initiatives: state.initiatives
        .filter((i) => !i.parentPlan)
        .map((i) => adaptInitRow(i)),
      errors: [],
    },
  ]
}

function adaptPlanRow(plan: Plan, initiatives: Initiative[]): UIPlanRow {
  const planInits = initiatives.filter((i) => i.parentPlan === plan.slug)
  const tasks = planInits.reduce(
    (acc, i) => ({
      done: acc.done + i.tasks.filter((t) => t.status === 'done').length,
      total: acc.total + i.tasks.length,
    }),
    { done: 0, total: 0 }
  )
  const phaseCounts = {
    done: plan.phases.filter((p) => p.status === 'done').length,
    active: plan.phases.filter((p) => p.status === 'active').length,
    pending: plan.phases.filter((p) => p.status === 'pending').length,
  }
  return {
    slug: plan.slug,
    title: plan.title,
    version: plan.version,
    status:
      plan.status === 'archived' || plan.status === 'paused' ? 'blocked' : (plan.status as 'active' | 'done'),
    branch: plan.branch ?? '—',
    currentPhase: plan.currentPhase,
    tasks,
    phases: phaseCounts,
    next: planInits.find((i) => i.status === 'active')?.nextAction ?? undefined,
    unreadAnnotations: 0,
    openHighlights: 0,
    criticalHighlights: 0,
  }
}

function adaptInitRow(initiative: Initiative): UIInitRow {
  return {
    slug: initiative.slug,
    title: initiative.title,
    status: initiative.status,
    tasks: {
      done: initiative.tasks.filter((t) => t.status === 'done').length,
      total: initiative.tasks.length,
    },
    next: initiative.nextAction ?? undefined,
    unreadAnnotations: 0,
    openHighlights: 0,
  }
}
