import { Fragment } from 'react'
import type { UIPhase } from '../../lib/adapters'

interface Props {
  phases: UIPhase[]
}

/**
 * Data-quality banner: surfaces phases that declare `parallelWith` peers
 * while the plan has `parallelismAllowed: false`. Rendered above the phase
 * tree; the tree itself strips parallelWith and renders them as solo phases
 * to recover gracefully.
 */
export function InconsistencyBanner({ phases }: Props) {
  if (!phases.length) return null
  return (
    <div
      style={{
        marginTop: 14,
        padding: '10px 14px',
        background: 'color-mix(in srgb, var(--severity-warn) 9%, var(--bg-surface))',
        border: '1px solid color-mix(in srgb, var(--severity-warn) 40%, transparent)',
        borderRadius: 8,
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
      }}
    >
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 14,
          color: 'var(--severity-warn)',
          flex: 'none',
          marginTop: 1,
        }}
      >
        ⚠
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            fontWeight: 600,
            color: 'var(--severity-warn)',
            letterSpacing: '0.08em',
            marginBottom: 4,
          }}
        >
          DATA INCONSISTENCY
        </div>
        <div style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--fg-default)', lineHeight: 1.5 }}>
          Plan has{' '}
          <code style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--severity-warn)' }}>
            parallelismAllowed: false
          </code>{' '}
          but {phases.length === 1 ? 'phase' : 'phases'}{' '}
          {phases.map((p, i) => (
            <Fragment key={p.id}>
              {i > 0 && (i === phases.length - 1 ? ' and ' : ', ')}
              <code
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 12,
                  color: 'var(--fg-default)',
                  fontWeight: 600,
                }}
              >
                {p.id}
              </code>
            </Fragment>
          ))}{' '}
          declare{' '}
          <code style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--fg-muted)' }}>parallelWith</code>{' '}
          peers.{' '}
          <span style={{ color: 'var(--fg-muted)' }}>
            Treating as solo phases for rendering — fix the plan file to silence this.
          </span>
        </div>
      </div>
    </div>
  )
}
