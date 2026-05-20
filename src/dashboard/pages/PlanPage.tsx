import { useParams, Link } from 'react-router'
import { usePlan } from '../lib/hooks'

export function PlanPage() {
  const { slug } = useParams<{ slug: string }>()
  const { data: plan, isLoading, error } = usePlan(slug)

  if (isLoading) return <Frame>Loading plan…</Frame>
  if (error) return <Frame>Cannot load plan: {String(error)}</Frame>
  if (!plan) return <Frame>Plan not found.</Frame>

  return (
    <Frame>
      <header>
        <div className="font-mono text-xs text-fg-subtle">plan · v{plan.version}</div>
        <h1 className="text-2xl font-medium">{plan.title}</h1>
        <div className="mt-1 text-sm text-fg-muted">
          current phase: <span className="font-mono text-accent-primary">{plan.currentPhase ?? '—'}</span> ·{' '}
          {plan.phases.length} phases · status {plan.status}
        </div>
      </header>

      <h2 className="mt-8 text-lg font-medium">Phases</h2>
      <ul className="mt-3 space-y-2">
        {plan.phases.map((phase) => (
          <li key={phase.id} className="rounded border border-border-default bg-bg-surface p-3">
            <div className="flex items-baseline gap-3">
              <span className="font-mono text-sm text-accent-primary">{phase.id}</span>
              <span className="text-sm text-fg-default">{phase.title}</span>
              <span className="ml-auto text-xs text-fg-subtle">{phase.status}</span>
            </div>
            <div className="mt-1 text-xs text-fg-muted">{phase.goal}</div>
            {phase.exitGate.criteria.length > 0 && (
              <div className="mt-2 text-xs text-fg-subtle">
                {phase.exitGate.criteria.length} exit-gate criteria
              </div>
            )}
          </li>
        ))}
      </ul>

      <p className="mt-8 text-sm text-fg-subtle">
        <Link to="/" className="text-accent-link hover:underline">
          ← home
        </Link>
      </p>
    </Frame>
  )
}

function Frame({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-6xl px-6 py-6">{children}</div>
}
