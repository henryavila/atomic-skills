import { Fragment, type ReactNode } from 'react'
import { StatusChip } from '../atoms'
import type { UIPlan } from '../../lib/adapters'

interface Props {
  plan: UIPlan
  refsCount: number
  onTogglePrinciples?: () => void
  onToggleGlossary?: () => void
  onToggleRefs?: () => void
}

export function PlanHero({ plan, refsCount, onTogglePrinciples, onToggleGlossary, onToggleRefs }: Props) {
  type Meta = {
    label: string
    value: ReactNode
    color?: string
    clickable?: (() => void) | null
  }
  const metas: Meta[] = [
    { label: 'started', value: plan.started, color: 'var(--fg-default)' },
    { label: 'branch', value: plan.branch ?? '—', color: 'var(--fg-default)' },
    {
      label: 'current',
      value: plan.currentPhase ?? '—',
      color: plan.currentPhase ? 'var(--status-active)' : 'var(--fg-muted)',
    },
    { label: 'phases', value: `${plan.phases.length}`, color: 'var(--fg-default)' },
    { label: 'tracks', value: `${plan.tracks.length}`, color: 'var(--fg-default)' },
    {
      label: 'principles',
      value: `${plan.principles.length}`,
      color: 'var(--fg-default)',
      clickable: plan.principles.length > 0 ? onTogglePrinciples : null,
    },
    {
      label: 'glossary',
      value: `${plan.glossary.length}`,
      color: 'var(--fg-default)',
      clickable: plan.glossary.length > 0 ? onToggleGlossary : null,
    },
    {
      label: 'refs',
      value: `${refsCount}`,
      color: 'var(--fg-default)',
      clickable: refsCount > 0 ? onToggleRefs : null,
    },
  ]
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="t-eyebrow" style={{ color: 'var(--fg-subtle)', marginBottom: 6 }}>
            PLAN · {plan.version} · {plan.slug}
          </div>
          <h1
            style={{
              margin: 0,
              fontFamily: 'var(--font-sans)',
              fontSize: 30,
              fontWeight: 600,
              color: 'var(--fg-default)',
              letterSpacing: '-0.025em',
              lineHeight: 1.1,
            }}
          >
            {plan.title}
          </h1>
        </div>
        <StatusChip status={plan.status} />
      </div>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 0,
          marginTop: 14,
          padding: '10px 4px',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-default)',
          borderRadius: 8,
          boxShadow: 'var(--shadow-ambient)',
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
        }}
      >
        {metas.map((m, i) => (
          <Fragment key={m.label}>
            <button
              onClick={m.clickable ?? undefined}
              onMouseEnter={(e) => {
                if (m.clickable) e.currentTarget.style.background = 'var(--bg-elevated)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent'
              }}
              style={{
                all: 'unset',
                cursor: m.clickable ? 'pointer' : 'default',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 14px',
                whiteSpace: 'nowrap',
                flex: 'none',
                borderRadius: 4,
                transition: 'background 120ms',
              }}
            >
              <span style={{ color: 'var(--fg-subtle)' }}>{m.label}</span>
              <span style={{ color: m.color ?? 'var(--fg-default)', fontWeight: 500 }}>{m.value}</span>
              {m.clickable && <span style={{ color: 'var(--fg-faint)', fontSize: 9 }}>▸</span>}
            </button>
            {i < metas.length - 1 && (
              <span style={{ width: 1, height: 14, background: 'var(--border-default)', flex: 'none' }} />
            )}
          </Fragment>
        ))}
      </div>
    </div>
  )
}
