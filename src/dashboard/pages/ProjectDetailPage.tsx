import { Fragment } from 'react'
import { useParams, useNavigate } from 'react-router'
import { useProjectScopedState, useProjectState, useHealth } from '../lib/hooks'
import { adaptStateForHome } from '../lib/adapters'
import type { UIConsumer } from '../lib/adapters'
import { Roadmap, RoadmapSources } from '../components/home/Roadmap'

// ── ConsumerErroredBlock ──────────────────────────────────────────────────

function ConsumerErroredBlock({ consumer }: { consumer: UIConsumer }) {
  if (consumer.health !== 'errored') return null
  return (
    <div style={{
      padding: '14px 16px', marginBottom: 14,
      background: 'color-mix(in srgb, var(--severity-critical) 6%, var(--bg-surface))',
      border: '1px solid color-mix(in srgb, var(--severity-critical) 30%, transparent)',
      borderRadius: 8,
    }}>
      <div className="t-eyebrow" style={{ color: 'var(--severity-critical)', marginBottom: 8 }}>
        ⊘ {consumer.name} — PARSE ERRORS
      </div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--fg-muted)' }}>
        Consumer reported errors. Check the files listed in the aiDeck logs.
      </div>
    </div>
  )
}

// ── ProjectDetailPage ─────────────────────────────────────────────────────

export function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const { data: health } = useHealth()

  // Try project-scoped API first, fall back to legacy single-project API
  const scopedState = useProjectScopedState(projectId)
  const legacyState = useProjectState()

  const data = scopedState.data ?? legacyState.data
  const isLoading = scopedState.isLoading && legacyState.isLoading
  const error = scopedState.error && legacyState.error

  // Derive display name from health rootDir or projectId
  const projectName = health?.rootDir
    ? health.rootDir.split('/').pop() ?? projectId ?? 'project'
    : projectId ?? 'project'

  if (isLoading) {
    return <Frame><p style={{ color: 'var(--fg-muted)' }}>Loading project…</p></Frame>
  }

  if (error || !data) {
    return (
      <Frame>
        <BackButton onClick={() => navigate('/')} />
        <div style={{
          padding: '16px 18px', marginTop: 12,
          background: 'color-mix(in srgb, var(--severity-critical) 6%, var(--bg-surface))',
          border: '1px solid color-mix(in srgb, var(--severity-critical) 35%, transparent)',
          borderRadius: 8,
        }}>
          <div className="t-eyebrow" style={{ color: 'var(--severity-critical)', marginBottom: 6 }}>
            PROJECT NOT FOUND
          </div>
          <p style={{ margin: 0, color: 'var(--fg-muted)', fontSize: 13 }}>
            Could not load state for project <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--fg-default)' }}>{projectId}</code>.
          </p>
        </div>
      </Frame>
    )
  }

  const consumers = adaptStateForHome(data)

  const onNav = (path: string) => {
    navigate(`/${projectId}${path}`)
  }

  const erroredConsumers = consumers.filter(c => c.health === 'errored')

  const planCount = consumers.reduce((n, c) => n + c.plans.length, 0)
  const initCount = consumers.reduce((n, c) => n + c.initiatives.length, 0)
  const activeConsumers = consumers.filter(c => c.health === 'active').length
  const totalHighlights = consumers.reduce((n, c) =>
    n + c.plans.reduce((pn, p) => pn + p.openHighlights, 0), 0)
  const totalUnread = consumers.reduce((n, c) =>
    n + c.plans.reduce((pn, p) => pn + p.unreadAnnotations, 0), 0)

  return (
    <Frame>
      <BackButton onClick={() => navigate('/')} />

      {/* eyebrow + title */}
      <div style={{ marginTop: 12 }}>
        <div className="t-eyebrow" style={{
          color: 'var(--fg-subtle)', marginBottom: 8,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span>PROJECT</span>
          <span style={{ color: 'var(--fg-faint)' }}>·</span>
          <span style={{ color: 'var(--fg-faint)' }}>~/.atomic-skills/</span>
        </div>
        <h1 style={{
          margin: 0, fontFamily: 'var(--font-sans)', fontSize: 30, fontWeight: 600,
          color: 'var(--fg-default)', letterSpacing: '-0.025em', lineHeight: 1.1,
        }}>{projectName}</h1>
      </div>

      {/* metric strip */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 0,
        marginTop: 14, padding: '8px 14px',
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-default)',
        borderRadius: 8,
        fontFamily: 'var(--font-mono)', fontSize: 11,
      }}>
        {[
          { label: 'consumers', value: `${activeConsumers}/${consumers.length}`, accent: activeConsumers > 0 ? 'var(--fg-default)' : undefined, suffix: activeConsumers > 0 ? ' active' : '' },
          { label: 'plans', value: String(planCount) },
          { label: 'init', value: String(initCount) },
          { label: 'highlights', value: String(totalHighlights), accent: totalHighlights > 0 ? 'var(--status-highlighted)' : undefined, suffix: ' open' },
          { label: 'unread', value: String(totalUnread), accent: totalUnread > 0 ? 'var(--status-emerged)' : undefined },
        ].map((m, i, arr) => (
          <Fragment key={m.label}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '0 12px', whiteSpace: 'nowrap' }}>
              <span style={{ color: 'var(--fg-subtle)' }}>{m.label}</span>
              <span style={{ color: m.accent ?? 'var(--fg-default)', fontWeight: 500 }}>
                {m.value}{m.suffix ?? ''}
              </span>
            </span>
            {i < arr.length - 1 && <span style={{ width: 1, height: 12, background: 'var(--border-default)' }} />}
          </Fragment>
        ))}
      </div>

      {/* errored consumers */}
      {erroredConsumers.length > 0 && (
        <div style={{ marginTop: 14 }}>
          {erroredConsumers.map(c => <ConsumerErroredBlock key={c.id} consumer={c} />)}
        </div>
      )}

      {/* roadmap */}
      <Roadmap consumers={consumers} onNav={onNav} />

      {/* sources */}
      <RoadmapSources consumers={consumers} />
    </Frame>
  )
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        all: 'unset', cursor: 'pointer',
        display: 'inline-flex', alignItems: 'center', gap: 6,
        height: 28, padding: '0 12px',
        background: 'transparent',
        border: '1px solid var(--border-subtle)',
        borderRadius: 999,
        fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 500,
        color: 'var(--fg-muted)',
        transition: 'background 120ms, border-color 120ms',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-surface)'; e.currentTarget.style.borderColor = 'var(--border-default)' }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'var(--border-subtle)' }}
    >
      ← All projects
    </button>
  )
}

function Frame({ children }: { children: React.ReactNode }) {
  return <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 24px 80px' }}>{children}</div>
}
