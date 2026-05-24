import { useState } from 'react'
import type { DiscoverRun } from '../../lib/types'

interface Props {
  run: DiscoverRun
  activeFilter: string | null
  onFilter: (bucket: string | null) => void
}

const LAYER_ICONS: Record<string, string> = {
  git: '⑂',
  github: '⊙',
  docs: '▤',
  memory: '◈',
  claude: '◎',
}

export function DiscoverHeader({ run, activeFilter, onFilter }: Props) {
  const [sourcesOpen, setSourcesOpen] = useState(false)
  const c = run.counts

  const chips: Array<{ label: string; count: number; key: string }> = [
    { label: 'Strong', count: c.strong, key: 'strong' },
    { label: 'Worth reviewing', count: c.worthReviewing, key: 'worth-reviewing' },
    { label: 'Historical', count: c.historical, key: 'historical' },
    { label: 'Already tracked', count: c.alreadyTracked, key: 'tracked' },
  ]

  return (
    <div style={{ marginBottom: 20 }}>
      <div className="t-eyebrow" style={{ color: 'var(--fg-subtle)', marginBottom: 4, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>
        Proposal
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 10 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Discover</h1>
        <span style={{ fontSize: 12, color: 'var(--fg-subtle)' }}>
          {new Date(run.generatedAt).toLocaleString()}
        </span>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
        {chips.map((chip) => (
          <button
            key={chip.key}
            onClick={() => onFilter(activeFilter === chip.key ? null : chip.key)}
            style={{
              padding: '3px 10px',
              borderRadius: 12,
              fontSize: 12,
              border: '1px solid',
              cursor: 'pointer',
              borderColor: activeFilter === chip.key ? 'var(--accent-emerald)' : 'var(--border-default)',
              background: activeFilter === chip.key ? 'color-mix(in srgb, var(--accent-emerald) 12%, var(--bg-surface))' : 'var(--bg-surface)',
              color: 'var(--fg-default)',
            }}
          >
            {chip.label} ({chip.count})
          </button>
        ))}
      </div>

      <button
        onClick={() => setSourcesOpen(!sourcesOpen)}
        style={{ background: 'none', border: 'none', padding: 0, fontSize: 12, color: 'var(--fg-muted)', cursor: 'pointer' }}
      >
        {sourcesOpen ? '▾' : '▸'} Sources scanned ({run.sourcesSummary.reduce((s, x) => s + x.signalCount, 0)} signals)
      </button>
      {sourcesOpen && (
        <div style={{ marginTop: 6, paddingLeft: 8 }}>
          {run.sourcesSummary.map((s, i) => (
            <div key={i} style={{ fontSize: 12, color: 'var(--fg-muted)', marginBottom: 2 }}>
              <span style={{ marginRight: 6 }}>{LAYER_ICONS[s.layer] ?? '•'}</span>
              <span style={{ fontWeight: 500 }}>{s.layer}</span> — {s.label} ({s.signalCount})
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
