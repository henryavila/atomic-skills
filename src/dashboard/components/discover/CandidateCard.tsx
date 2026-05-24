import { useState } from 'react'
import type { DiscoverCandidate } from '../../lib/types'
import { ConfidenceBar } from './ConfidenceBar'
import { ActivitySparkline } from './ActivitySparkline'
import { EvidencePill } from './EvidencePill'

type DecisionState = 'approve' | 'reject' | null

interface Props {
  candidate: DiscoverCandidate
  decision: DecisionState
  submittedDecision?: 'approve' | 'reject'
  onDecide: (slug: string, decision: DecisionState) => void
  readOnly: boolean
}

export function CandidateCard({ candidate: c, decision, submittedDecision, onDecide, readOnly }: Props) {
  const [expanded, setExpanded] = useState(false)
  const isHistorical = c.bucket === 'historical'
  const effectiveDecision = submittedDecision ?? decision

  return (
    <div
      style={{
        border: '1px solid var(--border-default)',
        borderRadius: 10,
        padding: '14px 18px',
        marginBottom: 10,
        opacity: isHistorical ? 0.6 : 1,
        background:
          effectiveDecision === 'approve'
            ? 'color-mix(in srgb, var(--accent-emerald) 6%, var(--bg-surface))'
            : effectiveDecision === 'reject'
              ? 'color-mix(in srgb, var(--severity-critical) 6%, var(--bg-surface))'
              : 'var(--bg-surface)',
        borderColor:
          effectiveDecision === 'approve'
            ? 'color-mix(in srgb, var(--accent-emerald) 30%, var(--border-default))'
            : effectiveDecision === 'reject'
              ? 'color-mix(in srgb, var(--severity-critical) 30%, var(--border-default))'
              : 'var(--border-default)',
      }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span
          style={{
            padding: '1px 7px',
            borderRadius: 4,
            fontSize: 10,
            fontWeight: 600,
            textTransform: 'uppercase',
            background: c.kind === 'plan' ? '#c4b5fd' : '#93c5fd',
            color: '#1e1b4b',
          }}
        >
          {c.kind}
        </span>
        <span style={{ fontWeight: 600, fontSize: 15, flex: 1 }}>{c.title}</span>
        {c.branch && (
          <span className="font-mono" style={{ fontSize: 11, color: 'var(--fg-subtle)', background: 'var(--bg-inset)', padding: '1px 6px', borderRadius: 4 }}>
            {c.branch}
          </span>
        )}
        {isHistorical && (
          <span style={{ fontSize: 10, color: 'var(--fg-subtle)', textTransform: 'uppercase' }}>archived</span>
        )}
        {!readOnly && (
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              onClick={() => onDecide(c.slug, decision === 'approve' ? null : 'approve')}
              style={{
                padding: '3px 10px',
                borderRadius: 6,
                border: '1px solid',
                fontSize: 12,
                cursor: 'pointer',
                borderColor: decision === 'approve' ? 'var(--accent-emerald)' : 'var(--border-default)',
                background: decision === 'approve' ? 'var(--accent-emerald)' : 'transparent',
                color: decision === 'approve' ? '#fff' : 'var(--fg-default)',
              }}
            >
              ✓
            </button>
            <button
              onClick={() => onDecide(c.slug, decision === 'reject' ? null : 'reject')}
              style={{
                padding: '3px 10px',
                borderRadius: 6,
                border: '1px solid',
                fontSize: 12,
                cursor: 'pointer',
                borderColor: decision === 'reject' ? 'var(--severity-critical)' : 'var(--border-default)',
                background: decision === 'reject' ? 'var(--severity-critical)' : 'transparent',
                color: decision === 'reject' ? '#fff' : 'var(--fg-default)',
              }}
            >
              ✗
            </button>
          </div>
        )}
        {submittedDecision && (
          <span style={{ fontSize: 11, color: submittedDecision === 'approve' ? 'var(--accent-emerald)' : 'var(--severity-critical)' }}>
            {submittedDecision === 'approve' ? '✓ approved' : '✗ rejected'}
          </span>
        )}
      </div>

      {/* Goal */}
      <p style={{ margin: '0 0 8px', color: 'var(--fg-muted)', fontSize: 13 }}>{c.goal}</p>

      {/* Metadata row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 8 }}>
        <div style={{ flex: 1, maxWidth: 200 }}>
          <ConfidenceBar breakdown={c.confidenceBreakdown} confidence={c.confidence} />
        </div>
        <ActivitySparkline timeline={c.activityTimeline} />
        <span className="font-mono" style={{ fontSize: 11, color: 'var(--fg-subtle)' }}>{c.slug}</span>
      </div>

      {/* Evidence pills */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
        {c.evidence.map((e, i) => (
          <EvidencePill key={i} evidence={e} />
        ))}
      </div>

      {/* Historical completion summary */}
      {isHistorical && c.completionSummary && (
        <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--fg-subtle)', fontStyle: 'italic' }}>
          {c.completionSummary}
        </p>
      )}

      {/* Expandable details */}
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          background: 'none',
          border: 'none',
          padding: 0,
          fontSize: 11,
          color: 'var(--fg-muted)',
          cursor: 'pointer',
          marginTop: 4,
        }}
      >
        {expanded ? '▾ Hide details' : '▸ Details'}
      </button>
      {expanded && (
        <div style={{ marginTop: 8, fontSize: 13, color: 'var(--fg-muted)' }}>
          <p style={{ margin: '0 0 6px', fontStyle: 'italic' }}>{c.rationale}</p>
          <div style={{ whiteSpace: 'pre-wrap', marginBottom: 8 }}>{c.contextMarkdown}</div>
          <details>
            <summary style={{ fontSize: 11, cursor: 'pointer' }}>Preview YAML</summary>
            <pre className="font-mono" style={{ fontSize: 11, background: 'var(--bg-inset)', padding: 8, borderRadius: 6, overflow: 'auto' }}>
              {c.previewYaml}
            </pre>
          </details>
        </div>
      )}
    </div>
  )
}
