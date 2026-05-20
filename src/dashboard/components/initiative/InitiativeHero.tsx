import { Fragment, type ReactNode } from 'react'
import { StatusChip } from '../atoms'
import type { UIInitiative } from '../../lib/adapters'

interface Props {
  initiative: UIInitiative
  onJumpToTask?: (taskId: string) => void
}

export function InitiativeHero({ initiative: i, onJumpToTask }: Props) {
  const isDone = i.status === 'done'
  const accent = isDone ? 'var(--status-done)' : 'var(--status-active)'
  const isStandalone = !i.parentPlan

  return (
    <div style={{ marginBottom: 6 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginBottom: 8,
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          flexWrap: 'wrap',
          rowGap: 6,
        }}
      >
        {isStandalone ? (
          <span className="t-eyebrow" style={{ color: 'var(--fg-subtle)', letterSpacing: '0.12em' }}>
            STANDALONE INITIATIVE
          </span>
        ) : (
          <Fragment>
            <span className="t-eyebrow" style={{ color: 'var(--fg-subtle)', letterSpacing: '0.12em', whiteSpace: 'nowrap' }}>
              INITIATIVE
            </span>
            <a href={`#/plans/${i.parentPlan!.slug}`} style={{ color: 'var(--accent-link)', textDecoration: 'none', whiteSpace: 'nowrap' }}>
              {i.parentPlan!.slug}
            </a>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}>
              <span style={{ color: 'var(--fg-faint)' }}>▸</span>
              <span style={{ color: 'var(--fg-muted)' }}>
                phase <span style={{ color: 'var(--fg-default)' }}>{(i.phaseIndex ?? 0) + 1}</span>
                <span style={{ color: 'var(--fg-subtle)' }}>/{i.phaseTotal ?? 1}</span>
              </span>
              <PhaseStepper index={i.phaseIndex ?? 0} total={i.phaseTotal ?? 1} isDone={isDone} />
            </span>
            {i.trackId && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}>
                <span style={{ width: 1, height: 12, background: 'var(--border-default)' }} />
                <span style={{ color: 'var(--fg-muted)' }}>
                  track <span style={{ color: 'var(--fg-default)' }}>{i.trackId}</span>{' '}
                  {i.trackTitle && <>· {i.trackTitle}</>}
                </span>
              </span>
            )}
          </Fragment>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'stretch', gap: 18, minWidth: 0 }}>
        {i.phaseId && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              padding: '10px 22px 12px',
              flex: 'none',
              minWidth: 110,
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-default)',
              borderRadius: 10,
              boxShadow: isDone
                ? '0 0 0 1px color-mix(in srgb, var(--status-done) 25%, transparent), var(--shadow-ambient)'
                : 'var(--shadow-glow-active)',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: accent }} />
            <div className="t-eyebrow" style={{ color: accent, marginBottom: 2, letterSpacing: '0.12em' }}>
              {isDone ? 'PHASE · DONE' : 'PHASE'}
            </div>
            <div
              className="t-display-mono"
              style={{ fontSize: 44, lineHeight: 1, color: accent, fontWeight: 600, letterSpacing: '-0.02em' }}
            >
              {i.phaseId}
            </div>
          </div>
        )}

        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            minWidth: 0,
            gap: 4,
          }}
        >
          <h1
            style={{
              margin: 0,
              fontFamily: 'var(--font-sans)',
              fontSize: 30,
              fontWeight: 600,
              color: 'var(--fg-default)',
              letterSpacing: '-0.025em',
              lineHeight: 1.1,
            }}
          >
            {i.title}
          </h1>
          <p
            style={{
              margin: '4px 0 0',
              fontFamily: 'var(--font-sans)',
              fontSize: 14.5,
              lineHeight: 1.55,
              color: 'var(--fg-muted)',
              maxWidth: '70ch',
            }}
          >
            {i.goal}
          </p>
        </div>
      </div>

      <MetaStripInit initiative={i} />

      {i.scope && i.scope.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <ScopePaths paths={i.scope} />
        </div>
      )}

      {!isDone && i.nextAction && <NextActionStrip next={i.nextAction} onJump={onJumpToTask} />}

      {isDone && (
        <div
          style={{
            marginTop: 16,
            padding: '12px 14px',
            background: 'color-mix(in srgb, var(--status-done) 6%, var(--bg-surface))',
            border: '1px solid color-mix(in srgb, var(--status-done) 30%, transparent)',
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            fontFamily: 'var(--font-sans)',
            fontSize: 13.5,
            color: 'var(--fg-muted)',
          }}
        >
          <span style={{ color: 'var(--status-done)', fontFamily: 'var(--font-mono)', fontSize: 14 }}>✓</span>
          <span>
            Closed on <span style={{ color: 'var(--status-done)', fontWeight: 500 }}>{i.completedAt}</span>
            {i.durationDays && (
              <>
                {' '}
                after <span style={{ color: 'var(--fg-default)', fontWeight: 500 }}>{i.durationDays} days</span>.
              </>
            )}{' '}
            All <span style={{ color: 'var(--fg-default)' }}>{i.exitGates.length} exit gates</span> met. Reopening
            writes a{' '}
            <code
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
                padding: '1px 5px',
                background: 'var(--bg-canvas)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 3,
                color: 'var(--fg-default)',
              }}
            >
              reopen
            </code>{' '}
            intent — no file is mutated directly.
          </span>
        </div>
      )}
    </div>
  )
}

function PhaseStepper({ index, total, isDone }: { index: number; total: number; isDone: boolean }) {
  const accent = isDone ? 'var(--status-done)' : 'var(--status-active)'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
      {Array.from({ length: total }).map((_, i) => {
        const past = i < index
        const cur = i === index
        return (
          <span
            key={i}
            style={{
              width: cur ? 14 : past ? 6 : 4,
              height: 4,
              borderRadius: 1,
              background: cur ? accent : past ? 'var(--border-strong)' : 'var(--border-default)',
            }}
          />
        )
      })}
    </div>
  )
}

function ScopePaths({ paths }: { paths: string[] }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
      <span className="t-eyebrow" style={{ color: 'var(--fg-subtle)', flex: 'none' }}>
        SCOPE
      </span>
      {paths.map((p, i) => (
        <span
          key={i}
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'var(--fg-muted)',
            padding: '2px 7px',
            borderRadius: 3,
            background: 'var(--bg-canvas)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          {p}
        </span>
      ))}
    </div>
  )
}

function NextActionStrip({
  next,
  onJump,
}: {
  next: { taskId: string; title: string }
  onJump?: (taskId: string) => void
}) {
  return (
    <div
      onClick={() => onJump?.(next.taskId)}
      role="button"
      tabIndex={0}
      className="has-texture-active"
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'color-mix(in srgb, var(--status-active) 10%, var(--bg-surface))'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'color-mix(in srgb, var(--status-active) 7%, var(--bg-surface))'
      }}
      style={{
        marginTop: 16,
        background: 'color-mix(in srgb, var(--status-active) 7%, var(--bg-surface))',
        border: '1px solid color-mix(in srgb, var(--status-active) 38%, transparent)',
        borderRadius: 8,
        padding: '12px 14px 12px 18px',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        cursor: 'pointer',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: 'var(--shadow-glow-active)',
      }}
    >
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: 'var(--status-active)' }} />
      <div
        style={{
          position: 'relative',
          width: 22,
          height: 22,
          flex: 'none',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
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
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--status-active)', fontWeight: 700 }}>◉</span>
      </div>
      <span
        className="t-eyebrow"
        style={{ color: 'var(--status-active)', flex: 'none', letterSpacing: '0.12em', whiteSpace: 'nowrap' }}
      >
        NEXT
      </span>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'baseline', gap: 10, overflow: 'hidden' }}>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--status-active)',
            flex: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          {next.taskId}
        </span>
        <span
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 14,
            fontWeight: 500,
            color: 'var(--fg-default)',
            flex: 1,
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {next.title}
        </span>
      </div>
      <span
        style={{
          fontFamily: 'var(--font-sans)',
          fontSize: 12,
          color: 'var(--accent-link)',
          flex: 'none',
          whiteSpace: 'nowrap',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
        }}
      >
        Jump to row <span style={{ fontSize: 11 }}>→</span>
      </span>
    </div>
  )
}

function MetaStripInit({ initiative: i }: { initiative: UIInitiative }) {
  const isDone = i.status === 'done'
  type Row = { label: string; value: ReactNode; color?: string; mono?: boolean; raw?: boolean }
  const rows: Array<Row | null> = [
    { label: 'status', value: <StatusChip status={i.status} />, raw: true },
    { label: 'started', value: i.started, color: 'var(--fg-default)' },
    isDone
      ? { label: 'completed', value: i.completedAt, color: 'var(--status-done)' }
      : { label: 'updated', value: i.updated, color: 'var(--fg-default)' },
    isDone && i.durationDays != null
      ? { label: 'duration', value: `${i.durationDays}d`, color: 'var(--fg-default)' }
      : null,
    { label: 'branch', value: i.branch ?? '—', color: 'var(--fg-default)', mono: true },
    i.tag ? { label: 'tag', value: i.tag, color: 'var(--status-done)', mono: true } : null,
    i.parentPlan
      ? { label: 'plan', value: i.parentPlan.slug, color: 'var(--accent-link)', mono: true }
      : null,
    i.audience ? { label: 'audience', value: i.audience, color: 'var(--fg-default)' } : null,
  ]
  const visible = rows.filter((r): r is Row => Boolean(r))

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 0,
        marginTop: 14,
        padding: '8px 4px',
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-default)',
        borderRadius: 8,
        boxShadow: 'var(--shadow-ambient)',
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
      }}
    >
      {visible.map((m, idx) => (
        <Fragment key={m.label}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 14px',
              whiteSpace: 'nowrap',
              flex: 'none',
            }}
          >
            <span style={{ color: 'var(--fg-subtle)' }}>{m.label}</span>
            {m.raw ? (
              m.value
            ) : (
              <span
                style={{
                  color: m.color,
                  fontWeight: 500,
                  fontFamily: m.mono === false ? 'var(--font-sans)' : 'var(--font-mono)',
                }}
              >
                {m.value}
              </span>
            )}
          </span>
          {idx < visible.length - 1 && (
            <span style={{ width: 1, height: 14, background: 'var(--border-default)', flex: 'none' }} />
          )}
        </Fragment>
      ))}
    </div>
  )
}
