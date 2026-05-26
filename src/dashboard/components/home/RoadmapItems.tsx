import { StatusGlyph, HighlightBadge } from '../atoms'
import { KindBadge, PhaseChip } from './ProjectCard'
import type { RoadmapItem } from '../../lib/roadmap'

// ── InFlightItem — hero card with progress ────────────────────────────────

export function InFlightItem({ item, onNav }: { item: RoadmapItem; onNav?: (to: string) => void }) {
  const accent = 'var(--status-active)'
  const total = item.tasks.total
  const done = item.tasks.done
  const pct = total > 0 ? Math.round((done / total) * 100) : 0
  const slugPath = `${item.kind === 'plan' ? '/plans' : '/initiatives'}/${item.slug}`

  return (
    <button onClick={() => onNav?.(slugPath)} style={{
      all: 'unset', cursor: 'pointer',
      display: 'flex', flexDirection: 'column', gap: 10,
      padding: '14px 16px',
      background: 'var(--bg-surface)',
      border: '1px solid var(--border-default)',
      borderLeft: `3px solid ${accent}`,
      borderRadius: 6,
      boxShadow: 'var(--shadow-ambient)',
      transition: 'background 120ms, border-color 120ms',
    }}
    onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-elevated)'; e.currentTarget.style.borderColor = 'var(--border-bright)'; e.currentTarget.style.borderLeftColor = accent }}
    onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-surface)'; e.currentTarget.style.borderColor = 'var(--border-default)'; e.currentTarget.style.borderLeftColor = accent }}>
      {/* meta row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        <StatusGlyph status={item.status} size={12} />
        <KindBadge kind={item.kind} accent={accent} />
        {item.currentPhase && <PhaseChip phase={item.currentPhase} />}
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-subtle)' }}>
          {slugPath}
        </span>
        <div style={{ flex: 1 }} />
        {item.openHighlights > 0 && (
          <HighlightBadge severity={item.criticalHighlights > 0 ? 'critical' : 'warn'} count={item.openHighlights} />
        )}
        {item.unreadAnnotations > 0 && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 500,
            color: 'var(--status-emerged)', padding: '1px 6px', borderRadius: 999,
            background: 'var(--status-emerged-bg)',
            border: '1px solid color-mix(in srgb, var(--status-emerged) 30%, transparent)',
          }}>◗ {item.unreadAnnotations}</span>
        )}
      </div>

      {/* title */}
      <h4 style={{
        margin: 0, fontFamily: 'var(--font-sans)', fontSize: 15, fontWeight: 600,
        color: 'var(--fg-default)', letterSpacing: '-0.015em',
      }}>{item.title}</h4>

      {/* progress */}
      {total > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{
            display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
            fontFamily: 'var(--font-mono)', fontSize: 11,
          }}>
            <span style={{ color: 'var(--fg-subtle)' }}>
              tasks <span style={{ color: 'var(--fg-default)', fontWeight: 500 }}>{done}</span>
              <span style={{ color: 'var(--fg-subtle)' }}>/{total}</span>
            </span>
            <span style={{ color: accent, fontWeight: 600 }}>{pct}%</span>
          </div>
          <div style={{
            height: 5, background: 'var(--bg-sunken)', borderRadius: 2,
            overflow: 'hidden', border: '1px solid var(--border-subtle)',
          }}>
            <div style={{
              width: `${pct}%`, height: '100%', background: accent,
              boxShadow: `0 0 8px color-mix(in srgb, ${accent} 70%, transparent)`,
              transition: 'width 200ms',
            }} />
          </div>
        </div>
      )}

      {/* phases + via */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 14,
        fontFamily: 'var(--font-mono)', fontSize: 11, flexWrap: 'wrap',
      }}>
        {item.phases && (item.phases.done + item.phases.active + item.phases.pending) > 0 && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: 'var(--fg-subtle)' }}>phases</span>
            <PhasePipsInline phases={item.phases} />
          </span>
        )}
        <span style={{ color: 'var(--fg-subtle)' }}>via <span style={{ color: 'var(--fg-muted)' }}>{item.consumer}</span></span>
      </div>

      {item.next && (
        <div style={{
          display: 'flex', alignItems: 'baseline', gap: 8,
          paddingTop: 8, borderTop: '1px dashed var(--border-subtle)',
          fontFamily: 'var(--font-sans)', fontSize: 12, minWidth: 0,
        }}>
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-subtle)',
            flex: 'none', letterSpacing: '0.06em', textTransform: 'uppercase' as const,
          }}>next</span>
          <span style={{
            color: 'var(--fg-default)', fontWeight: 500,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            flex: 1, minWidth: 0,
          }}>{item.next}</span>
        </div>
      )}
    </button>
  )
}

// ── BlockedItem ───────────────────────────────────────────────────────────

export function BlockedItem({ item, onNav }: { item: RoadmapItem; onNav?: (to: string) => void }) {
  const accent = 'var(--status-blocked)'
  const slugPath = `${item.kind === 'plan' ? '/plans' : '/initiatives'}/${item.slug}`
  return (
    <button onClick={() => onNav?.(slugPath)} style={{
      all: 'unset', cursor: 'pointer',
      display: 'flex', flexDirection: 'column', gap: 8,
      padding: '12px 14px',
      background: 'color-mix(in srgb, var(--status-blocked) 5%, var(--bg-surface))',
      border: '1px solid color-mix(in srgb, var(--status-blocked) 22%, var(--border-default))',
      borderLeft: `3px solid ${accent}`,
      borderRadius: 6,
      transition: 'background 120ms, border-color 120ms',
    }}
    onMouseEnter={e => { e.currentTarget.style.background = 'color-mix(in srgb, var(--status-blocked) 10%, var(--bg-elevated))' }}
    onMouseLeave={e => { e.currentTarget.style.background = 'color-mix(in srgb, var(--status-blocked) 5%, var(--bg-surface))' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        <StatusGlyph status="blocked" size={12} />
        <KindBadge kind={item.kind} accent={accent} />
        {item.currentPhase && <PhaseChip phase={item.currentPhase} />}
        <span style={{
          fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 600,
          color: 'var(--fg-default)',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          flex: 1, minWidth: 0,
        }}>{item.title}</span>
        {item.tasks.total > 0 && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-muted)', flex: 'none' }}>
            <span style={{ color: accent }}>{item.tasks.done}</span>
            <span style={{ color: 'var(--fg-faint)' }}>/{item.tasks.total}</span>
          </span>
        )}
      </div>
      {item.next && (
        <div style={{
          display: 'flex', alignItems: 'baseline', gap: 8, paddingLeft: 18,
          fontFamily: 'var(--font-sans)', fontSize: 12, minWidth: 0,
        }}>
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-subtle)',
            flex: 'none', letterSpacing: '0.06em', textTransform: 'uppercase' as const,
          }}>waiting</span>
          <span style={{ color: accent, fontWeight: 500, flex: 1, minWidth: 0 }}>{item.next}</span>
        </div>
      )}
    </button>
  )
}

// ── UpNextItem ────────────────────────────────────────────────────────────

export function UpNextItem({ item, onNav }: { item: RoadmapItem; onNav?: (to: string) => void }) {
  const accent = 'var(--status-emerged)'
  const slugPath = `${item.kind === 'plan' ? '/plans' : '/initiatives'}/${item.slug}`
  return (
    <button onClick={() => onNav?.(slugPath)} style={{
      all: 'unset', cursor: 'pointer',
      display: 'flex', flexDirection: 'column', gap: 6,
      padding: '10px 12px',
      background: 'transparent',
      border: '1px solid var(--border-subtle)',
      borderLeft: '2px solid color-mix(in srgb, var(--status-emerged) 50%, transparent)',
      borderRadius: 6,
      transition: 'background 120ms, border-color 120ms',
    }}
    onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-surface)'; e.currentTarget.style.borderColor = 'var(--border-default)'; e.currentTarget.style.borderLeftColor = accent }}
    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.borderLeftColor = 'color-mix(in srgb, var(--status-emerged) 50%, transparent)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        <StatusGlyph status="pending" size={11} />
        <KindBadge kind={item.kind} accent={accent} />
        <span style={{
          fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 500,
          color: 'var(--fg-default)',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          flex: 1, minWidth: 0,
        }}>{item.title}</span>
        {item.tasks.total > 0 && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-subtle)', flex: 'none' }}>
            {item.tasks.done}<span style={{ color: 'var(--fg-faint)' }}>/{item.tasks.total}</span>
          </span>
        )}
      </div>
      {item.next && (
        <div style={{ paddingLeft: 18, fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--fg-muted)' }}>
          {item.next}
        </div>
      )}
    </button>
  )
}

// ── ParkedItem ────────────────────────────────────────────────────────────

export function ParkedItem({ item, onNav }: { item: RoadmapItem; onNav?: (to: string) => void }) {
  const accent = 'var(--status-parked)'
  const slugPath = `${item.kind === 'plan' ? '/plans' : '/initiatives'}/${item.slug}`
  return (
    <button onClick={() => onNav?.(slugPath)} style={{
      all: 'unset', cursor: 'pointer',
      display: 'flex', flexDirection: 'column', gap: 4,
      padding: '8px 12px',
      background: 'transparent',
      border: '1px dashed color-mix(in srgb, var(--status-parked) 30%, var(--border-default))',
      borderRadius: 6,
      transition: 'background 120ms',
      opacity: 0.8,
    }}
    onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-surface)'; e.currentTarget.style.opacity = '1' }}
    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.opacity = '0.8' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        <StatusGlyph status="parked" size={11} />
        <KindBadge kind={item.kind} accent={accent} />
        <span style={{
          fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 500,
          color: 'var(--fg-muted)',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          flex: 1, minWidth: 0,
        }}>{item.title}</span>
      </div>
    </button>
  )
}

// ── ShippedItem ───────────────────────────────────────────────────────────

export function ShippedItem({ item, onNav }: { item: RoadmapItem; onNav?: (to: string) => void }) {
  const accent = 'var(--status-done)'
  const slugPath = `${item.kind === 'plan' ? '/plans' : '/initiatives'}/${item.slug}`
  return (
    <button onClick={() => onNav?.(slugPath)} style={{
      all: 'unset', cursor: 'pointer',
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '6px 10px',
      borderRadius: 4,
      transition: 'background 120ms',
      minWidth: 0,
      opacity: 0.7,
    }}
    onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-surface)'; e.currentTarget.style.opacity = '1' }}
    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.opacity = '0.7' }}>
      <StatusGlyph status="done" size={11} />
      <KindBadge kind={item.kind} accent={accent} />
      <span style={{
        fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--fg-muted)',
        textDecoration: 'line-through', textDecorationColor: 'var(--fg-faint)',
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        flex: 1, minWidth: 0,
      }}>{item.title}</span>
      {item.tasks.total > 0 && (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-faint)', flex: 'none' }}>
          {item.tasks.done}/{item.tasks.total}
        </span>
      )}
    </button>
  )
}

// ── Shared helper ─────────────────────────────────────────────────────────

function PhasePipsInline({ phases }: { phases: { done: number; active: number; pending: number } }) {
  const pips: string[] = []
  for (let i = 0; i < phases.done; i++) pips.push('d')
  for (let i = 0; i < phases.active; i++) pips.push('a')
  for (let i = 0; i < phases.pending; i++) pips.push('p')
  return (
    <span style={{ display: 'inline-flex', gap: 3, alignItems: 'center' }}>
      {pips.map((k, idx) => {
        const isActive = k === 'a'
        const color = k === 'd' ? 'var(--status-done)'
          : k === 'a' ? 'var(--status-active)'
          : 'color-mix(in srgb, var(--fg-faint) 70%, transparent)'
        return (
          <span key={idx} style={{
            display: 'inline-block', width: isActive ? 14 : 8, height: 4,
            background: color, borderRadius: 1,
            boxShadow: isActive ? '0 0 6px color-mix(in srgb, var(--status-active) 80%, transparent)' : 'none',
          }} />
        )
      })}
    </span>
  )
}
