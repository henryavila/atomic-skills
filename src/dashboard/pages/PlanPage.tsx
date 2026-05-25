import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { Btn } from '../components/atoms'
import { ActivePhaseCallout, TrackHeader } from '../components/plan/ActivePhaseCallout'
import { DepGraphOverlay } from '../components/plan/DepGraphOverlay'
import { InconsistencyBanner } from '../components/plan/InconsistencyBanner'
import { PhaseCard, ParallelGroup, groupParallels } from '../components/plan/PhaseCard'
import { PlanHero } from '../components/plan/PlanHero'
import { GlossaryPanel, LegacySection, NarrativePanel, PrinciplesPanel } from '../components/plan/Panels'
import { ReferencesModal } from '../components/plan/ReferencesModal'
import { adaptPlanForUI, type UIPhase } from '../lib/adapters'
import { usePlan, useProjectState } from '../lib/hooks'

export function PlanPage() {
  const navigate = useNavigate()
  const { slug, projectId } = useParams<{ slug: string; projectId?: string }>()
  const { data: planRaw, isLoading, error } = usePlan(slug, projectId)
  const { data: state } = useProjectState()

  const [showPrinciples, setShowPrinciples] = useState(false)
  const [showGlossary, setShowGlossary] = useState(false)
  const [showNarrative, setShowNarrative] = useState(false)
  const [narrativeExpanded, setNarrativeExpanded] = useState(false)
  const [showRefs, setShowRefs] = useState(false)
  const [showGraph, setShowGraph] = useState(false)

  const plan = planRaw ? adaptPlanForUI(planRaw, state?.initiatives ?? []) : null
  const inconsistentPhases = plan
    ? plan.parallelismAllowed
      ? []
      : plan.phases.filter((p) => Array.isArray(p.parallelWith) && p.parallelWith.length > 0)
    : []
  const renderablePhases = useMemo(
    () => {
      if (!plan) return []
      return inconsistentPhases.length > 0
        ? plan.phases.map((p) => ({ ...p, parallelWith: undefined }))
        : plan.phases
    },
    [plan?.phases, inconsistentPhases.length]
  )

  if (isLoading) return <Frame>Loading plan…</Frame>
  if (error)
    return (
      <Frame>
        <p style={{ color: 'var(--severity-critical)' }}>Cannot load plan: {String(error)}</p>
      </Frame>
    )
  if (!plan) return <Frame>Plan not found.</Frame>

  const activePhase = plan.phases.find((p) => p.status === 'active')

  const openPhase = (phase: UIPhase) => {
    // Find the initiative for this phase and navigate to it.
    const init = state?.initiatives.find((i) => i.parentPlan === plan.slug && i.phaseId === phase.id)
    if (init) navigate(`/initiatives/${init.slug}`)
  }

  const trackBuckets = plan.tracks
    .map((track) => ({
      track,
      phases: renderablePhases.filter((p) => (p.track ?? plan.tracks[0]?.id) === track.id),
    }))
    .filter((b) => b.phases.length > 0)
  if (trackBuckets.length === 0 && renderablePhases.length > 0) {
    trackBuckets.push({ track: { id: 'main', title: 'Main' }, phases: renderablePhases })
  }

  return (
    <Frame>
      <PlanHero
        plan={plan}
        refsCount={plan.refs.length}
        onTogglePrinciples={() => setShowPrinciples((v) => !v)}
        onToggleGlossary={() => setShowGlossary((v) => !v)}
        onToggleRefs={() => setShowRefs(true)}
      />

      {inconsistentPhases.length > 0 && <InconsistencyBanner phases={inconsistentPhases} />}

      <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
        <Btn variant={showNarrative ? 'secondary' : 'ghost'} size="sm" onClick={() => setShowNarrative((v) => !v)}>
          {showNarrative ? '▾' : '▸'} {showNarrative ? 'Close' : 'Open'} narrative
        </Btn>
        {plan.refs.length > 0 && (
          <Btn variant="ghost" size="sm" onClick={() => setShowRefs(true)}>
            References{' '}
            <span style={{ color: 'var(--fg-subtle)', fontFamily: 'var(--font-mono)', fontSize: 10, marginLeft: 4 }}>
              {plan.refs.length}
            </span>
          </Btn>
        )}
        <Btn variant="ghost" size="sm" onClick={() => setShowGraph(true)}>
          ⌬ Dependency graph
        </Btn>
        <div style={{ flex: 1 }} />
        {plan.principles.length > 0 && (
          <Btn variant={showPrinciples ? 'secondary' : 'ghost'} size="sm" onClick={() => setShowPrinciples((v) => !v)}>
            {showPrinciples ? '▾' : '▸'} Principles
          </Btn>
        )}
        {plan.glossary.length > 0 && (
          <Btn variant={showGlossary ? 'secondary' : 'ghost'} size="sm" onClick={() => setShowGlossary((v) => !v)}>
            {showGlossary ? '▾' : '▸'} Glossary
          </Btn>
        )}
      </div>

      {showNarrative && plan.narrative && (
        <NarrativePanel
          markdown={plan.narrative}
          expanded={narrativeExpanded}
          onToggleExpanded={() => setNarrativeExpanded((v) => !v)}
        />
      )}
      {showPrinciples && <PrinciplesPanel principles={plan.principles} />}
      {showGlossary && <GlossaryPanel glossary={plan.glossary} />}

      {activePhase && <ActivePhaseCallout phase={activePhase} onOpen={openPhase} />}

      <div style={{ marginTop: 6 }}>
        {trackBuckets.map(({ track, phases }) => {
          const groups = groupParallels(phases)
          return (
            <div key={track.id}>
              {trackBuckets.length > 1 && <TrackHeader track={track} />}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {groups.map((g, i) => {
                  if (g.kind === 'parallel') {
                    return (
                      <ParallelGroup
                        key={`p-${i}`}
                        phases={g.phases}
                        onOpen={openPhase}
                        variant="container"
                      />
                    )
                  }
                  return <PhaseCard key={g.phases[0]!.id} phase={g.phases[0]!} onOpen={openPhase} />
                })}
              </div>
            </div>
          )
        })}
      </div>

      <LegacySection phases={plan.legacyPhases} />

      <ReferencesModal open={showRefs} refs={plan.refs} onClose={() => setShowRefs(false)} />
      <DepGraphOverlay
        open={showGraph}
        plan={plan}
        onClose={() => setShowGraph(false)}
        onOpenPhase={(p) => {
          setShowGraph(false)
          openPhase(p)
        }}
      />
    </Frame>
  )
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '20px 24px 80px', width: '100%', boxSizing: 'border-box' }}>
      {children}
    </div>
  )
}
