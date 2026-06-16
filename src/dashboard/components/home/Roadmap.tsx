import { useState } from 'react'
import { Btn } from '../atoms'
import { LANE_STYLE } from './ProjectCard'
import { InFlightItem, BlockedItem, UpNextItem, ParkedItem, ShippedItem } from './RoadmapItems'
import type { UIConsumer } from '../../lib/adapters'
import type { RoadmapItem, LaneKey } from '../../lib/roadmap'
import { rollupRoadmap } from '../../lib/roadmap'

// ── Lane renderer map ─────────────────────────────────────────────────────

const LANE_RENDERER: Record<LaneKey, typeof InFlightItem> = {
  inflight: InFlightItem,
  blocked:  BlockedItem,
  upnext:   UpNextItem,
  parked:   ParkedItem,
  shipped:  ShippedItem,
}

const LANE_META: Record<LaneKey, { sub: string }> = {
  inflight: { sub: 'Currently shipping' },
  blocked:  { sub: 'Waiting on something' },
  upnext:   { sub: 'Ideas queued for pickup' },
  parked:   { sub: 'Deliberately set aside' },
  shipped:  { sub: 'Closed, done' },
}

// ── RoadmapLane ───────────────────────────────────────────────────────────

function RoadmapLane({
  laneKey, items, onNav, defaultOpen,
}: {
  laneKey: LaneKey; items: RoadmapItem[]; onNav?: (to: string) => void; defaultOpen: boolean
}) {
  const style = LANE_STYLE[laneKey]
  const meta = LANE_META[laneKey]
  const [open, setOpen] = useState(defaultOpen)
  const Renderer = LANE_RENDERER[laneKey]
  if (!items || items.length === 0) return null

  return (
    <section style={{ marginTop: 18 }}>
      <button onClick={() => setOpen(o => !o)} style={{
        all: 'unset', cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 10,
        width: '100%', padding: '4px 2px 8px',
      }}>
        <span style={{
          width: 18, height: 18,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700,
          color: style.color,
          background: `color-mix(in srgb, ${style.color} 12%, transparent)`,
          border: `1px solid color-mix(in srgb, ${style.color} 30%, transparent)`,
          borderRadius: 4, flex: 'none',
        }} aria-hidden="true">{style.glyph}</span>
        <h3 style={{
          margin: 0, fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600,
          color: 'var(--fg-default)', letterSpacing: '0.04em',
          textTransform: 'uppercase' as const,
        }}>{style.label}</h3>
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600,
          padding: '1px 7px', borderRadius: 999,
          color: style.color,
          background: `color-mix(in srgb, ${style.color} 10%, transparent)`,
          border: `1px solid color-mix(in srgb, ${style.color} 28%, transparent)`,
        }}>{items.length}</span>
        <span style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--fg-subtle)' }}>{meta.sub}</span>
        <div style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }} />
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-faint)' }}>
          {open ? '▾' : '▸'}
        </span>
      </button>

      {open && (
        <div style={{
          display: laneKey === 'inflight' ? 'grid' : 'flex',
          flexDirection: 'column',
          gridTemplateColumns: laneKey === 'inflight' && items.length > 1
            ? 'repeat(auto-fit, minmax(360px, 1fr))' : '1fr',
          gap: laneKey === 'shipped' ? 2 : 8,
        }}>
          {items.map(it => <Renderer key={`${it.kind}-${it.slug}`} item={it} onNav={onNav} />)}
        </div>
      )}
    </section>
  )
}

// ── RoadmapHeader ─────────────────────────────────────────────────────────

function RoadmapHeader({ counts, onAdd }: { counts: Record<LaneKey, number>; onAdd?: () => void }) {
  const order: LaneKey[] = ['inflight', 'blocked', 'upnext', 'parked', 'shipped']
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
      marginTop: 22, padding: '12px 14px',
      background: 'var(--bg-surface)',
      border: '1px solid var(--border-default)',
      borderRadius: 8, boxShadow: 'var(--shadow-ambient)',
    }}>
      <div className="t-eyebrow" style={{ color: 'var(--fg-muted)', flex: 'none' }}>ROADMAP</div>
      <div style={{ width: 1, height: 16, background: 'var(--border-default)', flex: 'none' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, flex: 1, minWidth: 0, flexWrap: 'wrap' }}>
        {order.map((k, i) => {
          const s = LANE_STYLE[k]
          const n = counts[k] ?? 0
          return (
            <span key={k} style={{ display: 'contents' }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '2px 12px', whiteSpace: 'nowrap', flex: 'none',
                opacity: n === 0 ? 0.45 : 1,
              }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: s.color }}>{s.glyph}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-subtle)' }}>{s.label}</span>
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600,
                  color: n === 0 ? 'var(--fg-faint)' : 'var(--fg-default)',
                }}>{n}</span>
              </span>
              {i < order.length - 1 && <span style={{ width: 1, height: 12, background: 'var(--border-default)', flex: 'none' }} />}
            </span>
          )
        })}
      </div>
      {onAdd && (
        <button onClick={onAdd} style={{
          all: 'unset', cursor: 'pointer',
          display: 'inline-flex', alignItems: 'center', gap: 6,
          height: 26, padding: '0 10px 0 8px',
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-default)',
          borderRadius: 6,
          fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 500,
          color: 'var(--fg-default)',
          transition: 'background 120ms, border-color 120ms',
          flex: 'none',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-overlay)'; e.currentTarget.style.borderColor = 'var(--border-bright)' }}
        onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-elevated)'; e.currentTarget.style.borderColor = 'var(--border-default)' }}>
          <span style={{ fontSize: 14, color: 'var(--status-active)' }}>+</span>
          <span>New initiative</span>
        </button>
      )}
    </div>
  )
}

// ── RoadmapSources ────────────────────────────────────────────────────────

export function RoadmapSources({ consumers }: { consumers: UIConsumer[] }) {
  if (!consumers || consumers.length === 0) return null
  return (
    <div style={{
      marginTop: 26, padding: '10px 14px',
      background: 'transparent',
      border: '1px solid var(--border-subtle)',
      borderRadius: 6,
      fontFamily: 'var(--font-mono)', fontSize: 11,
      display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12,
    }}>
      <span className="t-eyebrow" style={{ color: 'var(--fg-muted)' }}>SOURCES</span>
      <span style={{ width: 1, height: 10, background: 'var(--border-default)' }} />
      {consumers.map((c, i) => {
        const n = c.plans.length + c.initiatives.length
        const errored = c.health === 'errored'
        return (
          <span key={c.id} style={{ display: 'contents' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span style={{ color: 'var(--fg-subtle)' }}>{c.name}</span>
              <span style={{ color: errored ? 'var(--severity-critical)' : 'var(--fg-default)' }}>
                {errored ? '⊘ errored' : `${n} ${n === 1 ? 'item' : 'items'}`}
              </span>
              <span style={{ color: 'var(--fg-faint)' }}>·</span>
              <span style={{ color: 'var(--fg-subtle)' }}>{c.lastWrite}</span>
            </span>
            {i < consumers.length - 1 && <span style={{ width: 1, height: 10, background: 'var(--border-default)' }} />}
          </span>
        )
      })}
    </div>
  )
}

// ── Top-level Roadmap ─────────────────────────────────────────────────────

export function Roadmap({ consumers, onNav }: { consumers: UIConsumer[]; onNav?: (to: string) => void }) {
  const { lanes, counts, total } = rollupRoadmap(consumers)
  // Concluded plans (done → shipped, archived → parked) are hidden by default;
  // an explicit toggle reveals them. Hook stays above the early return (G8).
  const [showConcluded, setShowConcluded] = useState(false)

  if (total === 0) {
    return (
      <div style={{
        marginTop: 22, padding: '24px 22px',
        background: 'var(--bg-surface)',
        border: '1px dashed var(--border-default)',
        borderRadius: 10,
        fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--fg-muted)',
        display: 'flex', flexDirection: 'column', gap: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--fg-faint)' }}>(empty roadmap)</span>
        </div>
        <p style={{ margin: 0, maxWidth: 540 }}>
          Every feature you want to ship is a new initiative or plan. None here yet — add the first one to start tracking.
        </p>
        <div style={{ display: 'flex', gap: 6 }}>
          <Btn variant="primary" size="sm">+ New initiative</Btn>
          <Btn variant="ghost" size="sm">+ New plan</Btn>
        </div>
      </div>
    )
  }

  const concludedCount = counts.shipped + counts.parked

  return (
    <div>
      <RoadmapHeader counts={counts} onAdd={() => {}} />
      <RoadmapLane laneKey="inflight" items={lanes.inflight} onNav={onNav} defaultOpen={true} />
      <RoadmapLane laneKey="blocked"  items={lanes.blocked}  onNav={onNav} defaultOpen={true} />
      <RoadmapLane laneKey="upnext"   items={lanes.upnext}   onNav={onNav} defaultOpen={true} />
      {showConcluded && (
        <>
          <RoadmapLane laneKey="parked"  items={lanes.parked}  onNav={onNav} defaultOpen={true} />
          <RoadmapLane laneKey="shipped" items={lanes.shipped} onNav={onNav} defaultOpen={true} />
        </>
      )}
      {concludedCount > 0 && (
        <ConcludedToggle open={showConcluded} count={concludedCount} onToggle={() => setShowConcluded(o => !o)} />
      )}
    </div>
  )
}

// ── ConcludedToggle ─────────────────────────────────────────────────────────
// Explicit control to reveal/hide concluded plans (done + archived), hidden by
// default so the list foregrounds active work.

function ConcludedToggle({ open, count, onToggle }: { open: boolean; count: number; onToggle: () => void }) {
  return (
    <button onClick={onToggle} style={{
      all: 'unset', cursor: 'pointer',
      display: 'inline-flex', alignItems: 'center', gap: 8,
      marginTop: 18, padding: '6px 12px',
      background: 'var(--bg-surface)',
      border: '1px solid var(--border-default)',
      borderRadius: 6,
      fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 500,
      color: 'var(--fg-muted)',
    }}>
      <span style={{ color: 'var(--fg-faint)' }}>{open ? '▾' : '▸'}</span>
      <span>{open ? 'Hide concluded' : 'Show concluded'}</span>
      <span style={{
        fontSize: 11, fontWeight: 600,
        padding: '1px 7px', borderRadius: 999,
        color: 'var(--fg-subtle)',
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-subtle)',
      }}>{count}</span>
    </button>
  )
}
