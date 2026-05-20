// PrinciplesPanel + GlossaryPanel + NarrativePanel + LegacySection.

import { useMemo, useState, type ReactNode } from 'react'
import { PhaseCard } from './PhaseCard'
import type { UIPhase } from '../../lib/adapters'

interface PrinciplesProps {
  principles: Array<{ id: string; title: string; body: string }>
}

export function PrinciplesPanel({ principles }: PrinciplesProps) {
  return (
    <div
      style={{
        padding: '14px 16px',
        marginTop: 10,
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-default)',
        borderRadius: 8,
        boxShadow: 'var(--shadow-ambient)',
      }}
    >
      <div className="t-eyebrow" style={{ color: 'var(--fg-muted)', marginBottom: 10 }}>
        PRINCIPLES · {principles.length}
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: 12,
        }}
      >
        {principles.map((p) => (
          <div key={p.id}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                  color: 'var(--fg-subtle)',
                  letterSpacing: '0.04em',
                  minWidth: 24,
                }}
              >
                {p.id}
              </span>
              <span
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: 13,
                  fontWeight: 600,
                  color: 'var(--fg-default)',
                }}
              >
                {p.title}
              </span>
            </div>
            <div
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: 12,
                color: 'var(--fg-muted)',
                marginTop: 4,
                marginLeft: 32,
                lineHeight: 1.5,
              }}
            >
              {p.body}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

interface GlossaryProps {
  glossary: Array<{ term: string; definition: string }>
}

export function GlossaryPanel({ glossary }: GlossaryProps) {
  return (
    <div
      style={{
        padding: '14px 16px',
        marginTop: 10,
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-default)',
        borderRadius: 8,
        boxShadow: 'var(--shadow-ambient)',
      }}
    >
      <div className="t-eyebrow" style={{ color: 'var(--fg-muted)', marginBottom: 10 }}>
        GLOSSARY · {glossary.length}
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '8px 16px',
        }}
      >
        {glossary.map((g) => (
          <div key={g.term} style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
                color: 'var(--status-active)',
                minWidth: 92,
                flex: 'none',
                fontWeight: 500,
              }}
            >
              {g.term}
            </span>
            <span
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: 12,
                color: 'var(--fg-muted)',
                lineHeight: 1.5,
              }}
            >
              {g.definition}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

interface NarrativeProps {
  markdown: string
  expanded: boolean
  onToggleExpanded: () => void
}

interface Block {
  kind: 'h1' | 'h2' | 'p' | 'ol-item' | 'ul-item'
  text: string
}

export function NarrativePanel({ markdown, expanded, onToggleExpanded }: NarrativeProps) {
  const blocks = useMemo<Block[]>(() => {
    const lines = markdown.split('\n')
    const out: Block[] = []
    let buf: string[] = []
    const flushPara = () => {
      if (buf.length) {
        out.push({ kind: 'p', text: buf.join(' ') })
        buf = []
      }
    }
    for (const line of lines) {
      if (/^##\s+/.test(line)) {
        flushPara()
        out.push({ kind: 'h2', text: line.replace(/^##\s+/, '') })
      } else if (/^#\s+/.test(line)) {
        flushPara()
        out.push({ kind: 'h1', text: line.replace(/^#\s+/, '') })
      } else if (/^\d+\.\s+/.test(line)) {
        flushPara()
        out.push({ kind: 'ol-item', text: line.replace(/^\d+\.\s+/, '') })
      } else if (/^-\s+/.test(line)) {
        flushPara()
        out.push({ kind: 'ul-item', text: line.replace(/^-\s+/, '') })
      } else if (line.trim() === '') {
        flushPara()
      } else {
        buf.push(line)
      }
    }
    flushPara()
    return out
  }, [markdown])

  const renderInline = (text: string): ReactNode[] => {
    const parts: ReactNode[] = []
    const re = /(\*\*[^*]+\*\*|`[^`]+`)/g
    let lastIdx = 0
    let m: RegExpExecArray | null
    let i = 0
    while ((m = re.exec(text)) !== null) {
      if (m.index > lastIdx) parts.push(text.slice(lastIdx, m.index))
      const t = m[0]
      if (t.startsWith('**')) {
        parts.push(<strong key={i++}>{t.slice(2, -2)}</strong>)
      } else {
        parts.push(
          <code
            key={i++}
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.92em',
              padding: '1px 5px',
              background: 'var(--bg-canvas)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 3,
              color: 'var(--fg-default)',
            }}
          >
            {t.slice(1, -1)}
          </code>
        )
      }
      lastIdx = m.index + t.length
    }
    if (lastIdx < text.length) parts.push(text.slice(lastIdx))
    return parts
  }

  return (
    <div
      style={{
        marginTop: 12,
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-default)',
        borderRadius: 8,
        boxShadow: 'var(--shadow-ambient)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          maxHeight: expanded ? 'none' : 320,
          overflowY: expanded ? 'visible' : 'auto',
          padding: '16px 20px',
          position: 'relative',
        }}
      >
        {blocks.map((b, i) => {
          if (b.kind === 'h2')
            return (
              <h3
                key={i}
                style={{
                  margin: i === 0 ? '0 0 8px' : '20px 0 8px',
                  fontFamily: 'var(--font-sans)',
                  fontSize: 15,
                  fontWeight: 600,
                  color: 'var(--fg-default)',
                  letterSpacing: '-0.01em',
                }}
              >
                {b.text}
              </h3>
            )
          if (b.kind === 'h1')
            return (
              <h2
                key={i}
                style={{
                  margin: i === 0 ? '0 0 10px' : '24px 0 10px',
                  fontFamily: 'var(--font-sans)',
                  fontSize: 17,
                  fontWeight: 600,
                  color: 'var(--fg-default)',
                }}
              >
                {b.text}
              </h2>
            )
          if (b.kind === 'ol-item')
            return (
              <div
                key={i}
                style={{
                  display: 'flex',
                  gap: 10,
                  fontFamily: 'var(--font-sans)',
                  fontSize: 13,
                  color: 'var(--fg-muted)',
                  lineHeight: 1.6,
                  margin: '4px 0 4px 8px',
                }}
              >
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--status-active)',
                    flex: 'none',
                    minWidth: 18,
                  }}
                >
                  {i + 1}.
                </span>
                <span>{renderInline(b.text)}</span>
              </div>
            )
          if (b.kind === 'ul-item')
            return (
              <div
                key={i}
                style={{
                  display: 'flex',
                  gap: 10,
                  fontFamily: 'var(--font-sans)',
                  fontSize: 13,
                  color: 'var(--fg-muted)',
                  lineHeight: 1.6,
                  margin: '3px 0 3px 8px',
                }}
              >
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--fg-subtle)', flex: 'none' }}>·</span>
                <span>{renderInline(b.text)}</span>
              </div>
            )
          return (
            <p
              key={i}
              style={{
                margin: '8px 0',
                fontFamily: 'var(--font-sans)',
                fontSize: 13.5,
                color: 'var(--fg-muted)',
                lineHeight: 1.65,
              }}
            >
              {renderInline(b.text)}
            </p>
          )
        })}
        {!expanded && (
          <div
            aria-hidden
            style={{
              position: 'sticky',
              bottom: -16,
              left: 0,
              right: 0,
              height: 56,
              marginTop: -56,
              background: 'linear-gradient(to bottom, transparent, var(--bg-surface) 75%)',
              pointerEvents: 'none',
            }}
          />
        )}
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '8px 16px',
          borderTop: '1px solid var(--border-subtle)',
          background: 'color-mix(in srgb, var(--bg-elevated) 50%, transparent)',
        }}
      >
        <button
          onClick={onToggleExpanded}
          style={{
            all: 'unset',
            cursor: 'pointer',
            fontFamily: 'var(--font-sans)',
            fontSize: 12,
            color: 'var(--accent-link)',
          }}
        >
          {expanded ? '▴ show less' : '▾ show more (full narrative)'}
        </button>
        <div style={{ flex: 1 }} />
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            color: 'var(--fg-subtle)',
          }}
        >
          {markdown.length.toLocaleString()} chars · {markdown.split('\n').length} lines
        </span>
      </div>
    </div>
  )
}

interface LegacyProps {
  phases: UIPhase[]
}

export function LegacySection({ phases }: LegacyProps) {
  const [open, setOpen] = useState(false)
  if (!phases || phases.length === 0) return null
  const totalDays = phases.reduce((s, p) => s + (p.durationDays ?? 0), 0)
  return (
    <div style={{ marginTop: 16 }}>
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen((v) => !v)}
        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-surface)')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        style={{
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '8px 10px',
          borderRadius: 6,
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            fontWeight: 600,
            color: 'var(--fg-muted)',
            letterSpacing: '0.08em',
          }}
        >
          {open ? '▾' : '▸'} COMPLETED LEGACY · {phases.length}
        </span>
        <div style={{ display: 'flex', gap: 4 }}>
          {phases.map((p) => (
            <span
              key={p.id}
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                fontWeight: 500,
                color: 'var(--status-done)',
                padding: '1px 6px',
                borderRadius: 999,
                background: 'color-mix(in srgb, var(--status-done) 10%, transparent)',
                border: '1px solid color-mix(in srgb, var(--status-done) 25%, transparent)',
              }}
            >
              ✓ {p.id}
            </span>
          ))}
        </div>
        <div style={{ flex: 1, minWidth: 0, height: 1, background: 'var(--border-subtle)' }} />
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-subtle)' }}>
          {totalDays}d total · pre-F0
        </span>
      </div>
      {open && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
          {phases.map((p) => (
            <PhaseCard key={p.id} phase={p} density="tight" />
          ))}
        </div>
      )}
    </div>
  )
}
