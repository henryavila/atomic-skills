import { useNavigate } from 'react-router'
import { useProjectState } from '../lib/hooks'
import { adaptStateForHome } from '../lib/adapters'
import { ConsumerBand, EmptyState, HomeHeader } from '../components/home/HomeComponents'

export function HomePage() {
  const navigate = useNavigate()
  const { data, isLoading, error } = useProjectState()

  if (isLoading) {
    return <Frame><p className="text-fg-muted">Loading project state…</p></Frame>
  }
  if (error) {
    return (
      <Frame>
        <div
          style={{
            padding: '16px 18px',
            background: 'color-mix(in srgb, var(--severity-critical) 6%, var(--bg-surface))',
            border: '1px solid color-mix(in srgb, var(--severity-critical) 35%, transparent)',
            borderRadius: 8,
          }}
        >
          <div
            className="t-eyebrow"
            style={{ color: 'var(--severity-critical)', marginBottom: 6 }}
          >
            CANNOT REACH AIDECK
          </div>
          <p style={{ margin: 0, color: 'var(--fg-muted)', fontSize: 13 }}>
            The dashboard expects an aideck server on{' '}
            <code className="font-mono" style={{ color: 'var(--fg-default)' }}>127.0.0.1:7777</code>. Run{' '}
            <code className="font-mono" style={{ color: 'var(--fg-default)' }}>npx atomic-skills serve</code> from the
            target repo.
          </p>
        </div>
      </Frame>
    )
  }

  const consumers = data ? adaptStateForHome(data) : []
  return (
    <Frame>
      <HomeHeader consumerCount={consumers.length} />
      {consumers.length === 0 ? (
        <EmptyState />
      ) : (
        <div style={{ marginTop: 12 }}>
          {consumers.map((c) => (
            <ConsumerBand key={c.id} consumer={c} onOpen={navigate} />
          ))}
        </div>
      )}
    </Frame>
  )
}

function Frame({ children }: { children: React.ReactNode }) {
  return <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 24px 80px' }}>{children}</div>
}
