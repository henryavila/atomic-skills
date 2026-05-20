import { Link, useParams } from 'react-router'
import { usePlan, useProjectState } from '../lib/hooks'
import {
  Card,
  GateStatusBadge,
  SectionHeader,
  StatusChip,
  StatusGlyph,
  TagChip,
} from '../components/atoms'
import type { PhaseDescriptor } from '../lib/types'

export function PlanPage() {
  const { slug } = useParams<{ slug: string }>()
  const { data: plan, isLoading, error } = usePlan(slug)
  const { data: state } = useProjectState()

  if (isLoading) return <Frame>Loading plan…</Frame>
  if (error)
    return (
      <Frame>
        <p className="text-severity-critical">Cannot load plan: {String(error)}</p>
      </Frame>
    )
  if (!plan) return <Frame>Plan not found.</Frame>

  // Map: phaseId → initiative slug (for in-plan initiatives that are active or
  // archived). Used to make phase rows clickable when there's a backing init.
  const phaseInit = new Map<string, string>()
  for (const i of state?.initiatives ?? []) {
    if (i.parentPlan === plan.slug && i.phaseId) phaseInit.set(i.phaseId, i.slug)
  }

  return (
    <Frame>
      <header className="mb-6">
        <div className="font-mono text-[11px] uppercase tracking-wider text-fg-subtle">
          plan · v{plan.version}
        </div>
        <h1 className="mt-1 text-2xl font-medium text-fg-default">{plan.title}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-fg-muted">
          <span>
            current phase:{' '}
            <span className="font-mono text-accent-primary">{plan.currentPhase ?? '—'}</span>
          </span>
          <span className="text-fg-faint">·</span>
          <span>{plan.phases.length} phases</span>
          {plan.parallelismAllowed && (
            <>
              <span className="text-fg-faint">·</span>
              <TagChip kind="parallel">parallel</TagChip>
            </>
          )}
          <span className="text-fg-faint">·</span>
          <StatusChip status={plan.status} />
        </div>
      </header>

      <Card>
        <SectionHeader count={plan.phases.length}>Phases</SectionHeader>
        <ul className="divide-y divide-border-subtle">
          {plan.phases.map((phase) => (
            <PhaseRow key={phase.id} phase={phase} initiativeSlug={phaseInit.get(phase.id)} />
          ))}
        </ul>
      </Card>

      <p className="mt-6 text-sm">
        <Link to="/" className="text-accent-link hover:underline">
          ← home
        </Link>
      </p>
    </Frame>
  )
}

interface PhaseRowProps {
  phase: PhaseDescriptor
  initiativeSlug?: string
}

function PhaseRow({ phase, initiativeSlug }: PhaseRowProps) {
  const pendingCount = phase.exitGate.criteria.filter((c) => c.status === 'pending').length
  const metCount = phase.exitGate.criteria.filter((c) => c.status === 'met').length
  const totalGates = phase.exitGate.criteria.length

  const body = (
    <div className="space-y-2 px-4 py-3">
      <div className="flex items-baseline gap-3">
        <StatusGlyph status={phase.status} size={14} />
        <span className="font-mono text-[13px] text-accent-primary">{phase.id}</span>
        <span className="flex-1 truncate text-sm text-fg-default">{phase.title}</span>
        {phase.track && <TagChip kind="parallel">{phase.track}</TagChip>}
        <StatusChip status={phase.status} />
      </div>
      <p className="text-xs text-fg-muted">{phase.goal}</p>
      <div className="flex flex-wrap items-center gap-2 text-[11px] text-fg-subtle">
        {phase.dependsOn.length > 0 && (
          <span className="font-mono">depends on: {phase.dependsOn.join(', ')}</span>
        )}
        {totalGates > 0 && (
          <>
            {phase.dependsOn.length > 0 && <span className="text-fg-faint">·</span>}
            <span className="font-mono">
              gates: {metCount}/{totalGates} met
              {pendingCount > 0 && ` · ${pendingCount} pending`}
            </span>
          </>
        )}
        {phase.exitGate.summary && (
          <>
            <span className="text-fg-faint">·</span>
            <GateStatusBadge status={pendingCount === 0 && totalGates > 0 ? 'met' : 'pending'} />
          </>
        )}
      </div>
    </div>
  )

  if (initiativeSlug) {
    return (
      <li>
        <Link
          to={`/initiatives/${initiativeSlug}`}
          className="block transition-colors hover:bg-bg-elevated"
        >
          {body}
        </Link>
      </li>
    )
  }
  return <li>{body}</li>
}

function Frame({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-7xl px-6 py-6">{children}</div>
}
