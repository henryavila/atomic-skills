import type { UIPhase } from '../../lib/adapters'

interface Props {
  phase: UIPhase
  onOpen: (phase: UIPhase) => void
}

export function ActivePhaseCallout({ phase, onOpen }: Props) {
  return (
    <div
      className="has-texture-active"
      style={{
        marginTop: 16,
        padding: '14px 16px',
        background: 'color-mix(in srgb, var(--status-active) 7%, var(--bg-surface))',
        border: '1px solid color-mix(in srgb, var(--status-active) 35%, transparent)',
        borderRadius: 8,
        position: 'relative',
        overflow: 'hidden',
        boxShadow: 'var(--shadow-glow-active)',
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 3,
          background: 'var(--status-active)',
          zIndex: 1,
        }}
      />
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginLeft: 8,
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'relative',
            width: 22,
            height: 22,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            flex: 'none',
          }}
        >
          <span
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              background: 'var(--status-active)',
              opacity: 0.25,
              animation: 'atomic-pulse 2s ease-out infinite',
            }}
          />
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 14,
              color: 'var(--status-active)',
              fontWeight: 700,
            }}
          >
            ◉
          </span>
        </div>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            fontWeight: 600,
            color: 'var(--status-active)',
            letterSpacing: '0.1em',
          }}
        >
          YOU ARE HERE
        </span>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--status-active)',
          }}
        >
          {phase.id}
        </span>
        <span
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 15,
            fontWeight: 600,
            color: 'var(--fg-default)',
            flex: 1,
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {phase.title}
        </span>
        <button
          onClick={() => onOpen(phase)}
          style={{
            all: 'unset',
            cursor: 'pointer',
            fontFamily: 'var(--font-sans)',
            fontSize: 12,
            fontWeight: 500,
            color: 'var(--accent-link)',
            padding: '4px 10px',
            border: '1px solid color-mix(in srgb, var(--accent-link) 35%, transparent)',
            borderRadius: 4,
            background: 'var(--bg-canvas)',
            whiteSpace: 'nowrap',
          }}
        >
          Open →
        </button>
      </div>
      {phase.next && (
        <div
          style={{
            marginLeft: 8,
            marginTop: 8,
            position: 'relative',
            fontFamily: 'var(--font-sans)',
            fontSize: 13,
            color: 'var(--fg-muted)',
          }}
        >
          <span style={{ color: 'var(--fg-subtle)' }}>next action:</span>{' '}
          <span style={{ color: 'var(--fg-default)', fontWeight: 500 }}>{phase.next}</span>
        </div>
      )}
    </div>
  )
}

export function TrackHeader({ track }: { track: { id: string; title: string } }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '6px 0',
        marginTop: 14,
      }}
    >
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          fontWeight: 600,
          color: 'var(--fg-muted)',
          letterSpacing: '0.08em',
          whiteSpace: 'nowrap',
          flex: 'none',
        }}
      >
        TRACK {track.id} — {track.title.toUpperCase()}
      </span>
      <div style={{ flex: 1, minWidth: 0, height: 1, background: 'var(--border-subtle)' }} />
    </div>
  )
}
