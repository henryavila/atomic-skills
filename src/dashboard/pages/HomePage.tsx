import { useStateChangeSubscription, useProjectState } from '../lib/hooks'

export function HomePage() {
  useStateChangeSubscription()
  const { data, isLoading, error } = useProjectState()

  if (isLoading) {
    return <Frame>Loading state…</Frame>
  }
  if (error) {
    return (
      <Frame>
        <h2 className="text-severity-critical">Cannot reach aideck</h2>
        <p className="mt-2 text-fg-muted">
          The dashboard expects an aideck server on <code className="font-mono">127.0.0.1:7777</code>.
          Run <code className="font-mono">npx atomic-skills serve</code> from the target repo.
        </p>
        <pre className="mt-4 overflow-auto rounded border border-border-default bg-bg-sunken p-3 text-xs text-fg-muted">
          {String(error)}
        </pre>
      </Frame>
    )
  }

  return (
    <Frame>
      <h1 className="text-2xl font-medium">atomic-skills · home</h1>
      <p className="mt-2 text-fg-muted">
        {data?.plans.length ?? 0} active plan(s), {data?.initiatives.length ?? 0} active initiative(s).
      </p>
      <ul className="mt-6 space-y-2">
        {data?.plans.map((p) => (
          <li key={p.slug} className="rounded border border-border-default bg-bg-surface p-3">
            <div className="font-mono text-sm text-accent-primary">{p.slug}</div>
            <div className="mt-1 text-sm text-fg-default">{p.title}</div>
            <div className="mt-1 text-xs text-fg-subtle">
              current phase: {p.currentPhase ?? '—'} · {p.phases.length} phases
            </div>
          </li>
        ))}
      </ul>
    </Frame>
  )
}

function Frame({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-6xl px-6 py-6">{children}</div>
}
