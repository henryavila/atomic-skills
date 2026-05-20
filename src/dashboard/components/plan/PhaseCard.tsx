import { Fragment, type CSSProperties, type MouseEvent } from 'react'
import { HighlightBadge, StatusGlyph, TagChip } from '../atoms'
import type { UIPhase } from '../../lib/adapters'

interface PhaseCardProps {
  phase: UIPhase
  onOpen?: (phase: UIPhase) => void
  density?: 'tight' | 'baseline' | 'expanded'
  activeEmphasis?: 'edge' | 'edge-scan' | 'glow'
  inParallel?: boolean
  hashTarget?: boolean
}

export function PhaseCard({
  phase,
  onOpen,
  density = 'baseline',
  activeEmphasis = 'edge-scan',
  inParallel = false,
  hashTarget = false,
}: PhaseCardProps) {
  const isActive = phase.status === 'active'
  const isDone = phase.status === 'done'

  const accent = isActive
    ? 'var(--status-active)'
    : isDone
      ? 'var(--status-done)'
      : 'transparent'

  const padY = density === 'tight' ? 8 : density === 'expanded' ? 14 : 11
  const padX = density === 'tight' ? 12 : 14
  const showProgress = density !== 'tight'
  const showNext = density !== 'tight'
  const showScope = density === 'expanded' && phase.scope && phase.scope.length > 0

  const showActiveScan = isActive && activeEmphasis === 'edge-scan'
  const showActiveGlow = isActive && activeEmphasis === 'glow'

  const textureClasses: string[] = []
  if (showActiveScan) textureClasses.push('has-texture-active')
  if (phase.hasCriticalDrift) textureClasses.push('has-texture-drift')

  const cardStyle: CSSProperties = {
    all: 'unset',
    cursor: 'pointer',
    display: 'block',
    width: '100%',
    boxSizing: 'border-box',
    background: 'var(--bg-surface)',
    border: `1px solid ${hashTarget ? 'var(--status-active)' : 'var(--border-default)'}`,
    borderRadius: 8,
    padding: `${padY}px ${padX}px ${padY + 2}px`,
    boxShadow: showActiveGlow
      ? 'var(--shadow-glow-active)'
      : hashTarget
        ? '0 0 0 2px color-mix(in srgb, var(--status-active) 30%, transparent)'
        : 'var(--shadow-ambient)',
    position: 'relative',
    overflow: 'hidden',
    opacity: isDone ? 0.7 : 1,
    transition:
      'background 120ms var(--ease-out), border-color 120ms var(--ease-out), transform 120ms var(--ease-out), box-shadow 120ms var(--ease-out), opacity 120ms var(--ease-out)',
    scrollMarginTop: 80,
  }

  const onEnter = (e: MouseEvent<HTMLButtonElement>) => {
    const el = e.currentTarget
    el.style.background = 'var(--bg-elevated)'
    if (!hashTarget) el.style.borderColor = 'var(--border-bright)'
    el.style.transform = 'translateY(-1px)'
    if (isDone) el.style.opacity = '0.95'
  }
  const onLeave = (e: MouseEvent<HTMLButtonElement>) => {
    const el = e.currentTarget
    el.style.background = 'var(--bg-surface)'
    if (!hashTarget) el.style.borderColor = 'var(--border-default)'
    el.style.transform = 'translateY(0)'
    if (isDone) el.style.opacity = '0.7'
  }

  return (
    <button
      id={`phase-${phase.id}`}
      className={textureClasses.join(' ')}
      onClick={() => onOpen?.(phase)}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      style={cardStyle}
    >
      {accent !== 'transparent' && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: 3,
            background: accent,
            zIndex: 1,
          }}
        />
      )}

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          position: 'relative',
          marginLeft: inParallel ? 4 : 6,
        }}
      >
        {isActive ? (
          <span
            style={{
              position: 'relative',
              width: 18,
              height: 18,
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
                opacity: 0.22,
                animation: 'atomic-pulse 2s ease-out infinite',
              }}
            />
            <StatusGlyph status={phase.status} size={14} />
          </span>
        ) : (
          <span style={{ width: 18, display: 'inline-flex', justifyContent: 'center', flex: 'none' }}>
            <StatusGlyph status={phase.status} size={13} />
          </span>
        )}
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 13,
            fontWeight: 600,
            color: isActive ? 'var(--status-active)' : isDone ? 'var(--status-done)' : 'var(--fg-muted)',
            letterSpacing: '0.02em',
            whiteSpace: 'nowrap',
            flex: 'none',
            minWidth: 26,
          }}
        >
          {phase.id}
        </span>
        <span
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 14,
            fontWeight: 600,
            color: 'var(--fg-default)',
            flex: 1,
            letterSpacing: '-0.01em',
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {phase.title}
        </span>
        {hashTarget && (
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 9,
              fontWeight: 600,
              color: 'var(--status-active)',
              padding: '2px 7px',
              borderRadius: 999,
              background: 'color-mix(in srgb, var(--status-active) 15%, transparent)',
              border: '1px solid color-mix(in srgb, var(--status-active) 40%, transparent)',
              letterSpacing: '0.06em',
            }}
          >
            FROM URL
          </span>
        )}
        {phase.gateType === 'ui-gate' && <TagChip kind="uigate">ui-gate</TagChip>}
        {!isDone &&
          phase.highlights?.map((h, i) => (
            <HighlightBadge key={i} severity={h.severity} count={h.count} />
          ))}
      </div>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 14,
          alignItems: 'center',
          marginTop: density === 'tight' ? 4 : 8,
          marginLeft: 34,
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: isDone ? 'var(--status-done)' : 'var(--fg-muted)',
            whiteSpace: 'nowrap',
          }}
        >
          {phase.tasks.done}
          <span style={{ color: 'var(--fg-subtle)' }}>/{phase.tasks.total}</span> tasks
        </span>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: isDone
              ? 'var(--status-done)'
              : phase.gates.met < phase.gates.total
                ? 'var(--status-blocked)'
                : 'var(--status-done)',
            whiteSpace: 'nowrap',
          }}
        >
          {phase.gates.met}
          <span style={{ color: 'var(--fg-subtle)' }}>/{phase.gates.total}</span> gates
        </span>
        {isDone && phase.durationDays != null && (
          <span
            style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-subtle)', whiteSpace: 'nowrap' }}
          >
            {phase.durationDays}d duration
          </span>
        )}
        {!isDone && phase.audience && (
          <span
            style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-subtle)', whiteSpace: 'nowrap' }}
          >
            audience: <span style={{ color: 'var(--fg-muted)' }}>{phase.audience}</span>
          </span>
        )}
      </div>

      {showProgress && (
        <div
          style={{
            display: 'flex',
            height: 3,
            marginTop: 10,
            marginLeft: 34,
            marginRight: 6,
            gap: 1,
            borderRadius: 2,
            overflow: 'hidden',
          }}
        >
          {isDone ? (
            <div style={{ flex: 1, background: 'var(--status-done)' }} />
          ) : (
            <Fragment>
              {phase.tasks.done > 0 && (
                <div style={{ flex: phase.tasks.done, background: 'var(--status-done)', opacity: 0.85 }} />
              )}
              {isActive && (
                <div
                  style={{
                    flex: 1,
                    background: 'var(--status-active)',
                    backgroundImage:
                      'linear-gradient(90deg, var(--status-active), color-mix(in srgb, var(--status-active) 60%, white))',
                    boxShadow: '0 0 8px color-mix(in srgb, var(--status-active) 70%, transparent)',
                  }}
                />
              )}
              {phase.tasks.total - phase.tasks.done - (isActive ? 1 : 0) > 0 && (
                <div
                  style={{
                    flex: phase.tasks.total - phase.tasks.done - (isActive ? 1 : 0),
                    background: 'var(--border-default)',
                  }}
                />
              )}
            </Fragment>
          )}
        </div>
      )}

      {showScope && phase.scope && (
        <div
          style={{
            marginTop: 8,
            marginLeft: 34,
            display: 'flex',
            flexWrap: 'wrap',
            gap: 6,
            alignItems: 'center',
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              fontWeight: 600,
              color: 'var(--fg-subtle)',
              letterSpacing: '0.06em',
            }}
          >
            SCOPE
          </span>
          {phase.scope.map((s, i) => (
            <span
              key={i}
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                color: 'var(--fg-muted)',
                padding: '1px 6px',
                borderRadius: 3,
                background: 'var(--bg-canvas)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              {s}
            </span>
          ))}
        </div>
      )}

      {showNext &&
        (isDone ? (
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              color: 'var(--fg-subtle)',
              marginTop: 8,
              marginLeft: 34,
            }}
          >
            completed <span style={{ color: 'var(--status-done)' }}>{phase.completedAt}</span>
            <span style={{ color: 'var(--fg-faint)', margin: '0 8px' }}>·</span>
            <span style={{ color: 'var(--fg-muted)' }}>{phase.exit}</span>
          </div>
        ) : phase.next ? (
          <div
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: 12.5,
              color: 'var(--fg-muted)',
              marginTop: 8,
              marginLeft: 34,
            }}
          >
            Next: <span style={{ color: 'var(--fg-default)', fontWeight: 500 }}>{phase.next}</span>
          </div>
        ) : null)}
    </button>
  )
}

interface ParallelGroupProps {
  phases: UIPhase[]
  onOpen?: (phase: UIPhase) => void
  density?: 'tight' | 'baseline' | 'expanded'
  activeEmphasis?: 'edge' | 'edge-scan' | 'glow'
  variant?: 'bracket' | 'container' | 'chain'
  hashId?: string
}

export function ParallelGroup({
  phases,
  onOpen,
  density,
  activeEmphasis,
  variant = 'container',
  hashId,
}: ParallelGroupProps) {
  if (variant === 'container') {
    return (
      <div
        style={{
          position: 'relative',
          padding: '24px 12px 12px',
          background: 'color-mix(in srgb, var(--status-emerged) 5%, transparent)',
          border: '1px solid color-mix(in srgb, var(--status-emerged) 28%, transparent)',
          borderRadius: 10,
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: -10,
            left: 12,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '2px 10px',
            background: 'var(--bg-canvas)',
            border: '1px solid color-mix(in srgb, var(--status-emerged) 40%, transparent)',
            borderRadius: 999,
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            fontWeight: 600,
            color: 'var(--status-emerged)',
            letterSpacing: '0.08em',
          }}
        >
          <span>∥</span> PARALLEL · {phases.length} PHASES MAY RUN AT ONCE
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {phases.map((p, idx) => (
            <Fragment key={p.id}>
              <PhaseCard
                phase={p}
                onOpen={onOpen}
                inParallel
                density={density}
                activeEmphasis={activeEmphasis}
                hashTarget={hashId === p.id}
              />
              {idx < phases.length - 1 && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    fontFamily: 'var(--font-mono)',
                    fontSize: 10,
                    color: 'var(--status-emerged)',
                    letterSpacing: '0.08em',
                    margin: '-2px 0',
                  }}
                >
                  <span
                    style={{
                      flex: 1,
                      height: 1,
                      background: 'color-mix(in srgb, var(--status-emerged) 25%, transparent)',
                    }}
                  />
                  <span>∥ may run concurrently</span>
                  <span
                    style={{
                      flex: 1,
                      height: 1,
                      background: 'color-mix(in srgb, var(--status-emerged) 25%, transparent)',
                    }}
                  />
                </div>
              )}
            </Fragment>
          ))}
        </div>
      </div>
    )
  }
  return (
    <div style={{ position: 'relative', paddingLeft: 16 }}>
      <div
        style={{
          position: 'absolute',
          left: 4,
          top: 28,
          bottom: 4,
          width: 2,
          background: 'var(--status-emerged)',
          borderRadius: 1,
        }}
      />
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 6,
          marginLeft: -16,
          paddingLeft: 16,
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            fontWeight: 600,
            color: 'var(--status-emerged)',
            letterSpacing: '0.08em',
            whiteSpace: 'nowrap',
          }}
        >
          ∥ PARALLEL · {phases.length} PHASES
        </span>
        <div
          style={{
            flex: 1,
            minWidth: 0,
            height: 1,
            background: 'color-mix(in srgb, var(--status-emerged) 30%, transparent)',
          }}
        />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {phases.map((p) => (
          <PhaseCard
            key={p.id}
            phase={p}
            onOpen={onOpen}
            inParallel
            density={density}
            activeEmphasis={activeEmphasis}
            hashTarget={hashId === p.id}
          />
        ))}
      </div>
    </div>
  )
}

export function groupParallels(phases: UIPhase[]): Array<{ kind: 'solo' | 'parallel'; phases: UIPhase[] }> {
  const out: Array<{ kind: 'solo' | 'parallel'; phases: UIPhase[] }> = []
  const seen = new Set<string>()
  for (const p of phases) {
    if (seen.has(p.id)) continue
    const peers = Array.isArray(p.parallelWith) ? p.parallelWith : []
    if (peers.length > 0) {
      const group = [p, ...peers.map((id) => phases.find((x) => x.id === id)).filter((x): x is UIPhase => Boolean(x) && !seen.has(x!.id))]
      group.forEach((x) => seen.add(x.id))
      out.push({ kind: 'parallel', phases: group })
    } else {
      seen.add(p.id)
      out.push({ kind: 'solo', phases: [p] })
    }
  }
  return out
}
