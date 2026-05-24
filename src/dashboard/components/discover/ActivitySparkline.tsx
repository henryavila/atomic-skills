import type { ActivityPoint } from '../../lib/types'

interface Props {
  timeline: ActivityPoint[]
  days?: number
}

export function ActivitySparkline({ timeline, days = 60 }: Props) {
  if (timeline.length === 0) return null
  const now = Date.now()
  const start = now - days * 86400000
  const w = 120
  const h = 16

  const points = timeline
    .map((p) => ({ x: (Date.parse(p.date) - start) / (now - start), count: p.count }))
    .filter((p) => p.x >= 0 && p.x <= 1)

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: 'block' }}>
      {points.map((p, i) => (
        <circle
          key={i}
          cx={p.x * (w - 4) + 2}
          cy={h / 2}
          r={Math.min(3, 1.5 + p.count * 0.5)}
          fill={i === points.length - 1 ? 'var(--accent-emerald)' : 'var(--fg-muted)'}
          opacity={0.7 + 0.3 * (i / Math.max(1, points.length - 1))}
        />
      ))}
    </svg>
  )
}
