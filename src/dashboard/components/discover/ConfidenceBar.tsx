import { SOURCE_TYPES } from './constants'

interface Props {
  breakdown: Record<string, number>
  confidence: number
}

export function ConfidenceBar({ breakdown, confidence }: Props) {
  const total = Math.max(
    confidence,
    Object.values(breakdown).reduce((a, b) => a + b, 0),
  )
  const entries = Object.entries(breakdown).sort((a, b) => b[1] - a[1])

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 200 }}>
      <div
        style={{
          position: 'relative',
          flex: 1,
          minWidth: 140,
          maxWidth: 220,
          height: 6,
          background: 'var(--bg-sunken)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 2,
          display: 'flex',
          overflow: 'hidden',
        }}
        title={entries.map(([k, v]) => `${k} +${v.toFixed(2)}`).join('\n')}
      >
        {entries.map(([k, v]) => {
          const s = SOURCE_TYPES[k] || { color: 'var(--fg-subtle)' }
          return (
            <span
              key={k}
              style={{
                flex: v,
                background: s.color,
                opacity: 0.85,
                borderRight: '1px solid var(--bg-sunken)',
              }}
            />
          )
        })}
        {total < 1 && <span style={{ flex: 1 - total, background: 'transparent' }} />}
      </div>
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          fontWeight: 600,
          color:
            confidence >= 0.6
              ? 'var(--status-done)'
              : confidence >= 0.4
                ? 'var(--status-active)'
                : confidence >= 0.2
                  ? 'var(--status-blocked)'
                  : 'var(--fg-subtle)',
          minWidth: 28,
          textAlign: 'right',
        }}
      >
        {confidence.toFixed(2)}
      </span>
    </div>
  )
}
