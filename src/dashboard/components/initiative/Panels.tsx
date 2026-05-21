// StackPanel + ParkedPanel + EmergedPanel + ReferencesPanel + ExitGatesCard
// for the initiative view.

import { Fragment, useState, type ReactNode } from 'react'
import { Card, SectionHeader, StatusGlyph, VerifierBadge } from '../atoms'
import type { UIGate, UIParked, UIEmerged, UIStackFrame, UIRef } from '../../lib/adapters'

// ────────────────────────────────────────────────────────────────────────
// ExitGatesCard
// ────────────────────────────────────────────────────────────────────────

interface ExitGatesProps {
  gates: UIGate[]
}

export function ExitGatesCard({ gates }: ExitGatesProps) {
  const [requested, setRequested] = useState<Record<string, boolean>>({})
  const onRequest = (g: UIGate) => {
    setRequested((s) => ({ ...s, [g.id]: true }))
    setTimeout(() => {
      setRequested((s) => {
        const n = { ...s }
        delete n[g.id]
        return n
      })
    }, 3600)
  }
  const met = gates.filter((g) => g.status === 'met').length
  const deferred = gates.filter((g) => g.status === 'deferred').length
  const pending = gates.length - met - deferred
  const allMet = met === gates.length
  return (
    <Card>
      <SectionHeader
        count={gates.length}
        action={
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
            }}
          >
            <span style={{ color: allMet ? 'var(--status-done)' : 'var(--status-blocked)', fontWeight: 500 }}>
              {met}
              <span style={{ color: 'var(--fg-subtle)' }}>/{gates.length}</span> met
            </span>
            {pending > 0 && (
              <Fragment>
                <span style={{ width: 1, height: 10, background: 'var(--border-default)' }} />
                <span style={{ color: 'var(--fg-muted)' }}>{pending} pending</span>
              </Fragment>
            )}
            {deferred > 0 && (
              <Fragment>
                <span style={{ width: 1, height: 10, background: 'var(--border-default)' }} />
                <span style={{ color: 'var(--status-parked)' }}>{deferred} deferred</span>
              </Fragment>
            )}
          </span>
        }
      >
        Exit gates
      </SectionHeader>
      {gates.map((g, idx) => (
        <ExitGateRow key={g.id} gate={g} isLast={idx === gates.length - 1} requested={Boolean(requested[g.id])} onRequest={onRequest} />
      ))}
    </Card>
  )
}

function ExitGateRow({
  gate,
  isLast,
  requested,
  onRequest,
}: {
  gate: UIGate
  isLast: boolean
  requested: boolean
  onRequest: (g: UIGate) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const met = gate.status === 'met'
  const deferred = gate.status === 'deferred'
  const lr = gate.lastRun
  const statusColor = met ? 'var(--status-done)' : deferred ? 'var(--status-parked)' : 'var(--status-pending)'
  return (
    <div style={{ borderBottom: isLast ? 'none' : '1px solid var(--border-subtle)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px' }}>
        <StatusGlyph status={met ? 'done' : deferred ? 'parked' : 'pending'} size={13} />
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            fontWeight: 500,
            color: statusColor,
            width: 64,
            flex: 'none',
          }}
        >
          {gate.id}
        </span>
        <span
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 13.5,
            color: 'var(--fg-default)',
            flex: 1,
            minWidth: 0,
            lineHeight: 1.4,
          }}
        >
          {gate.description}
        </span>
        <VerifierBadge kind={gate.verifier.kind} />
        {!met && !deferred &&
          (requested ? (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                fontWeight: 600,
                color: 'var(--status-emerged)',
                letterSpacing: '0.05em',
                padding: '2px 8px',
                borderRadius: 4,
                whiteSpace: 'nowrap',
                background: 'color-mix(in srgb, var(--status-emerged) 14%, transparent)',
                border: '1px solid color-mix(in srgb, var(--status-emerged) 35%, transparent)',
              }}
            >
              <span style={{ fontSize: 11 }}>⇥</span> queued · intent written
            </span>
          ) : (
            <button
              onClick={() => onRequest(gate)}
              style={{
                all: 'unset',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                height: 24,
                padding: '0 9px',
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                color: 'var(--accent-link)',
                background: 'var(--bg-canvas)',
                border: '1px solid color-mix(in srgb, var(--accent-link) 35%, transparent)',
                borderRadius: 4,
                whiteSpace: 'nowrap',
              }}
            >
              <span>▷</span>
              request run
            </button>
          ))}
        <button
          onClick={() => setExpanded((v) => !v)}
          style={{
            all: 'unset',
            cursor: 'pointer',
            color: 'var(--fg-muted)',
            fontFamily: 'var(--font-mono)',
            fontSize: 13,
            padding: '0 4px',
            width: 18,
            textAlign: 'center',
          }}
        >
          {expanded ? '▾' : '▸'}
        </button>
      </div>

      {(lr || gate.evidence || gate.deferredReason) && (
        <div
          style={{
            padding: '0 14px 8px 86px',
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'var(--fg-subtle)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            flexWrap: 'wrap',
          }}
        >
          {lr && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '1px 7px',
                borderRadius: 3,
                whiteSpace: 'nowrap',
                background:
                  lr.status === 'pass'
                    ? 'color-mix(in srgb, var(--status-done) 10%, transparent)'
                    : 'color-mix(in srgb, var(--severity-warn) 10%, transparent)',
                border: `1px solid ${
                  lr.status === 'pass'
                    ? 'color-mix(in srgb, var(--status-done) 25%, transparent)'
                    : 'color-mix(in srgb, var(--severity-warn) 30%, transparent)'
                }`,
                color: lr.status === 'pass' ? 'var(--status-done)' : 'var(--severity-warn)',
              }}
            >
              {lr.status === 'pass' ? '✓' : '✗'} last run · exit {lr.exit} · {lr.when}
            </span>
          )}
          {lr?.output && (
            <span style={{ color: 'var(--fg-muted)' }}>
              → <span style={{ color: 'var(--fg-default)' }}>{lr.output}</span>
            </span>
          )}
          {met && gate.evidence && (
            <span style={{ fontFamily: 'var(--font-sans)', color: 'var(--fg-muted)' }}>
              evidence: <span style={{ color: 'var(--fg-default)' }}>{gate.evidence}</span>
            </span>
          )}
          {deferred && gate.deferredReason && (
            <span style={{ fontFamily: 'var(--font-sans)', color: 'var(--fg-muted)', flex: 1, minWidth: 0, lineHeight: 1.5 }}>
              <span style={{ color: 'var(--status-parked)', fontFamily: 'var(--font-mono)' }}>⌂ deferred:</span>{' '}
              {gate.deferredReason}
            </span>
          )}
        </div>
      )}

      {expanded && (
        <div
          style={{
            margin: '0 14px 12px 86px',
            padding: 12,
            background: 'var(--bg-sunken)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 6,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              fontWeight: 600,
              color: 'var(--fg-subtle)',
              letterSpacing: '0.08em',
            }}
          >
            <span>VERIFIER · {gate.verifier.kind.toUpperCase()}</span>
            <span style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }} />
          </div>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              color: 'var(--fg-default)',
              padding: '8px 10px',
              background: 'var(--bg-canvas)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 4,
              lineHeight: 1.5,
              wordBreak: 'break-all',
            }}
          >
            <span style={{ color: 'var(--fg-faint)', marginRight: 6, userSelect: 'none' }}>$</span>
            {gate.verifier.command}
          </div>
        </div>
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────
// StackPanel
// ────────────────────────────────────────────────────────────────────────

const FRAME_KIND: Record<UIStackFrame['kind'], { glyph: string; color: string; label: string }> = {
  task: { glyph: '◉', color: 'var(--status-active)', label: 'task' },
  validation: { glyph: '✓✓', color: 'var(--verifier-test)', label: 'validation' },
  investigation: { glyph: '⌬', color: 'var(--status-emerged)', label: 'investigation' },
  discussion: { glyph: '⌬', color: 'var(--accent-link)', label: 'discussion' },
}

interface StackProps {
  stack: UIStackFrame[]
}

export function StackPanel({ stack }: StackProps) {
  if (!stack || stack.length === 0) {
    return (
      <Card>
        <SectionHeader>Stack · attention</SectionHeader>
        <div style={{ padding: '14px 16px', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-subtle)' }}>
          (no active stack — nothing in flight)
        </div>
      </Card>
    )
  }
  const maxDepth = Math.max(...stack.map((s) => s.depth)) + 1
  return (
    <Card>
      <SectionHeader
        action={
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-subtle)' }}>
            depth <span style={{ color: 'var(--fg-default)', fontWeight: 500 }}>{maxDepth}</span>
            {' · '}top is <span style={{ color: 'var(--status-active)', fontWeight: 500 }}>HERE</span>
          </span>
        }
      >
        Stack · attention
      </SectionHeader>
      <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {stack.map((f, i) => (
          <StackFrame key={i} frame={f} isHere={f.here || i === stack.length - 1} />
        ))}
      </div>
    </Card>
  )
}

function StackFrame({ frame, isHere }: { frame: UIStackFrame; isHere: boolean }) {
  const kind = FRAME_KIND[frame.kind] ?? FRAME_KIND.task
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 8,
        position: 'relative',
        paddingLeft: frame.depth * 22,
      }}
    >
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 22,
          height: 22,
          flex: 'none',
          position: 'relative',
        }}
      >
        {isHere && (
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
        )}
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            color: isHere ? 'var(--status-active)' : kind.color,
            fontWeight: 600,
            position: 'relative',
          }}
        >
          {isHere ? '◉' : kind.glyph}
        </span>
      </span>
      <div style={{ flex: 1, minWidth: 0, paddingTop: 2 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              fontWeight: 600,
              color: isHere ? 'var(--status-active)' : kind.color,
            }}
          >
            #{frame.id}
          </span>
          <span
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: 13,
              color: isHere ? 'var(--fg-default)' : 'var(--fg-muted)',
              fontWeight: isHere ? 500 : 400,
              flex: 1,
              minWidth: 0,
              lineHeight: 1.4,
            }}
          >
            {frame.title}
          </span>
          {isHere && (
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 9,
                fontWeight: 700,
                color: 'var(--status-active)',
                letterSpacing: '0.12em',
                padding: '2px 7px',
                borderRadius: 999,
                background: 'color-mix(in srgb, var(--status-active) 14%, transparent)',
                border: '1px solid color-mix(in srgb, var(--status-active) 40%, transparent)',
              }}
            >
              ◉ HERE
            </span>
          )}
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginTop: 3,
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            color: 'var(--fg-subtle)',
          }}
        >
          <span style={{ color: kind.color, fontWeight: 500 }}>{kind.label}</span>
          <span style={{ color: 'var(--fg-faint)' }}>·</span>
          <span>opened {frame.openedAt}</span>
        </div>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────
// ParkedPanel + EmergedPanel + ReferencesPanel
// ────────────────────────────────────────────────────────────────────────

export function ParkedPanel({ items }: { items: UIParked[] }) {
  return (
    <PanelShell
      title="Parked"
      count={items.length}
      action={
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-subtle)', letterSpacing: '0.08em' }}>
          deliberately paused
        </span>
      }
      emptyMessage="no parked items in this initiative"
      emptyStriped
    >
      {items.map((p, idx) => (
        <div
          key={p.id}
          style={{
            padding: '10px 14px',
            borderBottom: idx < items.length - 1 ? '1px solid var(--border-subtle)' : 'none',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <StatusGlyph status="parked" size={12} />
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--fg-default)', flex: 1, lineHeight: 1.35 }}>
              {p.title}
              <StaleGlyph staleAge={p.staleAge} />
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-subtle)', flex: 'none' }}>
              parked {p.parkedAt}
            </span>
          </div>
          {p.reason && (
            <div
              style={{
                marginLeft: 28,
                paddingLeft: 10,
                borderLeft: '2px solid color-mix(in srgb, var(--status-parked) 30%, transparent)',
                fontFamily: 'var(--font-sans)',
                fontSize: 12,
                color: 'var(--fg-muted)',
                lineHeight: 1.5,
              }}
            >
              {p.reason}
            </div>
          )}
        </div>
      ))}
    </PanelShell>
  )
}

function StaleGlyph({ staleAge }: { staleAge?: number }) {
  if (staleAge === undefined || staleAge < 14) return null
  return (
    <span
      title={`Last reviewed ${staleAge} days ago`}
      style={{
        marginLeft: 6,
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        color: 'var(--severity-warn)',
      }}
    >
      ⌛
    </span>
  )
}

export function EmergedPanel({ items }: { items: UIEmerged[] }) {
  return (
    <PanelShell
      title="Emerged"
      count={items.length}
      action={
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-subtle)', letterSpacing: '0.08em' }}>
          discovered laterally
        </span>
      }
      emptyMessage="nothing emerged from this initiative"
      emptyStriped={false}
    >
      {items.map((e, idx) => (
        <div
          key={e.id}
          style={{
            padding: '10px 14px',
            borderBottom: idx < items.length - 1 ? '1px solid var(--border-subtle)' : 'none',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <StatusGlyph status="emerged" size={12} />
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--fg-default)', flex: 1, lineHeight: 1.35 }}>
              {e.title}
              <StaleGlyph staleAge={e.staleAge} />
            </span>
            {e.promoted && (
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                  color: 'var(--status-done)',
                  padding: '1px 6px',
                  borderRadius: 999,
                  background: 'color-mix(in srgb, var(--status-done) 10%, transparent)',
                  border: '1px solid color-mix(in srgb, var(--status-done) 25%, transparent)',
                }}
              >
                ✓ promoted
              </span>
            )}
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-subtle)', flex: 'none' }}>
              {e.surfacedAt}
            </span>
          </div>
          {e.reason && (
            <div
              style={{
                marginLeft: 28,
                paddingLeft: 10,
                borderLeft: '2px solid color-mix(in srgb, var(--status-emerged) 30%, transparent)',
                fontFamily: 'var(--font-sans)',
                fontSize: 12,
                color: 'var(--fg-muted)',
                lineHeight: 1.5,
              }}
            >
              {e.reason}
            </div>
          )}
        </div>
      ))}
    </PanelShell>
  )
}

export function ReferencesPanel({ refs }: { refs: UIRef[] }) {
  if (refs.length === 0) return null
  return (
    <PanelShell title="References" count={refs.length} emptyMessage="" emptyStriped={false}>
      {refs.map((r, i) => (
        <div
          key={i}
          style={{
            padding: '8px 14px',
            borderBottom: i < refs.length - 1 ? '1px solid var(--border-subtle)' : 'none',
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            color: 'var(--fg-default)',
            display: 'flex',
            gap: 10,
          }}
        >
          <span style={{ color: 'var(--fg-subtle)', minWidth: 60 }}>{r.kind}</span>
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.path}</span>
        </div>
      ))}
    </PanelShell>
  )
}

function PanelShell({
  title,
  count,
  action,
  emptyMessage,
  emptyStriped,
  children,
}: {
  title: string
  count: number
  action?: ReactNode
  emptyMessage: string
  emptyStriped: boolean
  children: ReactNode
}) {
  return (
    <Card>
      <SectionHeader count={count} action={action}>
        {title}
      </SectionHeader>
      {count === 0 ? (
        <div
          style={{
            padding: '20px 16px',
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'var(--fg-subtle)',
            textAlign: 'center',
            background: emptyStriped
              ? 'repeating-linear-gradient(135deg, transparent, transparent 6px, color-mix(in srgb, var(--border-subtle) 50%, transparent) 6px, color-mix(in srgb, var(--border-subtle) 50%, transparent) 7px)'
              : 'transparent',
          }}
        >
          {emptyMessage}
        </div>
      ) : (
        children
      )}
    </Card>
  )
}
