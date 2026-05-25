import type { ActivityPoint } from '../../lib/types'
import { SOURCE_TYPES, daysBetween, fmtDate } from './constants'

interface Props {
  timeline: ActivityPoint[]
  anchorDate: string
  width?: number
  height?: number
}

export function ActivitySparkline({ timeline, anchorDate, width = 184, height = 38 }: Props) {
  if (!timeline || timeline.length === 0) {
    return (
      <div
        style={{
          width,
          height,
          opacity: 0.3,
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          color: 'var(--fg-faint)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        no activity
      </div>
    )
  }

  const WINDOW = 60
  const padX = 26
  const baseY = height - 16
  const labelY = height - 4
  const totalCount = timeline.reduce((a, t) => a + t.count, 0)
  const activeDays = timeline.length
  const lastTimelineDate = timeline[timeline.length - 1].date

  const dots = timeline.map((t) => {
    const ago = daysBetween(t.date, anchorDate)
    const x = padX + ((WINDOW - Math.min(ago, WINDOW)) / WINDOW) * (width - padX * 2)
    const primaryType = t.types[0]
    const color = (SOURCE_TYPES[primaryType] || { color: 'var(--fg-muted)' }).color
    return { x, y: baseY, color, count: t.count, date: t.date, types: t.types, ago }
  })
  const lastIdx = dots.length - 1

  const tooltip = `${WINDOW}-day activity · ${totalCount} signal${totalCount !== 1 ? 's' : ''} across ${activeDays} day${activeDays !== 1 ? 's' : ''} · most recent ${fmtDate(lastTimelineDate)}`

  return (
    <svg width={width} height={height} aria-label={tooltip} role="img" style={{ display: 'block', flex: 'none' }}>
      <title>{tooltip}</title>
      {/* baseline */}
      <line x1={padX} x2={width - padX} y1={baseY} y2={baseY} stroke="var(--border-default)" strokeWidth="1" />
      {/* end caps */}
      <line x1={padX} x2={padX} y1={baseY - 3} y2={baseY + 3} stroke="var(--border-default)" strokeWidth="1" />
      <line
        x1={width - padX}
        x2={width - padX}
        y1={baseY - 3}
        y2={baseY + 3}
        stroke="var(--border-default)"
        strokeWidth="1"
      />
      {/* 30-day midpoint tick */}
      {(() => {
        const x = padX + 0.5 * (width - padX * 2)
        return <line x1={x} x2={x} y1={baseY - 2} y2={baseY + 2} stroke="var(--border-subtle)" strokeWidth="1" />
      })()}
      {/* axis labels */}
      <text
        x={padX}
        y={labelY}
        textAnchor="middle"
        dominantBaseline="middle"
        fontFamily="var(--font-mono)"
        fontSize="9"
        fill="var(--fg-faint)"
      >
        −60d
      </text>
      <text
        x={width - padX}
        y={labelY}
        textAnchor="middle"
        dominantBaseline="middle"
        fontFamily="var(--font-mono)"
        fontSize="9"
        fill="var(--fg-faint)"
      >
        now
      </text>
      {/* dots */}
      {dots.map((d, i) => {
        const isLast = i === lastIdx
        const r = Math.min(2.4 + Math.log2(d.count + 1) * 1.1, 5)
        return (
          <g key={i}>
            <line x1={d.x} x2={d.x} y1={baseY} y2={d.y - r} stroke={d.color} strokeWidth="1" opacity={isLast ? 0.45 : 0.25} />
            {isLast && <circle cx={d.x} cy={d.y - r - 1} r={r + 3} fill={d.color} opacity={0.2} />}
            <circle
              cx={d.x}
              cy={d.y - r - 1}
              r={r}
              fill={d.color}
              opacity={isLast ? 1 : 0.75}
              stroke={isLast ? d.color : 'none'}
              strokeWidth={isLast ? 0.6 : 0}
            >
              <title>{`${fmtDate(d.date)} · ${d.count} signal${d.count > 1 ? 's' : ''} · ${d.types.join(', ')}`}</title>
            </circle>
          </g>
        )
      })}
    </svg>
  )
}
