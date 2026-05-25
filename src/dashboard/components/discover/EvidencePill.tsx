import type { DiscoverEvidence } from '../../lib/types'
import { SOURCE_TYPES } from './constants'

interface Props {
  evidence: DiscoverEvidence
}

export function EvidencePill({ evidence: ev }: Props) {
  const s = SOURCE_TYPES[ev.sourceType] || { glyph: '·', color: 'var(--fg-muted)', label: ev.sourceType }
  const isMerged = !!ev.merged
  const isDone = ev.candidateCompletion === 'done'

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        height: 22,
        padding: '0 8px 0 7px',
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        color: 'var(--fg-default)',
        background: `color-mix(in srgb, ${s.color} 8%, var(--bg-sunken))`,
        border: `1px ${isMerged ? 'dashed' : 'solid'} color-mix(in srgb, ${s.color} ${isMerged ? 50 : 28}%, transparent)`,
        borderRadius: 3,
        cursor: 'help',
        maxWidth: 280,
        opacity: isDone ? 0.7 : 1,
      }}
      title={`${ev.sourceType} · ${ev.sourceId}\n"${ev.evidenceQuote}"${isMerged ? '\n\n↳ merged' : ''}`}
    >
      <span style={{ color: s.color, fontWeight: 600, lineHeight: 1, minWidth: 12, textAlign: 'center' }}>
        {s.glyph}
      </span>
      <span
        style={{
          color: 'var(--fg-default)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          maxWidth: 220,
        }}
      >
        {ev.sourceId}
      </span>
      {isMerged && <span style={{ color: 'var(--fg-faint)', fontSize: 9 }}>⤳</span>}
    </span>
  )
}
