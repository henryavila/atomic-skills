// Feedback drawer atoms — InlineBadge, FeedbackAuthorChip, SeverityChip,
// MarkdownLite, TargetCrumb, LiveDot. Used by both AnnotationPanel and
// FeedbackDrawer.

import { Fragment, useMemo, type ReactNode } from 'react'

type Severity = 'info' | 'warn' | 'critical'

const SEV: Record<Severity, { color: string; bg: string; glyph: string; label: string }> = {
  info: { color: 'var(--severity-info)', bg: 'var(--severity-info-bg)', glyph: 'ⓘ', label: 'info' },
  warn: { color: 'var(--severity-warn)', bg: 'var(--severity-warn-bg)', glyph: '⚠', label: 'warn' },
  critical: { color: 'var(--severity-critical)', bg: 'var(--severity-critical-bg)', glyph: '⚑', label: 'critical' },
}

export interface TargetEntity {
  slug: string
  path: string
  orphan?: boolean
}

export interface EntityTitleMap {
  [path: string]: { label: string; kind?: 'phase' | 'task' | 'gate' | 'entity'; orphan?: boolean }
}

interface InlineBadgeProps {
  rollup: { count: number; maxSeverity?: Severity; firstReason?: string }
  variant?: 'whisper' | 'standard' | 'loud'
  onClick?: () => void
}

export function InlineBadge({ rollup, variant = 'standard', onClick }: InlineBadgeProps) {
  if (!rollup || rollup.count === 0) return null
  const sev = rollup.maxSeverity
  const color = sev ? SEV[sev].color : 'var(--status-highlighted)'
  const title =
    rollup.count === 1
      ? rollup.firstReason
      : `${rollup.count} items — click to filter the drawer to this target`

  if (variant === 'whisper') {
    return (
      <button
        onClick={(e) => {
          e.stopPropagation()
          onClick?.()
        }}
        title={title}
        style={{
          all: 'unset',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          height: 16,
          padding: '0 4px',
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          fontWeight: 600,
          color,
        }}
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: color,
            boxShadow: `0 0 6px color-mix(in srgb, ${color} 60%, transparent)`,
          }}
        />
        {rollup.count}
      </button>
    )
  }
  if (variant === 'loud') {
    return (
      <button
        onClick={(e) => {
          e.stopPropagation()
          onClick?.()
        }}
        title={title}
        style={{
          all: 'unset',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          maxWidth: 360,
          height: 18,
          padding: '0 8px',
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          fontWeight: 600,
          color,
          background: `color-mix(in srgb, ${color} 12%, transparent)`,
          border: `1px solid color-mix(in srgb, ${color} 38%, transparent)`,
          borderRadius: 999,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
        }}
      >
        <span style={{ fontSize: 10 }}>⚑</span>
        {rollup.count}
        <span
          style={{
            color: 'var(--fg-muted)',
            fontWeight: 500,
            textOverflow: 'ellipsis',
            overflow: 'hidden',
            whiteSpace: 'nowrap',
            maxWidth: 280,
          }}
        >
          · {(rollup.firstReason ?? '').split('\n')[0]}
        </span>
      </button>
    )
  }
  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        onClick?.()
      }}
      title={title}
      style={{
        all: 'unset',
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 3,
        height: 16,
        padding: '0 6px',
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        fontWeight: 600,
        color,
        background: `color-mix(in srgb, ${color} 14%, transparent)`,
        border: `1px solid color-mix(in srgb, ${color} 38%, transparent)`,
        borderRadius: 999,
      }}
    >
      <span style={{ fontSize: 10 }}>⚑</span>
      {rollup.count}
    </button>
  )
}

export function FeedbackAuthorChip({ author, size = 'sm' }: { author: 'human' | 'ai'; size?: 'sm' | 'md' }) {
  const isAi = author === 'ai'
  const color = isAi ? 'var(--status-emerged)' : 'var(--status-active)'
  const bg = isAi ? 'var(--status-emerged-bg)' : 'var(--status-active-bg)'
  const h = size === 'sm' ? 16 : 18
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        height: h,
        padding: '0 7px',
        borderRadius: 999,
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        fontWeight: 600,
        color,
        background: bg,
        border: `1px solid color-mix(in srgb, ${color} 35%, transparent)`,
        whiteSpace: 'nowrap',
        lineHeight: 1,
      }}
    >
      <span style={{ fontSize: 9 }}>{isAi ? '⌬' : '◉'}</span>
      {author}
    </span>
  )
}

export function SeverityChip({ severity, strong = false }: { severity: Severity; strong?: boolean }) {
  const s = SEV[severity]
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        height: 16,
        padding: '0 7px',
        borderRadius: 999,
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        fontWeight: 600,
        color: s.color,
        background: strong ? `color-mix(in srgb, ${s.color} 22%, transparent)` : s.bg,
        border: `1px solid color-mix(in srgb, ${s.color} ${strong ? 55 : 35}%, transparent)`,
        whiteSpace: 'nowrap',
        lineHeight: 1,
      }}
    >
      <span style={{ fontSize: 10 }}>{s.glyph}</span>
      {s.label}
    </span>
  )
}

interface MarkdownLiteProps {
  src: string
  dim?: boolean
}

export function MarkdownLite({ src, dim = false }: MarkdownLiteProps) {
  const blocks = useMemo(() => {
    const parts: Array<{ kind: 'code' | 'prose'; lang?: string; body: string }> = []
    const lines = (src || '').split('\n')
    let i = 0
    while (i < lines.length) {
      const line = lines[i]
      const fence = line.match(/^```(\w*)\s*$/)
      if (fence) {
        const lang = fence[1] || ''
        const body: string[] = []
        i++
        while (i < lines.length && !lines[i].match(/^```\s*$/)) {
          body.push(lines[i])
          i++
        }
        i++
        parts.push({ kind: 'code', lang, body: body.join('\n') })
        continue
      }
      const run: string[] = []
      while (i < lines.length && !lines[i].match(/^```/)) {
        run.push(lines[i])
        i++
      }
      parts.push({ kind: 'prose', body: run.join('\n') })
    }
    return parts
  }, [src])

  const renderInline = (text: string): ReactNode[] => {
    const tokens: Array<{ kind: 'text' | 'code' | 'bold'; value: string }> = []
    const re = /(`[^`]+`|\*\*[^*]+\*\*)/g
    let last = 0
    let m: RegExpExecArray | null
    while ((m = re.exec(text)) !== null) {
      if (m.index > last) tokens.push({ kind: 'text', value: text.slice(last, m.index) })
      const v = m[0]
      if (v.startsWith('`')) tokens.push({ kind: 'code', value: v.slice(1, -1) })
      else tokens.push({ kind: 'bold', value: v.slice(2, -2) })
      last = m.index + v.length
    }
    if (last < text.length) tokens.push({ kind: 'text', value: text.slice(last) })
    return tokens.map((t, k) => {
      if (t.kind === 'code')
        return (
          <code
            key={k}
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              padding: '1px 5px',
              borderRadius: 4,
              background: 'var(--bg-sunken)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--accent-link)',
            }}
          >
            {t.value}
          </code>
        )
      if (t.kind === 'bold')
        return (
          <strong key={k} style={{ fontWeight: 600, color: 'var(--fg-default)' }}>
            {t.value}
          </strong>
        )
      return <Fragment key={k}>{t.value}</Fragment>
    })
  }

  const renderProse = (text: string, idx: number) => {
    const ls = text.split('\n')
    return (
      <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {ls.map((line, li) => {
          if (line.trim() === '') return <div key={li} style={{ height: 4 }} />
          const m = line.match(/^\s*[-*]\s+(.*)$/)
          if (m)
            return (
              <div key={li} style={{ display: 'flex', gap: 8, paddingLeft: 4 }}>
                <span style={{ color: 'var(--fg-faint)', flex: 'none' }}>·</span>
                <span>{renderInline(m[1])}</span>
              </div>
            )
          return <div key={li}>{renderInline(line)}</div>
        })}
      </div>
    )
  }

  return (
    <div
      style={{
        fontFamily: 'var(--font-sans)',
        fontSize: 13,
        color: dim ? 'var(--fg-muted)' : 'var(--fg-default)',
        lineHeight: 1.55,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      {blocks.map((b, k) =>
        b.kind === 'code' ? (
          <pre
            key={k}
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              lineHeight: 1.55,
              padding: '10px 12px',
              margin: 0,
              background: 'var(--bg-sunken)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 6,
              color: 'var(--fg-default)',
              overflowX: 'auto',
              position: 'relative',
            }}
          >
            {b.lang && (
              <span
                style={{
                  position: 'absolute',
                  top: 6,
                  right: 8,
                  fontFamily: 'var(--font-mono)',
                  fontSize: 9,
                  fontWeight: 600,
                  color: 'var(--fg-faint)',
                  letterSpacing: '0.06em',
                }}
              >
                {b.lang}
              </span>
            )}
            <code>{b.body}</code>
          </pre>
        ) : (
          renderProse(b.body, k)
        )
      )}
    </div>
  )
}

interface TargetCrumbProps {
  target: TargetEntity
  entityTitles?: EntityTitleMap
  onJump?: (target: TargetEntity) => void
  compact?: boolean
}

export function TargetCrumb({ target, entityTitles = {}, onJump, compact = false }: TargetCrumbProps) {
  const meta = entityTitles[target.path] ?? { label: target.path, kind: 'entity' as const }
  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        onJump?.(target)
      }}
      title={meta.orphan ? `${meta.label} — target deleted` : `Jump to ${meta.label}`}
      style={{
        all: 'unset',
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        color: 'var(--fg-subtle)',
        lineHeight: 1.3,
        flexWrap: 'wrap',
      }}
    >
      {!compact && <span style={{ color: 'var(--fg-faint)' }}>►</span>}
      <span
        style={{
          color: meta.orphan ? 'var(--fg-faint)' : 'var(--accent-link)',
          textDecoration: meta.orphan ? 'line-through' : 'none',
        }}
      >
        {target.slug}
      </span>
      <span style={{ color: 'var(--fg-faint)' }}>/</span>
      <span
        style={{
          color: meta.orphan ? 'var(--fg-faint)' : 'var(--fg-muted)',
          textDecoration: meta.orphan ? 'line-through' : 'none',
        }}
      >
        {target.path}
      </span>
      {meta.orphan && (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 3,
            height: 14,
            padding: '0 5px',
            borderRadius: 3,
            fontFamily: 'var(--font-mono)',
            fontSize: 9,
            fontWeight: 600,
            color: 'var(--severity-warn)',
            background: 'color-mix(in srgb, var(--severity-warn) 12%, transparent)',
            border: '1px solid color-mix(in srgb, var(--severity-warn) 38%, transparent)',
            marginLeft: 4,
            lineHeight: 1,
          }}
        >
          ⌧ orphan
        </span>
      )}
    </button>
  )
}

export function LiveDot({ live }: { live: boolean }) {
  return (
    <span
      style={{
        position: 'relative',
        display: 'inline-flex',
        width: 8,
        height: 8,
        flex: 'none',
      }}
      aria-label={live ? 'live' : 'paused'}
    >
      <span
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          background: live ? 'var(--status-done)' : 'var(--fg-faint)',
          boxShadow: live ? '0 0 8px color-mix(in srgb, var(--status-done) 70%, transparent)' : 'none',
        }}
      />
      {live && (
        <span
          style={{
            position: 'absolute',
            inset: -3,
            borderRadius: '50%',
            background: 'color-mix(in srgb, var(--status-done) 40%, transparent)',
            animation: 'atomic-pulse 2.4s ease-out infinite',
          }}
        />
      )}
    </span>
  )
}
