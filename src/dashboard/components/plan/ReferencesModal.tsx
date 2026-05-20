import { useMemo, useState } from 'react'
import type { UIRef } from '../../lib/adapters'

const REF_STATE_META: Record<UIRef['state'], { label: string; color: string; glyph: string; title: string }> = {
  'in-project': {
    label: 'in project',
    color: 'var(--fg-muted)',
    glyph: '·',
    title: 'Present in this repo',
  },
  external: {
    label: 'external',
    color: 'var(--accent-link)',
    glyph: '↗',
    title: 'Path outside this repo — depends on developer machine',
  },
  gitignored: {
    label: 'gitignored',
    color: 'var(--status-blocked)',
    glyph: '⊘',
    title: 'Present in working copy, not committed (PII, dumps, creds)',
  },
}

const REF_KIND_TINT: Record<string, string> = {
  prd: 'var(--accent-link)',
  runbook: 'var(--status-active)',
  adr: 'var(--status-emerged)',
  spec: 'var(--fg-muted)',
  schema: 'var(--status-active)',
  doc: 'var(--fg-muted)',
  repo: 'var(--status-emerged)',
}

interface Props {
  open: boolean
  refs: UIRef[]
  onClose: () => void
}

export function ReferencesModal({ open, refs, onClose }: Props) {
  const [filter, setFilter] = useState<'all' | UIRef['state']>('all')

  const counts = useMemo(() => {
    const c: Record<UIRef['state'], number> = { 'in-project': 0, external: 0, gitignored: 0 }
    refs.forEach((r) => {
      c[r.state] = (c[r.state] ?? 0) + 1
    })
    return c
  }, [refs])

  if (!open) return null

  const filtered = filter === 'all' ? refs : refs.filter((r) => r.state === filter)

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        background: 'color-mix(in srgb, var(--bg-sunken) 80%, transparent)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: 72,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(880px, calc(100vw - 48px))',
          maxHeight: 'calc(100vh - 120px)',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--bg-canvas)',
          border: '1px solid var(--border-default)',
          borderRadius: 10,
          boxShadow: 'var(--shadow-lg)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '14px 18px',
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          <span className="t-eyebrow" style={{ color: 'var(--fg-default)' }}>
            References
          </span>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              color: 'var(--fg-subtle)',
              padding: '2px 8px',
              borderRadius: 999,
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            {refs.length}
          </span>
          <div style={{ flex: 1 }} />
          <button
            onClick={onClose}
            aria-label="Close"
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
            gap: 6,
            padding: '12px 18px',
            borderBottom: '1px solid var(--border-subtle)',
            background: 'var(--bg-surface)',
          }}
        >
          {(
            [
              { id: 'all' as const, label: 'all', count: refs.length, color: 'var(--fg-default)' },
              {
                id: 'in-project' as const,
                label: 'in project',
                count: counts['in-project'],
                color: REF_STATE_META['in-project'].color,
              },
              { id: 'external' as const, label: 'external', count: counts.external, color: REF_STATE_META.external.color },
              { id: 'gitignored' as const, label: 'gitignored', count: counts.gitignored, color: REF_STATE_META.gitignored.color },
            ] as const
          ).map((f) => {
            const isActive = filter === f.id
            return (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                style={{
                  all: 'unset',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  height: 26,
                  padding: '0 12px',
                  background: isActive ? 'var(--bg-elevated)' : 'transparent',
                  color: isActive ? f.color : 'var(--fg-muted)',
                  border: `1px solid ${isActive ? 'var(--border-strong)' : 'var(--border-subtle)'}`,
                  borderRadius: 999,
                  fontFamily: 'var(--font-sans)',
                  fontSize: 12,
                  whiteSpace: 'nowrap',
                }}
              >
                {f.label}
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 10,
                    color: isActive ? f.color : 'var(--fg-subtle)',
                  }}
                >
                  {f.count}
                </span>
              </button>
            )
          })}
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {filtered.length === 0 ? (
            <div style={{ padding: 36, textAlign: 'center', fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--fg-subtle)' }}>
              (empty)
            </div>
          ) : (
            filtered.map((r, i) => <RefRow key={i} r={r} />)
          )}
        </div>

        <div
          style={{
            display: 'flex',
            gap: 18,
            alignItems: 'center',
            flexWrap: 'wrap',
            padding: '10px 18px',
            borderTop: '1px solid var(--border-subtle)',
            background: 'var(--bg-surface)',
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
          }}
        >
          {(Object.entries(REF_STATE_META) as Array<[UIRef['state'], typeof REF_STATE_META[UIRef['state']]]>).map(
            ([k, m]) => (
              <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--fg-subtle)' }}>
                <span style={{ color: m.color, fontSize: 11 }}>{m.glyph}</span>
                <span>{m.label}</span>
                <span style={{ color: 'var(--fg-faint)' }}>· {m.title}</span>
              </span>
            )
          )}
        </div>
      </div>
    </div>
  )
}

function RefRow({ r }: { r: UIRef }) {
  const state = REF_STATE_META[r.state]
  const tint = REF_KIND_TINT[r.kind] ?? 'var(--fg-muted)'
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '78px 88px 1fr auto',
        alignItems: 'center',
        gap: 12,
        padding: '7px 14px',
        borderBottom: '1px solid var(--border-subtle)',
        fontFamily: 'var(--font-mono)',
        fontSize: 12,
      }}
    >
      <span style={{ color: tint, letterSpacing: '0.04em', fontSize: 10, fontWeight: 600 }}>{r.kind}</span>
      <span
        title={state.title}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
          height: 18,
          padding: '0 7px',
          color: state.color,
          background: `color-mix(in srgb, ${state.color} 10%, transparent)`,
          border: `1px solid color-mix(in srgb, ${state.color} 30%, transparent)`,
          borderRadius: 999,
          fontSize: 10,
          fontWeight: 500,
          whiteSpace: 'nowrap',
          justifySelf: 'start',
        }}
      >
        <span style={{ fontSize: 10 }}>{state.glyph}</span>
        {state.label}
      </span>
      <span style={{ color: 'var(--fg-default)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.path}>
        {r.path}
        {r.section && <span style={{ color: 'var(--fg-subtle)' }}> · {r.section}</span>}
      </span>
      <button
        style={{
          all: 'unset',
          cursor: 'pointer',
          color: 'var(--fg-subtle)',
          fontSize: 11,
          padding: '2px 6px',
        }}
        aria-label="Open"
      >
        →
      </button>
    </div>
  )
}
