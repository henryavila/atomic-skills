import { Link } from 'react-router'
import { useProjectState } from '../lib/hooks'
import { Card, SectionHeader, StatusChip } from '../components/atoms'

export function HomePage() {
  // SSE subscription is mounted once at App level — no per-page hook here.
  const { data, isLoading, error } = useProjectState()

  if (isLoading) {
    return (
      <Frame>
        <p className="text-fg-muted">Loading state…</p>
      </Frame>
    )
  }
  if (error) {
    return (
      <Frame>
        <Card className="border-severity-critical">
          <SectionHeader>Cannot reach aideck</SectionHeader>
          <div className="space-y-2 p-4 text-sm">
            <p className="text-fg-muted">
              The dashboard expects an aideck server on{' '}
              <code className="font-mono text-fg-default">127.0.0.1:7777</code>. Run{' '}
              <code className="font-mono text-fg-default">npx atomic-skills serve</code> from the
              target repo.
            </p>
            <pre className="overflow-auto rounded border border-border-default bg-bg-sunken p-3 text-xs text-fg-muted">
              {String(error)}
            </pre>
          </div>
        </Card>
      </Frame>
    )
  }

  const plans = data?.plans ?? []
  const standalone = (data?.initiatives ?? []).filter((i) => !i.parentPlan)

  return (
    <Frame>
      <div className="mb-4 flex items-baseline justify-between">
        <h1 className="text-xl font-medium text-fg-default">Project status</h1>
        <span className="font-mono text-[11px] text-fg-subtle">
          {plans.length} plan{plans.length === 1 ? '' : 's'} · {standalone.length} standalone
        </span>
      </div>

      <Card>
        <SectionHeader count={plans.length}>Active plans</SectionHeader>
        {plans.length === 0 ? (
          <div className="p-4 text-sm text-fg-faint">No active plans.</div>
        ) : (
          <ul className="divide-y divide-border-subtle">
            {plans.map((p) => (
              <li key={p.slug}>
                <Link
                  to={`/plans/${p.slug}`}
                  className="flex items-baseline gap-3 px-4 py-3 transition-colors hover:bg-bg-elevated"
                >
                  <span className="font-mono text-[13px] text-accent-primary">{p.slug}</span>
                  <span className="flex-1 truncate text-sm text-fg-default">{p.title}</span>
                  <span className="font-mono text-[11px] text-fg-subtle">
                    {p.currentPhase ?? '—'} · {p.phases.length}p
                  </span>
                  <StatusChip status={p.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {standalone.length > 0 && (
        <div className="mt-6">
          <Card>
            <SectionHeader count={standalone.length}>Standalone initiatives</SectionHeader>
            <ul className="divide-y divide-border-subtle">
              {standalone.map((i) => (
                <li key={i.slug}>
                  <Link
                    to={`/initiatives/${i.slug}`}
                    className="flex items-baseline gap-3 px-4 py-3 transition-colors hover:bg-bg-elevated"
                  >
                    <span className="font-mono text-[13px] text-accent-primary">{i.slug}</span>
                    <span className="flex-1 truncate text-sm text-fg-default">{i.title}</span>
                    <StatusChip status={i.status} />
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}
    </Frame>
  )
}

function Frame({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-7xl px-6 py-6">{children}</div>
}
