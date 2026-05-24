import { useMemo, useState } from 'react'
import { useDiscoverRun, useDiscoverDecisions, usePostDecisions } from '../lib/hooks'
import type { DiscoverCandidate } from '../lib/types'
import { DiscoverHeader } from '../components/discover/DiscoverHeader'
import { CandidateCard } from '../components/discover/CandidateCard'
import { ActionBar } from '../components/discover/ActionBar'

type LocalDecisions = Map<string, { decision: 'approve' | 'reject'; candidate: DiscoverCandidate }>

export function DiscoverPage() {
  const { data: run, isLoading, error } = useDiscoverRun()
  const slugs = useMemo(() => run?.candidates.map((c) => c.slug) ?? [], [run])
  const { data: existingDecisions } = useDiscoverDecisions(slugs)
  const postMutation = usePostDecisions()

  const [localDecisions, setLocalDecisions] = useState<LocalDecisions>(new Map())
  const [filter, setFilter] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  const submittedMap = useMemo(() => {
    const m = new Map<string, 'approve' | 'reject'>()
    if (!existingDecisions) return m
    for (const d of existingDecisions) {
      if (d.target.slug && (d.decision === 'approve' || d.decision === 'reject')) {
        const existing = m.get(d.target.slug)
        if (!existing) m.set(d.target.slug, d.decision)
      }
    }
    return m
  }, [existingDecisions])

  if (isLoading) {
    return <Frame><p style={{ color: 'var(--fg-muted)' }}>Loading discover results…</p></Frame>
  }
  if (error || !run) {
    return (
      <Frame>
        <div style={{ padding: '16px 18px', background: 'color-mix(in srgb, var(--severity-critical) 6%, var(--bg-surface))', border: '1px solid color-mix(in srgb, var(--severity-critical) 35%, transparent)', borderRadius: 8 }}>
          <div className="t-eyebrow" style={{ color: 'var(--severity-critical)', marginBottom: 6 }}>NO DISCOVER DATA</div>
          <p style={{ margin: 0, color: 'var(--fg-muted)', fontSize: 13 }}>
            Run <code className="font-mono">project-plan discover</code> in Claude to generate proposals, then refresh this page.
          </p>
        </div>
      </Frame>
    )
  }

  const isReadOnly = submitted || submittedMap.size > 0

  const bucketOrder = ['strong', 'worth-reviewing', 'historical'] as const
  const filteredCandidates = run.candidates.filter((c) => {
    if (filter === 'tracked') return false
    if (filter && filter !== c.bucket) return false
    return true
  })

  const grouped = bucketOrder
    .map((b) => ({ bucket: b, items: filteredCandidates.filter((c) => c.bucket === b) }))
    .filter((g) => g.items.length > 0)

  const bucketLabels: Record<string, string> = {
    strong: '✓ Strong candidates',
    'worth-reviewing': '? Worth reviewing',
    historical: '◉ Historical',
  }

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
    await postMutation.mutateAsync(entries)
    setSubmitted(true)
  }

  const approveCount = [...localDecisions.values()].filter((d) => d.decision === 'approve').length
  const rejectCount = [...localDecisions.values()].filter((d) => d.decision === 'reject').length
  const totalPending = run.candidates.length - localDecisions.size - submittedMap.size

  return (
    <Frame>
      <DiscoverHeader run={run} activeFilter={filter} onFilter={setFilter} />

      {grouped.map(({ bucket, items }) => (
        <div key={bucket} style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, margin: '0 0 10px', color: 'var(--fg-default)' }}>
            {bucketLabels[bucket]} ({items.length})
          </h2>
          {items.map((c) => (
            <CandidateCard
              key={c.slug}
              candidate={c}
              decision={localDecisions.get(c.slug)?.decision ?? null}
              submittedDecision={submittedMap.get(c.slug)}
              onDecide={handleDecide}
              readOnly={isReadOnly}
            />
          ))}
        </div>
      ))}

      {run.orphanSignals.length > 0 && (!filter || filter === 'orphan') && (
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, margin: '0 0 10px', color: 'var(--fg-default)' }}>
            Unmatched signals ({run.orphanSignals.length})
          </h2>
          {run.orphanSignals.map((o) => (
            <div key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', fontSize: 12, color: 'var(--fg-muted)' }}>
              <span style={{ padding: '2px 8px', borderRadius: 12, background: 'var(--bg-inset)' }}>
                {o.sourceType}: {o.sourceId}
              </span>
              <span style={{ fontStyle: 'italic', flex: 1 }}>{o.evidenceQuote}</span>
            </div>
          ))}
        </div>
      )}

      <div style={{ height: 60 }} />

      <ActionBar
        approveCount={submitted ? submittedMap.size : approveCount}
        rejectCount={submitted ? 0 : rejectCount}
        totalPending={totalPending}
        submitted={isReadOnly}
        submitting={postMutation.isPending}
        onApproveAllStrong={handleApproveAllStrong}
        onSubmit={handleSubmit}
      />
    </Frame>
  )
}

function Frame({ children }: { children: React.ReactNode }) {
  return <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 24px 80px' }}>{children}</div>
}
