import { useParams, Link } from 'react-router'
import { useInitiative } from '../lib/hooks'

export function InitiativePage() {
  const { slug } = useParams<{ slug: string }>()
  const { data: init, isLoading, error } = useInitiative(slug)

  if (isLoading) return <Frame>Loading initiative…</Frame>
  if (error) return <Frame>Cannot load initiative: {String(error)}</Frame>
  if (!init) return <Frame>Initiative not found.</Frame>

  const pendingTasks = init.tasks.filter((t) => t.status === 'pending' || t.status === 'active')
  return (
    <Frame>
      <header>
        <div className="font-mono text-xs text-fg-subtle">
          initiative {init.parentPlan && init.phaseId ? `· ${init.parentPlan}/${init.phaseId}` : '· standalone'}
        </div>
        <h1 className="text-2xl font-medium">{init.title}</h1>
        <div className="mt-1 text-sm text-fg-muted">{init.goal}</div>
      </header>

      <section className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card title={`Tasks (${init.tasks.length}, ${pendingTasks.length} open)`}>
          <ul className="space-y-1 text-sm">
            {init.tasks.map((t) => (
              <li key={t.id} className="flex items-baseline gap-2">
                <span className="font-mono text-xs text-fg-subtle">{t.id}</span>
                <span className="flex-1 truncate">{t.title}</span>
                <StatusDot status={t.status} />
              </li>
            ))}
          </ul>
        </Card>
        <Card title={`Stack (depth ${init.stack.length})`}>
          <ul className="space-y-1 text-sm">
            {init.stack.map((f) => (
              <li key={f.id} className="flex items-baseline gap-2 font-mono text-xs">
                <span className="text-fg-subtle">#{f.id}</span>
                <span className="text-fg-default">{f.title}</span>
                <span className="text-fg-faint">{f.type}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card title={`Parked (${init.parked.length})`}>
          <ul className="space-y-1 text-sm">
            {init.parked.map((p, i) => (
              <li key={i} className="text-fg-default">
                {p.title}
              </li>
            ))}
            {init.parked.length === 0 && <li className="text-fg-faint">none</li>}
          </ul>
        </Card>
        <Card title={`Emerged (${init.emerged.length})`}>
          <ul className="space-y-1 text-sm">
            {init.emerged.map((e, i) => (
              <li key={i} className="text-fg-default">
                {e.title} {e.promoted && <span className="text-fg-subtle">— promoted</span>}
              </li>
            ))}
            {init.emerged.length === 0 && <li className="text-fg-faint">none</li>}
          </ul>
        </Card>
      </section>

      {init.exitGates.length > 0 && (
        <section className="mt-6">
          <h2 className="text-lg font-medium">Exit gates</h2>
          <ul className="mt-2 space-y-2">
            {init.exitGates.map((c) => (
              <li key={c.id} className="rounded border border-border-default bg-bg-surface p-3 text-sm">
                <div className="flex items-baseline gap-2">
                  <span className="font-mono text-xs text-fg-subtle">{c.id}</span>
                  <span className="flex-1">{c.description}</span>
                  <GateStatusBadge status={c.status} />
                </div>
                {c.evidence && (
                  <div className="mt-1 text-xs text-fg-muted">
                    verifier: {c.evidence.verifierKind} · {c.evidence.passed === true ? 'pass' : 'fail'} ·{' '}
                    {c.evidence.verifiedAt}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="mt-8 text-sm text-fg-subtle">
        {init.parentPlan && (
          <Link to={`/plans/${init.parentPlan}`} className="text-accent-link hover:underline">
            ← {init.parentPlan}
          </Link>
        )}
      </p>
    </Frame>
  )
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded border border-border-default bg-bg-surface p-3">
      <div className="mb-2 text-xs uppercase tracking-wide text-fg-subtle">{title}</div>
      {children}
    </div>
  )
}

function StatusDot({ status }: { status: string }) {
  const map: Record<string, string> = {
    done: 'bg-status-done',
    active: 'bg-status-active',
    pending: 'bg-status-pending',
    blocked: 'bg-status-blocked',
  }
  return <span className={`inline-block h-2 w-2 rounded-full ${map[status] ?? 'bg-fg-faint'}`} aria-label={status} />
}

function GateStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    met: 'text-status-done',
    deferred: 'text-status-blocked',
    pending: 'text-fg-muted',
  }
  return <span className={`font-mono text-xs ${map[status] ?? 'text-fg-faint'}`}>{status}</span>
}

function Frame({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-6xl px-6 py-6">{children}</div>
}
