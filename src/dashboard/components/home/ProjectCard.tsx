import type { CSSProperties } from 'react'
import { StatusGlyph, HighlightBadge } from '../atoms'
import type { UIConsumer } from '../../lib/adapters'
import type { RoadmapItem, ProjectRollup, LaneKey } from '../../lib/roadmap'
import { rollupProject, pickHeroItem, ROADMAP_LANES } from '../../lib/roadmap'

// ── Lane style map (shared with Roadmap.tsx) ──────────────────────────────

export const LANE_STYLE: Record<LaneKey, { color: string; glyph: string; label: string }> = {
  inflight: { color: 'var(--status-active)',  glyph: '◉', label: 'in flight' },
  blocked:  { color: 'var(--status-blocked)', glyph: '⊘', label: 'blocked' },
  upnext:   { color: 'var(--status-emerged)', glyph: '⇥', label: 'up next' },
  parked:   { color: 'var(--status-parked)',  glyph: '⌂', label: 'parked' },
  shipped:  { color: 'var(--status-done)',    glyph: '✓', label: 'shipped' },
}

// ── Shared atoms ──────────────────────────────────────────────────────────

function Dot({ color, size = 7 }: { color: string; size?: number }) {
  return (
    <span style={{
      width: size, height: size, borderRadius: 999, background: color, flex: 'none',
      boxShadow: `0 0 6px color-mix(in srgb, ${color} 70%, transparent)`,
    }} />
  )
}

function PulseDot({ color }: { color: string }) {
  return (
    <span style={{ position: 'relative', width: 7, height: 7, flex: 'none' }}>
      <span style={{
        position: 'absolute', inset: 0, borderRadius: '50%', background: color,
        boxShadow: `0 0 8px color-mix(in srgb, ${color} 70%, transparent)`,
      }} />
      <span style={{
        position: 'absolute', inset: -3, borderRadius: '50%',
        background: `color-mix(in srgb, ${color} 40%, transparent)`,
        animation: 'aideck-pulse 2.4s ease-out infinite',
      }} />
    </span>
  )
}

const HEALTH_STYLES: Record<string, { label: string; color: string; pulse: boolean }> = {
  active:  { label: 'active',  color: 'var(--status-done)',       pulse: true },
  idle:    { label: 'idle',    color: 'var(--fg-muted)',          pulse: false },
  errored: { label: 'errored', color: 'var(--severity-critical)', pulse: false },
  empty:   { label: 'no data', color: 'var(--fg-subtle)',         pulse: false },
}

function ProjectHealthBadge({ health }: { health: string }) {
  const s = HEALTH_STYLES[health] ?? HEALTH_STYLES.idle!
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      height: 20, padding: '0 9px 0 8px', borderRadius: 999,
      fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600,
      letterSpacing: '0.06em',
      color: s.color,
      background: `color-mix(in srgb, ${s.color} 10%, transparent)`,
      border: `1px solid color-mix(in srgb, ${s.color} 28%, transparent)`,
    }}>
      {s.pulse ? <PulseDot color={s.color} /> : <Dot color={s.color} />}
      {s.label}
    </span>
  )
}

export function KindBadge({ kind, accent }: { kind: 'plan' | 'initiative'; accent: string }) {
  return (
    <span style={{
      fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 600,
      letterSpacing: '0.1em',
      color: accent,
      padding: '1px 5px',
      background: `color-mix(in srgb, ${accent} 10%, transparent)`,
      border: `1px solid color-mix(in srgb, ${accent} 28%, transparent)`,
      borderRadius: 3, flex: 'none',
    }}>{kind === 'plan' ? 'PLAN' : 'INIT'}</span>
  )
}

export function PhaseChip({ phase }: { phase?: string | null }) {
  if (!phase) return null
  return (
    <span style={{
      fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 500,
      color: 'var(--status-active)',
      padding: '1px 6px',
      background: 'var(--status-active-bg)',
      border: '1px solid color-mix(in srgb, var(--status-active) 28%, transparent)',
      borderRadius: 3, flex: 'none',
    }}>{phase}</span>
  )
}

function PhasePips({ phases }: { phases: { done: number; active: number; pending: number } }) {
  const total = phases.done + phases.active + phases.pending
  if (total === 0) return null
  const pips: string[] = []
  for (let i = 0; i < phases.done; i++) pips.push('d')
  for (let i = 0; i < phases.active; i++) pips.push('a')
  for (let i = 0; i < phases.pending; i++) pips.push('p')
  return (
    <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
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
    </div>
  )
}

// ── ActiveItemHero ────────────────────────────────────────────────────────

function ActiveItemHero({ item }: { item: RoadmapItem }) {
  const isBlocked = item.status === 'blocked' || item.status === 'paused'
  const isDone = item.status === 'done'
  const accent = isBlocked ? 'var(--status-blocked)'
    : isDone ? 'var(--status-done)'
    : 'var(--status-active)'
  const total = item.tasks.total
  const done = item.tasks.done
  const pct = total > 0 ? Math.round((done / total) * 100) : 0
  const statusLabel = isBlocked ? 'BLOCKED' : isDone ? 'DONE' : 'ACTIVE'

  return (
    <div style={{
      padding: '12px 14px',
      background: 'var(--bg-elevated)',
      border: '1px solid var(--border-default)',
      borderRadius: 8,
    }}>
      {/* meta row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        <StatusGlyph status={item.status} size={12} />
        <KindBadge kind={item.kind} accent={accent} />
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 600,
          letterSpacing: '0.08em', color: accent,
        }}>{statusLabel}</span>
        {item.currentPhase && <PhaseChip phase={item.currentPhase} />}
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-subtle)' }}>
          /{item.kind === 'plan' ? 'plans' : 'initiatives'}/{item.slug}
        </span>
        <div style={{ flex: 1 }} />
        {item.openHighlights > 0 && (
          <HighlightBadge severity={item.criticalHighlights > 0 ? 'critical' : 'warn'} count={item.openHighlights} />
        )}
      </div>

      {/* title */}
      <h4 style={{
        margin: '8px 0 0', fontFamily: 'var(--font-sans)', fontSize: 15, fontWeight: 600,
        color: 'var(--fg-default)', letterSpacing: '-0.015em',
      }}>{item.title}</h4>

      {/* progress */}
      {total > 0 && (
        <div style={{ marginTop: 10 }}>
          <div style={{
            display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
            fontFamily: 'var(--font-mono)', fontSize: 11, marginBottom: 4,
          }}>
            <span style={{ color: 'var(--fg-subtle)' }}>
              tasks <span style={{ color: 'var(--fg-default)', fontWeight: 500 }}>{done}</span>
              <span style={{ color: 'var(--fg-subtle)' }}>/{total}</span>
            </span>
            <span style={{ color: accent, fontWeight: 600 }}>{pct}%</span>
          </div>
          <div style={{
            height: 4, background: 'var(--bg-sunken)', borderRadius: 2,
            overflow: 'hidden', border: '1px solid var(--border-subtle)',
          }}>
            <div style={{
              width: `${pct}%`, height: '100%', background: accent,
              boxShadow: !isDone ? `0 0 8px color-mix(in srgb, ${accent} 70%, transparent)` : 'none',
              transition: 'width 200ms',
            }} />
          </div>
        </div>
      )}

      {/* phases + provenance */}
      {item.phases && (item.phases.done + item.phases.active + item.phases.pending) > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, marginTop: 8,
          fontFamily: 'var(--font-mono)', fontSize: 11,
        }}>
          <span style={{ color: 'var(--fg-subtle)' }}>phases</span>
          <PhasePips phases={item.phases} />
          <span style={{ color: 'var(--fg-faint)' }}>
            {item.phases.done + item.phases.active + item.phases.pending}
            {' · '}<span style={{ color: 'var(--fg-subtle)' }}>{item.phases.active} active</span>
            {' · '}{item.phases.pending}
          </span>
        </div>
      )}

      {/* next line */}
      {item.next && (
        <div style={{
          display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 8,
          paddingTop: 8, borderTop: '1px dashed var(--border-subtle)',
          fontFamily: 'var(--font-sans)', fontSize: 12, minWidth: 0,
        }}>
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-subtle)',
            flex: 'none', letterSpacing: '0.06em', textTransform: 'uppercase' as const,
          }}>{isBlocked ? 'waiting' : 'next'}</span>
          <span style={{
            color: isBlocked ? 'var(--status-blocked)' : 'var(--fg-default)',
            fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden',
            textOverflow: 'ellipsis', flex: 1, minWidth: 0,
          }}>{item.next}</span>
        </div>
      )}
    </div>
  )
}

// ── InnerRow (compact roadmap item inside the card strip) ─────────────────

function InnerRow({ item }: { item: RoadmapItem }) {
  const lane = ROADMAP_LANES.find(l => l.statuses.includes(item.status))
  const laneKey = lane?.key ?? 'upnext'
  const style = LANE_STYLE[laneKey]
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0',
      fontFamily: 'var(--font-sans)', fontSize: 12, minWidth: 0,
    }}>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: style.color, flex: 'none' }}>
        {style.glyph}
      </span>
      <KindBadge kind={item.kind} accent={style.color} />
      <span style={{
        color: 'var(--fg-default)', fontWeight: 500,
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        flex: 1, minWidth: 0,
      }}>{item.title}</span>
      {item.tasks.total > 0 && (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-subtle)', flex: 'none' }}>
          {item.tasks.done}<span style={{ color: 'var(--fg-faint)' }}>/{item.tasks.total}</span>
        </span>
      )}
      {item.openHighlights > 0 && (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--status-highlighted)', flex: 'none' }}>
          ⚑{item.openHighlights}
        </span>
      )}
    </div>
  )
}

// ── ProjectRoadmapStrip ──────────────────────────────────────────────────

function ProjectRoadmapStrip({ rollup }: { rollup: ProjectRollup }) {
  const { roadmap } = rollup
  if (roadmap.total === 0) return null

  const heroItem = pickHeroItem(rollup)
  const remainingItems = roadmap.items.filter(it => it !== heroItem).slice(0, 4)
  const order: LaneKey[] = ['inflight', 'blocked', 'upnext', 'parked', 'shipped']

  return (
    <>
      {/* lane counts strip */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 0, padding: '6px 0',
        borderTop: '1px dashed var(--border-subtle)', marginTop: 6,
        fontFamily: 'var(--font-mono)', fontSize: 10, flexWrap: 'wrap',
      }}>
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 600,
          letterSpacing: '0.08em', color: 'var(--fg-muted)', marginRight: 8,
        }}>ROADMAP</span>
        {order.map((k, i) => {
          const s = LANE_STYLE[k]
          const n = roadmap.counts[k]
          return (
            <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, opacity: n === 0 ? 0.4 : 1 }}>
              {i > 0 && <span style={{ width: 1, height: 10, background: 'var(--border-default)', margin: '0 6px' }} />}
              <span style={{ color: s.color }}>{s.glyph}</span>
              <span style={{ color: 'var(--fg-subtle)' }}>{s.label}</span>
              <span style={{ color: n === 0 ? 'var(--fg-faint)' : 'var(--fg-default)', fontWeight: 600 }}>{n}</span>
            </span>
          )
        })}
      </div>

      {/* remaining items */}
      {remainingItems.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {remainingItems.map(it => (
            <InnerRow key={`${it.kind}-${it.slug}`} item={it} />
          ))}
        </div>
      )}
    </>
  )
}

// ── MetricStrip ──────────────────────────────────────────────────────────

function MetricStrip({ rollup }: { rollup: ProjectRollup }) {
  const items: Array<{ label: string; value: number; accent?: string }> = [
    { label: 'consumers', value: rollup.consumerCount },
    { label: 'plans', value: rollup.planCount },
    { label: 'init', value: rollup.initiativeCount },
  ]
  if (rollup.highlights.total > 0)
    items.push({ label: '⚑', value: rollup.highlights.total, accent: 'var(--status-highlighted)' })
  if (rollup.unread > 0)
    items.push({ label: '◗', value: rollup.unread, accent: 'var(--status-emerged)' })

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 0, padding: '6px 12px',
      background: 'var(--bg-sunken)', borderRadius: 6,
      fontFamily: 'var(--font-mono)', fontSize: 11,
    }}>
      {items.map((m, i) => (
        <span key={m.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          {i > 0 && <span style={{ width: 1, height: 10, background: 'var(--border-default)', margin: '0 8px' }} />}
          <span style={{ color: m.accent ?? 'var(--fg-subtle)' }}>{m.label}</span>
          <span style={{ color: 'var(--fg-default)', fontWeight: 500 }}>{m.value}</span>
        </span>
      ))}
    </div>
  )
}

// ── ErroredCardBody ─────────────────────────────────────────────────────

function ErroredCardBody({ errorCount }: { errorCount: number }) {
  return (
    <div style={{
      padding: '10px 14px',
      background: 'color-mix(in srgb, var(--severity-critical) 6%, var(--bg-surface))',
      border: '1px solid color-mix(in srgb, var(--severity-critical) 30%, transparent)',
      borderRadius: 8,
      fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--severity-critical)',
    }}>
      {errorCount} file{errorCount !== 1 ? 's' : ''} failed to parse
    </div>
  )
}

// ── ProjectCard ─────────────────────────────────────────────────────────

export interface ProjectCardData {
  id: string
  name: string
  fullPath: string
  branch: string
  lastActivity: string
  health: 'active' | 'idle' | 'errored' | 'empty'
  description?: string
  consumers: UIConsumer[]
  errorCount?: number
}

export function ProjectCard({ project, onClick }: { project: ProjectCardData; onClick: () => void }) {
  const rollup = rollupProject(project.consumers)
  const heroItem = pickHeroItem(rollup)
  const isErrored = project.health === 'errored'
  const isActive = project.health === 'active'
  const leftBorder = isErrored ? 'var(--severity-critical)'
    : isActive ? 'var(--status-active)'
    : 'var(--border-default)'

  const cardStyle: CSSProperties = {
    all: 'unset', cursor: 'pointer',
    display: 'flex', flexDirection: 'column', gap: 10,
    padding: '14px 16px',
    background: 'var(--bg-surface)',
    border: '1px solid var(--border-default)',
    borderLeft: `3px solid ${leftBorder}`,
    borderRadius: 8,
    boxShadow: 'var(--shadow-ambient)',
    transition: 'background 120ms cubic-bezier(0.16, 1, 0.3, 1), border-color 120ms',
  }

  return (
    <button
      onClick={onClick}
      style={cardStyle}
      onMouseEnter={e => {
        e.currentTarget.style.background = 'var(--bg-elevated)'
        e.currentTarget.style.borderColor = 'var(--border-bright)'
        e.currentTarget.style.borderLeftColor = leftBorder
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = 'var(--bg-surface)'
        e.currentTarget.style.borderColor = 'var(--border-default)'
        e.currentTarget.style.borderLeftColor = leftBorder
      }}
    >
      {/* header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600, color: 'var(--fg-faint)',
          flex: 'none',
        }}>⌬</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: 'var(--font-sans)', fontSize: 16, fontWeight: 600,
            color: 'var(--fg-default)', letterSpacing: '-0.015em',
          }}>{project.name}</div>
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-subtle)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>{project.fullPath}</div>
        </div>
        <ProjectHealthBadge health={project.health} />
      </div>

      {project.description && (
        <div style={{
          fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--fg-muted)',
          lineHeight: 1.4,
        }}>{project.description}</div>
      )}

      {/* metric strip */}
      <MetricStrip rollup={rollup} />

      {/* body: errored or hero + roadmap strip */}
      {isErrored ? (
        <ErroredCardBody errorCount={project.errorCount ?? rollup.erroredConsumers} />
      ) : (
        <>
          {heroItem && <ActiveItemHero item={heroItem} />}
          <ProjectRoadmapStrip rollup={rollup} />
        </>
      )}

      {/* footer */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        paddingTop: 8, borderTop: '1px solid var(--border-subtle)',
        fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-subtle)',
      }}>
        <span>branch <span style={{ color: 'var(--fg-default)' }}>{project.branch}</span></span>
        <span style={{ color: 'var(--fg-faint)' }}>·</span>
        <span>last activity <span style={{ color: 'var(--fg-muted)' }}>{project.lastActivity}</span></span>
        <div style={{ flex: 1 }} />
        <span style={{ color: 'var(--accent-link)', fontWeight: 500 }}>Open →</span>
      </div>
    </button>
  )
}
