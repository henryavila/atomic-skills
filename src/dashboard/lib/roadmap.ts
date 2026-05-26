// Roadmap data layer — rollup helpers for the ProjectsIndex and Project Detail views.
//
// Three rollup levels:
//   rollupRoadmap(consumers)   → lanes for one project (card strip + detail view)
//   rollupProject(consumers)   → aggregate metrics for one project card
//   rollupScenario(rollups[])  → aggregate metrics for the index header

import type { UIConsumer, UIPlanRow, UIInitRow } from './adapters'

// ── Lane definitions ──────────────────────────────────────────────────────

export type LaneKey = 'inflight' | 'blocked' | 'upnext' | 'parked' | 'shipped'

export interface LaneDef {
  key: LaneKey
  label: string
  statuses: string[]
}

export const ROADMAP_LANES: LaneDef[] = [
  { key: 'inflight', label: 'In flight', statuses: ['active'] },
  { key: 'blocked',  label: 'Blocked',   statuses: ['blocked', 'paused'] },
  { key: 'upnext',   label: 'Up next',   statuses: ['pending'] },
  { key: 'parked',   label: 'Parked',    statuses: ['archived'] },
  { key: 'shipped',  label: 'Shipped',   statuses: ['done'] },
]

// ── Roadmap item — a plan or initiative flattened into a lane entry ────────

export interface RoadmapItem {
  kind: 'plan' | 'initiative'
  slug: string
  title: string
  status: string
  tasks: { done: number; total: number }
  next?: string
  consumer: string
  currentPhase?: string
  phases?: { done: number; active: number; pending: number }
  openHighlights: number
  criticalHighlights: number
  unreadAnnotations: number
}

export interface RoadmapResult {
  lanes: Record<LaneKey, RoadmapItem[]>
  counts: Record<LaneKey, number>
  total: number
  items: RoadmapItem[]
}

export function rollupRoadmap(consumers: UIConsumer[]): RoadmapResult {
  const items: RoadmapItem[] = []
  for (const c of consumers) {
    for (const p of c.plans) items.push(planToRoadmapItem(p, c.name))
    for (const i of c.initiatives) items.push(initToRoadmapItem(i, c.name))
  }

  const lanes: Record<LaneKey, RoadmapItem[]> = {
    inflight: [], blocked: [], upnext: [], parked: [], shipped: [],
  }
  for (const it of items) {
    const lane = ROADMAP_LANES.find(l => l.statuses.includes(it.status))
    if (lane) lanes[lane.key].push(it)
    else lanes.upnext.push(it)
  }

  const counts: Record<LaneKey, number> = {
    inflight: lanes.inflight.length,
    blocked: lanes.blocked.length,
    upnext: lanes.upnext.length,
    parked: lanes.parked.length,
    shipped: lanes.shipped.length,
  }

  return { lanes, counts, total: items.length, items }
}

function planToRoadmapItem(p: UIPlanRow, consumer: string): RoadmapItem {
  return {
    kind: 'plan',
    slug: p.slug,
    title: p.title,
    status: p.status,
    tasks: p.tasks,
    next: p.next,
    consumer,
    currentPhase: p.currentPhase ?? undefined,
    phases: p.phases,
    openHighlights: p.openHighlights,
    criticalHighlights: p.criticalHighlights,
    unreadAnnotations: p.unreadAnnotations,
  }
}

function initToRoadmapItem(i: UIInitRow, consumer: string): RoadmapItem {
  return {
    kind: 'initiative',
    slug: i.slug,
    title: i.title,
    status: i.status,
    tasks: i.tasks,
    next: i.next,
    consumer,
    openHighlights: i.openHighlights,
    criticalHighlights: 0,
    unreadAnnotations: i.unreadAnnotations,
  }
}

// ── Project rollup — aggregate metrics for one project card ───────────────

export interface ProjectRollup {
  consumerCount: number
  erroredConsumers: number
  planCount: number
  initiativeCount: number
  activePlan: UIPlanRow | null
  blockedPlans: number
  activeInitiatives: number
  doneInitiatives: number
  tasks: { done: number; total: number }
  highlights: { total: number; critical: number }
  unread: number
  planList: Array<UIPlanRow & { consumer: string }>
  initiativeList: Array<UIInitRow & { consumer: string }>
  roadmap: RoadmapResult
}

export function rollupProject(consumers: UIConsumer[]): ProjectRollup {
  let planCount = 0
  let initiativeCount = 0
  let tasksDone = 0
  let tasksTotal = 0
  let activePlan: UIPlanRow | null = null
  let blockedPlans = 0
  let activeInitiatives = 0
  let doneInitiatives = 0
  let erroredConsumers = 0
  let highlightsTotal = 0
  let highlightsCritical = 0
  let unread = 0
  const planList: Array<UIPlanRow & { consumer: string }> = []
  const initiativeList: Array<UIInitRow & { consumer: string }> = []

  for (const c of consumers) {
    if (c.health === 'errored') erroredConsumers++
    for (const p of c.plans) {
      planCount++
      tasksDone += p.tasks.done
      tasksTotal += p.tasks.total
      highlightsTotal += p.openHighlights
      highlightsCritical += p.criticalHighlights
      unread += p.unreadAnnotations
      if (p.status === 'active' && !activePlan) activePlan = p
      if (p.status === 'blocked') blockedPlans++
      planList.push({ ...p, consumer: c.name })
    }
    for (const i of c.initiatives) {
      initiativeCount++
      tasksDone += i.tasks.done
      tasksTotal += i.tasks.total
      highlightsTotal += i.openHighlights
      unread += i.unreadAnnotations
      if (i.status === 'active') activeInitiatives++
      if (i.status === 'done') doneInitiatives++
      initiativeList.push({ ...i, consumer: c.name })
    }
  }

  return {
    consumerCount: consumers.length,
    erroredConsumers,
    planCount,
    initiativeCount,
    activePlan,
    blockedPlans,
    activeInitiatives,
    doneInitiatives,
    tasks: { done: tasksDone, total: tasksTotal },
    highlights: { total: highlightsTotal, critical: highlightsCritical },
    unread,
    planList,
    initiativeList,
    roadmap: rollupRoadmap(consumers),
  }
}

// Hero selection: active plan → blocked plan → active initiative → first plan → first initiative
export function pickHeroItem(rollup: ProjectRollup): RoadmapItem | null {
  const { roadmap } = rollup
  const inflight = roadmap.lanes.inflight
  const blocked = roadmap.lanes.blocked

  const activePlan = inflight.find(it => it.kind === 'plan')
  if (activePlan) return activePlan

  const blockedPlan = blocked.find(it => it.kind === 'plan')
  if (blockedPlan) return blockedPlan

  const activeInit = inflight.find(it => it.kind === 'initiative')
  if (activeInit) return activeInit

  const firstPlan = roadmap.items.find(it => it.kind === 'plan')
  if (firstPlan) return firstPlan

  const firstInit = roadmap.items.find(it => it.kind === 'initiative')
  if (firstInit) return firstInit

  return null
}

// ── Scenario rollup — aggregate metrics for the index header ──────────────

export interface ScenarioRollup {
  projectCount: number
  activeProjects: number
  idleProjects: number
  erroredProjects: number
  planCount: number
  initiativeCount: number
  highlights: { total: number; critical: number }
  unread: number
}

export interface ProjectWithRollup {
  health: 'active' | 'idle' | 'errored' | 'empty'
  rollup: ProjectRollup
}

export function rollupScenario(projects: ProjectWithRollup[]): ScenarioRollup {
  let activeProjects = 0
  let idleProjects = 0
  let erroredProjects = 0
  let planCount = 0
  let initiativeCount = 0
  let highlightsTotal = 0
  let highlightsCritical = 0
  let unread = 0

  for (const p of projects) {
    if (p.health === 'active') activeProjects++
    if (p.health === 'idle') idleProjects++
    if (p.health === 'errored') erroredProjects++
    planCount += p.rollup.planCount
    initiativeCount += p.rollup.initiativeCount
    highlightsTotal += p.rollup.highlights.total
    highlightsCritical += p.rollup.highlights.critical
    unread += p.rollup.unread
  }

  return {
    projectCount: projects.length,
    activeProjects,
    idleProjects,
    erroredProjects,
    planCount,
    initiativeCount,
    highlights: { total: highlightsTotal, critical: highlightsCritical },
    unread,
  }
}
