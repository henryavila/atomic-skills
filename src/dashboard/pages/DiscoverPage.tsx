import { useMemo, useState } from 'react'
import { useParams } from 'react-router'
import { useDiscoverRun, useDiscoverDecisions, usePostDecisions } from '../lib/hooks'
import type { DiscoverCandidate, DiscoverRelationship, AlreadyTrackedItem } from '../lib/types'
import { DiscoverHeader } from '../components/discover/DiscoverHeader'
import { CandidateCard } from '../components/discover/CandidateCard'
import { ActionBar } from '../components/discover/ActionBar'
import { BUCKETS, SOURCE_TYPES, fmtRelativeDays } from '../components/discover/constants'

type LocalDecisions = Map<string, { decision: 'approve' | 'reject'; candidate: DiscoverCandidate }>

export function DiscoverPage() {
  const { projectId } = useParams<{ projectId?: string }>()
  const { data: run, isLoading, error } = useDiscoverRun(projectId)
  const slugs = useMemo(() => run?.candidates.map((c) => c.slug) ?? [], [run])
  const { data: existingDecisions } = useDiscoverDecisions(slugs)
  const postMutation = usePostDecisions()

  const [localDecisions, setLocalDecisions] = useState<LocalDecisions>(new Map())
  const [activeBuckets, setActiveBuckets] = useState(
    () => new Set(['strong', 'worth-reviewing', 'historical', 'already-tracked']),
  )
  const [submitted, setSubmitted] = useState(false)

  const submittedMap = useMemo(() => {
    const m = new Map<string, 'approve' | 'reject'>()
    if (!existingDecisions) return m
    for (const d of existingDecisions) {
      if (d.target.slug && (d.decision === 'approve' || d.decision === 'reject')) {
        m.set(d.target.slug, d.decision)
      }
    }
    return m
  }, [existingDecisions])

  const grouped = useMemo(() => {
    const g: Record<string, DiscoverCandidate[]> = {
      strong: [],
      'worth-reviewing': [],
      historical: [],
    }
    if (!run) return g
    run.candidates.forEach((c) => {
      if (g[c.bucket]) g[c.bucket].push(c)
    })
    Object.keys(g).forEach((k) => g[k].sort((a, b) => b.confidence - a.confidence))
    return g
  }, [run])

  const relationsBySlug = useMemo(() => {
    const m: Record<string, Array<DiscoverRelationship & { otherSlug: string }>> = {}
    if (!run) return m
    run.relationships.forEach((r) => {
      ;(m[r.fromSlug] = m[r.fromSlug] || []).push({ ...r, otherSlug: r.toSlug })
      ;(m[r.toSlug] = m[r.toSlug] || []).push({ ...r, otherSlug: r.fromSlug })
    })
    Object.keys(m).forEach((k) => m[k].sort((a, b) => b.strength - a.strength))
    return m
  }, [run])

  if (isLoading) {
    return (
      <Frame>
        <p style={{ color: 'var(--fg-muted)' }}>Loading discover results…</p>
      </Frame>
    )
  }
  if (error || !run) {
    return (
      <Frame>
        <div
          style={{
            padding: '16px 18px',
            background: 'color-mix(in srgb, var(--severity-critical) 6%, var(--bg-surface))',
            border: '1px solid color-mix(in srgb, var(--severity-critical) 35%, transparent)',
            borderRadius: 8,
          }}
        >
          <div className="t-eyebrow" style={{ color: 'var(--severity-critical)', marginBottom: 6 }}>
            NO DISCOVER DATA
          </div>
          <p style={{ margin: 0, color: 'var(--fg-muted)', fontSize: 13 }}>
            Run <code className="font-mono">project discover</code> in Claude to generate proposals, then refresh
            this page.
          </p>
        </div>
      </Frame>
    )
  }

  const isReadOnly = submitted
  const anchorDate = run.generatedAt.slice(0, 10)

  const toggleBucket = (b: string) =>
    setActiveBuckets((prev) => {
      const n = new Set(prev)
      if (n.has(b)) n.delete(b)
      else n.add(b)
      return n
    })

  const handleDecide = (slug: string, decision: 'approve' | 'reject' | null) => {
    setLocalDecisions((prev) => {
      const next = new Map(prev)
      if (decision === null) {
        next.delete(slug)
      } else {
        const candidate = run.candidates.find((c) => c.slug === slug)
        if (candidate) next.set(slug, { decision, candidate })
      }
      return next
    })
  }

  const handleApproveAllStrong = () => {
    setLocalDecisions((prev) => {
      const next = new Map(prev)
      for (const c of run.candidates.filter((c) => c.bucket === 'strong')) {
        if (!submittedMap.has(c.slug)) {
          next.set(c.slug, { decision: 'approve', candidate: c })
        }
      }
      return next
    })
  }

  const handleSubmit = async () => {
    const entries = [...localDecisions.values()].map(({ candidate, decision }) => ({
      candidate,
      decision,
    }))
    if (entries.length === 0) return
    if (!entries.every((e) => e.candidate.draftPath)) {
      alert('Some candidates are missing draftPath — cannot submit.')
      return
    }
    try {
      await postMutation.mutateAsync(entries)
      setSubmitted(true)
    } catch {
      // error is surfaced via postMutation.error in ActionBar
    }
  }

  const approveCount = [...localDecisions.values()].filter((d) => d.decision === 'approve').length
  const rejectCount = [...localDecisions.values()].filter((d) => d.decision === 'reject').length
  const strongCount = grouped.strong.length
  const totalShown =
    (['strong', 'worth-reviewing', 'historical'] as const)
      .filter((b) => activeBuckets.has(b))
      .reduce((a, b) => a + grouped[b].length, 0) +
    (activeBuckets.has('already-tracked') ? run.alreadyTracked.length : 0)

  const disableApproveAll =
    strongCount > 0 && grouped.strong.every((c) => localDecisions.get(c.slug)?.decision === 'approve')

  const bucketHints: Record<string, string> = {
    strong: 'highest signal — recommend approving all',
    'worth-reviewing': 'ambiguous — read evidence before approving',
    historical: 'done or abandoned — archived for the record',
  }

  return (
    <Frame>
      <DiscoverHeader run={run} activeBuckets={activeBuckets} onToggleBucket={toggleBucket} />

      {/* Candidate bucket sections */}
      {(['strong', 'worth-reviewing', 'historical'] as const).map(
        (bucketKey) =>
          activeBuckets.has(bucketKey) &&
          grouped[bucketKey].length > 0 && (
            <BucketSection key={bucketKey} bucketKey={bucketKey} hint={bucketHints[bucketKey]}>
              {grouped[bucketKey].map((c) => (
                <CandidateCard
                  key={c.slug}
                  candidate={c}
                  anchorDate={anchorDate}
                  decision={localDecisions.get(c.slug)?.decision ?? null}
                  submittedDecision={submittedMap.get(c.slug)}
                  onDecide={handleDecide}
                  readOnly={isReadOnly}
                  relations={relationsBySlug[c.slug] || []}
                  defaultExpanded={false}
                />
              ))}
            </BucketSection>
          ),
      )}

      {/* Already tracked section */}
      {activeBuckets.has('already-tracked') && run.alreadyTracked.length > 0 && (
        <section style={{ marginTop: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, padding: '0 2px' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--status-emerged)' }}>⇥</span>
            <h2
              style={{
                margin: 0,
                fontFamily: 'var(--font-sans)',
                fontSize: 16,
                fontWeight: 600,
                color: 'var(--fg-default)',
                letterSpacing: '-0.01em',
              }}
            >
              Already tracked
            </h2>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                fontWeight: 600,
                color: 'var(--status-emerged)',
                padding: '1px 7px',
                borderRadius: 999,
                background: 'color-mix(in srgb, var(--status-emerged) 14%, var(--bg-surface))',
                border: '1px solid color-mix(in srgb, var(--status-emerged) 30%, transparent)',
              }}
            >
              {run.alreadyTracked.length}
            </span>
            <div style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-subtle)' }}>
              already a known plan or initiative — no action needed
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {run.alreadyTracked.map((it) => (
              <AlreadyTrackedRow key={typeof it === 'string' ? it : it.slug} item={it} anchorDate={anchorDate} />
            ))}
          </div>
        </section>
      )}

      {/* Orphan signals */}
      {run.orphanSignals.length > 0 && (
        <section style={{ marginTop: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, padding: '0 2px' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--fg-muted)' }}>⌖</span>
            <h2
              style={{
                margin: 0,
                fontFamily: 'var(--font-sans)',
                fontSize: 15,
                fontWeight: 600,
                color: 'var(--fg-default)',
                letterSpacing: '-0.01em',
              }}
            >
              Unmatched signals
            </h2>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                fontWeight: 600,
                color: 'var(--fg-muted)',
                padding: '1px 7px',
                borderRadius: 999,
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-default)',
              }}
            >
              {run.orphanSignals.length}
            </span>
            <div style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-subtle)' }}>
              no cluster matched — drop onto a card, or promote to its own
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {run.orphanSignals.map((s) => (
              <OrphanPill key={s.id} signal={s} anchorDate={anchorDate} />
            ))}
          </div>
        </section>
      )}

      <ActionBar
        approveCount={approveCount}
        rejectCount={rejectCount}
        strongCount={strongCount}
        totalShown={totalShown}
        submitted={submitted}
        submitting={postMutation.isPending}
        error={postMutation.error?.message}
        disableApproveAll={disableApproveAll}
        onApproveAllStrong={handleApproveAllStrong}
        onSubmit={handleSubmit}
      />
    </Frame>
  )
}

function Frame({ children }: { children: React.ReactNode }) {
  return <div style={{ maxWidth: 1280, margin: '0 auto', padding: '24px 24px 80px' }}>{children}</div>
}

function BucketSection({
  bucketKey,
  hint,
  children,
}: {
  bucketKey: string
  hint?: string
  children: React.ReactNode
}) {
  const b = BUCKETS[bucketKey]
  if (!b) return null
  return (
    <section style={{ marginTop: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, padding: '0 2px' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: b.color }}>{b.glyph}</span>
        <h2
          style={{
            margin: 0,
            fontFamily: 'var(--font-sans)',
            fontSize: 16,
            fontWeight: 600,
            color: 'var(--fg-default)',
            letterSpacing: '-0.01em',
          }}
        >
          {b.label}
        </h2>
        <div style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }} />
        {hint && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-subtle)', whiteSpace: 'nowrap' }}>
            {hint}
          </span>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{children}</div>
    </section>
  )
}

function AlreadyTrackedRow({
  item,
  anchorDate,
}: {
  item: AlreadyTrackedItem | string
  anchorDate: string
}) {
  if (typeof item === 'string') {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '8px 12px',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-default)',
          borderLeft: '3px solid var(--status-emerged)',
          borderRadius: 6,
          opacity: 0.78,
          fontFamily: 'var(--font-sans)',
          fontSize: 12.5,
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            fontWeight: 600,
            color: 'var(--status-emerged)',
            letterSpacing: '0.06em',
          }}
        >
          ⇥ TRACKED
        </span>
        <span style={{ color: 'var(--fg-default)', fontWeight: 500 }}>{item}</span>
        <div style={{ flex: 1 }} />
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent-link)' }}>↗</span>
      </div>
    )
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 12px',
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-default)',
        borderLeft: '3px solid var(--status-emerged)',
        borderRadius: 6,
        opacity: 0.78,
        fontFamily: 'var(--font-sans)',
        fontSize: 12.5,
      }}
    >
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          fontWeight: 600,
          color: 'var(--status-emerged)',
          letterSpacing: '0.06em',
        }}
      >
        ⇥ TRACKED
      </span>
      <span style={{ color: 'var(--fg-default)', fontWeight: 500 }}>{item.title}</span>
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          color: 'var(--fg-subtle)',
          background: 'var(--bg-sunken)',
          padding: '1px 6px',
          borderRadius: 3,
          border: '1px solid var(--border-subtle)',
        }}
      >
        {item.trackedAs}
      </span>
      <div style={{ flex: 1 }} />
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-faint)' }}>
        updated {fmtRelativeDays(item.lastUpdated, anchorDate)}
      </span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent-link)' }}>↗</span>
    </div>
  )
}

function OrphanPill({
  signal: s,
  anchorDate,
}: {
  signal: { id: string; sourceType: string; sourceId: string; evidenceQuote: string; lastActivity: string }
  anchorDate: string
}) {
  const st = SOURCE_TYPES[s.sourceType] || { glyph: '·', color: 'var(--fg-muted)', label: s.sourceType }
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 8px 8px 12px',
        background: 'var(--bg-surface)',
        border: '1px dashed var(--border-default)',
        borderRadius: 6,
      }}
    >
      <span
        style={{
          color: st.color,
          fontFamily: 'var(--font-mono)',
          fontSize: 13,
          lineHeight: 1,
          minWidth: 14,
          textAlign: 'center',
        }}
      >
        {st.glyph}
      </span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--font-mono)', fontSize: 11 }}>
          <span style={{ color: 'var(--fg-default)' }}>{s.sourceId}</span>
          <span style={{ color: 'var(--fg-faint)' }}>·</span>
          <span style={{ color: st.color }}>{st.label}</span>
          <span style={{ color: 'var(--fg-faint)' }}>·</span>
          <span style={{ color: 'var(--fg-subtle)' }}>{fmtRelativeDays(s.lastActivity, anchorDate)}</span>
        </div>
        <div style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--fg-muted)', lineHeight: 1.4 }}>
          "{s.evidenceQuote}"
        </div>
      </div>
      <button
        onClick={() => {}}
        style={{
          all: 'unset',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
          height: 26,
          padding: '0 10px',
          fontFamily: 'var(--font-sans)',
          fontSize: 11.5,
          fontWeight: 500,
          color: 'var(--status-emerged)',
          background: 'color-mix(in srgb, var(--status-emerged) 10%, transparent)',
          border: '1px solid color-mix(in srgb, var(--status-emerged) 35%, transparent)',
          borderRadius: 4,
          flex: 'none',
        }}
      >
        + Create candidate
      </button>
    </div>
  )
}
