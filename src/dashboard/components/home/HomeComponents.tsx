// HomeView pieces: HomeHeader + ConsumerBand + PlanRow + InitiativeRow +
// HealthBadge + PulseDot + Dot + PhasePips + MiniProgress + EmptyState.

import { Fragment, type ReactNode } from 'react'
import { HighlightBadge, StatusChip, StatusGlyph } from '../atoms'
import type { UIConsumer, UIPlanRow, UIInitRow } from '../../lib/adapters'

// ────────────────────────────────────────────────────────────────────────
// Dot / PulseDot / HealthBadge / PhasePips / MiniProgress
// ────────────────────────────────────────────────────────────────────────

function Dot({ color }: { color: string }) {
  return (
    <span
      style={{
        width: 7,
        height: 7,
        borderRadius: 999,
        background: color,
        flex: 'none',
        boxShadow: `0 0 6px color-mix(in srgb, ${color} 70%, transparent)`,
      }}
    />
  )
}

function PulseDot({ color }: { color: string }) {
  return (
    <span style={{ position: 'relative', width: 7, height: 7, flex: 'none' }}>
      <span
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          background: color,
          boxShadow: `0 0 8px color-mix(in srgb, ${color} 70%, transparent)`,
        }}
      />
      <span
        style={{
          position: 'absolute',
          inset: -3,
          borderRadius: '50%',
          background: `color-mix(in srgb, ${color} 40%, transparent)`,
          animation: 'atomic-pulse 2.4s ease-out infinite',
        }}
      />
    </span>
  )
}

interface HealthBadgeProps {
  health: UIConsumer['health']
}

function HealthBadge({ health }: HealthBadgeProps) {
  const map: Record<UIConsumer['health'], { label: string; color: string; pulse: boolean }> = {
    active: { label: 'active', color: 'var(--status-done)', pulse: true },
    empty: { label: 'no data', color: 'var(--fg-subtle)', pulse: false },
    errored: { label: 'errored', color: 'var(--severity-critical)', pulse: false },
    idle: { label: 'idle', color: 'var(--fg-muted)', pulse: false },
  }
  const s = map[health]
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        height: 20,
        padding: '0 9px 0 8px',
        borderRadius: 999,
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: '0.06em',
        color: s.color,
        background: `color-mix(in srgb, ${s.color} 10%, transparent)`,
        border: `1px solid color-mix(in srgb, ${s.color} 28%, transparent)`,
      }}
    >
      {s.pulse ? <PulseDot color={s.color} /> : <Dot color={s.color} />}
      {s.label}
    </span>
  )
}

function MiniProgress({ done, total, active = false }: { done: number; total: number; active?: boolean }) {
  const pendingCount = Math.max(0, total - done - (active ? 1 : 0))
  return (
    <div style={{ display: 'flex', height: 3, gap: 1, borderRadius: 2, overflow: 'hidden', minWidth: 80 }}>
      {done > 0 && <div style={{ flex: done, background: 'var(--status-done)', opacity: 0.9 }} />}
      {active && (
        <div
          style={{
            flex: 1,
            background: 'var(--status-active)',
            boxShadow: '0 0 8px color-mix(in srgb, var(--status-active) 70%, transparent)',
          }}
        />
      )}
      {pendingCount > 0 && <div style={{ flex: pendingCount, background: 'var(--border-default)' }} />}
    </div>
  )
}

function PhasePips({ phases }: { phases: { done: number; active: number; pending: number } }) {
  const pips: Array<{ k: 'd' | 'a' | 'p' }> = []
  for (let i = 0; i < phases.done; i++) pips.push({ k: 'd' })
  for (let i = 0; i < phases.active; i++) pips.push({ k: 'a' })
  for (let i = 0; i < phases.pending; i++) pips.push({ k: 'p' })
  return (
    <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
      {pips.map((p, idx) => {
        const color =
          p.k === 'd'
            ? 'var(--status-done)'
            : p.k === 'a'
              ? 'var(--status-active)'
              : 'color-mix(in srgb, var(--fg-faint) 70%, transparent)'
        const isActive = p.k === 'a'
        return (
          <span
            key={idx}
            style={{
              display: 'inline-block',
              width: isActive ? 14 : 8,
              height: 4,
              background: color,
              borderRadius: 1,
              boxShadow: isActive ? '0 0 6px color-mix(in srgb, var(--status-active) 80%, transparent)' : 'none',
            }}
          />
        )
      })}
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────
// PlanRow + InitiativeRow
// ────────────────────────────────────────────────────────────────────────

interface PlanRowProps {
  plan: UIPlanRow
  onOpen: (path: string) => void
}

export function PlanRow({ plan, onOpen }: PlanRowProps) {
  const isActive = plan.status === 'active'
  const isBlocked = plan.status === 'blocked'
  const leftBorder = isActive ? 'var(--status-active)' : isBlocked ? 'var(--status-blocked)' : 'var(--border-default)'
  return (
    <button
      onClick={() => onOpen(`/plans/${plan.slug}`)}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'var(--bg-elevated)'
        e.currentTarget.style.borderColor = 'var(--border-bright)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'var(--bg-surface)'
        e.currentTarget.style.borderColor = 'var(--border-default)'
      }}
      style={{
        all: 'unset',
        cursor: 'pointer',
        display: 'block',
        width: '100%',
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-default)',
        borderLeft: `3px solid ${leftBorder}`,
        borderRadius: 8,
        padding: '12px 14px',
        boxShadow: 'var(--shadow-ambient)',
        transition: 'background 120ms, border-color 120ms, transform 120ms',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 2 }}>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                color: 'var(--fg-subtle)',
                letterSpacing: '0.02em',
                whiteSpace: 'nowrap',
              }}
            >
              /plans/{plan.slug}
            </span>
            <span style={{ color: 'var(--fg-faint)', fontFamily: 'var(--font-mono)', fontSize: 10 }}>·</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-subtle)' }}>v{plan.version}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h3
              style={{
                margin: 0,
                fontFamily: 'var(--font-sans)',
                fontSize: 16,
                fontWeight: 600,
                color: 'var(--fg-default)',
                letterSpacing: '-0.015em',
              }}
            >
              {plan.title}
            </h3>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 'none' }}>
          {plan.criticalHighlights > 0 && <HighlightBadge severity="critical" count={plan.criticalHighlights} />}
          {plan.openHighlights - plan.criticalHighlights > 0 && (
            <HighlightBadge severity="warn" count={plan.openHighlights - plan.criticalHighlights} />
          )}
          <StatusChip status={plan.status} />
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 0,
          marginTop: 12,
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
        }}
      >
        {(
          [
            { label: 'current', value: plan.currentPhase ?? '—', color: 'var(--status-active)' },
            {
              label: 'tasks',
              value: (
                <span>
                  <span style={{ color: 'var(--fg-default)' }}>{plan.tasks.done}</span>
                  <span style={{ color: 'var(--fg-subtle)' }}>/{plan.tasks.total}</span>
                </span>
              ),
            },
            { label: 'phases', value: <PhasePips phases={plan.phases} /> },
            { label: 'branch', value: plan.branch, color: 'var(--fg-default)' },
          ] as Array<{ label: string; value: ReactNode; color?: string }>
        ).map((m, i, arr) => (
          <Fragment key={i}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '0 12px', whiteSpace: 'nowrap', flex: 'none' }}>
              <span style={{ color: 'var(--fg-subtle)' }}>{m.label}</span>
              <span style={{ color: m.color ?? 'var(--fg-default)', fontWeight: 500 }}>{m.value}</span>
            </span>
            {i < arr.length - 1 && <span style={{ width: 1, height: 12, background: 'var(--border-default)', flex: 'none' }} />}
          </Fragment>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <MiniProgress done={plan.tasks.done} total={plan.tasks.total} active={isActive} />
        </div>
        {plan.next && (
          <div
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: 12,
              color: 'var(--fg-muted)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: '60%',
              flex: 'none',
            }}
          >
            Next: <span style={{ color: 'var(--fg-default)', fontWeight: 500 }}>{plan.next}</span>
          </div>
        )}
      </div>
    </button>
  )
}

interface InitRowProps {
  init: UIInitRow
  onOpen: (path: string) => void
}

export function InitiativeRow({ init, onOpen }: InitRowProps) {
  const isDone = init.status === 'done'
  return (
    <button
      onClick={() => onOpen(`/initiatives/${init.slug}`)}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'var(--bg-surface)'
        e.currentTarget.style.borderColor = 'var(--border-default)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent'
        e.currentTarget.style.borderColor = 'var(--border-subtle)'
      }}
      style={{
        all: 'unset',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        width: '100%',
        padding: '8px 12px',
        background: 'transparent',
        border: '1px solid var(--border-subtle)',
        borderRadius: 6,
        fontFamily: 'var(--font-sans)',
        fontSize: 13,
        transition: 'background 120ms, border-color 120ms',
        opacity: isDone ? 0.6 : 1,
      }}
    >
      <StatusGlyph status={init.status} size={12} />
      <span style={{ color: 'var(--fg-default)', fontWeight: 500, flex: 'none' }}>{init.title}</span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-subtle)', whiteSpace: 'nowrap' }}>
        {init.tasks.done}
        <span style={{ color: 'var(--fg-faint)' }}>/{init.tasks.total}</span>
      </span>
      <div style={{ flex: 1 }} />
      {init.next && (
        <span
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 11,
            color: 'var(--fg-muted)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            maxWidth: 280,
          }}
        >
          {init.next}
        </span>
      )}
      {init.openHighlights > 0 && <HighlightBadge severity="warn" count={init.openHighlights} />}
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-faint)' }}>↗</span>
    </button>
  )
}

// ────────────────────────────────────────────────────────────────────────
// ConsumerBand + ConsumerHeader
// ────────────────────────────────────────────────────────────────────────

export function ConsumerBand({
  consumer,
  onOpen,
}: {
  consumer: UIConsumer
  onOpen: (path: string) => void
}) {
  const total = consumer.plans.length + consumer.initiatives.length
  return (
    <section style={{ marginTop: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 4px 10px' }}>
        <div
          aria-hidden
          style={{
            width: 28,
            height: 28,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-default)',
            borderRadius: 6,
            fontFamily: 'var(--font-mono)',
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--fg-muted)',
            flex: 'none',
            boxShadow: 'var(--shadow-ambient)',
          }}
        >
          ⌬
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, minWidth: 0 }}>
          <h2
            style={{
              margin: 0,
              fontFamily: 'var(--font-mono)',
              fontSize: 15,
              fontWeight: 600,
              color: 'var(--fg-default)',
              letterSpacing: '-0.01em',
            }}
          >
            {consumer.name}
          </h2>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-subtle)', whiteSpace: 'nowrap' }}>
            {consumer.path}
          </span>
        </div>
        <HealthBadge health={consumer.health} />
        <div style={{ flex: 1 }} />
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-subtle)', whiteSpace: 'nowrap' }}>
          last write {consumer.lastWrite}
        </span>
        {total > 0 && (
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              fontWeight: 500,
              color: 'var(--fg-muted)',
              padding: '2px 8px',
              borderRadius: 999,
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-default)',
              whiteSpace: 'nowrap',
            }}
          >
            {total} {total === 1 ? 'entry' : 'entries'}
          </span>
        )}
      </div>
      {total === 0 ? (
        <div
          style={{
            padding: '14px 16px',
            background: 'var(--bg-surface)',
            border: '1px dashed var(--border-default)',
            borderRadius: 8,
            fontFamily: 'var(--font-sans)',
            fontSize: 12,
            color: 'var(--fg-subtle)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--fg-faint)' }}>(empty)</span>
          <span>Consumer detected, no plans or initiatives written yet.</span>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {consumer.plans.map((p) => (
            <PlanRow key={p.slug} plan={p} onOpen={onOpen} />
          ))}
          {consumer.initiatives.length > 0 && (
            <div style={{ marginTop: consumer.plans.length > 0 ? 6 : 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, padding: '0 2px' }}>
                <span className="t-eyebrow" style={{ color: 'var(--fg-muted)' }}>
                  Standalone initiatives · {consumer.initiatives.length}
                </span>
                <div style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {consumer.initiatives.map((i) => (
                  <InitiativeRow key={i.slug} init={i} onOpen={onOpen} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  )
}

// ────────────────────────────────────────────────────────────────────────
// HomeHeader + EmptyState
// ────────────────────────────────────────────────────────────────────────

export function HomeHeader({
  consumerCount,
  cwd,
}: {
  consumerCount: number
  cwd?: string
}) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 18, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            className="t-eyebrow"
            style={{ color: 'var(--fg-subtle)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}
          >
            <span>HOME</span>
            <span style={{ color: 'var(--fg-faint)' }}>·</span>
            <span style={{ color: 'var(--fg-faint)' }}>{cwd ?? '~'}</span>
          </div>
          <h1
            style={{
              margin: 0,
              fontFamily: 'var(--font-sans)',
              fontSize: 32,
              fontWeight: 600,
              color: 'var(--fg-default)',
              letterSpacing: '-0.025em',
              lineHeight: 1.1,
            }}
          >
            {consumerCount === 0 ? (
              <>aiDeck is running. No consumers yet.</>
            ) : (
              <>
                Your work, projected from{' '}
                <span style={{ color: 'var(--status-active)' }}>{consumerCount}</span>{' '}
                {consumerCount === 1 ? 'consumer' : 'consumers'}.
              </>
            )}
          </h1>
          <p
            style={{
              margin: '10px 0 0',
              fontFamily: 'var(--font-sans)',
              fontSize: 14,
              color: 'var(--fg-muted)',
              lineHeight: 1.55,
              maxWidth: 720,
            }}
          >
            {consumerCount === 0 ? (
              <>
                aiDeck is a projection layer. It needs at least one consumer — an AI skill that writes structured
                project data — to show you anything.
              </>
            ) : (
              <>
                aiDeck never owns state — it projects from{' '}
                <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--fg-default)' }}>.atomic-skills/</code>.
                Click any plan or initiative to zoom in.
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  )
}

export function EmptyState() {
  return (
    <div style={{ marginTop: 18 }}>
      <div
        style={{
          padding: '24px 24px 22px',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-default)',
          borderRadius: 10,
          boxShadow: 'var(--shadow-ambient)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div className="t-eyebrow" style={{ color: 'var(--fg-muted)', marginBottom: 8 }}>
          NEXT STEP — INSTALL A CONSUMER
        </div>
        <h2
          style={{
            margin: 0,
            fontFamily: 'var(--font-sans)',
            fontSize: 20,
            fontWeight: 600,
            color: 'var(--fg-default)',
            letterSpacing: '-0.015em',
          }}
        >
          No plans or initiatives yet.
        </h2>
        <p style={{ margin: '8px 0 0', maxWidth: 680, color: 'var(--fg-muted)', fontSize: 13, lineHeight: 1.55 }}>
          A consumer is any AI skill that writes structured project data to{' '}
          <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--fg-default)' }}>.atomic-skills/</code> in your
          repo. Run the project skill to create your first plan, or use{' '}
          <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--fg-default)' }}>aideck demo</code> to see what
          this looks like populated.
        </p>
      </div>
    </div>
  )
}
