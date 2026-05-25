import { useState } from 'react'
import type { DiscoverCandidate, DiscoverEvidence, DiscoverRelationship } from '../../lib/types'
import { ConfidenceBar } from './ConfidenceBar'
import { ActivitySparkline } from './ActivitySparkline'
import { EvidencePill } from './EvidencePill'
import { BUCKETS, SOURCE_TYPES, RELATIONSHIP_KINDS, fmtRelativeDays } from './constants'

type DecisionState = 'approve' | 'reject' | null

interface Props {
  candidate: DiscoverCandidate
  anchorDate: string
  decision: DecisionState
  submittedDecision?: 'approve' | 'reject'
  onDecide: (slug: string, decision: DecisionState) => void
  readOnly: boolean
  relations: Array<DiscoverRelationship & { otherSlug: string }>
  defaultExpanded?: boolean
}

function ShapeBadge({ kind }: { kind: 'plan' | 'initiative' }) {
  const isPlan = kind === 'plan'
  const color = isPlan ? 'var(--status-emerged)' : 'var(--status-active)'
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: 22,
        padding: '0 8px',
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: '0.08em',
        color,
        background: `color-mix(in srgb, ${color} 12%, transparent)`,
        border: `1px solid color-mix(in srgb, ${color} 38%, transparent)`,
        borderRadius: 3,
        flex: 'none',
      }}
      title={isPlan ? 'Multi-phase plan' : 'Standalone initiative'}
    >
      <span style={{ marginRight: 6, fontSize: 11, opacity: 0.9 }}>{isPlan ? '◆' : '◉'}</span>
      {isPlan ? 'PLAN' : 'INIT'}
    </span>
  )
}

function BranchPill({ branch }: { branch: string }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        height: 20,
        padding: '0 8px',
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        color: 'var(--fg-muted)',
        background: 'var(--bg-sunken)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 3,
        flex: 'none',
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ color: 'var(--status-active)' }}>⎏</span>
      <span style={{ color: 'var(--fg-default)' }}>{branch}</span>
    </span>
  )
}

function DetailsTab({
  active,
  count,
  label,
  glyph,
  onClick,
}: {
  active: boolean
  count?: number | null
  label: string
  glyph: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      style={{
        all: 'unset',
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 7,
        height: 30,
        padding: '0 14px',
        fontFamily: 'var(--font-sans)',
        fontSize: 12.5,
        fontWeight: active ? 600 : 500,
        color: active ? 'var(--fg-default)' : 'var(--fg-muted)',
        background: active ? 'var(--bg-surface)' : 'transparent',
        borderBottom: active ? '2px solid var(--status-active)' : '2px solid transparent',
        marginBottom: -1,
        transition: 'color 120ms, background 120ms',
        whiteSpace: 'nowrap',
        flex: 'none',
      }}
    >
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 12,
          color: active ? 'var(--status-active)' : 'var(--fg-faint)',
        }}
      >
        {glyph}
      </span>
      <span>{label}</span>
      {count != null && (
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10.5,
            fontWeight: 600,
            padding: '1px 6px',
            borderRadius: 999,
            minWidth: 16,
            textAlign: 'center',
            color: active ? 'var(--fg-default)' : 'var(--fg-subtle)',
            background: active ? 'var(--bg-elevated)' : 'var(--bg-sunken)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          {count}
        </span>
      )}
    </button>
  )
}

function EvidenceRow({ ev }: { ev: DiscoverEvidence }) {
  const s = SOURCE_TYPES[ev.sourceType] || { glyph: '·', color: 'var(--fg-muted)', label: ev.sourceType }
  const isDone = ev.candidateCompletion === 'done'
  const isMerged = !!ev.merged
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '36px 1fr auto',
        gap: 12,
        padding: '10px 0',
        borderBottom: '1px solid var(--border-subtle)',
        opacity: isDone ? 0.75 : 1,
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 6,
          flex: 'none',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'var(--font-mono)',
          fontSize: 13,
          fontWeight: 600,
          color: s.color,
          background: `color-mix(in srgb, ${s.color} 12%, var(--bg-sunken))`,
          border: `1px solid color-mix(in srgb, ${s.color} 30%, transparent)`,
        }}
      >
        {s.glyph}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10.5,
              fontWeight: 600,
              color: s.color,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
            }}
          >
            {s.label}
          </span>
          <span style={{ color: 'var(--fg-faint)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>·</span>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11.5,
              color: 'var(--fg-default)',
              background: 'var(--bg-sunken)',
              padding: '1px 6px',
              borderRadius: 3,
              border: '1px solid var(--border-subtle)',
            }}
          >
            {ev.sourceId}
          </span>
          {isMerged && (
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 9.5,
                fontWeight: 600,
                color: 'var(--status-emerged)',
                letterSpacing: '0.06em',
                padding: '1px 5px',
                borderRadius: 3,
                background: 'color-mix(in srgb, var(--status-emerged) 12%, transparent)',
                border: '1px dashed color-mix(in srgb, var(--status-emerged) 40%, transparent)',
                cursor: 'help',
              }}
            >
              ⤳ MERGED
            </span>
          )}
        </div>
        <div
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 13,
            color: 'var(--fg-default)',
            lineHeight: 1.55,
            fontStyle: 'italic',
          }}
        >
          "{ev.evidenceQuote}"
        </div>
      </div>
      <div
        style={{
          textAlign: 'right',
          flex: 'none',
          fontFamily: 'var(--font-mono)',
          fontSize: 10.5,
          color: 'var(--fg-subtle)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: 3,
          whiteSpace: 'nowrap',
        }}
      >
        <span>{ev.lastActivity}</span>
        <span
          style={{
            color:
              ev.candidateCompletion === 'active'
                ? 'var(--status-active)'
                : ev.candidateCompletion === 'done'
                  ? 'var(--status-done)'
                  : ev.candidateCompletion === 'paused'
                    ? 'var(--status-blocked)'
                    : 'var(--fg-faint)',
            fontWeight: 500,
          }}
        >
          {ev.candidateCompletion}
        </span>
      </div>
    </div>
  )
}

function YamlPreview({ yaml, kind }: { yaml: string; kind: string }) {
  return (
    <pre
      style={{
        margin: 0,
        fontFamily: 'var(--font-mono)',
        fontSize: 12.5,
        color: 'var(--fg-default)',
        lineHeight: 1.6,
        background: 'var(--bg-sunken)',
        border: '1px solid var(--border-subtle)',
        borderLeft: `2px solid ${kind === 'plan' ? 'var(--status-emerged)' : 'var(--status-active)'}`,
        borderRadius: 4,
        padding: '14px 16px',
        maxHeight: 380,
        overflow: 'auto',
        whiteSpace: 'pre',
      }}
    >
      {yaml.split('\n').map((line, i) => {
        const m = line.match(/^(\s*)([\w-]+):\s*(.*)$/)
        const dash = line.match(/^(\s*)-\s+(.*)$/)
        if (m) {
          return (
            <div key={i}>
              <span>{m[1]}</span>
              <span style={{ color: 'var(--status-emerged)' }}>{m[2]}</span>
              <span style={{ color: 'var(--fg-muted)' }}>: </span>
              <span
                style={{
                  color: m[3].startsWith("'") || m[3].startsWith('"') ? 'var(--status-done)' : 'var(--fg-default)',
                }}
              >
                {m[3]}
              </span>
            </div>
          )
        }
        if (dash) {
          return (
            <div key={i}>
              <span>{dash[1]}</span>
              <span style={{ color: 'var(--status-active)' }}>- </span>
              <span style={{ color: 'var(--fg-default)' }}>{dash[2]}</span>
            </div>
          )
        }
        return <div key={i}>{line || ' '}</div>
      })}
    </pre>
  )
}

function DetailsBlock({ candidate }: { candidate: DiscoverCandidate }) {
  const [tab, setTab] = useState<'context' | 'evidence' | 'yaml'>('context')
  const bucketColor = (BUCKETS[candidate.bucket] || { color: 'var(--fg-muted)' }).color

  return (
    <div
      style={{
        marginTop: 14,
        background: 'color-mix(in srgb, var(--bg-elevated) 40%, transparent)',
        borderTop: '1px solid var(--border-subtle)',
        borderRadius: '0 0 6px 6px',
        marginLeft: -14,
        marginRight: -14,
        marginBottom: -14,
        padding: '0 18px 18px',
      }}
    >
      {/* Tab bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: 2,
          borderBottom: '1px solid var(--border-subtle)',
          marginBottom: 18,
        }}
      >
        <DetailsTab active={tab === 'context'} glyph="≡" label="Context" onClick={() => setTab('context')} />
        <DetailsTab
          active={tab === 'evidence'}
          glyph="⌬"
          label="Evidence"
          count={candidate.evidence.length}
          onClick={() => setTab('evidence')}
        />
        <DetailsTab active={tab === 'yaml'} glyph="{}" label="YAML preview" onClick={() => setTab('yaml')} />
        <div style={{ flex: 1, borderBottom: '0' }} />
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10.5,
            color: 'var(--fg-faint)',
            padding: '0 6px 8px',
          }}
        >
          {candidate.kind === 'plan' ? 'multi-phase plan' : 'standalone initiative'} · {candidate.bucket}
        </span>
      </div>

      {/* CONTEXT TAB */}
      {tab === 'context' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 720 }}>
          <div
            style={{
              paddingLeft: 14,
              borderLeft: `2px solid ${bucketColor}`,
              fontFamily: 'var(--font-sans)',
              fontSize: 14,
              fontWeight: 500,
              color: 'var(--fg-default)',
              lineHeight: 1.55,
              letterSpacing: '-0.005em',
            }}
          >
            {candidate.rationale}
          </div>

          {candidate.nextAction && (
            <div
              style={{
                display: 'flex',
                gap: 10,
                alignItems: 'flex-start',
                padding: '12px 14px',
                background: 'color-mix(in srgb, var(--status-active) 8%, transparent)',
                border: '1px solid color-mix(in srgb, var(--status-active) 30%, transparent)',
                borderLeft: '3px solid var(--status-active)',
                borderRadius: 6,
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  fontWeight: 600,
                  color: 'var(--status-active)',
                  letterSpacing: '0.06em',
                  padding: '3px 7px',
                  borderRadius: 3,
                  background: 'color-mix(in srgb, var(--status-active) 14%, transparent)',
                  flex: 'none',
                }}
              >
                NEXT
              </span>
              <span
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: 13.5,
                  color: 'var(--fg-default)',
                  lineHeight: 1.5,
                  flex: 1,
                }}
              >
                {candidate.nextAction}
              </span>
            </div>
          )}

          <div>
            <div className="t-eyebrow" style={{ color: 'var(--fg-subtle)', marginBottom: 10 }}>
              CONTEXT
            </div>
            <div
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: 13.5,
                color: 'var(--fg-default)',
                lineHeight: 1.65,
                whiteSpace: 'pre-line',
              }}
            >
              {candidate.contextMarkdown}
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: 8,
              paddingTop: 14,
              borderTop: '1px solid var(--border-subtle)',
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
            }}
          >
            <span className="t-eyebrow" style={{ color: 'var(--fg-subtle)', marginRight: 4 }}>
              SCOPE
            </span>
            {candidate.scopePaths.map((p) => (
              <span
                key={p}
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  padding: '2px 8px',
                  borderRadius: 3,
                  color: 'var(--fg-default)',
                  background: 'var(--bg-sunken)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                {p}
              </span>
            ))}
            {candidate.draftPath && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  marginLeft: 'auto',
                  color: 'var(--fg-subtle)',
                }}
              >
                <span style={{ color: 'var(--fg-faint)' }}>draft →</span>
                <span style={{ color: 'var(--fg-muted)' }}>{candidate.draftPath}</span>
              </span>
            )}
          </div>
        </div>
      )}

      {/* EVIDENCE TAB */}
      {tab === 'evidence' && (
        <div style={{ maxWidth: 920 }}>
          <p
            style={{
              margin: '0 0 6px',
              fontFamily: 'var(--font-sans)',
              fontSize: 12.5,
              color: 'var(--fg-muted)',
              lineHeight: 1.5,
            }}
          >
            {candidate.evidence.length} signal{candidate.evidence.length !== 1 ? 's' : ''} clustered into this
            candidate.
            {candidate.evidence.some((e) => !!e.merged) &&
              ' Dashed border = merged via fuzzy/LLM match (hover for rationale).'}
          </p>
          <div style={{ borderTop: '1px solid var(--border-subtle)' }}>
            {candidate.evidence.map((ev, i) => (
              <EvidenceRow key={i} ev={ev} />
            ))}
          </div>
        </div>
      )}

      {/* YAML TAB */}
      {tab === 'yaml' && (
        <div style={{ maxWidth: 760 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              marginBottom: 10,
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              color: 'var(--fg-subtle)',
            }}
          >
            <span style={{ color: 'var(--fg-muted)' }}>writes to</span>
            <span style={{ color: 'var(--fg-default)' }}>
              {candidate.draftPath ||
                `.atomic-skills/${candidate.slug}.${candidate.kind === 'plan' ? 'plan' : 'initiative'}.draft.md`}
            </span>
            <div style={{ flex: 1 }} />
            <button
              style={{
                all: 'unset',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                height: 24,
                padding: '0 10px',
                fontFamily: 'var(--font-sans)',
                fontSize: 11.5,
                fontWeight: 500,
                color: 'var(--fg-muted)',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-default)',
                borderRadius: 4,
              }}
              onClick={() => {
                try {
                  navigator.clipboard.writeText(candidate.previewYaml)
                } catch {}
              }}
            >
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>⎘</span> Copy
            </button>
          </div>
          <YamlPreview yaml={candidate.previewYaml} kind={candidate.kind} />
        </div>
      )}
    </div>
  )
}

export function CandidateCard({
  candidate: c,
  anchorDate,
  decision,
  submittedDecision,
  onDecide,
  readOnly,
  relations,
  defaultExpanded = false,
}: Props) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const isHistorical = c.bucket === 'historical'
  const effectiveDecision = submittedDecision ?? decision
  const bucketColor = (BUCKETS[c.bucket] || { color: 'var(--fg-muted)' }).color

  const isApproved = effectiveDecision === 'approve'
  const isRejected = effectiveDecision === 'reject'

  const cardOpacity = isRejected ? 0.4 : isHistorical ? 0.65 : 1
  const accentColor = isApproved
    ? 'var(--status-done)'
    : isRejected
      ? 'var(--severity-critical)'
      : bucketColor

  return (
    <article
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-default)',
        borderLeft: `3px solid ${accentColor}`,
        borderRadius: 8,
        boxShadow: 'var(--shadow-ambient)',
        transition: 'opacity 120ms, border-color 120ms, transform 120ms',
        opacity: cardOpacity,
        position: 'relative',
      }}
    >
      {/* Row 1 — header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px 8px' }}>
        <ShapeBadge kind={c.kind} />
        <h3
          style={{
            margin: 0,
            fontFamily: 'var(--font-sans)',
            fontSize: 15.5,
            fontWeight: 600,
            color: 'var(--fg-default)',
            letterSpacing: '-0.015em',
            flex: 1,
            minWidth: 0,
            textDecoration: isRejected ? 'line-through' : 'none',
            textDecorationColor: 'var(--severity-critical)',
          }}
        >
          {c.title}
        </h3>
        {c.branch && <BranchPill branch={c.branch} />}
        {isHistorical && (
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: '0.06em',
              color: 'var(--fg-subtle)',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-default)',
              padding: '2px 6px',
              borderRadius: 3,
            }}
          >
            ARCHIVED
          </span>
        )}
        {submittedDecision && (
          <span
            style={{
              fontSize: 11,
              fontFamily: 'var(--font-mono)',
              color: submittedDecision === 'approve' ? 'var(--status-done)' : 'var(--severity-critical)',
            }}
          >
            {submittedDecision === 'approve' ? '✓ approved' : '✗ rejected'}
          </span>
        )}
        {!readOnly && (
          <div style={{ display: 'flex', gap: 4, flex: 'none' }}>
            <button
              onClick={(e) => {
                e.stopPropagation()
                onDecide(c.slug, decision === 'approve' ? null : 'approve')
              }}
              title="Approve candidate"
              aria-pressed={isApproved}
              style={{
                all: 'unset',
                cursor: 'pointer',
                width: 28,
                height: 28,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'var(--font-mono)',
                fontSize: 13,
                color: isApproved ? 'var(--fg-on-accent)' : 'var(--status-done)',
                background: isApproved
                  ? 'var(--status-done)'
                  : 'color-mix(in srgb, var(--status-done) 8%, transparent)',
                border: `1px solid color-mix(in srgb, var(--status-done) ${isApproved ? 100 : 40}%, transparent)`,
                borderRadius: 4,
                transition: 'background 120ms, border-color 120ms',
              }}
            >
              ✓
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                onDecide(c.slug, decision === 'reject' ? null : 'reject')
              }}
              title="Reject candidate"
              aria-pressed={isRejected}
              style={{
                all: 'unset',
                cursor: 'pointer',
                width: 28,
                height: 28,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'var(--font-mono)',
                fontSize: 13,
                color: isRejected ? 'var(--fg-on-accent)' : 'var(--severity-critical)',
                background: isRejected
                  ? 'var(--severity-critical)'
                  : 'color-mix(in srgb, var(--severity-critical) 8%, transparent)',
                border: `1px solid color-mix(in srgb, var(--severity-critical) ${isRejected ? 100 : 40}%, transparent)`,
                borderRadius: 4,
                transition: 'background 120ms, border-color 120ms',
              }}
            >
              ✗
            </button>
          </div>
        )}
      </div>

      {/* Row 2 — goal */}
      <div
        style={{
          padding: '0 14px 8px',
          fontFamily: 'var(--font-sans)',
          fontSize: 13,
          color: 'var(--fg-muted)',
          lineHeight: 1.5,
        }}
      >
        {c.goal}
      </div>

      {/* Row 2.5 — historical completion summary */}
      {isHistorical && c.completionSummary && (
        <div
          style={{
            margin: '0 14px 10px',
            padding: '8px 10px',
            background: 'var(--bg-sunken)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 4,
            display: 'flex',
            gap: 8,
            fontFamily: 'var(--font-sans)',
            fontSize: 12,
            color: 'var(--fg-muted)',
            lineHeight: 1.5,
          }}
        >
          <span style={{ color: 'var(--status-done)', fontFamily: 'var(--font-mono)', flex: 'none' }}>✓</span>
          <span>{c.completionSummary}</span>
        </div>
      )}

      {/* Row 3 — metadata: confidence + sparkline + slug */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          padding: '0 14px 10px',
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: 'var(--fg-subtle)' }}>confidence</span>
          <ConfidenceBar confidence={c.confidence} breakdown={c.confidenceBreakdown} />
        </div>
        <span style={{ width: 1, height: 14, background: 'var(--border-default)', flex: 'none' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ color: 'var(--fg-subtle)', whiteSpace: 'nowrap' }}>
            activity <span style={{ color: 'var(--fg-faint)' }}>60d</span>
          </span>
          <ActivitySparkline timeline={c.activityTimeline} anchorDate={anchorDate} />
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              color: 'var(--fg-muted)',
              whiteSpace: 'nowrap',
            }}
            title={`${c.activityTimeline.reduce((a, t) => a + t.count, 0)} signal${c.activityTimeline.reduce((a, t) => a + t.count, 0) !== 1 ? 's' : ''} across ${c.activityTimeline.length} active day${c.activityTimeline.length !== 1 ? 's' : ''}`}
          >
            <span style={{ color: 'var(--fg-default)', fontWeight: 500 }}>
              {c.activityTimeline.reduce((a, t) => a + t.count, 0)}
            </span>
            <span style={{ color: 'var(--fg-subtle)' }}>events</span>
            <span style={{ color: 'var(--fg-faint)', margin: '0 2px' }}>·</span>
            <span style={{ color: 'var(--fg-subtle)' }}>last</span>
            <span
              style={{
                color: c.lastUpdated === anchorDate ? 'var(--status-active)' : 'var(--fg-default)',
                fontWeight: 500,
              }}
            >
              {fmtRelativeDays(c.lastUpdated, anchorDate)}
            </span>
          </span>
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 'none' }}>
          <span style={{ color: 'var(--fg-subtle)' }}>slug</span>
          <span
            style={{
              color: 'var(--fg-default)',
              background: 'var(--bg-sunken)',
              padding: '2px 6px',
              borderRadius: 3,
              border: '1px solid var(--border-subtle)',
              whiteSpace: 'nowrap',
            }}
          >
            {c.slug}
          </span>
          {c.slugAlternatives && c.slugAlternatives.length > 0 && (
            <span
              title={`alternatives: ${c.slugAlternatives.join(', ')}`}
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                color: 'var(--fg-subtle)',
                padding: '2px 5px',
                borderRadius: 3,
                border: '1px dashed var(--border-default)',
                whiteSpace: 'nowrap',
                cursor: 'help',
              }}
            >
              ✎ {c.slugAlternatives.length} alt
            </span>
          )}
        </div>
      </div>

      {/* Row 4 — evidence pills */}
      <div style={{ padding: '0 14px 10px', display: 'flex', flexWrap: 'wrap', gap: 5 }}>
        {c.evidence.map((ev, i) => (
          <EvidencePill key={i} evidence={ev} />
        ))}
      </div>

      {/* Row 5 — relationships + expand toggle */}
      <div
        style={{
          padding: '8px 14px',
          borderTop: '1px solid var(--border-subtle)',
          background: 'color-mix(in srgb, var(--bg-elevated) 40%, transparent)',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        {relations && relations.length > 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', minWidth: 0 }}>
            <span className="t-eyebrow" style={{ color: 'var(--fg-subtle)', whiteSpace: 'nowrap' }}>
              RELATED
            </span>
            {relations.map((r, i) => {
              const k = RELATIONSHIP_KINDS[r.kind] || { glyph: '·', label: r.kind }
              return (
                <span
                  key={i}
                  title={`${k.label}${r.sharedIdentifiers.length ? ' · ' + r.sharedIdentifiers.join(', ') : ''} · strength ${r.strength.toFixed(2)}`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                    color: 'var(--fg-muted)',
                    background: 'color-mix(in srgb, var(--status-emerged) 6%, var(--bg-sunken))',
                    border: '1px solid color-mix(in srgb, var(--status-emerged) 22%, transparent)',
                    borderRadius: 3,
                    padding: '2px 8px',
                    cursor: 'help',
                    whiteSpace: 'nowrap',
                    flex: 'none',
                  }}
                >
                  <span style={{ color: 'var(--status-emerged)' }}>{k.glyph}</span>
                  <span style={{ color: 'var(--fg-subtle)' }}>{k.label}</span>
                  <span style={{ color: 'var(--fg-default)' }}>{r.otherSlug}</span>
                  <span
                    style={{
                      display: 'inline-block',
                      width: Math.max(8, r.strength * 22),
                      height: 3,
                      background: 'color-mix(in srgb, var(--status-emerged) 70%, transparent)',
                      borderRadius: 2,
                    }}
                  />
                </span>
              )
            })}
          </div>
        ) : (
          <div />
        )}
        <div style={{ flex: 1 }} />
        <button
          onClick={() => setExpanded(!expanded)}
          style={{
            all: 'unset',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            fontFamily: 'var(--font-sans)',
            fontSize: 11.5,
            fontWeight: 500,
            color: 'var(--fg-muted)',
            padding: '4px 10px',
            borderRadius: 4,
            border: '1px solid var(--border-subtle)',
            background: expanded ? 'var(--bg-elevated)' : 'transparent',
            whiteSpace: 'nowrap',
            flex: 'none',
          }}
        >
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-subtle)' }}>
            {expanded ? '▾' : '▸'}
          </span>
          {expanded ? 'Hide details' : 'Details · context · YAML preview'}
        </button>
      </div>

      {expanded && (
        <div style={{ padding: '0 14px 14px' }}>
          <DetailsBlock candidate={c} />
        </div>
      )}
    </article>
  )
}
