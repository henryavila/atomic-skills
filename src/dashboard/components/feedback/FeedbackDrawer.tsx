// Faithful port of FeedbackDrawer.jsx — right-side drawer with both
// highlights and annotations, grouped by target, severity/author filters.

import { Fragment, useEffect, useMemo, useState } from 'react'
import { FeedbackAuthorChip, LiveDot, MarkdownLite, SeverityChip, TargetCrumb, type EntityTitleMap, type TargetEntity } from './Atoms'

type Severity = 'info' | 'warn' | 'critical'

export interface HighlightItem {
  id: string
  kind: 'highlight'
  target: TargetEntity
  author: 'human' | 'ai'
  severity: Severity
  reason: string
  createdAt: string
  createdAtSort?: number
  acknowledged?: boolean
  acknowledgement?: { author: 'human' | 'ai'; createdAt: string; body: string } | null
}

export interface AnnotationFeedItem {
  id: string
  kind: 'annotation'
  target: TargetEntity
  author: 'human' | 'ai'
  body: string
  createdAt: string
  createdAtSort?: number
  resolved?: boolean
  resolution?: { author: 'human' | 'ai'; createdAt: string; body: string } | null
  replies?: Array<{ id: string; author: 'human' | 'ai'; createdAt: string; body: string }>
}

export type FeedbackItem = HighlightItem | AnnotationFeedItem

interface FilterPillProps {
  selected: boolean
  tint: string
  label: string
  n?: number | null
  onClick: () => void
}

function FilterPill({ selected, tint, label, n, onClick }: FilterPillProps) {
  return (
    <button
      onClick={onClick}
      style={{
        all: 'unset',
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        height: 22,
        padding: '0 10px',
        background: selected ? 'var(--bg-elevated)' : 'transparent',
        color: selected ? tint : 'var(--fg-muted)',
        border: `1px solid ${selected ? 'var(--border-strong)' : 'var(--border-subtle)'}`,
        borderRadius: 999,
        fontFamily: 'var(--font-sans)',
        fontSize: 11,
        transition: 'all 120ms var(--ease-out)',
      }}
    >
      {label}
      {n != null && (
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 9,
            fontWeight: 600,
            color: selected ? tint : 'var(--fg-subtle)',
          }}
        >
          {n}
        </span>
      )}
    </button>
  )
}

function HighlightRow({
  h,
  onAcknowledge,
  onJump,
  entityTitles,
}: {
  h: HighlightItem
  onAcknowledge: (id: string) => void
  onJump: (target: TargetEntity) => void
  entityTitles: EntityTitleMap
}) {
  const ack = Boolean(h.acknowledged)
  const sevColor =
    h.severity === 'critical' ? 'var(--severity-critical)' : h.severity === 'warn' ? 'var(--severity-warn)' : 'var(--severity-info)'
  return (
    <div
      style={{
        position: 'relative',
        padding: '12px 14px',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        opacity: ack ? 0.55 : 1,
        transition: 'background 600ms var(--ease-out), opacity 140ms',
      }}
    >
      <span
        aria-hidden
        style={{
          position: 'absolute',
          left: 0,
          top: 8,
          bottom: 8,
          width: 2,
          background: ack ? 'var(--border-subtle)' : sevColor,
          borderRadius: 2,
        }}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <SeverityChip severity={h.severity} strong={!ack} />
        <FeedbackAuthorChip author={h.author} />
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-subtle)' }}>{h.createdAt}</span>
        {ack && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 3,
              height: 16,
              padding: '0 7px',
              borderRadius: 999,
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              fontWeight: 600,
              color: 'var(--status-done)',
              background: 'var(--status-done-bg)',
              border: '1px solid color-mix(in srgb, var(--status-done) 35%, transparent)',
              lineHeight: 1,
            }}
          >
            ✓ acked
          </span>
        )}
      </div>
      <TargetCrumb target={h.target} entityTitles={entityTitles} onJump={onJump} />
      <div
        style={{
          fontFamily: 'var(--font-sans)',
          fontSize: 13,
          color: 'var(--fg-default)',
          lineHeight: 1.5,
          ...(ack ? { textDecoration: 'line-through', textDecorationColor: 'var(--fg-faint)' } : {}),
        }}
      >
        {h.reason}
      </div>
      {h.acknowledgement && (
        <div style={{ marginTop: 2, paddingLeft: 10, borderLeft: '2px solid var(--status-done)', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600, color: 'var(--status-done)', letterSpacing: '0.06em' }}>
              ACKNOWLEDGEMENT
            </span>
            <FeedbackAuthorChip author={h.acknowledgement.author} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-subtle)' }}>{h.acknowledgement.createdAt}</span>
          </div>
          <div style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--fg-muted)', lineHeight: 1.5 }}>
            {h.acknowledgement.body}
          </div>
        </div>
      )}
      {!ack && (
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            onClick={() => onAcknowledge(h.id)}
            style={{
              all: 'unset',
              cursor: 'pointer',
              height: 22,
              padding: '0 10px',
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              fontWeight: 600,
              color: sevColor,
              border: `1px solid color-mix(in srgb, ${sevColor} 45%, transparent)`,
              background: `color-mix(in srgb, ${sevColor} 8%, transparent)`,
              borderRadius: 4,
            }}
          >
            [Acknowledge]
          </button>
          <button
            onClick={() => onJump(h.target)}
            style={{
              all: 'unset',
              cursor: 'pointer',
              height: 22,
              padding: '0 8px',
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              color: 'var(--fg-subtle)',
              border: '1px solid transparent',
              borderRadius: 4,
            }}
          >
            ↗ go to
          </button>
        </div>
      )}
    </div>
  )
}

function AnnotationRow({
  a,
  onResolve,
  onJump,
  entityTitles,
}: {
  a: AnnotationFeedItem
  onResolve: (id: string) => void
  onJump: (target: TargetEntity) => void
  entityTitles: EntityTitleMap
}) {
  const [threadOpen, setThreadOpen] = useState(true)
  const resolved = Boolean(a.resolved)
  return (
    <div
      style={{
        padding: '14px 14px',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        opacity: resolved ? 0.6 : 1,
        transition: 'background 600ms var(--ease-out), opacity 140ms',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <FeedbackAuthorChip author={a.author} />
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-subtle)' }}>{a.createdAt}</span>
        {resolved && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 3,
              height: 16,
              padding: '0 7px',
              borderRadius: 999,
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              fontWeight: 600,
              color: 'var(--status-done)',
              background: 'var(--status-done-bg)',
              border: '1px solid color-mix(in srgb, var(--status-done) 35%, transparent)',
              lineHeight: 1,
            }}
          >
            ✓ resolved
          </span>
        )}
      </div>
      <TargetCrumb target={a.target} entityTitles={entityTitles} onJump={onJump} />
      <div style={{ borderLeft: '2px solid var(--border-strong)', paddingLeft: 10, ...(resolved ? { opacity: 0.7 } : {}) }}>
        <MarkdownLite src={a.body} dim={resolved} />
      </div>
      {a.replies && a.replies.length > 0 && (
        <div style={{ marginLeft: 12 }}>
          <button
            onClick={() => setThreadOpen((v) => !v)}
            style={{
              all: 'unset',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              fontWeight: 600,
              color: 'var(--fg-muted)',
              letterSpacing: '0.04em',
              padding: '2px 0',
              marginBottom: threadOpen ? 8 : 0,
            }}
          >
            <span style={{ color: 'var(--fg-subtle)' }}>{threadOpen ? '▾' : '▸'}</span>
            {a.replies.length} {a.replies.length === 1 ? 'reply' : 'replies'}
          </button>
          {threadOpen && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingLeft: 10, borderLeft: '1px dashed var(--border-subtle)' }}>
              {a.replies.map((r) => (
                <div
                  key={r.id}
                  style={{
                    padding: '8px 10px',
                    background: 'var(--bg-canvas)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 6,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <FeedbackAuthorChip author={r.author} />
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-subtle)' }}>{r.createdAt}</span>
                  </div>
                  <div style={{ fontFamily: 'var(--font-sans)', fontSize: 12.5, color: 'var(--fg-default)', lineHeight: 1.55 }}>{r.body}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {a.resolution && (
        <div style={{ marginLeft: 12, paddingLeft: 10, borderLeft: '2px solid var(--status-done)', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600, color: 'var(--status-done)', letterSpacing: '0.06em' }}>
              RESOLUTION
            </span>
            <FeedbackAuthorChip author={a.resolution.author} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-subtle)' }}>{a.resolution.createdAt}</span>
          </div>
          <div style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--fg-muted)', lineHeight: 1.5 }}>{a.resolution.body}</div>
        </div>
      )}
      <div style={{ display: 'flex', gap: 4 }}>
        <button
          onClick={() => onResolve(a.id)}
          style={{
            all: 'unset',
            cursor: 'pointer',
            height: 22,
            padding: '0 10px',
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            fontWeight: 500,
            color: resolved ? 'var(--fg-muted)' : 'var(--accent-link)',
            border: `1px solid ${resolved ? 'var(--border-subtle)' : 'var(--border-default)'}`,
            borderRadius: 4,
          }}
        >
          [{resolved ? 'Reopen' : 'Mark resolved'}]
        </button>
        <button
          onClick={() => onJump(a.target)}
          style={{
            all: 'unset',
            cursor: 'pointer',
            height: 22,
            padding: '0 8px',
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'var(--fg-subtle)',
            border: '1px solid transparent',
            borderRadius: 4,
          }}
        >
          ↗ go to
        </button>
      </div>
    </div>
  )
}

interface Props {
  open: boolean
  onClose: () => void
  items?: FeedbackItem[]
  entityTitles?: EntityTitleMap
  liveStream?: boolean
  onToggleLive?: () => void
}

export function FeedbackDrawer({
  open,
  onClose,
  items = [],
  entityTitles = {},
  liveStream = true,
  onToggleLive,
}: Props) {
  const [kindFilter, setKindFilter] = useState<'all' | 'highlights' | 'annotations'>('all')
  const [sevFilter, setSevFilter] = useState<'any' | Severity>('any')
  const [authorFilter, setAuthorFilter] = useState<'any' | 'human' | 'ai'>('any')
  const [localItems, setLocalItems] = useState<FeedbackItem[]>(items)

  useEffect(() => {
    setLocalItems(items)
  }, [items])

  useEffect(() => {
    if (!open) return
    const fn = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [open, onClose])

  const counts = useMemo(() => {
    const c = {
      all: 0,
      highlights: 0,
      annotations: 0,
      critical: 0,
      warn: 0,
      info: 0,
      human: 0,
      ai: 0,
      resolved: 0,
    }
    for (const it of localItems) {
      const isClosed =
        (it.kind === 'annotation' && it.resolved) || (it.kind === 'highlight' && it.acknowledged)
      c.all++
      if (it.kind === 'highlight') {
        c.highlights++
        c[it.severity]++
      }
      if (it.kind === 'annotation') c.annotations++
      if (it.author === 'human') c.human++
      if (it.author === 'ai') c.ai++
      if (isClosed) c.resolved++
    }
    return c
  }, [localItems])

  const filtered = useMemo(() => {
    return localItems.filter((it) => {
      if (kindFilter === 'highlights' && it.kind !== 'highlight') return false
      if (kindFilter === 'annotations' && it.kind !== 'annotation') return false
      if (kindFilter === 'highlights' && sevFilter !== 'any' && it.kind === 'highlight' && it.severity !== sevFilter)
        return false
      if (authorFilter !== 'any' && it.author !== authorFilter) return false
      return true
    })
  }, [localItems, kindFilter, sevFilter, authorFilter])

  const onResolve = (id: string) => {
    setLocalItems((prev) =>
      prev.map((it) =>
        it.id === id && it.kind === 'annotation'
          ? { ...it, resolved: !it.resolved, resolution: !it.resolved ? { author: 'human', createdAt: 'just now', body: 'Marked resolved from the drawer.' } : null }
          : it
      )
    )
  }
  const onAcknowledge = (id: string) => {
    setLocalItems((prev) =>
      prev.map((it) =>
        it.id === id && it.kind === 'highlight'
          ? { ...it, acknowledged: !it.acknowledged, acknowledgement: !it.acknowledged ? { author: 'human', createdAt: 'just now', body: 'Acknowledged from the drawer.' } : null }
          : it
      )
    )
  }
  const onJump = () => {
    /* v0.1: stub — would scroll/highlight target in the main view */
  }

  if (!open) return null
  return (
    <aside
      aria-label="Feedback drawer"
      style={{
        width: 420,
        flex: 'none',
        background: 'var(--bg-canvas)',
        borderLeft: '1px solid var(--border-default)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '12px 14px',
          borderBottom: '1px solid var(--border-default)',
          background: 'var(--bg-surface)',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 13,
            fontWeight: 600,
            letterSpacing: '0.04em',
            color: 'var(--fg-default)',
            textTransform: 'uppercase',
          }}
        >
          Feedback
        </span>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'var(--fg-subtle)',
            padding: '1px 7px',
            borderRadius: 999,
            background: 'var(--bg-canvas)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          {counts.all}
        </span>
        <div style={{ flex: 1 }} />
        {onToggleLive && (
          <button
            onClick={onToggleLive}
            title={liveStream ? 'Pause live updates' : 'Resume live updates'}
            style={{
              all: 'unset',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              height: 22,
              padding: '0 8px',
              borderRadius: 999,
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              fontWeight: 600,
              color: liveStream ? 'var(--status-done)' : 'var(--fg-muted)',
              border: `1px solid ${liveStream ? 'color-mix(in srgb, var(--status-done) 40%, transparent)' : 'var(--border-subtle)'}`,
              background: liveStream ? 'color-mix(in srgb, var(--status-done) 8%, transparent)' : 'transparent',
            }}
          >
            <LiveDot live={liveStream} />
            {liveStream ? 'LIVE' : 'PAUSED'}
          </button>
        )}
        <button
          onClick={onClose}
          aria-label="Close drawer"
          title="Close (Esc)"
          style={{
            all: 'unset',
            cursor: 'pointer',
            color: 'var(--fg-muted)',
            fontFamily: 'var(--font-mono)',
            fontSize: 18,
            padding: '0 4px',
          }}
        >
          ×
        </button>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          padding: '8px 14px',
          borderBottom: '1px solid var(--border-subtle)',
          background: 'var(--bg-canvas)',
        }}
      >
        {(
          [
            { id: 'all' as const, label: 'all', n: counts.all, tint: 'var(--fg-default)' },
            { id: 'highlights' as const, label: 'highlights', n: counts.highlights, tint: 'var(--severity-warn)' },
            { id: 'annotations' as const, label: 'annotations', n: counts.annotations, tint: 'var(--accent-link)' },
          ] as const
        ).map((t) => (
          <FilterPill key={t.id} selected={kindFilter === t.id} tint={t.tint} label={t.label} n={t.n} onClick={() => setKindFilter(t.id)} />
        ))}
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          flexWrap: 'wrap',
          padding: '8px 14px',
          borderBottom: '1px solid var(--border-subtle)',
          background: 'var(--bg-surface)',
        }}
      >
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 600, color: 'var(--fg-faint)', letterSpacing: '0.06em', marginRight: 4 }}>
          AUTHOR
        </span>
        {(
          [
            { id: 'any' as const, label: 'any', tint: 'var(--fg-default)' },
            { id: 'human' as const, label: 'human', tint: 'var(--status-active)' },
            { id: 'ai' as const, label: 'ai', tint: 'var(--status-emerged)' },
          ] as const
        ).map((f) => (
          <FilterPill
            key={f.id}
            selected={authorFilter === f.id}
            tint={f.tint}
            label={f.label}
            n={f.id === 'any' ? null : f.id === 'human' ? counts.human : counts.ai}
            onClick={() => setAuthorFilter(f.id)}
          />
        ))}
        {kindFilter === 'highlights' && (
          <Fragment>
            <span style={{ width: 1, height: 14, background: 'var(--border-subtle)', margin: '0 4px' }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 600, color: 'var(--fg-faint)', letterSpacing: '0.06em', marginRight: 4 }}>
              SEV
            </span>
            {(
              [
                { id: 'any' as const, label: 'any', tint: 'var(--fg-default)', n: null },
                { id: 'critical' as const, label: 'critical', tint: 'var(--severity-critical)', n: counts.critical },
                { id: 'warn' as const, label: 'warn', tint: 'var(--severity-warn)', n: counts.warn },
                { id: 'info' as const, label: 'info', tint: 'var(--severity-info)', n: counts.info },
              ] as const
            ).map((f) => (
              <FilterPill key={f.id} selected={sevFilter === f.id} tint={f.tint} label={f.label} n={f.n} onClick={() => setSevFilter(f.id)} />
            ))}
          </Fragment>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', position: 'relative' }}>
        {filtered.length === 0 ? (
          <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--fg-subtle)' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--fg-muted)', marginBottom: 6 }}>(empty)</div>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: 12 }}>
              No {kindFilter === 'all' ? 'feedback' : kindFilter} match this filter.
            </div>
          </div>
        ) : (
          filtered.map((it) =>
            it.kind === 'highlight' ? (
              <HighlightRow key={it.id} h={it} onAcknowledge={onAcknowledge} onJump={onJump} entityTitles={entityTitles} />
            ) : (
              <AnnotationRow key={it.id} a={it} onResolve={onResolve} onJump={onJump} entityTitles={entityTitles} />
            )
          )
        )}
      </div>

      <div
        style={{
          padding: '8px 14px',
          borderTop: '1px solid var(--border-subtle)',
          background: 'var(--bg-surface)',
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          color: 'var(--fg-subtle)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <LiveDot live={liveStream} />
        <span>{liveStream ? 'SSE channel open · MCP writes land here' : 'Live updates paused'}</span>
      </div>
    </aside>
  )
}
