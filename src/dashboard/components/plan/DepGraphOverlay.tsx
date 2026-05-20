// Faithful port of DepGraphOverlay.jsx — hand-drawn SVG of the phase DAG.
// Topological-column layout via Kahn, row by track. Parallel pairs get a
// dashed backdrop pill. Edges curve with cubic bezier and use an arrow
// marker. Only renders when `open` is true.

import { useMemo, type ReactElement } from 'react'
import type { UIPlan, UIPhase } from '../../lib/adapters'

interface Props {
  open: boolean
  plan: UIPlan
  onClose: () => void
  onOpenPhase?: (phase: UIPhase) => void
}

export function DepGraphOverlay({ open, plan, onClose, onOpenPhase }: Props) {
  const positions = useMemo(() => {
    const ids = plan.phases.map((p) => p.id)
    const inDeg: Record<string, number> = {}
    const adj: Record<string, string[]> = {}
    ids.forEach((id) => {
      inDeg[id] = 0
      adj[id] = []
    })
    plan.deps.forEach((d) => {
      if (inDeg[d.to] != null && adj[d.from]) {
        inDeg[d.to]++
        adj[d.from].push(d.to)
      }
    })
    const col: Record<string, number> = {}
    let q = ids.filter((id) => inDeg[id] === 0)
    let level = 0
    while (q.length) {
      const next: string[] = []
      q.forEach((id) => {
        col[id] = level
        adj[id].forEach((n) => {
          inDeg[n]--
          if (inDeg[n] === 0) next.push(n)
        })
      })
      q = next
      level++
    }
    const maxCol = Math.max(0, ...Object.values(col))
    const trackIdx: Record<string, number> = {}
    plan.tracks.forEach((t, i) => {
      trackIdx[t.id] = i
    })
    const maxRow = Math.max(0, plan.tracks.length - 1)
    const COL_W = 150
    const ROW_H = 72
    const PAD_X = 96
    const PAD_Y = 56
    const pos: Record<string, { x: number; y: number; col: number; row: number }> = {}
    plan.phases.forEach((p) => {
      const c = col[p.id] ?? 0
      const r = trackIdx[p.track ?? plan.tracks[0]?.id ?? 'main'] ?? 0
      pos[p.id] = { x: PAD_X + c * COL_W, y: PAD_Y + r * ROW_H, col: c, row: r }
    })
    const width = PAD_X * 2 + maxCol * COL_W
    const height = PAD_Y * 2 + maxRow * ROW_H
    return { pos, width, height, PAD_X, PAD_Y, COL_W, ROW_H, maxCol }
  }, [plan])

  if (!open) return null

  const { pos, width: W, height: H, PAD_X, PAD_Y, COL_W, ROW_H, maxCol } = positions

  const phaseStatusColor = (s: UIPhase['status']) => {
    if (s === 'done') return 'var(--status-done)'
    if (s === 'active') return 'var(--status-active)'
    return 'var(--fg-muted)'
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        background: 'color-mix(in srgb, var(--bg-sunken) 85%, transparent)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: 56,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(1100px, calc(100vw - 48px))',
          maxHeight: 'calc(100vh - 96px)',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--bg-canvas)',
          border: '1px solid var(--border-default)',
          borderRadius: 10,
          boxShadow: 'var(--shadow-lg)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '14px 18px',
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          <span className="t-eyebrow" style={{ color: 'var(--fg-default)' }}>
            ⌬ Dependency graph
          </span>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              color: 'var(--fg-subtle)',
              padding: '2px 8px',
              borderRadius: 999,
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            {plan.phases.length} nodes · {plan.deps.length} edges
          </span>
          <div style={{ flex: 1 }} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-subtle)' }}>
            columns: topological depth · rows: track
          </span>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              all: 'unset',
              cursor: 'pointer',
              color: 'var(--fg-muted)',
              fontFamily: 'var(--font-mono)',
              fontSize: 18,
              padding: '0 4px',
              marginLeft: 8,
            }}
          >
            ×
          </button>
        </div>

        <div
          style={{
            flex: 1,
            overflow: 'auto',
            background: 'var(--bg-sunken)',
            backgroundImage: 'var(--texture-grid)',
            backgroundSize: 'var(--texture-grid-size)',
          }}
        >
          <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
            <defs>
              <marker id="arrow-default" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--border-strong)" opacity="0.55" />
              </marker>
              <marker id="arrow-active" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--status-active)" />
              </marker>
            </defs>

            {plan.tracks.map((t, i) => (
              <g key={t.id}>
                <line
                  x1={PAD_X - 28}
                  x2={W - PAD_X / 2}
                  y1={PAD_Y + i * ROW_H}
                  y2={PAD_Y + i * ROW_H}
                  stroke="var(--border-subtle)"
                  strokeDasharray="2 4"
                  opacity="0.5"
                />
                <text
                  x={28}
                  y={PAD_Y + i * ROW_H + 4}
                  fontFamily="var(--font-mono)"
                  fontSize="10"
                  fontWeight="600"
                  fill="var(--fg-muted)"
                  letterSpacing="0.08em"
                >
                  {`${t.id} — ${t.title.toUpperCase()}`}
                </text>
              </g>
            ))}

            {Array.from({ length: maxCol + 1 }).map((_, c) => (
              <text
                key={c}
                x={PAD_X + c * COL_W}
                y={20}
                textAnchor="middle"
                fontFamily="var(--font-mono)"
                fontSize="9"
                fill="var(--fg-faint)"
                letterSpacing="0.08em"
              >
                {`L${c}`}
              </text>
            ))}

            {plan.deps.map((d, i) => {
              const a = pos[d.from]
              const b = pos[d.to]
              if (!a || !b) return null
              const x1 = a.x + 42
              const y1 = a.y
              const x2 = b.x - 42
              const y2 = b.y
              const dx = (x2 - x1) * 0.5
              const path = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`
              const fromPhase = plan.phases.find((p) => p.id === d.from)
              const toPhase = plan.phases.find((p) => p.id === d.to)
              const isActiveEdge = fromPhase?.status === 'active' || toPhase?.status === 'active'
              const stroke = isActiveEdge ? 'var(--status-active)' : 'var(--border-strong)'
              return (
                <path
                  key={i}
                  d={path}
                  fill="none"
                  stroke={stroke}
                  strokeWidth={isActiveEdge ? 1.5 : 1}
                  strokeOpacity={isActiveEdge ? 0.95 : 0.55}
                  markerEnd={isActiveEdge ? 'url(#arrow-active)' : 'url(#arrow-default)'}
                />
              )
            })}

            {(() => {
              const pairs = new Set<string>()
              const rendered: ReactElement[] = []
              plan.phases.forEach((p) => {
                if (Array.isArray(p.parallelWith)) {
                  p.parallelWith.forEach((peerId) => {
                    const key = [p.id, peerId].sort().join('|')
                    if (pairs.has(key)) return
                    pairs.add(key)
                    const peer = pos[peerId]
                    if (!peer) return
                    const a = pos[p.id]
                    const x = Math.min(a.x, peer.x) - 50
                    const y = Math.min(a.y, peer.y) - 22
                    const w = Math.abs(peer.x - a.x) + 100
                    const h = Math.abs(peer.y - a.y) + 44
                    rendered.push(
                      <rect
                        key={key}
                        x={x}
                        y={y}
                        width={w}
                        height={h}
                        rx={12}
                        ry={12}
                        fill="color-mix(in srgb, var(--status-emerged) 8%, transparent)"
                        stroke="color-mix(in srgb, var(--status-emerged) 40%, transparent)"
                        strokeWidth={1}
                        strokeDasharray="3 3"
                      />
                    )
                    rendered.push(
                      <text
                        key={key + 't'}
                        x={x + 8}
                        y={y + 14}
                        fontFamily="var(--font-mono)"
                        fontSize="9"
                        fontWeight="600"
                        fill="var(--status-emerged)"
                        letterSpacing="0.08em"
                      >
                        ∥ PARALLEL
                      </text>
                    )
                  })
                }
              })
              return rendered
            })()}

            {plan.phases.map((p) => {
              const p0 = pos[p.id]
              if (!p0) return null
              const color = phaseStatusColor(p.status)
              const isActive = p.status === 'active'
              const isDone = p.status === 'done'
              return (
                <g
                  key={p.id}
                  onClick={() => onOpenPhase?.(p)}
                  style={{ cursor: onOpenPhase ? 'pointer' : 'default' }}
                >
                  {isActive && (
                    <circle
                      cx={p0.x}
                      cy={p0.y}
                      r={32}
                      fill="color-mix(in srgb, var(--status-active) 16%, transparent)"
                    />
                  )}
                  <rect
                    x={p0.x - 42}
                    y={p0.y - 18}
                    width={84}
                    height={36}
                    rx={6}
                    ry={6}
                    fill="var(--bg-surface)"
                    stroke={isActive || isDone ? color : 'var(--border-default)'}
                    strokeWidth={isActive ? 1.5 : 1}
                  />
                  {(isActive || isDone) && (
                    <rect x={p0.x - 42} y={p0.y - 18} width={2} height={36} fill={color} />
                  )}
                  <text x={p0.x - 30} y={p0.y + 4} fontFamily="var(--font-mono)" fontSize="12" fontWeight="700" fill={color}>
                    {p.status === 'done' ? '✓' : p.status === 'active' ? '◉' : '·'}
                  </text>
                  <text
                    x={p0.x - 18}
                    y={p0.y + 5}
                    fontFamily="var(--font-mono)"
                    fontSize="12"
                    fontWeight="600"
                    fill={isActive ? color : isDone ? color : 'var(--fg-default)'}
                  >
                    {p.id}
                  </text>
                  <text x={p0.x + 6} y={p0.y + 5} fontFamily="var(--font-mono)" fontSize="10" fill="var(--fg-muted)">
                    {p.tasks.done}/{p.tasks.total}
                  </text>
                </g>
              )
            })}
          </svg>
        </div>

        <div
          style={{
            display: 'flex',
            gap: 18,
            alignItems: 'center',
            flexWrap: 'wrap',
            padding: '10px 18px',
            borderTop: '1px solid var(--border-subtle)',
            background: 'var(--bg-surface)',
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            color: 'var(--fg-subtle)',
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: 'var(--status-active)', fontSize: 11 }}>◉</span>
            <span>active</span>
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: 'var(--status-done)', fontSize: 11 }}>✓</span>
            <span>done</span>
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: 'var(--fg-muted)', fontSize: 11 }}>·</span>
            <span>pending</span>
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: 'var(--status-emerged)' }}>∥</span>
            <span>parallel-allowed pair</span>
          </span>
          <div style={{ flex: 1 }} />
          <span>click any node to open the phase</span>
        </div>
      </div>
    </div>
  )
}
